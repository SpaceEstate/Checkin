// ============================================================
// mrz.js — Space Estate Check-in — lettura della MRZ dei documenti
//
// La MRZ (Machine Readable Zone) è il blocco di righe in caratteri
// monospaziati stampato sui documenti:
//   - TD3: passaporti          -> 2 righe da 44 caratteri (pagina dei dati)
//   - TD2: alcuni documenti    -> 2 righe da 36 caratteri
//   - TD1: carta d'identità    -> 3 righe da 30 caratteri (retro della CIE)
//
// Non è OCR "a indovinare": quasi tutti i campi hanno una cifra di controllo
// calcolata con l'algoritmo ICAO 9303 (pesi 7-3-1). Qui il criterio è
// prudente: un campo viene restituito SOLO se la sua cifra di controllo
// torna. Se l'OCR ha sbagliato un carattere, il campo resta vuoto e
// l'ospite lo compila a mano — meglio un campo vuoto che un dato sbagliato.
//
// Nessun dato esce dal browser: il file viene letto, l'OCR gira in locale
// (vedi documento-ocr.js) e da qui escono solo i campi del form.
//
// Questo file non è un modulo ES: va caricato PRIMA di checkin.js.
// ============================================================

// Codice ISO 3166-1 alpha-3 usato nella MRZ -> nome italiano, identico ai
// valori dell'elenco `stati` in checkin.js (il value inviato al backend deve
// restare la stringa italiana esatta, altrimenti la select non si allinea).
const MRZ_PAESI = {
  AFG: 'Afghanistan', ALB: 'Albania', DZA: 'Algeria', AND: 'Andorra', AGO: 'Angola',
  ATG: 'Antigua e Barbuda', SAU: 'Arabia Saudita', ARG: 'Argentina', ARM: 'Armenia',
  AUS: 'Australia', AUT: 'Austria', AZE: 'Azerbaigian', BHS: 'Bahamas', BHR: 'Bahrain',
  BGD: 'Bangladesh', BRB: 'Barbados', BEL: 'Belgio', BLZ: 'Belize', BEN: 'Benin',
  BTN: 'Bhutan', BLR: 'Bielorussia', MMR: 'Birmania', BOL: 'Bolivia',
  BIH: 'Bosnia ed Erzegovina', BWA: 'Botswana', BRA: 'Brasile', BRN: 'Brunei',
  BGR: 'Bulgaria', BFA: 'Burkina Faso', BDI: 'Burundi', KHM: 'Cambogia', CMR: 'Camerun',
  CAN: 'Canada', CPV: 'Capo Verde', TCD: 'Ciad', CHL: 'Cile', CHN: 'Cina', CYP: 'Cipro',
  COM: 'Comore', PRK: 'Corea del Nord', KOR: 'Corea del Sud', CIV: "Costa d'Avorio",
  CRI: 'Costa Rica', HRV: 'Croazia', CUB: 'Cuba', DNK: 'Danimarca', DMA: 'Dominica',
  ECU: 'Ecuador', EGY: 'Egitto', SLV: 'El Salvador', ARE: 'Emirati Arabi Uniti',
  ERI: 'Eritrea', EST: 'Estonia', ETH: 'Etiopia', FJI: 'Figi', PHL: 'Filippine',
  FIN: 'Finlandia', FRA: 'Francia', GAB: 'Gabon', GMB: 'Gambia', GEO: 'Georgia',
  // I passaporti tedeschi usano "D" come codice di stato, non "DEU".
  DEU: 'Germania', D: 'Germania',
  GHA: 'Ghana', JAM: 'Giamaica', JPN: 'Giappone', DJI: 'Gibuti', JOR: 'Giordania',
  GRC: 'Grecia', GRD: 'Grenada', GTM: 'Guatemala', GIN: 'Guinea', GNB: 'Guinea-Bissau',
  GNQ: 'Guinea Equatoriale', GUY: 'Guyana', HTI: 'Haiti', HND: 'Honduras', IND: 'India',
  IDN: 'Indonesia', IRN: 'Iran', IRQ: 'Iraq', IRL: 'Irlanda', ISL: 'Islanda',
  ISR: 'Israele', ITA: 'Italia', KAZ: 'Kazakistan', KEN: 'Kenya', KGZ: 'Kirghizistan',
  KIR: 'Kiribati', KWT: 'Kuwait', LAO: 'Laos', LSO: 'Lesotho', LVA: 'Lettonia',
  LBN: 'Libano', LBR: 'Liberia', LBY: 'Libia', LIE: 'Liechtenstein', LTU: 'Lituania',
  LUX: 'Lussemburgo', MKD: 'Macedonia del Nord', MDG: 'Madagascar', MWI: 'Malawi',
  MYS: 'Malaysia', MDV: 'Maldive', MLI: 'Mali', MLT: 'Malta', MAR: 'Marocco',
  MHL: 'Isole Marshall', MRT: 'Mauritania', MUS: 'Mauritius', MEX: 'Messico',
  FSM: 'Micronesia', MDA: 'Moldavia', MCO: 'Monaco', MNG: 'Mongolia', MNE: 'Montenegro',
  MOZ: 'Mozambico', NAM: 'Namibia', NRU: 'Nauru', NPL: 'Nepal', NIC: 'Nicaragua',
  NER: 'Niger', NGA: 'Nigeria', NOR: 'Norvegia', NZL: 'Nuova Zelanda', OMN: 'Oman',
  NLD: 'Paesi Bassi', PAK: 'Pakistan', PLW: 'Palau', PAN: 'Panama',
  PNG: 'Papua Nuova Guinea', PRY: 'Paraguay', PER: 'Peru', POL: 'Polonia',
  PRT: 'Portogallo', QAT: 'Qatar', GBR: 'Regno Unito', CZE: 'Repubblica Ceca',
  CAF: 'Repubblica Centrafricana', COG: 'Repubblica del Congo',
  COD: 'Repubblica Democratica del Congo', DOM: 'Repubblica Dominicana',
  ROU: 'Romania', RWA: 'Ruanda', RUS: 'Russia', KNA: 'Saint Kitts e Nevis',
  LCA: 'Saint Lucia', VCT: 'Saint Vincent e Grenadine', WSM: 'Samoa', SMR: 'San Marino',
  STP: 'São Tomé e Príncipe', SEN: 'Senegal', SRB: 'Serbia', SYC: 'Seychelles',
  SLE: 'Sierra Leone', SGP: 'Singapore', SYR: 'Siria', SVK: 'Slovacchia',
  SVN: 'Slovenia', SOM: 'Somalia', ESP: 'Spagna', LKA: 'Sri Lanka', USA: 'Stati Uniti',
  ZAF: 'Sudafrica', SDN: 'Sudan', SSD: 'Sudan del Sud', SUR: 'Suriname', SWE: 'Svezia',
  CHE: 'Svizzera', SWZ: 'Swaziland', TJK: 'Tagikistan', TZA: 'Tanzania',
  THA: 'Thailandia', TLS: 'Timor Est', TGO: 'Togo', TON: 'Tonga',
  TTO: 'Trinidad e Tobago', TUN: 'Tunisia', TUR: 'Turchia', TKM: 'Turkmenistan',
  TUV: 'Tuvalu', UKR: 'Ucraina', UGA: 'Uganda', HUN: 'Ungheria', URY: 'Uruguay',
  UZB: 'Uzbekistan', VUT: 'Vanuatu', VAT: 'Vaticano', VEN: 'Venezuela', VNM: 'Vietnam',
  YEM: 'Yemen', ZMB: 'Zambia', ZWE: 'Zimbabwe'
};

