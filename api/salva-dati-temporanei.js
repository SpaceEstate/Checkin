// api/salva-dati-temporanei.js
import { createClient } from 'redis';

let redisClient = null;
 
async function getRedisClient() {
  if (redisClient && redisClient.isOpen) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL non configurato");

  redisClient = createClient({
    url: redisUrl,
    socket: { tls: true, rejectUnauthorized: false },
  });

  redisClient.on("error", (err) => console.error("Redis Error:", err));

  await redisClient.connect();
  console.log("✅ Redis connesso");
  return redisClient;
}

export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  // ✅ Preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const client = await getRedisClient();

  // === POST: salva dati ===
  if (req.method === "POST") {
    const { sessionId, datiPrenotazione } = req.body;
    if (!sessionId || !datiPrenotazione)
      return res.status(400).json({ error: "sessionId e datiPrenotazione richiesti" });

    const ttlSeconds = 3600;
    const dataToStore = { dati: datiPrenotazione, timestamp: Date.now() };

    await client.setEx(sessionId, ttlSeconds, JSON.stringify(dataToStore));

    return res.status(200).json({
      success: true,
      message: "Dati salvati temporaneamente su Redis",
      sessionId,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    });
  }

  // === GET: recupera dati ===
  if (req.method === "GET") {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "sessionId richiesto" });

    const dataString = await client.get(sessionId);
    if (!dataString) return res.status(404).json({ error: "Dati non trovati o scaduti" });

    const datiSalvati = JSON.parse(dataString);
    await client.del(sessionId); // uso singolo

    return res.status(200).json({ success: true, datiPrenotazione: datiSalvati.dati });
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
