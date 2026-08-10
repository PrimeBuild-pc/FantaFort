/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef } from 'react';
import BadgeList from '@/components/BadgeList';
import { lineupCopy } from '@/lib/lineup';
import type { Locale } from '@/lib/i18n';
import type { PublicLineup } from '@/lib/types';

type Props = {
  locale: Locale;
  username: string;
  lineup?: PublicLineup;
  error?: string;
  onClose: () => void;
};

// Read-only presentation of an opted-in lineup. No trading actions and no private figures:
// the payload itself only ever carries public player data.
export default function LineupDrawer({ locale, username, lineup, error, onClose }: Props) {
  const text = lineupCopy[locale];
  const closeRef = useRef<HTMLButtonElement>(null);
  const number = (value:number) => new Intl.NumberFormat(locale).format(value);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event:KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return <div className="lineup-backdrop" onClick={onClose}>
    <aside className="lineup-drawer" role="dialog" aria-modal="true" aria-label={`${text.title} · ${username}`} onClick={event => event.stopPropagation()}>
      <header className="lineup-drawer-head">
        <div>
          <div className="eyebrow">{text.title}</div>
          <h2 className={`name-${lineup?.nameStyle || 'default'}`}>{lineup?.username || username}</h2>
          {lineup && <BadgeList badges={lineup.badges} compact />}
        </div>
        <button ref={closeRef} className="epic-button secondary" onClick={onClose}>{text.close}</button>
      </header>
      {lineup && <div className="lineup-summary">
        <span><small>{text.rank}</small><b>#{lineup.rank}</b></span>
        <span><small>{text.worth}</small><b>{number(lineup.netWorth)} C</b></span>
      </div>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {lineup && (lineup.lineup.length
        ? <ul className="lineup-list">{lineup.lineup.map(player => <li key={player.playerId}>
            {player.photoUrl
              ? <img src={player.photoUrl} alt="" loading="lazy" />
              : <i className={`rarity-dot ${player.rarity}`} aria-hidden="true">{player.handle.slice(0,2).toUpperCase()}</i>}
            <span><strong>{player.handle}</strong><small>{player.team || player.realName || player.rarity}</small></span>
            <b>{number(player.currentPrice)} C</b>
          </li>)}</ul>
        : <p className="empty-state compact">{text.empty}</p>)}
      {!lineup && !error && <div className="leaderboard-skeleton" aria-hidden="true">{Array.from({length:3},(_,index)=><i key={index}/>)}</div>}
    </aside>
  </div>;
}
