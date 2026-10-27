// Test degli endpoint: webhook Stripe (firma), metadati Stripe, salvataggio temporaneo, pre-verifica, admin, pulizia.
// Stripe è usato SOLO in locale (firma del webhook calcolata con un segreto di prova, sessioni finte): nessuna chiamata reale.
import './setup-env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeHandler as makeWebhook } from '../api/stripeWebhook.js';
import { makeHandler as makePagamento } from '../api/crea-pagamento-stripe.js';
import { makeHandler as makeSessione } from '../api/get-session.js';
import { makeHandler as makeSalva } from '../api/salva-dati-temporanei.js';
import { makeHandler as makeVerifica } from '../api/verifica-dati-alloggiati.js';
import { makeHandler as makeAdmin } from '../api/admin-alloggiati.js';
import { checkinIdDa } from '../api/_elabora-checkin.js';
import { makeDrive } from '../api/_drive.js';
import { requireApi, memStore, fintoRes, fintoReq, checkinFamiglia, caricaTabelleOk, caricaTabelleKo, catturaLog, contieneSensibili, fintoJpeg, fintoPdf, dataUri, NOW, fintaDriveApi, ENV_DRIVE } from './helpers.mjs';

const Stripe = requireApi('stripe');
const stripeLocale = new Stripe('sk_test_finto_nessuna_chiamata');
const SEGRETO_WH = 'whsec_prova_locale';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function reqRaw(payload, headers) {
  const buf = Buffer.from(payload);
  return { method: 'POST', headers, async *[Symbol.asyncIterator]() { yield buf; } };
}

test('webhook: firma non valida → 400 e nessuna elaborazione; firma valida → elaborazione; errore temporaneo → 500 (retry Stripe)', async () => {
  let chiamate = 0, esito = 'completato';
  const h = makeWebhook({ stripe: stripeLocale, endpointSecret: SEGRETO_WH, store: memStore(), dipendenze: () => ({}) });
  const evento = JSON.stringify({ id: 'evt_finto', object: 'event', type: 'checkout.session.completed', data: { object: { id: 'cs_test_finto', metadata: {} } } });
  // elaborazione sostituita: qui si verifica solo il contratto del webhook
  const modulo = await import('../api/_elabora-checkin.js');
  assert.ok(modulo.elaboraCheckin);
  const hFinto = makeWebhook({ stripe: stripeLocale, endpointSecret: SEGRETO_WH, store: memStore(), dipendenze: () => ({
    store: { ottieniOCreaRegistro: async () => { chiamate++; if (esito === 'boom') throw new Error('x'); return {}; }, acquisisciLease: async () => esito !== 'in_corso', rilasciaLease: async () => {}, aggiornaRegistro: async () => {}, leggiDatiTemporanei: async () => null },
    env: {}, caricaTabelle: caricaTabelleOk, drive: {}, inviaEmailOspite: async () => {}, inviaEmailGestore: async () => {}
  }) });
  let r = fintoRes();
  await (await catturaLog(() => h(reqRaw(evento, { 'stripe-signature': 't=1,v1=abc' }), r))).v;
  assert.equal(r.statusCode, 400);
  r = fintoRes();
  await catturaLog(() => hFinto(reqRaw(evento, {}), r));
  assert.equal(r.statusCode, 400, 'senza header di firma');
  const firma = stripeLocale.webhooks.generateTestHeaderString({ payload: evento, secret: SEGRETO_WH });
  r = fintoRes();
  await catturaLog(() => hFinto(reqRaw(evento, { 'stripe-signature': firma }), r));
  assert.equal(r.statusCode, 200); assert.equal(chiamate, 1);
  esito = 'in_corso'; r = fintoRes();
  await catturaLog(() => hFinto(reqRaw(evento, { 'stripe-signature': firma }), r));
  assert.equal(r.statusCode, 500, 'evento in elaborazione altrove: Stripe ritenterà');
  esito = 'boom'; r = fintoRes();
  await catturaLog(() => hFinto(reqRaw(evento, { 'stripe-signature': firma }), r));
  assert.equal(r.statusCode, 500);
  const altro = JSON.stringify({ id: 'evt_2', object: 'event', type: 'payment_intent.created', data: { object: {} } });
  r = fintoRes(); const prima = chiamate;
  await catturaLog(() => hFinto(reqRaw(altro, { 'stripe-signature': stripeLocale.webhooks.generateTestHeaderString({ payload: altro, secret: SEGRETO_WH }) }), r));
  assert.equal(r.statusCode, 200); assert.equal(chiamate, prima, 'altri eventi ignorati come prima');
});

