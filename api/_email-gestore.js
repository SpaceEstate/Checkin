// api/_email-gestore.js — email al gestore con la SOLA immagine del documento (fronte ed eventuale retro).
//
// MODALITÀ TEMPORANEA, mantenuta su indicazione del gestore: richiede una valutazione separata di sicurezza e di gestione
// delle copie (posta inviata, cestino, backup, dispositivi sincronizzati). Vedi docs/gdpr/checkin-modifiche.md.
// Regole: nessun PDF, nessun elenco ospiti, nessun dato anagrafico nell'oggetto o nel corpo, nessun dato da Google Sheets,
// nomi degli allegati generici (mai il nome originale del file, che può contenere nome e cognome).
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

// Testo dell'email: generico, senza dati identificativi. `riferimento` è l'identificativo tecnico del check-in.
export function componiEmail({ riferimento, statoTxt, numeroAllegati }) {
  const oggetto = 'Check-in La Columbera - immagine documento (rif. ' + riferimento + ')';
  const testo = [
    'È stato completato un check-in online.',
    '',
    'In allegato: ' + numeroAllegati + ' immagine/i del documento del responsabile. Nessun altro dato è incluso in questa email.',
    'Riferimento tecnico: ' + riferimento,
    'File Alloggiati Web (al momento di questo invio): ' + statoTxt,
    '',
    'PROMEMORIA OPERATIVO',
    '1. Verifica l\'identità dell\'ospite di persona (o con un collegamento video in tempo reale idoneo) confrontando il documento originale',
    '   con chi soggiorna: questa immagine NON basta come identificazione.',
    '2. Carica a mano il file TXT su Alloggiati Web e verifica la ricevuta sul portale.',
    '3. Dopo aver verificato la ricevuta: elimina questa email e i suoi allegati anche da "Posta inviata" della casella mittente,',
    '   dal Cestino e da ogni altra copia accessibile (download, dispositivi sincronizzati); elimina il TXT da Google Drive',
    '   con la procedura documentata (endpoint admin-alloggiati, azione "elimina-txt").',
    '   Il sistema non può cancellare le copie delle email: va fatto a mano.',
    '',
    '---',
    'Messaggio automatico del sistema di check-in.'
  ].join('\n');
  return { oggetto, testo };
}

// deps.transporter iniettabile nei test. Ritorna { inviata: true, allegati } oppure lancia un errore senza contenuti.
export async function inviaImmaginiAlGestore({ documenti, riferimento, statoTxt, destinatario, env, transporter }) {
  const { allegati, scartati } = preparaAllegati(documenti);
  if (!allegati.length) { const e = new Error('Nessuna immagine valida da inviare'); e.code = 'NESSUN_ALLEGATO'; e.scartati = scartati; throw e; }
  const t = transporter || nodemailer.createTransport({ service: 'gmail', auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD } });
  const { oggetto, testo } = componiEmail({ riferimento, statoTxt, numeroAllegati: allegati.length });
  await t.sendMail({ from: '"La Columbera" <' + env.EMAIL_USER + '>', to: destinatario, subject: oggetto, text: testo, attachments: allegati });
  return { inviata: true, allegati: allegati.length, scartati: scartati.length };
}

// Descrizione dell'errore SMTP senza contenuti (niente allegati, niente corpo).
export const descriviErroreEmail = e => !e ? 'errore' : [e.code || 'errore', e.responseCode ? 'SMTP ' + e.responseCode : ''].filter(Boolean).join(' · ');
