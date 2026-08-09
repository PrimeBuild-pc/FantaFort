-- Account wallet, virtual trading, equal-stake leagues, gifts, recovery grants and auction drafts.
create table public.account_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 10000 check (balance >= 0),
  locked_balance integer not null default 0 check (locked_balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  type text not null check (type in (
    'initial_grant', 'migration', 'trade_buy', 'trade_sell', 'daily_rescue',
    'gift_sent', 'gift_received', 'league_lock', 'league_refund', 'league_prize', 'league_loss'
  )),
  reference_type text,
  reference_id text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_created on public.wallet_transactions(user_id, created_at desc);

create table public.account_positions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  acquired_price integer not null check (acquired_price > 0),
  acquired_at timestamptz not null default now(),
  primary key (user_id, player_id)
);

create table public.account_watchlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, player_id)
);

alter table public.leagues
  add column economy_mode text not null default 'demo' check (economy_mode in ('demo', 'account_stake')),
  add column entry_stake integer not null default 0 check (entry_stake in (0, 500, 1000, 2000)),
  add column prize_rule text not null default 'winner_take_all' check (prize_rule = 'winner_take_all'),
  add column draft_mode text not null default 'market' check (draft_mode in ('market', 'auction'));

alter table public.league_members
  add column reserved_coins integer not null default 0,
  add constraint league_members_reserved_coins_check check (reserved_coins between 0 and coins);

alter table public.leagues drop constraint leagues_status_check;
alter table public.leagues add constraint leagues_status_check check (status in ('lobby', 'active', 'completed', 'cancelled'));

create table public.league_stakes (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount in (500, 1000, 2000)),
  status text not null default 'locked' check (status in ('locked', 'paid', 'refunded')),
  locked_at timestamptz not null default now(),
  settled_at timestamptz,
  primary key (league_id, user_id)
);

create table public.league_auctions (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id text not null references public.players(id),
  starting_bid integer not null check (starting_bid > 0),
  current_bid integer,
  bidder_id uuid references public.profiles(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'sold', 'expired', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  check (ends_at > starts_at),
  check ((current_bid is null and bidder_id is null) or (current_bid >= starting_bid and bidder_id is not null))
);
create unique index one_active_auction_per_league on public.league_auctions(league_id) where status = 'active';
create unique index one_active_player_auction_per_league on public.league_auctions(league_id, player_id) where status = 'active';

insert into public.account_wallets(user_id, balance)
select id, coins from public.profiles
on conflict (user_id) do nothing;

insert into public.wallet_transactions(user_id, amount, balance_after, type, idempotency_key, metadata)
select id, coins, coins, 'migration', 'migration:' || id::text, jsonb_build_object('source', 'profiles.coins')
from public.profiles
on conflict (idempotency_key) do nothing;

insert into public.account_positions(user_id, player_id, acquired_price, acquired_at)
select distinct on (user_id, player_id) user_id, player_id, acquired_price, acquired_at
from public.roster_entries where released_at is null
order by user_id, player_id, acquired_at desc
on conflict (user_id, player_id) do nothing;

alter table public.account_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.account_positions enable row level security;
alter table public.account_watchlist enable row level security;
alter table public.league_stakes enable row level security;
alter table public.league_auctions enable row level security;

create policy "read own account wallet" on public.account_wallets for select using (auth.uid() = user_id);
create policy "read own wallet transactions" on public.wallet_transactions for select using (auth.uid() = user_id);
create policy "read own account positions" on public.account_positions for select using (auth.uid() = user_id);
create policy "manage own watchlist" on public.account_watchlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "members read league stakes" on public.league_stakes for select using (is_league_member(league_id));
create policy "members read league auctions" on public.league_auctions for select using (is_league_member(league_id));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare requested text;
begin
  requested := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if requested !~ '^[A-Za-z0-9_.-]{3,30}$' or exists(select 1 from profiles where lower(username) = lower(requested)) then
    requested := 'player_' || left(new.id::text, 8);
  end if;
  insert into profiles(id, username) values (new.id, requested);
  insert into account_wallets(user_id, balance) values (new.id, 10000);
  insert into wallet_transactions(user_id, amount, balance_after, type, idempotency_key)
  values (new.id, 10000, 10000, 'initial_grant', 'initial:' || new.id::text);
  return new;
end;
$$;

create function public.account_net_worth(target_user uuid)
returns bigint language sql stable security definer set search_path = public
as $$
  select coalesce(w.balance + w.locked_balance, 0) + coalesce(sum(p.price), 0)
  from account_wallets w
  left join account_positions ap on ap.user_id = w.user_id
  left join players p on p.id = ap.player_id
  where w.user_id = target_user
  group by w.user_id, w.balance, w.locked_balance;
$$;

create function public.get_account_portfolio()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'balance', w.balance,
    'lockedBalance', w.locked_balance,
    'holdingsValue', coalesce(positions.value, 0),
    'totalEquity', w.balance + w.locked_balance + coalesce(positions.value, 0),
    'unrealizedPnl', coalesce(positions.pnl, 0),
    'positions', coalesce(positions.items, '[]'::jsonb)
  )
  from account_wallets w
  left join lateral (
    select sum(p.price)::bigint value, sum(p.price - ap.acquired_price)::bigint pnl,
      jsonb_agg(jsonb_build_object(
        'playerId', p.id, 'handle', p.handle, 'photoUrl', p.photo_url, 'rarity', p.rarity,
        'currentPrice', p.price, 'acquiredPrice', ap.acquired_price, 'acquiredAt', ap.acquired_at,
        'pnl', p.price - ap.acquired_price
      ) order by p.price desc) items
    from account_positions ap join players p on p.id = ap.player_id
    where ap.user_id = w.user_id
  ) positions on true
  where w.user_id = auth.uid();
