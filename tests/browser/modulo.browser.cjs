// tests/browser/modulo.browser.cjs — prove del modulo del check-in con un browser vero (Chromium + Playwright), oltre la scansione:
// passi degli ospiti, verifica della prenotazione, campo data digitabile, campi con elenco, lingue e testi, pagina di esito.
// Nate dall'analisi del 13/11/2026: ogni prova riproduce un difetto trovato allora (con il codice di prima fallisce).
// Il sito è servito in locale da server-prova.cjs; le API del check-in sono finte (nessuna rete, nessun Stripe, nessun dato reale).
// Uso: node --test tests/browser/modulo.browser.cjs        (serve Playwright: vedi CLAUDE.md, «Prove nel browser»)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require('playwright');
const { avvia, API } = require('./server-prova.cjs');

const DOC = path.join(__dirname, 'documenti-sintetici');
const IPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const domani = () => new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
let browser;

test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { if (browser) await browser.close(); });

// Apre una pagina del sito di prova. opzioni:
//  pagina    indirizzo dopo la radice (per esempio 'successo-pagamento.html?session_id=…')
//  lingua    lingua già scelta (memoria locale del browser)
//  contesto  opzioni del contesto di Playwright (telefono, fuso orario…)
//  api       (nome, corpo, indirizzo) → risposta finta di un'API; { __status, __body } per uno stato diverso da 200; undefined = quella di server-prova
//  dominio   nome finto da cui servire il sito: da «localhost» il modulo salta il pagamento (modalità di prova di checkin.js)
//  stripe    testo di uno Stripe.js finto servito al posto di https://js.stripe.com
async function apri(o = {}) {
  const srv = await avvia({ scansione: o.scansione || 'spenta' });
  const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.contesto || {}));
  if (o.lingua) await context.addInitScript(l => { try { localStorage.setItem('columbera_lingua', l); } catch (e) { /* memoria bloccata */ } }, o.lingua);
  if (o.initScript) await context.addInitScript(o.initScript);
  const page = await context.newPage();
  const rete = [], console_ = [], errori = [];
  context.on('request', r => rete.push({ metodo: r.method(), url: r.url(), corpo: r.postData() || '' }));
  page.on('console', m => console_.push(m.text()));
  page.on('pageerror', e => errori.push(e.message));
  await context.route(API + '**', async route => {
    const url = route.request().url(), nome = url.slice(API.length).split('?')[0];
    const corpo = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    let r = o.api ? await o.api(nome, corpo, url) : undefined;
    if (r === undefined) r = await srv.api(nome, corpo);
    await route.fulfill({ status: r.__status || 200, contentType: 'application/json', body: JSON.stringify(r.__body !== undefined ? r.__body : r) });
  });
  let radice = srv.url;
  if (o.dominio) {
    radice = 'https://' + o.dominio + '/';
    await context.route(radice + '**', async route => {
      const u = new URL(route.request().url());
      try { await route.fulfill({ response: await route.fetch({ url: srv.url + u.pathname.slice(1) + u.search }) }); } catch (e) { await route.abort(); }
    });
  }
  if (o.stripe) await context.route('https://js.stripe.com/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: o.stripe }));
  await page.goto(radice + (o.pagina || ''));
  return { srv, context, page, rete, console: console_, errori, chiudi: async () => { await context.close(); await srv.chiudi(); } };
}

const notifica = page => page.evaluate(() => { const n = document.querySelector('.notification'); return n ? n.textContent : ''; });
const passoAttivo = page => page.evaluate(() => { const s = document.querySelector('.step.active'); return s ? s.id : null; });
const tocca = (page, selettore, telefono) => (telefono ? page.tap(selettore) : page.click(selettore));

