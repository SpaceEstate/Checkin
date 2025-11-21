// api/test-email.js
// Script migliorato per testare l'invio email senza passare da Stripe

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  console.log('\n🧪 === TEST EMAIL SYSTEM ===\n');
  const startTime = Date.now();

  try {
    // ✅ CORREZIONE: Gestione corretta URL base
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : (req.headers.host?.includes('localhost') 
          ? `http://${req.headers.host}` 
          : 'https://checkin-six-coral.vercel.app');

    console.log('🌐 Base URL:', baseUrl);

    // Parametri test dalla query string
    const numOspiti = parseInt(req.query.ospiti) || 5; // Default 5 per testare page-break
    const conDocumenti = req.query.documenti !== 'false'; // Default true

    console.log(`👥 Test con ${numOspiti} ospiti`);
    console.log(`📎 Documenti allegati: ${conDocumenti ? 'SI' : 'NO'}`);

    // ✅ Genera dati di test dinamici
    const datiPrenotazioneTest = generaDatiTest(numOspiti, conDocumenti);

    const results = {
      timestamp: new Date().toISOString(),
      baseUrl,
      testParams: { numOspiti, conDocumenti },
      tests: [],
      executionTime: {}
    };

    console.log('📋 Dati di test preparati');
    console.log('🏠 Appartamento:', datiPrenotazioneTest.appartamento);
    console.log('👥 Ospiti:', datiPrenotazioneTest.numeroOspiti);
    console.log('📎 Documenti:', datiPrenotazioneTest.documenti.length);

    // TEST 1: Email al proprietario (genera-pdf-email)
    console.log('\n📧 TEST 1: Email proprietario con PDF...');
    const test1Start = Date.now();
    try {
      const emailProprietario = process.env.EMAIL_PROPRIETARIO || 'NON_CONFIGURATA';
      console.log('📬 Destinatario proprietario:', emailProprietario);

      if (emailProprietario === 'NON_CONFIGURATA') {
        throw new Error('EMAIL_PROPRIETARIO non configurata nelle variabili ambiente');
      }

      const response1 = await fetch(`${baseUrl}/api/genera-pdf-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datiPrenotazione: datiPrenotazioneTest,
          emailDestinatario: emailProprietario
        })
      });

      const result1 = await response1.json();
      const test1Time = Date.now() - test1Start;
      
      results.tests.push({
        test: 'Email Proprietario (con PDF)',
        status: response1.ok ? 'SUCCESS' : 'FAILED',
        statusCode: response1.status,
        executionTime: `${test1Time}ms`,
        response: result1
      });

      results.executionTime.emailProprietario = test1Time;

      if (response1.ok) {
        console.log(`✅ Email proprietario: OK (${test1Time}ms)`);
        console.log(`📄 PDF generato: ${result1.pdfGenerato ? 'SI' : 'NO'}`);
        console.log(`📎 Documenti allegati: ${result1.numeroDocumenti || 0}`);
      } else {
        console.error('❌ Email proprietario: FAILED');
        console.error('Dettagli:', result1);
      }
    } catch (error) {
      console.error('❌ Errore test 1:', error.message);
      results.tests.push({
        test: 'Email Proprietario (con PDF)',
        status: 'ERROR',
        error: error.message
      });
    }

    // TEST 2: Email all'ospite (invia-email-ospite)
    console.log('\n📧 TEST 2: Email ospite con codice cassetta...');
    const test2Start = Date.now();
    try {
      // ✅ CORREZIONE: Usa email dal query param o fallback a proprietario
      const emailOspiteTest = req.query.email_test || process.env.EMAIL_PROPRIETARIO;
      
      if (!emailOspiteTest || emailOspiteTest === 'NON_CONFIGURATA') {
        throw new Error('Specifica ?email_test=tua@email.com o configura EMAIL_PROPRIETARIO');
      }

      console.log('📬 Destinatario ospite:', emailOspiteTest);
      console.log('💡 Usa ?email_test=tua@email.com per cambiare destinatario');

      const response2 = await fetch(`${baseUrl}/api/invia-email-ospite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOspite: emailOspiteTest,
          datiPrenotazione: datiPrenotazioneTest
        })
      });

      const result2 = await response2.json();
      const test2Time = Date.now() - test2Start;
      
      results.tests.push({
        test: 'Email Ospite (con codice)',
        status: response2.ok ? 'SUCCESS' : 'FAILED',
        statusCode: response2.status,
        executionTime: `${test2Time}ms`,
        response: result2
      });

      results.executionTime.emailOspite = test2Time;

      if (response2.ok) {
        console.log(`✅ Email ospite: OK (${test2Time}ms)`);
        console.log('🔑 Codice cassetta:', result2.codiceCassetta || 'N/A');
      } else {
        console.error('❌ Email ospite: FAILED');
        console.error('Dettagli:', result2);
      }
    } catch (error) {
      console.error('❌ Errore test 2:', error.message);
      results.tests.push({
        test: 'Email Ospite (con codice)',
        status: 'ERROR',
        error: error.message
      });
    }

    // Verifica variabili ambiente
    console.log('\n🔍 Verifica configurazione:');
    const config = {
      EMAIL_USER: process.env.EMAIL_USER ? '✅ Configurata' : '❌ MANCANTE',
      EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '✅ Configurata' : '❌ MANCANTE',
      EMAIL_PROPRIETARIO: process.env.EMAIL_PROPRIETARIO ? `✅ ${process.env.EMAIL_PROPRIETARIO}` : '❌ MANCANTE',
      BROWSERLESS_API_TOKEN: process.env.BROWSERLESS_API_TOKEN ? '✅ Configurata (PDF disponibile)' : '⚠️ Mancante (email senza PDF)',
      CODICE_CASSETTA: process.env.CODICE_CASSETTA ? '✅ Configurata' : '⚠️ Opzionale'
    };

    Object.entries(config).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });

    results.config = config;

    const totalTime = Date.now() - startTime;
    results.executionTime.total = totalTime;

    console.log(`\n⏱️ Tempo totale: ${totalTime}ms`);
    console.log('🧪 === FINE TEST ===\n');

    // Genera risposta HTML leggibile
    const htmlResponse = generaHTMLRisposta(results, datiPrenotazioneTest);

    return res.status(200).send(htmlResponse);

  } catch (error) {
    console.error('❌ Errore generale nel test:', error);
    return res.status(500).json({
      error: 'Errore nel test',
      message: error.message,
      stack: error.stack
    });
  }
}

