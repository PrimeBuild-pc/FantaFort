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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page:String(page), size:'25' });
    if (search.trim()) query.set('search', search.trim());
    if (status) query.set('status', status);
    if (role) query.set('role', role);
    const response = await adminFetch(`/api/admin/users?${query}`);
    if (!response?.ok) { setMessage('Admin users unavailable'); return; }
    const result = await response.json() as { users:UserRow[]; total:number };
    setUsers(result.users); setTotal(result.total); setMessage('');
  }, [page, role, search, status]);

  useEffect(() => { load(); }, [load]);
  const submit = (event:FormEvent) => { event.preventDefault(); setPage(0); load(); };

  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>Users</h1><p>Server-side account search and impact review.</p></div>
    {message && <p className="notice error" role="alert">{message}</p>}
    <form className="epic-panel admin-user-filters" onSubmit={submit}>
      <label>Search<input value={search} onChange={event => setSearch(event.target.value)} maxLength={254} placeholder="Email, username or UUID" /></label>
      <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="anonymized">Anonymized</option></select></label>
      <label>Role<select value={role} onChange={event => { setRole(event.target.value); setPage(0); }}><option value="">All</option><option value="user">User</option><option value="admin">Admin</option></select></label>
      <button className="epic-button">Search</button>
    </form>
    <section className="epic-panel"><div className="section-heading"><h2>{total} accounts</h2><Link href="/admin">Overview</Link></div>
      <div className="table-wrap"><table><thead><tr><th>Account</th><th>Status</th><th>Role</th><th>Updates</th><th>Badges</th><th>Registered</th><th>Last access</th><th></th></tr></thead><tbody>{users.map(user => <tr key={user.id}>
        <td><strong>{user.username}</strong><small>{user.email}</small></td><td>{user.account_status}</td><td>{user.account_role}</td><td>{user.community_email_opt_in?'Opted in':'Off'}</td><td>{user.badge_count}</td>
        <td>{new Date(user.created_at).toLocaleDateString()}</td><td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '—'}</td>
        <td><Link href={`/admin/users/${user.id}`}>Details →</Link></td>
      </tr>)}</tbody></table></div>
      {!users.length && !message && <p>No matching accounts.</p>}
      <nav className="market-pagination" aria-label="User pages"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>{page + 1}</span><button disabled={(page + 1) * 25 >= total} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </section>
  </main></div>;
}
