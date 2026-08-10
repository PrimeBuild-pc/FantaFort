"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BadgeList from '@/components/BadgeList';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';
import type { PublicBadge } from '@/lib/types';

type Definition={slug:string;name:string;description:string;icon_token:string;assignment_type:'automatic'|'verified'|'manual'|'dynamic'};
type Candidate={candidate_order:number;user_id:string;username:string;account_status:string;registered_at:string;email_confirmed:boolean;already_awarded:boolean};

export default function AdminBadgesPage() {
  const [definitions,setDefinitions]=useState<Definition[]>([]);
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [mutationsEnabled,setMutationsEnabled]=useState(false);
  const [badgeMutationsEnabled,setBadgeMutationsEnabled]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{adminFetch('/api/admin/badges').then(async response=>{
    if(!response?.ok) throw new Error('unavailable');
    return response.json() as Promise<{definitions:Definition[];foundingCandidates:Candidate[];mutationsEnabled:boolean;badgeMutationsEnabled:boolean}>;
  }).then(result=>{setDefinitions(result.definitions);setCandidates(result.foundingCandidates);setMutationsEnabled(result.mutationsEnabled);setBadgeMutationsEnabled(result.badgeMutationsEnabled);}).catch(()=>setError('Badge administration unavailable'));},[]);
  const display=definitions.map(badge=>({slug:badge.slug,name:badge.name,description:badge.description,icon:badge.icon_token})) satisfies PublicBadge[];
  return <div className="app-shell"><Header/><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN · ACHIEVEMENTS</div><h1>Badges</h1><p>Definitions and verified Founding 50 dry-run. Assignment happens on the account detail page.</p></div>
    {error&&<p className="notice error" role="alert">{error}</p>}
    <p className="notice">Badge mutations: <strong>{badgeMutationsEnabled?'enabled':'disabled (fail-closed)'}</strong> · General admin mutations: <strong>{mutationsEnabled?'enabled':'disabled (fail-closed)'}</strong>. The two capabilities are independent; badge assignment answers only to the first.</p>
    {!badgeMutationsEnabled&&<p className="notice">Read-only. Badge assign/remove requires <code>ADMIN_BADGE_MUTATIONS_ENABLED=true</code> and <code>admin_runtime_config.badge_mutations_enabled=true</code>. Enabling it is an infrastructure operation and is deliberately not available from this UI.</p>}
    <section className="epic-panel"><div className="section-heading"><h2>Badge definitions</h2><span>{definitions.length}</span></div><BadgeList badges={display}/><div className="admin-stats">{definitions.map(badge=><div key={badge.slug}><small>{badge.slug}</small><b>{badge.assignment_type}</b></div>)}</div></section>
    <section className="epic-panel"><div className="section-heading"><h2>Founding 50 candidates</h2><span>{candidates.length}/50</span></div><p>Ordered by trusted Auth registration time, then internal ID. Administrators, synthetic markers, banned, anonymized and deleted accounts are excluded. No award is performed here; only these accounts are accepted by the Founding 50 assignment.</p><div className="table-wrap"><table><thead><tr><th>#</th><th>Nickname</th><th>Status</th><th>Registered</th><th>Email confirmed</th><th>Awarded</th><th /></tr></thead><tbody>{candidates.map(candidate=><tr key={candidate.user_id}><td>{candidate.candidate_order}</td><td><strong>{candidate.username}</strong></td><td>{candidate.account_status}</td><td>{new Date(candidate.registered_at).toLocaleString()}</td><td>{candidate.email_confirmed?'Yes':'No'}</td><td>{candidate.already_awarded?'Yes':'No'}</td><td><Link href={`/admin/users/${candidate.user_id}`}>Open</Link></td></tr>)}</tbody></table></div>{!candidates.length&&!error&&<p>No verified candidates.</p>}</section>
  </main></div>;
}
