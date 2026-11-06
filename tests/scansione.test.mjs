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

// 06/11/2026: l'unica differenza voluta rispetto a prima è la provincia «SU» (Sud Sardegna, dal 2016) nell'elenco delle province,
// che mancava: senza, i comuni di quella provincia non potevano avere la provincia compilata dall'elenco dei comuni.
const SENZA_SU = html => html.replace('<option value="SU">SU</option>', '');
test('scansione spenta: i passi degli ospiti sono identici a quelli di prima (1, 2, 3 e 9 ospiti; italiano, inglese, tedesco), salvo la provincia SU', () => {
  for (const [caso, attesi] of Object.entries(ATTUALI.casi)) {
    const [n, lingua] = caso.split('-');
    const passi = passiOspiti(ROOT, n, { lingua });
    assert.equal(passi.length, attesi.length, caso + ': numero di passi');
    passi.forEach((p, i) => {
      assert.equal(p.id, attesi[i].id, caso + ': id');
      assert.equal(p.className, attesi[i].className, caso + ': classe');
      assert.equal(p.html.split('<option value="SU">SU</option>').length, 2, caso + ' passo ' + p.id + ': una sola provincia SU');
      const prima = SENZA_SU(p.html);
      assert.equal(prima.length, attesi[i].caratteri, caso + ' passo ' + p.id + ': lunghezza del markup');
      assert.equal(sha(prima), attesi[i].sha256, caso + ' passo ' + p.id + ': markup diverso da quello di prima');
    });
  }
});

test('le funzioni del percorso di oggi (documento del responsabile, validazioni, pagamento) sono quelle di prima', () => {
  const src = read('checkin.js');
  for (const f of FUNZIONI_INVARIATE) {
    let c = corpoFunzione(src, f);
    assert.ok(c, f + ': funzione non trovata');
    // 06/11/2026, richiesta del titolare: sul telefono la fotocamera del documento si apre a tutto schermo con il riquadro
    // (fotocamera.js). È un blocco in più all'inizio di openCamera; tolto quello, la funzione è quella di prima.
    if (f === 'openCamera') {
      const blocco = /\n  \/\/ Telefono: fotocamera a tutto schermo[\s\S]*?\n    return;\n  }\n/;
      assert.match(c, blocco, 'openCamera: blocco della fotocamera con il riquadro');
      c = c.replace(blocco, '');
    }
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
  assert.deepEqual([a('luogoNascita'), a('comune'), a('provincia')], [L.DA_VERIFICARE, L.DA_VERIFICARE, L.DA_VERIFICARE], 'testo stampato: da verificare (il comune lo conferma poi l\'elenco dei comuni, nella pagina)');
  // 06/11/2026 (il titolare: «giusta ma in giallo»): CIE con la MRZ valida e il numero nel formato della CIE, tipo certo
  assert.equal(a('tipoDocumento'), L.SICURO, 'CIE con la MRZ valida: tipo certo');
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

test('nomi: MRZ e testo stampato quasi uguali → vale la MRZ, da verificare; Ü/UE e MRZ troncata → il testo stampato', () => {
  const m = L.leggiMrz(L.trovaMrz(td3({ stato: 'D', cittadinanza: 'D', cognome: 'MUELLER', nome: 'TEODORID', numero: 'C01X00T47', nascita: '101110', sesso: 'M', scadenza: '300101' })).righe, OGGI);
  const st = L.leggiTestoStampato(['REISEPASS / PASSPORT', 'NAME / SURNAME / NOM', 'MÜLLER', 'VORNAMEN / GIVEN NAMES / PRÉNOMS', 'TEODORICO'], OPZ);
  assert.equal(st.nome, 'TEODORICO', 'etichetta accentata («PRÉNOMS») riconosciuta');
  const r = L.combinaLetture([{ mrz: m, stampato: st }], OPZ);
  assert.deepEqual([r.campi.cognome.valore, r.campi.cognome.affidabilita], ['MÜLLER', L.SICURO], 'MÜLLER = MUELLER (traslitterazione ICAO)');
  assert.deepEqual([r.campi.nome.valore, r.campi.nome.affidabilita], ['TEODORID', L.DA_VERIFICARE], 'diversi: la MRZ, da controllare');
  // come sulle foto vere (CIE): GIOVANNA nella MRZ, «CIOVANNA» nel testo stampato → GIOVANNA
  const cie = L.leggiMrz(L.trovaMrz(td1({ tipo: 'C<', stato: 'ITA', cognome: 'PROVACCIA', nome: 'GIOVANNA', numero: 'CA00000AA', nascita: '800419', sesso: 'F', scadenza: '300419' })).righe, OGGI);
  const r2 = L.combinaLetture([{ mrz: cie, stampato: L.leggiTestoStampato(['COGNOME / SURNAME', 'PROVACCIA', 'NOME / NAME', 'CIOVANNA'], OPZ) }], OPZ);
  assert.equal(r2.campi.nome.valore, 'GIOVANNA');
  // MRZ troncata (nome lungo): la MRZ ha solo l'inizio, vale il testo stampato
  const lungo = td3({ stato: 'D', cittadinanza: 'D', cognome: 'MUELLER', nome: 'TEODORICO MASSIMILIANO GIOVANNI', numero: 'C01X00T47', nascita: '101110', sesso: 'M', scadenza: '300101' });
  assert.ok(!lungo[0].endsWith('<'), 'la riga dei nomi è piena');
  const mt = L.leggiMrz(L.trovaMrz(lungo).righe, OGGI);
  const st3 = L.leggiTestoStampato(['REISEPASS / PASSPORT', 'NAME / SURNAME / NOM', 'MÜLLER', 'VORNAMEN / GIVEN NAMES / PRÉNOMS', 'TEODORICO MASSIMILIANO GIOVANNI'], OPZ);
  const r3 = L.combinaLetture([{ mrz: mt, stampato: st3 }], OPZ);
  assert.deepEqual([r3.campi.nome.valore, r3.campi.nome.affidabilita], ['TEODORICO MASSIMILIANO GIOVANNI', L.DA_VERIFICARE]);
});

// ---- Aggancio in checkin.js e regole di privacy del codice della scansione ----

// ---- Foto vere (06/11/2026): righe di testo e MRZ trovate prima dell'OCR, «<» riconosciuti dalla forma, letture unite ----
// Le prove usano solo disegni fatti qui e dati di fantasia: le foto dei documenti veri usate per mettere a punto il codice
// sono rimaste sul computer di chi ha fatto le prove e non sono nel repository.
const I = await import('../scansione/immagine.js');
function foglio(w, h) { return { g: new Uint8Array(w * h).fill(255), w, h }; }
function tratto(t, x0, y0, x1, y1, sp) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 + 1, r = sp / 2;
  for (let k = 0; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = Math.round(x + dx), yy = Math.round(y + dy);
      if (xx >= 0 && yy >= 0 && xx < t.w && yy < t.h) t.g[yy * t.w + xx] = 0;
    }
  }
}
// Caratteri disegnati a tratti: «<» come nell'OCR-B (due tratti dagli angoli a destra alla punta a sinistra), qualche lettera
// che l'OCR confonde con il «<» (L, K, C, E, I) e un riquadro per tutte le altre lettere e cifre.
function glifo(t, ch, x, y, w, h, sp) {
  const T = (a, b, c, d) => tratto(t, x + a * w, y + b * h, x + c * w, y + d * h, sp);
  if (ch === '<') { T(1, 0, 0, 0.5); T(0, 0.5, 1, 1); }
  else if (ch === '>') { T(0, 0, 1, 0.5); T(1, 0.5, 0, 1); }
  else if (ch === 'L') { T(0, 0, 0, 1); T(0, 1, 1, 1); }
  else if (ch === 'K') { T(0, 0, 0, 1); T(1, 0, 0, 0.5); T(0, 0.5, 1, 1); }
  else if (ch === 'E') { T(0, 0, 0, 1); T(0, 0, 1, 0); T(0, 0.5, 0.8, 0.5); T(0, 1, 1, 1); }
  else if (ch === 'C') { T(1, 0, 0.25, 0); T(0.25, 0, 0, 0.3); T(0, 0.3, 0, 0.7); T(0, 0.7, 0.25, 1); T(0.25, 1, 1, 1); }
  else if (ch === 'I') { T(0.5, 0, 0.5, 1); T(0.2, 0, 0.8, 0); T(0.2, 1, 0.8, 1); }
  else { T(0, 0, 1, 0); T(1, 0, 1, 1); T(1, 1, 0, 1); T(0, 1, 0, 0); T(0, 0.5, 1, 0.5); }
}
// MRZ disegnata: righe di caratteri a passo fisso, con un'inclinazione (gradi) intorno al centro del foglio
function disegnaMrz(t, righe, { x0, y0, passo, alt, larg, interlinea, sp, inclinazione = 0, salta = [] }) {
  const a = inclinazione * Math.PI / 180, cx = t.w / 2, cy = t.h / 2;
  righe.forEach((r, ri) => [...r].forEach((ch, i) => {
    if (salta.some(([sr, si]) => sr === ri && si === i)) return;
    const px = x0 + i * passo, py = y0 + ri * interlinea;
    const qx = cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a), qy = cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a);
    glifo(t, ch, qx, qy, larg, alt, sp);
  }));
}
const trasposto = t => { const o = foglio(t.h, t.w); for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) o.g[x * t.h + (t.h - 1 - y)] = t.g[y * t.w + x]; return o; };   // girato di 90° in senso orario

