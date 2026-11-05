# Documenti sintetici per le prove della scansione

Tutte le immagini di questa cartella sono **sintetiche**: persone, numeri, codici fiscali e indirizzi sono di fantasia, e ogni
documento porta la scritta «FAC-SIMILE · DATI DI FANTASIA · SPECIMEN». Non sono riproduzioni di documenti reali né degli specimen
ufficiali (PRADO). Nel repository non vanno mai immagini di documenti reali (vedi `.gitignore`).

| File | Come è fatto |
|---|---|
| `cie-fronte.jpg`, `cie-retro.jpg`, `passaporto-de.jpg`, `carta-estera-es.jpg`, `patente-it.jpg`, `carta-cartacea-it.jpg` | `node tests/browser/genera-documenti.cjs` (Playwright + Chromium; MRZ con le cifre di controllo ICAO 9303 giuste) |
| `passaporto-de.heic` | `passaporto-de.jpg` salvata in HEIF con Python e `pillow-heif` 1.8.1 (`Image.open(...).save('passaporto-de.heic', format='HEIF', quality=80)`) |
| `passaporto-de-exif6.jpg` | `passaporto-de.jpg` con i pixel ruotati di 90° e l'orientamento EXIF 6, come le foto dei telefoni (Pillow: `transpose(ROTATE_90)`, `exif[0x0112] = 6`) |
| `non-immagine.pdf` | un PDF minimo scritto a mano, senza contenuto |

Le prove le usano così come sono (stessi byte su ogni computer); le varianti (sfocate, ruotate, coperte, poco contrasto) le crea la
prova stessa nel browser.

Dati di fantasia usati: PROVACCIA ERMENEGILDA (CIE, nata a Roma il 19/04/1980), PROVACCIA TEODORICO (passaporto tedesco, 10/11/2010),
ESEMPIO LUCIA (carta spagnola, 21/07/1992), PROVACCIA BERTOLDO (patente, Milano 05/03/1975), PROVACCIA CLOTILDE (carta cartacea,
Reggio nell'Emilia 15/01/2004).
