import type { Locale } from './i18n';

export const lineupCopy: Record<Locale, {
  settingTitle:string; settingLabel:string; settingBody:string; settingSave:string; settingOn:string; settingOff:string;
  view:string; private:string; empty:string; unavailable:string; close:string; rank:string; worth:string; value:string; title:string;
}> = {
  en:{
    settingTitle:'Public lineup', settingLabel:'Show my lineup on the leaderboard',
    settingBody:'Allow other FantaFort users to see your current lineup from the global leaderboard. You can turn this off at any time.',
    settingSave:'Save lineup visibility', settingOn:'Lineup visible to other users.', settingOff:'Lineup private.',
    view:'View lineup', private:'Private lineup', empty:'No lineup available.',
    unavailable:'This lineup is not available.', close:'Close', rank:'Rank', worth:'Net worth', value:'Value', title:'Lineup',
  },
  it:{
    settingTitle:'Formazione pubblica', settingLabel:'Mostra la mia formazione nella leaderboard',
    settingBody:'Consenti agli altri utenti FantaFort di vedere la tua formazione attuale dalla classifica globale. Puoi disattivare questa opzione in qualsiasi momento.',
    settingSave:'Salva visibilità formazione', settingOn:'Formazione visibile agli altri utenti.', settingOff:'Formazione privata.',
    view:'Vedi formazione', private:'Formazione privata', empty:'Nessuna formazione disponibile.',
    unavailable:'Questa formazione non è disponibile.', close:'Chiudi', rank:'Posizione', worth:'Patrimonio', value:'Valore', title:'Formazione',
  },
  es:{
    settingTitle:'Alineación pública', settingLabel:'Mostrar mi alineación en la clasificación',
    settingBody:'Permite que otros usuarios de FantaFort vean tu alineación actual desde la clasificación global. Puedes desactivarlo cuando quieras.',
    settingSave:'Guardar visibilidad', settingOn:'Alineación visible para otros usuarios.', settingOff:'Alineación privada.',
    view:'Ver alineación', private:'Alineación privada', empty:'No hay alineación disponible.',
    unavailable:'Esta alineación no está disponible.', close:'Cerrar', rank:'Posición', worth:'Patrimonio', value:'Valor', title:'Alineación',
  },
  de:{
    settingTitle:'Öffentliche Aufstellung', settingLabel:'Meine Aufstellung in der Rangliste zeigen',
    settingBody:'Erlaube anderen FantaFort-Nutzern, deine aktuelle Aufstellung über die globale Rangliste zu sehen. Du kannst das jederzeit deaktivieren.',
    settingSave:'Sichtbarkeit speichern', settingOn:'Aufstellung für andere sichtbar.', settingOff:'Aufstellung privat.',
    view:'Aufstellung ansehen', private:'Private Aufstellung', empty:'Keine Aufstellung verfügbar.',
    unavailable:'Diese Aufstellung ist nicht verfügbar.', close:'Schließen', rank:'Rang', worth:'Vermögen', value:'Wert', title:'Aufstellung',
  },
  fr:{
    settingTitle:'Composition publique', settingLabel:'Afficher ma composition dans le classement',
    settingBody:'Autorisez les autres utilisateurs FantaFort à voir votre composition actuelle depuis le classement mondial. Vous pouvez désactiver cette option à tout moment.',
    settingSave:'Enregistrer la visibilité', settingOn:'Composition visible par les autres utilisateurs.', settingOff:'Composition privée.',
    view:'Voir la composition', private:'Composition privée', empty:'Aucune composition disponible.',
    unavailable:'Cette composition n’est pas disponible.', close:'Fermer', rank:'Rang', worth:'Patrimoine', value:'Valeur', title:'Composition',
  },
};
