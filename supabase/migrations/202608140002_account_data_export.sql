-- Self-service subject access and portability (GDPR arts. 15 and 20). The user's own
-- rows only: auth.uid() is the sole filter and there is no parameter to point it
-- somewhere else. Security definer is needed to read auth.users for the email and
-- sign-in metadata the account owner is entitled to.
create function public.export_account_data()
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
    'sandbox_top_ups', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from sandbox_top_up_ledger t where t.user_id = me), '[]'::jsonb),
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
    'privacy_requests', coalesce((select jsonb_agg(to_jsonb(x)) from account_privacy_requests x where x.user_id = me), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.export_account_data() from public, anon;
grant execute on function public.export_account_data() to authenticated;
