// Test del collegamento tra pagamento e check-in: sessioni di altri sistemi ignorate, rete di sicurezza se il webhook non arriva,
// indirizzi di ritorno controllati, nessun dettaglio interno nelle risposte. Tutto simulato: nessuna chiamata a Stripe.
import './setup-env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler as makeWebhook } from '../api/stripeWebhook.js';
import { makeHandler as makeSessione } from '../api/get-session.js';
import { makeHandler as makePagamento, urlAmmesso, numeroPrenotazioneValido, chiavePubblicabile } from '../api/crea-pagamento-stripe.js';
import { cercaPrenotazione, trovaPerDataEAppartamento } from '../api/verifica-prenotazione.js';
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

test('pagamento: il numero di prenotazione verificato nel primo passo va nei metadati (sessione e pagamento) per l\'area clienti di La Columbera; senza verifica o non valido non c\'è', async () => {
  for (const [v, atteso] of [[' 558r te56 487a9 ', '558RTE56487A9'], ['HMSEDESZCW', 'HMSEDESZCW'], [6877180932, '6877180932'], ['M-ABC1234', 'M-ABC1234'],
    ['<b>x</b>', ''], ['ab', ''], ['A'.repeat(41), ''], [null, ''], [undefined, ''], [{ a: 1 }, ''], [['ABC123'], '']]) assert.equal(numeroPrenotazioneValido(v), atteso, String(v));
  let creata = null;
  const fintoStripe = { checkout: { sessions: { create: async p => { creata = p; return { id: 'cs_test_x', url: 'https://checkout.stripe.invalid/x' }; } } } };
  const d = checkinFamiglia();
  let r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe)(fintoReq('POST', Object.assign({}, d, { numeroPrenotazione: '558r te56 487a9' })), r));
  assert.equal(r.statusCode, 200);
  assert.equal(creata.metadata.numeroPrenotazione, '558RTE56487A9'); assert.equal(creata.payment_intent_data.metadata.numeroPrenotazione, '558RTE56487A9');
  assert.equal(creata.metadata.dataCheckin, d.dataCheckin, 'resta un check-in (dataCheckin) anche con il numero');
  for (const altro of [undefined, '', '<script>']) {
    r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe)(fintoReq('POST', Object.assign({}, d, { numeroPrenotazione: altro })), r));
    assert.equal(r.statusCode, 200); assert.ok(!('numeroPrenotazione' in creata.metadata) && !('numeroPrenotazione' in creata.payment_intent_data.metadata), String(altro));
  }
});

