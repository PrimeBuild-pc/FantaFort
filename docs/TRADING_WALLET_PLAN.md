# Piano implementativo — wallet account, trading e leghe con rischio

Stato: **implementazione completata il 17 luglio 2026**. Questo documento descrive le regole correnti e le possibili regolazioni future.

## Decisione adottata

Tenere separate due economie:

1. **Wallet account**: appartiene all'utente e viene usato nel trading individuale.
2. **Budget lega**: appartiene a una singola lega ed è uguale per tutti i partecipanti.

Il collegamento più equilibrato non è permettere ai giocatori ricchi di spendere liberamente il proprio wallet in una lega. È usare un **ingresso virtuale uguale per tutti**:

- ogni partecipante blocca la stessa quantità di coin account;
- tutti ricevono comunque lo stesso budget operativo nella lega;
- a fine lega il montepremi virtuale viene distribuito secondo regole fissate prima della partenza.

Così il patrimonio account è utile e può essere perso, ma non compra un vantaggio competitivo durante la lega.

## Principi non negoziabili

- Coin esclusivamente virtuali, non convertibili in denaro e senza cash-out.
- Nessun acquisto di coin con denaro reale nella prima versione.
- Nessun punteggio retroattivo dopo un acquisto.
- Ogni movimento registrato in un ledger immutabile.
- Operazioni economiche atomiche nel database, mai calcolate soltanto dal client.
- Stesso ingresso e stesso budget per tutti in una lega con rischio.
- Limiti contro multi-account, regali circolari e prosciugamento accidentale del wallet.
- Prezzi autorevoli aggiornati dal server ogni circa 15 minuti, non dal browser.

## Situazione attuale riutilizzabile

Il progetto contiene già:

- `profiles.coins`: saldo personale attuale;
- `roster_entries`: rosa personale fuori dalle leghe;
- `league_members.coins`: budget isolato per ogni lega;
- `league_roster_entries`: giocatori posseduti nella singola lega;
- `players.price` e `player_price_history`: prezzo corrente e storico;
- acquisto/vendita atomici tramite RPC;
- spread di vendita del 5%;
- iscrizione a più leghe senza un limite applicativo esplicito.

Non conviene però continuare ad aggiornare direttamente `profiles.coins`: serve un ledger verificabile.

## Modalità implementate

### 1. Trading personale

Ogni utente dispone di un portafoglio indipendente dalle leghe.

Prima versione semplice:

- può possedere al massimo una carta per ogni pro player;
- non esiste il limite di 3 giocatori nel portafoglio personale;
- compra e vende contro il mercato FantaFort al prezzo corrente;
- vendita al 95% per evitare compravendite senza rischio;
- nessun ordine tra utenti e nessuna quantità frazionaria;
- profitto/perdita mostrati per giocatore e per portafoglio.

Il prezzo continua a dipendere dalla forma competitiva reale. I FantaPoint ottenuti dai player possono essere mostrati come statistica, ma non devono generare automaticamente coin: creerebbero un ciclo in cui chi è ricco diventa sempre più ricco.

### 2. Lega demo — default

È l'attuale modello e deve rimanere la modalità principale:

- il creatore sceglie il budget iniziale;
- ogni partecipante riceve lo stesso budget lega;
- il wallet account non viene toccato;
- nessun rischio sul patrimonio personale.

### 3. Lega con ingresso virtuale

Modalità più intensa ma ancora senza denaro reale:

- il creatore sceglie un ingresso tra valori predefiniti, ad esempio 500, 1.000 o 2.000 coin;
- tutti bloccano lo stesso ingresso prima dell'avvio;
- il budget di mercato resta uguale per tutti e separato dal wallet;
- nessuno può unirsi dopo l'avvio;
- il montepremi viene bloccato in escrow fino alla chiusura;
- annullamento o errore tecnico restituiscono automaticamente gli ingressi;
- la distribuzione viene definita prima dell'avvio e non può cambiare.

