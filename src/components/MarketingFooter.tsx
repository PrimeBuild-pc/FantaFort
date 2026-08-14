import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { communityCopy, DISCORD_URL } from '@/lib/community';
import { marketingPath } from '@/lib/marketing';
import { EPIC_FAN_DISCLAIMER } from '@/lib/legal';

const copy = {
  en:{info:'About FantaFort',method:'Data methodology',cookies:'Cookie notice',credits:'Credits',note:'Independent fantasy experience. Not endorsed by Epic Games.'},
  it:{info:'Informazioni su FantaFort',method:'Metodo dati',cookies:'Informativa cookie',credits:'Crediti',note:'Esperienza fantasy indipendente. Non approvata da Epic Games.'},
  es:{info:'Acerca de FantaFort',method:'Metodología de datos',cookies:'Aviso de cookies',credits:'Créditos',note:'Experiencia independiente. No respaldada por Epic Games.'},
  de:{info:'Über FantaFort',method:'Datenmethodik',cookies:'Cookie-Hinweis',credits:'Bildnachweis',note:'Unabhängiges Fantasy-Erlebnis. Nicht von Epic Games unterstützt.'},
  fr:{info:'À propos de FantaFort',method:'Méthodologie des données',cookies:'Avis cookies',credits:'Crédits',note:'Expérience indépendante. Non approuvée par Epic Games.'},
} satisfies Record<Locale, {info:string;method:string;cookies:string;credits:string;note:string}>;

export default function MarketingFooter({ locale }: { locale: Locale }) {
  const text=copy[locale];
  return <footer className="marketing-footer"><div><Link href={marketingPath(locale)} className="logo"><span>FANTA</span>FORT</Link><p>{text.note}</p><p>{EPIC_FAN_DISCLAIMER}</p></div><nav aria-label="Legal"><Link href="/about">{text.info}</Link><Link href="/methodology">{text.method}</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">{text.cookies}</Link><Link href="/credits">{text.credits}</Link><Link href="/support">Support</Link><a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a></nav><small>© 2026 FantaFort · All rights reserved · <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">{communityCopy[locale].discord}</a></small></footer>;
}