test('forma del «<»: riconosciuto sottile e spesso (OCR-B), capovolto (MRZ sottosopra); L, K, C, E, I e le altre lettere no', () => {
  const t = foglio(900, 120), voci = ['<', '<', '>', 'L', 'K', 'C', 'E', 'I', 'B'];
  voci.forEach((ch, i) => glifo(t, ch, 20 + i * 95, 30, 30, 44, i === 1 ? 9 : 4));
  const { comp, lab } = I.macchie(t.g, t.w, t.h, true);
  const forme = comp.filter(c => c.area > 30).sort((a, b) => a.x0 - b.x0).map(c => I.eChevron(lab, t.w, c.id, c));
  assert.deepEqual(forme, [1, 1, -1, 0, 0, 0, 0, 0, 0]);
});

test('MRZ nell\'immagine: caselle della griglia, «<» dalla forma, carattere sbiadito come casella ignota; l\'OCR legge L al posto di «<»', () => {
  const righe = td1({ tipo: 'C<', stato: 'ITA', cognome: 'PROVACCIA', nome: 'ERMENEGILDA', numero: 'CA00000AA', nascita: '800419', sesso: 'F', scadenza: '310419' });
  const t = foglio(1300, 260);
  disegnaMrz(t, righe, { x0: 40, y0: 40, passo: 40, alt: 40, larg: 26, interlinea: 70, sp: 5, salta: [[0, 6]] });   // la «A» di CA sbiadita
  const gl = I.glifiMrz(t.g, t.w, t.h, 40);
  assert.equal(gl.righe.length, 3);
  assert.deepEqual(gl.righe.map(r => r.glifi.length), [30, 30, 30], 'tre righe da 30 caselle');
  gl.righe.forEach((r, ri) => assert.deepEqual(r.glifi.map(g => g.chevron ? '<' : g.ignoto ? '?' : '·').join(''),
    [...righe[ri]].map((c, i) => c === '<' ? '<' : (ri === 0 && i === 6 ? '?' : '·')).join(''), 'riga ' + (ri + 1)));
  // l'OCR (finto): ogni «<» letto L, la casella sbiadita letta «A»; simboli con i riquadri delle caselle
  const simboli = [];
  gl.righe.forEach((r, ri) => r.glifi.forEach((g, i) => simboli.push({ text: righe[ri][i] === '<' ? 'L' : righe[ri][i], confidence: 80, bbox: { x0: g.x0, y0: r.y0, x1: g.x1, y1: r.y1 } })));
  assert.deepEqual(gl.righe.map(r => I.allineaSimboli(simboli, r).testo), righe, 'le L tornano «<», la casella ignota prende la lettera letta');
  assert.equal(L.leggiMrz(gl.righe.map(r => I.allineaSimboli(simboli, r).testo), OGGI).valida, true);
  // un simbolo di un'altra riga non entra; una casella senza simbolo resta «?» (nessun dato inventato)
  const r0 = gl.righe[0];
  assert.equal(I.allineaSimboli(simboli.filter(x => !(x.bbox.y0 === r0.y0 && x.bbox.x0 === r0.glifi[3].x0)), r0).testo, righe[0].slice(0, 3) + '?' + righe[0].slice(4));
  // immagine pulita per l'OCR: solo le caselle delle righe; senza i «<» se richiesto
  const pulita = I.soloGlifi(t.g, t.w, t.h, gl.lab, gl.righe, true);
  const g20 = gl.righe[0].glifi[20];
  assert.ok(pulita.slice(g20.y0 * t.w + g20.x0, g20.y0 * t.w + g20.x1).every(v => v === 255), 'un «<» tolto');
});

