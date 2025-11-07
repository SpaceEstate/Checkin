function generaHTMLEmailOspite(dati, codiceCassetta) {
  const dataFormattata = new Date(dati.dataCheckin).toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // ✅ CORREZIONE: Converti totale in numero
  const totale = typeof dati.totale === 'string' ? parseFloat(dati.totale) : (dati.totale || 0);

  // Determina gli orari in base alla data di check-in
  const CHECKIN_OPEN_TIME = "15:00";
  const CHECKIN_CLOSE_TIME = "20:00";
  const CHECKOUT_CLOSE_TIME = "10:00";

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
        
        .code-box {
          background: rgba(255, 255, 255, 0.2);
          padding: 20px;
          border-radius: 8px;
          font-size: 48px;
          font-weight: bold;
          letter-spacing: 8px;
          margin: 15px 0;
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
        
        @media (max-width: 600px) {
          .container {
            margin: 10px;
          }
          
          .content {
            padding: 20px 15px;
          }
          
          .code-box {
            font-size: 36px;
            letter-spacing: 4px;
          }
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
          
          <div class="code-section">
            <div class="code-title">🔑 Codice Cassetta Sicurezza</div>
            <div class="code-box">${codiceCassetta}</div>
            <div class="code-note">Conserva questo codice con cura</div>
          </div>
          
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
              • Quando arrivi alla proprietà, la cassetta di sicurezza è situata in una nicchia dietro allo scuro dell'appartamento al piano terra (foto in allegato).
            </p>

            <p>
              • La sosta all'interno della proprietà è consentita esclusivamente per le operazioni di carico e scarico dei bagagli.
            </p>
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
