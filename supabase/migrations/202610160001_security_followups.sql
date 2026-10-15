-- Security follow-ups (2026-10-16).

-- 1. Every user-affecting step-up grant is bound to its target. Role, economy, recovery
-- and anonymisation grants were session-bound only, so a grant minted for user A could
-- be spent on user B within five minutes. Price edits move to their own untargeted
-- 'market' scope, gated by the player-pool switch like the rest of that feature.
alter table public.admin_step_up_grants drop constraint admin_step_up_grants_scope_check;
alter table public.admin_step_up_grants add constraint admin_step_up_grants_scope_check
  check (scope in ('role', 'economy', 'recovery', 'anonymize', 'account_status', 'session_revoke', 'badge', 'market'));
delete from public.admin_step_up_grants where target_user_id is null and scope <> 'badge';

create or replace function public.enforce_admin_mutation_runtime()
returns trigger language plpgsql security definer set search_path = public
as $$
declare config public.admin_runtime_config;
begin
  select * into config from public.admin_runtime_config where singleton;
  if not coalesce(
    case new.scope
      when 'badge' then config.badge_mutations_enabled
      when 'market' then config.player_pool_mutations_enabled
      else config.mutations_enabled
    end,
    false
  ) then
    raise insufficient_privilege using message = 'Admin mutations disabled';
  end if;
  return new;
end;
$$;

