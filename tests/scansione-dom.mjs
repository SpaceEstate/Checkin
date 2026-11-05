// tests/scansione-dom.mjs — esegue i18n.js e checkin.js in un contesto isolato con una pagina finta (nessun browser, nessuna rete)
// e restituisce il markup dei passi degli ospiti creato da generaStepOspiti(). Serve a dimostrare che, con la scansione dei
// documenti spenta, i passi degli ospiti restano identici a quelli di prima (fixture tests/fixtures/scansione/passi-ospiti-attuali.json).
import fs from 'fs';
import vm from 'vm';

const OGGI = Date.parse('2026-11-05T10:00:00Z');   // la data massima di nascita nel markup dipende dal giorno: qui è fissa

function elementoFinto(tag) {
  const attr = {};
  return {
    tagName: String(tag).toUpperCase(), className: '', id: '', innerHTML: '', style: {}, dataset: {},
    setAttribute(k, v) { attr[k] = String(v); }, getAttribute(k) { return k in attr ? attr[k] : null }, hasAttribute(k) { return k in attr; },
    removeAttribute(k) { delete attr[k]; }, querySelectorAll() { return []; }, querySelector() { return null; },
    appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
  };
}

// opzioni: { lingua: 'it'|'en'|'de', hash: '' (frammento dell'indirizzo), sorgente: testo di checkin.js (predefinito: il file del repository) }
export function passiOspiti(root, numeroOspiti, opzioni) {
  const o = opzioni || {};
  const inseriti = [];
  const form = Object.assign(elementoFinto('form'), { insertBefore(el) { inseriti.push(el); } });
  const stepFinal = elementoFinto('div');
  const document = {
    addEventListener() {}, removeEventListener() {},
    getElementById(id) { return id === 'checkin-form' ? form : id === 'step-final' ? stepFinal : null; },
    createElement: elementoFinto, querySelectorAll() { return []; }, querySelector() { return null; },
    documentElement: elementoFinto('html'), head: elementoFinto('head'), body: elementoFinto('body')
  };
  const lingua = o.lingua || 'it';
  const localStorage = { getItem: () => lingua, setItem() {} };
  const location = { hash: o.hash || '', search: '', href: 'https://spaceestate.github.io/Checkin/' + (o.hash || ''), pathname: '/Checkin/', hostname: 'spaceestate.github.io' };
  class DataFissa extends Date { constructor(...a) { if (a.length) super(...a); else super(OGGI); } static now() { return OGGI; } }
  const silenzioso = { log() {}, warn() {}, error() {}, info() {} };
  // come nel browser, `window` è l'oggetto globale (checkin.js definisce molte funzioni come window.nome = function ...)
  const ctx = { document, localStorage, location, navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }, console: silenzioso, Date: DataFissa,
    history: { replaceState() {} }, addEventListener() {}, setTimeout() { return 0; }, clearTimeout() {}, requestAnimationFrame() {},
    URLSearchParams, URL, JSON, Math, Promise };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(root + '/i18n.js', 'utf8'), ctx, { filename: 'i18n.js' });
  vm.runInContext(o.sorgente != null ? o.sorgente : fs.readFileSync(root + '/checkin.js', 'utf8'), ctx, { filename: 'checkin.js' });
  vm.runInContext('numeroOspiti = ' + Number(numeroOspiti) + '; generaStepOspiti();', ctx);
  return inseriti.map(el => ({ id: el.id, className: el.className, html: el.innerHTML }));
}

// Testo di una funzione di checkin.js (dalla dichiarazione alla graffa che la chiude), per controllare che le parti che la
// scansione non deve toccare restino identiche. Riconosce `function nome(`, `async function nome(` e `window.nome = (async) function`.
export function corpoFunzione(src, nome) {
  const re = new RegExp('(?:^|\\n)((?:async )?function ' + nome + '\\(|window\\.' + nome + ' = (?:async )?function)');
  const m = re.exec(src);
  if (!m) return null;
  const inizio = m.index + m[0].indexOf(m[1]);
  let i = src.indexOf('{', inizio), prof = 0, stringa = null;
  for (; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (stringa) { if (c === stringa && p !== '\\') stringa = null; continue; }
    if (c === '"' || c === "'" || c === '`') { stringa = c; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '{') prof++;
    else if (c === '}' && --prof === 0) return src.slice(inizio, i + 1);
  }
  return null;
}

// Funzioni del percorso di oggi (documento del responsabile, validazioni, pagamento) che la scansione non deve modificare.
export const FUNZIONI_INVARIATE = ['fileToBase64', 'validaStepOspite', 'validaPrenotazioneCompleta', 'inputDocumento', 'latiRichiesti', 'latiMancanti',
  'aggiornaLabelUpload', 'aggiornaStatoDocumenti', 'aggiornaObbligoRetro', 'bloccoUploadLato', 'handleFileUpload', 'openCamera', 'capturePhoto',
  'closeCamera', 'procediAlPagamento', 'verificaDatiAlloggiati', 'comprimiImmagineBase64', 'raccogliDatiPrenotazioneConCompressione',
  'creaLinkPagamentoConSessionId', 'mostraPagamentoNellaPagina', 'toggleComuneProvincia', 'precompilaDatiPrenotazione', 'prossimoStep', 'indietroStep'];
