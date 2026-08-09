/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';

type RosterPlayer = { id: string; handle: string; photo_url?: string; price: number };
type Row = {
  user_id: string; username: string; name_style: string; points: number; projected_points: number;
  base_points: number; synergy_points: number; strategy_points: number; penalty_points: number;
  coins: number; reserved_coins: number; roster: RosterPlayer[];
};
type Tournament = { window_id: string; name: string; starts_at: string; format: string; match_cap: number | null };
type Pick = { id: number; window_id: string; pick_type: string; player_id: string; partner_player_id: string | null; predicted_points: number | null; cost: number };
type Auction = { id:number; player_id:string; starting_bid:number; current_bid:number|null; bidder_id:string|null; ends_at:string; status:string; players:{handle:string;price:number}|null };

export default function LeagueDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { leagues, players, userId, selectLeague, finishLeague, refresh } = useGame();
  const { locale, t } = useLocale();
  const [rows, setRows] = useState<Row[]>([]);
  const [events, setEvents] = useState<Tournament[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [eventId, setEventId] = useState('');
  const [strategy, setStrategy] = useState<'captain' | 'duo_call' | 'exact_score'>('captain');
  const [playerId, setPlayerId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [prediction, setPrediction] = useState(0);
  const [auction, setAuction] = useState<Auction>();
  const [auctionPlayer, setAuctionPlayer] = useState('');
  const [auctionDuration, setAuctionDuration] = useState(90);
  const [bid, setBid] = useState(500);
  const [clock, setClock] = useState(0);
  const [updated, setUpdated] = useState<Date>();
  const [message, setMessage] = useState('');
  const league = leagues.find(item => item.id === id);

  const load = useCallback(async () => {
    if (!supabase) return;
    const now = new Date().toISOString();
    const [dashboard, tournaments, strategies, auctions] = await Promise.all([
      supabase.rpc('get_league_dashboard', { target_league: id }),
      supabase.from('tournaments').select('window_id,name,starts_at,format,match_cap').gt('starts_at', now).order('starts_at').limit(12),
      supabase.from('league_strategy_picks').select('id,window_id,pick_type,player_id,partner_player_id,predicted_points,cost').eq('league_id', id).eq('user_id', userId || ''),
      supabase.from('league_auctions').select('id,player_id,starting_bid,current_bid,bidder_id,ends_at,status,players(handle,price)').eq('league_id', id).eq('status','active').maybeSingle(),
    ]);
    if (dashboard.error) return setMessage(dashboard.error.message);
    const nextRows: Row[] = (dashboard.data || []).map((row: Row) => ({
      ...row,
      points: Number(row.points), projected_points: Number(row.projected_points), base_points: Number(row.base_points),
      synergy_points: Number(row.synergy_points), strategy_points: Number(row.strategy_points), penalty_points: Number(row.penalty_points),
    }));
    setRows(nextRows);
    setEvents((tournaments.data || []) as Tournament[]);
    setPicks((strategies.data || []) as Pick[]);
    setAuction(auctions.data as unknown as Auction | undefined);
    setEventId(value => value || tournaments.data?.[0]?.window_id || '');
    const mine = nextRows.find(row => row.user_id === userId);
    setPlayerId(value => value || mine?.roster[0]?.id || '');
    setPartnerId(value => value || mine?.roster[1]?.id || '');
    const ownedIds = new Set(nextRows.flatMap(row => row.roster.map(player => player.id)));
    setAuctionPlayer(value => value && !ownedIds.has(value) ? value : players.find(player => !ownedIds.has(player.id))?.id || '');
    const currentAuction = auctions.data as unknown as Auction | null;
    if (currentAuction) setBid(currentAuction.current_bid ? currentAuction.current_bid + 100 : currentAuction.starting_bid);
    setUpdated(new Date());
  }, [id, players, userId]);
  useEffect(() => { selectLeague(id); load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [id, load, selectLeague]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const mine = rows.find(row => row.user_id === userId);
  const leader = Math.max(1, ...rows.map(row => row.points));
  const selectedEvent = events.find(event => event.window_id === eventId);
  const strategyCost = league ? Math.round(league.budget * (strategy === 'captain' ? .05 : strategy === 'duo_call' ? .03 : .02)) : 0;
  const marketOpen = Boolean(league?.status === 'active' && league.marketClosesAt && updated && Date.parse(league.marketClosesAt) > updated.getTime());
  const canFinish = Boolean(league?.economyMode === 'demo' || (league?.endsAt && updated && Date.parse(league.endsAt) <= updated.getTime()));
  const existing = useMemo(() => new Set(picks.map(pick => `${pick.window_id}:${pick.pick_type}`)), [picks]);

  const buyStrategy = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || !eventId || !playerId) return;
    setMessage('');
    const { error } = await supabase.rpc('buy_strategy_pick', {
      target_league: id, target_window: eventId, strategy, target_player_id: playerId,
      partner_id: strategy === 'duo_call' ? partnerId : null,
      prediction: strategy === 'exact_score' ? prediction : null,
    });
    setMessage(error?.message || '✓');
    if (!error) { await Promise.all([load(), refresh()]); }
  };
  const auctionAction = async (action:'start'|'bid'|'settle'|'cancel') => {
    if (!supabase) return; setMessage('');
    const result = action === 'start'
      ? await supabase.rpc('start_league_auction',{target_league:id,target_player_id:auctionPlayer,duration_seconds:auctionDuration})
      : action === 'bid' && auction
        ? await supabase.rpc('place_auction_bid',{target_auction:auction.id,bid_amount:bid})
        : action === 'cancel' && auction
          ? await supabase.rpc('cancel_league_auction',{target_auction:auction.id})
          : auction ? await supabase.rpc('settle_league_auction',{target_auction:auction.id}) : null;
    if (!result) return;
    setMessage(result.error?.message || '✓');
    if (!result.error) await Promise.all([load(),refresh()]);
  };
  const remaining = auction ? Math.max(0, Math.ceil((Date.parse(auction.ends_at) - (clock || updated?.getTime() || 0)) / 1000)) : 0;
  const requiredBidFunds = auction?.bidder_id === userId ? Math.max(0, bid - (auction.current_bid || 0)) : bid;

  return <div className="app-shell"><Header /><main className="container page-content">
    <section className="live-hero"><div><div className="live-badge"><i /> LIVE FANTAFORT</div><h1>{league?.name || t('liveDashboard')}</h1><p>{updated ? `${t('updated')} ${updated.toLocaleTimeString(locale)}` : t('loading')}</p><small>{league ? `${t(`${league.scoringMode}Mode` as 'classicMode')} · ${marketOpen ? t('marketOpen') : t('marketClosed')}${league.economyMode === 'account_stake' ? ` · ${t('virtualPrizePool')}: ${(league.entryStake * league.members).toLocaleString(locale)} C` : ''}` : ''}</small></div><div className="league-actions"><Link href="/dashboard" className="epic-button">{t('market')}</Link>{league?.ownerId === userId && league.status === 'active' && canFinish && <button className="epic-button secondary" onClick={async () => setMessage(await finishLeague(id) || t('winnerRewarded'))}>{t('finishLeague')}</button>}</div></section>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="standings">
      {rows.map((row, index) => <article className={`standing-row strategic ${index === 0 ? 'leader' : ''}`} key={row.user_id}>
        <div className="rank">#{index + 1}</div>
        <div className="manager-info"><strong className={`name-${row.name_style}`}>{row.username}</strong><span>{row.roster.map(player => player.handle).join(' · ') || t('emptySquad')} · {row.coins.toLocaleString(locale)} C{row.reserved_coins ? ` (${row.reserved_coins.toLocaleString(locale)} ${t('reserved')})` : ''}</span><div className="score-breakdown"><small>{t('base')} {row.base_points}</small><small className="synergy">+{row.synergy_points} {t('synergy')}</small><small>+{row.strategy_points} {t('strategy')}</small>{row.penalty_points < 0 && <small className="penalty">{row.penalty_points} {t('ruling')}</small>}</div></div>
        <div className="score-block"><small>{t('points')}</small><b>{row.points}</b></div>
        <div className="score-block projection"><small>{t('projection')}</small><b>{row.projected_points}</b></div>
        <div className="standing-bar"><i style={{ width: `${Math.max(2, row.points / leader * 100)}%` }} /></div>
      </article>)}
    </div>

    {league?.status === 'active' && league.draftMode === 'auction' && <section className="auction-panel epic-panel"><div><div className="eyebrow">LIVE AUCTION</div><h2>{t('auctionDraft')}</h2><p>{t('auctionRules')}</p></div>{auction ? <div className="active-auction"><div><small>{t('player')}</small><h3>{auction.players?.handle || auction.player_id}</h3><span>{t('marketPrice')}: {auction.players?.price?.toLocaleString(locale) || '—'} C</span></div><div className="auction-price"><small>{t('currentBid')}</small><b>{(auction.current_bid || auction.starting_bid).toLocaleString(locale)} C</b><span>{remaining}s</span></div>{remaining > 0 ? <form onSubmit={event=>{event.preventDefault();auctionAction('bid')}}><label>{t('yourBid')}<input type="number" min={auction.current_bid ? auction.current_bid + 100 : auction.starting_bid} step="100" value={bid} onChange={event=>setBid(Number(event.target.value))}/></label><button className="epic-button" disabled={!mine || mine.coins < requiredBidFunds}>{t('placeBid')}</button>{league.ownerId===userId&&!auction.bidder_id&&<button type="button" className="link-button danger" onClick={()=>auctionAction('cancel')}>{t('cancelAuction')}</button>}</form>:<button className="epic-button" onClick={()=>auctionAction('settle')}>{t('settleAuction')}</button>}</div>:league.ownerId===userId&&marketOpen?<form onSubmit={event=>{event.preventDefault();auctionAction('start')}}><div className="settings-grid"><label>{t('player')}<select value={auctionPlayer} onChange={event=>setAuctionPlayer(event.target.value)}>{players.filter(player=>!rows.some(row=>row.roster.some(item=>item.id===player.id))).slice(0,150).map(player=><option value={player.id} key={player.id}>{player.handle} · {player.price.toLocaleString(locale)} C</option>)}</select></label><label>{t('auctionDuration')}<select value={auctionDuration} onChange={event=>setAuctionDuration(Number(event.target.value))}>{[30,60,90,120,180,300].map(value=><option value={value} key={value}>{value}s</option>)}</select></label></div><button className="epic-button">{t('startAuction')}</button></form>:<p className="notice">{marketOpen?t('waitingForAuction'):t('marketClosed')}</p>}</section>}

    {league?.status === 'active' && <section className="strategy-panel epic-panel">
      <div><div className="eyebrow">STRATEGY LAB</div><h2>{t('spendRemainder')}</h2><p>{t('strategyRules')}</p></div>
      {mine?.roster.length && events.length ? <form onSubmit={buyStrategy}>
        <label>{t('event')}<select value={eventId} onChange={event => setEventId(event.target.value)}>{events.map(item => <option key={item.window_id} value={item.window_id}>{item.name} · {new Date(item.starts_at).toLocaleString(locale)} · {item.format}</option>)}</select></label>
        <label>{t('strategy')}<select value={strategy} onChange={event => setStrategy(event.target.value as typeof strategy)}><option value="captain">{t('captain')}</option><option value="duo_call">{t('duoPrediction')}</option><option value="exact_score">{t('scorePrediction')}</option></select></label>
        <div className="settings-grid"><label>{t('player')}<select value={playerId} onChange={event => setPlayerId(event.target.value)}>{mine.roster.map(player => <option key={player.id} value={player.id}>{player.handle}</option>)}</select></label>
          {strategy === 'duo_call' && <label>{t('teammate')}<select value={partnerId} onChange={event => setPartnerId(event.target.value)}>{mine.roster.filter(player => player.id !== playerId).map(player => <option key={player.id} value={player.id}>{player.handle}</option>)}</select></label>}
          {strategy === 'exact_score' && <label>{t('exactPoints')}<input type="number" min="0" max="1000" value={prediction} onChange={event => setPrediction(Number(event.target.value))} /></label>}
        </div>
        <button className="epic-button" disabled={!selectedEvent || existing.has(`${eventId}:${strategy}`) || mine.coins < strategyCost}>{existing.has(`${eventId}:${strategy}`) ? t('alreadyPicked') : `${t('activate')} · ${strategyCost.toLocaleString(locale)} C`}</button>
      </form> : <p className="notice">{t('strategyUnavailable')}</p>}
      {picks.length > 0 && <div className="pick-list">{picks.map(pick => <span key={pick.id}>{t(pick.pick_type === 'captain' ? 'captain' : pick.pick_type === 'duo_call' ? 'duoPrediction' : 'scorePrediction')} · {pick.cost.toLocaleString(locale)} C</span>)}</div>}
    </section>}
    <p className="data-disclaimer">{t('syncDisclaimer')}</p>
  </main></div>;
}
