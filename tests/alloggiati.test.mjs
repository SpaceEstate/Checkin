// Test del TXT Alloggiati Web: formato (porting fedele da LaColumbera) e traduzione dei dati del check-in.
// Dati e tabelle di fantasia. Esecuzione: cd api && npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as AL from '../api/_alloggiati.js';
import { generaTxt, costruisciSchedine, problemiCorreggibiliDallOspite, problemiSenzaDati, nomeFileTxt } from '../api/_checkin-alloggiati.js';
import { tabelle, checkinFamiglia, NOW, VALORI_SENSIBILI, TABELLE_CSV } from './helpers.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const fx = n => fs.readFileSync(path.join(dir, 'fixtures', 'alloggiati', n), 'utf8');

test('formato: le fixture di LaColumbera si rileggono e si ricostruiscono identiche (168 caratteri, nessun errore)', () => {
  for (const [f, n] of [['ospite-singolo.txt', 1], ['famiglia.txt', 4], ['gruppo.txt', 3]]) {
    const text = fx(f), p = AL.parseText(text);
    assert.equal(p.records.length, n, f);
    const v = AL.validateRecords(p.records, { now: Date.parse('2026-10-14T08:00:00Z'), tables: tabelle() });
    assert.equal(v.riepilogo.errori, 0, f + ' ' + JSON.stringify(v.records.map(r => r.issues)));
    assert.deepEqual(v.lines, text.split('\n'), f);
    assert.ok(v.lines.every(l => Array.from(l).length === 168));
  }
});

test('porting: stesso risultato del modulo originale di LaColumbera (se disponibile)', (t) => {
  const base = process.env.LACOLUMBERA_DIR;
  if (!base || !fs.existsSync(path.join(base, 'api', '_alloggiati.js'))) { t.skip('SKIP — LACOLUMBERA_DIR non impostata: confronto con il modulo originale non eseguibile qui'); return; }
  const req = createRequire(path.join(base, 'api', 'package.json'));
  const ORIG = req(path.join(base, 'api', '_alloggiati.js')), ORIGWS = req(path.join(base, 'api', '_alloggiati_ws.js'));
  const tabsO = { luoghi: ORIGWS.buildTable('Luoghi', TABELLE_CSV.Luoghi), documenti: ORIGWS.buildTable('Tipi_Documento', TABELLE_CSV.Tipi_Documento), tipi: ORIGWS.buildTable('Tipi_Alloggiato', TABELLE_CSV.Tipi_Alloggiato) };
  const casi = [];
  for (const f of ['ospite-singolo.txt', 'famiglia.txt', 'gruppo.txt']) casi.push(AL.parseText(fx(f)).records);
  const { records } = costruisciSchedine(checkinFamiglia(), tabelle());
  casi.push(records.map(r => { const o = Object.assign({}, r); delete o._ospite; return o; }));
  casi.push([Object.assign({}, casi[0][0], { cognome: 'Rossi-Bianchi', giorni: '45', nascita: '31/02/1990' })]);
  for (const recs of casi) {
    const a = AL.validateRecords(recs, { now: NOW, tables: tabelle() }), b = ORIG.validateRecords(recs, { now: NOW, tables: tabsO });
    assert.deepEqual(a.lines, b.lines); assert.equal(a.hash, b.hash);
    assert.deepEqual(a.records.map(r => r.issues.map(i => i.code + ':' + i.campo)), b.records.map(r => r.issues.map(i => i.code + ':' + i.campo)));
  }
  const ws1 = fs.readFileSync(path.join(base, 'api', '_alloggiati_ws.js'), 'utf8'), ws2 = fs.readFileSync(path.join(dir, '..', 'api', '_alloggiati_ws.js'), 'utf8');
  for (const fn of ['function parseCsv', 'function buildTable', 'function search', 'async function tabella', 'async function generateToken', 'async function call']) {
    const estrai = s => { const i = s.indexOf(fn); return s.slice(i, s.indexOf('\n}\n', i)); };
    assert.equal(estrai(ws2), estrai(ws1), fn + ' copiata senza modifiche');
  }
});

test('TXT famiglia: ordine 17 + 19, 168 caratteri per riga, separatore CRLF, codici dalle tabelle', () => {
  const g = generaTxt(checkinFamiglia(), tabelle(), NOW);
  assert.equal(g.ok, true, JSON.stringify(g.problemi));
  const righe = g.txt.split('\r\n');
  assert.equal(righe.pop(), '', 'il file termina con CRLF');
  assert.equal(righe.length, 3);
  assert.ok(righe.every(r => Array.from(r).length === 168));
  const p = righe.map(r => AL.parseText(r).records[0]);
  assert.deepEqual(p.map(r => r.tipo), ['17', '19', '19']);
  assert.deepEqual(p.map(r => r.arrivo), ['05/11/2026', '05/11/2026', '05/11/2026']);
  assert.deepEqual(p.map(r => r.giorni), ['03', '03', '03']);
  assert.equal(p[0].cognome, 'Provaccia'); assert.equal(p[0].sesso, '2'); assert.equal(p[0].nascita, '19/04/1980');
  assert.equal(p[0].stato, '100000100'); assert.equal(p[0].comune, '400000010'); assert.equal(p[0].prov, 'RM');
  assert.equal(p[0].tipodoc, 'IDELE'); assert.equal(p[0].numdoc, 'ZZ9900011'); assert.equal(p[0].luogo, '100000100');
  assert.equal(p[1].stato, '100000901'); assert.equal(p[1].comune, ''); assert.equal(p[1].prov, ''); assert.equal(p[1].tipodoc, '');
  assert.equal(p[2].comune, '400000011', "Reggio nell'Emilia trovato per nome esatto");
  assert.ok(g.avvisi.some(a => a.code === 'RILASCIO_ITALIA'), 'avviso sul luogo di rilascio Italia');
  // stesso risultato rileggendo con il parser di riferimento
  const v = AL.validateRecords(AL.parseText(g.txt).records, { now: NOW, tables: tabelle() });
  assert.equal(v.riepilogo.errori, 0); assert.equal(v.hash, g.hash);
});

