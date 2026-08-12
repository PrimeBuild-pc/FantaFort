-- Founding 50 now requires a confirmed email to be awarded.
--
-- The badge means "one of the first 50 real accounts". An address nobody ever
-- confirmed is not evidence of a real person, and the slot is scarce.
--
-- This changes awardability only, never the historical slot: an unconfirmed account
-- keeps its position and does not renumber anyone, exactly as a suspended account
-- already does. Confirming the email makes it awardable with no further action.
--
-- Deliberately NOT implemented (see docs/PRO_PLAYER_EXPANSION_PLAN.md 7b): expiring
-- the slot after a week, re-dating the account to its confirmation time, and an
-- activity-based exemption. `suspended` is the precondition for anonymisation and is
-- what a self-service deletion request sets, so auto-suspending unconfirmed signups
-- would make them anonymisation-eligible and indistinguishable from users who asked
-- to be deleted; and the slot order comes from auth.users.created_at precisely
-- because Auth owns it and it is immutable. With 31 candidates for 50 slots nothing
-- is being blocked by this today, so the machinery is not worth its risk yet.
--
-- Both admin_set_user_badge and admin_set_user_badges_bulk gate `founding-50` on
-- `currently_awardable` from this preview, so they inherit the rule here rather than
-- restating it. That is why this migration only touches one function.

drop function public.admin_preview_founding_50();
create function public.admin_preview_founding_50()
returns table (
  candidate_order bigint,
  user_id uuid,
  username text,
  account_status text,
  registered_at timestamptz,
  email_confirmed boolean,
  historical_candidate boolean,
  currently_awardable boolean,
  award_block_reason text,
  already_awarded boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.authorize_admin_request();
  return query
  with historical as (
    select row_number() over (order by auth_user.created_at, profile.id)::bigint as slot,
      profile.id as profile_id,
      profile.username as nickname,
      profile.account_status as status,
      auth_user.created_at as registered,
      auth_user.email_confirmed_at is not null as confirmed
    from public.profiles profile
    join auth.users auth_user on auth_user.id = profile.id
    where profile.account_status <> 'anonymized'
      and not profile.is_admin
      and auth_user.deleted_at is null
      and (auth_user.banned_until is null or auth_user.banned_until <= now())
      and nullif(auth_user.raw_user_meta_data ->> 'test_marker', '') is null
    order by auth_user.created_at, profile.id
    limit 50
  )
  select candidate.slot,
    candidate.profile_id,
    candidate.nickname,
    candidate.status,
    candidate.registered,
    candidate.confirmed,
    true,
    candidate.status = 'active' and candidate.confirmed,
    case
      when candidate.status <> 'active' then candidate.status
      when not candidate.confirmed then 'email_unconfirmed'
    end,
    exists(
      select 1 from public.user_badges award
      join public.badges badge on badge.id = award.badge_id
      where award.user_id = candidate.profile_id and badge.slug = 'founding-50'
    )
  from historical candidate
  order by candidate.slot;
end;
$$;

revoke all on function public.admin_preview_founding_50() from public, anon, authenticated;
grant execute on function public.admin_preview_founding_50() to authenticated, service_role;

notify pgrst, 'reload schema';
