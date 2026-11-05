// tests/browser/server-prova.cjs — server LOCALE di prova del check-in: serve il sito così com'è (radice del repository) e
// risponde al posto delle API del check-in (checkin-six-coral.vercel.app/api). Nessuna rete, nessun Stripe, nessun database,
// nessuna email: i «salvataggi» restano in memoria per la durata della prova e si possono vedere in /prova/registro.
//
// Usato da tests/browser/scansione.browser.cjs (prove automatiche) e, a mano, per provare il flusso da ospite:
//   node tests/browser/server-prova.cjs [porta] [spenta|prova|attiva]
// poi aprire http://localhost:<porta>/  (prenotazione di prova: PROVA1).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const API = 'https://checkin-six-coral.vercel.app/api/';
const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

const domani = () => new Date(Date.now() + 86400e3).toISOString().slice(0, 10);

// Risposte finte delle API (le stesse per le prove automatiche e per la prova a mano).
function creaApi(stato) {
  return async function api(nome, corpo) {
    stato.richiesteApi.push({ nome, byte: JSON.stringify(corpo || {}).length });
    if (nome === 'verifica-prenotazione') {
      const numero = String((corpo && corpo.numeroPrenotazione) || '').trim().toUpperCase();
      if (numero !== 'PROVA1') return { found: false };
      return { found: true, dati: { numeroPrenotazione: 'PROVA1', dataCheckin: domani(), appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto', numeroOspiti: 3, numeroNotti: 2 } };
    }
    if (nome === 'verifica-dati-alloggiati') return { disponibile: true, ok: true, problemi: [] };
    if (nome === 'salva-dati-temporanei') {
      // stessa minimizzazione del server vero: si vede esattamente cosa verrebbe conservato
      const { minimizzaDatiCheckin } = await import(path.join(ROOT, 'api', '_validazione-checkin.js'));
      const m = minimizzaDatiCheckin(corpo && corpo.datiPrenotazione);
      stato.salvataggi.push({ ricevuto: corpo, minimizzato: m });
      return m.ok ? { success: true, expiresAt: new Date(Date.now() + 7200e3).toISOString() } : { success: false, error: m.errore };
    }
    if (nome === 'crea-pagamento-stripe') return { checkoutUrl: '/prova/pagamento-finto' };   // relativo: vale anche aperto da un altro dispositivo
    if (nome === 'get-session') return { success: false };
    return { error: 'non previsto nella prova' };
  };
}

// Nella prova a mano il sito chiama le API vere: questo frammento, aggiunto SOLO dal server di prova, le devia sulle risposte finte.
const DEVIATORE = `<script>(function(){var f=window.fetch;window.fetch=function(u,o){if(typeof u==='string'&&u.indexOf(${JSON.stringify(API)})===0){u='/prova/api/'+u.slice(${API.length}).split('?')[0];}return f.call(this,u,o);};})();</script>`;

function paginaFinta(stato) {
  const ultimo = stato.salvataggi[stato.salvataggi.length - 1];
  const dati = ultimo && ultimo.minimizzato && ultimo.minimizzato.dati;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ospiti = dati ? dati.ospiti.map(o => `<tr><td>${o.numero}</td><td>${esc(o.cognome)}</td><td>${esc(o.nome)}</td><td>${esc(o.genere)}</td><td>${esc(o.nascita)}</td><td>${esc(o.cittadinanza)}</td><td>${esc(o.luogoNascita)}${o.comune ? ' · ' + esc(o.comune) + ' (' + esc(o.provincia) + ')' : ''}</td><td>${o.numero === 1 ? esc(o.tipoDocumento) + ' · ' + esc(o.numeroDocumento) + ' · ' + esc(o.luogoRilascio) : '—'}</td></tr>`).join('') : '';
  const documenti = dati ? dati.documenti.map(d => `<li>${esc(d.lato)}: ${esc(d.mime)}, ${Math.round(d.base64.length * 0.75 / 1024)} KB</li>`).join('') : '';
  const totaleImmagini = ultimo ? (JSON.stringify(ultimo.ricevuto).match(/data:image\//g) || []).length : 0;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prova: pagamento simulato</title>
  <style>body{font-family:system-ui,sans-serif;margin:16px;color:#1e1917;background:#faf5ec}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #dccfb6;padding:6px;text-align:left}h1{font-size:20px}.ok{color:#2e7d4f;font-weight:700}</style></head><body>
  <h1>Prova del check-in: pagamento simulato (nessun addebito, nessun dato inviato)</h1>
  ${dati ? `<p>Dati che il server vero conserverebbe dopo la minimizzazione:</p><table><tr><th>#</th><th>Cognome</th><th>Nome</th><th>Sesso</th><th>Nascita</th><th>Cittadinanza</th><th>Nascita (Stato/comune)</th><th>Documento (solo responsabile)</th></tr>${ospiti}</table>
  <p>Immagini nel salvataggio: <b>${totaleImmagini}</b> (solo il documento del responsabile)</p><ul>${documenti}</ul>
  <p class="ok">Le foto degli altri ospiti non sono state inviate: il salvataggio contiene solo le immagini caricate nei riquadri del responsabile.</p>`
    : '<p>Nessun salvataggio ricevuto.</p>'}
  <p><a href="/">Ricomincia</a></p></body></html>`;
}

async function avvia(opzioni) {
  const o = Object.assign({ porta: 0, scansione: 'attiva', inietta: false }, opzioni || {});
  const stato = { richiesteApi: [], salvataggi: [], file: [], base: '' };
  const api = creaApi(stato);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/prova/api/')) {
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
        let corpo = '';
        for await (const c of req) corpo += c;
        const r = await api(url.pathname.slice('/prova/api/'.length), corpo ? JSON.parse(corpo) : {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(r));
      }
      if (url.pathname === '/prova/pagamento-finto') { res.writeHead(200, { 'Content-Type': TIPI['.html'] }); return res.end(paginaFinta(stato)); }
      if (url.pathname === '/prova/registro') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ richiesteApi: stato.richiesteApi, salvataggi: stato.salvataggi.map(s => s.minimizzato) }, null, 1));
      }
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.normalize(path.join(ROOT, rel));
      if (!file.startsWith(ROOT + path.sep) || /[\\/]\.(git|github)[\\/]/.test(file) || /[\\/](api|tests|node_modules)[\\/]/.test(path.relative(ROOT, file).replace(/^/, '/'))) {
        res.writeHead(404); return res.end();
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
      stato.file.push(rel);
      let corpo = fs.readFileSync(file);
      const ext = path.extname(file).toLowerCase();
      if (rel === '/checkin.js' && o.scansione !== 'spenta') {
        corpo = Buffer.from(corpo.toString('utf8').replace("const SCANSIONE_DOCUMENTI = 'spenta';", "const SCANSIONE_DOCUMENTI = '" + o.scansione + "';"));
      }
      if (o.inietta && ext === '.html') corpo = Buffer.from(corpo.toString('utf8').replace('<head>', '<head>' + DEVIATORE));
      res.writeHead(200, { 'Content-Type': TIPI[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(corpo);
    } catch (e) {
      res.writeHead(500); res.end();
    }
  });
  await new Promise(ok => server.listen(o.porta, '127.0.0.1', ok));
  stato.base = 'http://127.0.0.1:' + server.address().port + '/';
  return { url: stato.base, stato, api, chiudi: () => new Promise(ok => server.close(ok)) };
}

module.exports = { avvia, API };

if (require.main === module) {
  const porta = parseInt(process.argv[2], 10) || 8765, scansione = process.argv[3] || 'prova';
  avvia({ porta, scansione, inietta: true }).then(s => {
    process.stdout.write('Check-in di prova su ' + s.url + (scansione === 'prova' ? '#scansione=prova' : '') + ' (scansione: ' + scansione + ', prenotazione di prova PROVA1)\n');
  });
}
