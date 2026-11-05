# Librerie della scansione dei documenti (ospitate nel sito)

Queste librerie servono **solo** alla scansione facoltativa dei documenti (`scansione/`, vedi `docs/scansione-documenti.md`).
Sono ospitate qui invece che scaricate da una CDN: durante la scansione il browser dell'ospite non contatta nessun altro dominio.
Il browser le scarica solo quando l'ospite tocca «Scansiona documento». Con la scansione spenta non vengono mai richieste.

Nessuna è un servizio: sono file statici, gratuiti e open source. Nessuna chiave, nessun abbonamento, nessun costo a consumo.

| Cartella | Pacchetto npm | Versione | Licenza | Cosa contiene | Peso |
|---|---|---|---|---|---|
| `tesseract/` | `tesseract.js` | 7.0.0 | Apache-2.0 (`LICENSE.md`) | `tesseract.min.js` (interfaccia) e `worker.min.js` (worker), copiati da `dist/` senza modifiche | 63 KB + 111 KB |
| `tesseract-core/` | `tesseract.js-core` | 7.0.0 | Apache-2.0 (`LICENSE`) | motore Tesseract 5 in WebAssembly, solo LSTM: con SIMD e senza SIMD (iPhone e Android datati) | 3,9 MB ciascuno (1,5 MB compresso) |
| `tessdata/` | `@tesseract.js-data/eng` | 1.0.0 | modello di `tesseract-ocr/tessdata_best` (Apache-2.0, `LICENSE-Apache-2.0.txt`); il pacchetto npm è MIT | `eng.traineddata.gz` (cartella `4.0.0_best_int` del pacchetto), già compresso | 2,9 MB |
| `mrz/` | `mrz` (cheminfo) | 5.0.2 | MIT (`LICENSE`) | `lib/` riunita in un solo modulo ES (`mrz.js`) con esbuild 0.25.11, senza minificare: `esbuild lib/index.js --bundle --format=esm --legal-comments=inline --outfile=mrz.js` | 42 KB |
| `heic-to/` | `heic-to` | 1.6.7 (libheif 1.23.7) | LGPL-3.0 (`LICENSE`, con il testo della GNU GPL v3 in `COPYING-GPL-3.0.txt`) | `dist/csp/heic-to.js` senza modifiche (variante senza `eval`) | 3,2 MB (0,8 MB compresso) |

## LGPL di heic-to (libheif)

`heic-to.js` è una libreria LGPL-3.0 usata **così com'è**, in un file separato che il resto del sito carica soltanto quando una foto è in formato HEIC/HEIF
e il browser non la sa aprire da solo. Il codice del sito non la modifica e non la incorpora: chi vuole può sostituire il file con un'altra versione compatibile.
Sorgenti: <https://github.com/hoppergee/heic-to> (versione 1.6.7) e <https://github.com/strukturag/libheif> (versione 1.23.7).

## Provenienza e integrità

I file vengono dai pacchetti pubblicati su npm (`https://registry.npmjs.org/<pacchetto>/-/<pacchetto>-<versione>.tgz`). L'impronta SHA-512 dei pacchetti scaricati
coincide con quella pubblicata dal registro npm (`dist.integrity`, controllata il 05/11/2026):

- `tesseract.js-7.0.0.tgz` `sha512-exPBkd+z+wM1BuMkx/Bjv43OeLBxhL5kKWsz/9JY+DXcXdiBjiAch0V49QR3oAJqCaL5qURE0vx9Eo+G5YE7mA==`
- `tesseract.js-core-7.0.0.tgz` `sha512-WnNH518NzmbSq9zgTPeoF8c+xmilS8rFIl1YKbk/ptuuc7p6cLNELNuPAzcmsYw450ca6bLa8j3t0VAtq435Vw==`
- `@tesseract.js-data/eng-1.0.0.tgz` `sha512-mbTumm6KQPUHyzTPQaF3ObXYnx0SqqfV2nabqFVQBwD6Kl7PhGSLSzOlfFTWy0P3BjghaSKA2W9GB19Jk+ZcTg==`
- `mrz-5.0.2.tgz` `sha512-GXZ2eCwXrXHy3aTYLwckAyKy0V2yIEGM1Hgj8SjIbsGwVdZRdwrUSdNdetLZV4avgPUfKslBVvwbN7RVdWiyzw==`
- `heic-to-1.6.7.tgz` `sha512-GCPYNl86u6eZ7mr2aa+uQB+PrQOVKSBYfH8esovr8kh2c6EYQSDYIJ6uhXSmM2hPC8PdBVJ/Trn0jnfM9H9gvg==`

L'impronta SHA-256 di ogni file di questa cartella è in `impronte.sha256`: le prove (`tests/scansione.test.mjs`) la ricontrollano, così una modifica
involontaria o non dichiarata di una libreria fa fallire le prove. Per aggiornare una libreria: sostituire i file, aggiornare questa tabella e rigenerare
`impronte.sha256` (`find . -type f ! -name LEGGIMI.md ! -name impronte.sha256 | sort | xargs sha256sum > impronte.sha256`).

## Configurazione che impedisce richieste ad altri domini

Tesseract.js, se non gli si dicono i percorsi, scarica worker, motore e modello da jsDelivr. `scansione/scansione-documento.js` gli passa sempre i percorsi
di questa cartella (`workerPath`, `corePath` con il file esatto, `langPath`), `workerBlobURL: false` (nessun indirizzo `blob:`) e `cacheMethod: 'none'`
(il modello non viene salvato in IndexedDB: resta nella normale cache HTTP del browser, come gli altri file del sito).
