/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PlayerCard from '@/components/PlayerCard';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { MARKET_PAGE_SIZE, searchKnownAccounts, searchMarketPlayers, type KnownAccount } from '@/lib/market-players';
import { supabase } from '@/lib/supabase';
import type { Player } from '@/lib/types';

export default function DashboardPage() {
  const { leagues, activeLeagueId } = useGame();
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [visible, setVisible] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState<KnownAccount[]>([]);

  // Debounced so typing does not fire a query per keystroke.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await searchMarketPlayers(client, { search: query, page });
        if (cancelled) return;
        setVisible(result.players); setTotal(result.total); setFailed(false);
        // Only when the market itself has nothing: players we have seen compete but
        // do not carry. Cached, misses included, so repeated typing stays cheap.
        setMissing(query.trim().length >= 2 && !result.total
          ? await searchKnownAccounts(client, query).catch(() => [])
          : []);
      } catch {
        if (!cancelled) { setVisible([]); setTotal(0); setMissing([]); setFailed(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, page]);

  const totalPages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
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
        <span aria-live="polite">{total} PROS · {t('page')} {currentPage}/{totalPages}</span>
      </div>
      {loading ? <div className="player-grid" aria-busy="true" aria-label={t('loading')}>{Array.from({ length: 12 }, (_, index) => <div className="player-card-skeleton" key={index} />)}</div>
        : failed ? <p className="notice error" role="alert">{t('noPlayers')}</p>
        : visible.length ? <><div className="player-grid">{visible.map(player => <PlayerCard key={player.id} player={player} />)}</div><nav className="market-pagination" aria-label={t('marketPages')}><button disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>‹ <span>{t('previousPage')}</span></button>{pageButtons.map(number => <button className={number === currentPage ? 'active' : ''} aria-current={number === currentPage ? 'page' : undefined} onClick={() => changePage(number)} key={number}>{number}</button>)}<button disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}><span>{t('nextPage')}</span> ›</button></nav></> : <><p className="notice">{t('noPlayers')}</p>
          {missing.length > 0 && <section className="epic-panel missing-players">
            <div className="section-heading"><h2>Seen competing, not in the market</h2><span>{missing.length}</span></div>
            <p>These accounts appear in tournaments we track but are not carried yet. Statistics are only what we already recorded — nothing here is estimated.</p>
            <ul>{missing.map(account => <li key={account.account_id}>
              <strong>{account.username}</strong>
              <span>Best rank {account.best_rank} · {account.appearances} {account.appearances === 1 ? 'event' : 'events'}</span>
              <small>{account.latest_event || 'Unknown event'}{account.latest_region ? ` · ${account.latest_region}` : ''}</small>
            </li>)}</ul>
          </section>}</>}
    </main>
  </div>;
}
