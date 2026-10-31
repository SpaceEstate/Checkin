// api/invia-email-ospite.js
// VERSIONE CORRETTA - nomi file immagini aggiornati

import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { chiaveUguale } from './_admin-auth.js';

// Stesso criterio usato in stripeWebhook.js: mascherare l'indirizzo nei log
// mantenendo visibile solo il dominio.
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return 'N/A';
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 2 ? `${user[0]}*` : `${user.slice(0, 2)}${'*'.repeat(user.length - 2)}`;
  return `${maskedUser}@${domain}`;
}

// ------------------------------------------------------------------
// i18n email ospite (IT/EN/DE). Questa è l'UNICA email tradotta: quella al
// gestore (api/_email-gestore.js, solo immagine del documento) e il TXT
// Alloggiati restano in italiano — la lingua qui sotto riguarda solo cosa
// legge l'ospite. Dal webhook arrivano solo i dati che servono a questa email
// (soggiorno + nome per il saluto): nessun documento, nessuna data di nascita.
// ------------------------------------------------------------------
const LINGUE_VALIDE = ['it', 'en', 'de'];

// Sito di La Columbera: stessi indirizzi e stessi link di Google Maps della pagina «Come trovarci» (mappa.html: «Portami qui» e
// «Naviga al parcheggio») e dell'area clienti (js/area.js). L'ospite legge l'indirizzo, il link porta al punto giusto sulla mappa.
const SITO = 'https://la-columbera.vercel.app';
const MAPS_STRUTTURA = 'https://maps.app.goo.gl/mVBZWREejSuVEGqQ7?g_st=ic';
const MAPS_PARCHEGGIO = 'https://maps.app.goo.gl/VWHWQCMWUzAvgSYM7?g_st=ic';
// Recapiti del titolare, come nel piè di pagina delle email del sito. La casella che invia (EMAIL_USER) serve solo per gli avvisi e
// non viene letta: l'email chiede di non rispondere e indica questi recapiti.
const CONTATTI = { email: 'lacolumbera@gmail.com', tel: '+39 351 704 3594', telLink: 'tel:+393517043594' };
// Orari fissi (scelta del titolare, 31/10/2026): si cambiano qui a mano.
const CHECKIN_OPEN_TIME = '16:00', CHECKIN_CLOSE_TIME = '00:00', CHECKOUT_CLOSE_TIME = '10:00';

