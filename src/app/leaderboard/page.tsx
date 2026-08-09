"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';

type Ranking = { user_id:string; username:string; name_style:string; points:number };
export default function LeaderboardPage() {
  const { activeLeagueId, leagues } = useGame(); const { t } = useLocale();
  const [ranking,setRanking]=useState<Ranking[]>([]); const [error,setError]=useState('');
  useEffect(()=>{if(!supabase||!activeLeagueId)return;supabase.rpc('get_league_dashboard',{target_league:activeLeagueId}).then(({data,error:e})=>{if(e)setError(e.message);else setRanking((data||[]).map((row:Ranking)=>({...row,points:Number(row.points)})));});},[activeLeagueId]);
  const league=leagues.find(item=>item.id===activeLeagueId);
  return <div className="app-shell"><Header/><main className="container page-content"><div className="page-title"><div className="eyebrow">HALL OF FAME</div><h1>{t('rankings')}</h1><p>{league?.name||t('selectLeague')}</p></div>{!activeLeagueId&&<div className="empty-state"><h2>{t('createLeague')}</h2><Link className="epic-button" href="/leagues">{t('leagues')}</Link></div>}{error&&<p className="notice error">{error}</p>}{ranking.length>0&&<div className="table-wrap narrow"><table><thead><tr><th>#</th><th>{t('manager')}</th><th>{t('points')}</th></tr></thead><tbody>{ranking.map((row,index)=><tr key={row.user_id}><td>{index+1}</td><td><strong className={`name-${row.name_style}`}>{row.username}</strong></td><td><strong>{row.points}</strong></td></tr>)}</tbody></table></div>}</main></div>;
}
