// api/_checkin-alloggiati.js — dai dati del check-in alle schedine Alloggiati Web (TXT pronto per il caricamento MANUALE).
//
// - Il formato, i controlli e la costruzione della riga a 168 caratteri sono quelli di _alloggiati.js (porting fedele di
//   LaColumbera): qui c'è SOLO la traduzione dei campi del modulo di check-in nei campi del tracciato.
// - I codici (stati, comuni, tipi documento, tipi alloggiato) si cercano nelle tabelle ufficiali caricate da
//   _alloggiati_tabelle.js. Ricerca per nome ESATTO (normalizzato come in buildTable/search: maiuscole, senza accenti
//   e punteggiatura): niente somiglianze, niente correzioni automatiche. Se un valore non si trova in modo univoco
//   la schedina NON è valida e il TXT non viene generato.
// - Nessun dato anagrafico viene corretto, completato o inventato. Nessun log.
// - Il TXT è un FILE DA CARICARE A MANO sul portale: generarlo non significa che sia stato inviato o accettato.
import * as AL from './_alloggiati.js';
import { norm, search } from './_alloggiati_ws.js';

export const MAX_OSPITI = 9;               // il modulo di check-in ne gestisce al massimo 9
export const SEPARATORE_RIGHE = '\r\n';    // vedi docs/gdpr/checkin-modifiche.md (scelta tecnica da verificare al primo caricamento)

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const CAMPO_MODULO = { cognome: 'cognome', nome: 'nome', sesso: 'genere', nascita: 'nascita', comune: 'comune', prov: 'provincia',
  stato: 'luogo_nascita', cittad: 'cittadinanza', tipodoc: 'tipo_documento', numdoc: 'numero_documento', luogo: 'luogo_rilascio', arrivo: 'data-checkin', giorni: 'numero-notti', tipo: 'tipo-gruppo' };

function trovaLuogo(luoghi, valore, kind, prov) {
  const k = norm(valore);
  if (!k) return { esito: 'vuoto' };
  if (kind === 'stato' && k === 'ITALIA' && luoghi.italia) return { esito: 'ok', codice: luoghi.italia };
  let c = luoghi.list().filter(e => e.kind === kind && norm(e.nome) === k && (!prov || e.prov === prov));
  if (c.length > 1) { const attivi = c.filter(e => !e.fine); if (attivi.length) c = attivi; }
  if (c.length === 1) return { esito: 'ok', codice: c[0].codice };
  return { esito: c.length ? 'ambiguo' : 'non_trovato' };
}
function trovaDocumento(documenti, valore) {
  const k = norm(valore);
  if (!k) return { esito: 'vuoto' };
  const c = documenti.list().filter(e => norm(e.nome) === k);
  if (c.length === 1) return { esito: 'ok', codice: c[0].codice };
  return { esito: c.length ? 'ambiguo' : 'non_trovato' };
}
const isoToIt = iso => (typeof iso === 'string' && RE_ISO.test(iso) && AL.isIso(iso)) ? AL.fmtIt(iso) : '';
const testo = v => (typeof v === 'string' ? v.trim() : '');

