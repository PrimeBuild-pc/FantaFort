/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useEffect, useState } from 'react';
import BadgeList from '@/components/BadgeList';
import Emblem from '@/components/Emblem';
import Header from '@/components/Header';
import LegalFooter from '@/components/LegalFooter';
import LineupDrawer from '@/components/LineupDrawer';
import { useLocale } from '@/context/LocaleContext';
import type { Locale } from '@/lib/i18n';
import { lineupCopy } from '@/lib/lineup';
import { supabase } from '@/lib/supabase';
import type { PublicBadge, PublicLineup } from '@/lib/types';

type Ranking = { rank:number; username:string; name_style:string; avatar_style:string; net_worth:number; badges:PublicBadge[]; public_lineup:boolean; is_current_user:boolean };
const copy:Record<Locale,{eyebrow:string;title:string;intro:string;rank:string;manager:string;worth:string;search:string;searchAction:string;yourRank:string;empty:string;error:string;noMatch:string;signInToView:string}> = {
  en:{eyebrow:'GLOBAL HALL OF FAME',title:'Global leaderboard',intro:'Account coins plus the current market value of every player in the portfolio.',rank:'Rank',manager:'Manager',worth:'Net worth',search:'Search nickname',searchAction:'Search',yourRank:'Your position',empty:'The ranking is not available yet.',error:'The global leaderboard is temporarily unavailable.',noMatch:'No eligible manager found.',signInToView:'Sign in to view lineups.'},
  it:{eyebrow:'HALL OF FAME GLOBALE',title:'Classifica globale',intro:'Coin account più il valore di mercato corrente di tutti i player in portafoglio.',rank:'Posizione',manager:'Manager',worth:'Patrimonio',search:'Cerca nickname',searchAction:'Cerca',yourRank:'La tua posizione',empty:'La classifica non è ancora disponibile.',error:'La classifica globale è temporaneamente non disponibile.',noMatch:'Nessun manager idoneo trovato.',signInToView:'Accedi per vedere le formazioni.'},
  es:{eyebrow:'HALL OF FAME GLOBAL',title:'Clasificación global',intro:'Monedas de la cuenta más el valor actual de mercado de todos los jugadores de la cartera.',rank:'Posición',manager:'Manager',worth:'Patrimonio',search:'Buscar usuario',searchAction:'Buscar',yourRank:'Tu posición',empty:'La clasificación aún no está disponible.',error:'La clasificación global no está disponible temporalmente.',noMatch:'No se encontró ningún manager válido.',signInToView:'Inicia sesión para ver las alineaciones.'},
  de:{eyebrow:'GLOBALE HALL OF FAME',title:'Globale Rangliste',intro:'Konto-Coins plus aktueller Marktwert aller Spieler im Portfolio.',rank:'Rang',manager:'Manager',worth:'Vermögen',search:'Benutzername suchen',searchAction:'Suchen',yourRank:'Deine Position',empty:'Die Rangliste ist noch nicht verfügbar.',error:'Die globale Rangliste ist vorübergehend nicht verfügbar.',noMatch:'Kein berechtigter Manager gefunden.',signInToView:'Melde dich an, um Aufstellungen zu sehen.'},
  fr:{eyebrow:'HALL OF FAME MONDIAL',title:'Classement mondial',intro:'Coins du compte plus valeur de marché actuelle de tous les joueurs du portefeuille.',rank:'Rang',manager:'Manager',worth:'Patrimoine',search:'Rechercher un pseudo',searchAction:'Rechercher',yourRank:'Votre position',empty:'Le classement n’est pas encore disponible.',error:'Le classement mondial est temporairement indisponible.',noMatch:'Aucun manager éligible trouvé.',signInToView:'Connectez-vous pour voir les compositions.'},
};

const mapRows = (data:unknown) => ((data || []) as Ranking[]).map(row => ({ ...row, rank:Number(row.rank), net_worth:Number(row.net_worth), badges:row.badges || [] }));

