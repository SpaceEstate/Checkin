import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Codici cassetta: letti SOLO qui, lato server, e restituiti solo dopo aver
// verificato che il pagamento sia "paid" (vedi sotto). Prima erano scritti in
// chiaro nel frontend pubblico — chiunque poteva leggerli senza pagare.
function determinaCodiciCassetta(appartamento) {
  const fallback = [{ codice: null, nome: 'N/A', descrizione: 'Codice non disponibile, contatta il proprietario' }];
  if (!appartamento) return fallback;

  const appartamentoLower = appartamento.toLowerCase();
  const codici = [];

  if (appartamentoLower.includes('corte')) {
    codici.push({
      codice: process.env.CODICE_CASSETTA_CORTE || null,
      nome: 'Corte',
      descrizione: 'Appartamento con 1 camera da letto'
    });
  }

  if (appartamentoLower.includes('torre')) {
    codici.push({
      codice: process.env.CODICE_CASSETTA_TORRE || null,
      nome: 'Torre',
      descrizione: 'Appartamento con 2 camere da letto'
    });
  }

  return codici.length > 0 ? codici : fallback;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // Gestione preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { session_id } = req.query;
    
    console.log("📡 Richiesta dati sessione:", session_id);

    if (!session_id) {
      return res.status(400).json({ error: "session_id mancante" });
    }

    // Verifica se è una sessione di test
    if (session_id.startsWith('test_session_')) {
      console.log("🧪 Sessione di test rilevata");
      
      // Ritorna dati fittizi per test
      const testData = {
        id: session_id,
        dataCheckin: new Date().toISOString().split('T')[0],
        appartamento: "Appartamento Test",
        numeroOspiti: "2",
        numeroNotti: "3", 
        totale: "9.00",
        status: "complete",
        codiciCassetta: determinaCodiciCassetta("Appartamento Test")
      };
      
      return res.status(200).json(testData);
    }

    // Recupera la sessione da Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    console.log("✅ Sessione Stripe recuperata:", {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status
    });

    // Verifica che il pagamento sia completato
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        error: "Pagamento non completato",
        status: session.payment_status 
      });
    }

    // Estrai i dati dai metadata
    const metadata = session.metadata || {};
    
    const sessionData = {
      id: session.id,
      dataCheckin: metadata.dataCheckin,
      appartamento: metadata.appartamento,
      numeroOspiti: metadata.numeroOspiti,
      numeroNotti: metadata.numeroNotti,
      tipoGruppo: metadata.tipoGruppo,
      totale: metadata.totale,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: (session.amount_total / 100).toFixed(2),
      // Calcolati qui, dopo la verifica payment_status === 'paid' sopra:
      // non arrivano mai al client prima che il pagamento sia confermato.
      codiciCassetta: determinaCodiciCassetta(metadata.appartamento),
      
      // Dati responsabile
      responsabile: {
        cognome: metadata.resp_cognome,
        nome: metadata.resp_nome,
        genere: metadata.resp_genere,
        nascita: metadata.resp_nascita,
        eta: metadata.resp_eta,
        cittadinanza: metadata.resp_cittadinanza,
        luogoNascita: metadata.resp_luogoNascita,
        comune: metadata.resp_comune,
        provincia: metadata.resp_provincia,
        tipoDocumento: metadata.resp_tipoDocumento,
        numeroDocumento: metadata.resp_numeroDocumento,
        luogoRilascio: metadata.resp_luogoRilascio
      }
    };

    // Deserializza altri ospiti se presenti
    if (metadata.altri_ospiti) {
      try {
        const altriOspiti = JSON.parse(metadata.altri_ospiti);
        sessionData.altriOspiti = altriOspiti.map(o => ({
          numero: o.n,
          cognome: o.c,
          nome: o.no,
          genere: o.g,
          nascita: o.na,
          eta: o.e,
          cittadinanza: o.ci,
          luogoNascita: o.ln,
          comune: o.co,
          provincia: o.p
        }));
      } catch (e) {
        console.warn("⚠️ Errore nel parsing altri_ospiti:", e);
      }
    }

    console.log("📤 Invio dati sessione processati");

    return res.status(200).json(sessionData);

  } catch (error) {
    console.error("❌ Errore nel recupero sessione:", error);
    
    // Gestisci errori specifici di Stripe
    if (error.code === 'resource_missing') {
      return res.status(404).json({ 
        error: "Sessione non trovata",
        message: "La sessione di pagamento non esiste o è scaduta"
      });
    }
    
    return res.status(500).json({ 
      error: "Errore interno del server",
      message: error.message 
    });
  }
}