const EMAIL_TESTI = {
  it: {
    eyebrow: 'Check-in completato',
    preheader: "Il codice della cassetta, come arrivare e le foto per trovare l'ingresso.",
    title: nome => [nome ? `Grazie, ${nome}!` : 'Grazie!', 'Ti aspettiamo alla Columbera'],
    thanksText: 'Grazie per aver completato il check-in e il pagamento della tassa di soggiorno. Siamo felici di accoglierti nella nostra struttura!',
    codeTitleSingle: 'Codice della cassetta di sicurezza',
    codeTitleMulti: 'Codici delle cassette di sicurezza',
    codeNoteSingle: 'Conserva questo codice con cura',
    bothApartmentsNote: 'Hai prenotato entrambi gli appartamenti',
    infoTitle: 'Dettagli della tua prenotazione',
    labelCheckin: 'Data check-in',
    labelApartment: 'Appartamento',
    labelGuests: 'Ospiti',
    labelNights: 'Notti',
    labelTaxPaid: 'Tassa di soggiorno pagata',
    instructionsTitle: 'Come accedere alla struttura',
    addressPropertyLabel: 'Indirizzo della struttura',
    addressParkingLabel: 'Indirizzo del parcheggio',
    mapsLink: 'Apri in Google Maps',
    hoursLabel: 'Orari',
    checkinHoursText: (open, close) => `Check-in: dalle ${open} alle ${close}`,
    checkoutHoursText: (close) => `Check-out: entro le ${close}`,
    instruction1: 'Entrando dal cancello principale, dirigiti verso la palazzina sulla sinistra. Troverai due porte-finestre al piano terra, come mostrato in foto.',
    instruction2: "La cassetta si trova nella nicchia accanto all'ultimo scuro in legno sulla destra della facciata (vedi foto cerchiata in giallo).",
    instruction3: 'La sosta all\'interno della proprietà è consentita esclusivamente per le operazioni di carico e scarico dei bagagli.',
    galleryTitle: "Foto di riferimento per l'accesso",
    photo1Caption: '1. Ingresso della proprietà',
    photo2Caption: (multi, codes) => `2. Cassetta di sicurezza con ${multi ? 'codici' : 'codice'} ${codes}`,
    photo2CaptionNoCode: '2. Cassetta di sicurezza',
    photo3Caption: (multi) => `3. Ubicazione esatta ${multi ? 'delle cassette' : 'della cassetta'}`,
    areaTitle: 'La tua area personale',
    areaText: "Con il codice di prenotazione (anche quello di Booking.com o Airbnb) entri nell'area personale del nostro sito: informazioni sulla casa, Wi-Fi nei giorni del soggiorno, dintorni e Trentino Guest Card.",
    areaButton: 'Vai alla mia area personale',
    contactText: (email, tel) => `Per qualsiasi necessità o domanda scrivici a ${email} o chiamaci al ${tel}.`,
    closingText: 'Ti auguriamo un soggiorno piacevole e confortevole!',
    footerAutomated: (email) => `Questa è un'email automatica: non rispondere a questo messaggio. Per scriverci usa ${email}.`,
    privacy: 'Informativa privacy',
    subjectLine: (appartamento, data) => `Check-in completato · La Columbera${appartamento ? ' ' + appartamento : ''} · ${data}`,
    and: ' e ',
    genericName: 'Generico',
    fallbackDescrizione: 'Codice non disponibile, contatta il proprietario',
    corteDescrizione: 'Appartamento con 1 camera da letto',
    torreDescrizione: 'Appartamento con 2 camere da letto'
  },
  en: {
    eyebrow: 'Check-in completed',
    preheader: 'Your lockbox code, how to get here and photos to find the entrance.',
    title: nome => [nome ? `Thank you, ${nome}!` : 'Thank you!', 'We look forward to welcoming you'],
    thanksText: "Thank you for completing check-in and paying the tourist tax. We're delighted to welcome you to our property!",
    codeTitleSingle: 'Security lockbox code',
    codeTitleMulti: 'Security lockbox codes',
    codeNoteSingle: 'Keep this code somewhere safe',
    bothApartmentsNote: 'You have booked both apartments',
    infoTitle: 'Your booking details',
    labelCheckin: 'Check-in date',
    labelApartment: 'Apartment',
    labelGuests: 'Guests',
    labelNights: 'Nights',
    labelTaxPaid: 'Tourist tax paid',
    instructionsTitle: 'How to get into the property',
    addressPropertyLabel: 'Property address',
    addressParkingLabel: 'Parking address',
    mapsLink: 'Open in Google Maps',
    hoursLabel: 'Hours',
    checkinHoursText: (open, close) => `Check-in: from ${open} to ${close}`,
    checkoutHoursText: (close) => `Check-out: by ${close}`,
    instruction1: "Through the main gate, head to the building on the left. You'll find two French doors on the ground floor, as shown in the photo.",
    instruction2: 'The lockbox is in the recess next to the last wooden shutter on the right side of the façade (see the photo, circled in yellow).',
    instruction3: 'Parking inside the property is allowed only for loading and unloading luggage.',
    galleryTitle: 'Reference photos for access',
    photo1Caption: '1. Entrance to the property',
    photo2Caption: (multi, codes) => `2. Lockbox with ${multi ? 'codes' : 'code'} ${codes}`,
    photo2CaptionNoCode: '2. Lockbox',
    photo3Caption: (multi) => `3. Exact location of the ${multi ? 'lockboxes' : 'lockbox'}`,
    areaTitle: 'Your personal area',
    areaText: 'With your booking code (including the Booking.com or Airbnb one) you can open your personal area on our website: house information, Wi-Fi during your stay, things to do nearby and the Trentino Guest Card.',
    areaButton: 'Go to my personal area',
    contactText: (email, tel) => `If you need anything, email us at ${email} or call us on ${tel}.`,
    closingText: 'We wish you a pleasant and comfortable stay!',
    footerAutomated: (email) => `This is an automated email: please do not reply to this message. To contact us, write to ${email}.`,
    privacy: 'Privacy notice',
    subjectLine: (appartamento, data) => `Check-in completed · La Columbera${appartamento ? ' ' + appartamento : ''} · ${data}`,
    and: ' and ',
    genericName: 'Generic',
    fallbackDescrizione: 'Code not available, please contact the owner',
    corteDescrizione: 'Apartment with 1 bedroom',
    torreDescrizione: 'Apartment with 2 bedrooms'
  },
  de: {
    eyebrow: 'Check-in abgeschlossen',
    preheader: 'Ihr Code für die Sicherheitsbox, die Anfahrt und Fotos zum Eingang.',
    title: nome => [nome ? `Vielen Dank, ${nome}!` : 'Vielen Dank!', 'Wir freuen uns auf Sie'],
    thanksText: 'Vielen Dank für den Abschluss des Check-ins und die Zahlung der Kurtaxe. Wir freuen uns, Sie in unserer Unterkunft begrüßen zu dürfen!',
    codeTitleSingle: 'Code für die Sicherheitsbox',
    codeTitleMulti: 'Codes für die Sicherheitsboxen',
    codeNoteSingle: 'Bewahren Sie diesen Code sorgfältig auf',
    bothApartmentsNote: 'Sie haben beide Wohnungen gebucht',
    infoTitle: 'Details Ihrer Buchung',
    labelCheckin: 'Check-in-Datum',
    labelApartment: 'Wohnung',
    labelGuests: 'Gäste',
    labelNights: 'Nächte',
    labelTaxPaid: 'Bezahlte Kurtaxe',
    instructionsTitle: 'So gelangen Sie zur Unterkunft',
    addressPropertyLabel: 'Adresse der Unterkunft',
    addressParkingLabel: 'Adresse des Parkplatzes',
    mapsLink: 'In Google Maps öffnen',
    hoursLabel: 'Zeiten',
    checkinHoursText: (open, close) => `Check-in: von ${open} bis ${close}`,
    checkoutHoursText: (close) => `Check-out: bis ${close}`,
    instruction1: 'Gehen Sie durch das Haupttor zum Gebäude auf der linken Seite. Im Erdgeschoss finden Sie zwei Fenstertüren, wie auf dem Foto gezeigt.',
    instruction2: 'Die Box befindet sich in der Nische neben dem letzten Holzfensterladen auf der rechten Seite der Fassade (siehe gelb umkreistes Foto).',
    instruction3: 'Das Parken innerhalb des Grundstücks ist ausschließlich zum Be- und Entladen von Gepäck gestattet.',
    galleryTitle: 'Referenzfotos für den Zugang',
    photo1Caption: '1. Eingang zur Unterkunft',
    photo2Caption: (multi, codes) => `2. Sicherheitsbox mit ${multi ? 'Codes' : 'Code'} ${codes}`,
    photo2CaptionNoCode: '2. Sicherheitsbox',
    photo3Caption: (multi) => `3. Genaue Lage der ${multi ? 'Sicherheitsboxen' : 'Sicherheitsbox'}`,
    areaTitle: 'Ihr persönlicher Bereich',
    areaText: 'Mit Ihrer Buchungsnummer (auch der von Booking.com oder Airbnb) öffnen Sie Ihren persönlichen Bereich auf unserer Website: Informationen zum Haus, WLAN während Ihres Aufenthalts, Ausflugstipps und die Trentino Guest Card.',
    areaButton: 'Zu meinem persönlichen Bereich',
    contactText: (email, tel) => `Bei Fragen oder Anliegen schreiben Sie uns an ${email} oder rufen Sie uns an: ${tel}.`,
    closingText: 'Wir wünschen Ihnen einen angenehmen und komfortablen Aufenthalt!',
    footerAutomated: (email) => `Dies ist eine automatische E-Mail: Bitte antworten Sie nicht auf diese Nachricht. Schreiben Sie uns an ${email}.`,
    privacy: 'Datenschutzhinweis',
    subjectLine: (appartamento, data) => `Check-in abgeschlossen · La Columbera${appartamento ? ' ' + appartamento : ''} · ${data}`,
    and: ' und ',
    genericName: 'Allgemein',
    fallbackDescrizione: 'Code nicht verfügbar, bitte kontaktieren Sie den Eigentümer',
    corteDescrizione: 'Wohnung mit 1 Schlafzimmer',
    torreDescrizione: 'Wohnung mit 2 Schlafzimmern'
  }
};

