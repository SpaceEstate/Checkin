// tests/browser/scansione.browser.cjs — prove della scansione dei documenti con un browser vero (Chromium + Playwright).
// Il sito è servito in locale da server-prova.cjs; le API del check-in sono finte (nessuna rete, nessun Stripe, nessun dato reale);
// i documenti sono SINTETICI (tests/browser/documenti-sintetici, dati di fantasia). L'OCR è quello vero, con i file del sito.
// Uso: node --test tests/browser/        (serve Playwright: vedi CLAUDE.md, «Prove della scansione nel browser»)
// Al termine scrive in tests/browser/risultati/ (escluso da git) il registro delle richieste di rete e i tempi misurati.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { avvia, API } = require('./server-prova.cjs');

const DOC = path.join(__dirname, 'documenti-sintetici');
const RISULTATI = path.join(__dirname, 'risultati');
const file = n => path.join(DOC, n);
const DATI_PERSONALI = ['PROVACCIA', 'ERMENEGILDA', 'TEODORICO', 'CLOTILDE', 'BERTOLDO', 'ESEMPIO', 'CA12345XY', 'C01X00T47', 'AX1234567', 'U1A23B456C', 'PRVRNG80D59H501'];
const misure = {};
let browser;
let documentiSenzaScansione = null;       // documenti del responsabile inviati nel flusso senza scansione (flussoAMano)

test.before(async () => { browser = await chromium.launch(); fs.mkdirSync(RISULTATI, { recursive: true }); });
test.after(async () => {
  if (browser) await browser.close();
  fs.writeFileSync(path.join(RISULTATI, 'tempi.json'), JSON.stringify(misure, null, 1));
});

// Apre il check-in con la scansione nello stato voluto; registra richieste, console ed errori della pagina.
async function apri({ scansione = 'attiva', hash = '', mobile = false, initScript = null } = {}) {
  const srv = await avvia({ scansione });
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } : { viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    window.__prova = { blobCreati: 0, blobRevocati: 0 };
    const c = URL.createObjectURL, r = URL.revokeObjectURL;
    URL.createObjectURL = function () { window.__prova.blobCreati++; return c.apply(this, arguments); };
    URL.revokeObjectURL = function () { window.__prova.blobRevocati++; return r.apply(this, arguments); };
  });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  const rete = [], console_ = [], errori = [];
  context.on('request', r => rete.push({ metodo: r.method(), url: r.url(), corpo: r.postData() || '' }));
  page.on('console', m => console_.push(m.text()));
  page.on('pageerror', e => errori.push(e.message));
  await context.route(API + '**', async route => {
    const nome = route.request().url().slice(API.length).split('?')[0];
    const corpo = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(await srv.api(nome, corpo)) });
  });
  await page.goto(srv.url + (hash ? '#' + hash : ''));
  return { srv, context, page, rete, console: console_, errori, chiudi: async () => { await context.close(); await srv.chiudi(); } };
}

// Verifica della prenotazione di prova (3 ospiti, famiglia) e arrivo al passo dell'ospite 1.
async function iniziaFlusso(page) {
  await page.fill('#numero-prenotazione', 'PROVA1');
  await page.click('#step-0 .btn-primary');
  await page.waitForSelector('#step-1.active');
  await page.waitForFunction(() => document.getElementById('numero-ospiti').value === '3');
  await page.selectOption('#tipo-gruppo', 'famiglia');
  await page.click('#step-1 .btn-primary');
  await page.waitForSelector('#step-2.active');
}

const valori = (page, n) => page.evaluate(n => {
  const out = {};
  for (const k of ['cognome', 'nome', 'genere', 'nascita', 'cittadinanza', 'luogo_nascita', 'comune', 'provincia', 'tipo_documento', 'numero_documento', 'luogo_rilascio']) {
    const e = document.querySelector('[name="ospite' + n + '_' + k + '"]'); if (e) out[k] = e.value;
  }
  return out;
}, n);

