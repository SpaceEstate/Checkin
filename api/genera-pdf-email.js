// api/stripeWebhook.js
// VERSIONE CON LOGGING DETTAGLIATO

import Stripe from 'stripe';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
    console.log('✅ Webhook verificato:', event.type);
  } catch (err) {
    console.error('❌ Errore verifica webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('💰 Pagamento completato per sessione:', session.id);
    
    const emailCliente = session.customer_details?.email || null;
    console.log('📧 Email cliente da Stripe:', emailCliente || 'NESSUNA');
    
    try {
      // 1. Google Sheets (priorità massima)
      console.log('📊 === INIZIO SCRITTURA GOOGLE SHEETS ===');
      await scriviDatiSuGoogleSheets(session);
      console.log('✅ Google Sheets completato');
      
      // 2. Email proprietario con PDF
      console.log('📧 === INIZIO EMAIL PROPRIETARIO ===');
      try {
        await generaPDFEInviaEmailConDebug(session);
        console.log('✅ Email proprietario completata');
      } catch (pdfError) {
        console.error('⚠️ ERRORE Email proprietario:', pdfError.message);
        console.error('Stack completo:', pdfError.stack);
        // NON bloccare il flusso - continua comunque
      }
      
      // 3. Email ospite
      if (emailCliente) {
        console.log('📧 === INIZIO EMAIL OSPITE ===');
        try {
          await inviaEmailOspite(session, emailCliente);
          console.log('✅ Email ospite completata');
        } catch (emailError) {
          console.error('⚠️ ERRORE Email ospite:', emailError.message);
          console.error('Stack completo:', emailError.stack);
        }
      } else {
        console.warn('⚠️ Email cliente non disponibile, skip email ospite');
      }
      
      console.log('🎉 === WEBHOOK COMPLETATO CON SUCCESSO ===');
      
    } catch (error) {
      console.error('❌ ERRORE CRITICO elaborazione webhook:', error);
      console.error('Stack completo:', error.stack);
      return res.status(500).json({ 
        error: 'Errore interno', 
        message: error.message 
      });
    }
  }

  res.status(200).json({ received: true });
}

