// api/admin-alloggiati.js — endpoint RISERVATO al gestore per i file Alloggiati Web del check-in.
//
// Autenticazione: header  x-admin-secret: <ADMIN_SECRET>  (stessa variabile già usata dagli altri endpoint admin;
// qui solo header, mai in URL). Risposte con Cache-Control: no-store.
//
// Azioni (POST JSON { azione, ... }; "elenco" e "stato" anche in GET ?azione=...):
//  - stato                    configurazione (solo presenza delle variabili, mai i valori) e disponibilità delle tabelle
//  - elenco                   registro tecnico degli ultimi check-in (nessun dato anagrafico)
//  - scarica-txt   {checkinId}  TXT generato al momento dai dati temporanei (se ancora presenti e validi): utile se il
//                             salvataggio su Drive non è configurato o è fallito. Contiene dati personali: usalo solo per
//                             caricarlo sul portale e poi eliminalo dal tuo computer.
//  - bozza         {checkinId}  campi delle schedine e problemi trovati, per completare a mano una comunicazione non valida
//  - elimina-txt   {checkinId, conferma: "RICEVUTA_VERIFICATA"}  elimina il TXT da Google Drive. Da usare SOLO dopo aver
//                             verificato personalmente la ricevuta sul portale Alloggiati Web: il sistema non la verifica.
//  - elimina-dati-temporanei {checkinId, conferma: "ELIMINA"}  cancella subito anagrafiche e immagini ancora in attesa
//  - carica-tabella {nome, csv}  carica a mano una tabella ufficiale (Luoghi, Tipi_Documento, Tipi_Alloggiato) scaricata dal portale
//  - prova-drive              carica nella cartella un file di prova SENZA dati personali, ne verifica il contenuto e lo elimina:
//                             serve a controllare la configurazione di Drive senza aspettare un check-in
//  - prova-tabelle            legge le tabelle ufficiali (dal servizio, se configurato) e le mette in cache: controlla le credenziali
//  - prova-pdf                genera con Browserless un PDF di riepilogo con dati DI FANTASIA (nessuna email inviata):
//                             controlla che BROWSERLESS_API_TOKEN sia configurata e accettata
// Nessuna azione invia nulla ad Alloggiati Web.
//
// Pulizia programmata: il cron di Vercel chiama GET /api/admin-alloggiati (senza "azione" e senza x-admin-secret,
// con "Authorization: Bearer <CRON_SECRET>"): viene gestita da _pulizia.js. È qui e non in un endpoint separato
// perché il piano Vercel Hobby ammette al massimo 12 funzioni per deployment.
import crypto from 'crypto';
import { gestisciPulizia } from './_pulizia.js';
import { pgStore } from './_db.js';
import { caricaTabelle, salvaTabellaManuale } from './_alloggiati_tabelle.js';
import { generaTxt, costruisciSchedine, nomeFileTxt } from './_checkin-alloggiati.js';
import { makeDrive, configDrive, descriviErroreDrive } from './_drive.js';
import { readConfig } from './_alloggiati_ws.js';
import { generaPdfRiepilogo } from './_pdf-riepilogo.js';

const RE_CHECKIN = /^ck[0-9a-f]{16}$/;

function autorizzato(req, env) {
  const atteso = String(env.ADMIN_SECRET || ''), ricevuto = String(req.headers['x-admin-secret'] || '');
  if (!atteso || !ricevuto) return false;
  const a = crypto.createHash('sha256').update(atteso).digest(), b = crypto.createHash('sha256').update(ricevuto).digest();
  return crypto.timingSafeEqual(a, b);
}

