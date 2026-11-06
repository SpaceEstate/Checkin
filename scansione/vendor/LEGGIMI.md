# Librerie della scansione dei documenti (ospitate nel sito)

Queste librerie servono **solo** alla scansione facoltativa dei documenti (`scansione/`, vedi `docs/scansione-documenti.md`).
Sono ospitate qui invece che scaricate da una CDN: durante la scansione il browser dell'ospite non contatta nessun altro dominio.
Il browser le scarica solo alla prima foto da leggere (PDF.js solo al primo PDF). Con la scansione spenta non vengono mai richieste.

Nessuna è un servizio: sono file statici, gratuiti e open source. Nessuna chiave, nessun abbonamento, nessun costo a consumo.

| Cartella | Pacchetto npm | Versione | Licenza | Cosa contiene | Peso |
|---|---|---|---|---|---|
| `tesseract/` | `tesseract.js` | 7.0.0 | Apache-2.0 (`LICENSE.md`) | `tesseract.min.js` (interfaccia) e `worker.min.js` (worker), copiati da `dist/` senza modifiche | 63 KB + 111 KB |
| `tesseract-core/` | `tesseract.js-core` | 7.0.0 | Apache-2.0 (`LICENSE`) | motore Tesseract 5 in WebAssembly, solo LSTM: con SIMD e senza SIMD (iPhone e Android datati) | 3,9 MB ciascuno (1,5 MB compresso) |
| `tessdata/` | `@tesseract.js-data/eng` | 1.0.0 | modello di `tesseract-ocr/tessdata_best` (Apache-2.0, `LICENSE-Apache-2.0.txt`); il pacchetto npm è MIT | `eng.traineddata.gz` (cartella `4.0.0_best_int` del pacchetto), già compresso | 2,9 MB |
| `mrz/` | `mrz` (cheminfo) | 5.0.2 | MIT (`LICENSE`) | `lib/` riunita in un solo modulo ES (`mrz.js`) con esbuild 0.25.11, senza minificare: `esbuild lib/index.js --bundle --format=esm --legal-comments=inline --outfile=mrz.js` | 42 KB |
| `pdfjs/` | `pdfjs-dist` (Mozilla PDF.js) | 6.4.299 | Apache-2.0 (`LICENSE`); decoder in WebAssembly: OpenJPEG BSD-2 (`wasm/LICENSE_OPENJPEG`), JBIG2 di PDFium BSD-3 (`wasm/LICENSE_JBIG2`), qcms MIT (`wasm/LICENSE_QCMS`), con le note di Mozilla (`wasm/LICENSE_PDFJS_*`) | `legacy/build/pdf.min.mjs` e `legacy/build/pdf.worker.min.mjs` (variante «legacy», con i polyfill per i browser meno recenti) e `wasm/openjpeg.wasm`, `wasm/jbig2.wasm`, `wasm/qcms_bg.wasm` (immagini JPEG 2000, JBIG2 delle scansioni in bianco e nero, profili colore), senza modifiche | 0,5 MB + 1,3 MB + 0,45 MB |

`heic-to` (LGPL-3.0, per le foto HEIC) è stata tolta il 06/11/2026: il check-in accetta solo foto JPG e PNG e PDF (richiesta del titolare),
e sull'iPhone la galleria consegna le foto già in JPG.

## Provenienza e integrità

I file vengono dai pacchetti pubblicati su npm (`https://registry.npmjs.org/<pacchetto>/-/<pacchetto>-<versione>.tgz`). L'impronta SHA-512 dei pacchetti scaricati
coincide con quella pubblicata dal registro npm (`dist.integrity`, controllata il 05/11/2026):

- `tesseract.js-7.0.0.tgz` `sha512-exPBkd+z+wM1BuMkx/Bjv43OeLBxhL5kKWsz/9JY+DXcXdiBjiAch0V49QR3oAJqCaL5qURE0vx9Eo+G5YE7mA==`
- `tesseract.js-core-7.0.0.tgz` `sha512-WnNH518NzmbSq9zgTPeoF8c+xmilS8rFIl1YKbk/ptuuc7p6cLNELNuPAzcmsYw450ca6bLa8j3t0VAtq435Vw==`
- `@tesseract.js-data/eng-1.0.0.tgz` `sha512-mbTumm6KQPUHyzTPQaF3ObXYnx0SqqfV2nabqFVQBwD6Kl7PhGSLSzOlfFTWy0P3BjghaSKA2W9GB19Jk+ZcTg==`
- `mrz-5.0.2.tgz` `sha512-GXZ2eCwXrXHy3aTYLwckAyKy0V2yIEGM1Hgj8SjIbsGwVdZRdwrUSdNdetLZV4avgPUfKslBVvwbN7RVdWiyzw==`
- `pdfjs-dist-6.4.299.tgz` `sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==` (controllata il 06/11/2026)

L'impronta SHA-256 di ogni file di questa cartella è in `impronte.sha256`: le prove (`tests/scansione.test.mjs`) la ricontrollano, così una modifica
involontaria o non dichiarata di una libreria fa fallire le prove. Per aggiornare una libreria: sostituire i file, aggiornare questa tabella e rigenerare
`impronte.sha256` (`find . -type f ! -name LEGGIMI.md ! -name impronte.sha256 | sort | xargs sha256sum > impronte.sha256`).

## Configurazione che impedisce richieste ad altri domini

Tesseract.js, se non gli si dicono i percorsi, scarica worker, motore e modello da jsDelivr. `scansione/scansione-documento.js` gli passa sempre i percorsi
di questa cartella (`workerPath`, `corePath` con il file esatto, `langPath`), `workerBlobURL: false` (nessun indirizzo `blob:`) e `cacheMethod: 'none'`
(il modello non viene salvato in IndexedDB: resta nella normale cache HTTP del browser, come gli altri file del sito).

PDF.js riceve il PDF già in memoria (`data`: nessuno scaricamento), il percorso del suo worker in questa cartella (`GlobalWorkerOptions.workerSrc`) e
quello dei decoder (`wasmUrl`). Non gli si danno i percorsi di caratteri standard, CMap e profili ICC: non scarica nulla da altri domini (i caratteri non
inclusi nel PDF si sostituiscono con quelli del sistema). Il documento si chiude subito dopo la lettura (`destroy`: anche il worker si chiude).
