# Pagamento dell'imposta di soggiorno

Come sul sito di La Columbera (pagina «Conferma e paga»), l'ospite paga **dentro il modulo del check-in**, con i campi della carta di Stripe nello stile del sito.

## Come funziona

1. Ultimo passo («Riepilogo e pagamento»): l'ospite controlla il riepilogo, dichiara di aver letto l'informativa e preme **«Continua al pagamento · €…»**. I dati si salvano (come prima, temporanei) e si crea il pagamento su Stripe con l'importo ricalcolato dal server.
2. Sotto compare il riquadro **Pagamento**: importo da pagare, campo **Email**, campi della carta (anche Apple Pay e Google Pay se attivi su Stripe), pulsante **«Paga €…»**. I numeri della carta li riceve solo Stripe. Stripe.js si carica solo a questo punto (prima la pagina non si collega a Stripe).
3. Pagamento riuscito → si apre la pagina di esito di sempre (`successo-pagamento.html`), con i dettagli e il codice della cassetta.
4. Il check-in (email all'ospite, foglio, email al gestore) si elabora **solo quando Stripe conferma il pagamento**: dal webhook `checkout.session.completed` (pagamento «paid») o, se il webhook tarda, dalla pagina di esito che lo chiede a Stripe. Un pagamento rifiutato o abbandonato non registra nulla; i dati temporanei si cancellano da soli dopo 2 ore.

- **Email**: senza email Stripe non conferma il pagamento nella pagina (sulla pagina di Stripe la chiedeva Stripe stessa). Dal 30/10 al 02/11/2026 il campo mancava e ogni pagamento nella pagina finiva con «Il pagamento non è andato a buon fine: controlla i dati della carta e riprova». L'email va **solo a Stripe** (`updateEmail` di Stripe.js, appena l'ospite lascia il campo o al più tardi prima della conferma), non al server del check-in; da Stripe la legge l'elaborazione (`customer_details.email`) per mandare all'ospite l'email con le istruzioni per l'arrivo. Vuota o sbagliata: messaggio sopra il pulsante, nessun addebito. Se la sessione ha già l'email il campo non compare. Prove: `tests/pagamenti.test.mjs` («pagamento nella pagina senza email nella sessione …»).
- **Carta rifiutata**: il messaggio della banca compare sopra il pulsante e si riprova (anche con un'altra carta).
- **«← Modifica i dati»**: si chiudono i campi della carta e si torna al pulsante «Continua al pagamento» (un nuovo pagamento verrà creato con i dati aggiornati).
- **Dopo 30 minuti** il pagamento su Stripe scade: il riquadro si chiude e basta premere di nuovo «Continua al pagamento».
- **La banca chiede una conferma su un'altra pagina** (3D Secure con reindirizzamento): al termine si torna sulla pagina di esito.

### Pagina di esito (dal 13/11/2026)

- **Tre tentativi** per leggere i dati del pagamento (subito, dopo 1,5 e dopo 3 secondi): un errore di rete o del server di un momento non mostra più «Errore nel caricamento» a chi ha appena pagato.
- **Dettagli e codice restano a schermo**: un errore qualsiasi arrivato dopo (anche di uno script estraneo alla pagina) non li cancella.
- **Valori come testo**: appartamento, numero di ospiti e notti arrivano dal pagamento e si scrivono come testo, mai come HTML.
- **Lingua e data**: cambiando lingua si aggiornano anche la data e la descrizione dell'appartamento; la data di arrivo è il giorno scelto anche per chi guarda la pagina da un altro fuso orario.
- **Rielaborazione di riserva solo nei primi 7 giorni** (`GIORNI_RIELABORAZIONE` in `api/get-session.js`): la pagina la chiede a ogni apertura, ma serve solo finché Stripe può ancora ritentare il webhook (circa 3 giorni). Il registro tecnico si cancella dopo 30 giorni: senza questo limite, riaprendo la pagina più tardi l'ospite riceveva di nuovo l'email di benvenuto. Dettagli e codice si leggono sempre.

## Impostazioni su Vercel (progetto Check-in → Settings → Environment Variables)

| Variabile | A cosa serve |
|---|---|
| `STRIPE_PUBLISHABLE_KEY` | **Nuova.** Campi della carta nella pagina. Stripe → Sviluppatori → Chiavi API → «Chiave pubblicabile» (`pk_live_…`; per le prove `pk_test_…`). Deve essere dello stesso tipo di `STRIPE_SECRET_KEY` (stesso account Stripe del sito, quindi è la stessa chiave pubblicabile già messa nel progetto La Columbera). Senza, con un formato sbagliato o di tipo diverso, si paga sulla pagina di Stripe come prima |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Invariate |

Il webhook su Stripe non cambia (`/api/stripeWebhook`, evento `checkout.session.completed`). Per Apple Pay nella pagina va registrato su Stripe → Impostazioni → Domini dei metodi di pagamento anche il dominio del check-in (`spaceestate.github.io` e `checkin-six-coral.vercel.app`).

I campi della carta nella pagina usano la versione delle API `2026-08-26.dahlia` (la stessa del sito) solo per creare quella sessione: webhook, `get-session` e pagina di Stripe restano sulla versione della libreria di questo progetto.

## Aspetto

Tutto il check-in (modulo e pagina di esito) usa lo stile del sito di La Columbera: fondo carta, carte bianche arrotondate, titoli in Fraunces corsivo, parola calligrafica in Pinyon Script (servito dal sito, licenza in `fonts/`), etichette bordeaux maiuscole, campi su fondo carta, pulsanti a pillola bordeaux, righe di riepilogo come il conto del sito. Le regole stanno in fondo a `checkin.css` («TEMA LA COLUMBERA») e in fondo allo stile di `successo-pagamento.html`; i nomi delle classi usate da `checkin.js` non sono cambiati.

## Email all'ospite dopo il pagamento

Dal 31/10/2026 l'email che l'ospite riceve dopo il check-in (`api/invia-email-ospite.js`) ha lo stesso aspetto delle email del sito di La Columbera (`api/_mail.js` di quel progetto): testata bordeaux con il logo, riga oro, riepilogo a righe, pulsante e piè di pagina con i recapiti dello stesso bordeaux della testata; le scritte di risalto (codice della cassetta, importo, link) sono in oro scuro (#806120, leggibile su tutti i fondi chiari: contrasto da 4,8 a 5,7:1), come nelle email del sito. È costruita solo con tabelle e stili in linea, così si vede uguale in Gmail, Outlook e Apple Mail (nell'app Gmail con il telefono in modalità scura Gmail capovolge i colori: testata bordeaux e riga oro restano come sul sito perché il loro colore è ripetuto come immagine a tinta unita, che Gmail non tocca; pulsante e piè di pagina restano bordeaux con le scritte chiare grazie a regole che valgono solo in Gmail, le stesse delle email del sito; con un account non Google nell'app Gmail tornano rosati ma leggibili); c'è anche la versione di solo testo.

- **Contenuto** come prima, in italiano, inglese o tedesco: codice della cassetta (stessa regola di prima), dettagli della prenotazione, come accedere alla struttura, orari, istruzioni e le tre foto (allegati come prima).
- **Indirizzi**: l'ospite legge «Via Centrale, 48» e, per il parcheggio, «Via Val Gola, 22»; ognuno è un link di Google Maps, gli stessi del sito (pagina «Come trovarci» e area clienti). Se cambiano sul sito vanno cambiati anche qui (`MAPS_STRUTTURA`, `MAPS_PARCHEGGIO`): la prova li confronta con il sito quando è impostata `LACOLUMBERA_DIR`.
- **Orari fissi**: check-in dalle 16:00 alle 00:00, check-out entro le 10:00 (`CHECKIN_OPEN_TIME`, `CHECKIN_CLOSE_TIME`, `CHECKOUT_CLOSE_TIME`): si cambiano a mano.
- **Niente risposte**: la casella che invia (`EMAIL_USER`) serve solo per gli avvisi e non viene letta. L'email chiede di non rispondere e indica telefono ed email del titolare (`CONTATTI`); non c'è un Reply-To.
- **Area clienti**: pulsante per entrare con il codice di prenotazione (anche Booking.com o Airbnb).
- Oggetto, come sul sito: `Check-in completato · La Columbera Torre · 05/11/2026` (in inglese «Check-in completed», in tedesco «Check-in abgeschlossen»).

## Numero di prenotazione nel pagamento e nell'email

- Il numero di prenotazione va nei metadati del pagamento Stripe (`numeroPrenotazione`): il sito di La Columbera lo legge da lì e nell'area clienti il riquadro diventa «Check-in completato».
- **Ospite con il numero** (dall'area clienti o scritto nel primo passo): vale quello (`numeroDa = ospite`). Dal 14/11/2026 il server lo **ricontrolla nel foglio Prenotazioni** prima di creare il pagamento (`numeroNelFoglio` in `api/crea-pagamento-stripe.js`): se non c'è, o è di una prenotazione **annullata**, non va nel pagamento e si cerca per data di arrivo e appartamento come per chi non ha il numero. Se il foglio non risponde (non configurato, errore, più di 5 secondi) il numero dell'ospite si tiene com'era: il pagamento non si blocca mai per il foglio. Prima si guardava solo la forma del numero, e chi pagava poteva portare nel pagamento il numero di un'altra prenotazione (il sito di La Columbera avrebbe segnato per quella il check-in come fatto).
- **Prenotazioni annullate** (colonna `STATO` = `ANNULLATA`): non si verificano più nel primo passo del modulo (`cercaPrenotazione` in `api/verifica-prenotazione.js`): per l'ospite è «numero non trovato» e conta tra i tentativi falliti. Con lo stesso numero scritto su due righe (annullata e poi riprenotata) vale quella attiva. Come già faceva l'abbinamento per data e appartamento e come fa il sito.
- **Ospite senza numero** («Non ho il numero di prenotazione»): al pagamento il Check-in cerca nel foglio **Prenotazioni** la riga con la stessa **data di arrivo** e lo stesso **appartamento**, non annullata (anche «da verificare»); se è **una sola** (con più righe possibili decidono le notti) usa quel numero (`numeroDa = foglio`). Se il check-in è per tutti e due gli appartamenti, se non c'è nessuna riga o ne restano più di una, o se il foglio non risponde entro 5 secondi, il pagamento parte lo stesso senza numero.
- **Email al gestore**: l'oggetto comincia con il numero, per esempio `Check-in · Prenotazione 6397656355 · Torre · 30/10/2026 (rif. ck…)`, oppure `Check-in · senza numero di prenotazione · …`; nel testo la riga «Numero prenotazione» dice anche se l'ha inserito l'ospite o se è stato trovato nel foglio. Senza numero, il check-in si può segnare fatto a mano in Gestione → Prenotazioni.
- **Dati degli ospiti nel testo dell'email, nessun PDF** (dal 14/11/2026): il riepilogo che prima arrivava in un PDF (generato da un servizio esterno) è scritto nel testo dell'email al gestore, sotto «OSPITI REGISTRATI»: per ogni ospite nome, genere, data di nascita con età e «tassabile»/«esente», cittadinanza, luogo di nascita; per il responsabile anche il documento. In allegato solo le immagini del documento. L'oggetto non porta mai dati personali. Dettagli per la privacy in `docs/gdpr/checkin-modifiche.md`.
