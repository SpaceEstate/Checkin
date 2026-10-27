// api/_db.js — accesso a Neon PostgreSQL condiviso dagli endpoint del check-in.
//
// Il prefisso "_" evita che Vercel esponga il file come endpoint.
// Tre tabelle:
//  - temporary_sessions   (esistente) dati del check-in in attesa di elaborazione: anagrafiche + immagini del
//                         documento. È l'UNICO posto in cui il sistema conserva dati personali, per il tempo
//                         strettamente necessario (vedi le durate in _elabora-checkin.js e docs/gdpr/checkin-modifiche.md).
//  - checkin_adempimenti  (nuova) registro TECNICO di ogni check-in pagato: stato del TXT Alloggiati, del
//                         salvataggio su Drive e delle email. Nessun dato anagrafico: solo identificativi tecnici,
//                         data di arrivo, codici di errore (mai i valori inseriti dall'ospite).
//  - alloggiati_tabelle   (nuova) copia delle tabelle ufficiali Alloggiati Web (dati pubblici di riferimento, nessun dato personale).
//
// Nessuna funzione di questo file scrive nei log dati personali o contenuti delle righe.
import postgres from 'postgres';

let sql = null;
let schemaPronto = null;

export function getPostgresClient() {
  if (sql) return sql;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    const e = new Error('DATABASE_URL o POSTGRES_URL non configurato');
    e.code = 'DB_NON_CONFIGURATO';
    throw e;
  }
  sql = postgres(connectionString, { ssl: 'require', max: 10, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  return sql;
}

async function initSchema(db) {
  await db`
    CREATE TABLE IF NOT EXISTS temporary_sessions (
      session_id VARCHAR(255) PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    )`;
  await db`CREATE INDEX IF NOT EXISTS idx_expires_at ON temporary_sessions(expires_at)`;
  await db`
    CREATE TABLE IF NOT EXISTS checkin_adempimenti (
      checkin_id VARCHAR(40) PRIMARY KEY,
      stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
      temp_session_id VARCHAR(64),
      data_arrivo DATE,
      txt_stato VARCHAR(32) NOT NULL DEFAULT 'da_elaborare',
      txt_problemi JSONB,
      txt_nome_file VARCHAR(120),
      txt_sha256 CHAR(64),
      drive_file_id VARCHAR(128),
      drive_salvato_at TIMESTAMP,
      drive_eliminato_at TIMESTAMP,
      email_ospite_stato VARCHAR(24) NOT NULL DEFAULT 'da_inviare',
      email_gestore_stato VARCHAR(24) NOT NULL DEFAULT 'da_inviare',
      dati_temporanei_eliminati_at TIMESTAMP,
      in_corso_fino TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;
  // stato dell'invio al foglio Google (aggiunto dopo: ALTER per le tabelle già create)
  await db`ALTER TABLE checkin_adempimenti ADD COLUMN IF NOT EXISTS sheet_stato VARCHAR(24) NOT NULL DEFAULT 'da_inviare'`;
  await db`
    CREATE TABLE IF NOT EXISTS alloggiati_tabelle (
      nome VARCHAR(32) PRIMARY KEY,
      fonte VARCHAR(16) NOT NULL,
      csv_gz_b64 TEXT NOT NULL,
      aggiornata_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`;
}

async function db() {
  const c = getPostgresClient();
  if (!schemaPronto) schemaPronto = initSchema(c).catch(e => { schemaPronto = null; throw e; });
  await schemaPronto;
  return c;
}

// Colonne del registro che il codice può aggiornare (lista chiusa: niente nomi di colonna arbitrari).
const CAMPI_REGISTRO = ['sheet_stato', 'temp_session_id', 'data_arrivo', 'txt_stato', 'txt_problemi', 'txt_nome_file', 'txt_sha256', 'drive_file_id',
  'drive_salvato_at', 'drive_eliminato_at', 'email_ospite_stato', 'email_gestore_stato', 'dati_temporanei_eliminati_at'];

// Implementazione PostgreSQL dello "store" usato da _elabora-checkin.js e dagli endpoint.
// I test usano un'implementazione in memoria con la stessa interfaccia.
export const pgStore = {
  async salvaDatiTemporanei(sessionId, dati, scadenza) {
    const d = await db();
    const r = await d`
      INSERT INTO temporary_sessions (session_id, data, expires_at)
      VALUES (${sessionId}, ${d.json(dati)}, ${scadenza})
      ON CONFLICT (session_id) DO NOTHING
      RETURNING session_id`;
    return r.length ? 'ok' : 'esiste';
  },
  async leggiDatiTemporanei(sessionId) {
    const d = await db();
    const r = await d`SELECT data FROM temporary_sessions WHERE session_id = ${sessionId} AND expires_at > NOW() LIMIT 1`;
    if (!r.length) return null;
    const v = r[0].data;
    return typeof v === 'string' ? JSON.parse(v) : v;
  },
  // La scadenza si può solo ALLUNGARE fino al limite passato (mai oltre): serve a tenere i dati per i retry.
  async estendiScadenzaDatiTemporanei(sessionId, finoA) {
    const d = await db();
    await d`UPDATE temporary_sessions SET expires_at = ${finoA} WHERE session_id = ${sessionId} AND expires_at < ${finoA}`;
  },
  async eliminaDatiTemporanei(sessionId) {
    const d = await db();
    const r = await d`DELETE FROM temporary_sessions WHERE session_id = ${sessionId} RETURNING session_id`;
    return r.length;
  },
  async pulisciScaduti(giorniRegistro) {
    const d = await db();
    const s = await d`DELETE FROM temporary_sessions WHERE expires_at < NOW() RETURNING session_id`;
    // Registro tecnico: si tiene finché il TXT è su Drive (promemoria per la cancellazione), poi `giorniRegistro` giorni.
    const g = Math.max(1, parseInt(giorniRegistro, 10) || 30);
    const r = await d`
      DELETE FROM checkin_adempimenti
      WHERE (drive_file_id IS NULL OR drive_eliminato_at IS NOT NULL)
        AND COALESCE(drive_eliminato_at, updated_at) < NOW() - make_interval(days => ${g})
      RETURNING checkin_id`;
    return { sessioni: s.length, registri: r.length };
  },
  async ottieniOCreaRegistro({ checkinId, stripeSessionId, tempSessionId, dataArrivo }) {
    const d = await db();
    await d`
      INSERT INTO checkin_adempimenti (checkin_id, stripe_session_id, temp_session_id, data_arrivo)
      VALUES (${checkinId}, ${stripeSessionId}, ${tempSessionId || null}, ${dataArrivo || null})
      ON CONFLICT (checkin_id) DO NOTHING`;
    const r = await d`SELECT * FROM checkin_adempimenti WHERE checkin_id = ${checkinId}`;
    return r[0] || null;
  },
  async leggiRegistro(checkinId) {
    const d = await db();
    const r = await d`SELECT * FROM checkin_adempimenti WHERE checkin_id = ${checkinId}`;
    return r[0] || null;
  },
  async elencoRegistri(limite) {
    const d = await db();
    const n = Math.min(200, Math.max(1, parseInt(limite, 10) || 50));
    return d`
      SELECT checkin_id, data_arrivo, sheet_stato, txt_stato, txt_problemi, txt_nome_file, drive_salvato_at, drive_eliminato_at,
             email_ospite_stato, email_gestore_stato, dati_temporanei_eliminati_at, created_at, updated_at
      FROM checkin_adempimenti ORDER BY created_at DESC LIMIT ${n}`;
  },
  // "Lease" per evitare due elaborazioni contemporanee dello stesso pagamento (Stripe può consegnare due volte lo stesso evento).
  async acquisisciLease(checkinId, durataMs) {
    const d = await db();
    const fino = new Date(Date.now() + durataMs);
    const r = await d`
      UPDATE checkin_adempimenti SET in_corso_fino = ${fino}
      WHERE checkin_id = ${checkinId} AND (in_corso_fino IS NULL OR in_corso_fino < NOW())
      RETURNING checkin_id`;
    return r.length === 1;
  },
  async rilasciaLease(checkinId) {
    const d = await db();
    await d`UPDATE checkin_adempimenti SET in_corso_fino = NULL WHERE checkin_id = ${checkinId}`;
  },
  async aggiornaRegistro(checkinId, patch) {
    const d = await db();
    const campi = Object.keys(patch).filter(k => CAMPI_REGISTRO.includes(k));
    if (!campi.length) return;
    const valori = {};
    for (const k of campi) valori[k] = k === 'txt_problemi' && patch[k] != null ? d.json(patch[k]) : patch[k];
    await d`UPDATE checkin_adempimenti SET ${d(valori, campi)}, updated_at = NOW() WHERE checkin_id = ${checkinId}`;
  },
  async leggiTabella(nome) {
    const d = await db();
    const r = await d`SELECT fonte, csv_gz_b64, aggiornata_at FROM alloggiati_tabelle WHERE nome = ${nome}`;
    return r[0] ? { fonte: r[0].fonte, csvGzB64: r[0].csv_gz_b64, aggiornataMs: new Date(r[0].aggiornata_at).getTime() } : null;
  },
  async salvaTabella(nome, fonte, csvGzB64) {
    const d = await db();
    await d`
      INSERT INTO alloggiati_tabelle (nome, fonte, csv_gz_b64, aggiornata_at) VALUES (${nome}, ${fonte}, ${csvGzB64}, NOW())
      ON CONFLICT (nome) DO UPDATE SET fonte = EXCLUDED.fonte, csv_gz_b64 = EXCLUDED.csv_gz_b64, aggiornata_at = NOW()`;
  }
};
