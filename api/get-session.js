import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // 👉 Header CORS
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 👉 Gestione preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: "Session ID mancante" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    res.status(200).json(session);
  } catch (error) {
    console.error("Errore recupero sessione Stripe:", error);
    res.status(500).json({ error: "Errore nel recupero della sessione" });
  }
}
