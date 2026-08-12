/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';

type KnownAccount = {
  account_id:string; username:string; flag_token:string|null; best_rank:number;
  appearances:number; latest_event:string|null; latest_region:string|null; latest_ends_at:string|null;
};
const TIERS = ['elite', 'contender', 'regional', 'open'] as const;

export default function AdminPlayersPage() {
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [accounts, setAccounts] = useState<KnownAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState('');
  const [tier, setTier] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  useEffect(() => {
    adminFetch('/api/admin/session').then(async response => {
      if (response?.ok) setEnabled(Boolean((await response.json()).playerPoolMutationsEnabled));
    }).catch(() => setEnabled(false));
  }, []);

  const load = useCallback(async () => {
    if (submitted.trim().length < 2) { setAccounts([]); return; }
    setLoading(true);
    const response = await adminFetch(`/api/admin/players?search=${encodeURIComponent(submitted.trim())}`);
    if (!response?.ok) { setMessage('Account search unavailable'); setAccounts([]); setLoading(false); return; }
    setAccounts((await response.json()).accounts as KnownAccount[]);
    setMessage(''); setLoading(false);
  }, [submitted]);
  useEffect(() => { load(); }, [load]);

  const promote = async (account:KnownAccount) => {
    if (reason.trim().length < 3) return;
    setPending(account.account_id); setMessage('');
    const response = await adminFetch('/api/admin/players/promote', {
      method:'POST',
      body:JSON.stringify({ accountId:account.account_id, tier:tier[account.account_id] || 'contender',
        reason:reason.trim(), requestId:crypto.randomUUID(), idempotencyKey:crypto.randomUUID() }),
    });
    setMessage(response?.ok
      ? `${account.username} added to the market.`
      : 'Rejected — nothing was written. The account needs a stored competitive result inside the qualifying rank.');
    if (response?.ok) setAccounts(current => current.filter(row => row.account_id !== account.account_id));
    setPending('');
  };

  const submit = (event:FormEvent) => { event.preventDefault(); setSubmitted(search); };

  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>Player pool</h1>
      <p>Accounts seen in tracked tournaments that the market does not carry yet.</p></div>
    {message && <p className="notice" role="status">{message}</p>}
    {!enabled && <p className="notice">Read-only. Promotion requires <code>ADMIN_PLAYER_POOL_MUTATIONS_ENABLED=true</code> and <code>admin_runtime_config.player_pool_mutations_enabled=true</code>. Enabling it is an infrastructure operation and is deliberately not available from this UI.</p>}
    <form className="epic-panel admin-user-filters" onSubmit={submit}>
      <label>Search<input value={search} onChange={event => setSearch(event.target.value)} maxLength={80} placeholder="Player name, at least 2 characters" /></label>
      <label>Reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder="Recorded in the audit log" /></label>
      <button className="epic-button">Search</button>
    </form>
    <section className="epic-panel">
      <div className="section-heading"><h2>{accounts.length} candidates</h2><Link href="/admin/users">Users</Link></div>
      <p>Only accounts with a stored result inside the qualifying rank appear here — anything deeper could never earn a point. Statistics are what we already recorded; nothing is estimated.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Player</th><th>Best rank</th><th>Events</th><th>Latest</th><th>Tier</th><th /></tr></thead>
        <tbody aria-busy={loading}>{loading
          ? Array.from({ length:4 }, (_, index) => <tr key={index} className="row-skeleton"><td colSpan={6}><span /></td></tr>)
          : accounts.map(account => <tr key={account.account_id}>
            <td><strong>{account.username}</strong><small>{account.flag_token?.split('_').pop() || '—'}</small></td>
            <td>{account.best_rank}</td><td>{account.appearances}</td>
            <td>{account.latest_event || '—'}<small>{account.latest_region || ''}</small></td>
            <td><select aria-label={`Tier for ${account.username}`} value={tier[account.account_id] || 'contender'} disabled={!enabled || pending === account.account_id}
              onChange={event => setTier(current => ({ ...current, [account.account_id]:event.target.value }))}>
              {TIERS.map(value => <option key={value} value={value}>{value}</option>)}
            </select></td>
            <td><button className="epic-button" disabled={!enabled || pending === account.account_id || reason.trim().length < 3}
              onClick={() => promote(account)}>Add to market</button></td>
          </tr>)}</tbody>
      </table></div>
      {!loading && !accounts.length && <p>{submitted.trim().length < 2 ? 'Search for a player to begin.' : 'No untracked accounts match.'}</p>}
    </section>
  </main></div>;
}
