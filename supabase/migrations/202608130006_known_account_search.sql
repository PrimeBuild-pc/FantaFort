-- Finding players who are not in the market yet, from data we already hold.
--
-- `tournament_team_members` records every account seen on every synced leaderboard,
-- with player_id NULL when that account is not in the pool - 27,747 rows today. That
-- is already the index for "search a player we do not carry", so no new provider
-- dependency is introduced and no request-time lookup is invented.
--
-- The dead-card rule from the pool expansion applies here too and is enforced the
-- same way, without restating the event rules in SQL: a row can only exist in
-- `tournaments` if the results sync accepted it as competitive, so "has a stored
-- result inside the qualifying rank" is by construction "recruitable and payable".

-- Supports the username search and the not-in-pool filter.
create index if not exists tournament_team_members_missing_idx
  on public.tournament_team_members (lower(username))
  where player_id is null;

create or replace function public.search_known_accounts(
  search text,
  result_limit integer default 10
)
returns table (
  account_id text,
  username text,
  flag_token text,
  best_rank integer,
  appearances bigint,
  latest_event text,
  latest_region text,
  latest_ends_at timestamptz
)
language plpgsql stable security invoker set search_path = public
as $$
declare
  needle text := nullif(btrim(coalesce(search, '')), '');
  bounded_limit integer := least(greatest(coalesce(result_limit, 10), 1), 25);
begin
  if needle is null or char_length(needle) < 2 or char_length(needle) > 80 then
    return;
  end if;

  return query
  select member.account_id,
    max(member.username) as username,
    max(member.flag_token) as flag_token,
    min(team.rank)::integer as best_rank,
    count(distinct member.window_id) as appearances,
    (array_agg(tournament.name order by tournament.ends_at desc))[1] as latest_event,
    (array_agg(tournament.region order by tournament.ends_at desc))[1] as latest_region,
    max(tournament.ends_at) as latest_ends_at
  from tournament_team_members member
  join tournament_teams team
    on team.window_id = member.window_id and team.team_id = member.team_id
  join tournaments tournament on tournament.window_id = member.window_id
  where member.player_id is null
    and member.username is not null
    and member.username ilike '%' || needle || '%'
    -- Only surface accounts that could actually be carried: anything deeper than the
    -- pool's qualifying rank would become a card that can never earn a point.
    and team.rank <= 300
  group by member.account_id
  order by min(team.rank), max(tournament.ends_at) desc
  limit bounded_limit;
end;
$$;

-- Adds one known account to the market. Administrator-only and audited.
--
-- No step-up scope is introduced: step-up exists to re-authenticate irreversible
-- actions against user data, while this adds a game asset and is undone by setting
-- the row inactive. authorize_admin_request() already requires AAL2, and the action
-- is rate limited and written to the append-only audit log.
create or replace function public.admin_promote_known_account(
  target_account_id text,
  target_tier text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  candidate record;
  prior public.admin_audit_log;
  seed_price integer;
  seed_rarity text;
begin
  perform public.authorize_admin_request();
  if target_account_id is null or char_length(target_account_id) not between 8 and 100
    or target_tier not in ('elite', 'contender', 'regional', 'open')
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200 then
    raise invalid_parameter_value using message = 'Invalid promotion request';
  end if;

  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = 'player.promote' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    return jsonb_build_object('account', prior.target_id, 'replayed', true);
  end if;

  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action = 'player.promote' and created_at > now() - interval '1 hour') >= 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  if exists (select 1 from public.players where account_id = target_account_id and active) then
    raise unique_violation using message = 'Account is already in the market';
  end if;

  -- Eligibility comes from stored results, never from the caller. Presence in
  -- `tournaments` is itself proof the event passed the competitive filter at sync
  -- time, so the rules are not restated here and cannot drift from them.
  select member.account_id, max(member.username) as username,
    min(team.rank)::integer as best_rank, max(tournament.name) as event_name,
    max(tournament.region) as region
  into candidate
  from public.tournament_team_members member
  join public.tournament_teams team
    on team.window_id = member.window_id and team.team_id = member.team_id
  join public.tournaments tournament on tournament.window_id = member.window_id
  where member.account_id = target_account_id and member.username is not null
  group by member.account_id
  having min(team.rank) <= 300;

  if candidate.account_id is null then
    raise invalid_parameter_value using message = 'Account has no qualifying competitive result';
  end if;

  seed_price := case target_tier when 'elite' then 4000 when 'contender' then 2800 else 1800 end;
  seed_rarity := case target_tier when 'elite' then 'legendary' when 'contender' then 'epic' else 'rare' end;

  insert into public.players(id, account_id, handle, rarity, price, active, pro_tier, last_seen_at, eligibility_note)
  values (target_account_id, target_account_id, candidate.username, seed_rarity, seed_price, true, target_tier, now(),
    format('Promoted · best rank %s · %s · %s', candidate.best_rank, candidate.event_name, candidate.region))
  on conflict (id) do update set active = true, pro_tier = excluded.pro_tier, last_seen_at = now();

  -- Back-link the results already stored for this account so the new card is not blank.
  update public.tournament_team_members set player_id = target_account_id
  where account_id = target_account_id and player_id is null;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
    before_state, after_state, request_id, idempotency_key, outcome)
  values (auth.uid(), 'player.promote', 'player', target_account_id, trim(action_reason),
    jsonb_build_object('inPool', false),
    jsonb_build_object('inPool', true, 'tier', target_tier, 'bestRank', candidate.best_rank),
    action_request_id, action_idempotency_key, 'succeeded');

  return jsonb_build_object('account', target_account_id, 'tier', target_tier,
    'handle', candidate.username, 'bestRank', candidate.best_rank, 'replayed', false);
end;
$$;

revoke execute on function public.search_known_accounts(text, integer) from public, anon;
grant execute on function public.search_known_accounts(text, integer) to authenticated;
revoke all on function public.admin_promote_known_account(text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_promote_known_account(text, text, text, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
