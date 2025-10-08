import Stripe from 'stripe';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET non configurato');
    return res.status(500).json({ error: 'Webhook secret non configurato' });
  }

  let event;
  let body;

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);

    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    console.log('✅ Webhook Stripe verificato:', event.type);
    
  } catch (err) {
    console.error('❌ Errore verifica webhook:', err.message);
    return res.status(400).json({ error: 'Webhook signature invalid: ' + err.message });
  }

  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data.object;
      console.log('💰 Pagamento completato per sessione:', session.id);
      
      // 1. Scrivi dati su Google Sheets (priorità)
      await scriviDatiSuGoogleSheets(session);
      console.log('✅ Dati scritti su Google Sheets');
      
      // 2. Genera PDF e invia email (con gestione errori dettagliata)
      try {
        await generaPDFEInviaEmailConDebug(session);
        console.log('✅ PDF e email processati');
      } catch (pdfError) {
        console.error('⚠️ Errore PDF/Email:', pdfError.message);
        console.error('Stack trace:', pdfError.stack);
        
        // FALLBACK: Invia email semplice senza PDF
        try {
          await inviaEmailSemplice(session);
          console.log('✅ Email semplice inviata come fallback');
        } catch (fallbackError) {
          console.error('❌ Anche fallback email fallito:', fallbackError.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Errore elaborazione webhook:', error);
      return res.status(500).json({ error: 'Errore interno: ' + error.message });
    }
  }

  return res.status(200).json({ received: true });
}

