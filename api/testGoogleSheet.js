import { GoogleSpreadsheet } from "google-spreadsheet";

export default async function handler(req, res) {
  try {
    // Inizializza documento con ID dal .env
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);

    // Autenticazione Service Account
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    // Carica info del documento
    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0]; // primo foglio
    const rows = await sheet.getRows(); // recupera tutte le righe

    return res.status(200).json({
      message: "✅ Connessione riuscita!",
      titolo: doc.title,
      primoFoglio: sheet.title,
      righeTotali: sheet.rowCount,
      colonneTotali: sheet.columnCount,
      primeRighe: rows.slice(0, 5) // solo esempio
    });
  } catch (error) {
    console.error("Errore Google Sheets:", error);
    return res.status(500).json({ error: error.message });
  }
}
