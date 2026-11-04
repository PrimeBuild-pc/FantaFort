"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PlayerCard from '@/components/PlayerCard';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';

export default function MyTeamPage() {
  const { team, coins, loading, leagues, activeLeagueId } = useGame();
  const { locale, t } = useLocale();
  const [now, setNow] = useState(() => Date.now());
  const league = leagues.find(item => item.id === activeLeagueId);
  const slots = league?.rosterSize || 3;
  const open = league?.status === 'active' && league.marketClosesAt && Date.parse(league.marketClosesAt) > now;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">{league ? t('rosterEyebrow') : t('trainingMode')}</div><h1>{league?.name || t('mySquad')}</h1><p>{t('choosePlayers')}</p></div>
    <div className="window-facts">
      <div><small>{t('roster')}</small><b>{t('slots').replace('{filled}', String(team.length)).replace('{total}', String(slots))}</b></div>
      <div><small>{t('leagueCoins')}</small><b>{league ? `${new Intl.NumberFormat(locale).format(coins)} C` : '—'}</b></div>
      <div><small>{t('marketStatus')}</small><b>{league ? (open ? t('marketOpen') : t(league.status === 'active' ? 'marketClosed' : league.status)) : '—'}</b></div>
    </div>
    {loading ? <div className="notice">{t('loading')}</div> : team.length === 0 ? <div className="empty-state"><h2>{t('emptySquad')}</h2><p>{league ? t('visitMarket') : t('needsLeague')}</p><Link className="epic-button" href={league ? '/market' : '/leagues'}>{league ? t('market') : t('createLeague')}</Link></div> : <div className="player-grid">{team.map(player => <PlayerCard key={player.id} player={player} />)}</div>}
  </main></div>;
}
