// api/verifica-prenotazione.js
// Endpoint per verificare e recuperare dati prenotazione da Google Sheets
//
// Il numero di prenotazione vale come chiave dell'area clienti del sito: non va nei log (né i dati trovati), e i tentativi falliti
// sono limitati per IP come sul sito (10 ogni 15 minuti, vedi LIMITE_FALLITI). Il contatore usa solo un hash troncato dell'IP.

import crypto from 'crypto';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { pgStore } from './_db.js';

// Normalizza una data (proveniente dal foglio Google Sheets, in formato
// potenzialmente diverso) in una stringa ISO stretta "YYYY-MM-DD", come
// richiesto da <input type="date">. Ritorna null se non riesce a
// riconoscere il formato, invece di restituire una stringa "quasi giusta"
// che il campo data rifiuterebbe silenziosamente.
function normalizzaDataISO(valore) {
  if (!valore) return null;
  const raw = String(valore).trim();

  // Già in formato ISO (anno-mese-giorno), eventualmente con un orario
  // attaccato (es. "2026-09-22T00:00:00.000Z" o "2026-09-22 00:00:00"):
  // riconosciuto dal fatto che inizia con 4 cifre. In questo caso NON va
  // toccato, va solo tagliata l'eventuale parte oraria.
  let m = raw.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (m) {
    const anno = m[1];
    const mese = m[2].padStart(2, '0');
    const giorno = m[3].padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
  }

  // Formato giorno-primo (GG/MM/AAAA, GG-MM-AAAA, GG.MM.AAAA): riconosciuto
  // dal fatto che l'anno (4 cifre) è l'ULTIMO pezzo, non il primo.
  m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) {
    const giorno = m[1].padStart(2, '0');
    const mese = m[2].padStart(2, '0');
    const anno = m[3];
    return `${anno}-${mese}-${giorno}`;
  }

  // Ultima spiaggia: prova il parser nativo di Date (copre ad es. le
  // stringhe restituite da Google Sheets come oggetto Date serializzato).
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

// Cerca la riga della prenotazione (case-insensitive, trim degli spazi); poi anche senza spazi, punti e trattini, come la scrive l'ospite:
// Booking mostra "6877.180.932", la mail di La Columbera il codice a gruppi "558R TE56 487A9". Se così le righe sono più di una, nessuna.
export function cercaPrenotazione(rows, numeroPrenotazione) {
  const numeroNormalizzato = String(numeroPrenotazione).trim().toUpperCase();
  const esatta = rows.find(row => (row.get('Numero Prenotazione') || '').toString().trim().toUpperCase() === numeroNormalizzato);
  if (esatta) return esatta;
  const compatto = v => String(v == null ? '' : v).trim().toUpperCase().replace(/[\s.\-_/]+/g, '');
  const numeroCompatto = compatto(numeroPrenotazione);
  const simili = numeroCompatto.length >= 3 ? rows.filter(row => compatto(row.get('Numero Prenotazione')) === numeroCompatto) : [];
  return simili.length === 1 ? simili[0] : undefined;
}

// Appartamento di un testo («La Columbera - Torre, …»): 'torre' | 'corte'; '' se sono tutti e due o nessuno.
const aptDi = a => { const t = /torre/i.test(String(a || '')), c = /corte/i.test(String(a || '')); return t === c ? '' : t ? 'torre' : 'corte'; };
// Numero della prenotazione di un check-in fatto SENZA numero (l'ospite ha scelto «Non ho il numero di prenotazione»): la riga del foglio
// Prenotazioni con la stessa data di arrivo e lo stesso appartamento, non annullata. Solo se è una sola (con più righe possibili decidono le
// notti); altrimenti '' (meglio nessun numero che quello di un'altra prenotazione). Stessa regola del sito di La Columbera.
export function trovaPerDataEAppartamento(rows, dataISO, appartamento, notti) {
  const apt = aptDi(appartamento);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO || '') || !apt) return '';
  let c = (rows || []).filter(r => String(r.get('Numero Prenotazione') || '').trim() && String(r.get('STATO') || '').trim().toUpperCase() !== 'ANNULLATA'
    && normalizzaDataISO(r.get('Data Check-in')) === dataISO && aptDi(r.get('Appartamento')) === apt);
  const n = parseInt(notti, 10);
  if (c.length > 1 && n > 0) c = c.filter(r => parseInt(r.get('Numero Notti'), 10) === n);
  return c.length === 1 ? String(c[0].get('Numero Prenotazione')).trim() : '';
}
// Righe del foglio Prenotazioni (lo stesso della verifica del numero). Lancia se il foglio non risponde.
export async function leggiRighePrenotazioni(env = process.env) {
  const auth = new JWT({ email: env.GOOGLE_CLIENT_EMAIL, key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const doc = new GoogleSpreadsheet(env.SHEET_ID_PRENOTAZIONI || env.SHEET_ID, auth);
  await doc.loadInfo();
  return doc.sheetsByIndex[0].getRows();
}

// Tentativi falliti per IP: come sul sito di La Columbera (api/_accesso.js, failIp). Chi supera il limite riceve 429: la pagina mostra
// «prenotazione non trovata», come per un numero sbagliato, e l'ospite può sempre proseguire con «Non ho il numero di prenotazione».
export const LIMITE_FALLITI = { max: 10, finestraMs: 15 * 60 * 1000 };
const ATTESA_CONTATORE_MS = 3000;      // il contatore non deve mai rallentare la verifica: oltre questo tempo si prosegue senza

// Chiave del contatore: hash troncato dell'IP (l'IP in chiaro non si salva). Stesso criterio del sito.
export function chiaveIp(req) {
  const h = (req && req.headers) || {};
  const ip = String(h['x-real-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] || (req && req.socket && req.socket.remoteAddress) || 'sconosciuto').trim();
  return 'verifica:' + crypto.createHash('sha256').update('ip|' + ip).digest('hex').slice(0, 24);
}

// Esegue p con un tempo massimo; se non risponde o fallisce restituisce `riserva` (il contatore non blocca mai la verifica).
async function entro(p, ms, riserva) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(() => p()), new Promise(ok => { timer = setTimeout(() => ok(riserva), ms); })]); }
  catch (e) { console.warn('verifica-prenotazione: contatore non disponibile (' + (e && (e.code || e.name) || 'errore') + ')'); return riserva; }
  finally { clearTimeout(timer); }
}

