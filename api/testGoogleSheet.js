import { GoogleSpreadsheet } from "google-spreadsheet";

export default async function handler(req, res) {
  try {
    console.log("🔍 Diagnostica Google Sheets Auth");
    
    // Test 1: Verifica esistenza variabili
    const envVars = {
      SHEET_ID: process.env.SHEET_ID,
      GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
      GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ? "PRESENTE" : "MANCANTE"
    };
    
    console.log("📋 Variabili d'ambiente:", envVars);
    
    if (!process.env.SHEET_ID) {
      return res.status(500).json({ error: "SHEET_ID mancante" });
    }
    if (!process.env.GOOGLE_CLIENT_EMAIL) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_EMAIL mancante" });
    }
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: "GOOGLE_PRIVATE_KEY mancante" });
    }

    // Test 2: Analizza formato credenziali
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    console.log("📧 Email formato:", clientEmail.includes('@') ? "VALIDO" : "INVALIDO");
    console.log("🔑 Key inizia con BEGIN:", privateKey.includes('BEGIN PRIVATE KEY') ? "SÌ" : "NO");
    
    // Pulisci la chiave privata
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      console.log("🔧 Convertiti \\n in newline");
    }
    
    // Test 3: Verifica formato Service Account
    const keyValid = privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
                     privateKey.includes('-----END PRIVATE KEY-----');
    
    if (!keyValid) {
      return res.status(500).json({
        error: "FORMATO CHIAVE PRIVATA INVALIDO",
        details: "La chiave deve iniziare con '-----BEGIN PRIVATE KEY-----' e finire con '-----END PRIVATE KEY-----'",
        currentFormat: {
          starts: privateKey.substring(0, 30) + "...",
          ends: "..." + privateKey.substring(privateKey.length - 30)
        }
      });
    }
    
    if (!clientEmail.includes('@') || !clientEmail.includes('.iam.gserviceaccount.com')) {
      return res.status(500).json({
        error: "FORMATO EMAIL INVALIDO",
        details: "L'email deve essere nel formato: nome@progetto.iam.gserviceaccount.com",
        currentEmail: clientEmail
      });
    }

    console.log("✅ Formato credenziali OK");

    // Test 4: Tentativo connessione con debug
    console.log("📄 Tentativo inizializzazione documento...");
    
    const credentials = {
      client_email: clientEmail,
      private_key: privateKey
    };
    
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, credentials);
    
    console.log("📊 Tentativo caricamento info...");
    await doc.loadInfo();
    
    console.log("🎉 SUCCESSO! Documento caricato:", doc.title);
    
    return res.status(200).json({
      success: true,
      message: "🎉 AUTENTICAZIONE RIUSCITA!",
      diagnostica: {
        variabiliPresenti: envVars,
        formatoEmail: "VALIDO",
        formatoChiave: "VALIDO",
        connessione: "SUCCESSO"
      },
      data: {
        titolo: doc.title,
        fogli: doc.sheetsByIndex.map(sheet => ({
          nome: sheet.title,
          righe: sheet.rowCount,
          colonne: sheet.columnCount
        }))
      }
    });

  } catch (error) {
    console.error("❌ Errore dettagliato:", error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      diagnostica: {
        variabiliPresenti: {
          SHEET_ID: process.env.SHEET_ID ? "PRESENTE" : "MANCANTE",
          GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL ? "PRESENTE" : "MANCANTE", 
          GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ? "PRESENTE" : "MANCANTE"
        },
        suggerimenti: [
          "1. Verifica che il Service Account sia abilitato",
          "2. Controlla che l'email sia corretta (@progetto.iam.gserviceaccount.com)",
          "3. Assicurati che la chiave privata sia completa (inclusi BEGIN/END)",
          "4. Verifica che il foglio sia condiviso con il Service Account"
        ]
      },
      timestamp: new Date().toISOString()
    });
  }
}