async function imposta(page, n, dati) {
  await page.evaluate(({ n, dati }) => {
    const ordine = ['luogo_nascita', 'comune', 'provincia', 'cognome', 'nome', 'genere', 'nascita', 'cittadinanza', 'tipo_documento', 'numero_documento', 'luogo_rilascio'];
    for (const k of ordine) {
      if (!(k in dati)) continue;
      const e = document.querySelector('[name="ospite' + n + '_' + k + '"]');
      e.value = dati[k];
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { n, dati });
}

async function scegliScansione(page, n) {
  await page.click('#scan-scansiona-' + n);
  await page.waitForSelector('#scan-pannello-' + n + ':not([hidden])');
}
// L'esito compare togliendo l'attributo hidden; il passo dell'ospite può non essere a schermo (l'ospite è andato avanti).
async function attendiEsito(page, n, timeout = 120000) {
  await page.waitForSelector('#scan-pannello-' + n + ' .scan-esito:not([hidden])', { timeout, state: 'attached' });
  return page.$eval('#scan-pannello-' + n + ' .scan-esito', e => e.textContent);
}
async function caricaPerOspite(page, n, percorso, lato = 1, buffer = null) {
  await page.evaluate(n => { const e = document.querySelector('#scan-pannello-' + n + ' .scan-esito'); if (e) e.hidden = true; }, n);
  const sel = '#scan-pannello-' + n + ' .scan-input[data-lato="' + lato + '"]:not([capture])';
  await page.setInputFiles(sel, buffer ? { name: 'foto.jpg', mimeType: 'image/jpeg', buffer } : percorso);
}
async function avanti(page, passoAtteso) {
  await page.click('.step.active .btn-primary');
  await page.waitForSelector(passoAtteso + '.active');
}
// Presa visione e «Procedi al pagamento»: si aspetta il salvataggio dei dati (su 127.0.0.1 checkin.js salta Stripe da sé e va alla
// pagina di successo in modalità di prova: comportamento già esistente).
async function paga(page, srv) {
  const prima = srv.stato.salvataggi.length;
  await page.click('label[for="privacy-presa-visione"]');      // la casella vera è nascosta sotto quella disegnata
  await page.click('#btn-procedi-pagamento');
  const limite = Date.now() + 30000;
  while (srv.stato.salvataggi.length === prima && Date.now() < limite) await new Promise(r => setTimeout(r, 100));
  assert.ok(srv.stato.salvataggi.length > prima, 'dati non salvati');
  const ultimo = srv.stato.salvataggi[srv.stato.salvataggi.length - 1];
  assert.equal(ultimo.minimizzato.ok, true, 'il server vero accetterebbe i dati (minimizzazione: ' + ultimo.minimizzato.errore + ')');
  return ultimo.ricevuto.datiPrenotazione;
}

// Trasforma una foto sintetica nel browser (rotazione, sfocatura, parti coperte, poco contrasto, qualità JPEG).
async function trasforma(page, percorso, op) {
  const b64 = fs.readFileSync(percorso).toString('base64');
  const out = await page.evaluate(async ({ b64, op }) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
    const rot = op.ruota || 0, gira = rot === 90 || rot === 270;
    const c = document.createElement('canvas'); c.width = gira ? bmp.height : bmp.width; c.height = gira ? bmp.width : bmp.height;
    const g = c.getContext('2d');
    if (op.sfoca) g.filter = 'blur(' + op.sfoca + 'px)';
    g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180); g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none';
    if (op.copri) { g.fillStyle = '#3a332d'; g.fillRect(0, c.height * (1 - op.copri), c.width, c.height * op.copri); }
    if (op.contrasto) { g.fillStyle = 'rgba(200,200,200,' + op.contrasto + ')'; g.fillRect(0, 0, c.width, c.height); }
    return c.toDataURL('image/jpeg', op.qualita || 0.85).split(',')[1];
  }, { b64, op });
  return Buffer.from(out, 'base64');
}

const CIE = { fronte: file('cie-fronte.jpg'), retro: file('cie-retro.jpg') };
const RESPONSABILE_A_MANO = { cognome: 'PROVACCIA', nome: 'ERMENEGILDA', genere: 'F', nascita: '1980-04-19', cittadinanza: 'Italia', luogo_nascita: 'Italia',
  comune: 'ROMA', provincia: 'RM', tipo_documento: "CARTA IDENTITA' ELETTRONICA", numero_documento: 'CA12345XY', luogo_rilascio: 'Italia' };
