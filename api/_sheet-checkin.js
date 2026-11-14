// api/_sheet-checkin.js — invio dei dati del check-in al foglio Google (SHEET_ID), da cui lo script del gestore crea il TXT
// Alloggiati Web. RIPRISTINATO su richiesta del gestore (27/10/2026): il salvataggio diretto del TXT su Drive non è
// possibile con l'account di servizio (Google: "storageQuotaExceeded" su "Il mio Drive" di un account personale).
//
// Le colonne e i valori sono IDENTICI alla versione precedente (saveToGoogleSheets in stripeWebhook.js), perché lo
// script del gestore legge il foglio: una riga per ospite, campi del documento solo per il responsabile.
// Unica differenza tecnica: tutte le righe di un check-in vengono aggiunte con UNA sola chiamata (addRows), così un
// nuovo tentativo dopo un errore non lascia righe a metà né duplica quelle già scritte.
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Stessa regola di calcolaEta() in checkin.js (età il giorno dell'invio).
export function calcolaEta(dataNascita, oggi) {
  if (!dataNascita) return 0;
  const nascita = new Date(dataNascita);
  if (isNaN(nascita.getTime())) return 0;
  const d = oggi || new Date();
  let eta = d.getFullYear() - nascita.getFullYear();
  const mese = d.getMonth() - nascita.getMonth();
  if (mese < 0 || (mese === 0 && d.getDate() < nascita.getDate())) eta--;
  return Math.max(0, eta);
}

// I valori si scrivono «come digitati» (USER_ENTERED): un testo che inizia con = + - @ diventerebbe una formula del foglio (per esempio
// =IMPORTDATA(…) o =HYPERLINK(…), scritta da chi chiama l'API a mano: nome, cognome, comune… arrivano dal browser dell'ospite e il
// server non li ricontrolla), e un numero del documento di sole cifre con lo zero davanti, o più lungo di 15 cifre, perderebbe zeri e
// cifre. L'apostrofo iniziale è il modo di Google Sheets per dire «questo è testo»: non resta nella cella. I valori normali (nomi, date,
// numeri…) restano com'erano, quindi lo script del gestore che legge il foglio non vede differenze.
const INIZIO_FORMULA = /^[=+\-@\t\r\n]/;
export function testoSicuro(v, comeNumeroDocumento) {
  const t = v == null ? '' : String(v);
  if (INIZIO_FORMULA.test(t)) return "'" + t;
  if (comeNumeroDocumento && /^\d+$/.test(t) && (t[0] === '0' || t.length > 15)) return "'" + t;
  return t;
}

// Righe nel formato della versione precedente. `metadata` = metadati della sessione Stripe (totale e timestamp).
export function righeSheet(dati, metadata, oggi) {
  const md = metadata || {};
  const ospiti = Array.isArray(dati.ospiti) && dati.ospiti.length ? dati.ospiti.slice().sort((a, b) => (a.numero || 0) - (b.numero || 0))
    : [{ numero: 1, cognome: '', nome: '', genere: '', nascita: '', cittadinanza: '', luogoNascita: '' }];
  return ospiti.map(ospite => {
    const eta = calcolaEta(ospite.nascita, oggi);
    const responsabile = ospite.numero === 1 || ospite.isResponsabile;
    return {
      'Data Check-in': dati.dataCheckin || '',
      'Appartamento': testoSicuro(dati.appartamento || ''),
      'Numero Ospiti': (dati.numeroOspiti || 0).toString(),
      'Numero Notti': (dati.numeroNotti || 0).toString(),
      'Tipo Gruppo': testoSicuro(dati.tipoGruppo || ''),
      'Totale': String(md.totale || 0),
      'Numero Ospite': (ospite.numero || 1).toString(),
      'Cognome': testoSicuro(ospite.cognome || ''),
      'Nome': testoSicuro(ospite.nome || ''),
      'Genere': ospite.genere || '',
      'Data Nascita': ospite.nascita || '',
      'Età': eta ? eta.toString() : '',
      'Cittadinanza': testoSicuro(ospite.cittadinanza || ''),
      'Luogo Nascita': testoSicuro(ospite.luogoNascita || ''),
      'Comune': testoSicuro(ospite.comune || ''),
      'Provincia': testoSicuro(ospite.provincia || ''),
      'Timestamp': testoSicuro(md.timestamp || new Date().toISOString()),
      'Tipo Documento': responsabile ? testoSicuro(ospite.tipoDocumento || '') : '',
      'Numero Documento': responsabile ? testoSicuro(ospite.numeroDocumento || '', true) : '',
      'Luogo Rilascio': responsabile ? testoSicuro(ospite.luogoRilascio || '') : ''
    };
  });
}

export const sheetConfigurato = env => !!(env.SHEET_ID && env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY);

// Scrive le righe sul primo foglio del documento SHEET_ID (come prima). Lancia un errore senza contenuti se fallisce.
export async function salvaSuSheet(righe, env) {
  const auth = new JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: String(env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const doc = new GoogleSpreadsheet(env.SHEET_ID, auth);
  await doc.loadInfo();
  await doc.sheetsByIndex[0].addRows(righe);
}
