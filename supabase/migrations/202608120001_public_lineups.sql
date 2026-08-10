-- Public leaderboard hygiene and opt-in lineup sharing.
--
-- Lineup source: the project has no separate "selected lineup" at account level. Account slots,
-- roles, benches and reserves do not exist: `account_positions` holds one row per owned player and
-- is exactly what `global_leaderboard_rows()` values for net worth. Slot-based rosters exist only
-- inside private leagues (`league_roster_entries` + `leagues.slots`), which are deliberately outside
-- global wealth and are not exposed here. `roster_entries` is legacy, superseded by
-- `account_positions` in 202607170003. The canonical public lineup is therefore the account's
-- current positions — the same holdings that produced the published rank.

-- 1. Administrators are not players: exclude them from the eligible set before the rank is computed,
--    so ranks are numbered as if no administrator existed.
create or replace function public.global_leaderboard_rows()
returns table (
  user_id uuid,
  username text,
  name_style text,
  created_at timestamptz,
  net_worth bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with eligible as (
    select p.id as user_id, p.username, p.name_style, p.created_at,
      (w.balance::bigint + w.locked_balance::bigint + coalesce(sum(player.price), 0)::bigint) as net_worth
    from public.profiles p
    join public.account_wallets w on w.user_id = p.id
    join auth.users auth_user on auth_user.id = p.id
    left join public.account_positions position on position.user_id = p.id
    left join public.players player on player.id = position.player_id
    where p.account_status = 'active'
      and not p.is_admin
      and auth_user.deleted_at is null
      and (auth_user.banned_until is null or auth_user.banned_until <= now())
      and nullif(auth_user.raw_user_meta_data ->> 'test_marker', '') is null
    group by p.id, p.username, p.name_style, p.created_at, w.balance, w.locked_balance
  )
  select eligible.user_id, eligible.username, eligible.name_style, eligible.created_at, eligible.net_worth,
    row_number() over (order by eligible.net_worth desc, eligible.created_at, eligible.user_id)::bigint as rank
  from eligible;
$$;

-- 2. Owner-controlled, independent visibility consent. Default false for existing and new accounts.
alter table public.profiles
  add column public_lineup_enabled boolean not null default false;

-- Case-insensitive nickname lookup for the public lineup reader.
create index profiles_username_lower on public.profiles (lower(username));

create function public.set_public_lineup_visibility(enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Sign in required'; end if;
  if enabled is null then raise invalid_parameter_value using message = 'Invalid visibility preference'; end if;
  update public.profiles set public_lineup_enabled = enabled where id = auth.uid();
  if not found then raise no_data_found using message = 'Profile not found'; end if;
  return jsonb_build_object('enabled', enabled);
end;
$$;

-- 3. The leaderboard advertises who opted in, so the UI can offer the lineup only where it exists
--    and label the rest as private. Sharing is the account's own public choice; nothing else about
--    the lineup is revealed here.
drop function public.get_global_leaderboard(text);
create function public.get_global_leaderboard(search_username text default null)
returns table (
  rank bigint,
  username text,
  name_style text,
  net_worth bigint,
  badges jsonb,
  public_lineup boolean,
  is_current_user boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare query text := nullif(trim(search_username), '');
begin
  if query is not null and (char_length(query) > 30 or query !~ '^[A-Za-z0-9_.-]+$') then
    raise invalid_parameter_value using message = 'Invalid nickname search';
  end if;

  return query
  select rows.rank, rows.username, rows.name_style, rows.net_worth,
    public.public_badges_for_user(rows.user_id, rows.rank),
    coalesce(profile.public_lineup_enabled, false),
    rows.user_id = auth.uid()
  from public.global_leaderboard_rows() rows
  join public.profiles profile on profile.id = rows.user_id
  where case when query is null
    then rows.rank <= 50 or rows.user_id = auth.uid()
    else position(lower(query) in lower(rows.username)) > 0
  end
  order by rows.rank
  limit case when query is null then 51 else 20 end;
end;
$$;

revoke all on function public.get_global_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_global_leaderboard(text) to anon, authenticated, service_role;

-- 4. Minimal reader. Authenticated viewers only, and only for accounts that opted in.
--    Unknown, ineligible, administrator and private accounts all raise the same error, so holdings
--    cannot be enumerated by comparing failures.
create function public.get_public_lineup(target_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  nickname text := trim(coalesce(target_username, ''));
  target public.profiles;
  ranking record;
  result jsonb;
begin
  if auth.uid() is null or not public.is_account_active() then
    raise insufficient_privilege using message = 'Sign in required';
  end if;
  if char_length(nickname) not between 3 and 30 or nickname !~ '^[A-Za-z0-9_.-]+$' then
    raise invalid_parameter_value using message = 'Invalid nickname';
  end if;

  select * into target from public.profiles where lower(username) = lower(nickname);
  select rows.rank, rows.net_worth into ranking
  from public.global_leaderboard_rows() rows where rows.user_id = target.id;

  if target.id is null
    or target.is_admin
    or not coalesce(target.public_lineup_enabled, false)
    or ranking.rank is null then
    raise no_data_found using message = 'Lineup not available';
  end if;

  select jsonb_build_object(
    'username', target.username,
    'nameStyle', target.name_style,
    'rank', ranking.rank,
    'netWorth', ranking.net_worth,
    'badges', public.public_badges_for_user(target.id, ranking.rank),
    'lineup', coalesce(lineup.items, '[]'::jsonb)
  ) into result
  from (
    select jsonb_agg(jsonb_build_object(
      'playerId', player.id,
      'handle', player.handle,
      'realName', player.real_name,
      'team', player.organization,
      'photoUrl', player.photo_url,
      'rarity', player.rarity,
      'currentPrice', player.price
    ) order by player.price desc, player.id) as items
    from public.account_positions position
    join public.players player on player.id = position.player_id
    where position.user_id = target.id
  ) lineup;
  return result;
end;
$$;

revoke all on function public.set_public_lineup_visibility(boolean) from public, anon, authenticated;
grant execute on function public.set_public_lineup_visibility(boolean) to authenticated, service_role;
revoke all on function public.get_public_lineup(text) from public, anon, authenticated;
grant execute on function public.get_public_lineup(text) to authenticated, service_role;
revoke all on function public.global_leaderboard_rows() from public, anon, authenticated;
grant execute on function public.global_leaderboard_rows() to service_role;

notify pgrst, 'reload schema';
