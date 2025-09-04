import { GoogleSpreadsheet } from "google-spreadsheet";

export default async function handler(req, res) {
  try {
    console.log("🔍 Test Google Sheets v4");
    
    // Verifica env vars
    if (!process.env.SHEET_ID) {
      return res.status(500).json({ error: "SHEET_ID mancante" });
    }
    if (!process.env.GOOGLE_CLIENT_EMAIL) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_EMAIL mancante" });
    }
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: "GOOGLE_PRIVATE_KEY mancante" });
    }

    // Inizializza documento
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);
    
    // Autenticazione (v4 syntax)
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    // Carica info
    await doc.loadInfo();
    console.log("✅ Documento caricato:", doc.title);

    // Primo foglio
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows({ limit: 3 });

    return res.status(200).json({
      success: true,
      message: "✅ Connessione riuscita!",
      data: {
        titolo: doc.title,
        foglio: sheet.title,
        righe: sheet.rowCount,
        colonne: sheet.columnCount,
        headers: sheet.headerValues,
        primiDati: rows.map(row => row._rawData)
      }
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
