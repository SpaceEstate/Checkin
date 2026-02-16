// api/stripeWebhook.js
// VERSIONE ULTRA-ROBUSTA - Funziona anche senza PostgreSQL

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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`\n🎯 [${requestId}] WEBHOOK STRIPE ${new Date().toISOString()}`);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await buffer(req);
    const sig = req.headers['stripe-signature'];

    if (!sig || !endpointSecret) {
      console.error(`❌ [${requestId}] Configurazione mancante`);
      return res.status(400).send('Webhook Error: Missing configuration');
    }

    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log(`✅ [${requestId}] Evento: ${event.type} (${event.id})`);

  } catch (err) {
    console.error(`❌ [${requestId}] Errore signature:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Risposta IMMEDIATA a Stripe
  res.status(200).json({ received: true, requestId, eventId: event.id });

  // Processing asincrono
  if (event.type === 'checkout.session.completed') {
    processPayment(event, requestId).catch(err => {
      console.error(`❌ [${requestId}] Processing error:`, err.message);
    });
  }
}

async function processPayment(event, requestId) {
  try {
    const session = event.data.object;
    const metadata = session.metadata || {};
    
    console.log(`\n💰 [${requestId}] === PAGAMENTO COMPLETATO ===`);
    console.log(`   Session: ${session.id}`);
    console.log(`   Email: ${session.customer_details?.email}`);
    console.log(`   Importo: €${(session.amount_total / 100).toFixed(2)}`);

    // ✅ FALLBACK: Ricostruisci dati da metadata
    let datiCompleti = buildFromMetadata(metadata, session);
    
    // 🔄 OPZIONALE: Prova PostgreSQL (NON bloccante)
    const tempSessionId = metadata.temp_session_id;
    if (tempSessionId) {
      console.log(`📦 [${requestId}] Tentativo PostgreSQL (non bloccante)...`);
      
      try {
        const pgData = await fetchPostgresWithTimeout(tempSessionId, 5000);
        if (pgData) {
          datiCompleti = pgData;
          console.log(`✅ [${requestId}] Dati arricchiti da PostgreSQL`);
        }
      } catch (pgError) {
        console.warn(`⚠️ [${requestId}] PostgreSQL timeout/error, uso metadata`);
      }
    }

    console.log(`📊 [${requestId}] Dati finali:`);
    console.log(`   Ospiti: ${datiCompleti.ospiti?.length || 0}`);
    console.log(`   Documenti: ${datiCompleti.documenti?.length || 0}`);

    // 1. Google Sheets (non bloccante)
    saveToGoogleSheets(datiCompleti, requestId).catch(err => {
      console.error(`⚠️ [${requestId}] Google Sheets error:`, err.message);
    });

    // 2. Email Proprietario
    const emailProp = process.env.EMAIL_PROPRIETARIO;
    if (emailProp) {
      console.log(`\n📧 [${requestId}] Email proprietario...`);
      try {
        await sendOwnerEmail(datiCompleti, emailProp);
        console.log(`✅ [${requestId}] Email proprietario inviata`);
      } catch (err) {
        console.error(`❌ [${requestId}] Email proprietario fallita:`, err.message);
      }
    }

    // 3. Email Ospite
    const emailGuest = session.customer_details?.email;
    if (emailGuest) {
      console.log(`\n📧 [${requestId}] Email ospite...`);
      try {
        await sendGuestEmail(datiCompleti, emailGuest);
        console.log(`✅ [${requestId}] Email ospite inviata`);
      } catch (err) {
        console.error(`❌ [${requestId}] Email ospite fallita:`, err.message);
      }
    }

    console.log(`\n✅ [${requestId}] === COMPLETATO ===\n`);

  } catch (error) {
    console.error(`\n❌ [${requestId}] === ERRORE CRITICO ===`);
    console.error(error);
  }
}

// === UTILITY FUNCTIONS ===

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function buildFromMetadata(metadata, session) {
  const responsabile = {
    numero: 1,
    cognome: metadata.resp_cognome || '',
    nome: metadata.resp_nome || '',
    genere: metadata.resp_genere || 'M',
    nascita: metadata.resp_nascita || '',
    eta: parseInt(metadata.resp_eta) || 0,
    cittadinanza: metadata.resp_cittadinanza || 'Italia',
    luogoNascita: metadata.resp_luogoNascita || '',
    isResponsabile: true,
    email: session.customer_details?.email || ''
  };

  return {
    dataCheckin: metadata.dataCheckin || '',
    appartamento: metadata.appartamento || '',
    numeroOspiti: parseInt(metadata.numeroOspiti) || 1,
    numeroNotti: parseInt(metadata.numeroNotti) || 1,
    tipoGruppo: metadata.tipoGruppo || null,
    totale: parseFloat(metadata.totale) || 0,
    timestamp: metadata.timestamp || new Date().toISOString(),
    ospiti: [responsabile],
    documenti: []
  };
}

async function fetchPostgresWithTimeout(tempSessionId, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://checkin-six-coral.vercel.app';

    const response = await fetch(
      `${baseUrl}/api/salva-dati-temporanei?sessionId=${tempSessionId}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      return data.success ? data.datiPrenotazione : null;
    }

    return null;
  } catch (error) {
    clearTimeout(timeout);
    return null;
  }
}

async function saveToGoogleSheets(datiCompleti, requestId) {
  console.log(`📊 [${requestId}] Salvataggio Google Sheets...`);

  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  for (const ospite of datiCompleti.ospiti) {
    await sheet.addRow({
      'Data Check-in': datiCompleti.dataCheckin || '',
      'Appartamento': datiCompleti.appartamento || '',
      'Numero Ospiti': datiCompleti.numeroOspiti.toString(),
      'Numero Notti': datiCompleti.numeroNotti.toString(),
      'Tipo Gruppo': datiCompleti.tipoGruppo || '',
      'Totale': datiCompleti.totale.toString(),
      'Numero Ospite': ospite.numero.toString(),
      'Cognome': ospite.cognome || '',
      'Nome': ospite.nome || '',
      'Genere': ospite.genere || '',
      'Data Nascita': ospite.nascita || '',
      'Età': ospite.eta ? ospite.eta.toString() : '',
      'Cittadinanza': ospite.cittadinanza || '',
      'Luogo Nascita': ospite.luogoNascita || '',
      'Timestamp': datiCompleti.timestamp || new Date().toISOString()
    });
  }

  console.log(`✅ [${requestId}] Google Sheets salvato`);
}

async function sendOwnerEmail(datiCompleti, emailProprietario) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://checkin-six-coral.vercel.app';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);

  try {
    const response = await fetch(`${baseUrl}/api/genera-pdf-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datiPrenotazione: datiCompleti,
        emailDestinatario: emailProprietario
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function sendGuestEmail(datiCompleti, emailOspite) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://checkin-six-coral.vercel.app';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${baseUrl}/api/invia-email-ospite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOspite: emailOspite,
        datiPrenotazione: datiCompleti
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}
