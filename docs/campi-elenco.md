# Campi con elenco, comune e fotocamera del documento

Modifiche chieste dal titolare il 06/11/2026 (branch `claude/scansione-documenti`). Valgono per tutti gli ospiti, **anche con la scansione
dei documenti spenta**.

## Campi con elenco scrivibili (`campi-elenco.js`)

Genere, cittadinanza, Stato di nascita, provincia, tipo e luogo di rilascio del documento: si può **scrivere** (l'elenco si filtra mentre si
scrive, senza badare a maiuscole e accenti; per gli Stati valgono anche i nomi in inglese e tedesco e quelli comuni come «USA», «Inghilterra»,
«Olanda») oppure **scegliere dall'elenco**. Il valore deve essere una voce dell'elenco: un testo che non corrisponde a nessuna voce resta
scritto in rosso («Scegli una voce dell'elenco») e il campo vale vuoto, quindi «Avanti» si ferma con il solito messaggio. Una sola voce che
inizia con il testo scritto («ita» → Italia) basta.

Come è fatto: le `<select>` di sempre restano nel modulo, invisibili, e tengono il valore. La validazione (`validaStepOspite`), la raccolta
dei dati, la verifica per Alloggiati e l'invio **non cambiano** (le prove controllano che quelle funzioni siano le stesse). Sopra ogni
`<select>` c'è una casella di testo con l'elenco; segue anche i valori messi dal codice (la scansione, «Annulla», il cambio di Stato di
nascita) e il cambio di lingua. Stesso schema del campo data (`creaCustomDateInput` in `checkin.js`).

## Comune di nascita con l'elenco dei comuni

Il comune si scrive o si sceglie dall'elenco dei comuni; **scelto il comune, la provincia si compila da sola** (si può cambiare). Valgono
solo i comuni dell'elenco:

- comuni di oggi (7.902);
- **vecchi nomi** di comuni che esistono ancora (per esempio «ABANO BAGNI» → si scrive «ABANO TERME», il nome di oggi, che è quello della
  tabella ufficiale di Alloggiati Web);
- **comuni soppressi**, per chi è nato lì (si trovano con il loro nome).

Comuni con lo stesso nome in province diverse (Castro, Calliano, Livo, Peglio, Samone, San Teodoro): se la provincia è già scelta vale
quella, altrimenti si sceglie dall'elenco. La scansione porta il comune letto al nome dell'elenco (anche con una lettera sbagliata
dall'OCR, nella provincia letta); se non è nell'elenco non lo compila. La verifica sulla tabella ufficiale di Alloggiati prima del
pagamento (`verifica-dati-alloggiati`) resta com'era.

L'elenco è `elenchi/comuni.js` (circa 240 KB, 80 KB compresso): si scarica dallo stesso sito quando serve (Stato di nascita Italia, o al
primo tocco sul comune). Se non si scarica (rete), il comune torna un testo libero come prima: il check-in non si blocca.

- **Fonte:** archivio dei comuni del pacchetto npm `codice-fiscale-it` 1.0.1, licenza MIT (`elenchi/LICENZA-codice-fiscale-it.txt`).
- **Aggiornare:** `npm pack codice-fiscale-it@<versione>`, estrarre, `node elenchi/genera-comuni.cjs package/dist/data/comuni.json`; poi
  aumentare `VERSIONE_ELENCHI` in `campi-elenco.js` e controllare le prove (`tests/scansione.test.mjs`: numero di comuni, province).
- **Province:** aggiunta «SU» (Sud Sardegna, dal 2016), che mancava nell'elenco del modulo: senza, i comuni di quella provincia non
  potevano avere la provincia compilata. Le sigle storiche già presenti (CI, OT, VS, OG) restano.

## Fotocamera con il riquadro del documento (`fotocamera.js`)

Sul **telefono**, «📷 Fotografa» (nel riquadro «Documento di identità» del responsabile e, con la scansione, nel pannello degli altri ospiti)
apre la fotocamera a tutto schermo con il **riquadro** in cui mettere il documento. La fotocamera di sistema non permette di disegnare un
riquadro: per questo si apre dentro la pagina. Lo scatto è ritagliato sul riquadro (con un margine), quindi il documento riempie la foto e
le scritte piccole restano leggibili.

Pixel e nitidezza (06/11/2026: nella prova del titolare, con il fotogramma di un video a bassa risoluzione, mancavano luogo di nascita,
tipo e numero):

- si chiede la risoluzione più alta che la fotocamera dà (fino al 4K, 3840×2160);
- **zoom 2×** dove il browser lo offre (Safari recenti; sempre dentro i limiti dichiarati): il telefono si tiene a circa 30 cm, dove mette a
  fuoco anche quando la fotocamera principale non mette a fuoco da vicino (iPhone Pro), e la carta prende più pixel del sensore;
- allo scatto il riquadro si colora per circa mezzo secondo: si esaminano 5 fotogrammi e si tiene il **più nitido** (toccando il pulsante
  il telefono si muove);
- dove c'è lo **scatto vero** (`ImageCapture.takePhoto`, per esempio Chrome su Android) e ha più pixel del video, si usa quello (senza
  flash), ritagliato con un margine in più; se manca, non ha più pixel o è orientato diversamente, resta il fotogramma.