const OSPITE2_A_MANO = { cognome: 'PROVACCIA', nome: 'TEODORICO', genere: 'M', nascita: '2010-11-10', cittadinanza: 'Germania', luogo_nascita: 'Germania' };
const OSPITE3_A_MANO = { cognome: 'PROVACCIA', nome: 'CLOTILDE', genere: 'F', nascita: '2004-01-15', cittadinanza: 'Italia', luogo_nascita: 'Italia', comune: "REGGIO NELL'EMILIA", provincia: 'RE' };

// Check-in compilato tutto a mano, con la scansione spenta: è il flusso di prima. Restituisce i dati salvati e le richieste.
async function flussoAMano() {
  const x = await apri({ scansione: 'spenta' });
  try {
    await iniziaFlusso(x.page);
    const elementiScansione = await x.page.locator('.scan-doc, [id^="scan-"]').count();
    await imposta(x.page, 1, RESPONSABILE_A_MANO);
    await x.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await x.page.setInputFiles('#ospite1_documento_retro', CIE.retro);
    await avanti(x.page, '#step-3');
    await imposta(x.page, 2, OSPITE2_A_MANO);
    await avanti(x.page, '#step-4');
    await imposta(x.page, 3, OSPITE3_A_MANO);
    await avanti(x.page, '#step-final');
    const dati = await paga(x.page, x.srv);
    documentiSenzaScansione = dati.documenti.map(d => d.base64);
    return { dati, elementiScansione, rete: x.rete, errori: x.errori };
  } finally { await x.chiudi(); }
}

test('scansione spenta (valore predefinito): nessun pulsante, nessun file della scansione scaricato, flusso a mano fino al salvataggio come prima', async () => {
  const r = await flussoAMano();
  assert.equal(r.elementiScansione, 0, 'nessun elemento della scansione');
  assert.equal(r.dati.ospiti.length, 3);
  assert.deepEqual(r.dati.documenti.map(d => d.lato), ['fronte', 'retro']);
  assert.ok(!r.rete.some(q => q.url.includes('/scansione/')), 'nessun file della scansione richiesto');
  assert.deepEqual(r.errori, []);
});

test('scansione «prova»: il pulsante compare solo con #scansione=prova nell\'indirizzo', async () => {
  const senza = await apri({ scansione: 'prova' });
  try { await iniziaFlusso(senza.page); assert.equal(await senza.page.locator('.scan-doc').count(), 0); assert.ok(!senza.rete.some(r => r.url.includes('/scansione/'))); }
  finally { await senza.chiudi(); }
  const con = await apri({ scansione: 'prova', hash: 'scansione=prova' });
  try { await iniziaFlusso(con.page); assert.equal(await con.page.locator('.scan-doc').count(), 3, 'un blocco per ospite'); assert.ok(!con.rete.some(r => r.url.includes('/scansione/')), 'il codice si scarica solo quando l\'ospite sceglie la scansione'); }
  finally { await con.chiudi(); }
});

