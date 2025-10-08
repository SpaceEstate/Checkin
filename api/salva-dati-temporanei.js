// api/salva-dati-temporanei.js
// VERSIONE CON REDIS
export default async function handler(req, res) {
  // ✅ CORS Headers SEMPRE per TUTTE le richieste
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  
  // ✅ Gestione preflight OPTIONS
  if (req.method === "OPTIONS") {
    console.log('✅ Preflight OPTIONS handled');
    res.status(200).end();
    return;
  }
import { createClient } from 'redis';

// Variabile globale per riutilizzare la connessione
let redisClient = null;

async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  
  if (!redisUrl) {
    throw new Error('REDIS_URL o KV_URL non configurato nelle variabili d\'ambiente');
  }

  redisClient = createClient({
    url: redisUrl,
    socket: {
      tls: true,
      rejectUnauthorized: false
    }
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  await redisClient.connect();
  console.log('✅ Redis connesso');
  
  return redisClient;
}



  // === SALVATAGGIO DATI (POST) ===
  if (req.method === "POST") {
    let client = null;
    
    try {
      console.log('\n💾 === INIZIO SALVATAGGIO DATI (REDIS) ===');
      
      const { sessionId, datiPrenotazione } = req.body;

      // Validazione input
      if (!sessionId) {
        console.error('❌ sessionId mancante');
        return res.status(400).json({ 
          error: "sessionId è obbligatorio"
        });
      }

      if (!datiPrenotazione) {
        console.error('❌ datiPrenotazione mancanti');
        return res.status(400).json({ 
          error: "datiPrenotazione sono obbligatori"
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

      // Connessione a Redis
      client = await getRedisClient();

      // Salva su Redis con TTL di 1 ora (3600 secondi)
      const ttlSeconds = 3600;
      const timestamp = Date.now();
      
      const dataToStore = {
        dati: datiPrenotazione,
        timestamp: timestamp,
        expiresAt: new Date(timestamp + (ttlSeconds * 1000)).toISOString()
      };
      
      await client.setEx(sessionId, ttlSeconds, JSON.stringify(dataToStore));

      console.log(`✅ Dati salvati su Redis con successo`);
      console.log(`⏰ Scadenza: ${dataToStore.expiresAt}`);
      console.log('💾 === FINE SALVATAGGIO ===\n');

      return res.status(200).json({ 
        success: true,
        message: "Dati salvati temporaneamente su Redis",
        sessionId: sessionId,
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
      console.error("Stack trace:", error.stack);
      return res.status(500).json({ 
        error: "Errore interno: " + error.message 
      });
    }
  }

  // === RECUPERO DATI (GET) ===
  if (req.method === "GET") {
    let client = null;
    
    try {
      console.log('\n🔍 === INIZIO RECUPERO DATI (REDIS) ===');
      
      const { sessionId } = req.query;

      if (!sessionId) {
        console.error('❌ sessionId mancante nella query');
        return res.status(400).json({ 
          error: "sessionId mancante",
          example: "/api/salva-dati-temporanei?sessionId=temp_xxx"
        });
      }

      console.log(`🔑 Richiesta recupero per: ${sessionId}`);

      // Connessione a Redis
      client = await getRedisClient();

      // Recupera da Redis
      const dataString = await client.get(sessionId);

      if (!dataString) {
        console.warn(`⚠️ Dati NON TROVATI per sessione: ${sessionId}`);
        
        return res.status(404).json({ 
          error: "Dati non trovati o scaduti",
          sessionId: sessionId,
          storage: 'Redis'
        });
      }

      // Parse dei dati
      const datiSalvati = JSON.parse(dataString);

      // Verifica età dati
      const ora = Date.now();
      const etaDati = ora - datiSalvati.timestamp;
      
      console.log(`⏰ Età dati: ${(etaDati / 1000).toFixed(0)} secondi`);
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
      await client.del(sessionId);
      console.log('🗑️ Dati eliminati da Redis (uso singolo)');
      console.log('🔍 === FINE RECUPERO (SUCCESSO) ===\n');

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
