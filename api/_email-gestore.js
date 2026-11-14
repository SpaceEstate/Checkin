// api/_email-gestore.js — email al gestore con l'immagine del documento (fronte ed eventuale retro) e il riepilogo dei dati inseriti,
// per confrontarli con il documento.
//
// 14/11/2026, richiesta del titolare: il PDF di riepilogo (prima generato dal servizio esterno Browserless, 27/10/2026) NON si crea più.
// Il suo contenuto — dettagli del soggiorno e dati di tutti gli ospiti — sta nel TESTO dell'email; in allegato restano solo le immagini
// del documento, come prima. Nessun servizio esterno riceve più i dati degli ospiti (solo il server di posta, come per gli allegati).
//
// MODALITÀ mantenuta su indicazione del gestore: richiede una valutazione separata di sicurezza e di gestione delle
// copie (posta inviata, cestino, backup, dispositivi sincronizzati). Vedi docs/gdpr/checkin-modifiche.md.
// Regole: i dati degli ospiti stanno nel CORPO dell'email (e solo lì: l'oggetto non ne porta mai); nomi degli allegati generici (mai il nome
// originale del file, che può contenere nome e cognome).
// Il sistema NON può cancellare le copie dell'email: lo deve fare il gestore (promemoria nel corpo del messaggio).
import nodemailer from 'nodemailer';
import { decodificaDocumento } from './_validazione-checkin.js';

export function preparaAllegati(documenti) {
  const allegati = [], scartati = [];
  for (const d of Array.isArray(documenti) ? documenti : []) {
    const dec = decodificaDocumento(d);
    if (dec.errore) { scartati.push(dec.errore); continue; }
    allegati.push({ filename: 'documento-' + dec.lato + '.' + dec.ext, content: dec.buffer, contentType: dec.mime });
  }
  return { allegati, scartati };
}

// Testo dell'email: riassunto del check-in e dati di tutti gli ospiti (il contenuto del vecchio PDF di riepilogo, dal 14/11/2026).
// L'OGGETTO non porta mai dati personali (nemmeno il nome del responsabile): solo numero di prenotazione, appartamento, data e riferimento.
// `riepilogo` = { dataCheckin, appartamento, ospiti, registrati, notti, totale, responsabile, numeroPrenotazione, numeroDa,
//   ospitiDettaglio: [{ numero, isResponsabile, cognome, nome, genere, nascita, eta, cittadinanza, luogoNascita, comune, provincia,
//   tipoDocumento, numeroDocumento, luogoRilascio }] } (opzionale). `riferimento` è l'identificativo tecnico.
const dataIt = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.split('-').reverse().join('/') : (d || '—');
// valori scritti dall'ospite, in una sola riga: il testo di un'email non esegue nulla, ma un a capo dentro un nome rovinerebbe l'elenco
const riga = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f\u2028\u2029\s]+/g, ' ').trim().slice(0, 120);
const valore = v => riga(v) || '—';
const GENERE = { M: 'Maschio', F: 'Femmina' };
// Soglia dell'imposta: la stessa del modulo (checkin.js, calcolaTotale) e del server (crea-pagamento-stripe.js)
const ETA_TASSABILE = 4;

// Un ospite, come nel vecchio PDF: nome, genere, data di nascita (età e tassa), cittadinanza, luogo di nascita; il responsabile anche il documento
export function bloccoOspite(o, posizione) {
  const nome = [riga(o.cognome), riga(o.nome)].filter(Boolean).join(' ') || '—';
  const eta = Number.isInteger(o.eta) && o.eta >= 0 ? o.eta : null;
  const comune = riga(o.comune) ? ' · ' + riga(o.comune) + (riga(o.provincia) ? ' (' + riga(o.provincia) + ')' : '') : '';
  const righe = [
    posizione + '. ' + nome + (o.isResponsabile ? ' (RESPONSABILE)' : ''),
    '   Genere: ' + (GENERE[o.genere] || '—'),
    '   Data di nascita: ' + dataIt(riga(o.nascita)) + (eta === null ? '' : ' (' + eta + (eta === 1 ? ' anno, ' : ' anni, ') + (eta >= ETA_TASSABILE ? 'tassabile' : 'esente') + ')'),
    '   Cittadinanza: ' + valore(o.cittadinanza),
    '   Luogo di nascita: ' + valore(o.luogoNascita) + comune
  ];
  if (o.isResponsabile && (riga(o.tipoDocumento) || riga(o.numeroDocumento) || riga(o.luogoRilascio)))
    righe.push('   Documento: ' + valore(o.tipoDocumento) + ' · n. ' + valore(o.numeroDocumento) + ' · rilasciato in: ' + valore(o.luogoRilascio));
  return righe.join('\n');
}

