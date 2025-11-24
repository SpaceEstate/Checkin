// api/test-webhook-stripe.js
// Endpoint per loggare TUTTI i webhook in arrivo da Stripe

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  
  console.log('\n========================================');
  console.log('🎯 WEBHOOK RICEVUTO:', timestamp);
  console.log('========================================');
  console.log('📍 Method:', req.method);
  console.log('📍 URL:', req.url);
  console.log('📍 Headers:', JSON.stringify(req.headers, null, 2));
  
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, stripe-signature");
  
  if (req.method === "OPTIONS") {
    console.log('✅ Preflight OPTIONS OK');
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    console.log('❌ Metodo non POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const buf = await buffer(req);
    const bodyString = buf.toString('utf8');
    
    console.log('\n📦 BODY RAW (primi 500 caratteri):');
    console.log(bodyString.substring(0, 500));
    console.log('\n📏 Body size:', buf.length, 'bytes');
    
    // Prova a parsare come JSON
    try {
      const bodyJson = JSON.parse(bodyString);
      console.log('\n📋 BODY PARSED:');
      console.log('- Type:', bodyJson.type);
      console.log('- ID:', bodyJson.id);
      console.log('- Created:', bodyJson.created);
      
      if (bodyJson.data?.object) {
        console.log('- Object ID:', bodyJson.data.object.id);
        console.log('- Object Type:', bodyJson.data.object.object);
        
        if (bodyJson.type === 'checkout.session.completed') {
          console.log('\n🎉 EVENTO: checkout.session.completed');
          console.log('- Session ID:', bodyJson.data.object.id);
          console.log('- Payment Status:', bodyJson.data.object.payment_status);
          console.log('- Customer Email:', bodyJson.data.object.customer_details?.email);
          console.log('- Amount Total:', bodyJson.data.object.amount_total);
          console.log('- Metadata:', JSON.stringify(bodyJson.data.object.metadata, null, 2));
        }
      }
    } catch (parseError) {
      console.log('⚠️ Body non è JSON valido:', parseError.message);
    }
    
    // Verifica signature Stripe
    const sig = req.headers['stripe-signature'];
    console.log('\n🔐 Stripe Signature presente:', !!sig);
    
    if (sig) {
      console.log('Signature (primi 50 caratteri):', sig.substring(0, 50) + '...');
      
      // Prova a verificare con Stripe (se hai il secret configurato)
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (endpointSecret) {
        console.log('🔑 STRIPE_WEBHOOK_SECRET configurato: SI');
        
        try {
          const stripe = (await import('stripe')).default;
          const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
          
          const event = stripeInstance.webhooks.constructEvent(
            buf,
            sig,
            endpointSecret
          );
          
          console.log('✅ SIGNATURE VALIDA!');
          console.log('Event type verificato:', event.type);
        } catch (verifyError) {
          console.log('❌ SIGNATURE INVALIDA:', verifyError.message);
        }
      } else {
        console.log('🔑 STRIPE_WEBHOOK_SECRET configurato: NO');
        console.log('⚠️ Non posso verificare la signature senza il secret');
      }
    } else {
      console.log('⚠️ Nessuna signature Stripe presente (possibile test manuale)');
    }
    
    console.log('\n========================================');
    console.log('✅ TEST COMPLETATO:', timestamp);
    console.log('========================================\n');
    
    return res.status(200).json({
      success: true,
      message: 'Webhook ricevuto e loggato',
      timestamp,
      method: req.method,
      hasSignature: !!sig,
      bodySize: buf.length,
      hint: 'Controlla i log di Vercel per i dettagli completi'
    });
    
  } catch (error) {
    console.error('\n❌ ERRORE NEL TEST:', error);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({
      error: 'Errore interno',
      message: error.message
    });
  }
}
