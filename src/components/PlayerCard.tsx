/* eslint-disable @next/next/no-img-element */
"use client";

import { KeyboardEvent, MouseEvent, useState } from 'react';
import { Player } from '@/lib/types';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';

type Props = {
  player: Player;
  /** When set, renders a selection control for the comparison panel instead of only flipping on click. */
  compareMode?: boolean;
  compareSelected?: boolean;
  onToggleCompare?: (player: Player) => void;
};

export default function PlayerCard({ player, compareMode, compareSelected, onToggleCompare }: Props) {
  const { team, coins, leagues, activeLeagueId, addToTeam, removeFromTeam } = useGame();
  const { locale, t } = useLocale();
  const [flipped, setFlipped] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const isOwned = team.some(item => item.id === player.id);
  const canAfford = coins >= player.price;
  const auctionOnly = leagues.find(league => league.id === activeLeagueId)?.draftMode === 'auction';
  const colors = { common: '#a8b2c6', rare: '#2e9cff', epic: '#b347ff', legendary: '#f7c945' };
  const color = colors[player.rarity];

  const age = player.birthDate ? (() => {
    const born = new Date(`${player.birthDate}T00:00:00Z`); const now = new Date();
    return now.getUTCFullYear() - born.getUTCFullYear() - (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate()) ? 1 : 0);
  })() : null;
  const number = (value?: number | null) => value == null ? '—' : new Intl.NumberFormat(locale, { notation: value > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
  const money = player.earnings == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(player.earnings);

  const act = async (event: MouseEvent) => {
    event.stopPropagation();
    setPending(true); setError('');
    const message = isOwned ? await removeFromTeam(player.id) : await addToTeam(player);
    if (message) setError(message);
    setPending(false);
  };
  const keyboardFlip = (event: KeyboardEvent) => {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setFlipped(value => !value); }
  };
  const stats = [
    [t('earnings'), money], [t('cupPoints'), number(player.tournamentPoints)],
    [t('pointsPerGame'), number(player.pointsPerMatch)], [t('winRate'), `${number(player.winRate)}%`],
    [t('bestPlacement'), player.bestPlacement ? `#${player.bestPlacement}` : '—'], [t('age'), age == null ? '—' : String(age)],
  ];

  return <article
    className={`player-card-shell${compareSelected ? ' compare-selected' : ''}`} style={{ '--rarity': color } as React.CSSProperties}
    role="group" tabIndex={0} aria-label={`${player.handle} · ${flipped ? t('front') : t('details')}`}
    onClick={() => setFlipped(value => !value)} onKeyDown={keyboardFlip}
  >
    <div className={`player-flipper ${flipped ? 'is-flipped' : ''}`}>
      <section className="player-tile player-front" aria-hidden={flipped}>
        <div className="player-visual">
          {compareMode && <button type="button" className="compare-check" aria-pressed={!!compareSelected} aria-label={`${t('compareSelect')} — ${player.handle}`} onClick={event => { event.stopPropagation(); onToggleCompare?.(player); }}>{compareSelected ? '✓' : ''}</button>}
          {player.photoUrl ? <img src={player.photoUrl} alt={player.handle} loading="lazy" /> : <div className="player-silhouette" aria-label={t('photoPending')}><span>{player.handle.slice(0, 2).toUpperCase()}</span></div>}
          <div className="price-tag"><b>{new Intl.NumberFormat(locale).format(player.price)}</b><small className={player.priceChange ? player.priceChange > 0 ? 'positive' : 'negative' : ''}>COINS {player.priceChange ? `${player.priceChange > 0 ? '▲' : '▼'} ${number(Math.abs(player.priceChange))}` : '•'}</small></div>
          <div className="rarity-label">{player.rarity}</div><div className="rarity-line" />
        </div>
        <div className="player-info">
          <div className="eyebrow">{player.team || 'FORTNITE PRO'}</div><h3>{player.handle}</h3>
          <p>{player.realName || player.eligibility || t('eligible')}</p>
          <div className="quick-stats"><span><small>PTS</small><b>{number(player.tournamentPoints)}</b></span><span><small>CUPS</small><b>{number(player.cupsPlayed)}</b></span><em>{t('details')} ↻</em></div>
          <button className={isOwned ? 'epic-button owned' : 'epic-button'} tabIndex={flipped ? -1 : 0} onClick={act} disabled={auctionOnly || pending || (!isOwned && !canAfford)}>{auctionOnly ? t('auctionOnly') : pending ? t('wait') : isOwned ? t('sell') : t('purchase')}</button>
          {error && <p className="card-error" role="alert">{error}</p>}
        </div>
      </section>

      <section className="player-tile player-back" aria-hidden={!flipped}>
        <div className="card-back-header"><div><div className="eyebrow">PLAYER ANALYSIS</div><h3>{player.handle}</h3></div><span>{player.rarity}</span></div>
        <div className="stat-grid">{stats.map(([label, value]) => <div className="stat-cell" key={label}><small>{label}</small><b>{value}</b></div>)}</div>
        <div className="eligibility-box"><small>{player.teammates?.length ? t('recentTeammates') : t('eligible')}</small><p>{player.teammates?.length ? player.teammates.map(teammate => teammate.handle).join(' · ') : player.eligibility || 'Curated competitive player'}</p>{player.averagePlacement != null && <span>{t('avgPlacement')}: #{number(player.averagePlacement)}</span>}</div>
        <div className="back-actions"><button className={isOwned ? 'epic-button owned' : 'epic-button'} tabIndex={flipped ? 0 : -1} onClick={act} disabled={auctionOnly || pending || (!isOwned && !canAfford)}>{auctionOnly ? t('auctionOnly') : pending ? t('wait') : isOwned ? t('sell') : t('purchase')}</button><button className="epic-button secondary" tabIndex={flipped ? 0 : -1} onClick={event => { event.stopPropagation(); setFlipped(false); }}>{t('front')}</button></div>
        {error && <p className="card-error" role="alert">{error}</p>}
      </section>
    </div>
  </article>;
}
