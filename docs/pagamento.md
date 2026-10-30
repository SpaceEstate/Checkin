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
