/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/context/LocaleContext';
import { Locale } from '@/lib/i18n';

const COOKIE = 'fantafort_cookie_notice';
const copy: Record<Locale, { title: string; body: string; details: string; accept: string }> = {
  en: { title:'Essential storage only', body:'FantaFort uses essential browser storage for login, language, league and guide preferences. No advertising or analytics cookies are used.', details:'Cookie details', accept:'Understood' },
  it: { title:'Solo dati tecnici essenziali', body:'FantaFort usa dati del browser indispensabili per accesso, lingua, lega e preferenze della guida. Non usa cookie pubblicitari o analitici.', details:'Dettagli cookie', accept:'Ho capito' },
  es: { title:'Solo almacenamiento esencial', body:'FantaFort usa datos esenciales para acceso, idioma, liga y guía. No utiliza cookies publicitarias ni analíticas.', details:'Detalles', accept:'Entendido' },
  de: { title:'Nur notwendige Speicherung', body:'FantaFort speichert nur notwendige Daten für Anmeldung, Sprache, Liga und Anleitung. Keine Werbe- oder Analyse-Cookies.', details:'Cookie-Details', accept:'Verstanden' },
  fr: { title:'Stockage essentiel uniquement', body:'FantaFort utilise uniquement les données nécessaires à la connexion, langue, ligue et guide. Aucun cookie publicitaire ou analytique.', details:'Détails', accept:'Compris' },
};

export default function CookieNotice() {
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(!document.cookie.split('; ').some(value => value.startsWith(`${COOKIE}=`))), []);
  if (!visible) return null;
  const acknowledge = () => {
    document.cookie = `${COOKIE}=1; Max-Age=15552000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setVisible(false);
  };
  return <aside className="cookie-notice" aria-label={copy[locale].title}><div><strong>{copy[locale].title}</strong><p>{copy[locale].body}</p></div><Link href="/cookies">{copy[locale].details}</Link><button className="epic-button" onClick={acknowledge}>{copy[locale].accept}</button></aside>;
}
