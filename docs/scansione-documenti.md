# Scansione facoltativa dei documenti (lettura automatica dei dati)

Funzione aggiunta il 05/11/2026 (branch `claude/scansione-documenti`). **Spenta di default**: con il flag spento la scansione non c'è
(nessun pulsante, nessun file della scansione, nessuna richiesta in più; le prove lo verificano). Dal 06/11/2026, a richiesta del titolare,
cambiano per tutti (anche con la scansione spenta) i campi con elenco, il comune con l'elenco dei comuni e la fotocamera del documento:
vedi [campi-elenco.md](campi-elenco.md).

## In breve

In cima al passo di ogni ospite ci sono le foto del documento (fronte e retro): sul telefono **«📷 Fotografa»** apre la fotocamera con il
riquadro del documento, ovunque **«🖼️ Carica una foto»**. Il browser legge la MRZ (le righe `<<<`) e il testo stampato e compila i campi del
modulo, che restano sempre lì da scrivere a mano se la lettura non riesce (nessuna scelta «a mano / scansione», nessuna spiegazione: richiesta
del titolare, 06/11/2026). Sopra i lati c'è solo il titolo «📄 Documento di identità»; a lettura riuscita nessun messaggio (restano errori,
avvisi, valori diversi da quelli già scritti e «↩︎ Annulla»). I campi letti sono evidenziati: **verde** = verificato, **arancione** = da
controllare. Verde: dati della MRZ con le cifre di controllo; sesso della MRZ quando le cifre di nascita e scadenza, sulla stessa riga,
tornano; tipo «CARTA IDENTITA' ELETTRONICA» quando la MRZ è quella di una CIE con nascita e scadenza esatte; numero letto sul fronte e
confermato dalla MRZ; comune letto esatto e confermato dall'elenco dei comuni con la provincia letta, con provincia e Stato di nascita.
Tutto avviene **sul dispositivo dell'ospite**: nessuna API, nessun servizio esterno, nessun costo.

- **Ospiti diversi dal responsabile**: la foto serve solo a leggere i dati. Non viene inviata, salvata, copiata né mostrata in anteprima.
- **Responsabile**: la foto continua a essere caricata nei riquadri «Documento di identità» e inviata al gestore come prima. Con la
  scansione quel riquadro (lo stesso, non una copia) sale in cima al passo: si caricano le foto (file o fotocamera del check-in, sul telefono
  quella con il riquadro) e i campi si compilano da soli, lato per lato. In cima al passo il riquadro mostra solo titolo e lati: spiegazioni,
  avviso sull'immagine inviata al gestore e contatore dei file sono nascosti (06/11/2026, richiesta del titolare; lo stesso avviso è
  nell'informativa breve dell'ultimo passo, che l'ospite conferma, e nella pagina privacy). La scansione legge quei file (una copia
  decodificata in memoria) senza toccarli. Se il codice della scansione non si scarica, il riquadro resta al suo posto di sempre, com'era,
  e si compila a mano.

## Accendere, provare, spegnere

In `checkin.js`, sezione «SCANSIONE DEL DOCUMENTO»:

```js
const SCANSIONE_DOCUMENTI = 'prova';   // 'spenta' | 'prova' | 'attiva'
```

| Valore | Effetto |
|---|---|
| `'spenta'` | Il modulo è quello di prima. |
| `'prova'` | La scansione compare solo aprendo il check-in con `#scansione=prova` in fondo all'indirizzo, per esempio `https://spaceestate.github.io/Checkin/#scansione=prova`. Gli ospiti non la vedono. Serve a provare sui telefoni veri. **È il valore attuale sul branch `claude/scansione-documenti`** (05/11/2026, per le prove del titolare nell'anteprima di Vercel). |
| `'attiva'` | La scansione compare a tutti. |