test('TXT ospite singolo → 16; gruppo → 18 + 20', () => {
  const uno = checkinFamiglia({ numeroOspiti: 1, tipoGruppo: null });
  uno.ospiti = uno.ospiti.slice(0, 1);
  const g1 = generaTxt(uno, tabelle(), NOW);
  assert.equal(g1.ok, true); assert.equal(g1.lines[0].slice(0, 2), '16');
  const g2 = generaTxt(checkinFamiglia({ tipoGruppo: 'generico' }), tabelle(), NOW);
  assert.equal(g2.ok, true); assert.deepEqual(g2.lines.map(l => l.slice(0, 2)), ['18', '20', '20']);
});

test('record non validi o incompleti: nessun TXT, nessuna correzione silenziosa', () => {
  const casi = [
    [checkinFamiglia({ tipoGruppo: null }), 'TIPO_GRUPPO'],
    [(() => { const d = checkinFamiglia(); d.ospiti[0].comune = 'Rome'; return d; })(), 'COMUNE_NON_IN_TABELLA'],
    [(() => { const d = checkinFamiglia(); d.ospiti[1].cittadinanza = 'Atlantide'; return d; })(), 'STATO_NON_IN_TABELLA'],
    [(() => { const d = checkinFamiglia(); d.ospiti[2].nascita = ''; return d; })(), 'OBBLIGATORIO'],
    [(() => { const d = checkinFamiglia(); d.ospiti[0].cognome = 'Provaccia-Esempio'; return d; })(), 'CARATTERE'],
    [(() => { const d = checkinFamiglia(); d.ospiti[0].numeroDocumento = ''; return d; })(), 'OBBLIGATORIO'],
    [(() => { const d = checkinFamiglia(); d.ospiti[0].tipoDocumento = 'TESSERA INVENTATA'; return d; })(), 'DOCUMENTO_NON_IN_TABELLA'],
    [checkinFamiglia({ numeroNotti: 45 }), 'VALORE'],
    [checkinFamiglia({ numeroOspiti: 2 }), 'NUMERO_OSPITI'],
    [(() => { const d = checkinFamiglia(); d.ospiti[0].comune = 'San Michele'; d.ospiti[0].provincia = 'TN'; return d; })(), null],      // due voci, una cessata: si usa quella attiva
    [(() => { const d = checkinFamiglia(); d.ospiti[0].comune = 'Castello'; d.ospiti[0].provincia = 'BG'; return d; })(), 'COMUNE_AMBIGUO']
  ];
  for (const [dati, atteso] of casi) {
    const copia = JSON.stringify(dati);
    const g = generaTxt(dati, tabelle(), NOW);
    assert.equal(JSON.stringify(dati), copia, 'i dati in ingresso non vengono modificati');
    if (atteso === null) { assert.equal(g.ok, true, JSON.stringify(g.problemi)); continue; }
    assert.equal(g.ok, false, atteso); assert.equal(g.txt, undefined, 'nessun file prodotto');
    assert.ok(g.problemi.some(p => p.code === atteso), atteso + ' → ' + JSON.stringify(g.problemi.map(p => p.code)));
  }
});

test('tabelle ufficiali assenti: nessun TXT (niente liste di ripiego)', () => {
  const g = generaTxt(checkinFamiglia(), null, NOW);
  assert.equal(g.ok, false); assert.equal(g.problemi[0].code, 'TABELLE');
});

test('problemi per l\'ospite: solo quelli che può correggere, con suggerimenti dalla tabella', () => {
  const d = checkinFamiglia(); d.ospiti[2].comune = 'Reggio Emilia'; d.ospiti[1].cittadinanza = 'Atlantide';
  const g = generaTxt(d, tabelle(), NOW);
  const p = problemiCorreggibiliDallOspite(g.problemi);
  assert.equal(p.length, 1);
  assert.deepEqual(Object.assign({}, p[0], { suggerimenti: undefined }), { ospite: 3, campo: 'comune', codice: 'comune_non_trovato', suggerimenti: undefined });
  assert.ok(p[0].suggerimenti.some(s => s.startsWith("REGGIO NELL'EMILIA")));
});

test('registro tecnico: i problemi salvati non contengono valori inseriti', () => {
  const d = checkinFamiglia(); d.ospiti[0].cognome = 'Provaccia-Esempio'; d.ospiti[0].comune = 'Rome';
  const s = JSON.stringify(problemiSenzaDati(generaTxt(d, tabelle(), NOW).problemi));
  assert.deepEqual(VALORI_SENSIBILI.filter(v => s.includes(v)), []);
  assert.ok(!s.includes('Rome'));
});

test('nome del file senza dati identificativi', () => {
  const n = nomeFileTxt('2026-11-05', 'ck0123456789abcdef');
  assert.equal(n, 'alloggiati_2026-11-05_ck0123456789abcdef.txt');
  assert.ok(!/Provaccia|Ermenegilda|ZZ99/.test(n));
});
