import { GoogleSpreadsheet } from 'google-spreadsheet';

export default async function handler(req, res) {
  try {
    console.log("🔍 Test connessione Google Sheets");
    
    // Verifica variabili d'ambiente
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
    
    // Pulizia chiave privata
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    privateKey = privateKey.trim();
    
    // Verifica formato credenziali
    const emailValid = clientEmail.includes('@') && clientEmail.includes('.iam.gserviceaccount.com');
    const keyValid = privateKey.includes('-----BEGIN PRIVATE KEY-----') && privateKey.includes('-----END PRIVATE KEY-----');
    
    if (!emailValid || !keyValid) {
      return res.status(400).json({
        success: false,
        error: "Formato credenziali non valido",
        debug: {
          email_valida: emailValid,
          chiave_valida: keyValid,
          chiave_lunghezza: privateKey.length
        }
      });
    }
    
    console.log("✅ Credenziali formattate correttamente, test connessione...");
    
    // Test connessione a Google Sheets
    try {
      const doc = new GoogleSpreadsheet(sheetId);
      
      // Autenticazione
      await doc.useServiceAccountAuth({
        client_email: clientEmail,
        private_key: privateKey,
      });
      
      // Carica informazioni documento
      await doc.loadInfo();
      console.log("✅ Documento caricato:", doc.title);
      
      // Accedi al primo foglio
      const sheet = doc.sheetsByIndex[0];
      if (!sheet) {
        throw new Error("Nessun foglio trovato nel documento");
      }
      
      // Carica headers
      await sheet.loadHeaderRow();
      const headers = sheet.headerValues || [];
      
      // Conta le righe
      const rows = await sheet.getRows();
      
      // SUCCESS!
      return res.status(200).json({
        success: true,
        message: "🎉 CONNESSIONE RIUSCITA!",
        data: {
          documento: {
            titolo: doc.title,
            id: doc.spreadsheetId,
            url: `https://docs.google.com/spreadsheets/d/${doc.spreadsheetId}`
          },
          foglio: {
            titolo: sheet.title,
            righe: rows.length,
            colonne: headers.length,
            headers: headers.slice(0, 5) // Prime 5 colonne
          }
        },
        test_completati: [
          "✅ Autenticazione Service Account",
          "✅ Accesso al documento",
          "✅ Lettura metadati",
          "✅ Conteggio righe e colonne"
        ]
      });
      
    } catch (connectError) {
      console.error("❌ Errore connessione:", connectError.message);
      
      let errorType = "ERRORE_CONNESSIONE";
      let suggestion = "Verifica la configurazione";
      
      if (connectError.message.includes('403') || connectError.message.includes('Forbidden')) {
        errorType = "ACCESSO_NEGATO";
        suggestion = "Il Google Sheet non è condiviso con il Service Account";
      } else if (connectError.message.includes('404') || connectError.message.includes('not found')) {
        errorType = "DOCUMENTO_NON_TROVATO";
        suggestion = "Verifica l'ID del Google Sheet";
      } else if (connectError.message.includes('401') || connectError.message.includes('Unauthorized')) {
        errorType = "CREDENZIALI_INVALIDE";
        suggestion = "Le credenziali del Service Account sono errate";
      }
      
      return res.status(400).json({
        success: false,
        error: errorType,
        messaggio: connectError.message,
        suggerimento: suggestion,
        azioni_da_fare: [
          `1. Condividi il Google Sheet con: ${clientEmail}`,
          "2. Verifica che le API Google Sheets siano abilitate",
          "3. Controlla l'ID del Google Sheet",
          "4. Assicurati che il Service Account sia attivo"
        ]
      });
    }
    
  } catch (error) {
    console.error("❌ Errore generale:", error);
    return res.status(500).json({
      success: false,
      error: "ERRORE_INTERNO",
      messaggio: error.message
    });
  }
}
