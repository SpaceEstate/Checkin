# Regole di lavoro – Check-in La Columbera

Questo file vale per chiunque modifichi il repository (persone e assistenti). Il progetto gemello è il sito **La Columbera** (`SpaceEstate/LaColumbera`): stesso account Stripe, stesso foglio Prenotazioni; ha un file con le stesse regole.

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
| Alloggiati Web (TXT e servizio) | `api/_alloggiati*.js`, `api/_checkin-alloggiati.js`, `api/admin-alloggiati.js` | `tests/alloggiati.test.mjs` | – |
| Informativa e link | `index.html`, `successo-pagamento.html` | `tests/informativa.test.mjs` | `docs/gdpr/` |

Il sito pubblicato è la cartella `public/`, riempita da `build.sh`: un file nuovo da servire va aggiunto lì.

## Collegamenti con La Columbera

Una modifica a uno di questi punti va verificata anche nel repository LaColumbera.

- **Stesso account Stripe.** I pagamenti del check-in portano nei metadati `dataCheckin` e `numeroPrenotazione`: il sito li legge (`api/_checkin.js` di LaColumbera) per mostrare «Check-in completato» nell'area clienti. Il webhook di questo progetto ignora i pagamenti del sito. Nomi e significato dei metadati non vanno cambiati da una parte sola.
- **Foglio Prenotazioni.** È il registro delle prenotazioni del sito: qui si legge soltanto (`SHEET_ID_PRENOTAZIONI`, in `api/verifica-prenotazione.js`, usato anche da `api/crea-pagamento-stripe.js`). I dati del check-in si scrivono in un altro foglio (`SHEET_ID`, `api/_sheet-checkin.js`); `tests/endpoint.test.mjs` controlla che nessun altro file scriva su Google Sheets.
- **Alloggiati Web.** Il tracciato è un porting di `api/_alloggiati.js` di LaColumbera: con `LACOLUMBERA_DIR` il test confronta i due moduli.

## Come verificare (nessuna rete, nessun servizio reale)

Per non lasciare `api/node_modules` nel repository, le prove si eseguono su una copia:

```bash
cp -r . /tmp/ck && cd /tmp/ck/api && npm ci && npm test      # npm ci installa esattamente le versioni di api/package-lock.json
```

Facoltativi, per non saltare nessuna prova:

- `LACOLUMBERA_DIR=/percorso/di/LaColumbera`: confronto del tracciato Alloggiati con il modulo originale.
- `TEST_DATABASE_URL=postgres://…`: un database PostgreSQL **di prova locale, mai quello di produzione**. `api/_db.js` si collega solo con SSL (`ssl: 'require'`), quindi il server di prova deve avere SSL attivo (basta un certificato autofirmato: `ssl=on`, `server.crt`, `server.key`).

## Baseline (31/10/2026, dopo la sistemazione degli endpoint di diagnosi)

| Prova | Risultato |
|---|---|
| `npm test` senza variabili | 52 ok, 0 falliti, 4 saltati |
| con `LACOLUMBERA_DIR` e `TEST_DATABASE_URL` (PostgreSQL 16 locale con SSL) | 56 ok, 0 falliti, 0 saltati |

Prima di questo intervento (commit `63e4da8`): 50 ok e 3 saltati; 53 ok con le variabili.

Quando un intervento aggiunge prove, aggiornare questa tabella nello stesso commit.
