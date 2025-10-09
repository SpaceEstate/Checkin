// api/test-cors.js
// API semplice per testare CORS

export default async function handler(req, res) {
  console.log('🧪 TEST CORS');
  console.log('Method:', req.method);
  console.log('Origin:', req.headers.origin);
  console.log('Headers:', req.headers);

  // Imposta CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Gestione preflight
  if (req.method === "OPTIONS") {
    console.log('✅ OPTIONS preflight - Risposta 200');
    return res.status(200).json({ message: "CORS OK" });
  }

  // Risposta normale
  return res.status(200).json({
    success: true,
    message: "✅ CORS funziona correttamente!",
    method: req.method,
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    headers: {
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
      'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods'),
      'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  });
}
