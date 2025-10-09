// api/salva-dati-temporanei.js
// VERSIONE CORRETTA per Redis con gestione CORS

import { createClient } from 'redis';

// Client Redis globale (riutilizzato tra invocazioni)
let redisClient = null;

async function getRedisClient() {
  // Se il client esiste ed è connesso, riutilizzalo
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL non configurato nelle variabili d'ambiente");
  }

  console.log('🔌 Creazione nuovo client Redis...');
  
  redisClient = createClient({
    url: redisUrl,
    socket: {
      tls: true,
      rejectUnauthorized: false,
      connectTimeout: 10000,
    },
  });

  redisClient.on("error", (err) => {
    console.error("❌ Redis Error:", err);
  });

  redisClient.on("connect", () => {
    console.log("✅ Redis connesso");
  });

  await redisClient.connect();
  return redisClient;
}

export default async function handler(req, res) {
  console.log(`📥 ${req.method} /api/salva-dati-temporanei`);
  console.log('📋 Origin:', req.headers.origin);
  console.log('📋 Headers:', Object.keys(req.headers));

  // ✅ CORS headers - SEMPRE per tutte le richieste
  // IMPORTANTE: Questi devono essere impostati PRIMA di qualsiasi altra operazione
  const origin = req.headers.origin || req.headers.referer || 'https://spaceestate.github.io';
  
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  // ✅ Gestione OPTIONS (preflight) - DEVE tornare 200
  if (req.method === "OPTIONS") {
    console.log('✅ Preflight OPTIONS - Risposta 200 OK');
    res.status(200).end();
    return;
  }

  try {
    // Connetti a Redis
    const client = await getRedisClient();

    // === POST: Salva dati ===
    if (req.method === "POST") {
      console.log('\n💾 === SALVATAGGIO DATI ===');
      
      const { sessionId, datiPrenotazione } = req.body;

      if (!sessionId || !datiPrenotazione) {
        console.error('❌ Dati mancanti');
        return res.status(400).json({ 
          error: "sessionId e datiPrenotazione richiesti" 
        });
      }

      console.log(`🔑 Session ID: ${sessionId}`);
      console.log(`📊 Ospiti: ${datiPrenotazione.ospiti?.length || 0}`);
      console.log(`📄 Documenti: ${datiPrenotazione.documenti?.length || 0}`);

      // Calcola dimensione documenti
      let totalSize = 0;
      if (datiPrenotazione.documenti) {
        totalSize = datiPrenotazione.documenti.reduce((acc, doc) => acc + (doc.dimensione || 0), 0);
        console.log(`💾 Dimensione totale: ${(totalSize / 1024).toFixed(2)} KB`);
      }

      const ttlSeconds = 3600; // 1 ora
      const dataToStore = {
        dati: datiPrenotazione,
        timestamp: Date.now(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      };

      // Salva su Redis con TTL
      await client.setEx(sessionId, ttlSeconds, JSON.stringify(dataToStore));

      console.log(`✅ Dati salvati su Redis`);
      console.log(`⏰ Scadenza: ${dataToStore.expiresAt}`);

      return res.status(200).json({
        success: true,
        message: "Dati salvati temporaneamente su Redis",
        sessionId: sessionId,
        details: {
          numeroOspiti: datiPrenotazione.ospiti?.length || 0,
          numeroDocumenti: datiPrenotazione.documenti?.length || 0,
          documentiSizeKB: (totalSize / 1024).toFixed(2),
          expiresAt: dataToStore.expiresAt,
          storage: 'Redis'
        }
      });
    }

    // === GET: Recupera dati ===
    if (req.method === "GET") {
      console.log('\n🔍 === RECUPERO DATI ===');
      
      const { sessionId } = req.query;

      if (!sessionId) {
        console.error('❌ sessionId mancante');
        return res.status(400).json({ 
          error: "sessionId richiesto",
          example: "/api/salva-dati-temporanei?sessionId=temp_xxx"
        });
      }

      console.log(`🔑 Recupero per: ${sessionId}`);

      const dataString = await client.get(sessionId);

      if (!dataString) {
        console.warn(`⚠️ Dati non trovati per: ${sessionId}`);
        return res.status(404).json({ 
          error: "Dati non trovati o scaduti",
          sessionId: sessionId
        });
      }

      const datiSalvati = JSON.parse(dataString);
      const eta = Date.now() - datiSalvati.timestamp;

      console.log(`✅ Dati recuperati (età: ${(eta / 1000).toFixed(0)}s)`);
      console.log(`📊 Ospiti: ${datiSalvati.dati.ospiti?.length || 0}`);
      console.log(`📄 Documenti: ${datiSalvati.dati.documenti?.length || 0}`);

      // Elimina dopo recupero (uso singolo)
      await client.del(sessionId);
      console.log('🗑️ Dati eliminati (uso singolo)');

      return res.status(200).json({
        success: true,
        datiPrenotazione: datiSalvati.dati,
        metadata: {
          salvataAlle: new Date(datiSalvati.timestamp).toISOString(),
          etaSecondi: (eta / 1000).toFixed(0),
          storage: 'Redis'
        }
      });
    }

    // Metodo non supportato
    return res.status(405).json({ 
      error: "Metodo non consentito",
      allowed: ["GET", "POST", "OPTIONS"]
    });

  } catch (error) {
    console.error('❌ Errore:', error);
    console.error('Stack:', error.stack);

    // Gestione errori Redis specifici
    if (error.message.includes('REDIS_URL')) {
      return res.status(500).json({
        error: "Configurazione Redis mancante",
        message: "REDIS_URL non configurato nelle variabili d'ambiente",
        help: "Aggiungi REDIS_URL su Vercel Dashboard → Settings → Environment Variables"
      });
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      return res.status(500).json({
        error: "Impossibile connettersi a Redis",
        message: error.message,
        help: "Verifica che il server Redis sia attivo e raggiungibile"
      });
    }

    return res.status(500).json({
      error: "Errore interno",
      message: error.message
    });
  }
}
