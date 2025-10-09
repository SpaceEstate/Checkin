// api/genera-pdf-email.js
// VERSIONE BROWSERLESS - Funziona su Vercel!
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

    // 1. Genera HTML per il PDF
    const htmlContent = generaHTMLRiepilogo(datiPrenotazione);
    
    // 2. Genera PDF con Browserless
    console.log('🌐 Generazione PDF con Browserless...');
    const pdfBuffer = await generaPDFConBrowserless(htmlContent);
    
    // 3. Invia email con PDF allegato
    console.log('📧 Invio email in corso...');
    await inviaEmailConPDF(emailDestinatario, datiPrenotazione, pdfBuffer);
    
    console.log('✅ PDF generato e email inviata con successo');
    
    return res.status(200).json({ 
      success: true, 
      message: 'PDF generato e email inviata con successo' 
    });

  } catch (error) {
    console.error('❌ Errore:', error);
    return res.status(500).json({ 
      error: 'Errore interno: ' + error.message 
    });
  }
}

// FUNZIONE: Genera PDF usando Browserless API
async function generaPDFConBrowserless(htmlContent) {
  const browserlessToken = process.env.BROWSERLESS_API_TOKEN;
  
  if (!browserlessToken) {
    console.warn('⚠️ BROWSERLESS_API_TOKEN non configurato');
    console.log('📧 Genero email senza PDF');
    throw new Error('Token Browserless non configurato');
  }

  try {
    console.log('📤 Invio richiesta a Browserless...');
    
    const response = await fetch('https://chrome.browserless.io/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        token: browserlessToken,
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
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Errore Browserless:', errorText);
      throw new Error(`Browserless error (${response.status}): ${errorText}`);
    }

    const pdfBuffer = await response.arrayBuffer();
    console.log(`✅ PDF generato (${(pdfBuffer.byteLength / 1024).toFixed(2)} KB)`);
    
    return Buffer.from(pdfBuffer);
    
  } catch (error) {
    console.error('❌ Errore generazione PDF:', error.message);
    throw error;
  }
}

function generaHTMLRiepilogo(dati) {
  const dataFormattata = new Date(dati.dataCheckin).toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const documentiValidi = Array.isArray(dati.documenti) ? dati.documenti : [];
  console.log(`📄 Documenti trovati: ${documentiValidi.length}`);

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
        
        .documento-img {
          max-width: 100%;
          max-height: 300px;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          margin: 10px 0;
          display: block;
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
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
          text-align: center;
          color: #6c757d;
          font-size: 12px;
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

      <div class="section">
        <h2>👥 Ospiti Registrati</h2>
        ${(dati.ospiti || []).map((ospite) => {
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
              </div>
              ` : ''}
              
              ${documento ? `
              <div class="documento-section">
                <strong>Documento caricato:</strong> ${documento.nomeFile || 'Documento'} (${Math.round(documento.dimensione / 1024)} KB)
                ${documento.base64 ? `<img src="${documento.base64}" alt="Documento" class="documento-img" />` : ''}
              </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <div class="totale-section">
        <h2>💰 Totale Tassa di Soggiorno</h2>
        <div class="totale-amount">€${(dati.totale || 0).toFixed(2)}</div>
        <div style="font-size: 13px; color: #666; margin-top: 10px;">
          Tassa di €1,50 per notte per ospiti dai 4 anni in su
        </div>
      </div>

      <div class="footer">
        <p>Documento generato automaticamente dal sistema di check-in</p>
        <p>${new Date().toLocaleString('it-IT')}</p>
      </div>
    </body>
    </html>
  `;
}

async function inviaEmailConPDF(emailDestinatario, dati, pdfBuffer) {
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

---
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