export function makeHandler(deps) {
  const { store, env } = deps, now = deps.now || (() => Date.now());
  const drive = deps.drive || makeDrive({ env });
  const tabelle = () => deps.caricaTabelle({ store, env, fetch: deps.fetch, now, network: true, deadline: now() + 15000 });

  async function registroEDati(checkinId) {
    if (!RE_CHECKIN.test(String(checkinId || ''))) return { err: [400, 'checkinId non valido'] };
    const reg = await store.leggiRegistro(checkinId);
    if (!reg) return { err: [404, 'Check-in non trovato'] };
    const dati = reg.temp_session_id && !reg.dati_temporanei_eliminati_at ? await store.leggiDatiTemporanei(reg.temp_session_id) : null;
    return { reg, dati };
  }

  const azioni = {
    async stato() {
      const d = configDrive(env), ws = readConfig(env), cache = await deps.caricaTabelle({ store, env, now, network: false });
      return [200, {
        drive: { configurato: d.ok, mancanti: d.missing },
        tabelleAlloggiati: { inCache: cache.ok, credenzialiServizio: ws.missing.length === 0, mancanti: ws.missing },
        emailGestore: { configurata: !!(env.EMAIL_PROPRIETARIO && env.EMAIL_USER && env.EMAIL_PASSWORD) },
        nota: 'Nessun invio ad Alloggiati Web è previsto da questo sistema.'
      }];
    },
    async 'prova-drive'() {
      const d = configDrive(env);
      if (!d.ok) return [200, { ok: false, esito: 'Drive non configurato', mancanti: d.missing }];
      const id = 'ckprova' + crypto.randomBytes(6).toString('hex');
      let caricato = null;
      try {
        caricato = await drive.caricaTxt({ nomeFile: 'prova-configurazione-' + new Date(now()).toISOString().slice(0, 10) + '.txt', contenuto: 'File di prova del sistema di check-in: nessun dato personale.\r\n', checkinId: id });
      } catch (e) {
        const quota = e && e.motivo === 'storageQuotaExceeded';
        return [200, { ok: false, esito: 'Caricamento NON riuscito', dettaglio: descriviErroreDrive(e),
          suggerimento: quota ? 'L\'account di servizio non ha spazio proprio: serve una cartella in un Drive condiviso (Google Workspace) o un\'altra soluzione.'
            : 'Controlla: Google Drive API attiva nel progetto Google Cloud, cartella condivisa come Editor con l\'indirizzo GOOGLE_CLIENT_EMAIL, ID cartella corretto.' }];
      }
      try { await drive.eliminaFile(caricato.fileId); }
      catch (e) { return [200, { ok: true, esito: 'Caricamento riuscito, ma il file di prova non è stato eliminato: cancellalo a mano dalla cartella', dettaglio: descriviErroreDrive(e) }]; }
      return [200, { ok: true, esito: 'Caricamento su Drive riuscito e verificato; file di prova eliminato' }];
    },
    async 'prova-pdf'() {
      if (!env.BROWSERLESS_API_TOKEN) return [200, { ok: false, esito: 'BROWSERLESS_API_TOKEN non configurata su Vercel (o manca il Redeploy dopo averla aggiunta)' }];
      const fantasia = { dataCheckin: '2030-01-01', appartamento: 'PROVA', numeroOspiti: 1, numeroNotti: 1, tipoGruppo: null,
        ospiti: [{ numero: 1, isResponsabile: true, cognome: 'Prova', nome: 'Test', genere: 'M', nascita: '1990-01-01', cittadinanza: 'Italia', luogoNascita: 'Italia', tipoDocumento: 'PROVA', numeroDocumento: 'PROVA000', luogoRilascio: 'Italia' }] };
      try {
        const pdf = await (deps.generaPdfRiepilogo || generaPdfRiepilogo)({ dati: fantasia, metadata: { totale: '0' }, allegati: [], env, oggi: new Date(now()) });
        const valido = pdf && pdf.content && pdf.content.length > 500 && pdf.content.slice(0, 5).toString('latin1') === '%PDF-';
        return [200, valido ? { ok: true, esito: 'Browserless risponde: PDF di prova generato (' + Math.round(pdf.content.length / 1024) + ' KB). Nessuna email inviata.' }
          : { ok: false, esito: 'Browserless ha risposto ma il file ricevuto non è un PDF valido' }];
      } catch (e) {
        const m = /\((\d{3})\)/.exec(String(e && e.message || ''));
        const http = m ? +m[1] : null;
        return [200, { ok: false, esito: 'PDF NON generato', dettaglio: http ? 'Browserless HTTP ' + http : (e && (e.code || e.name) || 'errore'),
          suggerimento: http === 401 || http === 403 ? 'Il token non è valido: controlla il valore copiato dal tuo account Browserless' : http === 429 ? 'Limite di utilizzo del piano Browserless raggiunto' : 'Riprova tra qualche minuto; se persiste controlla lo stato del tuo account Browserless' }];
      }
    },
    async 'prova-tabelle'() {
      const tab = await tabelle();
      if (!tab.ok) return [200, { ok: false, esito: 'Tabelle ufficiali NON disponibili', motivo: tab.motivo }];
      return [200, { ok: true, esito: 'Tabelle ufficiali disponibili', righe: { Luoghi: tab.tables.luoghi.size, Tipi_Documento: tab.tables.documenti.size, Tipi_Alloggiato: tab.tables.tipi.size },
        italiaRiconosciuta: !!tab.tables.luoghi.italia }];
    },
    async elenco(b) {
      const righe = await store.elencoRegistri(b.limite);
      return [200, { registri: righe, nota: 'Stato "salvato_drive" = TXT pronto per il caricamento MANUALE: non indica un invio né una ricevuta.' }];
    },
    async 'scarica-txt'(b) {
      const x = await registroEDati(b.checkinId); if (x.err) return [x.err[0], { error: x.err[1] }];
      if (!x.dati) return [410, { error: 'Dati del check-in non più disponibili (già cancellati o scaduti)' }];
      const tab = await tabelle(); if (!tab.ok) return [503, { error: 'Tabelle ufficiali non disponibili', motivo: tab.motivo }];
      const g = generaTxt(x.dati, tab.tables, now());
      if (!g.ok) return [422, { error: 'Schedine non valide: usa l\'azione "bozza"', problemi: g.problemi.length }];
      return [200, { txt: g.txt, nomeFile: nomeFileTxt(x.reg.data_arrivo instanceof Date ? x.reg.data_arrivo.toISOString().slice(0, 10) : String(x.reg.data_arrivo || ''), x.reg.checkin_id), avvisi: g.avvisi, attenzione: 'File con dati personali: caricalo sul portale e poi eliminalo dal tuo dispositivo.' }, 'txt'];
    },
    async bozza(b) {
      const x = await registroEDati(b.checkinId); if (x.err) return [x.err[0], { error: x.err[1] }];
      if (!x.dati) return [410, { error: 'Dati del check-in non più disponibili (già cancellati o scaduti)' }];
      const tab = await tabelle(); if (!tab.ok) return [503, { error: 'Tabelle ufficiali non disponibili', motivo: tab.motivo }];
      const { records } = costruisciSchedine(x.dati, tab.tables);
      const g = generaTxt(x.dati, tab.tables, now());
      // i valori inseriti dall'ospite che non hanno trovato corrispondenza nelle tabelle, per completarli a mano
      const originali = (x.dati.ospiti || []).map(o => ({ ospite: o.numero, luogoNascita: o.luogoNascita, comune: o.comune, provincia: o.provincia, cittadinanza: o.cittadinanza, tipoDocumento: o.tipoDocumento, luogoRilascio: o.luogoRilascio }));
      return [200, { schedine: records.map(r => { const o = Object.assign({}, r); delete o._ospite; return o; }), valoriInseriti: originali, problemi: g.problemi, avvisi: g.avvisi,
        attenzione: 'Contiene dati personali: usali solo per completare la comunicazione e non salvarli altrove.' }];
    },
    async 'elimina-txt'(b) {
      if (b.conferma !== 'RICEVUTA_VERIFICATA') return [400, { error: 'Conferma mancante: invia conferma = "RICEVUTA_VERIFICATA" solo dopo aver verificato la ricevuta sul portale Alloggiati Web' }];
      if (!RE_CHECKIN.test(String(b.checkinId || ''))) return [400, { error: 'checkinId non valido' }];
      const reg = await store.leggiRegistro(b.checkinId);
      if (!reg) return [404, { error: 'Check-in non trovato' }];
      if (!reg.drive_file_id) return [409, { error: 'Nessun TXT su Drive per questo check-in' }];
      if (reg.drive_eliminato_at) return [200, { eliminato: true, gia: true }];
      try {
        const r = await drive.eliminaFile(reg.drive_file_id);
        await store.aggiornaRegistro(reg.checkin_id, { drive_eliminato_at: new Date(now()) });
        return [200, { eliminato: true, giaAssente: !!r.giaAssente,
          nota: 'TXT eliminato da Google Drive su tua conferma. Il sistema NON ha verificato la ricevuta Alloggiati. Ricorda di eliminare anche eventuali copie scaricate e le email con le immagini del documento.' }];
      } catch (e) {
        return [502, { error: 'Eliminazione da Drive non riuscita: il file NON è stato eliminato', dettaglio: descriviErroreDrive(e) }];
      }
    },
    async 'elimina-dati-temporanei'(b) {
      if (b.conferma !== 'ELIMINA') return [400, { error: 'Conferma mancante: invia conferma = "ELIMINA"' }];
      if (!RE_CHECKIN.test(String(b.checkinId || ''))) return [400, { error: 'checkinId non valido' }];
      const reg = await store.leggiRegistro(b.checkinId);
      if (!reg) return [404, { error: 'Check-in non trovato' }];
      if (reg.temp_session_id) await store.eliminaDatiTemporanei(reg.temp_session_id);
      await store.aggiornaRegistro(reg.checkin_id, { dati_temporanei_eliminati_at: new Date(now()) });
      return [200, { eliminati: true }];
    },
    async 'carica-tabella'(b) {
      if (typeof b.csv !== 'string' || b.csv.length > 3.5e6) return [400, { error: 'CSV mancante o troppo grande' }];
      const r = await salvaTabellaManuale(store, String(b.nome || ''), b.csv);
      return [r.ok ? 200 : 400, r];
    }
  };

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && !(req.query && req.query.azione) && !req.headers['x-admin-secret']) return gestisciPulizia(req, res, { store, env });
    if (!autorizzato(req, env)) return res.status(401).json({ error: 'Non autorizzato' });
    const body = req.method === 'POST' && req.body && typeof req.body === 'object' ? req.body : {};
    const azione = String(req.method === 'GET' ? (req.query && req.query.azione) || '' : body.azione || '');
    if (req.method === 'GET' && !['stato', 'elenco'].includes(azione)) return res.status(405).json({ error: 'Usa POST per questa azione' });
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Metodo non consentito' });
    const fn = azioni[azione];
    if (!fn) return res.status(400).json({ error: 'Azione non valida', azioni: Object.keys(azioni) });
    try {
      const [status, out, formato] = await fn(req.method === 'GET' ? (req.query || {}) : body);
      if (formato === 'txt' && status === 200 && body.formato === 'file') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="' + out.nomeFile + '"');
        return res.status(200).send(out.txt);
      }
      return res.status(status).json(out);
    } catch (e) {
      console.error('admin-alloggiati: ' + azione + ' errore ' + (e && (e.code || e.name) || 'interno'));
      return res.status(500).json({ error: 'Errore interno' });
    }
  };
}

export default makeHandler({ store: pgStore, env: process.env, fetch: (...a) => globalThis.fetch(...a), caricaTabelle });
