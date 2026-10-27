// tests/helpers.mjs — strumenti comuni ai test. TUTTI i dati sono di fantasia (persone, codici, immagini).
// Nessuna rete, nessun database reale, nessuna email reale, nessuna chiamata a Stripe o Google.
import crypto from 'crypto';
import { createRequire } from 'module';
import * as WS from '../api/_alloggiati_ws.js';

export const requireApi = createRequire(new URL('../api/package.json', import.meta.url));

// Tabelle SINTETICHE nel formato CSV del servizio (codici inventati: non sono i codici ufficiali).
// Le prime righe sono quelle del mock di LaColumbera (tests/sim/soap-mock.js), usate dalle fixture.
export const TABELLE_CSV = {
  Luoghi: [
    'Codice;Descrizione;Provincia;DataFineVal',
    '100000100;ITALIA;;', '100000248;ESTERIA;;', '100000424;ALTRONIA;;', '100000300;TERZISTAN;;',
    '100000901;GERMANIA;;', '100000902;FRANCIA;;',
    '400000001;COMUNE DI PROVA;TN;', '400000002;BORGO D\'ESEMPIO;RM;', '400000003;SAN MARTINO ALTO;MI;',
    '400000010;ROMA;RM;', '400000011;REGGIO NELL\'EMILIA;RE;',
    '400000012;SAN MICHELE;TN;', '400000013;SAN MICHELE;TN;31/12/2000',
    '400000014;CASTELLO;BG;', '400000015;CASTELLO;BG;'
  ].join('\n') + '\n',
  Tipi_Documento: 'Codice;Descrizione\nIDENT;CARTA DI IDENTITA\'\nIDELE;CARTA IDENTITA\' ELETTRONICA\nPASOR;PASSAPORTO ORDINARIO\nPATEN;PATENTE DI GUIDA\n',
  Tipi_Alloggiato: 'Codice;Descrizione\n16;OSPITE SINGOLO\n17;CAPO FAMIGLIA\n18;CAPO GRUPPO\n19;FAMILIARE\n20;MEMBRO GRUPPO\n'
};
export const tabelle = () => ({
  luoghi: WS.buildTable('Luoghi', TABELLE_CSV.Luoghi),
  documenti: WS.buildTable('Tipi_Documento', TABELLE_CSV.Tipi_Documento),
  tipi: WS.buildTable('Tipi_Alloggiato', TABELLE_CSV.Tipi_Alloggiato)
});
export const caricaTabelleOk = async () => ({ ok: true, tables: tabelle() });
export const caricaTabelleKo = async () => ({ ok: false, tables: {}, motivo: 'Luoghi: servizio non raggiungibile', configurazioneMancante: false });

// "Immagini" sintetiche: solo la firma dei byte del formato + riempimento. Nessun documento reale.
export const fintoJpeg = (n = 600) => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(n, 0x41)]);
export const fintoPdf = (n = 600) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(n, 0x20)]);
export const dataUri = (mime, buf) => 'data:' + mime + ';base64,' + buf.toString('base64');

export const NOW = Date.parse('2026-11-02T09:00:00Z');

// Check-in di fantasia: famiglia di 3 (responsabile nato in Italia, documento italiano)
export function checkinFamiglia(over) {
  return Object.assign({
    dataCheckin: '2026-11-05', appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto',
    numeroOspiti: 3, numeroNotti: 3, tipoGruppo: 'famiglia', lingua: 'it',
    ospiti: [
      { numero: 1, isResponsabile: true, cognome: 'Provaccia', nome: 'Ermenegilda', genere: 'F', nascita: '1980-04-19', cittadinanza: 'Italia', luogoNascita: 'Italia', comune: 'Roma', provincia: 'RM',
        tipoDocumento: "CARTA IDENTITA' ELETTRONICA", numeroDocumento: 'ZZ9900011', luogoRilascio: 'Italia' },
      { numero: 2, cognome: 'Provaccia', nome: 'Teodorico', genere: 'M', nascita: '2010-11-10', cittadinanza: 'Germania', luogoNascita: 'Germania' },
      { numero: 3, cognome: 'Provaccia', nome: 'Clotilde', genere: 'F', nascita: '2004-01-15', cittadinanza: 'Italia', luogoNascita: 'Italia', comune: "Reggio nell'Emilia", provincia: 'RE' }
    ],
    documenti: [
      { lato: 'fronte', mime: 'image/jpeg', base64: fintoJpeg().toString('base64') },
      { lato: 'retro', mime: 'image/jpeg', base64: fintoJpeg(700).toString('base64') }
    ]
  }, over || {});
}
// Valori anagrafici da cercare nei log/registri: non devono MAI comparire
export const VALORI_SENSIBILI = ['Provaccia', 'Ermenegilda', 'Teodorico', 'Clotilde', 'ZZ9900011', '1980-04-19', '19/04/1980', fintoJpeg().toString('base64').slice(0, 40)];

