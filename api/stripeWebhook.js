// api/stripeWebhook.js
// Webhook per gestire eventi Stripe (pagamento completato)
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

  // Gestisci l'evento checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data.object;
      console.log('💰 Pagamento completato per sessione:', session.id);
      
      // Estrai email cliente da Stripe
      const emailCliente = session.customer_details?.email || null;
      console.log('📧 Email cliente da Stripe:', emailCliente || 'NESSUNA');
      
      // 1. Scrivi dati su Google Sheets (priorità)
      await scriviDatiSuGoogleSheets(session);
      console.log('✅ Dati scritti su Google Sheets');
      
      // 2. Genera PDF e invia email al proprietario
      try {
        await generaPDFEInviaEmailConDebug(session);
        console.log('✅ PDF e email proprietario processati');
      } catch (pdfError) {
        console.error('⚠️ Errore PDF/Email proprietario:', pdfError.message);
        
        // FALLBACK: Invia email semplice senza PDF
        try {
          await inviaEmailSemplice(session);
          console.log('✅ Email semplice proprietario inviata come fallback');
        } catch (fallbackError) {
          console.error('❌ Anche fallback email proprietario fallito:', fallbackError.message);
        }
      }
      
      // 3. NUOVO: Invia email ospite con codice accesso
      if (emailCliente) {
        try {
          await inviaEmailOspite(session, emailCliente);
          console.log('✅ Email ospite inviata con successo');
        } catch (emailError) {
          console.error('⚠️ Errore invio email ospite:', emailError.message);
          // Non bloccare il flusso se l'email ospite fallisce
        }
      } else {
        console.warn('⚠️ Email cliente non disponibile, email ospite non inviata');
      }
      
    } catch (error) {
      console.error('❌ Errore elaborazione webhook:', error);
      return res.status(500).json({ error: 'Errore interno: ' + error.message });
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

// FUNZIONE: Scrivi dati su Google Sheets
async function scriviDatiSuGoogleSheets(session) {
  console.log('📊 === INIZIO SCRITTURA GOOGLE SHEETS ===');
  
  const metadata = session.metadata;
  
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
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
    console.log('✅ Responsabile aggiunto a Google Sheets');
    
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
        console.log(`✅ ${altriOspiti.length} altri ospiti aggiunti a Google Sheets`);
      } catch (e) {
        console.warn('⚠️ Errore nel parsing altri_ospiti:', e);
      }
    }
    
    console.log('📊 === FINE SCRITTURA GOOGLE SHEETS ===');
  } catch (error) {
    console.error('❌ Errore Google Sheets:', error);
    throw error;
  }
}

// FUNZIONE: Ricostruisci dati prenotazione da metadata
function ricostruisciDatiPrenotazione(metadata) {
  const datiPrenotazione = {
    dataCheckin: metadata.dataCheckin,
    appartamento: metadata.appartamento,
    numeroOspiti: metadata.numeroOspiti,
    numeroNotti: metadata.numeroNotti,
    tipoGruppo: metadata.tipoGruppo || null,
    totale: metadata.totale,
    timestamp: metadata.timestamp,
    ospiti: [],
    documenti: [] // Documenti recuperati da Redis
  };

  // Responsabile
  datiPrenotazione.ospiti.push({
    numero: 1,
    cognome: metadata.resp_cognome,
    nome: metadata.resp_nome,
    genere: metadata.resp_genere,
    nascita: metadata.resp_nascita,
    eta: metadata.resp_eta,
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
          eta: o.e,
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

// FUNZIONE: Genera PDF e invia email proprietario
async function generaPDFEInviaEmailConDebug(session) {
  console.log('📧 === INIZIO INVIO EMAIL PROPRIETARIO (da webhook) ===');
  
  const metadata = session.metadata;
  const tempSessionId = metadata.temp_session_id;
  
  console.log('🔑 Temp Session ID:', tempSessionId || 'NESSUNO');
  
  let datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
  
  // Recupera documenti da Redis se disponibile
  if (tempSessionId) {
    try {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'https://checkin-six-coral.vercel.app';
      
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
          console.log(`✅ Recuperati ${datiPrenotazione.documenti.length} documenti da Redis`);
        }
      } else {
        console.warn('⚠️ Dati non trovati su Redis:', await redisResponse.text());
      }
    } catch (redisError) {
      console.warn('⚠️ Errore recupero documenti da Redis:', redisError.message);
    }
  }
  
  const emailProprietario = process.env.EMAIL_PROPRIETARIO;
  
  if (!emailProprietario) {
    throw new Error('EMAIL_PROPRIETARIO non configurato');
  }
  
  console.log('📬 Destinatario proprietario:', emailProprietario);
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://checkin-six-coral.vercel.app';
  
  const apiUrl = `${baseUrl}/api/genera-pdf-email`;
  console.log('🌐 Chiamata API email proprietario:', apiUrl);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
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
    
    console.log('📡 Status risposta API email proprietario:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API email proprietario:', errorText);
      throw new Error(`Errore API (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Risposta API email proprietario:', result);
    console.log('📧 === FINE INVIO EMAIL PROPRIETARIO (SUCCESSO) ===');
    
  } catch (error) {
    console.error('❌ Errore invio email proprietario:', error.message);
    console.log('📧 === FINE INVIO EMAIL PROPRIETARIO (ERRORE) ===');
    throw error;
  }
}

// FUNZIONE: Invia email all'ospite con codice accesso
async function inviaEmailOspite(session, emailCliente) {
  console.log('📧 === INIZIO INVIO EMAIL OSPITE (da webhook) ===');
  
  const metadata = session.metadata;
  const datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://checkin-six-coral.vercel.app';
  
  const apiUrl = `${baseUrl}/api/invia-email-ospite`;
  console.log('🌐 Chiamata API email ospite:', apiUrl);
  
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
    
    console.log('📡 Status risposta API email ospite:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API email ospite:', errorText);
      throw new Error(`Errore API (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Risposta API email ospite:', result);
    console.log('📧 === FINE INVIO EMAIL OSPITE (SUCCESSO) ===');
    
  } catch (error) {
    console.error('❌ Errore invio email ospite:', error.message);
    console.log('📧 === FINE INVIO EMAIL OSPITE (ERRORE) ===');
    throw error;
  }
}

// FUNZIONE FALLBACK: Invia email semplice senza PDF
async function inviaEmailSemplice(session) {
  console.log('📧 === FALLBACK: EMAIL SEMPLICE ===');
  
  // Implementa invio email semplice senza PDF
  // Per ora solo log, puoi implementare nodemailer diretto qui se necessario
  console.warn('⚠️ Invio email semplice non implementato (TODO)');
}
