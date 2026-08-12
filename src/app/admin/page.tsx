"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';

type Overview = { users:number; suspendedUsers:number; pendingPrivacyRequests:number; activeLeagues:number; pendingFriendRequests:number; players:number; errors24h:number; adminActions24h:number; latestSync:string|null };
type AppError = { id:number; path:string; message:string; created_at:string };
type Health = { database:string; authData:string; competitiveData:string; latestSync:string|null };
type Activity = { id:number; actor_username:string; action:string; target_type:string; outcome:string; created_at:string };

export default function AdminPage() {
  const { locale } = useLocale();
  const [overview, setOverview] = useState<Overview>();
  const [errors, setErrors] = useState<AppError[]>([]);
  const [health, setHealth] = useState<Health>();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [message, setMessage] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaPending, setMfaPending] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const controller = new AbortController();
    client.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) throw new Error('unauthorized');
      const sessionResponse = await fetch('/api/admin/session', {
        headers: { Authorization: `Bearer ${token}` }, signal:controller.signal,
      });
      if (!sessionResponse.ok) throw new Error('unauthorized');
      const session = await sessionResponse.json() as { currentAal?:string };
      if (session.currentAal !== 'aal2') {
        const factors = await client.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        setMfaFactorId(factors.data.totp.find(factor => factor.status === 'verified')?.id || '');
        setMfaRequired(true);
        return null;
      }
      const response = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` }, signal:controller.signal,
      });
      if (!response.ok) throw new Error('unavailable');
      return response.json() as Promise<{ overview:Overview; errors:AppError[]; health:Health; activity:Activity[] }>;
    }).then(result => {
      if (!result) return;
      setOverview(result.overview); setErrors(result.errors); setHealth(result.health); setActivity(result.activity);
    }).catch(error => {
      if (error.name !== 'AbortError') setMessage('Admin access unavailable');
    });
    return () => controller.abort();
  }, []);

  const enrollMfa = async () => {
    if (!supabase) return;
    setMfaPending(true); setMessage('');
    const factors = await supabase.auth.mfa.listFactors();
    for (const factor of factors.data?.totp.filter(item => item.status !== 'verified') || []) {
      await supabase.auth.mfa.unenroll({ factorId:factor.id });
    }
    const enrolled = await supabase.auth.mfa.enroll({ factorType:'totp', friendlyName:'FantaFort Admin' });
    setMfaPending(false);
    if (enrolled.error) return setMessage('MFA enrollment unavailable');
    setMfaFactorId(enrolled.data.id); setMfaQrCode(enrolled.data.totp.qr_code); setMfaSecret(enrolled.data.totp.secret);
  };

  const verifyMfa = async () => {
    if (!supabase || !mfaFactorId || !/^\d{6}$/.test(mfaCode)) return;
    setMfaPending(true); setMessage('');
    const verified = await supabase.auth.mfa.challengeAndVerify({ factorId:mfaFactorId, code:mfaCode });
    if (verified.error) { setMfaPending(false); return setMessage('MFA verification failed'); }
    const session = await supabase.auth.setSession({
      access_token:verified.data.access_token, refresh_token:verified.data.refresh_token,
    });
    if (session.error) { setMfaPending(false); return setMessage('MFA verification failed'); }
    window.location.reload();
  };

  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">OPERATIONS</div><h1>{'Admin'}</h1><p>{'Service health, data freshness and recent client errors.'}</p></div>
    {message && <p className="notice error" role="alert">{message}</p>}
    {mfaRequired && <section className="epic-panel"><h2>Administrator verification</h2><p>Admin access requires a verified authenticator app. This second factor is tied to your account and must not be shared.</p>
      {!mfaFactorId && <button className="epic-button" disabled={mfaPending} onClick={enrollMfa}>Set up authenticator</button>}
      {mfaQrCode && <div><Image src={mfaQrCode} width={192} height={192} unoptimized alt="Authenticator setup QR code" /><p>Manual setup key: <code>{mfaSecret}</code></p></div>}
      {mfaFactorId && <div className="form-actions"><label>Six-digit authenticator code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g,'').slice(0,6))} disabled={mfaPending} /></label><button className="epic-button" disabled={mfaPending || mfaCode.length !== 6} onClick={verifyMfa}>Verify administrator</button></div>}
    </section>}
    {overview && <><section className="admin-stats">
      <div><small>{'Users'}</small><b>{overview.users}</b><Link href="/admin/users">Details →</Link></div>
      <div><small>Suspended</small><b>{overview.suspendedUsers}</b><Link href="/admin/users?status=suspended">Details →</Link></div>
      <div><small>Privacy requests</small><b>{overview.pendingPrivacyRequests}</b><Link href="/admin/users?status=suspended">Review →</Link></div>
      <div><small>{'Active leagues'}</small><b>{overview.activeLeagues}</b><Link href="/leagues">Details →</Link></div>
      <div><small>{'Pending requests'}</small><b>{overview.pendingFriendRequests}</b></div>
      <div><small>{'Listed players'}</small><b>{overview.players}</b><Link href="/players">Details →</Link></div>
      <div><small>{'Errors · 24h'}</small><b>{overview.errors24h}</b><a href="#recent-errors">Details →</a></div>
      <div><small>Admin actions · 24h</small><b>{overview.adminActions24h}</b><Link href="/admin/audit">Audit →</Link></div>
      <div><small>Achievements</small><b>5</b><Link href="/admin/badges">Badge preview →</Link></div>
    </section><p className="notice">{'Last market sync'}: {overview.latestSync ? new Date(overview.latestSync).toLocaleString(locale) : '—'}</p></>}
    {health && <section className="epic-panel"><div className="section-heading"><h2>Service health</h2></div><div className="admin-stats"><div><small>Database</small><b>{health.database}</b></div><div><small>Auth data</small><b>{health.authData}</b></div><div><small>Competitive data</small><b>{health.competitiveData}</b></div></div></section>}
    <section className="epic-panel"><div className="section-heading"><h2>Recent admin activity</h2><Link href="/admin/audit">Full audit →</Link></div><div className="error-log">{activity.length ? activity.map(entry => <article key={entry.id}><strong>{entry.action}</strong><span>{entry.actor_username} · {entry.target_type} · {entry.outcome}</span><small>{new Date(entry.created_at).toLocaleString(locale)}</small></article>) : <p>No administrative activity.</p>}</div></section>
    <section className="epic-panel" id="recent-errors"><div className="section-heading"><h2>{'Recent errors'}</h2><code>npm run import:results -- data.json</code></div><div className="error-log">{errors.length ? errors.map(error => <article key={error.id}><strong>{error.path}</strong><span>{error.message}</span><small>{new Date(error.created_at).toLocaleString(locale)}</small></article>) : <p>{'No recent errors.'}</p>}</div></section>
  </main></div>;
}
