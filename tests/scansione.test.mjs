// tests/scansione.test.mjs — scansione facoltativa dei documenti (lettura nel browser, docs/scansione-documenti.md).
// Nessuna rete, nessun browser: le prove con il browser vero sono in tests/browser/ (vedi CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import vm from 'vm';
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

// ---- Lettura dei documenti (scansione/lettura-documento.js): solo dati di fantasia ----
const L = await import('../scansione/lettura-documento.js');
const OGGI = Date.parse('2026-11-05T10:00:00Z');
const SRC_CHECKIN = read('checkin.js');
const STATI = JSON.parse(/const stati = (\[[^\]]*\]);/.exec(SRC_CHECKIN)[1]);
const PROVINCE = JSON.parse(/const province = (\[[^\]]*\]);/.exec(SRC_CHECKIN)[1]);
const TIPI_MODULO = JSON.parse(/const tipiDocumento = (\[[^\]]*\]);/.exec(SRC_CHECKIN)[1]);
const OPZ = { oggi: OGGI, stati: STATI, province: PROVINCE };

// Costruttori di MRZ sintetiche con le cifre di controllo ICAO 9303 giuste
const cd = s => String([...s].reduce((a, c, i) => a + (c === '<' ? 0 : /\d/.test(c) ? +c : c.charCodeAt(0) - 55) * [7, 3, 1][i % 3], 0) % 10);
const nomi = (cognome, nome) => cognome.replace(/ /g, '<') + '<<' + nome.replace(/ /g, '<');
function td3({ tipo = 'P<', stato, cognome, nome, numero, cittadinanza = stato, nascita, sesso, scadenza, personale = '' }) {
  const l1 = (tipo + stato.padEnd(3, '<') + nomi(cognome, nome)).padEnd(44, '<').slice(0, 44);
  const num = numero.padEnd(9, '<'), pers = personale.padEnd(14, '<'), pcd = personale ? cd(pers) : '<';
  const l2 = num + cd(num) + cittadinanza.padEnd(3, '<') + nascita + cd(nascita) + sesso + scadenza + cd(scadenza) + pers + pcd;
  return [l1, l2 + cd(num + cd(num) + nascita + cd(nascita) + scadenza + cd(scadenza) + pers + pcd)];
}
function td1({ tipo = 'I<', stato, cognome, nome, numero, cittadinanza = stato, nascita, sesso, scadenza, facoltativi1 = '', facoltativi2 = '' }) {
  const num = numero.padEnd(9, '<');
  const l1 = (tipo + stato.padEnd(3, '<') + num + cd(num) + facoltativi1).padEnd(30, '<').slice(0, 30);
  const l2a = nascita + cd(nascita) + sesso + scadenza + cd(scadenza) + cittadinanza.padEnd(3, '<') + facoltativi2.padEnd(11, '<');
  const l2 = l2a + cd(l1.slice(5, 30) + l2a.slice(0, 7) + l2a.slice(8, 15) + l2a.slice(18, 29));
  return [l1, l2, nomi(cognome, nome).padEnd(30, '<').slice(0, 30)];
}
const CIE_RETRO = td1({ tipo: 'CI', stato: 'ITA', cognome: 'PROVACCIA', nome: 'ERMENEGILDA', numero: 'CA00000AA', nascita: '800419', sesso: 'F', scadenza: '310419' });
const CIE_FRONTE = ['REPUBBLICA ITALIANA', 'MINISTERO DELL\'INTERNO', 'CARTA DI IDENTITA\' / IDENTITY CARD', 'CA00000AA', 'COGNOME / SURNAME', 'PROVACCIA',
  'NOME / NAME', 'ERMENEGILDA', 'LUOGO E DATA DI NASCITA / PLACE AND DATE OF BIRTH', 'ROMA (RM) 19.04.1980', 'SESSO / SEX STATURA / HEIGHT CITTADINANZA / NATIONALITY',
  'F 165 ITA', 'EMISSIONE / ISSUING SCADENZA / EXPIRY', '19.04.2021 19.04.2031'];

