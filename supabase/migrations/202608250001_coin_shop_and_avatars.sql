-- Retire the euro "sandbox wallet" and move cosmetics onto the single in-game currency.
--
-- 1. The mock top-up was a leftover from an abandoned payment mockup: it showed a euro
--    balance that could not be spent anywhere and implied real money was involved.
--    Coins (C) are now the only balance in the product.
-- 2. Cosmetics move from FantaPoints to coins and gain avatar emblems, so a manager can
--    decide how their row looks on the global leaderboard. The catalogue is curated and
--    priced server-side: there is no user-uploaded imagery, so no new personal data, no
--    EXIF to strip and no user content to moderate.

-- ------------------------------------------------------------- 1. demo money removal
drop function if exists public.mock_top_up(integer, uuid);
drop function if exists public.mock_top_up(integer);
drop table if exists public.sandbox_top_up_ledger;
alter table public.profiles drop column wallet_cents;

-- ------------------------------------------------------------------ 2. cosmetic store
-- Name styles are no longer a fixed enum: what a profile may equip is decided by
-- ownership in user_cosmetics, not by a constraint that has to be migrated per item.
alter table public.profiles drop constraint profiles_name_style_check;
alter table public.profiles
  add constraint profiles_name_style_check check (name_style ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add column avatar_style text not null default 'default'
    check (avatar_style ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create table public.cosmetics (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind text not null check (kind in ('name_style', 'avatar')),
  price integer not null check (price between 0 and 100000),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_cosmetics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cosmetic_id bigint not null references public.cosmetics(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);

-- Names and descriptions live in the app dictionary, not here: the product ships in five
-- languages and a single English string in the database cannot serve all of them.
insert into public.cosmetics(slug, kind, price, sort_order) values
  ('blaze',     'avatar',      600, 10),
  ('tundra',    'avatar',      600, 20),
  ('circuit',   'avatar',     1000, 30),
  ('shadow',    'avatar',     1000, 40),
  ('aurora',    'avatar',     1800, 50),
  ('royale',    'avatar',     2500, 60),
  ('storm',     'name_style', 1200, 70),
  ('victory',   'name_style', 2400, 80),
  ('legendary', 'name_style', 4000, 90);

-- Anyone who already unlocked a name style with FantaPoints keeps it.
insert into public.user_cosmetics(user_id, cosmetic_id)
select p.id, c.id from public.profiles p
join public.cosmetics c on c.kind = 'name_style' and c.slug = p.name_style
on conflict do nothing;

alter table public.cosmetics enable row level security;
alter table public.user_cosmetics enable row level security;
create policy "read active cosmetics" on public.cosmetics for select using (active);
create policy "read own cosmetics" on public.user_cosmetics for select using (auth.uid() = user_id);

revoke all on table public.cosmetics, public.user_cosmetics from public, anon, authenticated;
revoke all on sequence public.cosmetics_id_seq from public, anon, authenticated;
grant select on table public.cosmetics to anon, authenticated;
grant select on table public.user_cosmetics to authenticated;
grant all on table public.cosmetics, public.user_cosmetics to service_role;
grant usage, select on sequence public.cosmetics_id_seq to service_role;

alter table public.wallet_transactions drop constraint wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check check (type in (
  'initial_grant', 'migration', 'trade_buy', 'trade_sell', 'daily_rescue',
  'gift_sent', 'gift_received', 'league_lock', 'league_refund', 'league_prize', 'league_loss',
  'admin_adjustment', 'cosmetic_purchase'
));

-- 'default' is the starting look every account owns and is never sold, so it is the only
-- slug that can be equipped without a matching row in user_cosmetics.
create function public.equip_cosmetic(cosmetic_kind text, cosmetic_slug text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare item cosmetics;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if cosmetic_kind not in ('name_style', 'avatar') or cosmetic_slug is null then
    raise exception 'Invalid cosmetic';
  end if;
  if cosmetic_slug = 'default' then
    if cosmetic_kind = 'name_style' then
      update profiles set name_style = 'default' where id = auth.uid();
    else
      update profiles set avatar_style = 'default' where id = auth.uid();
    end if;
    return jsonb_build_object('kind', cosmetic_kind, 'slug', 'default');
  end if;
  select * into item from cosmetics where slug = cosmetic_slug and kind = cosmetic_kind and active;
  if item.id is null then raise exception 'Unknown cosmetic'; end if;
  if not exists(select 1 from user_cosmetics where user_id = auth.uid() and cosmetic_id = item.id) then
    raise exception 'Cosmetic not owned';
  end if;
  if item.kind = 'name_style' then
    update profiles set name_style = item.slug where id = auth.uid();
  else
    update profiles set avatar_style = item.slug where id = auth.uid();
  end if;
  return jsonb_build_object('kind', item.kind, 'slug', item.slug);
end;
$$;

-- Same wallet discipline as a trade: lock the row, replay on a known request id, and take
-- the price from the catalogue, never from the client.
create function public.buy_cosmetic(cosmetic_slug text, request_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare item cosmetics; wallet_row account_wallets;
begin
  if auth.uid() is null or not is_account_active() then raise exception 'Sign in required'; end if;
  if request_id is null then raise exception 'Invalid request'; end if;
  select * into wallet_row from account_wallets where user_id = auth.uid() for update;
  if exists(select 1 from wallet_transactions where idempotency_key = request_id::text and user_id = auth.uid()) then
    return jsonb_build_object('replayed', true);
  end if;
  select * into item from cosmetics where slug = cosmetic_slug and active;
  if item.id is null then raise exception 'Unknown cosmetic'; end if;
  if exists(select 1 from user_cosmetics where user_id = auth.uid() and cosmetic_id = item.id) then
    raise exception 'Cosmetic already owned';
  end if;
  if wallet_row.balance < item.price then raise exception 'Not enough coins'; end if;
  insert into user_cosmetics(user_id, cosmetic_id) values (auth.uid(), item.id);
  update account_wallets set balance = balance - item.price, updated_at = now() where user_id = auth.uid()
    returning * into wallet_row;
  insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
  values (auth.uid(), -item.price, wallet_row.balance, 'cosmetic_purchase', 'cosmetic', item.slug, request_id::text,
    jsonb_build_object('slug', item.slug, 'kind', item.kind, 'price', item.price));
  perform equip_cosmetic(item.kind, item.slug);
  return jsonb_build_object('kind', item.kind, 'slug', item.slug, 'balance', wallet_row.balance);
end;
$$;

drop function if exists public.buy_name_style(text);

revoke all on function public.buy_cosmetic(text, uuid), public.equip_cosmetic(text, text) from public, anon, authenticated;
grant execute on function public.buy_cosmetic(text, uuid), public.equip_cosmetic(text, text) to authenticated, service_role;

-- ------------------------------------------- 3. functions that read the dropped column
-- The export loses its sandbox top-up section and gains owned cosmetics; nothing else moves.
create or replace function public.export_account_data()
returns jsonb language plpgsql stable security definer
set search_path = public, auth set statement_timeout = '10s'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in required'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'format', 'FantaFort account export v1',
    'notice', 'Personal data held about you under GDPR arts. 15 and 20. Competitive player, tournament and market records are not personal data about you and are excluded.',
    'identity', (select jsonb_build_object(
        'user_id', u.id, 'email', u.email, 'email_confirmed_at', u.email_confirmed_at,
        'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
        'signup_metadata', u.raw_user_meta_data)
      from auth.users u where u.id = me),
    'profile', (select to_jsonb(p) from profiles p where p.id = me),
    'wallet', (select to_jsonb(w) from account_wallets w where w.user_id = me),
    'wallet_transactions', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from wallet_transactions t where t.user_id = me), '[]'::jsonb),
    'positions', coalesce((select jsonb_agg(to_jsonb(x)) from account_positions x where x.user_id = me), '[]'::jsonb),
    'watchlist', coalesce((select jsonb_agg(to_jsonb(x)) from account_watchlist x where x.user_id = me), '[]'::jsonb),
    'roster_entries', coalesce((select jsonb_agg(to_jsonb(x)) from roster_entries x where x.user_id = me), '[]'::jsonb),
    'leagues_owned', coalesce((select jsonb_agg(to_jsonb(l)) from leagues l where l.owner_id = me), '[]'::jsonb),
    'league_memberships', coalesce((select jsonb_agg(to_jsonb(x)) from league_members x where x.user_id = me), '[]'::jsonb),
    'league_roster_entries', coalesce((select jsonb_agg(to_jsonb(x)) from league_roster_entries x where x.user_id = me), '[]'::jsonb),
    'league_stakes', coalesce((select jsonb_agg(to_jsonb(x)) from league_stakes x where x.user_id = me), '[]'::jsonb),
    'league_strategy_picks', coalesce((select jsonb_agg(to_jsonb(x)) from league_strategy_picks x where x.user_id = me), '[]'::jsonb),
    'league_departures', coalesce((select jsonb_agg(to_jsonb(x)) from league_departures x where x.user_id = me), '[]'::jsonb),
    -- Both sides of a friendship name another person, so only the link and its state
    -- are exported: the counterparty's own data is theirs, not the requester's.
    'friendships', coalesce((select jsonb_agg(jsonb_build_object(
        'counterparty_user_id', case when f.user_a = me then f.user_b else f.user_a end,
        'status', f.status, 'requested_by_me', f.requested_by = me, 'created_at', f.created_at))
      from friendships f where f.user_a = me or f.user_b = me), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from notifications x where x.user_id = me), '[]'::jsonb),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from profile_xp_events x where x.user_id = me), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(to_jsonb(x)) from user_badges x where x.user_id = me), '[]'::jsonb),
    'cosmetics', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'kind', c.kind, 'acquired_at', x.acquired_at))
      from user_cosmetics x join cosmetics c on c.id = x.cosmetic_id where x.user_id = me), '[]'::jsonb),
    'privacy_requests', coalesce((select jsonb_agg(to_jsonb(x)) from account_privacy_requests x where x.user_id = me), '[]'::jsonb)
  );
