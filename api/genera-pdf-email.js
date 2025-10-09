// Funzione CORRETTA per generare HTML del PDF con TUTTI i campi
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

// Anche per l'email SENZA PDF, aggiungi i campi nella lista ospiti:
async function inviaEmailSenzaPDF(emailDestinatario, dati) {
  const transporter = nodemailer.createTransport({
    service: 'yahoo',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const oggetto = `Check-in Ricevuto - ${dati.appartamento || 'Appartamento'} - ${new Date(dati.dataCheckin).toLocaleDateString('it-IT')}`;
  
  // Genera lista ospiti dettagliata CON luogo nascita e rilascio
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

---
Sistema Check-in Automatico
Generato il ${new Date().toLocaleString('it-IT')}
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: emailDestinatario,
    subject: oggetto,
    text: corpoEmail
  };

  await transporter.sendMail(mailOptions);
}
