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

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Server di Browserless: di serie San Francisco (USA). Con BROWSERLESS_URL=https://production-ams.browserless.io (Amsterdam) o
// https://production-lon.browserless.io (Londra) l'HTML con i dati resta in Europa. Si accettano solo questi indirizzi: i dati degli
// ospiti non devono poter finire su un altro server per un errore di configurazione.
export function urlBrowserless(env) {
  const v = String((env && env.BROWSERLESS_URL) || '').trim().replace(/\/+$/, '');
  return /^https:\/\/production-(sfo|lon|ams)\.browserless\.io$/.test(v) ? v : 'https://production-sfo.browserless.io';
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
          <strong>📎 Documento allegato:</strong> ${escapeHtml(documento.nomeFile) || 'Documento'}
          (${Math.round((documento.dimensione || 0) / 1024)} KB) -
          <em>Vedi allegati email separati</em>
        </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: 'Arial', sans-serif; line-height: 1.3; color: #333; margin: 0; padding: 0; font-size: 11px; }
        .header { text-align: center; margin-bottom: 8px; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
        .header h1 { color: #2c3e50; font-size: 18px; margin: 0 0 4px 0; }
        .header p { font-size: 10px; margin: 0; color: #7f8c8d; }
        .section { margin: 6px 0; background: #f8f9fa; padding: 6px 8px; border-radius: 4px; border-left: 3px solid #3498db; }
        .section h2 { font-size: 13px; margin: 0 0 6px 0; color: #2c3e50; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 6px 0; }
        .info-item { background: white; padding: 5px 7px; border-radius: 3px; border: 1px solid #e9ecef; }
        .info-label { font-weight: bold; color: #495057; font-size: 9px; text-transform: uppercase; line-height: 1.2; }
        .info-value { color: #2c3e50; font-size: 11px; margin-top: 2px; line-height: 1.2; }
        .totale-section { background: #e8f5e8; border: 2px solid #28a745; padding: 8px; border-radius: 4px; text-align: center; margin: 6px 0; }
        .totale-section h2 { font-size: 13px; margin: 0 0 6px 0; color: #28a745; }
        .totale-amount { font-size: 20px; font-weight: bold; color: #28a745; margin: 4px 0; }
        .ospite { background: white; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; margin: 6px 0; page-break-inside: avoid; }
        .ospite.responsabile { border-color: #28a745; background: #f8fff9; }
        .ospite-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #dee2e6; }
        .ospite-nome { font-size: 13px; font-weight: bold; color: #2c3e50; }
        .ospite-badge { background: #28a745; color: white; padding: 2px 8px; border-radius: 10px; font-size: 9px; }
        .ospite-number { background: #6c757d; color: white; padding: 2px 8px; border-radius: 10px; font-size: 9px; }
        .ospite .info-grid { grid-template-columns: 1fr 1fr; gap: 5px; }
        .ospite .info-item { padding: 4px 6px; }
        .ospite .info-label { font-size: 8px; }
        .ospite .info-value { font-size: 10px; }
        .documento-note { background: #fff3cd; border: 1px solid #ffc107; padding: 5px 7px; border-radius: 3px; margin-top: 6px; font-size: 9px; }
        .section ul { margin: 6px 0 0 0; padding-left: 18px; }
        .section li { font-size: 10px; margin: 3px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Riepilogo Check-in</h1>
        <p>Generato il ${new Date().toLocaleString('it-IT')}</p>
      </div>

      <div class="section">
        <h2>📍 Dettagli Soggiorno</h2>
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
        <h2>💰 Totale Tassa di Soggiorno</h2>
        <div class="totale-amount">€${totale.toFixed(2)}</div>
      </div>

      <div class="section">
        <h2>👥 Ospiti Registrati (${ospiti.length})</h2>
      </div>

      ${ospitiHTML}

      ${documentiValidi.length > 0 ? `
      <div class="section" style="page-break-before: auto;">
        <h2>📎 Documenti Allegati</h2>
        <p style="font-size: 10px; margin: 4px 0;">I documenti di identità sono allegati separatamente a questa email:</p>
        <ul>
          ${documentiValidi.map(doc => `
            <li><strong>Ospite ${escapeHtml(doc.ospiteNumero) || '?'}:</strong> ${escapeHtml(doc.nomeFile)} (~${Math.round((doc.dimensione || 0) / 1024)} KB)</li>
          `).join('')}
        </ul>
      </div>
      ` : `
      <div class="section" style="page-break-before: auto;">
        <h2>📎 Documenti</h2>
        <p style="font-size: 10px; margin: 4px 0; color: #e74c3c;">Nessun documento allegato ricevuto.</p>
      </div>
      `}
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