// ✅ FUNZIONE: Genera dati di test dinamici
function generaDatiTest(numOspiti, conDocumenti) {
  const ospiti = [];
  
  // Ospite 1 - Responsabile
  ospiti.push({
    numero: 1,
    cognome: 'Rossi',
    nome: 'Mario',
    genere: 'M',
    nascita: '1985-05-15',
    eta: 39,
    cittadinanza: 'Italia',
    luogoNascita: 'Roma',
    comune: 'Roma',
    provincia: 'RM',
    tipoDocumento: 'CARTA DI IDENTITA\'',
    numeroDocumento: 'AB1234567',
    luogoRilascio: 'Comune di Roma',
    isResponsabile: true
  });

  // Altri ospiti
  const nomi = ['Laura', 'Sofia', 'Luca', 'Emma', 'Giulia', 'Alessandro', 'Martina'];
  const citta = [
    { nome: 'Milano', provincia: 'MI' },
    { nome: 'Torino', provincia: 'TO' },
    { nome: 'Napoli', provincia: 'NA' },
    { nome: 'Firenze', provincia: 'FI' },
    { nome: 'Bologna', provincia: 'BO' }
  ];

  for (let i = 2; i <= numOspiti; i++) {
    const eta = i === numOspiti ? 3 : 30 + i; // Ultimo ospite bambino esente
    const citta_sel = citta[(i - 2) % citta.length];
    
    ospiti.push({
      numero: i,
      cognome: 'Rossi',
      nome: nomi[(i - 2) % nomi.length],
      genere: i % 2 === 0 ? 'F' : 'M',
      nascita: `${2025 - eta}-0${(i % 9) + 1}-15`,
      eta: eta,
      cittadinanza: 'Italia',
      luogoNascita: citta_sel.nome,
      comune: citta_sel.nome,
      provincia: citta_sel.provincia
    });
  }

  // Genera documenti fittizi se richiesto
  const documenti = [];
  if (conDocumenti) {
    // Solo per i primi 3 ospiti (per non appesantire)
    const maxDoc = Math.min(numOspiti, 3);
    for (let i = 1; i <= maxDoc; i++) {
      // Genera un mini base64 fittizio (1x1 pixel PNG trasparente)
      const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      documenti.push({
        ospiteNumero: i,
        nomeFile: `documento_ospite_${i}_test.jpg`,
        tipo: 'image/jpeg',
        base64: `data:image/jpeg;base64,${fakeBase64}`,
        dimensione: 1024 // 1KB fittizio
      });
    }
  }

  return {
    dataCheckin: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Domani
    appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto',
    numeroOspiti: numOspiti,
    numeroNotti: 3,
    tipoGruppo: 'famiglia',
    totale: (numOspiti - 1) * 1.5 * 3, // Solo maggiori di 4 anni tassabili
    timestamp: new Date().toISOString(),
    ospiti: ospiti,
    documenti: documenti
  };
}

