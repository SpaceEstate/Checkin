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
      'Appartamento': dati.appartamento || '',
      'Numero Ospiti': (dati.numeroOspiti || 0).toString(),
      'Numero Notti': (dati.numeroNotti || 0).toString(),
      'Tipo Gruppo': dati.tipoGruppo || '',
      'Totale': String(md.totale || 0),
      'Numero Ospite': (ospite.numero || 1).toString(),
      'Cognome': ospite.cognome || '',
      'Nome': ospite.nome || '',
      'Genere': ospite.genere || '',
      'Data Nascita': ospite.nascita || '',
      'Età': eta ? eta.toString() : '',
      'Cittadinanza': ospite.cittadinanza || '',
      'Luogo Nascita': ospite.luogoNascita || '',
      'Comune': ospite.comune || '',
      'Provincia': ospite.provincia || '',
      'Timestamp': md.timestamp || new Date().toISOString(),
      'Tipo Documento': responsabile ? (ospite.tipoDocumento || '') : '',
      'Numero Documento': responsabile ? (ospite.numeroDocumento || '') : '',
      'Luogo Rilascio': responsabile ? (ospite.luogoRilascio || '') : ''
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