create or replace function public.create_admin_step_up_grant(grant_token_hash text, grant_scope text)
returns void language plpgsql security definer set search_path = public
as $$
declare session_id text := auth.jwt() ->> 'session_id';
begin
  perform public.authorize_admin_request();
  if session_id is null or grant_token_hash !~ '^[a-f0-9]{64}$'
    or grant_scope not in ('market') then
    raise invalid_parameter_value using message = 'Invalid step-up request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-step-up:' || auth.uid()::text, 0));
  delete from public.admin_step_up_grants where expires_at <= now();
  if (select count(*) from public.admin_step_up_grants
      where admin_user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise program_limit_exceeded using message = 'Step-up rate limit reached';
  end if;
  insert into public.admin_step_up_grants(token_hash, admin_user_id, auth_session_id, scope, expires_at)
  values (grant_token_hash, auth.uid(), session_id, grant_scope, now() + interval '5 minutes');
end;
$$;

create or replace function public.create_admin_step_up_grant(
  grant_token_hash text,
  grant_scope text,
  grant_target_user_id uuid
)
returns void language plpgsql security definer set search_path = public
as $$
declare session_id text := auth.jwt() ->> 'session_id';
begin
  perform public.authorize_admin_request();
  if session_id is null or grant_token_hash !~ '^[a-f0-9]{64}$'
    or grant_scope not in ('account_status', 'session_revoke', 'badge', 'role', 'economy', 'recovery', 'anonymize')
    or grant_target_user_id is null or grant_target_user_id = auth.uid()
    -- Only a role change may target another administrator (demotion).
    or not exists(select 1 from public.profiles where id = grant_target_user_id and (grant_scope = 'role' or not is_admin)) then
    raise invalid_parameter_value using message = 'Invalid step-up request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-step-up:' || auth.uid()::text, 0));
  delete from public.admin_step_up_grants where expires_at <= now();
  if (select count(*) from public.admin_step_up_grants
      where admin_user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise program_limit_exceeded using message = 'Step-up rate limit reached';
  end if;
  insert into public.admin_step_up_grants(token_hash, admin_user_id, auth_session_id, scope, target_user_id, expires_at)
  values (grant_token_hash, auth.uid(), session_id, grant_scope, grant_target_user_id, now() + interval '5 minutes');
end;
$$;

create or replace function public.admin_set_role(
  target_user_id uuid,
  requested_admin boolean,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare target public.profiles;
begin
  perform public.authorize_admin_request();
  if target_user_id = auth.uid() then raise invalid_parameter_value using message = 'Self role changes are not allowed'; end if;
  if action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash !~ '^[a-f0-9]{64}$' then raise invalid_parameter_value using message = 'Invalid admin request'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-role-change', 0));
  select * into target from public.profiles where id = target_user_id for update;
  if target.id is null or target.account_status <> 'active' then raise invalid_parameter_value using message = 'User unavailable'; end if;
  if target.is_admin = requested_admin then return; end if;
  perform public.consume_admin_step_up_grant(step_up_token_hash, 'role', target_user_id);

  if requested_admin then
    if exists(select 1 from public.profiles where is_admin and id <> target_user_id) then
      raise feature_not_supported using message = 'Additional administrators are not enabled';
    end if;
    if not exists(select 1 from auth.mfa_factors where user_id = target_user_id and status = 'verified') then
      raise invalid_parameter_value using message = 'Verified MFA is required';
    end if;
  elsif (select count(*) from public.profiles where is_admin) <= 1 then
    raise invalid_parameter_value using message = 'The last administrator cannot be removed';
  end if;

  update public.profiles set is_admin = requested_admin where id = target_user_id;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'user.set_role', 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('role', case when target.is_admin then 'admin' else 'user' end),
    jsonb_build_object('role', case when requested_admin then 'admin' else 'user' end),
    action_request_id, action_idempotency_key, 'succeeded');
end;
$$;

create or replace function public.admin_adjust_wallet(
  target_user_id uuid,
  adjustment integer,
  expected_balance integer,
  action_reason text,
  external_reference text,
  action_request_id uuid,
  action_idempotency_key text,
  action_payload_fingerprint text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  wallet account_wallets;
  existing wallet_transactions;
  resulting_balance integer;
  normalized_reference text := nullif(trim(external_reference), '');
begin
  perform authorize_admin_request();
  if target_user_id = auth.uid() then raise invalid_parameter_value using message = 'Self balance changes are not allowed'; end if;
  if adjustment is null or adjustment = 0 or abs(adjustment::bigint) > 100000
    or expected_balance is null or expected_balance < 0
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or (normalized_reference is not null and char_length(normalized_reference) > 200)
    or action_request_id is null or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or action_payload_fingerprint is null or action_payload_fingerprint !~ '^[a-f0-9]{64}$'
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid wallet adjustment';
  end if;
  if abs(adjustment::bigint) > 10000 then
    raise program_limit_exceeded using message = 'Ordinary adjustment limit exceeded';
  end if;
  if not exists(select 1 from profiles where id = target_user_id and account_status <> 'anonymized') then
    raise invalid_parameter_value using message = 'User unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-wallet-actor:' || auth.uid()::text, 0));
  select * into existing from wallet_transactions where idempotency_key = action_idempotency_key;
  if existing.id is not null then
    if existing.user_id <> target_user_id or existing.amount <> adjustment or existing.balance_before <> expected_balance
      or existing.reason <> trim(action_reason) or existing.external_reference is distinct from normalized_reference
      or existing.performed_by is distinct from auth.uid() or existing.admin_request_id is distinct from action_request_id
      or (existing.metadata ->> 'payloadFingerprint') is distinct from action_payload_fingerprint then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('balanceBefore', existing.balance_before, 'balanceAfter', existing.balance_after, 'replayed', true);
  end if;
  if coalesce((select sum(abs(amount::bigint)) from wallet_transactions
    where type = 'admin_adjustment' and performed_by = auth.uid()
      and created_at >= date_trunc('day', now())), 0) + abs(adjustment::bigint) > 50000 then
    raise program_limit_exceeded using message = 'Daily admin adjustment limit exceeded';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-wallet:' || target_user_id::text, 0));
  select * into wallet from account_wallets where user_id = target_user_id for update;
  if wallet.user_id is null then raise no_data_found using message = 'Wallet not found'; end if;
  if wallet.balance <> expected_balance then raise serialization_failure using message = 'Wallet balance changed'; end if;
  resulting_balance := wallet.balance + adjustment;
  if resulting_balance < 0 then raise check_violation using message = 'Insufficient balance'; end if;
  perform consume_admin_step_up_grant(step_up_token_hash, 'economy', target_user_id);

  update account_wallets set balance = resulting_balance, updated_at = now() where user_id = target_user_id;
  insert into wallet_transactions(user_id, amount, balance_before, balance_after, type, reference_type,
    reference_id, idempotency_key, reason, external_reference, performed_by, admin_request_id, metadata)
  values (target_user_id, adjustment, wallet.balance, resulting_balance, 'admin_adjustment', 'admin',
    auth.uid()::text, action_idempotency_key, trim(action_reason), normalized_reference, auth.uid(), action_request_id,
    jsonb_build_object('payloadFingerprint', action_payload_fingerprint));
  insert into admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'economy.adjust_wallet', 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('balance', wallet.balance), jsonb_build_object('balance', resulting_balance, 'delta', adjustment),
    action_request_id, action_idempotency_key, 'succeeded');
  return jsonb_build_object('balanceBefore', wallet.balance, 'balanceAfter', resulting_balance, 'replayed', false);
