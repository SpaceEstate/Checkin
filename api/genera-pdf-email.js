// api/genera-pdf-email.js
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Inizio generazione PDF e invio email');

  try {
    const { datiPrenotazione, emailDestinatario } = req.body;

    if (!datiPrenotazione || !emailDestinatario) {
      return res.status(400).json({ 
        error: 'Dati prenotazione ed email destinatario sono obbligatori' 
      });
    }

    // 1. Genera HTML per il PDF
    const htmlContent = generaHTMLRiepilogo(datiPrenotazione);
    
    // 2. Crea PDF con Puppeteer
    console.log('Generazione PDF in corso...');
    const pdfBuffer = await generaPDF(htmlContent);
    
    // 3. Invia email con PDF allegato
    console.log('Invio email in corso...');
    await inviaEmailConPDF(emailDestinatario, datiPrenotazione, pdfBuffer);
    
    console.log('PDF generato e email inviata con successo');
    
    return res.status(200).json({ 
      success: true, 
      message: 'PDF generato e email inviata con successo' 
    });

  } catch (error) {
    console.error('Errore generazione PDF/email:', error);
    return res.status(500).json({ 
      error: 'Errore interno: ' + error.message 
    });
  }
}

async function generaPDF(htmlContent) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

function generaHTMLRiepilogo(dati) {
  const dataFormattata = new Date(dati.dataCheckin).toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Validazione sicura dei documenti
  const documentiValidi = Array.isArray(dati.documenti) ? dati.documenti : [];
  console.log(`Documenti trovati: ${documentiValidi.length}`);

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 3px solid #3498db;
          padding-bottom: 20px;
        }
        
        .header h1 {
          color: #2c3e50;
          font-size: 28px;
          margin-bottom: 10px;
        }
        
        .header p {
          color: #7f8c8d;
          font-size: 14px;
        }
        
        .section {
          margin: 30px 0;
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #3498db;
        }
        
        .section h2 {
          color: #2c3e50;
          font-size: 20px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 15px 0;
        }
        
        .info-item {
          background: white;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }
        
        .info-label {
          font-weight: bold;
          color: #495057;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        
        .info-value {
          color: #2c3e50;
          font-size: 14px;
        }
        
        .ospite {
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 15px 0;
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
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #dee2e6;
        }
        
        .ospite-nome {
          font-size: 18px;
          font-weight: bold;
          color: #2c3e50;
        }
        
        .ospite-badge {
          background: #28a745;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .documento-section {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #dee2e6;
        }
        
        .documento-title {
          font-weight: bold;
          color: #495057;
          margin-bottom: 10px;
        }
        
        .documento-img {
          max-width: 100%;
          max-height: 300px;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          margin: 10px 0;
          display: block;
        }
        
        .documento-info {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          font-size: 12px;
          color: #6c757d;
        }
        
        .totale-section {
          background: #e8f5e8;
          border: 2px solid #28a745;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin: 30px 0;
        }
        
        .totale-amount {
          font-size: 32px;
          font-weight: bold;
          color: #28a745;
          margin: 10px 0;
        }
        
        .note {
          font-size: 12px;
          color: #6c757d;
          font-style: italic;
          margin-top: 10px;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
          text-align: center;
          color: #6c757d;
          font-size: 12px;
        }
        
        @media print {
          .documento-img {
            max-height: 250px;
          }
          
          .page-break {
            page-break-before: always;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Riepilogo Check-in</h1>
        <p>Generato automaticamente il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</p>
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
          ${dati.tipoGruppo ? `
          <div class="info-item">
            <div class="info-label">Tipo Gruppo</div>
            <div class="info-value">${dati.tipoGruppo}</div>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <h2>Ospiti Registrati</h2>
        ${(dati.ospiti || []).map((ospite, index) => {
          // Trova documento corrispondente con validazione sicura
          const documento = documentiValidi.find(d => 
            d && d.ospiteNumero && d.ospiteNumero === ospite.numero
          );
          
          return `
            <div class="ospite ${ospite.isResponsabile ? 'responsabile' : ''}">
              <div class="ospite-header">
                <div class="ospite-nome">
                  ${ospite.cognome || 'N/A'} ${ospite.nome || 'N/A'}
                </div>
                ${ospite.isResponsabile ? '<div class="ospite-badge">RESPONSABILE</div>' : ''}
              </div>
              
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Genere</div>
                  <div class="info-value">${ospite.genere === 'M' ? 'Maschio' : ospite.genere === 'F' ? 'Femmina' : 'Non specificato'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Data di Nascita</div>
                  <div class="info-value">${ospite.nascita ? new Date(ospite.nascita).toLocaleDateString('it-IT') : 'Non specificata'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Età</div>
                  <div class="info-value">${ospite.eta || 0} anni ${(ospite.eta || 0) >= 4 ? '(soggetto a tassa)' : '(esente da tassa)'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Cittadinanza</div>
                  <div class="info-value">${ospite.cittadinanza || 'Non specificata'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Luogo di Nascita</div>
                  <div class="info-value">${ospite.luogoNascita || 'Non specificato'}</div>
                </div>
                ${ospite.comune ? `
                <div class="info-item">
                  <div class="info-label">Comune</div>
                  <div class="info-value">${ospite.comune} (${ospite.provincia || 'N/A'})</div>
                </div>
                ` : ''}
              </div>
              
              ${ospite.isResponsabile && ospite.tipoDocumento ? `
              <div class="info-grid" style="margin-top: 15px;">
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
              <div class="documento-section">
                <div class="documento-title">Documento di Identità</div>
                <div class="documento-info">
                  <strong>File:</strong> ${documento.nomeFile || 'Documento caricato'}<br>
                  <strong>Tipo:</strong> ${documento.tipo || 'N/A'}<br>
                  <strong>Dimensione:</strong> ${documento.dimensione ? Math.round(documento.dimensione / 1024) + ' KB' : 'N/A'}
                </div>
                ${documento.base64 ? `
                <img src="${documento.base64}" alt="Documento ${ospite.cognome} ${ospite.nome}" class="documento-img" />
                ` : '<p style="color: #dc3545;">Documento non disponibile</p>'}
              </div>
              ` : '<div class="documento-section"><p style="color: #ffc107;">Nessun documento caricato</p></div>'}
            </div>
          `;
        }).join('')}
      </div>

      <div class="totale-section">
        <h2>Totale Tassa di Soggiorno</h2>
        <div class="totale-amount">€${(dati.totale || 0).toFixed(2)}</div>
        <div class="note">
          Tassa di €1,50 per notte per ospiti dai 4 anni in su<br>
          Calcolata su ${(dati.ospiti || []).filter(o => (o.eta || 0) >= 4).length} ospiti soggetti × ${dati.numeroNotti || 0} notti
        </div>
      </div>

      <div class="footer">
        <p>Documento generato automaticamente dal sistema di check-in</p>
        <p>Data/ora generazione: ${new Date().toLocaleString('it-IT')}</p>
        ${dati.timestamp ? `<p>ID Pratica: ${dati.timestamp.slice(-10)}</p>` : ''}
      </div>
    </body>
    </html>
  `;
}

async function inviaEmailConPDF(emailDestinatario, dati, pdfBuffer) {
  // CORREZIONE: createTransport invece di createTransporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
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

    Il PDF allegato contiene tutti i dati inseriti e i documenti caricati dagli ospiti.

    Responsabile: ${dati.ospiti?.[0]?.cognome || 'N/A'} ${dati.ospiti?.[0]?.nome || 'N/A'}

    Sistema Check-in Automatico
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: emailDestinatario,
    subject: oggetto,
    text: corpoEmail,
    attachments: [
      {
        filename: `checkin-${Date.now()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  await transporter.sendMail(mailOptions);
}
