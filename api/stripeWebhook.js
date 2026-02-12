// api/stripeWebhook.js
// VERSIONE CORRETTA - Recupera TUTTI i dati da PostgreSQL con debug dettagliato
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

  // Risposta IMMEDIATA a Stripe (evita timeout 30s di Stripe)
  res.status(200).json({ received: true });

  // Gestisci l'evento in background
  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data.object;
      console.log('💰 Pagamento completato per sessione:', session.id);

      const emailCliente = session.customer_details?.email || null;
      console.log('📧 Email cliente da Stripe:', emailCliente || 'NESSUNA');

      // ✅ CRITICO: Recupera dati completi da PostgreSQL
      const datiCompleti = await recuperaDatiCompletiDaPostgres(session);

      // ✅ DEBUG: Verifica struttura dati prima di procedere
      console.log('📊 === VERIFICA DATI PRIMA DI PROCEDERE ===');
      console.log('  ospiti.length:', datiCompleti.ospiti?.length || 0);
      console.log('  documenti.length:', datiCompleti.documenti?.length || 0);
      console.log('  totale:', datiCompleti.totale);
      if (datiCompleti.documenti?.length > 0) {
        datiCompleti.documenti.forEach((doc, i) => {
          const hasBase64 = !!doc.base64;
          const base64Len = doc.base64?.length || 0;
          console.log(`  doc[${i}]: ospite=${doc.ospiteNumero}, file=${doc.nomeFile}, hasBase64=${hasBase64}, base64Len=${base64Len}`);
        });
      }
      console.log('=========================================');

      // 1. Scrivi dati su Google Sheets
      try {
        await scriviDatiSuGoogleSheets(datiCompleti);
        console.log('✅ Dati scritti su Google Sheets');
      } catch (sheetsError) {
        console.error('⚠️ Errore Google Sheets:', sheetsError.message);
        // Non blocca il flusso
      }

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
    }
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

