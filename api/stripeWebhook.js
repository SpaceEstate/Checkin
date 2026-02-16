// api/stripeWebhook.js
// VERSIONE SEMPLIFICATA - SOLO METADATA STRIPE (no PostgreSQL)

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
  
  console.log(`\n🎯 [${requestId}] WEBHOOK ${new Date().toISOString()}`);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await buffer(req);
    const sig = req.headers['stripe-signature'];

    if (!sig || !endpointSecret) {
      console.error(`❌ [${requestId}] Missing config`);
      return res.status(400).send('Webhook Error: Missing configuration');
    }

    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log(`✅ [${requestId}] Event: ${event.type}`);

  } catch (err) {
    console.error(`❌ [${requestId}] Signature error:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Risposta immediata a Stripe
  res.status(200).json({ received: true });

  // Processing asincrono
  if (event.type === 'checkout.session.completed') {
    setImmediate(() => {
      processPayment(event, requestId).catch(err => {
        console.error(`❌ [${requestId}] Process error:`, err.message);
      });
    });
  }
}

async function processPayment(event, requestId) {
  try {
    const session = event.data.object;
    const metadata = session.metadata || {};
    
    console.log(`💰 [${requestId}] PAYMENT COMPLETED`);
    console.log(`   Session: ${session.id}`);
    console.log(`   Email: ${session.customer_details?.email || 'N/A'}`);
    console.log(`   Amount: €${(session.amount_total / 100).toFixed(2)}`);

    // Costruisci dati da metadata Stripe
    const datiCompleti = {
      dataCheckin: metadata.dataCheckin || '',
      appartamento: metadata.appartamento || '',
      numeroOspiti: parseInt(metadata.numeroOspiti) || 1,
      numeroNotti: parseInt(metadata.numeroNotti) || 1,
      tipoGruppo: metadata.tipoGruppo || null,
      totale: parseFloat(metadata.totale) || 0,
      timestamp: metadata.timestamp || new Date().toISOString(),
      ospiti: [{
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
      }],
      documenti: []
    };

    console.log(`📊 [${requestId}] Ospiti: ${datiCompleti.ospiti.length}`);

    // 1. Google Sheets
    console.log(`📊 [${requestId}] Saving to Google Sheets...`);
    try {
      await saveToGoogleSheets(datiCompleti);
      console.log(`✅ [${requestId}] Google Sheets saved`);
    } catch (err) {
      console.error(`⚠️ [${requestId}] Google Sheets error:`, err.message);
    }

    // 2. Email Proprietario
    const emailProp = process.env.EMAIL_PROPRIETARIO;
    if (emailProp) {
      console.log(`📧 [${requestId}] Sending owner email to ${emailProp}...`);
      try {
        await sendEmailWithRetry(
          'https://checkin-six-coral.vercel.app/api/genera-pdf-email',
          {
            datiPrenotazione: datiCompleti,
            emailDestinatario: emailProp
          },
          45000,
          requestId
        );
        console.log(`✅ [${requestId}] Owner email sent`);
      } catch (err) {
        console.error(`❌ [${requestId}] Owner email failed:`, err.message);
      }
    } else {
      console.warn(`⚠️ [${requestId}] EMAIL_PROPRIETARIO not configured`);
    }

    // 3. Email Ospite
    const emailGuest = session.customer_details?.email;
    if (emailGuest) {
      console.log(`📧 [${requestId}] Sending guest email to ${emailGuest}...`);
      try {
        await sendEmailWithRetry(
          'https://checkin-six-coral.vercel.app/api/invia-email-ospite',
          {
            emailOspite: emailGuest,
            datiPrenotazione: datiCompleti
          },
          20000,
          requestId
        );
        console.log(`✅ [${requestId}] Guest email sent`);
      } catch (err) {
        console.error(`❌ [${requestId}] Guest email failed:`, err.message);
      }
    } else {
      console.warn(`⚠️ [${requestId}] Guest email not available`);
    }

    console.log(`✅ [${requestId}] COMPLETED\n`);

  } catch (error) {
    console.error(`❌ [${requestId}] CRITICAL ERROR:`, error.message);
    console.error(error.stack);
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

async function saveToGoogleSheets(datiCompleti) {
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
}

async function sendEmailWithRetry(url, body, timeoutMs, requestId) {
  const maxRetries = 2;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        return await response.json();
      }

      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);

    } catch (error) {
      console.warn(`⚠️ [${requestId}] Retry ${i + 1}/${maxRetries}: ${error.message}`);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