end;
$$;

-- Anonymization no longer clears a euro balance that no longer exists, and now also
-- resets the avatar emblem along with the name style.
create or replace function public.admin_anonymize_profile(
  target_user_id uuid,
  confirmed_target_id uuid,
  expected_impact_fingerprint text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public set statement_timeout = '5s'
as $$
declare
  target profiles;
  subject_id uuid := target_user_id;
  anonymized_username text;
  impact jsonb;
  prior admin_audit_log;
begin
  perform authorize_admin_request();
  if auth.jwt() ->> 'aal' is distinct from 'aal2' then
    raise insufficient_privilege using message = 'MFA verification required';
  end if;
  if subject_id is null or subject_id = auth.uid() or confirmed_target_id is distinct from subject_id
    or expected_impact_fingerprint !~ '^[a-f0-9]{32}$'
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid anonymization request';
  end if;

  select * into prior from admin_audit_log where actor_user_id = auth.uid() and action = 'user.anonymize'
    and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> subject_id::text or prior.reason <> trim(action_reason)
      or prior.before_state ->> 'impactFingerprint' is distinct from expected_impact_fingerprint then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('replayed', true, 'status', 'anonymized');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-anonymize:' || subject_id::text, 0));
  select * into target from profiles where id = subject_id for update;
  if target.id is null or target.is_admin or target.account_status <> 'suspended' then
    raise invalid_parameter_value using message = 'Suspended non-admin account required';
  end if;
  impact := admin_preview_anonymization_impact(subject_id);
  if impact ->> 'fingerprint' is distinct from expected_impact_fingerprint then
    raise serialization_failure using message = 'Impact preview is stale';
  end if;
  if exists(select 1 from league_members m join leagues l on l.id = m.league_id
    where m.user_id = subject_id and l.status in ('lobby', 'active')) then
    raise invalid_parameter_value using message = 'Open league dependencies must be resolved first';
  end if;
  perform consume_admin_step_up_grant(step_up_token_hash, 'anonymize');

  anonymized_username := 'deleted_' || left(md5(subject_id::text), 12);
  delete from friendships f where subject_id in (f.user_a, f.user_b);
  delete from notifications n where n.user_id = subject_id;
  delete from league_invites i where i.target_user_id = subject_id or i.invited_by = subject_id;
  delete from account_watchlist w where w.user_id = subject_id;
  delete from app_errors e where e.user_id = subject_id;
  update profiles set username = anonymized_username, locale = 'en',
    name_style = 'default', avatar_style = 'default', last_seen_at = null,
    account_status = 'anonymized', status_changed_at = now()
  where id = subject_id;
  insert into admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'user.anonymize', 'user', subject_id::text, trim(action_reason),
    jsonb_build_object('status', target.account_status, 'impact', impact - 'fingerprint',
      'impactFingerprint', expected_impact_fingerprint),
    jsonb_build_object('status', 'anonymized'), action_request_id, action_idempotency_key, 'succeeded');
  return jsonb_build_object('replayed', false, 'status', 'anonymized');
end;
$$;

-- --------------------------------------------------- 4. cosmetics on the public surface
drop function public.get_global_leaderboard(text);
create function public.get_global_leaderboard(search_username text default null)
returns table (
  rank bigint,
  username text,
  name_style text,
  avatar_style text,
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
  select rows.rank, rows.username, rows.name_style, profile.avatar_style, rows.net_worth,
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

create or replace function public.get_public_lineup(target_username text)
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
    'avatarStyle', target.avatar_style,
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

notify pgrst, 'reload schema';