test('pagamento nella pagina (come sul sito di La Columbera): con la chiave pubblicabile la sessione è «elements» (API dahlia solo per questa chiamata), stessi importi e metadati; senza, o con chiavi di tipo diverso, la pagina di Stripe come prima', async () => {
  const chiamate = [];
  const fintoStripe = { checkout: { sessions: { create: async (p, o) => { chiamate.push({ p, o }); return p.ui_mode === 'elements' ? { id: 'cs_test_el', client_secret: 'cs_test_el_secret_x', url: null } : { id: 'cs_test_h', url: 'https://checkout.stripe.invalid/h' }; } } } };
  const d = Object.assign(checkinFamiglia(), { numeroPrenotazione: 'HMSEDESZCW', ui: 'elements', successUrl: 'https://spaceestate.github.io/Checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}&temp_session=t1&lang=en', cancelUrl: 'https://spaceestate.github.io/Checkin/?canceled=true' });
  const ENV_EL = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_prova' };
  let r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe, ENV_EL)(fintoReq('POST', d), r));
  assert.equal(r.statusCode, 200);
  const el = chiamate.pop();
  assert.deepEqual([r.body.clientSecret, r.body.publishableKey, r.body.sessionId, r.body.checkoutUrl], ['cs_test_el_secret_x', 'pk_test_prova', 'cs_test_el', undefined], 'la pagina riceve la chiave della sessione, non un indirizzo');
  assert.deepEqual(el.o, { apiVersion: '2026-08-26.dahlia' }, 'versione delle API dei campi nella pagina, solo per questa chiamata');
  assert.equal(el.p.ui_mode, 'elements');
  for (const k of ['success_url', 'cancel_url', 'locale', 'allow_promotion_codes']) assert.ok(!(k in el.p), k + ' non ammesso nella pagina');
  assert.equal(el.p.return_url, d.successUrl, 'se la banca porta su un\'altra pagina si torna alla pagina di successo');
  assert.equal(el.p.line_items[0].price_data.unit_amount, Math.round(r.body.totale * 100), 'importo ricalcolato dal server');
  assert.equal(el.p.metadata.dataCheckin, d.dataCheckin, 'resta un check-in (il webhook lo riconosce)');
  assert.equal(el.p.metadata.numeroPrenotazione, 'HMSEDESZCW'); assert.equal(el.p.payment_intent_data.metadata.numeroPrenotazione, 'HMSEDESZCW');
  assert.ok(el.p.expires_at - Math.floor(Date.now() / 1000) <= 1800, 'scade dopo 30 minuti');
  // senza chiave, con formato sbagliato o di tipo diverso (prova/reale), o se la pagina non la chiede: pagina di Stripe, come prima
  for (const [env, ui] of [[{ STRIPE_SECRET_KEY: 'sk_test_x' }, 'elements'], [{ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_x' }, 'elements'],
    [{ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'chiave a caso' }, 'elements'], [ENV_EL, undefined]]) {
    r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe, env)(fintoReq('POST', Object.assign({}, d, { ui })), r));
    const h = chiamate.pop();
    assert.equal(r.statusCode, 200); assert.equal(r.body.checkoutUrl, 'https://checkout.stripe.invalid/h'); assert.equal(r.body.clientSecret, undefined);
    assert.equal(h.p.ui_mode, undefined); assert.equal(h.o, undefined, 'versione delle API di sempre'); assert.equal(h.p.success_url, d.successUrl); assert.equal(h.p.locale, d.lingua || 'it');
  }
});

