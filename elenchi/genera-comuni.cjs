// elenchi/genera-comuni.cjs — crea elenchi/comuni.js dall'archivio dei comuni del pacchetto npm codice-fiscale-it (MIT).
//
//   npm pack codice-fiscale-it@1.0.1 && tar -xzf codice-fiscale-it-1.0.1.tgz
//   node elenchi/genera-comuni.cjs package/dist/data/comuni.json
//
// L'archivio ha una voce per nome: [codice catastale, sigla della provincia, NOME, 1 se il comune esiste oggi]. Gli Stati esteri
// (provincia «EE») non servono: lo Stato di nascita si sceglie nel suo campo. Per ogni codice catastale:
//  - il nome attivo è il comune di oggi;
//  - un nome non attivo con lo stesso codice di un nome attivo è un vecchio nome dello stesso comune (si cerca, ma nel modulo si
//    scrive il nome di oggi: è quello della tabella ufficiale di Alloggiati Web);
//  - i codici senza nome attivo sono comuni soppressi (chi è nato lì li trova con il loro nome).
'use strict';
const fs = require('fs');
const path = require('path');

const sorgente = process.argv[2];
if (!sorgente) { process.stderr.write('uso: node elenchi/genera-comuni.cjs <comuni.json di codice-fiscale-it>\n'); process.exit(1); }
const voci = JSON.parse(fs.readFileSync(sorgente, 'utf8'));
const perCodice = new Map();
for (const v of voci) {
  if (!Array.isArray(v) || v.length < 4) continue;
  const [codice, prov, nome, attivo] = v;
  if (prov === 'EE' || !/^[A-Z]\d{3}$/.test(codice) || !/^[A-Z]{2}$/.test(prov) || !nome) continue;
  // qualche vecchio nome porta una nota tra parentesi («BOIANO (corr. BOJANO)»): resta il nome
  const pulito = String(nome).replace(/\s*\(.*\)\s*$/, '').trim();
  if (!pulito) continue;
  if (!perCodice.has(codice)) perCodice.set(codice, []);
  perCodice.get(codice).push({ nome: pulito, prov, attivo: attivo === 1 });
}
const righe = new Map();     // «NOME;PR» → riga (un solo comune per nome e provincia: vince quello attivo)
for (const lista of perCodice.values()) {
  const attivo = lista.find(x => x.attivo);
  for (const x of lista) {
    if (!x.attivo && attivo && x.nome === attivo.nome && x.prov === attivo.prov) continue;     // nome vecchio uguale a quello di oggi
    const chiave = x.nome + ';' + x.prov;
    const riga = x.attivo ? chiave : attivo ? chiave + ';=' + attivo.nome : chiave + ';-';
    const prima = righe.get(chiave);
    if (!prima || (x.attivo && prima.includes(';', chiave.length))) righe.set(chiave, riga);
  }
}
const elenco = [...righe.values()].sort((a, b) => a.localeCompare(b, 'it'));
if (elenco.some(r => /[`$\\]/.test(r))) throw new Error('carattere non ammesso in un nome');
const testa = `// elenchi/comuni.js — comuni italiani (di oggi, vecchi nomi, soppressi) per il campo «Comune» del check-in (campi-elenco.js).
// Fonte: archivio dei comuni del pacchetto npm codice-fiscale-it 1.0.1 (licenza MIT: elenchi/LICENZA-codice-fiscale-it.txt).
// Creato con elenchi/genera-comuni.cjs: non modificare a mano. Righe: «NOME;PR» comune di oggi; «NOME;PR;=NOME DI OGGI» vecchio
// nome; «NOME;PR;-» comune soppresso. ${elenco.filter(r => r.split(';').length === 2).length} comuni di oggi, ${elenco.length} voci.
`;
fs.writeFileSync(path.join(__dirname, 'comuni.js'), testa + 'window.ELENCO_COMUNI = `' + elenco.join('\n') + '`;\n');
process.stdout.write('voci ' + elenco.length + '\n');
