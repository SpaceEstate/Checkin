// api/salva-dati-temporanei.js
// Salva i dati del check-in in attesa del pagamento (Neon PostgreSQL, tabella temporary_sessions).
//
// Minimizzazione (adeguamento GDPR):
//  - si salvano SOLO i campi necessari al TXT Alloggiati e all'immagine del documento per il gestore
//    (vedi _validazione-checkin.js): il resto viene scartato; immagini controllate per tipo reale, numero e dimensione;
//  - durata: 2 ore se il pagamento non arriva; dopo il pagamento i dati si cancellano appena TXT ed email sono a posto,
//    al massimo dopo 72 ore (vedi _elabora-checkin.js). Pulizia dei dati scaduti a ogni salvataggio e una volta al giorno (cron);
//  - rimosso il GET che restituiva i dati completi (documento incluso): ora il webhook legge direttamente dal database;
//  - un sessionId già usato non viene sovrascritto (prima un "upsert" permetteva di rimpiazzare i dati di un'altra sessione);
//  - nei log e nelle risposte niente dati personali, niente dimensioni dei file, niente messaggi interni del database.
import { pgStore } from './_db.js';
import { minimizzaDatiCheckin, sessionIdValido, MAX_BYTE_RICHIESTA } from './_validazione-checkin.js';
import { TTL_PRIMA_DEL_PAGAMENTO_MS } from './_elabora-checkin.js';

export function makeHandler(deps) {
  const store = deps.store, now = deps.now || (() => Date.now());
  return async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

    try {
      const body = req.body && typeof req.body === 'object' ? req.body : null;
      const { sessionId, datiPrenotazione } = body || {};
      if (!sessionIdValido(sessionId) || !datiPrenotazione) {
        return res.status(400).json({ error: "Richiesta non valida" });
      }
      // stima prudente della dimensione (Vercel rifiuta comunque oltre ~4,5 MB)
      if (JSON.stringify(datiPrenotazione).length > MAX_BYTE_RICHIESTA) {
        return res.status(413).json({ error: "Dati troppo grandi" });
      }
      const m = minimizzaDatiCheckin(datiPrenotazione);
      if (!m.ok) {
        console.warn('salva-dati-temporanei: dati rifiutati (' + m.errore + ')');
        return res.status(400).json({ error: "Dati non validi", codice: m.errore });
      }

      await store.pulisciScaduti().catch(() => console.warn('salva-dati-temporanei: pulizia scaduti non riuscita'));

      const scadenza = new Date(now() + TTL_PRIMA_DEL_PAGAMENTO_MS);
      const esito = await store.salvaDatiTemporanei(sessionId, m.dati, scadenza);
      if (esito !== 'ok') return res.status(409).json({ error: "Sessione già esistente" });

      console.log(`salva-dati-temporanei: salvati ospiti=${m.dati.ospiti.length} documenti=${m.dati.documenti.length}`);
      return res.status(200).json({ success: true, expiresAt: scadenza.toISOString() });
    } catch (error) {
      console.error('salva-dati-temporanei: errore ' + (error && (error.code || error.name) || 'interno'));
      return res.status(500).json({ error: "Salvataggio non riuscito" });
    }
  };
}

export default makeHandler({ store: pgStore });
