import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // 🔹 Estraggo i dati dal body del form
    const {
      checkin_date,
      apartment,
      nights,
      group_type,
      // ospite principale
      last_name,
      first_name,
      gender,
      birth_date,
      state,
      city,
      province,
      nationality,
      document_type,
      document_number,
      document_state,
      // altri ospiti come array di oggetti
      other_guests = [],
    } = req.body;

    // 🔹 Serializzo gli altri ospiti in JSON
    const otherGuestsJSON = JSON.stringify(other_guests);

    // 🔹 Creo la sessione di pagamento
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Prenotazione ${apartment}`,
            },
            unit_amount: 10000, // prezzo in centesimi (100€ esempio)
          },
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin}/success`,
      cancel_url: `${req.headers.origin}/cancel`,

      // 🔑 Metadata con tutti i dati del check-in
      metadata: {
        checkin_date,
        apartment,
        nights,
        group_type,
        last_name,
        first_name,
        gender,
        birth_date,
        state,
        city,
        province,
        nationality,
        document_type,
        document_number,
        document_state,
        other_guests: otherGuestsJSON, // JSON string
      },
    });

    // 🔹 Ritorno al frontend la sessione
    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error("❌ Errore Stripe:", error);
    res.status(500).json({ error: error.message });
  }
}
