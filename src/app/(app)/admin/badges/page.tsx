"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminNav from '@/components/AdminNav';
import BadgeList from '@/components/BadgeList';
import Header from '@/components/Header';
import { adminFetch, adminStepUp } from '@/lib/admin/client';
import type { PublicBadge } from '@/lib/types';

type Definition={slug:string;name:string;description:string;icon_token:string;assignment_type:'automatic'|'verified'|'manual'|'dynamic'};
type Candidate={candidate_order:number;user_id:string;username:string;account_status:string;registered_at:string;
  email_confirmed:boolean;historical_candidate:boolean;currently_awardable:boolean;award_block_reason:string|null;already_awarded:boolean};

export default function AdminBadgesPage() {
  const [definitions,setDefinitions]=useState<Definition[]>([]);
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [mutationsEnabled,setMutationsEnabled]=useState(false);
  const [badgeMutationsEnabled,setBadgeMutationsEnabled]=useState(false);
  const [error,setError]=useState('');
  const [mfaCode,setMfaCode]=useState('');
  const [awardPending,setAwardPending]=useState(false);
  const [awardMessage,setAwardMessage]=useState('');
  useEffect(()=>{adminFetch('/api/admin/badges').then(async response=>{
    if(!response?.ok) throw new Error('unavailable');
    return response.json() as Promise<{definitions:Definition[];foundingCandidates:Candidate[];mutationsEnabled:boolean;badgeMutationsEnabled:boolean}>;
  }).then(result=>{setDefinitions(result.definitions);setCandidates(result.foundingCandidates);setMutationsEnabled(result.mutationsEnabled);setBadgeMutationsEnabled(result.badgeMutationsEnabled);}).catch(()=>setError('Badge administration unavailable'));},[]);
  const awardable=candidates.filter(candidate=>candidate.currently_awardable&&!candidate.already_awarded);
  const awardFounders=async()=>{
    const userIds=awardable.map(candidate=>candidate.user_id);
    if(!badgeMutationsEnabled||!userIds.length||mfaCode.length!==6)return;
    setAwardPending(true);setAwardMessage('');
    const token=await adminStepUp('badge',mfaCode,undefined,userIds);
    if(!token){setAwardMessage('Step-up failed: check the authenticator code.');setAwardPending(false);setMfaCode('');return;}
    const response=await adminFetch('/api/admin/badges/bulk',{method:'POST',body:JSON.stringify({
      userIds,badge:'founding-50',assign:true,reason:'Award verified Founding 50 candidates',
      requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),stepUpToken:token,
    })});
    if(!response?.ok)setAwardMessage('Assignment rejected — nothing was changed. Reload the candidate list and try again.');
    else{const awarded=new Set(userIds);setCandidates(current=>current.map(candidate=>awarded.has(candidate.user_id)?{...candidate,already_awarded:true}:candidate));setAwardMessage(`Assigned Founding 50 to ${userIds.length} accounts.`);}
    setAwardPending(false);setMfaCode('');
  };
  const display=definitions.map(badge=>({slug:badge.slug,name:badge.name,description:badge.description,icon:badge.icon_token})) satisfies PublicBadge[];
  return <div className="app-shell"><Header/><AdminNav /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN · ACHIEVEMENTS</div><h1>Badges</h1><p>Definitions, verified Founding 50 candidates and audited bulk assignment.</p></div>
    {error&&<p className="notice error" role="alert">{error}</p>}
    <p className="notice">Badge mutations: <strong>{badgeMutationsEnabled?'enabled':'disabled (fail-closed)'}</strong> · General admin mutations: <strong>{mutationsEnabled?'enabled':'disabled (fail-closed)'}</strong>. The two capabilities are independent; badge assignment answers only to the first.</p>
    {!badgeMutationsEnabled&&<p className="notice">Read-only. Badge assign/remove requires <code>ADMIN_BADGE_MUTATIONS_ENABLED=true</code> and <code>admin_runtime_config.badge_mutations_enabled=true</code>. Enabling it is an infrastructure operation and is deliberately not available from this UI.</p>}
    <section className="epic-panel"><div className="section-heading"><h2>Badge definitions</h2><span>{definitions.length}</span></div><BadgeList badges={display}/><div className="admin-stats">{definitions.map(badge=><div key={badge.slug}><small>{badge.slug}</small><b>{badge.assignment_type}</b></div>)}</div></section>
    <section className="epic-panel"><div className="section-heading"><h2>Founding 50 candidates</h2><span>{candidates.length}/50</span></div><p>Historical slot: ordered by trusted Auth registration time, then internal ID. Excluded by authoritative database facts only — administrators, accounts carrying a <code>test_marker</code>, banned, anonymized and deleted accounts. Nickname shape and email domain are never eligibility criteria, and an unconfirmed email is shown for information only. A suspended account keeps its historical slot but is not awardable until it is active again.</p>
      {awardable.length>0&&<div className="form-actions"><label>MFA code<input value={mfaCode} onChange={event=>setMfaCode(event.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" disabled={awardPending}/></label><button className="epic-button" disabled={!badgeMutationsEnabled||awardPending||mfaCode.length!==6} onClick={awardFounders}>Assign to {awardable.length} eligible accounts</button></div>}
      {awardMessage&&<p className="notice" role="status">{awardMessage}</p>}
      <div className="table-wrap"><table><thead><tr><th>#</th><th>Nickname</th><th>Status</th><th>Registered</th><th>Email confirmed</th><th>Historical</th><th>Awardable</th><th>Block reason</th><th>Awarded</th><th /></tr></thead><tbody>{candidates.map(candidate=><tr key={candidate.user_id}><td>{candidate.candidate_order}</td><td><strong>{candidate.username}</strong></td><td>{candidate.account_status}</td><td>{new Date(candidate.registered_at).toLocaleString()}</td><td>{candidate.email_confirmed?'Yes':'No'}</td><td>{candidate.historical_candidate?'Yes':'No'}</td><td>{candidate.currently_awardable?'Yes':'No'}</td><td>{candidate.award_block_reason||'—'}</td><td>{candidate.already_awarded?'Yes':'No'}</td><td><Link href={`/admin/users/${candidate.user_id}`}>Open</Link></td></tr>)}</tbody></table></div>{!candidates.length&&!error&&<p>No verified candidates.</p>}<p><small>Historical candidates: {candidates.length}/50 · currently awardable: {candidates.filter(candidate=>candidate.currently_awardable).length}</small></p></section>
  </main></div>;
}
