import Stripe from "stripe";
import { leggiRighePrenotazioni, trovaPerDataEAppartamento, cercaPrenotazione } from "./verifica-prenotazione.js";
import { eSoggettoImposta, totaleImposta } from "./_imposta-soggiorno.js";

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

// Ricalcola il totale — stessa regola di calcolaTotale() in checkin.js (e di _imposta-soggiorno.js):
// €1,50 a notte per ogni ospite di almeno 14 anni (i minori di 14 anni sono esenti), per al massimo 10 notti.
// Dal 14/11/2026 (conferma del titolare, imposta provinciale del Trentino); prima: dai 4 anni, senza tetto di notti.
//
// IMPORTANTE: questo è il valore che va usato per l'addebito. Il campo "totale"
// che arriva dal client va nella richiesta POST insieme al resto dei dati, quindi
// chiunque può modificarlo (es. dagli strumenti sviluppatore del browser) prima
// dell'invio. In precedenza veniva passato direttamente a Stripe come
// unit_amount: bastava cambiare quel numero per pagare qualsiasi cifra,
// indipendentemente da ospiti/notti reali.
function calcolaTotaleServer(ospiti, numeroNotti) {
  const ospitiSoggetti = (ospiti || []).filter(o => eSoggettoImposta(calcolaEtaServer(o?.nascita))).length;
  return totaleImposta(ospitiSoggetti, numeroNotti);
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

// Righe del foglio Prenotazioni per questa richiesta (lette una volta sola, al massimo 5 secondi). null se il foglio non è configurato, non
// risponde o dà errore: chi le usa prosegue come se il foglio non ci fosse, il pagamento non si blocca mai per il foglio.
function righePrenotazioni(env) {
  let promessa = null;
  return () => promessa || (promessa = (async () => {
    if (!(env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY && (env.SHEET_ID_PRENOTAZIONI || env.SHEET_ID))) return null;      // foglio non configurato
    let timer;
    const tempo = new Promise(ok => { timer = setTimeout(() => ok(null), 5000); });
    try { return (await Promise.race([leggiRighePrenotazioni(env), tempo])) || null; }
    catch (e) { console.warn('foglio prenotazioni non letto: ' + (e && (e.code || e.name) || 'errore')); return null; }
    finally { clearTimeout(timer); }
  })());
}

// Check-in senza numero («Non ho il numero di prenotazione»): il numero si cerca nel foglio Prenotazioni per data di arrivo e appartamento
// (trovaPerDataEAppartamento). Se il foglio non risponde si paga lo stesso, senza numero.
async function numeroDaFoglio(dataCheckin, appartamento, notti, righe) {
  const rows = await righe();
  return rows ? trovaPerDataEAppartamento(rows, dataCheckin, appartamento, notti) : '';
}

// Il numero scritto dall'ospite si ricontrolla nel foglio (14/11/2026): true se c'è e non è annullata, false se non c'è (o è annullata),
// null se il foglio non risponde. Prima si guardava solo la forma del numero: chiunque pagasse poteva portare nel pagamento il numero di
// un'altra prenotazione, e il sito di La Columbera avrebbe segnato per quella il check-in come fatto.
async function numeroNelFoglio(numero, righe) {
  const rows = await righe();
  return rows ? !!cercaPrenotazione(rows, numero) : null;
}

// `stripe` è un parametro per poterlo sostituire nei test (nessuna chiamata reale a Stripe); deps.cercaNumero e deps.numeroNelFoglio idem (foglio Prenotazioni)
async function gestisciRichiesta(stripe, req, res, env = process.env, deps = {}) {
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
    // Il numero della prenotazione va nel pagamento (e nell'oggetto dell'email al gestore): quello verificato dall'ospite nel primo passo,
    // altrimenti quello trovato nel foglio per data di arrivo e appartamento (numeroDa = 'foglio'). Il sito di La Columbera lo legge dal
    // pagamento e segna il check-in come fatto nell'area clienti.
    const righe = righePrenotazioni(env);
    let numero = numeroPrenotazioneValido(numeroPrenotazione), numeroDa = numero ? 'ospite' : '';
    // un numero che nel foglio non c'è (inventato o di una prenotazione annullata) non si porta nel pagamento: si cerca per data e appartamento.
    // Foglio che non risponde: si tiene il numero dell'ospite, come prima.
    if (numero && (await Promise.resolve().then(() => (deps.numeroNelFoglio || (n => numeroNelFoglio(n, righe)))(numero)).catch(() => null)) === false) { numero = ''; numeroDa = ''; }
    if (!numero) {
      numero = numeroPrenotazioneValido(await (deps.cercaNumero || ((d, a, n) => numeroDaFoglio(d, a, n, righe)))(dataCheckin, appartamento, numeroNotti).catch(() => ''));
      if (numero) numeroDa = 'foglio';
    }
    const metadata = {
      numeroPrenotazione: numero,
      numeroDa,
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

export const makeHandler = (client, env, deps) => (req, res) => gestisciRichiesta(client, req, res, env || process.env, deps || {});
export default makeHandler(stripe);