// Costruisce le schedine nell'ordine richiesto (capo famiglia/gruppo seguito dai componenti).
// Ritorna { records, ospiti, problemi } — problemi = errori di corrispondenza con le tabelle o di struttura.
export function costruisciSchedine(dati, tables) {
  const problemi = [];
  const p = (ospite, campo, code, msg, extra) => problemi.push(Object.assign({ sev: 'errore', ospite, campo, code, msg }, extra || {}));
  const ospiti = Array.isArray(dati && dati.ospiti) ? dati.ospiti.slice().sort((a, b) => (a.numero || 0) - (b.numero || 0)) : [];
  const n = ospiti.length;
  if (!n) { p(null, null, 'NESSUN_OSPITE', 'Nessun ospite nei dati del check-in'); return { records: [], ospiti, problemi }; }
  if (n > MAX_OSPITI) { p(null, null, 'TROPPI_OSPITI', 'Troppi ospiti (massimo ' + MAX_OSPITI + ')'); return { records: [], ospiti, problemi }; }
  if (parseInt(dati.numeroOspiti, 10) !== n) p(null, null, 'NUMERO_OSPITI', 'Il numero di ospiti dichiarato non corrisponde agli ospiti compilati');
  if (!(ospiti[0].numero === 1 && ospiti[0].isResponsabile === true)) p(1, null, 'RESPONSABILE', 'Manca l\'ospite responsabile (numero 1)');

  // tipo alloggiato: 16 ospite singolo; con più ospiti 17+19 (famiglia) o 18+20 (gruppo) secondo la scelta dell'ospite
  let tipoCapo = '16', tipoMembro = null;
  if (n > 1) {
    if (dati.tipoGruppo === 'famiglia') { tipoCapo = '17'; tipoMembro = '19'; }
    else if (dati.tipoGruppo === 'generico') { tipoCapo = '18'; tipoMembro = '20'; }
    else p(null, 'tipo', 'TIPO_GRUPPO', 'Tipo di gruppo (famiglia o gruppo) non indicato');
  }
  const arrivo = isoToIt(dati.dataCheckin);
  const notti = parseInt(dati.numeroNotti, 10);
  const giorni = Number.isInteger(notti) && notti >= 0 && String(dati.numeroNotti).trim() === String(notti) ? String(notti).padStart(2, '0') : '';
  const L = tables.luoghi, D = tables.documenti;

  const records = ospiti.map((o, i) => {
    const num = o.numero || i + 1, capo = i === 0;
    const r = AL.emptyRecord(tipoCapo, arrivo);
    r.tipo = capo ? tipoCapo : (tipoMembro || '');   // emptyRecord userebbe "16" come ripiego: qui un tipo mancante deve restare un errore
    r.arrivo = arrivo;
    r.giorni = giorni;
    r.cognome = testo(o.cognome);
    r.nome = testo(o.nome);
    r.sesso = o.genere === 'M' ? '1' : o.genere === 'F' ? '2' : '';
    r.nascita = isoToIt(o.nascita);
    const luogo = (campo, valore) => {
      const x = trovaLuogo(L, valore, 'stato');
      if (x.esito === 'ok') return x.codice;
      if (x.esito !== 'vuoto') p(num, campo, x.esito === 'ambiguo' ? 'STATO_AMBIGUO' : 'STATO_NON_IN_TABELLA', AL.NOMI[campo] + ': lo Stato indicato non corrisponde in modo univoco a una voce della tabella ufficiale Luoghi');
      return '';
    };
    r.stato = luogo('stato', o.luogoNascita);
    r.cittad = luogo('cittad', o.cittadinanza);
    if (r.stato && L.italia && r.stato === L.italia) {
      const prov = testo(o.provincia);
      r.prov = prov;
      const x = trovaLuogo(L, o.comune, 'comune', prov);
      if (x.esito === 'ok') r.comune = x.codice;
      else if (x.esito !== 'vuoto') {
        // solo SUGGERIMENTI da mostrare all'ospite (sceglie lui): prima per testo intero, poi per prima parola, nella provincia indicata
        const primaParola = norm(o.comune).split(' ')[0] || '';
        const cand = search(L, o.comune, { kind: 'comune', limit: 8 }).concat(primaParola.length >= 3 ? search(L, primaParola, { kind: 'comune', limit: 25 }) : []);
        const visti = new Set(), sugg = [];
        for (const s of cand) if (s.prov === prov && !visti.has(s.codice)) { visti.add(s.codice); sugg.push(s.nome + ' (' + s.prov + ')'); }
        sugg.splice(5);
        p(num, 'comune', x.esito === 'ambiguo' ? 'COMUNE_AMBIGUO' : 'COMUNE_NON_IN_TABELLA', 'Comune di nascita non trovato in modo univoco nella tabella ufficiale per la provincia indicata', { suggerimenti: sugg });
      }
    }
    if (capo) {
      const td = trovaDocumento(D, o.tipoDocumento);
      if (td.esito === 'ok') r.tipodoc = td.codice;
      else if (td.esito !== 'vuoto') p(num, 'tipodoc', 'DOCUMENTO_NON_IN_TABELLA', 'Tipo documento non corrispondente in modo univoco alla tabella ufficiale Tipi_Documento');
      r.numdoc = testo(o.numeroDocumento);
      r.luogo = luogo('luogo', o.luogoRilascio);
    }
    r._ospite = num;
    return r;
  });
  return { records, ospiti, problemi };
}

