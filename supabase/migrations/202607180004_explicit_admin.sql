-- Replace the historical oldest-account bootstrap without rewriting applied migration history.
do $$
declare target_id constant uuid := '1c6706e1-47da-4831-8100-e8989c62767a';
begin
  if not exists(select 1 from public.profiles where id = target_id) then
    if exists(select 1 from public.profiles) then raise exception 'Approved administrator profile not found'; end if;
  else
    if not exists(select 1 from auth.users where id = target_id and email_confirmed_at is not null) then
      raise exception 'Approved administrator identity is not confirmed';
    end if;
    update public.profiles set is_admin = true where id = target_id;
    if not exists(select 1 from public.profiles where id = target_id and is_admin) then
      raise exception 'Approved administrator could not be preserved';
    end if;
    update public.profiles set is_admin = false where is_admin and id <> target_id;
    if (select count(*) from public.profiles where is_admin) <> 1 then
      raise exception 'Expected exactly one administrator';
    end if;
  end if;
end;
$$;

create unique index profiles_single_admin on public.profiles ((is_admin)) where is_admin;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare requested text;
begin
  requested := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if requested !~ '^[A-Za-z0-9_.-]{3,30}$' or exists(select 1 from profiles where lower(username) = lower(requested)) then
    requested := 'player_' || left(new.id::text, 8);
  end if;
  insert into profiles(id, username, is_admin) values (new.id, requested, false);
  insert into account_wallets(user_id, balance) values (new.id, 10000);
  insert into wallet_transactions(user_id, amount, balance_after, type, idempotency_key)
  values (new.id, 10000, 10000, 'initial_grant', 'initial:' || new.id::text);
  return new;
end;
$$;
