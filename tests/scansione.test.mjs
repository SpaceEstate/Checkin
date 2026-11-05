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

// ---- Librerie ospitate nel sito ----

test('librerie della scansione: file identici a quelli registrati (impronte SHA-256), nessun file in più, licenze presenti', () => {
  const dir = path.join(ROOT, 'scansione', 'vendor');
  const righe = read('scansione/vendor/impronte.sha256').trim().split('\n');
  const attesi = new Map(righe.map(r => { const [h, f] = r.split(/\s+/); return [f.replace(/^\.\//, ''), h]; }));
  const presenti = [];
  (function giro(d) { for (const x of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, x.name); if (x.isDirectory()) giro(p); else presenti.push(path.relative(dir, p)); } })(dir);
  for (const f of presenti.filter(f => !['LEGGIMI.md', 'impronte.sha256'].includes(f))) {
    assert.ok(attesi.has(f), 'file non registrato in impronte.sha256: ' + f);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex'), attesi.get(f), 'file modificato: ' + f);
  }
  for (const f of attesi.keys()) assert.ok(presenti.includes(f), 'file mancante: ' + f);
  for (const f of ['tesseract/LICENSE.md', 'tesseract-core/LICENSE', 'tessdata/LICENSE-Apache-2.0.txt', 'mrz/LICENSE', 'heic-to/LICENSE', 'heic-to/COPYING-GPL-3.0.txt']) assert.ok(attesi.has(f), 'licenza mancante: ' + f);
  assert.match(read('scansione/vendor/heic-to/LICENSE'), /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 3/);
  assert.match(read('scansione/vendor/heic-to/COPYING-GPL-3.0.txt'), /GNU GENERAL PUBLIC LICENSE\s+Version 3/);
  assert.match(read('scansione/vendor/tesseract/LICENSE.md'), /Apache License/);
  // il modello è compresso (gzip): Tesseract.js lo scarica come eng.traineddata.gz
  const gz = fs.readFileSync(path.join(dir, 'tessdata', 'eng.traineddata.gz'));
  assert.ok(gz[0] === 0x1f && gz[1] === 0x8b, 'eng.traineddata.gz non è un file gzip');
});

test('build.sh copia la scansione in public/ (Vercel) e .gitignore esclude le immagini di documenti dalle prove', () => {
  assert.match(read('build.sh'), /\ncp -r scansione\/\. public\/scansione\/\n/);
  const gi = read('.gitignore');
  for (const r of ['/public/scansione/', '/tests/**/locali/', '/tests/**/*.jpg', '/tests/**/*.png', '/tests/**/*.pdf', '*.heic']) assert.ok(gi.split('\n').includes(r), '.gitignore: ' + r);
});
