// scansione/scansione-documento.js — scansione FACOLTATIVA del documento nel browser dell'ospite (docs/scansione-documenti.md).
//
// Si scarica solo quando l'ospite sceglie «Scansiona documento» (checkin.js → sceltaCompilazione). Tutto avviene qui, sul
// dispositivo: l'immagine non viene mai inviata, salvata o copiata altrove. Regole:
//  - ospiti diversi dal responsabile: la foto serve solo a leggere i dati. Si decodifica in memoria, si legge, e si scarta:
//    campo file svuotato subito, bitmap chiusa, canvas azzerati, worker dell'OCR chiuso a fine lettura (la sua memoria,
//    compresa quella che ha contenuto l'immagine, torna al sistema). Nessun indirizzo blob: tranne il ripiego per i browser
//    vecchi, revocato appena l'immagine è decodificata. Nessuna anteprima, nessuna archiviazione, nessuna console.
//  - responsabile: si leggono le foto già allegate nei riquadri «Documento di identità» SENZA toccarle: i file restano nei
//    loro campi e partono per il gestore come prima (raccogliDatiPrenotazioneConCompressione in checkin.js, invariata).
//  - si compilano solo i campi vuoti dell'ospite giusto; ogni ospite ha il suo stato; «Annulla la compilazione» ripristina
//    esattamente i valori di prima. La conferma finale resta dell'ospite. Se qualcosa non va, si continua a mano.
import * as L from './lettura-documento.js?v=20261106a';
import * as I from './immagine.js?v=20261106a';

const VENDOR = new URL('./vendor/', import.meta.url);
const TEMPI = Object.assign({ preparazione: 60000, lettura: 45000 }, (typeof window !== 'undefined' && window.__scansioneTempi) || {});
const LATO_MAX = 2000;            // lato lungo dell'immagine di lavoro (px)
const LATO_PRIMA_LETTURA = 1600;  // lato lungo per la prima lettura (testo e posizione della MRZ)
const MRZ_LETTERE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
const MINIMO_PASSAGGIO = Math.min(3000, TEMPI.lettura);   // tempo minimo concesso a un passaggio dell'OCR
const LATO_ANALISI = 1400;        // lato lungo della copia piccola su cui si cercano le righe e la MRZ (senza OCR)
const ALTEZZA_MRZ = 40;           // altezza delle lettere nel ritaglio della MRZ (px)
const ALTEZZA_TESTO = 26;         // altezza delle lettere nel ritaglio del testo stampato (px)
const PARAMETRI_MRZ = { tessedit_char_whitelist: MRZ_LETTERE, tessedit_pageseg_mode: '6' };

let ctx = null;                  // funzioni e dati di checkin.js: t, stati, province, numeroOspiti(), inputDocumento…
const ospiti = new Map();        // numero dell'ospite → stato isolato
let lavoro = null;               // lettura in corso (una sola alla volta): { n, annullato, worker }
let linguaAgganciata = false;

const errore = codice => Object.assign(new Error(codice), { codice });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- Interfaccia pubblica (usata da checkin.js) ----

export function apri(n, contesto) {
  ctx = contesto;
  if (!linguaAgganciata && ctx.onCambioLingua) {
    ctx.onCambioLingua(() => {
      for (const s of ospiti.values()) {
        for (const [k, v] of Object.entries(s.statoLati)) if (v) statoLato(s, k, v.chiave, v.params);
        if (s.esito) mostraEsito(s);
      }
    });
    linguaAgganciata = true;
  }
  const s = statoOspite(n);
  if (!s.pannello) return;
  if (!s.disegnato) disegnaPannello(s);
  s.pannello.hidden = false;
  if (n === 1) portaSuDocumento(s);
  // elenco dei comuni (campi-elenco.js): serve a portare il comune letto al nome giusto
  if (window.ElencoComuni) window.ElencoComuni.carica();
}

export function chiudi(n) {
  const s = ospiti.get(n);
  if (lavoro && lavoro.n === n) interrompi(false);
  if (s && n === 1) rimettiDocumento(s);
  if (s && s.pannello) s.pannello.hidden = true;
}

// ---- Responsabile: riquadro del documento in cima e lettura automatica ----
// Il riquadro «Documento di identità» del responsabile (proprio quello, non una copia: stessi campi file, stessa fotocamera, stesse
// funzioni di checkin.js per caricamento e invio) sale in cima al passo, nel pannello: prima si caricano le foto, poi i campi si
// compilano da soli. chiudi() lo rimette esattamente al suo posto.
function sezioneDocumento() {
  const fronte = document.getElementById('upload-side-1-fronte');
  return fronte && fronte.closest ? fronte.closest('.document-section') : null;
}

function portaSuDocumento(s) {
  const sezione = sezioneDocumento();
  if (!sezione || !s.pannello) return;
  if (!s.postoDocumento) s.postoDocumento = { padre: sezione.parentNode, dopo: sezione.nextSibling };
  if (s.pannello.firstChild !== sezione) s.pannello.insertBefore(sezione, s.pannello.firstChild);
  sezione.classList.add('scan-documento-in-alto');
  osservaCaricamenti(s);
}

function rimettiDocumento(s) {
  smettiDiOsservare(s);
  const sezione = sezioneDocumento(), posto = s.postoDocumento;
  if (!sezione || !posto) return;
  if (posto.dopo && posto.dopo.parentNode === posto.padre) posto.padre.insertBefore(sezione, posto.dopo);
  else posto.padre.appendChild(sezione);
  sezione.classList.remove('scan-documento-in-alto');
}

// Appena un lato risulta caricato (checkin.js segna il riquadro come «completo», sia per un file sia per una foto della sua
// fotocamera) si legge quel lato. Per riconoscere un file nuovo basta nome, dimensione e data: nessun altro riferimento al file.
const chiaveFile = f => f ? [f.name, f.size, f.lastModified].join('|') : '';
function osservaCaricamenti(s) {
  if (s.osservatore || typeof MutationObserver !== 'function') return;
  s.lettiResponsabile = s.lettiResponsabile || {};
  const controlla = () => {
    const nuovi = [];
    for (const [k, lato] of [[1, 'fronte'], [2, 'retro']]) {
      const input = ctx.inputDocumento(1, lato), f = input && input.files && input.files[0];
      const chiave = chiaveFile(f);
      if (f && s.lettiResponsabile[k] !== chiave) { s.lettiResponsabile[k] = chiave; nuovi.push({ k, file: f }); }
      if (!f) s.lettiResponsabile[k] = '';
    }
    if (nuovi.length) esegui(s, nuovi);
  };
  s.osservatore = new MutationObserver(controlla);
  for (const lato of ['fronte', 'retro']) {
    const riquadro = document.getElementById('upload-side-1-' + lato);
    if (riquadro) s.osservatore.observe(riquadro, { attributes: true, attributeFilter: ['class'] });
  }
  controlla();     // foto già caricate prima di scegliere la scansione
}

function smettiDiOsservare(s) {
  if (s.osservatore) { s.osservatore.disconnect(); s.osservatore = null; }
}

function statoOspite(n) {
  let s = ospiti.get(n);
  if (!s) {
    s = { n, pannello: null, disegnato: false, letture: {}, istantanea: null, scritti: new Map(), esito: null, statoLati: {} };
    ospiti.set(n, s);
  }
  s.pannello = document.getElementById('scan-pannello-' + n);
  return s;
}