export function componiEmail({ riferimento, statoTxt, numeroAllegati, riepilogo }) {
  const r = riepilogo || null;
  // Oggetto: il numero di prenotazione per primo (lo stesso che il sito legge dal pagamento per segnare il check-in fatto), poi appartamento e data
  const apt = r ? (/torre/i.test(r.appartamento || '') && /corte/i.test(r.appartamento || '') ? 'Torre + Corte' : /torre/i.test(r.appartamento || '') ? 'Torre' : /corte/i.test(r.appartamento || '') ? 'Corte' : '') : '';
  const oggetto = r ? 'Check-in · ' + (r.numeroPrenotazione ? 'Prenotazione ' + r.numeroPrenotazione : 'senza numero di prenotazione') + (apt ? ' · ' + apt : '') + ' · ' + dataIt(r.dataCheckin) + ' (rif. ' + riferimento + ')'
    : 'Check-in La Columbera - documento e riepilogo (rif. ' + riferimento + ')';
  const righe = ['Nuovo check-in ricevuto!', ''];
  if (r) {
    righe.push('Numero prenotazione: ' + (r.numeroPrenotazione ? r.numeroPrenotazione + (r.numeroDa === 'foglio' ? ' (trovato per data di arrivo e appartamento: l\'ospite non l\'ha inserito)' : '') : 'non indicato e non trovato nel foglio Prenotazioni (puoi segnare il check-in fatto da Gestione → Prenotazioni)'), '');
    righe.push('DETTAGLI SOGGIORNO:',
      '- Data check-in: ' + dataIt(r.dataCheckin),
      '- Appartamento: ' + (r.appartamento || '—'),
      '- Ospiti: ' + (r.ospiti || '—') + ' (' + (r.registrati || 0) + ' registrati)',
      '- Notti: ' + (r.notti || '—'),
      '- Totale tassa soggiorno: €' + (Number.isFinite(+r.totale) ? (+r.totale).toFixed(2) : '—'),
      '');
    if (r.responsabile) righe.push('Responsabile: ' + r.responsabile, '');
    // dati di tutti gli ospiti (il contenuto del vecchio PDF di riepilogo), da confrontare con il documento allegato
    const ospitiDettaglio = Array.isArray(r.ospitiDettaglio) ? r.ospitiDettaglio : [];
    if (ospitiDettaglio.length) {
      righe.push('OSPITI REGISTRATI (' + ospitiDettaglio.length + '):', '');
      ospitiDettaglio.forEach((o, i) => righe.push(bloccoOspite(o || {}, i + 1), ''));
    }
  }
  righe.push('In allegato: ' + numeroAllegati + ' immagine/i del documento del responsabile'
      + (r && Array.isArray(r.ospitiDettaglio) && r.ospitiDettaglio.length ? ' (da confrontare con i dati qui sopra).' : '.'));
  if (!/^inviati al foglio/.test(statoTxt || '')) righe.push('Dati per Alloggiati Web: ' + statoTxt);
  righe.push('',
    'Dopo la registrazione su Alloggiati Web elimina questa email e gli allegati (anche da Posta inviata e Cestino), il TXT e le righe del foglio.',
    'Rif. tecnico: ' + riferimento);
  return { oggetto, testo: righe.join('\n') };
}

// deps.transporter iniettabile nei test. Ritorna { inviata: true, allegati } oppure lancia un errore senza contenuti.
// Allegati: solo le immagini del documento (nessun PDF di riepilogo: i dati stanno nel testo, vedi componiEmail).
export async function inviaImmaginiAlGestore({ documenti, riferimento, statoTxt, destinatario, env, transporter, riepilogo }) {
  const { allegati, scartati } = preparaAllegati(documenti);
  if (!allegati.length) { const e = new Error('Nessuna immagine valida da inviare'); e.code = 'NESSUN_ALLEGATO'; e.scartati = scartati; throw e; }
  const t = transporter || nodemailer.createTransport({ service: 'gmail', auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD } });
  const { oggetto, testo } = componiEmail({ riferimento, statoTxt, numeroAllegati: allegati.length, riepilogo });
  await t.sendMail({ from: '"La Columbera" <' + env.EMAIL_USER + '>', to: destinatario, subject: oggetto, text: testo, attachments: allegati });
  return { inviata: true, allegati: allegati.length, scartati: scartati.length };
}

// Descrizione dell'errore SMTP senza contenuti (niente allegati, niente corpo).
export const descriviErroreEmail = e => !e ? 'errore' : [e.code || 'errore', e.responseCode ? 'SMTP ' + e.responseCode : ''].filter(Boolean).join(' · ');