// === FUNZIONI SUPPORTO ===

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function scriviDatiSuGoogleSheets(session) {
  console.log('📊 Scrittura Google Sheets...');
  
  const metadata = session.metadata;
  
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    const sheet = doc.sheetsByIndex[0];
    
    // Riga responsabile
    const rigaResponsabile = {
      'Data Check-in': metadata.dataCheckin || '',
      'Appartamento': metadata.appartamento || '',
      'Numero Ospiti': metadata.numeroOspiti || '',
      'Numero Notti': metadata.numeroNotti || '',
      'Tipo Gruppo': metadata.tipoGruppo || '',
      'Totale': metadata.totale || '',
      'Numero Ospite': '1',
      'Cognome': metadata.resp_cognome || '',
      'Nome': metadata.resp_nome || '',
      'Genere': metadata.resp_genere || '',
      'Data Nascita': metadata.resp_nascita || '',
      'Età': metadata.resp_eta || '',
      'Cittadinanza': metadata.resp_cittadinanza || '',
      'Luogo Nascita': metadata.resp_luogoNascita || '',
      'Comune': metadata.resp_comune || '',
      'Provincia': metadata.resp_provincia || '',
      'Tipo Documento': metadata.resp_tipoDocumento || '',
      'Numero Documento': metadata.resp_numeroDocumento || '',
      'Luogo Rilascio': metadata.resp_luogoRilascio || '',
      'Timestamp': metadata.timestamp || new Date().toISOString(),
      'Stripe Session ID': session.id,
    };
    
    await sheet.addRow(rigaResponsabile);
    console.log('✅ Responsabile aggiunto');
    
    // Altri ospiti
    if (metadata.altri_ospiti) {
      try {
        const altriOspiti = JSON.parse(metadata.altri_ospiti);
        for (const ospite of altriOspiti) {
          const rigaOspite = {
            'Data Check-in': metadata.dataCheckin || '',
            'Appartamento': metadata.appartamento || '',
            'Numero Ospiti': metadata.numeroOspiti || '',
            'Numero Notti': metadata.numeroNotti || '',
            'Tipo Gruppo': metadata.tipoGruppo || '',
            'Totale': metadata.totale || '',
            'Numero Ospite': ospite.n.toString(),
            'Cognome': ospite.c || '',
            'Nome': ospite.no || '',
            'Genere': ospite.g || '',
            'Data Nascita': ospite.na || '',
            'Età': ospite.e ? ospite.e.toString() : '',
            'Cittadinanza': ospite.ci || '',
            'Luogo Nascita': ospite.ln || '',
            'Comune': ospite.co || '',
            'Provincia': ospite.p || '',
            'Timestamp': metadata.timestamp || new Date().toISOString(),
            'Stripe Session ID': session.id,
          };
          await sheet.addRow(rigaOspite);
        }
        console.log(`✅ ${altriOspiti.length} altri ospiti aggiunti`);
      } catch (e) {
        console.warn('⚠️ Errore parsing altri_ospiti:', e);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore Google Sheets:', error);
    throw error;
  }
}

function ricostruisciDatiPrenotazione(metadata) {
  const datiPrenotazione = {
    dataCheckin: metadata.dataCheckin,
    appartamento: metadata.appartamento,
    numeroOspiti: parseInt(metadata.numeroOspiti) || 0,
    numeroNotti: parseInt(metadata.numeroNotti) || 0,
    tipoGruppo: metadata.tipoGruppo || null,
    totale: parseFloat(metadata.totale) || 0,
    timestamp: metadata.timestamp,
    ospiti: [],
    documenti: []
  };

  // Responsabile
  datiPrenotazione.ospiti.push({
    numero: 1,
    cognome: metadata.resp_cognome,
    nome: metadata.resp_nome,
    genere: metadata.resp_genere,
    nascita: metadata.resp_nascita,
    eta: parseInt(metadata.resp_eta) || 0,
    cittadinanza: metadata.resp_cittadinanza,
    luogoNascita: metadata.resp_luogoNascita,
    comune: metadata.resp_comune,
    provincia: metadata.resp_provincia,
    tipoDocumento: metadata.resp_tipoDocumento,
    numeroDocumento: metadata.resp_numeroDocumento,
    luogoRilascio: metadata.resp_luogoRilascio,
    isResponsabile: true
  });

  // Altri ospiti
  if (metadata.altri_ospiti) {
    try {
      const altriOspiti = JSON.parse(metadata.altri_ospiti);
      altriOspiti.forEach(o => {
        datiPrenotazione.ospiti.push({
          numero: o.n,
          cognome: o.c,
          nome: o.no,
          genere: o.g,
          nascita: o.na,
          eta: parseInt(o.e) || 0,
          cittadinanza: o.ci,
          luogoNascita: o.ln,
          comune: o.co,
          provincia: o.p
        });
      });
    } catch (e) {
      console.warn('⚠️ Errore parsing altri_ospiti:', e);
    }
  }

  return datiPrenotazione;
}

async function generaPDFEInviaEmailConDebug(session) {
  console.log('📧 Preparazione email proprietario...');
  
  const metadata = session.metadata;
  const tempSessionId = metadata.temp_session_id;
  
  console.log('🔑 Temp Session ID:', tempSessionId || 'NESSUNO');
  
  let datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
  
  // Recupera documenti da Redis
  if (tempSessionId) {
    try {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'https://checkin-six-coral.vercel.app';
      
      console.log('🔍 Recupero documenti da Redis...');
      const redisResponse = await fetch(
        `${baseUrl}/api/salva-dati-temporanei?sessionId=${tempSessionId}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );
      
      if (redisResponse.ok) {
        const redisData = await redisResponse.json();
        if (redisData.success && redisData.datiPrenotazione?.documenti) {
          datiPrenotazione.documenti = redisData.datiPrenotazione.documenti;
          console.log(`✅ Recuperati ${datiPrenotazione.documenti.length} documenti`);
        }
      } else {
        console.warn('⚠️ Redis non disponibile:', redisResponse.status);
      }
    } catch (redisError) {
      console.warn('⚠️ Errore recupero Redis:', redisError.message);
    }
  }
  
  const emailProprietario = process.env.EMAIL_PROPRIETARIO;
  
  if (!emailProprietario) {
    throw new Error('EMAIL_PROPRIETARIO non configurato nelle variabili ambiente');
  }
  
  console.log('📬 Destinatario proprietario:', emailProprietario);
  console.log('📊 Dati da inviare:', {
    ospiti: datiPrenotazione.ospiti.length,
    documenti: datiPrenotazione.documenti.length,
    totale: datiPrenotazione.totale
  });
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://checkin-six-coral.vercel.app';
  
  const apiUrl = `${baseUrl}/api/genera-pdf-email`;
  console.log('🌐 Chiamata API:', apiUrl);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    console.log('📤 Invio richiesta...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CheckinWebhook/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        datiPrenotazione: datiPrenotazione,
        emailDestinatario: emailProprietario
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 Status risposta:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API:', errorText);
      throw new Error(`Errore API (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Risposta API:', result);
    
  } catch (error) {
    console.error('❌ Errore fetch:', error.message);
    if (error.name === 'AbortError') {
      console.error('⏱️ TIMEOUT: L\'invio email ha superato i 25 secondi');
    }
    throw error;
  }
}

async function inviaEmailOspite(session, emailCliente) {
  console.log('📧 Preparazione email ospite...');
  
  const metadata = session.metadata;
  const datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://checkin-six-coral.vercel.app';
  
  const apiUrl = `${baseUrl}/api/invia-email-ospite`;
  console.log('🌐 Chiamata API ospite:', apiUrl);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CheckinWebhook/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        emailOspite: emailCliente,
        datiPrenotazione: datiPrenotazione
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 Status risposta ospite:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API ospite:', errorText);
      throw new Error(`Errore API (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Risposta API ospite:', result);
    
  } catch (error) {
    console.error('❌ Errore invio ospite:', error.message);
    throw error;
  }
}