// ---- Pannello ----

function disegnaPannello(s) {
  const n = s.n, responsabile = n === 1;
  // sul telefono «Fotografa» apre la fotocamera con il riquadro del documento (fotocamera.js); su un computer si carica un file
  const fotocamera = !!(window.FotocameraDocumento && window.FotocameraDocumento.disponibile());
  const lato = k => `
        <div class="scan-lato" data-lato="${k}">
          <div class="scan-lato-testa"><span class="scan-lato-numero">${k}</span><span data-i18n="scan.lato${k}">${esc(ctx.t('scan.lato' + k))}</span></div>
          <div class="scan-lato-azioni">
            ${fotocamera ? `<button type="button" class="scan-btn scan-fotografa" data-lato="${k}" data-i18n="scan.fotografa">${esc(ctx.t('scan.fotografa'))}</button>` : ''}
            <div class="scan-file"><span class="scan-btn${fotocamera ? ' scan-btn-chiaro' : ''}" data-i18n="scan.carica">${esc(ctx.t('scan.carica'))}</span><input type="file" class="scan-input" accept="image/*" data-lato="${k}" aria-label="${esc(ctx.t('scan.carica'))}"></div>
          </div>
          <p class="scan-lato-stato" data-stato-lato="${k}">&nbsp;</p>
        </div>`;
  s.pannello.innerHTML = `
      ${responsabile
        ? `<p class="scan-lato-stato" data-stato-lato="1" data-prefisso="guest.latoFronte">&nbsp;</p>
      <p class="scan-lato-stato" data-stato-lato="2" data-prefisso="guest.latoRetro">&nbsp;</p>`
        : `<div class="scan-lati">${lato(1)}${lato(2)}</div>`}
      <div class="scan-avanzamento" hidden>
        <div class="scan-barra" aria-hidden="true"><i></i></div>
        <p class="scan-avanzamento-testo" role="status">&nbsp;</p>
        <button type="button" class="scan-interrompi" data-i18n="scan.interrompi">${esc(ctx.t('scan.interrompi'))}</button>
      </div>
      <div class="scan-esito" hidden></div>`;
  s.disegnato = true;
  s.pannello.classList.toggle('scan-responsabile', responsabile);
  s.pannello.querySelectorAll('.scan-input').forEach(inp => inp.addEventListener('change', () => fotoScelta(s, inp)));
  s.pannello.querySelectorAll('.scan-fotografa').forEach(b => b.addEventListener('click', () => fotografa(s, b.getAttribute('data-lato') === '2' ? 2 : 1)));
  s.pannello.querySelector('.scan-interrompi').addEventListener('click', () => interrompi(true));
}

// Testo di un elemento SENZA aggiungere nodi alla pagina: checkin.js osserva il modulo (MutationObserver sui nodi aggiunti)
// e a ogni nodo nuovo ripassa i campi data; aggiornare il valore del nodo di testo già presente non fa scattare nulla.
function scrivi(el, testo) {
  if (!el) return;
  if (el.firstChild && el.firstChild.nodeType === 3 && !el.firstChild.nextSibling) el.firstChild.nodeValue = testo;
  else el.textContent = testo;
}

function avanzamento(s, chiave, quota) {
  const box = s.pannello && s.pannello.querySelector('.scan-avanzamento');
  if (!box) return;
  box.hidden = false;
  if (chiave) scrivi(box.querySelector('.scan-avanzamento-testo'), ctx.t(chiave));
  if (quota != null) box.querySelector('.scan-barra i').style.width = Math.round(Math.max(0.03, Math.min(1, quota)) * 100) + '%';
}
function fineAvanzamento(s) {
  const box = s.pannello && s.pannello.querySelector('.scan-avanzamento');
  if (box) box.hidden = true;
}
function statoLato(s, k, chiave, params) {
  s.statoLati[k] = chiave ? { chiave, params } : null;
  const el = s.pannello && s.pannello.querySelector('[data-stato-lato="' + k + '"]');
  if (!el) return;
  const prefisso = el.getAttribute('data-prefisso');    // responsabile: «Fronte: …», «Retro: …»
  scrivi(el, chiave ? (prefisso ? ctx.t(prefisso) + ': ' : '') + ctx.t(chiave, params) : '\u00a0');
}
function avvisoPannello(s, chiave, tipo) {
  s.esito = { messaggio: chiave, tipo: tipo || 'errore', conflitti: [] };
  mostraEsito(s);
}

// ---- Scelta delle foto ----

// Altri ospiti: la foto arriva dal campo file del pannello. Il campo si svuota SUBITO (nessun riferimento al file resta nella
// pagina) e il file viene letto solo in memoria.
function fotoScelta(s, input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const k = input.getAttribute('data-lato') === '2' ? 2 : 1;
  esegui(s, [{ k, file }]);
}

// Altri ospiti, «Fotografa»: fotocamera con il riquadro. Lo scatto (una tela già ritagliata sul documento) va alla lettura in
// memoria e si azzera appena letto: nessun file, nessun invio.
function fotografa(s, k) {
  window.FotocameraDocumento.apri({
    titolo: ctx.t(k === 2 ? 'scan.fotoRetro' : 'scan.fotoFronte'),
    onFoto: tela => esegui(s, [{ k, tela }]),
    onErrore: () => statoLato(s, k, 'scan.fotocameraNonDisponibile')
  });
}

// ---- Lettura (una alla volta) ----

// Interrompe la lettura in corso (pulsante «Interrompi», un'altra lettura che la sostituisce, uscita dalla pagina).
export function interrompi(avvisa) {
  const l = lavoro;
  if (!l) return;
  l.annullato = true;
  lavoro = null;
  for (const voce of l.coda || []) { if (voce.tela) azzera(voce.tela); voce.file = null; voce.tela = null; }      // anche le foto in coda
  l.coda = [];
  chiudiWorker(l);
  const s = ospiti.get(l.n);
  if (s) {
    fineAvanzamento(s);
    for (const [k, v] of Object.entries(s.statoLati)) if (v && (v.chiave === 'scan.inLettura' || v.chiave === 'scan.inAttesa')) statoLato(s, k, null);
    if (avvisa) avvisoPannello(s, 'scan.interrotta', 'info');
  }
}

function chiudiWorker(l) {
  const w = l && l.worker;
  if (l) l.worker = null;
  if (w) { try { w.terminate(); } catch (e) { /* già chiuso */ } }
}

