// api/salva-dati-temporanei.js
// FIX: Parsing corretto dei dati Redis

import { createClient } from 'redis';

let redisClient = null;

async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.ciao_REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL non configurato nelle variabili d'ambiente");
  }

  console.log('🔌 Creazione nuovo client Redis...');
  
  const useTLS = redisUrl.startsWith('rediss://');
  
  redisClient = createClient({
    url: redisUrl,
    socket: {
      tls: useTLS,
      rejectUnauthorized: false,
      connectTimeout: 10000,
    },
  });

  redisClient.on("error", (err) => {
    console.error("❌ Redis Error:", err.message);
  });

  redisClient.on("connect", () => {
    console.log("✅ Redis connesso!");
  });

  redisClient.on("ready", () => {
    console.log("✅ Redis pronto!");
  });

  try {
    await redisClient.connect();
    console.log("✅ Connessione Redis stabilita");
    return redisClient;
  } catch (error) {
    console.error("❌ Errore connessione Redis:", error.message);
    throw error;
  }
}

export default async function handler(req, res) {
  console.log(`📥 ${req.method} /api/salva-dati-temporanei`);

  const origin = req.headers.origin || req.headers.referer || 'https://spaceestate.github.io';
  
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    console.log('✅ Preflight OPTIONS - Risposta 200 OK');
    res.status(200).end();
    return;
  }

  try {
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

      const jsonString = JSON.stringify(datiPrenotazione);
      const totalSize = jsonString.length;
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      
      console.log(`💾 Dimensione payload: ${totalSizeMB} MB (${totalSize} bytes)`);

      const MAX_REDIS_SIZE = 8 * 1024 * 1024;
      
      if (totalSize > MAX_REDIS_SIZE) {
        console.error(`❌ Payload troppo grande: ${totalSizeMB} MB (max 8 MB)`);
        return res.status(413).json({
          error: "Payload too large",
          message: `I dati sono troppo grandi (${totalSizeMB} MB). Riduci la dimensione delle immagini dei documenti.`,
          size: totalSize,
          maxSize: MAX_REDIS_SIZE
        });
      }

      let documentiSize = 0;
      if (datiPrenotazione.documenti) {
        documentiSize = datiPrenotazione.documenti.reduce((acc, doc) => {
          return acc + (doc.base64 ? doc.base64.length : 0);
        }, 0);
        console.log(`📎 Dimensione documenti: ${(documentiSize / 1024 / 1024).toFixed(2)} MB`);
      }

      const ttlSeconds = 7200; // 2 ore

      try {
        let retries = 3;
        let saved = false;
        
        while (retries > 0 && !saved) {
          try {
            await client.setEx(sessionId, ttlSeconds, jsonString);
            saved = true;
            console.log(`✅ Dati salvati su Redis (tentativo ${4 - retries})`);
          } catch (redisError) {
            retries--;
            console.warn(`⚠️ Errore Redis, retry... (${retries} tentativi rimasti)`, redisError.message);
            
            if (retries === 0) {
              throw redisError;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        console.log(`⏰ Scadenza: ${expiresAt}`);

        return res.status(200).json({
          success: true,
          message: "Dati salvati temporaneamente su Redis",
          sessionId: sessionId,
          details: {
            numeroOspiti: datiPrenotazione.ospiti?.length || 0,
            numeroDocumenti: datiPrenotazione.documenti?.length || 0,
            documentiSizeKB: (documentiSize / 1024).toFixed(2),
            totalSizeKB: (totalSize / 1024).toFixed(2),
            totalSizeMB: totalSizeMB,
            expiresAt: expiresAt,
            storage: 'Redis',
            ttlSeconds: ttlSeconds
          }
        });
        
      } catch (error) {
        console.error('❌ Errore Redis:', error);
        console.error('Stack:', error.stack);
        
        return res.status(500).json({
          error: "Errore Redis",
          message: error.message,
          hint: "Il server di storage potrebbe essere sovraccarico. Riprova tra qualche secondo."
        });
      }
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

      // ✅ FIX: Parsing diretto - i dati sono già l'oggetto completo
      let datiPrenotazione;
      try {
        datiPrenotazione = JSON.parse(dataString);
      } catch (parseError) {
        console.error('❌ Errore parsing JSON:', parseError);
        return res.status(500).json({
          error: "Dati corrotti",
          message: "Impossibile leggere i dati salvati"
        });
      }

      // ✅ VERIFICA: Controlla che i dati abbiano i campi essenziali
      if (!datiPrenotazione || typeof datiPrenotazione !== 'object') {
        console.error('❌ Struttura dati non valida');
        return res.status(500).json({
          error: "Struttura dati non valida",
          message: "I dati recuperati non hanno il formato corretto"
        });
      }

      console.log(`✅ Dati recuperati con successo`);
      console.log(`📊 Struttura: ospiti=${datiPrenotazione.ospiti?.length || 0}, documenti=${datiPrenotazione.documenti?.length || 0}`);

      // Elimina dopo recupero (uso singolo)
      await client.del(sessionId);
      console.log('🗑️ Dati eliminati (uso singolo)');

      return res.status(200).json({
        success: true,
        datiPrenotazione: datiPrenotazione, // ✅ Ritorna direttamente l'oggetto
        metadata: {
          salvataAlle: new Date().toISOString(),
          storage: 'Redis'
        }
      });
    }

    return res.status(405).json({ 
      error: "Metodo non consentito",
      allowed: ["GET", "POST", "OPTIONS"]
    });

  } catch (error) {
    console.error('❌ Errore:', error);
    console.error('Stack:', error.stack);

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