// Store in memoria con la stessa interfaccia di pgStore (api/_db.js)
export function memStore(clock) {
  const now = clock || (() => NOW);
  const sessioni = new Map(), registri = new Map(), tab = new Map();
  const s = {
    sessioni, registri, chiamate: [],
    async salvaDatiTemporanei(id, dati, scadenza) { if (sessioni.has(id)) return 'esiste'; sessioni.set(id, { data: JSON.parse(JSON.stringify(dati)), expires: +scadenza }); return 'ok'; },
    async leggiDatiTemporanei(id) { const x = sessioni.get(id); return x && x.expires > now() ? JSON.parse(JSON.stringify(x.data)) : null; },
    async estendiScadenzaDatiTemporanei(id, fino) { const x = sessioni.get(id); if (x && x.expires < +fino) x.expires = +fino; },
    async eliminaDatiTemporanei(id) { return sessioni.delete(id) ? 1 : 0; },
    async pulisciScaduti(giorni) {
      let n = 0; for (const [k, v] of sessioni) if (v.expires < now()) { sessioni.delete(k); n++; }
      let r = 0; const lim = now() - (giorni || 30) * 864e5;
      for (const [k, v] of registri) if ((!v.drive_file_id || v.drive_eliminato_at) && +(v.drive_eliminato_at || v.updated_at) < lim) { registri.delete(k); r++; }
      return { sessioni: n, registri: r };
    },
    async ottieniOCreaRegistro({ checkinId, stripeSessionId, tempSessionId, dataArrivo }) {
      if (!registri.has(checkinId)) registri.set(checkinId, { checkin_id: checkinId, stripe_session_id: stripeSessionId, temp_session_id: tempSessionId, data_arrivo: dataArrivo,
        txt_stato: 'da_elaborare', txt_problemi: null, txt_nome_file: null, txt_sha256: null, drive_file_id: null, drive_salvato_at: null, drive_eliminato_at: null,
        email_ospite_stato: 'da_inviare', email_gestore_stato: 'da_inviare', dati_temporanei_eliminati_at: null, in_corso_fino: null, created_at: new Date(now()), updated_at: new Date(now()) });
      return Object.assign({}, registri.get(checkinId));
    },
    async leggiRegistro(id) { const r = registri.get(id); return r ? Object.assign({}, r) : null; },
    async elencoRegistri() { return [...registri.values()].map(r => Object.assign({}, r)); },
    async acquisisciLease(id, ms) { const r = registri.get(id); if (r.in_corso_fino && +r.in_corso_fino > now()) return false; r.in_corso_fino = new Date(now() + ms); return true; },
    async rilasciaLease(id) { const r = registri.get(id); if (r) r.in_corso_fino = null; },
    async aggiornaRegistro(id, patch) { Object.assign(registri.get(id), JSON.parse(JSON.stringify(patch)), { updated_at: new Date(now()) }); },
    async leggiTabella(nome) { return tab.get(nome) || null; },
    async salvaTabella(nome, fonte, csvGzB64) { tab.set(nome, { fonte, csvGzB64, aggiornataMs: now() }); }
  };
  return s;
}

// Finta API di Google Drive (solo gli endpoint usati da api/_drive.js)
export function fintaDriveApi(opts) {
  const o = Object.assign({ falliscicaricamenti: 0, md5Sbagliato: false, quota: false }, opts || {});
  const files = new Map(), log = [];
  let n = 0;
  const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  const fetch = async (url, init) => {
    const u = new URL(url), metodo = init.method;
    log.push({ metodo, path: u.pathname, auth: init.headers && init.headers.Authorization });
    if (metodo === 'GET' && u.pathname === '/drive/v3/files') {
      const q = u.searchParams.get('q'), m = /value='([^']+)'/.exec(q), p = /'([^']+)' in parents/.exec(q);
      return resp(200, { files: [...files.values()].filter(f => f.appProperties.checkinId === m[1] && f.parents.includes(p[1])).map(f => ({ id: f.id, name: f.name, md5Checksum: f.md5Checksum })) });
    }
    if (metodo === 'POST' && u.pathname === '/upload/drive/v3/files') {
      if (o.quota) return resp(403, { error: { errors: [{ reason: 'storageQuotaExceeded' }] } });
      if (o.falliscicaricamenti > 0) { o.falliscicaricamenti--; return resp(503, { error: { status: 'UNAVAILABLE' } }); }
      const body = init.body, boundary = /boundary=(\S+)/.exec(init.headers['Content-Type'])[1];
      const parti = body.split('--' + boundary);
      const meta = JSON.parse(parti[1].split('\r\n\r\n')[1]);
      const contenuto = parti[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      const id = 'FILEID' + String(++n).padStart(8, '0');
      const md5 = o.md5Sbagliato ? '0'.repeat(32) : crypto.createHash('md5').update(contenuto, 'utf8').digest('hex');
      files.set(id, Object.assign({ id, md5Checksum: md5, contenuto }, meta));
      return resp(200, { id, name: meta.name, md5Checksum: md5 });
    }
    if (metodo === 'DELETE') { const id = u.pathname.split('/').pop(); return files.delete(id) ? resp(204, {}) : resp(404, { error: { status: 'NOT_FOUND' } }); }
    return resp(400, {});
  };
  return { fetch, files, log, opts: o };
}
export const ENV_DRIVE = { GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID: 'CARTELLAfinta_0123456789', GOOGLE_CLIENT_EMAIL: 'servizio@esempio.invalid', GOOGLE_PRIVATE_KEY: 'chiave-finta' };

// Finti req/res per gli handler Vercel
export function fintoRes() {
  const r = { statusCode: 200, headers: {}, body: undefined };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; return r; };
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.send = b => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
export const fintoReq = (method, body, headers, query) => ({ method, body, headers: headers || {}, query: query || {} });

// Cattura console.* durante fn
export async function catturaLog(fn) {
  const righe = [], orig = {};
  for (const k of ['log', 'warn', 'error', 'info']) { orig[k] = console[k]; console[k] = (...a) => righe.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); }
  try { const v = await fn(); return { v, righe }; } finally { Object.assign(console, orig); }
}
export const contieneSensibili = testo => VALORI_SENSIBILI.filter(v => String(testo).includes(v));