**Diagnosi per le prove sul telefono:** con `#scansione=prova&diagnosi` in fondo all'indirizzo, sotto le foto compare per ogni lato
una riga con dispositivo e browser, misure della foto, tempi, nitidezza, zone trovate, passaggi dell'OCR con la fiducia, controlli della
MRZ e i **nomi** dei campi letti (mai i valori). Serve a capire cosa succede su un telefono che non si può provare in locale (06/11/2026:
sull'iPhone del titolare il luogo di nascita restava vuoto, sul computer con le stesse foto no). Senza quella parola non cambia nulla.

**Spegnimento d'emergenza (kill switch):** rimettere `'spenta'` (una riga) e aumentare `?v=` di `checkin.js` in `index.html`, copiando i due
file in `public/`. Su GitHub Pages è online in un paio di minuti. Se i file della scansione non si scaricano (rete, file mancanti), il modulo mostra un
messaggio e si continua a mano: non serve altro.

Il flag non può arrivare dal server: Vercel Hobby ammette al massimo 12 funzioni e il check-in le usa già tutte.

### Provare il flusso da ospite senza dati veri

`node tests/browser/server-prova.cjs 8765 attiva` avvia il check-in in locale (`http://127.0.0.1:8765/`) con API **finte**: prenotazione
di prova `PROVA1`, nessun pagamento (alla fine una pagina mostra i dati che il server conserverebbe e quante immagini contiene il
salvataggio). Le foto sintetiche per provare sono in `tests/browser/documenti-sintetici/`.

## Come funziona

1. Con la scansione accesa, aprendo il passo di un ospite il browser scarica `scansione/scansione-documento.js` (pochi KB) e, solo alla prima
   foto da leggere, le librerie dell'OCR (circa 4,5 MB la prima volta, poi dalla cache del browser). Tutti i file sono **dello stesso sito**
   (`scansione/vendor/`). Le foto degli altri ospiti arrivano dalla fotocamera con il riquadro (una tela in memoria, ritagliata sul documento)
   o da «Carica una foto».
2. La foto (lato con i dati o con la MRZ; un secondo lato facoltativo) viene decodificata in memoria: orientamento EXIF, HEIC/HEIF
   (Safari le apre da solo; altrove heic-to in un worker chiuso subito dopo), riduzione a 2000 px (le foto grandi a metà per volta: in un
   passo solo Safari seghetta le scritte sottili come le parentesi), scala di grigi (il canale più chiaro
   di ogni pixel: le scritte nere restano nere, i fondi colorati del documento schiariscono). Le foto più piccole di 1600 px si
   **ingrandiscono** fino a 1600 (al più 3 volte): con la carta larga 500-800 px, come negli scatti dal riquadro di una fotocamera a
   bassa risoluzione, si perdevano luogo di nascita, comune, provincia e numero (06/11/2026, prove locali con le foto vere ridotte e con
   la CIE sintetica a 520 px). Una maschera di contrasto sulle foto sfocate è stata provata e scartata: sulle foto nitide faceva perdere
   dati.
3. **Prima dell'OCR**, su una copia di 1400 px e senza OCR (`scansione/immagine.js`, pochi decimi di secondo): bianco e nero locale
   (Sauvola), lettere come macchie, macchie unite in righe di testo (in orizzontale e in verticale, con l'inclinazione), scarto delle
   «righe» della tovaglia, del portafoglio, dei disegni. Si trovano così la **MRZ** (2 o 3 righe lunghe, parallele, a passo fisso) e la
   **zona del testo stampato**. L'OCR legge solo quelle zone, ritagliate dritte: è questo che rende la lettura veloce sulle foto vere
   (documento piccolo, storto, su un fondo a disegni) e le evita di leggere lettere nello sfondo.
4. **MRZ**: la fascia ritagliata si divide nelle caselle della griglia (caratteri a passo fisso, righe allineate; una casella sbiadita
   diventa «ignota»). I «<» si riconoscono **dalla forma** (l'OCR li legge spesso L, K o C) e dicono anche se la MRZ è sottosopra.
   L'OCR (Tesseract.js in un Web Worker, soli caratteri `A-Z0-9<`) legge la fascia tre volte, preparata in modo diverso (solo i
   caratteri, senza i «<», in grigio); ogni lettera va nella sua casella e le tre letture si uniscono con le **cifre di controllo**
   (`fondiMrz`): in una casella di sole cifre una O diventa 0, tra più letture vale quella che fa tornare la cifra del campo, un codice
   di Stato deve esistere. Un campo che non si può decidere resta vuoto (mai «corretto» a caso: vedi Limiti).
5. **Testo stampato**: la zona ritagliata si legge in uno o due versi (dritta, capovolta) e, se mancano dati, una seconda volta con
   un'altra impostazione. Il verso capovolto non si prova se la prima lettura ha già tre dati (cognome, nome, data…), anche con poca
   fiducia dell'OCR; la seconda lettura si fa anche con poca fiducia se ci sono già tre dati (06/11/2026: sulla CIE del titolare la
   fiducia era 43, sotto la soglia di 45, e sul telefono il luogo di nascita restava vuoto). Il luogo di nascita si riconosce anche con
   le parentesi lette male («ROMA [RM]», «ROMA (RM|», «ROMA RM 19.04.1980») o con l'etichetta illeggibile (la riga «COMUNE (PR)
   GG.MM.AAAA» della CIE): solo con la sigla di una provincia vera, e vale solo se l'elenco dei comuni conferma il comune; se no non si
   compilano né lo Stato né comune e provincia. Le etichette trovano il loro valore anche in colonna (riquadri dell'OCR: sulla CIE «CITTADINANZA» ha il valore
   sotto di sé, non sulla riga di «SESSO»), saltano le traduzioni lette male («SURAT» per SURNAME) e il rumore dopo il nome.
6. Se nella foto non si trova nessuna riga ma ci sono lettere (foto piccola o molto sfocata), si legge l'immagine intera come prima,
   con le rotazioni. Se non ci sono lettere in riga (non è un documento) si risponde subito.
7. `scansione/lettura-documento.js` (modulo puro, provato in CI) interpreta il testo e propone i valori, campo per campo, con un'affidabilità.
   Il tipo di documento riconosciuto ma non certo (patente, carta d'identità, passaporto) si compila lo stesso, da controllare (prima era una
   domanda «È giusto? Sì / Scelgo io»). Il comune letto si porta al nome dell'elenco dei comuni (anche con una lettera sbagliata dall'OCR,
   nella provincia letta); se non è nell'elenco non si compila.
   Fronte e retro dello stesso ospite si uniscono: per i nomi vale la MRZ se il testo stampato è diverso (di solito è il testo stampato a
   essere letto male), il testo stampato se coincide (accenti, apostrofi, Ü = UE) o se la MRZ è troncata.