// FUNZIONE CON DEBUG AVANZATO
async function generaPDFEInviaEmailConDebug(session) {
  console.log('\n🔍 === INIZIO DEBUG GENERAZIONE PDF ===');
  console.log('📋 Session ID:', session.id);
  console.log('📋 Metadata disponibili:', Object.keys(session.metadata));
  
  const metadata = session.metadata;
  const tempSessionId = metadata.temp_session_id;
  
  console.log('🔑 temp_session_id ricevuto:', tempSessionId || 'MANCANTE');
  
  // CONTROLLO 1: Verifica presenza temp_session_id
  if (!tempSessionId) {
    console.warn('⚠️ temp_session_id MANCANTE nei metadata');
    console.log('📦 Genero PDF senza documenti...');
    const datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
    await inviaEmailConDati(session, datiPrenotazione);
    return;
  }
  
  // CONTROLLO 2: Tentativo recupero dati temporanei
  console.log('🔍 Tentativo recupero dati temporanei...');
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://checkin-six-coral.vercel.app';
  
  const recuperoUrl = `${baseUrl}/api/salva-dati-temporanei?sessionId=${tempSessionId}`;
  console.log('🌐 URL chiamata:', recuperoUrl);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const recuperoResponse = await fetch(recuperoUrl, {
      method: 'GET',
      headers: { 
        'User-Agent': 'CheckinWebhook/1.0',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 Status risposta:', recuperoResponse.status);
    console.log('📡 Headers risposta:', Object.fromEntries(recuperoResponse.headers.entries()));
    
    if (!recuperoResponse.ok) {
      const errorText = await recuperoResponse.text();
      console.warn(`⚠️ Recupero fallito (${recuperoResponse.status}):`, errorText);
      console.log('📦 Procedo senza documenti...');
      
      const datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
      await inviaEmailConDati(session, datiPrenotazione);
      return;
    }
    
    const recuperoResult = await recuperoResponse.json();
    console.log('✅ Risposta ricevuta:', {
      success: recuperoResult.success,
      hasDati: !!recuperoResult.datiPrenotazione,
      numDocumenti: recuperoResult.datiPrenotazione?.documenti?.length || 0
    });
    
    if (!recuperoResult.success || !recuperoResult.datiPrenotazione) {
      throw new Error('Dati prenotazione non trovati nella risposta');
    }
    
    console.log(`📄 Documenti recuperati: ${recuperoResult.datiPrenotazione.documenti?.length || 0}`);
    
    // Invia email con dati completi
    await inviaEmailConDati(session, recuperoResult.datiPrenotazione);
    console.log('✅ Email con documenti inviata');
    
  } catch (error) {
    console.error('❌ Errore nel processo:', error.message);
    console.error('Stack:', error.stack);
    
    // FALLBACK: Genera PDF senza documenti
    console.log('🔄 FALLBACK: Genero PDF senza documenti...');
    const datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
    await inviaEmailConDati(session, datiPrenotazione);
  }
  
  console.log('🔍 === FINE DEBUG GENERAZIONE PDF ===\n');
}

// FUNZIONE: Invio email con chiamata all'API genera-pdf-email
async function inviaEmailConDati(session, datiPrenotazione) {
  console.log('📧 === INIZIO INVIO EMAIL ===');
  
  const emailCliente = session.customer_details?.email || 
                      session.metadata.email_cliente || 
                      null;
  
  const emailDestinatario = process.env.EMAIL_PROPRIETARIO;
  
  console.log('📋 Email destinatario:', emailDestinatario || 'MANCANTE');
  console.log('📋 Email cliente:', emailCliente || 'NESSUNA');
  console.log('📋 Numero documenti da inviare:', datiPrenotazione.documenti?.length || 0);
  
  if (!emailDestinatario) {
    throw new Error('EMAIL_PROPRIETARIO non configurata nelle variabili ambiente');
  }
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://checkin-six-coral.vercel.app';
  
  const apiUrl = `${baseUrl}/api/genera-pdf-email`;
  console.log('🌐 Chiamata API PDF a:', apiUrl);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CheckinWebhook/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        datiPrenotazione: datiPrenotazione,
        emailDestinatario: emailDestinatario,
        emailCliente: emailCliente
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 Status risposta API PDF:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API PDF:', errorText);
      throw new Error(`Errore API PDF (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Risposta API PDF:', result);
    console.log('📧 === FINE INVIO EMAIL (SUCCESSO) ===');
    
  } catch (error) {
    console.error('❌ Errore invio email:', error.message);
    console.log('📧 === FINE INVIO EMAIL (ERRORE) ===');
    throw error;
  }
}

// FALLBACK: Email semplice senza PDF
async function inviaEmailSemplice(session) {
  console.log('📧 Invio email semplice senza PDF...');
  
  const emailDestinatario = process.env.EMAIL_PROPRIETARIO;
  if (!emailDestinatario) {
    console.error('❌ EMAIL_PROPRIETARIO non configurata');
    return;
  }
  
  const metadata = session.metadata;
  const datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
  
  // Invia solo notifica testuale (implementa qui la tua logica di email semplice)
  console.log('✅ Email semplice inviata (simulata)');
  console.log('Dati:', {
    appartamento: datiPrenotazione.appartamento,
    checkin: datiPrenotazione.dataCheckin,
    ospiti: datiPrenotazione.numeroOspiti
  });
}

// FUNZIONE: Ricostruisce i dati dal metadata Stripe
function ricostruisciDatiPrenotazione(metadata) {
  let altriOspiti = [];
  if (metadata.altri_ospiti) {
    try {
      const ospitiCompatti = JSON.parse(metadata.altri_ospiti);
      altriOspiti = ospitiCompatti.map(o => ({
        numero: o.n,
        cognome: o.c,
        nome: o.no,
        genere: o.g,
        nascita: o.na,
        eta: parseInt(o.e) || 0,
        cittadinanza: o.ci,
        luogoNascita: o.ln,
        comune: o.co || '',
        provincia: o.p || ''
      }));
    } catch (e) {
      console.warn('⚠️ Errore parsing altri ospiti:', e.message);
    }
  }
  
  const ospiti = [
    {
      numero: 1,
      cognome: metadata.resp_cognome || '',
      nome: metadata.resp_nome || '',
      genere: metadata.resp_genere || '',
      nascita: metadata.resp_nascita || '',
      eta: parseInt(metadata.resp_eta) || 0,
      cittadinanza: metadata.resp_cittadinanza || '',
      luogoNascita: metadata.resp_luogoNascita || '',
      comune: metadata.resp_comune || '',
      provincia: metadata.resp_provincia || '',
      tipoDocumento: metadata.resp_tipoDocumento || '',
      numeroDocumento: metadata.resp_numeroDocumento || '',
      luogoRilascio: metadata.resp_luogoRilascio || '',
      isResponsabile: true
    },
    ...altriOspiti
  ];
  
  return {
    dataCheckin: metadata.dataCheckin || '',
    appartamento: metadata.appartamento || '',
    numeroOspiti: parseInt(metadata.numeroOspiti) || 0,
    numeroNotti: parseInt(metadata.numeroNotti) || 0,
    tipoGruppo: metadata.tipoGruppo || null,
    totale: parseFloat(metadata.totale) || 0,
    timestamp: metadata.timestamp || new Date().toISOString(),
    ospiti: ospiti,
    documenti: [] // Vuoti perché non salvabili in Stripe metadata
  };
}

async function scriviDatiSuGoogleSheets(session) {
  try {
    console.log('📊 Connessione a Google Sheets...');
    
    const sheetId = process.env.SHEET_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!sheetId || !clientEmail || !privateKey) {
      throw new Error('Variabili ambiente Google Sheets mancanti');
    }

    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: privateKey.trim(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    console.log('📝 Connesso a:', doc.title);

    const sheet = doc.sheetsByIndex[0];
    await sheet.loadHeaderRow();

    const metadata = session.metadata;
    
    let altriOspiti = [];
    if (metadata.altri_ospiti) {
      try {
        const ospitiCompatti = JSON.parse(metadata.altri_ospiti);
        altriOspiti = ospitiCompatti.map(o => ({
          numero: o.n,
          cognome: o.c,
          nome: o.no,
          genere: o.g,
          nascita: o.na,
          eta: o.e,
          cittadinanza: o.ci,
          luogoNascita: o.ln,
          comune: o.co || '',
          provincia: o.p || ''
        }));
      } catch (e) {
        console.warn('⚠️ Errore parsing altri ospiti:', e.message);
      }
    }

    const rigaPrincipale = {
      'Data Check-in': metadata.dataCheckin || '',
      'Appartamento': metadata.appartamento || '',
      'Numero Ospiti': metadata.numeroOspiti || '',
      'Numero Notti': metadata.numeroNotti || '',
      'Tipo Gruppo': metadata.tipoGruppo || '',
      'Cognome': metadata.resp_cognome || '',
      'Nome': metadata.resp_nome || '',
      'Genere': metadata.resp_genere || '',
      'Data Nascita': metadata.resp_nascita || '',
      'Cittadinanza': metadata.resp_cittadinanza || '',
      'Luogo Nascita': metadata.resp_luogoNascita || '',
      'Comune': metadata.resp_comune || '',
      'Provincia': metadata.resp_provincia || '',
      'Tipo Documento': metadata.resp_tipoDocumento || '',
      'Numero Documento': metadata.resp_numeroDocumento || '',
      'Luogo Rilascio': metadata.resp_luogoRilascio || ''
    };

    console.log('➕ Aggiunta riga responsabile...');
    await sheet.addRow(rigaPrincipale);

    if (altriOspiti.length > 0) {
      console.log(`➕ Aggiunta ${altriOspiti.length} altri ospiti...`);
      
      for (const ospite of altriOspiti) {
        const rigaOspite = {
          'Data Check-in': metadata.dataCheckin || '',
          'Appartamento': metadata.appartamento || '',
          'Numero Ospiti': metadata.numeroOspiti || '',
          'Numero Notti': metadata.numeroNotti || '',
          'Tipo Gruppo': metadata.tipoGruppo || '',
          'Cognome': ospite.cognome || '',
          'Nome': ospite.nome || '',
          'Genere': ospite.genere || '',
          'Data Nascita': ospite.nascita || '',
          'Cittadinanza': ospite.cittadinanza || '',
          'Luogo Nascita': ospite.luogoNascita || '',
          'Comune': ospite.comune || '',
          'Provincia': ospite.provincia || '',
          'Tipo Documento': '',
          'Numero Documento': '',
          'Luogo Rilascio': ''
        };
        
        await sheet.addRow(rigaOspite);
      }
    }

    console.log('✅ Tutti i dati scritti con successo');
    
  } catch (error) {
    console.error('❌ Errore scrittura Google Sheets:', error);
    throw error;
  }
}
