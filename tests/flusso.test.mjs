// Test del flusso dopo il pagamento: dati al foglio Google (come prima), email al gestore (solo immagini), email ospite,
// retry, cancellazioni. Tutto simulato: store in memoria, finto foglio, finta API Drive, finti invii email. Nessun servizio reale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { elaboraCheckin, checkinIdDa, TTL_DOPO_PAGAMENTO_MS } from '../api/_elabora-checkin.js';
import { makeDrive, configDrive } from '../api/_drive.js';
import { componiEmail, inviaImmaginiAlGestore, preparaAllegati } from '../api/_email-gestore.js';
import { righeSheet } from '../api/_sheet-checkin.js';
import { generaHTMLRiepilogo } from '../api/_pdf-riepilogo.js';
import { memStore, fintaDriveApi, ENV_DRIVE, checkinFamiglia, caricaTabelleOk, caricaTabelleKo, NOW, catturaLog, contieneSensibili, fintoJpeg, fintoPdf, dataUri } from './helpers.mjs';

const ENV = Object.assign({ EMAIL_PROPRIETARIO: 'gestore@esempio.invalid', EMAIL_USER: 'mittente@esempio.invalid', EMAIL_PASSWORD: 'x', SHEET_ID: 'FOGLIO_FINTO' }, ENV_DRIVE);
const sessione = (over) => Object.assign({ id: 'cs_test_finta0001', payment_status: 'paid', customer_details: { email: 'ospite@esempio.invalid' },
  metadata: { dataCheckin: '2026-11-05', appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto', numeroOspiti: '3', numeroNotti: '3', tipoGruppo: 'famiglia', totale: '13.5', lingua: 'it', temp_session_id: 'temp_1762000000000_abc123' } }, over || {});

function scenario(o) {
  o = o || {};
  let clock = NOW;
  const store = memStore(() => clock);
  const api = fintaDriveApi(o.drive);
  const drive = makeDrive({ env: o.env || ENV, fetch: api.fetch, getToken: async () => 'token-finto' });
  const ospite = [], gestore = [], logs = [], foglio = [], pdfRichiesti = [];
  const deps = {
    store, env: o.env || ENV, now: () => clock,
    generaPdfRiepilogo: async a => { if (o.pdfKo) throw Object.assign(new Error('x'), { code: 'PDF_NON_CONFIGURATO' }); pdfRichiesti.push(a); return { filename: 'checkin-' + a.dati.dataCheckin + '.pdf', content: Buffer.from('%PDF-1.4 finto'), contentType: 'application/pdf' }; },
    salvaSuSheet: async righe => { if (o.foglioKo && o.foglioKo-- > 0) throw Object.assign(new Error('x'), { code: 'ECONNRESET' }); foglio.push(...JSON.parse(JSON.stringify(righe))); },
    inviaEmailOspite: async p => { if (o.ospiteKo && o.ospiteKo-- > 0) throw Object.assign(new Error('x'), { code: 'ETIMEDOUT' }); ospite.push(JSON.parse(JSON.stringify(p))); return { success: true }; },
    inviaEmailGestore: async a => {
      if (o.gestoreKo && o.gestoreKo-- > 0) throw Object.assign(new Error('smtp'), { code: 'EAUTH', responseCode: 535 });
      const sent = [];
      await inviaImmaginiAlGestore(Object.assign({}, a, { transporter: { sendMail: async m => sent.push(m) } }));
      gestore.push(sent[0]);
    },
    log: m => logs.push(m)
  };
  const s = sessione();
  store.sessioni.set(s.metadata.temp_session_id, { data: checkinFamiglia(o.dati), expires: NOW + 2 * 3600e3 });
  return { store, api, deps, ospite, gestore, logs, foglio, pdfRichiesti, s, avanza: ms => { clock += ms; } };
}

test('percorso completo: righe nel foglio come prima, email gestore con sole immagini, email ospite minima, dati cancellati', async () => {
  const x = scenario();
  const { v: r, righe } = await catturaLog(() => elaboraCheckin(x.s, x.deps));
  assert.equal(r.esito, 'completato');
  const reg = x.store.registri.get(checkinIdDa(x.s.id));
  assert.equal(reg.sheet_stato, 'salvato');
  // stesse colonne e stessi valori della versione precedente
  assert.equal(x.foglio.length, 3);
  assert.deepEqual(Object.keys(x.foglio[0]), ['Data Check-in', 'Appartamento', 'Numero Ospiti', 'Numero Notti', 'Tipo Gruppo', 'Totale', 'Numero Ospite', 'Cognome', 'Nome', 'Genere', 'Data Nascita', 'Età', 'Cittadinanza', 'Luogo Nascita', 'Comune', 'Provincia', 'Timestamp', 'Tipo Documento', 'Numero Documento', 'Luogo Rilascio']);
  assert.deepEqual([x.foglio[0]['Cognome'], x.foglio[0]['Numero Documento'], x.foglio[0]['Totale'], x.foglio[0]['Età'], x.foglio[0]['Comune']], ['Provaccia', 'ZZ9900011', '13.5', '46', 'Roma']);
  assert.deepEqual([x.foglio[1]['Numero Ospite'], x.foglio[1]['Numero Documento'], x.foglio[1]['Comune']], ['2', '', '']);
  assert.equal(x.api.files.size, 0, 'nessun file su Drive');
  // email gestore: solo immagini, testo generico
  assert.equal(x.gestore.length, 1);
  const m = x.gestore[0];
  assert.deepEqual(m.attachments.map(a => [a.filename, a.contentType]), [['checkin-2026-11-05.pdf', 'application/pdf'], ['documento-fronte.jpg', 'image/jpeg'], ['documento-retro.jpg', 'image/jpeg']]);
  assert.deepEqual(contieneSensibili(m.subject + m.text), [], 'dati solo negli allegati, mai in oggetto o corpo');
  assert.match(m.text, /inviati al foglio/); assert.match(m.text, /riepilogo PDF dei dati inseriti/);
  assert.equal(x.pdfRichiesti.length, 1); assert.equal(x.pdfRichiesti[0].metadata.totale, '13.5');
  // email ospite: niente documenti né date di nascita
  assert.equal(x.ospite.length, 1);
  assert.deepEqual(Object.keys(x.ospite[0].datiPrenotazione).sort(), ['appartamento', 'dataCheckin', 'lingua', 'numeroNotti', 'numeroOspiti', 'ospiti', 'totale']);
  // minimizzazione
  assert.equal(x.store.sessioni.size, 0, 'dati temporanei eliminati');
  assert.deepEqual(contieneSensibili(JSON.stringify(reg)), [], 'registro senza dati personali');
  assert.deepEqual(contieneSensibili(righe.join('\n') + x.logs.join('\n')), [], 'log senza dati personali');
});

test('errore del foglio: retry senza righe duplicate, dati conservati fino al successo', async () => {
  const x = scenario({ foglioKo: 1 });
  const r1 = await elaboraCheckin(x.s, x.deps);
  assert.equal(r1.esito, 'da_ripetere');
  assert.equal(x.foglio.length, 0);
  assert.equal(x.store.sessioni.size, 1, 'dati NON cancellati prima del successo');
  assert.equal(x.store.sessioni.get(x.s.metadata.temp_session_id).expires, NOW + TTL_DOPO_PAGAMENTO_MS);
  assert.match(x.gestore[0].text, /NON ancora inviati/);
  x.avanza(60e3);
  assert.equal((await elaboraCheckin(x.s, x.deps)).esito, 'completato');
  assert.equal(x.foglio.length, 3, 'righe scritte una sola volta');
  assert.equal(x.ospite.length, 1); assert.equal(x.gestore.length, 1);
  assert.equal(x.store.sessioni.size, 0);
  assert.equal((await elaboraCheckin(x.s, x.deps)).esito, 'completato', 'evento consegnato di nuovo da Stripe');
  assert.equal(x.foglio.length, 3);
});

test('PDF non generabile: l\'email parte con le sole immagini e lo dice, senza retry', async () => {
  const x = scenario({ pdfKo: true });
  const { v: r } = await catturaLog(() => elaboraCheckin(x.s, x.deps));
  assert.equal(r.esito, 'completato');
  assert.deepEqual(x.gestore[0].attachments.map(a => a.filename), ['documento-fronte.jpg', 'documento-retro.jpg']);
  assert.match(x.gestore[0].text, /PDF NON è stato generato/);
});

test('modello del PDF: tutti gli ospiti, valori inseriti resi come testo (nessun HTML eseguibile)', () => {
  const d = checkinFamiglia(); d.ospiti[1].cognome = '<script>alert(1)</script>';
  const html = generaHTMLRiepilogo(Object.assign({}, d, { totale: 13.5, ospiti: d.ospiti.map(o => Object.assign({ eta: 30, isResponsabile: o.numero === 1 }, o)), documenti: [] }));
  assert.ok(!html.includes('<script>alert(1)</script>')); assert.ok(html.includes('&lt;script&gt;'));
  for (const n of ['Ermenegilda', 'Teodorico', 'Clotilde', 'ZZ9900011']) assert.ok(html.includes(n), n);
});

test('righe del foglio: ospite singolo e campi mancanti come nella versione precedente', () => {
  const d = checkinFamiglia({ numeroOspiti: 1, tipoGruppo: null }); d.ospiti = d.ospiti.slice(0, 1);
  const r = righeSheet(d, { totale: '4.5', timestamp: '2026-11-02T08:00:00.000Z' }, new Date(NOW));
  assert.equal(r.length, 1); assert.equal(r[0]['Tipo Gruppo'], ''); assert.equal(r[0]['Timestamp'], '2026-11-02T08:00:00.000Z');
  assert.equal(righeSheet(Object.assign({}, d, { ospiti: [{ numero: 1, nascita: '2025-01-01' }] }), {}, new Date(NOW))[0]['Età'], '1');
});

test('Drive: file già presente con lo stesso contenuto viene riutilizzato; contenuto diverso o MD5 errato = errore', async () => {
  const api = fintaDriveApi();
  const d = makeDrive({ env: ENV, fetch: api.fetch, getToken: async () => 't' });
  const a = await d.caricaTxt({ nomeFile: 'a.txt', contenuto: 'RIGA\r\n', checkinId: 'ck0000000000000001' });
  const b = await d.caricaTxt({ nomeFile: 'a.txt', contenuto: 'RIGA\r\n', checkinId: 'ck0000000000000001' });
  assert.equal(a.fileId, b.fileId); assert.equal(b.riutilizzato, true); assert.equal(api.files.size, 1);
  await assert.rejects(d.caricaTxt({ nomeFile: 'a.txt', contenuto: 'ALTRO\r\n', checkinId: 'ck0000000000000001' }), e => e.kind === 'contenuto_diverso_gia_presente');
  const api2 = fintaDriveApi({ md5Sbagliato: true });
  await assert.rejects(makeDrive({ env: ENV, fetch: api2.fetch, getToken: async () => 't' }).caricaTxt({ nomeFile: 'b.txt', contenuto: 'X', checkinId: 'ck0000000000000002' }), e => e.kind === 'verifica_contenuto_fallita');
  const api3 = fintaDriveApi({ quota: true });
  await assert.rejects(makeDrive({ env: ENV, fetch: api3.fetch, getToken: async () => 't' }).caricaTxt({ nomeFile: 'c.txt', contenuto: 'X', checkinId: 'ck0000000000000003' }), e => e.kind === 'caricamento_http' && e.motivo === 'storageQuotaExceeded');
  assert.deepEqual(configDrive({}).missing, ['GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY']);
  assert.equal(configDrive(Object.assign({}, ENV, { GOOGLE_DRIVE_ALLOGGIATI_FOLDER_ID: "x' or '1'='1" })).ok, false, 'ID cartella non valido rifiutato');
});

test('foglio non configurato: nessun retry infinito, dati tenuti al massimo 72 ore', async () => {
  const env = { EMAIL_PROPRIETARIO: 'gestore@esempio.invalid', EMAIL_USER: 'm@esempio.invalid', EMAIL_PASSWORD: 'x' };
  const x = scenario({ env });
  const r = await elaboraCheckin(x.s, x.deps);
  assert.equal(r.esito, 'completato');
  assert.equal(x.store.registri.get(checkinIdDa(x.s.id)).sheet_stato, 'non_configurato');
  assert.equal(x.store.sessioni.size, 1);
  assert.match(x.gestore[0].text, /configurazione mancante/);
});

test('errori email: retry controllato, nessun duplicato', async () => {
  const x = scenario({ gestoreKo: 1, ospiteKo: 1 });
  const r1 = await elaboraCheckin(x.s, x.deps);
  assert.equal(r1.esito, 'da_ripetere');
  assert.equal(x.store.sessioni.size, 1, 'immagini non cancellate finché l\'email al gestore non parte');
  const r2 = await elaboraCheckin(x.s, x.deps);
  assert.equal(r2.esito, 'completato');
  assert.equal(x.ospite.length, 1); assert.equal(x.gestore.length, 1); assert.equal(x.foglio.length, 3);
  assert.equal(x.store.sessioni.size, 0);
});

test('elaborazione concorrente dello stesso evento: la seconda non procede', async () => {
  const x = scenario();
  const id = checkinIdDa(x.s.id);
  await x.store.ottieniOCreaRegistro({ checkinId: id, stripeSessionId: x.s.id });
  await x.store.acquisisciLease(id, 55e3);
  const r = await elaboraCheckin(x.s, x.deps);
  assert.equal(r.esito, 'in_corso'); assert.equal(x.ospite.length, 0); assert.equal(x.foglio.length, 0);
});

test('dati temporanei scaduti: foglio ed email gestore non rifatti e dichiarati non disponibili', async () => {
  const x = scenario();
  x.avanza(3 * 3600e3);       // oltre le 2 ore prima del pagamento
  const r = await elaboraCheckin(x.s, x.deps);
  const reg = x.store.registri.get(checkinIdDa(x.s.id));
  assert.equal(r.esito, 'completato');
  assert.equal(reg.sheet_stato, 'dati_non_disponibili'); assert.equal(reg.email_gestore_stato, 'dati_non_disponibili');
  assert.equal(x.ospite.length, 1, 'email ospite comunque inviata (codici cassetta)');
  assert.deepEqual(x.ospite[0].datiPrenotazione.ospiti, []);
});

test('email gestore: allegati solo immagini valide, nomi generici, firma dei byte verificata', () => {
  const { allegati, scartati } = preparaAllegati([
    { lato: 'fronte', base64: dataUri('image/png', fintoJpeg()) },              // dichiarato png, in realtà jpeg: vale la firma
    { lato: 'retro', base64: dataUri('application/pdf', fintoPdf()) },
    { lato: 'fronte', base64: Buffer.from('<script>alert(1)</script>'.repeat(10)).toString('base64') },
    { lato: 'altro', base64: fintoJpeg().toString('base64') }
  ]);
  assert.deepEqual(allegati.map(a => [a.filename, a.contentType]), [['documento-fronte.jpg', 'image/jpeg'], ['documento-retro.pdf', 'application/pdf']]);
  assert.equal(scartati.length, 2);
  const { oggetto, testo } = componiEmail({ riferimento: 'ck01234567', statoTxt: 'x', numeroAllegati: 2 });
  assert.ok(!/Provaccia|ZZ99|nato|nascita/i.test(oggetto + testo));
});
