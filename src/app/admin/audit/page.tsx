/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';

type AuditEntry = {
  id:number; actor_ref:string; actor_username:string; action:string; target_type:string; target_ref:string;
  reason:string|null; before_state:Record<string,unknown>; after_state:Record<string,unknown>;
  request_ref:string; outcome:string; error_code:string|null; created_at:string;
};
type Filters = { q:string; action:string; outcome:string; targetType:string; target:string; admin:string; from:string; to:string };
const emptyFilters:Filters = { q:'', action:'', outcome:'', targetType:'', target:'', admin:'', from:'', to:'' };

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page:String(page), size:'50' });
    for (const [key,value] of Object.entries(filters)) if (value) query.set(key, value);
    const response = await adminFetch(`/api/admin/audit?${query}`);
    if (!response?.ok) { setMessage('Audit unavailable'); return; }
    const result = await response.json() as { entries:AuditEntry[]; total:number };
    setEntries(result.entries); setTotal(result.total); setMessage('');
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);
  const submit = (event:FormEvent) => { event.preventDefault(); setPage(0); setFilters(draft); };
  const field = (key:keyof Filters) => ({ value:draft[key], onChange:(event:ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setDraft(value => ({ ...value, [key]:event.target.value })) });

  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>Audit</h1><p>Append-only administrative activity. Identifiers and sensitive values are pseudonymized or redacted.</p></div>
    {message && <p className="notice error" role="alert">{message}</p>}
    <form className="epic-panel admin-user-filters" onSubmit={submit}>
      <label>Search<input {...field('q')} maxLength={100} placeholder="action, admin, target ref" /></label>
      <label>Action<input {...field('action')} maxLength={80} placeholder="economy.adjust_wallet" /></label>
      <label>Outcome<select {...field('outcome')}><option value="">All</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option><option value="denied">Denied</option></select></label>
      <label>Target type<input {...field('targetType')} maxLength={40} placeholder="user" /></label>
      <label>Target ref<input {...field('target')} maxLength={19} placeholder="target_…" /></label>
      <label>Admin username<input {...field('admin')} maxLength={30} /></label>
      <label>From<input {...field('from')} type="datetime-local" /></label>
      <label>To<input {...field('to')} type="datetime-local" /></label>
      <button className="epic-button">Apply filters</button><Link href="/admin">Overview</Link>
    </form>
    <section className="epic-panel"><h2>{total} records</h2><div className="audit-list">{entries.map(entry => <article key={entry.id}>
      <header><strong>{entry.action}</strong><span>{entry.outcome}</span><time>{new Date(entry.created_at).toLocaleString()}</time></header>
      <p><b>{entry.actor_username}</b> <code>{entry.actor_ref}</code> → {entry.target_type} <code>{entry.target_ref}</code></p>
      {entry.reason && <p>{entry.reason}</p>}
      <details><summary>Before / after</summary><pre>{JSON.stringify({ before:entry.before_state, after:entry.after_state }, null, 2)}</pre></details>
      <small>Request <code>{entry.request_ref}</code>{entry.error_code ? ` · ${entry.error_code}` : ''}</small>
    </article>)}</div>{!entries.length && !message && <p>No audit records.</p>}
      <nav className="market-pagination" aria-label="Audit pages"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>{page + 1}</span><button disabled={(page + 1) * 50 >= total} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </section>
  </main></div>;
}