// ✅ FUNZIONE: Genera HTML risposta
function generaHTMLRisposta(results, datiTest) {
  const allSuccess = results.tests.every(t => t.status === 'SUCCESS');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Email System</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 20px;
          line-height: 1.6;
          margin: 0;
        }
        .container {
          max-width: 1000px;
          margin: 0 auto;
          background: #252526;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        h1 { 
          color: #4ec9b0; 
          margin-top: 0;
          border-bottom: 2px solid #4ec9b0;
          padding-bottom: 10px;
        }
        h2 { 
          color: #569cd6; 
          margin-top: 30px;
          border-bottom: 1px solid #3e3e42;
          padding-bottom: 8px;
        }
        .success { color: #4ec9b0; font-weight: bold; }
        .error { color: #f48771; font-weight: bold; }
        .warning { color: #dcdcaa; font-weight: bold; }
        .info { color: #9cdcfe; }
        pre {
          background: #1e1e1e;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          border: 1px solid #3e3e42;
          font-size: 13px;
        }
        .test-result {
          background: #2d2d30;
          padding: 15px;
          margin: 10px 0;
          border-radius: 4px;
          border-left: 4px solid #4ec9b0;
        }
        .test-result.failed {
          border-left-color: #f48771;
        }
        .test-result.error {
          border-left-color: #dcdcaa;
        }
        .config-item {
          padding: 8px 12px;
          margin: 5px 0;
          background: #2d2d30;
          border-radius: 4px;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          margin-left: 10px;
        }
        .badge.success { background: #4ec9b0; color: #1e1e1e; }
        .badge.error { background: #f48771; color: #1e1e1e; }
        .summary {
          background: ${allSuccess ? '#1a3a2a' : '#3a1a1a'};
          border: 2px solid ${allSuccess ? '#4ec9b0' : '#f48771'};
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        }
        .summary h2 {
          margin: 0;
          color: ${allSuccess ? '#4ec9b0' : '#f48771'};
          border: none;
        }
        .usage {
          background: #1e1e1e;
          padding: 20px;
          border-radius: 6px;
          border: 1px solid #569cd6;
          margin-top: 20px;
        }
        .usage h3 {
          color: #569cd6;
          margin-top: 0;
        }
        code {
          background: #2d2d30;
          padding: 2px 6px;
          border-radius: 3px;
          color: #ce9178;
        }
        .time {
          color: #9cdcfe;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🧪 Test Sistema Email - Check-in</h1>
        <p class="info">Timestamp: ${results.timestamp}</p>
        <p class="info">Base URL: <code>${results.baseUrl}</code></p>
        <p class="time">⏱️ Tempo totale esecuzione: <strong>${results.executionTime.total}ms</strong></p>
        
        <div class="summary">
          <h2>${allSuccess ? '✅ Tutti i test sono passati!' : '⚠️ Alcuni test hanno fallito'}</h2>
          <p>${results.tests.filter(t => t.status === 'SUCCESS').length}/${results.tests.length} test superati</p>
        </div>

        <h2>📧 Risultati Test</h2>
        ${results.tests.map(test => `
          <div class="test-result ${test.status === 'FAILED' ? 'failed' : test.status === 'ERROR' ? 'error' : ''}">
            <div>
              <strong>${test.status === 'SUCCESS' ? '✅' : test.status === 'FAILED' ? '❌' : '⚠️'} ${test.test}</strong>
              <span class="badge ${test.status === 'SUCCESS' ? 'success' : 'error'}">${test.status}</span>
            </div>
            <div style="margin-top: 8px;">
              <span class="info">HTTP Status:</span> ${test.statusCode || 'N/A'} | 
              <span class="time">Tempo: ${test.executionTime || 'N/A'}</span>
            </div>
            ${test.response ? `
              <details style="margin-top: 10px;">
                <summary style="cursor: pointer; color: #9cdcfe;">📋 Vedi dettagli risposta</summary>
                <pre>${JSON.stringify(test.response, null, 2)}</pre>
              </details>
            ` : ''}
            ${test.error ? `<div class="error" style="margin-top: 8px;">❌ Error: ${test.error}</div>` : ''}
          </div>
        `).join('')}
        
        <h2>⚙️ Configurazione Variabili Ambiente</h2>
        ${Object.entries(results.config).map(([key, value]) => `
          <div class="config-item">
            <strong>${key}:</strong> ${value}
          </div>
        `).join('')}
        
        <h2>📋 Dati di Test Utilizzati</h2>
        <p class="info">👥 Ospiti: ${results.testParams.numOspiti} | 📎 Con documenti: ${results.testParams.conDocumenti ? 'SI' : 'NO'}</p>
        <details>
          <summary style="cursor: pointer; color: #9cdcfe;">📄 Vedi dati completi</summary>
          <pre>${JSON.stringify(datiTest, null, 2)}</pre>
        </details>
        
        <div class="usage">
          <h3>💡 Come usare questo test</h3>
          <p><strong>Test base:</strong></p>
          <code>GET ${results.baseUrl}/api/test-email</code>
          
          <p style="margin-top: 15px;"><strong>Test con email personalizzata:</strong></p>
          <code>GET ${results.baseUrl}/api/test-email?email_test=tua@email.com</code>
          
          <p style="margin-top: 15px;"><strong>Test con numero ospiti custom:</strong></p>
          <code>GET ${results.baseUrl}/api/test-email?ospiti=3</code>
          
          <p style="margin-top: 15px;"><strong>Test senza documenti:</strong></p>
          <code>GET ${results.baseUrl}/api/test-email?documenti=false</code>
          
          <p style="margin-top: 15px;"><strong>Test completo:</strong></p>
          <code>GET ${results.baseUrl}/api/test-email?email_test=tua@email.com&ospiti=5&documenti=true</code>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #3e3e42; text-align: center; color: #7f8c8d;">
          <p>Sistema Check-in Automatico - Test Endpoint v2.0</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
