import { GoogleSpreadsheet } from "google-spreadsheet";

export default async function handler(req, res) {
  try {
    // Inizializza documento con ID
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);

    // Autenticazione usando credenziali Service Account
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    // Carica le informazioni del documento
    await doc.loadInfo();

    // Seleziona il primo foglio
    const sheet = doc.sheetsByIndex[0];

    // Risposta JSON di test
    res.status(200).json({
      message: "✅ Connessione riuscita!",
      titoloDocumento: doc.title,
      primoFoglio: sheet.title,
      righe: sheet.rowCount,
      colonne: sheet.columnCount,
    });
  } catch (error) {
    console.error("Errore Google Sheets:", error);
    res.status(500).json({ error: error.message });
  }
}
