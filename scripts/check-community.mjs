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
  const allowed=['badges','is_current_user','name_style','net_worth','rank','username'];
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
  console.log('Community preferences, public leaderboard privacy, ranking and dynamic badge checks passed.');
} finally {
  if(ids.length) await admin.from('profiles').update({account_status:'suspended',is_admin:false}).in('id',ids);
  for(const id of ids) await admin.auth.admin.updateUserById(id,{ban_duration:'876000h',user_metadata:{test_marker:'CHECK_COMMUNITY_RETIRED'}});
}