test('Stripe: metadati senza dati personali, importo invariato (ricalcolato dal server)', async () => {
  let creata = null;
  const fintoStripe = { checkout: { sessions: { create: async p => { creata = p; return { id: 'cs_test_x', url: 'https://checkout.stripe.invalid/x' }; } } } };
  const h = makePagamento(fintoStripe);
  const d = checkinFamiglia();
  // anche se il browser mandasse tutto (vecchia versione del frontend), i dati personali non finiscono in Stripe
  const body = Object.assign({}, d, { totale: 0.01, tempSessionId: 'temp_1762000000000_abc123', ospiti: d.ospiti.map(o => Object.assign({}, o)) });
  const r = fintoRes();
  const { righe } = await catturaLog(() => h(fintoReq('POST', body), r));
  assert.equal(r.statusCode, 200);
  assert.deepEqual(Object.keys(creata.metadata).sort(), ['appartamento', 'dataCheckin', 'lingua', 'numeroNotti', 'numeroOspiti', 'temp_session_id', 'timestamp', 'tipoGruppo', 'totale']);
  assert.deepEqual(contieneSensibili(JSON.stringify(creata)), []);
  // tutti e 3 gli ospiti hanno almeno 4 anni: 3 × 3 notti × 1,50 € = 13,50 € (il totale 0,01 del client è ignorato)
  assert.equal(creata.line_items[0].price_data.unit_amount, 1350);
  assert.equal(creata.metadata.totale, '13.5');
  assert.deepEqual(contieneSensibili(righe.join('\n')), []);
});

test('get-session: nessun dato anagrafico nella risposta', async () => {
  const fintoStripe = { checkout: { sessions: { retrieve: async () => ({ id: 'cs_test_x', status: 'complete', payment_status: 'paid', amount_total: 1350,
    metadata: { dataCheckin: '2026-11-05', appartamento: 'La Columbera - Torre', numeroOspiti: '3', numeroNotti: '3', resp_nome: 'Ermenegilda', resp_cognome: 'Provaccia' } }) } } };
  const r = fintoRes();
  await catturaLog(() => makeSessione(fintoStripe)(fintoReq('GET', null, {}, { session_id: 'cs_test_x', lang: 'it' }), r));
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.responsabile, undefined); assert.equal(r.body.altriOspiti, undefined);
  assert.deepEqual(contieneSensibili(JSON.stringify(r.body)), []);
});

