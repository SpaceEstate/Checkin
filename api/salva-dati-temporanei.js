// api/salva-dati-temporanei.js
// VERSIONE NEON POSTGRESQL - Sostituisce Redis

import postgres from 'postgres';

let sql = null;

// Connessione Neon PostgreSQL
async function getPostgresClient() {
  if (sql) return sql;
  
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL o POSTGRES_URL non configurato nelle variabili d'ambiente");
  }

  console.log('🔌 Creazione connessione Neon PostgreSQL...');
  
  sql = postgres(connectionString, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  console.log('✅ Connessione Neon PostgreSQL stabilita');
  return sql;
}

// Crea la tabella se non esiste
async function initDatabase() {
  const db = await getPostgresClient();
  
  await db`
    CREATE TABLE IF NOT EXISTS temporary_sessions (
      session_id VARCHAR(255) PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    )
  `;
  
  // Crea indice per pulizia automatica
  await db`
    CREATE INDEX IF NOT EXISTS idx_expires_at 
    ON temporary_sessions(expires_at)
  `;
  
  console.log('✅ Tabella temporary_sessions pronta');
}

// Pulizia sessioni scadute (opzionale, chiamata periodicamente)
async function cleanExpiredSessions() {
  const db = await getPostgresClient();
  
  const result = await db`
    DELETE FROM temporary_sessions 
    WHERE expires_at < NOW()
    RETURNING session_id
  `;
  
  if (result.length > 0) {
    console.log(`🗑️ Pulite ${result.length} sessioni scadute`);
  }
}

export default async function handler(req, res) {
  console.log(`📥 ${req.method} /api/salva-dati-temporanei`);

  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    console.log('✅ Preflight OPTIONS - Risposta 200 OK');
    return res.status(200).end();
  }

  try {
    const db = await getPostgresClient();
    await initDatabase();
    
    // Pulizia periodica (solo 10% delle volte per non rallentare)
    if (Math.random() < 0.1) {
      cleanExpiredSessions().catch(err => 
        console.warn('⚠️ Errore pulizia sessioni:', err.message)
      );
    }

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

      // PostgreSQL può gestire JSONB di grandi dimensioni, ma manteniamo un limite ragionevole
      const MAX_SIZE = 50 * 1024 * 1024; // 50 MB (molto più generoso di Redis)
      
      if (totalSize > MAX_SIZE) {
        console.error(`❌ Payload troppo grande: ${totalSizeMB} MB (max 50 MB)`);
        return res.status(413).json({
          error: "Payload too large",
          message: `I dati sono troppo grandi (${totalSizeMB} MB). Limite massimo: 50 MB.`,
          size: totalSize,
          maxSize: MAX_SIZE
        });
      }

      const ttlSeconds = 7200; // 2 ore
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      try {
        // Upsert (insert or update)
        await db`
          INSERT INTO temporary_sessions (session_id, data, expires_at)
          VALUES (${sessionId}, ${jsonString}::jsonb, ${expiresAt})
          ON CONFLICT (session_id) 
          DO UPDATE SET 
            data = ${jsonString}::jsonb,
            expires_at = ${expiresAt},
            created_at = NOW()
        `;

        console.log(`✅ Dati salvati su Neon PostgreSQL`);
        console.log(`⏰ Scadenza: ${expiresAt.toISOString()}`);

        return res.status(200).json({
          success: true,
          message: "Dati salvati temporaneamente su Neon PostgreSQL",
          sessionId: sessionId,
          details: {
            numeroOspiti: datiPrenotazione.ospiti?.length || 0,
            numeroDocumenti: datiPrenotazione.documenti?.length || 0,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            totalSizeMB: totalSizeMB,
            expiresAt: expiresAt.toISOString(),
            storage: 'Neon PostgreSQL',
            ttlSeconds: ttlSeconds
          }
        });
        
      } catch (error) {
        console.error('❌ Errore PostgreSQL:', error);
        console.error('Stack:', error.stack);
        
        return res.status(500).json({
          error: "Errore PostgreSQL",
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

      const result = await db`
        SELECT data, expires_at 
        FROM temporary_sessions 
        WHERE session_id = ${sessionId}
        AND expires_at > NOW()
        LIMIT 1
      `;

      if (result.length === 0) {
        console.warn(`⚠️ Dati non trovati o scaduti per: ${sessionId}`);
        return res.status(404).json({ 
          error: "Dati non trovati o scaduti",
          sessionId: sessionId
        });
      }

      const sessionData = result[0];
      const datiPrenotazione = sessionData.data;

      console.log(`✅ Dati recuperati con successo`);
      console.log(`📊 Struttura: ospiti=${datiPrenotazione.ospiti?.length || 0}, documenti=${datiPrenotazione.documenti?.length || 0}`);

      // Elimina dopo recupero (uso singolo)
      await db`
        DELETE FROM temporary_sessions 
        WHERE session_id = ${sessionId}
      `;
      console.log('🗑️ Dati eliminati (uso singolo)');

      return res.status(200).json({
        success: true,
        datiPrenotazione: datiPrenotazione,
        metadata: {
          salvataAlle: sessionData.created_at,
          scadenzaOriginale: sessionData.expires_at,
          storage: 'Neon PostgreSQL'
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

    if (error.message.includes('DATABASE_URL') || error.message.includes('POSTGRES_URL')) {
      return res.status(500).json({
        error: "Configurazione PostgreSQL mancante",
        message: "DATABASE_URL o POSTGRES_URL non configurato nelle variabili d'ambiente",
        help: "Aggiungi DATABASE_URL su Vercel Dashboard → Settings → Environment Variables"
      });
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      return res.status(500).json({
        error: "Impossibile connettersi a PostgreSQL",
        message: error.message,
        help: "Verifica che il database Neon sia attivo e raggiungibile"
      });
    }

    return res.status(500).json({
      error: "Errore interno",
      message: error.message
    });
  }
}
