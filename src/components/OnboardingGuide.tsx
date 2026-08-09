"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { Locale } from '@/lib/i18n';

export const GUIDE_EVENT = 'fantafort:open-guide';
const STORAGE_KEY = 'fantafort-guide-v1';

type Step = { eyebrow: string; title: string; body: string; where: string };
const copy: Record<Locale, { skip: string; back: string; next: string; start: string; guide: string; where: string; steps: Step[] }> = {
  en: { skip:'Skip guide', back:'Back', next:'Next', start:'Create or join a league', guide:'Open the complete guide', where:'Where to find it', steps:[
    {eyebrow:'STEP 1',title:'Create or join a league',body:'Start a private league or enter an invite code from a friend. League settings define the budget, roster and scoring.',where:'Leagues → Create league or invite code.'},
    {eyebrow:'STEP 2',title:'Draft your roster',body:'Recruit competitive Fortnite players with virtual coins before their tournament begins. Player cards show recent form and teammates.',where:'Market → choose a player. My squad → review your roster.'},
    {eyebrow:'STEP 3',title:'Follow the competition',body:'Real tournament results update points and standings. Late signings never receive retroactive points.',where:'League dashboard → live standings. Tournaments → match details.'},
  ]},
  it: { skip:'Salta guida', back:'Indietro', next:'Avanti', start:'Crea o entra in una lega', guide:'Apri la guida completa', where:'Dove trovarlo', steps:[
    {eyebrow:'PASSO 1',title:'Crea o entra in una lega',body:'Avvia una lega privata oppure inserisci il codice ricevuto da un amico. Le impostazioni definiscono budget, rosa e punteggio.',where:'Leghe → Crea lega oppure codice invito.'},
    {eyebrow:'PASSO 2',title:'Componi la tua rosa',body:'Acquista player competitivi con coin virtuali prima dell’inizio del torneo. Le carte mostrano forma recente e compagni.',where:'Mercato → scegli un player. La mia rosa → controlla gli acquisti.'},
    {eyebrow:'PASSO 3',title:'Segui la competizione',body:'I risultati reali aggiornano punti e classifica. Gli acquisti tardivi non ricevono mai punti retroattivi.',where:'Dashboard della lega → classifica live. Tornei → dettagli delle partite.'},
  ]},
  es: { skip:'Saltar guía', back:'Atrás', next:'Siguiente', start:'Crear o unirse a una liga', guide:'Abrir la guía completa', where:'Dónde encontrarlo', steps:[
    {eyebrow:'PASO 1',title:'Crea o únete a una liga',body:'Inicia una liga privada o introduce la invitación de un amigo. La configuración define presupuesto, plantilla y puntuación.',where:'Ligas → Crear liga o código de invitación.'},
    {eyebrow:'PASO 2',title:'Crea tu plantilla',body:'Ficha jugadores con monedas virtuales antes del torneo. Las cartas muestran forma reciente y compañeros.',where:'Mercado → elige un jugador. Mi plantilla → revisa tus fichajes.'},
    {eyebrow:'PASO 3',title:'Sigue la competición',body:'Los resultados reales actualizan puntos y clasificación. No hay puntos retroactivos.',where:'Panel de liga → clasificación. Torneos → detalles de partidas.'},
  ]},
  de: { skip:'Anleitung überspringen', back:'Zurück', next:'Weiter', start:'Liga erstellen oder beitreten', guide:'Vollständige Anleitung öffnen', where:'Hier findest du es', steps:[
    {eyebrow:'SCHRITT 1',title:'Liga erstellen oder beitreten',body:'Starte eine private Liga oder nutze den Einladungscode eines Freundes. Die Einstellungen bestimmen Budget, Kader und Wertung.',where:'Ligen → Erstellen oder Einladungscode.'},
    {eyebrow:'SCHRITT 2',title:'Kader zusammenstellen',body:'Verpflichte Profis vor Turnierbeginn mit virtuellen Coins. Spielerkarten zeigen Form und letzte Mitspieler.',where:'Markt → Spieler wählen. Mein Team → Kader prüfen.'},
    {eyebrow:'SCHRITT 3',title:'Wettbewerb verfolgen',body:'Echte Ergebnisse aktualisieren Punkte und Tabelle. Späte Transfers erhalten keine rückwirkenden Punkte.',where:'Liga-Dashboard → Tabelle. Turniere → Spieldetails.'},
  ]},
  fr: { skip:'Passer le guide', back:'Retour', next:'Suivant', start:'Créer ou rejoindre une ligue', guide:'Ouvrir le guide complet', where:'Où le trouver', steps:[
    {eyebrow:'ÉTAPE 1',title:'Créez ou rejoignez une ligue',body:'Lancez une ligue privée ou saisissez l’invitation d’un ami. Les réglages définissent budget, équipe et score.',where:'Ligues → Créer ou saisir un code.'},
    {eyebrow:'ÉTAPE 2',title:'Composez votre équipe',body:'Recrutez des joueurs avec des coins virtuels avant le tournoi. Les cartes montrent forme et coéquipiers récents.',where:'Marché → choisir un joueur. Mon équipe → vérifier la sélection.'},
    {eyebrow:'ÉTAPE 3',title:'Suivez la compétition',body:'Les vrais résultats actualisent points et classement. Aucun point rétroactif pour un recrutement tardif.',where:'Tableau de ligue → classement. Tournois → détails des parties.'},
  ]},
};

export function openGuide() {
  window.dispatchEvent(new Event(GUIDE_EVENT));
}

export default function OnboardingGuide() {
  const { locale } = useLocale();
  const { loading, userId } = useGame();
  const pathname = usePathname();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const text = copy[locale];

  useEffect(() => {
    const show = () => { setStep(0); setOpen(true); };
    window.addEventListener(GUIDE_EVENT, show);
    const storageKey = `${STORAGE_KEY}:${userId || 'guest'}`;
    if (!loading && pathname === '/dashboard' && !localStorage.getItem(storageKey)) show();
    return () => window.removeEventListener(GUIDE_EVENT, show);
  }, [loading, pathname, userId]);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  const finish = (goToLeague = false) => {
    localStorage.setItem(`${STORAGE_KEY}:${userId || 'guest'}`, 'completed');
    setOpen(false);
    if (goToLeague) router.push('/leagues');
  };
  const current = text.steps[step];
  const guideHref = locale === 'en' ? '/how-it-works' : `/${locale}/how-it-works`;

  return <dialog ref={dialog} className="onboarding-dialog" onCancel={() => setOpen(false)}>
    <div className="guide-progress" aria-label={`${step + 1} / ${text.steps.length}`}>{text.steps.map((_, index) => <i className={index <= step ? 'active' : ''} key={index} />)}</div>
    <button className="guide-skip" onClick={() => finish()}>{text.skip}</button>
    <div className="eyebrow">{current.eyebrow}</div><h2>{current.title}</h2><p>{current.body}</p>
    <aside><strong>{text.where}</strong><span>{current.where}</span></aside>
    <Link className="guide-full-link" href={guideHref} onClick={() => finish()}>{text.guide} →</Link>
    <div className="guide-actions"><button className="epic-button secondary" disabled={step === 0} onClick={() => setStep(value => value - 1)}>{text.back}</button>{step < text.steps.length - 1 ? <button className="epic-button" onClick={() => setStep(value => value + 1)}>{text.next}</button> : <button className="epic-button" onClick={() => finish(true)}>{text.start}</button>}</div>
  </dialog>;
}
