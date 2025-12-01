import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
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
      timestamp,
      tempSessionId, // ✅ ID sessione temporanea per recuperare documenti
      successUrl,
      cancelUrl
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
      responsabile: `${responsabile.nome} ${responsabile.cognome}`,
      tempSessionId: tempSessionId || 'N/A'
    });

    // ✅ SOLUZIONE: Metadata MINIMI (solo info essenziali)
    const metadata = {
      dataCheckin,
      appartamento: appartamento.substring(0, 490),
      numeroOspiti: numeroOspiti.toString(),
      numeroNotti: numeroNotti.toString(),
      tipoGruppo: tipoGruppo || '',
      totale: totale.toString(),
      timestamp: timestamp || new Date().toISOString(),
      
      // ⭐ CHIAVE: Salva solo il temp_session_id
      temp_session_id: tempSessionId || '',
      
      // Dati responsabile (compatti)
      resp_cognome: responsabile.cognome || '',
      resp_nome: responsabile.nome || '',
      resp_genere: responsabile.genere || '',
      resp_nascita: responsabile.nascita || '',
      resp_eta: responsabile.eta ? responsabile.eta.toString() : '',
      resp_cittadinanza: responsabile.cittadinanza || '',
      resp_luogoNascita: responsabile.luogoNascita || '',
      
      // ❌ RIMOSSO: altri_ospiti (troppo grande)
      // Verranno recuperati da Redis nel webhook usando temp_session_id
    };

    // Rimuovi campi vuoti
    Object.keys(metadata).forEach(key => {
      if (!metadata[key] || metadata[key] === 'undefined') {
        delete metadata[key];
      }
    });

    console.log("💳 Creazione sessione Stripe...");
    console.log("🔑 Metadata temp_session_id:", metadata.temp_session_id);
    console.log("📏 Metadata size:", JSON.stringify(metadata).length, "chars");

    const finalSuccessUrl = successUrl || "https://spaceestate.github.io/checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}";
    const finalCancelUrl = cancelUrl || "https://spaceestate.github.io/checkin/index.html?canceled=true";

    const session = await stripe.checkout.sessions.create({
      payment_intent_data: {
        description: `Tassa soggiorno - ${appartamento.substring(0, 100)}`,
        metadata: {
          dataCheckin: dataCheckin,
          appartamento: appartamento.substring(0, 490)
        }
      },
      
      allow_promotion_codes: false,
      
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Tassa soggiorno - ${appartamento}`,
              description: `Check-in: ${dataCheckin} | Ospiti: ${numeroOspiti} | Notti: ${numeroNotti}`,
            },
            unit_amount: Math.round(totale * 100),
          },
          quantity: 1,
        },
      ],
      
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: metadata,
      
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minuti
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
}_method_types: ["card"],
      mode: "payment",
      customer_email: responsabile.email || undefined,
      locale: 'it',
      billing_address_collection: 'auto',
      
      payment
