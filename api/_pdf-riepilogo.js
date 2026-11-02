// api/_pdf-riepilogo.js — PDF di riepilogo del check-in per il gestore (RIPRISTINATO su sua richiesta, 27/10/2026),
// per confrontare i dati inseriti dall'ospite con l'immagine del documento.
//
// Modulo interno (prefisso "_", nessun endpoint): l'ex endpoint api/genera-pdf-email.js non torna perché il piano Vercel
// Hobby ammette al massimo 12 funzioni. Il modello HTML e la chiamata a Browserless sono quelli della versione
// precedente (copiati da genera-pdf-email.js, commit c863f6a), con due sole differenze: il token arriva come parametro
// e i messaggi di errore/log non riportano contenuti.
// Privacy: per generare il PDF l'HTML con TUTTI i dati degli ospiti viene inviato a Browserless (servizio esterno):
// è un responsabile del trattamento da verificare (art. 28 GDPR). Variabile richiesta: BROWSERLESS_API_TOKEN.
import { calcolaEta } from './_sheet-checkin.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Aspetto del sito (02/11/2026, su richiesta del gestore): bordeaux, oro e crema di La Columbera, logo in testata e i caratteri del sito
// (Fraunces per i titoli, Manrope per il testo). Logo e caratteri sono i file già pubblicati in public/ (come il logo dell'email
// all'ospite, api/invia-email-ospite.js) e vanno nel PDF come data: URI, così Browserless non scarica nulla. Se un file non si legge
// il PDF si genera lo stesso: al posto del logo la scritta «La Columbera», al posto dei caratteri Georgia e Helvetica.
const C = { wine: '#7A2E39', wine2: '#5F222B', ink: '#1E1917', muted: '#6C5F55', paper: '#FAF5EC', paper2: '#F1E9D9', stone: '#E6DBC6', line: '#DCCFB6', gold: '#B08D3C', oro: '#806120', white: '#FFFDF7' };
let risorse = null;
function risorseSito() {
  if (risorse) return risorse;
  // prima accanto al modulo (../public: così il file segue la funzione su Vercel e si trova anche nelle prove), poi dalla radice del progetto
  const leggi = (rel, mime) => { for (const f of [() => new URL('../public/' + rel, import.meta.url), () => join(process.cwd(), 'public', rel)]) { try { return 'data:' + mime + ';base64,' + readFileSync(f()).toString('base64'); } catch {} } return ''; };
  risorse = { logo: leggi('img/brand/email-logo.png', 'image/png'), fraunces: leggi('fonts/fraunces-latin-full-normal.woff2', 'font/woff2'), manrope: leggi('fonts/manrope-latin-wght-normal.woff2', 'font/woff2') };
  return risorse;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Server di Browserless: di serie Amsterdam (UE), come dichiarato nell'informativa privacy. BROWSERLESS_URL può indicare
// production-lon (Londra) o production-sfo (San Francisco, USA: in quel caso va aggiornata l'informativa). Si accettano solo questi
// indirizzi: i dati degli ospiti non devono poter finire su un altro server per un errore di configurazione.
export function urlBrowserless(env) {
  const v = String((env && env.BROWSERLESS_URL) || '').trim().replace(/\/+$/, '');
  return /^https:\/\/production-(sfo|lon|ams)\.browserless\.io$/.test(v) ? v : 'https://production-ams.browserless.io';
}

async function generaPDFConBrowserless(htmlContent, browserlessToken, env) {

  if (!browserlessToken) {
    throw new Error('BROWSERLESS_API_TOKEN non configurato');
  }

  const url = `${urlBrowserless(env)}/pdf?token=${browserlessToken}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify({
      html: htmlContent,
      options: {
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
        printBackground: true,
        scale: 1
      }
    })
  });

  if (!response.ok) {
    await response.text().catch(() => {});      // si legge comunque (chiude la connessione), ma il testo non va nei messaggi di errore: potrebbe riportare parti del contenuto
    throw new Error(`Browserless error (${response.status})`);
  }

  const pdfBuffer = await response.arrayBuffer();
  return Buffer.from(pdfBuffer);
}

function generaHTMLRiepilogo(dati) {
  const dataFormattata = new Date(dati.dataCheckin).toLocaleDateString('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const documentiValidi = Array.isArray(dati.documenti) ? dati.documenti : [];
  const totale = typeof dati.totale === 'string' ? parseFloat(dati.totale) : (dati.totale || 0);
  const ospiti = Array.isArray(dati.ospiti) ? dati.ospiti : [];


  // ✅ Genera HTML per TUTTI gli ospiti (non solo ospite 1), uno dietro l'altro:
  // nessun page-break forzato ogni 2 ospiti. "page-break-inside: avoid" su
  // .ospite (vedi CSS sotto) evita solo che UNA scheda venga tagliata a metà
  // tra due pagine; il resto del flusso lo decide il renderer in base allo
  // spazio disponibile, come per qualunque contenuto continuo.
  const ospitiHTML = ospiti.map((ospite) => {
    // Cerca documento per questo ospite specifico
    const documento = documentiValidi.find(d => d && d.ospiteNumero === ospite.numero);

    return `
      <div class="ospite ${ospite.isResponsabile ? 'responsabile' : ''}">
        <div class="ospite-header">
          <div class="ospite-nome">${escapeHtml(ospite.cognome) || 'N/A'} ${escapeHtml(ospite.nome) || 'N/A'}</div>
          ${ospite.isResponsabile
            ? '<div class="ospite-badge">RESPONSABILE</div>'
            : `<div class="ospite-number">Ospite ${escapeHtml(ospite.numero)}</div>`
          }
        </div>

        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Genere</div>
            <div class="info-value">${ospite.genere === 'M' ? 'Maschio' : ospite.genere === 'F' ? 'Femmina' : 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Data Nascita</div>
            <div class="info-value">${ospite.nascita ? new Date(ospite.nascita).toLocaleDateString('it-IT') : 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Età</div>
            <div class="info-value">${ospite.eta || 0} anni ${(ospite.eta || 0) >= 4 ? '(tassabile)' : '(esente)'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Cittadinanza</div>
            <div class="info-value">${escapeHtml(ospite.cittadinanza) || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Luogo Nascita</div>
            <div class="info-value">${escapeHtml(ospite.luogoNascita) || 'N/A'}</div>
          </div>
          ${ospite.comune && ospite.provincia ? `
          <div class="info-item">
            <div class="info-label">Comune/Provincia</div>
            <div class="info-value">${escapeHtml(ospite.comune)} (${escapeHtml(ospite.provincia)})</div>
          </div>
          ` : ''}
        </div>

        ${ospite.isResponsabile && ospite.tipoDocumento ? `
        <div class="info-grid" style="margin-top: 10px;">
          <div class="info-item">
            <div class="info-label">Tipo Documento</div>
            <div class="info-value">${escapeHtml(ospite.tipoDocumento)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Numero Documento</div>
            <div class="info-value">${escapeHtml(ospite.numeroDocumento) || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Luogo Rilascio</div>
            <div class="info-value">${escapeHtml(ospite.luogoRilascio) || 'N/A'}</div>
          </div>
        </div>
        ` : ''}

        ${documento ? `
        <div class="documento-note">
          <strong>Documento allegato:</strong> ${escapeHtml(documento.nomeFile) || 'Documento'}
          (${Math.round((documento.dimensione || 0) / 1024)} KB) -
          <em>Vedi allegati email separati</em>
        </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const R = risorseSito();
  const font = [R.fraunces && `@font-face { font-family: 'Fraunces'; font-weight: 100 900; src: url(${R.fraunces}) format('woff2'); }`,
    R.manrope && `@font-face { font-family: 'Manrope'; font-weight: 200 800; src: url(${R.manrope}) format('woff2'); }`].filter(Boolean).join('\n        ');
  const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif", SANS = "'Manrope', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <style>
        ${font}
        @page { size: A4; margin: 12mm; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: ${SANS}; line-height: 1.35; color: ${C.ink}; margin: 0; padding: 0; font-size: 11px; background: ${C.white}; }
        .header { background: ${C.wine2}; border-radius: 10px 10px 0 0; text-align: center; padding: 14px 16px 12px; }
        .header img { display: block; width: 190px; height: auto; margin: 0 auto; }
        .header .marchio { font-family: ${SERIF}; font-size: 22px; color: ${C.paper2}; }
        .riga-oro { height: 3px; background: ${C.gold}; margin-bottom: 12px; }
        .titolo { text-align: center; margin: 4px 0 10px; }
        .titolo .eyebrow { font-size: 9px; letter-spacing: 2.4px; text-transform: uppercase; color: ${C.gold}; font-weight: 700; }
        .titolo h1 { font-family: ${SERIF}; font-weight: 400; font-size: 22px; line-height: 1.2; margin: 4px 0 2px; color: ${C.ink}; }
        .titolo p { font-size: 9.5px; margin: 0; color: ${C.muted}; }
        .section { margin: 8px 0; background: ${C.paper}; padding: 8px 10px; border-radius: 8px; border-left: 3px solid ${C.gold}; }
        .section h2 { font-size: 9.5px; letter-spacing: 1.8px; text-transform: uppercase; margin: 0 0 6px 0; color: ${C.muted}; font-weight: 700; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 6px 0; }
        .info-item { background: ${C.white}; padding: 5px 8px; border-radius: 6px; border: 1px solid ${C.line}; }
        .info-label { font-weight: 700; color: ${C.muted}; font-size: 8.5px; letter-spacing: .6px; text-transform: uppercase; line-height: 1.2; }
        .info-value { color: ${C.ink}; font-size: 11px; font-weight: 600; margin-top: 2px; line-height: 1.25; }
        .totale-section { background: ${C.paper}; border: 1px dashed ${C.gold}; padding: 8px; border-radius: 10px; text-align: center; margin: 8px 0; }
        .totale-section h2 { font-size: 9.5px; letter-spacing: 1.8px; text-transform: uppercase; margin: 0 0 2px 0; color: ${C.muted}; font-weight: 700; }
        .totale-amount { font-family: ${SERIF}; font-size: 24px; font-weight: 400; color: ${C.oro}; margin: 2px 0; }
        .ospite { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 8px; padding: 8px 10px; margin: 6px 0; page-break-inside: avoid; }
        .ospite.responsabile { border-color: ${C.gold}; background: ${C.paper}; }
        .ospite-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px solid ${C.line}; }
        .ospite-nome { font-family: ${SERIF}; font-size: 14px; font-weight: 500; color: ${C.ink}; }
        .ospite-badge { background: ${C.wine2}; color: ${C.paper2}; padding: 2px 9px; border-radius: 999px; font-size: 8.5px; font-weight: 700; letter-spacing: .8px; }
        .ospite-number { background: ${C.stone}; color: ${C.ink}; padding: 2px 9px; border-radius: 999px; font-size: 8.5px; font-weight: 700; }
        .ospite .info-grid { grid-template-columns: 1fr 1fr; gap: 5px; }
        .ospite .info-item { padding: 4px 7px; }
        .ospite .info-label { font-size: 7.5px; }
        .ospite .info-value { font-size: 10px; }
        .documento-note { background: ${C.paper2}; border: 1px solid ${C.line}; padding: 5px 8px; border-radius: 6px; margin-top: 6px; font-size: 9px; }
        .section ul { margin: 6px 0 0 0; padding-left: 18px; }
        .section li { font-size: 10px; margin: 3px 0; }
        .avviso { color: ${C.wine}; font-weight: 600; }
        .piede { margin-top: 12px; padding-top: 7px; border-top: 1px solid ${C.line}; text-align: center; font-size: 8.5px; color: ${C.muted}; }
        .piede b { font-family: ${SERIF}; font-weight: 500; font-size: 10px; color: ${C.ink}; }
      </style>
    </head>
    <body>
      <div class="header">${R.logo ? `<img src="${R.logo}" alt="La Columbera">` : '<div class="marchio">La Columbera</div>'}</div>
      <div class="riga-oro"></div>
      <div class="titolo">
        <div class="eyebrow">Check-in online</div>
        <h1>Riepilogo Check-in</h1>
        <p>Generato il ${new Date().toLocaleString('it-IT')}</p>
      </div>

      <div class="section">
        <h2>Dettagli Soggiorno</h2>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Data Check-in</div>
            <div class="info-value">${dataFormattata}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Appartamento</div>
            <div class="info-value">${escapeHtml(dati.appartamento) || 'Non specificato'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Numero Ospiti</div>
            <div class="info-value">${escapeHtml(dati.numeroOspiti) || ospiti.length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Numero Notti</div>
            <div class="info-value">${escapeHtml(dati.numeroNotti) || 0}</div>
          </div>
        </div>
      </div>

      <div class="totale-section">
        <h2>Totale Tassa di Soggiorno</h2>
        <div class="totale-amount">€${totale.toFixed(2)}</div>
      </div>

      <div class="section">
        <h2>Ospiti Registrati (${ospiti.length})</h2>
      </div>

      ${ospitiHTML}

      ${documentiValidi.length > 0 ? `
      <div class="section" style="page-break-before: auto;">
        <h2>Documenti Allegati</h2>
        <p style="font-size: 10px; margin: 4px 0;">I documenti di identità sono allegati separatamente a questa email:</p>
        <ul>
          ${documentiValidi.map(doc => `
            <li><strong>Ospite ${escapeHtml(doc.ospiteNumero) || '?'}:</strong> ${escapeHtml(doc.nomeFile)} (~${Math.round((doc.dimensione || 0) / 1024)} KB)</li>
          `).join('')}
        </ul>
      </div>
      ` : `
      <div class="section" style="page-break-before: auto;">
        <h2>Documenti</h2>
        <p class="avviso" style="font-size: 10px; margin: 4px 0;">Nessun documento allegato ricevuto.</p>
      </div>
      `}
      <div class="piede"><b>La Columbera</b> · Dimora storica del XV secolo · Ravina, Trento</div>
    </body>
    </html>
  `;
}

// Prepara i dati nel formato del modello precedente e genera il PDF. Ritorna { filename, content, contentType }.
// `documenti` = allegati già preparati per l'email (nomi generici), solo per l'elenco nel PDF.
export async function generaPdfRiepilogo({ dati, metadata, allegati, env, oggi }) {
  const token = env.BROWSERLESS_API_TOKEN;
  if (!token) { const e = new Error('BROWSERLESS_API_TOKEN non configurato'); e.code = 'PDF_NON_CONFIGURATO'; throw e; }
  const d = oggi || new Date();
  const datiPdf = Object.assign({}, dati, {
    totale: parseFloat((metadata || {}).totale) || 0,
    ospiti: (dati.ospiti || []).slice().sort((a, b) => (a.numero || 0) - (b.numero || 0))
      .map(o => Object.assign({}, o, { eta: calcolaEta(o.nascita, d), isResponsabile: o.numero === 1 || o.isResponsabile === true })),
    documenti: (allegati || []).map(a => ({ ospiteNumero: 1, nomeFile: a.filename, dimensione: a.content.length }))
  });
  const content = await generaPDFConBrowserless(generaHTMLRiepilogo(datiPdf), token, env);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(dati.dataCheckin || '') ? dati.dataCheckin : 'riepilogo';
  return { filename: 'checkin-' + iso + '.pdf', content, contentType: 'application/pdf' };
}

export { generaHTMLRiepilogo, escapeHtml };
