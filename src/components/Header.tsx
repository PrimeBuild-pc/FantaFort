"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { Locale, locales } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { getLevelProgress } from '@/lib/types';
import { openGuide } from './OnboardingGuide';

/* Mobile bottom-nav glyphs: inline SVG instead of literal Unicode characters
   (⌂ ♟ ★ #) so the icon set renders consistently across platforms/fonts. */
const ICONS = {
  home: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-6h4v6"/></svg>,
  market: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9h16l-1.2 11H5.2L4 9Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg>,
  squad: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M16 4.3c1.7.4 3 2 3 3.7 0 1.8-1.3 3.3-3 3.7"/><path d="M22 20c0-2.8-2.2-5.1-5-5.8"/></svg>,
  leagues: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/><path d="M12 14v3M9 20h6M9.5 17h5l.5 3H9l.5-3Z"/></svg>,
  more: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  account: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>,
};

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { coins, accountPortfolio, loading, userEmail, userId, profile, leagues, activeLeagueId, selectLeague, signOut } = useGame();
  const { locale, setLocale, t } = useLocale();
  const here = (href: string) => pathname === href ? 'page' as const : undefined;
  const [unread, setUnread] = useState(0);
  const logout = async () => { await signOut(); router.replace('/auth'); router.refresh(); };

  useEffect(() => {
    if (!supabase || !userId) return;
    const client = supabase;
    const load = () => client.rpc('get_notifications').then(({ data }) => setUnread((data || []).filter((item:{ read:boolean }) => !item.read).length));
    const clear = () => setUnread(0);
    window.addEventListener('fantafort:notifications-read', clear);
    load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000); return () => { clearInterval(timer); window.removeEventListener('fantafort:notifications-read', clear); };
  }, [userId]);

  return <header className="site-header">
    <Link href="/dashboard" className="logo"><span>FANTA</span>FORT</Link>
    <nav className="desktop-nav" aria-label="Main navigation">
      <Link href="/dashboard" aria-current={here('/dashboard')}>{t('home')}</Link>
      <Link href="/market" aria-current={pathname.startsWith('/market') ? 'page' : undefined}>{t('market')}</Link>
      <Link href="/dashboard/team" aria-current={pathname.startsWith('/dashboard/team') ? 'page' : undefined}>{t('squad')}</Link>
      <Link href="/leagues" aria-current={pathname.startsWith('/leagues') ? 'page' : undefined}>{t('leagues')}</Link>
      <Link href="/leaderboard" aria-current={here('/leaderboard')}>{t('rankings')}</Link>
      <details className="desktop-more">
        <summary>{t('more')}</summary>
        <div className="desktop-more-menu">
          <Link href="/trading">{t('trading')}</Link>
          <Link href="/wallet">{t('wallet')}</Link>
          <Link href="/shop">{t('shop')}</Link>
          <Link href="/friends">{t('friends')}</Link>
          <Link href="/tournaments">{t('tournaments')}</Link>
          <Link href="/notifications">{t('notifications')}</Link>
          <Link href="/about">{t('info')}</Link>
          {profile?.isAdmin && <Link href="/admin">{t('admin')}</Link>}
        </div>
      </details>
    </nav>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <Link href="/dashboard" aria-current={here('/dashboard')}>{ICONS.home}<small>{t('home')}</small></Link>
      <Link href="/market" aria-current={pathname.startsWith('/market') ? 'page' : undefined}>{ICONS.market}<small>{t('market')}</small></Link>
      <Link href="/dashboard/team" aria-current={pathname.startsWith('/dashboard/team') ? 'page' : undefined}>{ICONS.squad}<small>{t('squad')}</small></Link>
      <Link href="/leagues" aria-current={pathname.startsWith('/leagues') ? 'page' : undefined}>{ICONS.leagues}<small>{t('leagues')}</small></Link>
      <details className="mobile-more">
        <summary>{ICONS.more}<small>{t('more')}</small></summary>
        <div className="mobile-more-menu">
          <Link href="/account">{t('account')}</Link>
          <Link href="/trading">{t('trading')}</Link>
          <Link href="/wallet">{t('wallet')}</Link>
          <Link href="/shop">{t('shop')}</Link>
          <Link href="/leaderboard">{t('rankings')}</Link>
          <Link href="/friends">{t('friends')}</Link>
          <Link href="/tournaments">{t('tournaments')}</Link>
          <Link href="/notifications">{t('notifications')}</Link>
          <Link href="/about">{t('info')}</Link>
          {profile?.isAdmin && <Link href="/admin">{t('admin')}</Link>}
        </div>
      </details>
    </nav>
    <div className="header-actions">
      <label className="header-language"><span>{t('language')}</span><select aria-label={t('language')} value={locale} onChange={event => setLocale(event.target.value as Locale)}>{locales.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
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
