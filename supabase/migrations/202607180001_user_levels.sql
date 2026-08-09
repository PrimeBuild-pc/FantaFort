alter table public.profiles
  add column experience_points integer not null default 0 check (experience_points >= 0);

-- Existing completed leagues count as participation XP; historical winners are not reconstructable reliably.
update public.profiles p
set experience_points = 100 * (
  select count(*)
  from public.league_members m
  join public.leagues l on l.id = m.league_id
  where m.user_id = p.id and l.status = 'completed'
);

-- Completing a league awards 100 XP to every member and another 100 XP to the winner.
create or replace function public.finish_league(target_league uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target leagues; winner uuid; stake_row record; pot integer := 0; wallet_row account_wallets;
begin
  select * into target from leagues where id = target_league and owner_id = auth.uid() and status = 'active' for update;
  if target.id is null then raise exception 'Only the owner can finish an active league'; end if;
  if target.economy_mode = 'account_stake' and now() < target.ends_at then
    raise exception 'A staked league can only finish at its scheduled end';
  end if;
  if exists(select 1 from league_auctions where league_id = target_league and status = 'active') then
    raise exception 'Settle the active auction first';
  end if;
  select d.user_id into winner from get_league_dashboard(target_league) d order by d.points desc, d.username limit 1;
  select coalesce(sum(amount), 0) into pot from league_stakes where league_id = target_league and status = 'locked';
  for stake_row in select * from league_stakes where league_id = target_league and status = 'locked' for update loop
    update account_wallets set locked_balance = locked_balance - stake_row.amount, updated_at = now()
    where user_id = stake_row.user_id returning * into wallet_row;
    if stake_row.user_id = winner then
      update account_wallets set balance = balance + pot, updated_at = now() where user_id = winner returning * into wallet_row;
      insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
      values (winner, pot, wallet_row.balance, 'league_prize', 'league', target_league::text,
        'league-prize:' || target_league::text || ':' || winner::text, jsonb_build_object('pot', pot));
    else
      insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
      values (stake_row.user_id, 0, wallet_row.balance, 'league_loss', 'league', target_league::text,
        'league-loss:' || target_league::text || ':' || stake_row.user_id::text, jsonb_build_object('stake', stake_row.amount));
    end if;
    update league_stakes set status = 'paid', settled_at = now()
    where league_id = target_league and user_id = stake_row.user_id;
  end loop;
  update leagues set status = 'completed', ends_at = least(coalesce(ends_at, now()), now()) where id = target_league;
  update profiles
  set reward_points = reward_points + case when id = winner then 100 else 0 end,
      experience_points = experience_points + case when id = winner then 200 else 100 end
  where id in (select user_id from league_members where league_id = target_league);
  return winner;
end;
$$;
