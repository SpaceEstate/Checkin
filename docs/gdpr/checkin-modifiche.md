# Check-in online: modifiche per minimizzazione dati e Alloggiati Web

Branch `gdpr/checkin-semplificazione`. È il primo di tre interventi: 1) check-in (questo), 2) sicurezza accessi del sito principale, 3) informativa e documentazione GDPR. Questo documento serve come base per il terzo intervento.

Il documento descrive cosa fa il codice. Non attesta la conformità al GDPR: per questo servono anche le verifiche organizzative, contrattuali e sugli account reali elencate più sotto.

## ⚠️ Aggiornamento intervento 3 (branch `gdpr/informativa`) — cosa vale oggi

Questa sezione corregge le parti del documento non più attuali. Le ho verificate sul codice di `main` (commit `431feb0`).

- **Il PDF di riepilogo è di nuovo attivo**, su richiesta del gestore.
  - Lo genera `api/_pdf-riepilogo.js` tramite **Browserless**: le frasi "Browserless non è più usato" e "Rimossi … il PDF" del § 2 e del § 4 non valgono più.
  - Browserless riceve l'HTML con i dati anagrafici di tutti gli ospiti, senza immagini.
  - L'endpoint nel codice è `production-ams.browserless.io` (Amsterdam, UE); con `BROWSERLESS_URL` si può scegliere Londra o San Francisco (USA, trasferimento extra SEE).
  - `BROWSERLESS_API_TOKEN` resta necessaria.
- **L'email al gestore contiene le immagini del documento e il PDF** (`_email-gestore.js`).
- **Il riquadro finale sulla verifica dell'identità è stato rimosso**, su richiesta del gestore. Resta la nota accanto al caricamento del documento. Le chiavi `stepFinal.identita*` in `i18n.js` non sono più usate.
- **Informativa:** `https://la-columbera.vercel.app/privacy.html` esiste (repo LaColumbera). Nell'intervento 3:
  - è stata riscritta;
  - nel modulo sono stati aggiunti un'informativa breve, il link visibile in ogni passaggio e nella pagina di successo, e testi corretti per la casella di presa visione (id `privacy-presa-visione`, non inviata né registrata);
  - sono stati tolti i preconnect verso Stripe.
- **Inventario completo** dei trattamenti, dei fornitori, della conservazione e delle verifiche: `LaColumbera/docs/gdpr/inventario-trattamenti.md`.

## ⚠️ Aggiornamento 27/10/2026 — scelta del gestore: si torna al foglio Google

La prova di configurazione (`prova-drive`) ha restituito `HTTP 403 · storageQuotaExceeded`: l'account di servizio non può salvare file nel "Il mio Drive" di un account Google personale. Il gestore ha quindi deciso di **mantenere il flusso precedente per il TXT**:

- dopo il pagamento i dati degli ospiti vengono **scritti di nuovo nel foglio Google `SHEET_ID`**, con le stesse colonne e gli stessi valori della versione precedente (`api/_sheet-checkin.js`); da lì lo **script Apps Script del gestore** crea il TXT nella cartella Drive "Check-in › Polizia di Stato", come prima;
- **non è più attivo** il salvataggio del TXT su Drive da parte del check-in. I moduli `_checkin-alloggiati.js`, `_drive.js` e le azioni admin collegate restano nel codice ma il flusso non li usa (la pre-verifica del comune di nascita resta attiva);
- **restano in vigore** le altre modifiche: niente PDF, email al gestore con sole immagini, metadati Stripe senza dati anagrafici, dati temporanei minimizzati e cancellati appena il foglio è scritto e l'email è partita, log senza dati personali, avvisi sulla verifica de visu.

Conseguenza privacy da riportare nell'intervento 3: **i dati anagrafici degli ospiti tornano a essere duplicati nel foglio Google** (e nei TXT creati dallo script). La loro conservazione e cancellazione non è gestita dal codice del check-in ma dal foglio e dallo script del gestore: vanno definite e applicate lì (es. cancellazione delle righe e del TXT dopo la ricevuta Alloggiati). Le parti di questo documento su Drive (§ 2–8) descrivono la soluzione non attivata.