async function esegui(s, elenco) {
  // stesso ospite con una lettura già in corso (per esempio il secondo lato scelto subito dopo il primo): la foto va in coda
  if (lavoro && lavoro.n === s.n && !lavoro.annullato) {
    for (const voce of elenco) {
      lavoro.coda = lavoro.coda.filter(x => x.k !== voce.k);     // un lato in coda due volte: vale l'ultima foto
      lavoro.coda.push(voce);
      delete s.letture[voce.k];
      statoLato(s, voce.k, 'scan.inAttesa');
    }
    return;
  }
  if (lavoro) interrompi(true);                  // un altro ospite: una sola lettura alla volta, la nuova sostituisce la precedente
  const l = { n: s.n, annullato: false, worker: null, coda: elenco.slice() };
  lavoro = l;
  s.esito = null;
  const esitoBox = s.pannello.querySelector('.scan-esito');
  if (esitoBox) esitoBox.hidden = true;
  const errori = [];
  let fatti = 0;
  try {
    avanzamento(s, 'scan.preparazione', 0.02);
    // una foto nuova sostituisce sempre la lettura precedente dello stesso lato (anche se la nuova non si legge)
    for (const voce of l.coda) { delete s.letture[voce.k]; statoLato(s, voce.k, 'scan.inAttesa'); }
    while (l.coda.length) {
      const voce = l.coda.shift(), base = fatti;
      statoLato(s, voce.k, 'scan.inLettura');
      try {
        const lettura = await leggiFile(l, voce.tela || voce.file, q => avanzamento(s, null, (base + q) / (base + 1 + l.coda.length)));
        if (l.annullato) return;
        s.letture[voce.k] = lettura;
        statoLato(s, voce.k, lettura.vuota ? (lettura.sfocata ? 'scan.latoSfocato' : 'scan.latoNonLetto') : 'scan.latoLetto');
      } catch (e) {
        if (l.annullato) return;
        const codice = (e && e.codice) || 'errore';
        errori.push(codice);
        statoLato(s, voce.k, 'scan.lato.' + (['pdf', 'formato', 'heic', 'timeout', 'offline'].includes(codice) ? codice : 'errore'));
        if (codice === 'timeout' || codice === 'offline') { for (const resto of l.coda) { if (resto.tela) azzera(resto.tela); resto.file = null; resto.tela = null; statoLato(s, resto.k, null); } l.coda = []; }
      } finally {
        if (voce.tela) azzera(voce.tela);       // nessun riferimento all'immagine dopo la lettura
        voce.file = null; voce.tela = null;
        fatti++;
      }
    }
  } finally {
    chiudiWorker(l);                            // memoria dell'OCR (e dell'immagine) restituita subito
    if (lavoro === l) lavoro = null;
    fineAvanzamento(s);
  }
  if (l.annullato) return;
  concludi(s, errori);
}

async function leggiFile(l, file, quota) {
  const immagine = typeof HTMLCanvasElement !== 'undefined' && file instanceof HTMLCanvasElement
    ? { sorgente: file, w: file.width, h: file.height, rotazione: 0, chiudi() {} }      // dalla fotocamera: già un'immagine
    : await decodifica(file);
  if (l.annullato) { immagine.chiudi(); throw errore('annullato'); }
  let pagina = null;
  try {
    pagina = preparaPagina(immagine);
  } finally {
    immagine.chiudi();
  }
  const inizio = Date.now();
  const resto = () => TEMPI.lettura - (Date.now() - inizio);
  try {
    const sfocata = I.nitidezza(pagina.g, pagina.w, pagina.h) < 18;
    if (!l.worker) l.worker = await avviaWorker(l, q => quota(0.05 + 0.25 * q));
    if (l.annullato) throw errore('annullato');
    quota(0.35);
    // 1) righe di testo e MRZ cercate su una copia piccola, senza OCR (pochi decimi di secondo): l'OCR leggerà solo quelle
    //    zone, ritagliate dritte, e non la tovaglia, il portafoglio o i disegni intorno al documento
    const f = Math.min(1, LATO_ANALISI / Math.max(pagina.w, pagina.h));
    const pw = Math.max(1, Math.round(pagina.w * f)), ph = Math.max(1, Math.round(pagina.h * f));
    const piccola = I.riduci(pagina.g, pagina.w, pagina.h, pw, ph);
    const an = I.analizzaPagina(piccola, pw, ph);
    piccola.fill(0);
    const scala = pagina.w / pw;
    let mrz = null, stampato = null;
    if (an.mrz) mrz = await leggiZonaMrz(l, pagina, an.mrz, scala, resto);
    if (l.annullato) throw errore('annullato');
    quota(0.6);
    // 2) testo stampato: serve se non c'è una MRZ buona, e sul passaporto per il luogo di nascita (la MRZ non lo contiene)
    if (an.testo && (!mrz || mrz.formato === 'TD3' || mrz.verificate < 2) && resto() > MINIMO_PASSAGGIO) {
      stampato = await leggiZonaTesto(l, pagina, an.testo, scala, resto);
      if (l.annullato) throw errore('annullato');
    }
    quota(0.85);
    // 3) nessuna riga riconoscibile (foto piccola, sfocata o molto storta): lettura dell'immagine intera, come prima. Non se
    //    nella foto non c'è quasi nessuna lettera in riga (non è un documento): si risponde subito invece che dopo 10-15 s
    if (!mrz && punteggioStampato(stampato) === 0 && an.lettere >= 12 && resto() > 6000) {
      const intera = await leggiIntera(l, pagina, resto, q => quota(0.85 + 0.1 * q));
      if (intera.mrz) mrz = intera.mrz;
      if (punteggioStampato(intera.stampato) > punteggioStampato(stampato)) stampato = intera.stampato;
    }
    const vuota = punteggioLettura({ mrz, stampato }) === 0;
    return { mrz, stampato, sfocata, vuota };
  } finally {
    pagina.g.fill(0);
  }
}

const punteggioStampato = st => st ? ['cognome', 'nome', 'nascita', 'numero', 'luogo'].filter(k => st[k]).length : 0;

// MRZ: fascia ritagliata dritta e in bianco e nero; i «<» si riconoscono dalla forma, le altre lettere le legge l'OCR (tre
// letture della stessa fascia preparata in modo diverso, unite con le cifre di controllo: lettura-documento.js, fondiMrz).
async function leggiZonaMrz(l, pagina, zm, scala, resto) {
  const zona = { cx: zm.zona.cx * scala, cy: zm.zona.cy * scala, lungo: zm.zona.lungo * scala, traverso: zm.zona.traverso * scala, angolo: zm.zona.angolo };
  const fattore = Math.max(0.5, Math.min(4, ALTEZZA_MRZ / (zm.s * scala)));
  if (zona.lungo * fattore * zona.traverso * fattore > 6e6) return null;
  const prepara = crop => { const bin = I.sauvola(crop.g, crop.w, crop.h, (ALTEZZA_MRZ * 2) | 1, 0.2); return { crop, bin, gl: I.glifiMrz(bin, crop.w, crop.h, ALTEZZA_MRZ) }; };
  let x = prepara(I.estrai(pagina.g, pagina.w, pagina.h, zona, fattore));
  if (x.gl.capovolti > x.gl.chevron) x = prepara(I.ruota180(x.crop));      // MRZ sottosopra: i «<» sono girati
  const { crop, bin, gl } = x, oggi = Date.now(), grezze = [];
  try {
    if (gl.chevron >= 3) {
      const candidati = [];
      for (const variante of ['pulita', 'senzaChevron', 'grigio']) {
        if (candidati.length && resto() < MINIMO_PASSAGGIO) break;
        const img = variante === 'grigio' ? I.distendi(crop.g) : I.soloGlifi(bin, crop.w, crop.h, gl.lab, gl.righe, variante === 'senzaChevron');
        const d = await ocr(l, img, crop.w, crop.h, PARAMETRI_MRZ, resto);
        img.fill(0);
        grezze.push(righeDaRisultato(d).map(r => r.testo));
        const simboli = simboliDa(d);
        const al = gl.righe.map(r => I.allineaSimboli(simboli, r));
        candidati.push({ righe: al.map(a => a.testo), conf: al.map(a => a.conf) });
        // le prime due letture coincidono e tornano: la terza non serve
        if (candidati.length === 2 && candidati[0].righe.join('\n') === candidati[1].righe.join('\n')) {
          const f2 = L.fondiMrz(candidati), m2 = f2 && L.leggiMrz(f2.righe, oggi, f2);
          if (m2 && m2.valida) return m2;
        }
      }
      const fusa = L.fondiMrz(candidati);
      if (fusa) return L.leggiMrz(fusa.righe, oggi, fusa);
    } else {
      // nessun «<» riconoscibile: forse non è una MRZ (tre righe regolari sul fronte di una CIE) o la forma dei «<» non si
      // distingue (foto piccola): una sola lettura del ritaglio, con la pulizia delle righe di prima
      const d = await ocr(l, I.distendi(crop.g), crop.w, crop.h, PARAMETRI_MRZ, resto);
      grezze.push(righeDaRisultato(d).map(r => r.testo));
    }
    for (const t of grezze) { const m = L.trovaMrz(t); if (m) return L.leggiMrz(m.righe, oggi); }
    return null;
  } finally {
    crop.g.fill(0); bin.fill(0);
  }
}

