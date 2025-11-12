// api/verifica-prenotazione.js
// Endpoint per verificare e recuperare dati prenotazione da Google Sheets

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  console.log('🔍 === VERIFICA NUMERO PRENOTAZIONE ===');

  try {
    const { numeroPrenotazione } = req.body;

    if (!numeroPrenotazione || !numeroPrenotazione.trim()) {
      return res.status(400).json({ 
        error: "Numero prenotazione richiesto",
        found: false
      });
    }

    console.log('🔑 Numero prenotazione ricercato:', numeroPrenotazione);

    // Connessione a Google Sheets
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // IMPORTANTE: Usa lo SHEET_ID_PRENOTAZIONI (nuovo foglio prenotazioni)
    // Crea un nuovo foglio Google Sheets con colonne:
    // A: Numero Prenotazione | B: Data Check-in | C: Appartamento | D: Numero Ospiti | E: Numero Notti
    const SHEET_ID_PRENOTAZIONI = process.env.SHEET_ID_PRENOTAZIONI || process.env.SHEET_ID;
    
    const doc = new GoogleSpreadsheet(SHEET_ID_PRENOTAZIONI, serviceAccountAuth);
    await doc.loadInfo();
    
    console.log('📊 Google Sheet caricato:', doc.title);
    
    // Cerca nel primo foglio (o specifica il nome del foglio)
    const sheet = doc.sheetsByIndex[0];
    console.log('📄 Foglio:', sheet.title);
    
    // Carica tutte le righe
    const rows = await sheet.getRows();
    console.log(`📋 Righe totali nel foglio: ${rows.length}`);

    // Cerca la prenotazione (case-insensitive, trim degli spazi)
    const numeroNormalizzato = numeroPrenotazione.trim().toUpperCase();
    
    const prenotazioneTrovata = rows.find(row => {
      const numeroRiga = (row.get('Numero Prenotazione') || '').toString().trim().toUpperCase();
      return numeroRiga === numeroNormalizzato;
    });

    if (!prenotazioneTrovata) {
      console.log('❌ Prenotazione non trovata');
      return res.status(404).json({
        found: false,
        message: "Numero prenotazione non trovato"
      });
    }

    console.log('✅ Prenotazione trovata!');

    // Estrai i dati
    const datiPrenotazione = {
      numeroPrenotazione: prenotazioneTrovata.get('Numero Prenotazione'),
      dataCheckin: prenotazioneTrovata.get('Data Check-in'),
      appartamento: prenotazioneTrovata.get('Appartamento'),
      numeroOspiti: parseInt(prenotazioneTrovata.get('Numero Ospiti')) || 0,
      numeroNotti: parseInt(prenotazioneTrovata.get('Numero Notti')) || 0,
      // Tipo gruppo rimane vuoto - compilato dall'utente
      tipoGruppo: null
    };

    console.log('📦 Dati estratti:', datiPrenotazione);

    // Validazione dati minimi
    if (!datiPrenotazione.dataCheckin || !datiPrenotazione.appartamento) {
      console.warn('⚠️ Dati prenotazione incompleti');
      return res.status(400).json({
        found: false,
        error: "Dati prenotazione incompleti nel sistema"
      });
    }

    // Converti data in formato ISO (YYYY-MM-DD)
    let dataISO = datiPrenotazione.dataCheckin;
    try {
      // Gestisce vari formati di data (DD/MM/YYYY, DD-MM-YYYY, ecc.)
      const parti = dataISO.split(/[\/\-\.]/);
      if (parti.length === 3) {
        // Assume formato DD/MM/YYYY o DD-MM-YYYY
        const giorno = parti[0].padStart(2, '0');
        const mese = parti[1].padStart(2, '0');
        const anno = parti[2];
        dataISO = `${anno}-${mese}-${giorno}`;
      }
    } catch (e) {
      console.warn('⚠️ Errore conversione data:', e);
    }

    datiPrenotazione.dataCheckin = dataISO;

    console.log('✅ Dati validati e pronti');

    return res.status(200).json({
      found: true,
      dati: datiPrenotazione,
      message: "Prenotazione trovata con successo"
    });

  } catch (error) {
    console.error('❌ Errore verifica prenotazione:', error);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({
      found: false,
      error: "Errore interno del server",
      message: error.message
    });
  }
}
