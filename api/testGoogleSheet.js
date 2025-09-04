import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

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
    const sheetId = process.env.SHEET_ID;
    
    // Debug formato email
    const emailValid = clientEmail.includes('@') && clientEmail.includes('.iam.gserviceaccount.com');
    
    // Pulizia chiave
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    privateKey = privateKey.trim();
    
    const keyValidAfterClean = privateKey.includes('-----BEGIN PRIVATE KEY-----') && 
                               privateKey.includes('-----END PRIVATE KEY-----');
    
    // Verifica formato credenziali
    if (!emailValid || !keyValidAfterClean) {
      return res.status(400).json({
        success: false,
        error: "FORMATO CREDENZIALI INVALIDO",
        debug: {
          email: { valore: clientEmail, valido: emailValid },
          chiave: { valida_dopo_pulizia: keyValidAfterClean }
        }
      });
    }
    
    console.log("✅ Formato credenziali OK, tentativo connessione reale...");
    
    // 🚀 TEST CONNESSIONE REALE
    try {
      // Crea JWT per autenticazione
      const serviceAccountAuth = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      // Connetti al Google Sheet
      const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
      
      // Test 1: Carica info documento
      await doc.loadInfo();
      console.log("✅ Documento caricato:", doc.title);
      
      // Test 2: Accedi al primo foglio
      const sheet = doc.sheetsByIndex[0];
      console.log("✅ Primo foglio:", sheet.title);
      
      // Test 3: Leggi le prime righe
      await sheet.loadHeaderRow();
      const headers = sheet.headerValues;
      console.log("✅ Headers trovati:", headers);
      
      // Test 4: Conta le righe
      const rows = await sheet.getRows();
      console.log("✅ Righe trovate:", rows.length);
      
      // SUCCESS! 🎉
      return res.status(200).json({
        success: true,
        message: "🎉 CONNESSIONE RIUSCITA!",
        data: {
          documento: {
            titolo: doc.title,
            id: doc.spreadsheetId,
            fogli: doc.sheetsByIndex.length
          },
          primo_foglio: {
            titolo: sheet.title,
            righe: rows.length,
            colonne: headers.length,
            headers: headers.slice(0, 10) // Prime 10 colonne
          }
        },
        test_completati: [
          "✅ Autenticazione Service Account",
          "✅ Accesso al documento",
          "✅ Lettura metadati foglio",
          "✅ Lettura headers",
          "✅ Conteggio righe"
        ]
      });
      
    } catch (connectionError) {
      console.error("❌ Errore connessione:", connectionError);
      
      // Analizza il tipo di errore
      let errorType = "ERRORE_GENERICO";
      let suggestion = "Controlla le configurazioni";
      
      if (connectionError.message.includes('403')) {
        errorType = "ACCESSO_NEGATO";
        suggestion = "Il Google Sheet non è condiviso con il Service Account";
      } else if (connectionError.message.includes('404')) {
        errorType = "SHEET_NON_TROVATO";
        suggestion = "Verifica l'ID del Google Sheet";
      } else if (connectionError.message.includes('401')) {
        errorType = "CREDENZIALI_INVALIDE";
        suggestion = "Le credenziali sono errate o scadute";
      } else if (connectionError.message.includes('400')) {
        errorType = "RICHIESTA_MALFORMATA";
        suggestion = "Problema con il formato della richiesta";
      }
      
      return res.status(400).json({
        success: false,
        error: "ERRORE_CONNESSIONE",
        tipo_errore: errorType,
        messaggio: connectionError.message,
        suggerimento: suggestion,
        debug: {
          email: clientEmail,
          sheet_id: sheetId,
          chiave_lunghezza: privateKey.length
        },
        cosa_fare: [
          "1. Verifica che il Google Sheet sia condiviso con: " + clientEmail,
          "2. Controlla che le API Google Sheets siano abilitate",
          "3. Verifica l'ID del Google Sheet",
          "4. Assicurati che il Service Account abbia i permessi corretti"
        ]
      });
    }
    
  } catch (error) {
    console.error("❌ Errore generale:", error);
    return res.status(500).json({
      success: false,
      error: "ERRORE_INTERNO",
      messaggio: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
