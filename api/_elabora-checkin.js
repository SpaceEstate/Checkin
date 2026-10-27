// api/_elabora-checkin.js — cosa succede dopo un pagamento confermato (webhook Stripe e rielaborazione manuale).
//
// Passi, ciascuno IDEMPOTENTE (lo stato è nel registro tecnico checkin_adempimenti, quindi un nuovo tentativo rifà solo
// ciò che non è riuscito):
//   1. email di benvenuto all'ospite (codici cassetta) — invariata nei contenuti, ma riceve solo i dati che le servono;
//   2. invio dei dati al foglio Google del check-in (SHEET_ID), da cui lo script del gestore crea il TXT Alloggiati
//      (ripristinato su richiesta del gestore: il salvataggio diretto su Drive non è possibile con l'account di servizio);
//   3. email al gestore con l'immagine del documento e il PDF di riepilogo dei dati (ripristinato su richiesta del gestore);
//   4. eliminazione dei dati temporanei (anagrafiche + immagini) appena i dati sono nel foglio e l'email al gestore è partita.
// Se un passo fallisce per un motivo temporaneo (rete, Google, SMTP) il risultato è "da_ripetere": il webhook
// risponde con errore e Stripe ritenta più tardi. I dati temporanei restano al massimo TTL_DOPO_PAGAMENTO_MS dal primo
// tentativo, poi vengono cancellati comunque (pulizia giornaliera + pulizia a ogni richiesta).
// Nessun invio ad Alloggiati Web da questo sistema. Nessun log con dati personali.
import crypto from 'crypto';
import { descriviErroreEmail } from './_email-gestore.js';
import { righeSheet, sheetConfigurato } from './_sheet-checkin.js';

export const TTL_PRIMA_DEL_PAGAMENTO_MS = 2 * 3600e3;    // checkout Stripe scade dopo 30 minuti: 2 ore bastano
export const TTL_DOPO_PAGAMENTO_MS = 72 * 3600e3;        // finestra massima per i nuovi tentativi (Stripe ritenta fino a ~3 giorni)
export const LEASE_MS = 55e3;

export const checkinIdDa = stripeSessionId => 'ck' + crypto.createHash('sha256').update(String(stripeSessionId)).digest('hex').slice(0, 16);
export const riferimentoBreve = checkinId => String(checkinId).slice(0, 10);

const TERMINALI_EMAIL = ['inviata', 'non_disponibile', 'non_configurata', 'dati_non_disponibili'];
function descriviStatoSheet(reg) {
  switch (reg.sheet_stato) {
    case 'salvato': return 'inviati al foglio Google del check-in (il TXT lo crea il tuo script, come prima).';
    case 'non_configurato': return 'NON inviati al foglio: configurazione mancante (SHEET_ID / account Google).';
    case 'dati_non_disponibili': return 'NON inviati al foglio: i dati del check-in non sono più disponibili.';
    default: return 'NON ancora inviati al foglio (nuovo tentativo automatico in corso).';
  }
}