test('salvataggio temporaneo: solo campi necessari, immagini verificate, scadenza 2 h, niente sovrascritture, log puliti', async () => {
  const store = memStore();
  const h = makeSalva({ store, now: () => NOW });
  const d = checkinFamiglia();
  const inviato = Object.assign({}, d, { totale: 13.5, timestamp: 'x', campoExtra: 'da scartare',
    ospiti: d.ospiti.map(o => Object.assign({ eta: 40, email: 'qualcuno@esempio.invalid' }, o)),
    documenti: [{ ospiteNumero: 1, lato: 'fronte', nomeFile: 'documento_fronte', tipo: 'image/jpeg', base64: dataUri('image/jpeg', fintoJpeg()) }] });
  let r = fintoRes();
  const { righe } = await catturaLog(() => h(fintoReq('POST', { sessionId: 'temp_1762000000000_abc123', datiPrenotazione: inviato }), r));
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  const salvato = store.sessioni.get('temp_1762000000000_abc123');
  assert.equal(salvato.expires, NOW + 2 * 3600e3);
  assert.equal(salvato.data.campoExtra, undefined); assert.equal(salvato.data.totale, undefined);
  assert.equal(salvato.data.ospiti[0].email, undefined); assert.equal(salvato.data.ospiti[0].eta, undefined);
  assert.equal(salvato.data.documenti[0].nomeFile, undefined);
  assert.deepEqual(contieneSensibili(righe.join('\n') + JSON.stringify(r.body)), []);
  // stessa sessione: niente sovrascrittura
  r = fintoRes(); await catturaLog(() => h(fintoReq('POST', { sessionId: 'temp_1762000000000_abc123', datiPrenotazione: inviato }), r));
  assert.equal(r.statusCode, 409);
  const casi = [
    [{ sessionId: '../../x', datiPrenotazione: inviato }, 400],
    [{ sessionId: 'temp_1762000000001_a', datiPrenotazione: Object.assign({}, inviato, { documenti: [{ lato: 'fronte', base64: Buffer.from('GIF89a' + 'x'.repeat(300)).toString('base64') }] }) }, 400],
    [{ sessionId: 'temp_1762000000002_a', datiPrenotazione: Object.assign({}, inviato, { documenti: [{ lato: 'fronte', base64: fintoJpeg().toString('base64') }, { lato: 'retro', base64: fintoJpeg().toString('base64') }, { lato: 'retro', base64: fintoJpeg().toString('base64') }] }) }, 400],
    [{ sessionId: 'temp_1762000000003_a', datiPrenotazione: Object.assign({}, inviato, { documenti: [{ lato: 'fronte', base64: fintoJpeg(1100 * 1024).toString('base64') }] }) }, 400],
    [{ sessionId: 'temp_1762000000004_a', datiPrenotazione: Object.assign({}, inviato, { documenti: [{ lato: 'retro', base64: fintoPdf().toString('base64') }] }) }, 200]
  ];
  for (const [body, atteso] of casi) { r = fintoRes(); await catturaLog(() => h(fintoReq('POST', body), r)); assert.equal(r.statusCode, atteso, JSON.stringify(r.body)); }
  r = fintoRes(); await catturaLog(() => h(fintoReq('GET', null, {}, { sessionId: 'temp_1762000000000_abc123' }), r));
  assert.equal(r.statusCode, 405, 'il GET che restituiva i dati completi non esiste più');
});

test('pre-verifica Alloggiati: problemi correggibili restituiti, servizio non disponibile = non blocca', async () => {
  const d = checkinFamiglia(); d.ospiti[2].comune = 'Reggio Emilia';
  let r = fintoRes();
  const { righe } = await catturaLog(() => makeVerifica({ store: memStore(), env: {}, caricaTabelle: caricaTabelleOk, now: () => NOW })(fintoReq('POST', d), r));
  assert.equal(r.body.disponibile, true); assert.equal(r.body.ok, false);
  assert.equal(r.body.problemi[0].campo, 'comune'); assert.equal(r.body.problemi[0].ospite, 3);
  assert.deepEqual(contieneSensibili(righe.join('\n')), []);
  r = fintoRes();
  await catturaLog(() => makeVerifica({ store: memStore(), env: {}, caricaTabelle: caricaTabelleKo, now: () => NOW })(fintoReq('POST', checkinFamiglia()), r));
  assert.deepEqual(r.body, { disponibile: false });
});

