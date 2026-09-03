// api/check-webhook-config.js
// Verifica configurazione webhook Stripe

import Stripe from 'stripe';

export default async function handler(req, res) {
  console.log('🔍 Verifica configurazione webhook Stripe');

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Endpoint amministrativo: richiede un secret, non è pensato per essere chiamato
  // dal sito pubblico. Accetta sia header (per curl/script) sia query param
  // (comodo per uso manuale da browser).
  if (!process.env.ADMIN_SECRET) {
    console.error('❌ ADMIN_SECRET non configurato sul server');
    return res.status(500).json({ error: 'Configurazione server incompleta' });
  }

  const providedSecret = req.headers['x-admin-secret'] || req.query.key;

  if (providedSecret !== process.env.ADMIN_SECRET) {
    console.warn('🚫 Tentativo di accesso non autorizzato a check-webhook-config');
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const results = {
    timestamp: new Date().toISOString(),
    checks: []
  };

  try {
    // ✅ CHECK 1: Variabili ambiente
    console.log('\n📋 CHECK 1: Variabili Ambiente');
    
    const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
    const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
    
    console.log(`  STRIPE_SECRET_KEY: ${hasStripeKey ? '✅ OK' : '❌ MANCANTE'}`);
    console.log(`  STRIPE_WEBHOOK_SECRET: ${hasWebhookSecret ? '✅ OK' : '❌ MANCANTE'}`);
    
    results.checks.push({
      name: 'Variabili Ambiente',
      status: hasStripeKey && hasWebhookSecret ? 'OK' : 'ERROR',
      details: {
        STRIPE_SECRET_KEY: hasStripeKey,
        STRIPE_WEBHOOK_SECRET: hasWebhookSecret
      }
    });

    if (!hasStripeKey) {
      throw new Error('STRIPE_SECRET_KEY non configurata');
    }

    // ✅ CHECK 2: Connessione Stripe API
    console.log('\n🔌 CHECK 2: Connessione Stripe API');
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    try {
      const account = await stripe.account.retrieve();
      console.log(`  ✅ Account Stripe connesso: ${account.business_profile?.name || account.id}`);
      console.log(`  📧 Email: ${account.email || 'N/A'}`);
      console.log(`  🌍 Country: ${account.country || 'N/A'}`);
      
      results.checks.push({
        name: 'Connessione Stripe',
        status: 'OK',
        details: {
          accountId: account.id,
          businessName: account.business_profile?.name,
          email: account.email,
          country: account.country
        }
      });
    } catch (stripeError) {
      console.error(`  ❌ Errore connessione: ${stripeError.message}`);
      results.checks.push({
        name: 'Connessione Stripe',
        status: 'ERROR',
        error: stripeError.message
      });
      throw stripeError;
    }

    // ✅ CHECK 3: Webhook Endpoints registrati
    console.log('\n🌐 CHECK 3: Webhook Endpoints Stripe');
    
    try {
      const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });
      
      console.log(`  📊 Webhook registrati: ${webhooks.data.length}`);
      
      const yourWebhooks = webhooks.data.filter(wh => 
        wh.url.includes('vercel.app') || wh.url.includes('spaceestate')
      );

      if (yourWebhooks.length === 0) {
        console.warn('  ⚠️ NESSUN WEBHOOK TROVATO per questo dominio!');
        console.warn('  💡 Registra il webhook su Stripe Dashboard:');
        console.warn('     https://dashboard.stripe.com/test/webhooks');
        console.warn('     URL: https://checkin-six-coral.vercel.app/api/stripeWebhook');
        console.warn('     Eventi: checkout.session.completed');
      } else {
        yourWebhooks.forEach((wh, index) => {
          console.log(`\n  📍 Webhook ${index + 1}:`);
          console.log(`     URL: ${wh.url}`);
          console.log(`     Status: ${wh.status}`);
          console.log(`     Eventi: ${wh.enabled_events.join(', ')}`);
          console.log(`     Secret: ${wh.secret.substring(0, 10)}...`);
          
          if (!wh.enabled_events.includes('checkout.session.completed')) {
            console.warn(`     ⚠️ MANCA evento checkout.session.completed!`);
          }
        });
      }

      results.checks.push({
        name: 'Webhook Endpoints',
        status: yourWebhooks.length > 0 ? 'OK' : 'WARNING',
        details: {
          total: webhooks.data.length,
          yourWebhooks: yourWebhooks.map(wh => ({
            url: wh.url,
            status: wh.status,
            events: wh.enabled_events
          }))
        }
      });

    } catch (webhookError) {
      console.error(`  ❌ Errore lettura webhook: ${webhookError.message}`);
      results.checks.push({
        name: 'Webhook Endpoints',
        status: 'ERROR',
        error: webhookError.message
      });
    }

    // ✅ CHECK 4: Recent Events
    console.log('\n📜 CHECK 4: Eventi Recenti (ultime 24h)');
    
    try {
      const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      
      const events = await stripe.events.list({
        limit: 10,
        created: { gte: oneDayAgo },
        type: 'checkout.session.completed'
      });

      console.log(`  📊 Eventi checkout.session.completed (24h): ${events.data.length}`);

      if (events.data.length > 0) {
        events.data.slice(0, 3).forEach((event, index) => {
          console.log(`\n  📌 Evento ${index + 1}:`);
          console.log(`     ID: ${event.id}`);
          console.log(`     Creato: ${new Date(event.created * 1000).toLocaleString('it-IT')}`);
          console.log(`     Session ID: ${event.data.object.id}`);
          console.log(`     Email: ${event.data.object.customer_details?.email || 'N/A'}`);
        });
      } else {
        console.log('  ℹ️ Nessun evento checkout.session.completed nelle ultime 24h');
      }

      results.checks.push({
        name: 'Eventi Recenti',
        status: 'INFO',
        details: {
          count: events.data.length,
          recentEvents: events.data.slice(0, 3).map(e => ({
            id: e.id,
            created: new Date(e.created * 1000).toISOString(),
            sessionId: e.data.object.id
          }))
        }
      });

    } catch (eventsError) {
      console.error(`  ❌ Errore lettura eventi: ${eventsError.message}`);
      results.checks.push({
        name: 'Eventi Recenti',
        status: 'ERROR',
        error: eventsError.message
      });
    }

    // ✅ CHECK 5: Webhook Endpoint Reachability
    console.log('\n🌐 CHECK 5: Webhook Endpoint Accessibilità');
    
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://checkin-six-coral.vercel.app';

      const webhookUrl = `${baseUrl}/api/stripeWebhook`;
      
      console.log(`  📡 Testo: ${webhookUrl}`);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });

      console.log(`  📊 Status: ${response.status}`);
      
      if (response.status === 200 || response.status === 400) {
        console.log('  ✅ Webhook endpoint raggiungibile');
        results.checks.push({
          name: 'Endpoint Accessibilità',
          status: 'OK',
          details: { url: webhookUrl, statusCode: response.status }
        });
      } else {
        console.warn(`  ⚠️ Status inaspettato: ${response.status}`);
        results.checks.push({
          name: 'Endpoint Accessibilità',
          status: 'WARNING',
          details: { url: webhookUrl, statusCode: response.status }
        });
      }

    } catch (reachError) {
      console.error(`  ❌ Errore accessibilità: ${reachError.message}`);
      results.checks.push({
        name: 'Endpoint Accessibilità',
        status: 'ERROR',
        error: reachError.message
      });
    }

    // Riepilogo
    console.log('\n✅ ========================================');
    console.log('✅ VERIFICA COMPLETATA');
    console.log('✅ ========================================\n');

    const allOk = results.checks.every(c => c.status === 'OK' || c.status === 'INFO');

    return res.status(200).json({
      success: allOk,
      message: allOk ? 'Configurazione OK' : 'Alcuni controlli hanno fallito',
      timestamp: results.timestamp,
      checks: results.checks
    });

  } catch (error) {
    console.error('\n❌ Errore generale:', error);
    console.error('Stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      checks: results.checks
    });
  }
}
