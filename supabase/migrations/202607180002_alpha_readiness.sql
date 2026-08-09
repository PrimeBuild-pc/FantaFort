-- Social controls, notifications, progression history and alpha operations.
alter table public.profiles add column is_admin boolean not null default false;
update public.profiles set is_admin = true where id = (select id from public.profiles order by created_at limit 1);

alter table public.friendships drop constraint friendships_status_check;
alter table public.friendships add constraint friendships_status_check check (status in ('pending', 'accepted', 'blocked'));

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('friend_request','friend_accepted','league_invite','market_closing','auction_outbid','league_completed')),
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_created on public.notifications(user_id, created_at desc);

create table public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (league_id, target_user_id)
);

create table public.profile_xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete set null,
  type text not null check (type in ('league_completed','league_won')),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, league_id, type)
);

create table public.league_departures (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete set null,
  league_name text not null,
  left_at timestamptz not null default now()
);

create table public.app_errors (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  path text not null,
  message text not null,
  stack text,
  created_at timestamptz not null default now()
);
create index app_errors_created on public.app_errors(created_at desc);

alter table public.notifications enable row level security;
alter table public.league_invites enable row level security;
alter table public.profile_xp_events enable row level security;
alter table public.league_departures enable row level security;
alter table public.app_errors enable row level security;

create policy "read own xp events" on public.profile_xp_events for select using (auth.uid() = user_id);
create policy "read own league departures" on public.league_departures for select using (auth.uid() = user_id);
grant select on public.profile_xp_events, public.league_departures to authenticated;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;
revoke all on function public.is_app_admin() from public;

create policy "admins read app errors" on public.app_errors for select using (is_app_admin());

create or replace function public.request_friend(target_username text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_id uuid; low_id uuid; high_id uuid; requester text;
begin
  select id into target_id from profiles where lower(username) = lower(trim(target_username));
  if target_id is null or target_id = auth.uid() then raise exception 'User not found'; end if;
  low_id := least(auth.uid(), target_id); high_id := greatest(auth.uid(), target_id);
  if exists(select 1 from friendships where user_a = low_id and user_b = high_id and status = 'blocked') then raise exception 'User not available'; end if;
  insert into friendships(user_a, user_b, requested_by) values (low_id, high_id, auth.uid()) on conflict do nothing;
  if found then
    select username into requester from profiles where id = auth.uid();
    insert into notifications(user_id, type, metadata) values (target_id, 'friend_request', jsonb_build_object('username', requester));
  end if;
end;
$$;

create or replace function public.accept_friend(friend_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare accepter text;
begin
  update friendships set status = 'accepted'
  where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id)
    and status = 'pending' and requested_by <> auth.uid();
  if not found then raise exception 'Friend request not found'; end if;
  select username into accepter from profiles where id = auth.uid();
  insert into notifications(user_id, type, metadata) values (friend_id, 'friend_accepted', jsonb_build_object('username', accepter));
end;
$$;

create function public.reject_friend(friend_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from friendships where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id)
    and status = 'pending' and requested_by <> auth.uid();
  if not found then raise exception 'Friend request not found'; end if;
end;
$$;

create function public.cancel_friend_request(friend_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from friendships where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id)
    and status = 'pending' and requested_by = auth.uid();
  if not found then raise exception 'Friend request not found'; end if;
end;
$$;

create function public.remove_friend(friend_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from friendships where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id) and status = 'accepted';
  if not found then raise exception 'Friend not found'; end if;
end;
$$;

create function public.block_user(friend_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if friend_id = auth.uid() or not exists(select 1 from profiles where id = friend_id) then raise exception 'User not found'; end if;
  if exists(select 1 from friendships where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id)
    and status = 'blocked' and requested_by <> auth.uid()) then raise exception 'User not available'; end if;
  insert into friendships(user_a, user_b, requested_by, status)
  values (least(auth.uid(), friend_id), greatest(auth.uid(), friend_id), auth.uid(), 'blocked')
  on conflict (user_a, user_b) do update set requested_by = auth.uid(), status = 'blocked', created_at = now();
end;
$$;

create function public.unblock_user(friend_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from friendships where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id)
    and status = 'blocked' and requested_by = auth.uid();
  if not found then raise exception 'Blocked user not found'; end if;
end;
$$;

create or replace function public.get_friends()
returns table(id uuid, username text, name_style text, online boolean, pending boolean, incoming boolean)
language sql security definer set search_path = public
as $$
  select p.id, p.username, p.name_style, p.last_seen_at > now() - interval '2 minutes',
    f.status = 'pending', f.status = 'pending' and f.requested_by <> auth.uid()
  from friendships f
  join profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b) and f.status <> 'blocked'
  order by f.status, p.username;