end;
$$;

create or replace function public.admin_authorize_recovery_attempt(
  target_user_id uuid,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare prior admin_audit_log;
begin
  perform authorize_admin_request();
  if auth.jwt() ->> 'aal' is distinct from 'aal2' then
    raise insufficient_privilege using message = 'MFA verification required';
  end if;
  if target_user_id = auth.uid() or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid admin request';
  end if;

  select * into prior from admin_audit_log where actor_user_id = auth.uid()
    and action = 'user.request_recovery' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_user_id::text or prior.reason <> trim(action_reason) then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-recovery-actor:' || auth.uid()::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-recovery-target:' || target_user_id::text, 0));
  if not exists(select 1 from profiles where id = target_user_id and not is_admin and account_status = 'active') then
    raise invalid_parameter_value using message = 'User unavailable';
  end if;
  if (select count(*) from admin_audit_log where action = 'user.request_recovery'
    and target_id = target_user_id::text and created_at > now() - interval '1 hour') >= 3
    or (select count(*) from admin_audit_log where actor_user_id = auth.uid() and action = 'user.request_recovery'
      and created_at > now() - interval '1 hour') >= 20 then
    raise program_limit_exceeded using message = 'Recovery rate limit reached';
  end if;

  perform consume_admin_step_up_grant(step_up_token_hash, 'recovery', target_user_id);
  insert into admin_audit_log(actor_user_id, action, target_type, target_id, reason, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'user.request_recovery', 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('accepted', true), action_request_id, action_idempotency_key, 'succeeded');
  return true;
end;
$$;

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
  perform consume_admin_step_up_grant(step_up_token_hash, 'anonymize', subject_id);

  anonymized_username := 'deleted_' || left(md5(subject_id::text), 12);
  delete from friendships f where subject_id in (f.user_a, f.user_b);
  delete from notifications n where n.user_id = subject_id;
  delete from league_invites i where i.target_user_id = subject_id or i.invited_by = subject_id;
  delete from account_watchlist w where w.user_id = subject_id;
  delete from app_errors e where e.user_id = subject_id;
  delete from user_badges b where b.user_id = subject_id;
  delete from user_cosmetics c where c.user_id = subject_id;
  update profiles set username = anonymized_username, locale = 'en',
    name_style = 'default', avatar_style = 'default', last_seen_at = null,
    account_status = 'anonymized', status_changed_at = now(),
    public_lineup_enabled = false, community_email_opt_in = false,
    community_email_opted_in_at = null, community_email_opted_out_at = null,
    community_email_consent_version = null, community_email_consent_source = null
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

create or replace function public.admin_update_market_player(
  target_id text,
  new_price integer,
  new_tier text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  prior public.admin_audit_log;
  before public.players;
begin
  perform public.authorize_admin_request();
  if not coalesce((select player_pool_mutations_enabled from public.admin_runtime_config where singleton), false) then
    raise insufficient_privilege using message = 'Player pool mutations disabled';
  end if;
  if target_id is null or char_length(target_id) not between 1 and 100
    or new_price is null or new_price not between 1500 and 6500
    or new_tier is not null and new_tier not in ('elite', 'contender', 'regional', 'open')
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid player update';
  end if;

  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = 'player.update' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_id then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('id', prior.target_id, 'replayed', true);
  end if;

  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action = 'player.update' and created_at > now() - interval '1 hour') >= 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  select * into before from public.players where id = target_id;
  if before.id is null then
    raise invalid_parameter_value using message = 'Player not found';
  end if;

  perform public.consume_admin_step_up_grant(step_up_token_hash, 'market');

  update public.players set price = new_price, pro_tier = coalesce(new_tier, pro_tier),
    rarity = case when new_price >= 5000 then 'legendary' when new_price >= 3500 then 'epic'
      when new_price >= 2200 then 'rare' else 'common' end
  where id = target_id;
  if new_price <> before.price then
    insert into public.player_price_history(player_id, old_price, new_price) values (target_id, before.price, new_price);
  end if;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
    before_state, after_state, request_id, idempotency_key, outcome)
  values (auth.uid(), 'player.update', 'player', target_id, trim(action_reason),
    jsonb_build_object('price', before.price, 'tier', before.pro_tier),
    jsonb_build_object('price', new_price, 'tier', coalesce(new_tier, before.pro_tier)),
    action_request_id, action_idempotency_key, 'succeeded');

  return jsonb_build_object('id', target_id, 'price', new_price, 'tier', coalesce(new_tier, before.pro_tier), 'replayed', false);
