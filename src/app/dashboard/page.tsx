"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PlayerCard from '@/components/PlayerCard';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';

const PAGE_SIZE = 48;

export default function DashboardPage() {
  const { players, leagues, activeLeagueId, loading } = useGame();
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => players.filter(player =>
    `${player.handle} ${player.realName || ''} ${player.team || ''}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [players, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstPageButton = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pageButtons = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPageButton + index);
  const activeLeague = leagues.find(league => league.id === activeLeagueId);
  const changePage = (nextPage:number) => { setPage(nextPage); document.querySelector('.market-toolbar')?.scrollIntoView({ behavior:'smooth' }); };

  return <div className="app-shell">
    <Header />
    <main className="container page-content">
      <section className="market-hero">
        <div><div className="eyebrow">FORTNITE FANTASY</div><h1>{t('itemShop')}</h1><p>{t('choosePlayers')}</p></div>
        <div className="hero-status">
          {activeLeague ? <><small>{t('activeLeague')}</small><strong>{activeLeague.name}</strong><span className={`status ${activeLeague.status}`}>{t(activeLeague.status)}</span></> : <><small>TRAINING MODE</small><strong>No league selected</strong><Link href="/leagues">{t('createLeague')} →</Link></>}
        </div>
      </section>
      <div className="market-toolbar">
        <label className="search-box"><span>⌕</span><input value={query} aria-label={t('searchPlayers')} maxLength={80} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={t('searchPlayers')} /></label>
        <span>{filtered.length} PROS · {t('page')} {currentPage}/{totalPages}</span>
      </div>
      {loading ? <p className="notice">{t('loading')}</p> : visible.length ? <><div className="player-grid">{visible.map(player => <PlayerCard key={player.id} player={player} />)}</div><nav className="market-pagination" aria-label={t('marketPages')}><button disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>‹ <span>{t('previousPage')}</span></button>{pageButtons.map(number => <button className={number === currentPage ? 'active' : ''} aria-current={number === currentPage ? 'page' : undefined} onClick={() => changePage(number)} key={number}>{number}</button>)}<button disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}><span>{t('nextPage')}</span> ›</button></nav></> : <p className="notice">{t('noPlayers')}</p>}
    </main>
  </div>;
}
