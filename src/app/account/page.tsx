/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BadgeList from '@/components/BadgeList';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { communityCopy, DISCORD_URL } from '@/lib/community';
import { lineupCopy } from '@/lib/lineup';
import { Locale, locales } from '@/lib/i18n';
import { isStrongPassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getLevelProgress, type PublicBadge } from '@/lib/types';
import { PRIVACY_EMAIL } from '@/lib/legal';

const styles = [{ id:'storm', cost:100 }, { id:'victory', cost:250 }, { id:'legendary', cost:500 }];
type XpEvent = { id:number; type:'league_completed'|'league_won'; amount:number; created_at:string; leagues:{name:string}|null };
type Departure = { id:number; league_id:string|null; league_name:string; left_at:string };
type GlobalSummary = { rank:number; username:string; net_worth:number; badges:PublicBadge[] };
const exportCopy:Record<Locale,{title:string;help:string;action:string;working:string;done:string}>={
  en:{title:'Download your data',help:'A JSON copy of the personal data held about your account, in a portable format (GDPR arts. 15 and 20). Competitive player and tournament records are not included: they are not personal data about you.',action:'Download my data',working:'Preparing your export…',done:'Export downloaded.'},
  it:{title:'Scarica i tuoi dati',help:'Una copia JSON dei dati personali relativi al tuo account, in formato portabile (artt. 15 e 20 GDPR). I dati di giocatori e tornei non sono inclusi: non sono dati personali che ti riguardano.',action:'Scarica i miei dati',working:'Preparazione dell’export…',done:'Export scaricato.'},
  es:{title:'Descarga tus datos',help:'Una copia JSON de los datos personales de tu cuenta, en formato portátil (arts. 15 y 20 RGPD). No incluye datos de jugadores ni torneos.',action:'Descargar mis datos',working:'Preparando la exportación…',done:'Exportación descargada.'},
  de:{title:'Deine Daten herunterladen',help:'Eine JSON-Kopie der zu deinem Konto gespeicherten personenbezogenen Daten in einem übertragbaren Format (Art. 15 und 20 DSGVO). Spieler- und Turnierdaten sind nicht enthalten.',action:'Meine Daten herunterladen',working:'Export wird vorbereitet…',done:'Export heruntergeladen.'},
  fr:{title:'Télécharger vos données',help:'Une copie JSON des données personnelles liées à votre compte, dans un format portable (art. 15 et 20 RGPD). Les données de joueurs et de tournois ne sont pas incluses.',action:'Télécharger mes données',working:'Préparation de l’export…',done:'Export téléchargé.'},
};
const deletionCopy:Record<Locale,{title:string;help:string;action:string;confirm:string}>={
  en:{title:'Account deletion',help:'Leave or close open leagues first. The request immediately suspends access; after identity review we normally complete deletion or anonymization within 30 days.',action:'Request account deletion',confirm:'Suspend access and submit the account deletion request?'},
  it:{title:'Cancellazione account',help:'Prima lascia o chiudi le leghe aperte. La richiesta sospende subito l’accesso; dopo la verifica dell’identità completiamo normalmente cancellazione o anonimizzazione entro 30 giorni.',action:'Richiedi cancellazione account',confirm:'Sospendere l’accesso e inviare la richiesta di cancellazione?'},
  es:{title:'Eliminación de cuenta',help:'Primero sal o cierra las ligas. La solicitud suspende el acceso y normalmente se completa en 30 días tras verificar la identidad.',action:'Solicitar eliminación',confirm:'¿Suspender el acceso y solicitar la eliminación?'},
  de:{title:'Kontolöschung',help:'Verlasse oder schließe zuerst offene Ligen. Die Anfrage sperrt den Zugriff und wird nach Identitätsprüfung normalerweise innerhalb von 30 Tagen bearbeitet.',action:'Kontolöschung anfordern',confirm:'Zugriff sperren und Löschung anfordern?'},
  fr:{title:'Suppression du compte',help:'Quittez ou fermez d’abord les ligues. La demande suspend l’accès et est normalement traitée sous 30 jours après vérification.',action:'Demander la suppression',confirm:'Suspendre l’accès et demander la suppression ?'},
};