$$;

create function public.get_blocked_users()
returns table(id uuid, username text)
language sql security definer set search_path = public
as $$
  select p.id, p.username from friendships f
  join profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b) and f.status = 'blocked' and f.requested_by = auth.uid()
  order by p.username;
$$;

create function public.invite_friend_to_league(target_league uuid, friend_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare invite_id uuid; league_name text; inviter text;
begin
  select name into league_name from leagues where id = target_league and status = 'lobby' and is_league_member(id);
  if league_name is null then raise exception 'Lobby league required'; end if;
  if not exists(select 1 from friendships where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id) and status = 'accepted') then raise exception 'Accepted friend required'; end if;
  if exists(select 1 from league_members where league_id = target_league and user_id = friend_id) then raise exception 'Friend already joined'; end if;
  delete from league_invites where league_id = target_league and target_user_id = friend_id and status = 'declined';
  insert into league_invites(league_id, target_user_id, invited_by) values (target_league, friend_id, auth.uid())
  returning id into invite_id;
  select username into inviter from profiles where id = auth.uid();
  insert into notifications(user_id, type, metadata, dedupe_key)
  values (friend_id, 'league_invite', jsonb_build_object('league_id', target_league, 'league_name', league_name, 'username', inviter), 'league-invite:' || invite_id::text);
  return invite_id;
exception when unique_violation then raise exception 'Invite already sent';
end;
$$;

create function public.get_league_invites()
returns table(id uuid, league_id uuid, league_name text, inviter text, created_at timestamptz)
language sql security definer set search_path = public
as $$
  select i.id, i.league_id, l.name, p.username, i.created_at
  from league_invites i join leagues l on l.id = i.league_id join profiles p on p.id = i.invited_by
  where i.target_user_id = auth.uid() and i.status = 'pending' and l.status = 'lobby'
  order by i.created_at desc;
$$;

create function public.respond_league_invite(invite_id uuid, accept_invite boolean)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target league_invites; code text; joined uuid;
begin
  select * into target from league_invites where id = invite_id and target_user_id = auth.uid() and status = 'pending' for update;
  if target.id is null then raise exception 'Invite not found'; end if;
  if accept_invite then
    select invite_code into code from leagues where id = target.league_id and status = 'lobby';
    if code is null then raise exception 'League is no longer available'; end if;
    joined := join_league(code);
    update league_invites set status = 'accepted', responded_at = now() where id = invite_id;
    return joined;
  end if;
  update league_invites set status = 'declined', responded_at = now() where id = invite_id;
  return null;
end;
$$;

