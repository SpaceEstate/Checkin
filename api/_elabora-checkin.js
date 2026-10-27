// api/_elabora-checkin.js — cosa succede dopo un pagamento confermato (webhook Stripe e rielaborazione manuale).
//
// Passi, ciascuno IDEMPOTENTE (lo stato è nel registro tecnico checkin_adempimenti, quindi un nuovo tentativo rifà solo
// ciò che non è riuscito):
//   1. email di benvenuto all'ospite (codici cassetta) — invariata nei contenuti, ma riceve solo i dati che le servono;
//   2. TXT Alloggiati Web: validazione con le tabelle ufficiali → se valido, salvataggio su Google Drive;
//   3. email al gestore con la SOLA immagine del documento;
//   4. eliminazione dei dati temporanei (anagrafiche + immagini) appena il TXT è su Drive e l'email al gestore è partita.
// Se un passo fallisce per un motivo temporaneo (rete, servizio, SMTP, Drive) il risultato è "da_ripetere": il webhook
// risponde con errore e Stripe ritenta più tardi. I dati temporanei restano al massimo TTL_DOPO_PAGAMENTO_MS dal primo
// tentativo, poi vengono cancellati comunque (pulizia giornaliera + pulizia a ogni richiesta).
// Il TXT NON viene mai inviato ad Alloggiati Web: è pronto per il caricamento manuale. Nessun log con dati personali.
import crypto from 'crypto';
import { generaTxt, nomeFileTxt, problemiSenzaDati } from './_checkin-alloggiati.js';
import { descriviErroreDrive } from './_drive.js';
import { descriviErroreEmail } from './_email-gestore.js';

export const TTL_PRIMA_DEL_PAGAMENTO_MS = 2 * 3600e3;    // checkout Stripe scade dopo 30 minuti: 2 ore bastano
export const TTL_DOPO_PAGAMENTO_MS = 72 * 3600e3;        // finestra massima per i nuovi tentativi (Stripe ritenta fino a ~3 giorni)
export const LEASE_MS = 55e3;

export const checkinIdDa = stripeSessionId => 'ck' + crypto.createHash('sha256').update(String(stripeSessionId)).digest('hex').slice(0, 16);
export const riferimentoBreve = checkinId => String(checkinId).slice(0, 10);

const TERMINALI_EMAIL = ['inviata', 'non_disponibile', 'non_configurata', 'dati_non_disponibili'];
const TXT_FINITI = ['salvato_drive'];

function descriviStatoTxt(reg) {
  switch (reg.txt_stato) {
    case 'salvato_drive': return 'salvato su Google Drive (' + reg.txt_nome_file + '), da caricare A MANO sul portale. NON è stato inviato.';
    case 'non_valido': return 'NON generato: i dati contengono problemi da correggere (endpoint admin-alloggiati, azione "bozza"). Entro 72 ore i dati vengono cancellati.';
    case 'drive_non_configurato': return 'generato ma NON salvato su Drive (configurazione mancante): scaricalo dall\'endpoint admin-alloggiati, azione "scarica-txt", entro 72 ore.';
    case 'drive_conflitto': return 'NON salvato: su Drive esiste già un file diverso per questo check-in. Controlla la cartella.';
    case 'tabelle_non_configurate': return 'NON generato: tabelle ufficiali Alloggiati non disponibili (configurazione mancante).';
    case 'dati_non_disponibili': return 'NON generato: i dati del check-in non sono più disponibili.';
    default: return 'non ancora salvato (nuovo tentativo automatico in corso).';
  }
}

// deps = { store, env, now, drive, caricaTabelle(o), inviaEmailOspite(payload), inviaEmailGestore(args), log }
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

    // 2. TXT Alloggiati + Drive
    let txt = null;
    if (!TXT_FINITI.includes(reg.txt_stato)) {
      if (!dati) {
        await aggiorna({ txt_stato: 'dati_non_disponibili' });
        log('txt: dati temporanei non disponibili');
      } else {
        const tab = await deps.caricaTabelle({ store, env, fetch: deps.fetch, now, network: true, deadline: now() + 20000 });
        if (!tab.ok) {
          const config = tab.configurazioneMancante === true;
          if (!config) da_ripetere = true;
          await aggiorna({ txt_stato: config ? 'tabelle_non_configurate' : 'tabelle_non_disponibili' });
          log('txt: tabelle ufficiali non disponibili (' + (tab.motivo || '') + ')');
        } else {
          const g = generaTxt(dati, tab.tables, now());
          if (!g.ok) {
            await aggiorna({ txt_stato: 'non_valido', txt_problemi: problemiSenzaDati(g.problemi) });
            log('txt: non valido, ' + g.problemi.length + ' problemi');
          } else {
            txt = g;
            const nomeFile = nomeFileTxt(dataArrivo || dati.dataCheckin, checkinId);
            await aggiorna({ txt_sha256: crypto.createHash('sha256').update(g.txt, 'utf8').digest('hex'), txt_nome_file: nomeFile, txt_problemi: problemiSenzaDati(g.avvisi) });
            try {
              const r = await deps.drive.caricaTxt({ nomeFile, contenuto: g.txt, checkinId });
              await aggiorna({ txt_stato: 'salvato_drive', drive_file_id: r.fileId, drive_salvato_at: new Date(now()) });
              log('txt: salvato su Drive' + (r.riutilizzato ? ' (già presente, nessun duplicato)' : ''));
            } catch (e) {
              const stato = e.kind === 'non_configurato' ? 'drive_non_configurato' : e.kind === 'contenuto_diverso_gia_presente' ? 'drive_conflitto' : 'errore_drive';
              if (stato === 'errore_drive') da_ripetere = true;
              await aggiorna({ txt_stato: stato });
              log('txt: Drive ' + descriviErroreDrive(e));
            }
          }
        }
      }
    }

    // 3. email al gestore: solo immagini del documento
    if (!TERMINALI_EMAIL.includes(reg.email_gestore_stato)) {
      const dest = env.EMAIL_PROPRIETARIO;
      if (!dest) await aggiorna({ email_gestore_stato: 'non_configurata' });
      else if (!dati) await aggiorna({ email_gestore_stato: 'dati_non_disponibili' });
      else {
        try {
          await deps.inviaEmailGestore({ documenti: dati.documenti, riferimento: riferimentoBreve(checkinId), statoTxt: descriviStatoTxt(reg), destinatario: dest, env });
          await aggiorna({ email_gestore_stato: 'inviata' });
          log('email gestore: inviata');
        } catch (e) {
          if (e && e.code === 'NESSUN_ALLEGATO') { await aggiorna({ email_gestore_stato: 'dati_non_disponibili' }); log('email gestore: nessuna immagine valida'); }
          else { da_ripetere = true; await aggiorna({ email_gestore_stato: 'errore' }); log('email gestore: errore ' + descriviErroreEmail(e)); }
        }
      }
    }

    // 4. minimizzazione: niente più dati personali appena non servono
    if (tempId && !reg.dati_temporanei_eliminati_at && reg.txt_stato === 'salvato_drive' && TERMINALI_EMAIL.includes(reg.email_gestore_stato)) {
      await store.eliminaDatiTemporanei(tempId);
      await aggiorna({ dati_temporanei_eliminati_at: new Date(now()) });
      log('dati temporanei: eliminati');
    }
    return { esito: da_ripetere ? 'da_ripetere' : 'completato', checkinId, registro: reg, txtGenerato: !!txt };
  } finally {
    await store.rilasciaLease(checkinId).catch(() => {});
  }
}