// Testo stampato: la zona con le righe del documento, ritagliata dritta; l'OCR la legge in uno o due versi (dritta e capovolta)
// e, se mancano dati importanti e c'è tempo, una seconda volta con un'altra impostazione.
async function leggiZonaTesto(l, pagina, zt, scala, resto) {
  const base = { cx: zt.cx * scala, cy: zt.cy * scala, lungo: zt.lungo * scala, traverso: zt.traverso * scala, angolo: zt.angolo };
  const opz = { oggi: Date.now(), stati: ctx.stati, province: ctx.province };
  const leggi = async (giro, psm, altezza) => {
    const fattore = Math.max(0.35, Math.min(2.5, altezza / (zt.s * scala)));
    if (base.lungo * fattore * base.traverso * fattore > 8e6) return null;
    const crop = I.estrai(pagina.g, pagina.w, pagina.h, Object.assign({}, base, { angolo: base.angolo + giro * Math.PI / 180 }), fattore);
    const img = I.distendi(crop.g);
    crop.g.fill(0);
    try {
      const d = await ocr(l, img, crop.w, crop.h, { tessedit_pageseg_mode: psm }, resto);
      const { segmenti, fiducia } = segmentiDa(d);
      const st = L.leggiTestoStampato(segmenti, opz);
      return { st, fiducia, giro, punti: punteggioStampato(st) + fiducia / 100 };
    } finally {
      img.fill(0);
    }
  };
  let migliore = null;
  for (const giro of [0, 180]) {
    if (migliore && resto() < MINIMO_PASSAGGIO) break;
    const r = await leggi(giro, '11', ALTEZZA_TESTO);
    if (r && (!migliore || r.punti > migliore.punti)) migliore = r;
    if (r && r.fiducia >= 45 && punteggioStampato(r.st) >= 1) break;         // verso giusto: il capovolto non serve
  }
  if (!migliore) return null;
  const dubbi = new Set(migliore.st.dubbi || []);
  const mancano = ['cognome', 'nome', 'nascita', 'luogo'].filter(k => !migliore.st[k] || dubbi.has(k)).length;
  if (mancano && migliore.fiducia >= 45 && resto() > 2 * MINIMO_PASSAGGIO) {
    const r2 = await leggi(migliore.giro, '3', ALTEZZA_TESTO - 2);
    if (r2) {
      const st = migliore.st, dubbi2 = new Set(r2.st.dubbi || []);
      for (const [k, val] of Object.entries(r2.st)) {
        if (k === 'indizi') { for (const [i, b] of Object.entries(val || {})) st.indizi[i] = st.indizi[i] || b; }
        else if (k === 'credibile') st.credibile = st.credibile || val;
        else if (k === 'dubbi') continue;
        else if (val != null && (st[k] == null || (dubbi.has(k) && !dubbi2.has(k)))) st[k] = val;   // un nome dubbio lascia il posto a uno pulito
      }
    }
  }
  return migliore.st;
}

// Un passaggio dell'OCR su una matrice di grigi (la tela si azzera subito dopo).
async function ocr(l, img, w, h, parametri, resto) {
  const c = nuovaTela(w, h), g = c.getContext('2d');
  const dati = g.createImageData(c.width, c.height), p = dati.data;
  for (let i = 0, j = 0; i < img.length; i++, j += 4) { p[j] = p[j + 1] = p[j + 2] = img[i]; p[j + 3] = 255; }
  g.putImageData(dati, 0, 0);
  p.fill(0);
  try {
    const r = await conTempo(l.worker.recognize(c, parametri, { text: true, blocks: true }), Math.max(MINIMO_PASSAGGIO, resto()), 'timeout');
    if (l.annullato) throw errore('annullato');
    return r && r.data;
  } finally {
    azzera(c);
  }
}

function simboliDa(data) {
  const out = [];
  for (const b of (data && data.blocks) || []) for (const p of b.paragraphs || []) for (const r of p.lines || []) for (const w of r.words || []) for (const s of w.symbols || []) out.push(s);
  return out;
}

// Righe del testo stampato come pezzi con il loro riquadro: una riga dell'OCR si divide dove le parole sono molto distanti
// (sulla CIE «SESSO», «STATURA» e «CITTADINANZA» sono tre colonne). In ordine dall'alto in basso, da sinistra a destra.
function segmentiDa(data) {
  const segmenti = [];
  let somma = 0, n = 0;
  for (const b of (data && data.blocks) || []) for (const p of b.paragraphs || []) for (const r of p.lines || []) {
    const parole = (r.words || []).filter(w => w && w.bbox && String(w.text || '').trim());
    const altezze = parole.map(w => w.bbox.y1 - w.bbox.y0).sort((x, y) => x - y), alt = altezze[altezze.length >> 1] || 10;
    let seg = null;
    for (const w of parole) {
      somma += w.confidence || 0; n++;
      if (seg && w.bbox.x0 - seg.bbox.x1 <= 2.5 * alt) {
        seg.testo += ' ' + w.text.trim();
        seg.bbox.x1 = Math.max(seg.bbox.x1, w.bbox.x1); seg.bbox.y0 = Math.min(seg.bbox.y0, w.bbox.y0); seg.bbox.y1 = Math.max(seg.bbox.y1, w.bbox.y1);
      } else {
        if (seg) segmenti.push(seg);
        seg = { testo: w.text.trim(), bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } };
      }
    }
    if (seg) segmenti.push(seg);
  }
  segmenti.sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));
  return { segmenti, fiducia: n ? somma / n : 0 };
}

