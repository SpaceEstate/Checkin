// api/genera-pdf-email.js
// CORREZIONE: nodemailer.createTransport (non createTransporter)
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  console.log('📧 Inizio generazione PDF e invio email (Browserless)');

  try {
    const { datiPrenotazione, emailDestinatario } = req.body;

    if (!datiPrenotazione || !emailDestinatario) {
      return res.status(400).json({ 
        error: 'Dati prenotazione ed email destinatario sono obbligatori' 
      });
    }

    // ✅ CORREZIONE: Converti totale in numero se è stringa
    if (typeof datiPrenotazione.totale === 'string') {
      datiPrenotazione.totale = parseFloat(datiPrenotazione.totale);
    }
    
    // Validazione documenti
    if (!Array.isArray(datiPrenotazione.documenti)) {
      console.warn('⚠️ documenti non è un array, inizializzo array vuoto');
      datiPrenotazione.documenti = [];
    }
    
    console.log('📊 Dati validati:', {
      numeroOspiti: datiPrenotazione.ospiti?.length || 0,
      numeroDocumenti: datiPrenotazione.documenti.length,
      totale: datiPrenotazione.totale,
      tipoTotale: typeof datiPrenotazione.totale
    });

    // 1. Genera HTML per il PDF (SENZA documenti)
    const htmlContent = generaHTMLRiepilogo(datiPrenotazione);
    
    let pdfBuffer = null;
    let pdfGenerato = false;

    // 2. PROVA a generare PDF con Browserless (con gestione errori)
    try {
      console.log('🌐 Tentativo generazione PDF con Browserless...');
      pdfBuffer = await generaPDFConBrowserless(htmlContent);
      pdfGenerato = true;
      console.log('✅ PDF generato con successo');
    } catch (pdfError) {
      console.warn('⚠️ Impossibile generare PDF:', pdfError.message);
      console.log('📧 Procedo con invio email senza PDF');
    }
    
    // 3. Prepara allegati documenti
    const allegatiDocumenti = preparaAllegatiDocumenti(datiPrenotazione.documenti);
    console.log(`📎 Allegati documenti preparati: ${allegatiDocumenti.length}`);
    
    // 4. Invia email (con o senza PDF + documenti come allegati)
    console.log('📧 Invio email in corso...');
    if (pdfGenerato && pdfBuffer) {
      await inviaEmailConPDF(emailDestinatario, datiPrenotazione, pdfBuffer, allegatiDocumenti);
      console.log('✅ Email inviata CON PDF e documenti allegati');
    } else {
      await inviaEmailSenzaPDF(emailDestinatario, datiPrenotazione, allegatiDocumenti);
      console.log('✅ Email inviata SENZA PDF (solo testo + documenti)');
    }
    
    return res.status(200).json({ 
      success: true, 
      message: pdfGenerato 
        ? 'PDF generato e email inviata con successo' 
        : 'Email inviata con successo (PDF non disponibile)',
      pdfGenerato: pdfGenerato,
      numeroDocumenti: allegatiDocumenti.length
    });

  } catch (error) {
    console.error('❌ Errore finale:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Errore interno: ' + error.message 
    });
  }
}

// FUNZIONE: Prepara allegati documenti
function preparaAllegatiDocumenti(documenti) {
  if (!Array.isArray(documenti) || documenti.length === 0) {
    console.log('📎 Nessun documento da allegare');
    return [];
  }

  const allegati = [];
  
  documenti.forEach((doc, index) => {
    if (!doc.base64 || !doc.nomeFile) {
      console.warn(`⚠️ Documento ${index + 1} incompleto, saltato`);
      return;
    }

    try {
      // Rimuovi il prefixo data:image/...;base64, se presente
      let base64Data = doc.base64;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }

      // Converti base64 in Buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Determina il nome file con prefisso ospite
      const ospitePrefix = doc.ospiteNumero ? `Ospite_${doc.ospiteNumero}_` : '';
      const nomeFile = `${ospitePrefix}${doc.nomeFile}`;

      allegati.push({
        filename: nomeFile,
        content: buffer,
        contentType: doc.tipo || 'application/octet-stream'
      });

      console.log(`📎 Allegato preparato: ${nomeFile} (${(buffer.length / 1024).toFixed(2)} KB)`);

    } catch (error) {
      console.error(`❌ Errore preparazione documento ${index + 1}:`, error.message);
    }
  });

  return allegati;
}

