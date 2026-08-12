/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { adminFetch, adminStepUp } from '@/lib/admin/client';

type UserRow = {
  id:string;
  email:string;
  username:string;
  account_status:'active'|'suspended'|'anonymized';
  account_role:'admin'|'user';
  community_email_opt_in:boolean;
  badge_count:number;
  created_at:string;
  last_sign_in_at:string|null;
};

type SortKey = 'username'|'account_status'|'account_role'|'badge_count'|'created_at'|'last_sign_in_at';
const COLUMNS: { key:SortKey; label:string }[] = [
  { key:'username', label:'Account' },
  { key:'account_status', label:'Status' },
  { key:'account_role', label:'Role' },
  { key:'badge_count', label:'Badges' },
  { key:'created_at', label:'Registered' },
  { key:'last_sign_in_at', label:'Last access' },
];
const PAGE_SIZE = 25;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('created_at');
  const [direction, setDirection] = useState<'asc'|'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [badge, setBadge] = useState('founding-50');
  const [reason, setReason] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({ page:String(page), size:String(PAGE_SIZE), sort, direction });
    if (search.trim()) query.set('search', search.trim());
    if (status) query.set('status', status);
    if (role) query.set('role', role);
    const response = await adminFetch(`/api/admin/users?${query}`);
    if (!response?.ok) { setMessage('Admin users unavailable'); setLoading(false); return; }
    const result = await response.json() as { users:UserRow[]; total:number };
    setUsers(result.users); setTotal(result.total); setMessage(''); setLoading(false);
  }, [direction, page, role, search, sort, status]);

  useEffect(() => { load(); }, [load]);

  // Only active non-admin accounts can receive a badge, so nothing else is selectable.
  const selectable = users.filter(user => user.account_role !== 'admin' && user.account_status === 'active');
  const toggle = (id:string) => setSelected(current => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  // One step-up bound to this exact set of accounts, then one call that still writes
  // an audit row per award. The server re-validates every target and applies the batch
  // all-or-nothing, so a partially eligible selection changes nothing.
  const applyBulk = async (assign:boolean) => {
    const ids = [...selected];
    if (!ids.length || reason.trim().length < 3 || mfaCode.length !== 6) return;
    setBulkPending(true); setBulkMessage('');
    const token = await adminStepUp('badge', mfaCode, undefined, ids);
    if (!token) { setBulkMessage('Step-up failed: check the code and that badge mutations are enabled.'); setBulkPending(false); setMfaCode(''); return; }
    const response = await adminFetch('/api/admin/badges/bulk', {
      method:'POST',
      body:JSON.stringify({ userIds:ids, badge, assign, reason:reason.trim(),
        requestId:crypto.randomUUID(), idempotencyKey:crypto.randomUUID(), stepUpToken:token }),
    });
    const payload = await response?.json().catch(() => null) as { result?:{ processed:number; changed:number } }|null;
    if (!response?.ok) setBulkMessage('Rejected — nothing was changed. Check that every selected account is active and currently awardable.');
    else { setBulkMessage(`${assign?'Assigned':'Removed'} ${badge}: ${payload?.result?.changed ?? 0} changed of ${payload?.result?.processed ?? ids.length}.`); setSelected(new Set()); setReason(''); load(); }
    setMfaCode(''); setBulkPending(false);
  };
  const submit = (event:FormEvent) => { event.preventDefault(); setPage(0); load(); };

  // Sorting is server-side: the list is paginated, so reordering the fetched page
  // alone would show the wrong "first by last access".
  const sortBy = (key:SortKey) => {
    setPage(0);
    if (key === sort) { setDirection(value => value === 'asc' ? 'desc' : 'asc'); return; }
    setSort(key);
    setDirection(key === 'username' || key === 'account_status' || key === 'account_role' ? 'asc' : 'desc');
  };

  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>Users</h1><p>Server-side account search, sorting and impact review.</p></div>
    {message && <p className="notice error" role="alert">{message}</p>}
    <form className="epic-panel admin-user-filters" onSubmit={submit}>
      <label>Search<input value={search} onChange={event => setSearch(event.target.value)} maxLength={254} placeholder="Email, username or UUID" /></label>
      <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="anonymized">Anonymized</option></select></label>
      <label>Role<select value={role} onChange={event => { setRole(event.target.value); setPage(0); }}><option value="">All</option><option value="user">User</option><option value="admin">Admin</option></select></label>
      <button className="epic-button">Search</button>
    </form>
    {selected.size > 0 && <section className="epic-panel bulk-bar" aria-label="Bulk badge assignment">
      <div className="bulk-summary"><strong>{selected.size} selected</strong><button type="button" className="link-button" onClick={() => setSelected(new Set())}>Clear</button></div>
      <label>Badge<select value={badge} onChange={event => setBadge(event.target.value)} disabled={bulkPending}>
        <option value="founding-50">Founding 50</option><option value="beta-tester">Beta Tester</option><option value="contributor">Contributor</option>
      </select></label>
      <label>Reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder="Recorded in the audit log" disabled={bulkPending} /></label>
      <label>MFA code<input value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" disabled={bulkPending} /></label>
      <div className="form-actions">
        <button className="epic-button" disabled={bulkPending || reason.trim().length < 3 || mfaCode.length !== 6} onClick={() => applyBulk(true)}>Assign to {selected.size}</button>
        <button className="epic-button secondary" disabled={bulkPending || reason.trim().length < 3 || mfaCode.length !== 6} onClick={() => applyBulk(false)}>Remove from {selected.size}</button>
      </div>
      <small>One MFA approval covers exactly these {selected.size} accounts. Each award is audited individually, and the batch is applied all-or-nothing.</small>
      {bulkMessage && <p className="notice" role="status">{bulkMessage}</p>}
    </section>}
    <section className="epic-panel"><div className="section-heading"><h2>{total} accounts</h2><Link href="/admin">Overview</Link></div>
      <div className="table-wrap"><table className="sortable-table">
        <thead><tr>
          <th className="select-column"><input type="checkbox" aria-label="Select all eligible accounts on this page"
            checked={selectable.length > 0 && selectable.every(user => selected.has(user.id))}
            onChange={event => setSelected(event.target.checked ? new Set(selectable.map(user => user.id)) : new Set())} /></th>
          {COLUMNS.map(column => <th key={column.key} aria-sort={sort === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" onClick={() => sortBy(column.key)}>
              {column.label}<span aria-hidden="true">{sort === column.key ? (direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            </button>
          </th>)}
          <th>Updates</th><th></th>
        </tr></thead>
        <tbody aria-busy={loading}>{loading
          ? Array.from({ length: 8 }, (_, index) => <tr key={index} className="row-skeleton"><td colSpan={9}><span /></td></tr>)
          : users.map(user => <tr key={user.id} className={selected.has(user.id) ? 'selected-row' : undefined}>
            <td className="select-column"><input type="checkbox" checked={selected.has(user.id)}
              disabled={user.account_role === 'admin' || user.account_status !== 'active'}
              aria-label={`Select ${user.username}`} onChange={() => toggle(user.id)} /></td>
            <td><strong>{user.username}</strong><small>{user.email}</small></td>
            <td>{user.account_status}</td><td>{user.account_role}</td><td>{user.badge_count}</td>
            <td>{new Date(user.created_at).toLocaleDateString()}</td>
            <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '—'}</td>
            <td>{user.community_email_opt_in?'Opted in':'Off'}</td>
            <td><Link href={`/admin/users/${user.id}`}>Details →</Link></td>
          </tr>)}</tbody>
      </table></div>
      {!loading && !users.length && !message && <p>No matching accounts.</p>}
      <nav className="market-pagination" aria-label="User pages"><button disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>Previous</button><span>{page + 1}</span><button disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </section>
  </main></div>;
}