Limite iniziale consigliato: ingresso massimo pari al minore tra 2.000 coin e il 20% del patrimonio account. Da discutere dopo simulazioni.

Non consiglio una modalità in cui ogni utente porta in lega tutto il proprio wallet: favorirebbe troppo gli account anziani e renderebbe difficile bilanciare il gioco.

## Recupero giornaliero

Non dare 100 coin ogni giorno a tutti: produrrebbe inflazione e premierebbe chi crea molti account.

Proposta:

- bonus recupero richiedibile una volta ogni 24 ore;
- disponibile soltanto se saldo liquido e valore del portafoglio sono sotto soglie definite;
- 100 coin per richiesta;
- non può portare il saldo oltre una soglia di sicurezza, inizialmente 500;
- account confermato e con età minima, inizialmente 7 giorni;
- ogni richiesta registrata nel ledger.

Serve a far ripartire chi è realmente a zero, non a generare rendita passiva.

## Regali tra amici

Da introdurre dopo il trading, non insieme alla prima migrazione economica.

Vincoli consigliati:

- solo amicizie accettate;
- account del mittente confermato e più vecchio di 7 giorni;
- tetto giornaliero iniziale di 300 coin inviati;
- saldo minimo residuo del mittente;
- messaggio di conferma con importo e destinatario;
- transazione atomica a doppia entrata;
- blocco e log dei pattern sospetti tra account collegati.

I regali non devono essere anonimi, reversibili dal client o acquistabili con denaro reale.

## Modello dati implementato

### `account_wallets`

- `user_id`
- `balance`
- `locked_balance`
- `updated_at`

### `wallet_transactions`

Ledger immutabile:

- `id`
- `user_id`
- `amount` positivo o negativo
- `balance_after`
- `type`: trade_buy, trade_sell, daily_rescue, gift_sent, gift_received, league_lock, league_refund, league_prize
- `reference_type` e `reference_id`
- `idempotency_key` univoca
- `created_at`

Nessuna policy deve permettere insert o update diretti dal browser.

### `account_positions`

- `user_id`
- `player_id`
- `acquired_price`
- `acquired_at`

Indice unico su utente e player. Per la prima versione non servono quantità, ordini o lotti multipli.

### `league_stakes`

- `league_id`
- `user_id`
- `amount`
- `status`: locked, paid, refunded
- riferimenti alle transazioni wallet

### Estensioni `leagues`

- `economy_mode`: demo oppure account_stake
- `entry_stake`
- `prize_rule`

I valori diventano immutabili dal primo ingresso confermato o, al più tardi, dall'avvio.

## RPC server-side

Minimo necessario:

- `account_buy_player(player_id)`
- `account_sell_player(player_id)`
- `claim_daily_rescue()`
- `gift_coins(friend_id, amount)`
- `lock_league_stake(league_id)`
- `cancel_league_and_refund(league_id)`
- estensione atomica di `finish_league()` per distribuire il premio
- `get_account_portfolio()`
- `get_wallet_history(page)`

Ogni RPC deve usare row lock, controllo saldo, idempotenza e validazione server-side.

## Interfaccia implementata

### `/trading`

Dashboard stile mercato semplificato:

- patrimonio totale;
- saldo disponibile e saldo bloccato;
- profitto/perdita giornaliero e totale;
- watchlist;
- grafico prezzi del player;
- forma recente e compagni;
- ticket compra/vendi con prezzo, spread e conferma;
- portafoglio e storico operazioni.

Non usare terminologia che prometta rendimenti finanziari reali. Mostrare sempre “coin virtuali senza valore monetario”.

### `/wallet`

- saldo e movimenti;
- coin bloccati nelle leghe;
- bonus recupero, quando disponibile;
- regalo a un amico;
- avvisi su limiti e irreversibilità.

### Creazione lega

Scelta esplicita:

- **Demo**: budget isolato uguale per tutti;
- **Ingresso virtuale**: stake account uguale, budget lega uguale, premio virtuale.