// Ripiego: l'immagine intera, come prima della ricerca delle zone (rotazioni secondo il verso delle righe, MRZ dalla prima
// lettura o dal terzo inferiore).
async function leggiIntera(l, pagina, resto, quota) {
  const lavoroCanvas = telaDa(I.distendi(pagina.g), pagina.w, pagina.h);
  try {
    const asseVerticale = righeVerticali(lavoroCanvas);
    const rotazioni = asseVerticale ? [90, 270, 0, 180] : [0, 180, 90, 270];
    let migliore = null;
    for (let r = 0; r < rotazioni.length; r++) {
      if (r > 0 && resto() < 6000) break;
      if (r >= 2 && (punteggioLettura(migliore) === 0 || resto() < TEMPI.lettura * 0.5)) break;   // niente testo in due tentativi: non è un documento leggibile
      const tela = rotazioni[r] === 0 ? lavoroCanvas : ruota(lavoroCanvas, rotazioni[r]);
      try {
        const lettura = await leggiTela(l, tela, resto);
        quota((r + 1) / rotazioni.length);
        if (!migliore || punteggioLettura(lettura) > punteggioLettura(migliore)) migliore = lettura;
        if (migliore.mrz && migliore.mrz.verificate >= 2) break;
        if (punteggioLettura(migliore) >= 3) break;
      } finally {
        if (tela !== lavoroCanvas) azzera(tela);
      }
    }
    return { mrz: migliore && migliore.mrz, stampato: migliore && migliore.stampato };
  } finally {
    azzera(lavoroCanvas);
  }
}

function telaDa(img, w, h) {
  const c = nuovaTela(w, h), g = c.getContext('2d', { willReadFrequently: true });
  const dati = g.createImageData(c.width, c.height), p = dati.data;
  for (let i = 0, j = 0; i < img.length; i++, j += 4) { p[j] = p[j + 1] = p[j + 2] = img[i]; p[j + 3] = 255; }
  g.putImageData(dati, 0, 0);
  p.fill(0); img.fill(0);
  return c;
}

const punteggioLettura = x => !x ? 0 : (x.mrz ? 2 + x.mrz.verificate : 0) + (x.stampato ? ['cognome', 'nome', 'nascita', 'numero', 'luogo'].filter(k => x.stampato[k]).length : 0);

// Una tela: prima lettura (testo e posizione delle righe), poi, se c'è, la fascia MRZ ritagliata, ingrandita e in bianco e nero.
async function leggiTela(l, tela, resto) {
  const piccola = riduci(tela, LATO_PRIMA_LETTURA);
  const scala = tela.width / piccola.width || 1;      // per riportare le coordinate della prima lettura sulla tela intera
  let prima;
  try {
    prima = await conTempo(l.worker.recognize(piccola, {}, { text: true, blocks: true }), Math.max(MINIMO_PASSAGGIO, resto()), 'timeout');
  } finally {
    if (piccola !== tela) azzera(piccola);
  }
  if (l.annullato) throw errore('annullato');
  const righe = righeDaRisultato(prima && prima.data);
  const testo = righe.map(r => r.testo);
  const opz = { oggi: Date.now(), stati: ctx.stati, province: ctx.province };
  const stampato = L.leggiTestoStampato(testo, opz);
  let mrz = null;
  const daPrima = L.trovaMrz(testo);
  if (daPrima) mrz = L.leggiMrz(daPrima.righe, Date.now());
  // fascia MRZ: righe che sembrano MRZ nella prima lettura, oppure il terzo inferiore dell'immagine (solo se la prima lettura
  // ha trovato del testo: su una foto che non è un documento non si perde altro tempo)
  const caratteri = testo.join('').replace(/[^A-Za-z0-9<]/g, '').length;
  if (!(mrz && mrz.valida) && resto() > 3000 && caratteri >= 20) {
    const candidate = righe.filter(r => /^[A-Z0-9<]{25,}$/.test(L.pulisciRigaMrz(r.testo)) && L.pulisciRigaMrz(r.testo).includes('<'));
    let zona;
    if (candidate.length) {
      const x0 = Math.min(...candidate.map(r => r.bbox.x0)) * scala, x1 = Math.max(...candidate.map(r => r.bbox.x1)) * scala;
      const y0 = Math.min(...candidate.map(r => r.bbox.y0)) * scala, y1 = Math.max(...candidate.map(r => r.bbox.y1)) * scala;
      const h = (y1 - y0) / Math.max(1, candidate.length);
      zona = { x: x0 - 0.04 * tela.width, y: y0 - 0.6 * h, w: (x1 - x0) + 0.08 * tela.width, h: (y1 - y0) + 1.2 * h, righe: Math.max(2, candidate.length) };
    } else {
      zona = { x: 0, y: tela.height * 0.62, w: tela.width, h: tela.height * 0.38, righe: 3 };
    }
    const fascia = ritagliaMrz(tela, zona);
    try {
      const seconda = await conTempo(l.worker.recognize(fascia, { tessedit_char_whitelist: MRZ_LETTERE, tessedit_pageseg_mode: '6' }, { text: true, blocks: true }), Math.max(MINIMO_PASSAGGIO, resto()), 'timeout');
      if (l.annullato) throw errore('annullato');
      const t2 = righeDaRisultato(seconda && seconda.data).map(r => r.testo);
      const m2 = L.trovaMrz(t2);
      const letta = m2 && L.leggiMrz(m2.righe, Date.now());
      if (letta && (!mrz || letta.verificate > mrz.verificate)) mrz = letta;
    } finally {
      azzera(fascia);
    }
  }
  return { mrz, stampato };
}

function righeDaRisultato(data) {
  const out = [];
  for (const b of (data && data.blocks) || []) for (const p of b.paragraphs || []) for (const r of p.lines || []) {
    const testo = String(r.text || '').replace(/\n/g, ' ').trim();
    if (testo) out.push({ testo, bbox: r.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 } });
  }
  if (!out.length && data && data.text) for (const t of String(data.text).split('\n')) if (t.trim()) out.push({ testo: t.trim(), bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } });
  return out;
}

// ---- Motore OCR (Tesseract.js, ospitato nel sito: nessuna richiesta ad altri domini) ----

let tesseractCaricato = null;
function caricaTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!tesseractCaricato) tesseractCaricato = new Promise((ok, ko) => {
    const sc = document.createElement('script');
    sc.src = new URL('tesseract/tesseract.min.js', VENDOR).href;
    sc.async = true;
    sc.onload = () => (window.Tesseract ? ok(window.Tesseract) : ko(errore('offline')));
    sc.onerror = () => { tesseractCaricato = null; sc.remove(); ko(errore('offline')); };
    document.head.appendChild(sc);
  });
  return tesseractCaricato;
}

// WebAssembly SIMD (stesso modulo di prova di wasm-feature-detect): senza SIMD (iPhone e Android datati) si usa l'altro motore.
function supportaSimd() {
  try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; }
}

async function avviaWorker(l, quota) {
  const T = await conTempo(caricaTesseract(), TEMPI.preparazione, 'offline');
  let scaduto = false;
  const creazione = T.createWorker('eng', 1, {
    workerPath: new URL('tesseract/worker.min.js', VENDOR).href,
    corePath: new URL(supportaSimd() ? 'tesseract-core/tesseract-core-simd-lstm.wasm.js' : 'tesseract-core/tesseract-core-lstm.wasm.js', VENDOR).href,
    langPath: new URL('tessdata', VENDOR).href,
    gzip: true,
    cacheMethod: 'none',         // il modello non va in IndexedDB: resta nella normale cache del browser
    workerBlobURL: false,        // nessun indirizzo blob: per il worker
    logger: m => { if (m && typeof m.progress === 'number') quota(m.progress); },   // solo lo stato di avanzamento, mai testo
    errorHandler: () => {}
  });
  // se il tempo scade mentre il worker si sta avviando, appena esiste si chiude (niente worker dimenticati in memoria)
  creazione.then(w => { if (scaduto || l.annullato) { try { w.terminate(); } catch (e) { /* già chiuso */ } } }, () => {});
  try {
    const w = await conTempo(creazione, TEMPI.preparazione, 'offline');
    await w.setParameters({ user_defined_dpi: '300' });
    return w;
  } catch (e) {
    scaduto = true;
    throw (e && e.codice) ? e : errore('offline');
  }
}

