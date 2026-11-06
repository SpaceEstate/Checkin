// campi-elenco.js — campi del check-in con un elenco (genere, cittadinanza, Stato di nascita, provincia, tipo e luogo di rilascio
// del documento, comune di nascita): si possono SCRIVERE oppure scegliere dall'elenco, ma il valore deve essere una voce dell'elenco.
//
// Le <select> di sempre restano nel modulo, nascoste, e sono loro a tenere il valore: validaStepOspite, la raccolta dei dati, la
// verifica per Alloggiati e l'invio non cambiano. Sopra ognuna c'è una casella di testo con l'elenco filtrato mentre si scrive
// (stesso schema del campo data, creaCustomDateInput in checkin.js). Lo stesso per il comune: il campo «ospiteN_comune» di sempre,
// nascosto, riceve solo un comune dell'elenco (elenchi/comuni.js, caricato quando serve) e la provincia si compila da sola (si
// può cambiare). Se l'elenco dei comuni non si scarica, il comune resta un testo libero come prima: il check-in non si blocca.
//
// Usato da checkin.js (generaStepOspiti → potenziaCampiElenco) e dalla scansione (ElencoComuni, per normalizzare il comune letto).
(function () {
  'use strict';

  const VERSIONE_ELENCHI = '20261106a';
  const MAX_VOCI = 60, MAX_COMUNI = 40;

  // Forma di confronto: maiuscole, senza accenti né punteggiatura («Agliè» = «AGLIE'» = «AGLIE»).
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const senzaSpazi = s => s.replace(/ /g, '');
  const tr = (k, p, ripiego) => { try { const x = typeof t === 'function' ? t(k, p) : ''; return x && x !== k ? x : ripiego; } catch (e) { return ripiego; } };

  // Nomi diversi con cui gli ospiti scrivono spesso uno Stato (si cerca anche nei nomi inglesi e tedeschi del modulo).
  const ALIAS_STATI = {
    'Stati Uniti': ['USA', 'US', 'AMERICA', 'STATI UNITI D AMERICA', 'UNITED STATES OF AMERICA', 'VEREINIGTE STAATEN VON AMERIKA'],
    'Regno Unito': ['UK', 'INGHILTERRA', 'GRAN BRETAGNA', 'GREAT BRITAIN', 'ENGLAND', 'SCOZIA', 'SCOTLAND', 'GALLES', 'WALES', 'ENGLAND'],
    'Paesi Bassi': ['OLANDA', 'HOLLAND', 'HOLLANDE'],
    'Repubblica Ceca': ['CECHIA', 'CZECHIA'],
    'Russia': ['FEDERAZIONE RUSSA', 'RUSSIAN FEDERATION'],
    'Vaticano': ['CITTA DEL VATICANO', 'SANTA SEDE', 'HOLY SEE'],
    'Germania': ['DEUTSCHLAND'], 'Austria': ['OESTERREICH', 'OSTERREICH'], 'Svizzera': ['SCHWEIZ', 'SUISSE', 'SVIZZERA'],
    'Spagna': ['ESPANA'], 'Grecia': ['HELLAS'], 'Croazia': ['HRVATSKA']
  };

  function chiaviStato(nomeItaliano) {
    const out = [norm(nomeItaliano)];
    try { const x = typeof I18N_PAESI !== 'undefined' && I18N_PAESI[nomeItaliano]; if (x) for (const v of Object.values(x)) out.push(norm(v)); } catch (e) { /* senza traduzioni */ }
    for (const a of ALIAS_STATI[nomeItaliano] || []) out.push(norm(a));
    return out;
  }

  // Punteggio di una voce per il testo scritto: 0 uguale, 1 inizia così, 2 una parola inizia così, 3 contiene. Infinity: no.
  function punteggio(chiavi, q, qs) {
    let best = Infinity;
    for (const k of chiavi) {
      if (!k) continue;
      const ks = senzaSpazi(k);
      const p = k === q || ks === qs ? 0 : (k.startsWith(q) || ks.startsWith(qs)) ? 1 : (' ' + k).includes(' ' + q) ? 2 : k.includes(q) ? 3 : Infinity;
      if (p < best) best = p;
      if (best === 0) break;
    }
    return best;
  }

  // ---- Elenco dei comuni (elenchi/comuni.js), caricato una volta, quando serve ----

  const Comuni = { voci: null, perNome: null, promessa: null, fallito: false };

  function analizza(testo) {
    const voci = [], perNome = new Map();
    for (const riga of String(testo || '').split('\n')) {
      const p = riga.split(';');
      if (p.length < 2 || !p[0] || !/^[A-Z]{2}$/.test(p[1])) continue;
      const oggi = p[2] && p[2][0] === '=' ? p[2].slice(1) : null, soppresso = p[2] === '-';
      const v = { nome: p[0], prov: p[1], oggi, soppresso, valore: oggi || p[0], chiave: norm(p[0]) };
      v.chiavi = [v.chiave];
      voci.push(v);
      if (!perNome.has(v.chiave)) perNome.set(v.chiave, []);
      perNome.get(v.chiave).push(v);
    }
    return { voci, perNome };
  }

  function carica() {
    if (Comuni.voci) return Promise.resolve(true);
    if (Comuni.promessa) return Comuni.promessa;
    Comuni.promessa = new Promise(ok => {
      const pronto = () => {
        if (typeof window.ELENCO_COMUNI !== 'string') { Comuni.fallito = true; Comuni.promessa = null; return ok(false); }
        const a = analizza(window.ELENCO_COMUNI);
        Comuni.voci = a.voci; Comuni.perNome = a.perNome;
        try { delete window.ELENCO_COMUNI; } catch (e) { window.ELENCO_COMUNI = undefined; }
        ok(true);
        for (const fn of attesaComuni.splice(0)) { try { fn(); } catch (e) { /* un campo non aggiornato non blocca gli altri */ } }
      };
      if (typeof window.ELENCO_COMUNI === 'string') return pronto();
      const s = document.createElement('script');
      s.src = 'elenchi/comuni.js?v=' + VERSIONE_ELENCHI;
      s.async = true;
      s.onload = pronto;
      s.onerror = () => { Comuni.fallito = true; Comuni.promessa = null; s.remove(); ok(false); };
      document.head.appendChild(s);
    });
    return Comuni.promessa;
  }
  const attesaComuni = [];

  // Comune scritto (anche un vecchio nome) → voce dell'elenco. Con la provincia, vince il comune di quella provincia.
  // Restituisce { nome (da scrivere nel modulo), prov, voce } oppure { ambiguo: [voci] } oppure null.
  function cerca(nome, prov) {
    if (!Comuni.voci) return null;
    let c = Comuni.perNome.get(norm(nome)) || [];
    if (!c.length) return null;
    if (prov) { const p = c.filter(v => v.prov === prov); if (p.length) c = p; }
    if (c.length > 1) { const oggi = c.filter(v => !v.oggi && !v.soppresso); if (oggi.length === 1) c = oggi; }
    if (c.length > 1) return { ambiguo: c };
    return { nome: c[0].valore, prov: c[0].prov, voce: c[0] };
  }

  function distanza(a, b) {
    const d = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prec = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const x = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prec + (a[i - 1] === b[j - 1] ? 0 : 1)); prec = x; }
    }
    return d[b.length];
  }

  // Comune letto male dall'OCR («GUBBlO» per GUBBIO): il comune più simile nella provincia letta, se è uno solo.
  function simile(nome, prov) {
    const esatto = cerca(nome, prov);
    if (esatto && !esatto.ambiguo && (!prov || esatto.prov === prov)) return esatto;
    if (!Comuni.voci || !prov) return null;
    const k = norm(nome), limite = Math.max(1, Math.floor(k.length / 6));
    let migliori = [], minimo = Infinity;
    for (const v of Comuni.voci) {
      if (v.prov !== prov || Math.abs(v.chiave.length - k.length) > limite) continue;
      const d = distanza(k, v.chiave);
      if (d < minimo) { minimo = d; migliori = [v]; } else if (d === minimo) migliori.push(v);
    }
    const unici = new Set(migliori.map(v => v.valore));
    return minimo <= limite && unici.size === 1 ? { nome: migliori[0].valore, prov: migliori[0].prov, voce: migliori[0], approssimato: true } : null;
  }

  function trovaComuni(testo, prov) {
    const q = norm(testo), qs = senzaSpazi(q);
    if (q.length < 2 || !Comuni.voci) return [];
    const hit = [];
    for (const v of Comuni.voci) {
      const p = punteggio(v.chiavi, q, qs);
      if (p < Infinity) hit.push([p, (v.oggi || v.soppresso) ? 1 : 0, prov && v.prov === prov ? 0 : 1, v]);
    }
    hit.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3].nome.localeCompare(b[3].nome, 'it'));
    return hit.slice(0, MAX_COMUNI).map(h => h[3]);
  }

  window.ElencoComuni = { carica, cerca, simile, trova: trovaComuni, pronto: () => !!Comuni.voci, norm };

  // ---- Valore di un campo nativo osservato anche quando lo cambia il codice (value = …) ----

  function osservaValore(el, dopo) {
    const proto = Object.getPrototypeOf(el);
    for (const prop of ['value', 'selectedIndex']) {
      let p = proto, d = null;
      while (p && !(d = Object.getOwnPropertyDescriptor(p, prop))) p = Object.getPrototypeOf(p);
      if (!d || !d.set) continue;
      Object.defineProperty(el, prop, {
        configurable: true, enumerable: d.enumerable,
        get() { return d.get.call(this); },
        set(v) { d.set.call(this, v); dopo(); }
      });
    }
  }
  const valoreNativo = el => { let p = Object.getPrototypeOf(el), d = null; while (p && !(d = Object.getOwnPropertyDescriptor(p, 'value'))) p = Object.getPrototypeOf(p); return d; };
  function imposta(el, v) {
    const d = valoreNativo(el);
    const prima = d.get.call(el);
    d.set.call(el, v);
    if (prima !== d.get.call(el)) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ---- Casella con elenco (combobox) ----

  let progressivo = 0;
  const tutti = [];

  // opzioni: { nativo, voci(testo) → [voce], etichetta(nativo) → testo mostrato, scegli(voce), conferma(testo) → esito,
  //            minimo (lettere prima di mostrare l'elenco), messaggioVuoto }
  function creaCasella(o) {
    const nativo = o.nativo, id = (nativo.id || ('campo-elenco-' + (++progressivo))) + '__testo';
    const box = document.createElement('div');
    box.className = 'combo';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.className = 'form-input combo-testo';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', id + '-lista');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocorrect', 'off');
    if (o.segnaposto) { input.setAttribute('placeholder', o.segnaposto.testo); if (o.segnaposto.chiave) input.setAttribute('data-i18n-placeholder', o.segnaposto.chiave); }
    const lista = document.createElement('ul');
    lista.id = id + '-lista';
    lista.className = 'combo-lista';
    lista.setAttribute('role', 'listbox');
    lista.hidden = true;
    const errore = document.createElement('p');
    errore.className = 'combo-errore';
    errore.hidden = true;
    errore.id = id + '-errore';
    input.setAttribute('aria-describedby', errore.id);
    box.append(input, lista, errore);
    nativo.insertAdjacentElement('afterend', box);
    nativo.classList.add('combo-nativo');
    nativo.setAttribute('tabindex', '-1');
    nativo.setAttribute('aria-hidden', 'true');
    const etichetta = nativo.id && document.querySelector('label[for="' + nativo.id + '"]');
    if (etichetta) etichetta.htmlFor = id;
    nativo._combo = input;
    input._nativo = nativo;

    let voci = [], attiva = -1, scrivendo = false;
    const aperta = () => !lista.hidden;
    const chiudi = () => { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); attiva = -1; };
    const mostraErrore = testo => {
      box.classList.toggle('combo-sbagliato', !!testo);
      if (testo) { errore.textContent = testo; errore.hidden = false; input.setAttribute('aria-invalid', 'true'); }
      else { errore.textContent = ''; errore.hidden = true; input.removeAttribute('aria-invalid'); }
    };
    const evidenzia = i => {
      attiva = i;
      [...lista.children].forEach((li, k) => { li.classList.toggle('attiva', k === i); li.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      const li = lista.children[i];
      if (li && li.id) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    };
    const disegna = testo => {
      voci = o.voci(testo);
      lista.textContent = '';
      if (!voci.length) {
        const msg = o.messaggioVuoto && o.messaggioVuoto(testo);
        if (!msg) { chiudi(); return; }
        const li = document.createElement('li');
        li.className = 'combo-vuota';
        li.textContent = msg;
        lista.appendChild(li);
      } else {
        voci.forEach((v, k) => {
          const li = document.createElement('li');
          li.id = id + '-voce-' + k;
          li.setAttribute('role', 'option');
          li.setAttribute('aria-selected', 'false');
          li.textContent = v.testo;
          if (v.nota) { const n = document.createElement('span'); n.className = 'combo-nota'; n.textContent = ' ' + v.nota; li.appendChild(n); }
          li.addEventListener('pointerdown', e => e.preventDefault());   // l'input non perde il fuoco
          li.addEventListener('mousedown', e => e.preventDefault());
          li.addEventListener('click', () => { scegli(v); });
          lista.appendChild(li);
        });
      }
      lista.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      attiva = -1;
    };
    const scegli = v => {
      scrivendo = false;
      mostraErrore('');
      o.scegli(v);
      input.value = o.etichetta();
      chiudi();
    };
    const conferma = () => {
      if (!scrivendo) return;
      scrivendo = false;
      const esito = o.conferma(input.value);
      if (esito && esito.errore) mostraErrore(esito.errore);
      else { mostraErrore(''); input.value = o.etichetta(); }
    };
    // testo mostrato quando il valore cambia da codice (scansione, «Annulla», toggleComuneProvincia…)
    const aggiorna = () => { if (!scrivendo) { input.value = o.etichetta(); mostraErrore(''); } };

    input.addEventListener('focus', () => {
      const t0 = input.value;
      disegna(t0 && t0 === o.etichetta() ? '' : t0);
    });
    input.addEventListener('input', () => { scrivendo = true; mostraErrore(''); disegna(input.value); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!aperta()) disegna(input.value === o.etichetta() ? '' : input.value); if (voci.length) evidenzia(Math.min(voci.length - 1, attiva + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (voci.length) evidenzia(Math.max(0, attiva - 1)); }
      else if (e.key === 'Enter') { if (aperta() && attiva >= 0 && voci[attiva]) { e.preventDefault(); scegli(voci[attiva]); } else if (scrivendo) { e.preventDefault(); conferma(); chiudi(); } }
      else if (e.key === 'Escape') { if (aperta()) { e.preventDefault(); chiudi(); } }
    });
    // all'uscita dal campo si conferma il testo scritto, ma con un attimo di ritardo: sui telefoni il tocco su una voce dell'elenco
    // arriva dopo che la casella ha perso il fuoco (la scelta, se arriva, ha la precedenza)
    input.addEventListener('blur', () => { setTimeout(() => { if (document.activeElement !== input) { chiudi(); conferma(); } }, 200); });
    // un tocco sulla casella già attiva (elenco chiuso con Esc o dopo una scelta) riapre l'elenco
    input.addEventListener('click', () => { if (!aperta()) disegna(input.value === o.etichetta() ? '' : input.value); });
    nativo.addEventListener('change', aggiorna);
    nativo.addEventListener('focus', () => input.focus());       // la validazione porta il fuoco sul campo nativo
    osservaValore(nativo, aggiorna);
    input.value = o.etichetta();
    const casella = { input, nativo, aggiorna, ridisegna: () => { if (aperta()) disegna(input.value === o.etichetta() ? '' : input.value); }, conferma };
    tutti.push(casella);
    return casella;
  }

  // ---- <select>: genere, cittadinanza, Stato di nascita, provincia, tipo di documento, luogo di rilascio ----

  function potenziaSelect(sel) {
    if (sel._combo) return;
    const stati = sel.querySelector('option[data-i18n-country]') !== null;
    const opzioni = () => [...sel.options].filter(op => op.value !== '');
    const voceDi = op => ({ valore: op.value, testo: op.textContent, chiavi: stati ? [norm(op.textContent)].concat(chiaviStato(op.value)) : [norm(op.textContent), norm(op.value)] });
    const etichetta = () => { const op = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null; return op && op.value ? op.textContent : ''; };
    const segnaposto = sel.options[0] && sel.options[0].value === '' ? { testo: sel.options[0].textContent, chiave: sel.options[0].getAttribute('data-i18n') } : null;
    const trova = testo => {
      const q = norm(testo), qs = senzaSpazi(q);
      const tutte = opzioni().map(voceDi);
      if (!q) return tutte.slice(0, 400);
      return tutte.map(v => [punteggio(v.chiavi, q, qs), v]).filter(x => x[0] < Infinity)
        .sort((a, b) => a[0] - b[0] || a[1].testo.localeCompare(b[1].testo)).slice(0, MAX_VOCI).map(x => x[1]);
    };
    const casella = creaCasella({
      nativo: sel, segnaposto,
      voci: trova,
      etichetta,
      messaggioVuoto: testo => norm(testo) ? tr('combo.nessuna', null, 'Nessuna voce trovata') : '',
      scegli: v => imposta(sel, v.valore),
      conferma: testo => {
        const q = norm(testo);
        if (!q) { imposta(sel, ''); return null; }
        // una sola voce uguale, oppure una sola che inizia così («ita» → Italia, anche se «Mauritania» contiene «ita»)
        const risultati = trova(testo), qs = senzaSpazi(q);
        const esatte = risultati.filter(v => punteggio(v.chiavi, q, qs) === 0), inizio = risultati.filter(v => punteggio(v.chiavi, q, qs) === 1);
        const scelta = esatte.length === 1 ? esatte[0] : (!esatte.length && inizio.length === 1 ? inizio[0] : null);
        if (scelta) { imposta(sel, scelta.valore); return null; }
        imposta(sel, '');
        return { errore: tr('combo.nonInElenco', null, "Scegli una voce dell'elenco") };
      }
    });
    // segnaposto tradotto con il resto della pagina: la prima opzione ha già data-i18n
    if (segnaposto && segnaposto.chiave) casella.input.setAttribute('data-i18n-placeholder', segnaposto.chiave);
    return casella;
  }

  // ---- Comune di nascita: elenco dei comuni, provincia compilata da sola ----

  function potenziaComune(input, provincia) {
    if (input._combo) return;
    const prov = () => (provincia ? provincia.value : '');
    const testoVoce = v => v.nome + ' (' + v.prov + ')';
    const notaVoce = v => v.oggi ? tr('combo.oggi', { nome: v.oggi }, '→ ' + v.oggi) : v.soppresso ? tr('combo.soppresso', null, '· comune non più esistente') : '';
    const segnaposto = input.getAttribute('placeholder') ? { testo: input.getAttribute('placeholder'), chiave: input.getAttribute('data-i18n-placeholder') } : null;
    const casella = creaCasella({
      nativo: input, segnaposto,
      voci: testo => {
        if (!Comuni.voci) { carica().then(() => casella.ridisegna()); return []; }
        return trovaComuni(testo, prov()).map(v => ({ testo: testoVoce(v), nota: notaVoce(v), voce: v }));
      },
      etichetta: () => input.value,
      messaggioVuoto: testo => {
        if (Comuni.fallito) return '';
        if (!Comuni.voci) return tr('combo.caricamento', null, 'Carico l\'elenco dei comuni…');
        return norm(testo).length < 2 ? tr('combo.scriviComune', null, 'Scrivi il nome del comune') : tr('combo.comuneNonTrovato', null, 'Comune non trovato: sceglilo dall\'elenco');
      },
      scegli: x => {
        imposta(input, x.voce.valore);
        if (provincia && provincia.value !== x.voce.prov && [...provincia.options].some(op => op.value === x.voce.prov)) imposta(provincia, x.voce.prov);
      },
      conferma: testo => {
        if (!norm(testo)) { imposta(input, ''); return null; }
        if (!Comuni.voci) {
          // elenco non ancora arrivato (o non scaricabile): per ora il testo, come prima; si controlla appena c'è l'elenco
          imposta(input, testo.trim());
          if (!Comuni.fallito) { attesaComuni.push(() => verificaComune()); carica(); }
          return null;
        }
        const r = cerca(testo, prov());
        if (r && !r.ambiguo) { scegliRisultato(r); return null; }
        // un solo comune che inizia così («gubb» → GUBBIO)
        const q = norm(testo), qs = senzaSpazi(q);
        const inizio = r ? [] : trovaComuni(testo, prov()).filter(v => punteggio(v.chiavi, q, qs) <= 1);
        const valori = new Set(inizio.map(v => v.valore + ';' + v.prov));
        if (!r && valori.size === 1) { scegliRisultato({ nome: inizio[0].valore, prov: inizio[0].prov, voce: inizio[0] }); return null; }
        imposta(input, '');
        return { errore: r && r.ambiguo ? tr('combo.comuneAmbiguo', null, 'Ci sono più comuni con questo nome: scegli quello giusto dall\'elenco') : tr('combo.comuneNonTrovato', null, 'Comune non trovato: sceglilo dall\'elenco') };
      }
    });
    function scegliRisultato(r) {
      imposta(input, r.nome);
      if (provincia && provincia.value !== r.prov && [...provincia.options].some(op => op.value === r.prov)) imposta(provincia, r.prov);
    }
    // un comune messo dal codice (scansione) o scritto prima che arrivasse l'elenco: si porta al nome dell'elenco, oppure si segnala
    function verificaComune() {
      const v = input.value;
      if (!v || !Comuni.voci) return;
      const r = cerca(v, prov());
      if (r && !r.ambiguo) { if (r.nome !== v) imposta(input, r.nome); return; }
      casella.input.value = v;
      imposta(input, '');
      casella.input.dispatchEvent(new Event('comune-sbagliato'));
    }
    casella.input.addEventListener('comune-sbagliato', () => {
      const box = casella.input.parentNode, err = box.querySelector('.combo-errore');
      box.classList.add('combo-sbagliato');
      err.textContent = tr('combo.comuneNonTrovato', null, 'Comune non trovato: sceglilo dall\'elenco');
      err.hidden = false;
      casella.input.setAttribute('aria-invalid', 'true');
    });
    // comune messo dal codice (la scansione): si controlla appena c'è l'elenco
    input.addEventListener('change', () => {
      if (!input.value) return;
      if (Comuni.voci) queueMicrotask(verificaComune);
      else if (!Comuni.fallito) { attesaComuni.push(verificaComune); carica(); }
    });
    // l'elenco si scarica appena il campo può servire (Stato di nascita: Italia) o al primo tocco
    casella.input.addEventListener('focus', () => { carica(); }, { once: true });
    return casella;
  }

  // Chiamata da generaStepOspiti per ogni passo di ospite appena creato.
  window.potenziaCampiElenco = function (radice) {
    if (!radice || !radice.querySelectorAll) return;
    radice.querySelectorAll('select.form-select').forEach(sel => { if (/^ospite\d+_/.test(sel.name || '')) potenziaSelect(sel); });
    radice.querySelectorAll('input[name$="_comune"]').forEach(inp => {
      const n = /^ospite(\d+)_comune$/.exec(inp.name || '');
      if (!n) return;
      potenziaComune(inp, radice.querySelector('select[name="ospite' + n[1] + '_provincia"]'));
      const luogo = radice.querySelector('select[name="ospite' + n[1] + '_luogo_nascita"]');
      if (luogo) luogo.addEventListener('change', () => { if (luogo.value === 'Italia') carica(); });
    });
  };

  // Cambio di lingua: le etichette delle opzioni sono tradotte, il testo mostrato si aggiorna.
  try { if (typeof onCambioLingua === 'function') onCambioLingua(() => { for (const c of tutti) { c.aggiorna(); c.ridisegna(); } }); } catch (e) { /* senza i18n */ }
})();