// ✅ FUNZIONE PRINCIPALE CORRETTA: Recupera dati completi da PostgreSQL
async function recuperaDatiCompletiDaPostgres(session) {
  console.log('🔄 === RECUPERO DATI COMPLETI DA POSTGRESQL ===');

  const metadata = session.metadata;
  const tempSessionId = metadata.temp_session_id;

  console.log('🔑 Temp Session ID:', tempSessionId || 'NESSUNO');

  // Dati base dai metadata Stripe (sempre disponibili come fallback)
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

  // Responsabile dai metadata Stripe (sempre disponibile come fallback)
  const responsabile = {
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
  };

  datiCompleti.ospiti.push(responsabile);

  // ✅ RECUPERA DATI COMPLETI DA POSTGRESQL (con retry)
  if (tempSessionId) {
    let recuperoRiuscito = false;
    const maxTentativi = 3;

    for (let tentativo = 1; tentativo <= maxTentativi; tentativo++) {
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://checkin-six-coral.vercel.app';

        console.log(`🔍 Tentativo ${tentativo}/${maxTentativi} - Recupero da PostgreSQL...`);

        // ✅ Timeout aumentato a 20 secondi per ogni tentativo
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const pgResponse = await fetch(
          `${baseUrl}/api/salva-dati-temporanei?sessionId=${tempSessionId}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'StripeWebhook/1.0'
            },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);
        console.log(`📡 PostgreSQL response status (tentativo ${tentativo}):`, pgResponse.status);

        if (pgResponse.ok) {
          const pgData = await pgResponse.json();

          console.log('✅ Risposta PostgreSQL ricevuta:', {
            success: pgData.success,
            hasOspiti: !!pgData.datiPrenotazione?.ospiti,
            numOspiti: pgData.datiPrenotazione?.ospiti?.length || 0,
            hasDocumenti: !!pgData.datiPrenotazione?.documenti,
            numDocumenti: pgData.datiPrenotazione?.documenti?.length || 0,
          });

          if (pgData.success && pgData.datiPrenotazione) {
            const datiPG = pgData.datiPrenotazione;

            // ✅ SOSTITUZIONE COMPLETA con dati da PostgreSQL
            if (datiPG.ospiti && datiPG.ospiti.length > 0) {
              datiCompleti.ospiti = datiPG.ospiti;
              console.log(`✅ Recuperati ${datiCompleti.ospiti.length} ospiti da PostgreSQL`);
            }

            if (datiPG.documenti && datiPG.documenti.length > 0) {
              datiCompleti.documenti = datiPG.documenti;
              console.log(`✅ Recuperati ${datiCompleti.documenti.length} documenti da PostgreSQL`);

              // ✅ DEBUG: Verifica struttura documenti recuperati
              datiCompleti.documenti.forEach((doc, i) => {
                console.log(`  📄 Documento[${i}]:`, {
                  ospiteNumero: doc.ospiteNumero,
                  nomeFile: doc.nomeFile,
                  tipo: doc.tipo,
                  dimensione: doc.dimensione,
                  hasBase64: !!doc.base64,
                  base64Preview: doc.base64 ? doc.base64.substring(0, 50) + '...' : 'MANCANTE'
                });
              });
            } else {
              console.warn('⚠️ Nessun documento trovato in PostgreSQL');
            }

            // Aggiorna anche altri campi se presenti
            if (datiPG.appartamento) datiCompleti.appartamento = datiPG.appartamento;
            if (datiPG.totale !== undefined) datiCompleti.totale = datiPG.totale;
            if (datiPG.tipoGruppo) datiCompleti.tipoGruppo = datiPG.tipoGruppo;

            recuperoRiuscito = true;
            break; // Uscita dal loop retry
          } else {
            console.warn(`⚠️ PostgreSQL tentativo ${tentativo}: dati non trovati o scaduti`);
          }
        } else if (pgResponse.status === 404) {
          console.warn(`⚠️ Sessione non trovata in PostgreSQL (potrebbe essere scaduta o già usata)`);
          break; // Non ha senso riprovare se 404
        } else {
          const errorText = await pgResponse.text();
          console.warn(`⚠️ PostgreSQL response non OK (tentativo ${tentativo}):`, pgResponse.status, errorText);
        }
      } catch (pgError) {
        if (pgError.name === 'AbortError') {
          console.warn(`⚠️ Timeout recupero PostgreSQL (tentativo ${tentativo})`);
        } else {
          console.warn(`⚠️ Errore recupero da PostgreSQL (tentativo ${tentativo}):`, pgError.message);
        }

        // Attendi prima del prossimo tentativo
        if (tentativo < maxTentativi) {
          await new Promise(resolve => setTimeout(resolve, 2000 * tentativo));
        }
      }
    }

    if (!recuperoRiuscito) {
      console.warn('⚠️ Tutti i tentativi di recupero da PostgreSQL falliti - uso dati parziali dai metadata');
      console.warn('⚠️ ATTENZIONE: Solo ospite 1 disponibile, documenti non disponibili');
    }
  } else {
    console.warn('⚠️ Nessun temp_session_id disponibile - solo dati metadata Stripe');
    console.warn('⚠️ Questo significa che NESSUN documento sarà allegato e solo ospite 1 sarà visibile');
  }

  // ✅ FALLBACK: Se ancora solo ospite 1, prova a recuperare altri ospiti dai metadata
  if (datiCompleti.ospiti.length <= 1 && metadata.altri_ospiti) {
    try {
      const altriOspiti = JSON.parse(metadata.altri_ospiti);
      altriOspiti.forEach(o => {
        datiCompleti.ospiti.push({
          numero: o.n,
          cognome: o.c || '',
          nome: o.no || '',
          genere: o.g || '',
          nascita: o.na || '',
          eta: parseInt(o.e) || 0,
          cittadinanza: o.ci || '',
          luogoNascita: o.ln || '',
          comune: o.co || '',
          provincia: o.p || ''
        });
      });
      console.log(`✅ Fallback: recuperati ${altriOspiti.length} altri ospiti da metadata Stripe`);
    } catch (e) {
      console.warn('⚠️ Errore parsing altri_ospiti dai metadata:', e.message);
    }
  }

  console.log('📊 === DATI FINALI RICOSTRUITI ===');
  console.log('  ospiti totali:', datiCompleti.ospiti.length);
  console.log('  documenti totali:', datiCompleti.documenti.length);
  console.log('  totale pagato:', datiCompleti.totale);
  console.log('  appartamento:', datiCompleti.appartamento);
  console.log('=================================');

  return datiCompleti;
}

// FUNZIONE: Scrivi dati su Google Sheets
async function scriviDatiSuGoogleSheets(datiCompleti) {
  console.log('📊 === INIZIO SCRITTURA GOOGLE SHEETS ===');

  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];

  console.log(`📝 Scrivendo ${datiCompleti.ospiti.length} ospiti su Google Sheets`);

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
    console.log(`✅ Ospite ${ospite.numero} (${ospite.nome} ${ospite.cognome}) aggiunto`);
  }

  console.log('📊 === FINE SCRITTURA GOOGLE SHEETS ===');
}

// FUNZIONE: Genera PDF e invia email proprietario
async function generaPDFEInviaEmail(datiCompleti) {
  console.log('📧 === INIZIO INVIO EMAIL PROPRIETARIO ===');

  const emailProprietario = process.env.EMAIL_PROPRIETARIO;
  if (!emailProprietario) {
    throw new Error('EMAIL_PROPRIETARIO non configurato');
  }

  console.log('📬 Destinatario proprietario:', emailProprietario);
  console.log('📊 Dati per email:', {
    ospiti: datiCompleti.ospiti.length,
    documenti: datiCompleti.documenti.length,
    totale: datiCompleti.totale
  });

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://checkin-six-coral.vercel.app';

  // ✅ Timeout aumentato a 55 secondi (massimo funzione Vercel è 60s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch(`${baseUrl}/api/genera-pdf-email`, {
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
      throw new Error(`Errore API (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Email proprietario inviata:', {
      pdfGenerato: result.pdfGenerato,
      numeroDocumenti: result.numeroDocumenti
    });

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout invio email proprietario (55s)');
    }
    throw error;
  }
}

// FUNZIONE: Invia email all'ospite
async function inviaEmailOspite(datiCompleti, emailCliente) {
  console.log('📧 === INIZIO INVIO EMAIL OSPITE ===');

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://checkin-six-coral.vercel.app';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${baseUrl}/api/invia-email-ospite`, {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Errore API (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Email ospite inviata:', result.codiciCassetta);

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout invio email ospite (20s)');
    }
    throw error;
  }
}
