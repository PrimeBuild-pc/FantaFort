/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from 'react';
import BadgeList from '@/components/BadgeList';
import Emblem from '@/components/Emblem';
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
  // Closing plays the exit animation first; the parent unmounts us when it ends.
  const [closing, setClosing] = useState(false);
  const close = () => setClosing(true);
  const number = (value:number) => new Intl.NumberFormat(locale).format(value);

  // Runs once: focusing on every parent re-render would steal focus from inside the drawer.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event:KeyboardEvent) => { if (event.key === 'Escape') setClosing(true); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return <div className={`lineup-backdrop${closing ? ' closing' : ''}`} onClick={close}>
    <aside className="lineup-drawer" role="dialog" aria-modal="true" aria-label={`${text.title} · ${username}`} onClick={event => event.stopPropagation()}
      onAnimationEnd={event => { if (closing && event.target === event.currentTarget) onClose(); }}>
      <header className="lineup-drawer-head">
        <Emblem username={lineup?.username || username} style={lineup?.avatarStyle} className="lineup-emblem" />
        <div>
          <div className="eyebrow">{text.title}</div>
          <h2 className={`name-${lineup?.nameStyle || 'default'}`}>{lineup?.username || username}</h2>
          {lineup && <BadgeList badges={lineup.badges} compact />}
        </div>
        <button ref={closeRef} className="epic-button secondary" onClick={close}>{text.close}</button>
      </header>
      {lineup && <div className="lineup-summary">
        <span><small>{text.rank}</small><b>#{lineup.rank}</b></span>
        <span><small>{text.worth}</small><b>{number(lineup.netWorth)} C</b></span>
      </div>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {lineup && (lineup.lineup.length
        ? <ul className="lineup-list">{lineup.lineup.map(player => <li key={player.playerId}>
            {player.photoUrl
              ? <img src={player.photoUrl} alt={player.handle} loading="lazy" />
              : <i className={`rarity-dot ${player.rarity}`} aria-hidden="true">{player.handle.slice(0,2).toUpperCase()}</i>}
            <span><strong>{player.handle}</strong><small>{player.team || player.realName || player.rarity}</small></span>
            <b>{number(player.currentPrice)} C</b>
          </li>)}</ul>
        : <p className="empty-state compact">{text.empty}</p>)}
      {!lineup && !error && <div className="leaderboard-skeleton" aria-hidden="true">{Array.from({length:3},(_,index)=><i key={index}/>)}</div>}
    </aside>
  </div>;
}
