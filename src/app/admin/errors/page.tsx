/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminNav from '@/components/AdminNav';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';

type AppError = { id:number; path:string; message:string; created_at:string };

export default function AdminErrorsPage() {
  const [entries, setEntries] = useState<AppError[]>([]);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page:String(page) });
    if (query) params.set('q', query);
    const response = await adminFetch(`/api/admin/errors?${params}`);
    if (!response?.ok) { setMessage('Errors unavailable'); return; }
    const result = await response.json() as { entries:AppError[]; total:number };
    setEntries(result.entries); setTotal(result.total); setMessage('');
  }, [page, query]);
  useEffect(() => { load(); }, [load]);
  const submit = (event:FormEvent) => { event.preventDefault(); setPage(0); setQuery(draft); };

  return <div className="app-shell"><Header /><AdminNav /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>Client errors</h1><p>Paths and messages are redacted the same way as the audit log. Stack traces stay server-side.</p></div>
    {message && <p className="notice error" role="alert">{message}</p>}
    <form className="epic-panel admin-user-filters" onSubmit={submit}>
      <label>Search<input value={draft} onChange={event => setDraft(event.target.value)} maxLength={200} placeholder="path or message" /></label>
      <button className="epic-button">Apply filter</button><Link href="/admin">Overview</Link>
    </form>
    <section className="epic-panel">
      <h2>{total} errors</h2>
      <div className="error-log">{entries.map(entry => <article key={entry.id}>
        <span>{new Date(entry.created_at).toLocaleString()}</span>
        <div><strong>{entry.path}</strong><br /><small>{entry.message}</small></div>
      </article>)}</div>
      {!entries.length && !message && <p>No client errors recorded.</p>}
      <nav className="market-pagination" aria-label="Error pages"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>{page + 1}</span><button disabled={(page + 1) * 50 >= total} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </section>
  </main></div>;
}