$$;

create function public.get_wallet_history(page_index integer default 0)
returns table(id bigint, amount integer, balance_after integer, type text, reference_type text, reference_id text, metadata jsonb, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select t.id, t.amount, t.balance_after, t.type, t.reference_type, t.reference_id, t.metadata, t.created_at
  from wallet_transactions t where t.user_id = auth.uid()
  order by t.created_at desc limit 50 offset greatest(page_index, 0) * 50;
$$;

create function public.account_buy_player(target_player_id text, request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare player_row players; wallet_row account_wallets; trades integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text and user_id = auth.uid()) then return; end if;
  if not exists(select 1 from tournaments where synced_at > now() - interval '30 minutes') then raise exception 'Market data is stale'; end if;
  select count(*) into trades from wallet_transactions where user_id = auth.uid()
    and type in ('trade_buy', 'trade_sell') and created_at >= date_trunc('day', now());
  if trades >= 50 then raise exception 'Daily trade limit reached'; end if;
  select * into player_row from players where id = target_player_id and active for share;
  if player_row.id is null then raise exception 'Player unavailable'; end if;
  if exists(select 1 from account_positions where user_id = auth.uid() and player_id = target_player_id) then raise exception 'Player already in portfolio'; end if;
  select * into wallet_row from account_wallets where user_id = auth.uid() for update;
  if wallet_row.balance < player_row.price then raise exception 'Not enough account coins'; end if;
  insert into account_positions(user_id, player_id, acquired_price) values (auth.uid(), target_player_id, player_row.price);
  update account_wallets set balance = balance - player_row.price, updated_at = now() where user_id = auth.uid()
    returning * into wallet_row;
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
  values (auth.uid(), -player_row.price, wallet_row.balance, 'trade_buy', 'player', target_player_id, request_id::text,
    jsonb_build_object('handle', player_row.handle, 'price', player_row.price));
end;
$$;

create function public.account_sell_player(target_player_id text, request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare player_row players; position_row account_positions; wallet_row account_wallets; refund integer; trades integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text and user_id = auth.uid()) then return; end if;
  if not exists(select 1 from tournaments where synced_at > now() - interval '30 minutes') then raise exception 'Market data is stale'; end if;
  select count(*) into trades from wallet_transactions where user_id = auth.uid()
    and type in ('trade_buy', 'trade_sell') and created_at >= date_trunc('day', now());
  if trades >= 50 then raise exception 'Daily trade limit reached'; end if;
  select * into position_row from account_positions where user_id = auth.uid() and player_id = target_player_id for update;
  if position_row.player_id is null then raise exception 'Player not in portfolio'; end if;
  select * into player_row from players where id = target_player_id for share;
  refund := greatest(1, floor(player_row.price * .95))::integer;
  select * into wallet_row from account_wallets where user_id = auth.uid() for update;
  delete from account_positions where user_id = auth.uid() and player_id = target_player_id;
  update account_wallets set balance = balance + refund, updated_at = now() where user_id = auth.uid()
    returning * into wallet_row;
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
  values (auth.uid(), refund, wallet_row.balance, 'trade_sell', 'player', target_player_id, request_id::text,
    jsonb_build_object('handle', player_row.handle, 'marketPrice', player_row.price, 'salePrice', refund,
      'acquiredPrice', position_row.acquired_price, 'realizedPnl', refund - position_row.acquired_price));
end;
$$;

create or replace function public.buy_player(target_player_id text)
returns void language plpgsql security definer set search_path = public
as $$ begin perform account_buy_player(target_player_id, gen_random_uuid()); end; $$;

create or replace function public.sell_player(target_player_id text)
returns void language plpgsql security definer set search_path = public
as $$ begin perform account_sell_player(target_player_id, gen_random_uuid()); end; $$;

create function public.claim_daily_rescue(request_id uuid)
returns integer language plpgsql security definer set search_path = public
as $$
declare wallet_row account_wallets; grant_amount integer; worth bigint;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text and user_id = auth.uid()) then return 0; end if;
  if not exists(select 1 from profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.created_at <= now() - interval '7 days' and u.email_confirmed_at is not null)
    then raise exception 'Account must be verified and 7 days old'; end if;
  if exists(select 1 from wallet_transactions where user_id = auth.uid() and type = 'daily_rescue'
    and created_at > now() - interval '24 hours') then raise exception 'Recovery already claimed'; end if;
  select * into wallet_row from account_wallets where user_id = auth.uid() for update;
  worth := account_net_worth(auth.uid());
  if wallet_row.balance >= 500 or worth >= 1500 then raise exception 'Recovery is only available below the safety threshold'; end if;
  grant_amount := least(100, 500 - wallet_row.balance);
  update account_wallets set balance = balance + grant_amount, updated_at = now() where user_id = auth.uid()
    returning * into wallet_row;
  insert into wallet_transactions(user_id, amount, balance_after, type, idempotency_key)
  values (auth.uid(), grant_amount, wallet_row.balance, 'daily_rescue', request_id::text);
  return grant_amount;
