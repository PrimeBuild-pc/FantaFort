"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';
import { focusWindow, formatRemaining, windowPhase, type WindowClock } from '@/lib/weekend';

type WindowRow = WindowClock & { windowId: string; name: string; region: string; syncedAt: string | null };
type NextStep = 'create' | 'fill' | 'invite' | 'clash' | 'recap' | 'wait';

const REGIONS = ['EU', 'NAC', 'NAW'];

export default function HomePage() {
  const { team, coins, leagues, activeLeagueId, selectLeague, loading, previewing } = useGame();
  const { locale, t } = useLocale();
  const [rows, setRows] = useState<WindowRow[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const league = leagues.find(item => item.id === activeLeagueId);
  const slots = league?.rosterSize || 3;
  const openSlots = Math.max(0, slots - team.length);
  const scoped = rows.filter(row => {
    const start = Date.parse(row.startsAt);
    if (league?.startsAt && start < Date.parse(league.startsAt)) return false;
    if (league?.endsAt && start > Date.parse(league.endsAt)) return false;
    return true;
  });
  const focus = focusWindow(scoped, now);
  const phase = focus ? windowPhase(focus, now) : null;
  const marketOpen = Boolean(league?.status === 'active' && league.marketClosesAt && Date.parse(league.marketClosesAt) > now);
  const marketCloses = marketOpen && league?.marketClosesAt
    ? `${t('closesIn')} ${formatRemaining(league.marketClosesAt, now)}`
    : league ? t(league.status === 'active' ? 'marketClosed' : league.status) : null;
  const next: NextStep = !league ? 'create'
    : phase === 'live' ? 'clash'
    : phase === 'completed' ? 'recap'
    : loading ? 'wait'
    : league.status === 'lobby' || league.members < 2 ? 'invite'
    : team.length < slots && marketOpen ? 'fill'
    : marketOpen ? 'invite'
    : 'wait';
  const nowCopy = t(next === 'create' ? 'homeNowCreate' : next === 'fill' ? 'homeNowFill' : next === 'invite' ? 'homeNowInvite' : next === 'clash' ? 'homeNowClash' : next === 'recap' ? 'homeNowRecap' : 'homeNowWait')
    .replace('{open}', String(openSlots));

  const shareInvite = async () => {
    if (!league) return;
    const link = `${window.location.origin}/leagues?join=${league.inviteCode}`;
    if (navigator.share) {
      try { await navigator.share({ title: league.name, url: link }); return; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
  };

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
      {previewing && <p className="notice" role="status">{t('devPreviewNote')}</p>}
      <section className="market-hero">
        <div>
          <div className="eyebrow">{t('homeEyebrow')}</div>
          <h1>{t('homeTitle')}</h1>
          <p>{t('homeLead')}</p>
        </div>
        <div className="hero-status home-next">
          <small>{league ? league.name : t('weekendLeague')}</small>
          <strong>{nowCopy}</strong>
          <div className="home-actions">
            {next === 'create' && <>
              <Link className="epic-button" href="/leagues?preset=weekend">{t('homeCreate')}</Link>
              <Link className="epic-button secondary" href="/leagues">{t('homeHaveInvite')}</Link>
            </>}
            {next === 'fill' && <Link className="epic-button" href="/market">{t('homeFill')}</Link>}
            {next === 'invite' && <button className="epic-button" type="button" onClick={shareInvite}>{copied ? t('inviteLinkCopied') : t('homeInviteFriend')}</button>}
            {next === 'clash' && league && <Link className="epic-button" href={`/leagues/${league.id}`}>{t('homeWatchClash')}</Link>}
            {next === 'recap' && league && <Link className="epic-button" href={`/leagues/${league.id}`}>{t('homeReadRecap')}</Link>}
            {next === 'wait' && league && <Link className="epic-button" href={`/leagues/${league.id}`}>{t('goToTable')}</Link>}
            {next !== 'create' && next !== 'invite' && league && <button className="epic-button secondary" type="button" onClick={shareInvite}>{copied ? t('inviteLinkCopied') : t('homeInviteFriend')}</button>}
          </div>
        </div>
      </section>

      <ol className="home-steps">
        <li><b>1</b><span>{t('homeStepPick')}</span></li>
        <li><b>2</b><span>{t('homeStepWindow')}</span></li>
        <li><b>3</b><span>{t('homeStepInvite')}</span></li>
      </ol>

      {league && <div className="home-invite">
        {next !== 'invite' && <p>{t('homeNowInvite')}</p>}
        <div>
          <code>{league.inviteCode}</code>
          <button type="button" className="epic-button secondary" onClick={shareInvite}>{copied ? t('inviteLinkCopied') : t('copyInviteLink')}</button>
        </div>
      </div>}

      {leagues.length > 1 && <label className="home-league">{t('activeLeague')}
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
            <Link href="/trading">{t('accountPortfolio')}</Link>
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
            {Array.from({ length: Math.max(0, slots - team.length) }, (_, index) => <li className="open" key={`open-${index}`}>{league ? <Link href="/market">{t('openSlot')}</Link> : <span>{t('openSlot')}</span>}</li>)}
          </ul>
          {!league && <p className="notice">{t('needsLeague')}</p>}
        </section>
      </div>
    </main>
  </div>;
}
