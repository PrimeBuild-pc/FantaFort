"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import BadgeList from '@/components/BadgeList';
import Header from '@/components/Header';
import { adminFetch, adminStepUp } from '@/lib/admin/client';
import type { PublicBadge } from '@/lib/types';

type UserDetail = {
  id:string; email:string; username:string; status:string; role:string;
  createdAt:string; lastSignInAt:string|null; emailConfirmedAt:string|null;
  balance:number|null; lockedBalance:number|null; rewardPoints:number; experiencePoints:number;
  communityEmailOptIn:boolean; communityEmailOptedInAt:string|null; communityEmailOptedOutAt:string|null;
  badges:PublicBadge[]; availableBadges:(PublicBadge&{assignmentType:'automatic'|'manual'})[];
};
type Impact = Record<string, number|boolean>;

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id:string }>();
  const [user, setUser] = useState<UserDetail>();
  const [impact, setImpact] = useState<Impact>();
  const [impactFingerprint, setImpactFingerprint] = useState('');
  const [impactConfirmed, setImpactConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [mutationsEnabled, setMutationsEnabled] = useState(false);
  const [anonymizationEnabled, setAnonymizationEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [delta, setDelta] = useState(0);
  const [reference, setReference] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [anonymizeConfirm, setAnonymizeConfirm] = useState('');
  const [selectedBadge, setSelectedBadge] = useState('');

  const load = useCallback(() => adminFetch(`/api/admin/users/${encodeURIComponent(id)}`).then(async response => {
    if (!response?.ok) throw new Error('unavailable');
    return response.json() as Promise<{ user:UserDetail; impact:Impact; impactFingerprint:string }>;
  }).then(result => {
    setUser(result.user); setImpact(result.impact); setImpactFingerprint(result.impactFingerprint); setImpactConfirmed(false);
    setSelectedBadge(value=>value||result.user.availableBadges[0]?.slug||'');
  }), [id]);

  useEffect(() => {
    load().catch(() => setMessage('Account detail unavailable'));
    adminFetch('/api/admin/session').then(response => response?.ok ? response.json() : null)
      .then((result:{ mutationsEnabled?:boolean; anonymizationEnabled?:boolean }|null) => {
        setMutationsEnabled(result?.mutationsEnabled === true);
        setAnonymizationEnabled(result?.anonymizationEnabled === true);
      });
  }, [load]);

  const run = async (action:'suspend'|'reactivate'|'revoke-sessions'|'recovery', label:string) => {
    if (!mutationsEnabled || reason.trim().length < 3 || !/^\d{6}$/.test(mfaCode)
      || !window.confirm(`${label} ${user?.username || 'account'}?`)) return;
    setPending(true); setMessage('');
    const scope = action === 'revoke-sessions' ? 'session_revoke' : action === 'recovery' ? 'recovery' : 'account_status';
    const stepUpToken = await adminStepUp(scope, mfaCode, id);
    if (!stepUpToken) { setPending(false); setMessage('MFA step-up failed'); return; }
    const requestId = crypto.randomUUID();
    const response = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/${action}`, {
      method:'POST',
      body:JSON.stringify({ reason:reason.trim(), requestId, idempotencyKey:`admin:${action}:${requestId}`, stepUpToken }),
    });
    setPending(false); setMfaCode('');
    if (!response?.ok) return setMessage('Admin operation unavailable');
    setReason(''); setMessage(action === 'recovery' ? 'Recovery request accepted' : 'Operation completed');
    await load();
  };

  const adjustWallet = async () => {
    if (!user || user.balance == null || !mutationsEnabled || user.role === 'admin' || !Number.isInteger(delta) || delta === 0
      || Math.abs(delta) > 10000 || reason.trim().length < 3 || !/^\d{6}$/.test(mfaCode)
      || !window.confirm(`Apply ${delta > 0 ? '+' : ''}${delta} coins to ${user.username}?`)) return;
    setPending(true); setMessage('');
    const stepUpToken = await adminStepUp('economy', mfaCode);
    if (!stepUpToken) { setPending(false); setMessage('MFA step-up failed'); return; }
    const requestId = crypto.randomUUID();
    const response = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/wallet`, {
      method:'POST', body:JSON.stringify({ delta, expectedBalance:user.balance, reason:reason.trim(), reference:reference.trim() || null,
        requestId, idempotencyKey:`admin:wallet:${requestId}`, stepUpToken }),
    });
    setPending(false); setMfaCode('');
    if (!response?.ok) return setMessage('Wallet adjustment unavailable');
    setDelta(0); setReference(''); setReason(''); setMessage('Wallet adjustment completed');
    await load();
  };

  const setBadge = async (assign:boolean) => {
    if (!user || !mutationsEnabled || user.role==='admin' || user.status!=='active' || !selectedBadge
      || reason.trim().length<3 || !/^\d{6}$/.test(mfaCode)
      || !window.confirm(`${assign?'Assign':'Remove'} ${selectedBadge} ${assign?'to':'from'} ${user.username}?`)) return;
    setPending(true); setMessage('');
    const stepUpToken=await adminStepUp('badge',mfaCode,id);
    if (!stepUpToken) { setPending(false); setMessage('MFA step-up failed'); return; }
    const requestId=crypto.randomUUID();
    const response=await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/badges`,{
      method:'POST', body:JSON.stringify({badge:selectedBadge,assign,reason:reason.trim(),requestId,idempotencyKey:`admin:badge:${requestId}`,stepUpToken}),
    });
    setPending(false); setMfaCode('');
    if (!response?.ok) return setMessage('Badge operation unavailable');
    setReason(''); setMessage('Badge operation completed'); await load();
  };

  const anonymize = async () => {
    if (!user || !anonymizationEnabled || user.status !== 'suspended' || user.role === 'admin'
      || !impactConfirmed || !/^[a-f0-9]{32}$/.test(impactFingerprint)
      || (anonymizeConfirm !== user.email && anonymizeConfirm !== user.id) || reason.trim().length < 3
      || !/^\d{6}$/.test(mfaCode) || !window.confirm(`Permanently anonymize ${user.username}?`)) return;
    setPending(true); setMessage('');
    const stepUpToken = await adminStepUp('anonymize', mfaCode);
    if (!stepUpToken) { setPending(false); setMessage('MFA step-up failed'); return; }
    const requestId = crypto.randomUUID();
    const response = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/anonymize`, {
      method:'POST', body:JSON.stringify({ confirmation:anonymizeConfirm, impactFingerprint, reason:reason.trim(), requestId,
        idempotencyKey:`admin:anonymize:${requestId}`, stepUpToken }),
    });
    setPending(false); setMfaCode('');
    if (!response?.ok) return setMessage('Anonymization incomplete');
    setAnonymizeConfirm(''); setImpactConfirmed(false); setReason(''); setMessage('Account anonymized');
    await load();
  };

  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN · USER DETAIL</div><h1>{user?.username || 'Account'}</h1><p>{mutationsEnabled ? 'Sensitive actions require an explicit reason and confirmation.' : 'Read-only view. Mutations are disabled by server configuration.'}</p></div>
    {message && <p className="notice error" role="alert">{message}</p>}
    {user && <><section className="admin-stats">
      <div><small>Status</small><b>{user.status}</b></div><div><small>Role</small><b>{user.role}</b></div>
      <div><small>Coin balance</small><b>{user.balance ?? '—'}</b></div><div><small>Locked</small><b>{user.lockedBalance ?? '—'}</b></div>
      <div><small>FantaPoints</small><b>{user.rewardPoints}</b></div><div><small>XP</small><b>{user.experiencePoints}</b></div><div><small>Email updates</small><b>{user.communityEmailOptIn?'On':'Off'}</b></div>
    </section><section className="epic-panel"><h2>Identity</h2><dl className="admin-detail-list">
      <div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>UUID</dt><dd><code>{user.id}</code></dd></div>
      <div><dt>Registered</dt><dd>{new Date(user.createdAt).toLocaleString()}</dd></div>
      <div><dt>Last access</dt><dd>{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : '—'}</dd></div>
      <div><dt>Email confirmed</dt><dd>{user.emailConfirmedAt ? new Date(user.emailConfirmedAt).toLocaleString() : 'No'}</dd></div>
      <div><dt>Updates opt-in</dt><dd>{user.communityEmailOptedInAt ? new Date(user.communityEmailOptedInAt).toLocaleString() : 'Never'}</dd></div><div><dt>Updates opt-out</dt><dd>{user.communityEmailOptedOutAt ? new Date(user.communityEmailOptedOutAt).toLocaleString() : '—'}</dd></div>
    </dl></section><section className="epic-panel"><div className="section-heading"><h2>Public badges</h2><Link href="/admin/badges">Founding 50 preview</Link></div><BadgeList badges={user.badges}/><div className="badge-admin-preview"><label>Badge<select value={selectedBadge} onChange={event=>setSelectedBadge(event.target.value)} disabled={!mutationsEnabled||pending}>{user.availableBadges.map(badge=><option value={badge.slug} key={badge.slug}>{badge.name} · {badge.assignmentType}</option>)}</select></label><p>{user.availableBadges.find(badge=>badge.slug===selectedBadge)?.description}</p><div className="form-actions"><button className="epic-button" disabled={!mutationsEnabled||pending||user.role==='admin'||user.status!=='active'||!selectedBadge||reason.trim().length<3||mfaCode.length!==6} onClick={()=>setBadge(true)}>Assign badge</button><button className="epic-button secondary" disabled={!mutationsEnabled||pending||!user.badges.some(badge=>badge.slug===selectedBadge)||reason.trim().length<3||mfaCode.length!==6} onClick={()=>setBadge(false)}>Remove badge</button></div><small>{mutationsEnabled?'Reason and MFA code below are required.':'Prepared only: badge mutations remain fail-closed.'}</small></div></section></>}
    {impact && <section className="epic-panel"><h2>Linked data impact</h2><div className="admin-stats">{Object.entries(impact).map(([key,value]) => <div key={key}><small>{key}</small><b>{String(value)}</b></div>)}</div></section>}
    {user && <section className="epic-panel danger-zone"><h2>Account controls</h2><label>Mandatory reason<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={500} disabled={!mutationsEnabled || pending} /></label><label>MFA code for sensitive actions<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g,'').slice(0,6))} disabled={!mutationsEnabled || pending} /></label><div className="form-actions">
      {user.status === 'active' ? <button className="danger-button" disabled={!mutationsEnabled || pending || user.role === 'admin' || reason.trim().length < 3 || mfaCode.length !== 6} onClick={() => run('suspend','Suspend')}>Suspend</button> : <button className="epic-button" disabled={!mutationsEnabled || pending || user.role === 'admin' || reason.trim().length < 3 || mfaCode.length !== 6} onClick={() => run('reactivate','Reactivate')}>Reactivate</button>}
      <button className="epic-button secondary" disabled={!mutationsEnabled || pending || user.role === 'admin' || reason.trim().length < 3 || mfaCode.length !== 6} onClick={() => run('revoke-sessions','Revoke sessions for')}>Revoke sessions</button>
      <button className="epic-button secondary" disabled={!mutationsEnabled || pending || user.role === 'admin' || reason.trim().length < 3 || mfaCode.length !== 6} onClick={() => run('recovery','Request recovery for')}>Request recovery email</button>
    </div></section>}
    {user && <section className="epic-panel"><h2>Economy adjustment</h2><p>Append-only ledger entry. The displayed balance is used as an optimistic concurrency guard.</p><div className="admin-user-filters">
      <label>Coin delta<input type="number" min={-10000} max={10000} value={delta} onChange={event => setDelta(Number(event.target.value))} disabled={!mutationsEnabled || pending} /></label>
      <label>Reference<input value={reference} maxLength={200} onChange={event => setReference(event.target.value)} disabled={!mutationsEnabled || pending} /></label>
      <label>MFA code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g,'').slice(0,6))} disabled={!mutationsEnabled || pending} /></label>
      <button className="epic-button" disabled={!mutationsEnabled || pending || user.role === 'admin' || user.balance == null || delta === 0 || reason.trim().length < 3 || mfaCode.length !== 6} onClick={adjustWallet}>Apply adjustment</button>
    </div></section>}
    {user && anonymizationEnabled && <section className="epic-panel danger-zone"><h2>Anonymization</h2><p>No hard delete. The account must be suspended and free of open league dependencies. Review the impact preview above, then type the exact email or UUID.</p><label className="checkbox-label"><input type="checkbox" checked={impactConfirmed} onChange={event => setImpactConfirmed(event.target.checked)} /> I reviewed and confirm the current impact preview.</label><label>Confirmation<input value={anonymizeConfirm} onChange={event => setAnonymizeConfirm(event.target.value)} maxLength={254} /></label><button className="danger-button" disabled={pending || user.status !== 'suspended' || user.role === 'admin' || !impactConfirmed || !impactFingerprint || (anonymizeConfirm !== user.email && anonymizeConfirm !== user.id) || reason.trim().length < 3 || mfaCode.length !== 6} onClick={anonymize}>Anonymize account</button></section>}
    <p><Link href="/admin/users">← Users</Link></p>
  </main></div>;
}
