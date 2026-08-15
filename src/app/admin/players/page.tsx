/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminNav from '@/components/AdminNav';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';

type KnownAccount = {
  account_id:string; username:string; flag_token:string|null; best_rank:number;
  appearances:number; latest_event:string|null; latest_region:string|null; latest_ends_at:string|null;
};
type RosterPlayer = {
  id:string; account_id:string|null; handle:string; organization:string|null; rarity:string;
  price:number; pro_tier:string|null; active:boolean; last_seen_at:string|null;
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

  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterActive, setRosterActive] = useState<'true' | 'false' | ''>('true');
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [rosterReason, setRosterReason] = useState<Record<string, string>>({});
  const [rosterPrice, setRosterPrice] = useState<Record<string, string>>({});
  const [rosterTier, setRosterTier] = useState<Record<string, string>>({});
  const [rosterPending, setRosterPending] = useState('');

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

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    const params = new URLSearchParams();
    if (rosterSearch.trim().length >= 2) params.set('search', rosterSearch.trim());
    if (rosterActive) params.set('active', rosterActive);
    const response = await adminFetch(`/api/admin/players/roster?${params.toString()}`);
    if (!response?.ok) { setRoster([]); setRosterTotal(0); setRosterLoading(false); return; }
    const data = await response.json() as { players:RosterPlayer[]; total:number };
    setRoster(data.players); setRosterTotal(data.total);
    setRosterPrice(current => ({ ...Object.fromEntries(data.players.map(row => [row.id, current[row.id] ?? String(row.price)])) }));
    setRosterTier(current => ({ ...Object.fromEntries(data.players.map(row => [row.id, current[row.id] ?? (row.pro_tier || '')])) }));
    setRosterLoading(false);
  }, [rosterSearch, rosterActive]);
  useEffect(() => { loadRoster(); }, [loadRoster]);

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
    if (response?.ok) { setAccounts(current => current.filter(row => row.account_id !== account.account_id)); loadRoster(); }
    setPending('');
  };

  const updatePlayer = async (row:RosterPlayer) => {
    const actionReason = rosterReason[row.id]?.trim() || '';
    const price = Number(rosterPrice[row.id]);
    if (actionReason.length < 3 || !Number.isFinite(price) || price <= 0) return;
    setRosterPending(row.id); setMessage('');
    const response = await adminFetch('/api/admin/players/update', {
      method:'POST',
      body:JSON.stringify({ id:row.id, price, tier: rosterTier[row.id] || null,
        reason:actionReason, requestId:crypto.randomUUID(), idempotencyKey:crypto.randomUUID() }),
    });
    setMessage(response?.ok ? `${row.handle} updated.` : 'Update rejected.');
    if (response?.ok) loadRoster();
    setRosterPending('');
  };

  const retirePlayer = async (row:RosterPlayer) => {
    const actionReason = rosterReason[row.id]?.trim() || '';
    if (actionReason.length < 3 || !window.confirm(`Retire ${row.handle} from the market?`)) return;
    setRosterPending(row.id); setMessage('');
    const response = await adminFetch('/api/admin/players/retire', {
      method:'POST',
      body:JSON.stringify({ id:row.id, reason:actionReason, requestId:crypto.randomUUID(), idempotencyKey:crypto.randomUUID() }),
    });
    setMessage(response?.ok ? `${row.handle} retired.` : 'Retirement rejected.');
    if (response?.ok) loadRoster();
    setRosterPending('');
  };

  const submit = (event:FormEvent) => { event.preventDefault(); setSubmitted(search); };

  return <div className="app-shell"><Header /><AdminNav /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>Player pool</h1>
      <p>Browse and manage carried players, and promote accounts seen in tracked tournaments that the market does not carry yet.</p></div>
    {message && <p className="notice" role="status">{message}</p>}
    {!enabled && <p className="notice">Read-only. Editing, retiring and promotion require <code>ADMIN_PLAYER_POOL_MUTATIONS_ENABLED=true</code> and <code>admin_runtime_config.player_pool_mutations_enabled=true</code>. Enabling it is an infrastructure operation and is deliberately not available from this UI.</p>}

    <section className="epic-panel">
      <div className="section-heading"><h2>Market roster · {rosterTotal}</h2></div>
      <form className="epic-panel admin-user-filters" onSubmit={event => event.preventDefault()}>
        <label>Search<input value={rosterSearch} onChange={event => setRosterSearch(event.target.value)} maxLength={80} placeholder="Handle, at least 2 characters" /></label>
        <label>Status<select value={rosterActive} onChange={event => setRosterActive(event.target.value as 'true' | 'false' | '')}>
          <option value="true">Active</option><option value="false">Retired</option><option value="">All</option>
        </select></label>
      </form>
      <div className="table-wrap"><table>
        <thead><tr><th>Player</th><th>Team</th><th>Price</th><th>Tier</th><th>Reason</th><th /></tr></thead>
        <tbody aria-busy={rosterLoading}>{rosterLoading
          ? Array.from({ length:4 }, (_, index) => <tr key={index} className="row-skeleton"><td colSpan={6}><span /></td></tr>)
          : roster.map(row => <tr key={row.id} className={row.active ? '' : 'selected-row'}>
            <td><strong>{row.handle}</strong><small>{row.active ? 'Active' : 'Retired'}{row.last_seen_at ? ` · seen ${new Date(row.last_seen_at).toLocaleDateString()}` : ''}</small></td>
            <td>{row.organization || '—'}</td>
            <td><input type="number" min={1} aria-label={`Price for ${row.handle}`} value={rosterPrice[row.id] ?? String(row.price)} disabled={!enabled || rosterPending === row.id}
              onChange={event => setRosterPrice(current => ({ ...current, [row.id]:event.target.value }))} /></td>
            <td><select aria-label={`Tier for ${row.handle}`} value={rosterTier[row.id] ?? (row.pro_tier || '')} disabled={!enabled || rosterPending === row.id}
              onChange={event => setRosterTier(current => ({ ...current, [row.id]:event.target.value }))}>
              <option value="">—</option>{TIERS.map(value => <option key={value} value={value}>{value}</option>)}
            </select></td>
            <td><input aria-label={`Reason for ${row.handle}`} value={rosterReason[row.id] || ''} maxLength={500} placeholder="Recorded in the audit log"
              disabled={!enabled || rosterPending === row.id} onChange={event => setRosterReason(current => ({ ...current, [row.id]:event.target.value }))} /></td>
            <td className="league-actions">
              <button className="epic-button" disabled={!enabled || rosterPending === row.id || (rosterReason[row.id]?.trim().length || 0) < 3}
                onClick={() => updatePlayer(row)}>Save</button>
              {row.active && <button className="epic-button secondary danger-button" disabled={!enabled || rosterPending === row.id || (rosterReason[row.id]?.trim().length || 0) < 3}
                onClick={() => retirePlayer(row)}>Retire</button>}
            </td>
          </tr>)}</tbody>
      </table></div>
      {!rosterLoading && !roster.length && <p>No players match this filter.</p>}
    </section>

    <section className="epic-panel section-block">
      <div className="section-heading"><h2>{accounts.length} candidates</h2><Link href="/admin/users">Users</Link></div>
      <p>Only accounts with a stored result inside the qualifying rank appear here — anything deeper could never earn a point. Statistics are what we already recorded; nothing is estimated.</p>
      <form className="epic-panel admin-user-filters" onSubmit={submit}>
        <label>Search<input value={search} onChange={event => setSearch(event.target.value)} maxLength={80} placeholder="Player name, at least 2 characters" /></label>
        <label>Reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder="Recorded in the audit log" /></label>
        <button className="epic-button">Search</button>
      </form>
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
