// api/_email-gestore.js — email al gestore con l'immagine del documento (fronte ed eventuale retro) e, su richiesta del
// gestore (27/10/2026), il PDF di riepilogo dei dati inseriti per confrontarli con il documento (_pdf-riepilogo.js).
//
// MODALITÀ mantenuta su indicazione del gestore: richiede una valutazione separata di sicurezza e di gestione delle
// copie (posta inviata, cestino, backup, dispositivi sincronizzati). Vedi docs/gdpr/checkin-modifiche.md.
// Regole: nel corpo solo il riassunto del soggiorno e il nome del responsabile; gli altri dati degli ospiti stanno SOLO negli allegati (PDF); nomi degli allegati
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

// Testo dell'email: riassunto del check-in (soggiorno e nome del responsabile, come richiesto dal gestore). Nel corpo NON vanno
// mai date di nascita, estremi del documento né i dati degli altri ospiti: restano solo negli allegati (PDF).
// `riepilogo` = { dataCheckin, appartamento, ospiti, registrati, notti, totale, responsabile } (opzionale). `riferimento` è l'identificativo tecnico.
const dataIt = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.split('-').reverse().join('/') : (d || '—');
export function componiEmail({ riferimento, statoTxt, numeroAllegati, pdf, riepilogo }) {
  const r = riepilogo || null;
  const oggetto = r ? 'Nuovo check-in ricevuto · ' + dataIt(r.dataCheckin) + ' (rif. ' + riferimento + ')' : 'Check-in La Columbera - documento e riepilogo (rif. ' + riferimento + ')';
  const righe = ['Nuovo check-in ricevuto!', ''];
  if (r) {
    righe.push('DETTAGLI SOGGIORNO:',
      '- Data check-in: ' + dataIt(r.dataCheckin),
      '- Appartamento: ' + (r.appartamento || '—'),
      '- Ospiti: ' + (r.ospiti || '—') + ' (' + (r.registrati || 0) + ' registrati)',
      '- Notti: ' + (r.notti || '—'),
      '- Totale tassa soggiorno: €' + (Number.isFinite(+r.totale) ? (+r.totale).toFixed(2) : '—'),
      '');
    if (r.responsabile) righe.push('Responsabile: ' + r.responsabile, '');
  }
  righe.push('In allegato: ' + numeroAllegati + ' immagine/i del documento del responsabile'
      + (pdf === true ? ' e il riepilogo PDF dei dati inseriti (da confrontare con il documento).'
        : pdf === false ? '. Il riepilogo PDF NON è stato generato (errore tecnico): i dati sono nel foglio Google del check-in.' : '.'));
  if (!/^inviati al foglio/.test(statoTxt || '')) righe.push('Dati per Alloggiati Web: ' + statoTxt);
  righe.push('',
    'Dopo la registrazione su Alloggiati Web elimina questa email e gli allegati (anche da Posta inviata e Cestino), il TXT e le righe del foglio.',
    'Rif. tecnico: ' + riferimento);
  return { oggetto, testo: righe.join('\n') };
}

// deps.transporter iniettabile nei test. Ritorna { inviata: true, allegati } oppure lancia un errore senza contenuti.
// generaPdf(allegati) opzionale: se fallisce l'email parte comunque con le sole immagini (il PDF non blocca nulla).
export async function inviaImmaginiAlGestore({ documenti, riferimento, statoTxt, destinatario, env, transporter, generaPdf, riepilogo }) {
  const { allegati, scartati } = preparaAllegati(documenti);
  if (!allegati.length) { const e = new Error('Nessuna immagine valida da inviare'); e.code = 'NESSUN_ALLEGATO'; e.scartati = scartati; throw e; }
  let pdf;
  if (generaPdf) {
    try { const p = await generaPdf(allegati); if (p && p.content && p.content.length) { allegati.unshift(p); pdf = true; } else pdf = false; }
    catch (e) { pdf = false; console.warn('email gestore: PDF non generato (' + (e && (e.code || e.name) || 'errore') + ')'); }
  }
  const t = transporter || nodemailer.createTransport({ service: 'gmail', auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD } });
  const numeroImmagini = allegati.filter(a => a.filename.startsWith('documento-')).length;
  const { oggetto, testo } = componiEmail({ riferimento, statoTxt, numeroAllegati: numeroImmagini, pdf, riepilogo });
  await t.sendMail({ from: '"La Columbera" <' + env.EMAIL_USER + '>', to: destinatario, subject: oggetto, text: testo, attachments: allegati });
  return { inviata: true, allegati: allegati.length, pdf: pdf === true, scartati: scartati.length };
}

// Descrizione dell'errore SMTP senza contenuti (niente allegati, niente corpo).
export const descriviErroreEmail = e => !e ? 'errore' : [e.code || 'errore', e.responseCode ? 'SMTP ' + e.responseCode : ''].filter(Boolean).join(' · ');