test('admin: autenticazione, eliminazione TXT solo con conferma esplicita, scarico TXT quando Drive non è disponibile', async () => {
  const store = memStore(), api = fintaDriveApi();
  const drive = makeDrive({ env: ENV_DRIVE, fetch: api.fetch, getToken: async () => 't' });
  const env = Object.assign({ ADMIN_SECRET: 'segreto-admin-di-prova' }, ENV_DRIVE);
  const h = makeAdmin({ store, env, drive, caricaTabelle: caricaTabelleOk, now: () => NOW });
  const id = checkinIdDa('cs_test_admin');
  await store.ottieniOCreaRegistro({ checkinId: id, stripeSessionId: 'cs_test_admin', tempSessionId: 'temp_1762000000000_zz', dataArrivo: '2026-11-05' });
  await store.salvaDatiTemporanei('temp_1762000000000_zz', checkinFamiglia(), new Date(NOW + 3600e3));
  const up = await drive.caricaTxt({ nomeFile: 'a.txt', contenuto: 'X', checkinId: id });
  await store.aggiornaRegistro(id, { drive_file_id: up.fileId, txt_stato: 'salvato_drive' });
  const H = { 'x-admin-secret': 'segreto-admin-di-prova' };
  let r = fintoRes(); await h(fintoReq('POST', { azione: 'elenco' }, { 'x-admin-secret': 'sbagliato' }), r); assert.equal(r.statusCode, 401);
  r = fintoRes(); await h(fintoReq('GET', null, {}, { azione: 'elenco', key: 'segreto-admin-di-prova' }), r); assert.equal(r.statusCode, 401, 'segreto in URL non accettato');
  r = fintoRes(); await h(fintoReq('GET', null, H, { azione: 'elenco' }), r);
  assert.equal(r.statusCode, 200); assert.deepEqual(contieneSensibili(JSON.stringify(r.body)), []);
  r = fintoRes(); await h(fintoReq('POST', { azione: 'scarica-txt', checkinId: id }, H), r);
  assert.equal(r.statusCode, 200); assert.ok(r.body.txt.split('\r\n')[0].length === 168);
  r = fintoRes(); await h(fintoReq('POST', { azione: 'elimina-txt', checkinId: id }, H), r);
  assert.equal(r.statusCode, 400, 'senza conferma non si elimina'); assert.equal(api.files.size, 1);
  r = fintoRes(); await h(fintoReq('POST', { azione: 'elimina-txt', checkinId: id, conferma: 'RICEVUTA_VERIFICATA' }, H), r);
  assert.equal(r.statusCode, 200); assert.equal(api.files.size, 0);
  assert.match(r.body.nota, /NON ha verificato la ricevuta/);
  assert.ok(store.registri.get(id).drive_eliminato_at);
  r = fintoRes(); await h(fintoReq('POST', { azione: 'elimina-dati-temporanei', checkinId: id, conferma: 'ELIMINA' }, H), r);
  assert.equal(r.statusCode, 200); assert.equal(store.sessioni.size, 0);
  r = fintoRes(); await h(fintoReq('POST', { azione: 'scarica-txt', checkinId: id }, H), r);
  assert.equal(r.statusCode, 410);
});

test('admin: prove di configurazione di Drive e tabelle senza dati personali', async () => {
  const H = { 'x-admin-secret': 'segreto-admin-di-prova' };
  const env = Object.assign({ ADMIN_SECRET: 'segreto-admin-di-prova' }, ENV_DRIVE);
  const api = fintaDriveApi();
  let h = makeAdmin({ store: memStore(), env, drive: makeDrive({ env: ENV_DRIVE, fetch: api.fetch, getToken: async () => 't' }), caricaTabelle: caricaTabelleOk, now: () => NOW });
  let r = fintoRes(); await h(fintoReq('POST', { azione: 'prova-drive' }, H), r);
  assert.equal(r.body.ok, true); assert.equal(api.files.size, 0, 'file di prova eliminato');
  assert.equal(api.log.filter(l => l.metodo === 'POST').length, 1);
  const api2 = fintaDriveApi({ quota: true });
  h = makeAdmin({ store: memStore(), env, drive: makeDrive({ env: ENV_DRIVE, fetch: api2.fetch, getToken: async () => 't' }), caricaTabelle: caricaTabelleKo, now: () => NOW });
  r = fintoRes(); await h(fintoReq('POST', { azione: 'prova-drive' }, H), r);
  assert.equal(r.body.ok, false); assert.match(r.body.suggerimento, /Drive condiviso/);
  r = fintoRes(); await h(fintoReq('POST', { azione: 'prova-tabelle' }, H), r);
  assert.equal(r.body.ok, false);
  h = makeAdmin({ store: memStore(), env: { ADMIN_SECRET: 'segreto-admin-di-prova' }, drive: {}, caricaTabelle: caricaTabelleOk, now: () => NOW });
  r = fintoRes(); await h(fintoReq('POST', { azione: 'prova-drive' }, H), r);
  assert.equal(r.body.ok, false); assert.equal(r.body.esito, 'Drive non configurato');
  r = fintoRes(); await h(fintoReq('POST', { azione: 'prova-tabelle' }, H), r);
  assert.equal(r.body.ok, true); assert.equal(r.body.italiaRiconosciuta, true);
});

