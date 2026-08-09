alter table public.profiles
  add column locale text not null default 'en' check (locale in ('en', 'it', 'es', 'de', 'fr')),
  add column reward_points integer not null default 0 check (reward_points >= 0),
  add column wallet_cents integer not null default 0 check (wallet_cents >= 0),
  add column name_style text not null default 'default' check (name_style in ('default', 'storm', 'victory', 'legendary')),
  add column last_seen_at timestamptz;

alter table public.players
  add column photo_url text,
  add column earnings integer,
  add column eligibility_note text not null default 'Curated pro player';

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
  return new;
end;
$$;

create unique index profiles_username_ci on public.profiles (lower(username));

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 40),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'completed')),
  max_members integer not null default 8 check (max_members between 2 and 20),
  created_at timestamptz not null default now(),
  starts_at timestamptz,
  ends_at timestamptz
);

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  coins integer not null default 10000 check (coins >= 0),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table public.league_roster_entries (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id text not null references public.players(id),
  acquired_price integer not null check (acquired_price > 0),
  acquired_at timestamptz not null default now(),
  released_at timestamptz
);

create unique index one_active_player_per_league
  on public.league_roster_entries (league_id, player_id) where released_at is null;
create unique index one_active_roster_slot
  on public.league_roster_entries (league_id, user_id, player_id) where released_at is null;

create table public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create or replace function public.is_league_member(target_league uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from league_members where league_id = target_league and user_id = auth.uid()) $$;