end;
$$;

create function public.gift_coins(friend_id uuid, amount integer, request_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare sender account_wallets; receiver account_wallets; sent_today integer;
begin
  if auth.uid() is null or friend_id = auth.uid() then raise exception 'Invalid recipient'; end if;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text || ':sent' and user_id = auth.uid()) then return; end if;
  if amount not between 10 and 300 then raise exception 'Gift must be 10-300 coins'; end if;
  if not exists(select 1 from profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.created_at <= now() - interval '7 days' and u.email_confirmed_at is not null)
    then raise exception 'Account must be verified and 7 days old'; end if;
  if not exists(select 1 from friendships where user_a = least(auth.uid(), friend_id)
    and user_b = greatest(auth.uid(), friend_id) and status = 'accepted') then raise exception 'Accepted friend required'; end if;
  select coalesce(-sum(t.amount), 0) into sent_today from wallet_transactions t
    where t.user_id = auth.uid() and t.type = 'gift_sent' and t.created_at >= date_trunc('day', now());
  if sent_today + amount > 300 then raise exception 'Daily gift limit exceeded'; end if;
  perform 1 from account_wallets where user_id in (auth.uid(), friend_id) order by user_id for update;
  select * into sender from account_wallets where user_id = auth.uid();
  select * into receiver from account_wallets where user_id = friend_id;
  if sender.balance - amount < 100 then raise exception 'Keep at least 100 coins'; end if;
  update account_wallets set balance = balance - amount, updated_at = now() where user_id = auth.uid() returning * into sender;
  update account_wallets set balance = balance + amount, updated_at = now() where user_id = friend_id returning * into receiver;
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key)
  values
    (auth.uid(), -amount, sender.balance, 'gift_sent', 'user', friend_id::text, request_id::text || ':sent'),
    (friend_id, amount, receiver.balance, 'gift_received', 'user', auth.uid()::text, request_id::text || ':received');
