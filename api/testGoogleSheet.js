import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  try {
    console.log("🔍 Inizio test connessione Google Sheets v5");
    
    // Verifica variabili d'ambiente
    if (!process.env.SHEET_ID) {
      throw new Error("SHEET_ID mancante nelle variabili d'ambiente");
    }
    if (!process.env.GOOGLE_CLIENT_EMAIL) {
      throw new Error("GOOGLE_CLIENT_EMAIL mancante nelle variabili d'ambiente");
    }
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error("GOOGLE_PRIVATE_KEY mancante nelle variabili d'ambiente");
    }

    console.log("✅ Variabili d'ambiente presenti");
    console.log("📋 SHEET_ID:", process.env.SHEET_ID);
    console.log("📧 CLIENT_EMAIL:", process.env.GOOGLE_CLIENT_EMAIL);

    // Prepara la chiave privata
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // Crea l'oggetto JWT per l'autenticazione (API v5)
    console.log("🔐 Creazione JWT per autenticazione...");
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    // Inizializza documento con auth
    console.log("📄 Inizializzazione documento...");
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);

    // Carica info del documento
    console.log("📊 Caricamento info documento...");
    await doc.loadInfo();
    console.log("✅ Info documento caricate");
    console.log("📋 Titolo documento:", doc.title);

    // Accedi al primo foglio
    const sheet = doc.sheetsByIndex[0];
    if (!sheet) {
      throw new Error("Nessun foglio trovato nel documento");
    }
    
    console.log("📄 Primo foglio:", sheet.title);
    
    // Carica le righe (con limite per evitare timeout)
    console.log("📊 Caricamento righe...");
    const rows = await sheet.getRows({ limit: 10 });
    console.log("✅ Righe caricate:", rows.length);

    // Risposta di successo
    return res.status(200).json({
      success: true,
      message: "✅ Connessione Google Sheets riuscita!",
      data: {
        titolo: doc.title,
        primoFoglio: sheet.title,
        righeTotali: sheet.rowCount,
        colonneTotali: sheet.columnCount,
        righeCaricate: rows.length,
        headers: sheet.headerValues || [],
        primeRighe: rows.slice(0, 3).map(row => row._rawData)
      }
    });

  } catch (error) {
    console.error("❌ Errore Google Sheets:", error);
    
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.name,
      timestamp: new Date().toISOString()
    });
  }
}