test('cifra di controllo ICAO 9303 e specimen ICAO (passaporto TD3 e carta TD1 di «Utopia»)', () => {
  assert.equal(L.cifraControllo('L898902C3'), '6');
  assert.equal(L.cifraControllo('740812'), '2');
  assert.equal(L.cifraControllo('120415'), '9');
  const p = L.leggiMrz(['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'], OGGI);
  assert.equal(p.formato, 'TD3');
  assert.equal(p.valida, true);
  assert.deepEqual([p.campi.cognome.valore, p.campi.nome.valore, p.campi.nascita.valore, p.campi.genere.valore, p.campi.numeroDocumento.valore],
    ['ERIKSSON', 'ANNA MARIA', '1974-08-12', 'F', 'L898902C3']);
  assert.equal(p.campi.numeroDocumento.affidabilita, L.SICURO);
  assert.equal(p.campi.nascita.affidabilita, L.SICURO);
  assert.equal(p.campi.cittadinanza, undefined, 'Utopia non è uno Stato del modulo: cittadinanza vuota');
  assert.equal(p.scadenza, '2012-04-15');
  const c = L.leggiMrz(['I<UTOD23145890<1233<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<2', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'], OGGI);
  assert.equal(c.formato, 'TD1');
  assert.equal(c.campi.numeroDocumento.valore, 'D23145890123', 'numero lungo che continua nei dati facoltativi');
  assert.equal(c.valida, true);
});

test('MRZ letta male: righe con un «<» in meno, O al posto di 0 nelle date, numero del documento corretto solo se la cifra di controllo lo conferma', () => {
  const t = L.trovaMrz(['some text', 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<', 'L898902C36UTO74O8122F12O4159ZE184226B<<<<10', 'altro']);
  assert.equal(t.formato, 'TD3');
  assert.deepEqual(t.righe, ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO74O8122F12O4159ZE184226B<<<<<10']);
  const r = L.leggiMrz(t.righe, OGGI);
  assert.equal(r.campi.nascita.valore, '1974-08-12');
  assert.equal(r.valida, true);
  // spazi, minuscole e «K» al posto di «<» in mezzo al riempimento
  assert.equal(L.pulisciRigaMrz('p<uto eriksson<<anna<maria<<<K<<<<<<<<<<<<<<<'), 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<');
  // numero del documento: «O» al posto di «0» → corretto e segnato da verificare
  const sbagliato = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L8989O2C36UTO7408122F1204159ZE184226B<<<<<10'];
  const x = L.leggiMrz(sbagliato, OGGI);
  assert.equal(x.campi.numeroDocumento.valore, 'L898902C3');
  assert.equal(x.campi.numeroDocumento.affidabilita, L.DA_VERIFICARE);
  assert.ok(x.avvisi.some(a => a.codice === 'numero_corretto'));
  // cifra di controllo sbagliata e nessuna correzione univoca: il numero resta vuoto (mai un numero non verificato dalla MRZ)
  const rotto = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C37UTO7408122F1204159ZE184226B<<<<<10'];
  assert.equal(L.leggiMrz(rotto, OGGI).campi.numeroDocumento, undefined);
  // data con cifra di controllo sbagliata: nessuna data proposta
  const dataRotta = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408125F1204159ZE184226B<<<<<10'];
  assert.equal(L.leggiMrz(dataRotta, OGGI).campi.nascita, undefined);
  assert.equal(L.trovaMrz(['testo qualsiasi', 'senza nessuna MRZ']), null);
});

test('anno a 2 cifre: nascita nel passato (1960, non 2060), scadenza nel 2000; secolo incerto segnalato', () => {
  assert.deepEqual(L.dataNascitaDaAnnoBreve('60', '01', '01', OGGI), { iso: '1960-01-01', incerta: false });
  assert.deepEqual(L.dataNascitaDaAnnoBreve('99', '12', '31', OGGI), { iso: '1999-12-31', incerta: false });
  assert.deepEqual(L.dataNascitaDaAnnoBreve('05', '06', '15', OGGI), { iso: '2005-06-15', incerta: false }, '1905 sarebbe un ospite di 121 anni');
  assert.deepEqual(L.dataNascitaDaAnnoBreve('20', '03', '01', OGGI), { iso: '2020-03-01', incerta: true }, '2020 o 1920: va controllata');
  assert.deepEqual(L.dataNascitaDaAnnoBreve('26', '11', '06', OGGI), { iso: '1926-11-06', incerta: false }, 'domani non può essere una data di nascita');
  assert.equal(L.dataNascitaDaAnnoBreve('85', '02', '30', OGGI), null, 'data inesistente');
  assert.equal(L.dataDocumentoDaAnnoBreve('31', '04', '19', OGGI), '2031-04-19');
  assert.equal(L.dataDocumentoDaAnnoBreve('12', '04', '15', OGGI), '2012-04-15');
});

test('codice fiscale: carattere di controllo, omocodia, lettura con spazi e O/0; solo controllo incrociato', () => {
  const base = 'PRVRNG80D59H501';                 // Provaccia Ermenegilda, 19/04/1980, F, Roma
  const cf = base + L.carattereControlloCF(base);
  assert.ok(L.codiceFiscaleValido(cf));
  assert.ok(!L.codiceFiscaleValido(base + (cf[15] === 'A' ? 'B' : 'A')));
  assert.equal(L.codiceCognomeCF('Provaccia'), 'PRV');
  assert.equal(L.codiceNomeCF('Ermenegilda'), 'RNG', 'con 4 o più consonanti: prima, terza e quarta');
  assert.equal(L.codiceNomeCF('Ugo'), 'GUO');
  assert.equal(L.trovaCodiceFiscale('CODICE FISCALE / FISCAL CODE\n' + cf.slice(0, 8) + ' ' + cf.slice(8)), cf);
  assert.equal(L.trovaCodiceFiscale(cf.replace('80', '8O')), cf, 'O al posto di 0 nella posizione di una cifra');
  // parole e righe MRZ non diventano mai un codice fiscale per caso (prima «PASSPORT PASSEPORT» dava «ASSPORTPASSEP0RT»)
  for (const testo of ['REISEPASS / PASSPORT / PASSEPORT', 'C01X00T478D<<1011108M3001019<<<<<<<<<<<<<<<8', 'P<D<<PROVACCIA<<TEODORICO<<<<<<<<<<<<<<<<<<<<',
    'BUNDESREPUBLIKDEU', 'DEUTSCHLANDREISE PASS']) assert.equal(L.trovaCodiceFiscale(testo), null, testo);
  const d = L.decodificaCF(cf);
  assert.deepEqual([d.annoBreve, d.mese, d.giorno, d.genere, d.natoAllEstero], ['80', 4, 19, 'F', false]);
  const omo = 'PRVRNG8LD59H501'; const cfOmo = omo + L.carattereControlloCF(omo);
  assert.ok(L.codiceFiscaleValido(cfOmo)); assert.equal(L.decodificaCF(cfOmo).annoBreve, '80');
  assert.deepEqual(L.confrontaCF(cf, { cognome: 'PROVACCIA', nome: 'ERMENEGILDA', nascita: '1980-04-19', genere: 'F' }), { cognome: true, nome: true, nascita: true, genere: true });
  assert.deepEqual(L.confrontaCF(cf, { cognome: 'ERMENEGILDA', nome: 'PROVACCIA', nascita: '1980-04-19', genere: 'M' }), { cognome: false, nome: false, nascita: true, genere: false });
});

test('codici della MRZ → voci del modulo: tutti gli Stati del modulo, Germania «D», codici speciali senza voce', () => {
  const valori = new Set(Object.values(L.ISO_STATI));
  for (const v of valori) assert.ok(STATI.includes(v), 'voce inesistente nel modulo: ' + v);
  for (const s of STATI) assert.ok(valori.has(s), 'Stato del modulo senza codice: ' + s);
  assert.equal(L.statoDaCodice('D<<').stato, 'Germania');
  assert.equal(L.statoDaCodice('DEU').stato, 'Germania');
  assert.equal(L.statoDaCodice('ITA').stato, 'Italia');
  for (const c of ['XXA', 'XXB', 'UNO', 'RKS', 'GBN']) assert.deepEqual([L.statoDaCodice(c).stato, L.statoDaCodice(c).motivo], [null, 'senza_voce'], c);
  assert.equal(L.statoDaCodice('UTO').stato, null);
  assert.deepEqual(Object.values(L.TIPI_DOCUMENTO).sort(), TIPI_MODULO.slice().sort(), 'tipi di documento = elenco del modulo');
});

test('CIE italiana: retro (MRZ) e fronte (testo stampato) → campi del responsabile, tipo proposto, codici del modulo', () => {
  const mrz = L.leggiMrz(L.trovaMrz(CIE_RETRO).righe, OGGI);
  assert.equal(mrz.valida, true);
  const stampato = L.leggiTestoStampato(CIE_FRONTE, OPZ);
  assert.deepEqual([stampato.cognome, stampato.nome, stampato.nascita, stampato.sesso, stampato.numero], ['PROVACCIA', 'ERMENEGILDA', '1980-04-19', 'F', 'CA00000AA']);
  assert.deepEqual(stampato.luogo, { stato: 'Italia', comune: 'ROMA', provincia: 'RM' });
  assert.equal(stampato.scadenza, '2031-04-19');
  const r = L.combinaLetture([{ mrz, stampato: L.leggiTestoStampato(CIE_RETRO, OPZ) }, { mrz: null, stampato }], Object.assign({ responsabile: true }, OPZ));
  const v = k => r.campi[k] && r.campi[k].valore, a = k => r.campi[k] && r.campi[k].affidabilita;
  assert.deepEqual([v('cognome'), v('nome'), v('genere'), v('nascita'), v('cittadinanza'), v('luogoNascita'), v('comune'), v('provincia')],
    ['PROVACCIA', 'ERMENEGILDA', 'F', '1980-04-19', 'Italia', 'Italia', 'ROMA', 'RM']);
  assert.deepEqual([v('tipoDocumento'), v('numeroDocumento'), v('luogoRilascio')], ["CARTA IDENTITA' ELETTRONICA", 'CA00000AA', 'Italia']);
  assert.deepEqual([a('cognome'), a('nome'), a('nascita'), a('numeroDocumento'), a('cittadinanza'), a('genere')], [L.SICURO, L.SICURO, L.SICURO, L.SICURO, L.SICURO, L.SICURO]);
  assert.deepEqual([a('luogoNascita'), a('comune'), a('provincia'), a('tipoDocumento')], [L.DA_VERIFICARE, L.DA_VERIFICARE, L.DA_VERIFICARE, L.DA_VERIFICARE], 'testo stampato: sempre da verificare');
  assert.equal(r.esito, 'ok');
  assert.equal(r.documento.tipo, 'cie');
  assert.ok(!r.avvisi.some(x => x.codice === 'documento_scaduto'));
});

test('altri ospiti: si propongono solo i dati anagrafici, mai quelli del documento (minimizzazione)', () => {
  const r = L.combinaLetture([{ mrz: L.leggiMrz(L.trovaMrz(CIE_RETRO).righe, OGGI), stampato: L.leggiTestoStampato(CIE_FRONTE, OPZ) }], Object.assign({ responsabile: false }, OPZ));
  assert.deepEqual(Object.keys(r.campi).sort(), ['cittadinanza', 'cognome', 'comune', 'genere', 'luogoNascita', 'nascita', 'nome', 'provincia']);
});

test('passaporti, carte straniere, documenti di viaggio: tipo solo suggerito o lasciato all\'ospite (mai «passaporto ordinario» a caso)', () => {
  const base = { stato: 'DEU', cognome: 'MUSTERMANN', nome: 'ERIKA', numero: 'C01X00T47', nascita: '640812', sesso: 'F', scadenza: '310801' };
  const tipo = righe => L.combinaLetture([{ mrz: L.leggiMrz(L.trovaMrz(righe).righe, OGGI), stampato: null }], Object.assign({ responsabile: true }, OPZ));
  const p = tipo(td3(Object.assign({}, base, { stato: 'D', cittadinanza: 'D' })));
  assert.equal(p.campi.tipoDocumento.valore, null);
  assert.equal(p.campi.tipoDocumento.suggerimento, 'PASSAPORTO ORDINARIO');
  assert.equal(p.campi.cittadinanza.valore, 'Germania');
  assert.equal(p.campi.luogoRilascio.valore, 'Germania');
  assert.equal(tipo(td3(Object.assign({}, base, { tipo: 'PD' }))).campi.tipoDocumento.suggerimento, 'PASSAPORTO DIPLOMATICO');
  assert.equal(tipo(td3(Object.assign({}, base, { tipo: 'PS' }))).campi.tipoDocumento.suggerimento, 'PASSAPORTO DI SERVIZIO');
  const viaggio = tipo(td3(Object.assign({}, base, { tipo: 'PT' })));
  assert.equal(viaggio.campi.tipoDocumento, undefined, 'documento di viaggio particolare: nessun tipo');
  assert.ok(viaggio.avvisi.some(a => a.codice === 'tipo_da_scegliere'));
  const carta = tipo(td1(Object.assign({}, base, { tipo: 'ID', stato: 'D', cittadinanza: 'D', numero: 'L01X00T47' })));
  assert.equal(carta.campi.tipoDocumento.suggerimento, "CARTA DI IDENTITA'");
  assert.equal(carta.campi.cittadinanza.valore, 'Germania');
  // documento italiano TD1 che non è una CIE (per esempio un permesso di soggiorno): nessun tipo
  assert.equal(tipo(td1(Object.assign({}, base, { tipo: 'IT', stato: 'ITA', cittadinanza: 'MAR', numero: 'I12345678' }))).campi.tipoDocumento, undefined);
  // apolide: cittadinanza vuota con avviso
  const apolide = tipo(td3(Object.assign({}, base, { stato: 'D', cittadinanza: 'XXA' })));
  assert.equal(apolide.campi.cittadinanza, undefined);
  assert.ok(apolide.avvisi.some(a => a.codice === 'cittadinanza_non_in_elenco'));
  assert.equal(apolide.campi.luogoRilascio.affidabilita, L.DA_VERIFICARE, 'Stato emittente diverso dalla cittadinanza: da verificare');
});

test('patente (senza MRZ, campi numerati), carta cartacea, luogo di nascita all\'estero', () => {
  const patente = ['PATENTE DI GUIDA', 'REPUBBLICA ITALIANA', '1. PROVACCIA', '2. TEODORICO', '3. 10/11/90 ROMA (RM)', '4a. 01/02/2020 4c. MIT-UCO', '4b. 01/02/2030', '5. U1A23B456C', '9. B'];
  const s = L.leggiTestoStampato(patente, OPZ);
  assert.deepEqual([s.cognome, s.nome, s.nascita, s.numero, s.scadenza, s.rilascio], ['PROVACCIA', 'TEODORICO', '1990-11-10', 'U1A23B456C', '2030-02-01', '2020-02-01']);
  assert.deepEqual(s.luogo, { stato: 'Italia', comune: 'ROMA', provincia: 'RM' });
  const r = L.combinaLetture([{ mrz: null, stampato: s }], Object.assign({ responsabile: true }, OPZ));
  assert.equal(r.campi.tipoDocumento.suggerimento, 'PATENTE DI GUIDA');
  assert.equal(r.campi.genere, undefined, 'la patente non riporta il sesso');
  assert.equal(r.campi.cittadinanza, undefined, 'la patente non riporta la cittadinanza');
  assert.equal(r.campi.luogoRilascio.valore, 'Italia');
  assert.ok(Object.values(r.campi).every(c => c.affidabilita === L.DA_VERIFICARE), 'senza MRZ tutto da verificare');
  const cartacea = ['REPUBBLICA ITALIANA', 'CARTA D\'IDENTITA\'', 'N. AX 1234567', 'COGNOME PROVACCIA', 'NOME CLOTILDE', 'NATO IL 15/01/2004', 'A REGGIO NELL\'EMILIA (RE)', 'CITTADINANZA ITALIANA'];
  const c = L.leggiTestoStampato(cartacea, OPZ);
  assert.deepEqual([c.cognome, c.nome, c.nascita, c.numero], ['PROVACCIA', 'CLOTILDE', '2004-01-15', 'AX1234567']);
  assert.deepEqual(c.luogo, { stato: 'Italia', comune: 'REGGIO NELL\'EMILIA', provincia: 'RE' });
  assert.equal(L.combinaLetture([{ stampato: c }], Object.assign({ responsabile: true }, OPZ)).campi.tipoDocumento.suggerimento, "CARTA DI IDENTITA'");
  assert.deepEqual(L.leggiLuogo('BERLINO (GERMANIA)', OPZ), { stato: 'Germania', comune: undefined, provincia: undefined });
  assert.equal(L.leggiLuogo('SPRINGFIELD (XX)', OPZ), null, 'sigla che non è una provincia: nulla');
});

test('controlli: nomi invertiti, documento scaduto, codice fiscale che non coincide, nascita futura, numero = codice fiscale', () => {
  const mrz = L.leggiMrz(L.trovaMrz(CIE_RETRO).righe, OGGI);
  const invertito = L.leggiTestoStampato(['COGNOME / SURNAME', 'ERMENEGILDA', 'NOME / NAME', 'PROVACCIA'], OPZ);
  const r = L.combinaLetture([{ mrz, stampato: invertito }], Object.assign({ responsabile: false }, OPZ));
  assert.ok(r.avvisi.some(a => a.codice === 'nomi_invertiti'));
  assert.equal(r.campi.cognome.valore, 'PROVACCIA', 'vale la struttura della MRZ');
  assert.equal(r.campi.cognome.affidabilita, L.DA_VERIFICARE);
  const scaduta = L.leggiMrz(L.trovaMrz(td1({ tipo: 'CI', stato: 'ITA', cognome: 'PROVACCIA', nome: 'ERMENEGILDA', numero: 'CA00000AA', nascita: '800419', sesso: 'F', scadenza: '250419' })).righe, OGGI);
  assert.ok(L.combinaLetture([{ mrz: scaduta }], OPZ).avvisi.some(a => a.codice === 'documento_scaduto'), 'scaduto: avviso, non blocco');
  const base = 'PRVRNG80D19H501'; const cfMaschio = base + L.carattereControlloCF(base);   // giorno 19: maschio, non coincide con «F»
  const conCf = L.combinaLetture([{ mrz, stampato: L.leggiTestoStampato(['CODICE FISCALE', cfMaschio], OPZ) }], OPZ);
  assert.ok(conCf.avvisi.some(a => a.codice === 'cf_non_coincide'));
  assert.equal(conCf.campi.genere.affidabilita, L.DA_VERIFICARE);
  const futuro = L.combinaLetture([{ stampato: L.leggiTestoStampato(['COGNOME', 'ROSSI', 'NOME', 'ADA', 'DATA DI NASCITA', '01.01.2030'], OPZ) }], OPZ);
  assert.equal(futuro.campi.nascita, undefined);
  const cfNumero = 'PRVRNG80D59H501' + L.carattereControlloCF('PRVRNG80D59H501');
  const pat = L.leggiTestoStampato(['PATENTE DI GUIDA', '1. ROSSI', '2. ADA', '3. 01/01/80 ROMA (RM)', '5. ' + cfNumero], OPZ);
  assert.equal(pat.numero, undefined, 'il codice fiscale non diventa mai il numero del documento');
  assert.equal(pat.codiceFiscale, cfNumero);
});

test('compilazione: solo i campi vuoti; valori già inseriti e diversi = conflitto da decidere; stessa persona', () => {
  const proposte = { cognome: { valore: 'ROSSI', affidabilita: L.SICURO }, nome: { valore: 'ADA', affidabilita: L.SICURO }, nascita: { valore: '1980-01-01', affidabilita: L.SICURO },
    cittadinanza: { valore: 'Italia', affidabilita: L.DA_VERIFICARE }, tipoDocumento: { valore: null, suggerimento: 'PASSAPORTO ORDINARIO' } };
  const p = L.pianificaCompilazione({ cognome: 'Rossi', nome: 'Bice', nascita: '', cittadinanza: '' }, proposte);
  assert.deepEqual(p.scrivere.map(x => x.campo).sort(), ['cittadinanza', 'nascita']);
  assert.deepEqual(p.conflitti, [{ campo: 'nome', attuale: 'Bice', letto: 'ADA', affidabilita: L.SICURO }]);
  assert.deepEqual(p.confermati, [{ campo: 'cognome', valore: 'Rossi' }]);
  assert.ok(L.stessaPersona({ cognome: 'Rossi', nome: 'Ada', nascita: '1980-01-01' }, { cognome: 'ROSSI', nome: 'ADA', nascita: '1980-01-01' }));
  assert.ok(!L.stessaPersona({ cognome: 'Rossi', nome: 'Ada', nascita: '1980-01-01' }, { cognome: 'ROSSI', nome: 'ADA', nascita: '1981-01-01' }));
});

test('Alloggiati Web: i dati letti da una CIE e da un passaporto tedesco producono un TXT valido (stesso percorso dei dati scritti a mano)', async () => {
  const { generaTxt } = await import('../api/_checkin-alloggiati.js');
  const { tabelle, NOW } = await import('./helpers.mjs');
  const daProposte = (r, extra) => Object.assign(Object.fromEntries(Object.entries(r.campi).filter(([, c]) => c.valore).map(([k, c]) => [k, c.valore])), extra);
  const resp = L.combinaLetture([{ mrz: L.leggiMrz(L.trovaMrz(CIE_RETRO).righe, OGGI) }, { stampato: L.leggiTestoStampato(CIE_FRONTE, OPZ) }], Object.assign({ responsabile: true }, OPZ));
  const tedesco = L.combinaLetture([{ mrz: L.leggiMrz(L.trovaMrz(td3({ stato: 'D', cittadinanza: 'D', cognome: 'PROVACCIA', nome: 'TEODORICO', numero: 'C01X00T47', nascita: '101110', sesso: 'M', scadenza: '300101' })).righe, OGGI) }],
    Object.assign({ responsabile: false }, OPZ));
  const ospiti = [daProposte(resp, { numero: 1, isResponsabile: true }), daProposte(tedesco, { numero: 2, luogoNascita: 'Germania' })];
  // il luogo di nascita del tedesco non è nella MRZ: qui lo «scrive l'ospite», come farebbe a mano
  assert.equal(tedesco.campi.luogoNascita, undefined);
  const dati = { dataCheckin: '2026-11-02', numeroOspiti: 2, numeroNotti: 3, tipoGruppo: 'famiglia', ospiti };
  const g = generaTxt(dati, tabelle(), NOW);
  assert.equal(g.ok, true, JSON.stringify(g.problemi));
  assert.equal(g.lines.length, 2);
  for (const l of g.lines) assert.equal(l.length, 168);
  assert.ok(g.lines[0].includes('PROVACCIA') && g.lines[0].includes('CA00000AA'));
  assert.ok(!g.lines[1].includes('C01X00T47'), 'nessun dato del documento per il familiare');
});

test('OCR imperfetto: «<» letti come C/K, etichette senza spazi («NATAIL»), cittadinanza dal codice stampato, testo a caso ignorato', () => {
  // riempimento letto come C: il nome finisce dove comincia il riempimento
  assert.equal(L.pulisciRigaMrz('P<D<<PROVACCIA<<TEODORICO<CCCCCCCCCCCCCCCCCCC'), 'P<D<<PROVACCIA<<TEODORICO<<<<<<<<<<<<<<<<<<<<');
  const r = L.leggiMrz(L.trovaMrz(td3({ stato: 'D', cittadinanza: 'D', cognome: 'PROVACCIA', nome: 'TEODORICO', numero: 'C01X00T47', nascita: '101110', sesso: 'M', scadenza: '300101' })
    .map((x, i) => i === 0 ? x.replace(/<{12}$/, '<<<<KNAUNE<<') : x)).righe, OGGI);
  assert.equal(r.campi.nome.valore, 'TEODORICO', 'rumore dopo il riempimento ignorato');
  const s = L.leggiTestoStampato(['REPUBBLICA ITALIANA', "CARTA D'IDENTITA", 'COGNOME PROVACCIA', 'NOME CLOTILDE', 'NATAIL 15/01/2004', "A REGGIO NELL'EMILIA (RE)", 'CITTADINANZA ITALIANA'], OPZ);
  assert.equal(s.nascita, '2004-01-15');
  assert.equal(s.cittadinanza, 'Italia');
  assert.equal(L.leggiTestoStampato(CIE_FRONTE, OPZ).cittadinanza, 'Italia', 'CIE: codice ITA sotto «CITTADINANZA»');
  // testo senza segni di documento e senza MRZ (foto qualsiasi): non si usa
  const caso = L.leggiTestoStampato(['NOM ANRAEIENSEELIWRENNARATERESHANSN', 'XQ WZ'], OPZ);
  assert.equal(caso.cognome, undefined, 'parola di 31 lettere: non è un nome');
  const solo = L.leggiTestoStampato(['COGNOME', 'ROSSI'], OPZ);
  assert.equal(solo.credibile, false);
  assert.equal(L.combinaLetture([{ mrz: null, stampato: solo }], OPZ).esito, 'nessun_dato');
  // righe di lettere a caso lunghe come una MRZ: non diventano una MRZ (servono cifre di controllo esatte e il riempimento)
  assert.equal(L.trovaMrz(['ANRAEIENSEELIWRENNARATERESHANSNQWERTYUIOPAS<', 'ZXCVBNMLKJHGFDSAQWERTYUIOPLKJHGFDSAZXCVBNMQ<']), null);
});

test('nomi: MRZ e testo stampato quasi uguali (lettura imperfetta, Ü/UE) → vale il testo stampato, da verificare', () => {
  const m = L.leggiMrz(L.trovaMrz(td3({ stato: 'D', cittadinanza: 'D', cognome: 'MUELLER', nome: 'TEODORID', numero: 'C01X00T47', nascita: '101110', sesso: 'M', scadenza: '300101' })).righe, OGGI);
  const st = L.leggiTestoStampato(['REISEPASS / PASSPORT', 'NAME / SURNAME / NOM', 'MÜLLER', 'VORNAMEN / GIVEN NAMES / PRÉNOMS', 'TEODORICO'], OPZ);
  assert.equal(st.nome, 'TEODORICO', 'etichetta accentata («PRÉNOMS») riconosciuta');
  const r = L.combinaLetture([{ mrz: m, stampato: st }], OPZ);
  assert.deepEqual([r.campi.cognome.valore, r.campi.nome.valore], ['MÜLLER', 'TEODORICO']);
  assert.equal(r.campi.nome.affidabilita, L.DA_VERIFICARE);
});

// ---- Aggancio in checkin.js e regole di privacy del codice della scansione ----

test('flag della scansione: «spenta» nel codice pubblicato; «prova» solo con #scansione=prova; «attiva» per tutti', () => {
  assert.match(SRC_CHECKIN, /\nconst SCANSIONE_DOCUMENTI = 'spenta';\n/, 'il valore pubblicato deve restare «spenta» finché il titolare non decide');
  const con = (valore, hash) => passiOspiti(ROOT, 2, { hash, sorgente: SRC_CHECKIN.replace("const SCANSIONE_DOCUMENTI = 'spenta';", "const SCANSIONE_DOCUMENTI = '" + valore + "';") });
  const ha = passi => passi.every(p => p.html.includes('class="scan-doc"') && p.html.includes("sceltaCompilazione(") && p.html.includes('data-i18n="scan.scansiona"'));
  // nel contesto di prova WebAssembly e Worker non ci sono (come in un browser molto vecchio): la scelta non compare
  assert.ok(!con('attiva', '').some(p => p.html.includes('scan-doc')), 'senza WebAssembly e Worker si compila solo a mano');
  const conMotore = (valore, hash) => {
    const src = SRC_CHECKIN.replace("const SCANSIONE_DOCUMENTI = 'spenta';", "const SCANSIONE_DOCUMENTI = '" + valore + "';")
      .replace('function scansioneDisponibile() {', 'globalThis.WebAssembly = {}; globalThis.Worker = function () {}; globalThis.HTMLScriptElement = function () {}; HTMLScriptElement.prototype.noModule = false;\nfunction scansioneDisponibile() {');
    return passiOspiti(ROOT, 2, { hash, sorgente: src });
  };
  assert.ok(ha(conMotore('attiva', '')));
  assert.ok(!conMotore('prova', '').some(p => p.html.includes('scan-doc')), '«prova» senza il frammento: nulla');
  assert.ok(ha(conMotore('prova', '#scansione=prova')));
  assert.ok(ha(conMotore('prova', '#k=BK1&lang=it&scansione=prova')), 'anche insieme al link dell\'area clienti');
  assert.ok(!conMotore('spenta', '#scansione=prova').some(p => p.html.includes('scan-doc')), '«spenta» vince sempre');
  // con la scansione accesa, togliendo il blocco il markup è quello di prima
  const passi = conMotore('attiva', '');
  passi.forEach((p, i) => {
    const senza = p.html.replace(/<div class="scan-doc" id="scan-doc-\d+">[\s\S]*?<div class="scan-pannello" id="scan-pannello-\d+" hidden><\/div>\n      <\/div>\n      /, '');
    assert.equal(sha(senza), ATTUALI.casi['2-it'][i].sha256, 'passo ' + p.id + ': il resto del markup non cambia');
  });
});

test('codice della scansione: nessuna rete, nessuna archiviazione, nessuna console; Tesseract solo con i file del sito', () => {
  const moduli = ['scansione/scansione-documento.js', 'scansione/lettura-documento.js', 'scansione/decodifica-heic.js'].map(f => [f, read(f)]);
  // via i commenti di riga; i brevi commenti /* … */ restano (non c'è nulla di vietato) e «image/*» nei campi file non è un commento
  const senzaCommenti = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/\s.*$/gm, '');
  for (const [f, src] of moduli) {
    const s = senzaCommenti(src);
    for (const [nome, re] of [['fetch', /\bfetch\s*\(/], ['XMLHttpRequest', /XMLHttpRequest/], ['sendBeacon', /sendBeacon/], ['WebSocket', /WebSocket/], ['EventSource', /EventSource/],
      ['localStorage', /localStorage/], ['sessionStorage', /sessionStorage/], ['indexedDB', /indexedDB/], ['caches', /\bcaches\./], ['serviceWorker', /serviceWorker/],
      ['cookie', /document\.cookie/], ['console', /\bconsole\./], ['eval', /\beval\s*\(|new Function\s*\(/], ['URL esterni', /https?:\/\//]]) assert.ok(!re.test(s), f + ': ' + nome);
    const creati = (s.match(/createObjectURL\(/g) || []).length, revocati = (s.match(/revokeObjectURL\(/g) || []).length;
    assert.ok(creati <= revocati, f + ': ogni indirizzo blob va revocato');
  }
  const ui = senzaCommenti(read('scansione/scansione-documento.js'));
  for (const opzione of [/workerPath: new URL\('tesseract\/worker\.min\.js', VENDOR\)/, /corePath: new URL\(supportaSimd\(\) \? 'tesseract-core\/tesseract-core-simd-lstm\.wasm\.js' : 'tesseract-core\/tesseract-core-lstm\.wasm\.js', VENDOR\)/,
    /langPath: new URL\('tessdata', VENDOR\)/, /cacheMethod: 'none'/, /workerBlobURL: false/]) assert.match(ui, opzione);
  assert.match(ui, /const VENDOR = new URL\('\.\/vendor\/', import\.meta\.url\);/, 'librerie dalla cartella del sito');
  assert.match(ui, /input\.value = '';/, 'il campo file degli altri ospiti si svuota subito');
  assert.match(ui, /w\.terminate\(\)/, 'i worker si chiudono');
  // il percorso del responsabile non viene toccato: nessuna scrittura nei campi file del documento né chiamate alle sue funzioni
  assert.ok(!/ospite1_documento_|handleFileUpload|raccogliDatiPrenotazione|comprimiImmagine/.test(ui), 'la scansione non tocca il caricamento del documento del responsabile');
  assert.ok(!/\.files\s*=/.test(ui), 'nessun file assegnato a un campo');
  // checkin.js carica la scansione solo su richiesta dell'ospite, dalla stessa cartella
  assert.match(SRC_CHECKIN, /import\(`\.\/scansione\/scansione-documento\.js\?v=\$\{SCANSIONE_VERSIONE\}`\)/);
  assert.ok(!/<script[^>]+scansione/.test(read('index.html')), 'index.html non carica la scansione');
});

test('testi della scansione presenti in italiano, inglese e tedesco', () => {
  const ctx = { window: {}, document: { querySelectorAll: () => [], documentElement: {}, addEventListener() {} }, console };
  vm.createContext(ctx);
  vm.runInContext(read('i18n.js') + '\n;this.__UI = I18N_UI;', ctx);
  const chiavi = new Set();
  for (const f of ['scansione/scansione-documento.js', 'checkin.js']) for (const m of read(f).matchAll(/['"`](scan\.[A-Za-z0-9_.]+)['"`]/g)) chiavi.add(m[1]);
  for (const m of read('scansione/lettura-documento.js').matchAll(/avviso\('([a-z_]+)'/g)) chiavi.add('scan.avviso.' + m[1]);
  for (const c of ['numero_corretto', 'nome_troncato', 'cittadinanza_non_in_elenco', 'emittente_non_in_elenco', 'stesso_ospite', 'timeout_parziale']) chiavi.add('scan.avviso.' + c);
  for (const c of ['pdf', 'formato', 'heic', 'timeout', 'offline', 'errore']) chiavi.add('scan.lato.' + c);
  chiavi.delete('scan.lato'); chiavi.delete('scan.avviso.');
  for (const l of ['it', 'en', 'de']) for (const k of chiavi) if (!k.endsWith('.')) assert.ok(typeof ctx.__UI[l][k] === 'string' && ctx.__UI[l][k].length > 1, l + ': ' + k);
  assert.ok(chiavi.size > 50);
});
