// api/genera-pdf-email.js
// VERSIONE AGGIORNATA: documenti come allegati separati, non nel PDF
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
    return res.status(500).json({ 
      error: 'Errore interno: ' + error.message 
    });
  }
}

// NUOVA FUNZIONE: Prepara allegati documenti
function preparaAllegatiDocumenti(documenti) {
  if (!Array.isArray(documenti) || documenti.length === 0) {
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
  
  console.log('🔍 DEBUG Token:', {
    isDefined: !!browserlessToken,
    length: browserlessToken?.length || 0,
    first10: browserlessToken?.substring(0, 10) || 'N/A'
  });
  
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

    console.log('📦 Request body size:', JSON.stringify(requestBody).length, 'bytes');
    
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

// FUNZIONE AGGIORNATA: Genera HTML SENZA documenti embedded con layout ottimizzato per la stampa
function generaHTMLRiepilogo(dati) {
  const dataFormattata = new Date(dati.dataCheckin).toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const documentiValidi = Array.isArray(dati.documenti) ? dati.documenti : [];
  console.log(`📄 Documenti trovati: ${documentiValidi.length} (verranno allegati separatamente)`);

  // Genera HTML ospiti con page-break intelligenti
  const ospitiHTML = (dati.ospiti || []).map((ospite, index) => {
    const documento = documentiValidi.find(d => 
      d && d.ospiteNumero && d.ospiteNumero === ospite.numero
    );
    
    // Page break ogni 2 ospiti (tranne il primo che sta con i dettagli)
    const needsPageBreak = index > 0 && index % 2 === 0;
    
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
        @page {
          size: A4;
          margin: 15mm;
        }
        
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.4;
          color: #333;
          margin: 0;
          padding: 0;
        }
        
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 3px solid #3498db;
          padding-bottom: 15px;
          page-break-after: avoid;
        }
        
        .header h1 {
          color: #2c3e50;
          font-size: 24px;
          margin: 0 0 8px 0;
        }
        
        .header p {
          margin: 0;
          font-size: 12px;
          color: #666;
        }
        
        .section {
          margin: 15px 0;
          background: #f8f9fa;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #3498db;
          page-break-inside: avoid;
        }
        
        .section h2 {
          color: #2c3e50;
          font-size: 16px;
          margin: 0 0 12px 0;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 10px 0;
        }
        
        .info-item {
          background: white;
          padding: 8px 10px;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }
        
        .info-label {
          font-weight: bold;
          color: #495057;
          font-size: 10px;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        
        .info-value {
          color: #2c3e50;
          font-size: 13px;
        }
        
        .ospite {
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 6px;
          padding: 15px;
          margin: 12px 0;
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
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #dee2e6;
        }
        
        .ospite-nome {
          font-size: 16px;
          font-weight: bold;
          color: #2c3e50;
        }
        
        .ospite-badge {
          background: #28a745;
          color: white;
          padding: 3px 10px;
          border-radius: 15px;
          font-size: 11px;
          font-weight: bold;
        }
        
        .ospite-number {
          background: #3498db;
          color: white;
          padding: 3px 10px;
          border-radius: 15px;
          font-size: 11px;
          font-weight: bold;
        }
        
        .documento-note {
          margin-top: 10px;
          padding: 10px;
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          border-radius: 4px;
          font-size: 12px;
        }
        
        .documento-note strong {
          color: #856404;
        }
        
        .totale-section {
          background: #e8f5e8;
          border: 2px solid #28a745;
          padding: 15px;
          border-radius: 6px;
          text-align: center;
          margin: 15px 0;
          page-break-inside: avoid;
          page-break-before: auto;
        }
        
        .totale-section h2 {
          margin: 0 0 8px 0;
          font-size: 16px;
        }
        
        .totale-amount {
          font-size: 28px;
          font-weight: bold;
          color: #28a745;
          margin: 8px 0;
        }
        
        .allegati-section {
          margin: 15px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 4px solid #3498db;
          page-break-inside: avoid;
        }
        
        .allegati-section h2 {
          color: #2c3e50;
          font-size: 16px;
          margin: 0 0 10px 0;
        }
        
        .allegati-section ul {
          margin: 8px 0;
          padding-left: 20px;
        }
        
        .allegati-section li {
          margin: 4px 0;
          font-size: 12px;
        }
        
        .footer {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #dee2e6;
          text-align: center;
          color: #6c757d;
          font-size: 10px;
          page-break-inside: avoid;
        }
        
        /* Regole per la stampa */
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .ospite {
            page-break-inside: avoid;
          }
          
          .section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Riepilogo Check-in</h1>
        <p>Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</p>
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
        <div class="totale-amount">€${(dati.totale || 0).toFixed(2)}</div>
        <div style="font-size: 11px; color: #666; margin-top: 8px;">
          Tassa di €1,50 per notte per ospiti dai 4 anni in su
        </div>
      </div>

      <div class="section" style="margin-top: 20px;">
        <h2>👥 Ospiti Registrati</h2>
      </div>

      ${ospitiHTML}

      ${documentiValidi.length > 0 ? `
      <div class="allegati-section" style="page-break-before: auto;">
        <h2>📎 Documenti Allegati</h2>
        <p style="margin: 8px 0; color: #666; font-size: 12px;">
          I documenti di identità sono allegati separatamente a questa email:
        </p>
        <ul>
          ${documentiValidi.map(doc => `
            <li>
              <strong>Ospite ${doc.ospiteNumero}:</strong> ${doc.nomeFile} 
              (${Math.round(doc.dimensione / 1024)} KB)
            </li>
          `).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="footer">
        <p>Documento generato automaticamente dal sistema di check-in</p>
        <p>${new Date().toLocaleString('it-IT')}</p>
      </div>
    </body>
    </html>
  `;
}

// FUNZIONE AGGIORNATA: Invia email CON PDF + documenti come allegati separati
async function inviaEmailConPDF(emailDestinatario, dati, pdfBuffer, allegatiDocumenti) {
  const transporter = nodemailer.createTransport({
    service: 'yahoo',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const oggetto = `Riepilogo Check-in - ${dati.appartamento || 'Appartamento'} - ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}`;
  
  const corpoEmail = `
Nuovo check-in ricevuto!

DETTAGLI SOGGIORNO:
- Data check-in: ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}
- Appartamento: ${dati.appartamento || 'Non specificato'}
- Ospiti: ${dati.numeroOspiti || 0}
- Notti: ${dati.numeroNotti || 0}
- Totale tassa soggiorno: €${(dati.totale || 0).toFixed(2)}

Responsabile: ${dati.ospiti?.[0]?.cognome || 'N/A'} ${dati.ospiti?.[0]?.nome || 'N/A'}

📎 ALLEGATI:
- Riepilogo completo (PDF)
${allegatiDocumenti.length > 0 ? `- ${allegatiDocumenti.length} documento/i di identità` : ''}

---
Sistema Check-in Automatico
  `;

  // Prepara array allegati: PDF + documenti
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

// FUNZIONE AGGIORNATA: Invia email SENZA PDF ma CON documenti allegati
async function inviaEmailSenzaPDF(emailDestinatario, dati, allegatiDocumenti) {
  const transporter = nodemailer.createTransport({
    service: 'yahoo',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const oggetto = `Check-in Ricevuto - ${dati.appartamento || 'Appartamento'} - ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}`;
  
  // Genera lista ospiti dettagliata
  let listaOspiti = '';
  (dati.ospiti || []).forEach((ospite, index) => {
    listaOspiti += `
${index + 1}. ${ospite.cognome} ${ospite.nome}${ospite.isResponsabile ? ' (RESPONSABILE)' : ''}
   - Genere: ${ospite.genere === 'M' ? 'Maschio' : 'Femmina'}
   - Data nascita: ${ospite.nascita ? new Date(ospite.nascita).toLocaleDateString('it-IT') : 'N/A'}
   - Età: ${ospite.eta || 0} anni
   - Cittadinanza: ${ospite.cittadinanza || 'N/A'}
   - Luogo nascita: ${ospite.luogoNascita || 'N/A'}${ospite.comune ? ` (${ospite.comune}, ${ospite.provincia})` : ''}${ospite.isResponsabile && ospite.tipoDocumento ? `
   - Documento: ${ospite.tipoDocumento} - ${ospite.numeroDocumento || 'N/A'}
   - Luogo rilascio: ${ospite.luogoRilascio || 'N/A'}` : ''}
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
Totale tassa soggiorno: €${(dati.totale || 0).toFixed(2)}

═══════════════════════════════════════
OSPITI REGISTRATI
═══════════════════════════════════════
${listaOspiti}

═══════════════════════════════════════
RESPONSABILE DELLA PRENOTAZIONE
═══════════════════════════════════════
Nome: ${dati.ospiti?.[0]?.nome || 'N/A'}
Cognome: ${dati.ospiti?.[0]?.cognome || 'N/A'}
Luogo nascita: ${dati.ospiti?.[0]?.luogoNascita || 'N/A'}
${dati.ospiti?.[0]?.tipoDocumento ? `Documento: ${dati.ospiti[0].tipoDocumento} - ${dati.ospiti[0].numeroDocumento}
Luogo rilascio: ${dati.ospiti[0].luogoRilascio || 'N/A'}` : ''}

${allegatiDocumenti.length > 0 ? `
═══════════════════════════════════════
DOCUMENTI ALLEGATI: ${allegatiDocumenti.length}
═══════════════════════════════════════
${allegatiDocumenti.map(doc => `- ${doc.filename}`).join('\n')}
` : ''}

---
Sistema Check-in Automatico
Generato il ${new Date().toLocaleString('it-IT')}
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
