import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Età a partire dalla data di nascita — stessa logica di calcolaEta() in checkin.js
function calcolaEtaServer(dataNascita) {
  if (!dataNascita) return 0;
  const nascita = new Date(dataNascita);
  if (isNaN(nascita.getTime())) return 0;
  const oggi = new Date();
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const meseCompleanno = oggi.getMonth() - nascita.getMonth();
  if (meseCompleanno < 0 || (meseCompleanno === 0 && oggi.getDate() < nascita.getDate())) {
    eta--;
  }
  return Math.max(0, eta);
}

// Ricalcola il totale — stessa regola di calcolaTotale() in checkin.js:
// €1,50 a notte per ogni ospite di almeno 4 anni.
//
// IMPORTANTE: questo è il valore che va usato per l'addebito. Il campo "totale"
// che arriva dal client va nella richiesta POST insieme al resto dei dati, quindi
// chiunque può modificarlo (es. dagli strumenti sviluppatore del browser) prima
// dell'invio. In precedenza veniva passato direttamente a Stripe come
// unit_amount: bastava cambiare quel numero per pagare qualsiasi cifra,
// indipendentemente da ospiti/notti reali.
function calcolaTotaleServer(ospiti, numeroNotti) {
  const notti = parseInt(numeroNotti, 10) || 0;
  const TASSA_PER_NOTTE = 1.50;
  const ospitiSoggetti = (ospiti || []).filter(o => calcolaEtaServer(o?.nascita) >= 4).length;
  return Math.round(ospitiSoggetti * notti * TASSA_PER_NOTTE * 100) / 100;
}

// Dopo il pagamento (o l'annullamento) Stripe riporta l'ospite all'indirizzo ricevuto dal browser. Si accettano solo gli indirizzi
// del check-in (GitHub Pages e Vercel): senza questo controllo chiunque potrebbe creare una sessione che rimanda a un sito qualsiasi.
const PREFISSI_URL_AMMESSI = ["https://spaceestate.github.io/Checkin/", "https://checkin-six-coral.vercel.app/"];
export const urlAmmesso = u => typeof u === "string" && u.length <= 2000 && PREFISSI_URL_AMMESSI.some(p => u.startsWith(p));

// Numero della prenotazione verificata nel primo passo (com'è nel foglio: lettere, cifre, al più un trattino). Non è un dato anagrafico:
// collega il pagamento alla prenotazione, così il sito di La Columbera (stesso account Stripe) sa che il check-in è fatto. Altro = niente.
export const numeroPrenotazioneValido = v => {
  const n = typeof v === "string" || typeof v === "number" ? String(v).trim().toUpperCase().replace(/\s+/g, "") : "";
  return /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(n) ? n : "";
};