function linguaValida(lingua) {
  return LINGUE_VALIDE.includes(lingua) ? lingua : 'it';
}

// Locale BCP47 per Intl/toLocaleDateString (data di arrivo, importo).
function localeEmail(lingua) {
  return { it: 'it-IT', en: 'en-GB', de: 'de-DE' }[lingua] || 'it-IT';
}

// Appartamenti del check-in, dal testo del modulo («La Columbera - Torre, …»): stesso criterio e stesso ordine di
// determinaCodiciCassetta (prima Corte, poi Torre). Il nome resta quello italiano; la descrizione è tradotta.
function appartamentiDi(valore, T) {
  const v = String(valore || '').toLowerCase(), l = [];
  if (v.includes('corte')) l.push({ nome: 'Corte', descrizione: T.corteDescrizione });
  if (v.includes('torre')) l.push({ nome: 'Torre', descrizione: T.torreDescrizione });
  return l;
}

// Data di arrivo: lunga nel testo (Giovedì 5 novembre 2026), corta nell'oggetto (5/11/2026). Le date arrivano come AAAA-MM-GG (mezzanotte UTC).
function dataArrivo(iso, L, lunga) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '');
  const s = d.toLocaleDateString(localeEmail(L), lunga ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { timeZone: 'UTC' });
  return lunga ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Oggetto: come le email del sito («Prenotazione confermata · La Columbera Torre · …»), senza ripetere il nome della struttura.
