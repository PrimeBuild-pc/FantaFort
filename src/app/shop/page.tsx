"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Emblem from '@/components/Emblem';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { cosmeticName, mapCosmetic, type Cosmetic, type CosmeticKind } from '@/lib/cosmetics';
import type { Locale } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

type Copy = {
  eyebrow:string; title:string; intro:string; balance:string; avatars:string; avatarsHelp:string;
  names:string; namesHelp:string; buy:string; equip:string; equipped:string; owned:string; reset:string;
  tooPoor:string; confirm:string; unavailable:string; standard:string; standardHelp:string;
};
const copy:Record<Locale,Copy> = {
  en:{eyebrow:'LOCKER',title:'Cosmetic shop',intro:'Spend in-game coins on how your account looks in the global leaderboard. Coins are virtual: they cannot be bought with money and cannot be cashed out.',balance:'Available coins',avatars:'Profile emblems',avatarsHelp:'Your initials on a themed plate, shown next to your nickname in the ranking.',names:'Nickname styles',namesHelp:'Colour and glow applied to your nickname everywhere it appears.',buy:'Buy',equip:'Equip',equipped:'Equipped',owned:'Owned',reset:'Back to standard',tooPoor:'Not enough coins',confirm:'Buy {name} for {price} coins?',unavailable:'The shop is temporarily unavailable.',standard:'Standard',standardHelp:'The default look, always available.'},
  it:{eyebrow:'ARMADIETTO',title:'Negozio cosmetici',intro:'Spendi le monete di gioco per decidere come appare il tuo account nella classifica globale. Le monete sono virtuali: non si comprano con denaro e non si possono incassare.',balance:'Monete disponibili',avatars:'Emblemi profilo',avatarsHelp:'Le tue iniziali su una placca a tema, mostrata accanto al nickname in classifica.',names:'Stili nickname',namesHelp:'Colore e bagliore applicati al nickname ovunque compaia.',buy:'Acquista',equip:'Equipaggia',equipped:'Equipaggiato',owned:'Posseduto',reset:'Torna allo standard',tooPoor:'Monete insufficienti',confirm:'Acquistare {name} per {price} monete?',unavailable:'Il negozio non è momentaneamente disponibile.',standard:'Standard',standardHelp:'L’aspetto predefinito, sempre disponibile.'},
  es:{eyebrow:'TAQUILLA',title:'Tienda de cosméticos',intro:'Gasta monedas del juego en el aspecto de tu cuenta en la clasificación global. Las monedas son virtuales: no se compran con dinero ni se pueden retirar.',balance:'Monedas disponibles',avatars:'Emblemas de perfil',avatarsHelp:'Tus iniciales sobre una placa temática, junto a tu nombre en la clasificación.',names:'Estilos de nombre',namesHelp:'Color y brillo aplicados a tu nombre allí donde aparezca.',buy:'Comprar',equip:'Equipar',equipped:'Equipado',owned:'En posesión',reset:'Volver al estándar',tooPoor:'Monedas insuficientes',confirm:'¿Comprar {name} por {price} monedas?',unavailable:'La tienda no está disponible temporalmente.',standard:'Estándar',standardHelp:'El aspecto por defecto, siempre disponible.'},
  de:{eyebrow:'SPIND',title:'Kosmetik-Shop',intro:'Gib Spielmünzen dafür aus, wie dein Konto in der globalen Rangliste aussieht. Münzen sind virtuell: nicht käuflich und nicht auszahlbar.',balance:'Verfügbare Münzen',avatars:'Profil-Embleme',avatarsHelp:'Deine Initialen auf einer Themenplatte, neben deinem Namen in der Rangliste.',names:'Namensstile',namesHelp:'Farbe und Leuchten für deinen Namen, überall wo er erscheint.',buy:'Kaufen',equip:'Ausrüsten',equipped:'Ausgerüstet',owned:'Im Besitz',reset:'Zurück zum Standard',tooPoor:'Nicht genug Münzen',confirm:'{name} für {price} Münzen kaufen?',unavailable:'Der Shop ist vorübergehend nicht verfügbar.',standard:'Standard',standardHelp:'Das Standardaussehen, immer verfügbar.'},
  fr:{eyebrow:'CASIER',title:'Boutique de cosmétiques',intro:'Dépensez des pièces de jeu pour l’apparence de votre compte dans le classement mondial. Les pièces sont virtuelles : ni achetables ni encaissables.',balance:'Pièces disponibles',avatars:'Emblèmes de profil',avatarsHelp:'Vos initiales sur une plaque thématique, à côté de votre pseudo au classement.',names:'Styles de pseudo',namesHelp:'Couleur et halo appliqués à votre pseudo partout où il apparaît.',buy:'Acheter',equip:'Équiper',equipped:'Équipé',owned:'Possédé',reset:'Revenir au standard',tooPoor:'Pièces insuffisantes',confirm:'Acheter {name} pour {price} pièces ?',unavailable:'La boutique est temporairement indisponible.',standard:'Standard',standardHelp:'L’apparence par défaut, toujours disponible.'},
};

