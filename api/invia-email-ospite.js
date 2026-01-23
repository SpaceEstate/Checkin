// api/invia-email-ospite.js
// VERSIONE CORRETTA - Caricamento foto con percorsi Vercel

import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  console.log('📧 === INIZIO INVIO EMAIL OSPITE ===');

  try {
    const { emailOspite, datiPrenotazione } = req.body;

    if (!emailOspite || !datiPrenotazione) {
      return res.status(400).json({ 
        error: 'Email ospite e dati prenotazione sono obbligatori' 
      });
    }

    console.log('📬 Destinatario:', emailOspite);
    console.log('📊 Appartamento:', datiPrenotazione.appartamento);

    const codiciCassetta = determinaCodiciCassetta(datiPrenotazione.appartamento);
    console.log('🔑 Codici cassetta generati:', codiciCassetta);

    if (typeof datiPrenotazione.totale === 'string') {
      datiPrenotazione.totale = parseFloat(datiPrenotazione.totale);
    }

    const htmlContent = generaHTMLEmailOspite(datiPrenotazione, codiciCassetta);

    // ✅ Carica foto (con fallback se non trovate)
    const allegati = await caricaAllegatiFoto();
    console.log(`📎 Foto caricate: ${allegati.length}`);

    await inviaEmailConNodemailer(emailOspite, datiPrenotazione, htmlContent, allegati);

    console.log('✅ Email ospite inviata con successo');
    console.log('📧 === FINE INVIO EMAIL OSPITE ===');

    return res.status(200).json({
      success: true,
      message: 'Email inviata con successo',
      codiciCassetta: codiciCassetta.map(c => c.codice),
      emailDestinatario: emailOspite,
      numeroAllegati: allegati.length,
      warning: allegati.length === 0 ? 'Foto cassetta non trovate' : null
    });

  } catch (error) {
    console.error('❌ Errore invio email ospite:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      error: 'Errore invio email',
      message: error.message
    });
  }
}

// ✅ FIX: Percorsi corretti per Vercel
async function caricaAllegatiFoto() {
  const allegati = [];
  
  try {
    // ✅ CRITICAL: Percorsi ASSOLUTI per Vercel
    const possibiliPercorsi = [
      '/var/task/public/images/cassetta',      // Vercel runtime (PRIORITÀ)
      join(process.cwd(), 'public/images/cassetta'), // Build directory
      join(__dirname, '..', 'public', 'images', 'cassetta'), // Relativo
    ];
    
    const files = [
      { name: 'ingresso_proprieta.jpg', cid: 'ingresso_proprieta' },
      { name: 'cassetta_sicurezza.jpg', cid: 'cassetta_sicurezza' },
      { name: 'ubicazione_cassetta.jpg', cid: 'ubicazione_cassetta' }
    ];
    
    console.log('🔍 Percorsi da provare:', possibiliPercorsi);
    
    for (const file of files) {
      let caricato = false;
      
      for (const basePath of possibiliPercorsi) {
        try {
          const filePath = join(basePath, file.name);
          console.log(`🔍 Tentativo: ${filePath}`);
          
          const content = await readFile(filePath);
          
          allegati.push({
            filename: file.name,
            content: content,
            cid: file.cid,
            contentType: 'image/jpeg'
          });
          
          console.log(`✅ Foto caricata: ${file.name} (${(content.length / 1024).toFixed(2)} KB)`);
          caricato = true;
          break;
        } catch (error) {
          // Continua con il prossimo percorso
          continue;
        }
      }
      
      if (!caricato) {
        console.warn(`⚠️ Impossibile caricare ${file.name} da nessun percorso`);
      }
    }
    
    if (allegati.length === 0) {
      console.warn('⚠️ NESSUNA foto trovata.');
      console.warn('📂 Contenuto directory corrente:', process.cwd());
      
      // ✅ Debug: lista contenuto directory
      try {
        const { readdir } = await import('fs/promises');
        const publicDir = await readdir(join(process.cwd(), 'public')).catch(() => []);
        console.warn('📂 public/:', publicDir);
      } catch (e) {
        console.warn('❌ Impossibile leggere directory public');
      }
    }
    
  } catch (error) {
    console.error('❌ Errore generale caricamento foto:', error.message);
  }
  
  return allegati;
}

function determinaCodiciCassetta(appartamento) {
  if (!appartamento) {
    console.warn('⚠️ Appartamento non specificato, uso codice generico');
    return [{
      codice: '0000',
      nome: 'Generico',
      descrizione: 'Appartamento non specificato'
    }];
  }

  const appartamentoLower = appartamento.toLowerCase();
  const codici = [];

  if (appartamentoLower.includes('corte')) {
    codici.push({
      codice: '1933',
      nome: 'Corte',
      descrizione: 'Appartamento con 1 camera da letto'
    });
  }

  if (appartamentoLower.includes('torre')) {
    codici.push({
      codice: '1935',
      nome: 'Torre',
      descrizione: 'Appartamento con 2 camere da letto'
    });
  }

  if (codici.length === 0) {
    console.warn('⚠️ Appartamento non riconosciuto:', appartamento);
    return [{
      codice: '0000',
      nome: 'Generico',
      descrizione: 'Appartamento non specificato'
    }];
  }

  return codici;
}

