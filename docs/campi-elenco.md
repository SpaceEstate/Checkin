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
riquadro: per questo si apre dentro la pagina. Lo scatto è il fotogramma ritagliato sul riquadro (con un margine), quindi il documento
riempie la foto e le scritte piccole restano leggibili.

- Responsabile: la foto va nel riquadro di caricamento come prima (stesso nome di file, stesso campo, JPEG sotto 1 MB, lato lungo 1600 px)
  e parte per il gestore come prima; manca un lato → si apre subito la fotocamera per quello. Prima la foto della fotocamera era il
  fotogramma intero a 1280×720 con qualità 0,7: il documento occupava solo una parte e le scritte piccole (luogo di nascita, numero rosso
  della CIE) non si leggevano.
- Altri ospiti: lo scatto (una tela in memoria) va solo alla lettura e si azzera subito; nessun file, nessun invio.
- Se il browser non dà la fotocamera (permesso negato, browser vecchio) compare un messaggio e si usa «Carica una foto».
- Su un **computer** il pulsante della fotocamera non c'è: si carica un file.

## Prove

`tests/scansione.test.mjs`: elenco dei comuni (numeri, province, licenza), ricerca dei comuni (vecchi nomi, omonimi, OCR), nessuna rete e
nessuna archiviazione in `fotocamera.js` e `campi-elenco.js`, markup dei passi identico a prima salvo la provincia SU, `openCamera` identica
a prima salvo il blocco della fotocamera con il riquadro. `tests/browser/scansione.browser.cjs`: campi con elenco (scrivere, scegliere,
voce inventata, comune e provincia, vecchio nome, «Avanti» fermo, valori dal codice, lingua) e fotocamera con il riquadro (fotocamera finta
di Chromium: riquadro, scatto nel riquadro del responsabile sotto 1 MB, fotocamera del retro, chiusura).