8. Si compilano **solo i campi vuoti** dell'ospite giusto. Un valore già scritto e diverso diventa una scelta («Usa il documento» /
   «Tieni il mio»). «Annulla la compilazione automatica» rimette tutti i campi come prima.
9. A fine lettura il worker dell'OCR viene chiuso (con lui la memoria che ha contenuto l'immagine), le tele e le matrici di grigi vengono
   azzerate, le bitmap chiuse, il campo file svuotato. L'ospite conferma i dati con il solito «Avanti».

## Documenti e regole

Tipo di documento (solo responsabile): «compilato» = verde se confermato (MRZ valida), altrimenti arancione; «suggerito» = dal 06/11/2026
si compila anch'esso, con il bordo arancione «da controllare» (prima era una domanda con un tocco).

| Documento | Come si legge | Tipo proposto (solo responsabile) |
|---|---|---|
| CIE italiana | Retro: MRZ (TD1) con cifre di controllo. Fronte: testo stampato (luogo e data di nascita «ROMA (RM) 19.04.1980», numero «CA…»). Numero: se nella MRZ non torna (carattere consumato, foto piccola) vale quello del fronte, anche letto con un carattere confuso (1/I/L, 0/O…), purché la MRZ lo confermi: quasi uguale al suo e con la cifra di controllo, la complessiva o entrambe che tornano. Le correzioni della sola MRZ restano nel formato della CIE e cedono al numero del fronte confermato. Un carattere del numero fuori formato nella MRZ (la O lettera letta zero, come sulla CIE del titolare) si sostituisce solo con i caratteri confusi che stanno nel formato: vale, verde, se uno solo fa tornare la cifra del numero e la complessiva | «CARTA IDENTITA' ELETTRONICA», compilato; verde se nascita e scadenza della MRZ tornano (con il numero della MRZ illeggibile, se lo conferma il fronte) |
| Carta d'identità cartacea italiana | Solo testo stampato (cognome, nome, «nato il», «a COMUNE (PR)», cittadinanza, numero «AX 1234567») | «CARTA DI IDENTITA'» solo suggerito |
| Carte d'identità straniere | MRZ TD1/TD2 (e carta francese) | «CARTA DI IDENTITA'» solo suggerito |
| Passaporti | MRZ TD3 | `P<`: «PASSAPORTO ORDINARIO» suggerito; `PD`: diplomatico suggerito; `PS`/`PO`: di servizio suggerito; altri codici (documenti di viaggio, emergenza, rifugiati): nessun tipo, sceglie l'ospite |
| Patente UE | Campi numerati 1 (cognome), 2 (nomi), 3 (data e luogo di nascita), 4a/4b (date), 5 (numero). L'OCR legge spesso i numeri dei campi (stampati in blu) come pezzi a sé, male («Q» per «3.») o per niente (06/11/2026, patente del titolare): le righe si ricompongono dai riquadri dell'OCR, la riga 3 si riconosce dal contenuto («GG/MM/AA COMUNE (PR)»), cognome e nome sono le due righe di lettere sopra, nella stessa colonna (solo con l'intestazione della patente letta); il numero anche dalla forma (2 lettere, 7 cifre, 1 lettera: non il codice del retro). Se manca il numero si legge anche la zona allargata ai gruppi di righe vicini (le righe 4a e 5 stanno spesso in un gruppo a parte) | «PATENTE DI GUIDA» compilato, verde con l'intestazione e i campi numerati letti; luogo di rilascio Italia verde con «REPUBBLICA ITALIANA» (anche letta male) o l'ufficio del campo 4c (MC-…, MIT-…). Cognome, nome, data e numero restano arancioni: niente li conferma. Sesso e cittadinanza non ci sono: restano da compilare |
| Patente svizzera | MRZ (libreria mrz) | «PATENTE DI GUIDA» suggerito |
| Permessi di soggiorno, visti, altri | Dati anagrafici se c'è una MRZ valida | nessun tipo (non sono nell'elenco del modulo) |

