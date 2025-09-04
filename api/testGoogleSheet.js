import { GoogleSpreadsheet } from "google-spreadsheet";

export default async function handler(req, res) {
  try {
    console.log("🔍 Test Google Sheets v4 con gestione header duplicati");
    
    // Verifica variabili d'ambiente
    if (!process.env.SHEET_ID) {
      return res.status(500).json({ error: "SHEET_ID mancante" });
    }
    if (!process.env.GOOGLE_CLIENT_EMAIL) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_EMAIL mancante" });
    }
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: "GOOGLE_PRIVATE_KEY mancante" });
    }

    console.log("📄 Inizializzazione documento...");
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);
    
    console.log("🔐 Autenticazione...");
    // Syntax per google-spreadsheet v4
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    console.log("📊 Caricamento info documento...");
    await doc.loadInfo();
    
    const sheet = doc.sheetsByIndex[0];
    if (!sheet) {
      throw new Error("Nessun foglio trovato");
    }

    console.log("📋 Analisi headers...");
    
    // In v4, gli headers sono già disponibili dopo loadInfo
    const rawHeaders = sheet.headerValues || [];
    
    console.log("🔍 Headers trovati:", rawHeaders);
    
    // Controlla duplicati
    const headerCounts = {};
    const duplicates = [];
    
    rawHeaders.forEach((header, index) => {
      if (header && header.trim()) {
        const cleanHeader = header.trim();
        headerCounts[cleanHeader] = (headerCounts[cleanHeader] || 0) + 1;
        if (headerCounts[cleanHeader] > 1) {
          duplicates.push({ 
            header: cleanHeader, 
            posizione: index + 1,
            colonna: String.fromCharCode(65 + index) // A, B, C, etc.
          });
        }
      }
    });

    if (duplicates.length > 0) {
      console.log("⚠️ Header duplicati trovati:", duplicates);
      
      return res.status(200).json({
        success: false,
        warning: "HEADER DUPLICATI RILEVATI",
        message: "Gli header nel foglio Google devono essere unici per funzionare correttamente",
        data: {
          titolo: doc.title,
          foglio: sheet.title,
          righeTotali: sheet.rowCount,
          colonneTotali: sheet.columnCount,
          headers: rawHeaders,
          duplicatiTrovati: duplicates,
          soluzione: [
            "1. Apri il foglio Google Sheets",
            "2. Modifica gli header duplicati nella prima riga", 
            "3. Assicurati che ogni header sia unico",
            "4. Riprova questo test"
          ]
        }
      });
    }

    // Headers unici - possiamo caricare i dati
    console.log("✅ Headers validi, caricamento righe...");
    
    try {
      const rows = await sheet.getRows({ limit: 3 });
      
      return res.status(200).json({
        success: true,
        message: "✅ Test completato con successo!",
        data: {
          titolo: doc.title,
          foglio: sheet.title,
          righeTotali: sheet.rowCount,
          colonneTotali: sheet.columnCount,
          headers: rawHeaders,
          righeCaricate: rows.length,
          esempioDati: rows.slice(0, 2).map(row => {
            const rowData = {};
            rawHeaders.forEach((header, index) => {
              if (header && header.trim()) {
                rowData[header] = row._rawData[index] || '';
              }
            });
            return rowData;
          })
        }
      });
      
    } catch (rowError) {
      console.log("⚠️ Errore nel caricamento righe (probabilmente header duplicati):", rowError.message);
      
      return res.status(200).json({
        success: false,
        warning: "Errore nel caricamento dati",
        message: "Connessione OK ma problema con gli header del foglio",
        error: rowError.message,
        data: {
          titolo: doc.title,
          foglio: sheet.title,
          headers: rawHeaders,
          suggerimento: "Controlla che tutti gli header siano unici"
        }
      });
    }

  } catch (error) {
    console.error("❌ Errore generale:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}