// FUNZIONE: Genera PDF usando Browserless API
async function generaPDFConBrowserless(htmlContent) {
  const browserlessToken = process.env.BROWSERLESS_API_TOKEN;
  
  if (!browserlessToken) {
    throw new Error('BROWSERLESS_API_TOKEN non configurato nelle variabili ambiente');
  }

  try {
    console.log('📤 Invio richiesta a Browserless...');
    
    const url = `https://production-sfo.browserless.io/pdf?token=${browserlessToken}`;
    
    const requestBody = {
      html: htmlContent,
      options: {
        format: 'A4',
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm'
        },
        printBackground: true,
        scale: 1
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore Browserless:', errorText);
      throw new Error(`Browserless error (${response.status}): ${errorText}`);
    }

    const pdfBuffer = await response.arrayBuffer();
    const sizeKB = (pdfBuffer.byteLength / 1024).toFixed(2);
    console.log(`✅ PDF generato: ${sizeKB} KB`);
    
    return Buffer.from(pdfBuffer);
    
  } catch (error) {
    console.error('❌ Errore generazione PDF:', error.message);
    throw error;
  }
}

// FUNZIONE: Genera HTML SENZA documenti embedded
function generaHTMLRiepilogo(dati) {
  const dataFormattata = new Date(dati.dataCheckin).toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const documentiValidi = Array.isArray(dati.documenti) ? dati.documenti : [];
  console.log(`📄 Documenti trovati: ${documentiValidi.length} (verranno allegati separatamente)`);

  // ✅ CORREZIONE: Converti totale in numero
  const totale = typeof dati.totale === 'string' ? parseFloat(dati.totale) : (dati.totale || 0);

  // Genera HTML ospiti con page-break corretto
  const ospitiHTML = (dati.ospiti || []).map((ospite, index) => {
    // ✅ CERCA DOCUMENTO SOLO PER OSPITE 1
    const documento = (index === 0 && documentiValidi.length > 0) 
      ? documentiValidi.find(d => d && d.ospiteNumero === 1) 
      : null;
    
    // ✅ CORREZIONE: Ospite 1 da solo in pag 1, poi 3 ospiti per pagina
// Pag 1: Dettagli + Ospite 1
// Pag 2: Ospite 2 e 3 (break prima del 2)
// Pag 3: Ospite 4 e 5 (break prima del 4)
// Pag 4: Ospite 6 e 7 (break prima del 6)
// Pag 5: Ospite 8 e 9 (break prima del 8)
const needsPageBreak = index === 1 || index === 4 || index === 7;
    
    return `
      <div class="ospite ${ospite.isResponsabile ? 'responsabile' : ''}" ${needsPageBreak ? 'style="page-break-before: always;"' : ''}>
        <div class="ospite-header">
          <div class="ospite-nome">
            ${ospite.cognome || 'N/A'} ${ospite.nome || 'N/A'}
          </div>
          ${ospite.isResponsabile ? '<div class="ospite-badge">RESPONSABILE</div>' : `<div class="ospite-number">Ospite ${ospite.numero}</div>`}
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
            <div class="info-value">${ospite.cittadinanza || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Luogo Nascita</div>
            <div class="info-value">${ospite.luogoNascita || 'N/A'}</div>
          </div>
          ${ospite.comune && ospite.provincia ? `
          <div class="info-item">
            <div class="info-label">Comune/Provincia</div>
            <div class="info-value">${ospite.comune} (${ospite.provincia})</div>
          </div>
          ` : ''}
        </div>
        
        ${ospite.isResponsabile && ospite.tipoDocumento ? `
        <div class="info-grid" style="margin-top: 10px;">
          <div class="info-item">
            <div class="info-label">Tipo Documento</div>
            <div class="info-value">${ospite.tipoDocumento}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Numero Documento</div>
            <div class="info-value">${ospite.numeroDocumento || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Luogo Rilascio</div>
            <div class="info-value">${ospite.luogoRilascio || 'N/A'}</div>
          </div>
        </div>
        ` : ''}
        
        ${documento ? `
        <div class="documento-note">
          <strong>📎 Documento allegato:</strong> ${documento.nomeFile || 'Documento'} 
          (${Math.round(documento.dimensione / 1024)} KB) - 
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

/* Header compatto */
.header { 
  text-align: center; 
  margin-bottom: 8px; 
  border-bottom: 2px solid #3498db; 
  padding-bottom: 8px; 
}
.header h1 { 
  color: #2c3e50; 
  font-size: 18px; 
  margin: 0 0 4px 0; 
  line-height: 1.2;
}
.header p {
  font-size: 10px;
  margin: 0;
  color: #7f8c8d;
}

/* Sezioni compatte */
.section { 
  margin: 6px 0; 
  background: #f8f9fa; 
  padding: 6px 8px; 
  border-radius: 4px; 
  border-left: 3px solid #3498db; 
}
.section h2 {
  font-size: 13px;
  margin: 0 0 6px 0;
  color: #2c3e50;
}

/* Grid info compatto */
.info-grid { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 6px; 
  margin: 6px 0; 
}
.info-item { 
  background: white; 
  padding: 5px 7px; 
  border-radius: 3px; 
  border: 1px solid #e9ecef; 
}
.info-label { 
  font-weight: bold; 
  color: #495057; 
  font-size: 9px; 
  text-transform: uppercase; 
  line-height: 1.2;
}
.info-value { 
  color: #2c3e50; 
  font-size: 11px; 
  margin-top: 2px;
  line-height: 1.2;
}

/* Totale compatto */
.totale-section { 
  background: #e8f5e8; 
  border: 2px solid #28a745; 
  padding: 8px; 
  border-radius: 4px; 
  text-align: center; 
  margin: 6px 0; 
}
.totale-section h2 {
  font-size: 13px;
  margin: 0 0 6px 0;
  color: #28a745;
}
.totale-amount { 
  font-size: 20px; 
  font-weight: bold; 
  color: #28a745; 
  margin: 4px 0; 
  line-height: 1;
}

/* Ospiti compatti */
.ospite { 
  background: white; 
  border: 1px solid #dee2e6; 
  border-radius: 4px; 
  padding: 8px; 
  margin: 6px 0; 
  page-break-inside: avoid;
}
.ospite.responsabile { 
  border-color: #28a745; 
  background: #f8fff9; 
}
.ospite-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  margin-bottom: 6px; 
  padding-bottom: 4px;
  border-bottom: 1px solid #dee2e6; 
}
.ospite-nome { 
  font-size: 13px; 
  font-weight: bold; 
  color: #2c3e50; 
  line-height: 1.2;
}
.ospite-badge { 
  background: #28a745; 
  color: white; 
  padding: 2px 8px; 
  border-radius: 10px; 
  font-size: 9px; 
  white-space: nowrap;
}
.ospite-number { 
  background: #6c757d; 
  color: white; 
  padding: 2px 8px; 
  border-radius: 10px; 
  font-size: 9px; 
}

/* Grid ospite compatto */
.ospite .info-grid {
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}
.ospite .info-item {
  padding: 4px 6px;
}
.ospite .info-label {
  font-size: 8px;
  margin-bottom: 1px;
}
.ospite .info-value {
  font-size: 10px;
}

/* Documento note compatto */
.documento-note { 
  background: #fff3cd; 
  border: 1px solid #ffc107; 
  padding: 5px 7px; 
  border-radius: 3px; 
  margin-top: 6px; 
  font-size: 9px; 
  line-height: 1.3;
}

/* Sezione documenti allegati */
.section ul {
  margin: 6px 0 0 0;
  padding-left: 18px;
}
.section li {
  font-size: 10px;
  margin: 3px 0;
  line-height: 1.3;
}
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
            <div class="info-value">${dati.appartamento || 'Non specificato'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Numero Ospiti</div>
            <div class="info-value">${dati.numeroOspiti || 0}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Numero Notti</div>
            <div class="info-value">${dati.numeroNotti || 0}</div>
          </div>
        </div>
      </div>

      <div class="totale-section">
        <h2>💰 Totale Tassa di Soggiorno</h2>
        <div class="totale-amount">€${totale.toFixed(2)}</div>
      </div>

      <div class="section">
        <h2>👥 Ospiti Registrati</h2>
      </div>

      ${ospitiHTML}

${documento ? `
    <div class="documento-note">
      <strong>📎 Documento allegato:</strong> ${documento.nomeFile || 'Documento'} 
      (${Math.round(documento.dimensione / 1024)} KB) - 
      <em>Vedi allegati email separati</em>
    </div>
    ` : (index === 0 ? `
    <div class="documento-note">
      <strong>⚠️ Documento non allegato</strong>
    </div>
    ` : '')}
    </body>
    </html>
  `;
}

// ✅ CORREZIONE: createTransport invece di createTransporter
async function inviaEmailConPDF(emailDestinatario, dati, pdfBuffer, allegatiDocumenti) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const totale = typeof dati.totale === 'string' ? parseFloat(dati.totale) : (dati.totale || 0);

  const oggetto = `Riepilogo Check-in - ${dati.appartamento || 'Appartamento'} - ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}`;
  
  const corpoEmail = `
Nuovo check-in ricevuto!

DETTAGLI SOGGIORNO:
- Data check-in: ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}
- Appartamento: ${dati.appartamento || 'Non specificato'}
- Ospiti: ${dati.numeroOspiti || 0}
- Notti: ${dati.numeroNotti || 0}
- Totale tassa soggiorno: €${totale.toFixed(2)}

Responsabile: ${dati.ospiti?.[0]?.cognome || 'N/A'} ${dati.ospiti?.[0]?.nome || 'N/A'}

📎 ALLEGATI:
- Riepilogo completo (PDF)
${allegatiDocumenti.length > 0 ? `- ${allegatiDocumenti.length} documento/i di identità` : ''}

---
Sistema Check-in Automatico
  `;

  const allegati = [
    {
      filename: `checkin-${Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    },
    ...allegatiDocumenti
  ];

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: emailDestinatario,
    subject: oggetto,
    text: corpoEmail,
    attachments: allegati
  };

  await transporter.sendMail(mailOptions);
}

