// ============================================================
// documento-ocr.js — Space Estate Check-in
//
// Legge la foto del documento DENTRO il browser dell'ospite e ne ricava la
// MRZ (vedi mrz.js). Nessuna immagine viene inviata a un server: l'OCR gira
// in locale con tesseract.js, quindi non serve nessun contratto con un
// fornitore esterno e non c'è costo per scansione.
//
// La libreria (~2-4 MB tra script, worker e dati lingua) viene scaricata
// SOLO quando l'ospite carica la prima foto, non al caricamento della
// pagina. Se il download fallisce o l'OCR non trova nulla, il check-in
// prosegue normalmente: i campi restano da compilare a mano.
//
// Va caricato PRIMA di checkin.js e DOPO mrz.js.
// ============================================================

// Versione fissata: aggiornarla è l'unico punto da toccare per cambiare
// release della libreria.
const OCR_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const OCR_TIMEOUT_MS = 30000;
const OCR_INATTIVITA_MS = 120000; // chiude il worker dopo 2 minuti senza lavoro

let ocrLibreriaPromise = null;
let ocrWorkerPromise = null;
let ocrTimerChiusura = null;
// Il worker elabora una richiesta per volta: le letture vengono messe in
// coda (l'ospite responsabile può caricare fronte e retro a distanza di un
// secondo e partirebbero due OCR in parallelo).
let ocrCoda = Promise.resolve();

function caricaLibreriaOCR() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (ocrLibreriaPromise) return ocrLibreriaPromise;

  ocrLibreriaPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = OCR_CDN;
    script.async = true;
    script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract non disponibile'));
    script.onerror = () => reject(new Error('Download libreria OCR fallito'));
    document.head.appendChild(script);
  }).catch(err => {
    ocrLibreriaPromise = null; // un nuovo tentativo è possibile
    throw err;
  });

  return ocrLibreriaPromise;
}

async function ottieniWorkerOCR() {
  if (ocrWorkerPromise) return ocrWorkerPromise;

  ocrWorkerPromise = (async () => {
    const Tesseract = await caricaLibreriaOCR();
    const worker = await Tesseract.createWorker('eng');
    // La MRZ usa solo maiuscole, cifre e il riempitivo '<': limitare
    // l'alfabeto riduce moltissimo gli errori di lettura.
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
      tessedit_pageseg_mode: '6' // blocco di testo uniforme
    });
    return worker;
  })().catch(err => {
    ocrWorkerPromise = null;
    throw err;
  });

  return ocrWorkerPromise;
}

function programmaChiusuraWorker() {
  clearTimeout(ocrTimerChiusura);
  ocrTimerChiusura = setTimeout(async () => {
    const promise = ocrWorkerPromise;
    ocrWorkerPromise = null;
    try {
      const worker = await promise;
      await worker?.terminate();
    } catch (e) { /* worker già chiuso o mai partito */ }
  }, OCR_INATTIVITA_MS);
}

function immagineDaFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')); };
    img.src = url;
  });
}

// Prepara l'immagine per l'OCR: ritaglio, ingrandimento, scala di grigi e
// aumento di contrasto. Sulle foto da telefono è la differenza tra una MRZ
// letta e una riga di caratteri a caso.
function canvasPerOCR(img, porzioneBassa) {
  const sorgenteY = porzioneBassa < 1 ? Math.round(img.height * (1 - porzioneBassa)) : 0;
  const sorgenteH = img.height - sorgenteY;

  const larghezzaTarget = Math.min(2000, Math.max(1200, img.width));
  const scala = larghezzaTarget / img.width;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scala);
  canvas.height = Math.round(sorgenteH * scala);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, sorgenteY, img.width, sorgenteH, 0, 0, canvas.width, canvas.height);

  const dati = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = dati.data;

  // Media dei grigi: soglia adattiva, così funziona sia con foto scure sia
  // con foto sovraesposte.
  let somma = 0;
  for (let i = 0; i < px.length; i += 4) {
    somma += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  const media = somma / (px.length / 4);

  for (let i = 0; i < px.length; i += 4) {
    const grigio = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    // Contrasto attorno alla media, senza binarizzare del tutto (una
    // soglia netta mangia i caratteri sottili della MRZ).
    let v = (grigio - media) * 1.8 + 140;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    px[i] = px[i + 1] = px[i + 2] = v;
  }

  ctx.putImageData(dati, 0, 0);
  return canvas;
}

function conTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout OCR')), ms);
    promise.then(
      valore => { clearTimeout(timer); resolve(valore); },
      errore => { clearTimeout(timer); reject(errore); }
    );
  });
}

// ------------------------------------------------------------------
// Punto di ingresso usato da checkin.js.
// Ritorna { dati } oppure { errore: 'pdf' | 'illeggibile' | 'ocr' }.
// Non lancia mai: un documento illeggibile non deve mai bloccare il
// check-in, al massimo l'ospite compila i campi a mano.
// ------------------------------------------------------------------
window.leggiDocumento = function(file, onStato) {
  const esecuzione = async () => {
    if (!file) return { errore: 'illeggibile' };
    // I PDF andrebbero prima renderizzati in immagine: fuori scope, si
    // compila a mano (succede solo con le scansioni da computer).
    if (file.type === 'application/pdf') return { errore: 'pdf' };

    let worker;
    try {
      if (onStato) onStato('preparazione');
      worker = await ottieniWorkerOCR();
    } catch (err) {
      console.warn('⚠️ OCR non disponibile:', err.message);
      return { errore: 'ocr' };
    }

    try {
      const img = await immagineDaFile(file);
      if (onStato) onStato('lettura');

      // Primo tentativo sulla fascia bassa (la MRZ è quasi sempre lì),
      // secondo sull'immagine intera se il documento è storto o ritagliato.
      for (const porzione of [0.45, 1]) {
        const canvas = canvasPerOCR(img, porzione);
        const risultato = await conTimeout(worker.recognize(canvas), OCR_TIMEOUT_MS);
        const testo = risultato?.data?.text || '';
        const dati = estraiDatiMRZ(testo);
        if (dati) return { dati };
      }

      return { errore: 'illeggibile' };
    } catch (err) {
      console.warn('⚠️ Lettura documento fallita:', err.message);
      return { errore: 'illeggibile' };
    } finally {
      programmaChiusuraWorker();
    }
  };

  // Accodamento: una lettura per volta, e un errore non blocca la coda.
  const risultato = ocrCoda.then(esecuzione, esecuzione);
  ocrCoda = risultato.catch(() => {});
  return risultato;
};
