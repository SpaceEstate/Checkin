# Regole di lavoro – Check-in La Columbera

Questo file vale per chiunque modifichi il repository (persone e assistenti). Il progetto gemello è il sito **La Columbera** (`SpaceEstate/LaColumbera`): stesso foglio Prenotazioni, account Stripe **diversi** (vedi «Collegamenti con La Columbera»); ha un file con le stesse regole.

## 9. Preservare il codice e non introdurre regressioni

È fondamentale preservare il funzionamento attuale di entrambi i siti.

- Non riscrivere da zero file, funzioni o intere sezioni di codice che già funzionano correttamente.
- Non modificare funzionalità, flussi operativi o interfacce che non presentano problemi e che non richiedono interventi.
- Non eliminare, sostituire o semplificare codice senza averne prima compreso le dipendenze e le conseguenze.
- Non modificare API, nomi di variabili d'ambiente, configurazioni, database, webhook o integrazioni senza una motivazione tecnica precisa.
- Prima di ogni modifica, verificare quali altri componenti potrebbero essere interessati (anche nell'altro sito: vedi «Collegamenti con La Columbera»).
- Mantenere la compatibilità con l'architettura e le integrazioni esistenti.
- Evitare modifiche che possano compromettere prenotazioni, pagamenti Stripe, check-in, sincronizzazioni o dati già presenti.
- Non introdurre nuove dipendenze se non sono strettamente necessarie.
- Non modificare configurazioni di produzione, credenziali o variabili d'ambiente.
- Non effettuare deploy in produzione senza l'autorizzazione del titolare.

Ogni modifica deve essere circoscritta, motivata e accompagnata dai test necessari.

Prima di modificare una parte critica, verificare che il comportamento attuale sia documentato o coperto da test, così da poterlo preservare (tabella qui sotto). Se non lo è, scrivere prima la prova del comportamento attuale, poi la modifica.

Se non si è sicuri che una modifica sia sicura o possa introdurre regressioni, **non procedere autonomamente**: descrivere il problema e proporre la soluzione.

Priorità assoluta: migliorare sicurezza, privacy, affidabilità e prestazioni senza compromettere ciò che attualmente funziona.

Al termine di ogni intervento verificare che:

- i test precedenti continuino a passare (stessi numeri della baseline, più quelli nuovi);
- i flussi non modificati continuino a funzionare;
- non siano state introdotte regressioni;
- le modifiche siano limitate a quanto strettamente necessario.

Un test cambiato o tolto va dichiarato e motivato nel messaggio di commit; un test non si salta né si indebolisce per farlo passare.

## Parti critiche: dove stanno e chi le prova

| Parte | Codice | Prove | Documento |
|---|---|---|---|
| Pagamento dell'imposta (creazione, webhook, pagina di esito) | `api/crea-pagamento-stripe.js`, `api/stripeWebhook.js`, `api/get-session.js`, `checkin.js` | `tests/pagamenti.test.mjs`, `tests/endpoint.test.mjs` | `docs/pagamento.md` |
| Elaborazione dopo il pagamento (foglio, email, nuovi tentativi) | `api/_elabora-checkin.js`, `api/_sheet-checkin.js`, `api/_email-gestore.js` | `tests/flusso.test.mjs` | – |
| Dati temporanei, registro, pulizia (Neon PostgreSQL) | `api/_db.js`, `api/salva-dati-temporanei.js`, `api/_pulizia.js` | `tests/db.test.mjs` (con `TEST_DATABASE_URL`) | `docs/gdpr/checkin-modifiche.md` |
| Verifica del numero di prenotazione e abbinamento (foglio Prenotazioni) | `api/verifica-prenotazione.js`, `api/crea-pagamento-stripe.js` | `tests/pagamenti.test.mjs` | `docs/pagamento.md` |
| Email all'ospite dopo il pagamento (aspetto, indirizzi e link di Maps, codice della cassetta) | `api/invia-email-ospite.js` | `tests/email-ospite.test.mjs` | `docs/pagamento.md` |
| Alloggiati Web (TXT e servizio) | `api/_alloggiati*.js`, `api/_checkin-alloggiati.js`, `api/admin-alloggiati.js` | `tests/alloggiati.test.mjs` | – |
| Informativa e link | `index.html`, `successo-pagamento.html` | `tests/informativa.test.mjs` | `docs/gdpr/` |
| Scansione facoltativa dei documenti (lettura nel browser, flag `SCANSIONE_DOCUMENTI`, spenta di default) | `scansione/*.js`, `scansione/vendor/` (librerie, impronte in `impronte.sha256`), sezione «SCANSIONE DEL DOCUMENTO» di `checkin.js` | `tests/scansione.test.mjs`, `tests/browser/scansione.browser.cjs` | `docs/scansione-documenti.md` |

Il sito pubblicato è la cartella `public/`, riempita da `build.sh`: un file nuovo da servire va aggiunto lì. La cartella `scansione/` (14 MB di librerie) la copia `build.sh` a ogni build e non va messa nel repository dentro `public/`.

## Collegamenti con La Columbera

Una modifica a uno di questi punti va verificata anche nel repository LaColumbera.

- **Account Stripe diversi** (05/11/2026: il check-in con le chiavi reali, il sito ancora con quelle di prova; il titolare userà lo stesso account per entrambi quando il sito sarà ultimato). I pagamenti del check-in portano nei metadati `dataCheckin` e `numeroPrenotazione`: il sito li legge (`api/_checkin.js` di LaColumbera, con un secondo webhook registrato su questo account) per mostrare «Check-in completato» nell'area clienti. Il webhook di questo progetto ignora i pagamenti del sito. Nomi e significato dei metadati non vanno cambiati da una parte sola.
- **Foglio Prenotazioni.** È il registro delle prenotazioni del sito: qui si legge soltanto (`SHEET_ID_PRENOTAZIONI`, in `api/verifica-prenotazione.js`, usato anche da `api/crea-pagamento-stripe.js`). I dati del check-in si scrivono in un altro foglio (`SHEET_ID`, `api/_sheet-checkin.js`); `tests/endpoint.test.mjs` controlla che nessun altro file scriva su Google Sheets.
- **Alloggiati Web.** Il tracciato è un porting di `api/_alloggiati.js` di LaColumbera: con `LACOLUMBERA_DIR` il test confronta i due moduli.

## Come verificare (nessuna rete, nessun servizio reale)

Le stesse prove partono da sole su GitHub a ogni push e a ogni pull request (`.github/workflows/prove.yml`, scheda «Actions»): una spunta rossa vuol dire che qualcosa si è rotto e va sistemato prima di unire o pubblicare.

Per non lasciare `api/node_modules` nel repository, le prove si eseguono su una copia:

```bash
cp -r . /tmp/ck && cd /tmp/ck/api && npm ci && npm test      # npm ci installa esattamente le versioni di api/package-lock.json
```

Facoltativi, per non saltare nessuna prova:

- `LACOLUMBERA_DIR=/percorso/di/LaColumbera`: confronto del tracciato Alloggiati con il modulo originale.
- `TEST_DATABASE_URL=postgres://…`: un database PostgreSQL **di prova locale, mai quello di produzione**. `api/_db.js` si collega solo con SSL (`ssl: 'require'`), quindi il server di prova deve avere SSL attivo (basta un certificato autofirmato: `ssl=on`, `server.crt`, `server.key`).

### Prove della scansione nel browser

Chromium vero, OCR vero con i file del sito, documenti **sintetici** (`tests/browser/documenti-sintetici/`, rigenerabili con `node tests/browser/genera-documenti.cjs`), API finte. Su GitHub girano nel job «scansione». Playwright si installa fuori dal repository:

```bash
npm install --prefix /tmp/pw playwright@1.63.0 && /tmp/pw/node_modules/.bin/playwright install --with-deps chromium
NODE_PATH=/tmp/pw/node_modules node --test tests/browser/scansione.browser.cjs     # registro di rete e tempi in tests/browser/risultati/ (escluso da git)
```

Per provare il flusso da ospite senza dati veri: `node tests/browser/server-prova.cjs 8765 attiva` e aprire `http://127.0.0.1:8765/` (prenotazione `PROVA1`). Nel repository non vanno mai immagini di documenti reali (`.gitignore`).

## Baseline (06/11/2026, dopo la lettura per zone delle foto vere: 6 prove nuove in `tests/scansione.test.mjs`, 1 in `tests/browser/scansione.browser.cjs`)

| Prova | Risultato |
|---|---|
| `npm test` senza variabili | 96 ok, 0 falliti, 4 saltati |
| con `LACOLUMBERA_DIR` e `TEST_DATABASE_URL` (PostgreSQL 16 locale con SSL) | 100 ok, 0 falliti, 0 saltati (verificato il 06/11/2026 con il solo `LACOLUMBERA_DIR`: 97 ok, 3 saltati, quelli del database; le prove nuove non usano il database) |
| `tests/browser/scansione.browser.cjs` (Chromium, Playwright 1.63.0) | 14 ok, 0 falliti, 0 saltati |

Prima della lettura per zone (commit `f61c70b`): 90 ok e 4 saltati, 94 ok con le variabili; 13 prove nel browser. Prima della scansione dei documenti (commit `aca8d57`): 69 ok e 4 saltati; 73 ok con le variabili. Prima dei nomi ufficiali dei paesi (commit `36f8683`): 68 ok e 4 saltati; 72 ok con le variabili. Prima della correzione degli Stati (commit `b152d3e`): 67 ok e 4 saltati; 71 ok con le variabili. Prima del selettore della lingua con bandiere disegnate (commit `262b272`): 66 ok e 4 saltati; 70 ok con le variabili. Prima del PDF di riepilogo nello stile del sito (commit `1586d31`): 65 ok e 4 saltati; 69 ok con le variabili. Prima dell'email nel pagamento nella pagina (commit `ae993ac`): 63 ok e 4 saltati; 67 ok con le variabili. Prima della prova del pagamento nella pagina lato browser (commit `cb17045`): 62 ok e 4 saltati; 66 ok con le variabili. Prima delle scritte in oro (commit `853a5ee`): 61 ok e 4 saltati; 65 ok con le variabili. Prima delle regole per Gmail (commit `c37476d`): 60 ok e 4 saltati; 64 ok con le variabili. Prima della nuova email all'ospite (commit `63e4da8`): 50 ok e 3 saltati; 53 ok con le variabili.

Quando un intervento aggiunge prove, aggiornare questa tabella nello stesso commit.
