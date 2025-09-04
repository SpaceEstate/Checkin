import { GoogleSpreadsheet } from "google-spreadsheet";

export default async function handler(req, res) {
  try {
    console.log("🔍 Test Google Sheets v5 con gestione header duplicati");
    
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

    console.log("📄 Inizializzazione documento v5...");
    
    // Prepara le credenziali per v5
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // Syntax per google-spreadsheet v5 - passa le credenziali al costruttore
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: privateKey,
    });

    console.log("📊 Caricamento info documento...");
    await doc.loadInfo();
    
    const sheet = doc.sheetsByIndex[0];
    if (!sheet) {
      throw new Error("Nessun foglio trovato");
    }

    console.log("📋 Analisi headers...");
    
    // Carica gli headers
    await sheet.loadHeaderRow();
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
        warning: "🚨 HEADER DUPLICATI RILEVATI",
        message: "Il foglio Google ha header duplicati che impediscono il funzionamento",
        data: {
          titolo: doc.title,
          foglio: sheet.title,
          righeTotali: sheet.rowCount,
          colonneTotali: sheet.columnCount,
          headersTrovati: rawHeaders,
          duplicatiDettaglio: duplicates,
          istruzioniRisoluzione: [
            `1. Apri: https://docs.google.com/spreadsheets/d/${process.env.SHEET_ID}`,
            "2. Nella prima riga, trova le colonne con nomi duplicati",
            "3. Rinomina gli header duplicati (es: 'Cognome' → 'Cognome Partner')",
            "4. Salva e riprova questo test"
          ]
        }
      });
    }

    // Headers unici - proviamo a caricare i dati
    console.log("✅ Headers validi, caricamento righe...");
    
    const rows = await sheet.getRows({ limit: 3 });
    
    return res.status(200).json({
      success: true,
      message: "🎉 CONNESSIONE GOOGLE SHEETS RIUSCITA!",
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

  } catch (error) {
    console.error("❌ Errore:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      suggerimento: "Se l'errore persiste, controlla le variabili d'ambiente su Vercel"
    });
  }
}
