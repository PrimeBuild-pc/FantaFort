/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import TradingChart, { ChartRange, TradingPoint } from '@/components/TradingChart';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { Player } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type PriceChange = { old_price:number; new_price:number; changed_at:string };
type TradeRow = { id:number|string; amount:number; type:string; metadata:Record<string,unknown>; created_at:string };
type Sort = 'change'|'price'|'name';

export default function TradingPage() {
  const { accountPortfolio, accountBuyPlayer, accountSellPlayer, players, userId, loading } = useGame();
  const { locale, t } = useLocale();
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState('');
  const [watchlist,setWatchlist]=useState<Set<string>>(new Set());
  const [filter,setFilter]=useState<'all'|'watchlist'|'portfolio'>('all');
  const [sort,setSort]=useState<Sort>('change');
  const [range,setRange]=useState<ChartRange>('1M');
  const [history,setHistory]=useState<TradingPoint[]>([]);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [lastSync,setLastSync]=useState<string>();
  const [marketStale,setMarketStale]=useState(false);
  const [trades,setTrades]=useState<TradeRow[]>([]);
  const [side,setSide]=useState<'buy'|'sell'>('buy');
  const [message,setMessage]=useState('');
  const [pending,setPending]=useState(false);
  const positions=useMemo(()=>new Map(accountPortfolio.positions.map(position=>[position.playerId,position])),[accountPortfolio.positions]);
  const market=useMemo(()=>players.filter(player=>{
    const matches=`${player.handle} ${player.realName||''} ${player.team||''}`.toLowerCase().includes(query.toLowerCase());
    return matches&&(filter==='all'||filter==='watchlist'&&watchlist.has(player.id)||filter==='portfolio'&&positions.has(player.id));
  }).sort((a,b)=>sort==='name'?a.handle.localeCompare(b.handle):sort==='price'?b.price-a.price:(b.priceChange||0)-(a.priceChange||0)).slice(0,160),[filter,players,positions,query,sort,watchlist]);
  const selected=players.find(player=>player.id===selectedId)||players.find(player=>positions.has(player.id))||market[0]||players[0];
  const position=selected?positions.get(selected.id):undefined;
  const number=(value:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(value);
  const percent=(value:number,base:number)=>base?value/base*100:0;
  const gainers=useMemo(()=>[...players].sort((a,b)=>(b.priceChange||0)-(a.priceChange||0)).slice(0,3),[players]);
  const losers=useMemo(()=>[...players].filter(player=>(player.priceChange||0)<0).sort((a,b)=>(a.priceChange||0)-(b.priceChange||0)).slice(0,3),[players]);
  const advancing=players.filter(player=>(player.priceChange||0)>0).length;
  const declining=players.filter(player=>(player.priceChange||0)<0).length;
  const averageMove=players.length?players.reduce((sum,player)=>sum+(player.priceChange||0),0)/players.length:0;

  useEffect(()=>{
    if(!supabase||!userId)return;
    const now=new Date().toISOString();
    Promise.all([
      supabase.from('account_watchlist').select('player_id').eq('user_id',userId),
      supabase.from('tournaments').select('synced_at').order('synced_at',{ascending:false}).limit(1).single(),
      supabase.rpc('get_wallet_history',{page_index:0}),
      supabase.from('tournaments').select('window_id').lte('starts_at',now).gte('ends_at',now).limit(1),
    ]).then(([watch,sync,ledger,live])=>{
      setWatchlist(new Set((watch.data||[]).map(row=>row.player_id)));
      setLastSync(sync.data?.synced_at);
      const freshnessMinutes=(live.data||[]).length?30:120;
      setMarketStale(!sync.data?.synced_at||Date.now()-Date.parse(sync.data.synced_at)>freshnessMinutes*60000);
      setTrades(((ledger.data||[]) as TradeRow[]).filter(row=>row.type==='trade_buy'||row.type==='trade_sell').slice(0,8));
    });
  },[userId]);

  useEffect(()=>{
    if(!supabase||!selected)return;
    let active=true;setHistoryLoading(true);
    const now=new Date();
    const start=range==='1D'?new Date(now.getTime()-86400000):range==='1W'?new Date(now.getTime()-7*86400000):range==='1M'?new Date(now.getTime()-30*86400000):null;
    const changesQuery=supabase.from('player_price_history').select('old_price,new_price,changed_at').eq('player_id',selected.id).order('changed_at',{ascending:true}).limit(500);
    const changesPromise=start?changesQuery.gte('changed_at',start.toISOString()):changesQuery;
    const anchorPromise=start?supabase.from('player_price_history').select('new_price,changed_at').eq('player_id',selected.id).lt('changed_at',start.toISOString()).order('changed_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null,error:null});
    Promise.all([changesPromise,anchorPromise]).then(([changesResult,anchorResult])=>{
      if(!active)return;
      const changes=(changesResult.data||[]) as PriceChange[];
      const points:TradingPoint[]=[];
      if(start){
        const anchor=(anchorResult.data as {new_price:number}|null)?.new_price??changes[0]?.old_price;
        if(anchor!=null)points.push({at:start.toISOString(),price:anchor});
      }else if(changes[0]) points.push({at:new Date(Date.parse(changes[0].changed_at)-1).toISOString(),price:changes[0].old_price});
      changes.forEach(change=>points.push({at:change.changed_at,price:change.new_price}));
      points.push({at:now.toISOString(),price:selected.price});
      setHistory(points);setHistoryLoading(false);
    });
    return()=>{active=false};
  },[range,selected]);

  useEffect(()=>{setSide(position?'sell':'buy');},[position,selected?.id]);

  const executeTrade=async()=>{
    if(!selected)return;
    const selling=side==='sell';
    if(selling&&!position)return setMessage(t('noPosition'));
    const value=selling?Math.floor(selected.price*.95):selected.price;
    if(!window.confirm(`${selling?t('confirmSale'):t('confirmBuy')} ${value.toLocaleString(locale)} C?`))return;
    setPending(true);setMessage('');
    const error=selling?await accountSellPlayer(selected.id):await accountBuyPlayer(selected.id);
    setMessage(error||'✓');setPending(false);
    if(!error){
      const row:TradeRow={id:crypto.randomUUID(),amount:selling?value:-value,type:selling?'trade_sell':'trade_buy',metadata:{handle:selected.handle},created_at:new Date().toISOString()};
      setTrades(current=>[row,...current].slice(0,8));
    }
  };
  const toggleWatch=async()=>{
    if(!supabase||!userId||!selected)return;
    const watched=watchlist.has(selected.id);
    const result=watched?await supabase.from('account_watchlist').delete().eq('user_id',userId).eq('player_id',selected.id):await supabase.from('account_watchlist').insert({user_id:userId,player_id:selected.id});
    if(result.error)return setMessage(result.error.message);
    setWatchlist(current=>{const next=new Set(current);if(watched)next.delete(selected.id);else next.add(selected.id);return next;});
  };
  const selectForTrade=(player:Player,nextSide?:'buy'|'sell')=>{setSelectedId(player.id);if(nextSide)setSide(nextSide);document.getElementById('order-ticket')?.scrollIntoView({behavior:'smooth',block:'center'});};
  const tradeValue=side==='sell'?Math.floor((selected?.price||0)*.95):selected?.price||0;
  const balanceAfter=side==='sell'?accountPortfolio.balance+tradeValue:accountPortfolio.balance-tradeValue;

  if(loading)return <div className="app-shell"><Header/><main className="container page-content"><p className="notice">{t('loading')}</p></main></div>;
  if(!userId)return <div className="app-shell"><Header/><main className="container page-content"><div className="empty-state"><h2>{t('signIn')}</h2><Link href="/auth" className="epic-button">{t('login')}</Link></div></main></div>;
  return <div className="app-shell"><Header/><main className="container page-content trading-dashboard">
    <section className="trading-hero"><div><div className="eyebrow">VIRTUAL PLAYER EXCHANGE</div><h1>{t('trading')}</h1><p>{t('virtualCoinsNotice')}</p></div><div className={`market-clock ${marketStale?'stale':''}`}><small>{t('marketStatus')}</small><b>{marketStale?t('dataStale'):t('marketOnline')}</b><span>{lastSync?`${t('updated')} ${new Date(lastSync).toLocaleString(locale)}`:'—'}</span></div></section>
    {message&&<p className="notice" role="status">{message}</p>}
    <section className="portfolio-strip finance-summary"><div><small>{t('available')}</small><b>{number(accountPortfolio.balance)} C</b></div><div><small>{t('invested')}</small><b>{number(accountPortfolio.holdingsValue)} C</b></div><div><small>{t('locked')}</small><b>{number(accountPortfolio.lockedBalance)} C</b></div><div><small>{t('totalEquity')}</small><b>{number(accountPortfolio.totalEquity)} C</b></div><div className={accountPortfolio.dailyPnl>=0?'positive':'negative'}><small>24H P&amp;L</small><b>{accountPortfolio.dailyPnl>=0?'+':''}{number(accountPortfolio.dailyPnl)} C</b></div><div className={accountPortfolio.totalPnl>=0?'positive':'negative'}><small>TOTAL P&amp;L</small><b>{accountPortfolio.totalPnl>=0?'+':''}{number(accountPortfolio.totalPnl)} C</b></div><Link href="/wallet" className="epic-button secondary">{t('wallet')}</Link></section>

    <section className="market-overview"><div><small>{t('listedPlayers')}</small><b>{players.length}</b></div><div className="positive"><small>{t('advancing')}</small><b>{advancing}</b></div><div className="negative"><small>{t('declining')}</small><b>{declining}</b></div><div className={averageMove>=0?'positive':'negative'}><small>{t('averageMove')}</small><b>{averageMove>=0?'+':''}{number(averageMove)} C</b></div><div className="mover-tape"><small>TOP MOVERS</small><span>{gainers.map(player=><button key={player.id} onClick={()=>setSelectedId(player.id)}>{player.handle} <em className="positive">+{number(player.priceChange||0)}</em></button>)}{losers.map(player=><button key={player.id} onClick={()=>setSelectedId(player.id)}>{player.handle} <em className="negative">{number(player.priceChange||0)}</em></button>)}</span></div></section>

    {selected&&<div className="analysis-layout"><section className="chart-panel epic-panel"><header className="asset-header"><div className="asset-identity">{selected.photoUrl?<img src={selected.photoUrl} alt=""/>:<i>{selected.handle.slice(0,2)}</i>}<div><div className="eyebrow">{selected.team||'FORTNITE PRO'}</div><h2>{selected.handle}</h2><span>{position?`${t('owned')} · ${position.pnl>=0?'+':''}${number(position.pnl)} C P&L`:t('notOwned')}</span></div></div><button className="watch-button" onClick={toggleWatch} aria-label={t('watchlist')}>{watchlist.has(selected.id)?'★':'☆'}</button></header><TradingChart points={history} range={range} onRangeChange={setRange} locale={locale} loading={historyLoading}/><div className="asset-fundamentals"><span><small>{t('marketPrice')}</small><b>{number(selected.price)} C</b></span><span><small>{t('pointsPerGame')}</small><b>{selected.pointsPerMatch||0}</b></span><span><small>{t('winRate')}</small><b>{selected.winRate||0}%</b></span><span><small>{t('avgPlacement')}</small><b>{selected.averagePlacement?`#${selected.averagePlacement}`:'—'}</b></span><span><small>{t('recentTeammates')}</small><b>{selected.teammates?.slice(0,2).map(player=>player.handle).join(' · ')||'—'}</b></span></div></section>
      <aside className="order-ticket epic-panel" id="order-ticket"><div className="eyebrow">ORDER TICKET</div><h2>{selected.handle}</h2><div className="order-tabs"><button className={side==='buy'?'active':''} onClick={()=>setSide('buy')}>{t('purchase')}</button><button className={side==='sell'?'active':''} onClick={()=>setSide('sell')}>{t('sell')}</button></div><div className="order-quote"><span><small>{t('marketPrice')}</small><b>{number(selected.price)} C</b></span>{side==='sell'&&<span><small>{t('spread')}</small><b>-5%</b></span>}<span><small>{side==='sell'?t('saleValue'):t('orderCost')}</small><b>{number(tradeValue)} C</b></span></div><div className="order-balance"><p><span>{t('available')}</span><b>{number(accountPortfolio.balance)} C</b></p><p><span>{t('afterOrder')}</span><b className={balanceAfter<0?'negative':''}>{number(balanceAfter)} C</b></p>{position&&<p><span>{t('boughtAt')}</span><b>{number(position.acquiredPrice)} C</b></p>}</div>{side==='sell'&&!position&&<p className="notice">{t('noPosition')}</p>}{side==='buy'&&position&&<p className="notice">{t('oneCardLimit')}</p>}<button className={`epic-button order-submit ${side}`} disabled={pending||marketStale||side==='buy'&&(!!position||accountPortfolio.balance<tradeValue)||side==='sell'&&!position} onClick={executeTrade}>{pending?t('wait'):`${side==='buy'?t('purchase'):t('sell')} ${selected.handle} · ${number(tradeValue)} C`}</button><small className="order-disclaimer">{t('serverPriceNotice')}</small></aside></div>}

    <div className="trading-lower"><section className="epic-panel positions-panel"><div className="section-heading"><div><div className="eyebrow">HOLDINGS</div><h2>{t('portfolio')}</h2></div><span>{accountPortfolio.positions.length} {t('positions')}</span></div>{accountPortfolio.positions.length?<div className="positions-table"><div className="positions-head"><span>{t('player')}</span><span>{t('value')}</span><span>{t('averageCost')}</span><span>24H</span><span>P&amp;L</span><span/></div>{accountPortfolio.positions.map(held=>{const player=players.find(item=>item.id===held.playerId);return <div key={held.playerId}><button className="position-asset" onClick={()=>player&&setSelectedId(player.id)}><strong>{held.handle}</strong><small>{player?.team||'PRO'}</small></button><b>{number(held.currentPrice)} C</b><span>{number(held.acquiredPrice)} C</span><span className={(held.dailyChange||0)>=0?'positive':'negative'}>{(held.dailyChange||0)>=0?'+':''}{number(held.dailyChange||0)}</span><span className={held.pnl>=0?'positive':'negative'}>{held.pnl>=0?'+':''}{number(held.pnl)} C<br/><small>{percent(held.pnl,held.acquiredPrice).toFixed(1)}%</small></span><button className="sell-now" onClick={()=>player&&selectForTrade(player,'sell')}>{t('sell')}</button></div>})}</div>:<p className="notice">{t('emptyPortfolio')}</p>}</section>
      <aside className="epic-panel allocation-panel"><div className="eyebrow">ALLOCATION</div><h2>{t('allocation')}</h2>{accountPortfolio.positions.slice(0,8).map(held=><div key={held.playerId}><span><b>{held.handle}</b><small>{percent(held.currentPrice,accountPortfolio.holdingsValue).toFixed(1)}%</small></span><i><em style={{width:`${percent(held.currentPrice,accountPortfolio.holdingsValue)}%`}}/></i></div>)}{!accountPortfolio.positions.length&&<p>—</p>}<hr/><div className="pnl-breakdown"><p><span>{t('realizedPnl')}</span><b className={accountPortfolio.realizedPnl>=0?'positive':'negative'}>{accountPortfolio.realizedPnl>=0?'+':''}{number(accountPortfolio.realizedPnl)} C</b></p><p><span>{t('unrealizedPnl')}</span><b className={accountPortfolio.unrealizedPnl>=0?'positive':'negative'}>{accountPortfolio.unrealizedPnl>=0?'+':''}{number(accountPortfolio.unrealizedPnl)} C</b></p></div></aside></div>

    <div className="trading-lower market-section"><section className="exchange-list epic-panel"><div className="market-toolbar advanced"><label className="search-box"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('searchPlayers')}/></label><div className="filter-tabs"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>{t('all')}</button><button className={filter==='watchlist'?'active':''} onClick={()=>setFilter('watchlist')}>★ {t('watchlist')}</button><button className={filter==='portfolio'?'active':''} onClick={()=>setFilter('portfolio')}>{t('portfolio')}</button></div><label>{t('sort')}<select value={sort} onChange={event=>setSort(event.target.value as Sort)}><option value="change">{t('movement')}</option><option value="price">{t('price')}</option><option value="name">A–Z</option></select></label></div><div className="trade-table"><div className="trade-head"><span>{t('player')}</span><span>{t('price')}</span><span>MOVE</span><span>{t('position')}</span></div>{market.map(player=>{const held=positions.get(player.id);return <button className={selected?.id===player.id?'selected':''} key={player.id} onClick={()=>setSelectedId(player.id)}><span><i className={`rarity-dot ${player.rarity}`}/><strong>{player.handle}</strong><small>{player.team||'PRO'}</small></span><b>{number(player.price)} C</b><em className={(player.priceChange||0)>=0?'positive':'negative'}>{(player.priceChange||0)>=0?'+':''}{number(player.priceChange||0)}</em><span>{held?`${held.pnl>=0?'+':''}${number(held.pnl)} C`:'—'}</span></button>})}</div></section>
      <aside className="epic-panel activity-panel"><div className="eyebrow">ACTIVITY</div><h2>{t('recentTrades')}</h2>{trades.length?trades.map(trade=><div key={trade.id}><span><b>{trade.type==='trade_buy'?t('purchase'):t('sell')} · {String(trade.metadata?.handle||'Player')}</b><small>{new Date(trade.created_at).toLocaleString(locale)}</small></span><strong className={trade.amount>=0?'positive':'negative'}>{trade.amount>0?'+':''}{number(trade.amount)} C</strong></div>):<p className="notice">{t('noTrades')}</p>}<Link href="/wallet" className="epic-button secondary">{t('allTransactions')}</Link></aside></div>
  </main></div>;
}
