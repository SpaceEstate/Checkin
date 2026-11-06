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
const { pdfUnaFotoPerPagina, pdfA4FronteRetro } = require('./pdf-di-prova.cjs');

const DOC = path.join(__dirname, 'documenti-sintetici');
const RISULTATI = path.join(__dirname, 'risultati');
const file = n => path.join(DOC, n);
const DATI_PERSONALI = ['PROVACCIA', 'ERMENEGILDA', 'TEODORICO', 'CLOTILDE', 'BERTOLDO', 'ESEMPIO', 'CA12345XY', 'C01X00T47', 'AX1234567', 'U1A23B456C', 'PRVRNG80D59H501'];
const misure = {};
let browser;
let documentiSenzaScansione = null;       // documenti del responsabile inviati nel flusso senza scansione (flussoAMano)

// fotocamera finta di Chromium (un'immagine che si muove): serve alle prove della fotocamera con il riquadro
test.before(async () => { browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }); fs.mkdirSync(RISULTATI, { recursive: true }); });
test.after(async () => {
  if (browser) await browser.close();
  fs.writeFileSync(path.join(RISULTATI, 'tempi.json'), JSON.stringify(misure, null, 1));
});

// Apre il check-in con la scansione nello stato voluto; registra richieste, console ed errori della pagina.
async function apri({ scansione = 'attiva', hash = '', mobile = false, initScript = null, fotocamera = false } = {}) {
  const srv = await avvia({ scansione });
  const context = await browser.newContext(Object.assign(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } : { viewport: { width: 1280, height: 900 } },
    fotocamera ? { permissions: ['camera'] } : {}));
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