// Confusioni tipiche dell'OCR. Nelle posizioni che devono contenere cifre si
// forzano le lettere somiglianti (e viceversa nelle posizioni alfabetiche):
// è il motivo per cui una MRZ letta male spesso si recupera comunque.
const MRZ_VERSO_CIFRE = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' };
const MRZ_VERSO_LETTERE = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 8: 'B', 6: 'G', 7: 'T', 4: 'A' };

function mrzSoloCifre(testo) {
  return testo.split('').map(c => MRZ_VERSO_CIFRE[c] || c).join('');
}

function mrzSoloLettere(testo) {
  return testo.split('').map(c => MRZ_VERSO_LETTERE[c] || c).join('');
}

// Cifra di controllo ICAO 9303: pesi ciclici 7-3-1, '<' vale 0,
// le lettere valgono A=10 ... Z=35.
function mrzCifraControllo(valore) {
  const pesi = [7, 3, 1];
  let somma = 0;
  for (let i = 0; i < valore.length; i++) {
    const c = valore[i];
    let v;
    if (c === '<') v = 0;
    else if (c >= '0' && c <= '9') v = c.charCodeAt(0) - 48;
    else if (c >= 'A' && c <= 'Z') v = c.charCodeAt(0) - 55;
    else return null; // carattere non valido: la riga non è una MRZ
    somma += v * pesi[i % 3];
  }
  return String(somma % 10);
}

