"use client";

import { useEffect, useState } from 'react';
import BadgeList from '@/components/BadgeList';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';
import type { PublicBadge } from '@/lib/types';

type Definition={slug:string;name:string;description:string;icon_token:string;assignment_type:'automatic'|'manual'|'dynamic'};
type Candidate={candidate_order:number;user_id:string;username:string;account_status:string;registered_at:string;already_awarded:boolean};

export default function AdminBadgesPage() {
  const [definitions,setDefinitions]=useState<Definition[]>([]);
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [mutationsEnabled,setMutationsEnabled]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{adminFetch('/api/admin/badges').then(async response=>{
    if(!response?.ok) throw new Error('unavailable');
    return response.json() as Promise<{definitions:Definition[];foundingCandidates:Candidate[];mutationsEnabled:boolean}>;
  }).then(result=>{setDefinitions(result.definitions);setCandidates(result.foundingCandidates);setMutationsEnabled(result.mutationsEnabled);}).catch(()=>setError('Badge administration unavailable'));},[]);
  const display=definitions.map(badge=>({slug:badge.slug,name:badge.name,description:badge.description,icon:badge.icon_token})) satisfies PublicBadge[];
  return <div className="app-shell"><Header/><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN · ACHIEVEMENTS</div><h1>Badges</h1><p>Definitions and verified Founding 50 dry-run. This page does not assign badges.</p></div>
    {error&&<p className="notice error" role="alert">{error}</p>}
    <p className="notice">Admin badge mutations: <strong>{mutationsEnabled?'enabled':'disabled (fail-closed)'}</strong>. Founding 50 remains preview-only.</p>
    <section className="epic-panel"><div className="section-heading"><h2>Badge definitions</h2><span>{definitions.length}</span></div><BadgeList badges={display}/><div className="admin-stats">{definitions.map(badge=><div key={badge.slug}><small>{badge.slug}</small><b>{badge.assignment_type}</b></div>)}</div></section>
    <section className="epic-panel"><div className="section-heading"><h2>Founding 50 candidates</h2><span>{candidates.length}/50</span></div><p>Ordered by trusted Auth registration time, then internal ID. Synthetic markers, anonymized and deleted accounts are excluded. No award is performed.</p><div className="table-wrap"><table><thead><tr><th>#</th><th>Nickname</th><th>Status</th><th>Registered</th><th>Awarded</th></tr></thead><tbody>{candidates.map(candidate=><tr key={candidate.user_id}><td>{candidate.candidate_order}</td><td><strong>{candidate.username}</strong></td><td>{candidate.account_status}</td><td>{new Date(candidate.registered_at).toLocaleString()}</td><td>{candidate.already_awarded?'Yes':'No'}</td></tr>)}</tbody></table></div>{!candidates.length&&!error&&<p>No verified candidates.</p>}</section>
  </main></div>;
}
