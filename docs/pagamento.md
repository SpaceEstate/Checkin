# Pagamento dell'imposta di soggiorno

Come sul sito di La Columbera (pagina «Conferma e paga»), l'ospite paga **dentro il modulo del check-in**, con i campi della carta di Stripe nello stile del sito.

## Come funziona

1. Ultimo passo («Riepilogo e pagamento»): l'ospite controlla il riepilogo, dichiara di aver letto l'informativa e preme **«Continua al pagamento · €…»**. I dati si salvano (come prima, temporanei) e si crea il pagamento su Stripe con l'importo ricalcolato dal server.
2. Sotto compare il riquadro **Pagamento**: importo da pagare, campi della carta (anche Apple Pay e Google Pay se attivi su Stripe), pulsante **«Paga €…»**. I numeri della carta li riceve solo Stripe. Stripe.js si carica solo a questo punto (prima la pagina non si collega a Stripe).
3. Pagamento riuscito → si apre la pagina di esito di sempre (`successo-pagamento.html`), con i dettagli e il codice della cassetta.
4. Il check-in (email all'ospite, foglio, email al gestore) si elabora **solo quando Stripe conferma il pagamento**: dal webhook `checkout.session.completed` (pagamento «paid») o, se il webhook tarda, dalla pagina di esito che lo chiede a Stripe. Un pagamento rifiutato o abbandonato non registra nulla; i dati temporanei si cancellano da soli dopo 2 ore.

- **Carta rifiutata**: il messaggio della banca compare sopra il pulsante e si riprova (anche con un'altra carta).
- **«← Modifica i dati»**: si chiudono i campi della carta e si torna al pulsante «Continua al pagamento» (un nuovo pagamento verrà creato con i dati aggiornati).
- **Dopo 30 minuti** il pagamento su Stripe scade: il riquadro si chiude e basta premere di nuovo «Continua al pagamento».
- **La banca chiede una conferma su un'altra pagina** (3D Secure con reindirizzamento): al termine si torna sulla pagina di esito.

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

Dal 31/10/2026 l'email che l'ospite riceve dopo il check-in (`api/invia-email-ospite.js`) ha lo stesso aspetto delle email del sito di La Columbera (`api/_mail.js` di quel progetto): testata bordeaux con il logo, riga oro, riepilogo a righe, pulsante bordeaux, piè di pagina scuro con i recapiti. È costruita solo con tabelle e stili in linea, così si vede uguale in Gmail, Outlook e Apple Mail; c'è anche la versione di solo testo.

- **Contenuto** come prima, in italiano, inglese o tedesco: codice della cassetta (stessa regola di prima), dettagli della prenotazione, come accedere alla struttura, orari, istruzioni e le tre foto (allegati come prima).
- **Indirizzi**: l'ospite legge «Via Centrale, 48» e, per il parcheggio, «Via Val Gola, 22»; ognuno è un link di Google Maps, gli stessi del sito (pagina «Come trovarci» e area clienti). Se cambiano sul sito vanno cambiati anche qui (`MAPS_STRUTTURA`, `MAPS_PARCHEGGIO`): la prova li confronta con il sito quando è impostata `LACOLUMBERA_DIR`.
- **Orari fissi**: check-in dalle 16:00 alle 00:00, check-out entro le 10:00 (`CHECKIN_OPEN_TIME`, `CHECKIN_CLOSE_TIME`, `CHECKOUT_CLOSE_TIME`): si cambiano a mano.
- **Niente risposte**: la casella che invia (`EMAIL_USER`) serve solo per gli avvisi e non viene letta. L'email chiede di non rispondere e indica telefono ed email del titolare (`CONTATTI`); non c'è un Reply-To.
- **Area clienti**: pulsante per entrare con il codice di prenotazione (anche Booking.com o Airbnb).
- Oggetto, come sul sito: `Check-in completato · La Columbera Torre · 05/11/2026` (in inglese «Check-in completed», in tedesco «Check-in abgeschlossen»).

## Numero di prenotazione nel pagamento e nell'email

- Il numero di prenotazione va nei metadati del pagamento Stripe (`numeroPrenotazione`): il sito di La Columbera lo legge da lì e nell'area clienti il riquadro diventa «Check-in completato».
- **Ospite con il numero** (dall'area clienti o scritto nel primo passo): vale quello (`numeroDa = ospite`).
- **Ospite senza numero** («Non ho il numero di prenotazione»): al pagamento il Check-in cerca nel foglio **Prenotazioni** la riga con la stessa **data di arrivo** e lo stesso **appartamento**, non annullata (anche «da verificare»); se è **una sola** (con più righe possibili decidono le notti) usa quel numero (`numeroDa = foglio`). Se il check-in è per tutti e due gli appartamenti, se non c'è nessuna riga o ne restano più di una, o se il foglio non risponde entro 5 secondi, il pagamento parte lo stesso senza numero.
- **Email al gestore**: l'oggetto comincia con il numero, per esempio `Check-in · Prenotazione 6397656355 · Torre · 30/10/2026 (rif. ck…)`, oppure `Check-in · senza numero di prenotazione · …`; nel testo la riga «Numero prenotazione» dice anche se l'ha inserito l'ospite o se è stato trovato nel foglio. Senza numero, il check-in si può segnare fatto a mano in Gestione → Prenotazioni.