// Valida e, se tutto è corretto, produce il TXT. Ritorna:
// { ok, txt, lines, hash, righe, problemi: [...errori], avvisi: [...] }  — problemi/avvisi con { ospite, campo, code, sev, msg }.
export function generaTxt(dati, tables, now) {
  if (!tables || !tables.luoghi || !tables.documenti || !tables.tipi) {
    return { ok: false, problemi: [{ sev: 'errore', ospite: null, campo: null, code: 'TABELLE', msg: 'Tabelle ufficiali non disponibili' }], avvisi: [] };
  }
  const { records, problemi } = costruisciSchedine(dati, tables);
  if (!records.length) return { ok: false, problemi, avvisi: [] };
  const v = AL.validateRecords(records, { now: now != null ? now : Date.now(), tables });
  const conMappatura = new Set(problemi.map(x => x.ospite + ':' + x.campo));
  const avvisi = [];
  for (const g of v.globali) (g.sev === 'errore' ? problemi : avvisi).push({ sev: g.sev, ospite: null, campo: g.campo, code: g.code, msg: g.msg });
  v.records.forEach((r, i) => {
    const ospite = records[i]._ospite;
    for (const is of r.issues) {
      // "mancante" su un campo già segnalato come non trovato in tabella: lo spiega già il primo messaggio
      if (is.code === 'OBBLIGATORIO' && conMappatura.has(ospite + ':' + is.campo)) continue;
      (is.sev === 'errore' ? problemi : avvisi).push({ sev: is.sev, ospite, campo: is.campo, code: is.code, msg: is.msg });
    }
    if (i === 0 && r.luogo && tables.luoghi.italia && r.luogo === tables.luoghi.italia) {
      avvisi.push({ sev: 'avviso', ospite, campo: 'luogo', code: 'RILASCIO_ITALIA', msg: 'Documento rilasciato in Italia: il modulo raccoglie solo lo Stato di rilascio, quindi nel TXT il luogo di rilascio è "Italia". Verificare sul portale se per i documenti italiani è richiesto il comune di rilascio.' });
    }
  });
  const ok = problemi.length === 0 && !!v.lines && v.riepilogo.inviabile;
  if (!ok && !problemi.length) problemi.push({ sev: 'errore', ospite: null, campo: null, code: 'NON_GENERABILE', msg: 'Schedine non generabili' });
  return ok
    ? { ok: true, txt: v.lines.join(SEPARATORE_RIGHE) + SEPARATORE_RIGHE, lines: v.lines, hash: v.hash, righe: v.lines.length, problemi: [], avvisi }
    : { ok: false, problemi, avvisi };
}

// Versione da conservare nel registro tecnico: SOLO codici e posizione, mai messaggi (possono contenere i valori inseriti).
export const problemiSenzaDati = list => (list || []).slice(0, 60).map(x => ({ sev: x.sev, ospite: x.ospite == null ? null : x.ospite, campo: x.campo || null, code: x.code }));

// Problemi che l'ospite può correggere da solo nel modulo (pre-verifica prima del pagamento). Gli altri (es. Stato non
// trovato in tabella) dipendono dalle tabelle o dal modulo e li gestisce il gestore: all'ospite non si mostrano.
const CORREGGIBILI = {
  cognome: ['CARATTERE', 'LUNGHEZZA_CAMPO'],
  nome: ['CARATTERE', 'LUNGHEZZA_CAMPO'],
  comune: ['COMUNE_NON_IN_TABELLA', 'COMUNE_AMBIGUO'],
  numdoc: ['CARATTERE', 'LUNGHEZZA_CAMPO']
};
const CODICE_OSPITE = { CARATTERE: 'caratteri_non_ammessi', LUNGHEZZA_CAMPO: 'troppo_lungo', COMUNE_NON_IN_TABELLA: 'comune_non_trovato', COMUNE_AMBIGUO: 'comune_non_trovato' };
export function problemiCorreggibiliDallOspite(problemi) {
  return (problemi || []).filter(x => x.ospite && CORREGGIBILI[x.campo] && CORREGGIBILI[x.campo].includes(x.code))
    .map(x => ({ ospite: x.ospite, campo: CAMPO_MODULO[x.campo], codice: CODICE_OSPITE[x.code], suggerimenti: Array.isArray(x.suggerimenti) ? x.suggerimenti : [] }));
}

export function nomeFileTxt(dataArrivo, checkinId) {
  const d = typeof dataArrivo === 'string' && RE_ISO.test(dataArrivo) ? dataArrivo : 'data-non-valida';
  return 'alloggiati_' + d + '_' + String(checkinId).replace(/[^a-z0-9]/gi, '') + '.txt';
}