test('pagina: la MRZ si trova tra il disordine anche storta, in verticale (inclinazione con il segno giusto) e capovolta', () => {
  const td3 = ['P<D<<PROVACCIA<<TEODORICO<<<<<<<<<<<<<<<<<<<', 'C01X00T478D<<1011108M3001019<<<<<<<<<<<<<<<8'];
  const t = foglio(1000, 700);
  // «tovaglia» intorno al documento: tratti di misure e spessori diversi (fuori dal riquadro del documento, 40-960 × 300-650)
  let seme = 7; const caso = () => (seme = (seme * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 140; k++) {
    const x = caso() * 1000, y = caso() * 700, l = 20 + caso() * 90, a = caso() * Math.PI, x1 = x + Math.cos(a) * l, y1 = y + Math.sin(a) * l;
    if (Math.max(x, x1) > 30 && Math.min(x, x1) < 970 && Math.max(y, y1) > 290 && Math.min(y, y1) < 660) continue;
    tratto(t, x, y, x1, y1, 2 + Math.round(caso() * 8));
  }
  // testo stampato e MRZ (righe di 44 caratteri, inclinate di 2°)
  for (let r = 0; r < 4; r++) disegnaMrz(t, ['PROVA DI TESTO ' + r], { x0: 120, y0: 330 + r * 40, passo: 16, alt: 18, larg: 11, interlinea: 0, sp: 2 });
  disegnaMrz(t, td3, { x0: 70, y0: 540, passo: 19, alt: 20, larg: 13, interlinea: 34, sp: 3, inclinazione: 2 });
  const an = I.analizzaPagina(t.g, t.w, t.h);
  assert.ok(an.mrz, 'MRZ trovata');
  assert.equal(an.mrz.righe, 2);
  assert.equal(an.mrz.verticale, false);
  assert.ok(Math.abs(an.mrz.zona.angolo * 180 / Math.PI - 2) < 0.8, 'inclinazione di circa 2°: ' + (an.mrz.zona.angolo * 180 / Math.PI).toFixed(2));
  // girata di 90°: righe verticali; la riga va verso il basso con l'inclinazione riportata (π/2 + 2°)
  const v = trasposto(t), av = I.analizzaPagina(v.g, v.w, v.h);
  assert.equal(av.mrz && av.mrz.verticale, true);
  assert.ok(Math.abs(av.mrz.zona.angolo * 180 / Math.PI - 92) < 0.8, 'angolo in verticale: ' + (av.mrz.zona.angolo * 180 / Math.PI).toFixed(2));
  // ritaglio dritto: i «<» della MRZ girata tornano «<» (o tutti capovolti se il verso è l'opposto)
  for (const [m, an2] of [[t, an], [v, av]]) {
    const crop = I.estrai(m.g, m.w, m.h, an2.mrz.zona, 40 / an2.mrz.s);
    const bin = I.sauvola(crop.g, crop.w, crop.h, 81, 0.2), gl = I.glifiMrz(bin, crop.w, crop.h, 40);
    assert.deepEqual(gl.righe.map(r => r.glifi.length), [44, 44]);
    assert.ok(gl.chevron >= 30 && gl.capovolti === 0, 'chevron ' + gl.chevron + ', capovolti ' + gl.capovolti);
  }
  // capovolta: i «<» risultano tutti capovolti (la lettura gira il ritaglio di 180°)
  const c = { g: t.g.slice().reverse(), w: t.w, h: t.h }, ac = I.analizzaPagina(c.g, c.w, c.h);
  const crop = I.estrai(c.g, c.w, c.h, ac.mrz.zona, 40 / ac.mrz.s);
  const gl = I.glifiMrz(I.sauvola(crop.g, crop.w, crop.h, 81, 0.2), crop.w, crop.h, 40);
  assert.ok(gl.capovolti >= 30 && gl.chevron === 0);
  // solo disordine: nessuna MRZ e nessuna zona di testo
  const d = foglio(800, 600); seme = 11;
  for (let k = 0; k < 120; k++) { const x = caso() * 800, y = caso() * 600, l = 10 + caso() * 120, a = caso() * Math.PI; tratto(d, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 2 + Math.round(caso() * 10)); }
  const ad = I.analizzaPagina(d.g, d.w, d.h);
  assert.equal(ad.mrz, null);
  assert.equal(ad.testo, null);
});

test('immagine: ritaglio girato, nitidezza, contrasto', () => {
  const t = foglio(200, 100);
  for (let y = 40; y < 44; y++) for (let x = 150; x < 154; x++) t.g[y * 200 + x] = 0;
  // zona centrata sul punto, riga verso il basso (90°): il punto finisce al centro del ritaglio
  const r = I.estrai(t.g, t.w, t.h, { cx: 152, cy: 42, lungo: 40, traverso: 20, angolo: Math.PI / 2 }, 1);
  assert.deepEqual([r.w, r.h], [40, 20]);
  assert.ok(r.g[10 * 40 + 20] < 60 && r.g[2 * 40 + 2] > 200);
  const nitida = foglio(300, 300);
  for (let k = 0; k < 20; k++) tratto(nitida, 10, 10 + k * 14, 290, 10 + k * 14, 3);
  // sfocata: media su 11×11 pixel (come una foto mossa)
  const sfocata = new Uint8Array(300 * 300);
  for (let y = 0; y < 300; y++) for (let x = 0; x < 300; x++) {
    let somma = 0, n = 0;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < 300 && xx >= 0 && xx < 300) { somma += nitida.g[yy * 300 + xx]; n++; } }
    sfocata[y * 300 + x] = somma / n;
  }
  assert.ok(I.nitidezza(nitida.g, 300, 300) > 18);
  assert.ok(I.nitidezza(sfocata, 300, 300) < I.nitidezza(nitida.g, 300, 300) / 2, 'sfocata: ' + I.nitidezza(sfocata, 300, 300).toFixed(1));
  assert.deepEqual([...I.distendi(Uint8Array.from([100, 110, 120]))].map(v => v > 127), [false, false, true]);
});