Regole principali (`lettura-documento.js`):

- **MRZ**: cifre di controllo ICAO 9303 (libreria `mrz`). Data, scadenza e numero si propongono solo se la loro cifra di controllo torna.
  Numero del documento letto male: si correggono le confusioni (O/0, I/1, B/8, S/5, Z/2, G/6…) solo se **una sola** versione fa tornare
  la cifra di controllo (e quella complessiva); resta «da verificare». Righe con un `<` in più o in meno vengono riallineate.
- **Anno a 2 cifre**: nascita = 20AA se non è nel futuro, altrimenti 19AA (2060 → 1960). Se anche il secolo precedente darebbe un'età
  credibile (fino a 110 anni) il campo è «da verificare», a meno che il testo stampato non riporti l'anno a 4 cifre. Scadenza = 20AA.
- **Nomi**: la struttura `COGNOME<<NOMI` della MRZ evita lo scambio; dopo tre `<` di fila c'è solo riempimento. Se il testo stampato coincide
  (o quasi: lettura imperfetta, Ü/UE) vale il testo stampato, che conserva accenti e apostrofi. Nomi invertiti tra MRZ e testo: avviso.
- **Codice fiscale**: solo controllo incrociato (cognome, nome, data, sesso, omocodia). Non va in nessun campo, non diventa mai il numero del documento.
- **Cittadinanza e Stato di rilascio**: codice ISO/ICAO della MRZ (la Germania usa `D`) → voce dell'elenco del modulo. «Sicuro» se
  coincidono emittente e cittadinanza. Apolidi (`XXA`), rifugiati, ONU, Kosovo e altri codici senza voce: campo vuoto con avviso.
- **Luogo di nascita**: non è nella MRZ. Si legge solo dal testo stampato dei documenti italiani («ROMA (RM)», «BERLINO (GERMANIA)»); per gli
  altri resta da compilare. Il comune viene poi controllato, come sempre, dalla pre-verifica Alloggiati prima del pagamento.
- **Testo stampato**: sempre «da verificare». Testo senza segni di documento (intestazione, campi della patente, numero CIE) e senza MRZ
  si scarta: una foto qualsiasi non produce dati.
- **Plausibilità** (avvisi, mai blocchi): documento scaduto, rilascio dopo la scadenza o prima della nascita, nascita futura (scartata),
  stessi dati di un altro ospite («hai fotografato lo stesso documento?»).

## Associazione ai campi Alloggiati Web

La scansione scrive solo nei campi che il modulo ha già (`ospiteN_cognome`, `_nome`, `_genere`, `_nascita`, `_cittadinanza`, `_luogo_nascita`,
`_comune`, `_provincia`; per il responsabile anche `ospite1_tipo_documento`, `_numero_documento`, `_luogo_rilascio`), con le **stesse voci**
degli elenchi del modulo. I codici ufficiali (Luoghi, Tipi_Documento) li assegna il server con le tabelle ufficiali, come per i dati scritti
a mano (`api/_checkin-alloggiati.js`, invariato). La catena codice ISO → voce del modulo → codice ufficiale è provata in `tests/scansione.test.mjs`
(insieme a `tests/alloggiati.test.mjs`, che verifica le voci del modulo sulla tabella ufficiale degli Stati).