export function oggettoEmailOspite(dati, lingua) {
  const L = linguaValida(lingua), T = EMAIL_TESTI[L];
  return T.subjectLine(appartamentiDi(dati.appartamento, T).map(a => a.nome).join(T.and), dataArrivo(dati.dataCheckin, L, false));
}

// deps.creaTrasporto: trasporto email iniettabile nelle prove (come gli altri endpoint con makeHandler); in produzione Gmail.
export function makeHandler(deps = {}) {
  return async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://spaceestate.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Internal-Secret");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  // ✅ FIX SICUREZZA: questo endpoint viene chiamato solo da stripeWebhook.js
  // dopo un pagamento confermato. Senza questo controllo, chiunque conoscesse
  // l'URL poteva ottenere i codici reali delle cassette (Torre/Corte) nella
  // risposta JSON e farseli inviare via email con foto, senza aver pagato
  // né avere una prenotazione reale. Stesso criterio già usato per il GET
  // di salva-dati-temporanei.js.
  const secretAtteso = process.env.INTERNAL_API_SECRET;
  const secretRicevuto = req.headers['x-internal-secret'];

  if (!secretAtteso) {
    console.error('❌ INTERNAL_API_SECRET non configurato nelle variabili d\'ambiente');
    return res.status(500).json({ error: "Configurazione server incompleta" });
  }

  if (!chiaveUguale(secretRicevuto, secretAtteso)) {
    console.warn('⚠️ Tentativo di invio email senza secret valido, apartamento:', req.body?.datiPrenotazione?.appartamento);
    return res.status(401).json({ error: "Non autorizzato" });
  }

  console.log('📧 === INIZIO INVIO EMAIL OSPITE ===');

  try {
    const { emailOspite, datiPrenotazione } = req.body;

    if (!emailOspite || !datiPrenotazione) {
      return res.status(400).json({ 
        error: 'Email ospite e dati prenotazione sono obbligatori' 
      });
    }

    console.log('📬 Destinatario:', maskEmail(emailOspite));
    console.log('📊 Appartamento:', datiPrenotazione.appartamento);

    const lingua = linguaValida(datiPrenotazione.lingua);
    console.log('🌐 Lingua email ospite:', lingua);

    const codiciCassetta = determinaCodiciCassetta(datiPrenotazione.appartamento, lingua);
    console.log('🔑 Codici cassetta generati:', codiciCassetta.length);

    if (typeof datiPrenotazione.totale === 'string') {
      datiPrenotazione.totale = parseFloat(datiPrenotazione.totale);
    }

    const htmlContent = generaHTMLEmailOspite(datiPrenotazione, codiciCassetta, lingua);
    const testoContent = generaTestoEmailOspite(datiPrenotazione, codiciCassetta, lingua);

    const allegati = await caricaAllegatiFoto();
    console.log(`📎 Foto caricate: ${allegati.length}`);

    await inviaEmailConNodemailer(emailOspite, datiPrenotazione, htmlContent, allegati, lingua, deps.creaTrasporto, testoContent);

    console.log('✅ Email ospite inviata con successo');
    console.log('📧 === FINE INVIO EMAIL OSPITE ===');

    return res.status(200).json({
      success: true,
      message: 'Email inviata con successo',
      codiciCassetta: codiciCassetta.map(c => c.codice),
      emailDestinatario: emailOspite,
      numeroAllegati: allegati.length,
      warning: allegati.length === 0 ? 'Foto cassetta non trovate' : null
    });

  } catch (error) {
    console.error('❌ Errore invio email ospite:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      error: 'Errore invio email',
      message: error.message
    });
  }
  };
}

export default makeHandler();

