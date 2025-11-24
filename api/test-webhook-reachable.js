// api/test-webhook-reachable.js
export default async function handler(req, res) {
  console.log('🧪 Test webhook ricevuto');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  
  return res.status(200).json({
    success: true,
    message: 'Webhook endpoint raggiungibile',
    timestamp: new Date().toISOString()
  });
}
