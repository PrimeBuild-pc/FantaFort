"use client";

import Link from 'next/link';
import Header from '@/components/Header';
import PlayerCard from '@/components/PlayerCard';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';

export default function MyTeamPage() {
  const { team, loading, leagues, activeLeagueId } = useGame();
  const { t } = useLocale();
  const league = leagues.find(item => item.id === activeLeagueId);
  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">{league?.name || 'TRAINING'}</div><h1>{t('mySquad')}</h1><p>{t('choosePlayers')}</p></div>
    {loading ? <div className="notice">{t('loading')}</div> : team.length === 0 ? <div className="empty-state"><h2>{t('emptySquad')}</h2><p>{t('visitMarket')}</p><Link className="epic-button" href="/dashboard">{t('market')}</Link></div> : <div className="player-grid">{team.map(player => <PlayerCard key={player.id} player={player} />)}</div>}
  </main></div>;
}