- Responsabile: la foto va nel riquadro di caricamento come prima (stesso nome di file, stesso campo), JPEG con lato lungo 2000 px (quello
  su cui lavora la lettura), stesso limite dei file caricati (20 MB); all'invio si comprime come le foto caricate. Manca un lato → si
  apre subito la fotocamera per quello. Prima la foto della fotocamera era il fotogramma intero a 1280×720 con qualità 0,7, poi (fino al
  06/11/2026) il fotogramma ritagliato a 1600 px sotto 1 MB.
- Altri ospiti: lo scatto (una tela in memoria) va solo alla lettura e si azzera subito; nessun file, nessun invio.
- Se il browser non dà la fotocamera (permesso negato, browser vecchio) compare un messaggio e si usa «Carica una foto».
- Tasto **«indietro»** del telefono (07/11/2026, prova con Android simulato): con la fotocamera aperta chiude solo la fotocamera, che si
  spegne; il check-in resta com'era, con i dati scritti e le foto già fatte. Prima faceva uscire dal check-in e i dati scritti si
  perdevano. Come: al tocco su «Fotografa» si aggiunge una voce alla cronologia della pagina (stesso indirizzo, nessun dato) e «indietro»
  toglie quella. Dopo lo scatto del fronte la voce resta alla fotocamera del retro, che si apre da sola; chiusa la fotocamera con la ✕, o
  dopo l'ultimo scatto, la voce si toglie, quindi un altro «indietro» porta alla pagina di prima, come sempre. Ogni voce nasce da un tocco
  dell'ospite: Chrome può saltare con «indietro» le pagine che aggiungono voci senza un tocco. Dopo l'ultimo scatto la voce si toglie un
  secondo più tardi: se intanto l'ospite ha fatto scorrere la pagina, la pagina resta lì (finché c'è la voce della fotocamera il browser
  non rimette lo scorrimento che la pagina aveva all'apertura: `history.scrollRestoration` «manual», poi di nuovo com'era). Vale anche per
  lo scorrimento indietro di Safari sull'iPhone.
- Su un **computer** il pulsante della fotocamera non c'è: si carica un file.

## La ✕ dei file caricati (`togliFileDocumento` in `checkin.js`)

Richiesta del titolare, 06/11/2026: in ogni riquadro «Fronte» / «Retro» del documento del responsabile, appena c'è un file (caricato o
fotografato), compare una piccola **✕ in alto a destra**: se il file è sbagliato si toglie, senza doverne scegliere un altro. Il riquadro
torna com'era prima del caricamento («📎 Scegli file», contatore dei file, bordo), il file non resta da nessuna parte e «Avanti» chiede di
nuovo quel lato. Vale anche con la scansione spenta.

Come è fatto: un pulsante in più nel riquadro (`bloccoUploadLato`), nascosto dal CSS finché il riquadro non ha la classe `completo`, che
`aggiornaLabelUpload` (invariata) mette e toglie con il file. `togliFileDocumento` svuota il campo file e chiama `aggiornaLabelUpload` e
`aggiornaStatoDocumenti`, come dopo un caricamento. Il nome del pulsante per i lettori di schermo («Togli il file», «Remove file», «Datei
entfernen») è un testo nascosto con `data-i18n`, quindi segue il cambio di lingua; da tastiera, tolto il file, il fuoco passa al campo file
dello stesso lato. Con la scansione accesa si tolgono anche i dati letti da quel lato: vedi [scansione-documenti.md](scansione-documenti.md).

## Prove

`tests/scansione.test.mjs`: elenco dei comuni (numeri, province, licenza), ricerca dei comuni (vecchi nomi, omonimi, OCR), nessuna rete e
nessuna archiviazione in `fotocamera.js` e `campi-elenco.js`, markup dei passi identico a prima salvo la provincia SU, `openCamera` identica
a prima salvo il blocco della fotocamera con il riquadro. `tests/browser/scansione.browser.cjs`: campi con elenco (scrivere, scegliere,
voce inventata, comune e provincia, vecchio nome, «Avanti» fermo, valori dal codice, lingua) e fotocamera con il riquadro (fotocamera finta
di Chromium: riquadro, scatto nel riquadro del responsabile sotto 1 MB, fotocamera del retro, chiusura). Dal 06/11/2026 anche: zoom dentro i
limiti del browser, zona dello scatto vero, nitidezza dei fotogrammi (`tests/scansione.test.mjs`); foto piccola (CIE sintetica a 520 px)
letta per intero, con i dati confermati in verde e solo il titolo sopra i lati (`tests/browser/scansione.browser.cjs`). La ✕ dei file
caricati: markup (una per riquadro, nome tradotto), CSS e `togliFileDocumento` in `tests/scansione.test.mjs`; nel browser, con la
scansione spenta, si vede solo con un file, piccola in alto a destra, toglie il file anche da tastiera e senza il file «Avanti» si ferma. Il tasto «indietro»
(dal 07/11/2026, nel browser con il profilo Android «Pixel 7» di Playwright): chiude solo la fotocamera, che si spegne, con i dati scritti
e la foto del fronte al loro posto, anche con la fotocamera del retro aperta dopo lo scatto; una sola voce nella cronologia per fronte e
retro; dopo la ✕ e dopo l'ultimo scatto nessuna voce in più, la pagina fatta scorrere dopo l'ultimo scatto resta lì, e un altro
«indietro» porta alla pagina di prima.