Il modulo non raccoglie scadenza, data e autorità di rilascio: la scansione li usa solo per i controlli e non li conserva.

## Privacy

| Domanda | Risposta (verificata dalle prove) |
|---|---|
| Le foto degli altri ospiti vanno al server? | No. Nessuna richiesta contiene i loro byte; il salvataggio contiene solo fronte e retro del responsabile (`tests/browser/scansione.browser.cjs`, registro in `tests/browser/risultati/rete-flusso-completo.json`). |
| A servizi AI o CDN esterne? | No. Nessuna richiesta a domini diversi dal sito; Tesseract.js riceve sempre i percorsi locali (`workerPath`, `corePath`, `langPath`). |
| Restano nel browser? | No IndexedDB (`cacheMethod: 'none'`), niente localStorage (solo la lingua, come prima), niente sessionStorage, niente Cache Storage, nessun service worker, nessun indirizzo `blob:` lasciato aperto, nessun worker attivo dopo la lettura. |
| Finiscono nei log? | Nessun `console.*` nei moduli della scansione; le prove controllano che in console non compaiano i dati di prova. Nessuno strumento di tracciamento nel sito. |
| La foto del responsabile cambia percorso? | No: stesse funzioni di prima (impronte controllate da `tests/scansione.test.mjs`), stessi byte inviati (stessa prova nel browser con e senza scansione). |

Limiti dichiarati: la memoria del browser la libera il browser quando vuole (non si può forzare); il codice abbandona ogni riferimento e chiude
i worker. Una foto scelta dalla galleria resta, ovviamente, nella galleria del telefono dell'ospite.

**Conservazione della foto del responsabile (invariata, solo verificata):** archivio temporaneo Neon 2 ore se il pagamento non arriva; dopo il
pagamento cancellata appena foglio ed email al gestore sono a posto, al massimo 72 ore (più fino a ~24 ore per il cron giornaliero). Le copie
nell'email al gestore **non hanno cancellazione automatica** (cancellazione manuale entro 24 ore dalla registrazione, come dice l'informativa):
punto aperto già segnalato in `docs/gdpr/checkin-modifiche.md` § 7.

**Informativa:** `privacy.html` del sito (§ 3, «Lettura automatica del documento (facoltativa)»). La nota nel riquadro della scansione è
stata tolta il 06/11/2026, a richiesta del titolare (nessuna spiegazione nel pannello).

## Librerie (gratuite, open source, ospitate nel sito)

Dettagli, provenienza e impronte in `scansione/vendor/LEGGIMI.md`.

| Libreria | Licenza | Uso |
|---|---|---|
| Tesseract.js 7.0.0 + tesseract.js-core 7.0.0 | Apache-2.0 | OCR in WebAssembly (con e senza SIMD) |
| Modello `eng` (tessdata_best, 4.0.0_best_int) | Apache-2.0 | riconoscimento dei caratteri |
| mrz 5.0.2 | MIT | MRZ e cifre di controllo ICAO 9303 |
| heic-to 1.6.7 (libheif 1.23.7) | LGPL-3.0 | foto HEIC/HEIF nei browser che non le aprono |

Nessuna API a pagamento, nessun abbonamento, nessun servizio a consumo.

## Prove

- `tests/scansione.test.mjs` (con le altre, `npm test`, anche su GitHub): comportamento di prima con la scansione spenta (markup identico,
  funzioni del percorso di oggi invariate), librerie identiche alle impronte, MRZ (specimen ICAO, letture imperfette), secolo, codice fiscale,
  codici ISO, tipi di documento, testo stampato, controlli, compilazione senza sovrascritture, TXT Alloggiati. Dal 06/11/2026 anche
  `scansione/immagine.js` su disegni fatti nella prova (forma del «<», griglia della MRZ con una casella sbiadita, MRZ tra il disordine,
  storta, in verticale e capovolta, ritagli, nitidezza) e l'unione delle letture con le cifre di controllo, con dati di fantasia.
