"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';
import { getLevelProgress } from '@/lib/types';
import { openGuide } from './OnboardingGuide';

export default function Header() {
  const router = useRouter();
  const { coins, accountPortfolio, loading, userEmail, userId, profile, leagues, activeLeagueId, selectLeague, signOut } = useGame();
  const { locale, t } = useLocale();
  const [unread, setUnread] = useState(0);
  const logout = async () => { await signOut(); router.replace('/auth'); router.refresh(); };

  useEffect(() => {
    if (!supabase || !userId) return;
    const client = supabase;
    const load = () => client.rpc('get_notifications').then(({ data }) => setUnread((data || []).filter((item:{ read:boolean }) => !item.read).length));
    const clear = () => setUnread(0);
    window.addEventListener('fantafort:notifications-read', clear);
    load(); const timer = setInterval(load, 30000); return () => { clearInterval(timer); window.removeEventListener('fantafort:notifications-read', clear); };
  }, [userId]);

  return <header className="site-header">
    <Link href="/dashboard" className="logo"><span>FANTA</span>FORT</Link>
    <nav className="desktop-nav" aria-label="Main navigation">
      <Link href="/dashboard">{t('market')}</Link>
      <Link href="/trading">{t('trading')}</Link>
      <Link href="/wallet">{t('wallet')}</Link>
      <Link href="/dashboard/team">{t('squad')}</Link>
      <Link href="/leagues">{t('leagues')}</Link>
      <Link href="/leaderboard">{t('rankings')}</Link>
      <Link href="/friends">{t('friends')}</Link>
      <Link href="/tournaments">{t('tournaments')}</Link>
      <Link href="/about">{t('info')}</Link>
      {profile?.isAdmin && <Link href="/admin">{t('admin')}</Link>}
    </nav>
    <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/dashboard">⌂<small>{t('market')}</small></Link><Link href="/dashboard/team">♟<small>{t('squad')}</small></Link><Link href="/leagues">★<small>{t('leagues')}</small></Link><Link href="/leaderboard">#<small>{t('rankings')}</small></Link><Link href="/account">◆<small>{t('account')}</small></Link></nav>
    <div className="header-actions">
      {userId && <Link href="/notifications" className="notification-bell" aria-label={`${t('notifications')}: ${unread}`}>◆{unread > 0 && <span>{unread}</span>}</Link>}
      <button className="guide-button" onClick={openGuide} aria-label={t('help')} title={t('help')}>?</button>
      {leagues.length > 0 && <select className="compact-select" aria-label={t('activeLeague')} value={activeLeagueId || ''} onChange={event => selectLeague(event.target.value)}>
        {leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}
      </select>}
      <Link href="/wallet" className="coin-display" title={t('accountCoins')}><span>C</span>{loading ? '—' : new Intl.NumberFormat(locale).format(accountPortfolio.balance)}</Link>
      {activeLeagueId && <div className="coin-display league-coins" title={t('leagueCoins')}><span>L</span>{new Intl.NumberFormat(locale).format(coins)}</div>}
      {userEmail ? <>
        <Link href="/account" className={`account-pill name-${profile?.nameStyle || 'default'}`}>{profile?.username || userEmail} · LVL {getLevelProgress(profile?.experiencePoints || 0).level}</Link>
        <button className="link-button" onClick={logout}>{t('logout')}</button>
      </> : <Link href="/auth">{t('login')}</Link>}
    </div>
  </header>;
}
