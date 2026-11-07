// fotocamera.js — fotocamera del telefono a tutto schermo, con il riquadro in cui mettere il documento (carta d'identità, patente,
// pagina del passaporto). Si usa per le foto del documento del responsabile (checkin.js, openCamera) e, con la scansione accesa, per
// le foto degli altri ospiti (scansione/scansione-documento.js). Su un computer non si apre: lì si carica un file.
//
// Lo scatto è ritagliato sul riquadro (con un po' di margine): il documento riempie la foto, quindi le scritte piccole (luogo di
// nascita, numero) restano leggibili. La fotocamera di sistema non permette di disegnare un riquadro: per questo si apre dentro la
// pagina. Se il browser non dà la fotocamera (permesso negato, browser vecchio) chi chiama usa il campo file con la fotocamera di
// sistema, come prima.
//
// Abbastanza pixel sul documento (06/11/2026: con il fotogramma di un video a 720p o 1080p la carta era larga 500-800 px e si
// perdevano luogo di nascita, numero e tipo):
//  - si chiede la risoluzione più alta che la fotocamera dà (fino al 4K);
//  - zoom 2x dove il browser lo offre (Safari recenti): il telefono si tiene a circa 30 cm, dove mette a fuoco anche quando la
//    fotocamera principale non mette a fuoco da vicino (iPhone Pro), e la carta prende più pixel del sensore;
//  - allo scatto si esaminano alcuni fotogrammi e si tiene il più nitido (toccando il pulsante il telefono si muove);
//  - dove c'è lo scatto vero (ImageCapture.takePhoto, per esempio Chrome su Android) e dà più pixel del video, si usa quello.
//
// Nessuna archiviazione: lo scatto resta in una tela in memoria, consegnata a chi ha aperto la fotocamera; lo stream si ferma alla
// chiusura.
(function () {
  'use strict';

  const RAPPORTO = 85.6 / 54;      // carta formato ID-1 (CIE, patente, permessi); la pagina del passaporto ci sta con il margine
  const MARGINE = 0.08;            // quanto si prende oltre il riquadro, per lato (il documento non va tagliato)
  const MARGINE_FOTO = 0.12;       // in più sullo scatto vero: il campo inquadrato può essere un po' diverso da quello del video
  const ZOOM = 2;                  // zoom chiesto, se il browser lo offre
  const FOTOGRAMMI = 5;            // fotogrammi esaminati allo scatto (uno ogni due): si tiene il più nitido
  const ATTESA_SCATTO = 120;       // ms dopo il tocco prima del primo fotogramma
  const tr = (k, ripiego) => { try { const x = typeof t === 'function' ? t(k) : ''; return x && x !== k ? x : ripiego; } catch (e) { return ripiego; } };
  const mobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));      // iPad con iPadOS si presenta come Mac
  const attendi = ms => new Promise(ok => setTimeout(ok, ms));
  const conLimite = (promessa, ms) => Promise.race([promessa, new Promise((_, no) => setTimeout(() => no(new Error('tempo')), ms))]);

  let aperta = null;
  // Tasto «indietro» (07/11/2026, prova su Android: con la fotocamera aperta faceva uscire dal check-in e i dati scritti si perdevano).
  // Aprendo la fotocamera si aggiunge una voce alla cronologia della pagina, con lo stesso indirizzo: «indietro» toglie quella voce e
  // chiude solo la fotocamera. Chiusa con la ✕ o per un errore, la voce si toglie da qui. Dopo uno scatto la voce resta alla fotocamera
  // che si apre subito dopo (il retro dopo il fronte) e si toglie se non se ne apre un'altra: così ogni voce nasce dal tocco su
  // «Fotografa» (Chrome può saltare con «indietro» le pagine che aggiungono voci senza un tocco). Vale anche per lo scorrimento
  // indietro di Safari sull'iPhone.
  // Tornando alla voce del check-in il browser rimetterebbe lo scorrimento che la pagina aveva all'apertura della fotocamera: dopo
  // l'ultimo scatto, se l'ospite l'ha già fatta scorrere, la pagina salterebbe. Finché c'è la voce della fotocamera lo scorrimento non si
  // rimette (scrollRestoration «manual»); tornati al check-in si rimette il modo di prima.
  let voceStoria = false;                 // la voce attuale della cronologia è quella della fotocamera
  let modoScorrimento = null;             // history.scrollRestoration del check-in prima della voce
  window.addEventListener('popstate', () => {
    voceStoria = !!(history.state && history.state.fotocameraDocumento);
    if (!voceStoria && modoScorrimento) setTimeout(rimettiModo, 0);        // dopo che il browser ha deciso lo scorrimento
    const stato = aperta;
    if (!voceStoria && stato) { chiudi({ cronologia: false }); if (stato.o.onChiusa) stato.o.onChiusa(); }
  });
  function aggiungiVoce() {
    try {
      if ('scrollRestoration' in history && !modoScorrimento) { modoScorrimento = history.scrollRestoration; history.scrollRestoration = 'manual'; }
      history.pushState({ fotocameraDocumento: true }, '');      // la voce nuova ha il modo della voce del check-in
      voceStoria = true;
    } catch (e) { rimettiModo(); }
  }
  function rimettiModo() {
    if (voceStoria || !modoScorrimento) return;
    try { history.scrollRestoration = modoScorrimento; } catch (e) { /* resta com'è */ }
    modoScorrimento = null;
  }
  function togliVoce() {
    if (!voceStoria) return;
    voceStoria = false;
    try { history.back(); } catch (e) { /* senza cronologia */ }
  }

  function disponibile() {
    return mobile() && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;
  }

  // Apre la fotocamera. opzioni: { titolo, onFoto(tela) (la tela va azzerata da chi la riceve), onChiusa(), onErrore(err) }
  async function apri(opzioni) {
    const o = opzioni || {};
    if (aperta) chiudi({ cronologia: false });          // un'altra fotocamera al posto di questa: stessa voce della cronologia
    if (!voceStoria) aggiungiVoce();
    const vista = document.createElement('div');
    vista.className = 'fotocamera';
    vista.setAttribute('role', 'dialog');
    vista.setAttribute('aria-modal', 'true');
    vista.setAttribute('aria-label', o.titolo || tr('foto.titolo', 'Fotografa il documento'));
    vista.innerHTML = `
      <video class="fotocamera-video" playsinline autoplay muted></video>
      <div class="fotocamera-maschera" aria-hidden="true"><div class="fotocamera-riquadro"><i></i><i></i><i></i><i></i></div></div>
      <p class="fotocamera-titolo"></p>
      <button type="button" class="fotocamera-chiudi" aria-label=""></button>
      <button type="button" class="fotocamera-scatta" aria-label=""><span></span></button>`;
    vista.querySelector('.fotocamera-titolo').textContent = o.titolo || tr('foto.inquadra', 'Metti il documento nel riquadro');
    vista.querySelector('.fotocamera-chiudi').setAttribute('aria-label', tr('guest.chiudi', 'Chiudi'));
    vista.querySelector('.fotocamera-chiudi').textContent = '✕';
    vista.querySelector('.fotocamera-scatta').setAttribute('aria-label', tr('guest.scatta', 'Scatta'));
    document.body.appendChild(vista);
    document.documentElement.classList.add('fotocamera-aperta');
    const video = vista.querySelector('video');
    const stato = { vista, video, stream: null, traccia: null, o };
    aperta = stato;
    vista.querySelector('.fotocamera-chiudi').addEventListener('click', () => { chiudi(); if (o.onChiusa) o.onChiusa(); });
    vista.querySelector('.fotocamera-scatta').addEventListener('click', () => { scatta(stato); });
    const esc = e => { if (e.key === 'Escape' && aperta === stato) { chiudi(); if (o.onChiusa) o.onChiusa(); } };
    document.addEventListener('keydown', esc);
    stato.togliEsc = () => document.removeEventListener('keydown', esc);
    try {
      // la risoluzione più alta che c'è (le scritte piccole del documento), fotocamera posteriore
      const vincoli = { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } } };
      try { stato.stream = await navigator.mediaDevices.getUserMedia(vincoli); }
      catch (e) { stato.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } }); }
      if (aperta !== stato) { ferma(stato); return; }
      video.srcObject = stato.stream;
      stato.traccia = stato.stream.getVideoTracks()[0] || null;
      if (stato.traccia) await regola(stato.traccia);
      try { await video.play(); } catch (e) { /* autoplay: riparte al primo tocco */ }
    } catch (err) {
      chiudi();
      if (o.onErrore) o.onErrore(err);
    }
  }

  // Messa a fuoco continua (Android; su iPhone è già automatica) e zoom, dove il browser li offre. Se no, niente.
  async function regola(traccia) {
    let c = {};
    try { c = (traccia.getCapabilities && traccia.getCapabilities()) || {}; } catch (e) { c = {}; }
    if (Array.isArray(c.focusMode) && c.focusMode.includes('continuous')) {
      try { await traccia.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) { /* non importa */ }
    }
    const z = valoreZoom(c.zoom);
    if (z != null) { try { await traccia.applyConstraints({ advanced: [{ zoom: z }] }); } catch (e) { /* non importa */ } }
  }

  // Zoom da chiedere: ZOOM, dentro i limiti dichiarati dal browser (un valore fuori dai limiti poteva bloccare Safari 17.4) e sul suo
  // passo. Niente zoom se il browser non lo offre, se arriva a meno di 1,5x o se lo esprime in un'altra scala (minimo oltre ZOOM).
  function valoreZoom(r) {
    if (!r || !isFinite(r.min) || !isFinite(r.max) || r.max < 1.5 || r.min > ZOOM) return null;
    let z = Math.min(r.max, ZOOM);
    if (r.step > 0) z = r.min + Math.round((z - r.min) / r.step) * r.step;
    return Math.max(r.min, Math.min(r.max, z));
  }

  // Zona del fotogramma (pixel del video) sotto il riquadro dello schermo, più il margine. Il video riempie lo schermo
  // (object-fit: cover): da coordinate dello schermo a pixel del fotogramma.
  function regioneRiquadro(stato) {
    const v = stato.video;
    const riq = stato.vista.querySelector('.fotocamera-riquadro').getBoundingClientRect(), vr = v.getBoundingClientRect();
    const k = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight);
    const ox = (vr.width - v.videoWidth * k) / 2 + vr.left, oy = (vr.height - v.videoHeight * k) / 2 + vr.top;
    const mx = riq.width * MARGINE, my = riq.height * MARGINE;
    const x0 = Math.max(0, (riq.left - mx - ox) / k), y0 = Math.max(0, (riq.top - my - oy) / k);
    const x1 = Math.min(v.videoWidth, (riq.right + mx - ox) / k), y1 = Math.min(v.videoHeight, (riq.bottom + my - oy) / k);
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  // Nitidezza: energia delle differenze tra pixel vicini (più è alta, meno la foto è mossa o sfocata).
  function nitidezza(dati) {
    const d = dati.data, w = dati.width, h = dati.height;
    let somma = 0;
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const a = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const dx = d[i + 4] * 0.299 + d[i + 5] * 0.587 + d[i + 6] * 0.114 - a;
        const j = i + w * 4;
        const dy = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114 - a;
        somma += dx * dx + dy * dy;
      }
    }
    return somma / Math.max(1, (w - 1) * (h - 1));
  }

  const prossimoFotogramma = v => new Promise(ok => {
    let fatto = false;
    const fine = () => { if (!fatto) { fatto = true; ok(); } };
    if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(fine);
    setTimeout(fine, 80);
  });

  // Il fotogramma più nitido tra FOTOGRAMMI, ritagliato sulla zona del riquadro alla risoluzione del video.
  async function fotogrammaMigliore(stato, reg) {
    const v = stato.video;
    const fp = Math.min(1, 640 / reg.w);
    const prova = document.createElement('canvas');
    prova.width = Math.max(1, Math.round(reg.w * fp)); prova.height = Math.max(1, Math.round(reg.h * fp));
    const gp = prova.getContext('2d', { willReadFrequently: true });
    const migliore = document.createElement('canvas');
    migliore.width = Math.max(1, Math.round(reg.w)); migliore.height = Math.max(1, Math.round(reg.h));
    const gm = migliore.getContext('2d');
    let punteggio = -1;
    try {
      await attendi(ATTESA_SCATTO);
      for (let i = 0; i < FOTOGRAMMI && aperta === stato; i++) {
        if (i) { await prossimoFotogramma(v); await prossimoFotogramma(v); }
        if (aperta !== stato) break;
        gp.drawImage(v, reg.x, reg.y, reg.w, reg.h, 0, 0, prova.width, prova.height);
        const dati = gp.getImageData(0, 0, prova.width, prova.height);
        const n = nitidezza(dati);
        dati.data.fill(0);
        if (n > punteggio) { punteggio = n; gm.drawImage(v, reg.x, reg.y, reg.w, reg.h, 0, 0, migliore.width, migliore.height); }
      }
    } finally {
      prova.width = 0; prova.height = 0;
    }
    if (punteggio < 0) { migliore.width = 0; migliore.height = 0; return null; }
    return migliore;
  }

  // Zona dello scatto vero che corrisponde alla zona del video: stesso centro, e il lato lungo dei due copre lo stesso campo (il video
  // è il sensore ritagliato in 16:9, la foto il sensore intero); in più MARGINE_FOTO per le differenze (stabilizzazione del video).
  function mappaRegione(reg, vw, vh, pw, ph) {
    const s = Math.max(pw, ph) / Math.max(vw, vh);
    const mx = reg.w * MARGINE_FOTO, my = reg.h * MARGINE_FOTO;
    const x0 = Math.max(0, (reg.x - mx - vw / 2) * s + pw / 2), y0 = Math.max(0, (reg.y - my - vh / 2) * s + ph / 2);
    const x1 = Math.min(pw, (reg.x + reg.w + mx - vw / 2) * s + pw / 2), y1 = Math.min(ph, (reg.y + reg.h + my - vh / 2) * s + ph / 2);
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), scala: s };
  }

  // Scatto vero della fotocamera, se il browser lo permette e ha più pixel del video; se no (o se qualcosa non torna) null.
  async function scattoVero(stato, reg) {
    if (typeof ImageCapture !== 'function' || !stato.traccia || stato.traccia.readyState !== 'live') return null;
    let ic;
    try { ic = new ImageCapture(stato.traccia); } catch (e) { return null; }
    if (typeof ic.takePhoto !== 'function') return null;
    const lungoVideo = Math.max(stato.video.videoWidth, stato.video.videoHeight);
    const impostazioni = {};
    try {
      const c = await conLimite(ic.getPhotoCapabilities(), 1500);
      if (c && Array.isArray(c.fillLightMode) && c.fillLightMode.includes('off')) impostazioni.fillLightMode = 'off';   // niente flash: riflessi
      const lungoFoto = c && c.imageWidth && c.imageHeight ? Math.max(c.imageWidth.max || 0, c.imageHeight.max || 0) : 0;
      if (lungoFoto && lungoFoto < 1.25 * lungoVideo) return null;
    } catch (e) { /* senza le capacità si prova lo stesso */ }
    let bm = null;
    try {
      const blob = await conLimite(ic.takePhoto(impostazioni), 3500);
      if (!blob || aperta !== stato) return null;
      bm = await createImageBitmap(blob);
      const vw = stato.video.videoWidth, vh = stato.video.videoHeight;
      if ((bm.width >= bm.height) !== (vw >= vh)) return null;       // orientata diversamente dal video: non si sa da che parte girarla
      const m = mappaRegione(reg, vw, vh, bm.width, bm.height);
      if (m.scala < 1.25) return null;
      const tela = document.createElement('canvas');
      tela.width = Math.max(1, Math.round(m.w)); tela.height = Math.max(1, Math.round(m.h));
      tela.getContext('2d').drawImage(bm, m.x, m.y, m.w, m.h, 0, 0, tela.width, tela.height);
      return tela;
    } catch (e) {
      return null;
    } finally {
      if (bm && bm.close) bm.close();
    }
  }

  async function scatta(stato) {
    const v = stato.video;
    if (stato.scattando || !v.videoWidth || !v.videoHeight) return;
    stato.scattando = true;
    stato.vista.classList.add('fotocamera-scatto');        // il riquadro si colora: tenere fermo
    let tela = null;
    try {
      const reg = regioneRiquadro(stato);
      tela = await fotogrammaMigliore(stato, reg);
      if (aperta === stato) {
        const vera = await scattoVero(stato, reg);
        if (vera) { if (tela) { tela.width = 0; tela.height = 0; } tela = vera; }
      }
    } catch (e) { /* si usa quello che c'è */ }
    if (aperta !== stato) { if (tela) { tela.width = 0; tela.height = 0; } return; }      // chiusa nel frattempo
    const o = stato.o;
    chiudi({ cronologia: false });              // la voce resta alla fotocamera che può seguire (il retro dopo il fronte)
    let fatto = null;
    if (tela && o.onFoto) fatto = o.onFoto(tela);
    else if (!tela && o.onErrore) o.onErrore(new Error('scatto'));
    // chi riceve la foto apre l'eventuale fotocamera seguente mentre la elabora (checkin.js: mezzo secondo dopo il file pronto); se un
    // secondo dopo la fine non se n'è aperta un'altra, la voce si toglie (chi elabora a lungo, come la lettura, si aspetta al più 5 s)
    Promise.race([Promise.resolve(fatto).catch(() => null), attendi(5000)])
      .then(() => setTimeout(() => { if (!aperta) togliVoce(); }, 1000));
  }

  function ferma(stato) {
    if (stato && stato.stream) { stato.stream.getTracks().forEach(tr => tr.stop()); stato.stream = null; }
  }

  // { cronologia: false }: la voce della cronologia non si tocca (un'altra fotocamera al posto di questa, scatto, «indietro» che l'ha già
  // tolta, pagina che si chiude); senza, la si toglie (✕, Esc, errore)
  function chiudi(opz) {
    const stato = aperta;
    if (!stato) return;
    aperta = null;
    if (!(opz && opz.cronologia === false)) togliVoce();
    ferma(stato);
    if (stato.togliEsc) stato.togliEsc();
    try { stato.video.srcObject = null; } catch (e) { /* già chiuso */ }
    stato.vista.remove();
    document.documentElement.classList.remove('fotocamera-aperta');
  }

  // Tela → file JPEG (per il documento del responsabile, che va al gestore come prima). Lato lungo al più `lato` pixel.
  function inFile(tela, nome, lato) {
    return new Promise(ok => {
      const f = Math.min(1, (lato || 1600) / Math.max(tela.width, tela.height));
      let t2 = tela;
      if (f < 1) { t2 = document.createElement('canvas'); t2.width = Math.round(tela.width * f); t2.height = Math.round(tela.height * f); t2.getContext('2d').drawImage(tela, 0, 0, t2.width, t2.height); }
      t2.toBlob(b => {
        if (t2 !== tela) { t2.width = 0; t2.height = 0; }
        ok(b ? new File([b], nome, { type: 'image/jpeg' }) : null);
      }, 'image/jpeg', 0.9);
    });
  }

  // _zoom, _mappa e _nitidezza: funzioni pure, esposte per le prove (tests/scansione.test.mjs)
  window.FotocameraDocumento = { disponibile, apri, chiudi, inFile, RAPPORTO, _zoom: valoreZoom, _mappa: mappaRegione, _nitidezza: nitidezza };
  window.addEventListener('pagehide', () => chiudi({ cronologia: false }));
})();
