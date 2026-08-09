"use client";

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { LeagueSettings } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type InvitePreview = { name:string; members:number; economy_mode:'demo'|'account_stake'; entry_stake:number; initial_budget:number; roster_size:number; draft_mode:'market'|'auction'; duration_days:number };
const defaults: LeagueSettings = { budget: 10000, rosterSize: 3, marketHours: 24, durationDays: 30, scoringMode: 'classic', economyMode: 'demo', entryStake: 0, draftMode: 'market' };

export default function LeaguesPage() {
  const { leagues, activeLeagueId, userId, createLeague, joinLeague, startLeague, leaveLeague, cancelLeague, selectLeague } = useGame();
  const { locale, t } = useLocale();
  const [leagueName, setLeagueName] = useState('');
  const [settings, setSettings] = useState(defaults);
  const [code, setCode] = useState('');
  const [invitePreview, setInvitePreview] = useState<InvitePreview>();
  const [message, setMessage] = useState('');

  const run = async (action: () => Promise<string | null>) => { setMessage(''); const error = await action(); setMessage(error || '✓'); };
  const previewInvite = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase) return;
    setMessage(''); const { data, error } = await supabase.rpc('preview_league_invite', { code });
    if (error || !data?.[0]) return setMessage('Invite unavailable');
    setInvitePreview(data[0] as InvitePreview);
  };
  const confirmJoin = async () => { await run(() => joinLeague(code)); setCode(''); setInvitePreview(undefined); };
  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">SOCIAL HUB</div><h1>{t('leagues')}</h1><p>{t('leagueIntro')}</p></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="hub-grid">
      <section className="epic-panel"><h2>{t('createLeague')}</h2><form onSubmit={event => { event.preventDefault(); run(() => createLeague(leagueName, settings)); setLeagueName(''); }}>
        <label>{t('leagueName')}<input value={leagueName} onChange={event => setLeagueName(event.target.value)} minLength={3} required /></label>
        <div className="settings-grid">
          <label>{t('initialBudget')}<input type="number" min="6000" max="30000" step="500" value={settings.budget} onChange={event => setSettings(value => ({ ...value, budget: Number(event.target.value) }))} /></label>
          <label>{t('rosterSlots')}<select value={settings.rosterSize} onChange={event => setSettings(value => ({ ...value, rosterSize: Number(event.target.value) }))}>{[2,3,4].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>{t('marketHours')}<input type="number" min="1" max="168" value={settings.marketHours} onChange={event => setSettings(value => ({ ...value, marketHours: Number(event.target.value) }))} /></label>
          <label>{t('leagueDays')}<input type="number" min="1" max="365" value={settings.durationDays} onChange={event => setSettings(value => ({ ...value, durationDays: Number(event.target.value) }))} /></label>
        </div>
        <label>{t('scoringMode')}<select value={settings.scoringMode} onChange={event => setSettings(value => ({ ...value, scoringMode: event.target.value as LeagueSettings['scoringMode'] }))}>
          <option value="classic">{t('classicMode')}</option><option value="balanced">{t('balancedMode')}</option><option value="formation">{t('formationMode')}</option>
        </select></label>
        <div className="settings-grid">
          <label>{t('economyMode')}<select value={settings.economyMode} onChange={event => setSettings(value => ({ ...value, economyMode: event.target.value as LeagueSettings['economyMode'], entryStake: event.target.value === 'demo' ? 0 : 500 }))}><option value="demo">{t('demoEconomy')}</option><option value="account_stake">{t('stakeEconomy')}</option></select></label>
          {settings.economyMode === 'account_stake' && <label>{t('entryStake')}<select value={settings.entryStake} onChange={event => setSettings(value => ({ ...value, entryStake: Number(event.target.value) as LeagueSettings['entryStake'] }))}>{[500,1000,2000].map(value => <option value={value} key={value}>{value.toLocaleString(locale)}</option>)}</select></label>}
          <label>{t('draftMode')}<select value={settings.draftMode} onChange={event => setSettings(value => ({ ...value, draftMode: event.target.value as LeagueSettings['draftMode'] }))}><option value="market">{t('fixedMarket')}</option><option value="auction">{t('auctionDraft')}</option></select></label>
        </div>
        <p className="form-hint">{t(`${settings.scoringMode}Help` as 'classicHelp')} {settings.economyMode === 'account_stake' ? t('stakeHelp') : t('demoHelp')}</p>
        <button className="epic-button">{t('create')}</button>
      </form></section>
      <section className="epic-panel"><h2>{t('joinLeague')}</h2><form onSubmit={previewInvite}><label>{t('inviteCode')}<input value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setInvitePreview(undefined); }} minLength={16} maxLength={16} pattern="[A-Fa-f0-9]{16}" autoComplete="off" spellCheck={false} required /></label><button className="epic-button secondary">{t('reviewLeague')}</button></form>
        {invitePreview ? <div className="join-preview"><h3>{invitePreview.name}</h3><p>{invitePreview.members} {t('members')} · {invitePreview.roster_size} {t('roster')} · {invitePreview.duration_days} {t('leagueDays')}</p><strong>{invitePreview.economy_mode === 'account_stake' ? `${t('entryStake')}: ${invitePreview.entry_stake.toLocaleString(locale)} C` : t('demoEconomy')}</strong><span>{invitePreview.draft_mode === 'auction' ? t('auctionDraft') : t('fixedMarket')} · {invitePreview.initial_budget.toLocaleString(locale)} C</span><button className="epic-button" onClick={confirmJoin}>{t('confirmJoin')}</button></div> : <div className="rules-card"><h3>{t('strategy')}</h3><p>{t('strategySummary')}</p></div>}
      </section>
    </div>

    <section className="section-block"><h2>{t('leagues')}</h2><div className="league-grid">{leagues.map(league => <article className={`league-card ${league.id === activeLeagueId ? 'selected' : ''}`} key={league.id} onClick={() => selectLeague(league.id)}>
      <div><span className={`status ${league.status}`}>{t(league.status)}</span><h3>{league.name}</h3><p>{league.members} {t('members')} · {league.rosterSize} {t('roster')} · {new Intl.NumberFormat(locale).format(league.budget)} C</p><small>{t(`${league.scoringMode}Mode` as 'classicMode')} · {league.draftMode === 'auction' ? t('auctionDraft') : t('fixedMarket')} · {league.economyMode === 'account_stake' ? `${league.entryStake} C ${t('entryStake')}` : t('demoEconomy')}</small></div>
      <div className="invite-code"><small>{t('inviteCode')}</small><b>{league.inviteCode}</b><button onClick={event => { event.stopPropagation(); navigator.clipboard.writeText(league.inviteCode); }}>{t('copyInvite')}</button></div>
      <div className="league-actions"><Link className="epic-button secondary" href={`/leagues/${league.id}`}>{t('liveDashboard')}</Link>{league.ownerId === userId && league.status === 'lobby' && <><button className="epic-button" onClick={event => { event.stopPropagation(); run(() => startLeague(league.id)); }}>{t('startLeague')}</button><button className="link-button danger" onClick={event => { event.stopPropagation(); run(() => cancelLeague(league.id)); }}>{t('cancelLeague')}</button></>}{league.ownerId !== userId && (league.status === 'lobby' || (league.status === 'active' && league.economyMode === 'demo')) && <button className="link-button danger" onClick={event => { event.stopPropagation(); if (league.status === 'lobby' || window.confirm(t('confirmLeaveActive'))) run(() => leaveLeague(league.id)); }}>{t('leaveLeague')}</button>}</div>
    </article>)}</div></section>

  </main></div>;
}