- `tests/browser/scansione.browser.cjs` (Chromium + Playwright; su GitHub nel job «scansione»): flusso completo da ospite con API finte,
  verifica di rete, archiviazione, annullamento, isolamento tra ospiti, documenti difficili (rotazioni, sfocatura, MRZ coperta, HEIC, EXIF, PDF,
  foto qualsiasi), due lati scelti uno dopo l'altro, tempo scaduto, lettore non scaricabile, motore senza SIMD, schermo stretto, inglese, e
  «foto come quelle vere»: documento sintetico piccolo e storto su una tovaglia a disegni accanto a un portafoglio (CIE fronte girato in
  verticale e retro, passaporto storto, carta capovolta), con un limite di tempo.
- Messa a punto sulle foto vere (06/11/2026): sette foto di documenti veri mandate dal titolare (permesso di soggiorno tedesco, due CIE,
  passaporto) sono state usate **solo sul computer di chi ha fatto le prove** e non sono nel repository. Risultato: tutti i retro con la MRZ
  letti con le cifre di controllo esatte (un numero di CIE consumato resta vuoto, non sbagliato), fronte e retro insieme danno i dati
  completi di tutte e tre le persone, 1,3–4 secondi per foto su un computer (prima 4–30 secondi, con dati quasi tutti sbagliati o mancanti).

### Da provare sui telefoni veri (modalità `'prova'`)

Le prove automatiche usano Chromium. Prima di passare ad `'attiva'` vanno fatte a mano, con `#scansione=prova`:

1. iPhone (Safari) recente e uno datato (iOS 15/16): «Fotografa» apre la fotocamera con il riquadro; foto del passaporto e della CIE (fronte e retro); foto dalla galleria.
2. Android (Chrome) recente e uno datato: stesse prove; una foto HEIC, se il telefono le scatta.
3. Responsabile: caricare fronte e retro come sempre, «Leggi i dati dalle foto caricate», completare e pagare (o fermarsi al pagamento):
   l'email al gestore deve arrivare come prima, con le stesse immagini.
4. Connessione lenta (4G debole): il primo download (~4,5 MB) e i tempi; «Interrompi» deve fermare tutto.
5. Una foto mossa e una con riflessi: messaggio chiaro, si prosegue a mano.

## Limiti del riconoscimento

- Affidabile soprattutto sulla MRZ (cifre di controllo). Il testo stampato (fronte della CIE, patente, carta cartacea) dipende molto da luce,
  riflessi e font: è sempre «da verificare». La carta cartacea, consumata o scritta a mano, è il caso più difficile.
- Il nome nella MRZ non ha cifra di controllo; con foto sfocate può uscire storpiato (resta «da verificare»). Il nome letto solo dal
  fronte (testo stampato su un fondo disegnato) può avere una lettera sbagliata: con anche il retro vale la MRZ.
- Numero del documento: una cifra di controllo non basta a ricostruire un carattere sbiadito (A, K e U, per esempio, danno la stessa
  cifra; quella complessiva contiene il numero con gli stessi pesi e non aiuta). Si corregge solo un carattere incerto se una sola scelta
  torna; altrimenti il numero resta vuoto e si scrive a mano.
- Lo Stato di nascita degli stranieri: dalla CIE italiana si legge la sigla tra parentesi (per esempio «(BRA)»); dagli altri documenti
  quasi sempre va scelto a mano (non è nella MRZ).
- Testo stampato in alfabeti non latini: non letto (la MRZ sì). PDF: non letti (il PDF del responsabile si invia come prima).
- Tempi: su un computer recente 1–4 secondi per foto (meno di un secondo per una foto che non è un documento). **Su un telefono datato non sono stati
  misurati**: il rallentamento della CPU simulato nelle prove vale per la pagina, non per il worker dell'OCR, quindi non dice quanto ci vorrà.
  Vanno misurati con le prove sui telefoni veri. Tempo massimo per foto 45 s, per la preparazione 60 s: oltre, messaggio e si continua a mano.
  Il motore senza SIMD (iPhone e Android datati) è provato: legge correttamente, con un altro file del motore.
- Il modulo ha 192 Stati: chi ha una cittadinanza non in elenco (Kosovo, Palestina, Taiwan, apolidi…) non può sceglierla nemmeno a mano (limite esistente).
- Documenti italiani: il modulo raccoglie solo lo Stato di rilascio (avviso esistente `RILASCIO_ITALIA` in `api/_checkin-alloggiati.js`).