test('letture unite: le cifre di controllo scelgono tra le letture; un campo che non si può decidere resta vuoto, mai corretto a caso', () => {
  const td1v = td1({ tipo: 'C<', stato: 'ITA', cognome: 'PROVACCIA', nome: 'ERMENEGILDA', numero: 'CA00000KL', nascita: '800419', sesso: 'F', scadenza: '310419' });
  // tre letture dello stesso retro: la «A» del numero sbiadita (letta 1 o non letta), la cifra di controllo della nascita letta
  // U, J e 0, «ITA» della cittadinanza letta LIA, 1TA, TTA, una L in mezzo ai «<» dei dati facoltativi
  const v = [
    [td1v[0].replace('CA0', 'C10'), td1v[1].slice(0, 6) + 'U' + td1v[1].slice(7, 15) + 'LIA' + td1v[1].slice(18, 21) + 'L' + td1v[1].slice(22), td1v[2]],
    [td1v[0].replace('CA0', 'C?0'), td1v[1].slice(0, 6) + 'J' + td1v[1].slice(7, 15) + '1TA' + td1v[1].slice(18), td1v[2]],
    [td1v[0].replace('CA0', 'C?0'), td1v[1].slice(0, 15) + 'TTA' + td1v[1].slice(18), td1v[2]]
  ];
  const f = L.fondiMrz(v);
  assert.equal(f.formato, 'TD1');
  assert.equal(f.righe[1], td1v[1], 'nascita 0 (cifra), ITA (codice esistente), «<» al posto della L');
  const m = L.leggiMrz(f.righe, OGGI, f);
  assert.deepEqual([m.campi.nascita.valore, m.campi.cittadinanza.valore, m.campi.cognome.valore, m.campi.nome.valore], ['1980-04-19', 'Italia', 'PROVACCIA', 'ERMENEGILDA']);
  // il numero non si può leggere: niente numero. (Cambiare la L finale in I farebbe tornare la cifra di controllo, e anche
  // quella complessiva: C100000KI. Si correggono solo le caselle incerte, cioè quella sbiadita.)
  assert.equal(m.campi.numeroDocumento, undefined);
  // 06/11/2026: per la CIE la correzione resta nel formato del numero (C, lettera, 5 cifre, 2 lettere); senza le caselle incerte
  // sbaglia lo stesso, con CL00000KI invece di C100000KI (che ha una cifra al posto della lettera)
  assert.equal(L.leggiMrz(f.righe, OGGI).campi.numeroDocumento.valore, 'CL00000KI', 'senza le caselle incerte la correzione sbaglierebbe');
  // due letture su tre coincidono e tornano: si tiene quella
  const buona = L.fondiMrz([td1v, td1v, v[0]]);
  assert.deepEqual(buona.righe, td1v);
  assert.equal(L.leggiMrz(buona.righe, OGGI, buona).valida, true);
  // una sola casella incerta in una data: la cifra di controllo la determina (il campo resta da controllare)
  const d = L.fondiMrz([[td1v[0], td1v[1].slice(0, 3) + '?' + td1v[1].slice(4), td1v[2]]]);
  assert.deepEqual([d.righe[1], d.dedotti], [td1v[1], ['birthDate']]);
  assert.equal(L.leggiMrz(d.righe, OGGI, d).campi.nascita.affidabilita, L.DA_VERIFICARE);
  // TD3: la cifra complessiva letta B in una lettura (casella di sole cifre: diventa 8) e 3 in un'altra; un «<» dei dati
  // facoltativi letto D: la cifra complessiva sceglie
  const p = td3({ stato: 'D', cittadinanza: 'D', cognome: 'PROVACCIA', nome: 'TEODORICO', numero: 'C01X00T47', nascita: '101110', sesso: 'M', scadenza: '300101' });
  assert.equal(p[1][43], '8');
  const p2 = L.fondiMrz([[p[0], p[1].slice(0, 43) + 'B'], [p[0], p[1].slice(0, 43) + '3'], [p[0], p[1].slice(0, 42) + 'D' + p[1].slice(43)]]);
  assert.deepEqual(p2.righe, p);
  assert.equal(L.leggiMrz(p2.righe, OGGI, p2).valida, true);
});

test('testo stampato delle foto vere: etichette lette male, rumore dopo il nome, colonne della CIE, permesso tedesco, Stato con la sigla', () => {
  // CIE: «SURNAME» letto «SURAT» con rumore, «NOME» letto «NCE», etichetta inglese sulla riga sotto, Stato estero con la sigla ISO
  const cie = L.leggiTestoStampato(['REPUBBLICA ITALIANA', 'CARTA DI IDENTITA / IDENTITY CARD', 'COGNOME SURAT x, NS ©', 'PROVACCIA x Ch i', 'NCE / NAME', 'GIOVANNA',
    'LUOGO E DATA DI NASCITA', 'PLACE AND DATE OF BIRTH Yo 4 @ Ph', 'SAO PAULO (BRA) 15.01.1990'], OPZ);
  assert.deepEqual([cie.cognome, cie.nome, cie.luogo && cie.luogo.stato, cie.nascita], ['PROVACCIA', 'GIOVANNA', 'Brasile', '1990-01-15']);
  // passaporto: etichette in tre lingue («Surname» letto «Sumame»), rumore della foto dopo i nomi, sesso sulla riga del luogo
  const pass = L.leggiTestoStampato(['PASSAPORTO', 'Cognome. Sumame. Nom. (1)', 'PROVACCIA Eo)', 'Nome. Given Names. Prénoms. (2)', 'TEODORA Jo =.',
    'Sessc Sex. Sexe. (5) Luogo di nascita. Place of birth. Lieu de naissance. (6)', 'F ROMA (RM)'], OPZ);
  assert.deepEqual([pass.cognome, pass.nome, pass.sesso, pass.luogo], ['PROVACCIA', 'TEODORA', 'F', { stato: 'Italia', comune: 'ROMA', provincia: 'RM' }]);
  // CIE con le colonne (riquadri dell'OCR): sotto «CITTADINANZA» c'è ITA, non la riga di SESSO e STATURA; «Mm» = M
  const b = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
  const col = L.leggiTestoStampato([{ testo: 'CARTA DI IDENTITA', bbox: b(90, 180, 870, 230) }, { testo: 'SESSO STATURA', bbox: b(420, 610, 810, 640) },
    { testo: 'CITTADINANZA', bbox: b(985, 606, 1187, 656) }, { testo: 'SEX HEIGHT', bbox: b(424, 640, 785, 670) }, { testo: 'NATIONALITY', bbox: b(986, 646, 1266, 673) },
    { testo: 'Mm 170', bbox: b(424, 680, 748, 709) }, { testo: 'ITA', bbox: b(985, 678, 1042, 707) }], OPZ);
  assert.deepEqual([col.sesso, col.cittadinanza], ['M', 'Italia']);
  // permesso di soggiorno tedesco: etichette di cognome e nome sulla stessa riga, valori sulle due righe sotto (nome in minuscolo)
  const pe = L.leggiTestoStampato(['AUFENTHALTSTITEL', 'NAMEN Vornamen/ SURNAMES Forenames', 'PROVACCIA', 'Teodoro', 'GESCHLECHT/ STAATSANGEHORIGKEIT/ GEBURTSDATUM',
    'SEX NATIONALITY DATE OF BIRTH', 'M SRB 01 02 1990'], OPZ);
  assert.deepEqual([pe.cognome, pe.nome, pe.sesso, pe.cittadinanza, pe.credibile], ['PROVACCIA', 'TEODORO', 'M', 'Serbia', true]);
  // un nome con una parte senza vocali è segnato come dubbio (la lettura ne cerca una seconda)
  assert.deepEqual(L.leggiTestoStampato(['COGNOME / SURNAME', 'PROVACCIA', 'NOME / NAME', 'CG OVANNA'], OPZ).dubbi, ['nome']);
  // la sigla ITA tra parentesi non è uno Stato estero; una provincia sconosciuta non dà un luogo
  assert.equal(L.leggiLuogo('ROMA (ITA)', OPZ), null);
  assert.equal(L.chiaveIcao('MÜLLER'), 'MUELLER');
});

