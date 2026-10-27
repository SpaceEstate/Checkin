// api/verifica-dati-alloggiati.js
// Pre-verifica, PRIMA del pagamento, dei dati che servono alle schedine Alloggiati Web.
// Scopo: permettere all'ospite di correggere subito ciò che solo lui può correggere (es. comune di nascita scritto in modo
// diverso dalla tabella ufficiale, caratteri non ammessi nel nome). Il resto lo gestisce il gestore.
// - Nessun salvataggio, nessun log dei dati ricevuti, nessuna immagine accettata (solo campi anagrafici).
// - Se le tabelle ufficiali non sono disponibili risponde { disponibile: false }: il modulo prosegue senza bloccare l'ospite
//   (il TXT verrà validato di nuovo dopo il pagamento e, se non valido, non verrà generato).
import { pgStore } from './_db.js';
import { caricaTabelle } from './_alloggiati_tabelle.js';
import { generaTxt, problemiCorreggibiliDallOspite } from './_checkin-alloggiati.js';
import { minimizzaDatiCheckin } from './_validazione-checkin.js';

export function makeHandler(deps) {
  const now = deps.now || (() => Date.now());
  return async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      if (JSON.stringify(body).length > 50000) return res.status(413).json({ error: "Richiesta troppo grande" });
      const m = minimizzaDatiCheckin(Object.assign({}, body, { documenti: [] }));
      if (!m.ok) return res.status(400).json({ error: "Dati non validi", codice: m.errore });

      const tab = await deps.caricaTabelle({ store: deps.store, env: deps.env, fetch: deps.fetch, now, network: true, deadline: now() + 6000 });
      if (!tab.ok) return res.status(200).json({ disponibile: false });

      const g = generaTxt(m.dati, tab.tables, now());
      const problemi = g.ok ? [] : problemiCorreggibiliDallOspite(g.problemi);
      return res.status(200).json({ disponibile: true, ok: problemi.length === 0, problemi });
    } catch (e) {
      console.error('verifica-dati-alloggiati: errore ' + (e && (e.code || e.name) || 'interno'));
      return res.status(200).json({ disponibile: false });
    }
  };
}

export default makeHandler({ store: pgStore, env: process.env, fetch: (...a) => globalThis.fetch(...a), caricaTabelle });
