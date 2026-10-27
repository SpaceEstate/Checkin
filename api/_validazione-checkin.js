// api/_validazione-checkin.js — controllo e minimizzazione dei dati del check-in prima che vengano salvati.
//
// Si conservano SOLO i campi che servono a generare il TXT Alloggiati e a inviare al gestore l'immagine del documento:
// tutto il resto che arriva dal browser viene scartato. Le immagini sono controllate per tipo reale (firma dei byte,
// non solo il tipo dichiarato), numero e dimensione. Nessun log, nessun valore nei messaggi di errore.
import { MAX_OSPITI } from './_checkin-alloggiati.js';

export const TIPI_DOCUMENTO_IMMAGINE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_BYTE_DOCUMENTO = 1024 * 1024;          // dopo la compressione nel browser un lato pesa al massimo ~900 KB
export const MAX_BYTE_RICHIESTA = 4 * 1024 * 1024;      // il limite di Vercel per il corpo della richiesta è ~4,5 MB
const LATI = ['fronte', 'retro'];
const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const RE_SESSIONE = /^temp_\d{10,16}_[a-z0-9]{1,16}$/;

export const sessionIdValido = s => typeof s === 'string' && RE_SESSIONE.test(s);

// Tipo reale dai primi byte
export function tipoDaFirma(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}
const ESTENSIONE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

// Decodifica un documento salvato ({ lato, base64 }). Ritorna { lato, buffer, mime, ext } oppure { errore } (codice, senza contenuti).
export function decodificaDocumento(doc) {
  if (!doc || typeof doc !== 'object' || !LATI.includes(doc.lato) || typeof doc.base64 !== 'string') return { errore: 'DOCUMENTO_NON_VALIDO' };
  let b64 = doc.base64;
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/i.exec(b64);
  if (m) b64 = b64.slice(m[0].length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { errore: 'DOCUMENTO_NON_BASE64' };
  if (b64.length * 0.75 > MAX_BYTE_DOCUMENTO + 4) return { errore: 'DOCUMENTO_TROPPO_GRANDE' };
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length < 100) return { errore: 'DOCUMENTO_VUOTO' };
  if (buffer.length > MAX_BYTE_DOCUMENTO) return { errore: 'DOCUMENTO_TROPPO_GRANDE' };
  const mime = tipoDaFirma(buffer);
  if (!mime || !TIPI_DOCUMENTO_IMMAGINE.includes(mime)) return { errore: 'DOCUMENTO_TIPO_NON_AMMESSO' };
  return { lato: doc.lato, buffer, mime, ext: ESTENSIONE[mime] };
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strOpt = (v, max) => { const s = str(v, max); return s || undefined; };

// Ritorna { ok: true, dati } con i soli campi necessari, oppure { ok: false, errore } (codice generico).
export function minimizzaDatiCheckin(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errore: 'DATI_NON_VALIDI' };
  const ospitiIn = Array.isArray(input.ospiti) ? input.ospiti : [];
  if (!ospitiIn.length || ospitiIn.length > MAX_OSPITI) return { ok: false, errore: 'OSPITI_NON_VALIDI' };
  if (!RE_ISO.test(String(input.dataCheckin || ''))) return { ok: false, errore: 'DATA_NON_VALIDA' };
  const ospiti = [];
  for (const o of ospitiIn) {
    if (!o || typeof o !== 'object') return { ok: false, errore: 'OSPITI_NON_VALIDI' };
    const numero = parseInt(o.numero, 10);
    if (!Number.isInteger(numero) || numero < 1 || numero > MAX_OSPITI) return { ok: false, errore: 'OSPITI_NON_VALIDI' };
    const x = {
      numero,
      cognome: str(o.cognome, 60), nome: str(o.nome, 60),
      genere: o.genere === 'M' || o.genere === 'F' ? o.genere : '',
      nascita: RE_ISO.test(String(o.nascita || '')) ? o.nascita : '',
      cittadinanza: str(o.cittadinanza, 80), luogoNascita: str(o.luogoNascita, 80),
      comune: strOpt(o.comune, 80), provincia: strOpt(o.provincia, 4)
    };
    if (numero === 1) {
      x.isResponsabile = true;
      x.tipoDocumento = str(o.tipoDocumento, 60);
      x.numeroDocumento = str(o.numeroDocumento, 30);
      x.luogoRilascio = str(o.luogoRilascio, 80);
    }
    ospiti.push(x);
  }
  if (new Set(ospiti.map(o => o.numero)).size !== ospiti.length) return { ok: false, errore: 'OSPITI_NON_VALIDI' };
  const docIn = Array.isArray(input.documenti) ? input.documenti : [];
  if (docIn.length > LATI.length) return { ok: false, errore: 'TROPPI_DOCUMENTI' };
  const documenti = [];
  for (const d of docIn) {
    const dec = decodificaDocumento(d);
    if (dec.errore) return { ok: false, errore: dec.errore };
    if (documenti.some(x => x.lato === dec.lato)) return { ok: false, errore: 'DOCUMENTO_DUPLICATO' };
    documenti.push({ lato: dec.lato, mime: dec.mime, base64: dec.buffer.toString('base64') });
  }
  return {
    ok: true,
    dati: {
      dataCheckin: input.dataCheckin,
      appartamento: str(input.appartamento, 200),
      numeroOspiti: parseInt(input.numeroOspiti, 10) || 0,
      numeroNotti: parseInt(input.numeroNotti, 10) || 0,
      tipoGruppo: input.tipoGruppo === 'famiglia' || input.tipoGruppo === 'generico' ? input.tipoGruppo : null,
      lingua: ['it', 'en', 'de'].includes(input.lingua) ? input.lingua : 'it',
      ospiti,
      documenti
    }
  };
}
