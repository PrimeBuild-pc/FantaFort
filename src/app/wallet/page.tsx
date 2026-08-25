/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';

type Transaction = { id:number; amount:number; balance_after:number; type:string; reference_id:string|null; metadata:Record<string,unknown>; created_at:string };
type Friend = { id:string; username:string; pending:boolean };

export default function WalletPage() {
  const { accountPortfolio, userId, loading, refresh } = useGame();
  const { locale, t } = useLocale();
  const [transactions,setTransactions]=useState<Transaction[]>([]);
  const [historyPage,setHistoryPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [friends,setFriends]=useState<Friend[]>([]);
  const [friendId,setFriendId]=useState('');
  const [amount,setAmount]=useState(100);
  const [message,setMessage]=useState('');
  const [pending,setPending]=useState(false);
  const number=(value:number)=>new Intl.NumberFormat(locale).format(value);
  const rescueExplanation = accountPortfolio.rescueReason === 'wealth'
    ? `${t('rescueWealth')} ${number(accountPortfolio.totalEquity)} C.`
    : accountPortfolio.rescueReason === 'account_age' ? t('rescueAge')
    : accountPortfolio.rescueReason === 'cooldown' ? `${t('rescueCooldown')} ${accountPortfolio.nextRescueAt ? new Date(accountPortfolio.nextRescueAt).toLocaleString(locale) : ''}`
    : t('dailyRescueRules');
  const load=useCallback(async()=>{
    if(!supabase||!userId)return;
    const [history,friendRows]=await Promise.all([supabase.rpc('get_wallet_history',{page_index:0}),supabase.rpc('get_friends')]);
    if(history.error)setMessage(history.error.message); else { setTransactions((history.data||[]) as Transaction[]); setHistoryPage(0); setHasMore((history.data||[]).length===50); }
    const accepted=(friendRows.data||[]).filter((friend:Friend)=>!friend.pending) as Friend[];
    setFriends(accepted); setFriendId(value=>value||accepted[0]?.id||'');
  },[userId]);
  useEffect(()=>{load();},[load]);
  const loadMore=async()=>{if(!supabase)return;const next=historyPage+1;const {data,error}=await supabase.rpc('get_wallet_history',{page_index:next});if(error)return setMessage(error.message);setTransactions(value=>[...value,...((data||[]) as Transaction[])]);setHistoryPage(next);setHasMore((data||[]).length===50);};
  const claim=async()=>{if(!supabase)return;setPending(true);setMessage('');const {data,error}=await supabase.rpc('claim_daily_rescue',{request_id:crypto.randomUUID()});setMessage(error?.message||(data?`+${data} C`:'✓'));if(!error)await Promise.all([refresh(),load()]);setPending(false);};
  const gift=async(event:FormEvent)=>{event.preventDefault();if(!supabase||!friendId||!window.confirm(`${t('confirmGift')} ${amount} C?`))return;setPending(true);setMessage('');const {error}=await supabase.rpc('gift_coins',{friend_id:friendId,amount,request_id:crypto.randomUUID()});setMessage(error?.message||'✓');if(!error)await Promise.all([refresh(),load()]);setPending(false);};
  const label=(type:string)=>t(({
    initial_grant:'initialGrant',migration:'migratedBalance',trade_buy:'tradeBuy',trade_sell:'tradeSell',daily_rescue:'dailyRescue',gift_sent:'giftSent',gift_received:'giftReceived',league_lock:'leagueLock',league_refund:'leagueRefund',league_prize:'leaguePrize',league_loss:'leagueLoss',cosmetic_purchase:'cosmeticPurchase'
  }[type]||'transaction') as 'transaction');

  if(loading)return <div className="app-shell"><Header/><main className="container page-content"><p className="notice">{t('loading')}</p></main></div>;
  if(!userId)return <div className="app-shell"><Header/><main className="container page-content"><div className="empty-state"><h2>{t('signIn')}</h2><Link href="/auth" className="epic-button">{t('login')}</Link></div></main></div>;
  return <div className="app-shell"><Header/><main className="container page-content"><div className="page-title"><div className="eyebrow">ACCOUNT ECONOMY</div><h1>{t('wallet')}</h1><p>{t('virtualCoinsNotice')}</p><p className="form-hint"><Link href="/shop">{t('shop')} →</Link></p></div>
    {message&&<p className="notice" role="status">{message}</p>}
    <section className="portfolio-strip wallet-summary"><div><small>{t('available')}</small><b>{number(accountPortfolio.balance)} C</b></div><div><small>{t('locked')}</small><b>{number(accountPortfolio.lockedBalance)} C</b></div><div><small>{t('portfolio')}</small><b>{number(accountPortfolio.holdingsValue)} C</b></div><div><small>{t('totalEquity')}</small><b>{number(accountPortfolio.totalEquity)} C</b></div><Link href="/trading" className="epic-button">{t('trading')}</Link></section>
    <div className="wallet-grid"><section className="epic-panel"><div className="eyebrow">COMEBACK</div><h2>{t('dailyRescue')}</h2><p>{rescueExplanation}</p><button className="epic-button" disabled={pending||!accountPortfolio.rescueAvailable} onClick={claim}>{t('claim100')}</button></section>
      <section className="epic-panel"><div className="eyebrow">FRIENDS</div><h2>{t('giftCoins')}</h2><p>{t('giftRules')}</p>{friends.length?<form onSubmit={gift}><label>{t('friend')}<select value={friendId} onChange={event=>setFriendId(event.target.value)}>{friends.map(friend=><option value={friend.id} key={friend.id}>{friend.username}</option>)}</select></label><label>{t('amount')}<input type="number" min="10" max="300" step="10" value={amount} onChange={event=>setAmount(Number(event.target.value))}/></label><button className="epic-button" disabled={pending}>{t('sendGift')}</button></form>:<p className="notice">{t('addFriendFirst')}</p>}</section>
    </div>
    <section className="epic-panel transaction-panel"><div className="section-heading"><div><div className="eyebrow">LEDGER</div><h2>{t('transactions')}</h2></div></div><div className="transaction-list">{transactions.map(transaction=><article key={transaction.id}><div><strong>{label(transaction.type)}</strong><small>{transaction.type==='migration'?t('previousWallet'):transaction.metadata?.handle?String(transaction.metadata.handle):transaction.reference_id||'FantaFort'} · {new Date(transaction.created_at).toLocaleString(locale)}</small></div><b className={transaction.type==='migration'?'':transaction.amount>=0?'positive':'negative'}>{transaction.type==='migration'?'':transaction.amount>0?'+':''}{number(transaction.amount)} C</b><span>{number(transaction.balance_after)} C</span></article>)}</div>{hasMore&&<button className="epic-button secondary" onClick={loadMore}>{t('loadMore')}</button>}</section>
  </main></div>;
}