end;
$$;

-- 2. Bulk badge replays must match the original target set.
create or replace function public.admin_set_user_badges_bulk(
  target_user_ids uuid[],
  target_badge_slug text,
  assign_badge boolean,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  target_badge public.badges;
  prior public.admin_audit_log;
  action_name text := case when assign_badge then 'badge.assign' else 'badge.remove' end;
  targets uuid[];
  target_count integer;
  current_target uuid;
  had_badge boolean;
  changed integer := 0;
begin
  perform public.authorize_admin_request();

  select array_agg(distinct target order by target) into targets
  from unnest(coalesce(target_user_ids, '{}'::uuid[])) target;
  target_count := coalesce(array_length(targets, 1), 0);

  if target_count not between 1 and 50
    or auth.uid() = any(targets)
    or assign_badge is null
    or target_badge_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid badge request';
  end if;
  if not coalesce((select badge_mutations_enabled from public.admin_runtime_config where singleton), false) then
    raise insufficient_privilege using message = 'Badge mutations disabled';
  end if;

  -- Replaying the same key returns the recorded batch instead of awarding twice.
  -- Each target gets its own audit row keyed `<key>:<uuid>`, so the replay probe
  -- matches on that exact prefix. Compared with left() rather than LIKE because the
  -- key is caller-supplied and `%` or `_` in it would otherwise widen the match.
  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = action_name
    and left(idempotency_key, char_length(action_idempotency_key) + 1) = action_idempotency_key || ':';
  if prior.id is not null then
    -- A replay must be the same batch: same badge and the same target set.
    if coalesce(prior.after_state ->> 'badge', prior.before_state ->> 'badge') <> target_badge_slug
      or (select array_agg(log.target_id::uuid order by log.target_id::uuid) from public.admin_audit_log log
          where log.actor_user_id = auth.uid() and log.action = action_name
            and left(log.idempotency_key, char_length(action_idempotency_key) + 1) = action_idempotency_key || ':')
        is distinct from targets then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('badge', target_badge_slug, 'processed', 0, 'replayed', true);
  end if;

  perform public.consume_admin_step_up_grant_batch(step_up_token_hash, 'badge', targets);

  select * into target_badge from public.badges where slug = target_badge_slug and assignment_type <> 'dynamic';
  if target_badge.id is null then raise invalid_parameter_value using message = 'Badge unavailable'; end if;

  -- The hourly ceiling counts the whole batch up front, not one row at a time.
  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action in ('badge.assign', 'badge.remove')
      and created_at > now() - interval '1 hour') + target_count > 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  -- All-or-nothing: validate every target before writing anything, so a single
  -- ineligible account cannot leave the batch half applied.
  if (select count(*) from public.profiles
      where id = any(targets) and account_status = 'active' and not is_admin) <> target_count then
    raise invalid_parameter_value using message = 'One or more users are unavailable';
  end if;
  if target_badge.slug = 'founding-50' and (
    select count(*) from public.admin_preview_founding_50() candidate
    where candidate.user_id = any(targets) and candidate.currently_awardable) <> target_count then
    raise invalid_parameter_value using message = 'One or more users are not currently awardable Founding 50 candidates';
  end if;

  foreach current_target in array targets loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('admin-badge:' || current_target::text || ':' || target_badge_slug, 0));
    select exists(select 1 from public.user_badges
      where user_id = current_target and badge_id = target_badge.id) into had_badge;

    if assign_badge and not had_badge then
      insert into public.user_badges(user_id, badge_id, awarded_by, reason, source)
      values (current_target, target_badge.id, auth.uid(), trim(action_reason), 'admin');
      changed := changed + 1;
    elsif not assign_badge and had_badge then
      delete from public.user_badges where user_id = current_target and badge_id = target_badge.id;
      changed := changed + 1;
    end if;

    -- One audit row per award: a batch approval must not collapse into one entry.
    -- admin_audit_log is unique on (actor, request_id) and (actor, action, idempotency
    -- key), so both are derived per target. The derivation is deterministic from the
    -- batch request id, and the original is kept in after_state, so every row remains
    -- correlatable back to the single approval that authorised it.
    insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
      before_state, after_state, request_id, idempotency_key, outcome)
    values (auth.uid(), action_name, 'user', current_target::text, trim(action_reason),
      jsonb_build_object('badge', target_badge.slug, 'assigned', had_badge),
      jsonb_build_object('badge', target_badge.slug, 'assigned', assign_badge,
        'batch', true, 'batchRequestId', action_request_id),
      (md5(action_request_id::text || ':' || current_target::text))::uuid,
      action_idempotency_key || ':' || current_target::text, 'succeeded');
  end loop;

  return jsonb_build_object('badge', target_badge.slug, 'processed', target_count,
    'changed', changed, 'replayed', false);