export default function LeaderboardPage() {
  const { locale } = useLocale();
  const text = copy[locale];
  const [rows,setRows]=useState<Ranking[]>([]);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<Ranking[]|null>(null);
  const [loading,setLoading]=useState(true);
  const [searching,setSearching]=useState(false);
  const [error,setError]=useState('');
  const [openLineup,setOpenLineup]=useState<string>();
  const [lineup,setLineup]=useState<PublicLineup>();
  const [lineupError,setLineupError]=useState('');
  const lineupText=lineupCopy[locale];

  // Fetched on demand and dropped on close: no client cache can outlive a visibility change.
  const showLineup = async (username:string) => {
    setOpenLineup(username); setLineup(undefined); setLineupError('');
    if (!supabase) return setLineupError(lineupText.unavailable);
    const { data:session } = await supabase.auth.getSession();
    if (!session.session) return setLineupError(text.signInToView);
    const { data, error:failure } = await supabase.rpc('get_public_lineup', { target_username:username });
    if (failure || !data) return setLineupError(lineupText.unavailable);
    const value = data as PublicLineup;
    setLineup({ ...value, rank:Number(value.rank), netWorth:Number(value.netWorth), badges:value.badges || [], lineup:value.lineup || [] });
  };
  const closeLineup = () => { setOpenLineup(undefined); setLineup(undefined); setLineupError(''); };

  useEffect(() => {
    if (!supabase) { setError(text.error); setLoading(false); return; }
    supabase.rpc('get_global_leaderboard',{ search_username:null }).then(({data,error:failure}) => {
      if (failure) setError(text.error); else setRows(mapRows(data));
      setLoading(false);
    });
  }, [text.error]);

  const search = async (event:FormEvent) => {
    event.preventDefault();
    const value=query.trim();
    if (!value) { setResults(null); return; }
    if (!supabase) return setError(text.error);
    setSearching(true); setError('');
    const {data,error:failure}=await supabase.rpc('get_global_leaderboard',{search_username:value});
    setSearching(false);
    if (failure) setError(text.error); else setResults(mapRows(data));
  };

  const top=rows.filter(row=>row.rank<=50);
  const current=rows.find(row=>row.is_current_user);
  const format=(value:number)=>`${new Intl.NumberFormat(locale).format(value)} C`;

  return <div className="app-shell"><Header/><main className="container page-content global-leaderboard-page">
    <section className="leaderboard-hero"><div><div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1><p>{text.intro}</p></div><div className="leaderboard-rule"><small>{text.worth}</small><strong>COINS + PORTFOLIO</strong><span>TOP 50</span></div></section>
    <form className="leaderboard-search" onSubmit={search} role="search"><label htmlFor="leaderboard-search">{text.search}</label><div><input id="leaderboard-search" value={query} onChange={event=>setQuery(event.target.value)} minLength={1} maxLength={30}/><button className="epic-button" disabled={searching}>{searching?'…':text.searchAction}</button></div></form>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {results&&<section className="leaderboard-search-results" aria-live="polite"><h2>{text.search}</h2>{results.length?<div className="leaderboard-list">{results.map(row=><article key={row.username}><span className="rank">#{row.rank}</span><span className="leaderboard-manager"><Emblem username={row.username} style={row.avatar_style} className="leaderboard-emblem" /><span className="manager-text"><strong className={`name-${row.name_style}`}>{row.username}</strong><BadgeList badges={row.badges} compact/>{row.public_lineup?<button className="lineup-cta" onClick={()=>showLineup(row.username)}>{lineupText.view}</button>:<small className="lineup-private">{lineupText.private}</small>}</span></span><b>{format(row.net_worth)}</b></article>)}</div>:<p className="empty-state compact">{text.noMatch}</p>}</section>}
    {current&&current.rank>50&&<aside className="your-global-rank"><span>{text.yourRank}</span><strong>#{current.rank}</strong><b>{format(current.net_worth)}</b></aside>}
    {loading?<div className="leaderboard-skeleton" aria-label={text.empty}>{Array.from({length:8},(_,index)=><i key={index}/>)}</div>:top.length?<section aria-label={text.title}><div className="leaderboard-head"><span>{text.rank}</span><span>{text.manager}</span><span>{text.worth}</span></div><div className="leaderboard-list">{top.map(row=><article className={row.rank<=3?`podium rank-${row.rank}`:''} key={row.username}><span className="rank">#{row.rank}</span><span className="leaderboard-manager"><Emblem username={row.username} style={row.avatar_style} className="leaderboard-emblem" /><span className="manager-text"><strong className={`name-${row.name_style}`}>{row.username}</strong><BadgeList badges={row.badges} compact/>{row.public_lineup?<button className="lineup-cta" onClick={()=>showLineup(row.username)}>{lineupText.view}</button>:<small className="lineup-private">{lineupText.private}</small>}</span></span><b>{format(row.net_worth)}</b></article>)}</div></section>:!error&&<p className="empty-state">{text.empty}</p>}
    {openLineup&&<LineupDrawer locale={locale} username={openLineup} lineup={lineup} error={lineupError} onClose={closeLineup}/>}
  </main><LegalFooter/></div>;
}