function conTempo(promessa, ms, codice) {
  let timer;
  return Promise.race([
    promessa,
    new Promise((_, ko) => { timer = setTimeout(() => ko(errore(codice)), ms); })
  ]).finally(() => clearTimeout(timer));
}

// ---- Immagine: decodifica, orientamento, preparazione (tutto in memoria) ----

function tipoDaByte(b) {
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
  const ascii = (i, n) => String.fromCharCode.apply(null, Array.from(b.slice(i, i + n)));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
  if (ascii(0, 5) === '%PDF-') return 'pdf';
  if (ascii(4, 4) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(ascii(8, 4))) return 'heic';
  if (ascii(0, 3) === 'GIF') return 'gif';
  if (ascii(0, 2) === 'BM') return 'bmp';
  return null;
}

// Orientamento EXIF e dimensioni reali di un JPEG (per i browser che non ruotano da soli le foto dei telefoni).
export function infoJpeg(b) {
  let orientamento = 1, larghezza = 0, altezza = 0, i = 2;
  const u16 = (p, le) => le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1];
  const u32 = (p, le) => le ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0 : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
  while (i + 4 < b.length) {
    if (b[i] !== 0xFF) break;
    const marker = b[i + 1], len = u16(i + 2, false);
    if (marker === 0xE1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      const t = i + 10, le = b[t] === 0x49;             // intestazione TIFF: «II» little endian, «MM» big endian
      const ifd = t + u32(t + 4, le);
      const voci = ifd + 2 <= b.length ? u16(ifd, le) : 0;
      for (let k = 0; k < voci && k < 200; k++) { const e = ifd + 2 + k * 12; if (e + 10 > b.length) break; if (u16(e, le) === 0x0112) { orientamento = u16(e + 8, le); break; } }
    } else if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) {
      altezza = u16(i + 5, false); larghezza = u16(i + 7, false); break;
    }
    i += 2 + len;
  }
  return { orientamento: orientamento >= 1 && orientamento <= 8 ? orientamento : 1, larghezza, altezza };
}

async function decodifica(file) {
  const testa = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const tipo = tipoDaByte(testa);
  if (tipo === 'pdf') throw errore('pdf');
  if (!tipo || tipo === 'gif') throw errore('formato');
  if (tipo === 'heic') {
    let bmp = null;
    try { bmp = await createImageBitmap(file); } catch (e) { bmp = null; }      // Safari apre le HEIC da solo
    if (!bmp) bmp = await decodificaHeic(file);
    return { sorgente: bmp, w: bmp.width, h: bmp.height, rotazione: 0, chiudi: () => { try { bmp.close(); } catch (e) { /* già chiusa */ } } };
  }
  const info = tipo === 'jpeg' ? infoJpeg(testa) : { orientamento: 1 };
  let sorgente = null, w = 0, h = 0, chiudi = () => {};
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      sorgente = bmp; w = bmp.width; h = bmp.height; chiudi = () => { try { bmp.close(); } catch (e) { /* già chiusa */ } };
    } catch (e) { sorgente = null; }
  }
  if (!sorgente) {
    // ripiego per i browser senza createImageBitmap: <img> con un indirizzo temporaneo, revocato appena decodificata
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(errore('formato')); i.src = url; });
      if (img.decode) { try { await img.decode(); } catch (e) { /* già decodificata */ } }
      sorgente = img; w = img.naturalWidth; h = img.naturalHeight;
      chiudi = () => { img.removeAttribute('src'); };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  // il browser non ha applicato la rotazione EXIF di 90°/270° (le dimensioni sono ancora quelle del sensore): la si applica qui
  let rotazione = 0;
  if (info.larghezza && [5, 6, 7, 8].includes(info.orientamento) && w === info.larghezza && h === info.altezza) rotazione = [6, 5].includes(info.orientamento) ? 90 : 270;
  return { sorgente, w, h, rotazione, chiudi };
}

// Foto HEIC che il browser non sa aprire (Chrome, Firefox): heic-to in un worker dedicato, chiuso subito dopo.
async function decodificaHeic(file) {
  let w;
  try { w = new Worker(new URL('./decodifica-heic.js?v=20261105a', import.meta.url), { type: 'module' }); } catch (e) { throw errore('heic'); }
  try {
    return await conTempo(new Promise((ok, ko) => {
      w.onmessage = e => (e.data && e.data.ok && e.data.bitmap ? ok(e.data.bitmap) : ko(errore('heic')));
      w.onerror = () => ko(errore('heic'));
      w.postMessage(file);
    }), TEMPI.lettura, 'timeout');
  } finally {
    w.terminate();
  }
}

function nuovaTela(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}
function azzera(c) { if (c && c.width) { c.width = 0; c.height = 0; } }

// Immagine di lavoro: ridotta (lato lungo al massimo LATO_MAX), girata se serve, come matrice di grigi (il canale più chiaro
// di ogni pixel: scritte nere, fondi colorati chiari). La tela usata per disegnarla si azzera subito.
function preparaPagina(img) {
  const f = Math.min(1, LATO_MAX / Math.max(img.w, img.h));
  const w = img.w * f, h = img.h * f, gira = img.rotazione === 90 || img.rotazione === 270;
  const c = nuovaTela(gira ? h : w, gira ? w : h), g = c.getContext('2d', { willReadFrequently: true });
  try {
    g.imageSmoothingQuality = 'high';
    g.save();
    g.translate(c.width / 2, c.height / 2);
    g.rotate(img.rotazione * Math.PI / 180);
    g.drawImage(img.sorgente, -w / 2, -h / 2, w, h);
    g.restore();
    const dati = g.getImageData(0, 0, c.width, c.height);
    const grigio = I.grigioMassimo(dati.data, c.width, c.height);
    dati.data.fill(0);
    return { g: grigio, w: c.width, h: c.height };
  } finally {
    azzera(c);
  }
}

function riduci(c, lato) {
  const f = lato / Math.max(c.width, c.height);
  if (f >= 1) return c;
  const r = nuovaTela(c.width * f, c.height * f), g = r.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, r.width, r.height);
  return r;
}

function ruota(c, gradi) {
  const gira = gradi === 90 || gradi === 270;
  const r = nuovaTela(gira ? c.height : c.width, gira ? c.width : c.height), g = r.getContext('2d');
  g.translate(r.width / 2, r.height / 2);
  g.rotate(gradi * Math.PI / 180);
  g.drawImage(c, -c.width / 2, -c.height / 2);
  return r;
}

