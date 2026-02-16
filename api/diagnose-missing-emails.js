// api/diagnose-missing-emails.js
// Analizza perché le email non vengono inviate dopo il pagamento

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('\n🔍 === DIAGNOSI MANCATO INVIO EMAIL ===\n');

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  
  if (req.method === "OPTIONS") return res.status(200).end();

  const diagnosis = {
    timestamp: new Date().toISOString(),
    recentPayments: [],
    webhookStatus: null,
    possibleIssues: []
  };

  try {
    // 1. Recupera ultimi pagamenti completati
    console.log('📊 Analisi ultimi 5 pagamenti completati...\n');
    
    const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    
    const events = await stripe.events.list({
      limit: 5,
      created: { gte: oneDayAgo },
      type: 'checkout.session.completed'
    });

    console.log(`📌 Trovati ${events.data.length} eventi nelle ultime 24h\n`);

    for (const event of events.data) {
      const session = event.data.object;
      const metadata = session.metadata || {};
      
      const paymentInfo = {
        eventId: event.id,
        sessionId: session.id,
        created: new Date(event.created * 1000).toLocaleString('it-IT'),
        email: session.customer_details?.email,
        amountPaid: `€${(session.amount_total / 100).toFixed(2)}`,
        tempSessionId: metadata.temp_session_id || null,
        dataCheckin: metadata.dataCheckin,
        appartamento: metadata.appartamento,
        numeroOspiti: metadata.numeroOspiti,
        hasMetadata: Object.keys(metadata).length > 0
      };

      console.log(`\n💳 Pagamento ${events.data.indexOf(event) + 1}:`);
      console.log(`   Session ID: ${paymentInfo.sessionId}`);
      console.log(`   Data: ${paymentInfo.created}`);
      console.log(`   Email: ${paymentInfo.email || '❌ MANCANTE'}`);
      console.log(`   Importo: ${paymentInfo.amountPaid}`);
      console.log(`   Temp Session ID: ${paymentInfo.tempSessionId || '❌ MANCANTE'}`);
      console.log(`   Data Check-in: ${paymentInfo.dataCheckin || '❌ MANCANTE'}`);
      console.log(`   Appartamento: ${paymentInfo.appartamento || '❌ MANCANTE'}`);

      // Verifica problemi
      const issues = [];
      
      if (!paymentInfo.email) {
        issues.push('❌ Email cliente mancante');
      }
      
      if (!paymentInfo.tempSessionId) {
        issues.push('❌ Temp Session ID mancante - impossibile recuperare dati completi');
      }
      
      if (!paymentInfo.hasMetadata) {
        issues.push('⚠️ Metadata vuoti - dati prenotazione non salvati');
      }

      if (issues.length > 0) {
        console.log(`\n   🚨 PROBLEMI RILEVATI:`);
        issues.forEach(issue => console.log(`      ${issue}`));
      } else {
        console.log(`\n   ✅ Dati completi presenti`);
      }

      paymentInfo.issues = issues;
      diagnosis.recentPayments.push(paymentInfo);
    }

    // 2. Verifica configurazione webhook
    console.log('\n\n🌐 Verifica configurazione webhook...\n');
    
    try {
      const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });
      
      const activeWebhooks = webhooks.data.filter(wh => 
        wh.url.includes('vercel.app') && 
        wh.enabled_events.includes('checkout.session.completed')
      );

      if (activeWebhooks.length === 0) {
        console.log('❌ NESSUN WEBHOOK ATTIVO TROVATO!');
        diagnosis.possibleIssues.push('Webhook non configurato su Stripe Dashboard');
        diagnosis.webhookStatus = 'MISSING';
      } else {
        console.log(`✅ Trovati ${activeWebhooks.length} webhook attivi:`);
        activeWebhooks.forEach((wh, i) => {
          console.log(`\n   Webhook ${i + 1}:`);
          console.log(`   URL: ${wh.url}`);
          console.log(`   Status: ${wh.status}`);
          console.log(`   Eventi: ${wh.enabled_events.join(', ')}`);
        });
        diagnosis.webhookStatus = 'OK';
      }
    } catch (webhookError) {
      console.error('❌ Errore verifica webhook:', webhookError.message);
      diagnosis.webhookStatus = 'ERROR';
      diagnosis.possibleIssues.push(`Errore lettura webhook: ${webhookError.message}`);
    }

    // 3. Verifica variabili ambiente email
    console.log('\n\n📧 Verifica configurazione email...\n');
    
    const emailConfig = {
      EMAIL_USER: !!process.env.EMAIL_USER,
      EMAIL_PASSWORD: !!process.env.EMAIL_PASSWORD,
      EMAIL_PROPRIETARIO: process.env.EMAIL_PROPRIETARIO || null
    };

    console.log(`   EMAIL_USER: ${emailConfig.EMAIL_USER ? '✅' : '❌'}`);
    console.log(`   EMAIL_PASSWORD: ${emailConfig.EMAIL_PASSWORD ? '✅' : '❌'}`);
    console.log(`   EMAIL_PROPRIETARIO: ${emailConfig.EMAIL_PROPRIETARIO || '❌ MANCANTE'}`);

    if (!emailConfig.EMAIL_USER || !emailConfig.EMAIL_PASSWORD) {
      diagnosis.possibleIssues.push('Credenziali Gmail non configurate');
    }

    if (!emailConfig.EMAIL_PROPRIETARIO) {
      diagnosis.possibleIssues.push('EMAIL_PROPRIETARIO non configurata');
    }

    // 4. Test recupero dati da PostgreSQL (per ultimo pagamento)
    if (diagnosis.recentPayments.length > 0) {
      const lastPayment = diagnosis.recentPayments[0];
      
      if (lastPayment.tempSessionId) {
        console.log('\n\n💾 Test recupero dati da PostgreSQL...\n');
        
        try {
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://checkin-six-coral.vercel.app';

          const pgResponse = await fetch(
            `${baseUrl}/api/salva-dati-temporanei?sessionId=${lastPayment.tempSessionId}`,
            {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            }
          );

          if (pgResponse.ok) {
            const pgData = await pgResponse.json();
            console.log('   ✅ Dati recuperabili da PostgreSQL');
            console.log(`   Ospiti: ${pgData.datiPrenotazione?.ospiti?.length || 0}`);
            console.log(`   Documenti: ${pgData.datiPrenotazione?.documenti?.length || 0}`);
          } else {
            console.log(`   ❌ Impossibile recuperare dati (HTTP ${pgResponse.status})`);
            diagnosis.possibleIssues.push('Dati non disponibili in PostgreSQL');
          }
        } catch (pgError) {
          console.error('   ❌ Errore recupero PostgreSQL:', pgError.message);
          diagnosis.possibleIssues.push(`Errore PostgreSQL: ${pgError.message}`);
        }
      }
    }

    // RIEPILOGO FINALE
    console.log('\n\n📋 === RIEPILOGO DIAGNOSI ===\n');

    if (diagnosis.possibleIssues.length === 0) {
      console.log('✅ Nessun problema evidente trovato');
      console.log('💡 Le email dovrebbero essere inviate correttamente');
      console.log('   Controlla i log di Vercel per vedere se il webhook viene chiamato');
    } else {
      console.log('🚨 PROBLEMI RILEVATI:\n');
      diagnosis.possibleIssues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    console.log('\n===========================\n');

    return res.status(200).json({
      success: diagnosis.possibleIssues.length === 0,
      diagnosis,
      recommendations: generateRecommendations(diagnosis)
    });

  } catch (error) {
    console.error('\n❌ Errore diagnosi:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

function generateRecommendations(diagnosis) {
  const recommendations = [];

  // Check webhook
  if (diagnosis.webhookStatus === 'MISSING') {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Webhook non configurato',
      solution: 'Vai su Stripe Dashboard → Webhooks e aggiungi: https://checkin-six-coral.vercel.app/api/stripeWebhook con evento checkout.session.completed'
    });
  }

  // Check email mancanti
  const paymentsWithoutEmail = diagnosis.recentPayments.filter(p => !p.email);
  if (paymentsWithoutEmail.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      issue: `${paymentsWithoutEmail.length} pagamenti senza email cliente`,
      solution: 'Stripe Checkout non sta raccogliendo l\'email. Verifica le impostazioni della sessione checkout.'
    });
  }

  // Check temp_session_id mancanti
  const paymentsWithoutTempId = diagnosis.recentPayments.filter(p => !p.tempSessionId);
  if (paymentsWithoutTempId.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      issue: `${paymentsWithoutTempId.length} pagamenti senza temp_session_id`,
      solution: 'Il frontend non sta passando temp_session_id a Stripe. Verifica checkin.js funzione creaLinkPagamentoConSessionId()'
    });
  }

  // Check problemi specifici
  if (diagnosis.possibleIssues.includes('EMAIL_PROPRIETARIO non configurata')) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Email proprietario non configurata',
      solution: 'Aggiungi EMAIL_PROPRIETARIO nelle variabili ambiente di Vercel'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'INFO',
      issue: 'Configurazione sembra corretta',
      solution: 'Controlla i log di Vercel nella sezione Functions per vedere se il webhook viene effettivamente chiamato e dove fallisce.'
    });
  }

  return recommendations;
}
