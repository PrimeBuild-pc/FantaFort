"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';
import { focusWindow, formatRemaining, windowPhase, type WindowClock } from '@/lib/weekend';

type WindowRow = WindowClock & { windowId: string; name: string; region: string; syncedAt: string | null };

const REGIONS = ['EU', 'NAC', 'NAW'];

export default function HomePage() {
  const { team, coins, leagues, activeLeagueId, selectLeague, loading } = useGame();
  const { locale, t } = useLocale();
  const [rows, setRows] = useState<WindowRow[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const league = leagues.find(item => item.id === activeLeagueId);
  const slots = league?.rosterSize || 3;
  const scoped = rows.filter(row => {
    const start = Date.parse(row.startsAt);
    if (league?.startsAt && start < Date.parse(league.startsAt)) return false;
    if (league?.endsAt && start > Date.parse(league.endsAt)) return false;
    return true;
  });
  const focus = focusWindow(scoped, now);
  const phase = focus ? windowPhase(focus, now) : null;
  const marketCloses = league?.status === 'active' && league.marketClosesAt && Date.parse(league.marketClosesAt) > now
    ? `${t('closesIn')} ${formatRemaining(league.marketClosesAt, now)}`
    : league ? t(league.status === 'active' ? 'marketClosed' : league.status) : null;

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const load = () => supabase!.from('tournaments')
      .select('window_id,name,region,starts_at,ends_at,synced_at')
      .in('region', REGIONS)
      .gte('ends_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('starts_at')
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setFailed(true); return; }
        setFailed(false);
        setRows((data || []).map(row => ({
          windowId: row.window_id, name: row.name, region: row.region,
          startsAt: row.starts_at, endsAt: row.ends_at, syncedAt: row.synced_at,
        })));
      });
    load();
    const refresh = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 300000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { cancelled = true; clearInterval(refresh); clearInterval(tick); };
  }, []);

  return <div className="app-shell">
    <Header />
    <main className="container page-content">
      <section className="market-hero">
        <div>
          <div className="eyebrow">{t('homeEyebrow')}</div>
          <h1>{t('homeTitle')}</h1>
          <p>{t('homeLead')}</p>
        </div>
        <div className="hero-status">
          {league
            ? <><small>{t('activeLeague')}</small><strong>{league.name}</strong><span className={`status ${league.status}`}>{t(league.status)}</span></>
            : <><small>{t('trainingMode')}</small><strong>{t('noLeagueSelected')}</strong><Link href="/leagues">{t('createLeague')} →</Link></>}
        </div>
      </section>

      {leagues.length > 0 && <label className="home-league">{t('activeLeague')}
        <select aria-label={t('activeLeague')} value={activeLeagueId || ''} onChange={event => selectLeague(event.target.value)}>
          {leagues.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}

      <div className="home-grid">
        <section className="epic-panel">
          <div className="eyebrow">{t('nextWindow')}</div>
          {failed ? <p className="notice error" role="alert">{t('noPlayers')}</p>
            : focus ? <>
              <h2>{focus.name}</h2>
              <p>{focus.region} · {phase === 'live' ? t('clashLive') : phase === 'upcoming' ? t('upcoming') : t('clashRecap')}{phase === 'upcoming' ? ` · ${formatRemaining(focus.startsAt, now)}` : phase === 'live' ? ` · ${formatRemaining(focus.endsAt, now)}` : ''}</p>
              <p>{t('dataAsOf').replace('{time}', focus.syncedAt ? new Date(focus.syncedAt).toLocaleString(locale) : '—')}</p>
            </> : <p className="notice">{t('noWindow')}</p>}
          <div className="home-actions">
            <Link className="epic-button" href="/market">{t('recruitLeague')}</Link>
            <Link className="epic-button secondary" href="/trading">{t('accountPortfolio')}</Link>
            {league && <Link className="epic-button secondary" href={`/leagues/${league.id}`}>{t('goToTable')}</Link>}
          </div>
        </section>
        <section className="epic-panel">
          <div className="window-facts">
            <div><small>{t('roster')}</small><b>{loading ? '—' : t('slots').replace('{filled}', String(team.length)).replace('{total}', String(slots))}</b></div>
            <div><small>{t('leagueCoins')}</small><b>{league ? `${new Intl.NumberFormat(locale).format(coins)} C` : '—'}</b></div>
            <div><small>{t('marketStatus')}</small><b>{marketCloses || '—'}</b></div>
          </div>
          <ul className="slot-list">
            {team.map(player => <li key={player.id}><strong>{player.handle}</strong><span>{new Intl.NumberFormat(locale).format(player.price)} C</span></li>)}
            {Array.from({ length: Math.max(0, slots - team.length) }, (_, index) => <li className="open" key={`open-${index}`}><span>{t('openSlot')}</span></li>)}
          </ul>
          {!league && <p className="notice">{t('needsLeague')}</p>}
        </section>
      </div>
    </main>
  </div>;
}
