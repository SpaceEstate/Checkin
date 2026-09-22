// api/verifica-prenotazione.js
// Endpoint per verificare e recuperare dati prenotazione da Google Sheets

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Normalizza una data (proveniente dal foglio Google Sheets, in formato
// potenzialmente diverso) in una stringa ISO stretta "YYYY-MM-DD", come
// richiesto da <input type="date">. Ritorna null se non riesce a
// riconoscere il formato, invece di restituire una stringa "quasi giusta"
// che il campo data rifiuterebbe silenziosamente.
function normalizzaDataISO(valore) {
  if (!valore) return null;
  const raw = String(valore).trim();

  // Già in formato ISO (anno-mese-giorno), eventualmente con un orario
  // attaccato (es. "2026-09-22T00:00:00.000Z" o "2026-09-22 00:00:00"):
  // riconosciuto dal fatto che inizia con 4 cifre. In questo caso NON va
  // toccato, va solo tagliata l'eventuale parte oraria.
  let m = raw.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (m) {
    const anno = m[1];
    const mese = m[2].padStart(2, '0');
    const giorno = m[3].padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
  }

  // Formato giorno-primo (GG/MM/AAAA, GG-MM-AAAA, GG.MM.AAAA): riconosciuto
  // dal fatto che l'anno (4 cifre) è l'ULTIMO pezzo, non il primo.
  m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) {
    const giorno = m[1].padStart(2, '0');
    const mese = m[2].padStart(2, '0');
    const anno = m[3];
    return `${anno}-${mese}-${giorno}`;
  }

  // Ultima spiaggia: prova il parser nativo di Date (copre ad es. le
  // stringhe restituite da Google Sheets come oggetto Date serializzato).
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

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

    // Converti data in formato ISO (YYYY-MM-DD), qualunque sia il formato
    // in cui è salvata nel foglio.
    //
    // BUG STORICO: il vecchio codice assumeva SEMPRE un formato giorno-primo
    // (GG/MM/AAAA) e prendeva l'ultimo pezzo come anno. Ma le prenotazioni
    // create dal sito stesso (dopo pagamento Stripe, vedi stripeWebhook.js)
    // salvano la data già in formato ISO AAAA-MM-GG. Per una data tipo
    // "2026-09-22", quel codice produceva "22-09-2026": non valido per un
    // <input type="date"> (che richiede rigorosamente AAAA-MM-GG). Il campo
    // risultava quindi vuoto e, siccome veniva comunque bloccato in sola
    // lettura, anche il selettore calendario del browser restava disabilitato.
    const dataISO = normalizzaDataISO(datiPrenotazione.dataCheckin);

    if (!dataISO) {
      console.warn('⚠️ Data check-in non riconosciuta:', datiPrenotazione.dataCheckin);
      return res.status(400).json({
        found: false,
        error: "Data check-in non valida nel sistema",
        message: `Formato data non riconosciuto: "${datiPrenotazione.dataCheckin}"`
      });
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