function generaHTMLEmailOspite(dati, codiciCassetta) {
  const dataFormattata = new Date(dati.dataCheckin).toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const totale = typeof dati.totale === 'string' ? parseFloat(dati.totale) : (dati.totale || 0);

  const CHECKIN_OPEN_TIME = "16:00";
  const CHECKIN_CLOSE_TIME = "00:00";
  const CHECKOUT_CLOSE_TIME = "10:00";

  let codiciHTML = '';
  
  if (codiciCassetta.length === 1) {
    codiciHTML = `
      <div class="code-section">
        <div class="code-title">🔑 Codice Cassetta Sicurezza</div>
        <div class="code-subtitle">${codiciCassetta[0].nome}</div>
        <div class="code-box">${codiciCassetta[0].codice}</div>
        <div class="code-note">Conserva questo codice con cura</div>
      </div>
    `;
  } else {
    codiciHTML = `
      <div class="code-section">
        <div class="code-title">🔑 Codici Cassette Sicurezza</div>
        <div class="code-note" style="margin-bottom: 20px;">Hai prenotato entrambi gli appartamenti</div>
        
        ${codiciCassetta.map(cassetta => `
          <div class="code-sub-section">
            <div class="code-subtitle">🏠 ${cassetta.nome}</div>
            <div class="code-box">${cassetta.codice}</div>
            <small style="display: block; margin-top: 5px; opacity: 0.9; font-size: 14px;">
              ${cassetta.descrizione}
            </small>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f2e9;
          margin: 0;
          padding: 0;
        }
        
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          border: 1px solid rgba(232, 220, 192, 0.3);
        }
        
        .header {
          background: linear-gradient(135deg, #b89968 0%, #a67c52 100%);
          color: white;
          padding: 40px 20px;
          text-align: center;
        }
        
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.95;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .welcome-text {
          font-size: 18px;
          color: #8b7d6b;
          margin-bottom: 20px;
        }
        
        .code-section {
          background: linear-gradient(135deg, #a67c52 0%, #8b7d6b 100%);
          color: white;
          padding: 30px;
          border-radius: 12px;
          text-align: center;
          margin: 30px 0;
        }
        
        .code-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 15px;
        }
        
        .code-subtitle {
          font-size: 16px;
          margin-bottom: 10px;
          font-weight: 500;
        }
        
        .code-box {
          background: rgba(255, 255, 255, 0.2);
          padding: 20px;
          border-radius: 8px;
          font-size: 48px;
          font-weight: bold;
          letter-spacing: 8px;
          margin: 15px 0;
        }
        
        .code-sub-section {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 8px;
          margin: 15px 0;
        }
        
        .code-sub-section .code-box {
          font-size: 40px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.2);
        }
        
        .code-note {
          font-size: 14px;
          opacity: 0.9;
          margin-top: 10px;
        }
        
        .info-section {
          background: #faf9f6;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #b89968;
        }
        
        .info-title {
          font-size: 18px;
          font-weight: 600;
          color: #8b7d6b;
          margin-bottom: 15px;
        }
        
        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e8dcc0;
        }
        
        .info-item:last-child {
          border-bottom: none;
        }
        
        .info-label {
          font-weight: 500;
          color: #a0927f;
        }
        
        .info-value {
          font-weight: 600;
          color: #8b7d6b;
        }
        
        .instructions {
          background: #fff9e6;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #ffc107;
        }
        
        .instructions h3 {
          color: #856404;
          margin-top: 0;
          font-size: 18px;
          margin-bottom: 15px;
        }
        
        .instructions p {
          margin: 10px 0;
          color: #8b7d6b;
          line-height: 1.8;
        }

        .instructions strong {
          color: #856404;
          display: block;
          margin-top: 15px;
          margin-bottom: 5px;
        }

        .address-block {
          background: white;
          padding: 12px;
          border-radius: 6px;
          margin: 10px 0;
          border-left: 3px solid #b89968;
        }

        .photo-gallery {
          margin: 30px 0;
        }

        .photo-gallery h3 {
          color: #8b7d6b;
          font-size: 20px;
          margin-bottom: 20px;
          text-align: center;
        }

        .photo-item {
          margin: 20px 0;
          text-align: center;
        }

        .photo-item img {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          margin-bottom: 10px;
        }

        .photo-caption {
          font-size: 14px;
          color: #8b7d6b;
          font-style: italic;
        }
        
        .footer {
          background: #f5f2e9;
          padding: 30px;
          text-align: center;
          color: #a0927f;
          font-size: 14px;
        }
        
        .footer p {
          margin: 5px 0;
        }
        
        .highlight {
          background: #fff3cd;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Benvenuto a Space Estate!</h1>
          <p>Il tuo soggiorno sta per iniziare</p>
        </div>
        
        <div class="content">
          <p class="welcome-text">
            Gentile <strong>${dati.ospiti?.[0]?.nome || 'Ospite'} ${dati.ospiti?.[0]?.cognome || ''}</strong>,
          </p>
          
          <p>
            Grazie per aver completato il check-in e il pagamento della tassa di soggiorno. 
            Siamo felici di accoglierti nella nostra struttura!
          </p>
          
          ${codiciHTML}
          
          <div class="info-section">
            <div class="info-title">📋 Dettagli della tua prenotazione</div>
            <div class="info-item">
              <span class="info-label">Data Check-in:</span>
              <span class="info-value">${dataFormattata}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Appartamento:</span>
              <span class="info-value">${dati.appartamento || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Numero Ospiti:</span>
              <span class="info-value">${dati.numeroOspiti || 0}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Numero Notti:</span>
              <span class="info-value">${dati.numeroNotti || 0}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tassa Soggiorno Pagata:</span>
              <span class="info-value">€${totale.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="instructions">
            <h3>📍 Come accedere alla struttura</h3>
            
            <div class="address-block">
              <strong>📍 Indirizzo Struttura:</strong>
              <p style="margin: 5px 0;">
                Via Centrale, 48<br>
                38123 Trento (TN)
              </p>
            </div>

            <div class="address-block">
              <strong>📍 Indirizzo Parcheggio:</strong>
              <p style="margin: 5px 0;">
                Via Val Gola, 22<br>
                38123 Trento (TN)
              </p>
            </div>

            <div class="address-block">
              <strong>⏰ Orari:</strong>
              <p style="margin: 5px 0;">
                Check-in: dalle ${CHECKIN_OPEN_TIME} alle ${CHECKIN_CLOSE_TIME}<br>
                Check-out: entro le ${CHECKOUT_CLOSE_TIME}
              </p>
            </div>

            <p style="margin-top: 20px;">
              • Quando arrivi alla proprietà, ${codiciCassetta.length > 1 ? 'le cassette di sicurezza sono situate' : 'la cassetta di sicurezza è situata'} in una nicchia dietro allo scuro ${codiciCassetta.length > 1 ? 'degli appartamenti al' : 'dell\'appartamento al'} piano terra (vedi foto sotto).
            </p>

            <p>
              • La sosta all'interno della proprietà è consentita esclusivamente per le operazioni di carico e scarico dei bagagli.
            </p>
          </div>

          <div class="photo-gallery">
            <h3>📸 Foto di riferimento per l'accesso</h3>
            
            <div class="photo-item">
              <img src="cid:ingresso_proprieta" alt="Ingresso Proprietà">
              <p class="photo-caption">1. Ingresso della proprietà</p>
            </div>

            <div class="photo-item">
              <img src="cid:cassetta_sicurezza" alt="Cassetta di Sicurezza">
              <p class="photo-caption">2. Cassetta di sicurezza con ${codiciCassetta.length > 1 ? 'codici' : 'codice'} ${codiciCassetta.map(c => c.codice).join(' e ')}</p>
            </div>

            <div class="photo-item">
              <img src="cid:ubicazione_cassetta" alt="Ubicazione Cassetta">
              <p class="photo-caption">3. Ubicazione esatta ${codiciCassetta.length > 1 ? 'delle cassette' : 'della cassetta'}</p>
            </div>
          </div>
          
          <p style="margin-top: 30px; color: #8b7d6b;">
            Per qualsiasi necessità o domanda, non esitare a contattarci. 
            Ti auguriamo un soggiorno piacevole e confortevole! 🌟
          </p>
        </div>
        
        <div class="footer">
          <p><strong>Space Estate</strong></p>
          <p>La Columbera - Appartamenti turistici</p>
          <p style="margin-top: 15px; font-size: 12px;">
            Questa è una email automatica, per favore non rispondere direttamente.
          </p>
          <p style="font-size: 12px;">
            Generata il ${new Date().toLocaleString('it-IT')}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function inviaEmailConNodemailer(emailDestinatario, dati, htmlContent, allegati) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const totale = typeof dati.totale === 'string' ? parseFloat(dati.totale) : (dati.totale || 0);

  const oggetto = `Benvenuto a Space Estate - ${dati.appartamento || 'Appartamento'} - Check-in ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: emailDestinatario,
    subject: oggetto,
    html: htmlContent,
    attachments: allegati.length > 0 ? allegati : undefined
  };

  await transporter.sendMail(mailOptions);
  console.log(`✅ Email inviata a ${emailDestinatario}${allegati.length > 0 ? ' con ' + allegati.length + ' foto allegate' : ' senza foto'}`);
}
