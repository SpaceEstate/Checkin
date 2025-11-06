// api/test-email.js
// Script per testare l'invio email senza passare da Stripe

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  console.log('\n🧪 === TEST EMAIL SYSTEM ===\n');

  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://checkin-six-coral.vercel.app';

    // Dati di test
    const datiPrenotazioneTest = {
      dataCheckin: '2025-11-15',
      appartamento: 'La Columbera - Torre, Appartamento con 2 camere da letto',
      numeroOspiti: 2,
      numeroNotti: 3,
      tipoGruppo: 'famiglia',
      totale: 9.00,
      timestamp: new Date().toISOString(),
      ospiti: [
        {
          numero: 1,
          cognome: 'Rossi',
          nome: 'Mario',
          genere: 'M',
          nascita: '1985-05-15',
          eta: 39,
          cittadinanza: 'Italia',
          luogoNascita: 'Italia',
          comune: 'Roma',
          provincia: 'RM',
          tipoDocumento: 'CARTA DI IDENTITA\'',
          numeroDocumento: 'AB1234567',
          luogoRilascio: 'Italia',
          isResponsabile: true
        },
        {
          numero: 2,
          cognome: 'Rossi',
          nome: 'Laura',
          genere: 'F',
          nascita: '1987-08-20',
          eta: 37,
          cittadinanza: 'Italia',
          luogoNascita: 'Italia',
          comune: 'Milano',
          provincia: 'MI'
        }
      ],
      documenti: [] // Vuoti per il test
    };

    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    console.log('📋 Dati di test preparati');
    console.log('🏠 Appartamento:', datiPrenotazioneTest.appartamento);
    console.log('👥 Ospiti:', datiPrenotazioneTest.numeroOspiti);

    // TEST 1: Email al proprietario (genera-pdf-email)
    console.log('\n📧 TEST 1: Email proprietario...');
    try {
      const emailProprietario = process.env.EMAIL_PROPRIETARIO || 'NON_CONFIGURATA';
      console.log('📬 Destinatario proprietario:', emailProprietario);

      const response1 = await fetch(`${baseUrl}/api/genera-pdf-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datiPrenotazione: datiPrenotazioneTest,
          emailDestinatario: emailProprietario
        })
      });

      const result1 = await response1.json();
      
      results.tests.push({
        test: 'Email Proprietario',
        status: response1.ok ? 'SUCCESS' : 'FAILED',
        statusCode: response1.status,
        response: result1
      });

      if (response1.ok) {
        console.log('✅ Email proprietario: OK');
      } else {
        console.error('❌ Email proprietario: FAILED');
        console.error('Dettagli:', result1);
      }
    } catch (error) {
      console.error('❌ Errore test 1:', error.message);
      results.tests.push({
        test: 'Email Proprietario',
        status: 'ERROR',
        error: error.message
      });
    }

    // TEST 2: Email all'ospite (invia-email-ospite)
    console.log('\n📧 TEST 2: Email ospite...');
    try {
      // Puoi cambiare questa email per testare con la tua
      const emailOspiteTest = req.query.email_test || 'test@example.com';
      console.log('📬 Destinatario ospite:', emailOspiteTest);

      const response2 = await fetch(`${baseUrl}/api/invia-email-ospite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOspite: emailOspiteTest,
          datiPrenotazione: datiPrenotazioneTest
        })
      });

      const result2 = await response2.json();
      
      results.tests.push({
        test: 'Email Ospite',
        status: response2.ok ? 'SUCCESS' : 'FAILED',
        statusCode: response2.status,
        response: result2
      });

      if (response2.ok) {
        console.log('✅ Email ospite: OK');
        console.log('🔑 Codice inviato:', result2.codiceCassetta);
      } else {
        console.error('❌ Email ospite: FAILED');
        console.error('Dettagli:', result2);
      }
    } catch (error) {
      console.error('❌ Errore test 2:', error.message);
      results.tests.push({
        test: 'Email Ospite',
        status: 'ERROR',
        error: error.message
      });
    }

    // Verifica variabili ambiente
    console.log('\n🔍 Verifica configurazione:');
    const config = {
      EMAIL_USER: process.env.EMAIL_USER ? '✅ Configurata' : '❌ MANCANTE',
      EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '✅ Configurata' : '❌ MANCANTE',
      EMAIL_PROPRIETARIO: process.env.EMAIL_PROPRIETARIO ? '✅ Configurata' : '❌ MANCANTE',
      BROWSERLESS_API_TOKEN: process.env.BROWSERLESS_API_TOKEN ? '✅ Configurata' : '⚠️ Opzionale'
    };

    Object.entries(config).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });

    results.config = config;

    console.log('\n🧪 === FINE TEST ===\n');

    // Genera risposta HTML leggibile
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Email System</title>
        <style>
          body {
            font-family: monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            background: #252526;
            padding: 30px;
            border-radius: 8px;
          }
          h1 { color: #4ec9b0; }
          h2 { color: #569cd6; margin-top: 30px; }
          .success { color: #4ec9b0; }
          .error { color: #f48771; }
          .warning { color: #dcdcaa; }
          pre {
            background: #1e1e1e;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
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
          .config-item {
            padding: 8px 0;
            border-bottom: 1px solid #3e3e42;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🧪 Test Sistema Email</h1>
          <p>Timestamp: ${results.timestamp}</p>
          
          <h2>📧 Risultati Test</h2>
          ${results.tests.map(test => `
            <div class="test-result ${test.status === 'SUCCESS' ? '' : 'failed'}">
              <strong>${test.status === 'SUCCESS' ? '✅' : '❌'} ${test.test}</strong>
              <div>Status: <span class="${test.status === 'SUCCESS' ? 'success' : 'error'}">${test.status}</span></div>
              <div>HTTP Status: ${test.statusCode || 'N/A'}</div>
              ${test.response ? `<pre>${JSON.stringify(test.response, null, 2)}</pre>` : ''}
              ${test.error ? `<div class="error">Error: ${test.error}</div>` : ''}
            </div>
          `).join('')}
          
          <h2>⚙️ Configurazione Variabili Ambiente</h2>
          ${Object.entries(results.config).map(([key, value]) => `
            <div class="config-item">
              <strong>${key}:</strong> ${value}
            </div>
          `).join('')}
          
          <h2>📋 Dati di Test Utilizzati</h2>
          <pre>${JSON.stringify(datiPrenotazioneTest, null, 2)}</pre>
          
          <h2>💡 Come usare questo test</h2>
          <pre>
# Test base (usa email di default)
GET https://checkin-six-coral.vercel.app/api/test-email

# Test con email personalizzata per l'ospite
GET https://checkin-six-coral.vercel.app/api/test-email?email_test=tuaemail@example.com
          </pre>
        </div>
      </body>
      </html>
    `;

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