// deps: leggiRighe (foglio Prenotazioni), store (contatore dei tentativi: tentativiFalliti, registraTentativoFallito), env, attesaMs (solo test)
export function makeHandler(deps = {}) {
  const leggiRighe = deps.leggiRighe || (() => leggiRighePrenotazioni(deps.env || process.env));
  const store = deps.store || null, attesa = deps.attesaMs || ATTESA_CONTATORE_MS;
  return async function handler(req, res) {
    // CORS Headers
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
      const { numeroPrenotazione } = req.body || {};

      if (!numeroPrenotazione || !String(numeroPrenotazione).trim()) {
        return res.status(400).json({
          error: "Numero prenotazione richiesto",
          found: false
        });
      }

      // Il foglio si legge mentre si controlla il contatore: la verifica non diventa più lenta.
      const chiave = chiaveIp(req);
      const [falliti, rows] = await Promise.all([
        store ? entro(() => store.tentativiFalliti(chiave), attesa, 0) : 0,
        leggiRighe()
      ]);
      if (falliti >= LIMITE_FALLITI.max) {
        console.warn('verifica-prenotazione: troppi tentativi falliti da questo indirizzo');
        res.setHeader("Retry-After", String(Math.ceil(LIMITE_FALLITI.finestraMs / 1000)));
        return res.status(429).json({ found: false, error: "Troppi tentativi", message: "Troppi tentativi: riprova più tardi" });
      }

      const prenotazioneTrovata = cercaPrenotazione(rows, numeroPrenotazione);

      if (!prenotazioneTrovata) {
        if (store) await entro(() => store.registraTentativoFallito(chiave, LIMITE_FALLITI.finestraMs), attesa, null);
        console.log('verifica-prenotazione: non trovata');
        return res.status(404).json({
          found: false,
          message: "Numero prenotazione non trovato"
        });
      }

      // Estrai i dati
      const datiPrenotazione = {
        numeroPrenotazione: prenotazioneTrovata.get('Numero Prenotazione'),
        dataCheckin: prenotazioneTrovata.get('Data Check-in'),
        appartamento: prenotazioneTrovata.get('Appartamento'),
        numeroOspiti: parseInt(prenotazioneTrovata.get('Numero Ospiti')) || 0,
        numeroNotti: parseInt(prenotazioneTrovata.get('Numero Notti')) || 0,
        // Tipo gruppo rimane vuoto - compilato dall'utente
        tipoGruppo: null
      };

      // Validazione dati minimi
      if (!datiPrenotazione.dataCheckin || !datiPrenotazione.appartamento) {
        console.warn('verifica-prenotazione: dati della prenotazione incompleti nel foglio');
        return res.status(400).json({
          found: false,
          error: "Dati prenotazione incompleti nel sistema"
        });
      }

      // Converti data in formato ISO (YYYY-MM-DD), qualunque sia il formato
      // in cui è salvata nel foglio.
      //
      // BUG STORICO: il vecchio codice assumeva SEMPRE un formato giorno-primo
      // (GG/MM/AAAA) e prendeva l'ultimo pezzo come anno. Ma le prenotazioni
      // create dal sito stesso (dopo pagamento Stripe, vedi stripeWebhook.js)
      // salvano la data già in formato ISO AAAA-MM-GG. Per una data tipo
      // "2026-09-22", quel codice produceva "22-09-2026": non valido per un
      // <input type="date"> (che richiede rigorosamente AAAA-MM-GG). Il campo
      // risultava quindi vuoto e, siccome veniva comunque bloccato in sola
      // lettura, anche il selettore calendario del browser restava disabilitato.
      const dataISO = normalizzaDataISO(datiPrenotazione.dataCheckin);

      if (!dataISO) {
        console.warn('verifica-prenotazione: data di arrivo non riconosciuta nel foglio');
        return res.status(400).json({
          found: false,
          error: "Data check-in non valida nel sistema",
          message: `Formato data non riconosciuto: "${datiPrenotazione.dataCheckin}"`
        });
      }

      datiPrenotazione.dataCheckin = dataISO;

      console.log('verifica-prenotazione: trovata');

      return res.status(200).json({
        found: true,
        dati: datiPrenotazione,
        message: "Prenotazione trovata con successo"
      });

    } catch (error) {
      // Solo il tipo di errore: niente messaggi interni nei log o nella risposta (come gli altri endpoint del check-in)
      console.error('verifica-prenotazione: errore ' + (error && (error.code || error.name) || 'interno'));

      return res.status(500).json({
        found: false,
        error: "Errore interno del server"
      });
    }
  };
}

export default makeHandler({ store: pgStore });
