// scansione/lettura-documento.js — interpretazione del testo letto da un documento d'identità.
//
// Modulo PURO: niente pagina, niente rete, niente archiviazione, niente console. Riceve il testo che l'OCR ha letto
// (scansione-documento.js) e restituisce le PROPOSTE per i campi del modulo di check-in, ognuna con il suo livello di
// affidabilità. Non decide nulla da solo: la conferma finale è sempre dell'ospite.
//
// Regole (docs/scansione-documenti.md):
//  - Con la MRZ i campi si verificano con le cifre di controllo ICAO 9303 (libreria mrz, ospitata in vendor/mrz).
//  - Un campo che non si legge o non si verifica resta VUOTO: niente dati inventati, niente valori «probabili».
//  - Si propongono solo i campi che il modulo chiede (minimizzazione). Per gli ospiti diversi dal responsabile nessun dato
//    del documento (tipo, numero, rilascio): il modulo non li chiede.
//  - Le voci proposte sono quelle del modulo (Stati in italiano, tipi di documento): i codici ufficiali di Alloggiati Web
//    li assegna il server con le tabelle ufficiali, come per i dati scritti a mano.
//  - Il codice fiscale serve solo come controllo incrociato (cognome, nome, data di nascita, sesso): non diventa mai il
//    numero del documento e non va in nessun campo.
import { parse as parseMrzLibreria } from './vendor/mrz/mrz.js';

export const SICURO = 'sicuro';
export const DA_VERIFICARE = 'da_verificare';

// Voci dell'elenco «Tipo documento» del modulo (checkin.js → tipiDocumento). Le prove controllano che coincidano.
export const TIPI_DOCUMENTO = {
  PASSAPORTO: 'PASSAPORTO ORDINARIO',
  CARTA_IDENTITA: "CARTA DI IDENTITA'",
  CIE: "CARTA IDENTITA' ELETTRONICA",
  PATENTE: 'PATENTE DI GUIDA',
  PASSAPORTO_DIPLOMATICO: 'PASSAPORTO DIPLOMATICO',
  PASSAPORTO_SERVIZIO: 'PASSAPORTO DI SERVIZIO'
};

// ---- Codici della MRZ → voci «Stato» del modulo ----
// ISO 3166-1 alpha-3 e codici ICAO (la Germania usa «D»). Ogni valore è una voce esatta dell'elenco `stati` di checkin.js
// (controllato dalle prove), che il server traduce poi nel codice della tabella ufficiale Luoghi.
export const ISO_STATI = {
  AFG: 'Afghanistan', AGO: 'Angola', ALB: 'Albania', AND: 'Andorra', ARE: 'Emirati Arabi Uniti', ARG: 'Argentina', ARM: 'Armenia',
  ATG: 'Antigua e Barbuda', AUS: 'Australia', AUT: 'Austria', AZE: 'Azerbaigian', BDI: 'Burundi', BEL: 'Belgio', BEN: 'Benin',
  BFA: 'Burkina Faso', BGD: 'Bangladesh', BGR: 'Bulgaria', BHR: 'Bahrain', BHS: 'Bahamas', BIH: 'Bosnia ed Erzegovina', BLR: 'Bielorussia',
  BLZ: 'Belize', BOL: 'Bolivia', BRA: 'Brasile', BRB: 'Barbados', BRN: 'Brunei', BTN: 'Bhutan', BWA: 'Botswana',
  CAF: 'Repubblica Centrafricana', CAN: 'Canada', CHE: 'Svizzera', CHL: 'Cile', CHN: 'Cina', CIV: "Costa d'Avorio", CMR: 'Camerun',
  COD: 'Repubblica Democratica del Congo', COG: 'Repubblica del Congo', COM: 'Comore', CPV: 'Capo Verde', CRI: 'Costa Rica', CUB: 'Cuba',
  CYP: 'Cipro', CZE: 'Repubblica Ceca', D: 'Germania', DEU: 'Germania', DJI: 'Gibuti', DMA: 'Dominica', DNK: 'Danimarca',
  DOM: 'Repubblica Dominicana', DZA: 'Algeria', ECU: 'Ecuador', EGY: 'Egitto', ERI: 'Eritrea', ESP: 'Spagna', EST: 'Estonia',
  ETH: 'Etiopia', FIN: 'Finlandia', FJI: 'Figi', FRA: 'Francia', FSM: 'Micronesia', GAB: 'Gabon', GBR: 'Regno Unito', GEO: 'Georgia',
  GHA: 'Ghana', GIN: 'Guinea', GMB: 'Gambia', GNB: 'Guinea-Bissau', GNQ: 'Guinea Equatoriale', GRC: 'Grecia', GRD: 'Grenada',
  GTM: 'Guatemala', GUY: 'Guyana', HND: 'Honduras', HRV: 'Croazia', HTI: 'Haiti', HUN: 'Ungheria', IDN: 'Indonesia', IND: 'India',
  IRL: 'Irlanda', IRN: 'Iran', IRQ: 'Iraq', ISL: 'Islanda', ISR: 'Israele', ITA: 'Italia', JAM: 'Giamaica', JOR: 'Giordania',
  JPN: 'Giappone', KAZ: 'Kazakistan', KEN: 'Kenya', KGZ: 'Kirghizistan', KHM: 'Cambogia', KIR: 'Kiribati', KNA: 'Saint Kitts e Nevis',
  KOR: 'Corea del Sud', KWT: 'Kuwait', LAO: 'Laos', LBN: 'Libano', LBR: 'Liberia', LBY: 'Libia', LCA: 'Saint Lucia', LIE: 'Liechtenstein',
  LKA: 'Sri Lanka', LSO: 'Lesotho', LTU: 'Lituania', LUX: 'Lussemburgo', LVA: 'Lettonia', MAR: 'Marocco', MCO: 'Monaco', MDA: 'Moldavia',
  MDG: 'Madagascar', MDV: 'Maldive', MEX: 'Messico', MHL: 'Isole Marshall', MKD: 'Macedonia del Nord', MLI: 'Mali', MLT: 'Malta',
  MMR: 'Birmania', MNE: 'Montenegro', MNG: 'Mongolia', MOZ: 'Mozambico', MRT: 'Mauritania', MUS: 'Mauritius', MWI: 'Malawi',
  MYS: 'Malaysia', NAM: 'Namibia', NER: 'Niger', NGA: 'Nigeria', NIC: 'Nicaragua', NLD: 'Paesi Bassi', NOR: 'Norvegia', NPL: 'Nepal',
  NRU: 'Nauru', NZL: 'Nuova Zelanda', OMN: 'Oman', PAK: 'Pakistan', PAN: 'Panama', PER: 'Peru', PHL: 'Filippine', PLW: 'Palau',
  PNG: 'Papua Nuova Guinea', POL: 'Polonia', PRK: 'Corea del Nord', PRT: 'Portogallo', PRY: 'Paraguay', QAT: 'Qatar', ROU: 'Romania',
  RUS: 'Russia', RWA: 'Ruanda', SAU: 'Arabia Saudita', SDN: 'Sudan', SEN: 'Senegal', SGP: 'Singapore', SLE: 'Sierra Leone',
  SLV: 'El Salvador', SMR: 'San Marino', SOM: 'Somalia', SRB: 'Serbia', SSD: 'Sudan del Sud', STP: 'São Tomé e Príncipe', SUR: 'Suriname',
  SVK: 'Slovacchia', SVN: 'Slovenia', SWE: 'Svezia', SWZ: 'Swaziland', SYC: 'Seychelles', SYR: 'Siria', TCD: 'Ciad', TGO: 'Togo',
  THA: 'Thailandia', TJK: 'Tagikistan', TKM: 'Turkmenistan', TLS: 'Timor Est', TON: 'Tonga', TTO: 'Trinidad e Tobago', TUN: 'Tunisia',
  TUR: 'Turchia', TUV: 'Tuvalu', TZA: 'Tanzania', UGA: 'Uganda', UKR: 'Ucraina', URY: 'Uruguay', USA: 'Stati Uniti', UZB: 'Uzbekistan',
  VAT: 'Vaticano', VCT: 'Saint Vincent e Grenadine', VEN: 'Venezuela', VNM: 'Vietnam', VUT: 'Vanuatu', WSM: 'Samoa', YEM: 'Yemen',
  ZAF: 'Sudafrica', ZMB: 'Zambia', ZWE: 'Zimbabwe'
};

// Codici ICAO validi che NON corrispondono a una voce del modulo: il campo resta vuoto e l'ospite sceglie.
// (apolidi, rifugiati, organizzazioni internazionali, cittadinanze britanniche particolari, Stati assenti dall'elenco del modulo)
export const CODICI_SENZA_VOCE = {
  XXA: 'apolide', XXB: 'rifugiato', XXC: 'rifugiato', XXX: 'non specificata', UNO: 'Nazioni Unite', UNA: 'Nazioni Unite', UNK: 'Kosovo (UNMIK)',
  EUE: 'Unione europea', XOM: 'Ordine di Malta', XPO: 'Interpol', XCC: 'Comunità dei Caraibi', XEC: 'Comunità dell\'Africa occidentale',
  XBA: 'Banca africana di sviluppo', XIM: 'Banca africana per l\'import-export', XCE: 'Consiglio d\'Europa', XCO: 'COMESA', XDC: 'SADC', XES: 'OECO',
  GBD: 'cittadinanza britannica particolare', GBN: 'cittadinanza britannica particolare', GBO: 'cittadinanza britannica particolare',
  GBP: 'cittadinanza britannica particolare', GBS: 'cittadinanza britannica particolare', RKS: 'Kosovo', PSE: 'Palestina', TWN: 'Taiwan',
  HKG: 'Hong Kong', MAC: 'Macao', ESH: 'Sahara Occidentale', COK: 'Isole Cook', NIU: 'Niue'
};

export function statoDaCodice(codice) {
  const c = String(codice || '').replace(/</g, '').toUpperCase();
  if (!c) return { stato: null, motivo: 'vuoto' };
  if (ISO_STATI[c]) return { stato: ISO_STATI[c], codice: c };
  if (CODICI_SENZA_VOCE[c]) return { stato: null, codice: c, motivo: 'senza_voce' };
  return { stato: null, codice: c, motivo: 'sconosciuto' };
}

// ---- Strumenti di base ----

// Cifra di controllo ICAO 9303: pesi 7-3-1 ripetuti; «<» vale 0, le lettere valgono A=10 … Z=35.
export function cifraControllo(valore) {
  const pesi = [7, 3, 1];
  let somma = 0;
  for (let i = 0; i < valore.length; i++) {
    const c = valore[i];
    let v;
    if (c === '<') v = 0;
    else if (c >= '0' && c <= '9') v = c.charCodeAt(0) - 48;
    else if (c >= 'A' && c <= 'Z') v = c.charCodeAt(0) - 55;
    else return null;
    somma += v * pesi[i % 3];
  }
  return String(somma % 10);
}

// Lettere e cifre che l'OCR confonde. Nei campi numerici della MRZ la libreria corregge da sola (autocorrect); qui servono
// per i nomi (solo lettere) e per il numero del documento (lettere e cifre: lo decide la cifra di controllo).
const VERSO_LETTERA = { 0: 'O', 1: 'I', 2: 'Z', 4: 'A', 5: 'S', 6: 'G', 7: 'T', 8: 'B' };
const AMBIGUI = { O: ['0', 'Q', 'D'], 0: ['O', 'D', 'Q'], Q: ['0', 'O'], D: ['0', 'O'], I: ['1', 'L'], 1: ['I', 'L'], L: ['1', 'I'],
  B: ['8'], 8: ['B'], S: ['5'], 5: ['S'], Z: ['2'], 2: ['Z'], G: ['6'], 6: ['G'], T: ['7'], 7: ['T'], A: ['4'], 4: ['A'] };

