// api/stripeWebhook.js
// VERSIONE CORRETTA - Gestione robusta errori + logging dettagliato

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
  
  console.log(`\n🎯 ========================================`);
  console.log(`🎯 WEBHOOK RICEVUTO: ${requestId}`);
  console.log(`🎯 Timestamp: ${new Date().toISOString()}`);
  console.log(`🎯 Method: ${req.method}`);
  console.log(`🎯 URL: ${req.url}`);
  console.log(`🎯 ========================================\n`);

  if (req.method !== 'POST') {
    console.warn(`⚠️ [${requestId}] Metodo non POST: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;
  let rawBody;

  try {
    // ✅ CRITICAL: Buffer del body
    rawBody = await buffer(req);
    console.log(`📦 [${requestId}] Body size: ${rawBody.length} bytes`);

    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error(`❌ [${requestId}] Stripe signature MANCANTE!`);
      console.error(`   Headers ricevuti:`, Object.keys(req.headers));
      return res.status(400).send(`Webhook Error: Missing Stripe signature`);
    }

    console.log(`🔐 [${requestId}] Signature presente (primi 50 chars): ${sig.substring(0, 50)}...`);

    if (!endpointSecret) {
      console.error(`❌ [${requestId}] STRIPE_WEBHOOK_SECRET non configurato!`);
      return res.status(500).send(`Webhook Error: Webhook secret not configured`);
    }

    console.log(`🔑 [${requestId}] Webhook secret configurato: ${endpointSecret.substring(0, 10)}...`);

    // ✅ Verifica signature
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
      console.log(`✅ [${requestId}] Webhook verificato con successo!`);
      console.log(`   Event Type: ${event.type}`);
      console.log(`   Event ID: ${event.id}`);
      console.log(`   Created: ${new Date(event.created * 1000).toISOString()}`);
    } catch (sigError) {
      console.error(`❌ [${requestId}] Errore verifica signature:`, sigError.message);
      console.error(`   Signature ricevuta: ${sig.substring(0, 100)}...`);
      console.error(`   Secret usato: ${endpointSecret.substring(0, 10)}...`);
      return res.status(400).send(`Webhook Error: ${sigError.message}`);
    }

  } catch (bufferError) {
    console.error(`❌ [${requestId}] Errore buffer body:`, bufferError.message);
    return res.status(400).send(`Webhook Error: ${bufferError.message}`);
  }

  // ✅ Risposta IMMEDIATA a Stripe (evita timeout)
  res.status(200).json({ received: true, requestId, eventId: event.id });

  // Gestisci l'evento in background (async)
  if (event.type === 'checkout.session.completed') {
    // Non usare await qui - lascia eseguire in background
    processCheckoutCompleted(event, requestId).catch(error => {
      console.error(`❌ [${requestId}] Errore processing (background):`, error.message);
    });
  } else {
    console.log(`ℹ️ [${requestId}] Evento ignorato: ${event.type}`);
  }
}

// Funzione async separata per processing
async function processCheckoutCompleted(event, requestId) {
  const startTime = Date.now();
  
  try {
    const session = event.data.object;
    
    console.log(`\n💰 [${requestId}] === INIZIO PROCESSING PAGAMENTO ===`);
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Payment Status: ${session.payment_status}`);
    console.log(`   Amount: €${(session.amount_total / 100).toFixed(2)}`);

    const emailCliente = session.customer_details?.email || null;
    console.log(`   Email Cliente: ${emailCliente || 'NESSUNA'}`);

    // ✅ Recupera dati completi
    console.log(`\n🔄 [${requestId}] Recupero dati completi...`);
    const datiCompleti = await recuperaDatiCompletiDaPostgres(session, requestId);
    
    console.log(`📊 [${requestId}] Dati recuperati:`);
    console.log(`   Ospiti: ${datiCompleti.ospiti?.length || 0}`);
    console.log(`   Documenti: ${datiCompleti.documenti?.length || 0}`);
    console.log(`   Totale: €${datiCompleti.totale}`);
    console.log(`   Appartamento: ${datiCompleti.appartamento}`);

    // 1. Google Sheets (non bloccante)
    scriviDatiSuGoogleSheets(datiCompleti, requestId).catch(err => {
      console.error(`⚠️ [${requestId}] Errore Google Sheets (non bloccante):`, err.message);
    });

    // 2. Email Proprietario (con retry)
    try {
      console.log(`\n📧 [${requestId}] === INVIO EMAIL PROPRIETARIO ===`);
      await generaPDFEInviaEmail(datiCompleti, requestId);
      console.log(`✅ [${requestId}] Email proprietario inviata`);
    } catch (emailError) {
      console.error(`❌ [${requestId}] ERRORE EMAIL PROPRIETARIO:`, emailError.message);
      console.error(`   Stack:`, emailError.stack);
    }

    // 3. Email Ospite (con retry)
    if (emailCliente) {
      try {
        console.log(`\n📧 [${requestId}] === INVIO EMAIL OSPITE ===`);
        await inviaEmailOspite(datiCompleti, emailCliente, requestId);
        console.log(`✅ [${requestId}] Email ospite inviata a ${emailCliente}`);
      } catch (emailError) {
        console.error(`❌ [${requestId}] ERRORE EMAIL OSPITE:`, emailError.message);
        console.error(`   Stack:`, emailError.stack);
      }
    } else {
      console.warn(`⚠️ [${requestId}] Email cliente mancante, skip email ospite`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ [${requestId}] === PROCESSING COMPLETATO in ${totalTime}ms ===\n`);

  } catch (error) {
    console.error(`\n❌ [${requestId}] === ERRORE GENERALE ===`);
    console.error(`   Errore:`, error.message);
    console.error(`   Stack:`, error.stack);
    console.error(`========================================\n`);
  }
}

// === FUNZIONI SUPPORTO ===

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function recuperaDatiCompletiDaPostgres(session, requestId) {
  console.log(`🔄 [${requestId}] Recupero da PostgreSQL...`);

  const metadata = session.metadata || {};
  const tempSessionId = metadata.temp_session_id;

  let datiCompleti = {
    dataCheckin: metadata.dataCheckin,
    appartamento: metadata.appartamento,
    numeroOspiti: parseInt(metadata.numeroOspiti) || 0,
    numeroNotti: parseInt(metadata.numeroNotti) || 0,
    tipoGruppo: metadata.tipoGruppo || null,
    totale: parseFloat(metadata.totale) || 0,
    timestamp: metadata.timestamp || new Date().toISOString(),
    ospiti: [],
    documenti: []
  };

  const responsabile = {
    numero: 1,
    cognome: metadata.resp_cognome || '',
    nome: metadata.resp_nome || '',
    genere: metadata.resp_genere || '',
    nascita: metadata.resp_nascita || '',
    eta: parseInt(metadata.resp_eta) || 0,
    cittadinanza: metadata.resp_cittadinanza || '',
    luogoNascita: metadata.resp_luogoNascita || '',
    isResponsabile: true
  };

  datiCompleti.ospiti.push(responsabile);

  if (tempSessionId) {
    for (let tentativo = 1; tentativo <= 3; tentativo++) {
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://checkin-six-coral.vercel.app';

        console.log(`   Tentativo ${tentativo}/3: ${baseUrl}/api/salva-dati-temporanei`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const pgResponse = await fetch(
          `${baseUrl}/api/salva-dati-temporanei?sessionId=${tempSessionId}`,
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (pgResponse.ok) {
          const pgData = await pgResponse.json();
          
          if (pgData.success && pgData.datiPrenotazione) {
            datiCompleti = pgData.datiPrenotazione;
            console.log(`   ✅ Dati completi recuperati (tentativo ${tentativo})`);
            break;
          }
        } else if (pgResponse.status === 404) {
          console.warn(`   ⚠️ Dati non trovati in PostgreSQL (scaduti?)`);
          break;
        }
      } catch (pgError) {
        console.warn(`   ⚠️ Tentativo ${tentativo} fallito: ${pgError.message}`);
        if (tentativo < 3) await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  return datiCompleti;
}

async function scriviDatiSuGoogleSheets(datiCompleti, requestId) {
  console.log(`📊 [${requestId}] Scrittura Google Sheets...`);

  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];

  for (const ospite of datiCompleti.ospiti) {
    const riga = {
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
    };

    await sheet.addRow(riga);
  }

  console.log(`   ✅ Scritti ${datiCompleti.ospiti.length} ospiti`);
}

async function generaPDFEInviaEmail(datiCompleti, requestId) {
  const emailProprietario = process.env.EMAIL_PROPRIETARIO;
  
  if (!emailProprietario) {
    throw new Error('EMAIL_PROPRIETARIO non configurata');
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://checkin-six-coral.vercel.app';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

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

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`   ✅ Email proprietario OK (PDF: ${result.pdfGenerato ? 'SI' : 'NO'})`);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function inviaEmailOspite(datiCompleti, emailCliente, requestId) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://checkin-six-coral.vercel.app';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${baseUrl}/api/invia-email-ospite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOspite: emailCliente,
        datiPrenotazione: datiCompleti
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`   ✅ Email ospite OK (Codice: ${result.codiciCassetta || 'N/A'})`);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
