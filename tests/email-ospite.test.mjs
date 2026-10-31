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

// ---------------- aspetto e contenuto (dal 31/10/2026: stesso stile delle email del sito) ----------------
const MAPS = 'https://maps.app.goo.gl/mVBZWREejSuVEGqQ7?g_st=ic', PARK = 'https://maps.app.goo.gl/VWHWQCMWUzAvgSYM7?g_st=ic';

test('email ospite: stile del sito (tabelle e stili in linea, niente blocco <style>, sfumature, emoji), sotto il limite di Gmail', async () => {
  for (const lingua of ['it', 'en', 'de']) {
    const { mail } = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ lingua }) });
    const h = mail.html;
    assert.ok(!/<style|class=|linear-gradient|box-shadow|display:\s*flex/i.test(h), lingua + ': solo stili in linea');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(h), lingua + ': niente emoji');
    assert.ok(h.includes('role="presentation"') && h.includes('#5F222B') && h.includes('#B08D3C'), lingua + ': testata bordeaux e riga oro del sito');
    assert.ok(Buffer.byteLength(h) < 100 * 1024, lingua + ': Gmail taglia le email oltre 102 KB');
    assert.ok(!/Generat[ao] il|Generated on|Erstellt am/.test(h), lingua + ': niente data tecnica di generazione');
  }
});

test('email ospite: indirizzi come oggi (Via Centrale 48, parcheggio Via Val Gola 22) con i link di Google Maps del sito', async () => {
  const { mail } = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati() });
  for (const [via, link] of [['Via Centrale, 48', MAPS], ['Via Val Gola, 22', PARK]]) {
    const i = mail.html.indexOf(via); assert.ok(i > 0, via);
    assert.ok(mail.html.lastIndexOf('href="' + link + '"', i) > mail.html.lastIndexOf('</a>', i), via + ': il testo dell\'indirizzo è il link alla mappa');
    assert.ok(mail.text.includes(via) && mail.text.includes(link), via + ': anche nella versione di solo testo');
  }
  // gli stessi link del sito (pagina «Come trovarci» e area clienti), se il repository del sito è disponibile
  if (process.env.LACOLUMBERA_DIR) {
    const area = (await import('fs')).readFileSync(path.join(process.env.LACOLUMBERA_DIR, 'js', 'area.js'), 'utf8');
    assert.ok(area.includes("MAPS='" + MAPS + "'") && area.includes("MAPS_PARCHEGGIO='" + PARK + "'"), 'link uguali a quelli del sito');
  }
  assert.ok(mail.html.includes('Check-in: dalle 16:00 alle 00:00') && mail.html.includes('Check-out: entro le 10:00'), 'orari fissi');
});

test('email ospite: recapiti e niente risposte alla casella degli avvisi; area clienti e informativa del sito', async () => {
  const attese = { it: 'non rispondere a questo messaggio', en: 'please do not reply to this message', de: 'Bitte antworten Sie nicht auf diese Nachricht' };
  for (const [lingua, nonRispondere] of Object.entries(attese)) {
    const { mail } = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ lingua }) });
    for (const x of ['mailto:lacolumbera@gmail.com', 'tel:+393517043594', 'https://la-columbera.vercel.app/area-clienti.html', 'https://la-columbera.vercel.app/privacy.html']) assert.ok(mail.html.includes(x), lingua + ': ' + x);
    assert.ok(mail.html.includes(nonRispondere) && mail.text.includes(nonRispondere), lingua + ': avviso di non rispondere');
    assert.ok(!/rispondi pure|reply to this email|antworten Sie auf diese/i.test(mail.html), lingua + ': nessun invito a rispondere');
    assert.equal(mail.replyTo, undefined, lingua + ': nessun Reply-To');
  }
});

test('email ospite: saluto tradotto con il nome (testo dell\'ospite reso innocuo), oggetto senza ripetizioni, importo nel formato della lingua', async () => {
  const titoli = { it: 'Grazie, Giulia!', en: 'Thank you, Giulia!', de: 'Vielen Dank, Giulia!' };
  for (const [lingua, saluto] of Object.entries(titoli)) {
    const { mail } = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ lingua }) });
    assert.ok(mail.html.includes(saluto), lingua + ': ' + saluto);
    if (lingua !== 'it') assert.ok(!mail.html.includes('Gentile'), lingua + ': niente «Gentile» in italiano');
  }
  const x = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ ospiti: [{ nome: '<img src=x onerror=alert(1)>', cognome: '' }] }) });
  assert.ok(!x.mail.html.includes('<img src=x') && x.mail.html.includes('&lt;img src=x'), 'nome dell\'ospite trattato come testo');
  const senzaNome = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ ospiti: [] }) });
  assert.ok(senzaNome.mail.html.includes('Grazie!<br>'), 'senza nome: «Grazie!»');
  // oggetto: come le email del sito, senza «La Columbera - La Columbera»
  assert.equal((await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati() })).mail.subject, 'Check-in completato · La Columbera Torre · 05/11/2026');
  const due = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ appartamento: CORTE + ' + ' + TORRE, lingua: 'en' }) });
  assert.equal(due.mail.subject, 'Check-in completed · La Columbera Corte and Torre · 05/11/2026');
  assert.ok(!/La Columbera - La Columbera/.test(due.mail.subject));
  // importo: virgola in italiano e tedesco, punto in inglese
  for (const [lingua, euro] of [['it', '€ 13,50'], ['de', '€ 13,50'], ['en', '€ 13.50']]) {
    const { mail } = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ lingua, totale: '13.5' }) });
    assert.ok(mail.html.includes(euro) && mail.text.includes(euro), lingua + ': ' + euro);
  }
});

test('email ospite: codice mancante = «Codice non disponibile…» (mai «null»); versione di solo testo con il codice', async () => {
  const { mail } = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati() }, { env: Object.assign({}, ENV, { CODICE_CASSETTA_TORRE: undefined }) });
  assert.ok(mail.html.includes('Codice non disponibile, contatta il proprietario') && !/null/.test(mail.html) && !/null/.test(mail.text));
  assert.ok(mail.text.includes('Torre: Codice non disponibile') || mail.text.includes(': Codice non disponibile'), 'anche nel testo');
  // appartamento non riconosciuto: stesso messaggio (come prima), nessun codice
  const g = await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati({ appartamento: 'Altro' }) });
  assert.ok(g.mail.html.includes('Codice non disponibile, contatta il proprietario') && !g.mail.html.includes('4821') && !g.mail.html.includes('9375'));
  const t = (await inviaProva({ emailOspite: 'g@esempio.invalid', datiPrenotazione: dati() })).mail.text;
  for (const x of ['4821', 'Torre', 'Giovedì 5 novembre 2026', 'https://la-columbera.vercel.app/area-clienti.html', 'lacolumbera@gmail.com']) assert.ok(t.includes(x), 'testo: ' + x);
});
