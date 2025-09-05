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
      
      // Scrivi dati su Google Sheets
      await scriviDatiSuGoogleSheets(session);
      
      console.log('✅ Dati scritti con successo su Google Sheets');
      
    } catch (error) {
      console.error('❌ Errore elaborazione webhook:', error);
      return res.status(500).json({ error: 'Errore interno: ' + error.message });
    }
  }

  return res.status(200).json({ received: true });
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