end;
$$;

create function public.lock_league_stake_for_user(target_league uuid, target_user uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare league_row leagues; wallet_row account_wallets; worth bigint;
begin
  select * into league_row from leagues where id = target_league for update;
  if league_row.economy_mode <> 'account_stake' or league_row.entry_stake = 0 then return; end if;
  if exists(select 1 from league_stakes where league_id = target_league and user_id = target_user) then return; end if;
  select * into wallet_row from account_wallets where user_id = target_user for update;
  worth := account_net_worth(target_user);
  if league_row.entry_stake > least(2000, floor(worth * .20)) then raise exception 'Entry exceeds the account risk limit'; end if;
  if wallet_row.balance < league_row.entry_stake then raise exception 'Not enough account coins for entry'; end if;
  update account_wallets set balance = balance - league_row.entry_stake,
    locked_balance = locked_balance + league_row.entry_stake, updated_at = now()
  where user_id = target_user returning * into wallet_row;
  insert into league_stakes(league_id, user_id, amount) values (target_league, target_user, league_row.entry_stake);
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key)
  values (target_user, -league_row.entry_stake, wallet_row.balance, 'league_lock', 'league', target_league::text,
    'league-lock:' || target_league::text || ':' || target_user::text);
end;
$$;

create function public.refund_league_stake_for_user(target_league uuid, target_user uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare stake_row league_stakes; wallet_row account_wallets;
begin
  select * into stake_row from league_stakes where league_id = target_league and user_id = target_user and status = 'locked' for update;
  if stake_row.user_id is null then return; end if;
  update account_wallets set balance = balance + stake_row.amount,
    locked_balance = locked_balance - stake_row.amount, updated_at = now()
  where user_id = target_user returning * into wallet_row;
  update league_stakes set status = 'refunded', settled_at = now() where league_id = target_league and user_id = target_user;
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key)
  values (target_user, stake_row.amount, wallet_row.balance, 'league_refund', 'league', target_league::text,
    'league-refund:' || target_league::text || ':' || target_user::text)
  on conflict (idempotency_key) do nothing;
end;
$$;