test('flusso completo con la scansione: CIE del responsabile, passaporto e carta cartacea degli altri ospiti; foto degli altri mai inviate; documenti del responsabile identici a quelli senza scansione', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    // responsabile: le foto si caricano nei riquadri di sempre, la scansione le legge senza toccarle
    await x.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await x.page.setInputFiles('#ospite1_documento_retro', CIE.retro);
    await scegliScansione(x.page, 1);
    let t0 = Date.now();
    await x.page.click('#scan-pannello-1 .scan-leggi');
    const esito1 = await attendiEsito(x.page, 1);
    misure.responsabileCie = Date.now() - t0;
    assert.match(esito1, /Dati letti dal documento/);
    assert.deepEqual(await valori(x.page, 1), RESPONSABILE_A_MANO);
    assert.deepEqual(await x.page.evaluate(() => ['fronte', 'retro'].map(l => document.getElementById('ospite1_documento_' + l).files[0].name)), ['cie-fronte.jpg', 'cie-retro.jpg'], 'file del responsabile ancora allegati');
    await avanti(x.page, '#step-3');
    // ospite 2: passaporto tedesco (lo Stato di nascita non è nella MRZ: lo sceglie l'ospite)
    await scegliScansione(x.page, 2);
    t0 = Date.now();
    await caricaPerOspite(x.page, 2, file('passaporto-de.jpg'));
    const esito2 = await attendiEsito(x.page, 2);
    misure.passaporto = Date.now() - t0;
    assert.doesNotMatch(esito2, /codice fiscale/, 'un passaporto tedesco non ha codice fiscale: nessun avviso');
    const v2 = await valori(x.page, 2);
    assert.deepEqual([v2.cognome, v2.nome, v2.genere, v2.nascita, v2.cittadinanza, v2.luogo_nascita], ['PROVACCIA', 'TEODORICO', 'M', '2010-11-10', 'Germania', '']);
    assert.equal(await x.page.$eval('#scan-pannello-2 .scan-input[data-lato="1"]:not([capture])', e => e.value), '', 'campo file svuotato subito');
    await imposta(x.page, 2, { luogo_nascita: 'Germania' });
    await avanti(x.page, '#step-4');
    // ospite 3: carta d'identità cartacea (nessuna MRZ)
    await scegliScansione(x.page, 3);
    await caricaPerOspite(x.page, 3, file('carta-cartacea-it.jpg'));
    await attendiEsito(x.page, 3);
    const v3 = await valori(x.page, 3);
    assert.deepEqual([v3.cognome, v3.nome, v3.nascita, v3.cittadinanza, v3.luogo_nascita, v3.comune, v3.provincia], ['PROVACCIA', 'CLOTILDE', '2004-01-15', 'Italia', 'Italia', "REGGIO NELL'EMILIA", 'RE']);
    await imposta(x.page, 3, { genere: 'F' });     // la carta cartacea di prova non riporta il sesso
    await avanti(x.page, '#step-final');
    const dati = await paga(x.page, x.srv);

    // 1) documenti del responsabile: identici, byte per byte, a quelli del flusso senza scansione (stessi file, stesso browser)
    if (!documentiSenzaScansione) await flussoAMano();
    assert.deepEqual(dati.documenti.map(d => d.base64), documentiSenzaScansione);
    // 2) dati anagrafici: quelli letti (e completati dall'ospite) arrivano al server come se fossero scritti a mano
    const ospiti = dati.ospiti.map(o => [o.cognome, o.nome, o.genere, o.nascita, o.cittadinanza, o.luogoNascita, o.comune || '', o.provincia || '']);
    assert.deepEqual(ospiti, [['PROVACCIA', 'ERMENEGILDA', 'F', '1980-04-19', 'Italia', 'Italia', 'ROMA', 'RM'], ['PROVACCIA', 'TEODORICO', 'M', '2010-11-10', 'Germania', 'Germania', '', ''],
      ['PROVACCIA', 'CLOTILDE', 'F', '2004-01-15', 'Italia', 'Italia', "REGGIO NELL'EMILIA", 'RE']]);
    assert.deepEqual([dati.ospiti[0].tipoDocumento, dati.ospiti[0].numeroDocumento, dati.ospiti[0].luogoRilascio], ["CARTA IDENTITA' ELETTRONICA", 'CA12345XY', 'Italia']);
    // 3) rete: nessun dominio esterno; nessuna immagine in nessuna richiesta, tranne i due documenti del responsabile nel salvataggio
    const host = new URL(x.srv.url).host;
    const esterni = x.rete.filter(r => { const u = new URL(r.url); return u.protocol !== 'data:' && u.host !== host && !r.url.startsWith(API); });
    assert.deepEqual(esterni.map(r => r.url), [], 'richieste ad altri domini');
    const salvataggio = x.rete.filter(r => r.url === API + 'salva-dati-temporanei');
    assert.equal(salvataggio.length, 1);
    const corpo = JSON.parse(salvataggio[0].corpo);
    const immagini = JSON.stringify(corpo).match(/data:image\//g) || [];
    assert.equal(immagini.length, 2, 'solo fronte e retro del responsabile');
    const senzaDocumenti = JSON.stringify(Object.assign({}, corpo, { datiPrenotazione: Object.assign({}, corpo.datiPrenotazione, { documenti: [] }) }));
    assert.ok(!/\/9j\/|iVBORw0KGgo|UklGR|data:image/.test(senzaDocumenti), 'nessun\'altra immagine nel salvataggio');
    // pezzi presi dal CENTRO dei dati delle foto degli altri ospiti (le intestazioni JPEG sono uguali per tutte le foto dello stesso codificatore)
    const pezzi = ['passaporto-de.jpg', 'carta-cartacea-it.jpg'].flatMap(f => { const b = fs.readFileSync(file(f)).toString('base64'); return [0.4, 0.6, 0.8].map(q => b.slice(Math.floor(b.length * q), Math.floor(b.length * q) + 120)); });
    for (const r of x.rete) {
      for (const pezzo of pezzi) assert.ok(!r.corpo.includes(pezzo), 'foto di un ospite in una richiesta: ' + r.url);
      if (r.url.startsWith(API) && r.url !== API + 'salva-dati-temporanei') assert.ok(!/data:image|\/9j\//.test(r.corpo), 'immagine in ' + r.url);
      if (r.metodo !== 'GET') assert.ok(r.url.startsWith(API), 'invio di dati fuori dalle API del check-in: ' + r.url);
    }
    fs.writeFileSync(path.join(RISULTATI, 'rete-flusso-completo.json'), JSON.stringify(x.rete.map(r => ({ metodo: r.metodo, url: r.url.replace(x.srv.url, '/'), byteInviati: r.corpo.length,
      immaginiNelCorpo: (r.corpo.match(/data:image\//g) || []).length })), null, 1));
    // 4) niente console con dati personali, niente archiviazione nel browser, nessun indirizzo blob: lasciato aperto
    for (const m of x.console) for (const d of DATI_PERSONALI) assert.ok(!m.includes(d), 'dato personale in console: ' + d);
  } finally { await x.chiudi(); }
});

test('archiviazione nel browser: nessun IndexedDB, localStorage solo la lingua, niente sessionStorage, Cache Storage vuota, indirizzi blob tutti revocati', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await scegliScansione(x.page, 2);
    for (const f of ['passaporto-de.jpg', 'passaporto-de.heic', 'cie-retro.jpg']) {
      await caricaPerOspite(x.page, 2, file(f));
      await attendiEsito(x.page, 2);
    }
    const stato = await x.page.evaluate(async () => ({
      idb: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [],
      local: Object.keys(localStorage), session: sessionStorage.length, cache: await caches.keys(), blob: window.__prova
    }));
    assert.deepEqual(stato.idb, []);
    assert.ok(stato.local.every(k => k === 'columbera_lingua'), 'localStorage: ' + stato.local);
    assert.equal(stato.session, 0);
    assert.deepEqual(stato.cache, []);
    assert.equal(stato.blob.blobCreati, stato.blob.blobRevocati, 'indirizzi blob: creati ' + stato.blob.blobCreati + ', revocati ' + stato.blob.blobRevocati);
    // finita la lettura non resta nessun worker (OCR e HEIC chiusi: la loro memoria, con quella delle immagini, torna al sistema)
    await x.page.waitForFunction(() => true);
    await new Promise(r => setTimeout(r, 300));
    assert.deepEqual(x.page.workers().map(w => w.url()), [], 'worker ancora attivi');
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

test('nessuna sovrascrittura: i valori già scritti diventano una scelta dell\'ospite; «Annulla» riporta i campi esattamente a prima', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await imposta(x.page, 2, { cognome: 'Rossi' });
    const testoDataPrima = await x.page.$eval('[name="ospite2_nascita"]', e => (e.closest('.date-input-wrapper') || e).querySelector('.date-text-input') ? e.closest('.date-input-wrapper').querySelector('.date-text-input').value : null);
    await scegliScansione(x.page, 2);
    await caricaPerOspite(x.page, 2, file('passaporto-de.jpg'));
    const esito = await attendiEsito(x.page, 2);
    assert.match(esito, /già compilati/);
    let v = await valori(x.page, 2);
    assert.equal(v.cognome, 'Rossi', 'il valore scritto dall\'ospite non si tocca');
    assert.equal(v.nome, 'TEODORICO');
    assert.ok(await x.page.$eval('[name="ospite2_nome"]', e => e.classList.contains('scan-letto') || e.classList.contains('scan-verifica')), 'campo letto evidenziato');
    await x.page.click('#scan-pannello-2 [data-azione="usa"]');
    assert.equal((await valori(x.page, 2)).cognome, 'PROVACCIA');
    await x.page.click('#scan-pannello-2 [data-azione="annulla"]');
    v = await valori(x.page, 2);
    assert.deepEqual(v, { cognome: 'Rossi', nome: '', genere: '', nascita: '', cittadinanza: '', luogo_nascita: '', comune: '', provincia: '' });
    const testoDataDopo = await x.page.$eval('[name="ospite2_nascita"]', e => e.closest('.date-input-wrapper') ? e.closest('.date-input-wrapper').querySelector('.date-text-input').value : null);
    assert.equal(testoDataDopo, testoDataPrima, 'anche il campo data visibile torna com\'era');
    assert.equal(await x.page.locator('#step-3 .scan-letto, #step-3 .scan-verifica').count(), 0, 'segni tolti');
  } finally { await x.chiudi(); }
});

test('ospiti isolati: i dati letti vanno sempre all\'ospite giusto; una lettura nuova interrompe quella in corso', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await scegliScansione(x.page, 2);
    await caricaPerOspite(x.page, 2, file('passaporto-de.jpg'));
    // l'ospite passa al passo successivo mentre la lettura è in corso
    await x.page.evaluate(() => { currentStep = 4; mostraStepCorrente(); });
    await attendiEsito(x.page, 2);
    assert.equal((await valori(x.page, 2)).nome, 'TEODORICO');
    assert.deepEqual(Object.values(await valori(x.page, 3)).filter(Boolean), [], 'ospite 3 intatto');
    // due letture: la seconda (ospite 3) interrompe la prima (ospite 2), che lo dice
    await scegliScansione(x.page, 3);
    await x.page.$eval('#scan-pannello-2 [data-azione="annulla"]', b => b.click());   // il passo dell'ospite 2 non è a schermo
    await caricaPerOspite(x.page, 2, file('carta-estera-es.jpg'));
    await caricaPerOspite(x.page, 3, file('carta-cartacea-it.jpg'));
    const e2 = await attendiEsito(x.page, 2), e3 = await attendiEsito(x.page, 3);
    assert.match(e2, /interrotta/);
    assert.match(e3, /Dati letti/);
    assert.equal((await valori(x.page, 2)).cognome, '', 'nessun dato della carta spagnola nell\'ospite 2');
    assert.equal((await valori(x.page, 3)).nome, 'CLOTILDE');
  } finally { await x.chiudi(); }
});

test('stesso ospite, due lati scelti uno dopo l\'altro: il secondo aspetta il primo e i dati si uniscono (CIE retro + fronte)', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await scegliScansione(x.page, 2);
    await caricaPerOspite(x.page, 2, CIE.retro, 1);
    await caricaPerOspite(x.page, 2, CIE.fronte, 2);       // subito, mentre il primo lato è ancora in lettura
    const esito = await attendiEsito(x.page, 2);
    assert.doesNotMatch(esito, /interrotta/);
    const v = await valori(x.page, 2);
    assert.deepEqual([v.cognome, v.nome, v.genere, v.nascita, v.cittadinanza, v.luogo_nascita, v.comune, v.provincia], ['PROVACCIA', 'ERMENEGILDA', 'F', '1980-04-19', 'Italia', 'Italia', 'ROMA', 'RM']);
    for (const k of [1, 2]) assert.match(await x.page.$eval('#scan-pannello-2 [data-stato-lato="' + k + '"]', e => e.textContent), /Letto/);
    assert.equal(v.numero_documento, undefined, 'nessun dato del documento per un ospite diverso dal responsabile');
  } finally { await x.chiudi(); }
});

test('documenti e foto difficili (ospite diverso dal responsabile): rotazioni, sfocatura, MRZ coperta, HEIC, EXIF, PDF, foto che non è un documento', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await scegliScansione(x.page, 2);
    const svuota = () => imposta(x.page, 2, { luogo_nascita: '', cognome: '', nome: '', genere: '', nascita: '', cittadinanza: '' });
    const casi = [
      { nome: 'ruotata 90°', op: { ruota: 90 }, attesi: { cognome: 'PROVACCIA', nome: 'TEODORICO', nascita: '2010-11-10', cittadinanza: 'Germania' } },
      { nome: 'ruotata 180°', op: { ruota: 180 }, attesi: { cognome: 'PROVACCIA', nascita: '2010-11-10' } },
      { nome: 'poco contrasto', op: { contrasto: 0.55 }, attesi: { nome: 'TEODORICO', nascita: '2010-11-10' } },
      { nome: 'JPEG molto compresso', op: { qualita: 0.3 }, attesi: { nome: 'TEODORICO', nascita: '2010-11-10' } },
      { nome: 'MRZ coperta (solo testo stampato)', op: { copri: 0.25 }, attesi: { cognome: 'PROVACCIA', nome: 'TEODORICO', nascita: '2010-11-10', cittadinanza: '' } },
      { nome: 'sfocata (leggera)', op: { sfoca: 3 }, attesi: { cognome: 'PROVACCIA', nascita: '2010-11-10' } },
      { nome: 'sfocata (molto)', op: { sfoca: 8 }, attesi: { cognome: '' }, messaggio: /sfocata/ },
      { nome: 'carta d\'identità spagnola', f: 'carta-estera-es.jpg', attesi: { cognome: 'ESEMPIO', nome: 'LUCIA', genere: 'F', nascita: '1992-07-21', cittadinanza: 'Spagna' } },
      { nome: 'patente', f: 'patente-it.jpg', attesi: { cognome: 'PROVACCIA', nome: 'BERTOLDO', nascita: '1975-03-05', genere: '', cittadinanza: '', luogo_nascita: 'Italia', comune: 'MILANO', provincia: 'MI' } },
      { nome: 'HEIC', f: 'passaporto-de.heic', attesi: { nome: 'TEODORICO', nascita: '2010-11-10' } },
      { nome: 'EXIF ruotata (foto del telefono)', f: 'passaporto-de-exif6.jpg', attesi: { nome: 'TEODORICO', nascita: '2010-11-10' } },
      { nome: 'PDF', f: 'non-immagine.pdf', attesi: { cognome: '' }, messaggio: /PDF/ },
      { nome: 'foto che non è un documento', f: path.join(__dirname, '..', '..', 'public', 'images', 'cassetta', '2_cassetta_sicurezza.jpg'), attesi: { cognome: '', nome: '' }, messaggio: /Non riesco a leggere|Non riconosco/ }
    ];
    for (const c of casi) {
      await svuota();
      const t0 = Date.now();
      if (c.f) {
        const p = path.isAbsolute(c.f) ? c.f : file(c.f);
        const mime = p.endsWith('.heic') ? 'image/heic' : p.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        await x.page.evaluate(() => { const e = document.querySelector('#scan-pannello-2 .scan-esito'); if (e) e.hidden = true; });
        await x.page.setInputFiles('#scan-pannello-2 .scan-input[data-lato="1"]:not([capture])', { name: path.basename(p), mimeType: mime, buffer: fs.readFileSync(p) });
      } else await caricaPerOspite(x.page, 2, null, 1, await trasforma(x.page, file('passaporto-de.jpg'), c.op));
      const esito = await attendiEsito(x.page, 2);
      misure['difficile: ' + c.nome] = Date.now() - t0;
      const v = await valori(x.page, 2);
      for (const [k, atteso] of Object.entries(c.attesi)) assert.equal(v[k], atteso, c.nome + ': ' + k);
      if (c.messaggio) assert.match(esito, c.messaggio, c.nome);
    }
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

test('responsabile: tipo di documento suggerito (patente) confermato con un tocco; PDF caricato per il gestore non si legge ma resta allegato', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await x.page.setInputFiles('#ospite1_documento_fronte', file('patente-it.jpg'));
    await scegliScansione(x.page, 1);
    await x.page.click('#scan-pannello-1 .scan-leggi');
    const esito = await attendiEsito(x.page, 1);
    assert.match(esito, /PATENTE DI GUIDA/);
    assert.equal((await valori(x.page, 1)).tipo_documento, '', 'solo suggerito: il campo resta vuoto finché l\'ospite non conferma');
    await x.page.click('#scan-pannello-1 [data-azione="tipo-si"]');
    const v = await valori(x.page, 1);
    assert.deepEqual([v.tipo_documento, v.luogo_rilascio, v.cognome, v.nome], ['PATENTE DI GUIDA', 'Italia', 'PROVACCIA', 'BERTOLDO']);
    // numero della patente: solo testo stampato, nessuna cifra di controllo (l'OCR può confondere 1 e L): proposto ma da verificare
    assert.match(v.numero_documento, /^U[1IL]A23B456C$/);
    assert.ok(await x.page.$eval('[name="ospite1_numero_documento"]', e => e.classList.contains('scan-verifica')), 'numero segnato da controllare');
    // un PDF nel riquadro del gestore: la scansione lo dice e non lo tocca
    await x.page.setInputFiles('#ospite1_documento_retro', file('non-immagine.pdf'));
    await x.page.click('#scan-pannello-1 .scan-leggi');
    await attendiEsito(x.page, 1);
    assert.match(await x.page.locator('#scan-pannello-1 [data-stato-lato="2"]').innerText(), /PDF/);
    assert.equal(await x.page.$eval('#ospite1_documento_retro', e => e.files[0] && e.files[0].name), 'non-immagine.pdf');
  } finally { await x.chiudi(); }
});

test('tempo scaduto e lettore non scaricabile: messaggio chiaro, si continua a mano', async () => {
  const lento = await apri({ scansione: 'attiva', initScript: () => { window.__scansioneTempi = { lettura: 300 }; } });
  try {
    await iniziaFlusso(lento.page);
    await scegliScansione(lento.page, 1);
    await lento.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await lento.page.setInputFiles('#ospite1_documento_retro', CIE.retro);
    await lento.page.click('#scan-pannello-1 .scan-leggi');
    assert.match(await attendiEsito(lento.page, 1), /troppo tempo/);
    await imposta(lento.page, 1, RESPONSABILE_A_MANO);
    await avanti(lento.page, '#step-3');        // il check-in prosegue a mano
  } finally { await lento.chiudi(); }
  const offline = await apri({ scansione: 'attiva' });
  try {
    await offline.context.route('**/scansione/vendor/tesseract/**', r => r.abort());
    await iniziaFlusso(offline.page);
    await offline.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await scegliScansione(offline.page, 2);
    await caricaPerOspite(offline.page, 2, file('passaporto-de.jpg'));
    assert.match(await attendiEsito(offline.page, 2), /connessione/);
    await imposta(offline.page, 2, OSPITE2_A_MANO);
    await avanti(offline.page, '#step-4');
  } finally { await offline.chiudi(); }
});

test('schermo stretto, CPU della pagina rallentata 6 volte (il worker dell\'OCR non è rallentato: i tempi veri vanno misurati sui telefoni), testi in inglese', async () => {
  const x = await apri({ scansione: 'attiva', mobile: true, initScript: () => { try { localStorage.setItem('columbera_lingua', 'en'); } catch (e) { /* niente */ } } });
  try {
    const cdp = await x.context.newCDPSession(x.page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await iniziaFlusso(x.page);
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    assert.equal((await x.page.locator('#scan-scansiona-2').innerText()).trim(), '📷 Scan document');
    await scegliScansione(x.page, 2);
    const t0 = Date.now();
    await caricaPerOspite(x.page, 2, file('passaporto-de.jpg'));
    const esito = await attendiEsito(x.page, 2, 180000);
    misure.passaportoCpuRallentata6x = Date.now() - t0;
    assert.match(esito, /Data read from the document/);
    assert.equal((await valori(x.page, 2)).nome, 'TEODORICO');
    const larghezza = await x.page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(larghezza <= 390, 'nessuno scorrimento orizzontale (' + larghezza + ' px)');
    await x.page.screenshot({ path: path.join(RISULTATI, 'telefono-ospite2.png'), fullPage: false });
  } finally { await x.chiudi(); }
});

test('motore senza WebAssembly SIMD (iPhone e Android datati): si usa l\'altro file del motore e la lettura funziona', async () => {
  // il browser «non supporta» SIMD: la prova di WebAssembly.validate fallisce, come su iOS precedente alla 16.4
  const x = await apri({ scansione: 'attiva', initScript: () => { const v = WebAssembly.validate; WebAssembly.validate = function (b) { const u = new Uint8Array(b); return u.length < 64 && u.includes(253) ? false : v.apply(this, arguments); }; } });
  try {
    await iniziaFlusso(x.page);
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await scegliScansione(x.page, 2);
    const t0 = Date.now();
    await caricaPerOspite(x.page, 2, file('passaporto-de.jpg'));
    await attendiEsito(x.page, 2);
    misure.passaportoSenzaSimd = Date.now() - t0;
    assert.equal((await valori(x.page, 2)).nome, 'TEODORICO');
    const motori = x.rete.filter(r => r.url.includes('/tesseract-core/')).map(r => path.basename(new URL(r.url).pathname));
    assert.deepEqual(motori, ['tesseract-core-lstm.wasm.js']);
  } finally { await x.chiudi(); }
});