Prima dell'avvio mostrare un riepilogo confermato da tutti i membri.

## Prezzi e integrità del mercato

- Il database è l'unica fonte del prezzo eseguibile.
- L'utente vede l'orario dell'ultimo aggiornamento.
- Bloccare il trading se Osirion non aggiorna da oltre una soglia, inizialmente 30 minuti durante eventi live.
- Applicare sempre lo spread del 5%.
- Nessun acquisto al vecchio prezzo dopo un refresh: la RPC rilegge il prezzo nella stessa transazione.
- Limite iniziale di operazioni, ad esempio 50 al giorno, solo come protezione anti-bot.
- Conservare tutto lo storico prezzi per grafici e contestazioni.

## Aste e ordini avanzati

Il draft ad asta è implementato con un solo lotto attivo per lega, durata 30-300 secondi, rilancio minimo di 100 coin, fondi riservati e assegnazione atomica alla chiusura.

Gli ordini limite e lo scambio diretto di player tra utenti restano esclusi: richiederebbero liquidità, matching, scadenze, cancellazioni e molte più misure antifrode senza essere necessari per validare il gioco.

## Sicurezza e abuso

Test obbligatori:

- due acquisti simultanei non possono spendere lo stesso saldo;
- un retry non duplica una transazione;
- saldo e locked balance non diventano negativi;
- il ledger riconcilia sempre il wallet;
- non è possibile regalare a non amici o oltre il limite;
- nessun bonus giornaliero duplicato per timezone o richieste parallele;
- nessun ingresso viene perso se la lega viene annullata;
- il premio totale non supera il montepremi bloccato;
- chi compra dopo l'inizio non riceve punti retroattivi;
- RLS impedisce di leggere dati privati o scrivere movimenti arbitrari.

## Fasi di implementazione

Tutte le fasi previste per questa versione sono completate e coperte dal controllo `npm run check:db`.

### Fase 1 — Fondamenta economiche ✅

- wallet e ledger;
- migrazione del saldo `profiles.coins` senza perdita;
- portfolio personale senza limite di tre;
- RPC compra/vendi;
- riconciliazione e test database.

### Fase 2 — Trading UI ✅

- pagina Trading;
- portafoglio, P&L, watchlist e grafici;
- timestamp prezzi e stato provider;
- storico transazioni.

### Fase 3 — Collegamento alle leghe ✅

- modalità Demo e Ingresso virtuale;
- escrow, conferma partecipanti, rimborso e premio;
- limiti proporzionali al patrimonio;
- aggiornamento dashboard e guida.

### Fase 4 — Recupero e regali ✅

- bonus recupero condizionale;
- regali tra amici con limiti;
- audit e strumenti minimi di moderazione.

### Fase 5 — Asta ✅

- draft ad asta dentro le leghe;
- timer, rilanci atomici e gestione disconnessioni;
- niente order book globale finché non emerge una necessità reale.

## Default adottati, da rivalutare con dati reali

1. Saldo iniziale account: 10.000 coin.
2. Portfolio: una carta per player, nessuna quantità multipla.
3. Ingressi virtuali: 500, 1.000 o 2.000 coin, massimo 20% del patrimonio.
4. Premio: vincitore unico.
5. Recupero: fino a 100 coin sotto 500 liquidi e 1.500 di patrimonio; regali massimo 300 al giorno.
6. Nessun limite iniziale al numero di leghe.
7. Trading bloccato quando i dati provider hanno più di 30 minuti.
8. Valuta mostrata come coin `C`, senza riferimenti a valuta reale o cash-out.

## Nota legale futura

Finché coin e premi non sono acquistabili, vendibili o convertibili in denaro, il sistema deve restare chiaramente un gioco virtuale sandbox. Prima di introdurre acquisti reali, cash-out, quote pagate o premi di valore occorre una revisione legale e fiscale specifica, oltre alla verifica dei termini Epic, Osirion e delle licenze delle immagini.