// ✅ CORREZIONE: createTransport invece di createTransporter
async function inviaEmailSenzaPDF(emailDestinatario, dati, allegatiDocumenti) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const totale = typeof dati.totale === 'string' ? parseFloat(dati.totale) : (dati.totale || 0);

  const oggetto = `Check-in Ricevuto - ${dati.appartamento || 'Appartamento'} - ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}`;
  
  let listaOspiti = '';
  (dati.ospiti || []).forEach((ospite, index) => {
    listaOspiti += `
${index + 1}. ${ospite.cognome} ${ospite.nome}${ospite.isResponsabile ? ' (RESPONSABILE)' : ''}
   - Genere: ${ospite.genere === 'M' ? 'Maschio' : 'Femmina'}
   - Età: ${ospite.eta || 0} anni
   - Cittadinanza: ${ospite.cittadinanza || 'N/A'}
`;
  });
  
  const corpoEmail = `
Nuovo check-in ricevuto!

⚠️ NOTA: Il PDF non è stato generato. Di seguito i dettagli completi.

═══════════════════════════════════════
DETTAGLI SOGGIORNO
═══════════════════════════════════════
Data check-in: ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}
Appartamento: ${dati.appartamento || 'Non specificato'}
Numero ospiti: ${dati.numeroOspiti || 0}
Numero notti: ${dati.numeroNotti || 0}
Totale tassa soggiorno: €${totale.toFixed(2)}

═══════════════════════════════════════
OSPITI REGISTRATI
═══════════════════════════════════════
${listaOspiti}

${allegatiDocumenti.length > 0 ? `
═══════════════════════════════════════
DOCUMENTI ALLEGATI: ${allegatiDocumenti.length}
═══════════════════════════════════════
${allegatiDocumenti.map(doc => `- ${doc.filename}`).join('\n')}
` : ''}

---
Sistema Check-in Automatico
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: emailDestinatario,
    subject: oggetto,
    text: corpoEmail,
    attachments: allegatiDocumenti
  };

  await transporter.sendMail(mailOptions);
}
