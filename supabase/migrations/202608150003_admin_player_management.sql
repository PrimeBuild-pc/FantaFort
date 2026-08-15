-- Admin player-pool management beyond promotion: browse the full roster (active
-- and retired), edit a carried player's price/tier, and retire one.
--
-- These reuse the same runtime switch and skip step-up for the same reason
-- admin_promote_known_account does: player-pool mutations are a game-asset
-- change, not a user-data one, and are undone by editing the row again or
-- setting it inactive. authorize_admin_request() already requires AAL2.

-- Admin-only roster browser. `players` is already publicly readable (the
-- market needs it), but the public path only returns active cards through
-- search_market_players; the admin console also needs retired rows and the
-- account_id/pro_tier/last_seen_at columns the public mapper never exposes.
create or replace function public.admin_list_market_players(
  search text default null,
  tier_filter text default null,
  active_filter boolean default null,
  page_limit integer default 25,
  page_offset integer default 0
)
returns table (
  id text,
  account_id text,
  handle text,
  organization text,
  rarity text,
  price integer,
  pro_tier text,
  active boolean,
  last_seen_at timestamptz,
  total_count bigint
)
language plpgsql stable security invoker set search_path = public
as $$
declare
  needle text := nullif(btrim(coalesce(search, '')), '');
  bounded_limit integer := least(greatest(coalesce(page_limit, 25), 1), 100);
  bounded_offset integer := greatest(coalesce(page_offset, 0), 0);
begin
  perform public.authorize_admin_request();
  if tier_filter is not null and tier_filter not in ('elite', 'contender', 'regional', 'open') then
    raise invalid_parameter_value using message = 'Invalid tier filter';
  end if;

  return query
  select p.id, p.account_id, p.handle, p.organization, p.rarity, p.price, p.pro_tier, p.active, p.last_seen_at,
    count(*) over () as total_count
  from public.players p
  where (needle is null or p.handle ilike '%' || needle || '%')
    and (tier_filter is null or p.pro_tier = tier_filter)
    and (active_filter is null or p.active = active_filter)
  order by p.active desc, p.handle asc
  limit bounded_limit offset bounded_offset;
end;
$$;

create or replace function public.admin_update_market_player(
  target_id text,
  new_price integer,
  new_tier text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text
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
    or new_price is null or new_price <= 0
    or new_tier is not null and new_tier not in ('elite', 'contender', 'regional', 'open')
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200 then
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

  update public.players set price = new_price, pro_tier = coalesce(new_tier, pro_tier) where id = target_id;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
    before_state, after_state, request_id, idempotency_key, outcome)
  values (auth.uid(), 'player.update', 'player', target_id, trim(action_reason),
    jsonb_build_object('price', before.price, 'tier', before.pro_tier),
    jsonb_build_object('price', new_price, 'tier', coalesce(new_tier, before.pro_tier)),
    action_request_id, action_idempotency_key, 'succeeded');

  return jsonb_build_object('id', target_id, 'price', new_price, 'tier', coalesce(new_tier, before.pro_tier), 'replayed', false);
end;
$$;

create or replace function public.admin_retire_market_player(
  target_id text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text
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
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200 then
    raise invalid_parameter_value using message = 'Invalid retirement request';
  end if;

  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = 'player.retire' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_id then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('id', prior.target_id, 'replayed', true);
  end if;

  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action = 'player.retire' and created_at > now() - interval '1 hour') >= 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  select * into before from public.players where id = target_id;
  if before.id is null then
    raise invalid_parameter_value using message = 'Player not found';
  end if;
  -- Retiring an already-retired card is a harmless no-op, not an error: it keeps
  -- the button idempotent even without a matching idempotency key from a stale tab.
  update public.players set active = false where id = target_id;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
    before_state, after_state, request_id, idempotency_key, outcome)
  values (auth.uid(), 'player.retire', 'player', target_id, trim(action_reason),
    jsonb_build_object('active', before.active), jsonb_build_object('active', false),
    action_request_id, action_idempotency_key, 'succeeded');

  return jsonb_build_object('id', target_id, 'replayed', false);
end;
$$;

revoke all on function public.admin_list_market_players(text, text, boolean, integer, integer) from public, anon;
grant execute on function public.admin_list_market_players(text, text, boolean, integer, integer) to authenticated;
revoke all on function public.admin_update_market_player(text, integer, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_update_market_player(text, integer, text, text, uuid, text) to authenticated, service_role;
revoke all on function public.admin_retire_market_player(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_retire_market_player(text, text, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
