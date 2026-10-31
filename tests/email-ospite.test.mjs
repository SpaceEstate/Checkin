// Email all'ospite dopo il check-in (api/invia-email-ospite.js): cosa deve restare com'è (autorizzazione, risposte, destinatario,
// allegati, codice della cassetta, lingua) e come appare. Nessuna email reale: il trasporto è finto. Dati e codici di fantasia.
import './setup-env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeHandler } from '../api/invia-email-ospite.js';
import { fintoRes, fintoReq, catturaLog } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = { INTERNAL_API_SECRET: 'interna-di-prova', EMAIL_USER: 'avvisi@esempio.invalid', CODICE_CASSETTA_TORRE: '4821', CODICE_CASSETTA_CORTE: '9375' };
const TORRE = 'La Columbera - Torre, Appartamento con 2 camere da letto', CORTE = 'La Columbera - Corte, Appartamento con 1 camera da letto';

// Esegue l'endpoint come in produzione (cartella del progetto come directory di lavoro, per le foto in public/) e restituisce l'email inviata.
async function inviaProva(body, { headers, env = ENV, method = 'POST' } = {}) {
  const prima = {}, cwd = process.cwd(), inviate = [];
  for (const k of Object.keys(ENV)) { prima[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  process.chdir(root);
  try {
    const h = makeHandler({ creaTrasporto: () => ({ sendMail: async m => { inviate.push(m); return { messageId: 'x' }; } }) });
    const r = fintoRes();
    await catturaLog(() => h(fintoReq(method, body, headers === undefined ? { 'x-internal-secret': ENV.INTERNAL_API_SECRET } : headers), r));
    return { r, mail: inviate[0], inviate };
  } finally {
    process.chdir(cwd);
    for (const k of Object.keys(ENV)) { if (prima[k] === undefined) delete process.env[k]; else process.env[k] = prima[k]; }
  }
}
const dati = (over) => Object.assign({ appartamento: TORRE, dataCheckin: '2026-11-05', numeroOspiti: 3, numeroNotti: 3, totale: 13.5, lingua: 'it', ospiti: [{ nome: 'Giulia', cognome: 'Prova' }] }, over || {});

test('email ospite: autorizzazione e risposte come prima (405, 401 senza chiave interna, 500 se manca, 400 senza dati)', async () => {
  assert.equal((await inviaProva({}, { method: 'GET' })).r.statusCode, 405);
  for (const headers of [{}, { 'x-internal-secret': 'sbagliata' }]) {
    const { r, inviate } = await inviaProva({ emailOspite: 'giulia@esempio.invalid', datiPrenotazione: dati() }, { headers });
    assert.equal(r.statusCode, 401); assert.equal(inviate.length, 0, 'nessuna email senza chiave interna');
  }
  const senza = await inviaProva({ emailOspite: 'giulia@esempio.invalid', datiPrenotazione: dati() }, { env: Object.assign({}, ENV, { INTERNAL_API_SECRET: undefined }) });
  assert.equal(senza.r.statusCode, 500); assert.equal(senza.inviate.length, 0);
  assert.equal((await inviaProva({ datiPrenotazione: dati() })).r.statusCode, 400);
  assert.equal((await inviaProva({ emailOspite: 'giulia@esempio.invalid' })).r.statusCode, 400);
});

test('email ospite: destinatario, mittente, logo e tre foto allegati e usati nel testo, codice della cassetta dell\'appartamento giusto', async () => {
  const { r, mail } = await inviaProva({ emailOspite: 'giulia@esempio.invalid', datiPrenotazione: dati() });
  assert.equal(r.statusCode, 200);
  assert.equal(mail.to, 'giulia@esempio.invalid');
  assert.equal(mail.from, '"La Columbera" <avvisi@esempio.invalid>');
  assert.deepEqual(mail.attachments.map(a => a.cid), ['logo_columbera', 'ingresso_proprieta', 'cassetta_sicurezza', 'ubicazione_cassetta']);
  for (const a of mail.attachments) assert.ok(mail.html.includes('cid:' + a.cid), 'immagine usata nel testo: ' + a.cid);
  assert.deepEqual([r.body.success, r.body.codiciCassetta, r.body.emailDestinatario, r.body.numeroAllegati, r.body.warning], [true, ['4821'], 'giulia@esempio.invalid', 4, null]);
  assert.ok(mail.html.includes('4821') && !mail.html.includes('9375'), 'solo il codice della Torre');
  assert.ok(/La Columbera/.test(mail.subject) && /Torre/.test(mail.subject));
  // Corte e tutti e due gli appartamenti
  const c = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ appartamento: CORTE }) });
  assert.deepEqual(c.r.body.codiciCassetta, ['9375']); assert.ok(c.mail.html.includes('9375') && !c.mail.html.includes('4821'));
  const e = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ appartamento: CORTE + ' + ' + TORRE }) });
  assert.deepEqual(e.r.body.codiciCassetta, ['9375', '4821']); assert.ok(e.mail.html.includes('9375') && e.mail.html.includes('4821'));
});

test('email ospite: lingua dell\'ospite (it, en, de; altro = italiano)', async () => {
  for (const [lingua, attesa] of [['it', 'it'], ['en', 'en'], ['de', 'de'], ['fr', 'it'], [undefined, 'it']]) {
    const { mail } = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ lingua }) });
    assert.match(mail.html, new RegExp('<html lang="' + attesa + '"'), String(lingua));
  }
});
