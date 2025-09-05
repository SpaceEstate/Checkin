import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // Gestione preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    console.log("📥 Ricevuto request per pagamento");
    
    const {
      dataCheckin,
      appartamento,
      numeroOspiti,
      numeroNotti,
      tipoGruppo,
      totale,
      ospiti = [],
      timestamp
    } = req.body;

    // Validazione dati essenziali
    if (!dataCheckin || !appartamento || !numeroOspiti || !ospiti.length || !totale) {
      return res.status(400).json({ 
        error: "Dati mancanti",
        details: "dataCheckin, appartamento, numeroOspiti, ospiti e totale sono obbligatori"
      });
    }

    // Trova il responsabile
    const responsabile = ospiti.find(o => o.numero === 1 || o.isResponsabile);
    if (!responsabile) {
      return res.status(400).json({ error: "Dati del responsabile mancanti" });
    }

    console.log("📋 Dati validati:", {
      dataCheckin,
      appartamento,
      numeroOspiti,
      totale,
      responsabile: `${responsabile.nome} ${responsabile.cognome}`
    });

    // Prepara metadata per Stripe
    const metadata = {
      dataCheckin,
      appartamento: appartamento.substring(0, 490),
      numeroOspiti: numeroOspiti.toString(),
      numeroNotti: numeroNotti.toString(),
      tipoGruppo: tipoGruppo || '',
      totale: totale.toString(),
      timestamp: timestamp || new Date().toISOString(),
      
      // Dati responsabile
      resp_cognome: responsabile.cognome || '',
      resp_nome: responsabile.nome || '',
      resp_genere: responsabile.genere || '',
      resp_nascita: responsabile.nascita || '',
      resp_eta: responsabile.eta ? responsabile.eta.toString() : '',
      resp_cittadinanza: responsabile.cittadinanza || '',
      resp_luogoNascita: responsabile.luogoNascita || '',
      resp_comune: responsabile.comune || '',
      resp_provincia: responsabile.provincia || '',
      resp_tipoDocumento: responsabile.tipoDocumento || '',
      resp_numeroDocumento: responsabile.numeroDocumento || '',
      resp_luogoRilascio: responsabile.luogoRilascio || '',
    };

    // Serializza altri ospiti
    const altriOspiti = ospiti.filter(o => o.numero !== 1 && !o.isResponsabile);
    if (altriOspiti.length > 0) {
      const ospitiCompatti = altriOspiti.map(o => ({
        n: o.numero,
        c: o.cognome,
        no: o.nome,
        g: o.genere,
        na: o.nascita,
        e: o.eta,
        ci: o.cittadinanza,
        ln: o.luogoNascita,
        co: o.comune || '',
        p: o.provincia || ''
      }));
      
      metadata.altri_ospiti = JSON.stringify(ospitiCompatti);
    }

    // Rimuovi campi vuoti
    Object.keys(metadata).forEach(key => {
      if (!metadata[key] || metadata[key] === 'undefined') {
        delete metadata[key];
      }
    });

    console.log("💳 Creazione sessione Stripe...");

    // Crea la sessione di pagamento con URL CORRETTE
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Tassa soggiorno - ${appartamento}`,
              description: `Check-in: ${dataCheckin} | Ospiti: ${numeroOspiti} | Notti: ${numeroNotti}`
            },
            unit_amount: Math.round(totale * 100),
          },
          quantity: 1,
        },
      ],
      // ✅ URL CORRETTE - puntano ai file che esistono veramente
      success_url: "https://spaceestate.github.io/checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://spaceestate.github.io/checkin/index.html?canceled=true",
      metadata: metadata,
    });

    console.log("✅ Sessione creata:", session.id);

    return res.status(200).json({ 
      checkoutUrl: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error("❌ Errore creazione sessione:", error);
    return res.status(500).json({ 
      error: "Errore creazione sessione",
      message: error.message 
    });
  }
}