export default function ShopPage() {
  const { profile, accountPortfolio, userId, loading, buyCosmetic, equipCosmetic } = useGame();
  const { locale, t } = useLocale();
  const text = copy[locale];
  const [catalog,setCatalog]=useState<Cosmetic[]>([]);
  const [owned,setOwned]=useState<Set<number>>(new Set());
  const [message,setMessage]=useState('');
  const [pending,setPending]=useState('');
  const number=(value:number)=>new Intl.NumberFormat(locale).format(value);

  const load=useCallback(async()=>{
    if(!supabase||!userId)return;
    const [items,mine]=await Promise.all([
      supabase.from('cosmetics').select('id,slug,kind,price,sort_order').eq('active',true).order('sort_order'),
      supabase.from('user_cosmetics').select('cosmetic_id'),
    ]);
    if(items.error)return setMessage(text.unavailable);
    setCatalog((items.data||[]).map(mapCosmetic));
    setOwned(new Set((mine.data||[]).map(row=>row.cosmetic_id as number)));
  },[text.unavailable,userId]);
  useEffect(()=>{load();},[load]);

  const buy=async(item:Cosmetic)=>{
    const name=cosmeticName(item.slug);
    if(!window.confirm(text.confirm.replace('{name}',name).replace('{price}',number(item.price))))return;
    setPending(item.slug); setMessage('');
    const error=await buyCosmetic(item.slug);
    setMessage(error||'✓'); setPending('');
    if(!error)await load();
  };
  const equip=async(kind:CosmeticKind,slug:string)=>{
    setPending(slug); setMessage('');
    const error=await equipCosmetic(kind,slug);
    setMessage(error||'✓'); setPending('');
  };

  const equippedFor=(kind:CosmeticKind)=>kind==='avatar'?(profile?.avatarStyle||'default'):(profile?.nameStyle||'default');
  const preview=(item:Cosmetic)=>item.kind==='avatar'
    ? <Emblem username={profile?.username||'PL'} style={item.slug} className="shop-emblem" />
    : <strong className={`shop-preview name-preview name-${item.slug}`}>{profile?.username||'Player'}</strong>;

  const section=(kind:CosmeticKind,title:string,help:string)=>{
    const items=catalog.filter(item=>item.kind===kind);
    const equipped=equippedFor(kind);
    return <section className="epic-panel shop-panel" key={kind}>
      <div className="eyebrow">{kind==='avatar'?'EMBLEM':'NAME'}</div><h2>{title}</h2><p>{help}</p>
      <div className="shop-grid">
        <article className={equipped==='default'?'shop-card equipped':'shop-card'}>
          {kind==='avatar'
            ? <Emblem username={profile?.username||'PL'} style="default" className="shop-emblem" />
            : <strong className="shop-preview name-preview name-default">{profile?.username||'Player'}</strong>}
          <b>{text.standard}</b><small>{text.standardHelp}</small>
          {equipped==='default'
            ? <span className="shop-tag">{text.equipped}</span>
            : <button className="epic-button secondary" disabled={!!pending} onClick={()=>equip(kind,'default')}>{text.reset}</button>}
        </article>
        {items.map(item=>{
          const isOwned=owned.has(item.id);
          const isEquipped=equipped===item.slug;
          const affordable=accountPortfolio.balance>=item.price;
          return <article className={isEquipped?'shop-card equipped':'shop-card'} key={item.slug}>
            {preview(item)}
            <b>{cosmeticName(item.slug)}</b>
            <small>{isOwned?text.owned:`${number(item.price)} C`}</small>
            {isEquipped
              ? <span className="shop-tag">{text.equipped}</span>
              : isOwned
                ? <button className="epic-button secondary" disabled={!!pending} onClick={()=>equip(item.kind,item.slug)}>{text.equip}</button>
                : <button className="epic-button" disabled={!!pending||!affordable} onClick={()=>buy(item)}>{affordable?text.buy:text.tooPoor}</button>}
          </article>;
        })}
      </div>
    </section>;
  };

  if(loading)return <div className="app-shell"><Header/><main className="container page-content"><p className="notice">{t('loading')}</p></main></div>;
  if(!userId)return <div className="app-shell"><Header/><main className="container page-content"><div className="empty-state"><h2>{t('signIn')}</h2><Link href="/auth" className="epic-button">{t('login')}</Link></div></main></div>;

  return <div className="app-shell"><Header/><main className="container page-content shop-page">
    <div className="page-title"><div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1><p>{text.intro}</p></div>
    {message&&<p className="notice" role="status">{message}</p>}
    <section className="portfolio-strip"><div><small>{text.balance}</small><b>{number(accountPortfolio.balance)} C</b></div><Link href="/wallet" className="epic-button secondary">{t('wallet')}</Link></section>
    {section('avatar',text.avatars,text.avatarsHelp)}
    {section('name_style',text.names,text.namesHelp)}
  </main></div>;
}
