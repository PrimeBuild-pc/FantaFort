/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';

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
    <section className="epic-panel"><div className="section-heading"><h2>{total} accounts</h2><Link href="/admin">Overview</Link></div>
      <div className="table-wrap"><table className="sortable-table">
        <thead><tr>
          {COLUMNS.map(column => <th key={column.key} aria-sort={sort === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" onClick={() => sortBy(column.key)}>
              {column.label}<span aria-hidden="true">{sort === column.key ? (direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            </button>
          </th>)}
          <th>Updates</th><th></th>
        </tr></thead>
        <tbody aria-busy={loading}>{loading
          ? Array.from({ length: 8 }, (_, index) => <tr key={index} className="row-skeleton"><td colSpan={8}><span /></td></tr>)
          : users.map(user => <tr key={user.id}>
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