create function public.get_notifications()
returns table(id bigint, type text, metadata jsonb, read boolean, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  insert into notifications(user_id, type, metadata, dedupe_key)
  select auth.uid(), 'market_closing', jsonb_build_object('league_id', l.id, 'league_name', l.name, 'closes_at', l.market_closes_at), 'market-closing:' || l.id::text
  from leagues l join league_members m on m.league_id = l.id
  where m.user_id = auth.uid() and l.status = 'active' and l.market_closes_at > now() and l.market_closes_at <= now() + interval '1 hour'
  on conflict (user_id, dedupe_key) do nothing;
  return query select n.id, n.type, n.metadata, n.read_at is not null, n.created_at
  from notifications n where n.user_id = auth.uid() order by n.created_at desc limit 50;
end;
$$;

create function public.mark_notifications_read()
returns void language sql security definer set search_path = public
as $$ update notifications set read_at = now() where user_id = auth.uid() and read_at is null $$;

create or replace function public.place_auction_bid(target_auction bigint, bid_amount integer)
returns void language plpgsql security definer set search_path = public
as $$
declare auction_row league_auctions; member_row league_members; minimum integer; slots integer; prior integer; league_name text; player_name text;
begin
  select * into auction_row from league_auctions where id = target_auction and status = 'active' for update;
  if auction_row.id is null or auction_row.ends_at <= now() then raise exception 'Auction is closed'; end if;
  if not is_league_member(auction_row.league_id) then raise exception 'Not a league member'; end if;
  select roster_size, name into slots, league_name from leagues where id = auction_row.league_id and status = 'active' and draft_mode = 'auction' and now() < market_closes_at;
  if slots is null then raise exception 'Auction market is closed'; end if;
  if (select count(*) from league_roster_entries where league_id = auction_row.league_id and user_id = auth.uid() and released_at is null) >= slots then raise exception 'Roster is full'; end if;
  minimum := coalesce(auction_row.current_bid + 100, auction_row.starting_bid);
  if bid_amount < minimum then raise exception 'Bid is below the minimum'; end if;
  select * into member_row from league_members where league_id = auction_row.league_id and user_id = auth.uid() for update;
  prior := case when auction_row.bidder_id = auth.uid() then coalesce(auction_row.current_bid, 0) else 0 end;
  if member_row.coins - member_row.reserved_coins + prior < bid_amount then raise exception 'Not enough available league coins'; end if;
  if auction_row.bidder_id is not null and auction_row.bidder_id <> auth.uid() then
    update league_members set reserved_coins = reserved_coins - auction_row.current_bid where league_id = auction_row.league_id and user_id = auction_row.bidder_id;
    select handle into player_name from players where id = auction_row.player_id;
    insert into notifications(user_id, type, metadata, dedupe_key)
    values (auction_row.bidder_id, 'auction_outbid', jsonb_build_object('league_id', auction_row.league_id, 'league_name', league_name, 'player', player_name, 'bid', bid_amount),
      'outbid:' || target_auction::text || ':' || bid_amount::text);
  end if;
  update league_members set reserved_coins = reserved_coins - prior + bid_amount where league_id = auction_row.league_id and user_id = auth.uid();
  update league_auctions set current_bid = bid_amount, bidder_id = auth.uid() where id = target_auction;
end;
$$;

create or replace function public.finish_league(target_league uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target leagues; winner uuid; stake_row record; pot integer := 0; wallet_row account_wallets; winner_name text;
begin
  select * into target from leagues where id = target_league and owner_id = auth.uid() and status = 'active' for update;
  if target.id is null then raise exception 'Only the owner can finish an active league'; end if;
  if target.economy_mode = 'account_stake' and now() < target.ends_at then raise exception 'A staked league can only finish at its scheduled end'; end if;
  if exists(select 1 from league_auctions where league_id = target_league and status = 'active') then raise exception 'Settle the active auction first'; end if;
  select d.user_id into winner from get_league_dashboard(target_league) d order by d.points desc, d.username limit 1;
  select username into winner_name from profiles where id = winner;
  select coalesce(sum(amount), 0) into pot from league_stakes where league_id = target_league and status = 'locked';
  for stake_row in select * from league_stakes where league_id = target_league and status = 'locked' for update loop
    update account_wallets set locked_balance = locked_balance - stake_row.amount, updated_at = now() where user_id = stake_row.user_id returning * into wallet_row;
    if stake_row.user_id = winner then
      update account_wallets set balance = balance + pot, updated_at = now() where user_id = winner returning * into wallet_row;
      insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
      values (winner, pot, wallet_row.balance, 'league_prize', 'league', target_league::text, 'league-prize:' || target_league::text || ':' || winner::text, jsonb_build_object('pot', pot));
    else
      insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
      values (stake_row.user_id, 0, wallet_row.balance, 'league_loss', 'league', target_league::text, 'league-loss:' || target_league::text || ':' || stake_row.user_id::text, jsonb_build_object('stake', stake_row.amount));
    end if;
    update league_stakes set status = 'paid', settled_at = now() where league_id = target_league and user_id = stake_row.user_id;
  end loop;
  update leagues set status = 'completed', ends_at = least(coalesce(ends_at, now()), now()) where id = target_league;
  insert into profile_xp_events(user_id, league_id, type, amount)
    select user_id, target_league, 'league_completed', 100 from league_members where league_id = target_league;
  insert into profile_xp_events(user_id, league_id, type, amount) values (winner, target_league, 'league_won', 100);
  update profiles set reward_points = reward_points + case when id = winner then 100 else 0 end,
    experience_points = experience_points + case when id = winner then 200 else 100 end
  where id in (select user_id from league_members where league_id = target_league);
  insert into notifications(user_id, type, metadata, dedupe_key)
  select user_id, 'league_completed', jsonb_build_object('league_id', target_league, 'league_name', target.name, 'winner', winner_name, 'xp', case when user_id = winner then 200 else 100 end),
    'league-completed:' || target_league::text from league_members where league_id = target_league;
  return winner;
end;
$$;

create or replace function public.leave_league(target_league uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target leagues;
begin
  select * into target from leagues where id = target_league for update;
  if target.id is null or not is_league_member(target_league) then raise exception 'Not a league member'; end if;
  if target.owner_id = auth.uid() then raise exception 'Owner must cancel or finish the league'; end if;
  if target.status = 'lobby' then
    perform refund_league_stake_for_user(target_league, auth.uid());
  elsif target.status = 'active' then
    if target.economy_mode <> 'demo' then raise exception 'Staked leagues cannot be left while active'; end if;
    if exists(select 1 from league_auctions where league_id = target_league and status = 'active' and bidder_id = auth.uid()) then raise exception 'Settle the auction before leaving'; end if;
    update league_roster_entries set released_at = now() where league_id = target_league and user_id = auth.uid() and released_at is null;
    insert into league_departures(user_id, league_id, league_name) values (auth.uid(), target_league, target.name);
  else raise exception 'League is already closed';
  end if;
  delete from league_members where league_id = target_league and user_id = auth.uid();
end;
$$;

create function public.delete_account(confirm_username text)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and username = confirm_username) then raise exception 'Username confirmation does not match'; end if;
  if exists(select 1 from public.league_members m join public.leagues l on l.id = m.league_id where m.user_id = auth.uid() and l.status in ('lobby','active')) then raise exception 'Leave or close open leagues first'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

create function public.log_client_error(error_message text, error_path text, error_stack text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into app_errors(user_id, path, message, stack) values (auth.uid(), left(coalesce(error_path, '/'), 500), left(coalesce(error_message, 'Unknown error'), 2000), left(error_stack, 8000));
end;
$$;

create function public.get_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_app_admin() then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'activeLeagues', (select count(*) from leagues where status = 'active'),
    'pendingFriendRequests', (select count(*) from friendships where status = 'pending'),
    'players', (select count(*) from players where active),
    'errors24h', (select count(*) from app_errors where created_at > now() - interval '24 hours'),
    'latestSync', (select max(synced_at) from tournaments)
  );
end;
$$;

create function public.get_admin_errors()
returns table(id bigint, path text, message text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_app_admin() then raise exception 'Admin access required'; end if;
  return query select e.id, e.path, e.message, e.created_at from app_errors e order by e.created_at desc limit 50;
end;
$$;

revoke all on function public.reject_friend(uuid), public.cancel_friend_request(uuid), public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.get_blocked_users(), public.invite_friend_to_league(uuid,uuid), public.get_league_invites(), public.respond_league_invite(uuid,boolean),
  public.get_notifications(), public.mark_notifications_read(), public.delete_account(text), public.log_client_error(text,text,text),
  public.get_admin_overview(), public.get_admin_errors() from public;
grant execute on function public.reject_friend(uuid), public.cancel_friend_request(uuid), public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.get_blocked_users(), public.invite_friend_to_league(uuid,uuid), public.get_league_invites(), public.respond_league_invite(uuid,boolean),
  public.get_notifications(), public.mark_notifications_read(), public.delete_account(text), public.log_client_error(text,text,text),
  public.get_admin_overview(), public.get_admin_errors() to authenticated;
