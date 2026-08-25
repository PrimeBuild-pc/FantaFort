import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!anon||!service) throw new Error('Missing Supabase configuration');
const host=new URL(url).hostname;
if(!['127.0.0.1','localhost'].includes(host)&&process.env.FANTAFORT_TEST_ENV!=='isolated') throw new Error('Community checks require local Supabase or FANTAFORT_TEST_ENV=isolated');

const admin=createClient(url,service,{auth:{persistSession:false}});
const anonymous=createClient(url,anon,{auth:{persistSession:false}});
const ids=[];
const suffix=Date.now().toString().slice(-8);
const password=`Test-${crypto.randomUUID()}!`;
const ok=result=>{if(result.error)throw result.error;return result.data;};
const createUser=async(index,marker)=>{
  const username=`rank_${suffix}_${String(index).padStart(2,'0')}`;
  const created=ok(await admin.auth.admin.createUser({email:`${username}@example.com`,password,email_confirm:true,user_metadata:{username,...(marker?{test_marker:marker}:{})}}));
  ids.push(created.user.id);
  return {id:created.user.id,username,createdAt:created.user.created_at};
};

try {
  const users=[];
  for(let index=0;index<53;index++) users.push(await createUser(index));
  const synthetic=await createUser(99,'CHECK_COMMUNITY');
  const suspended=users[51];
  const banned=users[50];
  const current=users[52];

  const prices=ok(await admin.from('players').select('id,price').eq('active',true).order('price').limit(1));
  if(!prices.length) throw new Error('An active market player is required');
  for(let index=0;index<users.length;index++) ok(await admin.from('account_wallets').update({balance:index===0?20000:index<3?19000:18000-index,locked_balance:0}).eq('user_id',users[index].id));
  ok(await admin.from('account_wallets').update({balance:999999}).eq('user_id',synthetic.id));
  ok(await admin.from('account_positions').insert({user_id:users[0].id,player_id:prices[0].id,acquired_price:prices[0].price}));
  ok(await admin.from('profiles').update({account_status:'suspended'}).eq('id',suspended.id));
  ok(await admin.auth.admin.updateUserById(banned.id,{ban_duration:'1h'}));

  const signed=createClient(url,anon,{auth:{persistSession:false}});
  ok(await signed.auth.signInWithPassword({email:`${current.username}@example.com`,password}));
  const initialPreference=ok(await signed.from('profiles').select('community_email_opt_in,community_email_opted_in_at,community_email_opted_out_at').single());
  if(initialPreference.community_email_opt_in||initialPreference.community_email_opted_in_at||initialPreference.community_email_opted_out_at) throw new Error('Communication preference did not default to false');
  if(!(await signed.from('profiles').update({community_email_opt_in:true}).eq('id',current.id)).error) throw new Error('Direct preference write bypassed RPC');
  const optedIn=ok(await signed.rpc('update_communication_preferences',{enabled:true,consent_version:'product_updates_v1',consent_source:'account_settings'}));
  if(!optedIn.enabled||!optedIn.optedInAt||optedIn.optedOutAt||optedIn.consentVersion!=='product_updates_v1'||optedIn.consentSource!=='account_settings') throw new Error('Communication opt-in audit fields failed');
  const optedOut=ok(await signed.rpc('update_communication_preferences',{enabled:false,consent_version:'product_updates_v1',consent_source:'account_settings'}));
  if(optedOut.enabled||!optedOut.optedInAt||!optedOut.optedOutAt) throw new Error('Communication opt-out failed');

  const publicRows=ok(await anonymous.rpc('get_global_leaderboard',{search_username:null}));
  if(publicRows.length!==50||publicRows.some(row=>row.is_current_user)) throw new Error('Anonymous Top 50 failed');
  const allowed=['avatar_style','badges','is_current_user','name_style','net_worth','public_lineup','rank','username'];
  if(publicRows.some(row=>JSON.stringify(Object.keys(row).sort())!==JSON.stringify(allowed))) throw new Error('Leaderboard exposed unexpected fields');
  if(JSON.stringify(publicRows).includes('@example.com')||ids.some(id=>JSON.stringify(publicRows).includes(id))) throw new Error('Leaderboard exposed private identity data');
  if(publicRows[0].username!==users[0].username||Number(publicRows[0].net_worth)!==20000+prices[0].price) throw new Error('Net-worth formula failed');

  const tied=[users[1],users[2]].sort((left,right)=>left.createdAt.localeCompare(right.createdAt)||left.id.localeCompare(right.id));
  if(publicRows[1].username!==tied[0].username||publicRows[2].username!==tied[1].username||Number(publicRows[1].rank)!==2||Number(publicRows[2].rank)!==3) throw new Error('Deterministic tie-break failed');
  const firstBadges=publicRows[0].badges.map(badge=>badge.slug);
  if(!firstBadges.includes('top-10')||!firstBadges.includes('top-50')||publicRows[10].badges.some(badge=>badge.slug==='top-10')) throw new Error('Dynamic ranking badges failed');

  const signedRows=ok(await signed.rpc('get_global_leaderboard',{search_username:null}));
  const own=signedRows.find(row=>row.is_current_user);
  if(signedRows.length!==51||Number(own?.rank)!==51||own?.username!==current.username) throw new Error('Authenticated outside-Top-50 position failed');
  const search=ok(await anonymous.rpc('get_global_leaderboard',{search_username:current.username}));
  if(search.length!==1||Number(search[0].rank)!==51) throw new Error('Nickname search outside Top 50 failed');
  for(const excluded of [synthetic,suspended,banned]) if(ok(await anonymous.rpc('get_global_leaderboard',{search_username:excluded.username})).length) throw new Error(`Excluded account leaked into leaderboard: ${excluded.username}`);
  if(!(await anonymous.rpc('get_global_leaderboard',{search_username:'%'})).error) throw new Error('Invalid leaderboard search accepted');

  const contributor=ok(await signed.from('badges').select('id').eq('slug','contributor').single());
  if(!(await signed.from('user_badges').insert({user_id:current.id,badge_id:contributor.id,source:'admin'})).error) throw new Error('Badge assignment bypassed admin controls');

  // Administrators are removed from the eligible set before the rank is computed.
  const leader=users[0];
  const richAdmin=users[49];
  ok(await admin.from('account_wallets').update({balance:9999999}).eq('user_id',richAdmin.id));
  ok(await admin.from('profiles').update({is_admin:true}).eq('id',richAdmin.id));
  const adminFreeRows=ok(await anonymous.rpc('get_global_leaderboard',{search_username:null}));
  if(adminFreeRows.some(row=>row.username===richAdmin.username)) throw new Error('Administrator appeared in the leaderboard');
  if(adminFreeRows[0].username!==leader.username||Number(adminFreeRows[0].rank)!==1) throw new Error('Administrator net worth altered rank #1');
  if(adminFreeRows.length!==50||adminFreeRows.some((row,index)=>Number(row.rank)!==index+1)) throw new Error('Ranks were not renumbered without administrators');
  if(ok(await anonymous.rpc('get_global_leaderboard',{search_username:richAdmin.username})).length) throw new Error('Administrator was searchable in the leaderboard');

  // Public lineups: default private, owner-controlled, authenticated readers only.
  const owner=users[0];
  const ownerClient=createClient(url,anon,{auth:{persistSession:false}});
  ok(await ownerClient.auth.signInWithPassword({email:`${owner.username}@example.com`,password}));
  if(ok(await admin.from('profiles').select('public_lineup_enabled').eq('id',owner.id).single()).public_lineup_enabled) throw new Error('Public lineup did not default to false');
  if(!(await signed.rpc('get_public_lineup',{target_username:owner.username})).error) throw new Error('Private lineup was readable');
  if(!(await anonymous.rpc('get_public_lineup',{target_username:owner.username})).error) throw new Error('Anonymous read of a lineup succeeded');
  if(!(await signed.from('profiles').update({public_lineup_enabled:true}).eq('id',owner.id)).error) throw new Error('Direct visibility write bypassed the RPC');
  // The RPC takes no target: a caller can only ever flip their own row.
  ok(await signed.rpc('set_public_lineup_visibility',{enabled:true}));
  if(ok(await admin.from('profiles').select('public_lineup_enabled').eq('id',owner.id).single()).public_lineup_enabled) throw new Error('A user changed another account visibility');
  ok(await signed.rpc('set_public_lineup_visibility',{enabled:false}));

  ok(await ownerClient.rpc('set_public_lineup_visibility',{enabled:true}));
  const visible=ok(await signed.rpc('get_public_lineup',{target_username:owner.username.toUpperCase()}));
  if(visible.username!==owner.username||Number(visible.rank)!==1||visible.lineup.length!==1) throw new Error('Public lineup read failed');
  if(visible.lineup[0].playerId!==prices[0].id||visible.lineup[0].currentPrice!==prices[0].price) throw new Error('Public lineup content failed');
  const payload=JSON.stringify(visible);
  for(const forbidden of ['@example.com','acquired','Pnl','pnl','balance','wallet','locked','userId','user_id',owner.id]) {
    if(payload.includes(forbidden)) throw new Error(`Public lineup exposed private data: ${forbidden}`);
  }
  const lineupKeys=['currentPrice','handle','photoUrl','playerId','rarity','realName','team'];
  if(JSON.stringify(Object.keys(visible.lineup[0]).sort())!==JSON.stringify(lineupKeys)) throw new Error('Public lineup returned unexpected player fields');
  if(JSON.stringify(Object.keys(visible).sort())!==JSON.stringify(['badges','lineup','nameStyle','netWorth','rank','username'])) throw new Error('Public lineup returned unexpected fields');

  // A lineup with no players is a clean empty state, not an error.
  const emptyOwner=users[1];
  const emptyClient=createClient(url,anon,{auth:{persistSession:false}});
  ok(await emptyClient.auth.signInWithPassword({email:`${emptyOwner.username}@example.com`,password}));
  ok(await emptyClient.rpc('set_public_lineup_visibility',{enabled:true}));
  const emptyLineup=ok(await signed.rpc('get_public_lineup',{target_username:emptyOwner.username}));
  if(!Array.isArray(emptyLineup.lineup)||emptyLineup.lineup.length) throw new Error('Empty lineup state failed');

  // Ineligible targets are indistinguishable from private ones.
  for(const target of [synthetic,suspended,banned,richAdmin]) {
    ok(await admin.from('profiles').update({public_lineup_enabled:true}).eq('id',target.id));
    const denied=await signed.rpc('get_public_lineup',{target_username:target.username});
    if(!denied.error) throw new Error(`Ineligible target lineup was readable: ${target.username}`);
    if(denied.error.message!==(await signed.rpc('get_public_lineup',{target_username:`ghost${suffix}`})).error?.message) {
      throw new Error('Lineup denial distinguishes private accounts from unknown ones');
    }
  }

  // Turning visibility off must take effect on the very next read.
  ok(await ownerClient.rpc('set_public_lineup_visibility',{enabled:false}));
  if(!(await signed.rpc('get_public_lineup',{target_username:owner.username})).error) throw new Error('Disabled visibility remained readable');

  ok(await admin.from('profiles').update({is_admin:false}).eq('id',richAdmin.id));
  console.log('Community preferences, public leaderboard privacy, ranking, lineup visibility and dynamic badge checks passed.');
} finally {
  if(ids.length) await admin.from('profiles').update({account_status:'suspended',is_admin:false}).in('id',ids);
  for(const id of ids) await admin.auth.admin.updateUserById(id,{ban_duration:'876000h',user_metadata:{test_marker:'CHECK_COMMUNITY_RETIRED'}});
}
