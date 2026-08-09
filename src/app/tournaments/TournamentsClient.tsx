/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { useLocale } from '@/context/LocaleContext';

type Tier = { keyValue: number; pointsEarned: number; multiplicative: boolean };
export type Tournament = {
  eventId: string; windowId: string; name: string; subtitle: string; description: string; imageUrl: string;
  region: string; startsAt: string; endsAt: string; round: number; matchCap: number | null;
  format: string; eliminationPoints: number | null; placementTiers: Tier[]; status: 'upcoming'|'live'|'completed';
};
type Session = { id: string; number: number; endedAt: string; placement: number | null; eliminations: number; victory: boolean; timeAlive: number | null };
type Entry = {
  teamId: string; rank: number; percentile: number | null; points: number; projectedPoints: number;
  players: { accountId: string; username: string | null; flagToken?: string | null }[];
  matches: number; wins: number; eliminations: number; sessions: Session[];
};
const regions = ['EU','NAC','BR','ASIA','OCE','ME'];

export default function TournamentsPage({initialTournaments}:{initialTournaments:Tournament[]}) {
  const { locale, t } = useLocale();
  const initialSelected=initialTournaments.find(item=>item.status==='live')||initialTournaments.find(item=>item.status==='completed')||initialTournaments[0];
  const [region,setRegion]=useState('EU'); const [tournaments,setTournaments]=useState<Tournament[]>(initialTournaments); const [selected,setSelected]=useState<Tournament|undefined>(initialSelected);
  const [entries,setEntries]=useState<Entry[]>([]); const [entryPage,setEntryPage]=useState(0); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  useEffect(()=>{let active=true;setLoading(true);setError('');fetch(`/api/fortnite/tournaments?region=${region}`).then(r=>r.ok?r.json():Promise.reject(Error('API unavailable'))).then(data=>{if(!active)return;setTournaments(data.tournaments);setSelected(data.tournaments.find((item:Tournament)=>item.status==='live')||data.tournaments.find((item:Tournament)=>item.status==='completed')||data.tournaments[0]);}).catch(reason=>active&&setError(reason.message)).finally(()=>active&&setLoading(false));return()=>{active=false};},[region]);
  useEffect(()=>{setEntryPage(0);if(!selected||selected.status==='upcoming'){setEntries([]);return}let active=true;setLoading(true);setError('');const q=new URLSearchParams({eventId:selected.eventId,windowId:selected.windowId,matchCap:String(selected.matchCap||0)});fetch(`/api/fortnite/leaderboard?${q}`).then(r=>r.ok?r.json():Promise.reject(Error('Leaderboard unavailable'))).then(data=>active&&setEntries(data.entries)).catch(reason=>active&&setError(reason.message)).finally(()=>active&&setLoading(false));return()=>{active=false};},[selected]);
  const duration = (seconds: number | null) => seconds == null ? '—' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;
  const pageSize=25, totalEntryPages=Math.ceil(entries.length/pageSize), visibleEntries=entries.slice(entryPage*pageSize,(entryPage+1)*pageSize);

  return <div className="app-shell"><Header/><main className="container page-content"><div className="page-title"><div className="eyebrow">COMPETITIVE CENTER</div><h1>{t('fortniteEvents')}</h1><p>{t('realData')}</p></div>
    <div className="filters"><label>{t('region')}<select value={region} onChange={event=>setRegion(event.target.value)}>{regions.map(item=><option key={item}>{item}</option>)}</select></label><label>{t('event')}<select value={selected?.windowId||''} onChange={event=>setSelected(tournaments.find(item=>item.windowId===event.target.value))}>{tournaments.map(item=><option key={`${item.eventId}:${item.windowId}`} value={item.windowId}>{item.name} · {new Date(item.startsAt).toLocaleDateString(locale)} · {item.status}</option>)}</select></label></div>
    {selected && <section className="event-hero">{selected.imageUrl && <Image src={selected.imageUrl} alt={selected.name} width={800} height={450} sizes="(max-width:850px) calc(100vw - 3.8rem), 35vw" priority fetchPriority="high"/>}<div><span className={`status ${selected.status}`}>{t(selected.status)}</span><h2>{selected.name}</h2><h3>{selected.subtitle}</h3><p>{selected.description}</p><div className="event-facts"><span><small>{t('format')}</small><b>{selected.format}</b></span><span><small>{t('round')}</small><b>{selected.round + 1}</b></span><span><small>{t('matchCap')}</small><b>{selected.matchCap || '—'}</b></span><span><small>{t('eliminationScore')}</small><b>{selected.eliminationPoints ?? '—'}</b></span></div></div></section>}
    {selected?.placementTiers.length ? <details className="scoring-rules"><summary>{t('officialScoring')}</summary><div>{selected.placementTiers.map(tier=><span key={`${tier.keyValue}:${tier.pointsEarned}`}>#{tier.keyValue} → +{tier.pointsEarned}</span>)}</div></details> : null}
    {error&&<p className="notice error">{error}</p>}{loading&&<p className="notice">{t('loading')}</p>}{!loading&&selected?.status==='upcoming'&&<p className="notice">{t('upcoming')}</p>}
    {!loading&&entries.length>0&&<><div className="table-wrap"><table><thead><tr><th>#</th><th>{t('squad')}</th><th>{t('points')}</th><th>{t('projection')}</th><th>{t('games')}</th><th>{t('wins')}</th><th>{t('teamElims')}</th><th>{t('gameLog')}</th></tr></thead><tbody>{visibleEntries.map(entry=><tr key={`${entry.rank}:${entry.teamId}`}><td>{entry.rank}</td><td><strong>{entry.players.map(p=>p.username||'Anonymous').join(' + ')}</strong><small className="team-size">{entry.players.length === 1 ? 'SOLO' : `${entry.players.length}-STACK`}</small></td><td><strong>{entry.points}</strong></td><td>{entry.projectedPoints}</td><td>{entry.matches}</td><td>{entry.wins}</td><td>{entry.eliminations}</td><td>{entry.sessions.length ? <details className="session-log"><summary>{entry.sessions.length} {t('games')}</summary><div>{entry.sessions.map(session=><span key={session.id} className={session.victory?'victory-session':''}><b>#{session.number}</b> {session.victory?'👑 ':''}#{session.placement||'—'} · {session.eliminations} ELIM · {duration(session.timeAlive)}</span>)}</div></details>:'—'}</td></tr>)}</tbody></table></div>{totalEntryPages>1&&<nav className="market-pagination" aria-label={t('marketPages')}><button disabled={entryPage===0} onClick={()=>setEntryPage(page=>page-1)}>‹ <span>{t('previousPage')}</span></button><span>{entryPage+1} / {totalEntryPages}</span><button disabled={entryPage===totalEntryPages-1} onClick={()=>setEntryPage(page=>page+1)}><span>{t('nextPage')}</span> ›</button></nav>}</>}
  </main></div>;
}