-- Replace league creation with explicit economy and draft settings.
drop function public.create_league(text,integer,integer,integer,integer,text);
create function public.create_league(
  league_name text, budget integer, slots integer, market_hours integer, league_days integer,
  mode text, economy text, stake integer, draft text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid; code text;
begin
  league_name := trim(league_name);
  if char_length(league_name) not between 3 and 40 then raise exception 'League name must be 3-40 characters'; end if;
  if budget not between 6000 and 30000 then raise exception 'Budget must be 6,000-30,000'; end if;
  if slots not between 2 and 4 then raise exception 'Roster must have 2-4 players'; end if;
  if market_hours not between 1 and 168 then raise exception 'Market duration must be 1-168 hours'; end if;
  if league_days not between 1 and 365 then raise exception 'League duration must be 1-365 days'; end if;
  if mode not in ('classic', 'balanced', 'formation') then raise exception 'Invalid scoring mode'; end if;
  if economy not in ('demo', 'account_stake') then raise exception 'Invalid economy mode'; end if;
  if draft not in ('market', 'auction') then raise exception 'Invalid draft mode'; end if;
  if (economy = 'demo' and stake <> 0) or (economy = 'account_stake' and stake not in (500, 1000, 2000)) then raise exception 'Invalid entry stake'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into leagues(name, owner_id, invite_code, initial_budget, roster_size, draft_hours, duration_days,
    scoring_mode, economy_mode, entry_stake, draft_mode)
  values (league_name, auth.uid(), code, budget, slots, market_hours, league_days, mode, economy, stake, draft)
  returning id into new_id;
  insert into league_members(league_id, user_id, role, coins) values (new_id, auth.uid(), 'owner', budget);
  perform lock_league_stake_for_user(new_id, auth.uid());
  return new_id;
end;
$$;

create or replace function public.join_league(code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target leagues; member_count integer;
begin
  select * into target from leagues where invite_code = upper(trim(code)) for update;
  if target.id is null then raise exception 'Invite code not found'; end if;
  if target.status <> 'lobby' then raise exception 'League already started'; end if;
  if exists(select 1 from league_members where league_id = target.id and user_id = auth.uid()) then return target.id; end if;
  select count(*) into member_count from league_members where league_id = target.id;
  if member_count >= target.max_members then raise exception 'League is full'; end if;
  insert into league_members(league_id, user_id, coins) values (target.id, auth.uid(), target.initial_budget);
  perform lock_league_stake_for_user(target.id, auth.uid());
  return target.id;
end;
$$;

create function public.leave_league(target_league uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if exists(select 1 from leagues where id = target_league and owner_id = auth.uid()) then raise exception 'Owner must cancel the league'; end if;
  if not exists(select 1 from leagues where id = target_league and status = 'lobby') then raise exception 'Only lobby leagues can be left'; end if;
  perform refund_league_stake_for_user(target_league, auth.uid());
  delete from league_members where league_id = target_league and user_id = auth.uid();
  if not found then raise exception 'Not a league member'; end if;
end;
$$;

create function public.cancel_league(target_league uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare member record;
begin
  if not exists(select 1 from leagues where id = target_league and owner_id = auth.uid() and status = 'lobby' for update)
    then raise exception 'Only the owner can cancel a lobby league'; end if;
  for member in select user_id from league_members where league_id = target_league loop
    perform refund_league_stake_for_user(target_league, member.user_id);
  end loop;
  update leagues set status = 'cancelled', ends_at = now() where id = target_league;
end;
$$;

create or replace function public.start_league(target_league uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target leagues;
begin
  select * into target from leagues where id = target_league and owner_id = auth.uid() and status = 'lobby' for update;
  if target.id is null then raise exception 'Only the owner can start this league'; end if;
  if (select count(*) from league_members where league_id = target_league) < 2 then raise exception 'Invite at least one friend before starting'; end if;
  if target.economy_mode = 'account_stake' and
    (select count(*) from league_stakes where league_id = target_league and status = 'locked') <>
    (select count(*) from league_members where league_id = target_league) then raise exception 'Every member must lock the entry stake'; end if;
  update leagues set status = 'active', starts_at = now(),
    market_closes_at = now() + make_interval(hours => draft_hours),
    ends_at = now() + make_interval(days => duration_days)
  where id = target_league;
end;
$$;

create or replace function public.league_buy_player(target_league uuid, target_player_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare player_price integer; current_coins integer; slots integer;
begin
  if not is_league_member(target_league) then raise exception 'Not a league member'; end if;
  select roster_size into slots from leagues where id = target_league and status = 'active'
    and draft_mode = 'market' and now() < market_closes_at;
  if slots is null then raise exception 'Fixed-price market is not open'; end if;
  select price into player_price from players where id = target_player_id and active for share;
  if player_price is null then raise exception 'Player unavailable'; end if;
  select coins - reserved_coins into current_coins from league_members
    where league_id = target_league and user_id = auth.uid() for update;
  if current_coins < player_price then raise exception 'Not enough league coins'; end if;
  if (select count(*) from league_roster_entries where league_id = target_league and user_id = auth.uid() and released_at is null) >= slots then raise exception 'Roster is full'; end if;
  if exists(select 1 from league_roster_entries where league_id = target_league and player_id = target_player_id and released_at is null) then raise exception 'Player already owned in this league'; end if;
  insert into league_roster_entries(league_id, user_id, player_id, acquired_price)
  values (target_league, auth.uid(), target_player_id, player_price);
  update league_members set coins = coins - player_price where league_id = target_league and user_id = auth.uid();
end;
$$;

create or replace function public.league_sell_player(target_league uuid, target_player_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare entry_id bigint; refund integer;
begin
  if not exists(select 1 from leagues where id = target_league and status = 'active'
    and draft_mode = 'market' and now() < market_closes_at) then raise exception 'Fixed-price market is not open'; end if;
  select re.id, greatest(1, floor(p.price * .95))::integer into entry_id, refund
  from league_roster_entries re join players p on p.id = re.player_id
  where re.league_id = target_league and re.user_id = auth.uid() and re.player_id = target_player_id and re.released_at is null
  limit 1 for update of re;
  if entry_id is null then raise exception 'Player not in your roster'; end if;
  update league_roster_entries set released_at = now() where id = entry_id;
  update league_members set coins = coins + refund where league_id = target_league and user_id = auth.uid();
end;
$$;

create or replace function public.buy_strategy_pick(
  target_league uuid, target_window text, strategy text, target_player_id text, partner_id text, prediction integer
)
returns void language plpgsql security definer set search_path = public
as $$
declare league_row leagues; tournament_start timestamptz; pick_cost integer;
begin
  select * into league_row from leagues where id = target_league and status = 'active' for share;
  if league_row.id is null or not is_league_member(target_league) then raise exception 'Active league required'; end if;
  select starts_at into tournament_start from tournaments where window_id = target_window
    and starts_at > now() and starts_at <= league_row.ends_at;
  if tournament_start is null then raise exception 'Prediction window is closed'; end if;
  if strategy not in ('captain', 'duo_call', 'exact_score') then raise exception 'Invalid strategy'; end if;
  if not exists(select 1 from league_roster_entries where league_id = target_league and user_id = auth.uid()
    and player_id = target_player_id and released_at is null) then raise exception 'Player not in your roster'; end if;
  if strategy = 'duo_call' then
    if partner_id is null or partner_id = target_player_id or not exists(select 1 from league_roster_entries
      where league_id = target_league and user_id = auth.uid() and player_id = partner_id and released_at is null)
      then raise exception 'Choose two different roster players'; end if;
  else partner_id := null; end if;
  if strategy = 'exact_score' then
    if prediction is null or prediction not between 0 and 1000 then raise exception 'Prediction must be 0-1,000'; end if;
  else prediction := null; end if;
  pick_cost := greatest(1, round(league_row.initial_budget * case strategy when 'captain' then .05 when 'duo_call' then .03 else .02 end));
  update league_members set coins = coins - pick_cost
  where league_id = target_league and user_id = auth.uid() and coins - reserved_coins >= pick_cost;
  if not found then raise exception 'Not enough available league coins'; end if;
  begin
    insert into league_strategy_picks(league_id, user_id, window_id, pick_type, player_id, partner_player_id, predicted_points, cost)
    values (target_league, auth.uid(), target_window, strategy, target_player_id, partner_id, prediction, pick_cost);
  exception when unique_violation then raise exception 'Strategy already used for this tournament'; end;
end;
$$;

create function public.start_league_auction(target_league uuid, target_player_id text, duration_seconds integer default 90)
returns bigint language plpgsql security definer set search_path = public
as $$
declare league_row leagues; player_price integer; auction_id bigint; duration interval;
begin
  select * into league_row from leagues where id = target_league and owner_id = auth.uid() and status = 'active'
    and draft_mode = 'auction' and now() < market_closes_at for update;
  if league_row.id is null then raise exception 'Only the owner can start an auction while the market is open'; end if;
  if duration_seconds not between 30 and 300 then raise exception 'Auction duration must be 30-300 seconds'; end if;
  if now() + make_interval(secs => duration_seconds) > league_row.market_closes_at then raise exception 'Not enough market time remains'; end if;
  if exists(select 1 from league_auctions where league_id = target_league and status = 'active') then raise exception 'Settle the active auction first'; end if;
  if exists(select 1 from league_roster_entries where league_id = target_league and player_id = target_player_id and released_at is null) then raise exception 'Player already owned'; end if;
  select price into player_price from players where id = target_player_id and active;
  if player_price is null then raise exception 'Player unavailable'; end if;
  duration := make_interval(secs => duration_seconds);
  insert into league_auctions(league_id, player_id, starting_bid, ends_at, created_by)
  values (target_league, target_player_id, greatest(500, floor(player_price * .5))::integer, now() + duration, auth.uid())
  returning id into auction_id;
  return auction_id;
end;
$$;

create function public.place_auction_bid(target_auction bigint, bid_amount integer)
returns void language plpgsql security definer set search_path = public
as $$
declare auction_row league_auctions; member_row league_members; minimum integer; slots integer; prior integer;
begin
  select * into auction_row from league_auctions where id = target_auction and status = 'active' for update;
  if auction_row.id is null or auction_row.ends_at <= now() then raise exception 'Auction is closed'; end if;
  if not is_league_member(auction_row.league_id) then raise exception 'Not a league member'; end if;
  select roster_size into slots from leagues where id = auction_row.league_id and status = 'active' and draft_mode = 'auction' and now() < market_closes_at;
  if slots is null then raise exception 'Auction market is closed'; end if;
  if (select count(*) from league_roster_entries where league_id = auction_row.league_id and user_id = auth.uid() and released_at is null) >= slots then raise exception 'Roster is full'; end if;
  minimum := coalesce(auction_row.current_bid + 100, auction_row.starting_bid);
  if bid_amount < minimum then raise exception 'Bid is below the minimum'; end if;
  select * into member_row from league_members where league_id = auction_row.league_id and user_id = auth.uid() for update;
  prior := case when auction_row.bidder_id = auth.uid() then coalesce(auction_row.current_bid, 0) else 0 end;
  if member_row.coins - member_row.reserved_coins + prior < bid_amount then raise exception 'Not enough available league coins'; end if;
  if auction_row.bidder_id is not null and auction_row.bidder_id <> auth.uid() then
    update league_members set reserved_coins = reserved_coins - auction_row.current_bid
    where league_id = auction_row.league_id and user_id = auction_row.bidder_id;
  end if;
  update league_members set reserved_coins = reserved_coins - prior + bid_amount
  where league_id = auction_row.league_id and user_id = auth.uid();
  update league_auctions set current_bid = bid_amount, bidder_id = auth.uid() where id = target_auction;
end;
$$;

create function public.settle_league_auction(target_auction bigint)
returns text language plpgsql security definer set search_path = public
as $$
declare auction_row league_auctions; slots integer;
begin
  select * into auction_row from league_auctions where id = target_auction and status = 'active' for update;
  if auction_row.id is null then return 'settled'; end if;
  if auction_row.ends_at > now() then raise exception 'Auction is still active'; end if;
  if not is_league_member(auction_row.league_id) then raise exception 'Not a league member'; end if;
  if auction_row.bidder_id is null then
    update league_auctions set status = 'expired' where id = target_auction;
    return 'expired';
  end if;
  select roster_size into slots from leagues where id = auction_row.league_id;
  if (select count(*) from league_roster_entries where league_id = auction_row.league_id and user_id = auction_row.bidder_id and released_at is null) >= slots then
    update league_members set reserved_coins = reserved_coins - auction_row.current_bid
    where league_id = auction_row.league_id and user_id = auction_row.bidder_id;
    update league_auctions set status = 'cancelled' where id = target_auction;
    return 'cancelled';
  end if;
  insert into league_roster_entries(league_id, user_id, player_id, acquired_price)
  values (auction_row.league_id, auction_row.bidder_id, auction_row.player_id, auction_row.current_bid);
  update league_members set coins = coins - auction_row.current_bid,
    reserved_coins = reserved_coins - auction_row.current_bid
  where league_id = auction_row.league_id and user_id = auction_row.bidder_id;
  update league_auctions set status = 'sold' where id = target_auction;
  return 'sold';
end;
$$;

create function public.cancel_league_auction(target_auction bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare auction_row league_auctions;
begin
  select a.* into auction_row from league_auctions a join leagues l on l.id = a.league_id
  where a.id = target_auction and a.status = 'active' and l.owner_id = auth.uid() for update of a;
  if auction_row.id is null then raise exception 'Active auction not found'; end if;
  if auction_row.bidder_id is not null then raise exception 'Auction with bids cannot be cancelled'; end if;
  update league_auctions set status = 'cancelled' where id = target_auction;
end;
$$;

-- Dashboard now exposes available and reserved league coins.
drop function public.get_league_dashboard(uuid);
create function public.get_league_dashboard(target_league uuid)
returns table(
  user_id uuid, username text, name_style text, points bigint, projected_points bigint,
  base_points bigint, synergy_points bigint, strategy_points bigint, penalty_points bigint,
  coins integer, reserved_coins integer, roster jsonb
)
language sql stable security definer set search_path = public
as $$
  select m.user_id, p.username, p.name_style,
    (s.base_points + s.synergy_points + s.strategy_points + s.penalty_points)::bigint,
    s.projected_points, s.base_points, s.synergy_points, s.strategy_points, s.penalty_points,
    m.coins - m.reserved_coins, m.reserved_coins,
    coalesce(jsonb_agg(distinct jsonb_build_object('id', pl.id, 'handle', pl.handle, 'photo_url', pl.photo_url, 'price', pl.price))
      filter (where pl.id is not null and re.released_at is null), '[]'::jsonb)
  from league_members m
  join profiles p on p.id = m.user_id
  join get_league_score_components(target_league) s on s.user_id = m.user_id
  left join league_roster_entries re on re.league_id = m.league_id and re.user_id = m.user_id
  left join players pl on pl.id = re.player_id
  where m.league_id = target_league and is_league_member(target_league)
  group by m.user_id, p.username, p.name_style, m.coins, m.reserved_coins, s.base_points, s.synergy_points,
    s.strategy_points, s.penalty_points, s.projected_points
  order by 4 desc, p.username;
$$;

create or replace function public.finish_league(target_league uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare winner uuid; stake_row record; pot integer := 0; wallet_row account_wallets;
begin
  if not exists(select 1 from leagues where id = target_league and owner_id = auth.uid() and status = 'active' for update)
    then raise exception 'Only the owner can finish an active league'; end if;
  if exists(select 1 from league_auctions where league_id = target_league and status = 'active') then raise exception 'Settle the active auction first'; end if;
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
  update profiles set reward_points = reward_points + 100 where id = winner;
  return winner;
end;
$$;

revoke execute on function public.account_net_worth(uuid), public.lock_league_stake_for_user(uuid,uuid),
  public.refund_league_stake_for_user(uuid,uuid), public.get_account_portfolio(), public.get_wallet_history(integer),
  public.account_buy_player(text,uuid), public.account_sell_player(text,uuid), public.claim_daily_rescue(uuid),
  public.gift_coins(uuid,integer,uuid), public.create_league(text,integer,integer,integer,integer,text,text,integer,text),
  public.leave_league(uuid), public.cancel_league(uuid), public.start_league_auction(uuid,text,integer),
  public.place_auction_bid(bigint,integer), public.settle_league_auction(bigint), public.cancel_league_auction(bigint) from public;

grant execute on function public.get_account_portfolio(), public.get_wallet_history(integer),
  public.account_buy_player(text,uuid), public.account_sell_player(text,uuid), public.claim_daily_rescue(uuid),
  public.gift_coins(uuid,integer,uuid), public.create_league(text,integer,integer,integer,integer,text,text,integer,text),
  public.leave_league(uuid), public.cancel_league(uuid), public.start_league_auction(uuid,text,integer),
  public.place_auction_bid(bigint,integer), public.settle_league_auction(bigint), public.cancel_league_auction(bigint)
  to authenticated;
