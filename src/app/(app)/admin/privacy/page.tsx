/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';

type PrivacyRequest = { id:string; username:string; request_type:string; status:string; requested_at:string; resolved_at:string|null };
const STATUSES = ['pending', 'completed', 'cancelled', 'all'] as const;

export default function AdminPrivacyPage() {
  const [status, setStatus] = useState<typeof STATUSES[number]>('pending');
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const response = await adminFetch(`/api/admin/privacy?status=${status}&page=${page}`);
    if (!response?.ok) { setMessage('Privacy requests unavailable'); setLoading(false); return; }
    const result = await response.json() as { requests:PrivacyRequest[]; total:number };
    setRequests(result.requests); setTotal(result.total); setMessage(''); setLoading(false);
  }, [status, page]);
  useEffect(() => { load(); }, [load]);

  return <div className="app-shell"><Header /><AdminNav /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>Privacy requests</h1><p>Account deletion requests raised from the account settings page. Resolution happens on the account detail page&rsquo;s anonymization action.</p></div>
    {message && <p className="notice error" role="alert">{message}</p>}
    <form className="epic-panel admin-user-filters" onSubmit={event => event.preventDefault()}>
      <label>Status<select value={status} onChange={event => { setPage(0); setStatus(event.target.value as typeof STATUSES[number]); }}>
        {STATUSES.map(value => <option key={value} value={value}>{value === 'all' ? 'All' : value}</option>)}
      </select></label>
    </form>
    <section className="epic-panel">
      <h2>{total} requests</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>User</th><th>Type</th><th>Status</th><th>Requested</th><th>Resolved</th></tr></thead>
        <tbody aria-busy={loading}>{loading
          ? Array.from({ length:4 }, (_, index) => <tr key={index} className="row-skeleton"><td colSpan={5}><span /></td></tr>)
          : requests.map(row => <tr key={row.id}>
            <td>{row.username}</td>
            <td>{row.request_type}</td>
            <td><span className={`status ${row.status === 'pending' ? 'upcoming' : row.status === 'completed' ? 'completed' : ''}`}>{row.status}</span></td>
            <td>{new Date(row.requested_at).toLocaleString()}</td>
            <td>{row.resolved_at ? new Date(row.resolved_at).toLocaleString() : '—'}</td>
          </tr>)}</tbody>
      </table></div>
      {!loading && !requests.length && <p>No privacy requests for this filter.</p>}
      <nav className="market-pagination" aria-label="Privacy request pages"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>{page + 1}</span><button disabled={(page + 1) * 50 >= total} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </section>
  </main></div>;
}
