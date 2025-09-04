export default async function handler(req, res) {
  try {
    console.log("🔍 Debug completo credenziali Google");
    
    // Verifica base
    if (!process.env.SHEET_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ 
        error: "Variabili d'ambiente mancanti",
        missing: {
          SHEET_ID: !process.env.SHEET_ID,
          GOOGLE_CLIENT_EMAIL: !process.env.GOOGLE_CLIENT_EMAIL,
          GOOGLE_PRIVATE_KEY: !process.env.GOOGLE_PRIVATE_KEY
        }
      });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    // Debug formato email
    const emailValid = clientEmail.includes('@') && clientEmail.includes('.iam.gserviceaccount.com');
    
    // Debug chiave privata
    const keyInfo = {
      lunghezza: privateKey.length,
      inizia_con: privateKey.substring(0, 50),
      finisce_con: privateKey.substring(privateKey.length - 50),
      contiene_begin: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
      contiene_end: privateKey.includes('-----END PRIVATE KEY-----'),
      contiene_backslash_n: privateKey.includes('\\n')
    };

    // Pulizia chiave
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    privateKey = privateKey.trim();
    
    const keyValidAfterClean = privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
                               privateKey.includes('-----END PRIVATE KEY-----');

    // Return debug info PRIMA di tentare la connessione
    if (!emailValid || !keyValidAfterClean) {
      return res.status(400).json({
        success: false,
        error: "FORMATO CREDENZIALI INVALIDO",
        debug: {
          email: {
            valore: clientEmail,
            valido: emailValid,
            formato_atteso: "nome@progetto.iam.gserviceaccount.com"
          },
          chiave: {
            ...keyInfo,
            valida_dopo_pulizia: keyValidAfterClean
          }
        },
        suggerimenti: [
          emailValid ? "✅ Email OK" : "❌ Email formato sbagliato",
          keyValidAfterClean ? "✅ Chiave OK" : "❌ Chiave formato sbagliato"
        ]
      });
    }

    // Se arriviamo qui, le credenziali sembrano OK
    console.log("✅ Formato credenziali sembra corretto, tentativo connessione...");
    
    // Test connessione semplificato - senza google-spreadsheet per ora
    return res.status(200).json({
      success: true,
      message: "FORMATO CREDENZIALI OK - Pronti per il test di connessione",
      debug: {
        email: {
          valore: clientEmail,
          formato: "VALIDO"
        },
        chiave: {
          lunghezza: privateKey.length,
          formato: "VALIDO",
          inizia_correttamente: privateKey.substring(0, 27) === '-----BEGIN PRIVATE KEY-----',
          finisce_correttamente: privateKey.substring(privateKey.length - 25) === '-----END PRIVATE KEY-----'
        },
        sheet_id: process.env.SHEET_ID
      },
      prossimo_passo: "Le credenziali sono nel formato corretto. Il problema potrebbe essere:",
      possibili_cause: [
        "1. Service Account non abilitato nel progetto Google Cloud",
        "2. Google Sheet non condiviso con il Service Account",
        "3. API Google Sheets non abilitata nel progetto",
        "4. Chiave privata generata male o corrotta"
      ]
    });

  } catch (error) {
    console.error("❌ Errore:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