// ---- Campi con elenco scrivibili, elenco dei comuni, fotocamera con il riquadro (06/11/2026, richiesta del titolare) ----

const RIGHE_COMUNI = read('elenchi/comuni.js').split('`')[1].split('\n');
function ElencoComuniDiProva() {
  // campi-elenco.js in un contesto isolato, con l'elenco dei comuni già «scaricato» (window.ELENCO_COMUNI)
  const ctx = { console, setTimeout, queueMicrotask, Promise, Event: class { constructor(t) { this.type = t; } }, document: { createElement() { return {}; }, head: { appendChild() {} } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.ELENCO_COMUNI = read('elenchi/comuni.js').split('`')[1];
  vm.runInContext(read('campi-elenco.js'), ctx, { filename: 'campi-elenco.js' });
  return ctx.ElencoComuni;
}

test('CIE con il numero della MRZ illeggibile: resta una CIE (proposta con il fronte, altrimenti suggerita)', () => {
  const r = td1({ tipo: 'C<', stato: 'ITA', cognome: 'PROVACCIA', nome: 'ERMENEGILDA', numero: 'CA00000AA', nascita: '800419', sesso: 'F', scadenza: '310419' });
  const consumata = [r[0].slice(0, 6) + '?' + r[0].slice(7), r[1], r[2]];          // un carattere del numero non si legge
  const m = L.leggiMrz(consumata, OGGI);
  assert.equal(m.campi.numeroDocumento, undefined);
  assert.deepEqual(L.classificaDocumento(m, null), { tipo: 'cie', voce: L.TIPI_DOCUMENTO.CIE, modo: 'suggerito' });
  const fronte = L.leggiTestoStampato(['REPUBBLICA ITALIANA', 'CARTA DI IDENTITA / IDENTITY CARD', 'CA00000AA'], OPZ);
  assert.deepEqual(L.classificaDocumento(m, fronte), { tipo: 'cie', voce: L.TIPI_DOCUMENTO.CIE, modo: 'proposto' });
  const c = L.combinaLetture([{ mrz: m, stampato: null }, { mrz: null, stampato: fronte }], Object.assign({ responsabile: true }, OPZ));
  // MRZ non del tutto valida: il tipo arriva come proposta da controllare (la scansione lo scrive con il bordo arancione)
  assert.equal(c.campi.tipoDocumento.valore || c.campi.tipoDocumento.suggerimento, "CARTA IDENTITA' ELETTRONICA");
  assert.equal(c.campi.numeroDocumento.valore, 'CA00000AA', 'il numero dal fronte');
});

// 06/11/2026, prova del titolare: numero vuoto, sesso e tipo arancioni. Sulle foto vere il numero nella MRZ aveva un carattere
// consumato (cifra di controllo che non torna) e il fronte, a bassa risoluzione, una lettera letta «1».
test('numero della CIE: dal fronte, confermato dalla MRZ anche con un carattere consumato; letture alternative solo se la MRZ le conferma; sesso e tipo certi con la riga di nascita e scadenza esatta', () => {
  const r = td1({ tipo: 'C<', stato: 'ITA', cognome: 'PROVACCIA', nome: 'ERMENEGILDA', numero: 'CA12345XL', nascita: '800419', sesso: 'F', scadenza: '310419' });
  const consumata = [r[0].slice(0, 6) + '5' + r[0].slice(7), r[1], r[2]];      // la seconda lettera del numero letta «5»
  const m = L.leggiMrz(consumata, OGGI);
  assert.equal(m.campi.numeroDocumento, undefined, 'dalla sola MRZ niente numero');
  assert.deepEqual([m.controlli.numero, m.controlli.nascita, m.controlli.scadenza], [false, true, true]);
  assert.equal(m.campi.genere.affidabilita, L.SICURO, 'sesso tra nascita e scadenza, che tornano');
  assert.equal(m.verificaNumero('CA12345XL').conferme, 2, 'il numero vero fa tornare la cifra del numero e la complessiva');
  assert.equal(m.verificaNumero('CA12345XI'), null, 'una lettera diversa no');
  assert.equal(m.verificaNumero('CB99999XL'), null, 'troppo diverso dal numero della MRZ');
  const resp = Object.assign({ responsabile: true }, OPZ);
  const conFronte = righeFronte => L.combinaLetture([{ mrz: m, stampato: null }, { mrz: null, stampato: L.leggiTestoStampato(['REPUBBLICA ITALIANA', 'CARTA DI IDENTITA', ...righeFronte], OPZ) }], resp);
  const esatto = conFronte(['CA12345XL']);
  assert.deepEqual([esatto.campi.numeroDocumento.valore, esatto.campi.numeroDocumento.affidabilita], ['CA12345XL', L.SICURO], 'fronte esatto, confermato dalla MRZ');
  assert.deepEqual([esatto.campi.tipoDocumento.valore, esatto.campi.tipoDocumento.affidabilita], ["CARTA IDENTITA' ELETTRONICA", L.SICURO]);
  // fronte con l'ultima lettera letta «1»: delle letture possibili (XI, XL) vale quella confermata dalla MRZ
  const st = L.leggiTestoStampato(['CA12345X1'], OPZ);
  assert.equal(st.numero, undefined);
  assert.ok(st.numeriCie.includes('CA12345XI') && st.numeriCie.includes('CA12345XL'));
  const alternativa = conFronte(['CA12345X1']);
  assert.deepEqual([alternativa.campi.numeroDocumento.valore, alternativa.campi.numeroDocumento.affidabilita], ['CA12345XL', L.SICURO]);
  // senza la MRZ le letture alternative non si usano; un numero esatto del solo fronte resta da controllare
  const soloFronte = t => L.combinaLetture([{ mrz: null, stampato: L.leggiTestoStampato(['REPUBBLICA ITALIANA', 'CARTA DI IDENTITA', t], OPZ) }], resp).campi.numeroDocumento;
  assert.equal(soloFronte('CA12345X1'), undefined);
  assert.equal(soloFronte('CA12345XL').affidabilita, L.DA_VERIFICARE);
  // anche la cifra del numero illeggibile («E»): basta la complessiva, ma il numero della MRZ deve differire di un solo carattere
  const senzaCifra = [consumata[0].slice(0, 14) + 'E' + consumata[0].slice(15), consumata[1], consumata[2]];
  const m2 = L.leggiMrz(senzaCifra, OGGI);
  const v2 = m2.verificaNumero('CA12345XL');
  assert.deepEqual([v2.conferme, v2.cifraLetta, v2.distanza], [1, false, 1]);
  const con2 = L.combinaLetture([{ mrz: m2, stampato: null }, { mrz: null, stampato: L.leggiTestoStampato(['CA12345X1'], OPZ) }], resp);
  assert.deepEqual([con2.campi.numeroDocumento.valore, con2.campi.numeroDocumento.affidabilita], ['CA12345XL', L.SICURO]);
  // riga di nascita e scadenza letta male: sesso e tipo restano da controllare
  const rotta = [r[0], r[1].slice(0, 6) + (r[1][6] === '0' ? '1' : '0') + r[1].slice(7), r[2]];
  const m3 = L.leggiMrz(rotta, OGGI);
  assert.equal(m3.controlli.nascita, false);
  if (m3.campi.genere) assert.equal(m3.campi.genere.affidabilita, L.DA_VERIFICARE);
  const t3 = L.combinaLetture([{ mrz: m3, stampato: null }], resp).campi.tipoDocumento;
  assert.equal(t3.affidabilita, L.DA_VERIFICARE);
});

// 06/11/2026, foto del titolare: nel numero della CIE c'è una O lettera, che l'OCR della MRZ legge zero in tutte e tre le letture
// (nessuna casella incerta): la cifra di controllo non tornava e il numero restava vuoto.
test('numero della CIE nella MRZ con la O lettera letta zero: il formato della CIE impone la lettera; verde se tornano entrambe le cifre di controllo', () => {
  const conZero = stato => { const r = td1({ tipo: 'C<', stato, cognome: 'PROVACCIA', nome: 'ERMENEGILDA', numero: 'CA12345OF', nascita: '800419', sesso: 'F', scadenza: '310419' }); return [r[0].replace('CA12345OF', 'CA123450F'), r[1], r[2]]; };
  const zero = conZero('ITA'), f = L.fondiMrz([zero, zero, zero]);
  for (const m of [L.leggiMrz(zero, OGGI), L.leggiMrz(f.righe, OGGI, f)]) {
    assert.deepEqual([m.campi.numeroDocumento.valore, m.campi.numeroDocumento.affidabilita], ['CA12345OF', L.SICURO]);
    assert.ok(!m.avvisi.some(a => a.codice === 'numero_corretto'), 'imposta dal formato, non un\'ipotesi');
  }
  const c = L.combinaLetture([{ mrz: L.leggiMrz(f.righe, OGGI, f), stampato: null }], Object.assign({ responsabile: true }, OPZ));
  assert.deepEqual([c.campi.numeroDocumento.valore, c.campi.tipoDocumento.affidabilita, c.campi.genere.affidabilita], ['CA12345OF', L.SICURO, L.SICURO]);
  // il formato vale solo per la CIE italiana: un altro documento con le stesse letture e nessuna casella incerta resta senza numero
  const altro = conZero('FRA'), fa = L.fondiMrz([altro, altro, altro]);
  assert.equal(L.leggiMrz(fa.righe, OGGI, fa).campi.numeroDocumento, undefined);
});

// 06/11/2026, prova del titolare sul telefono: luogo di nascita vuoto (sul computer, con le stesse foto, si leggeva). La riga
// «COMUNE (PR) GG.MM.AAAA» si leggeva con poca fiducia e l'etichetta italiana no: una parentesi letta male bastava a perderla.
test('luogo di nascita: parentesi lette male o etichetta illeggibile; il risultato «incerto» lo deve confermare l\'elenco dei comuni', () => {
  const o = OPZ;
  // la forma esatta resta quella di prima
  assert.deepEqual(L.leggiLuogo('ROMA (RM) 19.04.1980', o), { stato: 'Italia', comune: 'ROMA', provincia: 'RM' });
  assert.deepEqual(L.leggiLuogo('BERLINO (GERMANIA)', o), { stato: 'Germania', comune: undefined, provincia: undefined });
  // parentesi lette male, o una sola, o nessuna con la data subito dopo: incerto
  for (const t of ['ROMA [RM] 19.04.1980', 'ROMA {RM) 19.04.1980', 'ROMA (RM| 19.04.1980', 'ROMA (RMJ 19.04.1980', 'ROMA RM 19.04.1980', 'ROMA RM) 19.04.1980'])
    assert.deepEqual(L.leggiLuogo(t, o), { stato: 'Italia', comune: 'ROMA', provincia: 'RM', incerto: true }, t);
  assert.equal(L.leggiLuogo('ROMA XX 19.04.1980', o), null, 'sigla che non è una provincia');
  assert.equal(L.leggiLuogo('EMISSIONE / ISSUING 19.04.2021', o), null);
  assert.equal(L.leggiLuogo('VIA ROMA 3 ROMA (RM)', o, { soloConData: true }), null, 'senza data (l\'indirizzo di residenza) no');
  assert.deepEqual(L.leggiLuogo('PLACE AND DATE OF BIRTH ROMA RM 19.04.1980', o), { stato: 'Italia', comune: 'ROMA', provincia: 'RM', incerto: true }, 'etichetta sulla stessa riga');
  // etichetta illeggibile: la riga del luogo e della data si riconosce da sola
  const fronte = ['REPUBBLICA ITALIANA', 'CARTA DI IDENTITA', 'COGNOME / SURNAME', 'PROVACCIA', 'NOME / NAME', 'ERMENEGILDA', 'LU0G0 E DAT4 D1 NASC1TA', 'ROMA [RM] 19.04.1980'];
  const st = L.leggiTestoStampato(fronte, o);
  assert.deepEqual(st.luogo, { stato: 'Italia', comune: 'ROMA', provincia: 'RM', incerto: true });
  const c = L.combinaLetture([{ mrz: L.leggiMrz(CIE_RETRO, OGGI), stampato: null }, { mrz: null, stampato: st }], Object.assign({ responsabile: true }, o));
  assert.deepEqual([c.campi.luogoNascita.valore, c.campi.comune.valore, c.campi.provincia.valore], ['Italia', 'ROMA', 'RM']);
  assert.ok(c.campi.comune.incerto && c.campi.provincia.incerto && c.campi.luogoNascita.incerto, 'incerto: lo conferma l\'elenco dei comuni nella pagina');
  assert.equal(L.combinaLetture([{ mrz: null, stampato: L.leggiTestoStampato(CIE_FRONTE, o) }], o).campi.comune.incerto, undefined, 'la forma esatta non è incerta');
});

test('elenco dei comuni: comuni di oggi, vecchi nomi e soppressi; province del modulo (con SU); licenza e generatore', () => {
  const voci = RIGHE_COMUNI.map(r => r.split(';'));
  const oggi = voci.filter(v => v.length === 2), vecchi = voci.filter(v => v[2] && v[2][0] === '='), soppressi = voci.filter(v => v[2] === '-');
  assert.equal(oggi.length, 7902, 'comuni di oggi');
  assert.equal(oggi.length + vecchi.length + soppressi.length, voci.length);
  assert.ok(vecchi.length > 2000 && soppressi.length > 2000);
  assert.ok(voci.every(v => /^[A-Z][A-Z0-9 '\-.\/()]*$/.test(v[0]) && /^[A-Z]{2}$/.test(v[1])), 'nomi in maiuscolo e sigle di provincia');
  assert.equal(new Set(voci.map(v => v[0] + ';' + v[1])).size, voci.length, 'un solo comune per nome e provincia');
  const nomiOggi = new Set(oggi.map(v => v[0]));
  assert.ok(vecchi.every(v => nomiOggi.has(v[2].slice(1))), 'ogni vecchio nome rimanda a un comune di oggi');
  for (const [nome, prov] of [['ROMA', 'RM'], ['GUBBIO', 'PG'], ["REGGIO NELL'EMILIA", 'RE'], ['MILANO', 'MI'], ['CARBONIA', 'SU']]) assert.ok(RIGHE_COMUNI.includes(nome + ';' + prov), nome);
  // ogni provincia di un comune di oggi è nell'elenco delle province del modulo (che ora ha anche SU, Sud Sardegna)
  assert.ok(PROVINCE.includes('SU'));
  assert.deepEqual([...new Set(oggi.map(v => v[1]))].filter(p => !PROVINCE.includes(p)), []);
  assert.match(read('elenchi/LICENZA-codice-fiscale-it.txt'), /^MIT License/);
  assert.match(read('elenchi/comuni.js'), /Fonte: archivio dei comuni del pacchetto npm codice-fiscale-it 1\.0\.1 \(licenza MIT/);
  assert.match(read('elenchi/genera-comuni.cjs'), /writeFileSync\(path\.join\(__dirname, 'comuni\.js'\)/);
});

test('campo comune: si scrive o si sceglie, ma vale solo un comune dell\'elenco; vecchi nomi, omonimi, lettere sbagliate dall\'OCR', async () => {
  const E = ElencoComuniDiProva();
  assert.equal(await E.carica(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(E.cerca('Gubbio'))).nome, 'GUBBIO');
  assert.equal(E.cerca('gubbio').prov, 'PG', 'maiuscole o minuscole');
  assert.equal(E.cerca('Agliè').nome, "AGLIE'", 'accento scritto o con l\'apostrofo');
  assert.deepEqual([E.cerca('Abano Bagni').nome, E.cerca('Abano Bagni').prov], ['ABANO TERME', 'PD'], 'vecchio nome → nome di oggi');
  assert.ok(E.cerca('Castro').ambiguo, 'Castro: due comuni (BG e LE)');
  assert.equal(E.cerca('Castro', 'LE').prov, 'LE', 'con la provincia si sceglie');
  assert.equal(E.cerca('Pippolandia'), null, 'un comune inventato non c\'è');
  assert.deepEqual(Array.from(E.trova('gubb'), v => v.nome), ['GUBBIO']);
  assert.equal(E.trova('san gio', 'NA')[0].nome, 'SAN GIORGIO A CREMANO', 'prima i comuni della provincia scelta');
  const ocr = E.simile('GUBBLO', 'PG');
  assert.deepEqual([ocr.nome, ocr.approssimato], ['GUBBIO', true], 'una lettera sbagliata dall\'OCR, nella provincia letta');
  assert.equal(E.simile('GUBBLO', 'RM'), null, 'non in un\'altra provincia');
  assert.equal(E.simile('XYZWQ', 'VE'), null);
});

test('fotocamera: zoom chiesto dentro i limiti del browser, zona dello scatto vero, nitidezza dei fotogrammi', () => {
  const ctx = { navigator: { userAgent: '' }, document: {}, addEventListener() {}, Math, isFinite };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('fotocamera.js'), ctx, { filename: 'fotocamera.js' });
  const F = ctx.FotocameraDocumento;
  // zoom 2x se il browser lo offre; mai fuori dai limiti (Safari 17.4 poteva bloccarsi), sul passo dichiarato
  assert.equal(F._zoom(undefined), null, 'nessuno zoom offerto');
  assert.equal(F._zoom({ min: 1, max: 8, step: 0.1 }), 2);
  assert.equal(F._zoom({ min: 0.5, max: 15, step: 0.5 }), 2, 'iPhone con il grandangolo: 1 = fotocamera principale');
  assert.equal(F._zoom({ min: 1, max: 1.8, step: 0.1 }), 1.8, 'al massimo il massimo dichiarato');
  assert.equal(F._zoom({ min: 1, max: 1.2, step: 0.1 }), null, 'meno di 1,5x: niente');
  assert.equal(F._zoom({ min: 100, max: 400, step: 1 }), null, 'zoom in un\'altra scala: niente');
  const z = F._zoom({ min: 1, max: 10, step: 0.3 });
  assert.ok(Math.abs(z - 1.9) < 1e-9, 'sul passo: ' + z);
  // scatto vero 3024x4032 e video 1080x1920 (stesso campo sul lato lungo): la zona del riquadro, più il margine, nella foto
  const reg = { x: 90, y: 620, w: 900, h: 580 };
  const m = F._mappa(reg, 1080, 1920, 3024, 4032);
  assert.ok(Math.abs(m.scala - 2.1) < 1e-9);
  const centro = [m.x + m.w / 2, m.y + m.h / 2], atteso = [(reg.x + reg.w / 2 - 540) * 2.1 + 1512, (reg.y + reg.h / 2 - 960) * 2.1 + 2016];
  assert.ok(Math.abs(centro[0] - atteso[0]) < 1e-6 && Math.abs(centro[1] - atteso[1]) < 1e-6, 'stesso centro');
  assert.ok(m.w > reg.w * 2.1 && m.h > reg.h * 2.1, 'con il margine');
  const bordo = F._mappa({ x: 0, y: 0, w: 1080, h: 1920 }, 1080, 1920, 3024, 4032);
  assert.ok(bordo.x >= 0 && bordo.y >= 0 && bordo.x + bordo.w <= 3024 && bordo.y + bordo.h <= 4032, 'dentro la foto');
  // nitidezza: un fotogramma nitido vale più dello stesso sfocato; uno uniforme vale zero
  const fotogramma = (w, h, valore) => { const data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = valore(x, y), i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; } return { data, width: w, height: h }; };
  const nitido = fotogramma(64, 40, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? 230 : 20);
  const sfocato = fotogramma(64, 40, (x, y) => 125 + 105 * Math.sin(x * Math.PI / 4) * Math.sin(y * Math.PI / 4) * 0.4);
  assert.ok(F._nitidezza(nitido) > 4 * F._nitidezza(sfocato));
  assert.equal(F._nitidezza(fotogramma(20, 20, () => 128)), 0);
});

test('fotocamera con il riquadro e campi con elenco: nessuna archiviazione, nessuna rete (solo l\'elenco dei comuni dal sito), nessuna console', () => {
  const senzaCommenti = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/\s.*$/gm, '');
  for (const f of ['fotocamera.js', 'campi-elenco.js']) {
    const src = senzaCommenti(read(f));
    for (const [nome, re] of [['fetch', /\bfetch\s*\(/], ['XMLHttpRequest', /XMLHttpRequest/], ['sendBeacon', /sendBeacon/], ['WebSocket', /WebSocket/],
      ['localStorage', /localStorage/], ['sessionStorage', /sessionStorage/], ['indexedDB', /indexedDB/], ['caches', /\bcaches\./], ['cookie', /document\.cookie/],
      ['console', /\bconsole\./], ['eval', /\beval\s*\(|new Function\s*\(/], ['URL esterni', /https?:\/\//], ['indirizzi blob', /createObjectURL/]]) assert.ok(!re.test(src), f + ': ' + nome);
  }
  const foto = senzaCommenti(read('fotocamera.js'));
  assert.match(foto, /getTracks\(\)\.forEach\(tr => tr\.stop\(\)\)/, 'la fotocamera si spegne alla chiusura');
  assert.match(foto, /window\.addEventListener\('pagehide', chiudi\)/);
  assert.match(senzaCommenti(read('campi-elenco.js')), /s\.src = 'elenchi\/comuni\.js\?v=' \+ VERSIONE_ELENCHI;/, 'l\'elenco dei comuni dallo stesso sito');
  // pagina e build: i due file si caricano dopo checkin.js e si copiano in public/ (Vercel); l'elenco dei comuni a ogni build
  const html = read('index.html');
  assert.ok(html.indexOf('checkin.js?v=') < html.indexOf('campi-elenco.js?v=') && html.indexOf('campi-elenco.js?v=') < html.indexOf('fotocamera.js?v='));
  for (const f of ['campi-elenco.js', 'fotocamera.js']) assert.equal(read('public/' + f), read(f), 'public/' + f);
  const build = read('build.sh');
  for (const r of ['cp campi-elenco.js public/', 'cp fotocamera.js public/', 'cp elenchi/comuni.js elenchi/LICENZA-codice-fiscale-it.txt public/elenchi/']) assert.ok(build.includes(r), 'build.sh: ' + r);
  assert.ok(read('.gitignore').split('\n').includes('/public/elenchi/'));
  // generaStepOspiti chiama i campi con elenco e la scansione (che si apre da sola, senza scelta) dopo aver creato il passo
  assert.match(SRC_CHECKIN, /if \(typeof window\.potenziaCampiElenco === 'function'\) window\.potenziaCampiElenco\(stepDiv\);\n    if \(i === 1\) aggiornaObbligoRetro\(1\);\n    if \(scansioneDisponibile\(\)\) avviaScansione\(i\);/);
});

test('flag della scansione: «spenta» nel codice pubblicato; «prova» solo con #scansione=prova; «attiva» per tutti', () => {
  // valore deciso dal titolare: 05/11/2026 'prova' sul branch delle prove (gli ospiti non vedono nulla senza #scansione=prova).
  // 'attiva' solo con una sua decisione esplicita: cambiarlo qui va dichiarato nel messaggio di commit.
  assert.match(SRC_CHECKIN, /\nconst SCANSIONE_DOCUMENTI = 'prova';/, 'valore del flag diverso da quello deciso dal titolare');
  const FLAG = /const SCANSIONE_DOCUMENTI = '[a-z]+';/;
  const con = (valore, hash) => passiOspiti(ROOT, 2, { hash, sorgente: SRC_CHECKIN.replace(FLAG, "const SCANSIONE_DOCUMENTI = '" + valore + "';") });
  // 06/11/2026: niente scelta «a mano / scansione», il pannello è sempre aperto in cima al passo
  const ha = passi => passi.every((p, i) => p.html.includes('class="scan-doc"') && p.html.includes('<div class="scan-pannello" id="scan-pannello-' + (i + 1) + '"></div>') && !p.html.includes('sceltaCompilazione('));
  // nel contesto di prova WebAssembly e Worker non ci sono (come in un browser molto vecchio): la scelta non compare
  assert.ok(!con('attiva', '').some(p => p.html.includes('scan-doc')), 'senza WebAssembly e Worker si compila solo a mano');
  const conMotore = (valore, hash) => {
    const src = SRC_CHECKIN.replace(FLAG, "const SCANSIONE_DOCUMENTI = '" + valore + "';")
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
    const senza = SENZA_SU(p.html.replace(/<div class="scan-doc" id="scan-doc-\d+">\n        <div class="scan-pannello" id="scan-pannello-\d+"><\/div>\n      <\/div>\n      /, ''));
    assert.equal(sha(senza), ATTUALI.casi['2-it'][i].sha256, 'passo ' + p.id + ': il resto del markup non cambia');
  });
});

test('codice della scansione: nessuna rete, nessuna archiviazione, nessuna console; Tesseract solo con i file del sito', () => {
  const moduli = ['scansione/scansione-documento.js', 'scansione/lettura-documento.js', 'scansione/immagine.js', 'scansione/decodifica-heic.js'].map(f => [f, read(f)]);
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
