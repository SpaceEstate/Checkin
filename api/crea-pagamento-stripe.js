import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // 👉 Header CORS
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 👉 Gestione preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const dati = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Tassa soggiorno - ${dati.appartamento}`,
            },
            unit_amount: Math.round(dati.totale * 100), // centesimi
          },
          quantity: 1,
        },
      ],
      success_url: "https://spaceestate.github.io/checkin/checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://spaceestate.github.io/checkin/checkin/checkin.html",
    });

    res.status(200).json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("Errore Stripe:", error);
    res.status(500).json({ error: "Errore creazione sessione" });
  }
}
