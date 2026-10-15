"use client";

import { useEffect, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import Header from '@/components/Header';
import { adminFetch } from '@/lib/admin/client';

type Report = {
  generatedAt: string;
  users: Record<string, number>;
  signupsByWeek: { week: string; signups: number }[];
  byLanguage: Record<string, number>;
  engagement: Record<string, number>;
  leagues: Record<string, number | null>;
};

const LABELS: Record<string, string> = {
  total: 'Registered accounts', emailConfirmed: 'Email confirmed', active7d: 'Active in the last 7 days',
  active30d: 'Active in the last 30 days', returning7d: 'Older accounts back this week', olderThan7d: 'Accounts older than 7 days',
  communityEmailOptIn: 'Opted in to updates', publicLineups: 'Public lineups', usersInALeague: 'In at least one league',
  usersWhoTraded: 'Traded at least once', usersWithFriends: 'With at least one friend', lobby: 'In lobby', active: 'Running',
  completed: 'Completed', withTwoOrMoreMembers: 'With 2+ members', averageMembers: 'Average members',
};

// Flat metric,value rows: easy to paste into a deck or a spreadsheet for Epic Games.
function toCsv(report: Report) {
  const rows: [string, string | number | null][] = [['generatedAt', report.generatedAt]];
  for (const [group, values] of Object.entries({ users: report.users, engagement: report.engagement, leagues: report.leagues, language: report.byLanguage })) {
    for (const [key, value] of Object.entries(values)) rows.push([`${group}.${key}`, value]);
  }
  for (const { week, signups } of report.signupsByWeek) rows.push([`signups.${week}`, signups]);
  return ['metric,value', ...rows.map(([metric, value]) => `${metric},${value ?? ''}`)].join('\n');
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

function Metrics({ title, values }: { title: string; values: Record<string, number | null> }) {
  return <section className="epic-panel"><h2>{title}</h2><div className="admin-stats">
    {Object.entries(values).map(([key, value]) => <div key={key}><small>{LABELS[key] || key}</small><b>{value ?? '—'}</b></div>)}
  </div></section>;
}

export default function AdminInterestPage() {
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch('/api/admin/interest').then(async response => {
      if (!response?.ok) return setError('Report unavailable');
      setReport(await response.json() as Report);
    }).catch(() => setError('Report unavailable'));
  }, []);

  const stamp = report?.generatedAt.slice(0, 10) || 'report';
  const peak = Math.max(1, ...(report?.signupsByWeek.map(row => row.signups) || [1]));

  return <div className="app-shell"><Header /><AdminNav /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ADMIN CONTROL CENTER</div><h1>Interest report</h1>
      <p>Aggregated counts only. Administrators, suspended, banned, deleted and synthetic test accounts are excluded, so the figures can be shared as they are.</p></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!report && !error && <p className="notice" role="status">Loading…</p>}
    {report && <>
      <div className="league-actions">
        <button className="epic-button" onClick={() => download(`fantafort-interest-${stamp}.json`, JSON.stringify(report, null, 2), 'application/json')}>Download JSON</button>
        <button className="epic-button secondary" onClick={() => download(`fantafort-interest-${stamp}.csv`, toCsv(report), 'text/csv')}>Download CSV</button>
      </div>
      <Metrics title="Players" values={report.users} />
      <Metrics title="Engagement" values={report.engagement} />
      <Metrics title="Leagues" values={report.leagues} />
      <Metrics title="Language" values={report.byLanguage} />
      <section className="epic-panel"><h2>Sign-ups per week</h2>
        <table><thead><tr><th>Week of</th><th>Sign-ups</th><th aria-hidden="true" /></tr></thead><tbody>
          {report.signupsByWeek.map(row => <tr key={row.week}><td>{row.week}</td><td>{row.signups}</td>
            <td aria-hidden="true"><span className="interest-bar" style={{ width: `${row.signups / peak * 100}%` }} /></td></tr>)}
        </tbody></table>
      </section>
      <p className="notice">Generated {new Date(report.generatedAt).toLocaleString()}.</p>
    </>}
  </main></div>;
}
