// api/retry-email-from-stripe.js
// Recupera dati da una sessione Stripe esistente e ri-invia le email

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return 'N/A';
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 2 ? `${user[0]}*` : `${user.slice(0, 2)}${'*'.repeat(user.length - 2)}`;
  return `${maskedUser}@${domain}`;
}

export default async function handler(req, res) {
  console.log('\n🔄 === RETRY EMAIL DA SESSIONE STRIPE ===\n');

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  
  if (req.method === "OPTIONS") return res.status(200).end();

  // Endpoint amministrativo: richiede un secret, non è pensato per essere chiamato
  // dal sito pubblico. Accetta sia header (per curl/script) sia query param
  // (comodo per uso manuale da browser).
  if (!process.env.ADMIN_SECRET) {
    console.error('❌ ADMIN_SECRET non configurato sul server');
    return res.status(500).json({ error: 'Configurazione server incompleta' });
  }

  const providedSecret = req.headers['x-admin-secret'] || req.query.key;

  if (providedSecret !== process.env.ADMIN_SECRET) {
    console.warn('🚫 Tentativo di accesso non autorizzato a retry-email-from-stripe');
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  try {
    // Può essere GET con ?session_id= o POST con body
    const sessionId = req.query.session_id || req.body?.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID richiesto',
        usage: 'GET /api/retry-email-from-stripe?session_id=cs_test_...'
      });
    }

    console.log(`🔍 Recupero sessione Stripe: ${sessionId}`);

    // Recupera sessione da Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'Pagamento non completato',
        status: session.payment_status
      });
    }

    console.log(`✅ Sessione trovata:`);
    console.log(`   Email: ${maskEmail(session.customer_details?.email)}`);
    console.log(`   Importo: €${(session.amount_total / 100).toFixed(2)}`);
    console.log(`   Status: ${session.payment_status}`);

    const metadata = session.metadata || {};
    const tempSessionId = metadata.temp_session_id;

    console.log(`\n📋 Metadata disponibili:`);
    console.log(`   temp_session_id: ${tempSessionId || '❌ MANCANTE'}`);
    console.log(`   dataCheckin: ${metadata.dataCheckin}`);
    console.log(`   appartamento: ${metadata.appartamento}`);
    console.log(`   numeroOspiti: ${metadata.numeroOspiti}`);

    // Ricostruisci dati prenotazione
    let datiCompleti;

    if (tempSessionId) {
      console.log(`\n🔄 Tentativo recupero da PostgreSQL...`);
      
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://checkin-six-coral.vercel.app';

        const pgResponse = await fetch(
          `${baseUrl}/api/salva-dati-temporanei?sessionId=${tempSessionId}`,
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
          datiCompleti = pgData.datiPrenotazione;
          console.log(`✅ Dati recuperati da PostgreSQL:`);
          console.log(`   Ospiti: ${datiCompleti.ospiti?.length || 0}`);
          console.log(`   Documenti: ${datiCompleti.documenti?.length || 0}`);
        } else {
          console.warn(`⚠️ PostgreSQL non disponibile (${pgResponse.status}), uso metadata`);
          throw new Error('Dati non in PostgreSQL');
        }
      } catch (pgError) {
        console.warn(`⚠️ ${pgError.message}, fallback a metadata Stripe`);
        datiCompleti = ricostruisciDaMetadata(metadata, session);
      }
    } else {
      console.warn(`⚠️ temp_session_id mancante, uso metadata Stripe`);
      datiCompleti = ricostruisciDaMetadata(metadata, session);
    }

    // Aggiungi email se mancante
    if (datiCompleti.ospiti?.[0] && !datiCompleti.ospiti[0].email) {
      datiCompleti.ospiti[0].email = session.customer_details?.email;
    }

    console.log(`\n📧 === INIZIO INVIO EMAIL ===\n`);

    const results = {
      emailProprietario: null,
      emailOspite: null
    };

    // 1. Email proprietario
    const emailProprietario = process.env.EMAIL_PROPRIETARIO;
    
    if (emailProprietario) {
      console.log(`📤 Invio email proprietario a: ${emailProprietario}`);
      
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://checkin-six-coral.vercel.app';

        const emailResponse = await fetch(`${baseUrl}/api/genera-pdf-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datiPrenotazione: datiCompleti,
            emailDestinatario: emailProprietario
          })
        });

        if (emailResponse.ok) {
          const result = await emailResponse.json();
          console.log(`✅ Email proprietario inviata`);
          console.log(`   PDF generato: ${result.pdfGenerato ? 'SI' : 'NO'}`);
          console.log(`   Documenti allegati: ${result.numeroDocumenti || 0}`);
          
          results.emailProprietario = {
            status: 'SUCCESS',
            pdfGenerato: result.pdfGenerato,
            numeroDocumenti: result.numeroDocumenti
          };
        } else {
          const errorText = await emailResponse.text();
          throw new Error(`HTTP ${emailResponse.status}: ${errorText}`);
        }
      } catch (emailError) {
        console.error(`❌ Errore email proprietario: ${emailError.message}`);
        results.emailProprietario = {
          status: 'ERROR',
          error: emailError.message
        };
      }
    } else {
      console.warn(`⚠️ EMAIL_PROPRIETARIO non configurata`);
      results.emailProprietario = {
        status: 'SKIPPED',
        reason: 'EMAIL_PROPRIETARIO non configurata'
      };
    }

    // 2. Email ospite
    const emailOspite = session.customer_details?.email;

    if (emailOspite) {
      console.log(`\n📤 Invio email ospite a: ${maskEmail(emailOspite)}`);
      
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://checkin-six-coral.vercel.app';

        const emailResponse = await fetch(`${baseUrl}/api/invia-email-ospite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailOspite: emailOspite,
            datiPrenotazione: datiCompleti
          })
        });

        if (emailResponse.ok) {
          const result = await emailResponse.json();
          console.log(`✅ Email ospite inviata`);
          console.log(`   Codici cassetta: ${result.codiciCassetta?.length ? 'generati (' + result.codiciCassetta.length + ')' : 'N/A'}`);
          
          results.emailOspite = {
            status: 'SUCCESS',
            codiciCassetta: result.codiciCassetta
          };
        } else {
          const errorText = await emailResponse.text();
          throw new Error(`HTTP ${emailResponse.status}: ${errorText}`);
        }
      } catch (emailError) {
        console.error(`❌ Errore email ospite: ${emailError.message}`);
        results.emailOspite = {
          status: 'ERROR',
          error: emailError.message
        };
      }
    } else {
      console.warn(`⚠️ Email ospite non disponibile`);
      results.emailOspite = {
        status: 'SKIPPED',
        reason: 'Email non disponibile'
      };
    }

    console.log(`\n✅ === OPERAZIONE COMPLETATA ===\n`);

    return res.status(200).json({
      success: true,
      message: 'Email re-inviate',
      sessionId: sessionId,
      results: results
    });

  } catch (error) {
    console.error('\n❌ Errore:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

// Ricostruisce dati minimi da metadata Stripe
function ricostruisciDaMetadata(metadata, session) {
  const responsabile = {
    numero: 1,
    cognome: metadata.resp_cognome || 'N/A',
    nome: metadata.resp_nome || 'N/A',
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
    appartamento: metadata.appartamento || 'N/A',
    numeroOspiti: parseInt(metadata.numeroOspiti) || 1,
    numeroNotti: parseInt(metadata.numeroNotti) || 1,
    tipoGruppo: metadata.tipoGruppo || null,
    totale: parseFloat(metadata.totale) || 0,
    timestamp: metadata.timestamp || new Date().toISOString(),
    ospiti: [responsabile],
    documenti: [] // Non disponibili senza PostgreSQL
  };
}