create or replace function public.update_profile(new_username text, new_locale text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  new_username := trim(new_username);
  if new_username !~ '^[A-Za-z0-9_.-]{3,30}$' then
    raise exception 'Username must be 3-30 characters: letters, numbers, dot, dash or underscore';
  end if;
  if new_locale not in ('en', 'it', 'es', 'de', 'fr') then raise exception 'Invalid language'; end if;
  update profiles set username = new_username, locale = new_locale where id = auth.uid();
exception when unique_violation then
  raise exception 'Username already taken';
end;
$$;

create or replace function public.touch_presence()
returns void language sql security definer set search_path = public
as $$ update profiles set last_seen_at = now() where id = auth.uid() $$;

create or replace function public.create_league(league_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid; code text;
begin
  league_name := trim(league_name);
  if char_length(league_name) not between 3 and 40 then raise exception 'League name must be 3-40 characters'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into leagues(name, owner_id, invite_code) values (league_name, auth.uid(), code) returning id into new_id;
  insert into league_members(league_id, user_id, role) values (new_id, auth.uid(), 'owner');
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
  select count(*) into member_count from league_members where league_id = target.id;
  if member_count >= target.max_members then raise exception 'League is full'; end if;
  insert into league_members(league_id, user_id) values (target.id, auth.uid()) on conflict do nothing;
  return target.id;
end;
$$;

create or replace function public.start_league(target_league uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists(select 1 from leagues where id = target_league and owner_id = auth.uid() and status = 'lobby') then
    raise exception 'Only the owner can start this league';
  end if;
  if (select count(*) from league_members where league_id = target_league) < 2 then
    raise exception 'Invite at least one friend before starting';
  end if;
  update leagues set status = 'active', starts_at = now() where id = target_league;
end;
$$;

create or replace function public.league_buy_player(target_league uuid, target_player_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare player_price integer; current_coins integer;
begin
  if not is_league_member(target_league) then raise exception 'Not a league member'; end if;
  if not exists(select 1 from leagues where id = target_league and status in ('lobby', 'active')) then raise exception 'League is closed'; end if;
  select price into player_price from players where id = target_player_id and active;
  if player_price is null then raise exception 'Player unavailable'; end if;
  select coins into current_coins from league_members where league_id = target_league and user_id = auth.uid() for update;
  if current_coins < player_price then raise exception 'Not enough V-Coins'; end if;
  if (select count(*) from league_roster_entries where league_id = target_league and user_id = auth.uid() and released_at is null) >= 3 then
    raise exception 'Roster is full (3 players)';
  end if;
  if exists(select 1 from league_roster_entries where league_id = target_league and player_id = target_player_id and released_at is null) then
    raise exception 'Player already owned in this league';
  end if;
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
  select id, acquired_price into entry_id, refund from league_roster_entries
  where league_id = target_league and user_id = auth.uid() and player_id = target_player_id and released_at is null
  limit 1 for update;
  if entry_id is null then raise exception 'Player not in your roster'; end if;
  update league_roster_entries set released_at = now() where id = entry_id;
  update league_members set coins = coins + refund where league_id = target_league and user_id = auth.uid();
end;
$$;

create or replace function public.request_friend(target_username text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_id uuid; low_id uuid; high_id uuid;
begin
  select id into target_id from profiles where lower(username) = lower(trim(target_username));
  if target_id is null or target_id = auth.uid() then raise exception 'User not found'; end if;
  low_id := least(auth.uid(), target_id); high_id := greatest(auth.uid(), target_id);
  insert into friendships(user_a, user_b, requested_by) values (low_id, high_id, auth.uid())
  on conflict (user_a, user_b) do nothing;
end;
$$;

create or replace function public.accept_friend(friend_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update friendships set status = 'accepted'
  where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id)
    and requested_by <> auth.uid();
  if not found then raise exception 'Friend request not found'; end if;
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
  where auth.uid() in (f.user_a, f.user_b)
  order by f.status, p.username;
$$;

create or replace function public.mock_top_up(amount_cents integer)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if amount_cents not in (499, 999, 1999) then raise exception 'Invalid sandbox package'; end if;
  update profiles set wallet_cents = wallet_cents + amount_cents where id = auth.uid();
end;
$$;

create or replace function public.buy_name_style(style text)
returns void language plpgsql security definer set search_path = public
as $$
declare cost integer;
begin
  cost := case style when 'storm' then 100 when 'victory' then 250 when 'legendary' then 500 else null end;
  if cost is null then raise exception 'Invalid cosmetic'; end if;
  update profiles set reward_points = reward_points - cost, name_style = style
  where id = auth.uid() and reward_points >= cost;
  if not found then raise exception 'Not enough FantaPoints'; end if;
end;
$$;

create or replace function public.finish_league(target_league uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare winner uuid;
begin
  if not exists(select 1 from leagues where id = target_league and owner_id = auth.uid() and status = 'active') then
    raise exception 'Only the owner can finish an active league';
  end if;
  select m.user_id into winner
  from league_members m
  left join league_roster_entries re on re.league_id = m.league_id and re.user_id = m.user_id
  left join player_results r on r.player_id = re.player_id
  left join tournaments t on t.window_id = r.window_id and t.starts_at >= re.acquired_at
    and (re.released_at is null or t.starts_at < re.released_at)
  where m.league_id = target_league
  group by m.user_id order by coalesce(sum(case when t.window_id is not null then r.points else 0 end), 0) desc, m.joined_at limit 1;
  update leagues set status = 'completed', ends_at = now() where id = target_league;
  update profiles set reward_points = reward_points + 100 where id = winner;
  return winner;
end;
$$;

create or replace function public.get_league_dashboard(target_league uuid)
returns table(user_id uuid, username text, name_style text, points bigint, coins integer, roster jsonb)
language sql security definer set search_path = public
as $$
  select m.user_id, p.username, p.name_style,
    coalesce(sum(case when t.window_id is not null then r.points else 0 end), 0)::bigint,
    m.coins,
    coalesce(jsonb_agg(distinct jsonb_build_object('id', pl.id, 'handle', pl.handle, 'photo_url', pl.photo_url))
      filter (where pl.id is not null and re.released_at is null), '[]'::jsonb)
  from league_members m
  join profiles p on p.id = m.user_id
  left join league_roster_entries re on re.league_id = m.league_id and re.user_id = m.user_id
  left join players pl on pl.id = re.player_id
  left join player_results r on r.player_id = re.player_id
  left join tournaments t on t.window_id = r.window_id
    and t.starts_at >= re.acquired_at and (re.released_at is null or t.starts_at < re.released_at)
  where m.league_id = target_league and is_league_member(target_league)
  group by m.user_id, p.username, p.name_style, m.coins
  order by 4 desc, p.username;
$$;

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_roster_entries enable row level security;
alter table public.friendships enable row level security;

create policy "members read league" on public.leagues for select using (is_league_member(id));
create policy "members read members" on public.league_members for select using (is_league_member(league_id));
create policy "members read rosters" on public.league_roster_entries for select using (is_league_member(league_id));

revoke execute on function public.is_league_member(uuid), public.update_profile(text,text), public.touch_presence(),
  public.create_league(text), public.join_league(text), public.start_league(uuid), public.league_buy_player(uuid,text),
  public.league_sell_player(uuid,text), public.request_friend(text), public.accept_friend(uuid), public.get_friends(),
  public.mock_top_up(integer), public.buy_name_style(text), public.finish_league(uuid), public.get_league_dashboard(uuid) from public;
grant execute on function public.is_league_member(uuid), public.update_profile(text,text), public.touch_presence(),
  public.create_league(text), public.join_league(text), public.start_league(uuid), public.league_buy_player(uuid,text),
  public.league_sell_player(uuid,text), public.request_friend(text), public.accept_friend(uuid), public.get_friends(),
  public.mock_top_up(integer), public.buy_name_style(text), public.finish_league(uuid), public.get_league_dashboard(uuid) to authenticated;
