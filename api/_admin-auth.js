// api/_admin-auth.js — confronto delle chiavi degli endpoint riservati (il prefisso "_" evita che Vercel lo esponga come endpoint).
//
// Confronto a tempo costante (si confrontano gli hash, così anche lunghezze diverse non si notano dai tempi di risposta),
// come già fa admin-alloggiati.js. Una chiave mancante o vuota non è mai valida.
import crypto from 'crypto';

export function chiaveUguale(ricevuta, attesa) {
  const r = String(ricevuta == null ? '' : ricevuta), a = String(attesa == null ? '' : attesa);
  if (!r || !a) return false;
  const h = s => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(r), h(a));
}

// Endpoint di diagnosi (test-email, diagnose-missing-emails, check-webhook-config, retry-email-from-stripe): la chiave ADMIN_SECRET
// arriva nell'intestazione x-admin-secret oppure, come prima, nell'indirizzo (?key=, comodo dal browser; meglio l'intestazione,
// perché l'indirizzo resta nella cronologia del browser e nei log).
export function adminAutorizzato(req, env = process.env) {
  const ricevuta = (req && req.headers && req.headers['x-admin-secret']) || (req && req.query && req.query.key) || '';
  return chiaveUguale(ricevuta, env.ADMIN_SECRET);
}
