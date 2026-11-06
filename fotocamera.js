// fotocamera.js — fotocamera del telefono a tutto schermo, con il riquadro in cui mettere il documento (carta d'identità, patente,
// pagina del passaporto). Si usa per le foto del documento del responsabile (checkin.js, openCamera) e, con la scansione accesa, per
// le foto degli altri ospiti (scansione/scansione-documento.js). Su un computer non si apre: lì si carica un file.
//
// Lo scatto è il fotogramma della fotocamera ritagliato sul riquadro (con un po' di margine): il documento riempie la foto, quindi
// le scritte piccole (luogo di nascita, numero) restano leggibili anche senza una foto enorme. La fotocamera di sistema non permette
// di disegnare un riquadro: per questo si apre dentro la pagina. Se il browser non dà la fotocamera (permesso negato, browser
// vecchio) chi chiama usa il campo file con la fotocamera di sistema, come prima.
//
// Nessuna archiviazione: il fotogramma resta in una tela in memoria, consegnata a chi ha aperto la fotocamera; lo stream si ferma
// alla chiusura.
(function () {
  'use strict';

  const RAPPORTO = 85.6 / 54;      // carta formato ID-1 (CIE, patente, permessi); la pagina del passaporto ci sta con il margine
  const MARGINE = 0.08;            // quanto si prende oltre il riquadro, per lato (il documento non va tagliato)
  const tr = (k, ripiego) => { try { const x = typeof t === 'function' ? t(k) : ''; return x && x !== k ? x : ripiego; } catch (e) { return ripiego; } };
  const mobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));      // iPad con iPadOS si presenta come Mac

  let aperta = null;

  function disponibile() {
    return mobile() && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;
  }

  // Apre la fotocamera. opzioni: { titolo, onFoto(tela) (la tela va azzerata da chi la riceve), onChiusa(), onErrore(err) }
  async function apri(opzioni) {
    const o = opzioni || {};
    if (aperta) chiudi();
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
    const stato = { vista, video, stream: null, o };
    aperta = stato;
    vista.querySelector('.fotocamera-chiudi').addEventListener('click', () => { chiudi(); if (o.onChiusa) o.onChiusa(); });
    vista.querySelector('.fotocamera-scatta').addEventListener('click', () => scatta(stato));
    const esc = e => { if (e.key === 'Escape' && aperta === stato) { chiudi(); if (o.onChiusa) o.onChiusa(); } };
    document.addEventListener('keydown', esc);
    stato.togliEsc = () => document.removeEventListener('keydown', esc);
    try {
      // risoluzione alta se c'è (le scritte piccole del documento), fotocamera posteriore
      const vincoli = { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } } };
      try { stato.stream = await navigator.mediaDevices.getUserMedia(vincoli); }
      catch (e) { stato.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } }); }
      if (aperta !== stato) { ferma(stato); return; }
      video.srcObject = stato.stream;
      const traccia = stato.stream.getVideoTracks()[0];
      // messa a fuoco continua dove il browser lo permette (Android); su iPhone è già automatica
      try { const c = traccia.getCapabilities ? traccia.getCapabilities() : {}; if (c.focusMode && c.focusMode.includes('continuous')) await traccia.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) { /* non importa */ }
      try { await video.play(); } catch (e) { /* autoplay: riparte al primo tocco */ }
    } catch (err) {
      chiudi();
      if (o.onErrore) o.onErrore(err);
    }
  }

  // Fotogramma ritagliato sul riquadro (più il margine), alla risoluzione della fotocamera.
  function scatta(stato) {
    const v = stato.video;
    if (!v.videoWidth || !v.videoHeight) return;
    const riq = stato.vista.querySelector('.fotocamera-riquadro').getBoundingClientRect(), vr = v.getBoundingClientRect();
    // il video riempie lo schermo (object-fit: cover): da coordinate dello schermo a pixel del fotogramma
    const k = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight);
    const ox = (vr.width - v.videoWidth * k) / 2 + vr.left, oy = (vr.height - v.videoHeight * k) / 2 + vr.top;
    const mx = riq.width * MARGINE, my = riq.height * MARGINE;
    let x0 = (riq.left - mx - ox) / k, y0 = (riq.top - my - oy) / k, x1 = (riq.right + mx - ox) / k, y1 = (riq.bottom + my - oy) / k;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(v.videoWidth, x1); y1 = Math.min(v.videoHeight, y1);
    const tela = document.createElement('canvas');
    tela.width = Math.max(1, Math.round(x1 - x0)); tela.height = Math.max(1, Math.round(y1 - y0));
    tela.getContext('2d').drawImage(v, x0, y0, x1 - x0, y1 - y0, 0, 0, tela.width, tela.height);
    const o = stato.o;
    chiudi();
    if (o.onFoto) o.onFoto(tela);
  }

  function ferma(stato) {
    if (stato && stato.stream) { stato.stream.getTracks().forEach(tr => tr.stop()); stato.stream = null; }
  }

  function chiudi() {
    const stato = aperta;
    if (!stato) return;
    aperta = null;
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
      }, 'image/jpeg', 0.85);
    });
  }

  window.FotocameraDocumento = { disponibile, apri, chiudi, inFile, RAPPORTO };
  window.addEventListener('pagehide', chiudi);
})();
