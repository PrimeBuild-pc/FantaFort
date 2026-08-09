"use client";

import Link from 'next/link';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { useLocale } from '@/context/LocaleContext';
import { Locale } from '@/lib/i18n';
import { EPIC_FAN_DISCLAIMER, SUPPORT_EMAIL } from '@/lib/legal';

type Copy={title:string;intro:string;sections:{title:string;body:string;items?:string[]}[]};
const copy:Record<Locale,Copy>={
  en:{title:'Terms of use',intro:'Effective 24 July 2026. These terms apply to the free, limited FantaFort public alpha.',sections:[
    {title:'Service and eligibility',body:'FantaFort is an independent experimental fantasy game based on public competitive results. You must be at least 16, provide accurate registration information and use only your own account.'},
    {title:'Free sandbox only',body:'Coins, balances, entry stakes, rewards and player cards are virtual game elements with no monetary value. They cannot be bought, sold, transferred outside FantaFort or exchanged for money or prizes. FantaFort does not provide betting, gambling or payment processing.'},
    {title:'Game data and scoring',body:'Competitive data may be delayed, incomplete or corrected by its provider. Scoring follows the published methodology and may be recalculated after verified corrections. Projections are estimates, not promises. Alpha data, leagues or balances may be reset when reasonably necessary for testing, security or material rule changes.'},
    {title:'Acceptable use',body:'You must not abuse, disrupt or reverse engineer the service; automate requests without permission; exploit bugs; impersonate others; harass users; attempt unauthorized access; manipulate leagues or virtual balances; or use FantaFort for unlawful activity. Report vulnerabilities privately and do not access other users’ data.'},
    {title:'Accounts and moderation',body:'You are responsible for account security. We may limit, suspend or close accounts to protect users, investigate abuse, comply with law or operate the alpha. General support may use private Discord tickets, but passwords, recovery codes and tokens must never be shared.'},
    {title:'Intellectual property and third parties',body:'FantaFort’s original code and design remain proprietary. Fortnite, player names, competitive data, photographs and third-party materials remain subject to their owners’ rights. Access to FantaFort grants no license to reuse them.',items:[EPIC_FAN_DISCLAIMER]},
    {title:'Availability and changes',body:'The alpha is provided without a guaranteed uptime, feature set or preservation of test data. We may modify or discontinue it after reasonable notice where practical. Mandatory consumer rights are not excluded.'},
    {title:'Liability',body:'To the maximum extent permitted by law, the alpha is provided as is and FantaFort is not liable for indirect loss arising from service interruptions, provider corrections or loss of virtual game progress. Nothing limits liability that cannot legally be limited.'},
    {title:'Law and contact',body:'Italian law applies without depriving consumers of mandatory protections in their country of residence. Contact support before starting a formal dispute.'},
  ]},
  it:{title:'Termini di utilizzo',intro:'In vigore dal 24 luglio 2026. Questi termini si applicano alla public alpha gratuita e limitata di FantaFort.',sections:[
    {title:'Servizio e requisiti',body:'FantaFort è un fantasy game sperimentale e indipendente basato su risultati competitivi pubblici. Devi avere almeno 16 anni, fornire dati di registrazione corretti e usare soltanto il tuo account.'},
    {title:'Solo sandbox gratuita',body:'Coin, saldi, quote di ingresso, ricompense e carte giocatore sono elementi virtuali senza valore monetario. Non possono essere acquistati, venduti, trasferiti fuori da FantaFort o convertiti in denaro o premi. FantaFort non offre scommesse, gioco d’azzardo o pagamenti.'},
    {title:'Dati e punteggio',body:'I dati competitivi possono essere ritardati, incompleti o corretti dal fornitore. Il punteggio segue la metodologia pubblicata e può essere ricalcolato dopo correzioni verificate. Le proiezioni sono stime. Dati alpha, leghe o saldi possono essere azzerati quando ragionevolmente necessario per test, sicurezza o modifiche sostanziali delle regole.'},
    {title:'Uso consentito',body:'Non puoi abusare, interrompere o decodificare il servizio; automatizzare richieste senza permesso; sfruttare bug; impersonare altri; molestare utenti; tentare accessi non autorizzati; manipolare leghe o saldi virtuali; usare FantaFort per attività illecite. Le vulnerabilità vanno segnalate privatamente senza accedere ai dati altrui.'},
    {title:'Account e moderazione',body:'Sei responsabile della sicurezza dell’account. Possiamo limitare, sospendere o chiudere account per proteggere gli utenti, indagare abusi, rispettare la legge o gestire l’alpha. Il supporto generale può usare ticket Discord privati, ma non devi mai condividere password, codici di recupero o token.'},
    {title:'Proprietà intellettuale e terzi',body:'Codice e design originali di FantaFort restano proprietari. Fortnite, nomi dei giocatori, dati, fotografie e materiali di terzi restano soggetti ai diritti dei rispettivi titolari. L’accesso non concede una licenza di riutilizzo.',items:[EPIC_FAN_DISCLAIMER]},
    {title:'Disponibilità e modifiche',body:'L’alpha non garantisce disponibilità, funzioni immutabili o conservazione dei dati di test. Possiamo modificarla o interromperla, dando preavviso quando ragionevolmente possibile. I diritti inderogabili dei consumatori restano validi.'},
    {title:'Responsabilità',body:'Nei limiti di legge, l’alpha è fornita così com’è e FantaFort non risponde di danni indiretti dovuti a interruzioni, correzioni del provider o perdita di progressi virtuali. Non sono escluse responsabilità che la legge vieta di limitare.'},
    {title:'Legge e contatti',body:'Si applica la legge italiana, senza privare i consumatori delle tutele inderogabili del paese di residenza. Contatta il supporto prima di avviare una controversia formale.'},
  ]},
  es:{title:'Términos de uso',intro:'Vigentes desde el 24 de julio de 2026 para la alpha pública gratuita y limitada.',sections:[
    {title:'Servicio y edad',body:'FantaFort es un juego fantasy experimental e independiente. Debes tener al menos 16 años, usar datos correctos y tu propia cuenta.'},
    {title:'Sandbox gratuita',body:'Monedas, saldos, entradas y recompensas son virtuales, sin valor monetario, compra, retirada, premio ni apuesta.'},
    {title:'Datos y puntuación',body:'Los resultados pueden retrasarse o corregirse. La metodología publicada rige la puntuación. Los datos de alpha pueden reiniciarse por pruebas, seguridad o cambios sustanciales.'},
    {title:'Uso permitido',body:'No abuses del servicio, automatices sin permiso, explotes errores, suplantes, acoses, accedas sin autorización ni manipules ligas o saldos.'},
    {title:'Cuentas',body:'Podemos limitar o suspender cuentas por seguridad, abuso, ley u operación de la alpha. Nunca compartas contraseñas, códigos o tokens.'},
    {title:'Derechos de terceros',body:'El código original es propietario. Los materiales de terceros conservan sus derechos.',items:[EPIC_FAN_DISCLAIMER]},
    {title:'Disponibilidad y ley',body:'La alpha se ofrece sin garantía de disponibilidad. Se aplica la ley italiana sin excluir derechos obligatorios del consumidor.'},
  ]},
  de:{title:'Nutzungsbedingungen',intro:'Gültig ab 24. Juli 2026 für die kostenlose, begrenzte öffentliche Alpha.',sections:[
    {title:'Dienst und Alter',body:'FantaFort ist ein unabhängiges experimentelles Fantasyspiel. Du musst mindestens 16 Jahre alt sein, korrekte Angaben machen und dein eigenes Konto nutzen.'},
    {title:'Kostenlose Sandbox',body:'Coins, Guthaben, Einsätze und Belohnungen sind virtuell, ohne Geldwert, Kauf, Auszahlung, Preis oder Wette.'},
    {title:'Daten und Wertung',body:'Ergebnisse können verspätet oder korrigiert werden. Es gilt die veröffentlichte Methodik. Alpha-Daten können aus Test-, Sicherheits- oder Regelgründen zurückgesetzt werden.'},
    {title:'Zulässige Nutzung',body:'Kein Missbrauch, unzulässige Automatisierung, Ausnutzen von Fehlern, Identitätstäuschung, Belästigung, unbefugter Zugriff oder Manipulation.'},
    {title:'Konten',body:'Konten können aus Sicherheits-, Missbrauchs-, Rechts- oder Betriebsgründen eingeschränkt werden. Teile niemals Passwörter, Codes oder Tokens.'},
    {title:'Rechte Dritter',body:'Originalcode ist proprietär; Drittmaterial bleibt geschützt.',items:[EPIC_FAN_DISCLAIMER]},
    {title:'Verfügbarkeit und Recht',body:'Keine Verfügbarkeitsgarantie. Italienisches Recht gilt unter Wahrung zwingender Verbraucherrechte.'},
  ]},
  fr:{title:'Conditions d’utilisation',intro:'En vigueur le 24 juillet 2026 pour l’alpha publique gratuite et limitée.',sections:[
    {title:'Service et âge',body:'FantaFort est un jeu fantasy expérimental indépendant. Vous devez avoir au moins 16 ans, fournir des informations exactes et utiliser votre propre compte.'},
    {title:'Sandbox gratuite',body:'Coins, soldes, mises et récompenses sont virtuels, sans valeur, achat, retrait, prix ou pari.'},
    {title:'Données et score',body:'Les résultats peuvent être retardés ou corrigés. La méthodologie publiée s’applique. Les données alpha peuvent être réinitialisées pour tests, sécurité ou changement important.'},
    {title:'Utilisation acceptable',body:'Pas d’abus, automatisation non autorisée, exploitation de bugs, usurpation, harcèlement, accès illégitime ou manipulation.'},
    {title:'Comptes',body:'Nous pouvons limiter un compte pour sécurité, abus, loi ou exploitation de l’alpha. Ne partagez jamais mots de passe, codes ou jetons.'},
    {title:'Droits de tiers',body:'Le code original est propriétaire et les contenus tiers restent protégés.',items:[EPIC_FAN_DISCLAIMER]},
    {title:'Disponibilité et droit',body:'Aucune disponibilité garantie. Le droit italien s’applique sans exclure les droits impératifs des consommateurs.'},
  ]},
};

export default function TermsPage(){const{locale}=useLocale();const text=copy[locale];return <div className="app-shell"><MarketingHeader locale={locale}/><main className="container page-content legal-page"><div className="page-title"><div className="eyebrow">LEGAL</div><h1>{text.title}</h1><p>{text.intro}</p></div>{text.sections.map(section=><section className="epic-panel" key={section.title}><h2>{section.title}</h2><p>{section.body}</p>{section.items&&<ul>{section.items.map(item=><li key={item}>{item}</li>)}</ul>}</section>)}<section className="epic-panel"><p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · <Link href="/privacy">Privacy</Link> · <Link href="/cookies">Cookies</Link> · <Link href="/methodology">Methodology</Link></p></section></main><MarketingFooter locale={locale}/></div>}