// Fascia MRZ ritagliata, ingrandita (righe alte circa 48 px) e portata in bianco e nero (soglia di Otsu).
function ritagliaMrz(c, z) {
  const x = Math.max(0, Math.round(z.x)), y = Math.max(0, Math.round(z.y));
  const w = Math.min(c.width - x, Math.round(z.w)), h = Math.min(c.height - y, Math.round(z.h));
  const scala = Math.max(1, Math.min(3, 48 / Math.max(1, h / (z.righe * 1.6))));
  const r = nuovaTela(w * scala, h * scala), g = r.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, x, y, w, h, 0, 0, r.width, r.height);
  const dati = g.getImageData(0, 0, r.width, r.height), p = dati.data, ist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) ist[p[i]]++;
  const tot = p.length / 4;
  let somma = 0; for (let v = 0; v < 256; v++) somma += v * ist[v];
  let sB = 0, wB = 0, soglia = 127, massimo = 0;
  for (let v = 0; v < 256; v++) {
    wB += ist[v]; if (!wB) continue;
    const wF = tot - wB; if (!wF) break;
    sB += v * ist[v];
    const mB = sB / wB, mF = (somma - sB) / wF, tra = wB * wF * (mB - mF) * (mB - mF);
    if (tra > massimo) { massimo = tra; soglia = v; }
  }
  for (let i = 0; i < p.length; i += 4) { const y = p[i] > soglia ? 255 : 0; p[i] = p[i + 1] = p[i + 2] = y; }
  g.putImageData(dati, 0, 0);
  return r;
}

// Asse delle righe di testo: confronto tra le variazioni orizzontali e verticali dei bordi su una copia piccola. Il testo
// orizzontale ha molte transizioni lungo le righe (bordi verticali dei caratteri) e righe ben separate.
function righeVerticali(c) {
  const piccola = riduci(c, 400);
  try {
    const g = piccola.getContext('2d', { willReadFrequently: true });
    const { data: p, width: w, height: h } = g.getImageData(0, 0, piccola.width, piccola.height);
    const righe = new Float64Array(h), colonne = new Float64Array(w);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4, gx = Math.abs(p[i + 4] - p[i - 4]), gy = Math.abs(p[i + w * 4] - p[i - w * 4]);
      righe[y] += gx; colonne[x] += gy;
    }
    const varianza = a => { let m = 0; for (const v of a) m += v; m /= a.length || 1; let q = 0; for (const v of a) q += (v - m) * (v - m); return q / (a.length || 1) / ((m * m) || 1); };
    return varianza(colonne) > varianza(righe) * 1.6;
  } finally {
    if (piccola !== c) azzera(piccola);
  }
}

// ---- Campi del modulo ----

const SELETTORI = {
  cognome: n => `input[name="ospite${n}_cognome"]`, nome: n => `input[name="ospite${n}_nome"]`, genere: n => `select[name="ospite${n}_genere"]`,
  nascita: n => `input[name="ospite${n}_nascita"]`, cittadinanza: n => `select[name="ospite${n}_cittadinanza"]`,
  luogoNascita: n => `select[name="ospite${n}_luogo_nascita"]`, comune: n => `input[name="ospite${n}_comune"]`, provincia: n => `select[name="ospite${n}_provincia"]`,
  tipoDocumento: () => 'select[name="ospite1_tipo_documento"]', numeroDocumento: () => 'input[name="ospite1_numero_documento"]', luogoRilascio: () => 'select[name="ospite1_luogo_rilascio"]'
};
const ORDINE = ['luogoNascita', 'comune', 'provincia', 'cognome', 'nome', 'genere', 'nascita', 'cittadinanza', 'tipoDocumento', 'numeroDocumento', 'luogoRilascio'];
const ETICHETTE_CAMPI = { cognome: 'field.cognome', nome: 'field.nome', genere: 'field.genere', nascita: 'field.dataNascita', cittadinanza: 'field.cittadinanza',
  luogoNascita: 'field.luogoNascita', comune: 'guest.comuneEtichetta', provincia: 'scan.campo.provincia', tipoDocumento: 'field.tipoDocumento',
  numeroDocumento: 'field.numeroDocumento', luogoRilascio: 'field.luogoRilascio' };

const campo = (n, k) => (n === 1 || !['tipoDocumento', 'numeroDocumento', 'luogoRilascio'].includes(k)) ? document.querySelector(SELETTORI[k](n)) : null;
const testoData = el => { const w = el && el.closest && el.closest('.date-input-wrapper'); return w ? w.querySelector('.date-text-input') : null; };
const visibile = el => el._combo || testoData(el) || el;      // campi con elenco: la casella di testo (campi-elenco.js)

function valoriAttuali(n) {
  const v = {};
  for (const k of ORDINE) { const el = campo(n, k); if (el) v[k] = el.value || ''; }
  return v;
}

function istantanea(n) {
  const v = valoriAttuali(n), nascita = campo(n, 'nascita'), t = testoData(nascita);
  return { valori: v, testoNascita: t ? t.value : null };
}

function imposta(el, valore) {
  if (el.tagName === 'SELECT' && valore && !Array.from(el.options).some(o => o.value === valore)) return false;   // mai un valore fuori elenco
  el.value = valore;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));    // es. luogo di nascita → comune/provincia; tipo documento → retro
  return true;
}

function segna(el, affidabilita) {
  const v = visibile(el);
  for (const x of new Set([el, v])) {
    x.classList.remove('scan-letto', 'scan-verifica');
    x.classList.add(affidabilita === L.SICURO ? 'scan-letto' : 'scan-verifica');
    if (!x.dataset.scanAscolto) {
      x.dataset.scanAscolto = '1';
      const togli = e => { if (e.isTrusted) { el.classList.remove('scan-letto', 'scan-verifica'); v.classList.remove('scan-letto', 'scan-verifica'); } };
      x.addEventListener('input', togli);
      x.addEventListener('change', togli);
    }
  }
}
function togliSegni(n) {
  for (const k of ORDINE) { const el = campo(n, k); if (el) { el.classList.remove('scan-letto', 'scan-verifica'); visibile(el).classList.remove('scan-letto', 'scan-verifica'); } }
}

function ripristina(s) {
  const ist = s.istantanea;
  if (!ist) return;
  for (const k of ORDINE) {
    const el = campo(s.n, k);
    if (!el || ist.valori[k] == null) continue;
    if (el.value !== ist.valori[k]) imposta(el, ist.valori[k]);
    if (k === 'nascita') { const t = testoData(el); if (t && ist.testoNascita != null) t.value = ist.testoNascita; }
  }
  togliSegni(s.n);
  s.scritti.clear();
}

// Toglie solo ciò che ha scritto la scansione e che l'ospite non ha più toccato (prima di riapplicare letture nuove).
function togliPropriScritti(s) {
  for (const k of ORDINE) {
    if (!s.scritti.has(k)) continue;
    const el = campo(s.n, k);
    if (el && el.value === s.scritti.get(k) && s.istantanea) {
      imposta(el, s.istantanea.valori[k] || '');
      if (k === 'nascita') { const t = testoData(el); if (t) t.value = s.istantanea.testoNascita || ''; }
    }
  }
  s.scritti.clear();
  togliSegni(s.n);
}

function applica(s, proposte) {
  if (!s.istantanea) s.istantanea = istantanea(s.n);
  togliPropriScritti(s);
  const piano = L.pianificaCompilazione(valoriAttuali(s.n), proposte);
  const scritti = [];
  for (const k of ORDINE) {
    const voce = piano.scrivere.find(x => x.campo === k);
    if (!voce) continue;
    const el = campo(s.n, k);
    if (!el) continue;
    if (k === 'comune' || k === 'provincia') {
      if ((campo(s.n, 'luogoNascita') || {}).value !== 'Italia') continue;   // comune e provincia solo per chi è nato in Italia
    }
    if (imposta(el, voce.valore)) { s.scritti.set(k, el.value); segna(el, voce.affidabilita); scritti.push(voce); }
  }
  for (const c of piano.confermati) { const el = campo(s.n, c.campo); if (el && proposte[c.campo]) segna(el, proposte[c.campo].affidabilita); }
  return { scritti, conflitti: piano.conflitti };
}

