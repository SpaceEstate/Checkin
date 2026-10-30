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

// Pagamento nella pagina del check-in (come sul sito di La Columbera): i campi della carta di Stripe dentro il modulo, con lo stile del sito.
// Serve la chiave pubblicabile STRIPE_PUBLISHABLE_KEY su Vercel, dello stesso tipo della chiave segreta (prova con prova, reale con reale).
// Senza, con un formato sbagliato o di tipo diverso si paga sulla pagina di Stripe, come prima. stato: ok | manca | formato | tipo.
export function chiavePubblicabile(env = process.env) {
  const pk = String(env.STRIPE_PUBLISHABLE_KEY || '').trim(), tipo = k => (/^[spr]k_(live|test)/.exec(k) || [])[1] || '';
  if (!pk) return { pk: '', stato: 'manca' };
  if (!/^pk_(live|test)_\w+$/.test(pk)) return { pk: '', stato: 'formato' };
  const ts = tipo(String(env.STRIPE_SECRET_KEY || '').trim());
  return ts && ts !== tipo(pk) ? { pk: '', stato: 'tipo' } : { pk, stato: 'ok' };
}
// I campi della carta nella pagina (Checkout Sessions con ui_mode «elements») esistono dalla versione 2026-08-26.dahlia delle API, la stessa del sito
// di La Columbera. La libreria di questo progetto usa una versione più vecchia: la nuova si chiede SOLO per creare queste sessioni, tutto il resto
// (webhook, get-session, pagina di Stripe) resta com'era.
export const VERSIONE_API_NELLA_PAGINA = '2026-08-26.dahlia';

// `stripe` è un parametro per poterlo sostituire nei test (nessuna chiamata reale a Stripe)
async function gestisciRichiesta(stripe, req, res, env = process.env) {
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
      cancelUrl,
      ui // 'elements' = il modulo chiede i campi della carta nella pagina (vedi chiavePubblicabile)
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

    const pk = ui === 'elements' ? chiavePubblicabile(env).pk : '';
    const lineItems = [
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
    ];
    const paymentIntentData = {
      description: `Tassa soggiorno - ${appartamento.substring(0, 100)}`,
      metadata: Object.assign({
        dataCheckin: dataCheckin,
        appartamento: appartamento.substring(0, 490)
      }, numero ? { numeroPrenotazione: numero } : {})
    };

    if (pk) {
      // Nella pagina: stessi importi, metadati e durata; niente success_url / cancel_url (non ammessi): il modulo resta aperto e, a pagamento
      // riuscito, porta da sé alla pagina di successo. return_url serve solo se la banca chiede una conferma su un'altra pagina.
      // La lingua dei campi la decide la pagina (Stripe.js), non la sessione.
      const nellaPagina = await stripe.checkout.sessions.create({
        ui_mode: "elements",
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: responsabile.email || undefined,
        billing_address_collection: 'auto',
        payment_intent_data: paymentIntentData,
        line_items: lineItems,
        return_url: finalSuccessUrl,
        metadata: metadata,
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minuti
      }, { apiVersion: VERSIONE_API_NELLA_PAGINA });
      console.log("✅ Sessione (nella pagina) creata:", nellaPagina.id);
      return res.status(200).json({
        clientSecret: nellaPagina.client_secret,
        publishableKey: pk,
        sessionId: nellaPagina.id,
        totale: totaleServer
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: responsabile.email || undefined,
      locale: linguaOspite, // Stripe accetta 'it' | 'en' | 'de' come codici di locale diretti
      billing_address_collection: 'auto',
      
      payment_intent_data: paymentIntentData,
      
      allow_promotion_codes: false,
      
      line_items: lineItems,
      
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

export const makeHandler = (client, env) => (req, res) => gestisciRichiesta(client, req, res, env || process.env);
export default makeHandler(stripe);
