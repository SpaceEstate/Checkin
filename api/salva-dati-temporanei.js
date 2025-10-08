// api/salva-dati-temporanei.js
// VERSIONE MIGLIORATA con logging dettagliato

// IMPORTANTE: Su Vercel, la Map in memoria si resetta tra richieste
// Per produzione, considera l'uso di:
// - Vercel KV (Redis)
// - Upstash Redis
// - Database temporaneo

const datiTemporanei = new Map();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // === SALVATAGGIO DATI (POST) ===
  if (req.method === "POST") {
    try {
      console.log('\n💾 === INIZIO SALVATAGGIO DATI TEMPORANEI ===');
      
      const { sessionId, datiPrenotazione } = req.body;

      // Validazione input
      if (!sessionId) {
        console.error('❌ sessionId mancante');
        return res.status(400).json({ 
          error: "sessionId è obbligatorio",
          received: { sessionId: !!sessionId }
        });
      }

      if (!datiPrenotazione) {
        console.error('❌ datiPrenotazione mancanti');
        return res.status(400).json({ 
          error: "datiPrenotazione sono obbligatori",
          received: { datiPrenotazione: !!datiPrenotazione }
        });
      }

      // Log dettagliato
      console.log(`🔑 Session ID: ${sessionId}`);
      console.log(`📊 Numero ospiti: ${datiPrenotazione.ospiti?.length || 0}`);
      console.log(`📄 Numero documenti: ${datiPrenotazione.documenti?.length || 0}`);
      
      // Calcola dimensione totale dei documenti
      let documentiSize = 0;
      if (datiPrenotazione.documenti) {
        documentiSize = datiPrenotazione.documenti.reduce((acc, doc) => {
          return acc + (doc.dimensione || 0);
        }, 0);
        console.log(`💾 Dimensione totale documenti: ${(documentiSize / 1024).toFixed(2)} KB`);
      }

      // Log singoli documenti
      if (datiPrenotazione.documenti?.length > 0) {
        datiPrenotazione.documenti.forEach((doc, idx) => {
          console.log(`  📎 Documento ${idx + 1}:`, {
            ospiteNumero: doc.ospiteNumero,
            nome: doc.nomeFile,
            tipo: doc.tipo,
            dimensione: `${(doc.dimensione / 1024).toFixed(2)} KB`,
            hasBase64: !!doc.base64
          });
        });
      }

      // Salva in memoria
      const timestamp = Date.now();
      const ttl = 3600000; // 1 ora
      
      datiTemporanei.set(sessionId, {
        dati: datiPrenotazione,
        timestamp: timestamp,
        ttl: ttl,
        expiresAt: new Date(timestamp + ttl).toISOString()
      });

      // Cleanup automatico
      pulisciDatiScaduti();

      // Log stato attuale
      console.log(`✅ Dati salvati con successo`);
      console.log(`📦 Sessioni attive in memoria: ${datiTemporanei.size}`);
      console.log(`⏰ Scadenza: ${new Date(timestamp + ttl).toISOString()}`);
      console.log('💾 === FINE SALVATAGGIO ===\n');

      return res.status(200).json({ 
        success: true,
        message: "Dati salvati temporaneamente",
        sessionId: sessionId,
        details: {
          numeroOspiti: datiPrenotazione.ospiti?.length || 0,
          numeroDocumenti: datiPrenotazione.documenti?.length || 0,
          documentiSizeKB: (documentiSize / 1024).toFixed(2),
          expiresAt: new Date(timestamp + ttl).toISOString()
        }
      });

    } catch (error) {
      console.error("❌ Errore salvataggio dati:", error);
      console.error("Stack trace:", error.stack);
      return res.status(500).json({ 
        error: "Errore interno: " + error.message 
      });
    }
  }

  // === RECUPERO DATI (GET) ===
  if (req.method === "GET") {
    try {
      console.log('\n🔍 === INIZIO RECUPERO DATI TEMPORANEI ===');
      
      const { sessionId } = req.query;

      if (!sessionId) {
        console.error('❌ sessionId mancante nella query');
        return res.status(400).json({ 
          error: "sessionId mancante",
          example: "/api/salva-dati-temporanei?sessionId=temp_xxx"
        });
      }

      console.log(`🔑 Richiesta recupero per: ${sessionId}`);
      console.log(`📦 Sessioni attive: ${datiTemporanei.size}`);
      
      // Log tutte le chiavi disponibili (per debug)
      if (datiTemporanei.size > 0) {
        console.log('📋 Chiavi disponibili:');
        for (const [key] of datiTemporanei.entries()) {
          console.log(`  - ${key}`);
        }
      }

      const datiSalvati = datiTemporanei.get(sessionId);

      if (!datiSalvati) {
        console.warn(`⚠️ Dati NON TROVATI per sessione: ${sessionId}`);
        console.warn('❗ ATTENZIONE: Su Vercel, i dati in memoria si perdono tra invocazioni diverse');
        console.warn('💡 Soluzione: Usa Vercel KV, Upstash Redis, o un database');
        
        return res.status(404).json({ 
          error: "Dati non trovati o scaduti",
          sessionId: sessionId,
          note: "Su Vercel, i dati in memoria possono essere persi tra invocazioni. Considera l'uso di Vercel KV o Redis per storage persistente."
        });
      }

      // Verifica TTL
      const ora = Date.now();
      const etaDati = ora - datiSalvati.timestamp;
      
      console.log(`⏰ Età dati: ${(etaDati / 1000).toFixed(0)} secondi`);
      console.log(`⏰ TTL rimanente: ${((datiSalvati.ttl - etaDati) / 1000).toFixed(0)} secondi`);
      
      if (etaDati > datiSalvati.ttl) {
        console.warn('⚠️ Dati scaduti');
        datiTemporanei.delete(sessionId);
        return res.status(404).json({ 
          error: "Dati scaduti",
          expiredAt: new Date(datiSalvati.timestamp + datiSalvati.ttl).toISOString()
        });
      }

      console.log(`✅ Dati recuperati con successo`);
      console.log(`📊 Ospiti: ${datiSalvati.dati.ospiti?.length || 0}`);
      console.log(`📄 Documenti: ${datiSalvati.dati.documenti?.length || 0}`);
      
      // Log documenti
      if (datiSalvati.dati.documenti?.length > 0) {
        datiSalvati.dati.documenti.forEach((doc, idx) => {
          console.log(`  📎 Doc ${idx + 1}:`, {
            ospite: doc.ospiteNumero,
            file: doc.nomeFile,
            size: `${(doc.dimensione / 1024).toFixed(2)} KB`,
            hasBase64: !!doc.base64
          });
        });
      }

      // Elimina i dati dopo il recupero (uso singolo)
      datiTemporanei.delete(sessionId);
      console.log('🗑️ Dati eliminati dalla memoria (uso singolo)');
      console.log('🔍 === FINE RECUPERO (SUCCESSO) ===\n');

      return res.status(200).json({ 
        success: true,
        datiPrenotazione: datiSalvati.dati,
        metadata: {
          salvataAlle: new Date(datiSalvati.timestamp).toISOString(),
          etaSecondi: (etaDati / 1000).toFixed(0)
        }
      });

    } catch (error) {
      console.error("❌ Errore recupero dati:", error);
      console.error("Stack trace:", error.stack);
      console.log('🔍 === FINE RECUPERO (ERRORE) ===\n');
      
      return res.status(500).json({ 
        error: "Errore interno: " + error.message 
      });
    }
  }

  return res.status(405).json({ 
    error: "Metodo non consentito",
    allowed: ["POST", "GET", "OPTIONS"]
  });
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
