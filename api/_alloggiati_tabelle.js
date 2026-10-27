// api/_alloggiati_tabelle.js — accesso alle tabelle ufficiali Alloggiati Web (Luoghi, Tipi_Documento, Tipi_Alloggiato).
//
// Stesso meccanismo del progetto principale (LaColumbera api/adempimenti.js → getTable): memoria → cache → servizio
// ufficiale (metodo "Tabella"), con la stessa interpretazione del CSV (buildTable). Differenze rispetto all'originale:
//  - la cache è su PostgreSQL (tabella alloggiati_tabelle) invece che su Redis/KV, perché questo progetto usa Neon;
//  - in alternativa al servizio, il gestore può caricare a mano il CSV ufficiale scaricato dal portale
//    (endpoint admin-alloggiati, azione "carica-tabella"): fonte "manuale", che non scade da sola.
// Nessuna lista statica: se le tabelle non sono disponibili il TXT NON viene generato.
import zlib from 'zlib';
import * as WS from './_alloggiati_ws.js';

export const NOMI_TABELLE = ['Luoghi', 'Tipi_Documento', 'Tipi_Alloggiato'];
export const TTL_WS_MS = 24 * 3600e3;          // come LaColumbera (TABLE_TTL_SEC = 24 h)

const memoria = new Map();                      // per istanza: nome → { at, table }

export const gz = csv => zlib.gzipSync(Buffer.from(csv, 'utf8')).toString('base64');
const gunz = b64 => zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');

// o = { store, env, fetch, now, network (bool), deadline (ms), token }
async function getTable(nome, o) {
  const now = o.now ? o.now() : Date.now();
  const m = memoria.get(nome);
  if (m && now - m.at < TTL_WS_MS) return { table: m.table };
  let salvata = null;
  try { salvata = await o.store.leggiTabella(nome); } catch { salvata = null; }
  if (salvata && (salvata.fonte === 'manuale' || now - salvata.aggiornataMs < TTL_WS_MS)) {
    try {
      const t = WS.buildTable(nome, gunz(salvata.csvGzB64));
      if (t.ok) { memoria.set(nome, { at: now, table: t }); return { table: t, fonte: salvata.fonte }; }
    } catch { /* cache illeggibile: si ricarica dal servizio */ }
  }
  if (!o.network) return { table: null, errore: { kind: 'cache_vuota' } };
  const c = WS.readConfig(o.env || {});
  if (c.missing.length) return { table: null, errore: { kind: 'config', missing: c.missing } };
  const net = () => ({ url: c.url, fetch: o.fetch, timeoutMs: Math.max(500, Math.min(8000, (o.deadline || now + 8000) - (o.now ? o.now() : Date.now()))) });
  let tk = o.token;
  if (!tk) { tk = await WS.generateToken(c, net()); if (!tk.ok) return { table: null, errore: tk }; o.token = tk; }
  const r = await WS.tabella(c, tk.token, nome, net());
  if (!r.ok) return { table: null, errore: r };
  const t = WS.buildTable(nome, r.csv);
  if (!t.ok) return { table: null, errore: { kind: 'formato', msg: 'Tabella ' + nome + ' non utilizzabile' } };
  memoria.set(nome, { at: now, table: t });
  try { await o.store.salvaTabella(nome, 'ws', gz(r.csv)); } catch { /* resta in memoria */ }
  return { table: t, fonte: 'ws' };
}

// Ritorna { ok, tables: { luoghi, documenti, tipi }, motivo, configurazioneMancante }. motivo senza segreti né dati personali.
export async function caricaTabelle(o) {
  const out = {}, errori = [];
  let configurazioneMancante = false;
  for (const nome of NOMI_TABELLE) {
    const r = await getTable(nome, o);
    if (!r.table) { errori.push(nome + ': ' + descriviErrore(r.errore)); if (r.errore && r.errore.kind === 'config') configurazioneMancante = true; }
    out[nome] = r.table;
  }
  const tables = { luoghi: out.Luoghi, documenti: out.Tipi_Documento, tipi: out.Tipi_Alloggiato };
  return errori.length ? { ok: false, tables, motivo: errori.join('; '), configurazioneMancante } : { ok: true, tables };
}

function descriviErrore(e) {
  if (!e) return 'non disponibile';
  if (e.kind === 'cache_vuota') return 'non presente in cache';
  if (e.kind === 'config') return 'credenziali del servizio non configurate (' + e.missing.join(', ') + ') e nessuna tabella caricata a mano';
  return WS.dettaglio(e);
}

// Caricamento manuale (endpoint admin): il CSV viene interpretato con lo stesso buildTable e salvato solo se utilizzabile.
export async function salvaTabellaManuale(store, nome, csv) {
  if (!NOMI_TABELLE.includes(nome)) return { ok: false, err: 'Tabella non valida' };
  const t = WS.buildTable(nome, csv);
  if (!t.ok) return { ok: false, err: 'Tabella non utilizzabile', avvisi: t.diag.avvisi };
  await store.salvaTabella(nome, 'manuale', gz(csv));
  memoria.delete(nome);
  return { ok: true, righe: t.size, colonne: t.diag.colonne, intestazione: t.diag.intestazione, scartate: t.diag.scartate, avvisi: t.diag.avvisi };
}

export function _svuotaMemoria() { memoria.clear(); }
