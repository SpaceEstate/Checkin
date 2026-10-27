// api/pulizia-dati-temporanei.js — pulizia programmata (Vercel Cron, vedi vercel.json "crons").
//
// Cancella i dati temporanei del check-in scaduti (anagrafiche + immagini) e le righe del registro tecnico non più
// necessarie. È la rete di sicurezza: la pulizia avviene anche a ogni salvataggio e a ogni webhook.
// Con il piano Vercel Hobby i cron girano al massimo una volta al giorno (orario non preciso): un dato scaduto può quindi
// restare fino a ~24 ore oltre la scadenza se nel frattempo non arrivano altre richieste. Vedi docs/gdpr/checkin-modifiche.md.
//
// Autorizzazione: se è impostata CRON_SECRET, Vercel invia "Authorization: Bearer <CRON_SECRET>" e la richiesta senza
// questo header viene rifiutata. Senza CRON_SECRET l'endpoint resta richiamabile (l'unico effetto possibile è cancellare
// dati GIÀ scaduti) ma è consigliato impostarla.
import crypto from 'crypto';
import { pgStore } from './_db.js';

export const GIORNI_REGISTRO = 30;

export function makeHandler(deps) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
    const segreto = deps.env.CRON_SECRET;
    if (segreto) {
      const atteso = crypto.createHash('sha256').update('Bearer ' + segreto).digest();
      const ricevuto = crypto.createHash('sha256').update(String(req.headers.authorization || '')).digest();
      if (!crypto.timingSafeEqual(atteso, ricevuto)) return res.status(401).json({ error: 'Non autorizzato' });
    } else {
      console.warn('pulizia-dati-temporanei: CRON_SECRET non impostata');
    }
    try {
      const r = await deps.store.pulisciScaduti(GIORNI_REGISTRO);
      console.log(`pulizia-dati-temporanei: sessioni eliminate=${r.sessioni} registri eliminati=${r.registri}`);
      return res.status(200).json({ ok: true, eliminati: r });
    } catch (e) {
      console.error('pulizia-dati-temporanei: errore ' + (e && (e.code || e.name) || 'interno'));
      return res.status(500).json({ ok: false });
    }
  };
}

export default makeHandler({ store: pgStore, env: process.env });
