"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/context/LocaleContext';
import { locales, type Locale } from '@/lib/i18n';
import { marketingPath } from '@/lib/marketing';
import { useSignedInHint } from '@/lib/session-hint';

const labels: Record<Locale, { nav:string; how:string; players:string; events:string; ranking:string; login:string; signup:string; account:string }> = {
  en:{nav:'Public navigation',how:'How it works',players:'Players',events:'Tournaments',ranking:'Leaderboard',login:'Sign in',signup:'Create account',account:'Open game'},
  it:{nav:'Navigazione pubblica',how:'Come funziona',players:'Player',events:'Tornei',ranking:'Classifica',login:'Accedi',signup:'Crea account',account:'Apri il gioco'},
  es:{nav:'Navegación pública',how:'Cómo funciona',players:'Jugadores',events:'Torneos',ranking:'Clasificación',login:'Entrar',signup:'Crear cuenta',account:'Abrir juego'},
  de:{nav:'Öffentliche Navigation',how:'So funktioniert es',players:'Spieler',events:'Turniere',ranking:'Rangliste',login:'Anmelden',signup:'Konto erstellen',account:'Spiel öffnen'},
  fr:{nav:'Navigation publique',how:'Fonctionnement',players:'Joueurs',events:'Tournois',ranking:'Classement',login:'Connexion',signup:'Créer un compte',account:'Ouvrir le jeu'},
};

export default function MarketingHeader({ locale }: { locale: Locale }) {
  const text = labels[locale];
  const signedIn = useSignedInHint();
  const { setLocale } = useLocale();
  // Only home and how-it-works exist in every language; other pages switch to the localized home.
  const localizedPath = usePathname().replace(/^\/(?:it|es|de|fr)(?=\/|$)/, '') === '/how-it-works' ? '/how-it-works' : '';
  return <header className="marketing-header">
    <Link href={marketingPath(locale)} className="logo"><span>FANTA</span>FORT</Link>
    <nav aria-label={text.nav}>
      <Link href={marketingPath(locale, '/how-it-works')}>{text.how}</Link>
      <Link href="/players">{text.players}</Link>
      {signedIn && <Link href="/tournaments">{text.events}</Link>}
      <Link href="/leaderboard">{text.ranking}</Link>
    </nav>
    <div className="marketing-languages" aria-label="Language">{locales.map(item=><Link href={marketingPath(item, localizedPath)} onClick={()=>setLocale(item)} hrefLang={item} lang={item} key={item} aria-current={item===locale?'page':undefined}>{item.toUpperCase()}</Link>)}</div>
    {signedIn
      ? <Link href="/dashboard" className="epic-button">{text.account}</Link>
      : <div className="marketing-auth-actions"><Link href="/auth">{text.login}</Link><Link href="/auth?mode=signup" className="epic-button">{text.signup}</Link></div>}
  </header>;
}