// 06/11/2026: il pannello della scansione si apre da solo in cima al passo (prima si sceglieva «Scansiona documento»): qui si
// aspetta solo che sia disegnato
async function scegliScansione(page, n) {
  await page.waitForSelector('#scan-pannello-' + n + ' .scan-esito', { state: 'attached', timeout: 30000 });
}
// L'esito compare togliendo l'attributo hidden; il passo dell'ospite può non essere a schermo (l'ospite è andato avanti).
async function attendiEsito(page, n, timeout = 120000) {
  await page.waitForSelector('#scan-pannello-' + n + ' .scan-esito:not([hidden])', { timeout, state: 'attached' });
  return page.$eval('#scan-pannello-' + n + ' .scan-esito', e => e.textContent);
}
// Fine della lettura: esito a schermo, avanzamento nascosto e, per i lati indicati, uno stato finale (non «In attesa…»/«Lettura in corso…»).
async function attendiFine(page, n, lati, timeout = 120000) {
  await page.waitForFunction(({ n, lati }) => {
    const p = document.getElementById('scan-pannello-' + n);
    const esito = p && p.querySelector('.scan-esito'), av = p && p.querySelector('.scan-avanzamento');
    if (!esito || esito.hidden || (av && !av.hidden)) return false;
    return lati.every(k => { const t = ((p.querySelector('[data-stato-lato="' + k + '"]') || {}).textContent || '').trim(); return t && t !== '\u00a0' && !t.endsWith('…'); });
  }, { n, lati }, { timeout });
  return page.$eval('#scan-pannello-' + n + ' .scan-esito', e => e.textContent);
}
// Esito della lettura dalla classe del riquadro (ok, parziale, errore, info). 06/11/2026, richiesta del titolare: a lettura riuscita
// non c'è più il messaggio «Dati letti dal documento: controllali.»; le prove controllano l'esito e che quel messaggio non ci sia.
const esitoTipo = (page, n) => page.$eval('#scan-pannello-' + n + ' .scan-esito', e => [...e.classList].filter(c => c !== 'scan-esito' && c !== 'senza-testo').join(' '));
async function caricaPerOspite(page, n, percorso, lato = 1, buffer = null, nome = 'foto.jpg') {
  await page.evaluate(n => { const e = document.querySelector('#scan-pannello-' + n + ' .scan-esito'); if (e) e.hidden = true; }, n);
  const sel = '#scan-pannello-' + n + ' .scan-input[data-lato="' + lato + '"]:not([capture])';
  await page.setInputFiles(sel, buffer ? { name: nome, mimeType: nome.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', buffer } : percorso);
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

// Foto «come quelle vere»: il documento sintetico piccolo e storto, su una tovaglia grigia a rami bianchi, accanto a un
// portafoglio scuro (le foto vere dei titolari erano così: 06/11/2026). Disegnata nel browser, sempre uguale (seme fisso).
async function inScena(page, percorso, { angolo = 0, scala = 0.5, seme = 1 } = {}) {
  const b64 = fs.readFileSync(percorso).toString('base64');
  const out = await page.evaluate(async ({ b64, angolo, scala, seme }) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
    const c = document.createElement('canvas'); c.width = 1500; c.height = 2000;
    const g = c.getContext('2d');
    let s = seme; const caso = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#8e9196'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#f2f2f2'; g.lineCap = 'round';
    for (let k = 0; k < 160; k++) {
      const x = caso() * c.width, y = caso() * c.height, l = 40 + caso() * 160, a = caso() * Math.PI * 2;
      g.lineWidth = 4 + caso() * 14;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.fillStyle = '#1d1a18'; g.fillRect(250, 60, 1000, 640);
    g.save(); g.translate(c.width / 2, c.height * 0.6); g.rotate(angolo * Math.PI / 180); g.scale(scala, scala);
    g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2); g.restore();
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, { b64, angolo, scala, seme });
  return Buffer.from(out, 'base64');
}

// Documento ridotto a `lato` px di lato lungo, come lo scatto ritagliato sul riquadro di una fotocamera a bassa risoluzione
async function ridotta(page, percorso, lato) {
  const b64 = fs.readFileSync(percorso).toString('base64');
  const out = await page.evaluate(async ({ b64, lato }) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
    const f = lato / Math.max(bmp.width, bmp.height), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, { b64, lato });
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

test('scansione spenta: nessun pulsante, nessun file della scansione scaricato, flusso a mano fino al salvataggio come prima', async () => {
  const r = await flussoAMano();
  assert.equal(r.elementiScansione, 0, 'nessun elemento della scansione');
  assert.equal(r.dati.ospiti.length, 3);
  assert.deepEqual(r.dati.documenti.map(d => d.lato), ['fronte', 'retro']);
  assert.ok(!r.rete.some(q => q.url.includes('/scansione/')), 'nessun file della scansione richiesto');
  assert.deepEqual(r.errori, []);
});

test('scansione «prova»: il pannello compare solo con #scansione=prova nell\'indirizzo; il lettore si scarica solo alla prima foto', async () => {
  const senza = await apri({ scansione: 'prova' });
  try { await iniziaFlusso(senza.page); assert.equal(await senza.page.locator('.scan-doc').count(), 0); assert.ok(!senza.rete.some(r => r.url.includes('/scansione/'))); }
  finally { await senza.chiudi(); }
  const con = await apri({ scansione: 'prova', hash: 'scansione=prova' });
  try {
    await iniziaFlusso(con.page);
    assert.equal(await con.page.locator('.scan-doc').count(), 3, 'un blocco per ospite');
    await scegliScansione(con.page, 1);
    assert.equal(await con.page.locator('.scan-scelta-btn, #scan-manuale-1, #scan-scansiona-1').count(), 0, 'nessuna scelta «a mano / scansione»');
    // 06/11/2026: il pannello si apre da solo, quindi il suo codice (pochi KB) si scarica con il passo; l'OCR (circa 4,5 MB) no
    assert.ok(!con.rete.some(r => /\/scansione\/vendor\/(tesseract|tesseract-core|tessdata|pdfjs)\//.test(r.url)), 'le librerie dell\'OCR (e PDF.js) si scaricano solo alla prima foto (o al primo PDF) da leggere');
  }
  finally { await con.chiudi(); }
});

test('flusso completo con la scansione: CIE del responsabile, passaporto e carta cartacea degli altri ospiti; foto degli altri mai inviate; documenti del responsabile identici a quelli senza scansione', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    // responsabile: con la scansione il riquadro del documento di sempre sale in cima; caricate le foto, i campi si compilano da soli
    await scegliScansione(x.page, 1);
    assert.equal(await x.page.locator('#scan-pannello-1 .document-section').count(), 1, 'riquadro del documento nel pannello, in cima');
    let t0 = Date.now();
    await x.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await x.page.setInputFiles('#ospite1_documento_retro', CIE.retro);
    const esito1 = await attendiFine(x.page, 1, [1, 2]);
    misure.responsabileCie = Date.now() - t0;
    assert.equal(await esitoTipo(x.page, 1), 'ok');
    assert.doesNotMatch(esito1, /Dati letti/, 'nessun messaggio a lettura riuscita');
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
    // 06/11/2026: un PDF al posto della foto HEIC (le HEIC non sono più consentite): anche PDF.js non lascia nulla nel browser
    const pdf = pdfUnaFotoPerPagina([fs.readFileSync(file('passaporto-de.jpg'))]);
    for (const f of ['passaporto-de.jpg', 'documento.pdf', 'cie-retro.jpg']) {
      if (f.endsWith('.pdf')) await caricaPerOspite(x.page, 2, null, 1, pdf, f); else await caricaPerOspite(x.page, 2, file(f));
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
    // finita la lettura non resta nessun worker (OCR e PDF.js chiusi: la loro memoria, con quella delle immagini, torna al sistema)
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
    assert.match(esito, /già compilati/i);          // 06/11/2026: testo accorciato («Già compilati con un altro valore:»)
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
    assert.equal(await esitoTipo(x.page, 3), 'ok');
    assert.doesNotMatch(e3, /Dati letti/);
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

test('documenti e foto difficili (ospite diverso dal responsabile): rotazioni, sfocatura, MRZ coperta, EXIF, PDF letto e PDF danneggiato, HEIC non consentita, foto che non è un documento', async () => {
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
      // 06/11/2026, richiesta del titolare: si caricano solo foto JPG e PNG e PDF (prima la HEIC si leggeva con heic-to)
      { nome: 'HEIC (non consentita)', f: 'passaporto-de.heic', attesi: { nome: '' }, messaggio: /non consentito/ },
      { nome: 'PDF con il passaporto', pdf: ['passaporto-de.jpg'], attesi: { cognome: 'PROVACCIA', nome: 'TEODORICO', nascita: '2010-11-10', cittadinanza: 'Germania' } },
      { nome: 'EXIF ruotata (foto del telefono)', f: 'passaporto-de-exif6.jpg', attesi: { nome: 'TEODORICO', nascita: '2010-11-10' } },
      { nome: 'PDF danneggiato', f: 'non-immagine.pdf', attesi: { cognome: '' }, messaggio: /PDF/ },
      { nome: 'foto che non è un documento', f: path.join(__dirname, '..', '..', 'public', 'images', 'cassetta', '2_cassetta_sicurezza.jpg'), attesi: { cognome: '', nome: '' }, messaggio: /Non riesco a leggere|Non riconosco/ }
    ];
    for (const c of casi) {
      await svuota();
      const t0 = Date.now();
      if (c.pdf) await caricaPerOspite(x.page, 2, null, 1, pdfUnaFotoPerPagina(c.pdf.map(f => fs.readFileSync(file(f)))), 'documento.pdf');
      else if (c.f) {
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

// 06/11/2026, richiesta del titolare: si caricano solo foto JPG e PNG e PDF, e i PDF si leggono (PDF.js, ospitato nel sito)
test('PDF: la scansione A4 del responsabile con fronte e retro si legge e resta allegata; il PDF di un altro ospite si legge; foto HEIC e WebP non consentite', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    const ACCEPT = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';
    await iniziaFlusso(x.page);
    await scegliScansione(x.page, 1);
    assert.equal(await x.page.$eval('#ospite1_documento_fronte', e => e.accept), ACCEPT, 'riquadro del responsabile: solo JPG, PNG e PDF');
    // responsabile: fronte e retro sullo stesso foglio A4 (come una scansione), nel riquadro del fronte
    const t0 = Date.now();
    await x.page.setInputFiles('#ospite1_documento_fronte', { name: 'documento.pdf', mimeType: 'application/pdf', buffer: pdfA4FronteRetro(fs.readFileSync(CIE.fronte), fs.readFileSync(CIE.retro)) });
    await attendiFine(x.page, 1, [1]);
    misure['PDF: A4 con fronte e retro'] = Date.now() - t0;
    assert.deepEqual(await valori(x.page, 1), RESPONSABILE_A_MANO);
    assert.equal(await x.page.$eval('#ospite1_documento_fronte', e => e.files[0] && e.files[0].name), 'documento.pdf', 'il PDF resta allegato per il gestore');
    // responsabile: foto HEIC o WebP non consentite (messaggio, riquadro vuoto)
    for (const [nome, mimeType] of [['foto.heic', 'image/heic'], ['foto.webp', 'image/webp']]) {
      await x.page.setInputFiles('#ospite1_documento_retro', { name: nome, mimeType, buffer: fs.readFileSync(file('passaporto-de.heic')) });
      assert.equal(await x.page.$eval('#ospite1_documento_retro', e => e.files.length), 0, nome + ' rifiutata');
      assert.match(await x.page.locator('.notification.error').innerText(), /JPG, PNG o PDF/);
    }
    // altro ospite: un PDF si legge
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await scegliScansione(x.page, 2);
    assert.equal(await x.page.$eval('#scan-pannello-2 .scan-input[data-lato="1"]', e => e.accept), ACCEPT, 'scansione: solo JPG, PNG e PDF');
    await caricaPerOspite(x.page, 2, null, 1, pdfUnaFotoPerPagina([fs.readFileSync(file('passaporto-de.jpg'))]), 'passaporto.pdf');
    await attendiEsito(x.page, 2);
    const v2 = await valori(x.page, 2);
    assert.deepEqual([v2.cognome, v2.nome, v2.nascita, v2.cittadinanza], ['PROVACCIA', 'TEODORICO', '2010-11-10', 'Germania']);
    // altro ospite: una WebP non consentita, riconosciuta dai primi byte anche con il nome .jpg
    const webp = await x.page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const b = await new Promise(r => c.toBlob(r, 'image/webp', 0.8)); return Array.from(new Uint8Array(await b.arrayBuffer())); });
    await caricaPerOspite(x.page, 2, null, 2, Buffer.from(webp), 'foto.jpg');
    await attendiFine(x.page, 2, [2]);
    assert.match(await x.page.locator('#scan-pannello-2 [data-stato-lato="2"]').innerText(), /non consentito/);
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

test('foto come quelle vere: documento piccolo e storto su una tovaglia a disegni, accanto a un portafoglio; letto in pochi secondi', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    // ospite 2: CIE, fronte girato di quasi 90° (foto in verticale) e retro storto di 4°, metà della foto
    await scegliScansione(x.page, 2);
    const fronte = await inScena(x.page, file('cie-fronte.jpg'), { angolo: 87, scala: 0.5, seme: 5 });
    const retro = await inScena(x.page, file('cie-retro.jpg'), { angolo: 4, scala: 0.5, seme: 3 });
    let t0 = Date.now();
    await caricaPerOspite(x.page, 2, null, 1, fronte);
    await caricaPerOspite(x.page, 2, null, 2, retro);
    await attendiFine(x.page, 2, [1, 2]);
    misure['scena: CIE fronte e retro'] = Date.now() - t0;
    const v2 = await valori(x.page, 2);
    assert.deepEqual([v2.cognome, v2.nome, v2.genere, v2.nascita, v2.cittadinanza, v2.luogo_nascita, v2.comune, v2.provincia],
      ['PROVACCIA', 'ERMENEGILDA', 'F', '1980-04-19', 'Italia', 'Italia', 'ROMA', 'RM']);
    // ospite 3: passaporto storto di −5°, carta spagnola capovolta (183°)
    await x.page.evaluate(() => { currentStep = 4; mostraStepCorrente(); });
    await scegliScansione(x.page, 3);
    for (const [f, op, attesi] of [['passaporto-de.jpg', { angolo: -5, scala: 0.55, seme: 9 }, ['PROVACCIA', 'TEODORICO', 'M', '2010-11-10', 'Germania']],
      ['carta-estera-es.jpg', { angolo: 183, scala: 0.45, seme: 13 }, ['ESEMPIO', 'LUCIA', 'F', '1992-07-21', 'Spagna']]]) {
      await imposta(x.page, 3, { luogo_nascita: '', cognome: '', nome: '', genere: '', nascita: '', cittadinanza: '' });
      t0 = Date.now();
      await caricaPerOspite(x.page, 3, null, 1, await inScena(x.page, file(f), op));
      await attendiEsito(x.page, 3);
      misure['scena: ' + f] = Date.now() - t0;
      const v = await valori(x.page, 3);
      assert.deepEqual([v.cognome, v.nome, v.genere, v.nascita, v.cittadinanza], attesi, f);
    }
    // in pochi secondi anche qui (prima di questa versione la sola lettura di una foto così durava decine di secondi);
    // limite largo per le macchine lente della CI: i tempi veri vanno misurati sui telefoni
    for (const k of Object.keys(misure).filter(k => k.startsWith('scena:'))) assert.ok(misure[k] < 30000, k + ': ' + misure[k] + ' ms');
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

// 06/11/2026: con lo scatto della fotocamera nella pagina (fotogramma di un video a 720p-1080p) la carta era larga 500-800 px e si
// perdevano luogo di nascita, comune e provincia. Con il documento ridotto a 520 px la lettura di prima li perdeva; ora le foto
// piccole si ingrandiscono prima della lettura.
test('foto piccola, come uno scatto a bassa risoluzione: si leggono anche luogo di nascita, comune, provincia e numero; verdi i dati confermati; solo il titolo sopra i lati', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await scegliScansione(x.page, 1);
    // prima del caricamento: solo il titolo «Documento di identità» e i due lati (niente spiegazioni, avviso, contatore)
    const visibile = sel => x.page.$eval(sel, e => getComputedStyle(e).display !== 'none' && !!e.getClientRects().length);
    assert.equal(await visibile('#scan-pannello-1 .document-title'), true);
    for (const sel of ['#scan-pannello-1 .identity-hint', '#upload-status-1']) assert.equal(await visibile(sel), false, sel + ' nascosto');
    await x.page.setInputFiles('#ospite1_documento_fronte', { name: 'fronte.jpg', mimeType: 'image/jpeg', buffer: await ridotta(x.page, CIE.fronte, 520) });
    await x.page.setInputFiles('#ospite1_documento_retro', { name: 'retro.jpg', mimeType: 'image/jpeg', buffer: await ridotta(x.page, CIE.retro, 520) });
    const esito = await attendiFine(x.page, 1, [1, 2]);
    assert.equal(await esitoTipo(x.page, 1), 'ok');
    assert.doesNotMatch(esito, /Dati letti/);
    assert.deepEqual(await valori(x.page, 1), RESPONSABILE_A_MANO);
    // verde: tipo (CIE con la MRZ valida), comune e provincia (letti esatti e confermati dall'elenco dei comuni), Stato di nascita
    for (const k of ['tipo_documento', 'comune', 'provincia', 'luogo_nascita']) {
      assert.ok(await x.page.$eval('#ospite1_' + k + '__testo', e => e.classList.contains('scan-letto')), k + ': verde');
    }
    // altri ospiti: lo stesso titolo sopra i due lati
    await x.page.evaluate(() => { currentStep = 3; mostraStepCorrente(); });
    await scegliScansione(x.page, 2);
    assert.equal((await x.page.locator('#scan-pannello-2 .scan-titolo').innerText()).trim(), '📄 Documento di identità');
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

// 06/11/2026: per capire cosa succede sul telefono del titolare (Safari), che qui non si può provare
test('diagnosi: solo con «diagnosi» nell\'indirizzo, sotto le foto misure, tempi, zone e nomi dei campi, mai i valori', async () => {
  const x = await apri({ scansione: 'attiva', hash: 'diagnosi' });
  try {
    await iniziaFlusso(x.page);
    await scegliScansione(x.page, 1);
    await x.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await x.page.setInputFiles('#ospite1_documento_retro', CIE.retro);
    await attendiFine(x.page, 1, [1, 2]);
    const d = await x.page.$eval('#scan-pannello-1 .scan-diagnosi', e => e.textContent);
    assert.match(d, /Fronte: \d+×\d+ → \d+×\d+/);
    assert.match(d, /Retro: .*MRZ: TD1 cifre 3\/3, complessiva sì/);
    assert.match(d, /stampato: cognome nome nascita luogo/);
    // nessun valore letto (quelli di almeno tre caratteri: una lettera come «F» compare in «Fronte»)
    for (const valore of Object.values(RESPONSABILE_A_MANO).concat(['19.04.1980', '1980']).filter(v => v.length >= 3)) assert.ok(!d.includes(valore), 'nessun valore letto: ' + valore);
    assert.deepEqual(await valori(x.page, 1), RESPONSABILE_A_MANO);
  } finally { await x.chiudi(); }
  const senza = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(senza.page);
    await scegliScansione(senza.page, 1);
    await senza.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await attendiFine(senza.page, 1, [1]);
    assert.equal(await senza.page.locator('.scan-diagnosi').count(), 0, 'senza «diagnosi» nell\'indirizzo niente');
  } finally { await senza.chiudi(); }
});

test('responsabile: tipo di documento riconosciuto (patente) compilato, verde; PDF danneggiato caricato per il gestore non si apre ma resta allegato', async () => {
  const x = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(x.page);
    await scegliScansione(x.page, 1);
    await x.page.setInputFiles('#ospite1_documento_fronte', file('patente-it.jpg'));
    const esito = await attendiFine(x.page, 1, [1]);
    assert.equal(await esitoTipo(x.page, 1), 'ok');
    assert.doesNotMatch(esito, /Dati letti/);
    // 06/11/2026, richiesta del titolare: niente domanda «È giusto? Sì / Scelgo io»; il tipo si compila, segnato da controllare
    // 06/11/2026: intestazione «PATENTE DI GUIDA» e campi numerati letti, il tipo è certo (verde); prima era arancione, da controllare
    assert.ok(await x.page.$eval('#ospite1_tipo_documento__testo', e => e.classList.contains('scan-letto') && e.value === 'PATENTE DI GUIDA'), 'tipo compilato, verde');
    assert.equal(await x.page.locator('#scan-pannello-1 [data-azione="tipo-si"]').count(), 0);
    const v = await valori(x.page, 1);
    assert.deepEqual([v.tipo_documento, v.luogo_rilascio, v.cognome, v.nome], ['PATENTE DI GUIDA', 'Italia', 'PROVACCIA', 'BERTOLDO']);
    // numero della patente: solo testo stampato, nessuna cifra di controllo (l'OCR può confondere 1 e L): proposto ma da verificare
    assert.match(v.numero_documento, /^U[1IL]A23B456C$/);
    assert.ok(await x.page.$eval('[name="ospite1_numero_documento"]', e => e.classList.contains('scan-verifica')), 'numero segnato da controllare');
    // un PDF danneggiato nel riquadro del gestore: la scansione dice che non si apre e lo lascia allegato (06/11/2026: i PDF si leggono)
    await x.page.setInputFiles('#ospite1_documento_retro', file('non-immagine.pdf'));
    await attendiFine(x.page, 1, [2]);
    assert.match(await x.page.locator('#scan-pannello-1 [data-stato-lato="2"]').innerText(), /PDF/);
    assert.equal(await x.page.$eval('#ospite1_documento_retro', e => e.files[0] && e.files[0].name), 'non-immagine.pdf');
  } finally { await x.chiudi(); }
});

test('responsabile: il riquadro del documento è in cima al passo; sul telefono la fotocamera con il riquadro mette la foto nel riquadro e la lettura parte da sola', async () => {
  const posto = page => page.evaluate(() => {
    const sez = document.getElementById('upload-side-1-fronte').closest('.document-section'), prima = sez.previousElementSibling;
    return { nelPannello: !!sez.closest('#scan-pannello-1'), dopoLuogoRilascio: !!(prima && prima.querySelector('#ospite1_luogo_rilascio')) };
  });
  // computer: niente fotocamera (si carica il file), riquadro in cima al pannello
  const pc = await apri({ scansione: 'attiva' });
  try {
    await iniziaFlusso(pc.page);
    await scegliScansione(pc.page, 1);
    assert.deepEqual(await posto(pc.page), { nelPannello: true, dopoLuogoRilascio: false });
    assert.equal(await pc.page.$eval('#upload-side-1-fronte .camera-group', e => getComputedStyle(e).display), 'none', 'su un computer il pulsante della fotocamera non c\'è');
    // foto arrivata nel riquadro dal percorso di sempre (file nel campo, riquadro aggiornato): la lettura parte da sola
    const b64 = fs.readFileSync(CIE.retro).toString('base64');
    await pc.page.evaluate(async b64 => {
      const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'documento_ospite_1_prova.jpg', { type: 'image/jpeg' }));
      inputDocumento(1, 'fronte').files = dt.files;
      aggiornaLabelUpload(1, 'fronte');
      aggiornaStatoDocumenti(1);
    }, b64);
    await attendiFine(pc.page, 1, [1]);
    const v = await valori(pc.page, 1);
    assert.deepEqual([v.cognome, v.nome, v.nascita, v.numero_documento], ['PROVACCIA', 'ERMENEGILDA', '1980-04-19', 'CA12345XY']);
    assert.equal(await pc.page.$eval('#ospite1_documento_fronte', e => e.files[0].name), 'documento_ospite_1_prova.jpg', 'la foto resta allegata per il gestore');
    assert.deepEqual(pc.errori, []);
  } finally { await pc.chiudi(); }
  // telefono: la fotocamera a tutto schermo con il riquadro; lo scatto va nel riquadro del fronte e si apre subito quella del retro
  const tel = await apri({ scansione: 'attiva', mobile: true, fotocamera: true });
  try {
    await iniziaFlusso(tel.page);
    await scegliScansione(tel.page, 1);
    await tel.page.click('#upload-side-1-fronte .camera-btn');
    await tel.page.waitForFunction(() => { const v = document.querySelector('.fotocamera video'); return v && v.videoWidth > 0; }, null, { timeout: 15000 });
    assert.equal(await tel.page.locator('.fotocamera-riquadro').count(), 1, 'riquadro del documento');
    await tel.page.screenshot({ path: path.join(RISULTATI, 'fotocamera-riquadro.png') });
    await tel.page.click('.fotocamera-scatta');
    await tel.page.waitForFunction(() => { const f = document.getElementById('ospite1_documento_fronte').files[0]; return f && /^documento_ospite_1_.+\.jpg$/.test(f.name); }, null, { timeout: 10000 });
    const foto = await tel.page.$eval('#ospite1_documento_fronte', e => ({ nome: e.files[0].name, byte: e.files[0].size, tipo: e.files[0].type }));
    assert.ok(foto.byte < 1024 * 1024 && foto.tipo === 'image/jpeg', 'foto JPEG sotto 1 MB, come prima: ' + JSON.stringify(foto));
    await tel.page.waitForSelector('.fotocamera video', { timeout: 5000 });       // retro: si fotografa subito anche quello
    await tel.page.click('.fotocamera-chiudi');
    assert.equal(await tel.page.locator('.fotocamera').count(), 0, 'fotocamera chiusa');
    assert.equal(await tel.page.evaluate(() => document.documentElement.classList.contains('fotocamera-aperta')), false);
    await attendiFine(tel.page, 1, [1]);            // l'immagine finta della fotocamera non è un documento: la lettura finisce lo stesso
    assert.deepEqual(tel.errori, []);
  } finally { await tel.chiudi(); }
  // il codice della scansione non si scarica: il riquadro resta al suo posto di sempre e si compila a mano
  const senza = await apri({ scansione: 'attiva' });
  try {
    await senza.context.route('**/scansione/scansione-documento.js*', r => r.abort());
    await iniziaFlusso(senza.page);
    await senza.page.waitForFunction(() => document.getElementById('scan-doc-1') && document.getElementById('scan-doc-1').hidden, null, { timeout: 15000 });
    assert.deepEqual(await posto(senza.page), { nelPannello: false, dopoLuogoRilascio: true });
    await imposta(senza.page, 1, RESPONSABILE_A_MANO);
    await senza.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await senza.page.setInputFiles('#ospite1_documento_retro', CIE.retro);
    await avanti(senza.page, '#step-3');
  } finally { await senza.chiudi(); }
});

test('campi con elenco: si scrive o si sceglie, ma vale solo una voce dell\'elenco; il comune compila la provincia (anche con la scansione spenta)', async () => {
  const x = await apri({ scansione: 'spenta' });
  try {
    await iniziaFlusso(x.page);
    const nativo = (k) => x.page.$eval('[name="ospite1_' + k + '"]', e => e.value), casella = k => '#ospite1_' + k + '__testo';
    assert.equal(await x.page.locator('#step-2 .combo').count(), 7, 'genere, cittadinanza, luogo di nascita, comune, provincia, tipo e luogo di rilascio del documento');
    // cittadinanza: «germ» e Invio
    await x.page.click(casella('cittadinanza')); await x.page.keyboard.type('germ'); await x.page.keyboard.press('Enter');
    assert.equal(await nativo('cittadinanza'), 'Germania');
    // Stato inventato: il campo resta vuoto e lo dice
    await x.page.fill(casella('luogo_rilascio'), 'Atlantide'); await x.page.click('#ospite1_cognome');
    await x.page.waitForSelector('#ospite1_luogo_rilascio__testo-errore:not([hidden])');
    assert.equal(await nativo('luogo_rilascio'), '');
    // luogo di nascita «ita» (una sola voce che inizia così) → Italia: compaiono comune e provincia
    await x.page.click(casella('luogo_nascita')); await x.page.keyboard.type('ita'); await x.page.keyboard.press('Tab');
    await x.page.waitForFunction(() => getComputedStyle(document.getElementById('comune-provincia-wrapper-1')).display !== 'none');
    assert.equal(await nativo('luogo_nascita'), 'Italia');
    // comune: si scrive e si sceglie dall'elenco; la provincia si compila da sola (e si può cambiare)
    await x.page.click(casella('comune')); await x.page.keyboard.type('gubb');
    await x.page.waitForSelector('#ospite1_comune__testo-lista li[role="option"]', { timeout: 15000 });
    await x.page.click('#ospite1_comune__testo-lista li[role="option"]');
    assert.deepEqual([await nativo('comune'), await nativo('provincia'), await x.page.$eval(casella('provincia'), e => e.value)], ['GUBBIO', 'PG', 'PG']);
    // comune inventato: non passa, e «Avanti» si ferma
    await x.page.fill(casella('comune'), 'Pippolandia'); await x.page.click('#ospite1_cognome');
    await x.page.waitForSelector('#ospite1_comune__testo-errore:not([hidden])');
    assert.equal(await nativo('comune'), '');
    await imposta(x.page, 1, { cognome: 'PROVACCIA', nome: 'ERMENEGILDA', genere: 'F', nascita: '1980-04-19', tipo_documento: "CARTA IDENTITA' ELETTRONICA", numero_documento: 'CA12345XY', luogo_rilascio: 'Italia' });
    await x.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await x.page.setInputFiles('#ospite1_documento_retro', CIE.retro);
    await x.page.click('.step.active .btn-primary');
    await x.page.waitForTimeout(500);
    assert.equal(await x.page.locator('#step-2.active').count(), 1, 'comune non valido: si resta sul passo');
    // vecchio nome scritto a mano → il comune di oggi; poi si prosegue
    await x.page.fill(casella('comune'), 'abano bagni'); await x.page.click('#ospite1_cognome');
    await x.page.waitForFunction(() => document.querySelector('[name="ospite1_comune"]').value === 'ABANO TERME');
    assert.equal(await nativo('provincia'), 'PD');
    await avanti(x.page, '#step-3');
    // valori messi dal codice (come la scansione) e cambio di lingua: la casella si aggiorna
    await imposta(x.page, 2, { genere: 'M', cittadinanza: 'Germania' });
    assert.equal(await x.page.$eval('#ospite2_genere__testo', e => e.value), 'Maschio');
    await x.page.evaluate(() => impostaLingua('en'));
    assert.deepEqual([await x.page.$eval('#ospite2_genere__testo', e => e.value), await x.page.$eval('#ospite2_cittadinanza__testo', e => e.value)], ['Male', 'Germany']);
    assert.deepEqual(x.errori, []);
  } finally { await x.chiudi(); }
});

test('tempo scaduto e lettore non scaricabile: messaggio chiaro, si continua a mano', async () => {
  // tempo di lettura simulato: 50 ms (06/11/2026: era 300 ms, ma la lettura per zone ora ci sta dentro e il limite non scattava)
  const lento = await apri({ scansione: 'attiva', initScript: () => { window.__scansioneTempi = { lettura: 50 }; } });
  try {
    await iniziaFlusso(lento.page);
    await scegliScansione(lento.page, 1);
    await lento.page.setInputFiles('#ospite1_documento_fronte', CIE.fronte);
    await lento.page.setInputFiles('#ospite1_documento_retro', CIE.retro);
    assert.match(await attendiFine(lento.page, 1, [1]), /troppo tempo/);
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
    await scegliScansione(x.page, 2);
    assert.equal((await x.page.locator('#scan-pannello-2 .scan-fotografa[data-lato="1"]').innerText()).trim(), '📷 Take a photo');
    const t0 = Date.now();
    await caricaPerOspite(x.page, 2, file('passaporto-de.jpg'));
    const esito = await attendiEsito(x.page, 2, 180000);
    misure.passaportoCpuRallentata6x = Date.now() - t0;
    assert.equal(await esitoTipo(x.page, 2), 'ok');
    assert.doesNotMatch(esito, /Data read/);
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
