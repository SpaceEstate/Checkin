// api/stripeWebhook.js
// VERSIONE CORRETTA - Recupera TUTTI i dati da Redis
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
      
      // ✅ CRITICO: Recupera dati completi da Redis PRIMA di tutto
      const datiCompleti = await recuperaDatiCompletiDaRedis(session);
      
      // 1. Scrivi dati su Google Sheets
      await scriviDatiSuGoogleSheets(datiCompleti);
      console.log('✅ Dati scritti su Google Sheets');
      
      // 2. Genera PDF e invia email al proprietario
      try {
        await generaPDFEInviaEmail(datiCompleti);
        console.log('✅ PDF e email proprietario processati');
      } catch (pdfError) {
        console.error('⚠️ Errore PDF/Email proprietario:', pdfError.message);
      }
      
      // 3. Invia email ospite con codice accesso
      if (emailCliente) {
        try {
          await inviaEmailOspite(datiCompleti, emailCliente);
          console.log('✅ Email ospite inviata con successo');
        } catch (emailError) {
          console.error('⚠️ Errore invio email ospite:', emailError.message);
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

// ✅ NUOVA FUNZIONE PRINCIPALE: Recupera dati completi da Redis + Metadata
async function recuperaDatiCompletiDaRedis(session) {
  console.log('🔄 === RECUPERO DATI COMPLETI DA REDIS ===');
  
  const metadata = session.metadata;
  const tempSessionId = metadata.temp_session_id;
  
  console.log('🔑 Temp Session ID:', tempSessionId || 'NESSUNO');
  
  // Dati base dai metadata Stripe (sempre disponibili)
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

  // Responsabile dai metadata (sempre disponibile)
  const responsabile = {
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
  };
  
  datiCompleti.ospiti.push(responsabile);
  
  // ✅ RECUPERA DATI COMPLETI DA REDIS (se disponibile)
  if (tempSessionId) {
    try {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'https://checkin-six-coral.vercel.app';
      
      console.log('🔍 Recupero dati completi da Redis...');
      console.log('📡 URL:', `${baseUrl}/api/salva-dati-temporanei?sessionId=${tempSessionId}`);
      
      const redisResponse = await fetch(
        `${baseUrl}/api/salva-dati-temporanei?sessionId=${tempSessionId}`,
        {
          method: 'GET',
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'StripeWebhook/1.0'
          }
        }
      );
      
      console.log('📡 Redis response status:', redisResponse.status);
      
      if (redisResponse.ok) {
        const redisData = await redisResponse.json();
        
        console.log('✅ Risposta Redis ricevuta:', {
          success: redisData.success,
          hasOspiti: !!redisData.datiPrenotazione?.ospiti,
          numOspiti: redisData.datiPrenotazione?.ospiti?.length || 0,
          hasDocumenti: !!redisData.datiPrenotazione?.documenti,
          numDocumenti: redisData.datiPrenotazione?.documenti?.length || 0
        });
        
        if (redisData.success && redisData.datiPrenotazione) {
          // ✅ SOVRASCRIVI con dati completi da Redis
          if (redisData.datiPrenotazione.ospiti && redisData.datiPrenotazione.ospiti.length > 0) {
            datiCompleti.ospiti = redisData.datiPrenotazione.ospiti;
            console.log(`✅ Recuperati ${datiCompleti.ospiti.length} ospiti da Redis`);
          }
          
          if (redisData.datiPrenotazione.documenti && redisData.datiPrenotazione.documenti.length > 0) {
            datiCompleti.documenti = redisData.datiPrenotazione.documenti;
            console.log(`✅ Recuperati ${datiCompleti.documenti.length} documenti da Redis`);
          }
        } else {
          console.warn('⚠️ Redis: dati non trovati nella risposta');
        }
      } else {
        const errorText = await redisResponse.text();
        console.warn('⚠️ Redis response non OK:', redisResponse.status, errorText);
      }
    } catch (redisError) {
      console.warn('⚠️ Errore recupero da Redis:', redisError.message);
      console.warn('📋 Proseguo con dati parziali dai metadata');
    }
  } else {
    console.warn('⚠️ Nessun temp_session_id disponibile - solo dati metadata');
  }
  
  // Se non abbiamo recuperato altri ospiti da Redis, prova dai metadata
  if (datiCompleti.ospiti.length === 1 && metadata.altri_ospiti) {
    try {
      const altriOspiti = JSON.parse(metadata.altri_ospiti);
      altriOspiti.forEach(o => {
        datiCompleti.ospiti.push({
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
      console.log(`✅ Recuperati ${altriOspiti.length} altri ospiti da metadata`);
    } catch (e) {
      console.warn('⚠️ Errore parsing altri_ospiti dai metadata:', e);
    }
  }
  
  console.log('📊 Dati finali ricostruiti:', {
    ospiti: datiCompleti.ospiti.length,
    documenti: datiCompleti.documenti.length,
    totale: datiCompleti.totale
  });
  console.log('🔄 === FINE RECUPERO ===');
  
  return datiCompleti;
}

// FUNZIONE: Scrivi dati su Google Sheets
async function scriviDatiSuGoogleSheets(datiCompleti) {
  console.log('📊 === INIZIO SCRITTURA GOOGLE SHEETS ===');
  
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    const sheet = doc.sheetsByIndex[0];
    
    console.log(`📝 Scrivendo ${datiCompleti.ospiti.length} ospiti su Google Sheets`);
    
    // Scrivi tutti gli ospiti
    for (const ospite of datiCompleti.ospiti) {
      const riga = {
        'Data Check-in': datiCompleti.dataCheckin || '',
        'Appartamento': datiCompleti.appartamento || '',
        'Numero Ospiti': datiCompleti.numeroOspiti.toString() || '',
        'Numero Notti': datiCompleti.numeroNotti.toString() || '',
        'Tipo Gruppo': datiCompleti.tipoGruppo || '',
        'Totale': datiCompleti.totale.toString() || '',
        'Numero Ospite': ospite.numero.toString(),
        'Cognome': ospite.cognome || '',
        'Nome': ospite.nome || '',
        'Genere': ospite.genere || '',
        'Data Nascita': ospite.nascita || '',
        'Età': ospite.eta ? ospite.eta.toString() : '',
        'Cittadinanza': ospite.cittadinanza || '',
        'Luogo Nascita': ospite.luogoNascita || '',
        'Comune': ospite.comune || '',
        'Provincia': ospite.provincia || '',
        'Tipo Documento': ospite.tipoDocumento || '',
        'Numero Documento': ospite.numeroDocumento || '',
        'Luogo Rilascio': ospite.luogoRilascio || '',
        'Timestamp': datiCompleti.timestamp || new Date().toISOString()
      };
      
      await sheet.addRow(riga);
      console.log(`✅ Ospite ${ospite.numero} (${ospite.nome} ${ospite.cognome}) aggiunto a Google Sheets`);
    }
    
    console.log('📊 === FINE SCRITTURA GOOGLE SHEETS ===');
  } catch (error) {
    console.error('❌ Errore Google Sheets:', error);
    throw error;
  }
}

// FUNZIONE: Genera PDF e invia email proprietario
async function generaPDFEInviaEmail(datiCompleti) {
  console.log('📧 === INIZIO INVIO EMAIL PROPRIETARIO ===');
  
  const emailProprietario = process.env.EMAIL_PROPRIETARIO;
  
  if (!emailProprietario) {
    throw new Error('EMAIL_PROPRIETARIO non configurato');
  }
  
  console.log('📬 Destinatario proprietario:', emailProprietario);
  console.log('📊 Dati da inviare:', {
    ospiti: datiCompleti.ospiti.length,
    documenti: datiCompleti.documenti.length,
    totale: datiCompleti.totale,
    tipoTotale: typeof datiCompleti.totale
  });
  
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
        datiPrenotazione: datiCompleti,
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
async function inviaEmailOspite(datiCompleti, emailCliente) {
  console.log('📧 === INIZIO INVIO EMAIL OSPITE ===');
  
  console.log('📊 Dati per email ospite:', {
    email: emailCliente,
    totale: datiCompleti.totale,
    tipoTotale: typeof datiCompleti.totale,
    appartamento: datiCompleti.appartamento
  });
  
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
        datiPrenotazione: datiCompleti
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