// ---- Esito ----

function concludi(s, errori) {
  const letture = Object.values(s.letture).filter(Boolean);
  const responsabile = s.n === 1;
  const comb = L.combinaLetture(letture, { responsabile, oggi: Date.now(), stati: ctx.stati, province: ctx.province });
  const proposte = {};
  for (const [k, c] of Object.entries(comb.campi)) if (c.valore) proposte[k] = c;
  // tipo di documento riconosciuto ma non certo (patente, carta d'identità, passaporto): si compila lo stesso, da controllare
  // (prima era una domanda «È giusto? Sì / Scelgo io»: tolta su richiesta del titolare, 06/11/2026)
  const tipoDoc = comb.campi.tipoDocumento;
  if (responsabile && tipoDoc && !tipoDoc.valore && tipoDoc.suggerimento) proposte.tipoDocumento = { valore: tipoDoc.suggerimento, affidabilita: L.DA_VERIFICARE, fonte: 'tipo' };
  // comune: il nome dell'elenco dei comuni (campi-elenco.js), anche se l'OCR ha sbagliato una lettera; se non è nell'elenco
  // non si compila (il campo accetta solo comuni dell'elenco)
  if (proposte.comune && window.ElencoComuni && window.ElencoComuni.pronto()) {
    const r = window.ElencoComuni.simile(proposte.comune.valore, proposte.provincia && proposte.provincia.valore);
    if (r && !r.ambiguo) {
      proposte.comune = Object.assign({}, proposte.comune, { valore: r.nome }, r.approssimato ? { affidabilita: L.DA_VERIFICARE } : {});
      if (!proposte.provincia) proposte.provincia = { valore: r.prov, affidabilita: L.DA_VERIFICARE, fonte: 'elenco' };
    } else delete proposte.comune;
  }
  const { scritti, conflitti } = letture.length ? applica(s, proposte) : { scritti: [], conflitti: [] };
  let messaggio, tipo;
  const sfocate = letture.some(x => x.sfocata && x.vuota);
  if (comb.esito === 'nessun_dato') {
    if (errori.includes('timeout')) { messaggio = 'scan.timeout'; tipo = 'errore'; }
    else if (errori.includes('offline')) { messaggio = 'scan.offline'; tipo = 'errore'; }
    else if (errori.includes('pdf')) { messaggio = 'scan.pdf'; tipo = 'errore'; }
    else if (errori.includes('heic')) { messaggio = 'scan.heic'; tipo = 'errore'; }
    else if (errori.includes('formato')) { messaggio = 'scan.formato'; tipo = 'errore'; }
    else if (errori.length) { messaggio = 'scan.errore'; tipo = 'errore'; }
    else if (sfocate) { messaggio = 'scan.sfocata'; tipo = 'errore'; }
    else if (letture.some(x => !x.vuota)) { messaggio = 'scan.nonSupportato'; tipo = 'errore'; }
    else { messaggio = 'scan.nonLeggibile'; tipo = 'errore'; }
  } else if (comb.esito === 'parziale') { messaggio = 'scan.esitoParziale'; tipo = 'parziale'; }
  else { messaggio = 'scan.esitoOk'; tipo = 'ok'; }
  const avvisi = comb.avvisi.filter(a => a.codice !== 'tipo_da_scegliere' || !proposte.tipoDocumento);
  // stesso documento usato per due ospiti?
  const totale = ctx.numeroOspiti ? ctx.numeroOspiti() : 0, attuali = valoriAttuali(s.n);
  for (let m = 1; m <= totale; m++) if (m !== s.n && L.stessaPersona(attuali, valoriAttuali(m))) avvisi.push({ codice: 'stesso_ospite', n: m });
  if (errori.includes('timeout') && comb.esito !== 'nessun_dato') avvisi.push({ codice: 'timeout_parziale' });
  s.esito = { messaggio, tipo, scritti, conflitti, avvisi };
  mostraEsito(s);
}

function mostraEsito(s) {
  const box = s.pannello && s.pannello.querySelector('.scan-esito');
  const e = s.esito;
  if (!box || !e) return;
  const t = ctx.t;
  const righe = [`<p class="scan-esito-titolo">${esc(t(e.messaggio))}</p>`];
  for (const a of e.avvisi || []) righe.push(`<p class="scan-avviso">${esc(t('scan.avviso.' + a.codice, { n: a.n }))}</p>`);
  if (e.conflitti && e.conflitti.length) {
    righe.push(`<p class="scan-conflitti-titolo">${esc(t('scan.conflittiTitolo'))}</p>`);
    e.conflitti.forEach((c, i) => righe.push(`<div class="scan-conflitto"><span>${esc(t('scan.conflitto', { campo: t(ETICHETTE_CAMPI[c.campo] || c.campo), attuale: mostraValore(c.campo, c.attuale), letto: mostraValore(c.campo, c.letto) }))}</span>
      <button type="button" class="scan-mini" data-azione="usa" data-indice="${i}">${esc(t('scan.usaLetto'))}</button>
      <button type="button" class="scan-mini scan-mini-chiaro" data-azione="tieni" data-indice="${i}">${esc(t('scan.tieniMio'))}</button></div>`));
  }
  if (s.istantanea && ((e.scritti && e.scritti.length) || s.scritti.size)) righe.push(`<button type="button" class="scan-annulla" data-azione="annulla">${esc(t('scan.annulla'))}</button>`);
  box.className = 'scan-esito ' + (e.tipo || '');
  box.innerHTML = righe.join('');
  box.hidden = false;
  box.querySelectorAll('[data-azione]').forEach(b => b.addEventListener('click', () => azioneEsito(s, b.getAttribute('data-azione'), parseInt(b.getAttribute('data-indice'), 10))));
}

function mostraValore(k, v) {
  if (k === 'nascita' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
  if (['cittadinanza', 'luogoNascita', 'luogoRilascio'].includes(k) && ctx.traduciPaese) return ctx.traduciPaese(v);
  if (k === 'tipoDocumento' && ctx.traduciDocumento) return ctx.traduciDocumento(v);
  return v;
}

function azioneEsito(s, azione, indice) {
  const e = s.esito;
  if (!e) return;
  if (azione === 'annulla') {
    ripristina(s);
    s.letture = {};
    s.istantanea = null;
    for (const k of [1, 2]) statoLato(s, k, null);
    s.esito = { messaggio: 'scan.annullata', tipo: 'info', scritti: [], conflitti: [], avvisi: [] };
  } else if (azione === 'usa' || azione === 'tieni') {
    const c = e.conflitti[indice];
    if (!c) return;
    if (azione === 'usa') {
      const el = campo(s.n, c.campo);
      if (el && imposta(el, c.letto)) segna(el, c.affidabilita);      // scelta dell'ospite: una nuova lettura non la toglie
    }
    e.conflitti = e.conflitti.filter((_, i) => i !== indice);
  }
  mostraEsito(s);
}

// Uscendo dalla pagina si chiude tutto (nessun worker o immagine lasciati in memoria).
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => interrompi(false));
