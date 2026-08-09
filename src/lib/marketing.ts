import type { Locale } from './i18n';

export type LocalizedLocale = Exclude<Locale, 'en'>;
export const localizedLocales: LocalizedLocale[] = ['it', 'es', 'de', 'fr'];

export function isLocalizedLocale(value: string): value is LocalizedLocale {
  return localizedLocales.includes(value as LocalizedLocale);
}

export function marketingPath(locale: Locale, path = '') {
  const suffix = path && !path.startsWith('/') ? `/${path}` : path;
  return locale === 'en' ? suffix || '/' : `/${locale}${suffix}`;
}

export const homeCopy: Record<Locale, {
  eyebrow:string; title:string; accent:string; intro:string; signup:string; signin:string; signupNote:string; learn:string;
  worksTitle:string; steps:string[]; whyTitle:string; benefits:string[];
  dataTitle:string; dataBody:string; fairBody:string; ctaTitle:string; ctaBody:string;
}> = {
  en: {
    eyebrow:'FORTNITE FANTASY LEAGUE', title:'Draft pros.', accent:'Win with friends.', intro:'Build a three-player roster and score from real FNCS results in a private league.', signup:'Create free account', signin:'I already have an account', signupNote:'New to FantaFort? Create your account first, then start or join a league.', learn:'See how it works',
    worksTitle:'Playing takes three steps', steps:['Create your free account and start or join a private league.','Draft three competitive Fortnite players with virtual coins.','Follow live points and climb the league table with your friends.'],
    whyTitle:'Everything you need to compete', benefits:['Private leagues with invite codes','Real FNCS results, updated regularly','Virtual coins only — no betting or payments'],
    dataTitle:'Real competition data', dataBody:'Tournament results are synchronized from Osirion about every 15 minutes. Late signings never receive retroactive points.', fairBody:'Independent experience. Not affiliated with or endorsed by Epic Games.',
    ctaTitle:'Ready for your first draft?', ctaBody:'Create your account and invite your friends. It only takes a minute.'
  },
  it: {
    eyebrow:'FANTASY LEAGUE DI FORTNITE', title:'Scegli i pro.', accent:'Vinci con gli amici.', intro:'Crea una rosa di tre player e ottieni punti dai risultati reali FNCS in una lega privata.', signup:'Crea account gratuito', signin:'Ho già un account', signupNote:'Se è la prima volta, crea prima il tuo account. Poi potrai creare o raggiungere una lega.', learn:'Scopri come funziona',
    worksTitle:'Ti bastano tre passaggi', steps:['Crea il tuo account gratuito e avvia o raggiungi una lega privata.','Scegli tre player competitivi di Fortnite usando coin virtuali.','Segui i punti live e scala la classifica insieme agli amici.'],
    whyTitle:'Tutto ciò che serve per sfidarsi', benefits:['Leghe private con codice invito','Risultati FNCS reali e aggiornati','Solo coin virtuali — niente scommesse o pagamenti'],
    dataTitle:'Dati competitivi reali', dataBody:'I risultati dei tornei vengono sincronizzati da Osirion circa ogni 15 minuti. Gli acquisti tardivi non ricevono punti retroattivi.', fairBody:'Esperienza indipendente, non affiliata né approvata da Epic Games.',
    ctaTitle:'Pronto per il primo draft?', ctaBody:'Crea il tuo account e invita gli amici. Basta un minuto.'
  },
  es: {
    eyebrow:'LIGA FANTASY DE FORTNITE', title:'Ficha a los pros.', accent:'Gana con amigos.', intro:'Crea una plantilla de tres jugadores y suma puntos con resultados reales de FNCS en una liga privada.', signup:'Crear cuenta gratis', signin:'Ya tengo una cuenta', signupNote:'Si es tu primera vez, crea tu cuenta. Después podrás crear una liga o unirte a ella.', learn:'Cómo funciona',
    worksTitle:'Solo necesitas tres pasos', steps:['Crea tu cuenta gratis e inicia una liga privada o únete a ella.','Elige tres jugadores competitivos de Fortnite con monedas virtuales.','Sigue los puntos en directo y sube en la clasificación con tus amigos.'],
    whyTitle:'Todo lo necesario para competir', benefits:['Ligas privadas con invitación','Resultados reales de FNCS actualizados','Solo monedas virtuales, sin apuestas ni pagos'],
    dataTitle:'Datos competitivos reales', dataBody:'Los resultados se sincronizan desde Osirion aproximadamente cada 15 minutos. Los fichajes tardíos no reciben puntos retroactivos.', fairBody:'Experiencia independiente, no afiliada ni respaldada por Epic Games.',
    ctaTitle:'¿Listo para tu primer draft?', ctaBody:'Crea tu cuenta e invita a tus amigos. Solo necesitas un minuto.'
  },
  de: {
    eyebrow:'FORTNITE FANTASY LEAGUE', title:'Draft die Profis.', accent:'Gewinne mit Freunden.', intro:'Baue einen Kader aus drei Spielern und sammle in einer privaten Liga Punkte aus echten FNCS-Ergebnissen.', signup:'Kostenloses Konto erstellen', signin:'Ich habe bereits ein Konto', signupNote:'Neu bei FantaFort? Erstelle zuerst dein Konto und starte danach eine Liga oder tritt einer bei.', learn:'So funktioniert es',
    worksTitle:'Drei Schritte genügen', steps:['Erstelle dein kostenloses Konto und starte eine private Liga oder tritt bei.','Wähle drei Fortnite-Wettkampfspieler mit virtuellen Coins.','Verfolge Live-Punkte und steige mit deinen Freunden in der Tabelle auf.'],
    whyTitle:'Alles für euren Wettbewerb', benefits:['Private Ligen mit Einladungscode','Echte, regelmäßig aktualisierte FNCS-Ergebnisse','Nur virtuelle Coins — keine Wetten oder Zahlungen'],
    dataTitle:'Echte Wettkampfdaten', dataBody:'Turnierergebnisse werden etwa alle 15 Minuten von Osirion synchronisiert. Späte Transfers erhalten keine rückwirkenden Punkte.', fairBody:'Unabhängige Erfahrung, weder mit Epic Games verbunden noch von Epic Games unterstützt.',
    ctaTitle:'Bereit für deinen ersten Draft?', ctaBody:'Erstelle dein Konto und lade deine Freunde ein. Es dauert nur eine Minute.'
  },
  fr: {
    eyebrow:'LIGUE FANTASY FORTNITE', title:'Recrutez les pros.', accent:'Gagnez entre amis.', intro:'Composez une équipe de trois joueurs et marquez des points grâce aux vrais résultats FNCS dans une ligue privée.', signup:'Créer un compte gratuit', signin:'J’ai déjà un compte', signupNote:'Vous découvrez FantaFort ? Créez d’abord votre compte, puis lancez ou rejoignez une ligue.', learn:'Comment ça marche',
    worksTitle:'Trois étapes suffisent', steps:['Créez votre compte gratuit, puis lancez ou rejoignez une ligue privée.','Choisissez trois joueurs Fortnite compétitifs avec des coins virtuels.','Suivez les points en direct et grimpez au classement avec vos amis.'],
    whyTitle:'Tout pour vous affronter', benefits:['Ligues privées sur invitation','Vrais résultats FNCS mis à jour','Coins virtuels uniquement — aucun pari ni paiement'],
    dataTitle:'Données compétitives réelles', dataBody:'Les résultats sont synchronisés depuis Osirion environ toutes les 15 minutes. Aucun point rétroactif pour un recrutement tardif.', fairBody:'Expérience indépendante, ni affiliée ni approuvée par Epic Games.',
    ctaTitle:'Prêt pour votre première draft ?', ctaBody:'Créez votre compte et invitez vos amis. Une minute suffit.'
  }
};