end;
$$;

-- 3. Completed leagues keep the standings that were paid out. The winner was computed
-- from live data and nothing was stored, so a later correction changed the history.
create table public.league_final_standings (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  winner_id uuid,
  standings jsonb not null,
  finished_at timestamptz not null default now()
);
alter table public.league_final_standings enable row level security;
revoke all on table public.league_final_standings from public, anon, authenticated;
grant all on table public.league_final_standings to service_role;

create or replace function public.finish_league(target_league uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target leagues; winner uuid; stake_row record; pot integer := 0; wallet_row account_wallets; winner_name text;
begin
  -- Any member may close a league its owner abandoned a day past its end, so stakes cannot stay locked forever.
  select * into target from leagues where id = target_league and status = 'active'
    and (owner_id = auth.uid() or (is_league_member(target_league) and ends_at is not null and now() > ends_at + interval '24 hours'))
    for update;
  if target.id is null then raise exception 'Only the owner can finish an active league'; end if;
  if target.economy_mode = 'account_stake' and now() < target.ends_at then raise exception 'A staked league can only finish at its scheduled end'; end if;
  if exists(select 1 from league_auctions where league_id = target_league and status = 'active') then raise exception 'Settle the active auction first'; end if;
  select d.user_id into winner from get_league_dashboard(target_league) d order by d.points desc, d.username limit 1;
  select username into winner_name from profiles where id = winner;
  -- Freeze what was paid out: later provider corrections or prunes must not rewrite it.
  insert into league_final_standings(league_id, winner_id, standings)
  select target_league, winner, coalesce(jsonb_agg(to_jsonb(d) order by d.points desc, d.username), '[]'::jsonb)
  from get_league_dashboard(target_league) d;
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

-- Same rows as get_league_dashboard: the frozen snapshot once a league is completed.
create or replace function public.get_league_standings(target_league uuid)
returns setof jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_league_member(target_league) then return; end if;
  if exists (select 1 from league_final_standings where league_id = target_league) then
    return query select jsonb_array_elements(standings) from league_final_standings where league_id = target_league;
  else
    return query select to_jsonb(d) from get_league_dashboard(target_league) d;
  end if;
end;
$$;
revoke all on function public.get_league_standings(uuid) from public, anon;
grant execute on function public.get_league_standings(uuid) to authenticated;

-- 4. Legacy economy RPCs with no caller since the market moved server-side (2026-08-12).
-- get_market_players() was executable by anon and costs ~3.7 s of database time per call;
-- the buy/sell wrappers generated their own request ids, bypassing idempotency.
drop function if exists public.get_market_players();
drop function if exists public.get_fantasy_leaderboard();
drop function if exists public.buy_player(text);
drop function if exists public.sell_player(text);

notify pgrst, 'reload schema';
