// api/retry-email-from-stripe.js
// Endpoint amministrativo: ripete l'elaborazione di un check-in pagato a partire dalla sessione Stripe.
//
// Prima: ricostruiva i dati (anche dai metadati Stripe con nome, cognome, nascita...) e richiamava
// genera-pdf-email (PDF + riepilogo ospiti) e invia-email-ospite. Ora usa la stessa elaborazione IDEMPOTENTE
// del webhook (_elabora-checkin.js): rifà solo i passi non ancora riusciti (email ospite, TXT Alloggiati + Drive,
// email al gestore con la sola immagine del documento). Se i dati temporanei sono già stati cancellati, il TXT e
// l'email al gestore non possono essere rifatti: lo dice il registro ("dati_non_disponibili").
//
// Uso: GET /api/retry-email-from-stripe?session_id=cs_...  con header x-admin-secret (o ?key=, come prima).

import Stripe from 'stripe';
import { elaboraCheckin } from './_elabora-checkin.js';
import { dipendenzeProduzione } from './stripeWebhook.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

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
    const sessionId = req.query.session_id || req.body?.sessionId;
    if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      return res.status(400).json({ error: 'Session ID richiesto', usage: 'GET /api/retry-email-from-stripe?session_id=cs_test_...' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Pagamento non completato', status: session.payment_status });
    }

    const requestId = 'retry_' + Date.now();
    const r = await elaboraCheckin(session, dipendenzeProduzione(requestId));
    const reg = r.registro || {};
    return res.status(200).json({
      success: r.esito === 'completato',
      esito: r.esito,
      checkinId: r.checkinId,
      stato: {
        txt: reg.txt_stato,
        txtNomeFile: reg.txt_nome_file || null,
        emailOspite: reg.email_ospite_stato,
        emailGestore: reg.email_gestore_stato,
        datiTemporaneiEliminati: !!reg.dati_temporanei_eliminati_at
      },
      nota: 'Il TXT è solo pronto per il caricamento manuale su Alloggiati Web: nessun invio è stato fatto.'
    });
  } catch (error) {
    console.error('retry-email-from-stripe: errore ' + (error && (error.type || error.code || error.name) || 'interno'));
    return res.status(500).json({ success: false, error: 'Errore interno' });
  }
}
