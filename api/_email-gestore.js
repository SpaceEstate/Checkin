// api/_email-gestore.js — email al gestore con l'immagine del documento (fronte ed eventuale retro) e, su richiesta del
// gestore (27/10/2026), il PDF di riepilogo dei dati inseriti per confrontarli con il documento (_pdf-riepilogo.js).
//
// MODALITÀ mantenuta su indicazione del gestore: richiede una valutazione separata di sicurezza e di gestione delle
// copie (posta inviata, cestino, backup, dispositivi sincronizzati). Vedi docs/gdpr/checkin-modifiche.md.
// Regole: i dati degli ospiti stanno SOLO negli allegati (PDF), mai nell'oggetto o nel corpo; nomi degli allegati
// generici (mai il nome originale del file, che può contenere nome e cognome).
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
export function componiEmail({ riferimento, statoTxt, numeroAllegati, pdf }) {
  const oggetto = 'Check-in La Columbera - documento e riepilogo (rif. ' + riferimento + ')';
  const testo = [
    'È stato completato un check-in online.',
    '',
    'In allegato: ' + numeroAllegati + ' immagine/i del documento del responsabile'
      + (pdf === true ? ' e il riepilogo PDF dei dati inseriti (da confrontare con il documento).'
        : pdf === false ? '. Il riepilogo PDF NON è stato generato (errore tecnico): i dati sono nel foglio Google del check-in.' : '.'),
    'Riferimento tecnico: ' + riferimento,
    'Dati per Alloggiati Web (al momento di questo invio): ' + statoTxt,
    '',
    'PROMEMORIA OPERATIVO',
    '1. Verifica l\'identità dell\'ospite di persona (o con un collegamento video in tempo reale idoneo) confrontando il documento originale',
    '   con chi soggiorna: questa immagine NON basta come identificazione.',
    '2. Carica a mano il file TXT su Alloggiati Web e verifica la ricevuta sul portale.',
    '3. Dopo aver verificato la ricevuta: elimina questa email e i suoi allegati anche da "Posta inviata" della casella mittente,',
    '   dal Cestino e da ogni altra copia accessibile (download, dispositivi sincronizzati); elimina il TXT e le righe',
    '   degli ospiti non più necessarie dal foglio e dalla cartella Drive.',
    '   Il sistema non può cancellare le copie delle email: va fatto a mano.',
    '',
    '---',
    'Messaggio automatico del sistema di check-in.'
  ].join('\n');
  return { oggetto, testo };
}

// deps.transporter iniettabile nei test. Ritorna { inviata: true, allegati } oppure lancia un errore senza contenuti.
// generaPdf(allegati) opzionale: se fallisce l'email parte comunque con le sole immagini (il PDF non blocca nulla).
export async function inviaImmaginiAlGestore({ documenti, riferimento, statoTxt, destinatario, env, transporter, generaPdf }) {
  const { allegati, scartati } = preparaAllegati(documenti);
  if (!allegati.length) { const e = new Error('Nessuna immagine valida da inviare'); e.code = 'NESSUN_ALLEGATO'; e.scartati = scartati; throw e; }
  let pdf;
  if (generaPdf) {
    try { const p = await generaPdf(allegati); if (p && p.content && p.content.length) { allegati.unshift(p); pdf = true; } else pdf = false; }
    catch (e) { pdf = false; console.warn('email gestore: PDF non generato (' + (e && (e.code || e.name) || 'errore') + ')'); }
  }
  const t = transporter || nodemailer.createTransport({ service: 'gmail', auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD } });
  const numeroImmagini = allegati.filter(a => a.filename.startsWith('documento-')).length;
  const { oggetto, testo } = componiEmail({ riferimento, statoTxt, numeroAllegati: numeroImmagini, pdf });
  await t.sendMail({ from: '"La Columbera" <' + env.EMAIL_USER + '>', to: destinatario, subject: oggetto, text: testo, attachments: allegati });
  return { inviata: true, allegati: allegati.length, pdf: pdf === true, scartati: scartati.length };
}

// Descrizione dell'errore SMTP senza contenuti (niente allegati, niente corpo).
export const descriviErroreEmail = e => !e ? 'errore' : [e.code || 'errore', e.responseCode ? 'SMTP ' + e.responseCode : ''].filter(Boolean).join(' · ');
