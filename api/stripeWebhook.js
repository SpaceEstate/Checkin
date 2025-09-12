import Stripe from 'stripe';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// IMPORTANTE: Configurazione per raw body su Vercel
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
    // Leggi il raw body per Vercel
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);

    // Verifica signature Stripe
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    console.log('✅ Webhook Stripe verificato:', event.type);
    
  } catch (err) {
    console.error('❌ Errore verifica webhook:', err.message);
    return res.status(400).json({ error: 'Webhook signature invalid: ' + err.message });
  }

  // Gestisci solo eventi di pagamento completato
  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data.object;
      console.log('💰 Pagamento completato per sessione:', session.id);
      
      // 1. Scrivi dati su Google Sheets (priorità)
      await scriviDatiSuGoogleSheets(session);
      console.log('✅ Dati scritti con successo su Google Sheets');
      
      // 2. NUOVO: Genera PDF e invia email (non bloccante)
      try {
        await generaPDFEInviaEmail(session);
        console.log('✅ PDF generato e email inviata');
      } catch (pdfError) {
        console.error('⚠️ Errore PDF/Email (non critico):', pdfError);
        // Non blocchiamo il webhook per errori PDF
      }
      
    } catch (error) {
      console.error('❌ Errore elaborazione webhook:', error);
      return res.status(500).json({ error: 'Errore interno: ' + error.message });
    }
  }

  return res.status(200).json({ received: true });
}

// NUOVA FUNZIONE: Genera PDF e invia email
async function generaPDFEInviaEmail(session) {
  try {
    console.log('📄 Inizio generazione PDF e invio email...');
    
    const metadata = session.metadata;
    
    // Ricostruisci dati prenotazione dal metadata
    const datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
    
    // Estrai email del cliente (se disponibile)
    const emailCliente = session.customer_details?.email || 
                        metadata.email_cliente || 
                        process.env.EMAIL_PROPRIETARIO; // Fallback al tuo email
    
    if (!emailCliente) {
      console.warn('⚠️ Email cliente non trovata, skip invio PDF');
      return;
    }
    
    // Determina l'URL base
    const baseUrl = process.env.BASE_URL || 
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   'https://checkin-six-coral.vercel.app';
    
    console.log('🌐 Chiamata API PDF a:', `${baseUrl}/api/genera-pdf-email`);
    
    // Chiamata alla API di generazione PDF
    const response = await fetch(`${baseUrl}/api/genera-pdf-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CheckinWebhook/1.0'
      },
      body: JSON.stringify({
        datiPrenotazione: datiPrenotazione,
        emailDestinatario: emailDestinatario
      }),
      timeout: 30000 // 30 secondi timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Errore API PDF (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Risposta API PDF:', result.success ? 'SUCCESS' : result);
    
  } catch (error) {
    console.error('❌ Errore generazione PDF/email:', error);
    throw error; // Rilancia per logging, ma non blocca il webhook principale
  }
}

// FUNZIONE: Ricostruisce i dati completi dal metadata Stripe
function ricostruisciDatiPrenotazione(metadata) {
  // Parsing altri ospiti se presenti
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
  
  // Ricostruisci documenti se presenti
  let documenti = [];
  if (metadata.documenti_base64) {
    try {
      documenti = JSON.parse(metadata.documenti_base64);
      console.log(`📎 Trovati ${documenti.length} documenti`);
    } catch (e) {
      console.warn('⚠️ Errore parsing documenti:', e.message);
    }
  }
  
  // Ricostruisci array ospiti completo
  const ospiti = [
    // Responsabile
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
    // Altri ospiti
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
    documenti: documenti
  };
}

async function scriviDatiSuGoogleSheets(session) {
  try {
    console.log('📊 Connessione a Google Sheets...');
    
    // Configurazione Google Sheets
    const sheetId = process.env.SHEET_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!sheetId || !clientEmail || !privateKey) {
      throw new Error('Variabili ambiente Google Sheets mancanti');
    }

    // Fix per chiave privata
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // Autenticazione
    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: privateKey.trim(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Connessione al documento
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    console.log('📝 Connesso a:', doc.title);

    // Prendi il primo foglio
    const sheet = doc.sheetsByIndex[0];
    await sheet.loadHeaderRow();

    // Estrai dati dalla sessione Stripe
    const metadata = session.metadata;
    
    // Parsing altri ospiti se presenti
    let altriOspiti = [];
    if (metadata.altri_ospiti) {
      try {
        const ospitiCompatti = JSON.parse(metadata.altri_ospiti);
        // Decompatta i dati (da formato compatto a formato completo)
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

    // Prepara i dati per il foglio - RESPONSABILE
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

    // Aggiungi riga responsabile
    console.log('➕ Aggiunta riga responsabile...');
    await sheet.addRow(rigaPrincipale);

    // Aggiungi righe per altri ospiti (se ci sono)
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
