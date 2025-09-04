import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  try {
    console.log("🔍 Test connessione Google Sheets v4+");

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

    const sheetId = process.env.SHEET_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    privateKey = privateKey.trim();

    // Autenticazione via google-auth-library
    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0];
    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();

    return res.status(200).json({
      success: true,
      message: "🎉 CONNESSIONE RIUSCITA (v4+)!",
      data: {
        documento: {
          titolo: doc.title,
          id: doc.spreadsheetId,
          url: `https://docs.google.com/spreadsheets/d/${doc.spreadsheetId}`
        },
        foglio: {
          titolo: sheet.title,
          righe: rows.length,
          colonne: sheet.headerValues.length,
          headers: sheet.headerValues.slice(0, 5)
        }
      }
    });

  } catch (error) {
    console.error("❌ Errore connessione:", error);
    return res.status(500).json({
      success: false,
      error: "ERRORE_CONNESSIONE",
      messaggio: error.message
    });
  }
}
