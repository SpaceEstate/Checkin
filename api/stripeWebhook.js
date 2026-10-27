// api/stripeWebhook.js
// Webhook Stripe: dopo un pagamento confermato avvia l'elaborazione del check-in (vedi _elabora-checkin.js).
//
// Cosa è cambiato (adeguamento GDPR, branch gdpr/checkin-semplificazione):
//  - i dati degli ospiti vanno al foglio Google del check-in come prima (da lì lo script del gestore crea il TXT);
//  - al gestore vanno l'immagine del documento e il PDF di riepilogo (dati solo negli allegati, mai nel corpo dell'email);
//  - i dati temporanei si leggono direttamente dal database (prima: chiamata HTTP all'URL di produzione con
//    INTERNAL_API_SECRET, che dalle preview puntava comunque alla produzione) e si cancellano appena non servono;
//  - se un passo fallisce per un motivo temporaneo il webhook risponde 500 e Stripe ritenta: ogni passo è idempotente,
//    quindi un nuovo tentativo non duplica email né righe del foglio.
// Invariati: verifica della firma Stripe, evento gestito (checkout.session.completed), importi e logica di pagamento.

import Stripe from 'stripe';
import { pgStore } from './_db.js';
import { elaboraCheckin } from './_elabora-checkin.js';
import { inviaImmaginiAlGestore } from './_email-gestore.js';
import { salvaSuSheet } from './_sheet-checkin.js';
import { generaPdfRiepilogo } from './_pdf-riepilogo.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

// Email di benvenuto all'ospite: stesso endpoint di prima (invia-email-ospite.js), ma riceve solo i dati che usa.
export async function inviaEmailOspiteHttp(payload) {
  const maxRetries = 2;
  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('https://checkin-six-coral.vercel.app/api/invia-email-ospite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (response.ok) return await response.json();
      const e = new Error('HTTP ' + response.status); e.code = 'HTTP_' + response.status; throw e;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 2000));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function dipendenzeProduzione(requestId) {
  return {
    store: pgStore,
    env: process.env,
    fetch: (...a) => globalThis.fetch(...a),
    salvaSuSheet,
    generaPdfRiepilogo,
    inviaEmailOspite: inviaEmailOspiteHttp,
    inviaEmailGestore: inviaImmaginiAlGestore,
    log: msg => console.log(`[${requestId}] ${msg}`)
  };
}

// deps: { stripe, endpointSecret, store, dipendenze(requestId) } — iniettabili nei test
export function makeHandler(deps) {
  return async function handler(req, res) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    let event;
    try {
      const rawBody = await buffer(req);
      const sig = req.headers['stripe-signature'];
      if (!sig || !deps.endpointSecret) {
        console.error(`❌ [${requestId}] Missing config`);
        return res.status(400).send('Webhook Error: Missing configuration');
      }
      event = deps.stripe.webhooks.constructEvent(rawBody, sig, deps.endpointSecret);
      console.log(`✅ [${requestId}] Event verified: ${event.type}`);
    } catch (err) {
      console.error(`❌ [${requestId}] Signature error`);
      return res.status(400).send('Webhook Error: firma non valida');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      try {
        const r = await elaboraCheckin(session, deps.dipendenze(requestId));
        console.log(`[${requestId}] checkin ${r.checkinId}: ${r.esito}`);
        // pulizia dei dati temporanei scaduti (anche di altri check-in): un errore qui non cambia la risposta
        await deps.store.pulisciScaduti().catch(() => console.warn(`[${requestId}] pulizia scaduti non riuscita`));
        if (r.esito !== 'completato') {
          // "da_ripetere" (errore temporaneo) o "in_corso" (stesso evento già in elaborazione): Stripe ritenterà
          return res.status(500).json({ received: true, retry: true });
        }
      } catch (err) {
        console.error(`❌ [${requestId}] Errore elaborazione: ${err && (err.code || err.name) || 'errore'}`);
        return res.status(500).json({ received: true, retry: true });
      }
    }

    return res.status(200).json({ received: true });
  };
}

export default makeHandler({ stripe, endpointSecret, store: pgStore, dipendenze: dipendenzeProduzione });

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