## ⚠️ Aggiornamento 30/10/2026 — collegamento con l'area clienti di La Columbera

- **Arrivo dall'area clienti.** Il riquadro «Check-in online» dell'area clienti apre `index.html#k=<numero prenotazione>&lang=<it|en|de>`. Il frammento `#` non arriva a nessun server (né a GitHub Pages né a Vercel) e la pagina lo toglie subito dall'indirizzo; il numero si verifica da solo e, se la prenotazione c'è, si passa direttamente ai dati del soggiorno (`daAreaClienti()` in `checkin.js`). Se non si trova resta il primo passo, con il numero già scritto.
- **Numero di prenotazione nei metadati Stripe.** Solo se l'ospite ha verificato la prenotazione nel primo passo, `numeroPrenotazione` va nei metadati della sessione e del pagamento (`crea-pagamento-stripe.js`, controllato: lettere e cifre maiuscole, al più qualche trattino, massimo 40 caratteri; altrimenti non c'è). Non è un dato anagrafico: è il riferimento della prenotazione, che Stripe già collega all'email del pagante. Serve al sito di La Columbera, che riceve gli eventi dello stesso account Stripe, per sapere che il check-in di quella prenotazione è fatto (riquadro «Check-in completato» e codice della cassetta nell'area clienti, `LaColumbera/api/_checkin.js`). Chi sceglie «Non ho il numero di prenotazione» non lo porta.
- **Ricerca del numero** (`verifica-prenotazione.js`): prima la corrispondenza esatta, poi anche senza spazi, punti e trattini (Booking mostra «6877.180.932», l'email di La Columbera il codice a gruppi); se così le righe possibili sono più di una, nessuna.

---

## 1. Fonti consultate e cosa dicono

Le fonti sono state lette il 27/10/2026. Qui si riporta solo ciò che è stato effettivamente trovato.

| Fonte | Cosa dice (per quanto riguarda il check-in) |
|---|---|
| **Garante Privacy, nota di chiarimento del 29/04/2026** (docweb 10244289) | Base giuridica: **art. 6.1.c GDPR** (obbligo di legge). L'obbligo dell'art. 109 TULPS riguarda la *comunicazione* dei dati, non la loro conservazione presso la struttura. Il gestore non deve fare né conservare copie dei documenti (analogiche o digitali) oltre quanto serve per inserire i dati in Alloggiati Web. Le copie digitali vanno cancellate **non appena il sistema genera la ricevuta** di avvenuta comunicazione. La **ricevuta va conservata 5 anni**. Raccomanda di non fotografare i documenti con dispositivi mobili e di non usare servizi di messaggistica istantanea. Se al check-in si usano dispositivi che possono acquisire copie digitali, gli ospiti vanno informati che le immagini non saranno conservate. Servono accordi ex art. 28 con i fornitori che raccolgono o gestiscono i dati. **L'email non è citata.** Il riassunto ricevuto con la richiesta corrisponde alla fonte. |
| **Consiglio di Stato, Sez. III, sent. n. 9101 del 21/11/2025** (scheda dell'Ufficio massimario) | Il gestore deve verificare **di persona** che le generalità degli ospiti corrispondano ai documenti, almeno per quanto riguarda la fotografia. Il "check-in da remoto" non basta. Una verifica a distanza è ammessa solo con dispositivi di videocollegamento installati dal gestore all'ingresso, idonei ad accertare *hic et nunc* la corrispondenza tra ospite e titolare del documento (gli esempi citati sono uno spioncino digitale o un QR code che produce un fermo immagine), con il documento esibito o trasmesso all'arrivo. Il riassunto ricevuto corrisponde alla fonte. |
| **GDPR (Reg. UE 2016/679)**, artt. 5, 25, 28, 32 | Da EUR-Lex, tramite lo strumento disponibile, sono stati letti solo i considerando (39, 74, 78, 81, 83): il testo degli articoli era troncato. I principi applicati qui sono quelli noti degli articoli: minimizzazione e limitazione della conservazione (art. 5.1.c ed e), integrità e riservatezza (art. 5.1.f), privacy by design e by default (art. 25), responsabili del trattamento (art. 28), sicurezza (art. 32). **Il testo degli articoli va ricontrollato direttamente su EUR-Lex nell'intervento 3.** |

In questo documento le **prescrizioni normative** (quanto sopra) sono tenute separate dalle **scelte tecniche** (§ 4–7), che sono decisioni di progetto e non obblighi di legge, e dalle **verifiche su account reali** (§ 10), che dal codice non si possono fare.

---

## 2. Cosa è cambiato

| Prima | Dopo |
|---|---|
| Dopo il pagamento i dati di ogni ospite venivano scritti in un **Google Sheet** (riga per ospite, con il documento del responsabile). | **Rimosso.** Non si scrivono più dati degli ospiti su Google Sheets. La lettura del foglio prenotazioni (`verifica-prenotazione.js`) non è cambiata. |
| Veniva generato un **PDF di riepilogo** con tutti gli ospiti, tramite Browserless (servizio esterno a cui si mandava l'HTML con i dati). Il PDF partiva per email al gestore insieme alle foto. Se il PDF falliva, la stessa email conteneva l'elenco ospiti nel corpo. | **Rimossi** `api/genera-pdf-email.js`, il PDF, Browserless e l'elenco ospiti. Al gestore va **solo l'immagine del documento** (fronte ed eventuale retro), con oggetto e corpo generici. |
| I **metadati Stripe** contenevano nome, cognome, sesso, data e luogo di nascita, età e cittadinanza del responsabile. | Restano solo dati tecnici e del soggiorno: `dataCheckin, appartamento, numeroOspiti, numeroNotti, tipoGruppo, totale, timestamp, lingua, temp_session_id`. Anche la richiesta del browser a `crea-pagamento-stripe` non contiene più nomi, documenti né immagini. |
| `get-session` restituiva i dati del responsabile presi da Stripe. | Rimossi: la pagina di successo non li usava. |
| I dati temporanei (Neon) avevano una durata di 4 ore e venivano puliti su circa il 10% delle richieste. Erano leggibili via GET da un endpoint e ammettevano la sovrascrittura (upsert). | Si salvano solo i campi necessari, con una durata di 2 ore. Vengono **cancellati appena non servono più**. La pulizia avviene a ogni salvataggio, a ogni webhook e con un cron giornaliero. **GET rimosso**, niente sovrascrittura. |
| Nessun file Alloggiati: i dati venivano ricopiati a mano. | Il **TXT Alloggiati Web** viene generato automaticamente dopo il pagamento e salvato su **Google Drive**, pronto per il **caricamento manuale**. Nessun invio automatico. |
| Nessun avviso sulla verifica dell'identità. | Due avvisi nel modulo (IT/EN/DE) spiegano che il modulo e la foto non bastano e che serve la verifica di persona all'arrivo. Aggiunto il link all'informativa. |

---

## 3. Flusso attuale

1. **Modulo (browser)**. L'ospite compila i dati. Prima del pagamento i soli campi anagrafici (mai le immagini) vengono pre-verificati da `api/verifica-dati-alloggiati.js`, che usa le tabelle ufficiali. Il modulo si blocca solo per problemi che l'ospite può correggere: comune di nascita non trovato (con suggerimenti), caratteri non ammessi o lunghezza eccessiva in nome, cognome o numero documento. Se la verifica non è disponibile si prosegue. L'endpoint non salva nulla e non scrive dati nei log.
2. **Salvataggio temporaneo** (`api/salva-dati-temporanei.js` → Neon `temporary_sessions`). Si salvano solo i campi necessari (§ 4). Le immagini sono controllate per tipo reale (firma dei byte: JPEG, PNG, WebP, PDF), numero (massimo 2) e dimensione (massimo 1 MB per lato). Scadenza: 2 ore.
3. **Pagamento Stripe** (`api/crea-pagamento-stripe.js`). Metadati minimi. Importo ricalcolato dal server come prima.
4. **Webhook** (`api/stripeWebhook.js`). Firma Stripe verificata come prima, poi parte `api/_elabora-checkin.js`. I passi sono idempotenti e lo stato è registrato in `checkin_adempimenti`:
   1. email di benvenuto all'ospite con i codici della cassetta (invariata nel contenuto). Riceve solo i dati del soggiorno e nome e cognome del responsabile per il saluto;
   2. **TXT Alloggiati**: validazione con le tabelle ufficiali. Se è valido, viene salvato su Drive con verifica dell'MD5. Se non è valido, il file non viene generato;
   3. **email al gestore** con le sole immagini del documento;
   4. **cancellazione dei dati temporanei** appena il TXT è su Drive e l'email al gestore è partita.

   In caso di errore temporaneo (rete, Drive, SMTP, tabelle non raggiungibili) il webhook risponde 500 e Stripe ritenta. Un nuovo tentativo rifà solo i passi non riusciti, senza duplicare email o file. Due consegne contemporanee dello stesso evento sono escluse da un lease.
5. **Il gestore** verifica di persona l'identità all'arrivo, carica a mano il TXT sul portale e controlla la ricevuta. Poi elimina il TXT da Drive e le email con le immagini (§ 8).

---

## 4. Dati e servizi coinvolti

| Dato | Dove | Perché | Note |
|---|---|---|---|
| Per ogni ospite: cognome, nome, sesso, data di nascita, cittadinanza, Stato di nascita, comune e provincia (se nato in Italia). Per il responsabile anche tipo, numero e luogo di rilascio del documento | Neon `temporary_sessions` (JSONB) | Generare il TXT Alloggiati | Scartati: età, email nel modulo, totale, nome originale dei file e altri campi |
| Immagini del documento del responsabile (fronte ed eventuale retro, compresse nel browser) | Neon `temporary_sessions` (base64) | Inviarle al gestore (modalità temporanea, § 7) | Mai in URL, metadati Stripe, log o messaggi di errore |
| TXT Alloggiati (tutte le schedine) | Google Drive, cartella `GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID` | Caricamento manuale sul portale | Nome file `alloggiati_<data-arrivo>_<checkinId>.txt`, senza nomi né numeri di documento |
| Immagini del documento | Email al gestore (`EMAIL_PROPRIETARIO`) tramite Gmail SMTP (`EMAIL_USER`) | Modalità temporanea | Allegati `documento-fronte.<ext>` e `documento-retro.<ext>` |
| Email dell'ospite | Raccolta da Stripe Checkout (come prima) | Ricevuta Stripe ed email di benvenuto | Nei log è mascherata |
| Nome e cognome del responsabile | Payload interno all'endpoint `invia-email-ospite` | Saluto nell'email di benvenuto | Come prima. Nessun documento, nessuna data di nascita |
| Date di nascita (senza nomi) | Richiesta a `crea-pagamento-stripe` (non salvate su Stripe) | Il server ricalcola la tassa (età ≥ 4 anni) | |
| Registro tecnico: `checkin_id` (hash della sessione Stripe), id della sessione Stripe, `temp_session_id`, data di arrivo, stati, nome e ID del file su Drive, hash del TXT, codici di errore (senza valori) | Neon `checkin_adempimenti` | Idempotenza, promemoria di cancellazione, diagnosi | Nessun dato anagrafico in chiaro. Gli identificativi sono pseudonimi |
| Tabelle ufficiali Alloggiati (Luoghi, Tipi_Documento, Tipi_Alloggiato) | Neon `alloggiati_tabelle` + memoria | Codici del tracciato | Dati pubblici di riferimento |
| Contatore dei tentativi falliti di verifica del numero di prenotazione: hash troncato dell'IP (`sha256('ip|'+ip)`, 24 caratteri), numero di tentativi, scadenza | Neon `limiti_tentativi` | Protezione da chi prova numeri a raffica (10 tentativi falliti ogni 15 minuti per IP, come sul sito) | Nessun IP in chiaro, nessun numero di prenotazione. Il numero cercato e i dati trovati non vanno più nei log |

**Servizi esterni coinvolti** (da verificare ai fini dell'art. 28 e dell'informativa: § 10). Vercel (funzioni e log), Neon (database), Stripe, Google (Drive, Gmail SMTP e Sheets in sola lettura per le prenotazioni), GitHub Pages (hosting del modulo), servizio Alloggiati Web (solo lettura delle tabelle, se configurato), Google Fonts (caricato da `index.html`: trasferisce a Google l'indirizzo IP del visitatore; non toccato in questo intervento). **Browserless non è più usato.**

---

## 5. Conservazioni realmente applicate dal codice

| Dato | Durata applicata | Meccanismo |
|---|---|---|
| Dati temporanei di un check-in **non pagato** | Scadono dopo **2 ore**. La cancellazione fisica avviene al primo tra: un nuovo salvataggio di qualunque ospite, un webhook, il cron giornaliero. Massimo effettivo: circa **2 h + 24 h** se non arrivano altre richieste | `pulisciScaduti()` + Vercel Cron `17 3 * * *` (03:17 UTC) su `/api/admin-alloggiati` (GET senza azione, autenticata con `CRON_SECRET`) |
| Dati temporanei di un check-in **pagato**, tutto riuscito | **Cancellati subito**, appena il TXT è su Drive e l'email al gestore è partita | `_elabora-checkin.js` passo 4 |
| Dati temporanei di un check-in pagato con un passo non riuscito (Drive, email, tabelle) o con TXT non valido o Drive non configurato | Fino al successo, ma **al massimo 72 ore** dalla prima elaborazione (più il ritardo del cron). Dopo vengono cancellati comunque, anche se il TXT non è stato salvato | Scadenza allungata una sola volta, fino a `creazione registro + 72 h` |
| Registro tecnico `checkin_adempimenti` | Finché il TXT è su Drive e non risulta eliminato (fa da promemoria). Poi **30 giorni** dall'eliminazione da Drive o dall'ultimo aggiornamento | Cron giornaliero |
| TXT su Google Drive | **Nessuna cancellazione automatica.** Resta finché il gestore non lo elimina con la procedura del § 8, dopo aver verificato la ricevuta | Azione `elimina-txt` |
| Email al gestore con le immagini | **Fuori dal controllo del sistema.** Restano nella casella del gestore, in "Posta inviata" della casella mittente, nel cestino ed eventuali backup finché il gestore non le elimina | Promemoria nel corpo dell'email (§ 8) |
| Tabelle ufficiali | 24 h (fonte servizio) oppure fino alla sostituzione (fonte manuale) | |
| Contatore dei tentativi falliti (`limiti_tentativi`) | **15 minuti** dal primo tentativo fallito; la riga scaduta si cancella con la pulizia giornaliera | `verifica-prenotazione.js`, `_db.js` (`pulisciScaduti`) |
| Metadati Stripe | Secondo le regole di Stripe (non verificabile dal codice). Ora senza dati anagrafici | |
| Log di Vercel | Secondo il piano Vercel (non verificabile dal codice). I nuovi log non contengono dati anagrafici, base64, numeri di documento, contenuti del TXT né oggetti completi di sessione o prenotazione | |

**Limiti dichiarati.** Con il piano Vercel Hobby i cron girano una volta al giorno e l'orario non è preciso. Il piano in uso non è verificabile dal codice. Una cancellazione "allo scadere esatto" non è quindi garantita: la scadenza è garantita in lettura (un dato scaduto non viene più letto né usato), la cancellazione fisica avviene entro circa 24 ore.

---

## 6. TXT Alloggiati Web (scelte tecniche)

- **Formato.** È il tracciato del progetto principale, a 168 caratteri per record (account STANDARD). `api/_alloggiati.js` è un **porting fedele** (solo sintassi ESM) di `LaColumbera/api/_alloggiati.js` (commit `8923092`): stesso layout, stesse regole per capofamiglia e capogruppo (17 → 19, 18 → 20), stesse regole su documento obbligatorio o vuoto, date `gg/mm/aaaa` e giorni di permanenza su 2 cifre (massimo 30). `tests/alloggiati.test.mjs` confronta il risultato con il modulo originale quando `LACOLUMBERA_DIR` punta al repo LaColumbera: righe, hash e codici di errore risultano identici. **Se il formato cambia in LaColumbera, la stessa modifica va riportata qui.**
- **Tipo alloggiato.** Un solo ospite → 16. Con più ospiti si usa la scelta fatta nel modulo: "Famiglia" → 17 + 19, "Gruppo" → 18 + 20. Senza scelta il TXT non viene generato.
- **Codici.** Si cercano nelle **tabelle ufficiali**, per nome esatto normalizzato (maiuscole, senza accenti e punteggiatura, come `buildTable` e `search` di LaColumbera). Non ci sono liste statiche né ricerche per somiglianza. Un valore non trovato o ambiguo blocca il TXT. Per i comuni si filtra anche per provincia. Se ci sono più voci con lo stesso nome si preferisce quella senza data di fine validità; se resta ambiguità il TXT non viene generato.
- **Tabelle.** Arrivano dal servizio Alloggiati (metodo `Tabella`, con le credenziali `ALLOGGIATI_*`) oppure dal caricamento manuale del CSV ufficiale (`carica-tabella`). La cache è su Neon e dura 24 h. Da questo progetto **non si possono chiamare Test né Send**: quelle funzioni non sono state copiate.
- **Validazione.** I controlli sono quelli di LaColumbera (livelli 1 e 2). Ci sono avvisi non bloccanti (es. lettere non ASCII, arrivo più vecchio di 24 ore) e un avviso aggiuntivo: per un documento rilasciato in Italia il modulo raccoglie solo lo Stato, quindi il luogo di rilascio è "Italia". **Da verificare sul portale** se per i documenti italiani è richiesto il comune di rilascio.
- **File.** Separatore di riga `CRLF` e `CRLF` finale, UTF-8 senza BOM. Il parser di LaColumbera accetta sia LF sia CRLF. **Da verificare al primo caricamento manuale sul portale.**
- **Mai "inviato".** Gli stati possibili sono `salvato_drive`, `non_valido`, `drive_non_configurato`, `errore_drive`, `drive_conflitto`, `tabelle_non_disponibili`, `tabelle_non_configurate`, `dati_non_disponibili`. Nessuno indica un invio o una ricevuta. La descrizione del file su Drive dice: "da caricare MANUALMENTE … NON è stato inviato".

---

## 7. Email al gestore con l'immagine del documento: modalità temporanea

**Mantenuta su indicazione del gestore, in via temporanea.** Richiede una valutazione separata di sicurezza e di gestione delle copie. Questo documento non afferma che sia certamente vietata, né che la cancellazione manuale elimini ogni rischio.

Cosa fa il codice: allega solo le immagini (nomi generici). Oggetto e corpo contengono un riferimento tecnico, lo stato del TXT e il promemoria. Il destinatario è quello già configurato (`EMAIL_PROPRIETARIO`). Le immagini non finiscono in URL, parametri, log, metadati Stripe o messaggi di errore.

Rischi residui:

- Copie fuori dal controllo del sistema: casella del gestore, "Posta inviata" della casella mittente (`EMAIL_USER`), cestino, backup del provider, dispositivi sincronizzati, eventuali download.
- La nota del Garante raccomanda di evitare foto con dispositivi mobili e messaggistica istantanea: le foto sono spesso scattate con lo smartphone dell'ospite. L'email non è citata dalla nota.
- Transito tramite SMTP di Gmail: la cifratura end-to-end non è garantita.

**Alternativa futura proposta (non implementata).** In ordine di minor rischio:

1. **Non raccogliere più la foto.** I dati sono già inseriti dall'ospite e l'identità va comunque verificata di persona sul documento originale (CdS 9101/2025). La foto non è necessaria per compilare Alloggiati.
2. Se la foto serve, **niente email**: l'immagine resta cifrata nel database per poche ore ed è visibile solo da una pagina admin autenticata. Viene cancellata automaticamente alla conferma della verifica o allo scadere del termine.

---

## 8. Procedure manuali a carico del gestore

Endpoint: `https://checkin-six-coral.vercel.app/api/admin-alloggiati`. Autenticazione con l'header `x-admin-secret` (valore della variabile `ADMIN_SECRET`, da non scrivere mai in URL o documenti).

```bash
# stato della configurazione (mostra solo se le variabili sono presenti, mai i valori)
curl -s -H "x-admin-secret: $ADMIN_SECRET" "https://checkin-six-coral.vercel.app/api/admin-alloggiati?azione=stato"
# elenco dei check-in con lo stato del TXT (senza dati anagrafici)
curl -s -H "x-admin-secret: $ADMIN_SECRET" "https://checkin-six-coral.vercel.app/api/admin-alloggiati?azione=elenco"
```

**A. Per ogni arrivo**

1. Verifica l'identità **di persona** sui documenti originali di tutti gli ospiti (oppure con un videocollegamento in tempo reale idoneo, nei limiti della sentenza).
2. Scarica il TXT dalla cartella Drive e caricalo a mano sul portale Alloggiati Web. Controlla l'esito e la **ricevuta**.
3. **Conserva la ricevuta per 5 anni** (nota del Garante). Il sistema non la gestisce.

**B. Dopo aver verificato la ricevuta: cancellazione del TXT da Drive**

```bash
curl -s -X POST -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" \
  -d '{"azione":"elimina-txt","checkinId":"ck…","conferma":"RICEVUTA_VERIFICATA"}' \
  https://checkin-six-coral.vercel.app/api/admin-alloggiati
```

Il sistema **non verifica la ricevuta**: registra la tua conferma ed elimina il file. Senza `conferma` non elimina nulla. Elimina anche eventuali copie del TXT scaricate sul tuo dispositivo.

**C. Dopo aver verificato la ricevuta: cancellazione delle email con le immagini**

Elimina l'email e gli allegati dalla casella del gestore, da "Posta inviata" della casella mittente (`EMAIL_USER`), dal **Cestino** di entrambe e da ogni copia scaricata o sincronizzata. Il sistema non può farlo.

**D. Se il TXT non è stato salvato** (stato diverso da `salvato_drive`, entro 72 ore dal pagamento)

- `drive_non_configurato` o `errore_drive`: azione `scarica-txt` (`{"azione":"scarica-txt","checkinId":"ck…"}`; aggiungi `"formato":"file"` per ricevere il file).
- `non_valido`: azione `bozza`, che restituisce i campi e i problemi per completare la comunicazione a mano (portale o sezione Adempimenti del sito).
- Per ripetere i passi non riusciti: `GET /api/retry-email-from-stripe?session_id=cs_…` con l'header `x-admin-secret`.
- Chiusa la pratica, puoi cancellare subito i dati rimasti: `{"azione":"elimina-dati-temporanei","checkinId":"ck…","conferma":"ELIMINA"}`.

**Verifica della configurazione senza aspettare un check-in:** azioni `prova-drive` (carica, verifica ed elimina un file di prova senza dati personali) e `prova-tabelle` (legge le tabelle ufficiali e le mette in cache).

**E. Tabelle ufficiali senza credenziali del servizio nel progetto Checkin.** Scarica dal portale il CSV di Luoghi, Tipi_Documento e Tipi_Alloggiato e caricalo con `{"azione":"carica-tabella","nome":"Luoghi","csv":"…"}`. Va ricaricato quando il portale aggiorna le tabelle.

---

## 9. Configurazione (solo nomi delle variabili, nessun valore)

| Variabile | Stato | Uso |
|---|---|---|
| `GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID` | **nuova, da creare** | ID della cartella Drive privata per i TXT |
| `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` | esistenti (account di servizio già usato per Sheets) | Drive. Serve la **Google Drive API attiva** nel progetto Google Cloud e la cartella **condivisa con l'account di servizio come Editor**. Ambito OAuth `drive`: l'accesso reale è limitato a ciò che è condiviso con l'account di servizio, quindi condividi con lui **solo** la cartella dei TXT (oltre ai fogli già usati) |
| `ALLOGGIATI_UTENTE`, `ALLOGGIATI_PASSWORD`, `ALLOGGIATI_WSKEY` (facoltativa `ALLOGGIATI_URL`) | da decidere | Lettura automatica delle tabelle ufficiali. In alternativa: caricamento manuale (§ 8.E) |
| `CRON_SECRET` | consigliata, nuova | Protegge il cron di pulizia |
| `DATABASE_URL` / `POSTGRES_URL`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_PROPRIETARIO`, `ADMIN_SECRET`, `INTERNAL_API_SECRET`, `STRIPE_*`, `SHEET_ID*`, `CODICE_CASSETTA_*` | esistenti, invariate | |
| `BROWSERLESS_API_TOKEN` | **non più usata** | Si può rimuovere da Vercel dopo il merge |

**Limite Vercel Hobby: massimo 12 funzioni per deployment.** Con questo intervento la cartella `api/` ne contiene esattamente 12 (i file con prefisso `_` non contano): per questo la pulizia programmata è dentro `admin-alloggiati.js` e non in un endpoint separato. Una nuova funzione richiederà di accorparne un'altra o di passare a un piano superiore.

`SHEET_ID` va mantenuta: `verifica-prenotazione.js` la usa come ripiego se manca `SHEET_ID_PRENOTAZIONI`.

---

## 10. Verifiche che richiedono accesso ad account reali (non eseguite)

- **Drive**: un account di servizio non ha spazio di archiviazione proprio. In una cartella del "Mio Drive" di un account Gmail personale il caricamento può fallire (`storageQuotaExceeded`): in quel caso serve un Drive condiviso (Google Workspace) o un'altra soluzione. Il codice riporta l'errore e non dichiara successi. Da provare con una cartella di test.
- La cartella Drive non deve essere condivisa pubblicamente né "con chiunque abbia il link".
- **Formato TXT** (separatore di riga, comune di rilascio per i documenti italiani, corrispondenza tra i nomi degli Stati del modulo e la tabella ufficiale, es. "Stati Uniti" o "Regno Unito"): da verificare con un primo caricamento di prova sul portale. Gli Stati non trovati bloccano il TXT (stato `non_valido`) e vanno gestiti a mano. Se succede spesso, conviene allineare l'elenco del modulo ai nomi ufficiali.
- **Piano Vercel** (frequenza del cron, durata dei log) e regole di conservazione di Neon, Stripe e Gmail.
- **Contratti e DPA ex art. 28** con Vercel, Neon, Google, Stripe, GitHub e Alloggiati (se applicabile). Il codice non lo può stabilire.
- **Dati storici** (non toccati dal codice): righe già presenti nel Google Sheet del check-in, PDF ed email già inviati al gestore, metadati `resp_*` delle sessioni Stripe passate, account Browserless. Vanno valutati e, se il caso, eliminati a mano.
- **Link all'informativa** `https://la-columbera.vercel.app/privacy.html`: la pagina sarà creata nell'intervento 3. Fino ad allora il link dà 404. Anche il testo della casella "Dichiaro di aver letto l'informativa…" va rivisto nell'intervento 3 (base giuridica art. 6.1.c, non il consenso).
- **Adempimento organizzativo**: se non è disponibile una verifica di persona (o un videocollegamento idoneo) all'arrivo, l'obbligo di identificazione non è assolto dal modulo. Va organizzato fuori dal sistema.

---

## 11. Test

`cd api && npm install && npm test`. Opzioni:

- `LACOLUMBERA_DIR=/percorso/LaColumbera` abilita il confronto con il modulo originale;
- `TEST_DATABASE_URL=postgres://…` abilita i test dello store PostgreSQL. **Solo un database di prova, mai quello di produzione.**

Tutti i dati dei test sono di fantasia, comprese le tabelle sintetiche con codici inventati. Non si contatta nessun servizio reale.
