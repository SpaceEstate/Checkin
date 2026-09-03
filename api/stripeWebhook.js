// api/stripeWebhook.js
// VERSIONE CORRETTA - res.json() DOPO tutte le operazioni + fix struttura PostgreSQL

import Stripe from 'stripe';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// I log di questo file finiscono su Vercel, che ha una sua retention: mascherare
// l'indirizzo (mantenendo il dominio, utile per capire se un provider ha problemi
// di recapito) evita di tenere l'email leggibile dell'ospite nei log applicativi.
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return 'N/A';
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 2 ? `${user[0]}*` : `${user.slice(0, 2)}${'*'.repeat(user.length - 2)}`;
  return `${maskedUser}@${domain}`;
}

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
    console.log(`✅ [${requestId}] Event verified: ${event.type}`);

  } catch (err) {
    console.error(`❌ [${requestId}] Signature error:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ CRITICO: await PRIMA di rispondere a Stripe
  if (event.type === 'checkout.session.completed') {
    try {
      await processPayment(event, requestId);
    } catch (err) {
      console.error(`❌ [${requestId}] Process error:`, err.message);
      console.error(err.stack);
    }
  }

  // ✅ RISPOSTA A STRIPE - SOLO DOPO aver completato tutto
  console.log(`✅ [${requestId}] Sending 200 to Stripe`);
  return res.status(200).json({ received: true });
}

async function processPayment(event, requestId) {
  const session = event.data.object;
  const metadata = session.metadata || {};
  
  console.log(`\n💰 [${requestId}] PAYMENT COMPLETED`);
  console.log(`   Session: ${session.id}`);
  console.log(`   Email: ${maskEmail(session.customer_details?.email)}`);
  console.log(`   Amount: €${(session.amount_total / 100).toFixed(2)}`);
  console.log(`   Ospiti: ${metadata.numeroOspiti || 'N/A'}`);
  console.log(`   temp_session_id: ${metadata.temp_session_id || 'MANCANTE'}`);

  // ✅ Prova prima a recuperare dati completi da PostgreSQL
  let datiCompleti = null;

  if (metadata.temp_session_id) {
    console.log(`\n🔍 [${requestId}] Recupero dati da PostgreSQL...`);
    try {
      const pgResponse = await fetch(
        `https://checkin-six-coral.vercel.app/api/salva-dati-temporanei?sessionId=${metadata.temp_session_id}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET
          }
        }
      );

      if (pgResponse.ok) {
        const pgData = await pgResponse.json();

        // 🔍 LOG DIAGNOSTICO: solo la struttura (chiavi presenti / conteggi),
        // mai il contenuto — prima qui finiva un dump JSON che includeva nome,
        // data di nascita e documento del primo ospite nei log di Vercel.
        console.log(`📋 [${requestId}] Struttura pgData: chiavi=${Object.keys(pgData || {}).join(',')}`);

        // La risposta di salva-dati-temporanei è:
        // { success: true, datiPrenotazione: { ospiti: [...], documenti: [...], ... }, metadata: {...} }
        // MA datiPrenotazione potrebbe essere un oggetto annidato o stringificato
        
        let parsed = pgData.datiPrenotazione;

        // Se è una stringa JSON, parsala
        if (typeof parsed === 'string') {
          console.log(`🔄 [${requestId}] datiPrenotazione è una stringa, parsing...`);
          parsed = JSON.parse(parsed);
        }

        // Verifica che abbia la struttura attesa
        if (parsed && (parsed.ospiti || parsed.appartamento || parsed.dataCheckin)) {
          datiCompleti = parsed;
          console.log(`✅ [${requestId}] Dati PostgreSQL validi:`);
          console.log(`   ospiti=${datiCompleti.ospiti?.length ?? 'undefined'}`);
          console.log(`   documenti=${datiCompleti.documenti?.length ?? 'undefined'}`);
          console.log(`   appartamento=${datiCompleti.appartamento ?? 'undefined'}`);
          console.log(`   dataCheckin=${datiCompleti.dataCheckin ?? 'undefined'}`);
          
          // Aggiungi email ospite se mancante
          if (datiCompleti.ospiti?.[0] && !datiCompleti.ospiti[0].email) {
            datiCompleti.ospiti[0].email = session.customer_details?.email || '';
          }
        } else {
          console.warn(`⚠️ [${requestId}] Struttura datiPrenotazione non valida:`, typeof parsed, Object.keys(parsed || {}));
        }
      } else {
        const errText = await pgResponse.text();
        console.warn(`⚠️ [${requestId}] PostgreSQL HTTP ${pgResponse.status}: ${errText.substring(0, 200)}`);
      }
    } catch (pgErr) {
      console.warn(`⚠️ [${requestId}] PostgreSQL fallito: ${pgErr.message}`);
    }
  }

  // Fallback: costruisci dati minimi da metadata Stripe
  if (!datiCompleti) {
    console.log(`⚠️ [${requestId}] Fallback a metadata Stripe (dati parziali, senza documenti)`);
    datiCompleti = {
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
  }

  // Garantisci struttura minima per evitare crash
  if (!Array.isArray(datiCompleti.ospiti)) {
    console.warn(`⚠️ [${requestId}] ospiti non è un array, inizializzo array vuoto`);
    datiCompleti.ospiti = [];
  }
  if (!Array.isArray(datiCompleti.documenti)) {
    datiCompleti.documenti = [];
  }

  console.log(`\n📊 [${requestId}] Dati pronti per invio:`);
  console.log(`   appartamento: ${datiCompleti.appartamento}`);
  console.log(`   ospiti: ${datiCompleti.ospiti.length}`);
  console.log(`   documenti: ${datiCompleti.documenti.length}`);

  // 1. Google Sheets
  console.log(`\n📊 [${requestId}] Saving to Google Sheets...`);
  try {
    await saveToGoogleSheets(datiCompleti);
    console.log(`✅ [${requestId}] Google Sheets saved`);
  } catch (err) {
    console.error(`⚠️ [${requestId}] Google Sheets error:`, err.message);
  }

  // 2. Email Proprietario
  const emailProp = process.env.EMAIL_PROPRIETARIO;
  if (emailProp) {
    console.log(`\n📧 [${requestId}] Sending owner email to ${emailProp}...`);
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
    console.log(`\n📧 [${requestId}] Sending guest email to ${maskEmail(emailGuest)}...`);
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

  console.log(`\n✅ [${requestId}] processPayment COMPLETED\n`);
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

  const ospitiDaSalvare = datiCompleti.ospiti?.length > 0
    ? datiCompleti.ospiti
    : [{ numero: 1, cognome: '', nome: '', genere: '', nascita: '', eta: 0, cittadinanza: '', luogoNascita: '' }];

  for (const ospite of ospitiDaSalvare) {
    // ✅ FIX: Aggiungi campi documento solo per il responsabile (ospite 1)
    const rowData = {
      'Data Check-in': datiCompleti.dataCheckin || '',
      'Appartamento': datiCompleti.appartamento || '',
      'Numero Ospiti': (datiCompleti.numeroOspiti || 0).toString(),
      'Numero Notti': (datiCompleti.numeroNotti || 0).toString(),
      'Tipo Gruppo': datiCompleti.tipoGruppo || '',
      'Totale': (datiCompleti.totale || 0).toString(),
      'Numero Ospite': (ospite.numero || 1).toString(),
      'Cognome': ospite.cognome || '',
      'Nome': ospite.nome || '',
      'Genere': ospite.genere || '',
      'Data Nascita': ospite.nascita || '',
      'Età': ospite.eta ? ospite.eta.toString() : '',
      'Cittadinanza': ospite.cittadinanza || '',
      'Luogo Nascita': ospite.luogoNascita || '',
      'Comune': ospite.comune || '',
      'Provincia': ospite.provincia || '',
      'Timestamp': datiCompleti.timestamp || new Date().toISOString()
    };

    // ✅ CRITICAL: Aggiungi campi documento SOLO per ospite responsabile (numero 1)
    if (ospite.numero === 1 || ospite.isResponsabile) {
      rowData['Tipo Documento'] = ospite.tipoDocumento || '';
      rowData['Numero Documento'] = ospite.numeroDocumento || '';
      rowData['Luogo Rilascio'] = ospite.luogoRilascio || '';
    } else {
      // Per gli altri ospiti, lascia vuoti i campi documento
      rowData['Tipo Documento'] = '';
      rowData['Numero Documento'] = '';
      rowData['Luogo Rilascio'] = '';
    }

    await sheet.addRow(rowData);
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
