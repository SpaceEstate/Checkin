// api/_drive.js — salvataggio del TXT Alloggiati su Google Drive (cartella privata del gestore).
//
// Nel repository NON esisteva alcun salvataggio su Drive: questo modulo è nuovo e richiede una configurazione esplicita.
//  - Credenziali: lo stesso account di servizio Google già usato per Google Sheets (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY).
//    Nessuna nuova credenziale. Serve però che nel progetto Google Cloud sia attiva la Google Drive API.
//  - Cartella: GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID (nuova variabile, solo l'ID della cartella). La cartella va condivisa
//    con l'indirizzo dell'account di servizio come "Editor" e NON deve essere condivisa pubblicamente o "con chiunque abbia il link":
//    i file creati qui ereditano solo i permessi della cartella; questo modulo non crea mai permessi di condivisione.
//  - Attenzione (da verificare sull'account reale): un account di servizio non ha spazio di archiviazione proprio; in una
//    cartella del "Mio Drive" di un account Gmail personale il caricamento può essere rifiutato (storageQuotaExceeded).
//    Funziona con un Drive condiviso (Google Workspace). Il modulo riporta l'errore così com'è, senza simulare successi.
//  - Ambito OAuth minimo: drive.file (il servizio vede e modifica solo i file che ha creato lui).
// Idempotenza: ogni file porta appProperties.checkinId; prima di caricare si cerca un file con lo stesso checkinId.
// Successo dichiarato SOLO se Drive restituisce l'ID e l'MD5 del contenuto salvato coincide con quello inviato.
import crypto from 'crypto';
import { JWT } from 'google-auth-library';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const RE_ID = /^[A-Za-z0-9_-]{10,200}$/;

export function configDrive(env) {
  const folderId = String(env.GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID || '').trim();
  const missing = [];
  if (!folderId) missing.push('GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID');
  if (!env.GOOGLE_CLIENT_EMAIL) missing.push('GOOGLE_CLIENT_EMAIL');
  if (!env.GOOGLE_PRIVATE_KEY) missing.push('GOOGLE_PRIVATE_KEY');
  if (folderId && !RE_ID.test(folderId)) missing.push('GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID (formato non valido)');
  return { ok: missing.length === 0, missing, folderId };
}

const errore = (kind, extra) => Object.assign(new Error('Drive: ' + kind), { kind }, extra || {});

// deps = { env, fetch, getToken } — getToken iniettabile nei test
export function makeDrive(deps) {
  const env = deps.env, doFetch = deps.fetch || ((...a) => globalThis.fetch(...a));
  let jwt = null;
  const getToken = deps.getToken || (async () => {
    if (!jwt) jwt = new JWT({ email: env.GOOGLE_CLIENT_EMAIL, key: String(env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'), scopes: [SCOPE] });
    const t = await jwt.getAccessToken();
    if (!t || !t.token) throw errore('autenticazione');
    return t.token;
  });

  async function richiesta(url, init, timeoutMs) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs || 15000);
    try {
      const token = await getToken();
      const r = await doFetch(url, Object.assign({}, init, { headers: Object.assign({ Authorization: 'Bearer ' + token }, init.headers || {}), signal: ctl.signal }));
      return r;
    } catch (e) {
      if (e && e.kind) throw e;
      throw errore(e && e.name === 'AbortError' ? 'timeout' : 'rete');
    } finally { clearTimeout(timer); }
  }
  // Legge solo il codice/motivo dell'errore Google (mai il corpo della richiesta).
  async function motivo(r) {
    try { const j = await r.json(); const e = j && j.error; return (e && (e.errors && e.errors[0] && e.errors[0].reason || e.status)) || ''; } catch { return ''; }
  }

  async function cerca(cfg, checkinId) {
    if (!/^[a-z0-9]{6,40}$/i.test(checkinId)) throw errore('checkin_id_non_valido');
    const q = "'" + cfg.folderId + "' in parents and trashed = false and appProperties has { key='checkinId' and value='" + checkinId + "' }";
    const url = API + '?' + new URLSearchParams({ q, fields: 'files(id,name,md5Checksum,size)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '10' });
    const r = await richiesta(url, { method: 'GET' });
    if (!r.ok) throw errore('ricerca_http', { http: r.status, motivo: await motivo(r) });
    const j = await r.json();
    return Array.isArray(j.files) ? j.files : [];
  }

  // Carica (o ritrova, se già caricato) il TXT. Ritorna { fileId, nome, md5, riutilizzato }.
  async function caricaTxt({ nomeFile, contenuto, checkinId }) {
    const cfg = configDrive(env);
    if (!cfg.ok) throw errore('non_configurato', { missing: cfg.missing });
    const md5 = crypto.createHash('md5').update(contenuto, 'utf8').digest('hex');
    const esistenti = await cerca(cfg, checkinId);
    const uguale = esistenti.find(f => f.md5Checksum === md5);
    if (uguale) return { fileId: uguale.id, nome: uguale.name, md5, riutilizzato: true };
    if (esistenti.length) throw errore('contenuto_diverso_gia_presente', { quanti: esistenti.length });   // non si sovrascrive né si duplica: decide il gestore

    const boundary = 'lacolumbera' + crypto.randomBytes(12).toString('hex');
    const metadata = {
      name: nomeFile, mimeType: 'text/plain', parents: [cfg.folderId],
      description: 'Schedine Alloggiati Web da caricare MANUALMENTE sul portale. Il file NON è stato inviato. Eliminare solo dopo aver verificato la ricevuta Alloggiati.',
      appProperties: { checkinId }
    };
    const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
      '\r\n--' + boundary + '\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n' + contenuto + '\r\n--' + boundary + '--';
    const url = UPLOAD + '?' + new URLSearchParams({ uploadType: 'multipart', supportsAllDrives: 'true', fields: 'id,name,md5Checksum,size' });
    const r = await richiesta(url, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body }, 20000);
    if (!r.ok) throw errore('caricamento_http', { http: r.status, motivo: await motivo(r) });
    const j = await r.json();
    if (!j || !j.id) throw errore('risposta_senza_id');
    if (j.md5Checksum !== md5) throw errore('verifica_contenuto_fallita', { fileId: j.id });
    return { fileId: j.id, nome: j.name, md5, riutilizzato: false };
  }

  // Elimina definitivamente il file (solo file creati da questo servizio). 404 = già eliminato.
  async function eliminaFile(fileId) {
    if (!RE_ID.test(String(fileId || ''))) throw errore('file_id_non_valido');
    const r = await richiesta(API + '/' + encodeURIComponent(fileId) + '?supportsAllDrives=true', { method: 'DELETE' });
    if (r.status === 204 || r.status === 200) return { eliminato: true };
    if (r.status === 404) return { eliminato: true, giaAssente: true };
    throw errore('eliminazione_http', { http: r.status, motivo: await motivo(r) });
  }

  return { caricaTxt, eliminaFile, cerca };
}

// Descrizione dell'errore senza segreti né contenuti (per log e registro).
export const descriviErroreDrive = e => !e ? 'errore' : [e.kind || 'errore', e.http ? 'HTTP ' + e.http : '', e.motivo || '', e.missing ? 'mancano: ' + e.missing.join(', ') : ''].filter(Boolean).join(' · ');