export default function AccountPage() {
  const router = useRouter();
  const { profile, userEmail, team, leagues, saveProfile, saveCommunicationPreference, savePublicLineupVisibility, mockTopUp, buyNameStyle, signOut } = useGame();
  const { locale, setLocale, t } = useLocale();
  const [username, setUsername] = useState(profile?.username || '');
  const [selectedLocale, setSelectedLocale] = useState<Locale>(profile?.locale || locale);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<{ label:string; points:number }[]>([]);
  const [xpHistory, setXpHistory] = useState<XpEvent[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [communityEmail, setCommunityEmail] = useState(false);
  const [publicLineup, setPublicLineup] = useState(false);
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary>();

  useEffect(() => { if (profile) { setUsername(profile.username); setSelectedLocale(profile.locale); setCommunityEmail(profile.communityEmailOptIn); setPublicLineup(profile.publicLineupEnabled); } }, [profile]);
  useEffect(() => {
    if (!supabase || !profile) return;
    supabase.rpc('get_global_leaderboard',{search_username:profile.username}).then(({data}) => {
      const match=(data as GlobalSummary[]|null)?.find(row=>row.username.toLowerCase()===profile.username.toLowerCase());
      if (match) setGlobalSummary({...match,rank:Number(match.rank),net_worth:Number(match.net_worth),badges:match.badges||[]});
    });
  }, [profile]);
  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from('profile_xp_events').select('id,type,amount,created_at,leagues(name)').order('created_at', { ascending:false }).limit(20),
      supabase.from('league_departures').select('id,league_id,league_name,left_at').order('left_at', { ascending:false }),
    ]).then(([xp, left]) => { setXpHistory((xp.data || []) as unknown as XpEvent[]); setDepartures((left.data || []) as Departure[]); });
  }, [profile?.experiencePoints]);
  useEffect(() => {
    if (!supabase || !team.length) return;
    supabase.from('player_results').select('points,tournaments(name,ends_at)').in('player_id', team.map(player => player.id)).then(({ data }) => {
      const totals = new Map<string,number>();
      data?.forEach(row => { const tournament = row.tournaments as unknown as { name:string }; totals.set(tournament?.name || 'Event', (totals.get(tournament?.name || 'Event') || 0) + row.points); });
      setHistory([...totals].slice(-8).map(([label, points]) => ({ label, points })));
    });
  }, [team]);

  const max = Math.max(1, ...history.map(item => item.points));
  const run = async (action:() => Promise<string|null>) => { const error = await action(); setMessage(error || '✓'); };
  const logout = async () => { await signOut(); router.replace('/auth'); router.refresh(); };
  const submit = async (event:FormEvent) => { event.preventDefault(); const error = await saveProfile(username, selectedLocale); setMessage(error || '✓'); if (!error) setLocale(selectedLocale); };
  const saveEmailPreference = async () => {
    const error = await saveCommunicationPreference(communityEmail);
    setMessage(error || (communityEmail ? communityCopy[locale].emailOn : communityCopy[locale].emailOff));
  };
  const saveLineupVisibility = async () => {
    const error = await savePublicLineupVisibility(publicLineup);
    setMessage(error || (publicLineup ? lineupCopy[locale].settingOn : lineupCopy[locale].settingOff));
  };
  const changePassword = async (event:FormEvent) => {
    event.preventDefault(); if (!supabase || !userEmail) return;
    if (!isStrongPassword(newPassword)) return setMessage(t('invalidPassword'));
    const verified = await supabase.auth.signInWithPassword({ email:userEmail, password:currentPassword });
    if (verified.error) return setMessage(t('invalidCredentials'));
    const { error } = await supabase.auth.updateUser({ password:newPassword });
    setMessage(error?.message || t('passwordUpdated'));
    if (!error) { setCurrentPassword(''); setNewPassword(''); }
  };
  const downloadData = async () => {
    if (!supabase) return;
    setExporting(true); setMessage(exportCopy[locale].working);
    const { data, error } = await supabase.rpc('export_account_data');
    setExporting(false);
    if (error) return setMessage(error.message);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `fantafort-account-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); URL.revokeObjectURL(url);
    setMessage(exportCopy[locale].done);
  };
  const requestDeletion = async () => {
    if (!supabase || !profile || !window.confirm(deletionCopy[locale].confirm)) return;
    const { error } = await supabase.rpc('request_account_deletion', { confirm_username:profile.username });
    if (error) return setMessage(error.message);
    await logout();
  };
  const formattedBalance = useMemo(() => ((profile?.walletCents || 0) / 100).toLocaleString(locale, { style:'currency', currency:'EUR' }), [locale, profile?.walletCents]);
  const level = getLevelProgress(profile?.experiencePoints || 0);
  const closedLeagues = leagues.filter(league => league.status === 'completed' || league.status === 'cancelled');

  return <div className="app-shell"><Header /><main className="container page-content account-settings-page">
    <div className="page-title"><div className="eyebrow">PLAYER PROFILE</div><h1>{t('settings')}</h1></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="account-grid">
      <section className="epic-panel profile-panel"><div className="profile-panel-heading"><div className="eyebrow">PROFILE</div><h2>{t('account')}</h2></div><div className="profile-identity"><div className={`profile-emblem name-${profile?.nameStyle || 'default'}`}>{(profile?.username || 'P').slice(0,2).toUpperCase()}</div><div className="level-summary"><b>{t('level')} {level.level}</b><strong>{t(`badge_${level.badge}` as Parameters<typeof t>[0])}</strong><span>{level.current} / {level.required} XP</span><i role="progressbar" aria-label={`${t('level')} ${level.level}`} aria-valuemin={0} aria-valuemax={level.required} aria-valuenow={level.current}><em style={{ width:`${level.current / level.required * 100}%` }} /></i></div>{globalSummary&&<div className="profile-global-summary"><span>{t('position')} <b>#{globalSummary.rank}</b></span><span>{t('totalEquity')} <b>{new Intl.NumberFormat(locale).format(globalSummary.net_worth)} C</b></span><BadgeList badges={globalSummary.badges}/></div>}</div><form onSubmit={submit}>
        <label>{t('username')}<input value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={30} /></label>
        <label>{t('email')}<input value={userEmail || ''} disabled /></label>
        <label>{t('language')}<select value={selectedLocale} onChange={event => setSelectedLocale(event.target.value as Locale)}>{locales.map(item => <option value={item} key={item}>{item.toUpperCase()}</option>)}</select></label>
        <div className="form-actions"><button className="epic-button">{t('save')}</button><button className="epic-button secondary" type="button" onClick={logout}>{t('logout')}</button></div>
      </form></section>

      <section className="epic-panel wallet-panel"><div className="eyebrow">{t('balance')}</div><h2>{formattedBalance}</h2><p className="sandbox-label">SANDBOX</p><div className="wallet-packages">{[499,999,1999].map(amount => <button key={amount} onClick={() => run(() => mockTopUp(amount))}>+ €{(amount / 100).toFixed(2)}</button>)}</div><p>{t('sandboxNotice')}</p></section>
      <section className="epic-panel rewards-panel"><div className="eyebrow">{t('rewards')}</div><h2>{profile?.rewardPoints || 0} FP</h2><p>{t('cosmeticHelp')}</p><div className="cosmetic-list">{styles.map(style => <button className={`name-${style.id}`} key={style.id} onClick={() => run(() => buyNameStyle(style.id))}>{style.id.toUpperCase()} · {style.cost} FP</button>)}</div></section>
    </div>

    <div className="account-detail-grid">
      <section className="epic-panel security-panel"><div className="eyebrow">SECURITY</div><h2>{t('security')}</h2><form onSubmit={changePassword}><label>{t('currentPassword')}<input type="password" minLength={8} maxLength={128} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label><label>{t('newPassword')}<input type="password" minLength={10} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" required /><small>{t('passwordRules')}</small></label><button className="epic-button secondary">{t('changePassword')}</button></form><div className="privacy-export"><h3>{exportCopy[locale].title}</h3><p>{exportCopy[locale].help}</p><button className="epic-button secondary" type="button" onClick={downloadData} disabled={exporting}>{exporting ? exportCopy[locale].working : exportCopy[locale].action}</button></div><div className="danger-zone"><h3>{deletionCopy[locale].title}</h3><p>{deletionCopy[locale].help}</p><button className="danger-button" type="button" onClick={requestDeletion}>{deletionCopy[locale].action}</button><small><Link href="/privacy">Privacy</Link> · <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a></small></div></section>
      <section className="epic-panel progression-panel"><div className="eyebrow">XP</div><h2>{t('progression')}</h2><p>{t('xpRules')}</p><div className="activity-list">{xpHistory.length ? xpHistory.map(event => <article key={event.id}><span><strong>{event.type === 'league_won' ? t('leagueWon') : t('leagueCompleted')}</strong><small>{event.leagues?.name || t('league')}</small></span><b>+{event.amount} XP</b></article>) : <p>{t('noXpHistory')}</p>}</div></section>
    </div>

    <section className="epic-panel communication-panel" id="communication"><div><h2>{communityCopy[locale].title}</h2><p>{communityCopy[locale].body}</p><a className="epic-button secondary" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">{communityCopy[locale].discord}</a></div><div><h2>{communityCopy[locale].emailTitle}</h2><label className="checkbox-label"><input type="checkbox" checked={communityEmail} onChange={event => setCommunityEmail(event.target.checked)} /> <span>{communityCopy[locale].emailBody}</span></label><button type="button" className="epic-button" onClick={saveEmailPreference} disabled={communityEmail === profile?.communityEmailOptIn}>{communityCopy[locale].emailSave}</button>{profile?.communityEmailOptedInAt && <small>{new Date(profile.communityEmailOptedInAt).toLocaleString(locale)}</small>}</div></section>

    <section className="epic-panel lineup-privacy-panel" id="lineup-visibility"><div><h2>{lineupCopy[locale].settingTitle}</h2><p>{lineupCopy[locale].settingBody}</p></div><div><label className="checkbox-label"><input type="checkbox" checked={publicLineup} onChange={event => setPublicLineup(event.target.checked)} /> <span>{lineupCopy[locale].settingLabel}</span></label><button type="button" className="epic-button" onClick={saveLineupVisibility} disabled={publicLineup === profile?.publicLineupEnabled}>{lineupCopy[locale].settingSave}</button></div></section>

    {(closedLeagues.length > 0 || departures.length > 0) && <section className="epic-panel league-history-panel"><div className="eyebrow">ARCHIVE</div><h2>{t('leagueHistory')}</h2><div className="activity-list">{closedLeagues.map(league => <Link href={`/leagues/${league.id}`} key={league.id}><span><strong>{league.name}</strong><small>{t(league.status)}</small></span><b>→</b></Link>)}{departures.map(item => <article key={`left-${item.id}`}><span><strong>{item.league_name}</strong><small>{t('leftLeague')} · {new Date(item.left_at).toLocaleDateString(locale)}</small></span></article>)}</div></section>}

    <section className="epic-panel performance-panel"><div className="section-heading"><div><div className="eyebrow">ACCOUNT ANALYTICS</div><h2>{t('performance')}</h2></div></div>{history.length ? <div className="performance-chart">{history.map(item => <div className="chart-column" key={item.label}><b>{item.points}</b><i style={{ height:`${Math.max(5, item.points / max * 100)}%` }} /><small title={item.label}>{item.label}</small></div>)}</div> : <p>{t('noPerformance')}</p>}</section>
  </main></div>;
}
