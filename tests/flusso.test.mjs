// Test del flusso dopo il pagamento: TXT → Drive, email al gestore (solo immagini), email ospite, retry, cancellazioni.
// Tutto simulato: store in memoria, finta API Drive, finti invii email. Nessun servizio reale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { elaboraCheckin, checkinIdDa, TTL_DOPO_PAGAMENTO_MS } from '../api/_elabora-checkin.js';
import { makeDrive, configDrive } from '../api/_drive.js';
import { componiEmail, inviaImmaginiAlGestore, preparaAllegati } from '../api/_email-gestore.js';
import { memStore, fintaDriveApi, ENV_DRIVE, checkinFamiglia, caricaTabelleOk, caricaTabelleKo, NOW, catturaLog, contieneSensibili, fintoJpeg, fintoPdf, dataUri } from './helpers.mjs';

const ENV = Object.assign({ EMAIL_PROPRIETARIO: 'gestore@esempio.invalid', EMAIL_USER: 'mittente@esempio.invalid', EMAIL_PASSWORD: 'x' }, ENV_DRIVE);
const sessione = (over) => Object.assign({ id: 'cs_test_finta0001', payment_status: 'paid', customer_details: { email: 'ospite@esempio.invalid' },
  metadata: { dataCheckin: '2026-11-05', appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto', numeroOspiti: '3', numeroNotti: '3', tipoGruppo: 'famiglia', totale: '13.5', lingua: 'it', temp_session_id: 'temp_1762000000000_abc123' } }, over || {});

function scenario(o) {
  o = o || {};
  let clock = NOW;
  const store = memStore(() => clock);
  const api = fintaDriveApi(o.drive);
  const drive = makeDrive({ env: o.env || ENV, fetch: api.fetch, getToken: async () => 'token-finto' });
  const ospite = [], gestore = [], logs = [];
  const deps = {
    store, env: o.env || ENV, now: () => clock, drive,
    caricaTabelle: o.tabelleKo ? caricaTabelleKo : caricaTabelleOk,
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
  return { store, api, deps, ospite, gestore, logs, s, avanza: ms => { clock += ms; } };
}

test('percorso completo: TXT su Drive, email gestore con sole immagini, email ospite minima, dati temporanei cancellati', async () => {
  const x = scenario();
  const { v: r, righe } = await catturaLog(() => elaboraCheckin(x.s, x.deps));
  assert.equal(r.esito, 'completato');
  const reg = x.store.registri.get(checkinIdDa(x.s.id));
  assert.equal(reg.txt_stato, 'salvato_drive');
  assert.equal(x.api.files.size, 1);
  const f = [...x.api.files.values()][0];
  assert.equal(f.name, 'alloggiati_2026-11-05_' + reg.checkin_id + '.txt');
  assert.ok(f.contenuto.split('\r\n').filter(Boolean).every(l => l.length === 168));
  assert.match(f.description, /MANUALMENTE/); assert.match(f.description, /NON è stato inviato/);
  assert.deepEqual(Object.keys(f).filter(k => /permission/i.test(k)), [], 'nessuna condivisione creata');
  // email gestore: solo immagini, testo generico
  assert.equal(x.gestore.length, 1);
  const m = x.gestore[0];
  assert.deepEqual(m.attachments.map(a => [a.filename, a.contentType]), [['documento-fronte.jpg', 'image/jpeg'], ['documento-retro.jpg', 'image/jpeg']]);
  assert.ok(!m.attachments.some(a => a.contentType === 'application/pdf'), 'nessun PDF generato');
  assert.deepEqual(contieneSensibili(m.subject + m.text), []);
  assert.match(m.text, /elimina questa email/i); assert.match(m.text, /NON basta come identificazione/);
  // email ospite: niente documenti né date di nascita
  assert.equal(x.ospite.length, 1);
  assert.deepEqual(Object.keys(x.ospite[0].datiPrenotazione).sort(), ['appartamento', 'dataCheckin', 'lingua', 'numeroNotti', 'numeroOspiti', 'ospiti', 'totale']);
  assert.deepEqual(x.ospite[0].datiPrenotazione.ospiti, [{ nome: 'Ermenegilda', cognome: 'Provaccia' }]);
  // minimizzazione
  assert.equal(x.store.sessioni.size, 0, 'dati temporanei eliminati');
  assert.ok(reg.dati_temporanei_eliminati_at);
  assert.deepEqual(contieneSensibili(JSON.stringify(reg)), [], 'registro senza dati personali');
  assert.deepEqual(contieneSensibili(righe.join('\n') + x.logs.join('\n')), [], 'log senza dati personali');
  assert.ok(!/salvato_drive|inviat/.test(reg.txt_stato) || reg.txt_stato === 'salvato_drive');
});

test('errore di caricamento su Drive: nessun successo dichiarato, dati conservati, retry senza duplicati', async () => {
  const x = scenario({ drive: { falliscicaricamenti: 1 } });
  const r1 = await elaboraCheckin(x.s, x.deps);
  assert.equal(r1.esito, 'da_ripetere');
  const id = checkinIdDa(x.s.id);
  assert.equal(x.store.registri.get(id).txt_stato, 'errore_drive');
  assert.equal(x.api.files.size, 0);
  assert.equal(x.store.sessioni.size, 1, 'dati NON cancellati prima del successo');
  assert.equal(x.gestore.length, 1); assert.match(x.gestore[0].text, /non ancora salvato/);
  // scadenza allungata al massimo a creazione + 72 h
  assert.equal(x.store.sessioni.get(x.s.metadata.temp_session_id).expires, NOW + TTL_DOPO_PAGAMENTO_MS);
  x.avanza(60e3);
  const r2 = await elaboraCheckin(x.s, x.deps);
  assert.equal(r2.esito, 'completato');
  assert.equal(x.api.files.size, 1, 'un solo file');
  assert.equal(x.ospite.length, 1, 'email ospite non ripetuta');
  assert.equal(x.gestore.length, 1, 'email gestore non ripetuta');
  assert.equal(x.store.sessioni.size, 0);
  const r3 = await elaboraCheckin(x.s, x.deps);       // evento consegnato di nuovo da Stripe
  assert.equal(r3.esito, 'completato'); assert.equal(x.api.files.size, 1);
  assert.equal(x.api.log.filter(l => l.metodo === 'POST').length, 2, 'solo il tentativo fallito e quello riuscito');
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

test('Drive non configurato: TXT generato ma non salvato, nessun retry infinito, dati tenuti per lo scarico manuale', async () => {
  const env = { EMAIL_PROPRIETARIO: 'gestore@esempio.invalid', EMAIL_USER: 'm@esempio.invalid', EMAIL_PASSWORD: 'x' };
  const x = scenario({ env });
  const r = await elaboraCheckin(x.s, x.deps);
  assert.equal(r.esito, 'completato');
  const reg = x.store.registri.get(checkinIdDa(x.s.id));
  assert.equal(reg.txt_stato, 'drive_non_configurato');
  assert.equal(x.store.sessioni.size, 1, 'dati conservati (max 72 h) per scaricare il TXT');
  assert.match(x.gestore[0].text, /NON salvato su Drive/);
});

test('dati non validi: nessun TXT, stato "non_valido" con soli codici; tabelle non disponibili = retry', async () => {
  const x = scenario({ dati: { tipoGruppo: null } });
  const r = await elaboraCheckin(x.s, x.deps);
  assert.equal(r.esito, 'completato');
  const reg = x.store.registri.get(checkinIdDa(x.s.id));
  assert.equal(reg.txt_stato, 'non_valido'); assert.equal(x.api.files.size, 0);
  assert.ok(reg.txt_problemi.every(p => Object.keys(p).sort().join() === 'campo,code,ospite,sev'));
  const y = scenario({ tabelleKo: true });
  const r2 = await elaboraCheckin(y.s, y.deps);
  assert.equal(r2.esito, 'da_ripetere');
  assert.equal(y.store.registri.get(checkinIdDa(y.s.id)).txt_stato, 'tabelle_non_disponibili');
});

test('errori email: retry controllato, nessun duplicato', async () => {
  const x = scenario({ gestoreKo: 1, ospiteKo: 1 });
  const r1 = await elaboraCheckin(x.s, x.deps);
  assert.equal(r1.esito, 'da_ripetere');
  assert.equal(x.store.sessioni.size, 1, 'immagini non cancellate finché l\'email al gestore non parte');
  const r2 = await elaboraCheckin(x.s, x.deps);
  assert.equal(r2.esito, 'completato');
  assert.equal(x.ospite.length, 1); assert.equal(x.gestore.length, 1); assert.equal(x.api.files.size, 1);
  assert.equal(x.store.sessioni.size, 0);
});

test('elaborazione concorrente dello stesso evento: la seconda non procede', async () => {
  const x = scenario();
  const id = checkinIdDa(x.s.id);
  await x.store.ottieniOCreaRegistro({ checkinId: id, stripeSessionId: x.s.id });
  await x.store.acquisisciLease(id, 55e3);
  const r = await elaboraCheckin(x.s, x.deps);
  assert.equal(r.esito, 'in_corso'); assert.equal(x.ospite.length, 0); assert.equal(x.api.files.size, 0);
});

test('dati temporanei scaduti: TXT ed email gestore non rifatti e dichiarati non disponibili', async () => {
  const x = scenario();
  x.avanza(3 * 3600e3);       // oltre le 2 ore prima del pagamento
  const r = await elaboraCheckin(x.s, x.deps);
  const reg = x.store.registri.get(checkinIdDa(x.s.id));
  assert.equal(r.esito, 'completato');
  assert.equal(reg.txt_stato, 'dati_non_disponibili'); assert.equal(reg.email_gestore_stato, 'dati_non_disponibili');
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
