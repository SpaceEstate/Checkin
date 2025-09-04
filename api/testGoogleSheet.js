import { GoogleSpreadsheet } from "google-spreadsheet";

export default async function handler(req, res) {
  try {
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);

    // Autenticazione con Service Account (nuovo metodo)
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    // Carica info documento
    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0];

    return res.status(200).json({
      message: "✅ Connessione riuscita!",
      titolo: doc.title,
      primoFoglio: sheet.title,
      righe: sheet.rowCount,
      colonne: sheet.columnCount,
    });
  } catch (error) {
    console.error("Errore Google Sheets:", error);
    return res.status(500).json({ error: error.message });
  }
}
