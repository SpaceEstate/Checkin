// scansione/decodifica-heic.js — worker che apre UNA foto HEIC/HEIF con heic-to (libheif, LGPL-3.0, vendor/heic-to).
// heic-to apre a sua volta un worker interno e non lo chiude mai: per questo gira qui dentro. scansione-documento.js chiude
// questo worker appena ha l'immagine, e con lui si chiudono il worker interno, la sua memoria e il suo indirizzo blob:.
// Riceve il file, restituisce un'ImageBitmap (trasferita, nessuna copia). Nessuna rete, nessuna archiviazione, nessuna console.
import { heicTo } from './vendor/heic-to/heic-to.js';

self.onmessage = async evento => {
  try {
    const bitmap = await heicTo({ blob: evento.data, type: 'bitmap' });
    self.postMessage({ ok: true, bitmap }, [bitmap]);
  } catch (e) {
    self.postMessage({ ok: false });
  }
};