// `stripe` è un parametro per poterlo sostituire nei test (nessuna chiamata reale a Stripe)
async function gestisciRichiesta(stripe, req, res) {
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
      numeroPrenotazione, // solo se l'ospite ha verificato la prenotazione nel primo passo
      lingua, // Lingua scelta dall'ospite nel form (it/en/de): guida la lingua
              // della pagina di pagamento Stripe e, più avanti, dell'email di
              // benvenuto. Non tocca il TXT Alloggiati né l'email al gestore.
      successUrl,
      cancelUrl
    } = req.body;

    const LINGUE_VALIDE = ['it', 'en', 'de'];
    const linguaOspite = LINGUE_VALIDE.includes(lingua) ? lingua : 'it';

    // Validazione dati essenziali (il totale non è più tra i campi richiesti dal
    // client: si calcola qui sotto e quel valore, non il suo, è quello usato)
    if (!dataCheckin || !appartamento || !numeroOspiti || !ospiti.length) {
      return res.status(400).json({ 
        error: "Dati mancanti",
        details: "dataCheckin, appartamento, numeroOspiti e ospiti sono obbligatori"
      });
    }

    // Trova il responsabile
    const responsabile = ospiti.find(o => o.numero === 1 || o.isResponsabile);
    if (!responsabile) {
      return res.status(400).json({ error: "Dati del responsabile mancanti" });
    }

    // ⚠️ SICUREZZA: totale ricalcolato qui, MAI usato quello ricevuto dal client
    // per l'addebito effettivo (vedi calcolaTotaleServer sopra).
    const totaleServer = calcolaTotaleServer(ospiti, numeroNotti);

    if (totaleServer <= 0) {
      return res.status(400).json({
        error: "Importo non valido",
        details: "Il totale calcolato è zero: verifica il numero di notti e le date di nascita degli ospiti"
      });
    }

    if (typeof totale === "number" && Math.abs(totale - totaleServer) > 0.01) {
      console.warn("⚠️ Totale ricevuto dal client diverso da quello ricalcolato dal server", {
        totaleClient: totale,
        totaleServer
      });
    }

    console.log("📋 Dati validati:", {
      numeroOspiti,
      totale: totaleServer,
      tempSessionId: tempSessionId ? 'presente' : 'assente'
    });

    // Metadata MINIMI: solo identificativi tecnici e dati del soggiorno necessari a collegare pagamento e check-in
    // (adeguamento GDPR). NON si inviano a Stripe nome, cognome, sesso, data/luogo di nascita, cittadinanza né estremi
    // del documento: prima finivano qui (resp_*) e restavano nei metadati della sessione Stripe. I dati degli ospiti
    // restano solo nei dati temporanei collegati da temp_session_id, cancellati dopo l'elaborazione (_elabora-checkin.js).
    const numero = numeroPrenotazioneValido(numeroPrenotazione);
    const metadata = {
      numeroPrenotazione: numero,
      dataCheckin,
      appartamento: appartamento.substring(0, 490), // Max 490 per sicurezza
      numeroOspiti: numeroOspiti.toString(),
      numeroNotti: numeroNotti.toString(),
      tipoGruppo: tipoGruppo || '',
      totale: totaleServer.toString(),
      timestamp: timestamp || new Date().toISOString(),
      lingua: linguaOspite,
      temp_session_id: tempSessionId || ''
    };

    // Rimuovi campi vuoti per risparmiare spazio
    Object.keys(metadata).forEach(key => {
      if (!metadata[key] || metadata[key] === 'undefined') {
        delete metadata[key];
      }
    });

    console.log("💳 Creazione sessione Stripe...");
    console.log("📏 Metadata size:", JSON.stringify(metadata).length, "chars");

    const finalSuccessUrl = urlAmmesso(successUrl) ? successUrl : "https://spaceestate.github.io/Checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}";
    const finalCancelUrl = urlAmmesso(cancelUrl) ? cancelUrl : "https://spaceestate.github.io/Checkin/index.html?canceled=true";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: responsabile.email || undefined,
      locale: linguaOspite, // Stripe accetta 'it' | 'en' | 'de' come codici di locale diretti
      billing_address_collection: 'auto',
      
      payment_intent_data: {
        description: `Tassa soggiorno - ${appartamento.substring(0, 100)}`,
        metadata: Object.assign({
          dataCheckin: dataCheckin,
          appartamento: appartamento.substring(0, 490)
        }, numero ? { numeroPrenotazione: numero } : {})
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
            unit_amount: Math.round(totaleServer * 100),
          },
          quantity: 1,
        },
      ],
      
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: metadata, // ✅ Metadata compatti (< 500 caratteri)
      
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minuti
    });

    console.log("✅ Sessione creata:", session.id);

    return res.status(200).json({ 
      checkoutUrl: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error("❌ Errore creazione sessione:", error && (error.type || error.code || error.name) || 'errore');
    return res.status(500).json({ 
      error: "Errore creazione sessione"
    });
  }
}

export const makeHandler = client => (req, res) => gestisciRichiesta(client, req, res);
export default makeHandler(stripe);