// ✅ FIX: nomi file corretti (con prefisso numerico)
async function caricaAllegatiFoto() {
  const allegati = [];

  // Logo La Columbera (cid: logo_columbera), incorporato nell'header dell'email
  try {
    const logoPath = join(process.cwd(), 'public', 'img', 'brand', 'email-logo.png');
    const logoContent = await readFile(logoPath);
    allegati.push({
      filename: 'logo-la-columbera.png',
      content: logoContent,
      cid: 'logo_columbera',
      contentType: 'image/png'
    });
    console.log(`✅ Logo caricato (${(logoContent.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.warn(`⚠️ Impossibile caricare il logo: ${err.message}`);
  }

  try {
    const basePath = join(process.cwd(), 'public', 'images', 'cassetta');
    
    // ✅ NOMI FILE CORRETTI
    const files = [
      { name: '1_ingresso_proprieta.jpg',  cid: 'ingresso_proprieta' },
      { name: '2_cassetta_sicurezza.jpg',  cid: 'cassetta_sicurezza' },
      { name: '3_ubicazione_cassetta.jpg', cid: 'ubicazione_cassetta' }
    ];
    
    console.log('🔍 Directory foto:', basePath);
    
    // Log contenuto directory per debug
    try {
      const { readdir } = await import('fs/promises');
      const contenuto = await readdir(join(basePath, '..')).catch(() => []);
      console.log('📂 Contenuto images/:', contenuto);
      const contenutoCassetta = await readdir(basePath).catch(() => []);
      console.log('📂 Contenuto images/cassetta/:', contenutoCassetta);
    } catch (e) {
      console.warn('⚠️ Impossibile listare directory');
    }
    
    let fotoTrovate = 0;
    for (const file of files) {
      try {
        const filePath = join(basePath, file.name);
        console.log(`🔍 Caricamento: ${filePath}`);
        
        const content = await readFile(filePath);
        
        allegati.push({
          filename: file.name,
          content: content,
          cid: file.cid,
          contentType: 'image/jpeg'
        });
        fotoTrovate++;
        
        console.log(`✅ Foto caricata: ${file.name} (${(content.length / 1024).toFixed(1)} KB)`);
      } catch (err) {
        console.warn(`⚠️ Impossibile caricare ${file.name}: ${err.message}`);
      }
    }
    
    if (fotoTrovate === 0) {
      console.warn('⚠️ NESSUNA foto trovata - email inviata senza immagini');
    }
    
  } catch (error) {
    console.error('❌ Errore generale caricamento foto:', error.message);
  }
  
  return allegati;
}

// I valori arrivano da CODICE_CASSETTA_TORRE / CODICE_CASSETTA_CORTE (env var,
// solo server). Prima erano scritti qui in chiaro E duplicati anche nel
// frontend pubblico (checkin.js, successo-pagamento.html) — vedi anche
// api/get-session.js, che ora è l'unica altra copia di questa logica.
function determinaCodiciCassetta(appartamento, lingua) {
  const T = EMAIL_TESTI[linguaValida(lingua)];
  const generico = [{
    codice: null,
    nome: T.genericName,
    descrizione: T.fallbackDescrizione
  }];

  if (!appartamento) {
    console.warn('⚠️ Appartamento non specificato, uso codice generico');
    return generico;
  }

  const appartamentoLower = appartamento.toLowerCase();
  const codici = [];

  if (appartamentoLower.includes('corte')) {
    codici.push({
      codice: process.env.CODICE_CASSETTA_CORTE || null,
      nome: 'Corte',
      descrizione: T.corteDescrizione
    });
  }

  if (appartamentoLower.includes('torre')) {
    codici.push({
      codice: process.env.CODICE_CASSETTA_TORRE || null,
      nome: 'Torre',
      descrizione: T.torreDescrizione
    });
  }

  if (codici.length === 0) {
    console.warn('⚠️ Appartamento non riconosciuto:', appartamento);
    return generico;
  }

  return codici;
}

// ------------------------------------------------------------------
// Aspetto: lo stesso delle email del sito di La Columbera (api/_mail.js del progetto LaColumbera): stessi colori e caratteri,
// testata bordeaux con il logo, riga oro, riepilogo a righe, pulsante bordeaux, piè di pagina scuro con i recapiti.
// Solo tabelle e stili scritti dentro ogni elemento (niente blocco <style>, sfumature, ombre o flex): è il modo per vederla
// uguale in Gmail, Outlook e Apple Mail. Le immagini sono gli allegati di sempre (cid:), quindi si vedono anche senza internet.
// ------------------------------------------------------------------
const C = { wine: '#7A2E39', wine2: '#5F222B', wine3: '#3A151B', ink: '#1E1917', muted: '#6C5F55', paper: '#FAF5EC', paper2: '#F1E9D9', line: '#DCCFB6', gold: '#B08D3C', white: '#FFFDF7' };
const SERIF = "Georgia,'Times New Roman',serif", SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif", MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euro = (v, L) => '€ ' + (Number(v) || 0).toLocaleString(localeEmail(L), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nomeOspite = dati => String((dati && Array.isArray(dati.ospiti) && dati.ospiti[0] && dati.ospiti[0].nome) || '').trim();
const totaleDi = dati => (typeof dati.totale === 'string' ? parseFloat(dati.totale) : (dati.totale || 0)) || 0;
const INDIRIZZI = T => [
  { etichetta: T.addressPropertyLabel, righe: ['Via Centrale, 48', '38123 Trento (TN)'], link: MAPS_STRUTTURA },
  { etichetta: T.addressParkingLabel, righe: ['Via Val Gola, 22', '38123 Trento (TN)'], link: MAPS_PARCHEGGIO }
];
const didascaliaCassetta = (codiciCassetta, T) => {
  const noti = codiciCassetta.map(c => c.codice).filter(Boolean);
  return noti.length ? T.photo2Caption(codiciCassetta.length > 1, noti.join(' / ')) : T.photo2CaptionNoCode;
};

function generaHTMLEmailOspite(dati, codiciCassetta, lingua) {
  const L = linguaValida(lingua), T = EMAIL_TESTI[L];
  const multi = codiciCassetta.length > 1, apts = appartamentiDi(dati.appartamento, T);
  const sec = (inner, pad) => `<tr><td style="padding:${pad || '22px 32px 0'}">${inner}</td></tr>`;
  const etichetta = (t, centro) => `<div style="font-family:${SANS};font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:${C.muted};font-weight:700;padding-bottom:12px${centro ? ';text-align:center' : ''}">${esc(t)}</div>`;
  const testo = (html, extra) => `<p style="margin:0;font-family:${SANS};font-size:15px;line-height:24px;color:${C.ink}${extra || ''}">${html}</p>`;
  const riga = (k, v, ultima) => `<tr><td valign="top" style="padding:13px 12px 13px 0;${ultima ? '' : `border-bottom:1px solid ${C.line};`}font-family:${SANS};font-size:14px;color:${C.muted}">${esc(k)}</td><td align="right" style="padding:13px 0;${ultima ? '' : `border-bottom:1px solid ${C.line};`}font-family:${SANS};font-size:15px;font-weight:700;color:${C.ink}">${v}</td></tr>`;
  const pulsante = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center" bgcolor="${C.wine}" style="border-radius:999px"><a href="${esc(href)}" target="_blank" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:15px;font-weight:700;letter-spacing:.3px;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
  const riquadro = inner => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};border-radius:12px"><tr><td style="padding:22px 22px">${inner}</td></tr></table>`;

  // Codice (o codici) della cassetta: stesso contenuto di prima (determinaCodiciCassetta), nello stile del codice di prenotazione del sito.
  // Se un codice non è configurato si legge il messaggio «Codice non disponibile…» (prima compariva la parola «null»).
  const boxCodice = c => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};border:1px dashed ${C.gold};border-radius:10px"><tr><td align="center" style="padding:18px 16px">`
    + (multi || (c.nome && c.nome !== T.genericName) ? `<div style="font-family:${SERIF};font-size:18px;line-height:24px;color:${C.ink}">${esc(c.nome)}</div>` : '')
    + (c.codice
      ? `<div style="font-family:${MONO};font-size:34px;line-height:44px;font-weight:700;letter-spacing:8px;color:${C.wine};padding:6px 0 0 8px">${esc(c.codice)}</div>`
      : `<div style="font-family:${SANS};font-size:14px;line-height:21px;color:${C.wine};font-weight:700;padding-top:6px">${esc(T.fallbackDescrizione)}</div>`)
    + (multi && c.codice ? `<div style="font-family:${SANS};font-size:12px;color:${C.muted};padding-top:4px">${esc(c.descrizione)}</div>` : '')
    + `</td></tr></table>`;
  const codici = etichetta(multi ? T.codeTitleMulti : T.codeTitleSingle, true)
    + (multi ? `<p style="margin:0 0 12px;font-family:${SANS};font-size:13px;color:${C.muted};text-align:center">${esc(T.bothApartmentsNote)}</p>` : '')
    + codiciCassetta.map(boxCodice).join('<div style="height:10px;line-height:10px;font-size:0">&nbsp;</div>')
    + (multi ? '' : `<p style="margin:10px 0 0;font-family:${SANS};font-size:12px;color:${C.muted};text-align:center">${esc(T.codeNoteSingle)}</p>`);

  const aptHtml = apts.length
    ? apts.map(a => `${esc(a.nome)}<div style="font-weight:400;font-size:12px;line-height:17px;color:${C.muted}">${esc(a.descrizione)}</div>`).join('<div style="height:6px;line-height:6px;font-size:0">&nbsp;</div>')
    : esc(dati.appartamento || 'N/A');
  const riepilogo = etichetta(T.infoTitle) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`
    + riga(T.labelCheckin, esc(dataArrivo(dati.dataCheckin, L, true)))
    + riga(T.labelApartment, aptHtml)
    + riga(T.labelGuests, esc(dati.numeroOspiti || 0))
    + riga(T.labelNights, esc(dati.numeroNotti || 0))
    + `<tr><td style="padding:16px 12px 0 0;font-family:${SANS};font-size:14px;color:${C.muted};vertical-align:middle">${esc(T.labelTaxPaid)}</td><td align="right" style="padding:16px 0 0;font-family:${SERIF};font-size:26px;line-height:32px;color:${C.wine};white-space:nowrap">${esc(euro(totaleDi(dati), L))}</td></tr></table>`;

  const indirizzo = i => `<div style="padding-bottom:16px"><div style="font-family:${SANS};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};font-weight:700;padding-bottom:4px">${esc(i.etichetta)}</div>`
    + `<a href="${esc(i.link)}" target="_blank" style="font-family:${SANS};font-size:15px;line-height:22px;color:${C.ink};text-decoration:none">${i.righe.map(esc).join('<br>')}</a>`
    + `<div style="padding-top:4px"><a href="${esc(i.link)}" target="_blank" style="font-family:${SANS};font-size:13px;font-weight:700;color:${C.wine};text-decoration:underline">${esc(T.mapsLink)} &#8599;</a></div></div>`;
  const punto = t => `<tr><td valign="top" width="18" style="font-family:${SANS};font-size:14px;line-height:22px;color:${C.gold};padding:0 0 10px">&#8226;</td><td style="font-family:${SANS};font-size:14px;line-height:22px;color:${C.ink};padding:0 0 10px">${esc(t)}</td></tr>`;
  const accesso = riquadro(`<div style="font-family:${SERIF};font-size:20px;line-height:26px;color:${C.ink};padding-bottom:16px">${esc(T.instructionsTitle)}</div>`
    + INDIRIZZI(T).map(indirizzo).join('')
    + `<div style="padding-bottom:16px"><div style="font-family:${SANS};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};font-weight:700;padding-bottom:4px">${esc(T.hoursLabel)}</div>`
    + `<div style="font-family:${SANS};font-size:15px;line-height:22px;color:${C.ink}">${esc(T.checkinHoursText(CHECKIN_OPEN_TIME, CHECKIN_CLOSE_TIME))}<br>${esc(T.checkoutHoursText(CHECKOUT_CLOSE_TIME))}</div></div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${punto(T.instruction1)}${punto(T.instruction2)}${punto(T.instruction3)}</table>`);

  const foto = (cid, didascalia) => `<img src="cid:${cid}" width="536" alt="${esc(didascalia)}" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:10px">`
    + `<p style="margin:8px 0 22px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.muted};font-style:italic;text-align:center">${esc(didascalia)}</p>`;
  const galleria = etichetta(T.galleryTitle, true)
    + foto('ingresso_proprieta', T.photo1Caption) + foto('cassetta_sicurezza', didascaliaCassetta(codiciCassetta, T)) + foto('ubicazione_cassetta', T.photo3Caption(multi));

  const area = riquadro(`<div style="font-family:${SERIF};font-size:20px;line-height:26px;color:${C.ink};padding-bottom:8px">${esc(T.areaTitle)}</div>`
    + `<p style="margin:0 0 18px;font-family:${SANS};font-size:14px;line-height:22px;color:${C.muted}">${esc(T.areaText)}</p>` + pulsante(SITO + '/area-clienti.html', T.areaButton));

  const mail = `<a href="mailto:${CONTATTI.email}" style="color:${C.wine}">${CONTATTI.email}</a>`, tel = `<a href="${CONTATTI.telLink}" style="color:${C.wine};white-space:nowrap">${esc(CONTATTI.tel)}</a>`;
  const chiusura = `<p style="margin:0;font-family:${SANS};font-size:14px;line-height:22px;color:${C.muted};text-align:center">${T.contactText(mail, tel)}<br>${esc(T.closingText)}</p>`;
  const [titolo1, titolo2] = T.title(nomeOspite(dati));

  return `<!doctype html>
<html lang="${L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(T.eyebrow)}</title></head>
<body style="margin:0;padding:0;background:${C.paper2};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(T.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper2}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.white};border-radius:14px;overflow:hidden;border:1px solid ${C.line}">
<tr><td align="center" bgcolor="${C.wine2}" style="background:${C.wine2};padding:22px 24px 18px">
<a href="${SITO}" target="_blank" style="text-decoration:none"><img src="cid:logo_columbera" width="240" alt="La Columbera" style="display:block;width:240px;max-width:100%;height:auto;border:0;color:#F1E9D9;font-family:${SERIF};font-size:24px"></a></td></tr>
<tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${C.gold}">&nbsp;</td></tr>
<tr><td style="padding:34px 32px 8px" align="center">
<div style="font-family:${SANS};font-size:11px;letter-spacing:2.6px;text-transform:uppercase;color:${C.gold};font-weight:700">${esc(T.eyebrow)}</div>
<h1 style="margin:10px 0 0;font-family:${SERIF};font-weight:400;font-size:29px;line-height:36px;color:${C.ink}">${esc(titolo1)}<br>${esc(titolo2)}</h1></td></tr>
${sec(testo(esc(T.thanksText), ';text-align:center'), '14px 32px 0')}
${sec(codici, '26px 32px 0')}
${sec(riepilogo, '30px 32px 0')}
${sec(accesso, '30px 32px 0')}
${sec(galleria, '30px 32px 0')}
${sec(area, '8px 32px 0')}
${sec(chiusura, '26px 32px 30px')}
<tr><td bgcolor="${C.wine3}" style="background:${C.wine3};padding:24px 32px" align="center">
<div style="font-family:${SERIF};font-size:16px;color:#F1E9D9">La Columbera</div>
<div style="font-family:${SANS};font-size:12px;line-height:19px;color:#CDBFAE;padding-top:6px">Dimora storica del XV secolo · Ravina, Trento<br><a href="${CONTATTI.telLink}" style="color:#CDBFAE;text-decoration:none">${esc(CONTATTI.tel)}</a> · <a href="mailto:${CONTATTI.email}" style="color:#CDBFAE;text-decoration:none">${CONTATTI.email}</a></div>
<div style="font-family:${SANS};font-size:11px;line-height:17px;color:#A8988A;padding-top:12px">${esc(T.footerAutomated(CONTATTI.email))}<br><a href="${SITO}/privacy.html" target="_blank" style="color:#A8988A">${esc(T.privacy)}</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

// Versione di solo testo (programmi di posta senza HTML, anteprime, filtri antispam): stesse informazioni, link scritti per esteso.
function generaTestoEmailOspite(dati, codiciCassetta, lingua) {
  const L = linguaValida(lingua), T = EMAIL_TESTI[L], multi = codiciCassetta.length > 1, apts = appartamentiDi(dati.appartamento, T);
  const [titolo1, titolo2] = T.title(nomeOspite(dati));
  const codici = codiciCassetta.map(c => (multi || (c.nome && c.nome !== T.genericName) ? c.nome + ': ' : '') + (c.codice || T.fallbackDescrizione));
  return [
    titolo1 + ' ' + titolo2 + '.', T.thanksText, '',
    (multi ? T.codeTitleMulti : T.codeTitleSingle).toUpperCase() + ': ' + codici.join(' · '), multi ? T.bothApartmentsNote : T.codeNoteSingle, '',
    T.infoTitle.toUpperCase(),
    T.labelCheckin + ': ' + dataArrivo(dati.dataCheckin, L, true),
    T.labelApartment + ': ' + (apts.length ? apts.map(a => a.nome + ' (' + a.descrizione + ')').join(T.and) : (dati.appartamento || 'N/A')),
    T.labelGuests + ': ' + (dati.numeroOspiti || 0),
    T.labelNights + ': ' + (dati.numeroNotti || 0),
    T.labelTaxPaid + ': ' + euro(totaleDi(dati), L), '',
    T.instructionsTitle.toUpperCase(),
    ...INDIRIZZI(T).map(i => i.etichetta + ': ' + i.righe.join(', ') + ' — ' + i.link),
    T.hoursLabel + ': ' + T.checkinHoursText(CHECKIN_OPEN_TIME, CHECKIN_CLOSE_TIME) + ' · ' + T.checkoutHoursText(CHECKOUT_CLOSE_TIME),
    '- ' + T.instruction1, '- ' + T.instruction2, '- ' + T.instruction3, '',
    T.areaTitle.toUpperCase(), T.areaText, SITO + '/area-clienti.html', '',
    T.contactText(CONTATTI.email, CONTATTI.tel), T.closingText, '',
    T.footerAutomated(CONTATTI.email),
    'La Columbera · Dimora storica del XV secolo · Ravina, Trento',
    T.privacy + ': ' + SITO + '/privacy.html'
  ].join('\n');
}

async function inviaEmailConNodemailer(emailDestinatario, dati, htmlContent, allegati, lingua, creaTrasporto, testoContent) {
  const transporter = creaTrasporto ? creaTrasporto() : nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  const oggetto = oggettoEmailOspite(dati, lingua);

  const mailOptions = {
    from: '"La Columbera" <' + process.env.EMAIL_USER + '>',
    to: emailDestinatario,
    subject: oggetto,
    html: htmlContent,
    text: testoContent,
    attachments: allegati.length > 0 ? allegati : undefined
  };

  await transporter.sendMail(mailOptions);
  console.log(`✅ Email inviata a ${maskEmail(emailDestinatario)}${allegati.length > 0 ? ' con ' + allegati.length + ' foto allegate' : ' senza foto'}`);
}
