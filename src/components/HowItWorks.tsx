import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import MarketingFooter from './MarketingFooter';
import MarketingHeader from './MarketingHeader';

type Copy={title:string;intro:string;sections:{title:string;body:string;items?:string[]}[];cta:string};
const copy:Record<Locale,Copy>={
  en:{title:'How FantaFort works',intro:'Build a roster of competitive Fortnite players, manage a virtual budget and challenge friends using real FNCS results.',sections:[
    {title:'1. Create or join a private league',body:'A league is a private competition shared through an invite code. Its owner chooses the starting budget, roster size, market duration, league duration and scoring mode. Players are exclusive inside that league, so two managers cannot recruit the same pro.'},
    {title:'2. Draft your roster before the event',body:'Search the eligible player market and recruit the roster you believe will perform best. Prices use recent competitive form. Scores count only for tournaments starting after acquisition, preventing retroactive points. The market closes according to the league settings.'},
    {title:'3. Choose a transparent scoring mode',body:'Fortnite leaderboard points and eliminations are reported for the official team. FantaFort offers three ways to use those results:',items:['Classic: every selected player receives the full official team score.','Balanced: the score is divided by the official team size.','Formation: each official formation counts once for a manager, avoiding duplicate team points.']},
    {title:'4. Use your remaining budget strategically',body:'Before an event starts, a complete roster may invest remaining league coins in a captain, teammate prediction or exact-score prediction. Picks lock at event start. The captain adds 10%; other rewards are deliberately capped.'},
    {title:'5. Follow live standings',body:'Tournament data syncs from Osirion about every 15 minutes and league dashboards refresh about every 30 seconds. You can inspect official points, projections, synergy, predictions and verified rulings. Provider corrections may change a result after publication.'},
    {title:'Sandbox rules',body:'All coins are virtual and have no monetary value. FantaFort does not process real payments, betting or cash-out. It is an independent entertainment product and is not affiliated with or endorsed by Epic Games.'}],cta:'Create your first league'},
  it:{title:'Come funziona FantaFort',intro:'Crea una rosa di player competitivi di Fortnite, gestisci un budget virtuale e sfida gli amici usando risultati FNCS reali.',sections:[
    {title:'1. Crea o entra in una lega privata',body:'Una lega è una competizione privata condivisa tramite codice invito. Il proprietario sceglie budget iniziale, posti in rosa, durata del mercato, durata della lega e modalità di punteggio. I player sono esclusivi nella lega: due manager non possono acquistare lo stesso pro.'},
    {title:'2. Componi la rosa prima dell’evento',body:'Cerca nel mercato dei player idonei e acquista la formazione che ritieni più competitiva. I prezzi riflettono la forma recente. Contano soltanto i tornei iniziati dopo l’acquisto, così nessuno riceve punti retroattivi.'},
    {title:'3. Scegli un punteggio trasparente',body:'Fortnite pubblica punti ed eliminazioni della formazione ufficiale. FantaFort offre tre modalità:',items:['Classica: ogni player selezionato riceve tutti i punti ufficiali del team.','Bilanciata: i punti vengono divisi per il numero di componenti ufficiali.','Formazioni: ogni formazione ufficiale conta una sola volta per manager.']},
    {title:'4. Investi il budget residuo',body:'Prima dell’evento una rosa completa può scegliere capitano, previsione del compagno o pronostico del punteggio. Le scelte si bloccano alla partenza. Il capitano aggiunge il 10%; gli altri premi sono limitati.'},
    {title:'5. Segui la classifica live',body:'I dati si sincronizzano da Osirion circa ogni 15 minuti e la dashboard della lega si aggiorna circa ogni 30 secondi. Puoi distinguere punti ufficiali, proiezioni, intesa, pronostici e provvedimenti verificati.'},
    {title:'Regole sandbox',body:'Tutti i coin sono virtuali e senza valore economico. FantaFort non gestisce pagamenti reali, scommesse o cash-out. È un prodotto indipendente e non è affiliato né approvato da Epic Games.'}],cta:'Crea la prima lega'},
  es:{title:'Cómo funciona FantaFort',intro:'Crea una plantilla de jugadores competitivos, administra un presupuesto virtual y compite con resultados FNCS reales.',sections:[
    {title:'1. Crea o únete a una liga privada',body:'El propietario configura presupuesto, plantilla, mercado, duración y puntuación. Los jugadores son exclusivos dentro de cada liga.'},
    {title:'2. Ficha antes del evento',body:'Elige jugadores elegibles según su forma competitiva reciente. Solo cuentan torneos que empiezan después del fichaje; no existen puntos retroactivos.'},
    {title:'3. Elige una puntuación transparente',body:'Fortnite publica puntos y eliminaciones del equipo oficial.',items:['Clásico: cada jugador recibe todos los puntos del equipo.','Equilibrado: los puntos se dividen por el tamaño del equipo.','Formaciones: cada formación oficial cuenta una sola vez.']},
    {title:'4. Usa el presupuesto restante',body:'Antes del evento puedes elegir capitán y pronósticos. Todo queda bloqueado al inicio y las recompensas están limitadas.'},
    {title:'5. Sigue la clasificación',body:'Osirion se sincroniza aproximadamente cada 15 minutos. La clasificación separa puntos, proyección, sinergia y pronósticos.'},
    {title:'Reglas sandbox',body:'Las monedas son virtuales y no tienen valor. No hay pagos, apuestas ni retirada. FantaFort no está afiliado a Epic Games.'}],cta:'Crear mi primera liga'},
  de:{title:'So funktioniert FantaFort',intro:'Stelle einen Kader aus Fortnite-Profis zusammen und tritt mit echten FNCS-Ergebnissen gegen Freunde an.',sections:[
    {title:'1. Private Liga erstellen',body:'Der Eigentümer legt Budget, Kadergröße, Marktzeit, Dauer und Wertung fest. Spieler sind innerhalb der Liga exklusiv.'},
    {title:'2. Vor dem Event draften',body:'Wähle berechtigte Spieler anhand ihrer aktuellen Wettkampfform. Nur Turniere nach dem Kauf zählen; rückwirkende Punkte gibt es nicht.'},
    {title:'3. Transparente Wertung wählen',body:'Fortnite meldet Punkte und Eliminierungen des offiziellen Teams.',items:['Klassisch: jeder Spieler erhält die vollen Teampunkte.','Ausgeglichen: Punkte werden durch die Teamgröße geteilt.','Formationen: jede offizielle Formation zählt einmal.']},
    {title:'4. Restbudget einsetzen',body:'Vor Eventbeginn kannst du Kapitän und Prognosen wählen. Danach sind alle Tipps gesperrt und Boni begrenzt.'},
    {title:'5. Live-Tabelle verfolgen',body:'Osirion-Daten werden etwa alle 15 Minuten synchronisiert. Die Tabelle zeigt Punkte, Prognose, Synergie und Tipps getrennt.'},
    {title:'Sandbox-Regeln',body:'Coins sind virtuell und wertlos. Es gibt keine Zahlungen, Wetten oder Auszahlung. FantaFort ist nicht mit Epic Games verbunden.'}],cta:'Erste Liga erstellen'},
  fr:{title:'Comment fonctionne FantaFort',intro:'Composez une équipe de joueurs Fortnite et défiez vos amis avec de vrais résultats FNCS.',sections:[
    {title:'1. Créez une ligue privée',body:'Le propriétaire règle budget, équipe, marché, durée et score. Les joueurs sont exclusifs dans chaque ligue.'},
    {title:'2. Recrutez avant l’événement',body:'Choisissez les joueurs selon leur forme compétitive récente. Seuls les tournois commençant après le recrutement comptent.'},
    {title:'3. Choisissez un score transparent',body:'Fortnite publie les points et éliminations de l’équipe officielle.',items:['Classique : chaque joueur reçoit tous les points de l’équipe.','Équilibré : les points sont divisés par la taille de l’équipe.','Formations : chaque formation officielle compte une fois.']},
    {title:'4. Investissez le budget restant',body:'Avant l’événement, choisissez capitaine et pronostics. Les choix sont verrouillés au départ et les bonus plafonnés.'},
    {title:'5. Suivez le classement',body:'Les données Osirion sont synchronisées environ toutes les 15 minutes. Points, projection, synergie et pronostics restent distincts.'},
    {title:'Règles sandbox',body:'Les coins sont virtuels et sans valeur. Aucun paiement, pari ou retrait. FantaFort n’est pas affilié à Epic Games.'}],cta:'Créer ma première ligue'}
};

export function howCopy(locale:Locale){return copy[locale]}

export default function HowItWorks({locale}:{locale:Locale}){
  const text=copy[locale];
  return <div className="marketing-shell" lang={locale}><MarketingHeader locale={locale}/><main className="marketing-article"><header><div className="eyebrow">FANTAFORT GUIDE</div><h1>{text.title}</h1><p>{text.intro}</p></header>{text.sections.map(section=><section key={section.title}><h2>{section.title}</h2><p>{section.body}</p>{section.items&&<ul>{section.items.map(item=><li key={item}>{item}</li>)}</ul>}</section>)}<div className="marketing-cta"><h2>{text.cta}</h2><Link className="epic-button huge" href="/auth">{text.cta}</Link></div></main><MarketingFooter locale={locale}/></div>
}