test('chiave pubblicabile: ok solo se ha il formato giusto ed è dello stesso tipo della chiave segreta', () => {
  assert.deepEqual(chiavePubblicabile({}), { pk: '', stato: 'manca' });
  assert.deepEqual(chiavePubblicabile({ STRIPE_PUBLISHABLE_KEY: 'sk_test_x' }), { pk: '', stato: 'formato' });
  assert.deepEqual(chiavePubblicabile({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_x' }), { pk: '', stato: 'tipo' });
  assert.deepEqual(chiavePubblicabile({ STRIPE_SECRET_KEY: 'rk_live_x', STRIPE_PUBLISHABLE_KEY: ' pk_live_abc ' }), { pk: 'pk_live_abc', stato: 'ok' });
});

test('check-in senza numero («Non ho il numero di prenotazione»): il numero si cerca nel foglio Prenotazioni per data di arrivo e appartamento e va nel pagamento; solo se la prenotazione possibile è una sola', async () => {
  const riga = (n, d, a, notti, stato) => ({ get: k => ({ 'Numero Prenotazione': n, 'Data Check-in': d, 'Appartamento': a, 'Numero Notti': notti, 'STATO': stato })[k] });
  const T = '"La Columbera - Torre, Appartamento con 2 camere da letto"', C = '"La Columbera - Corte, Appartamento con 1 camere da letto"';
  const rows = [riga('6397656355', '30/10/2026', T, '2', 'DA_VERIFICARE'), riga('5679231822', '26/10/2026', T, '4', 'CONFERMATA'), riga('5956862602', '27/11/2026', C, '2', 'ANNULLATA'),
    riga('111', '2026-12-10', T, '2', 'CONFERMATA'), riga('222', '10/12/2026', T, '5', 'CONFERMATA'), riga('', '01/12/2026', C, '3', '')];
  assert.equal(trovaPerDataEAppartamento(rows, '2026-10-30', 'La Columbera - Torre, Appartamento con 2 camere da letto', '2'), '6397656355', 'unica (anche «da verificare»)');
  assert.equal(trovaPerDataEAppartamento(rows, '2026-10-30', 'La Columbera - Corte', '2'), '', 'appartamento diverso');
  assert.equal(trovaPerDataEAppartamento(rows, '2026-10-30', 'La Columbera - Torre + La Columbera - Corte', '2'), '', 'tutti e due gli appartamenti: non si indovina');
  assert.equal(trovaPerDataEAppartamento(rows, '2026-11-27', 'Corte', '2'), '', 'annullata');
  assert.equal(trovaPerDataEAppartamento(rows, '2026-12-10', 'Torre', '3'), '', 'due possibili, notti diverse da entrambe');
  assert.equal(trovaPerDataEAppartamento(rows, '2026-12-10', 'Torre', '5'), '222', 'le notti scelgono (date in formati diversi nel foglio)');
  assert.equal(trovaPerDataEAppartamento(rows, '2026-12-01', 'Corte', '3'), '', 'riga senza numero');
  // nel pagamento: numero trovato nel foglio (numeroDa = foglio); se l'ospite l'ha verificato vale il suo e il foglio non si interroga
  let creata = null, cercate = 0;
  const fintoStripe = { checkout: { sessions: { create: async p => { creata = p; return { id: 'cs_test_x', url: 'https://checkout.stripe.invalid/x' }; } } } };
  const deps = { cercaNumero: async (d, a, n) => { cercate++; return trovaPerDataEAppartamento(rows, d, a, n); } };
  const d = Object.assign(checkinFamiglia(), { dataCheckin: '2026-10-30', appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto', numeroNotti: 2 });
  let r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe, undefined, deps)(fintoReq('POST', d), r));
  assert.equal(r.statusCode, 200);
  assert.deepEqual([creata.metadata.numeroPrenotazione, creata.metadata.numeroDa, creata.payment_intent_data.metadata.numeroPrenotazione, cercate], ['6397656355', 'foglio', '6397656355', 1]);
  r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe, undefined, deps)(fintoReq('POST', Object.assign({}, d, { numeroPrenotazione: 'HMSEDESZCW' })), r));
  assert.deepEqual([creata.metadata.numeroPrenotazione, creata.metadata.numeroDa, cercate], ['HMSEDESZCW', 'ospite', 1], 'numero dell\'ospite: il foglio non si interroga');
  // foglio che non risponde: si paga lo stesso, senza numero
  r = fintoRes(); await catturaLog(() => makePagamento(fintoStripe, undefined, { cercaNumero: async () => { throw new Error('giù'); } })(fintoReq('POST', d), r));
  assert.equal(r.statusCode, 200); assert.ok(!('numeroPrenotazione' in creata.metadata) && !('numeroDa' in creata.metadata));
});

test('verifica prenotazione: il numero si trova anche scritto con spazi, punti o trattini e in minuscolo; prima vale la corrispondenza esatta', () => {
  const riga = n => ({ get: k => k === 'Numero Prenotazione' ? n : '' });
  const rows = [riga('558RTE56487A9'), riga(6877180932), riga('HM-ABC123'), riga('HMABC123')];
  for (const [n, i] of [['558RTE56487A9', 0], ['558r te56 487a9', 0], ['6877.180.932', 1], ['6877180932', 1], [' hm-abc123 ', 2], ['HMABC123', 3]]) assert.equal(cercaPrenotazione(rows, n), rows[i], n);
  for (const n of ['558RTE56487A', 'XX', '--']) assert.equal(cercaPrenotazione(rows, n), undefined, n);
  assert.equal(cercaPrenotazione(rows, 'hm abc123'), undefined, 'due righe possibili (HM-ABC123 e HMABC123): non si indovina');
});

test('Browserless: di serie Amsterdam (UE); Londra o San Francisco solo se indicati; qualsiasi altro indirizzo è ignorato (i dati non vanno altrove)', () => {
  assert.equal(urlBrowserless({}), 'https://production-ams.browserless.io');
  assert.equal(urlBrowserless({ BROWSERLESS_URL: 'https://production-sfo.browserless.io' }), 'https://production-sfo.browserless.io');
  assert.equal(urlBrowserless({ BROWSERLESS_URL: 'https://production-ams.browserless.io' }), 'https://production-ams.browserless.io');
  assert.equal(urlBrowserless({ BROWSERLESS_URL: ' https://production-lon.browserless.io/ ' }), 'https://production-lon.browserless.io');
  for (const v of ['https://evil.example', 'http://production-ams.browserless.io', 'https://production-ams.browserless.io.evil.example', 'https://production-ams.browserless.io/x', 'ams'])
    assert.equal(urlBrowserless({ BROWSERLESS_URL: v }), 'https://production-ams.browserless.io', v);
});
