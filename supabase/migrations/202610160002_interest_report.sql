-- Aggregated interest metrics for the alpha's goal: showing a rights holder how many
-- people actually use FantaFort. Counts only; no identifier leaves the database, and
-- administrators, suspended, deleted, banned and synthetic test accounts are excluded.
create or replace function public.admin_interest_report()
returns jsonb language plpgsql stable security definer set search_path = public, auth set statement_timeout = '10s'
as $$
declare report jsonb;
begin
  perform public.authorize_admin_request();

  with real_users as (
    select p.id, p.created_at, p.last_seen_at, p.locale, p.community_email_opt_in, p.public_lineup_enabled,
      u.email_confirmed_at is not null as confirmed
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.account_status = 'active' and not p.is_admin and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and nullif(u.raw_user_meta_data ->> 'test_marker', '') is null
  ),
  weeks as (
    select generate_series(date_trunc('week', now()) - interval '15 weeks', date_trunc('week', now()), interval '1 week') as week
  ),
  real_leagues as (
    select l.id, l.status, count(m.user_id) as members
    from public.leagues l
    join public.league_members m on m.league_id = l.id
    where m.user_id in (select id from real_users)
    group by l.id, l.status
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from real_users),
      'emailConfirmed', (select count(*) from real_users where confirmed),
      'active7d', (select count(*) from real_users where last_seen_at > now() - interval '7 days'),
      'active30d', (select count(*) from real_users where last_seen_at > now() - interval '30 days'),
      -- Retention: of accounts older than a week, how many came back in the last 7 days.
      'returning7d', (select count(*) from real_users where created_at < now() - interval '7 days' and last_seen_at > now() - interval '7 days'),
      'olderThan7d', (select count(*) from real_users where created_at < now() - interval '7 days'),
      'communityEmailOptIn', (select count(*) from real_users where community_email_opt_in),
      'publicLineups', (select count(*) from real_users where public_lineup_enabled)
    ),
    'signupsByWeek', (select jsonb_agg(jsonb_build_object('week', w.week::date,
        'signups', (select count(*) from real_users r where date_trunc('week', r.created_at) = w.week)) order by w.week) from weeks w),
    'byLanguage', (select coalesce(jsonb_object_agg(coalesce(locale, 'unknown'), total), '{}'::jsonb)
        from (select locale, count(*) total from real_users group by locale) l),
    'engagement', jsonb_build_object(
      'usersInALeague', (select count(distinct m.user_id) from public.league_members m where m.user_id in (select id from real_users)),
      'usersWhoTraded', (select count(distinct t.user_id) from public.wallet_transactions t
        where t.type in ('trade_buy', 'trade_sell') and t.user_id in (select id from real_users)),
      'usersWithFriends', (select count(distinct side.user_id) from public.friendships f
        cross join lateral (values (f.user_a), (f.user_b)) side(user_id)
        where f.status = 'accepted' and side.user_id in (select id from real_users))
    ),
    'leagues', jsonb_build_object(
      'total', (select count(*) from real_leagues),
      'lobby', (select count(*) from real_leagues where status = 'lobby'),
      'active', (select count(*) from real_leagues where status = 'active'),
      'completed', (select count(*) from real_leagues where status = 'completed'),
      'withTwoOrMoreMembers', (select count(*) from real_leagues where members >= 2),
      'averageMembers', (select round(avg(members), 1) from real_leagues)
    )
  ) into report;
  return report;
end;
$$;

revoke all on function public.admin_interest_report() from public, anon, authenticated;
grant execute on function public.admin_interest_report() to authenticated;

notify pgrst, 'reload schema';
