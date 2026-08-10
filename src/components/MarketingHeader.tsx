"use client";

import Link from 'next/link';
import { useGame } from '@/context/GameContext';
import { locales, type Locale } from '@/lib/i18n';
import { marketingPath } from '@/lib/marketing';

const labels: Record<Locale, { nav:string; how:string; players:string; events:string; ranking:string; login:string; signup:string; account:string }> = {
  en:{nav:'Public navigation',how:'How it works',players:'Players',events:'Tournaments',ranking:'Leaderboard',login:'Sign in',signup:'Create account',account:'Open game'},
  it:{nav:'Navigazione pubblica',how:'Come funziona',players:'Player',events:'Tornei',ranking:'Classifica',login:'Accedi',signup:'Crea account',account:'Apri il gioco'},
  es:{nav:'Navegación pública',how:'Cómo funciona',players:'Jugadores',events:'Torneos',ranking:'Clasificación',login:'Entrar',signup:'Crear cuenta',account:'Abrir juego'},
  de:{nav:'Öffentliche Navigation',how:'So funktioniert es',players:'Spieler',events:'Turniere',ranking:'Rangliste',login:'Anmelden',signup:'Konto erstellen',account:'Spiel öffnen'},
  fr:{nav:'Navigation publique',how:'Fonctionnement',players:'Joueurs',events:'Tournois',ranking:'Classement',login:'Connexion',signup:'Créer un compte',account:'Ouvrir le jeu'},
};

export default function MarketingHeader({ locale }: { locale: Locale }) {
  const text = labels[locale];
  const { loading, userId, profile } = useGame();
  return <header className="marketing-header">
    <Link href={marketingPath(locale)} className="logo"><span>FANTA</span>FORT</Link>
    <nav aria-label={text.nav}>
      <Link href={marketingPath(locale, '/how-it-works')}>{text.how}</Link>
      <Link href="/players">{text.players}</Link>
      <Link href="/tournaments">{text.events}</Link>
      <Link href="/leaderboard">{text.ranking}</Link>
    </nav>
    <div className="marketing-languages" aria-label="Language">{locales.map(item=><Link href={marketingPath(item)} hrefLang={item} lang={item} key={item} aria-current={item===locale?'page':undefined}>{item.toUpperCase()}</Link>)}</div>
    {loading ? <span className="epic-button" aria-hidden="true">…</span> : userId
      ? <Link href="/dashboard" className="epic-button">{profile?.username||text.account}</Link>
      : <div className="marketing-auth-actions"><Link href="/auth">{text.login}</Link><Link href="/auth?mode=signup" className="epic-button">{text.signup}</Link></div>}
  </header>;
}