function mrzControlloOk(valore, cifra) {
  const attesa = mrzCifraControllo(valore);
  return attesa !== null && attesa === mrzSoloCifre(cifra);
}

// Ripulisce una riga letta dall'OCR: maiuscole, via spazi e punteggiatura,
// i caratteri che l'OCR usa spesso al posto del filler diventano '<'.
function mrzNormalizzaRiga(riga) {
  return String(riga || '')
    .toUpperCase()
    .replace(/[«»＜‹›^]/g, '<')
    .replace(/[^A-Z0-9<]/g, '');
}

// "ROSSI<<MARIO<LUIGI<<<" -> { cognome: 'Rossi', nome: 'Mario Luigi' }
function mrzNomi(campo) {
  const parti = campo.split('<<');
  const cognome = (parti[0] || '').replace(/</g, ' ').trim();
  const nome = (parti.slice(1).join(' ') || '').replace(/</g, ' ').trim();
  return { cognome: mrzCapitalizza(cognome), nome: mrzCapitalizza(nome) };
}

// I nomi nella MRZ sono tutti in maiuscolo: "DE LUCA" -> "De Luca".
function mrzCapitalizza(testo) {
  return String(testo || '')
    .toLowerCase()
    .replace(/(^|[\s'\-])([a-zà-ÿ])/g, (m, sep, lettera) => sep + lettera.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

// AAMMGG -> AAAA-MM-GG. Una data di nascita non può essere nel futuro:
// '05' letto oggi è il 2005, '85' è il 1985.
function mrzDataNascita(aammgg) {
  const cifre = mrzSoloCifre(aammgg);
  if (!/^\d{6}$/.test(cifre)) return null;
  const aa = parseInt(cifre.slice(0, 2), 10);
  const mm = cifre.slice(2, 4);
  const gg = cifre.slice(4, 6);
  const annoCorrente = new Date().getFullYear() % 100;
  const anno = aa > annoCorrente ? 1900 + aa : 2000 + aa;
  if (mm < '01' || mm > '12' || gg < '01' || gg > '31') return null;
  return `${anno}-${mm}-${gg}`;
}

function mrzDataScadenza(aammgg) {
  const cifre = mrzSoloCifre(aammgg);
  if (!/^\d{6}$/.test(cifre)) return null;
  const aa = parseInt(cifre.slice(0, 2), 10);
  // Le scadenze guardano avanti: sotto 70 è 20xx, sopra è 19xx.
  const anno = aa < 70 ? 2000 + aa : 1900 + aa;
  return `${anno}-${cifre.slice(2, 4)}-${cifre.slice(4, 6)}`;
}

function mrzPaese(codice) {
  const pulito = mrzSoloLettere(String(codice || '')).replace(/</g, '');
  return MRZ_PAESI[pulito] || null;
}

// Tipo documento nei valori usati dalla select del form (`tipiDocumento`).
function mrzTipoDocumento(codice, formato) {
  const c = mrzSoloLettere(String(codice || '')).replace(/</g, '');
  if (c.startsWith('P')) return 'PASSAPORTO ORDINARIO';
  // Un documento d'identità con MRZ è per forza elettronico: la vecchia
  // carta cartacea la MRZ non ce l'ha.
  if (formato === 'TD1' || c.startsWith('I') || c.startsWith('A') || c.startsWith('C')) {
    return "CARTA IDENTITA' ELETTRONICA";
  }
  return null;
}

// Porta una riga alla lunghezza attesa: l'OCR spesso mangia o aggiunge
// qualche filler in coda, ma il contenuto utile è comunque all'inizio.
function mrzAdattaLunghezza(riga, attesa) {
  if (riga.length === attesa) return riga;
  if (riga.length > attesa) return riga.slice(0, attesa);
  return riga + '<'.repeat(attesa - riga.length);
}

// ------------------------------------------------------------------
// Parser dei tre formati. Ogni campo viene restituito solo se la sua
// cifra di controllo torna (i nomi e il sesso non ne hanno).
// ------------------------------------------------------------------
function mrzParseTD3(r1, r2) {
  const l1 = mrzAdattaLunghezza(r1, 44);
  const l2 = mrzAdattaLunghezza(r2, 44);

  const numeroDocumento = l2.slice(0, 9);
  const nascita = mrzSoloCifre(l2.slice(13, 19));
  const scadenza = mrzSoloCifre(l2.slice(21, 27));

  return mrzComponi({
    formato: 'TD3',
    codiceDocumento: l1.slice(0, 2),
    statoEmissione: l1.slice(2, 5),
    nomi: l1.slice(5, 44),
    numeroDocumento,
    numeroDocumentoOk: mrzControlloOk(numeroDocumento, l2[9]),
    cittadinanza: l2.slice(10, 13),
    nascita,
    nascitaOk: mrzControlloOk(nascita, l2[19]),
    sesso: l2[20],
    scadenza,
    scadenzaOk: mrzControlloOk(scadenza, l2[27])
  });
}

function mrzParseTD2(r1, r2) {
  const l1 = mrzAdattaLunghezza(r1, 36);
  const l2 = mrzAdattaLunghezza(r2, 36);

  const numeroDocumento = l2.slice(0, 9);
  const nascita = mrzSoloCifre(l2.slice(13, 19));
  const scadenza = mrzSoloCifre(l2.slice(21, 27));

  return mrzComponi({
    formato: 'TD2',
    codiceDocumento: l1.slice(0, 2),
    statoEmissione: l1.slice(2, 5),
    nomi: l1.slice(5, 36),
    numeroDocumento,
    numeroDocumentoOk: mrzControlloOk(numeroDocumento, l2[9]),
    cittadinanza: l2.slice(10, 13),
    nascita,
    nascitaOk: mrzControlloOk(nascita, l2[19]),
    sesso: l2[20],
    scadenza,
    scadenzaOk: mrzControlloOk(scadenza, l2[27])
  });
}

function mrzParseTD1(r1, r2, r3) {
  const l1 = mrzAdattaLunghezza(r1, 30);
  const l2 = mrzAdattaLunghezza(r2, 30);
  const l3 = mrzAdattaLunghezza(r3, 30);

  const numeroDocumento = l1.slice(5, 14);
  const nascita = mrzSoloCifre(l2.slice(0, 6));
  const scadenza = mrzSoloCifre(l2.slice(8, 14));

  return mrzComponi({
    formato: 'TD1',
    codiceDocumento: l1.slice(0, 2),
    statoEmissione: l1.slice(2, 5),
    nomi: l3,
    numeroDocumento,
    numeroDocumentoOk: mrzControlloOk(numeroDocumento, l1[14]),
    cittadinanza: l2.slice(15, 18),
    nascita,
    nascitaOk: mrzControlloOk(nascita, l2[6]),
    sesso: l2[7],
    scadenza,
    scadenzaOk: mrzControlloOk(scadenza, l2[14])
  });
}

function mrzComponi(grezzo) {
  const { cognome, nome } = mrzNomi(grezzo.nomi);
  const sesso = String(grezzo.sesso || '').toUpperCase();

  return {
    formato: grezzo.formato,
    cognome: cognome || null,
    nome: nome || null,
    sesso: sesso === 'M' || sesso === 'F' ? sesso : null,
    // I campi con cifra di controllo passano solo se il controllo torna.
    dataNascita: grezzo.nascitaOk ? mrzDataNascita(grezzo.nascita) : null,
    scadenza: grezzo.scadenzaOk ? mrzDataScadenza(grezzo.scadenza) : null,
    numeroDocumento: grezzo.numeroDocumentoOk
      ? grezzo.numeroDocumento.replace(/</g, '').trim()
      : null,
    cittadinanza: mrzPaese(grezzo.cittadinanza),
    statoEmissione: mrzPaese(grezzo.statoEmissione),
    tipoDocumento: mrzTipoDocumento(grezzo.codiceDocumento, grezzo.formato)
  };
}

// Una riga è "da MRZ" se è lunga il giusto ed è fatta di caratteri MRZ:
// serve a scartare il resto del testo letto dall'OCR sul documento.
function mrzRigheCandidate(testo) {
  return String(testo || '')
    .split(/[\r\n]+/)
    .map(mrzNormalizzaRiga)
    .filter(riga => riga.length >= 26 && (riga.match(/</g) || []).length >= 2);
}

// ------------------------------------------------------------------
// Punto di ingresso: dal testo grezzo dell'OCR ai campi del form.
// Restituisce null se nel testo non c'è nessuna MRZ riconoscibile.
// ------------------------------------------------------------------
function estraiDatiMRZ(testoOCR) {
  const righe = mrzRigheCandidate(testoOCR);
  if (righe.length < 2) return null;

  const risultati = [];

  for (let i = 0; i < righe.length - 1; i++) {
    const a = righe[i];
    const b = righe[i + 1];
    const c = righe[i + 2];

    // TD1: tre righe da 30 (carta d'identità elettronica)
    if (c && [a, b, c].every(r => r.length >= 28 && r.length <= 32)) {
      risultati.push(mrzParseTD1(a, b, c));
    }
    // TD3: due righe da 44 (passaporto)
    if (a.length >= 42 && a.length <= 46 && b.length >= 42 && b.length <= 46) {
      risultati.push(mrzParseTD3(a, b));
    }
    // TD2: due righe da 36
    if (a.length >= 34 && a.length <= 38 && b.length >= 34 && b.length <= 38) {
      risultati.push(mrzParseTD2(a, b));
    }
  }

  if (risultati.length === 0) return null;

  // Tra più letture possibili vince quella con più campi validati.
  const punteggio = r => ['cognome', 'nome', 'sesso', 'dataNascita', 'numeroDocumento', 'cittadinanza']
    .filter(k => r[k]).length;

  risultati.sort((x, y) => punteggio(y) - punteggio(x));
  const migliore = risultati[0];

  // Sotto i due campi utili non vale la pena proporre niente all'ospite.
  return punteggio(migliore) >= 2 ? migliore : null;
}

// Uso anche da Node per i test, restando uno script classico nel browser.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { estraiDatiMRZ, mrzCifraControllo, mrzDataNascita, mrzCapitalizza, MRZ_PAESI };
}