// deps = { store, env, now, salvaSuSheet(righe, env), inviaEmailOspite(payload), inviaEmailGestore(args), generaPdfRiepilogo(args), log }
export async function elaboraCheckin(session, deps) {
  const { store, env } = deps;
  const now = deps.now || (() => Date.now());
  const log = deps.log || (() => {});
  const metadata = (session && session.metadata) || {};
  const checkinId = checkinIdDa(session.id);
  const dataArrivo = /^\d{4}-\d{2}-\d{2}$/.test(metadata.dataCheckin || '') ? metadata.dataCheckin : null;
  const tempId = metadata.temp_session_id || null;
  let da_ripetere = false;

  let reg = await store.ottieniOCreaRegistro({ checkinId, stripeSessionId: session.id, tempSessionId: tempId, dataArrivo });
  if (!(await store.acquisisciLease(checkinId, LEASE_MS))) return { esito: 'in_corso', checkinId };
  const aggiorna = async patch => { await store.aggiornaRegistro(checkinId, patch); reg = Object.assign({}, reg, patch); };

  try {
    // Dati temporanei: si tengono al massimo fino a creazione registro + TTL_DOPO_PAGAMENTO_MS (mai oltre).
    let dati = null;
    if (tempId && !reg.dati_temporanei_eliminati_at) {
      dati = await store.leggiDatiTemporanei(tempId);
      if (dati) {
        const creato = reg.created_at ? new Date(reg.created_at).getTime() : now();
        await store.estendiScadenzaDatiTemporanei(tempId, new Date(creato + TTL_DOPO_PAGAMENTO_MS));
      }
    }

    // 1. email ospite (benvenuto + codici cassetta): solo i dati che servono
    if (!TERMINALI_EMAIL.includes(reg.email_ospite_stato)) {
      const emailOspite = session.customer_details && session.customer_details.email;
      if (!emailOspite) await aggiorna({ email_ospite_stato: 'non_disponibile' });
      else {
        const resp = dati && Array.isArray(dati.ospiti) ? dati.ospiti.find(o => o.numero === 1) : null;
        const payload = {
          emailOspite,
          datiPrenotazione: {
            dataCheckin: metadata.dataCheckin || (dati && dati.dataCheckin) || '',
            appartamento: metadata.appartamento || (dati && dati.appartamento) || '',
            numeroOspiti: parseInt(metadata.numeroOspiti, 10) || (dati && dati.numeroOspiti) || 0,
            numeroNotti: parseInt(metadata.numeroNotti, 10) || (dati && dati.numeroNotti) || 0,
            totale: parseFloat(metadata.totale) || 0,
            lingua: ['it', 'en', 'de'].includes(metadata.lingua) ? metadata.lingua : ((dati && dati.lingua) || 'it'),
            // solo per il saluto ("Gentile ..."), come prima
            ospiti: resp ? [{ nome: resp.nome || '', cognome: resp.cognome || '' }] : []
          }
        };
        try { await deps.inviaEmailOspite(payload); await aggiorna({ email_ospite_stato: 'inviata' }); log('email ospite: inviata'); }
        catch (e) { da_ripetere = true; await aggiorna({ email_ospite_stato: 'errore' }); log('email ospite: errore ' + descriviErroreEmail(e)); }
      }
    }

    // 2. dati al foglio Google del check-in (una sola scrittura per tutte le righe: niente righe a metà o duplicate)
    if (reg.sheet_stato !== 'salvato') {
      if (!dati) {
        await aggiorna({ sheet_stato: 'dati_non_disponibili' });
        log('foglio: dati temporanei non disponibili');
      } else if (!sheetConfigurato(env)) {
        await aggiorna({ sheet_stato: 'non_configurato' });
        log('foglio: configurazione mancante');
      } else {
        try {
          await deps.salvaSuSheet(righeSheet(dati, metadata, new Date(now())), env);
          await aggiorna({ sheet_stato: 'salvato' });
          log('foglio: righe aggiunte (' + dati.ospiti.length + ')');
        } catch (e) {
          da_ripetere = true;
          await aggiorna({ sheet_stato: 'errore' });
          log('foglio: errore ' + (e && (e.code || e.name) || 'sconosciuto'));
        }
      }
    }

    // 3. email al gestore: immagini del documento + PDF di riepilogo (se il PDF fallisce, l'email parte comunque)
    if (!TERMINALI_EMAIL.includes(reg.email_gestore_stato)) {
      const dest = env.EMAIL_PROPRIETARIO;
      if (!dest) await aggiorna({ email_gestore_stato: 'non_configurata' });
      else if (!dati) await aggiorna({ email_gestore_stato: 'dati_non_disponibili' });
      else {
        try {
          const generaPdf = deps.generaPdfRiepilogo ? allegati => deps.generaPdfRiepilogo({ dati, metadata, allegati, env, oggi: new Date(now()) }) : undefined;
          await deps.inviaEmailGestore({ documenti: dati.documenti, riferimento: riferimentoBreve(checkinId), statoTxt: descriviStatoSheet(reg), destinatario: dest, env, generaPdf });
          await aggiorna({ email_gestore_stato: 'inviata' });
          log('email gestore: inviata');
        } catch (e) {
          if (e && e.code === 'NESSUN_ALLEGATO') { await aggiorna({ email_gestore_stato: 'dati_non_disponibili' }); log('email gestore: nessuna immagine valida'); }
          else { da_ripetere = true; await aggiorna({ email_gestore_stato: 'errore' }); log('email gestore: errore ' + descriviErroreEmail(e)); }
        }
      }
    }

    // 4. minimizzazione: niente più dati personali appena non servono
    if (tempId && !reg.dati_temporanei_eliminati_at && reg.sheet_stato === 'salvato' && TERMINALI_EMAIL.includes(reg.email_gestore_stato)) {
      await store.eliminaDatiTemporanei(tempId);
      await aggiorna({ dati_temporanei_eliminati_at: new Date(now()) });
      log('dati temporanei: eliminati');
    }
    return { esito: da_ripetere ? 'da_ripetere' : 'completato', checkinId, registro: reg };
  } finally {
    await store.rilasciaLease(checkinId).catch(() => {});
  }
}
