# Reset periodico completo dello staging

Questa procedura è distruttiva ed è consentita **solo** per `FantaFort Staging`.
Non eseguirla mai sul progetto production.

## Gate obbligatorio

Prima di qualsiasi reset verificare manualmente tutti i valori:

- nome progetto: `FantaFort Staging`;
- ref atteso corrente: `ibatqfmefkekbsvuterp`;
- hostname atteso corrente: `ibatqfmefkekbsvuterp.supabase.co`;
- il ref non deve essere quello production `ytbk…mulyl`;
- il worktree deve essere sul commit staging approvato;
- `ADMIN_MFA_ENFORCEMENT_ENABLED=true`, `ADMIN_MUTATIONS_ENABLED=false` e
  `ADMIN_ANONYMIZATION_ENABLED=false` su Vercel staging;
- `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, password DB e stringhe Postgres non devono essere presenti nel runtime Vercel.

Interrompere immediatamente se uno dei controlli non coincide.

## Reset in-place da migrazioni

1. Salvare, se necessario, un export destinato esclusivamente al debugging staging.
2. Sospendere i test e verificare che nessun job scriva sul progetto.
3. Collegare Supabase CLI esclusivamente al ref staging e rieseguire il gate sopra.
4. Eseguire il reset remoto senza seed:

   ```bash
   npx supabase db reset --linked --no-seed
   ```

   Il comando ricrea il database applicativo usando le migrazioni versionate. Non
   aggiungere SQL di bypass per ledger o audit.
5. Dopo il reset dello schema applicativo, eliminare tramite Auth Admin API tutti
   gli utenti appartenenti allo staging. A questo punto non esistono più i record
   applicativi dipendenti che normalmente rendono append-only ledger e audit.
6. Rimuovere eventuali oggetti Storage e risorse Auth staging non ricreate dalle
   migrazioni.
7. Verificare migration history, dry-run vuoto, assenza di utenti/profili/wallet e
   presenza dei trigger append-only.
8. Ricreare soltanto l'eventuale amministratore sintetico necessario al test
   successivo e lasciarlo disabilitato fino alla nuova finestra autorizzata.
9. Ridistribuire `fantafort-staging` mantenendo tutti i flag amministrativi a
   `false`.

## Alternativa preferita quando serve isolamento totale

Distruggere e ricreare l'intero progetto Supabase staging, applicare tutte le
migrazioni da zero e aggiornare esclusivamente gli environment Vercel staging.
Il nuovo ref deve essere approvato prima dell'uso. Questa alternativa elimina
anche residui Auth, Storage e configurazioni non coperti dal reset SQL.

## Verifiche finali

- migration history locale/remota allineata;
- `supabase db push --linked --dry-run --include-all` vuoto;
- zero utenti Auth, profili, wallet e grant non intenzionali;
- ledger e audit append-only nuovamente attivi;
- alias `fantafort-staging.vercel.app` sano;
- production e relativo ref invariati.
