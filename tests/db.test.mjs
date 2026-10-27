// Test dello store PostgreSQL (api/_db.js) su un database DI PROVA locale.
// Eseguito solo se TEST_DATABASE_URL è impostata (MAI il database di produzione): altrimenti SKIP.
import './setup-env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkinFamiglia, ENV_DRIVE, contieneSensibili } from './helpers.mjs';

const URL_TEST = process.env.TEST_DATABASE_URL;
const salta = !URL_TEST ? 'SKIP — TEST_DATABASE_URL non impostata: store PostgreSQL non verificabile in questo ambiente' : false;

test('store PostgreSQL: dati temporanei, registro, lease, pulizia, tabelle', { skip: salta }, async () => {
  process.env.DATABASE_URL = URL_TEST;
  const { pgStore, getPostgresClient } = await import('../api/_db.js');
  const sql = getPostgresClient();
  await sql`DROP TABLE IF EXISTS temporary_sessions, checkin_adempimenti, alloggiati_tabelle`;
  const id = 'temp_1762000000000_dbtest';
  assert.equal(await pgStore.salvaDatiTemporanei(id, checkinFamiglia(), new Date(Date.now() + 3600e3)), 'ok');
  assert.equal(await pgStore.salvaDatiTemporanei(id, { altro: 1 }, new Date(Date.now() + 3600e3)), 'esiste', 'nessuna sovrascrittura');
  assert.equal((await pgStore.leggiDatiTemporanei(id)).ospiti[0].cognome, 'Provaccia');
  // formato delle righe salvate dalla versione precedente (stringa JSON castata a jsonb): ancora leggibile
  await sql`INSERT INTO temporary_sessions (session_id, data, expires_at) VALUES ('temp_1_vecchio', ${JSON.stringify({ ospiti: [] })}::jsonb, NOW() + interval '1 hour')`;
  assert.deepEqual(await pgStore.leggiDatiTemporanei('temp_1_vecchio'), { ospiti: [] });
  // la scadenza si può solo allungare
  const limite = new Date(Date.now() + 72 * 3600e3);
  await pgStore.estendiScadenzaDatiTemporanei(id, limite);
  await pgStore.estendiScadenzaDatiTemporanei(id, new Date(Date.now() + 1000));
  const [{ expires_at }] = await sql`SELECT expires_at FROM temporary_sessions WHERE session_id = ${id}`;
  assert.ok(Math.abs(new Date(expires_at) - limite) < 2000);
  // scaduti non leggibili ed eliminati dalla pulizia
  await sql`UPDATE temporary_sessions SET expires_at = NOW() - interval '1 minute' WHERE session_id = 'temp_1_vecchio'`;
  assert.equal(await pgStore.leggiDatiTemporanei('temp_1_vecchio'), null);
  const ck = 'ckdb00000000000001';
  const reg = await pgStore.ottieniOCreaRegistro({ checkinId: ck, stripeSessionId: 'cs_test_db', tempSessionId: id, dataArrivo: '2026-11-05' });
  assert.equal(reg.txt_stato, 'da_elaborare');
  assert.equal(await pgStore.acquisisciLease(ck, 60e3), true);
  assert.equal(await pgStore.acquisisciLease(ck, 60e3), false, 'lease già presa');
  await pgStore.rilasciaLease(ck);
  assert.equal(await pgStore.acquisisciLease(ck, 60e3), true);
  await pgStore.rilasciaLease(ck);
  await pgStore.aggiornaRegistro(ck, { txt_stato: 'non_valido', txt_problemi: [{ sev: 'errore', ospite: 1, campo: 'comune', code: 'X' }], campo_non_ammesso: 'ignorato' });
  const r2 = await pgStore.leggiRegistro(ck);
  assert.equal(r2.txt_stato, 'non_valido'); assert.equal(r2.txt_problemi[0].code, 'X');
  const p = await pgStore.pulisciScaduti(30);
  assert.equal(p.sessioni, 1);
  await sql`UPDATE checkin_adempimenti SET updated_at = NOW() - interval '31 days' WHERE checkin_id = ${ck}`;
  assert.equal((await pgStore.pulisciScaduti(30)).registri, 1);
  await pgStore.salvaTabella('Luoghi', 'manuale', 'abc');
  assert.equal((await pgStore.leggiTabella('Luoghi')).fonte, 'manuale');
  assert.equal(await pgStore.eliminaDatiTemporanei(id), 1);
});

test('flusso completo sullo store PostgreSQL (foglio ed email simulati)', { skip: salta }, async () => {
  process.env.DATABASE_URL = URL_TEST;
  const { pgStore, getPostgresClient } = await import('../api/_db.js');
  const { elaboraCheckin, checkinIdDa } = await import('../api/_elabora-checkin.js');
  const sql = getPostgresClient();
  const tempId = 'temp_1762000000000_flusso';
  await sql`DELETE FROM temporary_sessions WHERE session_id = ${tempId}`;
  await sql`DELETE FROM checkin_adempimenti WHERE stripe_session_id = 'cs_test_flussodb'`;
  await pgStore.salvaDatiTemporanei(tempId, checkinFamiglia(), new Date(Date.now() + 3600e3));
  const foglio = [], inviate = []; let fallisci = 1;
  const deps = { store: pgStore, env: Object.assign({ EMAIL_PROPRIETARIO: 'g@esempio.invalid', SHEET_ID: 'FOGLIO_FINTO' }, ENV_DRIVE),
    salvaSuSheet: async righe => { if (fallisci-- > 0) throw new Error('x'); foglio.push(...righe); },
    inviaEmailOspite: async () => {}, inviaEmailGestore: async a => { inviate.push(a.documenti.length); } };
  const s = { id: 'cs_test_flussodb', customer_details: { email: 'o@esempio.invalid' }, metadata: { dataCheckin: '2026-11-05', numeroOspiti: '3', numeroNotti: '3', totale: '13.5', lingua: 'it', temp_session_id: tempId } };
  assert.equal((await elaboraCheckin(s, deps)).esito, 'da_ripetere');
  assert.ok(await pgStore.leggiDatiTemporanei(tempId), 'dati ancora presenti dopo l\'errore del foglio');
  assert.equal((await elaboraCheckin(s, deps)).esito, 'completato');
  assert.equal(await pgStore.leggiDatiTemporanei(tempId), null, 'dati eliminati dopo il successo');
  const reg = await pgStore.leggiRegistro(checkinIdDa(s.id));
  assert.equal(reg.sheet_stato, 'salvato'); assert.equal(foglio.length, 3); assert.deepEqual(inviate, [2]);
  assert.deepEqual(contieneSensibili(JSON.stringify(reg)), []);
  await sql.end();
});