const senzaAccenti = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
// Forma di confronto di un nome: maiuscole, senza accenti, solo lettere (come nella MRZ, dove apostrofi e trattini spariscono).
export const chiaveNome = s => senzaAccenti(s).toUpperCase().replace(/[^A-Z]/g, '');
// Come la scrive la MRZ (ICAO 9303, traslitterazione): Ä → AE, Ö → OE, Ü → UE, ß → SS, Å → AA, Æ → AE, Ø → OE…
const TRASLITTERA = { 'Ä': 'AE', 'Ö': 'OE', 'Ü': 'UE', 'ß': 'SS', 'Å': 'AA', 'Æ': 'AE', 'Ø': 'OE', 'Œ': 'OE', 'Þ': 'TH', 'Ð': 'D', 'Ĳ': 'IJ' };
export const chiaveIcao = s => chiaveNome(String(s || '').toUpperCase().replace(/[ÄÖÜßÅÆØŒÞÐĲ]/g, c => TRASLITTERA[c] || c));
// Forma di confronto di una voce (Stato, provincia, comune): maiuscole, senza accenti e punteggiatura, spazi singoli.
const chiaveVoce = s => senzaAccenti(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const isoValida = (a, m, g) => {
  const d = new Date(Date.UTC(a, m - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g;
};
const iso = (a, m, g) => String(a).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(g).padStart(2, '0');
const oggiIso = oggi => new Date(oggi == null ? Date.now() : oggi).toISOString().slice(0, 10);
const annoDi = oggi => new Date(oggi == null ? Date.now() : oggi).getUTCFullYear();
const etaIn = (nascitaIso, oggi) => {
  const [a, m, g] = nascitaIso.split('-').map(Number), o = new Date(oggi == null ? Date.now() : oggi);
  let e = o.getUTCFullYear() - a;
  if (o.getUTCMonth() + 1 < m || (o.getUTCMonth() + 1 === m && o.getUTCDate() < g)) e--;
  return e;
};

// ---- Date con l'anno a 2 cifre (MRZ, patente) ----
// Nascita: 20AA se quella data non è nel futuro, altrimenti 19AA (2060 per una nascita è impossibile: si legge 1960).
// «incerta» quando anche 19AA darebbe un'età credibile (fino a 110 anni): può essere un bambino o un ultracentenario,
// quindi il campo va controllato dall'ospite se nessun'altra fonte (anno a 4 cifre stampato) lo conferma.
export function dataNascitaDaAnnoBreve(aa, mm, gg, oggi) {
  const a2 = parseInt(aa, 10), m = parseInt(mm, 10), g = parseInt(gg, 10);
  if (!(a2 >= 0 && a2 <= 99) || !(m >= 1 && m <= 12) || !(g >= 1 && g <= 31)) return null;
  const oggiS = oggiIso(oggi);
  let anno = 2000 + a2;
  if (!isoValida(anno, m, g) && !isoValida(1900 + a2, m, g)) return null;
  if (!isoValida(anno, m, g) || iso(anno, m, g) > oggiS) anno = 1900 + a2;
  if (!isoValida(anno, m, g)) return null;
  const valore = iso(anno, m, g);
  const alternativa = anno >= 2000 ? iso(anno - 100, m, g) : null;
  const incerta = !!alternativa && isoValida(anno - 100, m, g) && etaIn(alternativa, oggi) <= 110;
  return { iso: valore, incerta };
}
// Scadenza (e rilascio): sempre 20AA, tranne il caso impossibile di una data oltre 50 anni nel futuro.
export function dataDocumentoDaAnnoBreve(aa, mm, gg, oggi) {
  const a2 = parseInt(aa, 10), m = parseInt(mm, 10), g = parseInt(gg, 10);
  if (!(a2 >= 0 && a2 <= 99)) return null;
  let anno = 2000 + a2;
  if (anno > annoDi(oggi) + 50) anno -= 100;
  return isoValida(anno, m, g) ? iso(anno, m, g) : null;
}

// ---- Codice fiscale (solo controllo incrociato) ----
const CF_DISPARI = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };
const CF_MESI = 'ABCDEHLMPRST';
const CF_OMOCODIA = 'LMNPQRSTUV';            // cifre sostituite da lettere nei codici omocodici
const RE_CF = /[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]/;
const POS_CIFRE_CF = [6, 7, 9, 10, 12, 13, 14];

export function carattereControlloCF(primi15) {
  let s = 0;
  for (let i = 0; i < 15; i++) {
    const c = primi15[i];
    s += i % 2 === 0 ? CF_DISPARI[c] : (c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 65);
  }
  return String.fromCharCode(65 + (s % 26));
}
export const codiceFiscaleValido = cf => typeof cf === 'string' && cf.length === 16 && RE_CF.test(cf) && carattereControlloCF(cf) === cf[15];

// Cerca nel testo un codice fiscale con il carattere di controllo giusto. Solo parole intere di 16 caratteri (o due o tre parole
// vicine che insieme fanno 16, se l'OCR ha messo uno spazio), mai le righe della MRZ, e con almeno 4 cifre vere nelle posizioni
// delle cifre: così una parola qualsiasi («PASSPORTPASSEPORT»…) non diventa un codice fiscale per caso. Nelle posizioni delle cifre
// si correggono le lettere simili (O al posto di 0…), non quelle dell'omocodia. Restituisce il codice o null.
export function trovaCodiceFiscale(testo) {
  const righe = String(testo || '').toUpperCase().split(/\n/);
  for (const r of righe) {
    if (r.includes('<')) continue;
    const parole = r.split(/[^A-Z0-9]+/).filter(Boolean);
    const candidati = [];
    for (let i = 0; i < parole.length; i++) {
      let unite = '';
      for (let j = i; j < Math.min(parole.length, i + 3); j++) {
        unite += parole[j];
        if (unite.length === 16) candidati.push(unite);
        if (unite.length >= 16) break;
      }
    }
    for (const c of candidati) {
      if (POS_CIFRE_CF.filter(k => /[0-9]/.test(c[k])).length < 4) continue;
      if (codiceFiscaleValido(c)) return c;
      const corretto = Array.from(c).map((ch, k) => (POS_CIFRE_CF.includes(k) && /[A-Z]/.test(ch) && !CF_OMOCODIA.includes(ch)) ? ({ O: '0', D: '0', Q: '0', I: '1', Z: '2', S: '5', G: '6', B: '8' }[ch] || ch) : ch).join('');
      if (corretto !== c && codiceFiscaleValido(corretto)) return corretto;
    }
  }
  return null;
}

const consonanti = s => chiaveNome(s).replace(/[AEIOU]/g, '');
const vocali = s => chiaveNome(s).replace(/[^AEIOU]/g, '');
export function codiceCognomeCF(cognome) { return (consonanti(cognome) + vocali(cognome) + 'XXX').slice(0, 3); }
export function codiceNomeCF(nome) {
  const c = consonanti(nome);
  if (c.length >= 4) return c[0] + c[2] + c[3];
  return (c + vocali(nome) + 'XXX').slice(0, 3);
}
const deOmocodia = ch => (CF_OMOCODIA.includes(ch) ? String(CF_OMOCODIA.indexOf(ch)) : ch);
export function decodificaCF(cf) {
  if (!codiceFiscaleValido(cf)) return null;
  const n = Array.from(cf).map((ch, k) => (POS_CIFRE_CF.includes(k) ? deOmocodia(ch) : ch)).join('');
  const aa = n.slice(6, 8), mese = CF_MESI.indexOf(n[8]) + 1, giorno = parseInt(n.slice(9, 11), 10);
  return { cognome: n.slice(0, 3), nome: n.slice(3, 6), annoBreve: aa, mese, giorno: giorno > 40 ? giorno - 40 : giorno,
    genere: giorno > 40 ? 'F' : 'M', natoAllEstero: n[11] === 'Z' };
}
// Confronto con i dati letti: per ogni campo true (coincide), false (non coincide) o null (non confrontabile).
export function confrontaCF(cf, dati) {
  const d = decodificaCF(cf);
  if (!d) return null;
  const r = { cognome: null, nome: null, nascita: null, genere: null };
  if (dati.cognome) r.cognome = codiceCognomeCF(dati.cognome) === d.cognome;
  if (dati.nome) r.nome = codiceNomeCF(dati.nome) === d.nome;
  if (dati.nascita && /^\d{4}-\d{2}-\d{2}$/.test(dati.nascita)) {
    const [a, m, g] = dati.nascita.split('-');
    r.nascita = a.slice(2) === d.annoBreve && parseInt(m, 10) === d.mese && parseInt(g, 10) === d.giorno;
  }
  if (dati.genere) r.genere = dati.genere === d.genere;
  return r;
}

// ---- MRZ ----

// Ripulisce una riga letta dall'OCR: maiuscole, via spazi e segni; i simboli che l'OCR scambia per «<» diventano «<».
// Una lettera isolata in mezzo a una lunga fila di «<» è quasi sempre un «<» letto male.
export function pulisciRigaMrz(riga) {
  let s = String(riga || '').toUpperCase().replace(/[«‹＜≪]/g, '<').replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, '');
  for (let k = 0; k < 2; k++) s = s.replace(/(<{3,})[A-Z0-9](<{3,})/g, '$1<$2');
  // file di «<» lette come C o K (succede con le foto un po' sfocate): 4 o più caratteri di fila tra «<», C e K con almeno due «<»,
  // oppure 5 o più C/K di fila (nessun nome ha quattro C o K consecutive)
  s = s.replace(/[<CK]{4,}/g, m => ((m.match(/</g) || []).length >= 2 || m.length >= 5) ? '<'.repeat(m.length) : m);
  return s;
}
const pareMrz = s => s.length >= 20 && /^[A-Z0-9<]+$/.test(s) && (s.includes('<') || /^[A-Z0-9]{28,}$/.test(s));

const FORMATI = [
  { nome: 'TD3', righe: 2, lunghezza: 44 },
  { nome: 'TD2', righe: 2, lunghezza: 36 },
  { nome: 'TD1', righe: 3, lunghezza: 30 }
];

function punteggio(righe) {
  let r;
  try { r = parseMrzLibreria(righe, { autocorrect: true }); } catch { return { punti: -1 }; }
  let punti = 0;
  for (const d of r.details) {
    if (!d.field) continue;
    // la cifra di controllo di un campo vale più di quella complessiva (che, con due errori, può tornare per caso)
    if (/CheckDigit$/.test(d.field) && d.valid) punti += d.field === 'compositeCheckDigit' ? 2 : 3;
    if (d.valid && /^(issuingState|nationality|birthDate|expirationDate|sex|documentCode)$/.test(d.field)) punti += 1;
  }
  return { punti, risultato: r };
}

// Porta una riga alla lunghezza del formato: se l'OCR ha perso o aggiunto un «<» nelle file di riempimento, prova a
// inserirlo o toglierlo in ogni fila e tiene la versione con più cifre di controllo esatte.
function allineaRiga(riga, lunghezza, righe, indice) {
  if (riga.length === lunghezza) return riga;
  const candidati = new Set();
  if (riga.length > lunghezza) {
    const t = riga.replace(/<+$/, m => m.slice(0, Math.max(0, m.length - (riga.length - lunghezza))));
    candidati.add(t.length === lunghezza ? t : riga.slice(0, lunghezza));
    if (riga.length - lunghezza <= 2) for (let i = 0; i < riga.length; i++) {
      const x = riga.slice(0, i) + riga.slice(i + 1);
      candidati.add(x.length === lunghezza ? x : x.slice(0, lunghezza));
    }
  } else {
    const manca = lunghezza - riga.length;
    candidati.add(riga + '<'.repeat(manca));
    if (manca <= 2) {
      const re = /<+/g; let m;
      while ((m = re.exec(riga))) candidati.add(riga.slice(0, m.index) + '<'.repeat(manca) + riga.slice(m.index));
    }
  }
  let migliore = null, punti = -2;
  for (const c of candidati) {
    if (c.length !== lunghezza) continue;
    const prova = righe.slice(); prova[indice] = c;
    const p = punteggio(prova).punti;
    if (p > punti) { punti = p; migliore = c; }
  }
  return migliore || (riga + '<'.repeat(Math.max(0, lunghezza - riga.length))).slice(0, lunghezza);
}

// Dalle righe lette (in ordine) individua il blocco MRZ più credibile e lo restituisce già alla lunghezza esatta.
export function trovaMrz(righeLette) {
  const righe = (Array.isArray(righeLette) ? righeLette : String(righeLette || '').split('\n')).map(pulisciRigaMrz);
  let migliore = null;
  for (const f of FORMATI) {
    for (let i = 0; i + f.righe <= righe.length; i++) {
      const blocco = righe.slice(i, i + f.righe);
      if (!blocco.every(pareMrz)) continue;
      if (!blocco.every(r => Math.abs(r.length - f.lunghezza) <= 3)) continue;
      const allineate = blocco.slice();
      for (let k = 0; k < allineate.length; k++) allineate[k] = allineaRiga(allineate[k], f.lunghezza, allineate, k);
      const p = punteggio(allineate);
      const cifre = p.risultato ? p.risultato.details.filter(d => d.field && /CheckDigit$/.test(d.field) && d.valid).length : 0;
      if (cifre < 2 || (allineate.join('').match(/</g) || []).length < 4) continue;
      if (!migliore || p.punti > migliore.punti) migliore = { formato: f.nome, righe: allineate, punti: p.punti };
    }
  }
  return migliore;
}

// Che cosa può stare in ogni casella della MRZ (ICAO 9303): d = solo cifre, l = lettere o «<», s = sesso (M, F, <),
// a = tutto. Solo le caselle sicure: i numeri dei documenti e i dati facoltativi possono avere lettere e cifre.
const VERSO_CIFRA = { O: '0', D: '0', Q: '0', U: '0', I: '1', L: '1', J: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' };
function classiRiga(lunghezza, tratti) {
  const r = new Array(lunghezza).fill('a');
  for (const [da, a, c] of tratti) for (let i = da; i <= a; i++) r[i] = c;
  return r;
}
// Dati facoltativi (riga, prima e ultima casella): quasi sempre solo «<»
const CAMPI_FACOLTATIVI = { TD1: [[0, 15, 29], [1, 18, 28]], TD2: [[1, 28, 34]], TD3: [[1, 28, 41]] };
const CLASSI_MRZ = {
  TD1: [classiRiga(30, [[0, 0, 'l'], [2, 4, 'l']]),
    classiRiga(30, [[0, 6, 'd'], [7, 7, 's'], [8, 14, 'd'], [15, 17, 'l'], [29, 29, 'd']]),
    classiRiga(30, [[0, 29, 'l']])],
  TD2: [classiRiga(36, [[0, 0, 'l'], [2, 35, 'l']]),
    classiRiga(36, [[13, 19, 'd'], [20, 20, 's'], [21, 27, 'd'], [10, 12, 'l'], [35, 35, 'd']])],
  TD3: [classiRiga(44, [[0, 0, 'l'], [2, 43, 'l']]),
    classiRiga(44, [[13, 19, 'd'], [20, 20, 's'], [21, 27, 'd'], [10, 12, 'l'], [43, 43, 'd']])]
};

// Letture della stessa griglia con le righe un po' più lunghe o più corte del formato (un pezzo di sfondo ai bordi della fascia,
// un carattere iniziale o finale perso): si prova a togliere caselle all'inizio o alla fine (o ad aggiungerne di ignote) e si
// tiene la scelta con più cifre di controllo esatte, la stessa per tutte le letture (sono le stesse caselle).
function lunghezzeMrz(lista) {
  if (!lista.length) return lista;
  const n = lista[0].righe.length, lunghezze = lista[0].righe.map(r => r.length);
  if (!lista.every(c => c.righe.length === n && c.righe.every((r, i) => r.length === lunghezze[i]))) return lista;
  const media = lunghezze.reduce((x, y) => x + y, 0) / n;
  const attesa = n === 3 ? 30 : n === 2 ? (media > 40 ? 44 : 36) : 0;
  if (!attesa || lunghezze.every(l => l === attesa) || lunghezze.some(l => Math.abs(l - attesa) > 4)) return lista;
  // per ogni riga, i modi di portarla alla lunghezza giusta: [quante togliere (o aggiungere, se negativo) all'inizio, alla fine]
  const modi = lunghezze.map(l => { const d = l - attesa, out = []; for (let k = 0; k <= Math.abs(d); k++) out.push(d >= 0 ? [k, d - k] : [-k, -(Math.abs(d) - k)]); return out; });
  const taglia = (r, [a, b], riempi) => a >= 0 ? r.slice(a, r.length - b) : riempi.repeat(-a) + r + riempi.repeat(-b);
  let migliore = null;
  const giro = (k, scelta) => {
    if (k === n) {
      const righe = lista[0].righe.map((r, i) => taglia(r, scelta[i], '?'));
      const p = punteggio(righe).punti;
      if (!migliore || p > migliore.p) migliore = { p, scelta: scelta.slice() };
      return;
    }
    for (const m of modi[k]) { scelta.push(m); giro(k + 1, scelta); scelta.pop(); }
  };
  giro(0, []);
  return lista.map(c => ({
    righe: c.righe.map((r, i) => taglia(r, migliore.scelta[i], '?')),
    conf: c.conf ? c.conf.map((r, i) => { const [a, b] = migliore.scelta[i]; return a >= 0 ? r.slice(a, r.length - b) : new Array(-a).fill(0).concat(r, new Array(-b).fill(0)); }) : null
  }));
}

// Più letture della stessa MRZ (l'OCR su immagini preparate in modo diverso), già divise nelle caselle della griglia.
// Ogni casella prende il carattere letto con più fiducia. Per i campi con la cifra di controllo (numero, nascita, scadenza):
//  - se la lettura migliore torna, si tiene;
//  - se non torna, vale la lettura intera del campo fatta da una delle altre letture, se torna (e sono d'accordo);
//  - altrimenti si cambia UNA sola casella (con il carattere letto da un'altra lettura, o con ogni cifra dove può stare solo
//    una cifra e nessuno ha letto niente): se una sola scelta torna il campo è «dedotto» (da controllare);
//  - se tornano più scelte il campo è «ambiguo» e non si usa. (Una cifra di controllo torna per caso una volta su dieci:
//    mescolando caratteri di letture diverse si trova quasi sempre una combinazione che torna, ma non è quella giusta;
//    la cifra complessiva non aiuta, perché contiene gli stessi caratteri con gli stessi pesi.)
// Restituisce { formato, righe, punti, dedotti, ambigui } oppure null. Nessun carattere inventato: le caselle che nessuna
// lettura ha letto restano «?».
export function fondiMrz(candidati) {
  // un candidato: righe (stringhe) oppure { righe, conf } con la fiducia dell'OCR per ogni casella
  const norm = lunghezzeMrz(candidati.filter(Boolean).map(c => Array.isArray(c) ? { righe: c, conf: null } : c));
  const formato = c => c.length === 3 && c.every(r => r.length === 30) ? 'TD1' : c.length === 2 && c.every(r => r.length === 44) ? 'TD3' : c.length === 2 && c.every(r => r.length === 36) ? 'TD2' : null;
  const gruppi = {};
  for (const c of norm) { const f = formato(c.righe); if (f) (gruppi[f] = gruppi[f] || []).push(c); }
  let migliore = null;
  for (const [f, lista] of Object.entries(gruppi)) {
    // per ogni casella: i caratteri letti (senza «?»), prima quello con più fiducia sommata. Nelle caselle di sole cifre
    // una lettera diventa la cifra che le somiglia (O→0, B→8…) e viceversa nelle caselle di sole lettere
    const classi = CLASSI_MRZ[f];
    const opzioni = lista[0].righe.map((r, ri) => Array.from(r, (_, i) => {
      const peso = new Map(), classe = classi[ri][i];
      for (const c of lista) {
        let ch = c.righe[ri][i];
        if (ch === '?') continue;
        if (classe === 'd' && /[A-Z]/.test(ch)) ch = VERSO_CIFRA[ch] || '?';
        else if (classe === 'l' && /[0-9]/.test(ch)) ch = VERSO_LETTERA[ch] || '?';
        else if (classe === 's' && !/[MF<]/.test(ch)) ch = '?';
        if (ch === '?') continue;
        peso.set(ch, (peso.get(ch) || 0) + (c.conf ? c.conf[ri][i] : 1));
      }
      return [...peso.entries()].sort((x, y) => y[1] - x[1]).map(x => x[0]);
    }));
    const celle = opzioni.map(r => r.map(o => o[0] || '?'));
    // dati facoltativi: una casella in mezzo a una fila di «<» letta come L, K, C… è un «<» che la forma non ha riconosciuto
    // (un graffio, un riflesso); i nomi non si toccano
    for (const [ri, da, a] of CAMPI_FACOLTATIVI[f]) for (let i = da; i <= a; i++) {
      const sx = i > 0 ? celle[ri][i - 1] : '<', dx = i + 1 < celle[ri].length ? celle[ri][i + 1] : '<';
      if (sx === '<' && (dx === '<' || i === a) && /^[LKCEX(]$/.test(celle[ri][i])) celle[ri][i] = '<';
    }
    const righeDa = () => celle.map(r => r.join(''));
    let r0;
    try { r0 = parseMrzLibreria(righeDa(), { autocorrect: true }); } catch { continue; }
    const dedotti = [], ambigui = [];
    const det = (x, n) => x.details.find(d => d.field === n);
    const torna = (prova, campo) => {
      let x = null; try { x = parseMrzLibreria(prova.map(r => r.join('')), { autocorrect: true }); } catch { return false; }
      return det(x, campo).valid && det(x, campo + 'CheckDigit').valid;
    };
    const converti = (ch, classe) => classe === 'd' && /[A-Z]/.test(ch) ? (VERSO_CIFRA[ch] || '?') : classe === 'l' && /[0-9]/.test(ch) ? (VERSO_LETTERA[ch] || '?') : ch;
    for (const campo of ['documentNumber', 'birthDate', 'expirationDate']) {
      const d = det(r0, campo), dc = det(r0, campo + 'CheckDigit');
      if (!d || !dc || d.line == null || dc.line == null || (d.valid && dc.valid)) continue;
      const posti = [];
      for (let i = d.start; i < d.end; i++) posti.push([d.line, i]);
      posti.push([dc.line, dc.start]);
      // 1) la lettura intera del campo fatta da una delle letture: se torna, vale come una lettura normale
      const intere = new Map();
      for (const c of lista) {
        const prova = celle.map(r => r.slice());
        let completa = true;
        for (const [ri, i] of posti) { const ch = converti(c.righe[ri][i], classi[ri][i]); if (ch === '?') completa = false; prova[ri][i] = ch; }
        if (completa && torna(prova, campo)) intere.set(posti.map(([ri, i]) => prova[ri][i]).join(''), prova);
      }
      if (intere.size === 1) { const prova = [...intere.values()][0]; for (const [ri, i] of posti) celle[ri][i] = prova[ri][i]; continue; }
      if (intere.size > 1) { ambigui.push(campo); continue; }
      // 2) una sola casella cambiata rispetto alla lettura migliore (un'altra lettura di quella casella; tutte le cifre dove
      //    può stare solo una cifra e nessuno ha letto niente): si tiene solo se una sola scelta torna, ed è «dedotta»
      const soluzioni = [];
      for (const [ri, i] of posti) {
        const cifra = classi[ri][i] === 'd' || (ri === dc.line && i === dc.start);
        const alternative = opzioni[ri][i].length ? opzioni[ri][i].slice(1) : (cifra ? Array.from('0123456789') : []);
        for (const ch of alternative) {
          if (ch === celle[ri][i]) continue;
          const prova = celle.map(r => r.slice()); prova[ri][i] = ch;
          if (torna(prova, campo)) soluzioni.push([ri, i, ch]);
        }
      }
      if (soluzioni.length === 1) { const [ri, i, ch] = soluzioni[0]; celle[ri][i] = ch; dedotti.push(campo); }
      else if (soluzioni.length > 1) ambigui.push(campo);
    }
    // cifra complessiva che non torna, con numero, nascita e scadenza tutti confermati dalle loro cifre: l'errore è nei dati
    // facoltativi o nella cifra complessiva stessa. Se una sola scelta tra le letture la fa tornare, si tiene. (Con un campo
    // principale sbagliato no: un carattere qualsiasi dei dati facoltativi potrebbe compensarlo e far tornare la cifra per caso.)
    let rc; try { rc = parseMrzLibreria(righeDa(), { autocorrect: true }); } catch { rc = null; }
    const comp = rc && det(rc, 'compositeCheckDigit');
    const principali = rc ? ['documentNumber', 'birthDate', 'expirationDate'].map(campo => [det(rc, campo), det(rc, campo + 'CheckDigit')]) : [];
    if (comp && !comp.valid && comp.line != null && principali.every(([d, dc]) => d && dc && d.valid && dc.valid && d.line != null)) {
      const confermate = new Set();
      for (const [d, dc] of principali) { for (let i = d.start; i < d.end; i++) confermate.add(d.line + ':' + i); confermate.add(dc.line + ':' + dc.start); }
      const soluzioni = [];
      opzioni.forEach((r, ri) => r.forEach((o, i) => {
        const ultima = ri === comp.line && i === comp.start;
        if (confermate.has(ri + ':' + i) || classi[ri][i] === 'l' || classi[ri][i] === 's') return;
        const alternative = o.length > 1 ? o.slice(1) : (ultima && !o.length ? Array.from('0123456789') : []);
        for (const ch of alternative) {
          if (ch === celle[ri][i]) continue;
          const prova = celle.map(x => x.slice()); prova[ri][i] = ch;
          let x = null; try { x = parseMrzLibreria(prova.map(y => y.join('')), { autocorrect: true }); } catch { x = null; }
          if (x && det(x, 'compositeCheckDigit').valid) soluzioni.push([ri, i, ch]);
        }
      }));
      if (soluzioni.length === 1) { const [ri, i, ch] = soluzioni[0]; celle[ri][i] = ch; }
    }
    // Stato emittente e cittadinanza (nessuna cifra di controllo): se la lettura migliore non è un codice esistente, tra i
    // caratteri letti dalle letture si cerca l'unica combinazione che dà un codice esistente (TTA, LIA, ITA → ITA)
    const noto = c => { const x = statoDaCodice(c); return !!x.stato || x.motivo === 'senza_voce'; };
    for (const campo of ['issuingState', 'nationality']) {
      const d = det(r0, campo);
      if (!d || d.line == null) continue;
      const posti = []; for (let i = d.start; i < d.end; i++) posti.push([d.line, i]);
      if (noto(posti.map(([ri, i]) => celle[ri][i]).join(''))) continue;
      const liste = posti.map(([ri, i]) => opzioni[ri][i].length ? opzioni[ri][i] : ['?']);
      if (liste.reduce((x, o) => x * o.length, 1) > 512) continue;
      const trovati = [];
      const giro = (k, pref) => { if (k === liste.length) { if (noto(pref)) trovati.push(pref); return; } for (const ch of liste[k]) giro(k + 1, pref + ch); };
      giro(0, '');
      if (trovati.length === 1) posti.forEach(([ri, i], k) => { celle[ri][i] = trovati[0][k]; });
    }
    const righe = righeDa(), punti = punteggio(righe).punti;
    // caselle incerte: lette in modi diversi, o con poca fiducia (per la correzione del numero in leggiMrz)
    const incerte = [];
    opzioni.forEach((r, ri) => r.forEach((o, i) => {
      const peso = lista.reduce((x, c) => x + (c.righe[ri][i] === celle[ri][i] ? (c.conf ? c.conf[ri][i] : 100) : 0), 0);
      if (o.length !== 1 || peso < lista.length * 50) incerte.push([ri, i]);
    }));
    if (!migliore || punti > migliore.punti) migliore = { formato: f, righe, punti, dedotti, ambigui, incerte };
  }
  // letture non divise nella griglia (lunghezze diverse): come prima, riga per riga
  for (const c of norm) {
    if (formato(c.righe)) continue;
    const t = trovaMrz(c.righe);
    if (t && (!migliore || t.punti > migliore.punti)) migliore = Object.assign({ dedotti: [], ambigui: [], incerte: null }, t);
  }
  if (!migliore) return null;
  const p = punteggio(migliore.righe);
  const cifre = p.risultato ? p.risultato.details.filter(d => d.field && /CheckDigit$/.test(d.field) && d.valid && !(d.field === 'documentNumberCheckDigit' && migliore.ambigui.includes('documentNumber'))).length : 0;
  return cifre >= 2 ? migliore : null;
}

// Numero del documento con cifra di controllo sbagliata: prova a sostituire i caratteri che l'OCR confonde (al massimo 2).
// Se una sola versione fa tornare la cifra di controllo (e, se c'è, anche quella complessiva) la restituisce come «corretta».
function correggiNumeroDocumento(numero, cifra, verificaComplessiva, soloIn) {
  const pos = [];
  for (let i = 0; i < numero.length; i++) if (AMBIGUI[numero[i]] && (!soloIn || soloIn.has(i))) pos.push(i);
  if (!pos.length || pos.length > 9) return null;
  const trovati = new Set();
  const prova = s => { if (cifraControllo(s) === cifra && (!verificaComplessiva || verificaComplessiva(s))) trovati.add(s); };
  for (const i of pos) for (const a of AMBIGUI[numero[i]]) prova(numero.slice(0, i) + a + numero.slice(i + 1));
  if (!trovati.size) for (let x = 0; x < pos.length; x++) for (let y = x + 1; y < pos.length; y++)
    for (const a of AMBIGUI[numero[pos[x]]]) for (const b of AMBIGUI[numero[pos[y]]]) {
      const c = Array.from(numero); c[pos[x]] = a; c[pos[y]] = b; prova(c.join(''));
    }
  return trovati.size === 1 ? [...trovati][0] : null;
}

const pulisciNomeMrz = s => String(s || '').replace(/[0-9]/g, c => VERSO_LETTERA[c] || '').replace(/\s+/g, ' ').trim();
// Campo dei nomi della MRZ (COGNOME<<NOMI<<<…): dopo tre «<» di fila c'è solo riempimento; quello che l'OCR ci legge è rumore.
function nomiDaCampoMrz(campo) {
  const c = String(campo || '');
  const sep = c.indexOf('<<');
  if (sep < 0) return { cognome: pulisciNomeMrz(c.replace(/</g, ' ')), nome: '' };
  const cognome = c.slice(0, sep), resto = c.slice(sep + 2);
  const fine = resto.search(/<{3,}/);
  const nomi = fine >= 0 ? resto.slice(0, fine) : resto;
  return { cognome: pulisciNomeMrz(cognome.replace(/</g, ' ')), nome: pulisciNomeMrz(nomi.replace(/</g, ' ')) };
}

// Interpreta un blocco MRZ (già alla lunghezza esatta). `oggi` (ms) serve per il secolo delle date.
export function leggiMrz(righe, oggi, fusione) {
  let r;
  try { r = parseMrzLibreria(righe, { autocorrect: true }); } catch { return null; }
  const det = {};
  for (const d of r.details) if (d.field) det[d.field] = d;
  // dalla fusione di più letture (fondiMrz): un campo «ambiguo» non si usa, uno «dedotto» resta da controllare
  const ambigui = new Set((fusione && fusione.ambigui) || []), dedotti = new Set((fusione && fusione.dedotti) || []);
  const campoDi = f => f.replace(/CheckDigit$/, '');
  const ok = f => !!(det[f] && det[f].valid) && !ambigui.has(campoDi(f));
  const grezzo = campo => { const d = det[campo]; return d && d.line != null && righe[d.line] ? righe[d.line].slice(d.start, d.end) : ''; };
  const f = r.fields;
  const out = { formato: r.format, codiceDocumento: (righe[0] || '').slice(0, 2), campi: {}, controlli: {}, avvisi: [] };

  // composita (TD1, TD2, TD3): copre numero del documento, nascita, scadenza (e dati facoltativi)
  out.controlli.complessiva = det.compositeCheckDigit ? ok('compositeCheckDigit') : null;

  // numero del documento (anche quello lungo dei TD1, che continua nei dati facoltativi: result.documentNumber)
  let numero = r.documentNumber || f.documentNumber || null;
  const numeroGrezzo = grezzo('documentNumber'), cifraNumero = grezzo('documentNumberCheckDigit');
  if (ok('documentNumber') && ok('documentNumberCheckDigit') && numero) {
    out.campi.numeroDocumento = { valore: numero.replace(/</g, ''), affidabilita: out.controlli.complessiva === false || dedotti.has('documentNumber') ? DA_VERIFICARE : SICURO, fonte: 'mrz' };
    if (dedotti.has('documentNumber')) { out.campi.numeroDocumento.nota = 'corretto'; out.avvisi.push({ codice: 'numero_corretto', campo: 'numeroDocumento' }); }
  } else if (!ambigui.has('documentNumber') && numeroGrezzo && /^[0-9]$/.test(cifraNumero) && det.documentNumber.line != null) {
    // la cifra di controllo non torna: si prova a correggere i caratteri ambigui (O/0, I/1, B/8, S/5…)
    const rng = det.documentNumber;
    // con più letture unite (fondiMrz) si correggono solo le caselle incerte (lette in modi diversi o con poca fiducia): la
    // cifra di controllo, da sola, torna anche cambiando un carattere giusto che compensa quello sbagliato, e quella
    // complessiva non aiuta (contiene il numero con gli stessi pesi)
    const incerte = fusione && fusione.incerte ? new Set(fusione.incerte.filter(x => x[0] === rng.line && x[1] >= rng.start && x[1] < rng.end).map(x => x[1] - rng.start)) : null;
    // CIE italiana (TD1, «C», ITA): la correzione deve restare nel formato del numero della CIE (06/11/2026: cambiando due
    // caratteri si trovava anche un numero con una lettera tra le cifre che faceva tornare entrambe le cifre di controllo)
    const cieItaliana = r.format === 'TD1' && /^C/.test(out.codiceDocumento) && grezzo('issuingState').replace(/</g, '') === 'ITA';
    const corretto = correggiNumeroDocumento(numeroGrezzo, cifraNumero, s => {
      if (cieItaliana && !RE_FORMATO_CIE.test(s)) return false;
      const prova = righe.slice();
      prova[rng.line] = prova[rng.line].slice(0, rng.start) + s + prova[rng.line].slice(rng.end);
      try { const x = parseMrzLibreria(prova, { autocorrect: true }); const c = x.details.find(d => d.field === 'compositeCheckDigit'); return !c || c.valid; } catch { return false; }
    }, incerte);
    if (corretto) {
      out.campi.numeroDocumento = { valore: corretto.replace(/</g, ''), affidabilita: DA_VERIFICARE, fonte: 'mrz', nota: 'corretto' };
      out.avvisi.push({ codice: 'numero_corretto', campo: 'numeroDocumento' });
    }
  }
  if (out.campi.numeroDocumento && codiceFiscaleValido(out.campi.numeroDocumento.valore)) delete out.campi.numeroDocumento;  // mai il codice fiscale

  // nascita
  if (f.birthDate && /^\d{6}$/.test(f.birthDate) && ok('birthDate') && ok('birthDateCheckDigit')) {
    const d = dataNascitaDaAnnoBreve(f.birthDate.slice(0, 2), f.birthDate.slice(2, 4), f.birthDate.slice(4, 6), oggi);
    if (d) out.campi.nascita = { valore: d.iso, affidabilita: d.incerta || dedotti.has('birthDate') ? DA_VERIFICARE : SICURO, fonte: 'mrz', secoloIncerto: d.incerta };
  }
  // scadenza: non va nel modulo, serve solo all'avviso «documento scaduto»
  if (f.expirationDate && /^\d{6}$/.test(f.expirationDate) && ok('expirationDate') && ok('expirationDateCheckDigit')) {
    out.scadenza = dataDocumentoDaAnnoBreve(f.expirationDate.slice(0, 2), f.expirationDate.slice(2, 4), f.expirationDate.slice(4, 6), oggi);
  }
  // sesso: nessuna cifra di controllo, ma sta tra la data di nascita e la scadenza, sulla stessa riga: se le loro cifre di controllo
  // tornano la riga è letta bene e il sesso (M o F, lettere che nella MRZ non si confondono) è sicuro (06/11/2026, il titolare:
  // «sesso giallo» anche quando giusto); se no resta da controllare, a meno che lo confermi il testo stampato
  const rigaBuona = ok('birthDateCheckDigit') && ok('expirationDateCheckDigit');
  if (f.sex === 'male' || f.sex === 'female') out.campi.genere = { valore: f.sex === 'male' ? 'M' : 'F', affidabilita: rigaBuona ? SICURO : DA_VERIFICARE, fonte: 'mrz' };

  // nomi: struttura COGNOME<<NOMI; nessuna cifra di controllo
  const campoNomi = { TD3: (righe[0] || '').slice(5), TD2: (righe[0] || '').slice(5), TD1: righe[2] || '' }[r.format];
  const nm = campoNomi != null ? nomiDaCampoMrz(campoNomi) : { cognome: pulisciNomeMrz(f.lastName), nome: pulisciNomeMrz(f.firstName) };
  const cognome = nm.cognome, nome = nm.nome;
  if (cognome) out.campi.cognome = { valore: cognome, affidabilita: DA_VERIFICARE, fonte: 'mrz' };
  if (nome) out.campi.nome = { valore: nome, affidabilita: DA_VERIFICARE, fonte: 'mrz' };
  const rigaNomi = { TD3: righe[0], TD2: righe[0], TD1: righe[2] }[r.format];
  if (rigaNomi && rigaNomi[rigaNomi.length - 1] !== '<' && (cognome || nome)) out.avvisi.push({ codice: 'nome_troncato', campo: 'nome' });

  // Stato emittente e cittadinanza (codici senza cifra di controllo: se coincidono, le due letture si confermano)
  // (letti dalla riga così com'è: la libreria considera non validi i codici che non conosce, qui si distinguono da soli)
  const codEmittente = grezzo('issuingState').replace(/</g, '').replace(/[0-9]/g, c => VERSO_LETTERA[c] || c);
  const codCittadinanza = grezzo('nationality').replace(/</g, '').replace(/[0-9]/g, c => VERSO_LETTERA[c] || c);
  out.codici = { emittente: codEmittente, cittadinanza: codCittadinanza };
  const em = statoDaCodice(codEmittente), ci = statoDaCodice(codCittadinanza);
  const concordi = !!codEmittente && codEmittente === codCittadinanza;
  if (ci.stato) out.campi.cittadinanza = { valore: ci.stato, affidabilita: concordi ? SICURO : DA_VERIFICARE, fonte: 'mrz' };
  else if (ci.motivo === 'senza_voce') out.avvisi.push({ codice: 'cittadinanza_non_in_elenco', campo: 'cittadinanza' });
  if (em.stato) out.campi.luogoRilascio = { valore: em.stato, affidabilita: concordi ? SICURO : DA_VERIFICARE, fonte: 'mrz' };
  else if (em.motivo === 'senza_voce') out.avvisi.push({ codice: 'emittente_non_in_elenco', campo: 'luogoRilascio' });

  // dati facoltativi: un codice fiscale valido (alcuni documenti italiani) serve solo al controllo incrociato
  const facoltativi = [f.optional1, f.optional2, f.personalNumber].filter(Boolean).join('\n');
  const cf = trovaCodiceFiscale(facoltativi);
  if (cf) out.codiceFiscale = cf;

  const verificate = ['documentNumberCheckDigit', 'birthDateCheckDigit', 'expirationDateCheckDigit'].filter(ok).length;
  out.valida = verificate === 3 && out.controlli.complessiva !== false;
  out.verificate = verificate;
  out.controlli.numero = ok('documentNumberCheckDigit');
  out.controlli.nascita = ok('birthDateCheckDigit');
  out.controlli.scadenza = ok('expirationDateCheckDigit');

  // Un numero letto altrove (il fronte della CIE) si verifica con la MRZ, quando il numero nella MRZ è consumato o letto male: deve
  // essere quasi uguale a quello letto nella MRZ (al più 2 caratteri diversi: sono due letture indipendenti) e, messo al suo posto,
  // far tornare la cifra di controllo del numero (se si legge) e la complessiva (se nascita e scadenza tornano, altrimenti non dice
  // niente). Restituisce { distanza, conferme, cifraLetta } o null. Usata da combinaLetture.
  const rngN = det.documentNumber, rngC = det.documentNumberCheckDigit;
  if (rngN && rngC && rngN.line != null && rngC.line === rngN.line && righe[rngN.line] && rngN.end - rngN.start === 9) {
    const grezzoN = grezzo('documentNumber'), cifraGrezza = grezzo('documentNumberCheckDigit');
    const cifraLetta = /^[0-9]$/.test(cifraGrezza);
    const conComplessiva = !!(det.compositeCheckDigit && out.controlli.nascita && out.controlli.scadenza);
    out.verificaNumero = candidato => {
      const n = String(candidato || '').toUpperCase();
      if (n.length !== 9 || !/^[A-Z0-9]+$/.test(n)) return null;
      let distanza = 0;
      for (let i = 0; i < 9; i++) if (n[i] !== grezzoN[i]) distanza++;
      if (distanza > 2) return null;
      let riga = righe[rngN.line];
      riga = riga.slice(0, rngN.start) + n + riga.slice(rngN.end);
      if (!cifraLetta) riga = riga.slice(0, rngC.start) + cifraControllo(n) + riga.slice(rngC.end);   // cifra illeggibile: la calcola
      const prova = righe.slice();
      prova[rngN.line] = riga;
      let x;
      try { x = parseMrzLibreria(prova, { autocorrect: true }); } catch { return null; }
      const d = {};
      for (const e of x.details) if (e.field) d[e.field] = e;
      const cifraOk = cifraLetta && !!(d.documentNumberCheckDigit && d.documentNumberCheckDigit.valid);
      const complessivaOk = conComplessiva ? !!(d.compositeCheckDigit && d.compositeCheckDigit.valid) : null;
      if ((cifraLetta && !cifraOk) || complessivaOk === false) return null;
      const conferme = (cifraOk ? 1 : 0) + (complessivaOk ? 1 : 0);
      return conferme ? { distanza, conferme, cifraLetta } : null;
    };
  }
  return out;
}

// ---- Testo stampato (senza MRZ o in aggiunta alla MRZ) ----

const MESI = { GEN: 1, JAN: 1, ENE: 1, FEB: 2, FEV: 2, MAR: 3, MRZ: 3, MAE: 3, APR: 4, AVR: 4, ABR: 4, MAG: 5, MAY: 5, MAI: 5, GIU: 6, JUN: 6, JUI: 6,
  LUG: 7, JUL: 7, AGO: 8, AUG: 8, AOU: 8, SET: 9, SEP: 9, OTT: 10, OCT: 10, OKT: 10, NOV: 11, DIC: 12, DEC: 12, DEZ: 12 };
// Tutte le date trovate in una riga, nell'ordine: { iso, breve } (breve = anno a 2 cifre).
export function dateNelTesto(riga) {
  const s = senzaAccenti(String(riga || '')).toUpperCase(), out = [];
  const re = /(\d{1,2})\s?[.\/\-]\s?(\d{1,2})\s?[.\/\-]\s?(\d{4}|\d{2})(?!\d)|(\d{1,2})\s+([A-Z]{3})[A-Z]*(?:\s*\/\s*[A-Z]{3,4})?\s+(\d{4}|\d{2})(?!\d)/g;
  let m;
  while ((m = re.exec(s))) {
    const g = parseInt(m[1] || m[4], 10), mese = m[2] ? parseInt(m[2], 10) : MESI[m[5]], anno = m[3] || m[6];
    if (!mese || mese > 12 || g < 1 || g > 31) continue;
    out.push({ g, m: mese, anno, breve: anno.length === 2, indice: m.index });
  }
  return out;
}

const RE_PATENTE = /PATENTE DI GUIDA|DRIVING LICEN[CS]E|F[UÜ]HRERSCHEIN|PERMIS DE CONDUIRE|PERMISO DE CONDUC|RIJBEWIJS|PRAWO JAZDY|K[OÖ]RKORT|CARTA DE CONDU/;
const RE_CARTA = /CARTA D\W?\s?IDENTIT|CARTA DI IDENTIT|IDENTITY CARD|PERSONALAUSWEIS|CARTE NATIONALE D|DOCUMENTO NACIONAL DE IDENTIDAD|IDENTITEITSKAART|DOWOD OSOBISTY|AUFENTHALTSTITEL|RESIDENCE PERMIT|PERMESSO DI SOGGIORNO|TITRE DE S[EÉ]JOUR|PERMISO DE RESIDENCIA/;
const RE_PASSAPORTO = /PASSAPORTO|PASSPORT|REISEPASS|PASSEPORT|PASAPORTE|PASPOORT/;
const RE_ITALIA = /REPUBBLICA ITALIANA|ITALIAN REPUBLIC|MINISTERO DELL\W?INTERNO|MINISTERO DELLE INFRASTRUTTURE|COMUNE DI /;

// Gli spazi delle etichette diventano facoltativi (l'OCR a volte li perde: «NATAIL»).
const etichetta = src => new RegExp(src.replace(/ /g, '\\s?'));
const ETICHETTE = {
  cognome: etichetta('\\b(COGNOME|SURNAME|NACHNAME|NOM\\b|APELLIDOS?)'),
  nome: etichetta('\\b(NOME|NOMI|GIVEN NAMES?|VORNAMEN?|PR[EÉ]NOMS?|NOMBRES?|FORENAMES?|NAME)\\b'),
  luogoData: etichetta('LUOGO E DATA DI NASCITA|PLACE AND DATE OF BIRTH'),
  luogo: etichetta('LUOGO DI NASCITA|PLACE OF BIRTH|GEBURTSORT|LIEU DE NAISSANCE|LUGAR DE NACIMIENTO|\\bNAT[OA] A\\b'),
  data: etichetta('DATA DI NASCITA|DATE OF BIRTH|GEBURTSDATUM|GEBURTSTAG|DATE DE NAISSANCE|FECHA DE NACIMIENTO|\\bNAT[OA] IL\\b'),
  sesso: etichetta('\\b(SESSO|SEX|GESCHLECHT|SEXE|SEXO)\\b'),
  cittadinanza: etichetta('CITTADINANZA|NATIONALITY|STAATSANGEH[OÖ]RIGKEIT|NATIONALIT[EÉ]|NACIONALIDAD'),
  scadenza: etichetta('SCADENZA|DATE OF EXPIRY|EXPIRY|G[UÜ]LTIG BIS|DATE D.EXPIRATION|VALIDA FINO AL|FECHA DE CADUCIDAD'),
  rilascio: etichetta('EMISSIONE|DATA DI RILASCIO|DATE OF ISSUE|AUSSTELLUNGSDATUM|DATE DE D[EÉ]LIVRANCE|FECHA DE EXPEDICI[OÓ]N')
};
const ETICHETTA_QUALSIASI = new RegExp(Object.values(ETICHETTE).map(r => r.source).join('|') + '|STATURA|HEIGHT|CODICE\\s?FISCALE|FISCAL\\s?CODE|INDIRIZZO|RESIDENZA|FIRMA|SIGNATURE|\\bNAME\\b');
const ETICHETTE_TUTTE = new RegExp(ETICHETTA_QUALSIASI.source, 'g');

const pulisciNomeStampato = s => String(s || '').toUpperCase().replace(/[’‘`´]/g, "'").replace(/[^A-ZÀ-ÖØ-Ý' \-]/g, ' ').replace(/\s+/g, ' ').trim();
// Un nome credibile: da 2 a 50 caratteri, al massimo 5 parole, nessuna parola oltre 20 lettere (l'OCR su una foto qualsiasi
// produce lunghe file di lettere a caso).
const nomeCredibile = s => !!s && s.length >= 2 && s.length <= 50 && s.split(' ').length <= 5 && s.split(/[ '\-]/).every(p => p.length <= 20);

// Parole delle etichette (soprattutto le traduzioni inglesi, francesi, tedesche…) come l'OCR può leggerle male: «SURAT»,
// «SUMAME» per SURNAME. Una riga che dopo l'etichetta ha una di queste parole è una riga di etichette, non un valore.
const PAROLE_ETICHETTA = ['SURNAME', 'SURNAMES', 'NAME', 'NAMES', 'GIVEN', 'FORENAMES', 'NOM', 'NOMS', 'PRENOMS', 'NOMBRE', 'NOMBRES',
  'APELLIDOS', 'VORNAMEN', 'NACHNAME', 'COGNOME', 'NOME', 'PLACE', 'DATE', 'BIRTH', 'NATIONALITY', 'NATIONALITE', 'SEX', 'SEXE',
  'HEIGHT', 'ISSUING', 'ISSUE', 'EXPIRY', 'SIGNATURE', 'MUNICIPALITY', 'AUTHORITY', 'STATURA', 'CITTADINANZA', 'SESSO', 'LUOGO',
  'NASCITA', 'EMISSIONE', 'SCADENZA', 'FIRMA', 'TITOLARE', 'HOLDER', 'GESCHLECHT', 'STAATSANGEHORIGKEIT', 'GEBURTSDATUM'];
function pareEtichetta(parola) {
  const p = senzaAccenti(parola).toUpperCase().replace(/[^A-Z]/g, '');
  if (p.length < 3) return false;
  return PAROLE_ETICHETTA.some(e => {
    const d = distanza(p, e), sim = 1 - d / Math.max(p.length, e.length);
    return sim >= 0.7 || (p.length >= 4 && p.slice(0, 3) === e.slice(0, 3) && sim >= 0.45);
  });
}
// Pulizia del valore di un nome: via le parole con minuscole o simboli (pezzi di firma, di foto, di ologramma) quando ci sono
// parole tutte maiuscole (i nomi sui documenti sono in maiuscolo; il permesso tedesco scrive il nome in minuscolo: lì resta).
function soloParoleNome(orig) {
  const parole = String(orig || '').split(/\s+/).filter(Boolean);
  const pulite = parole.filter(w => /^[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý'\-]+$/.test(w));
  return (pulite.length ? pulite : parole).join(' ');
}
// Valore che segue un'etichetta: il resto della riga (tolte le etichette in più lingue, le barre e i numeri dei campi tra
// parentesi come «(1)»), se sembra davvero un valore (in maiuscolo, non un'altra etichetta letta male); altrimenti la riga
// sotto, saltando al più due righe di sole etichette (la CIE ha l'etichetta in italiano e sotto quella in inglese).
// U: righe in maiuscolo; O: le stesse righe come lette (con le minuscole); G: riquadri delle righe (facoltativi): se ci sono,
// la riga «sotto» è quella più vicina sotto l'etichetta che le sta in colonna (sulla CIE i campi sono su più colonne).
function valoreDopoEtichetta(U, re, O, G, escludi, accettabile) {
  O = O || U;
  const etichettaSola = i => ETICHETTA_QUALSIASI.test(U[i]) && !/[A-Z]{2,}/.test(U[i].replace(ETICHETTE_TUTTE, ' ').replace(/\b[A-Z]{1,3}\b/g, ' ').split(/\s+/).filter(w => !pareEtichetta(w)).join(' '));
  const sotto = i => {
    if (!G || !G[i]) return [i + 1, i + 2, i + 3].filter(j => j < U.length);
    const a = G[i], h = Math.max(4, a.y1 - a.y0);
    return G.map((b, j) => ({ j, b })).filter(({ j, b }) => j !== i && b && b.y0 >= a.y0 + h * 0.5 && b.y0 <= a.y1 + h * 4.5
      && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.3 * Math.min(a.x1 - a.x0, b.x1 - b.x0))
      .sort((x, y) => x.b.y0 - y.b.y0).map(x => x.j).slice(0, 3);
  };
  for (let i = 0; i < U.length; i++) {
    const m = re.exec(U[i]);
    if (!m || (escludi && escludi.test(U[i]))) continue;
    const fine = m.index + m[0].length;
    const togli = t => t.replace(ETICHETTE_TUTTE, ' ').replace(/(^|\s)[\/|:.,]+(?=\s|$)|\(\d+\)/g, ' ').replace(/\s+/g, ' ').trim();
    const resto = togli(U[i].slice(fine)), restoO = O[i].length === U[i].length ? togli(O[i].slice(fine)) : resto;
    const prima = (restoO.match(/[A-Za-zÀ-ÿ]{3,}/) || [''])[0];
    const lettere = restoO.replace(/[^A-Za-zÀ-ÿ]/g, ''), maiuscole = restoO.replace(/[^A-ZÀ-ÖØ-Ý]/g, '');
    const sembraValore = (/[A-Z0-9]{2,}/.test(resto) || /^[MF]$/.test(resto)) && !pareEtichetta(prima) && (!lettere.length || maiuscole.length >= 0.8 * lettere.length)
      && (!accettabile || accettabile(restoO));
    if (sembraValore) return { valore: resto, originale: restoO, riga: i, etichetta: i };
    for (const j of sotto(i)) {
      if (etichettaSola(j)) continue;
      if (ETICHETTA_QUALSIASI.test(U[j]) && re.test(U[j])) break;
      return { valore: U[j].trim(), originale: O[j].trim(), riga: j, etichetta: i };
    }
  }
  return null;
}

// Luogo di nascita: «ROMA (RM)» (comune italiano con la sigla della provincia) oppure «BERLINO (GERMANIA)» (Stato del modulo).
export function leggiLuogo(testo, { province, stati }) {
  const s = String(testo || '').toUpperCase();
  const m = /([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' .\-]{1,40}?)\s*\(\s*([A-ZÀ-ÖØ-Ý' .\-]{2,40}?)\s*\)/.exec(s);
  if (!m) return null;
  const nome = m[1].replace(/^(?:[A-Z]\s+)+/, '').replace(/^(A|DI|IN)\s+/, '').trim(), tra = m[2].trim();
  if (/^[A-Z]{2}$/.test(tra) && (province || []).includes(tra)) return { stato: 'Italia', comune: nome, provincia: tra };
  const stato = (stati || []).find(x => chiaveVoce(x) === chiaveVoce(tra));
  if (stato) return { stato, comune: stato === 'Italia' ? nome : undefined, provincia: undefined };
  // sigla ISO a 3 lettere dello Stato (CIE di chi è nato all'estero: «SAO PAULO (BRA)»)
  if (/^[A-Z]{3}$/.test(tra) && ISO_STATI[tra] && tra !== 'ITA' && (!stati || !stati.length || stati.includes(ISO_STATI[tra]))) return { stato: ISO_STATI[tra], comune: undefined, provincia: undefined };
  return null;
}

const RE_NUMERO_CIE = /\b(C[A-Z])\s?(\d{5})\s?([A-Z]{2})\b/;
const RE_FORMATO_CIE = /^C[A-Z]\d{5}[A-Z]{2}$/;
// Numero della CIE sul fronte con qualche carattere confuso dall'OCR (una lettera letta 1, una cifra letta O…): le letture possibili
// nel formato della CIE (C, una lettera, 5 cifre, 2 lettere), al più due caratteri cambiati (AMBIGUI). Non si usano da sole: vale
// solo quella che la MRZ del retro conferma (combinaLetture → verificaNumero). 06/11/2026: sulle foto vere ridotte l'OCR leggeva
// il numero con un solo carattere sbagliato e il numero restava vuoto.
export function numeriCieIncerti(righe) {
  const out = new Set();
  const lettera = c => /[A-Z]/.test(c), cifra = c => /[0-9]/.test(c);
  for (const riga of righe || []) {
    const t = senzaAccenti(String(riga || '')).toUpperCase().replace(/\s+/g, '');
    for (let i = 0; i + 9 <= t.length; i++) {
      if (t[i] !== 'C') continue;
      const w = t.slice(i, i + 9), opzioni = [['C']];
      let cambiati = 0;
      for (let k = 1; k < 9; k++) {
        const c = w[k], vuole = k === 1 || k >= 7 ? lettera : cifra;
        if (vuole(c)) { opzioni.push([c]); continue; }
        const alt = (AMBIGUI[c] || []).filter(vuole);
        if (!alt.length) { cambiati = 99; break; }
        opzioni.push(alt); cambiati++;
      }
      if (cambiati > 2) continue;
      let comb = [''];
      for (const o of opzioni) comb = comb.flatMap(x => o.map(y => x + y));
      for (const n of comb) out.add(n);
    }
  }
  return [...out].slice(0, 24);
}
const RE_NUMERO_CARTA_CARTACEA = /\b([A-Z]{2})\s?(\d{7})\b/;

// Lettura del testo stampato. `righe`: righe lette dall'OCR, nell'ordine. Restituisce i valori trovati e gli indizi sul tipo.
export function leggiTestoStampato(righe, opzioni) {
  const o = opzioni || {};
  // righe: stringhe, oppure { testo, bbox: { x0, y0, x1, y1 } } (con i riquadri l'etichetta trova il valore in colonna)
  const elenco = (Array.isArray(righe) ? righe : String(righe || '').split('\n'))
    .map(r => (r && typeof r === 'object') ? { t: String(r.testo || ''), b: r.bbox || null } : { t: String(r || ''), b: null })
    .map(r => ({ t: r.t.replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim(), b: r.b })).filter(r => r.t);
  const O = elenco.map(r => r.t), G = elenco.some(r => r.b) ? elenco.map(r => r.b) : null;
  const U = O.map(r => r.toUpperCase());
  const dopo = (re, escludi, accettabile) => valoreDopoEtichetta(U, re, O, G, escludi, accettabile);
  // un nome sulla stessa riga dell'etichetta («Cognome PROVACCIA» della carta cartacea) solo se è pulito: lettere maiuscole,
  // parole di almeno due lettere; altrimenti è un pezzo dell'etichetta inglese letto male («Pe, TES») e il nome è sotto
  const nomePulito = t => /^[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' \-]*$/.test(t.trim()) && t.trim().split(/[ '\-]+/).every(p => p.length >= 2);
  const tutto = U.join('\n');
  const indizi = { patente: RE_PATENTE.test(tutto), carta: RE_CARTA.test(tutto), passaporto: RE_PASSAPORTO.test(tutto), italia: RE_ITALIA.test(tutto) };
  const v = { indizi };

  // patente UE: campi numerati 1. 2. 3. 4a. 4b. 4c. 5.
  const campoNumerato = n => {
    for (const r of U) { const m = new RegExp('^\\s*' + n + '\\s?[.,]\\s*(.+)$').exec(r); if (m) return m[1].trim(); }
    return null;
  };
  const p1 = campoNumerato('1'), p2 = campoNumerato('2'), p3 = campoNumerato('3'), p5 = campoNumerato('5');
  indizi.campiPatente = !!(p1 && p2 && (p3 || p5));
  if (indizi.patente && indizi.campiPatente) {
    v.cognome = pulisciNomeStampato(p1);
    v.nome = pulisciNomeStampato(p2);
    if (p3) {
      const d = dateNelTesto(p3)[0];
      if (d) {
        if (d.breve) { const x = dataNascitaDaAnnoBreve(d.anno, d.m, d.g, o.oggi); if (x) { v.nascita = x.iso; v.nascitaIncerta = x.incerta; } }
        else if (isoValida(+d.anno, d.m, d.g)) v.nascita = iso(+d.anno, d.m, d.g);
      }
      const luogo = leggiLuogo(p3, o);
      if (luogo) v.luogo = luogo;
    }
    if (p5) { const n = p5.replace(/[^A-Z0-9]/g, ''); if (n.length >= 5 && n.length <= 16 && !codiceFiscaleValido(n)) v.numero = n; }
    const p4b = campoNumerato('4B'); if (p4b) { const d = dateNelTesto(p4b)[0]; if (d) v.scadenza = d.breve ? dataDocumentoDaAnnoBreve(d.anno, d.m, d.g, o.oggi) : (isoValida(+d.anno, d.m, d.g) ? iso(+d.anno, d.m, d.g) : null); }
    const p4a = campoNumerato('4A'); if (p4a) { const d = dateNelTesto(p4a)[0]; if (d) v.rilascio = d.breve ? dataDocumentoDaAnnoBreve(d.anno, d.m, d.g, o.oggi) : (isoValida(+d.anno, d.m, d.g) ? iso(+d.anno, d.m, d.g) : null); }
  } else {
    const c = dopo(ETICHETTE.cognome, null, nomePulito), n = dopo(ETICHETTE.nome, ETICHETTE.cognome, nomePulito);
    if (c) v.cognome = pulisciNomeStampato(soloParoleNome(c.originale));
    if (n && (!c || n.riga !== c.riga)) v.nome = pulisciNomeStampato(soloParoleNome(n.originale));
    // cognome e nome con le etichette sulla stessa riga («NAMEN/VORNAMEN · SURNAMES/FORENAMES»): i valori sono le due righe sotto
    if (c && !v.nome && c.riga !== c.etichetta && ETICHETTE.nome.test(U[c.etichetta].replace(ETICHETTE.cognome, ' '))) {
      const j = c.riga + 1;
      if (U[j] && !ETICHETTA_QUALSIASI.test(U[j]) && !/\d/.test(U[j])) v.nome = pulisciNomeStampato(soloParoleNome(O[j]));
    }
    // un nome con una parte senza vocali («CG OVANNA») o di una lettera sola («C OVANNA»): probabilmente letto male (dubbi: la
    // lettura ne cerca una seconda; se non c'è, si usa lo stesso, da controllare)
    for (const k of ['cognome', 'nome']) {
      const parti = v[k] ? v[k].split(/[ '\-]+/).filter(Boolean) : [];
      if (parti.some(p => (p.length >= 2 && !/[AEIOUYÀ-ÖØ-Ý]/.test(p)) || (p.length === 1 && parti.length > 1))) (v.dubbi = v.dubbi || []).push(k);
    }
    const ld = dopo(ETICHETTE.luogoData);
    const luogoTesto = ld ? ld.valore : (dopo(ETICHETTE.luogo) || {}).valore;
    if (luogoTesto) { const l = leggiLuogo(luogoTesto, o); if (l) v.luogo = l; }
    const dt = ld ? null : dopo(ETICHETTE.data);
    const dataTesto = ld ? ld.valore : (dt || {}).valore;
    // carta cartacea: «nato il …», poi (atto n. …), poi «a COMUNE (PR)» nelle due righe sotto
    if (!v.luogo && dt) for (const r of U.slice(dt.riga + 1, dt.riga + 3)) { if (/^A\s/.test(r)) { const l = leggiLuogo(r, o); if (l) { v.luogo = l; break; } } }
    if (dataTesto) {
      const d = dateNelTesto(dataTesto)[0];
      if (d && !d.breve && isoValida(+d.anno, d.m, d.g)) v.nascita = iso(+d.anno, d.m, d.g);
      else if (d && d.breve) { const x = dataNascitaDaAnnoBreve(d.anno, d.m, d.g, o.oggi); if (x) { v.nascita = x.iso; v.nascitaIncerta = x.incerta; } }
    }
    const ct = dopo(ETICHETTE.cittadinanza);
    if (ct) {
      const codice = (ct.valore.match(/\b[A-Z]{3}\b/g) || []).find(c => ISO_STATI[c]);
      if (codice) v.cittadinanza = ISO_STATI[codice];
      else if (/\bITALIAN[AO]\b/.test(ct.valore)) v.cittadinanza = 'Italia';
    }
    const sx = dopo(ETICHETTE.sesso);
    // «M», anche se l'OCR ci ha attaccato una lettera minuscola («Mm»)
    if (sx) { const m = /^\s*([MF])(?![A-Z])/.exec(sx.originale || sx.valore) || /\b([MF])\b/.exec(sx.valore); if (m) v.sesso = m[1]; }
    const sc = dopo(ETICHETTE.scadenza);
    if (sc) { const ds = dateNelTesto(sc.valore); const d = ds[ds.length - 1]; if (d) v.scadenza = d.breve ? dataDocumentoDaAnnoBreve(d.anno, d.m, d.g, o.oggi) : (isoValida(+d.anno, d.m, d.g) ? iso(+d.anno, d.m, d.g) : null); }
    const em = dopo(ETICHETTE.rilascio);
    if (em) { const d = dateNelTesto(em.valore)[0]; if (d) v.rilascio = d.breve ? dataDocumentoDaAnnoBreve(d.anno, d.m, d.g, o.oggi) : (isoValida(+d.anno, d.m, d.g) ? iso(+d.anno, d.m, d.g) : null); }
    // CIE: «SCADENZA» e «EMISSIONE» spesso sono sulla stessa riga, con le due date nella riga sotto
    if (!v.scadenza && em) { const ds = dateNelTesto(em.valore); if (ds.length >= 2) { const d = ds[1]; v.scadenza = d.breve ? dataDocumentoDaAnnoBreve(d.anno, d.m, d.g, o.oggi) : (isoValida(+d.anno, d.m, d.g) ? iso(+d.anno, d.m, d.g) : null); } }
    // numero del documento (solo i formati riconoscibili: CIE «CA00000AA», carta cartacea «AX 1234567»)
    const cie = RE_NUMERO_CIE.exec(tutto);
    if (cie) { v.numero = cie[1] + cie[2] + cie[3]; indizi.numeroCie = true; }
    const incerti = numeriCieIncerti(U).filter(n => n !== v.numero && !codiceFiscaleValido(n));
    if (incerti.length) v.numeriCie = incerti;
    else if (indizi.carta && indizi.italia && !indizi.passaporto) { const cc = RE_NUMERO_CARTA_CARTACEA.exec(tutto); if (cc) v.numero = cc[1] + cc[2]; }
  }
  if (v.cognome && !nomeCredibile(v.cognome)) delete v.cognome;
  if (v.nome && !nomeCredibile(v.nome)) delete v.nome;
  // credibile anche da solo (senza MRZ) se c'è un segno di documento (intestazione, campi della patente, numero della CIE)
  // oppure almeno cognome, nome e data di nascita: altrimenti è probabilmente testo letto a caso (combinaLetture lo ignora)
  v.credibile = !!(indizi.patente || indizi.carta || indizi.passaporto || indizi.italia || indizi.numeroCie || (v.cognome && v.nome && v.nascita));
  if (v.numero && codiceFiscaleValido(v.numero)) delete v.numero;
  const cf = trovaCodiceFiscale(tutto);
  if (cf) v.codiceFiscale = cf;
  return v;
}

// ---- Tipo di documento (solo per il responsabile) ----
// modo: 'proposto' = si compila (CIE italiana riconosciuta dalla MRZ); 'suggerito' = l'ospite conferma con un tocco; null = sceglie l'ospite.
export function classificaDocumento(mrz, stampato) {
  const ind = (stampato && stampato.indizi) || {};
  if (mrz) {
    const cod = mrz.codiceDocumento || '', em = mrz.codici && mrz.codici.emittente;
    const numero = mrz.campi.numeroDocumento && mrz.campi.numeroDocumento.valore;
    if (mrz.formato === 'TD1' && em === 'ITA' && /^C[A-Z]\d{5}[A-Z]{2}$/.test(numero || '') && /^[CI]/.test(cod))
      return { tipo: 'cie', voce: TIPI_DOCUMENTO.CIE, modo: 'proposto' };
    // «C<ITA» a tre righe è la CIE anche se il numero non si legge (consumato, riflesso): proposta se lo conferma il fronte
    if (mrz.formato === 'TD1' && em === 'ITA' && /^C/.test(cod))
      return { tipo: 'cie', voce: TIPI_DOCUMENTO.CIE, modo: ind.numeroCie || (ind.carta && ind.italia) ? 'proposto' : 'suggerito' };
    if (mrz.formato === 'TD3' && cod[0] === 'P') {
      if (cod === 'P<' || cod === 'PP') return { tipo: 'passaporto', voce: TIPI_DOCUMENTO.PASSAPORTO, modo: 'suggerito' };
      if (cod === 'PD') return { tipo: 'passaporto', voce: TIPI_DOCUMENTO.PASSAPORTO_DIPLOMATICO, modo: 'suggerito' };
      if (cod === 'PS' || cod === 'PO') return { tipo: 'passaporto', voce: TIPI_DOCUMENTO.PASSAPORTO_SERVIZIO, modo: 'suggerito' };
      return { tipo: 'documento_viaggio', voce: null, modo: null, nota: 'documento_di_viaggio_particolare' };   // emergenza, rifugiati, apolidi…
    }
    if ((mrz.formato === 'TD1' || mrz.formato === 'TD2' || mrz.formato === 'FRENCH_NATIONAL_ID') && /^[IAC][<D]$/.test(cod) && em !== 'ITA')
      return { tipo: 'carta_estera', voce: TIPI_DOCUMENTO.CARTA_IDENTITA, modo: 'suggerito' };
    if (mrz.formato === 'SWISS_DRIVING_LICENSE') return { tipo: 'patente', voce: TIPI_DOCUMENTO.PATENTE, modo: 'suggerito' };
    return { tipo: 'altro', voce: null, modo: null, nota: 'tipo_non_determinabile' };   // es. permessi di soggiorno, visti: non nell'elenco del modulo
  }
  if (ind.patente && ind.campiPatente) return { tipo: 'patente', voce: TIPI_DOCUMENTO.PATENTE, modo: 'suggerito' };
  if (ind.carta && ind.italia && ind.numeroCie) return { tipo: 'cie_fronte', voce: TIPI_DOCUMENTO.CIE, modo: 'suggerito' };
  if (ind.carta && ind.italia) return { tipo: 'carta_cartacea', voce: TIPI_DOCUMENTO.CARTA_IDENTITA, modo: 'suggerito' };
  if (ind.carta) return { tipo: 'carta_estera', voce: TIPI_DOCUMENTO.CARTA_IDENTITA, modo: 'suggerito' };
  if (ind.passaporto) return { tipo: 'passaporto', voce: null, modo: null, nota: 'passaporto_senza_mrz' };
  return null;
}

// Distanza di modifica (Levenshtein) tra due chiavi di nome: «simili» se differiscono al più di 2 caratteri (o del 20%).
function distanza(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prec = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prec + (a[i - 1] === b[j - 1] ? 0 : 1)); prec = t; }
  }
  return d[b.length];
}
const simili = (a, b) => !!a && !!b && distanza(a, b) <= Math.max(2, Math.round(Math.max(a.length, b.length) * 0.2));

// ---- Unione delle letture (fronte e retro) e proposte per i campi del modulo ----

const CAMPI_ANAGRAFICI = ['cognome', 'nome', 'genere', 'nascita', 'cittadinanza', 'luogoNascita', 'comune', 'provincia'];
const CAMPI_DOCUMENTO = ['tipoDocumento', 'numeroDocumento', 'luogoRilascio'];

// letture: [{ mrz: <leggiMrz> | null, stampato: <leggiTestoStampato> | null }] (una per immagine)
// opzioni: { responsabile: bool, oggi, stati, province }
// Restituisce { campi: { nome: { valore, affidabilita, fonte, suggerimento? } }, avvisi: [{ codice, campo? }], documento, esito }
export function combinaLetture(letture, opzioni) {
  const o = opzioni || {};
  const elenco = (letture || []).filter(Boolean);
  const mrz = elenco.map(l => l.mrz).filter(Boolean).sort((a, b) => (b.verificate - a.verificate) || ((b.controlli.complessiva === true) - (a.controlli.complessiva === true)))[0] || null;
  // testo stampato: si uniscono i campi trovati nelle varie immagini (il primo valore trovato vince)
  const st = { indizi: {} };
  for (const l of elenco) {
    const s = l.stampato; if (!s) continue;
    if (!mrz && s.credibile === false) continue;       // testo senza segni di documento e senza MRZ: non si usa
    for (const [k, val] of Object.entries(s.indizi || {})) st.indizi[k] = st.indizi[k] || val;
    for (const k of ['cognome', 'nome', 'nascita', 'nascitaIncerta', 'luogo', 'sesso', 'cittadinanza', 'numero', 'scadenza', 'rilascio', 'codiceFiscale']) if (st[k] == null && s[k] != null) st[k] = s[k];
    if (s.numeriCie) st.numeriCie = (st.numeriCie || []).concat(s.numeriCie);
  }
  const campi = {}, avvisi = [];
  const avviso = (codice, campo) => { if (!avvisi.some(a => a.codice === codice && a.campo === campo)) avvisi.push(campo ? { codice, campo } : { codice }); };
  if (mrz) for (const a of mrz.avvisi) avviso(a.codice, a.campo);

  // nomi: struttura della MRZ; il testo stampato conferma (e conserva accenti e apostrofi, che la MRZ non ha: MÜLLER, che
  // la MRZ scrive MUELLER, è la stessa persona). Se i due differiscono, uno dei due è letto male: vale la MRZ (carattere
  // fatto per l'OCR, separatori «<» riconosciuti dalla forma, tre letture unite), da controllare, perché sulle foto vere il
  // testo stampato su un fondo disegnato si legge peggio (GIOVANNA letto «CIOVANNA», «CG OVANNA»). Due eccezioni, in cui vale il
  // testo stampato: la MRZ troncata (nome lungo: la MRZ ne ha solo l'inizio) e la MRZ con meno di due cifre di controllo esatte.
  for (const k of ['cognome', 'nome']) {
    const m = mrz && mrz.campi[k], s = st[k];
    const uguali = m && s && (chiaveNome(m.valore) === chiaveNome(s) || chiaveNome(m.valore) === chiaveIcao(s));
    const troncata = m && s && mrz.avvisi.some(a => a.codice === 'nome_troncato') && [chiaveNome(s), chiaveIcao(s)].some(x => x.length > chiaveNome(m.valore).length && x.startsWith(chiaveNome(m.valore)));
    if (uguali) campi[k] = { valore: s, affidabilita: SICURO, fonte: 'mrz+stampato' };
    else if (m && s && simili(chiaveNome(m.valore), chiaveNome(s)) && (troncata || mrz.verificate < 2)) campi[k] = { valore: s, affidabilita: DA_VERIFICARE, fonte: 'stampato' };
    else if (m && s && troncata) campi[k] = { valore: s, affidabilita: DA_VERIFICARE, fonte: 'stampato' };
    else if (m) campi[k] = Object.assign({}, m, s ? { affidabilita: DA_VERIFICARE } : {});
    else if (s) campi[k] = { valore: s, affidabilita: DA_VERIFICARE, fonte: 'stampato' };
  }
  if (mrz && mrz.campi.cognome && mrz.campi.nome && st.cognome && st.nome && chiaveNome(st.cognome) === chiaveNome(mrz.campi.nome.valore) && chiaveNome(st.nome) === chiaveNome(mrz.campi.cognome.valore)) {
    avviso('nomi_invertiti', 'cognome');
    campi.cognome.affidabilita = DA_VERIFICARE; campi.nome.affidabilita = DA_VERIFICARE;
  }
  if (avvisi.some(a => a.codice === 'nome_troncato') && campi.nome && campi.nome.fonte === 'mrz') campi.nome.affidabilita = DA_VERIFICARE;

  // data di nascita
  const mn = mrz && mrz.campi.nascita;
  if (mn) {
    campi.nascita = Object.assign({}, mn);
    if (st.nascita && st.nascita === mn.valore) { campi.nascita.affidabilita = SICURO; campi.nascita.fonte = 'mrz+stampato'; }
    else if (mn.secoloIncerto && st.nascita && st.nascita.slice(2) === mn.valore.slice(2)) campi.nascita = { valore: st.nascita, affidabilita: SICURO, fonte: 'mrz+stampato' };
    if (campi.nascita.affidabilita !== SICURO && mn.secoloIncerto) avviso('secolo_incerto', 'nascita');
  } else if (st.nascita) {
    campi.nascita = { valore: st.nascita, affidabilita: DA_VERIFICARE, fonte: 'stampato' };
    if (st.nascitaIncerta) avviso('secolo_incerto', 'nascita');
  }
  if (campi.nascita && campi.nascita.valore > oggiIso(o.oggi)) { delete campi.nascita; avviso('nascita_futura', 'nascita'); }

  // sesso
  const ms = mrz && mrz.campi.genere;
  if (ms) campi.genere = Object.assign({}, ms, st.sesso === ms.valore ? { affidabilita: SICURO, fonte: 'mrz+stampato' } : {});
  else if (st.sesso) campi.genere = { valore: st.sesso, affidabilita: DA_VERIFICARE, fonte: 'stampato' };

  // cittadinanza: dalla MRZ; senza MRZ solo se il testo stampato riporta il codice a 3 lettere (CIE) o «italiana»
  if (mrz && mrz.campi.cittadinanza) {
    campi.cittadinanza = Object.assign({}, mrz.campi.cittadinanza);
    if (st.cittadinanza && st.cittadinanza === campi.cittadinanza.valore) campi.cittadinanza.affidabilita = SICURO;
  } else if (st.cittadinanza) campi.cittadinanza = { valore: st.cittadinanza, affidabilita: DA_VERIFICARE, fonte: 'stampato' };

  // luogo di nascita: solo dal testo stampato (la MRZ non lo contiene)
  if (st.luogo && st.luogo.stato) {
    campi.luogoNascita = { valore: st.luogo.stato, affidabilita: DA_VERIFICARE, fonte: 'stampato' };
    if (st.luogo.stato === 'Italia' && st.luogo.comune && st.luogo.provincia) {
      campi.comune = { valore: st.luogo.comune, affidabilita: DA_VERIFICARE, fonte: 'stampato' };
      campi.provincia = { valore: st.luogo.provincia, affidabilita: DA_VERIFICARE, fonte: 'stampato' };
    }
  }

  // codice fiscale: SOLO controllo incrociato
  const cf = (mrz && mrz.codiceFiscale) || st.codiceFiscale || null;
  if (cf) {
    const c = confrontaCF(cf, { cognome: campi.cognome && campi.cognome.valore, nome: campi.nome && campi.nome.valore, nascita: campi.nascita && campi.nascita.valore, genere: campi.genere && campi.genere.valore });
    const nonCoincide = Object.entries(c).filter(([, x]) => x === false).map(([k]) => k);
    if (nonCoincide.length) { avviso('cf_non_coincide'); for (const k of nonCoincide) if (campi[k]) campi[k].affidabilita = DA_VERIFICARE; }
    else for (const k of ['cognome', 'nome', 'genere']) if (c[k] === true && campi[k]) campi[k].affidabilita = SICURO;
    const d = decodificaCF(cf);
    if (d && campi.luogoNascita && (campi.luogoNascita.valore === 'Italia') === d.natoAllEstero) avviso('cf_non_coincide');
  }

  // dati del documento: solo per il responsabile (il modulo non li chiede agli altri ospiti)
  const tipo = classificaDocumento(mrz, st);
  if (o.responsabile) {
    // Numero del documento: dalla MRZ (cifra di controllo). Se nella MRZ non torna (consumato, letto male), dal fronte della CIE:
    // verde se la MRZ lo conferma (verificaNumero), arancione se si legge solo sul fronte. Le letture alternative del fronte
    // (numeriCieIncerti) valgono solo confermate: con due conferme (cifra del numero e complessiva), o con la sola complessiva se la
    // cifra del numero nella MRZ non si legge e il numero della MRZ differisce di un solo carattere. Tra più numeri confermati vale
    // quello più vicino al numero della MRZ, se è uno solo (06/11/2026: numero vuoto nella prova del titolare).
    const confermati = [];
    if (mrz && mrz.verificaNumero) {
      const prova = (n, esatto) => {
        if (!n || confermati.some(c => c.n === n)) return;
        const r = mrz.verificaNumero(n);
        if (r && (esatto || r.conferme >= 2 || (!r.cifraLetta && r.distanza <= 1))) confermati.push({ n, distanza: r.distanza, conferme: r.conferme });
      };
      prova(st.numero, true);
      for (const n of st.numeriCie || []) prova(n, false);
      confermati.sort((a, b) => a.distanza - b.distanza || b.conferme - a.conferme);
    }
    const [c0, c1] = confermati;
    const confermato = c0 && (!c1 || c0.distanza < c1.distanza || c0.conferme > c1.conferme) ? c0.n : null;
    // un numero «corretto» dalla sola MRZ (caratteri cambiati finché le cifre di controllo tornano) è un'ipotesi: se il fronte ne dà
    // uno confermato dalla MRZ, vale quello
    const dallaMrz = mrz && mrz.campi.numeroDocumento, ipotesi = !!(dallaMrz && dallaMrz.nota === 'corretto');
    if (dallaMrz && !(ipotesi && confermato && confermato !== dallaMrz.valore)) {
      campi.numeroDocumento = Object.assign({}, dallaMrz);
      if ((st.numero && st.numero === campi.numeroDocumento.valore) || confermato === campi.numeroDocumento.valore) campi.numeroDocumento.affidabilita = SICURO;
    } else if (confermato) campi.numeroDocumento = { valore: confermato, affidabilita: SICURO, fonte: 'stampato+mrz' };
    else if (st.numero) campi.numeroDocumento = { valore: st.numero, affidabilita: DA_VERIFICARE, fonte: 'stampato' };
    // Tipo: la CIE è certa (verde) se la MRZ è quella di una CIE (TD1, ITA, «C») e la riga di nascita e scadenza è letta bene (cifre
    // di controllo esatte): il tipo non dipende dal numero. 06/11/2026, il titolare: «giusta ma in giallo». Gli altri tipi
    // riconosciuti restano da controllare (arancione).
    const cieCerta = !!(tipo && tipo.tipo === 'cie' && mrz && mrz.controlli && mrz.controlli.nascita && mrz.controlli.scadenza);
    if (tipo && tipo.voce && (cieCerta || (tipo.modo === 'proposto' && mrz && mrz.valida))) campi.tipoDocumento = { valore: tipo.voce, affidabilita: cieCerta ? SICURO : DA_VERIFICARE, fonte: 'mrz' };
    else if (tipo && tipo.voce) campi.tipoDocumento = { valore: null, suggerimento: tipo.voce, affidabilita: DA_VERIFICARE, fonte: mrz ? 'mrz' : 'stampato' };
    else avviso('tipo_da_scegliere', 'tipoDocumento');
    if (mrz && mrz.campi.luogoRilascio) campi.luogoRilascio = Object.assign({}, mrz.campi.luogoRilascio);
    else if (!mrz && st.indizi.italia && (st.indizi.patente || st.indizi.carta)) campi.luogoRilascio = { valore: 'Italia', affidabilita: DA_VERIFICARE, fonte: 'stampato' };
  }

  // controlli di plausibilità (avvisi, mai blocchi)
  const scadenza = (mrz && mrz.scadenza) || st.scadenza || null;
  if (scadenza && scadenza < oggiIso(o.oggi)) avviso('documento_scaduto');
  if (st.rilascio && scadenza && st.rilascio >= scadenza) avviso('date_incoerenti');
  if (campi.nascita && st.rilascio && st.rilascio < campi.nascita.valore) avviso('date_incoerenti');

  // valori che il modulo non può accettare: si scartano (mai un valore fuori elenco)
  if (o.stati) for (const k of ['cittadinanza', 'luogoNascita', 'luogoRilascio']) if (campi[k] && campi[k].valore && !o.stati.includes(campi[k].valore)) delete campi[k];
  if (o.province && campi.provincia && !o.province.includes(campi.provincia.valore)) { delete campi.provincia; delete campi.comune; }
  for (const k of Object.keys(campi)) if (!CAMPI_ANAGRAFICI.includes(k) && !(o.responsabile && CAMPI_DOCUMENTO.includes(k))) delete campi[k];

  const letti = Object.values(campi).filter(c => c.valore).length;
  const esito = campi.cognome && campi.nome && campi.nascita ? 'ok' : letti ? 'parziale' : 'nessun_dato';
  return { campi, avvisi, documento: { tipo: tipo && tipo.tipo, nota: tipo && tipo.nota, mrz: !!mrz, mrzValida: !!(mrz && mrz.valida), formato: mrz && mrz.formato }, esito };
}

// ---- Compilazione senza sovrascritture ----
// attuali: valori già nel modulo { campo: stringa }; proposte: combinaLetture(...).campi
// Si scrivono SOLO i campi vuoti; un valore già inserito e diverso diventa un «conflitto» che decide l'ospite.
const uguali = (k, a, b) => (k === 'cognome' || k === 'nome' || k === 'comune') ? chiaveNome(a) === chiaveNome(b) : String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
export function pianificaCompilazione(attuali, proposte) {
  const scrivere = [], conflitti = [], confermati = [];
  for (const [k, p] of Object.entries(proposte || {})) {
    if (!p || p.valore == null || p.valore === '') continue;
    const a = attuali && attuali[k] != null ? String(attuali[k]).trim() : '';
    if (!a) scrivere.push({ campo: k, valore: p.valore, affidabilita: p.affidabilita });
    else if (uguali(k, a, p.valore)) confermati.push({ campo: k, valore: a });
    else conflitti.push({ campo: k, attuale: a, letto: p.valore, affidabilita: p.affidabilita });
  }
  return { scrivere, conflitti, confermati };
}

// Stessa persona (per l'avviso «documento già usato per un altro ospite»): cognome, nome e data di nascita uguali.
export function stessaPersona(a, b) {
  return !!(a && b && a.cognome && b.cognome && a.nome && b.nome && a.nascita && b.nascita &&
    chiaveNome(a.cognome) === chiaveNome(b.cognome) && chiaveNome(a.nome) === chiaveNome(b.nome) && a.nascita === b.nascita);
}
