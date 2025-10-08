// api/salva-dati-temporanei.js
// Salva i dati completi (inclusi documenti) prima del pagamento

const datiTemporanei = new Map(); // In produzione usa Redis o database

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    try {
      const { sessionId, datiPrenotazione } = req.body;

      if (!sessionId || !datiPrenotazione) {
        return res.status(400).json({ 
          error: "sessionId e datiPrenotazione sono obbligatori" 
        });
      }

      console.log(`💾 Salvataggio dati temporanei per sessione: ${sessionId}`);
      console.log(`📊 Documenti trovati: ${datiPrenotazione.documenti?.length || 0}`);

      // Salva in memoria (scade automaticamente dopo 1 ora)
      datiTemporanei.set(sessionId, {
        dati: datiPrenotazione,
        timestamp: Date.now(),
        ttl: 3600000 // 1 ora in millisecondi
      });

      // Cleanup automatico dei dati vecchi
      pulisciDatiScaduti();

      return res.status(200).json({ 
        success: true,
        message: "Dati salvati temporaneamente",
        sessionId: sessionId
      });

    } catch (error) {
      console.error("❌ Errore salvataggio dati:", error);
      return res.status(500).json({ 
        error: "Errore interno: " + error.message 
      });
    }
  }

  if (req.method === "GET") {
    try {
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId mancante" });
      }

      console.log(`🔍 Recupero dati per sessione: ${sessionId}`);

      const datiSalvati = datiTemporanei.get(sessionId);

      if (!datiSalvati) {
        console.warn(`⚠️ Dati non trovati per sessione: ${sessionId}`);
        return res.status(404).json({ 
          error: "Dati non trovati o scaduti" 
        });
      }

      // Verifica TTL
      if (Date.now() - datiSalvati.timestamp > datiSalvati.ttl) {
        datiTemporanei.delete(sessionId);
        return res.status(404).json({ 
          error: "Dati scaduti" 
        });
      }

      console.log(`✅ Dati recuperati con successo`);
      console.log(`📊 Documenti: ${datiSalvati.dati.documenti?.length || 0}`);

      // Elimina i dati dopo il recupero (uso singolo)
      datiTemporanei.delete(sessionId);

      return res.status(200).json({ 
        success: true,
        datiPrenotazione: datiSalvati.dati
      });

    } catch (error) {
      console.error("❌ Errore recupero dati:", error);
      return res.status(500).json({ 
        error: "Errore interno: " + error.message 
      });
    }
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}

// Funzione di pulizia dei dati scaduti
function pulisciDatiScaduti() {
  const ora = Date.now();
  let eliminati = 0;

  for (const [sessionId, dati] of datiTemporanei.entries()) {
    if (ora - dati.timestamp > dati.ttl) {
      datiTemporanei.delete(sessionId);
      eliminati++;
    }
  }

  if (eliminati > 0) {
    console.log(`🧹 Pulizia: ${eliminati} sessioni scadute eliminate`);
  }
}
