-- Remove PostgreSQL's default PUBLIC execute grant from privileged functions.
-- Regrant only RPC entry points used by the app; helpers remain owner/service-role only.
alter default privileges for role postgres in schema public revoke execute on functions from public;

do $$
declare
  fn record;
  anonymous_names constant text[] := array[
    'enforce_active_data_session',
    'get_featured_players',
    'get_market_players'
  ];
  authenticated_names constant text[] := array[
    'accept_friend', 'account_buy_player', 'account_sell_player',
    'admin_adjust_wallet', 'admin_anonymize_profile', 'admin_authorize_recovery_attempt',
    'admin_get_user', 'admin_list_audit', 'admin_list_users',
    'admin_preview_anonymization_impact', 'admin_preview_user_impact',
    'admin_revoke_user_sessions', 'admin_set_account_status', 'admin_set_role',
    'authorize_admin_request', 'authorize_admin_step_up_request',
    'block_user', 'buy_name_style', 'buy_player', 'buy_strategy_pick',
    'cancel_friend_request', 'cancel_league', 'cancel_league_auction',
    'claim_daily_rescue', 'create_admin_step_up_grant', 'create_league',
    'finish_league', 'get_account_portfolio', 'get_admin_errors',
    'get_admin_health', 'get_admin_overview', 'get_blocked_users',
    'get_fantasy_leaderboard', 'get_friends', 'get_league_dashboard',
    'get_league_invites', 'get_notifications', 'get_wallet_history',
    'gift_coins', 'invite_friend_to_league', 'is_account_active',
    'is_app_admin', 'is_league_member', 'join_league', 'league_buy_player',
    'league_sell_player', 'leave_league', 'log_client_error',
    'mark_notifications_read', 'mock_top_up', 'place_auction_bid',
    'preview_league_invite', 'reject_friend', 'remove_friend',
    'request_account_deletion', 'request_friend', 'respond_league_invite',
    'sell_player', 'settle_league_auction', 'start_league',
    'start_league_auction', 'touch_presence', 'unblock_user', 'update_profile'
  ];
begin
  for fn in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
    if fn.proname = any(anonymous_names) then
      execute format('grant execute on function %s to anon, authenticated', fn.signature);
    elsif fn.proname = any(authenticated_names) then
      execute format('grant execute on function %s to authenticated', fn.signature);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
