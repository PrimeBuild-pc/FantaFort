import { createHash, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error('Missing Supabase configuration');
const testHost = new URL(url).hostname;
if (!['127.0.0.1', 'localhost'].includes(testHost) && process.env.FANTAFORT_TEST_ENV !== 'isolated') {
  throw new Error('Database checks require local Supabase or FANTAFORT_TEST_ENV=isolated');
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const anonymous = createClient(url, anon, { auth: { persistSession:false } });
const userIds = [];
const runSuffix = Date.now().toString().slice(-7);
const tokenHash = label => createHash('sha256').update(`${runSuffix}:${crypto.randomUUID()}:${label}`).digest('hex');
const invalidToken = '0'.repeat(64);
const roleToken = tokenHash('role');
const economyTokens = [tokenHash('economy-1'), tokenHash('economy-2')];
const anonymizeToken = tokenHash('anonymize');
const ownerName = `owner_${runSuffix}`;
const friendName = `friend_${runSuffix}`;
const recoveryName = `recovery_${runSuffix}`;
const testWindow = `check-${Date.now()}`;
const makeUser = async name => {
  const email = `${name}-${Date.now()}@example.com`;
  const password = `Test-${crypto.randomUUID()}!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: name, test_marker:'CHECK_SOCIAL' } });
  if (created.error) throw created.error;
  userIds.push(created.data.user.id);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return client;
};
const ok = result => { if (result.error) throw result.error; return result.data; };
const wallet = async id => ok(await admin.from('account_wallets').select('balance,locked_balance').eq('user_id', id).single());
const adjustmentFingerprint = (id, delta, expected, reason, reference, requestId) =>
  createHash('sha256').update(JSON.stringify([id, delta, expected, reason, reference, requestId])).digest('hex');
const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const decodeBase32 = value => {
  let bits = '';
  const bytes = [];
  for (const character of value.replace(/=+$/, '').toUpperCase()) bits += base32Alphabet.indexOf(character).toString(2).padStart(5, '0');
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
};
const totp = (secret, timestamp = Date.now()) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30000)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String(((digest[offset] & 127) << 24 | digest[offset + 1] << 16 | digest[offset + 2] << 8 | digest[offset + 3]) % 1_000_000).padStart(6, '0');
};
const elevateWithTotp = async client => {
  const enrolled = ok(await client.auth.mfa.enroll({ factorType:'totp', friendlyName:'check-social' }));
  const clock = await fetch(`${url}/auth/v1/settings`, { headers:{ apikey:anon } });
  const serverTime = Date.parse(clock.headers.get('date') || '') || Date.now();
  const verified = ok(await client.auth.mfa.challengeAndVerify({ factorId:enrolled.id, code:totp(enrolled.totp.secret, serverTime) }));
  ok(await client.auth.setSession({ access_token:verified.access_token, refresh_token:verified.refresh_token }));
};

if (process.env.FANTAFORT_TEST_ENV === 'isolated') {
  const staleAdmin = await admin.from('profiles').update({ is_admin:false }).like('username','owner_%');
  if (staleAdmin.error) throw staleAdmin.error;
}

try {
  const owner = await makeUser(ownerName);
  const friend = await makeUser(friendName);
  const recovery = await makeUser(recoveryName);
  await admin.from('profiles').update({ created_at: new Date(Date.now() - 8 * 86400000).toISOString() }).in('id', userIds);

  for (const id of userIds) {
    const initial = await wallet(id);
    if (initial.balance !== 10000 || initial.locked_balance !== 0) throw new Error('Initial wallet failed');
  }
  await owner.from('account_wallets').update({ balance:999999 }).eq('user_id', userIds[0]);
  if ((await wallet(userIds[0])).balance !== 10000) throw new Error('Wallet RLS write protection failed');
  const forgedLedger = await owner.from('wallet_transactions').insert({ user_id:userIds[0], amount:999999, balance_after:999999, type:'daily_rescue', idempotency_key:crypto.randomUUID() });
  if (!forgedLedger.error) throw new Error('Ledger RLS write protection failed');
  const topUpRequest = crypto.randomUUID();
  if (ok(await owner.rpc('mock_top_up', { amount_cents:1999, request_id:topUpRequest })) !== 1999
    || ok(await owner.rpc('mock_top_up', { amount_cents:1999, request_id:topUpRequest })) !== 1999) {
    throw new Error('Sandbox top-up idempotency failed');
  }
  ok(await owner.rpc('mock_top_up', { amount_cents:1999, request_id:crypto.randomUUID() }));
  ok(await owner.rpc('mock_top_up', { amount_cents:999, request_id:crypto.randomUUID() }));
  if (!(await owner.rpc('mock_top_up', { amount_cents:499, request_id:crypto.randomUUID() })).error) {
    throw new Error('Sandbox top-up daily cap failed');
  }
  const topUpRows = ok(await owner.from('sandbox_top_up_ledger').select('amount_cents'));
  if (topUpRows.length !== 3 || topUpRows.reduce((sum,row) => sum + row.amount_cents, 0) !== 4997) {
    throw new Error('Sandbox top-up ledger failed');
  }

  ok(await owner.rpc('request_friend', { target_username: friendName }));
  if (!ok(await friend.rpc('get_notifications')).some(row => row.type === 'friend_request')) throw new Error('Friend request notification failed');
  ok(await friend.rpc('accept_friend', { friend_id: userIds[0] }));
  if (!ok(await owner.rpc('get_notifications')).some(row => row.type === 'friend_accepted')) throw new Error('Friend accepted notification failed');
  const starts = new Date(Date.now() + 5 * 60000).toISOString();
  ok(await admin.from('tournaments').insert({
    window_id:testWindow, event_id:testWindow, name:'Automated Strategy Check', region:'EU',
    starts_at:starts, ends_at:new Date(Date.now() + 65 * 60000).toISOString(), match_cap:6, format:'duo',
  }));

  const players = ok(await admin.from('players').select('id,price').eq('active', true).order('price').limit(3));
  if (players.length < 3) throw new Error('Three active players required');

  const buyRequests = [crypto.randomUUID(), crypto.randomUUID()];
  const buys = await Promise.all(buyRequests.map(request_id => owner.rpc('account_buy_player', { target_player_id: players[0].id, request_id })));
  if (buys.filter(result => !result.error).length !== 1) throw new Error('Concurrent account purchase protection failed');
  const positions = ok(await owner.from('account_positions').select('player_id').eq('player_id', players[0].id));
  if (positions.length !== 1) throw new Error('Account position uniqueness failed');
  const portfolio = ok(await owner.rpc('get_account_portfolio'));
  if (portfolio.positions.length !== 1 || Number(portfolio.holdingsValue) !== players[0].price || Number(portfolio.totalEquity) !== 10000 || portfolio.rescueAvailable || portfolio.rescueReason !== 'wealth') throw new Error('Portfolio valuation or rescue status failed');
  ok(await owner.from('account_watchlist').insert({ user_id:userIds[0], player_id:players[1].id }));
  if (ok(await owner.from('account_watchlist').select('player_id')).length !== 1) throw new Error('Watchlist failed');
  ok(await owner.from('account_watchlist').delete().eq('player_id',players[1].id));

  const sellRequest = crypto.randomUUID();
  ok(await owner.rpc('account_sell_player', { target_player_id: players[0].id, request_id: sellRequest }));
  ok(await owner.rpc('account_sell_player', { target_player_id: players[0].id, request_id: sellRequest }));
  const afterTrade = await wallet(userIds[0]);
  const salePrice = Math.max(1, Math.floor(players[0].price * .95));
  const expectedAfterTrade = 10000 - players[0].price + salePrice;
  if (afterTrade.balance !== expectedAfterTrade) throw new Error('Trade idempotency or spread failed');
  const soldPortfolio = ok(await owner.rpc('get_account_portfolio'));
  if (Number(soldPortfolio.realizedPnl) !== salePrice - players[0].price || Number(soldPortfolio.totalPnl) !== salePrice - players[0].price) throw new Error('Realized P&L failed');

  if (!(await owner.rpc('gift_coins',{friend_id:userIds[2],amount:100,request_id:crypto.randomUUID()})).error) throw new Error('Non-friend gift guard failed');
  const giftRequest = crypto.randomUUID();
  ok(await owner.rpc('gift_coins', { friend_id:userIds[1], amount:100, request_id:giftRequest }));
  ok(await owner.rpc('gift_coins', { friend_id:userIds[1], amount:100, request_id:giftRequest }));
  if ((await wallet(userIds[0])).balance !== expectedAfterTrade - 100 || (await wallet(userIds[1])).balance !== 10100) throw new Error('Gift transfer failed');
  const concurrentGifts = await Promise.all([crypto.randomUUID(),crypto.randomUUID()].map(request_id => owner.rpc('gift_coins',{friend_id:userIds[1],amount:200,request_id})));
  if (concurrentGifts.filter(result=>!result.error).length !== 1) throw new Error('Concurrent gift limit failed');
  if ((await wallet(userIds[0])).balance !== expectedAfterTrade - 300 || (await wallet(userIds[1])).balance !== 10300) throw new Error('Concurrent gift settlement failed');

  ok(await admin.from('account_wallets').update({ balance:0 }).eq('user_id', userIds[2]));
  ok(await admin.from('wallet_transactions').insert({
    user_id:userIds[2], amount:-10000, balance_after:0, type:'trade_buy', idempotency_key:`check-drain:${userIds[2]}`,
    metadata:{ test:true },
  }));
  const rescueRequests = [crypto.randomUUID(),crypto.randomUUID()];
  const rescues = await Promise.all(rescueRequests.map(request_id=>recovery.rpc('claim_daily_rescue',{request_id})));
  if (rescues.filter(result=>!result.error&&result.data===100).length !== 1) throw new Error('Concurrent recovery protection failed');
  const successfulRescue = rescueRequests[rescues.findIndex(result=>!result.error)];
  ok(await recovery.rpc('claim_daily_rescue', { request_id:successfulRescue }));
  if ((await wallet(userIds[2])).balance !== 100) throw new Error('Recovery idempotency failed');
  const recoveryStatus = ok(await recovery.rpc('get_account_portfolio'));
  if (recoveryStatus.rescueAvailable || recoveryStatus.rescueReason !== 'cooldown') throw new Error('Recovery cooldown status failed');

  const leagueId = ok(await owner.rpc('create_league', {
    league_name:'Automated Stake Check', budget:30000, slots:3, market_hours:24, league_days:30,
    mode:'classic', economy:'account_stake', stake:500, draft:'market',
  }));
  const league = ok(await owner.from('leagues').select('invite_code').eq('id', leagueId).single());
  const preview = ok(await friend.rpc('preview_league_invite', { code:league.invite_code }));
  if (preview.length !== 1 || preview[0].entry_stake !== 500 || preview[0].economy_mode !== 'account_stake') throw new Error('Invite preview failed');
  const malformedInvite = await recovery.rpc('join_league', { code:'A1B2C3D4' });
  const missingInvite = await recovery.rpc('join_league', { code:'F'.repeat(16) });
  if (!malformedInvite.error || malformedInvite.error.message !== missingInvite.error?.message) throw new Error('Invite errors reveal code state');
  for (let index = 0; index < 11; index++) {
    const failedPreview = ok(await recovery.rpc('preview_league_invite', { code:'F'.repeat(16) }));
    if (failedPreview.length) throw new Error('Unknown invite preview succeeded');
  }
  const inviteLimit = ok(await admin.from('league_invite_preview_attempts').select('failures').eq('user_id',userIds[2]).single());
  if (inviteLimit.failures !== 10 || ok(await recovery.rpc('preview_league_invite', { code:league.invite_code })).length) {
    throw new Error('Invite preview throttle failed');
  }
  ok(await owner.rpc('invite_friend_to_league', { target_league:leagueId, friend_id:userIds[1] }));
  const invitations = ok(await friend.rpc('get_league_invites'));
  if (invitations.length !== 1) throw new Error('Direct league invite failed');
  ok(await friend.rpc('respond_league_invite', { invite_id:invitations[0].id, accept_invite:true }));
  if ((await wallet(userIds[0])).locked_balance !== 500 || (await wallet(userIds[1])).locked_balance !== 500) throw new Error('Stake lock failed');
  ok(await owner.rpc('start_league', { target_league:leagueId }));
  if (!(await owner.rpc('finish_league', { target_league:leagueId })).error) throw new Error('Staked league early finish guard failed');
  ok(await owner.rpc('league_buy_player', { target_league:leagueId, target_player_id:players[0].id }));
  ok(await owner.rpc('league_buy_player', { target_league:leagueId, target_player_id:players[1].id }));
  if (!(await friend.rpc('league_buy_player', { target_league:leagueId, target_player_id:players[0].id })).error) throw new Error('Player exclusivity failed');

  ok(await admin.from('player_results').insert(players.slice(0,2).map(player => ({
    window_id:testWindow, player_id:player.id, team_id:'check-duo', team_size:2,
    rank:10, points:100, matches:2, wins:1, team_eliminations:8,
  }))));
  ok(await owner.rpc('buy_strategy_pick', {
    target_league:leagueId, target_window:testWindow, strategy:'captain',
    target_player_id:players[0].id, partner_id:null, prediction:null,
  }));
  const ownerStrategies = ok(await owner.from('league_strategy_picks').select('user_id').eq('league_id',leagueId));
  const memberStrategies = ok(await friend.from('league_strategy_picks').select('user_id').eq('league_id',leagueId));
  if (!ownerStrategies.some(row => row.user_id === userIds[0]) || memberStrategies.some(row => row.user_id === userIds[0])) {
    throw new Error('Strategy pick privacy failed');
  }
  const dashboard = ok(await friend.rpc('get_league_dashboard', { target_league:leagueId }));
  const ownerRow = dashboard.find(row => row.user_id === userIds[0]);
  if (dashboard.length !== 2 || Number(ownerRow?.base_points) !== 200 || Number(ownerRow?.synergy_points) !== 15 || Number(ownerRow?.strategy_points) !== 10 || Number(ownerRow?.points) !== 225) throw new Error(`Strategic scoring failed: ${JSON.stringify(ownerRow)}`);

  ok(await admin.from('leagues').update({ starts_at:'2000-01-01T00:00:00Z', ends_at:'2000-01-03T00:00:00Z' }).eq('id', leagueId));
  ok(await admin.from('tournaments').update({ starts_at:'2000-01-02T00:00:00Z', ends_at:'2000-01-02T01:00:00Z' }).eq('window_id', testWindow));
  ok(await admin.from('league_roster_entries').update({ acquired_at:'2000-01-01T12:00:00Z' }).eq('league_id', leagueId));
  const ownerBeforePrize = await wallet(userIds[0]);
  const friendBeforeLoss = await wallet(userIds[1]);
  ok(await owner.rpc('finish_league', { target_league:leagueId }));
  const ownerAfterPrize = await wallet(userIds[0]);
  const friendAfterLoss = await wallet(userIds[1]);
  if (ownerAfterPrize.locked_balance !== 0 || ownerAfterPrize.balance !== ownerBeforePrize.balance + 1000) throw new Error('Winner stake payout failed');
  if (friendAfterLoss.locked_balance !== 0 || friendAfterLoss.balance !== friendBeforeLoss.balance) throw new Error('Losing stake settlement failed');

  const refundLeague = ok(await owner.rpc('create_league', {
    league_name:'Automated Refund Check', budget:10000, slots:3, market_hours:24, league_days:30,
    mode:'classic', economy:'account_stake', stake:500, draft:'market',
  }));
  const refundCode = ok(await owner.from('leagues').select('invite_code').eq('id', refundLeague).single());
  ok(await friend.rpc('join_league', { code:refundCode.invite_code }));
  const beforeRefund = [await wallet(userIds[0]), await wallet(userIds[1])];
  ok(await owner.rpc('cancel_league', { target_league:refundLeague }));
  const afterRefund = [await wallet(userIds[0]), await wallet(userIds[1])];
  if (afterRefund.some((value,index) => value.locked_balance !== 0 || value.balance !== beforeRefund[index].balance + 500)) throw new Error('Stake refund failed');

  const auctionLeague = ok(await owner.rpc('create_league', {
    league_name:'Automated Auction Check', budget:30000, slots:3, market_hours:24, league_days:30,
    mode:'classic', economy:'demo', stake:0, draft:'auction',
  }));
  const auctionCode = ok(await owner.from('leagues').select('invite_code').eq('id', auctionLeague).single());
  ok(await friend.rpc('join_league', { code:auctionCode.invite_code }));
  ok(await owner.rpc('start_league', { target_league:auctionLeague }));
  const auctionId = ok(await owner.rpc('start_league_auction', { target_league:auctionLeague, target_player_id:players[2].id, duration_seconds:30 }));
  const auction = ok(await owner.from('league_auctions').select('starting_bid').eq('id', auctionId).single());
  ok(await owner.rpc('place_auction_bid', { target_auction:auctionId, bid_amount:auction.starting_bid }));
  const winningBid = auction.starting_bid + 100;
  ok(await friend.rpc('place_auction_bid', { target_auction:auctionId, bid_amount:winningBid }));
  if (!ok(await owner.rpc('get_notifications')).some(row => row.type === 'auction_outbid')) throw new Error('Outbid notification failed');
  const reserved = ok(await admin.from('league_members').select('reserved_coins').eq('league_id',auctionLeague).eq('user_id',userIds[1]).single());
  if (reserved.reserved_coins !== winningBid) throw new Error('Auction reserve failed');
  ok(await admin.from('league_auctions').update({ starts_at:'2000-01-01T00:00:00Z', ends_at:'2000-01-02T00:00:00Z' }).eq('id', auctionId));
  if (ok(await friend.rpc('settle_league_auction', { target_auction:auctionId })) !== 'sold') throw new Error('Auction settlement failed');
  const auctionRoster = ok(await friend.from('league_roster_entries').select('player_id,acquired_price').eq('league_id', auctionLeague).eq('user_id', userIds[1]).is('released_at', null));
  if (auctionRoster.length !== 1 || auctionRoster[0].player_id !== players[2].id || auctionRoster[0].acquired_price !== winningBid) throw new Error('Auction roster failed');
  const auctionMember = ok(await admin.from('league_members').select('coins,reserved_coins').eq('league_id',auctionLeague).eq('user_id',userIds[1]).single());
  if (auctionMember.reserved_coins !== 0 || auctionMember.coins !== 30000 - winningBid) throw new Error('Auction coin settlement failed');
  ok(await friend.rpc('leave_league', { target_league:auctionLeague }));
  if (ok(await friend.from('league_departures').select('id')).length !== 1) throw new Error('Active demo league departure failed');

  ok(await owner.rpc('block_user', { friend_id:userIds[2] }));
  if (!(await recovery.rpc('request_friend', { target_username:ownerName })).error) throw new Error('Blocked friend request guard failed');
  ok(await owner.rpc('unblock_user', { friend_id:userIds[2] }));
  for (let index=0; index<25; index++) ok(await owner.rpc('log_client_error', { error_message:`Automated check ${index}`, error_path:'/check', error_stack:null }));
  const errorRows = await admin.from('app_errors').select('id', { count:'exact', head:true }).eq('user_id',userIds[0]).eq('path','/check');
  ok(errorRows);
  if (errorRows.count !== 20) throw new Error('Client error rate limit failed');
  if (!(await owner.rpc('get_admin_overview')).error) throw new Error('Admin access guard failed');
  const aal1Session = ok(await owner.auth.getSession()).session;
  const aal1Owner = createClient(url, anon, {
    auth:{ persistSession:false, autoRefreshToken:false },
    global:{ headers:{ Authorization:`Bearer ${aal1Session.access_token}` } },
  });
  ok(await admin.from('profiles').update({ is_admin:true }).eq('id',userIds[0]));
  ok(await aal1Owner.rpc('authorize_admin_step_up_request'));
  if (!(await aal1Owner.rpc('authorize_admin_request')).error || !(await aal1Owner.rpc('get_admin_overview')).error) {
    throw new Error('AAL1 admin read guard failed');
  }
  await elevateWithTotp(owner);
  ok(await owner.rpc('authorize_admin_request'));
  const disabledRuntimeToken = tokenHash('runtime-disabled');
  if (!(await owner.rpc('create_admin_step_up_grant', { grant_token_hash:disabledRuntimeToken, grant_scope:'economy' })).error) {
    throw new Error('Database admin mutation kill switch failed');
  }
  if (!(await owner.from('admin_runtime_config').update({ mutations_enabled:true }).eq('singleton',true)).error) {
    throw new Error('Authenticated user changed the admin mutation kill switch');
  }
  ok(await admin.from('admin_runtime_config').update({ mutations_enabled:true, updated_at:new Date().toISOString() }).eq('singleton',true));
  const recoveryRequest = crypto.randomUUID();
  if (!(await owner.rpc('admin_authorize_recovery_attempt', { target_user_id:userIds[1], action_reason:'Synthetic recovery AAL check', action_request_id:recoveryRequest, action_idempotency_key:`recovery:${recoveryRequest}`, step_up_token_hash:invalidToken })).error) throw new Error('AAL1 admin recovery guard failed');
  for (const requestedAdmin of [false, true]) {
    const roleRequest = crypto.randomUUID();
    if (!(await owner.rpc('admin_set_role', { target_user_id:userIds[0], requested_admin:requestedAdmin, action_reason:'Synthetic self-role check', action_request_id:roleRequest, action_idempotency_key:`role:${roleRequest}`, step_up_token_hash:invalidToken })).error) throw new Error('Admin self-role guard failed');
  }
  const ownerSession = ok(await owner.auth.getSession()).session;
  const ownerClaims = ok(await owner.auth.getClaims(ownerSession.access_token)).claims;
  ok(await admin.from('admin_step_up_grants').insert({ token_hash:roleToken, admin_user_id:userIds[0], auth_session_id:ownerClaims.session_id, scope:'role', expires_at:new Date(Date.now() + 300000).toISOString() }));
  const promotionRequest = crypto.randomUUID();
  if (!(await owner.rpc('admin_set_role', { target_user_id:userIds[1], requested_admin:true, action_reason:'Synthetic promotion guard check', action_request_id:promotionRequest, action_idempotency_key:`role:${promotionRequest}`, step_up_token_hash:roleToken })).error) throw new Error('Additional administrator guard failed');
  const adminCount = await admin.from('profiles').select('id', { count:'exact', head:true }).eq('is_admin',true);
  ok(adminCount);
  if (adminCount.count !== 1) throw new Error('Single administrator invariant failed');
  const friendWalletBefore = await wallet(userIds[1]);
  ok(await admin.from('admin_step_up_grants').insert(economyTokens.map(value => ({ token_hash:value, admin_user_id:userIds[0], auth_session_id:ownerClaims.session_id, scope:'economy', expires_at:new Date(Date.now() + 300000).toISOString() }))));
  const adjustmentReason = 'Synthetic concurrent adjustment';
  const adjustmentReference = 'local-check';
  const adjustmentRequests = [crypto.randomUUID(), crypto.randomUUID()];
  const adjustments = await Promise.all(adjustmentRequests.map((requestId,index) => owner.rpc('admin_adjust_wallet', {
    target_user_id:userIds[1], adjustment:50, expected_balance:friendWalletBefore.balance, action_reason:adjustmentReason,
    external_reference:adjustmentReference, action_request_id:requestId, action_idempotency_key:`adjust:${requestId}`,
    action_payload_fingerprint:adjustmentFingerprint(userIds[1],50,friendWalletBefore.balance,adjustmentReason,adjustmentReference,requestId),
    step_up_token_hash:economyTokens[index],
  })));
  if (adjustments.filter(result => !result.error).length !== 1 || (await wallet(userIds[1])).balance !== friendWalletBefore.balance + 50) throw new Error('Concurrent admin wallet guard failed');
  const successfulAdjustment = adjustments.findIndex(result => !result.error);
  const successfulRequest = adjustmentRequests[successfulAdjustment];
  ok(await owner.rpc('admin_adjust_wallet', {
    target_user_id:userIds[1], adjustment:50, expected_balance:friendWalletBefore.balance, action_reason:adjustmentReason,
    external_reference:adjustmentReference, action_request_id:successfulRequest, action_idempotency_key:`adjust:${successfulRequest}`,
    action_payload_fingerprint:adjustmentFingerprint(userIds[1],50,friendWalletBefore.balance,adjustmentReason,adjustmentReference,successfulRequest),
    step_up_token_hash:economyTokens[successfulAdjustment],
  }));
  if ((await wallet(userIds[1])).balance !== friendWalletBefore.balance + 50) throw new Error('Admin wallet idempotency failed');
  if (!(await owner.rpc('admin_adjust_wallet', {
    target_user_id:userIds[1], adjustment:50, expected_balance:friendWalletBefore.balance, action_reason:adjustmentReason,
    external_reference:adjustmentReference, action_request_id:successfulRequest, action_idempotency_key:`adjust:${successfulRequest}`,
    action_payload_fingerprint:'f'.repeat(64), step_up_token_hash:economyTokens[successfulAdjustment],
  })).error) throw new Error('Admin wallet payload fingerprint reuse succeeded');
  const ownAdjustment = crypto.randomUUID();
  const ownBalance = (await wallet(userIds[0])).balance;
  if (!(await owner.rpc('admin_adjust_wallet', {
    target_user_id:userIds[0], adjustment:50, expected_balance:ownBalance, action_reason:'Synthetic self-adjustment check',
    external_reference:null, action_request_id:ownAdjustment, action_idempotency_key:`adjust:${ownAdjustment}`,
    action_payload_fingerprint:adjustmentFingerprint(userIds[0],50,ownBalance,'Synthetic self-adjustment check',null,ownAdjustment),
    step_up_token_hash:tokenHash('self-adjustment'),
  })).error) throw new Error('Admin self-wallet guard failed');
  const oversizedRequest = crypto.randomUUID();
  if (!(await owner.rpc('admin_adjust_wallet', {
    target_user_id:userIds[1], adjustment:10001, expected_balance:friendWalletBefore.balance + 50, action_reason:'Synthetic ordinary limit check',
    external_reference:null, action_request_id:oversizedRequest, action_idempotency_key:`adjust:${oversizedRequest}`,
    action_payload_fingerprint:adjustmentFingerprint(userIds[1],10001,friendWalletBefore.balance + 50,'Synthetic ordinary limit check',null,oversizedRequest),
    step_up_token_hash:tokenHash('oversized-adjustment'),
  })).error) throw new Error('Ordinary admin wallet limit failed');
  const adjustmentRow = ok(await admin.from('wallet_transactions').select('id,balance_before,balance_after,amount,reason').eq('idempotency_key',`adjust:${successfulRequest}`).single());
  if (adjustmentRow.balance_after !== adjustmentRow.balance_before + adjustmentRow.amount || adjustmentRow.reason !== 'Synthetic concurrent adjustment') throw new Error('Admin ledger entry failed');
  if (!(await admin.from('wallet_transactions').update({ reason:'tampered' }).eq('id',adjustmentRow.id)).error) throw new Error('Append-only wallet guard failed');
  const adminUsers = ok(await owner.rpc('admin_list_users', { user_search:friendName, status_filter:'active', role_filter:'user', page_index:0, page_size:25 }));
  if (adminUsers.length !== 1 || Number(adminUsers[0].total_count) !== 1) throw new Error('Admin user search failed');
  const adminDetail = ok(await owner.rpc('admin_get_user', { target_user_id:userIds[1] }));
  const adminImpact = ok(await owner.rpc('admin_preview_user_impact', { target_user_id:userIds[1] }));
  if (adminDetail.role !== 'user' || adminImpact.isAdmin || Number(adminImpact.walletTransactions) < 1) throw new Error('Admin user detail failed');
  const aal1Mutation = await aal1Owner.rpc('admin_set_account_status', {
    target_user_id:userIds[2], new_status:'suspended', action_reason:'Synthetic AAL1 denial',
    action_request_id:crypto.randomUUID(), action_idempotency_key:`aal1:${crypto.randomUUID()}`, step_up_token_hash:invalidToken,
  });
  if (!aal1Mutation.error) throw new Error('AAL1 direct status mutation succeeded');
  const noGrantMutation = await owner.rpc('admin_set_account_status', {
    target_user_id:userIds[2], new_status:'suspended', action_reason:'Synthetic missing grant denial',
    action_request_id:crypto.randomUUID(), action_idempotency_key:`no-grant:${crypto.randomUUID()}`, step_up_token_hash:invalidToken,
  });
  if (!noGrantMutation.error) throw new Error('AAL2 status mutation without grant succeeded');
  const wrongSessionToken = tokenHash('wrong-session');
  ok(await admin.from('admin_step_up_grants').insert({
    token_hash:wrongSessionToken, admin_user_id:userIds[0], auth_session_id:'different-session-id',
    scope:'account_status', target_user_id:userIds[2], expires_at:new Date(Date.now() + 300000).toISOString(),
  }));
  const wrongSession = await owner.rpc('admin_set_account_status', {
    target_user_id:userIds[2], new_status:'suspended', action_reason:'Synthetic session binding denial',
    action_request_id:crypto.randomUUID(), action_idempotency_key:`wrong-session:${crypto.randomUUID()}`,
    step_up_token_hash:wrongSessionToken,
  });
  if (!wrongSession.error) throw new Error('Admin grant from another session succeeded');

  const statusToken = tokenHash('account-status');
  ok(await owner.rpc('create_admin_step_up_grant', {
    grant_token_hash:statusToken, grant_scope:'account_status', grant_target_user_id:userIds[2],
  }));
  const wrongTarget = await owner.rpc('admin_set_account_status', {
    target_user_id:userIds[1], new_status:'suspended', action_reason:'Synthetic target binding denial',
    action_request_id:crypto.randomUUID(), action_idempotency_key:`wrong-target:${crypto.randomUUID()}`, step_up_token_hash:statusToken,
  });
  const wrongScope = await owner.rpc('admin_revoke_user_sessions', {
    target_user_id:userIds[2], action_reason:'Synthetic scope binding denial', action_request_id:crypto.randomUUID(),
    action_idempotency_key:`wrong-scope:${crypto.randomUUID()}`, step_up_token_hash:statusToken,
  });
  if (!wrongTarget.error || !wrongScope.error) throw new Error('Admin grant binding failed');

  const suspendRequest = crypto.randomUUID();
  ok(await owner.rpc('admin_set_account_status', {
    target_user_id:userIds[2], new_status:'suspended', action_reason:'Synthetic suspension check',
    action_request_id:suspendRequest, action_idempotency_key:`suspend:${suspendRequest}`, step_up_token_hash:statusToken,
  }));
  const replayedGrant = await owner.rpc('admin_set_account_status', {
    target_user_id:userIds[2], new_status:'active', action_reason:'Synthetic grant replay denial',
    action_request_id:crypto.randomUUID(), action_idempotency_key:`replay:${crypto.randomUUID()}`, step_up_token_hash:statusToken,
  });
  if (!replayedGrant.error) throw new Error('Admin step-up grant replay succeeded');
  if (!(await recovery.rpc('get_account_portfolio')).error) throw new Error('Suspended session retained Data API access');

  const reactivateToken = tokenHash('account-reactivate');
  ok(await owner.rpc('create_admin_step_up_grant', {
    grant_token_hash:reactivateToken, grant_scope:'account_status', grant_target_user_id:userIds[2],
  }));
  const reactivateRequest = crypto.randomUUID();
  ok(await owner.rpc('admin_set_account_status', {
    target_user_id:userIds[2], new_status:'active', action_reason:'Synthetic reactivation check',
    action_request_id:reactivateRequest, action_idempotency_key:`reactivate:${reactivateRequest}`, step_up_token_hash:reactivateToken,
  }));
  ok(await recovery.rpc('get_account_portfolio'));

  const revokeToken = tokenHash('session-revoke');
  ok(await owner.rpc('create_admin_step_up_grant', {
    grant_token_hash:revokeToken, grant_scope:'session_revoke', grant_target_user_id:userIds[2],
  }));
  const revokeRequest = crypto.randomUUID();
  ok(await owner.rpc('admin_revoke_user_sessions', {
    target_user_id:userIds[2], action_reason:'Synthetic session revocation check', action_request_id:revokeRequest,
    action_idempotency_key:`revoke:${revokeRequest}`, step_up_token_hash:revokeToken,
  }));
  if (!(await recovery.rpc('get_account_portfolio')).error) throw new Error('Revoked session retained Data API access');

  const anonymizeStatusToken = tokenHash('anonymize-suspend');
  ok(await owner.rpc('create_admin_step_up_grant', {
    grant_token_hash:anonymizeStatusToken, grant_scope:'account_status', grant_target_user_id:userIds[2],
  }));
  const anonymizeSuspend = crypto.randomUUID();
  ok(await owner.rpc('admin_set_account_status', {
    target_user_id:userIds[2], new_status:'suspended', action_reason:'Synthetic anonymization preparation',
    action_request_id:anonymizeSuspend, action_idempotency_key:`suspend:${anonymizeSuspend}`, step_up_token_hash:anonymizeStatusToken,
  }));
  ok(await admin.from('admin_step_up_grants').insert({ token_hash:anonymizeToken, admin_user_id:userIds[0], auth_session_id:ownerClaims.session_id, scope:'anonymize', expires_at:new Date(Date.now() + 300000).toISOString() }));
  const anonymizeImpact = ok(await owner.rpc('admin_preview_anonymization_impact', { target_user_id:userIds[2] }));
  if (!/^[a-f0-9]{32}$/.test(anonymizeImpact.fingerprint)) throw new Error('Anonymization impact fingerprint failed');
  const anonymizeRequest = crypto.randomUUID();
  if (!(await aal1Owner.rpc('admin_anonymize_profile', { target_user_id:userIds[2], confirmed_target_id:userIds[2],
    expected_impact_fingerprint:anonymizeImpact.fingerprint, action_reason:'Synthetic anonymization AAL check',
    action_request_id:anonymizeRequest, action_idempotency_key:`anonymize:${anonymizeRequest}`, step_up_token_hash:anonymizeToken })).error) {
    throw new Error('AAL1 admin anonymization guard failed');
  }
  const anonymizedProfile = ok(await admin.from('profiles').select('username,account_status').eq('id',userIds[2]).single());
  if (anonymizedProfile.account_status !== 'suspended' || anonymizedProfile.username.startsWith('deleted_') || !(await wallet(userIds[2]))) throw new Error('Denied anonymization changed data');
  const redactionUuid = crypto.randomUUID();
  ok(await friend.rpc('log_client_error', { error_message:`Bearer syntheticlong.headerlonger.signaturelong for audit-person@example.test cookie=session-secret sb_secret_syntheticsecret ${redactionUuid}`, error_path:'/redaction-check', error_stack:'stack must remain server-side' }));
  const redactedErrors = ok(await owner.rpc('get_admin_errors'));
  const redactedError = redactedErrors.find(row => row.path === '/redaction-check');
  if (!redactedError || redactedError.message.includes('syntheticlong.headerlonger.signaturelong')
    || redactedError.message.includes('@example.test') || redactedError.message.includes('session-secret')
    || redactedError.message.includes('sb_secret_') || redactedError.message.includes(redactionUuid)
    || 'stack' in redactedError) throw new Error('Admin error redaction failed');
  const auditQuery = { search_filter:'economy', action_filter:null, outcome_filter:'succeeded',
    target_type_filter:'user', target_ref_filter:null, actor_username_filter:ownerName,
    created_from_filter:new Date(Date.now() - 3600000).toISOString(), created_to_filter:new Date(Date.now() + 60000).toISOString(),
    page_index:0, page_size:100 };
  const auditRows = ok(await owner.rpc('admin_list_audit', auditQuery));
  if (!auditRows.some(row => row.action === 'economy.adjust_wallet')
    || auditRows.some(row => 'actor_user_id' in row || 'target_id' in row || 'request_id' in row
      || !/^actor_[a-f0-9]{12}$/.test(row.actor_ref) || !/^target_[a-f0-9]{12}$/.test(row.target_ref)
      || !/^request_[a-f0-9]{12}$/.test(row.request_ref))) throw new Error('Admin audit reader failed');
  if (!(await friend.rpc('admin_list_audit', auditQuery)).error || !(await anonymous.rpc('admin_list_audit', auditQuery)).error) throw new Error('Admin audit authorization failed');
  if (!(await admin.from('admin_audit_log').update({ outcome:'failed' }).eq('id',auditRows[0].id)).error) throw new Error('Append-only audit guard failed');
  if (!(await aal1Owner.rpc('create_admin_step_up_grant', { grant_token_hash:invalidToken, grant_scope:'economy' })).error) throw new Error('AAL1 step-up guard failed');
  ok(await admin.from('profiles').update({ account_status:'suspended' }).eq('id',userIds[0]));
  if (!(await owner.rpc('authorize_admin_request')).error) throw new Error('Suspended admin authorization guard failed');
  ok(await admin.from('profiles').update({ account_status:'active', is_admin:false }).eq('id',userIds[0]));
  const deletionName = `delete_${runSuffix}`;
  const deletion = await makeUser(deletionName);
  const deletionId = userIds.at(-1);
  if (!(await deletion.rpc('delete_account', { confirm_username:deletionName })).error) throw new Error('Destructive account deletion was not blocked');
  if (!ok(await admin.from('profiles').select('id').eq('id',deletionId)).length) throw new Error('Blocked deletion removed profile data');
  ok(await deletion.rpc('request_account_deletion', { confirm_username:deletionName }));
  const deletionProfile = ok(await admin.from('profiles').select('account_status').eq('id',deletionId).single());
  const privacyRequest = ok(await admin.from('account_privacy_requests').select('status').eq('user_id',deletionId).single());
  if (deletionProfile.account_status !== 'suspended' || privacyRequest.status !== 'pending'
    || !(await deletion.rpc('get_account_portfolio')).error) throw new Error('Account deletion request did not suspend access');

  const profile = ok(await owner.from('profiles').select('reward_points,experience_points').single());
  const friendProfile = ok(await friend.from('profiles').select('experience_points').single());
  if (profile.reward_points !== 100) throw new Error('Winner reward failed');
  if (profile.experience_points !== 200 || friendProfile.experience_points !== 100) throw new Error('League XP failed');
  if (ok(await owner.from('profile_xp_events').select('amount')).reduce((sum,row) => sum + row.amount, 0) !== 200) throw new Error('XP history failed');
  for (const id of userIds) {
    const rows = ok(await admin.from('wallet_transactions').select('amount').eq('user_id', id));
    const ledgerBalance = rows.reduce((sum,row) => sum + row.amount, 0);
    if (ledgerBalance !== (await wallet(id)).balance) throw new Error(`Wallet ledger reconciliation failed for ${id}`);
  }
  console.log('Supabase auth, social, notifications, progression, wallet, league and admin checks passed.');
} finally {
  await admin.from('admin_runtime_config').update({ mutations_enabled:false, updated_at:new Date().toISOString() }).eq('singleton',true);
  await admin.from('app_errors').delete().eq('path', '/check');
  await admin.from('tournaments').delete().eq('window_id', testWindow);
  if (userIds.length) await admin.from('profiles').update({ is_admin:false, account_status:'suspended' }).in('id',userIds);
  for (const id of userIds) {
    if (['127.0.0.1', 'localhost'].includes(testHost)) await admin.auth.admin.deleteUser(id);
    else await admin.auth.admin.updateUserById(id, { ban_duration:'876000h', user_metadata:{ test_marker:'CHECK_SOCIAL_RETIRED' } });
  }
}
