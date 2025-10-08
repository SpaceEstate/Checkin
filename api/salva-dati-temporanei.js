// api/salva-dati-temporanei.js
import { createClient } from 'redis';

// Variabile globale per riutilizzare la connessione Redis
let redisClient = null;

// Funzione per ottenere la connessione Redis
async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (!redisUrl) throw new Error("REDIS_URL o KV_URL non configurato nelle variabili d'ambiente");

  redisClient = createClient({
    url: redisUrl,
    socket: {
      tls: true,
      rejectUnauthorized: false
    }
  });

  redisClient.on('error', (err) => console.error('Redis Client Error:', err));

  await redisClient.connect();
  console.log('✅ Redis connesso');
  return redisClient;
}

export default async function handler(req, res) {
  // ✅ CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // ✅ Gestione preflight OPTIONS
  if (req.method === "OPTIONS") {
    console.log('✅ Preflight OPTIONS handled');
    return res.status(200).end();
  }

  const client = await getRedisClient();

  // === SALVATAGGIO DATI (POST) ===
  if (req.method === "POST") {
    try {
      const { sessionId, datiPrenotazione } = req.body;

      if (!sessionId) {
        console.error('❌ sessionId mancante');
        return res.status(400).json({ error: "sessionId è obbligatorio" });
      }

      if (!datiPrenotazione) {
        console.error('❌ datiPrenotazione mancanti');
        return res.status(400).json({ error: "datiPrenotazione sono obbligatori" });
      }

      // Log dettagliato
      console.log(`🔑 Session ID: ${sessionId}`);
      console.log(`📊 Numero ospiti: ${datiPrenotazione.ospiti?.length || 0}`);
      console.log(`📄 Numero documenti: ${datiPrenotazione.documenti?.length || 0}`);

      let documentiSize = 0;
      if (datiPrenotazione.documenti) {
        documentiSize = datiPrenotazione.documenti.reduce((acc, doc) => acc + (doc.dimensione || 0), 0);
        console.log(`💾 Dimensione totale documenti: ${(documentiSize / 1024).toFixed(2)} KB`);
      }

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

      // Salvataggio su Redis con TTL 1 ora
      const ttlSeconds = 3600;
      const timestamp = Date.now();
      const dataToStore = {
        dati: datiPrenotazione,
        timestamp,
        expiresAt: new Date(timestamp + (ttlSeconds * 1000)).toISOString()
      };

      await client.setEx(sessionId, ttlSeconds, JSON.stringify(dataToStore));

      console.log('✅ Dati salvati su Redis con successo');
      return res.status(200).json({
        success: true,
        message: "Dati salvati temporaneamente su Redis",
        sessionId,
        details: {
          numeroOspiti: datiPrenotazione.ospiti?.length || 0,
          numeroDocumenti: datiPrenotazione.documenti?.length || 0,
          documentiSizeKB: (documentiSize / 1024).toFixed(2),
          expiresAt: dataToStore.expiresAt,
          storage: 'Redis'
        }
      });

    } catch (error) {
      console.error("❌ Errore salvataggio dati:", error);
      return res.status(500).json({ error: "Errore interno: " + error.message });
    }
  }

  // === RECUPERO DATI (GET) ===
  if (req.method === "GET") {
    try {
      const { sessionId } = req.query;
      if (!sessionId) return res.status(400).json({ error: "sessionId mancante" });

      const dataString = await client.get(sessionId);
      if (!dataString) return res.status(404).json({ error: "Dati non trovati o scaduti" });

      const datiSalvati = JSON.parse(dataString);
      const etaDati = Date.now() - datiSalvati.timestamp;

      // Elimina dati dopo il recupero
      await client.del(sessionId);

      console.log('✅ Dati recuperati con successo');
      return res.status(200).json({
        success: true,
        datiPrenotazione: datiSalvati.dati,
        metadata: {
          salvataAlle: new Date(datiSalvati.timestamp).toISOString(),
          etaSecondi: (etaDati / 1000).toFixed(0),
          storage: 'Redis'
        }
      });

    } catch (error) {
      console.error("❌ Errore recupero dati:", error);
      return res.status(500).json({ error: "Errore interno: " + error.message });
    }
  }

  // Metodo non consentito
  return res.status(405).json({ error: "Metodo non consentito", allowed: ["POST","GET","OPTIONS"] });
}
