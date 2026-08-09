"use client";

import Link from 'next/link';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { useLocale } from '@/context/LocaleContext';
import { Locale } from '@/lib/i18n';

const LICENSE_NOTICE = `FantaFort Proprietary License

Copyright (c) 2026 FantaFort. All rights reserved.

The software and source code are proprietary and confidential. No permission
is granted to use, copy, reproduce, modify, publish, distribute, sublicense,
sell, host, reverse engineer or create derivative works without prior written
authorization from the copyright holder.

Authorized users may use only the officially hosted FantaFort service. Access
to the service does not grant rights in the source code.

Third-party software, trademarks, data and images remain subject to their own
licenses and rights.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, TO THE
MAXIMUM EXTENT PERMITTED BY LAW.`;

type Copy = { title:string; intro:string; guide:string; howTitle:string; how:string[]; licenseTitle:string; license:string; full:string; thirdTitle:string; third:string[]; dataTitle:string; data:string };
const copy: Record<Locale, Copy> = {
  en:{title:'About FantaFort',intro:'FantaFort is an independent, sandbox fantasy game based on public competitive Fortnite results.',guide:'Open the game guide',howTitle:'How it works',how:['Trade players in your private virtual portfolio.','Create or join a private league.','The owner configures budget, roster, timed market, duration and scoring.','Recruit exclusive players and invest the remainder in pre-event strategies.','Real tournament results determine base, synergy and prediction bonuses.'],licenseTitle:'Software license',license:'FantaFort source code is private and proprietary. No right to copy, modify, redistribute, host or use it is granted without prior written authorization.',full:'Read the proprietary notice',thirdTitle:'Third-party rights',third:['Fortnite and related marks and assets belong to Epic Games. FantaFort is not endorsed by or affiliated with Epic Games.','The proprietary notice covers original software code only. It does not grant rights to third-party trademarks, competitive data, photographs or other external content.','Competitive data is provided by Osirion under its own terms. Curated player metadata and images require their original attribution and licensing review before commercial use.'],dataTitle:'Data and responsibility',data:'Scores refresh from Osirion about every 15 minutes and can be delayed or corrected. FantaFort is entertainment only: no real payment or betting is processed.'},
  it:{title:'Informazioni su FantaFort',intro:'FantaFort è un fantasy game indipendente e sandbox basato sui risultati pubblici dei tornei competitivi di Fortnite.',guide:'Apri la guida di gioco',howTitle:'Come funziona',how:['Fai trading di player nel portafoglio virtuale personale.','Crea o entra in una lega privata.','Il proprietario configura budget, rosa, mercato a tempo, durata e punteggio.','Acquista giocatori esclusivi e investi il residuo nelle strategie pre-torneo.','I risultati reali determinano punti base, intesa e bonus pronostici.'],licenseTitle:'Licenza software',license:'Il codice sorgente di FantaFort è privato e proprietario. Non è concesso copiarlo, modificarlo, distribuirlo, ospitarlo o utilizzarlo senza autorizzazione scritta.',full:'Leggi l’avviso proprietario',thirdTitle:'Diritti di terzi',third:['Fortnite, i relativi marchi e asset appartengono a Epic Games. FantaFort non è approvato né affiliato a Epic Games.','L’avviso proprietario riguarda soltanto il codice originale e non concede diritti su marchi, dati competitivi, fotografie o altri contenuti esterni.','I dati competitivi provengono da Osirion secondo i suoi termini. Metadati e immagini curate richiedono attribuzione originale e verifica della licenza prima di usi commerciali.'],dataTitle:'Dati e responsabilità',data:'I risultati si aggiornano da Osirion circa ogni 15 minuti e possono subire ritardi o correzioni. FantaFort è solo intrattenimento: non gestisce pagamenti reali né scommesse.'},
  es:{title:'Información sobre FantaFort',intro:'FantaFort es un juego fantasy independiente y sandbox basado en resultados competitivos públicos.',guide:'Abrir guía',howTitle:'Cómo funciona',how:['Opera con jugadores en tu cartera virtual.','Crea o únete a una liga privada.','Configura presupuesto, plantilla, mercado, duración y puntuación.','Ficha jugadores e invierte el resto en estrategias.','Los resultados reales calculan base, sinergia y pronósticos.'],licenseTitle:'Licencia de software',license:'El código de FantaFort es privado y propietario. No puede copiarse, modificarse, distribuirse, alojarse ni utilizarse sin autorización escrita.',full:'Leer el aviso propietario',thirdTitle:'Derechos de terceros',third:['Fortnite y sus marcas pertenecen a Epic Games; FantaFort no está afiliado ni respaldado.','El aviso propietario cubre solo el código original, no marcas, datos, fotos o contenido externo.','Osirion proporciona datos bajo sus términos; las imágenes requieren atribución y revisión antes de uso comercial.'],dataTitle:'Datos y responsabilidad',data:'Los datos se actualizan aproximadamente cada 15 minutos. Es entretenimiento sandbox, sin pagos reales ni apuestas.'},
  de:{title:'Über FantaFort',intro:'FantaFort ist ein unabhängiges Sandbox-Fantasyspiel auf Basis öffentlicher Turnierergebnisse.',guide:'Spielanleitung öffnen',howTitle:'So funktioniert es',how:['Handle Spieler im privaten virtuellen Portfolio.','Private Liga erstellen oder beitreten.','Budget, Kader, Markt, Dauer und Wertung festlegen.','Spieler verpflichten und Restbudget strategisch nutzen.','Echte Ergebnisse bestimmen Basis, Synergie und Tipps.'],licenseTitle:'Softwarelizenz',license:'Der FantaFort-Quellcode ist privat und proprietär. Kopieren, Ändern, Verteilen, Hosten oder Nutzen ist ohne schriftliche Genehmigung verboten.',full:'Proprietären Hinweis lesen',thirdTitle:'Rechte Dritter',third:['Fortnite und Marken gehören Epic Games; keine Verbindung oder Unterstützung.','Der proprietäre Hinweis gilt nur für Originalcode, nicht für Marken, Daten, Fotos oder externe Inhalte.','Osirion-Daten und kuratierte Bilder unterliegen eigenen Bedingungen und Attributionen.'],dataTitle:'Daten und Verantwortung',data:'Aktualisierung etwa alle 15 Minuten. Nur Sandbox-Unterhaltung, keine echten Zahlungen oder Wetten.'},
  fr:{title:'À propos de FantaFort',intro:'FantaFort est un jeu fantasy indépendant et sandbox fondé sur des résultats compétitifs publics.',guide:'Ouvrir le guide',howTitle:'Fonctionnement',how:['Échangez des joueurs dans le portefeuille virtuel.','Créez ou rejoignez une ligue privée.','Réglez budget, équipe, marché, durée et score.','Recrutez et investissez le reste en stratégies.','Les vrais résultats déterminent base, synergie et pronostics.'],licenseTitle:'Licence logicielle',license:'Le code source de FantaFort est privé et propriétaire. Aucune copie, modification, distribution, exploitation ou utilisation sans autorisation écrite.',full:'Lire l’avis propriétaire',thirdTitle:'Droits de tiers',third:['Fortnite et ses marques appartiennent à Epic Games; aucune affiliation ou approbation.','L’avis propriétaire couvre uniquement le code original, pas les marques, données, photos ou contenus externes.','Les données Osirion et images organisées gardent leurs propres conditions et attributions.'],dataTitle:'Données et responsabilité',data:'Mise à jour environ toutes les 15 minutes. Divertissement sandbox uniquement, sans paiement réel ni pari.'},
};

export default function AboutPage() {
  const { locale } = useLocale(); const text = copy[locale];
  return <div className="app-shell"><MarketingHeader locale={locale}/><main className="container page-content legal-page"><div className="page-title"><div className="eyebrow">FANTAFORT</div><h1>{text.title}</h1><p>{text.intro}</p></div>
    <section className="epic-panel"><h2>{text.howTitle}</h2><ol>{text.how.map(item=><li key={item}>{item}</li>)}</ol><Link className="epic-button" href={locale==='en'?'/how-it-works':`/${locale}/how-it-works`}>{text.guide}</Link></section>
    <section className="epic-panel"><h2>{text.licenseTitle}</h2><p>{text.license}</p><details><summary>{text.full}</summary><pre>{LICENSE_NOTICE}</pre></details></section>
    <section className="epic-panel"><h2>{text.thirdTitle}</h2><ul>{text.third.map(item=><li key={item}>{item}</li>)}</ul><p><a href="https://fnapi.osirion.gg" target="_blank" rel="noreferrer">Osirion API</a></p></section>
    <section className="epic-panel"><h2>{text.dataTitle}</h2><p>{text.data}</p></section>
  </main><MarketingFooter locale={locale}/></div>;
}
