// tests/scansione.test.mjs — scansione facoltativa dei documenti (lettura nel browser, docs/scansione-documenti.md).
// Nessuna rete, nessun browser: le prove con il browser vero sono in tests/browser/ (vedi CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { passiOspiti, corpoFunzione, FUNZIONI_INVARIATE } from './scansione-dom.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const ATTUALI = JSON.parse(read('tests/fixtures/scansione/passi-ospiti-attuali.json'));

// ---- Comportamento di prima: con la scansione spenta nulla cambia ----

test('scansione spenta: i passi degli ospiti sono identici a quelli di prima (1, 2, 3 e 9 ospiti; italiano, inglese, tedesco)', () => {
  for (const [caso, attesi] of Object.entries(ATTUALI.casi)) {
    const [n, lingua] = caso.split('-');
    const passi = passiOspiti(ROOT, n, { lingua });
    assert.equal(passi.length, attesi.length, caso + ': numero di passi');
    passi.forEach((p, i) => {
      assert.equal(p.id, attesi[i].id, caso + ': id');
      assert.equal(p.className, attesi[i].className, caso + ': classe');
      assert.equal(p.html.length, attesi[i].caratteri, caso + ' passo ' + p.id + ': lunghezza del markup');
      assert.equal(sha(p.html), attesi[i].sha256, caso + ' passo ' + p.id + ': markup diverso da quello di prima');
    });
  }
});

test('le funzioni del percorso di oggi (documento del responsabile, validazioni, pagamento) sono quelle di prima', () => {
  const src = read('checkin.js');
  for (const f of FUNZIONI_INVARIATE) {
    const c = corpoFunzione(src, f);
    assert.ok(c, f + ': funzione non trovata');
    assert.equal(sha(c), ATTUALI.funzioni[f].sha256, f + ': funzione modificata');
  }
});
