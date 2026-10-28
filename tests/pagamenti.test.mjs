// Test del collegamento tra pagamento e check-in: sessioni di altri sistemi ignorate, rete di sicurezza se il webhook non arriva,
// indirizzi di ritorno controllati, nessun dettaglio interno nelle risposte. Tutto simulato: nessuna chiamata a Stripe.
import './setup-env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler as makeWebhook } from '../api/stripeWebhook.js';
import { makeHandler as makeSessione } from '../api/get-session.js';
import { makeHandler as makePagamento, urlAmmesso } from '../api/crea-pagamento-stripe.js';
import { elaboraCheckin, checkinIdDa } from '../api/_elabora-checkin.js';
import { urlBrowserless } from '../api/_pdf-riepilogo.js';
import { requireApi, memStore, fintoRes, fintoReq, checkinFamiglia, catturaLog, NOW, ENV_DRIVE } from './helpers.mjs';

const Stripe = requireApi('stripe');
const stripeLocale = new Stripe('sk_test_finto_nessuna_chiamata');
const SEGRETO_WH = 'whsec_prova_locale';
const ENV = Object.assign({ EMAIL_PROPRIETARIO: 'gestore@esempio.invalid', EMAIL_USER: 'mittente@esempio.invalid', EMAIL_PASSWORD: 'x', SHEET_ID: 'FOGLIO_FINTO' }, ENV_DRIVE);
const TEMP = 'temp_1762000000000_abc123';
const sessioneCheckin = over => Object.assign({ id: 'cs_test_pag0001', status: 'complete', payment_status: 'paid', amount_total: 1350, customer_details: { email: 'ospite@esempio.invalid' },
  metadata: { dataCheckin: '2026-11-05', appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto', numeroOspiti: '3', numeroNotti: '3', tipoGruppo: 'famiglia', totale: '13.5', lingua: 'it', temp_session_id: TEMP } }, over || {});
// pagamento di una prenotazione del sito (La Columbera): stesso account Stripe, nessun metadato del check-in
const sessionePrenotazione = () => ({ id: 'cs_test_sito0001', status: 'complete', payment_status: 'paid', amount_total: 54000, customer_details: { email: 'altro@esempio.invalid' }, metadata: { code: 'ABC123' } });

function reqRaw(payload, headers) {
  const buf = Buffer.from(payload);
  return { method: 'POST', headers, async *[Symbol.asyncIterator]() { yield buf; } };
}
function scenario() {
  const store = memStore(), ospite = [], gestore = [], foglio = [];
  const deps = {
    store, env: ENV, now: () => NOW,
    generaPdfRiepilogo: async () => ({ filename: 'checkin.pdf', content: Buffer.from('%PDF-1.4 finto'), contentType: 'application/pdf' }),
    salvaSuSheet: async righe => { foglio.push(...JSON.parse(JSON.stringify(righe))); },
    inviaEmailOspite: async p => { ospite.push(JSON.parse(JSON.stringify(p))); return { success: true }; },
    inviaEmailGestore: async a => { gestore.push(a.riferimento); },
    log: () => {}
  };
  store.sessioni.set(TEMP, { data: checkinFamiglia(), expires: NOW + 2 * 3600e3 });
  const webhook = makeWebhook({ stripe: stripeLocale, endpointSecret: SEGRETO_WH, store, dipendenze: () => deps });
  const consegna = async (session, tipo) => {
    const evento = JSON.stringify({ id: 'evt_' + Math.random().toString(36).slice(2), object: 'event', type: tipo || 'checkout.session.completed', data: { object: session } });
    const r = fintoRes();
    await catturaLog(() => webhook(reqRaw(evento, { 'stripe-signature': stripeLocale.webhooks.generateTestHeaderString({ payload: evento, secret: SEGRETO_WH }) }), r));
    return r;
  };
  const fintoStripe = s => ({ checkout: { sessions: { retrieve: async id => { if (id !== s.id) throw Object.assign(new Error('No such checkout.session: ' + id), { code: 'resource_missing' }); return s; } } } });
  const fallback = async (s, deps2) => {
    const r = fintoRes();
    await catturaLog(() => makeSessione(fintoStripe(s), { elabora: x => elaboraCheckin(x, deps) , ...(deps2 || {}) })(fintoReq('GET', null, {}, { session_id: s.id, lang: 'it', elabora: '1' }), r));
    return r;
  };
  return { store, deps, ospite, gestore, foglio, consegna, fallback };
}
const conteggi = x => [x.foglio.length, x.ospite.length, x.gestore.length];

test('webhook: il pagamento di una prenotazione del sito (stesso account Stripe) non è un check-in e viene ignorato senza errori', async () => {
  const x = scenario();
  let r = await x.consegna(sessionePrenotazione());
  assert.equal(r.statusCode, 200); assert.equal(r.body.ignored, true);
  assert.deepEqual(conteggi(x), [0, 0, 0], 'nessuna email, nessuna riga sul foglio');
  assert.equal(x.store.registri.size, 0, 'nessun registro tecnico creato');
  assert.equal(x.store.sessioni.size, 1, 'i dati temporanei del check-in non sono toccati');
  // pagamento non ancora riuscito: si aspetta
  r = await x.consegna(sessioneCheckin({ payment_status: 'unpaid' }));
  assert.equal(r.statusCode, 200); assert.equal(r.body.ignored, true); assert.deepEqual(conteggi(x), [0, 0, 0]);
  // il check-in vero viene elaborato
  r = await x.consegna(sessioneCheckin());
  assert.equal(r.statusCode, 200); assert.equal(r.body.ignored, undefined); assert.deepEqual(conteggi(x), [3, 1, 1]);
});

test('webhook perso: la pagina di successo (get-session?elabora=1) elabora il check-in comunque, con la stessa elaborazione e senza duplicati', async () => {
  const x = scenario(), s = sessioneCheckin();
  // il webhook NON arriva; l'ospite torna sulla pagina di successo
  let r = await x.fallback(s);
  assert.equal(r.statusCode, 200); assert.equal(r.body.elaborazione, 'completato');
  assert.deepEqual(conteggi(x), [3, 1, 1], 'righe sul foglio, email all\'ospite e al gestore');
  assert.equal(x.store.sessioni.size, 0, 'dati temporanei eliminati dopo l\'elaborazione');
  // chiamata ripetuta dalla pagina e webhook che arriva dopo: nulla in più
  await x.fallback(s);
  r = await x.consegna(s); assert.equal(r.statusCode, 200);
  assert.deepEqual(conteggi(x), [3, 1, 1], 'nessun duplicato');
  assert.equal(x.store.registri.size, 1);
  assert.equal(x.store.registri.get(checkinIdDa(s.id)).email_ospite_stato, 'inviata');
});

test('webhook e pagina di successo insieme: chi arriva secondo trova il lavoro già fatto o in corso, mai doppioni', async () => {
  const x = scenario(), s = sessioneCheckin();
  let r = await x.consegna(s); assert.equal(r.statusCode, 200);
  assert.deepEqual(conteggi(x), [3, 1, 1]);
  r = await x.fallback(s); assert.equal(r.body.elaborazione, 'completato');
  assert.deepEqual(conteggi(x), [3, 1, 1]);
  // il webhook sta ancora lavorando (lease): la pagina non avvia un secondo giro
  const y = scenario(); const reg = await y.store.ottieniOCreaRegistro({ checkinId: checkinIdDa(s.id), stripeSessionId: s.id, tempSessionId: TEMP, dataArrivo: '2026-11-05' });
  assert.ok(reg); assert.equal(await y.store.acquisisciLease(checkinIdDa(s.id), 55e3), true);
  r = await y.fallback(s); assert.equal(r.statusCode, 200); assert.equal(r.body.elaborazione, 'in_corso'); assert.deepEqual(conteggi(y), [0, 0, 0]);
});

test('get-session ?elabora=1: solo sessioni pagate del check-in; un errore interno non arriva alla pagina', async () => {
  const x = scenario();
  let r = await x.fallback(sessionePrenotazione());
  assert.equal(r.statusCode, 400, 'una sessione del sito di prenotazione non è un check-in'); assert.deepEqual(conteggi(x), [0, 0, 0]);
  r = await x.fallback(sessioneCheckin({ payment_status: 'unpaid' }));
  assert.equal(r.statusCode, 400, 'non pagata'); assert.deepEqual(conteggi(x), [0, 0, 0]);
  const s = sessioneCheckin();
  r = fintoRes();
  const { righe } = await catturaLog(() => makeSessione({ checkout: { sessions: { retrieve: async () => s } } }, { elabora: async () => { throw Object.assign(new Error('password del database: segretissima'), { code: 'XX01' }); } })(fintoReq('GET', null, {}, { session_id: s.id, elabora: '1' }), r));
  assert.equal(r.statusCode, 200); assert.equal(r.body.elaborazione, 'errore');
  assert.ok(!JSON.stringify(r.body).includes('segretissima') && !righe.join('\n').includes('segretissima'), 'il dettaglio dell\'errore non esce né nella risposta né nei log');
});

test('get-session: un errore di Stripe non rivela il suo messaggio (può contenere parti della chiave)', async () => {
  const r = fintoRes();
  const stripeKo = { checkout: { sessions: { retrieve: async () => { throw Object.assign(new Error('Invalid API Key provided: sk_live_****abcd'), { type: 'StripeAuthenticationError' }); } } } };
  const { righe } = await catturaLog(() => makeSessione(stripeKo)(fintoReq('GET', null, {}, { session_id: 'cs_test_x' }), r));
  assert.equal(r.statusCode, 500);
  assert.ok(!JSON.stringify(r.body).includes('sk_live') && !righe.join('\n').includes('sk_live'), 'nessuna parte della chiave');
  const r2 = fintoRes();
  await catturaLog(() => makeSessione({ checkout: { sessions: { retrieve: async () => { throw Object.assign(new Error('No such checkout.session'), { code: 'resource_missing' }); } } } })(fintoReq('GET', null, {}, { session_id: 'cs_test_y' }), r2));
  assert.equal(r2.statusCode, 404);
});

test('pagamento: Stripe riporta l\'ospite solo a indirizzi del check-in; qualsiasi altro indirizzo è sostituito da quello predefinito', async () => {
  for (const [u, ok] of [
    ['https://spaceestate.github.io/Checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}&temp_session=temp_1_a&lang=it', true],
    ['https://spaceestate.github.io/Checkin/index.html?canceled=true', true],
    ['https://checkin-six-coral.vercel.app/index.html', true],
    ['https://evil.example/', false], ['https://spaceestate.github.io.evil.example/Checkin/', false], ['https://checkin-six-coral.vercel.app.evil.example/x', false],
    ['http://spaceestate.github.io/Checkin/', false], ['javascript:alert(1)', false], ['', false], [undefined, false], [{ a: 1 }, false]
  ]) assert.equal(urlAmmesso(u), ok, String(u));
  let creata = null;
  const fintoStripe = { checkout: { sessions: { create: async p => { creata = p; return { id: 'cs_test_x', url: 'https://checkout.stripe.invalid/x' }; } } } };
  const d = checkinFamiglia();
  const buono = 'https://spaceestate.github.io/Checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}&temp_session=temp_1_a&lang=de';
  let r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe)(fintoReq('POST', Object.assign({}, d, { successUrl: buono, cancelUrl: 'https://spaceestate.github.io/Checkin/?canceled=true' })), r));
  assert.equal(r.statusCode, 200); assert.equal(creata.success_url, buono); assert.equal(creata.cancel_url, 'https://spaceestate.github.io/Checkin/?canceled=true');
  r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe)(fintoReq('POST', Object.assign({}, d, { successUrl: 'https://evil.example/ruba', cancelUrl: 'https://evil.example/' })), r));
  assert.equal(r.statusCode, 200);
  assert.equal(creata.success_url, 'https://spaceestate.github.io/Checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(creata.cancel_url, 'https://spaceestate.github.io/Checkin/index.html?canceled=true');
});

test('Browserless: di serie San Francisco; Amsterdam e Londra con BROWSERLESS_URL; qualsiasi altro indirizzo è ignorato (i dati non vanno altrove)', () => {
  assert.equal(urlBrowserless({}), 'https://production-sfo.browserless.io');
  assert.equal(urlBrowserless({ BROWSERLESS_URL: 'https://production-ams.browserless.io' }), 'https://production-ams.browserless.io');
  assert.equal(urlBrowserless({ BROWSERLESS_URL: ' https://production-lon.browserless.io/ ' }), 'https://production-lon.browserless.io');
  for (const v of ['https://evil.example', 'http://production-ams.browserless.io', 'https://production-ams.browserless.io.evil.example', 'https://production-ams.browserless.io/x', 'ams'])
    assert.equal(urlBrowserless({ BROWSERLESS_URL: v }), 'https://production-sfo.browserless.io', v);
});