// Dati di un ospite scritti nei campi veri del modulo (come dopo una scelta dall'elenco)
async function compila(page, n, dati = {}) {
  const v = Object.assign({ cognome: 'Esempio', nome: 'Mario', genere: 'M', nascita: '1980-05-10', cittadinanza: 'Germania', luogo: 'Germania' }, dati);
  await page.evaluate(({ n, v }) => {
    const metti = (sel, val) => { const el = document.querySelector(sel); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    metti(`[name="ospite${n}_cognome"]`, v.cognome); metti(`[name="ospite${n}_nome"]`, v.nome);
    metti(`select[name="ospite${n}_genere"]`, v.genere); metti(`input[name="ospite${n}_nascita"]`, v.nascita);
    metti(`select[name="ospite${n}_cittadinanza"]`, v.cittadinanza); metti(`select[name="ospite${n}_luogo_nascita"]`, v.luogo);
    if (n === 1) { metti('select[name="ospite1_tipo_documento"]', 'PASSAPORTO ORDINARIO'); metti('input[name="ospite1_numero_documento"]', 'C01X00T47'); metti('select[name="ospite1_luogo_rilascio"]', 'Germania'); }
  }, { n, v });
  if (n === 1) await page.setInputFiles('#ospite1_documento_fronte', path.join(DOC, 'passaporto-de.jpg'));
}

// Primo passo senza numero di prenotazione, poi i dati del soggiorno scritti a mano
async function soggiornoAMano(page, { ospiti = 1, notti = 2, data = domani() } = {}) {
  if (await passoAttivo(page) === 'step-0') { await page.click('.no-booking-link'); await page.waitForSelector('#step-1.active'); }
  await page.evaluate(d => { const i = document.getElementById('data-checkin'); i.value = d; i.dispatchEvent(new Event('change', { bubbles: true })); }, data);
  if (!(await page.isChecked('.apartment-checkbox[value*="Torre"]'))) await page.click('.apartment-chip:has(input[value*="Torre"])');
  await page.selectOption('#numero-ospiti', String(ospiti));
  await page.fill('#numero-notti', String(notti));
  if (ospiti > 1) await page.selectOption('#tipo-gruppo', 'famiglia');
}
const avanti = async (page, da, a) => { await page.click(`#${da} .btn-primary`); await page.waitForSelector(`#${a}.active`); };

// Prenotazione di prova verificata (PROVA1: Torre, 3 ospiti, 2 notti, arrivo domani) fino al passo dei dati del soggiorno
async function verifica(page, numero = 'PROVA1') {
  await page.fill('#numero-prenotazione', numero);
  await page.click('#step-0 .btn-primary');
  await page.waitForSelector('#step-1.active');
  await page.waitForFunction(() => /✓/.test(document.querySelector('#step-1 .step-subtitle').textContent));
}

const STRIPE_FINTO = `window.Stripe = function () { return { initCheckoutElementsSdk: function () { return {
  createPaymentElement: function () { return { on: function (e, f) { setTimeout(f, 20); }, mount: function () {}, destroy: function () {} }; },
  loadActions: function () { return Promise.resolve({ type: 'success', actions: { getSession: function () { return {}; }, updateEmail: function () { return Promise.resolve({ type: 'success' }); },
    confirm: function () { return Promise.resolve({ type: 'error', error: { message: 'prova' } }); } } }); } }; } }; };`;

// ---- Passi degli ospiti ----

test('numero di ospiti cambiato dopo aver creato i passi: i passi seguono il nuovo numero, i dati già scritti restano, l\'ultimo ospite porta al riepilogo', async () => {
  // da 2 a 3 ospiti: prima, dopo il secondo ospite, la pagina restava vuota e senza pulsanti
  let x = await apri();
  try {
    const p = x.page;
    await soggiornoAMano(p, { ospiti: 2 });
    await avanti(p, 'step-1', 'step-2');
    await compila(p, 1);
    await p.click('#step-2 .btn-secondary'); await p.waitForSelector('#step-1.active');
    await p.selectOption('#numero-ospiti', '3');
    await avanti(p, 'step-1', 'step-2');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.step')].map(s => s.id)), ['step-0', 'step-1', 'step-2', 'step-3', 'step-4', 'step-final', 'step-success'], 'un passo per ognuno dei tre ospiti, in ordine');
    assert.equal(await p.inputValue('[name="ospite1_cognome"]'), 'Esempio', 'i dati del primo ospite sono ancora lì');
    assert.equal((await p.textContent('#step-3 .button-group .btn-primary')).trim(), 'Prossimo ospite →', 'il secondo ospite non è più l\'ultimo');
    assert.equal((await p.textContent('#step-4 .button-group .btn-primary')).trim(), 'Vai al riepilogo →');
    await avanti(p, 'step-2', 'step-3');
    await compila(p, 2, { nome: 'Anna', genere: 'F' });
    await avanti(p, 'step-3', 'step-4');
    await compila(p, 3, { nome: 'Luca', nascita: '2015-03-01' });
    await avanti(p, 'step-4', 'step-final');
    assert.equal(await p.locator('.guest-summary').count(), 3, 'tre ospiti nel riepilogo');
    assert.equal((await p.textContent('#progress-label')).trim(), 'Passo 6 di 6');
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
  // da 3 a 2 ospiti: il secondo diventa l'ultimo (prima il suo pulsante diceva ancora «Prossimo ospite»)
  x = await apri();
  try {
    const p = x.page;
    await soggiornoAMano(p, { ospiti: 3, notti: 2 });
    await avanti(p, 'step-1', 'step-2');
    await p.click('#step-2 .btn-secondary'); await p.waitForSelector('#step-1.active');
    await p.selectOption('#numero-ospiti', '2');
    await avanti(p, 'step-1', 'step-2');
    assert.equal((await p.textContent('#step-3 .button-group .btn-primary')).trim(), 'Vai al riepilogo →');
    await compila(p, 1);
    await avanti(p, 'step-2', 'step-3');
    await compila(p, 2, { nome: 'Anna', genere: 'F' });
    await avanti(p, 'step-3', 'step-final');
    assert.equal(await p.locator('.guest-summary').count(), 2);
    assert.equal((await p.textContent('.total-amount')).trim(), '€6.00', '2 ospiti per 2 notti');
  } finally { await x.chiudi(); }
});

// ---- Verifica della prenotazione ----

test('verifica riuscita e «Torna indietro»: il pulsante di verifica è di nuovo attivo; «Non ho il numero» sblocca i campi; «✓ verificati» resta al cambio di lingua', async () => {
  const x = await apri();
  try {
    const p = x.page;
    await verifica(p);
    const bloccati = () => p.evaluate(() => ({ caselle: [...document.querySelectorAll('.apartment-checkbox')].map(c => c.disabled), ospiti: document.getElementById('numero-ospiti').disabled,
      notti: document.getElementById('numero-notti').readOnly, data: document.querySelector('#step-1 .date-text-input').readOnly, calendario: document.querySelector('#step-1 .date-picker-btn').disabled }));
    assert.deepEqual(await bloccati(), { caselle: [true, true], ospiti: true, notti: true, data: true, calendario: true }, 'dati della prenotazione verificata: bloccati, come sempre');
    // cambio di lingua (e ritorno): la conferma della verifica resta (prima tornava il sottotitolo generico)
    await p.click('.lang-flag[data-lang="en"]');
    assert.match(await p.textContent('#step-1 .step-subtitle'), /✓ Booking details verified/);
    assert.match(await p.textContent('#step-1 .step-subtitle'), /Select the type of group/);
    await p.click('.lang-flag[data-lang="it"]');
    assert.match(await p.textContent('#step-1 .step-subtitle'), /✓ Dati prenotazione verificati/);
    // «Torna indietro»: prima il pulsante restava disattivato con «Verifica in corso…»
    await p.click('#step-1 .btn-secondary');
    await p.click('.confirm-box .btn-primary');
    await p.waitForSelector('#step-0.active');
    assert.deepEqual(await p.evaluate(() => { const b = document.querySelector('#step-0 .btn-primary'); return [b.disabled, b.textContent.trim()]; }), [false, 'Verifica e continua →']);
    // «Non ho il numero di prenotazione»: si compila a mano, quindi i campi si possono cambiare (i valori restano scritti)
    await p.click('.no-booking-link'); await p.waitForSelector('#step-1.active');
    assert.deepEqual(await bloccati(), { caselle: [false, false], ospiti: false, notti: false, data: false, calendario: false });
    assert.equal((await p.textContent('#step-1 .step-subtitle')).trim(), 'Inserisci i dettagli della tua prenotazione');
    assert.equal(await p.inputValue('#numero-ospiti'), '3', 'i valori precompilati restano');
    assert.equal(await p.evaluate(() => window.datiPrecompilati), false);
    await p.selectOption('#numero-ospiti', '2');
    // tornando indietro e verificando di nuovo, la prenotazione verificata vale di nuovo (campi bloccati, numero di ospiti del foglio)
    await p.click('#step-1 .btn-secondary'); await p.waitForSelector('#step-0.active');
    await p.click('#step-0 .btn-primary');
    await p.waitForFunction(() => document.querySelector('#step-1.active') && document.getElementById('numero-ospiti').disabled);
    assert.deepEqual(await bloccati(), { caselle: [true, true], ospiti: true, notti: true, data: true, calendario: true });
    assert.equal(await p.inputValue('#numero-ospiti'), '3');
    assert.match(await p.textContent('#step-1 .step-subtitle'), /✓ Dati prenotazione verificati/);
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

test('prenotazione del foglio con l\'appartamento scritto in un altro modo o con più ospiti del menu: il campo resta da compilare; errore del server: non è «numero non trovato»', async () => {
  const foglio = dati => (nome => (nome === 'verifica-prenotazione' ? { found: true, dati: Object.assign({ numeroPrenotazione: 'X1', dataCheckin: domani(), numeroNotti: 2 }, dati) } : undefined));
  // appartamento non riconosciuto: prima le caselle restavano bloccate e vuote («Seleziona almeno un appartamento», senza poterlo fare)
  let x = await apri({ api: foglio({ appartamento: 'Intera proprietà', numeroOspiti: 4 }) });
  try {
    const p = x.page;
    await verifica(p, 'X1');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.apartment-checkbox')].map(c => [c.checked, c.disabled])), [[false, false], [false, false]]);
    assert.equal(await p.evaluate(() => document.getElementById('numero-ospiti').disabled), false, 'il numero di ospiti dipende dall\'appartamento: si può scegliere');
    assert.equal(await p.evaluate(() => document.getElementById('numero-notti').readOnly), true, 'il resto della prenotazione resta bloccato');
    await p.click('.apartment-chip:has(input[value*="Torre"])');
    await p.selectOption('#tipo-gruppo', 'famiglia');
    await avanti(p, 'step-1', 'step-2');
  } finally { await x.chiudi(); }
  // più ospiti di quelli del menu: prima il menu restava bloccato e vuoto
  x = await apri({ api: foglio({ appartamento: 'La Columbera - Torre + La Columbera - Corte', numeroOspiti: 12 }) });
  try {
    const p = x.page;
    await verifica(p, 'X1');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.apartment-checkbox')].map(c => [c.checked, c.disabled])), [[true, true], [true, true]], 'appartamenti riconosciuti: bloccati');
    assert.deepEqual(await p.evaluate(() => { const s = document.getElementById('numero-ospiti'); return [s.value, s.disabled]; }), ['', false]);
    await p.selectOption('#numero-ospiti', '9'); await p.selectOption('#tipo-gruppo', 'generico');
    await avanti(p, 'step-1', 'step-2');
  } finally { await x.chiudi(); }
  // prenotazione normale: tutto bloccato come sempre, anche con più ospiti del massimo dell'appartamento (Corte con 5)
  x = await apri({ api: foglio({ appartamento: 'La Columbera - Corte, Appartamento con 1 camera da letto', numeroOspiti: 5 }) });
  try {
    const p = x.page;
    await verifica(p, 'X1');
    assert.deepEqual(await p.evaluate(() => { const s = document.getElementById('numero-ospiti'); return [s.value, s.disabled]; }), ['5', true]);
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.apartment-checkbox')].map(c => [c.checked, c.disabled])), [[false, true], [true, true]]);
  } finally { await x.chiudi(); }
  // errore del server: prima «Numero di prenotazione non trovato», come per un numero sbagliato
  x = await apri({ api: nome => (nome === 'verifica-prenotazione' ? { __status: 500, __body: { found: false, error: 'Errore interno del server' } } : undefined) });
  try {
    const p = x.page;
    await p.fill('#numero-prenotazione', 'X1'); await p.click('#step-0 .btn-primary');
    await p.waitForFunction(() => /Errore nella verifica/.test((document.querySelector('.notification') || {}).textContent || ''));
    assert.equal(await passoAttivo(p), 'step-0');
    assert.deepEqual(await p.evaluate(() => { const b = document.querySelector('#step-0 .btn-primary'); return [b.disabled, b.textContent.trim()]; }), [false, 'Verifica e continua →']);
  } finally { await x.chiudi(); }
  // numero che non c'è (404) e troppi tentativi (429): «non trovato», come prima
  for (const stato of [404, 429]) {
    x = await apri({ api: nome => (nome === 'verifica-prenotazione' ? { __status: stato, __body: { found: false } } : undefined) });
    try {
      await x.page.fill('#numero-prenotazione', 'X1'); await x.page.click('#step-0 .btn-primary');
      await x.page.waitForFunction(() => /non trovato/.test((document.querySelector('.notification') || {}).textContent || ''));
    } finally { await x.chiudi(); }
  }
});

// ---- Campi con elenco ----

test('campi con elenco: la voce scritta per intero vale anche toccando subito «Prossimo ospite» (computer e telefono); una voce che non è nell\'elenco resta un errore', async () => {
  for (const telefono of [false, true]) {
    const x = await apri({ contesto: telefono ? IPHONE : {} });
    try {
      const p = x.page;
      await verifica(p);
      await p.selectOption('#tipo-gruppo', 'famiglia');
      await tocca(p, '#step-1 .btn-primary', telefono); await p.waitForSelector('#step-2.active');
      await compila(p, 1);
      // la cittadinanza scritta a mano, senza scegliere dall'elenco, e subito «Prossimo ospite»: prima «Cittadinanza è obbligatorio», a ogni tocco
      await p.evaluate(() => { document.querySelector('select[name="ospite1_cittadinanza"]').value = ''; });
      await tocca(p, '#ospite1_cittadinanza__testo', telefono);
      await p.keyboard.type('Germania');
      await tocca(p, '#step-2 .btn-primary', telefono);
      await p.waitForSelector('#step-3.active');
      assert.equal(await p.evaluate(() => document.querySelector('select[name="ospite1_cittadinanza"]').value), 'Germania', telefono ? 'telefono' : 'computer');
      // comune scritto a mano (nato in Italia): prima il primo tocco su «Avanti» dava «Comune e provincia sono obbligatori»
      await compila(p, 2, { nome: 'Anna', genere: 'F', luogo: 'Italia' });
      await tocca(p, '#ospite2_comune__testo', telefono);
      await p.waitForFunction(() => window.ElencoComuni && window.ElencoComuni.pronto());
      await p.keyboard.type('Trento');
      // sul telefono l'elenco aperto copre il pulsante: l'ospite tocca prima fuori dall'elenco (qui il titolo del passo)
      if (telefono) await p.tap('#step-3 .step-title');
      await tocca(p, '#step-3 .btn-primary', telefono);
      await p.waitForSelector('#step-4.active');
      assert.deepEqual(await p.evaluate(() => [document.querySelector('input[name="ospite2_comune"]').value, document.querySelector('select[name="ospite2_provincia"]').value]), ['TRENTO', 'TN']);
      // una voce che non è nell'elenco: errore sul campo, non si va avanti
      await compila(p, 3, { nome: 'Luca' });
      await p.evaluate(() => { document.querySelector('select[name="ospite3_luogo_nascita"]').value = ''; });
      await tocca(p, '#ospite3_luogo_nascita__testo', telefono);
      await p.keyboard.type('Atlantide');
      if (telefono) await p.tap('#step-4 .step-title');
      await tocca(p, '#step-4 .btn-primary', telefono);
      await p.waitForFunction(() => /obbligatorio/.test((document.querySelector('.notification') || {}).textContent || ''));
      assert.equal(await passoAttivo(p), 'step-4');
      assert.equal(await p.evaluate(() => document.querySelector('#ospite3_luogo_nascita__testo-errore').textContent), 'Scegli una voce dell\'elenco.');
      // la scelta dall'elenco funziona come sempre
      await p.fill('#ospite3_luogo_nascita__testo', 'Franc');
      await tocca(p, '#ospite3_luogo_nascita__testo-lista li', telefono);
      assert.equal(await p.evaluate(() => document.querySelector('select[name="ospite3_luogo_nascita"]').value), 'Francia');
      assert.deepEqual(x.errori, []);
    } finally { await x.chiudi(); }
  }
});

// ---- Campo data ----

test('campo data digitabile: arrivo nell\'anno prossimo accettato; data cancellata o sbagliata non lascia il valore di prima; data di nascita futura rifiutata; segnaposto tradotto', async () => {
  const x = await apri({ lingua: 'en' });
  try {
    const p = x.page, anno = new Date().getFullYear(), testo = '#step-1 .date-text-input';
    const stato = () => p.evaluate(() => ({ testo: document.querySelector('#step-1 .date-text-input').value, errore: document.querySelector('#step-1 .date-text-input').classList.contains('error'), valore: document.getElementById('data-checkin').value }));
    await p.click('.no-booking-link'); await p.waitForSelector('#step-1.active');
    assert.equal(await p.getAttribute(testo, 'placeholder'), 'DD/MM/YYYY', 'segnaposto nella lingua dell\'ospite (prima «GG/MM/AAAA» in tutte le lingue)');
    await p.click('.lang-flag[data-lang="de"]');
    assert.equal(await p.getAttribute(testo, 'placeholder'), 'TT/MM/JJJJ');
    await p.click('.lang-flag[data-lang="it"]');
    assert.equal(await p.getAttribute(testo, 'placeholder'), 'GG/MM/AAAA');
    // arrivo il 2 gennaio dell'anno prossimo: prima il campo diventava rosso e la data non veniva presa
    await p.click(testo); await p.keyboard.type('0201' + (anno + 1));
    assert.deepEqual(await stato(), { testo: '02/01/' + (anno + 1), errore: false, valore: (anno + 1) + '-01-02' });
    // data cancellata: prima il campo vero teneva la data di prima e si andava avanti con quella
    await p.fill(testo, '');
    assert.equal((await stato()).valore, '');
    await p.click('.apartment-chip:has(input[value*="Torre"])'); await p.selectOption('#numero-ospiti', '2'); await p.fill('#numero-notti', '2'); await p.selectOption('#tipo-gruppo', 'famiglia');
    await p.click('#step-1 .btn-primary');
    await p.waitForFunction(() => /Seleziona la data di check-in/.test((document.querySelector('.notification') || {}).textContent || ''));
    // data che non esiste: rossa, con il messaggio; nessun valore di prima
    await p.click(testo); await p.keyboard.type('0201' + (anno + 1));
    await p.fill(testo, ''); await p.click(testo); await p.keyboard.type('4512' + anno);
    assert.deepEqual(await stato(), { testo: '45/12/' + anno, errore: true, valore: '' });
    assert.match(await notifica(p), /Data non valida/);
    // data giusta: si prosegue
    await p.fill(testo, ''); await p.click(testo); await p.keyboard.type('0201' + (anno + 1));
    await avanti(p, 'step-1', 'step-2');
    // data di nascita futura (qui: dopodomani; con il calendario del computer non si può scegliere, a mano sì): rifiutata con il suo messaggio
    const d = new Date(Date.now() + 2 * 86400e3), gg = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
    await compila(p, 1);
    const nascita = '#step-2 .date-text-input';
    await p.fill(nascita, ''); await p.click(nascita); await p.keyboard.type(gg + mm + d.getFullYear());
    assert.equal(await p.inputValue('input[name="ospite1_nascita"]'), '', 'una data di nascita futura non viene presa');
    assert.match(await notifica(p), /Data di nascita non valida/);
    await p.click('#step-2 .btn-primary');
    await p.waitForFunction(() => /Data di nascita è obbligatorio/.test((document.querySelector('.notification') || {}).textContent || ''));
    assert.equal(await passoAttivo(p), 'step-2');
    // la data di oggi è una data di nascita possibile (un neonato): accettata per un ospite che non è il responsabile
    await p.fill(nascita, ''); await p.click(nascita); await p.keyboard.type('10051980');
    await avanti(p, 'step-2', 'step-3');
    // (il giorno di oggi secondo l'ora universale, come il limite scritto nel campo: così la prova non dipende dal fuso di chi la esegue)
    const [oa, om, og] = new Date().toISOString().slice(0, 10).split('-');
    await compila(p, 2, { nome: 'Anna', genere: 'F' });
    await p.fill('#step-3 .date-text-input', ''); await p.click('#step-3 .date-text-input'); await p.keyboard.type(og + om + oa);
    assert.equal(await p.inputValue('input[name="ospite2_nascita"]'), `${oa}-${om}-${og}`);
    // il pattern del campo è valido (prima Chrome scriveva un errore in console a ogni controllo del campo)
    await p.evaluate(() => document.querySelector('#step-1 .date-text-input').checkValidity());
    assert.deepEqual(x.console.filter(r => /Pattern attribute value/.test(r)), []);
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

test('iPhone (campo data del telefono): data di nascita fuori dai limiti rifiutata; data di arrivo passata di una prenotazione verificata accettata; un solo ascoltatore per campo', async () => {
  const x = await apri({ contesto: IPHONE, api: nome => (nome === 'verifica-prenotazione' ? { found: true, dati: { numeroPrenotazione: 'X1', dataCheckin: '2025-08-10', appartamento: 'La Columbera - Torre', numeroOspiti: 2, numeroNotti: 2 } } : undefined),
    initScript: () => {
      window.__ascolti = {};
      const aggiungi = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (tipo, f, o) {
        if (this instanceof HTMLInputElement && this.type === 'date' && tipo === 'focus') window.__ascolti[this.id] = (window.__ascolti[this.id] || 0) + 1;
        return aggiungi.call(this, tipo, f, o);
      };
    } });
  try {
    const p = x.page;
    await verifica(p, 'X1');
    assert.equal(await p.inputValue('#data-checkin'), '2025-08-10', 'la data di arrivo della prenotazione verificata resta, anche se è passata');
    await p.selectOption('#tipo-gruppo', 'famiglia');
    await p.tap('#step-1 .btn-primary'); await p.waitForSelector('#step-2.active');
    assert.equal(await p.locator('.date-input-wrapper').count(), 0, 'sull\'iPhone il campo data è quello del telefono');
    const scegli = (n, valore) => p.evaluate(({ n, valore }) => { const el = document.querySelector(`input[name="ospite${n}_nascita"]`); el.value = valore; el.dispatchEvent(new Event('change', { bubbles: true })); return el.value; }, { n, valore });
    const futuro = (new Date().getFullYear() + 3) + '-01-01';
    assert.equal(await scegli(1, futuro), '', 'data di nascita futura: il campo si svuota');
    assert.match(await notifica(p), /Data di nascita non valida/);
    assert.equal(await scegli(1, '0001-01-01'), '', 'anno 0001');
    assert.equal(await scegli(1, '1980-05-10'), '1980-05-10', 'una data vera resta');
    await compila(p, 1);
    await p.tap('#step-2 .btn-primary'); await p.waitForSelector('#step-3.active');
    await compila(p, 2, { nome: 'Anna', genere: 'F' });
    await p.tap('#step-3 .btn-primary'); await p.waitForSelector('#step-final.active');
    // prima ogni modifica del modulo aggiungeva gli stessi ascoltatori agli stessi campi (qui erano già 6-9 per campo)
    assert.deepEqual(await p.evaluate(() => window.__ascolti), { 'data-checkin': 1, ospite1_nascita: 1, ospite2_nascita: 1 });
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

// ---- Fuso orario ----

test('ospite che compila dall\'America: il riepilogo e la pagina di esito mostrano il giorno scelto; la data di oggi non è «nel passato»', async () => {
  for (const fuso of ['America/New_York', 'America/Los_Angeles', 'Europe/Rome', 'Asia/Tokyo']) {
    const x = await apri({ contesto: { timezoneId: fuso } });
    try {
      const p = x.page;
      await soggiornoAMano(p, { data: '2030-12-20' });
      await avanti(p, 'step-1', 'step-2');
      await compila(p, 1);
      await avanti(p, 'step-2', 'step-final');
      assert.match(await p.textContent('#summary-content .summary-item'), /venerdì 20 dicembre 2030/, fuso + ': prima, a ovest di Greenwich, «giovedì 19 dicembre»');
    } finally { await x.chiudi(); }
  }
  // la data di oggi (di chi compila): prima, a New York, «La data di check-in non può essere nel passato»
  let x = await apri({ contesto: { timezoneId: 'America/New_York' } });
  try {
    const p = x.page;
    const oggi = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    await soggiornoAMano(p, { data: oggi });
    await avanti(p, 'step-1', 'step-2');
    // ieri resta «nel passato»
    await p.click('#step-2 .btn-secondary'); await p.waitForSelector('#step-1.active');
    const ieri = await p.evaluate(() => { const d = new Date(Date.now() - 86400e3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    await p.evaluate(d => { const i = document.getElementById('data-checkin'); i.value = d; i.dispatchEvent(new Event('change', { bubbles: true })); }, ieri);
    await p.click('#step-1 .btn-primary');
    await p.waitForFunction(() => /non può essere nel passato/.test((document.querySelector('.notification') || {}).textContent || ''));
    assert.equal(await passoAttivo(p), 'step-1');
  } finally { await x.chiudi(); }
  x = await apri({ pagina: 'successo-pagamento.html?session_id=cs_test_x&lang=it', contesto: { timezoneId: 'America/New_York' }, api: sessioneFinta() });
  try {
    await x.page.waitForFunction(() => /Notti/.test(document.getElementById('booking-details').textContent));
    assert.match(await x.page.textContent('#booking-details'), /venerdì 20 dicembre 2030/);
  } finally { await x.chiudi(); }
});

// ---- Pagina di esito ----

// Risposta finta di get-session (dettagli e codice); con ?elabora=1 la risposta dell'elaborazione di riserva
function sessioneFinta(dati, contatore) {
  return (nome, corpo, url) => {
    if (nome !== 'get-session') return undefined;
    if (/elabora=1/.test(url)) return { elaborazione: 'completato' };
    if (contatore) contatore.richieste++;
    if (contatore && contatore.fallite > 0) { contatore.fallite--; return { __status: 500, __body: { error: 'Errore interno del server' } }; }
    return Object.assign({ id: 'cs_test_x', dataCheckin: '2030-12-20', appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto', numeroOspiti: '2', numeroNotti: '3', totale: '9',
      status: 'complete', payment_status: 'paid', amount_total: '9.00', codiciCassetta: [{ codice: '0000', nome: 'Torre', descrizione: 'Appartamento con 2 camere da letto' }] }, dati || {});
  };
}
const esito = page => page.evaluate(() => ({ titolo: document.querySelector('.success-title').textContent.trim(), icona: document.querySelector('.success-icon').textContent.trim(),
  dettagli: document.getElementById('booking-details').textContent.replace(/\s+/g, ' ').trim(), codice: document.getElementById('codice-cassetta').textContent.replace(/\s+/g, ' ').trim() }));

test('pagina di esito: un errore di un momento non la rovina (nuovo tentativo; codice che resta dopo un errore estraneo); i valori del pagamento sono testo; il cambio di lingua aggiorna data e appartamento', async () => {
  // prima risposta mancata, la seconda arriva: prima bastava una risposta mancata per «Errore nel caricamento» a chi aveva appena pagato
  let contatore = { richieste: 0, fallite: 1 };
  let x = await apri({ pagina: 'successo-pagamento.html?session_id=cs_test_x&lang=it', api: sessioneFinta(null, contatore) });
  try {
    const p = x.page;
    await p.waitForFunction(() => /Notti/.test(document.getElementById('booking-details').textContent), null, { timeout: 15000 });
    assert.equal(contatore.richieste, 2, 'un secondo tentativo');
    assert.deepEqual(await esito(p), { titolo: 'Pagamento completato!', icona: '✅', codice: '0000',
      dettagli: 'Check-in: venerdì 20 dicembre 2030 Appartamento: La Columbera - Torre, Appartamento con 2 camere da letto Ospiti: 2 Notti: 3 Totale pagato: €9.00' });
    // un errore qualsiasi DOPO (uno script estraneo, come quelli che certe app aggiungono alle pagine): prima cancellava codice e dettagli
    await p.evaluate(() => setTimeout(() => { throw new Error('errore di uno script estraneo'); }, 0));
    await p.waitForTimeout(300);
    assert.equal((await esito(p)).codice, '0000');
    assert.equal((await esito(p)).icona, '✅');
    // cambio di lingua: prima data e appartamento restavano nella lingua di prima
    await p.click('.lang-flag[data-lang="de"]');
    assert.deepEqual(await esito(p), { titolo: 'Zahlung abgeschlossen!', icona: '✅', codice: '0000',
      dettagli: 'Check-in: Freitag, 20. Dezember 2030 Wohnung: La Columbera - Torre, Wohnung mit 2 Schlafzimmern Gäste: 2 Nächte: 3 Gesamtbetrag bezahlt: €9.00' });
  } finally { await x.chiudi(); }
  // tutti i tentativi falliti: la pagina di errore di sempre, dopo tre tentativi
  contatore = { richieste: 0, fallite: 99 };
  x = await apri({ pagina: 'successo-pagamento.html?session_id=cs_test_x&lang=it', api: sessioneFinta(null, contatore) });
  try {
    await x.page.waitForFunction(() => document.querySelector('.success-icon').textContent.trim() === '❌', null, { timeout: 20000 });
    assert.equal(contatore.richieste, 3);
    assert.equal((await esito(x.page)).titolo, 'Errore nel caricamento');
  } finally { await x.chiudi(); }
  // due appartamenti, e valori del pagamento che contengono HTML: mostrati come testo, mai eseguiti
  x = await apri({ pagina: 'successo-pagamento.html?session_id=cs_test_x&lang=en', api: sessioneFinta({ appartamento: 'Torre + Corte <img src=x onerror="window.__eseguito=1">', numeroOspiti: '2<img src=x onerror="window.__eseguito=2">',
    numeroNotti: '3<b>x</b>', codiciCassetta: [{ codice: '0000', nome: 'Corte', descrizione: 'Appartamento con 1 camera da letto' }, { codice: '1111', nome: 'Torre<img src=x onerror="window.__eseguito=3">', descrizione: '<i>x</i>' }] }) });
  try {
    const p = x.page;
    await p.waitForFunction(() => /Nights/.test(document.getElementById('booking-details').textContent));
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.__eseguito), undefined, 'nessun codice eseguito');
    assert.equal(await p.locator('#booking-details img, #booking-details b, #codice-cassetta img, #codice-cassetta i').count(), 0, 'nessun elemento creato dai valori');
    assert.match(await p.textContent('#booking-details'), /Guests:\s*2<img src=x/);
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.code-item')].map(c => [c.querySelector('.code-number').textContent, c.querySelector('.code-desc').textContent])), [['0000', 'Apartment with 1 bedroom'], ['1111', '<i>x</i>']]);
  } finally { await x.chiudi(); }
});

// ---- Testi ----

test('testi: «1 notte» e «1 anno»; titolo della scheda con il nome della struttura; segnaposto del documento tradotto; Paesi in ordine alfabetico nella lingua scelta; notifiche lette dai lettori di schermo', async () => {
  const unAnnoFa = new Date(Date.now() - 400 * 86400e3).toISOString().slice(0, 10);
  const x = await apri({ dominio: 'checkin.prova', stripe: STRIPE_FINTO, api: nome => (nome === 'crea-pagamento-stripe' ? { clientSecret: 'cs_secret', publishableKey: 'pk_test_x', sessionId: 'cs_test_x', totale: 1.5 } : undefined) });
  try {
    const p = x.page;
    assert.equal(await p.title(), 'Check-in Ospiti · La Columbera', 'prima il titolo tradotto perdeva «· La Columbera»');
    await soggiornoAMano(p, { ospiti: 2, notti: 1 });
    assert.equal(await p.getAttribute('.notification', 'role'), 'status', 'le notifiche sono annunciate dai lettori di schermo');
    await avanti(p, 'step-1', 'step-2');
    // elenco dei Paesi: in italiano come prima, in inglese e in tedesco in ordine alfabetico (prima «Deutschland» tra «Georgien» e «Ghana»)
    const paesi = async lingua => {
      await p.click(`.lang-flag[data-lang="${lingua}"]`);
      await p.click('#ospite1_cittadinanza__testo');
      const voci = await p.evaluate(() => [...document.querySelectorAll('#ospite1_cittadinanza__testo-lista li')].map(li => li.textContent));
      await p.keyboard.press('Escape');
      return voci;
    };
    for (const lingua of ['de', 'en', 'it']) {
      const voci = await paesi(lingua);
      assert.equal(voci.length, 192, lingua);
      assert.deepEqual(voci, voci.slice().sort((a, b) => a.localeCompare(b, lingua)), 'ordine alfabetico: ' + lingua);
    }
    await p.click('.lang-flag[data-lang="en"]');
    assert.equal(await p.getAttribute('#ospite1_numero_documento', 'placeholder'), 'e.g. AA1234567', 'prima «Es. AA1234567» in tutte le lingue');
    await p.click('.lang-flag[data-lang="it"]');
    assert.equal(await p.getAttribute('#ospite1_numero_documento', 'placeholder'), 'Es. AA1234567');
    await p.click('#step-2 .btn-primary');
    await p.waitForFunction(() => /obbligatorio/.test((document.querySelector('.notification') || {}).textContent || ''));
    assert.equal(await p.getAttribute('.notification', 'role'), 'alert', 'gli errori sono annunciati subito');
    await compila(p, 1);
    await avanti(p, 'step-2', 'step-3');
    await compila(p, 2, { nome: 'Bimbo', nascita: unAnnoFa });
    await avanti(p, 'step-3', 'step-final');
    // bambino di un anno, una notte
    const eta = () => p.evaluate(() => [...document.querySelectorAll('.guest-summary .age')].map(e => e.textContent.trim()));
    assert.equal((await eta())[1], 'Età: 1 anno (esente)', 'prima «1 anni»');
    assert.match((await eta())[0], /^Età: \d+ anni \(soggetto a tassa\)$/);
    await p.click('.lang-flag[data-lang="en"]'); assert.equal((await eta())[1], 'Age: 1 year (exempt)');
    await p.click('.lang-flag[data-lang="de"]'); assert.equal((await eta())[1], 'Alter: 1 Jahr (befreit)');
    assert.match((await eta())[0], /^Alter: \d+ Jahre \(steuerpflichtig\)$/);
    await p.click('.lang-flag[data-lang="it"]');
    await p.click('.privacy-label');
    await p.click('#btn-procedi-pagamento');
    await p.waitForSelector('#pay-panel:not([hidden])');
    assert.equal(await p.textContent('#pay-due-sub'), 'Imposta di soggiorno · 1 notte', 'prima «1 notti»');
    await p.click('.lang-flag[data-lang="en"]'); assert.equal(await p.textContent('#pay-due-sub'), 'Tourist tax · 1 night');
    await p.click('.lang-flag[data-lang="de"]'); assert.equal(await p.textContent('#pay-due-sub'), 'Kurtaxe · 1 Nacht');
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
  // due notti: il plurale di sempre
  const y = await apri({ dominio: 'checkin.prova', stripe: STRIPE_FINTO, api: nome => (nome === 'crea-pagamento-stripe' ? { clientSecret: 'cs_secret', publishableKey: 'pk_test_x', sessionId: 'cs_test_x', totale: 3 } : undefined) });
  try {
    const p = y.page;
    await soggiornoAMano(p, { ospiti: 1, notti: 2 });
    await avanti(p, 'step-1', 'step-2');
    await compila(p, 1);
    await avanti(p, 'step-2', 'step-final');
    await p.click('.privacy-label'); await p.click('#btn-procedi-pagamento');
    await p.waitForSelector('#pay-panel:not([hidden])');
    assert.equal(await p.textContent('#pay-due-sub'), 'Imposta di soggiorno · 2 notti');
  } finally { await y.chiudi(); }
});

test('lingua: il selettore funziona anche se il browser blocca la memoria locale (Safari con i cookie bloccati, alcune app)', async () => {
  const x = await apri({ initScript: () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); } });
  try {
    const p = x.page;
    assert.equal(await p.textContent('#step-0 .step-title'), 'Verifica prenotazione');
    await p.click('.lang-flag[data-lang="de"]');
    assert.equal(await p.textContent('#step-0 .step-title'), 'Buchungsprüfung', 'prima il tocco sulla bandiera non cambiava nulla');
    assert.equal(await p.evaluate(() => document.documentElement.lang), 'de');
    await p.click('.no-booking-link'); await p.waitForSelector('#step-1.active');
    assert.equal(await p.textContent('#step-1 .step-title'), 'Allgemeine Informationen', 'la lingua scelta vale per tutta la pagina');
    await p.click('.lang-flag[data-lang="en"]');
    assert.equal(await p.textContent('#step-1 .step-title'), 'General information');
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});