test('pulizia programmata: CRON_SECRET rispettata, scaduti eliminati, registri con TXT ancora su Drive conservati', async () => {
  let t = NOW;
  const store = memStore(() => t);
  await store.salvaDatiTemporanei('temp_1_a', { x: 1 }, new Date(NOW + 1000));
  await store.salvaDatiTemporanei('temp_2_a', { x: 1 }, new Date(NOW + 3600e3 * 10));
  await store.ottieniOCreaRegistro({ checkinId: 'ckaaaaaaaaaaaaaaaa', stripeSessionId: 'cs_a' });
  await store.ottieniOCreaRegistro({ checkinId: 'ckbbbbbbbbbbbbbbbb', stripeSessionId: 'cs_b' });
  await store.aggiornaRegistro('ckbbbbbbbbbbbbbbbb', { drive_file_id: 'FILEID00000001' });
  const h = makeAdmin({ store, env: { CRON_SECRET: 'cron-prova', ADMIN_SECRET: 'segreto-admin-di-prova' }, drive: {}, caricaTabelle: caricaTabelleOk });
  let r = fintoRes(); await catturaLog(() => h(fintoReq('GET', null, {}), r)); assert.equal(r.statusCode, 401);
  t = NOW + 31 * 864e5;
  r = fintoRes(); await catturaLog(() => h(fintoReq('GET', null, { authorization: 'Bearer cron-prova' }), r));
  assert.equal(r.statusCode, 200);
  assert.equal(store.sessioni.size, 0);
  assert.deepEqual([...store.registri.keys()], ['ckbbbbbbbbbbbbbbbb'], 'il registro di un TXT non ancora eliminato da Drive resta come promemoria');
});

test('Vercel Hobby: al massimo 12 funzioni nella cartella api/ (file senza "_")', () => {
  const funzioni = fs.readdirSync(path.join(root, 'api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
  assert.ok(funzioni.length <= 12, funzioni.length + ' funzioni: ' + funzioni.join(', '));
  const cron = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).crons.map(c => c.path.replace(/^\/api\//, '') + '.js');
  assert.ok(cron.every(c => funzioni.includes(c)), 'il cron punta a una funzione esistente');
});

test('vecchio endpoint PDF rimosso; Browserless solo nel modulo interno del PDF; foglio Google solo da _sheet-checkin.js', () => {
  assert.equal(fs.existsSync(path.join(root, 'api', 'genera-pdf-email.js')), false);
  const api = fs.readdirSync(path.join(root, 'api')).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(root, 'api', f), 'utf8')]);
  for (const [f, s] of api) {
    if (f !== '_pdf-riepilogo.js') assert.ok(!/browserless\.io|genera-pdf-email['"`]/.test(s.replace(/^\s*\/\/.*$/gm, '')), f + ': riferimento a Browserless o al vecchio endpoint');
    if (!['verifica-prenotazione.js', '_sheet-checkin.js'].includes(f)) assert.ok(!/google-spreadsheet|addRows?\(/.test(s), f + ': scrittura su Google Sheets');
  }
  const wh = fs.readFileSync(path.join(root, 'api', 'stripeWebhook.js'), 'utf8');
  assert.ok(!/saveToGoogleSheets/.test(wh));
});

test('il TXT non viene mai presentato come inviato o accettato', () => {
  const testi = ['_elabora-checkin.js', '_email-gestore.js', '_drive.js', 'admin-alloggiati.js', 'retry-email-from-stripe.js'].map(f => fs.readFileSync(path.join(root, 'api', f), 'utf8')).join('\n');
  assert.ok(!/txt_stato:\s*'(inviato|accettato|ricevuta)/.test(testi));
  assert.ok(!/['"](inviato|accettato)['"]/.test(testi));
});
