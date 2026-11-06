// scansione/immagine.js — analisi delle immagini per la lettura dei documenti (docs/scansione-documenti.md).
//
// Solo calcoli su matrici di pixel in memoria (scala di grigi, Uint8Array): niente pagina, niente rete, niente archiviazione.
// Serve a non far leggere all'OCR tutta la foto (tovaglia, portafoglio, riflessi la rallentano e la confondono), ma solo:
//  - la MRZ, trovata dovunque sia nella foto e in qualunque verso (analizzaPagina), ritagliata dritta e in bianco e nero;
//  - la zona con il testo stampato.
// E a correggere l'errore tipico dell'OCR sulla MRZ: le file di «<» lette come L, K o C. La forma del «<» si riconosce
// dall'immagine (eChevron) e la riga letta si allinea ai caratteri trovati nell'immagine (allineaRigaMrz).
//
// Il «grigio» è il canale più chiaro di ogni pixel (max di R, G, B): il nero delle scritte resta nero, mentre i fondi colorati
// del documento (disegni azzurri e verdi, la scritta arancione «ITALIA» sul retro della CIE) diventano chiari e spariscono.

export function grigioMassimo(rgba, w, h) {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) {
    const r = rgba[i], v = rgba[i + 1], b = rgba[i + 2];
    g[j] = r > v ? (r > b ? r : b) : (v > b ? v : b);
  }
  return g;
}

// Riduzione per media dei pixel (area), da w×h a nw×nh (nw ≤ w, nh ≤ h).
export function riduci(g, w, h, nw, nh) {
  const out = new Uint8Array(nw * nh), fx = w / nw, fy = h / nh;
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.min(h, Math.max(y0 + 1, Math.floor((y + 1) * fy)));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.min(w, Math.max(x0 + 1, Math.floor((x + 1) * fx)));
      let s = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0, i = yy * w + x0; xx < x1; xx++, i++) s += g[i];
      out[y * nw + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

export function sogliaOtsu(g) {
  const ist = new Uint32Array(256);
  for (let i = 0; i < g.length; i++) ist[g[i]]++;
  let somma = 0; for (let v = 0; v < 256; v++) somma += v * ist[v];
  let sB = 0, wB = 0, soglia = 127, massimo = -1;
  for (let v = 0; v < 256; v++) {
    wB += ist[v]; if (!wB) continue;
    const wF = g.length - wB; if (!wF) break;
    sB += v * ist[v];
    const mB = sB / wB, mF = (somma - sB) / wF, tra = wB * wF * (mB - mF) * (mB - mF);
    if (tra > massimo) { massimo = tra; soglia = v; }
  }
  return soglia;
}

// Bianco e nero «locale» (Sauvola): la soglia segue la luce della zona, quindi riflessi e ombre non cancellano le lettere.
// Restituisce 0 per l'inchiostro e 255 per il fondo.
export function sauvola(g, w, h, finestra, k = 0.25) {
  // somme cumulate: dei valori (bastano 32 bit fino a 16 milioni di pixel) e dei quadrati (64 bit)
  const W = w + 1, s1 = w * h <= 16e6 ? new Uint32Array(W * (h + 1)) : new Float64Array(W * (h + 1)), s2 = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let r1 = 0, r2 = 0;
    for (let x = 0; x < w; x++) {
      const v = g[y * w + x]; r1 += v; r2 += v * v;
      s1[(y + 1) * W + x + 1] = s1[y * W + x + 1] + r1;
      s2[(y + 1) * W + x + 1] = s2[y * W + x + 1] + r2;
    }
  }
  const r = Math.max(3, finestra >> 1), out = new Uint8Array(g.length);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1), n = (yb - ya) * (xb - xa);
      const sum = s1[yb * W + xb] - s1[ya * W + xb] - s1[yb * W + xa] + s1[ya * W + xa];
      const sq = s2[yb * W + xb] - s2[ya * W + xb] - s2[yb * W + xa] + s2[ya * W + xa];
      const m = sum / n, dev = Math.sqrt(Math.max(0, sq / n - m * m)), v = g[y * w + x];
      // su un fondo uniforme conta solo ciò che è decisamente più scuro della media (niente granella)
      out[y * w + x] = (v > m * (1 + k * (dev / 128 - 1)) || m - v < 12) ? 255 : 0;
    }
  }
  return out;
}

// Componenti connesse dell'inchiostro (pixel a 0), 8-connesse. Con `etichette` restituisce anche la mappa pixel → componente.
export function macchie(bin, w, h, etichette) {
  const lab = new Int32Array(w * h).fill(-1), out = [], pila = new Int32Array(w * h);
  for (let i = 0; i < bin.length; i++) {
    if (bin[i] || lab[i] >= 0) continue;
    const id = out.length;
    let top = 0, n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    pila[top++] = i; lab[i] = id;
    while (top) {
      const p = pila[--top], x = p % w, y = (p - x) / w;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (!bin[q] && lab[q] < 0) { lab[q] = id; pila[top++] = q; }
        }
      }
    }
    out.push({ id, x0, y0, x1, y1, area: n });
  }
  return etichette ? { comp: out, lab } : out;
}

// ---- Righe di testo: catene di «lettere» (componenti di misura simile, allineate e vicine) ----

// Vista di una componente lungo l'asse delle righe: `a` lungo la riga, `b` di traverso (verticale: assi scambiati).
const vista = (c, verticale) => verticale
  ? { c, a0: c.y0, a1: c.y1, b0: c.x0, b1: c.x1, s: c.x1 - c.x0 + 1, l: c.y1 - c.y0 + 1, ac: (c.y0 + c.y1) / 2, bc: (c.x0 + c.x1) / 2 }
  : { c, a0: c.x0, a1: c.x1, b0: c.y0, b1: c.y1, s: c.y1 - c.y0 + 1, l: c.x1 - c.x0 + 1, ac: (c.x0 + c.x1) / 2, bc: (c.y0 + c.y1) / 2 };

function mediana(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; }

// Unisce in catene le componenti che sembrano lettere di una stessa riga. Restituisce le catene con le loro misure:
// { v: [viste in ordine], n, a0, a1, b0, b1, s (altezza mediana), passo (distanza media tra i centri), cv (regolarità), pendenza }.
export function catene(comp, verticale, opz = {}) {
  const sMin = opz.sMin || 5, sMax = opz.sMax || 120;
  const v = [];
  for (const c of comp) {
    const q = vista(c, verticale);
    if (q.s < sMin || q.s > sMax || q.l > q.s * 2.6 || c.area < 8) continue;
    v.push(q);
  }
  // griglia per cercare i vicini senza confrontare tutte le coppie
  const G = 48, griglia = new Map();
  const chiave = (i, j) => i * 100003 + j;
  for (let k = 0; k < v.length; k++) {
    const q = v[k], kk = chiave(Math.floor(q.ac / G), Math.floor(q.bc / G));
    if (!griglia.has(kk)) griglia.set(kk, []);
    griglia.get(kk).push(k);
  }
  const destra = new Int32Array(v.length).fill(-1), costoDestra = new Float64Array(v.length).fill(Infinity);
  for (let k = 0; k < v.length; k++) {
    const q = v[k], portata = q.a1 + 1.3 * q.s * 1.65 + q.s;
    for (let i = Math.floor(q.ac / G); i <= Math.floor(portata / G); i++) {
      for (let j = Math.floor((q.bc - q.s) / G); j <= Math.floor((q.bc + q.s) / G); j++) {
        const lista = griglia.get(chiave(i, j)); if (!lista) continue;
        for (const m of lista) {
          if (m === k) continue;
          const r = v[m];
          if (r.ac <= q.ac) continue;
          const s = Math.max(q.s, r.s), gap = r.a0 - q.a1, db = Math.abs(r.bc - q.bc);
          if (gap < -0.3 * Math.min(q.s, r.s) || gap > 1.3 * s || db > 0.32 * s || s / Math.min(q.s, r.s) > 1.65) continue;
          const costo = Math.max(0, gap) / s + 2 * db / s + Math.abs(Math.log(r.s / q.s));
          if (costo < costoDestra[k]) { costoDestra[k] = costo; destra[k] = m; }
        }
      }
    }
  }
  // legame solo se è reciproco (ogni lettera ha al più un vicino a destra e uno a sinistra)
  const sinistra = new Int32Array(v.length).fill(-1), costoSinistra = new Float64Array(v.length).fill(Infinity);
  for (let k = 0; k < v.length; k++) { const m = destra[k]; if (m >= 0 && costoDestra[k] < costoSinistra[m]) { costoSinistra[m] = costoDestra[k]; sinistra[m] = k; } }
  const out = [];
  for (let k = 0; k < v.length; k++) {
    if (sinistra[k] >= 0 && destra[sinistra[k]] === k) continue;   // non è l'inizio di una catena
    const membri = [k];
    let x = k;
    while (destra[x] >= 0 && sinistra[destra[x]] === x) { x = destra[x]; membri.push(x); }
    if (membri.length >= 2) out.push(misuraCatena(membri.map(i => v[i])));
  }
  return unisciCatene(out);
}

function misuraCatena(vv) {
  vv = vv.slice().sort((x, y) => x.ac - y.ac);
  const n = vv.length, s = mediana(vv.map(q => q.s));
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const q of vv) { a0 = Math.min(a0, q.a0); a1 = Math.max(a1, q.a1); b0 = Math.min(b0, q.b0); b1 = Math.max(b1, q.b1); }
  const passi = []; for (let i = 1; i < n; i++) passi.push(vv[i].ac - vv[i - 1].ac);
  const passo = passi.length ? mediana(passi) : s;
  const dev = passi.length ? Math.sqrt(passi.reduce((x, y) => x + (y - passo) * (y - passo), 0) / passi.length) : 0;
  // pendenza della riga (minimi quadrati dei centri)
  let ma = 0, mb = 0; for (const q of vv) { ma += q.ac; mb += q.bc; } ma /= n; mb /= n;
  let num = 0, den = 0; for (const q of vv) { num += (q.ac - ma) * (q.bc - mb); den += (q.ac - ma) * (q.ac - ma); }
  // uniformità delle altezze e riempimento (inchiostro sul riquadro della riga): le righe vere di un documento hanno lettere
  // alte uguali e piene; i disegni di una tovaglia o le pieghe di un portafoglio no
  const ms = vv.reduce((x, q) => x + q.s, 0) / n, devS = Math.sqrt(vv.reduce((x, q) => x + (q.s - ms) * (q.s - ms), 0) / n) / (ms || 1);
  const riemp = vv.reduce((x, q) => x + q.c.area, 0) / Math.max(1, (a1 - a0 + 1) * (b1 - b0 + 1));
  // altezza delle maiuscole: l'80° percentile (in certi caratteri i «<» sono molto più bassi delle lettere e sono metà riga)
  const alte = vv.map(q => q.s).sort((x, y) => x - y), sAlto = alte[Math.min(n - 1, Math.floor(n * 0.8))];
  return { v: vv, n, a0, a1, b0, b1, s, sAlto, passo, cv: passo ? dev / passo : 1, pendenza: den ? num / den : 0, ma, mb, devS, riemp };
}
// Una riga di testo stampato credibile (per la zona del testo; la MRZ ha le sue regole in gruppoMrz)
const rigaBuona = c => c.n >= 4 && c.cv <= 0.6 && c.devS <= 0.16 && c.riemp >= 0.2 && Math.abs(c.pendenza) <= 0.15 && c.passo / c.s >= 0.45 && c.passo / c.s <= 2.6;

// Due pezzi della stessa riga (una lettera persa per un riflesso, uno spazio più largo): si uniscono se sono allineati.
function unisciCatene(cc) {
  const lista = cc.slice().sort((x, y) => x.a0 - y.a0), usate = new Set(), out = [];
  for (let i = 0; i < lista.length; i++) {
    if (usate.has(i)) continue;
    let A = lista[i];
    for (let j = i + 1; j < lista.length; j++) {
      if (usate.has(j)) continue;
      const B = lista[j], s = Math.max(A.s, B.s), gap = B.a0 - A.a1;
      if (gap < -0.2 * s || gap > 3.2 * Math.max(A.passo, s)) continue;
      // (fino a 1,7: in certi caratteri della MRZ i «<» sono molto più bassi delle lettere, e una fila di «<» è un pezzo a sé)
      if (s / Math.min(A.s, B.s) > 1.7) continue;
      const pend = A.n >= 4 ? A.pendenza : 0, previsto = A.mb + pend * ((B.a0 + B.a1) / 2 - A.ma);
      if (Math.abs(previsto - B.mb) > 0.35 * s) continue;
      A = misuraCatena(A.v.concat(B.v)); usate.add(j);
    }
    out.push(A);
  }
  return out;
}

// MRZ tra le catene: 2 o 3 righe lunghe, parallele, impilate, con la stessa misura e lo stesso passo (carattere a larghezza fissa).
export function gruppoMrz(cc) {
  const lunghe = cc.filter(c => c.n >= 14 && c.cv < 0.45 && c.passo / c.sAlto > 0.5 && c.passo / c.s < 2.2).sort((x, y) => x.mb - y.mb);
  let migliore = null;
  for (let i = 0; i < lunghe.length; i++) {
    for (const quante of [3, 2]) {
      const g = [lunghe[i]];
      for (let j = i + 1; j < lunghe.length && g.length < quante; j++) {
        const A = g[g.length - 1], B = lunghe[j], s = Math.max(A.sAlto, B.sAlto);
        const d = B.mb - A.mb;
        if (d < 1.05 * s) continue;            // stessa riga (pezzo doppio): si salta
        if (d > 3.2 * s) break;
        if (s / Math.min(A.sAlto, B.sAlto) > 1.4 || Math.max(A.passo, B.passo) / Math.min(A.passo, B.passo) > 1.3) continue;
        const sovrapp = Math.min(A.a1, B.a1) - Math.max(A.a0, B.a0);
        if (sovrapp < 0.55 * Math.min(A.a1 - A.a0, B.a1 - B.a0)) continue;
        g.push(B);
      }
      if (g.length < 2) continue;
      const n = g.reduce((x, c) => x + c.n, 0), cv = g.reduce((x, c) => x + c.cv, 0) / g.length;
      const lunghezza = n / g.length;
      // righe da 30 (TD1, 3 righe), 36 o 44 (TD2, TD3: 2 righe): somiglianza con il formato atteso
      const atteso = g.length === 3 ? 30 : (lunghezza > 40 ? 44 : 36);
      const punti = n * (1 - Math.min(0.6, Math.abs(lunghezza - atteso) / atteso)) * (1 - Math.min(0.5, cv));
      if (!migliore || punti > migliore.punti) migliore = { punti, righe: g, n };
    }
  }
  return migliore;
}

// Analisi della pagina (immagine piccola, lato lungo ~1000 px): righe di testo nei due versi, verso prevalente, MRZ.
// Restituisce { verticale, mrz: { zona, verticale, s, passo, righe, n } | null, testo: zona | null, lettere }.
// Le zone sono { cx, cy, lungo, traverso, angolo, verticale }: centro, misure lungo e di traverso alla riga, angolo della riga.
export function analizzaPagina(g, w, h) {
  const finestra = Math.max(15, Math.round(Math.min(w, h) / 22)) | 1;
  const bin = sauvola(g, w, h, finestra, 0.2);
  const comp = macchie(bin, w, h);
  const versi = [false, true].map(verticale => {
    const cc = catene(comp, verticale, { sMin: 6, sMax: Math.min(w, h) / 6 });
    const righe = cc.filter(rigaBuona);
    return { verticale, cc, righe, lettere: righe.reduce((x, c) => x + c.n, 0), mrz: gruppoMrz(cc) };
  });
  // verso della MRZ: quello con il gruppo migliore; verso del testo: quello con più lettere in riga
  const conMrz = versi.filter(x => x.mrz).sort((x, y) => y.mrz.punti - x.mrz.punti)[0];
  const prevalente = conMrz && conMrz.mrz.n >= 40 ? conMrz : (versi[1].lettere > versi[0].lettere * 1.15 ? versi[1] : versi[0]);
  let mrz = null;
  if (conMrz) {
    const gr = conMrz.mrz.righe, s = mediana(gr.map(c => c.sAlto)), passo = mediana(gr.map(c => c.passo));
    const pendenza = gr.reduce((x, c) => x + c.pendenza * c.n, 0) / gr.reduce((x, c) => x + c.n, 0);
    mrz = { zona: zonaDaCatene(gr, conMrz.verticale, pendenza, 2.2 * passo, 1.0 * s), verticale: conMrz.verticale, s, passo, righe: gr.length, n: conMrz.mrz.n };
  }
  // testo stampato: le righe del verso prevalente vicine tra loro (il gruppo con più lettere). Le righe prese per una MRZ
  // restano dentro: può essere un falso allarme (tre righe regolari sul fronte di una CIE) e toglierle spezzerebbe il gruppo
  const righe = prevalente.righe;
  let testo = null, testoEsteso = null;
  if (righe.length >= 2) {
    const gruppi = [];
    for (const c of righe.slice().sort((x, y) => x.b0 - y.b0)) {
      const q = gruppi.find(gq => c.b0 <= gq.b1 + 4 * c.s && c.b1 >= gq.b0 - 4 * c.s && c.a1 >= gq.a0 - 8 * c.s && c.a0 <= gq.a1 + 8 * c.s);
      if (q) { q.cc.push(c); q.a0 = Math.min(q.a0, c.a0); q.a1 = Math.max(q.a1, c.a1); q.b0 = Math.min(q.b0, c.b0); q.b1 = Math.max(q.b1, c.b1); q.n += c.n; }
      else gruppi.push({ cc: [c], a0: c.a0, a1: c.a1, b0: c.b0, b1: c.b1, n: c.n });
    }
    const top = gruppi.sort((x, y) => y.n - x.n)[0];
    if (top && top.n >= 12) {
      const s = mediana(top.cc.map(c => c.s));
      const pendenza = top.cc.reduce((x, c) => x + c.pendenza * c.n, 0) / top.n;
      testo = zonaDaCatene(top.cc, prevalente.verticale, Math.abs(pendenza) < 0.2 ? pendenza : 0, 3 * s, 2 * s);
      testo.s = s;
      // zona allargata, con i gruppi vicini sopra o sotto e allineati in larghezza: righe scartate da rigaBuona (date con le barre,
      // caratteri di misure diverse: le righe 3 e 4a della patente) spezzano il blocco del testo. Si legge solo se serve
      // (scansione-documento.js: patente senza numero; 06/11/2026). Mai la MRZ, che ha la sua zona.
      const dellaMrz = new Set(conMrz ? conMrz.mrz.righe : []), cc = top.cc.slice();
      let a0 = top.a0, a1 = top.a1, b0 = top.b0, b1 = top.b1;
      for (const q of gruppi) {
        if (q === top || q.n < 8 || q.cc.some(c => dellaMrz.has(c))) continue;
        const distanza = Math.max(q.b0 - b1, b0 - q.b1), comune = Math.min(q.a1, a1) - Math.max(q.a0, a0);
        if (distanza > 7 * s || comune < 0.5 * Math.min(q.a1 - q.a0, a1 - a0)) continue;
        cc.push(...q.cc);
        a0 = Math.min(a0, q.a0); a1 = Math.max(a1, q.a1); b0 = Math.min(b0, q.b0); b1 = Math.max(b1, q.b1);
      }
      if (cc.length > top.cc.length) {
        testoEsteso = zonaDaCatene(cc, prevalente.verticale, Math.abs(pendenza) < 0.2 ? pendenza : 0, 3 * s, 2 * s);
        testoEsteso.s = s;
      }
    }
  }
  return { verticale: prevalente.verticale, mrz, testo, testoEsteso, lettere: prevalente.lettere };
}

// Zona (centro, misure, angolo) che contiene le catene, con un margine lungo la riga e di traverso.
function zonaDaCatene(cc, verticale, pendenza, margineA, margineB) {
  // coordinate lungo/traverso ruotate della pendenza, così la zona segue la riga anche se la foto è un po' storta
  const ang = Math.atan(pendenza), cs = Math.cos(ang), sn = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (const c of cc) for (const q of c.v) for (const [a, b] of [[q.a0, q.b0], [q.a1, q.b0], [q.a0, q.b1], [q.a1, q.b1]]) {
    const u = a * cs + b * sn, ww = -a * sn + b * cs;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, ww); w1 = Math.max(w1, ww);
  }
  u0 -= margineA; u1 += margineA; w0 -= margineB; w1 += margineB;
  const uc = (u0 + u1) / 2, wc = (w0 + w1) / 2, ac = uc * cs - wc * sn, bc = uc * sn + wc * cs;
  // verticale: lungo = y, traverso = x; la riga va verso il basso (angolo π/2): il «basso» delle lettere è verso sinistra.
  // Scambiare gli assi è uno specchio: la pendenza dx/dy diventa un angolo di π/2 − atan(pendenza) nell'immagine
  return verticale
    ? { cx: bc, cy: ac, lungo: u1 - u0, traverso: w1 - w0, angolo: Math.PI / 2 - ang, verticale }
    : { cx: ac, cy: bc, lungo: u1 - u0, traverso: w1 - w0, angolo: ang, verticale };
}

// Ritaglio di una zona girata: la riga diventa orizzontale. `scala` = pixel del ritaglio per pixel della matrice d'origine.
// angolo = direzione della riga nell'immagine (0: verso destra; π/2: verso il basso). Interpolazione bilineare; fuori = bianco.
export function estrai(g, w, h, z, scala) {
  const W = Math.max(1, Math.round(z.lungo * scala)), H = Math.max(1, Math.round(z.traverso * scala)), out = new Uint8Array(W * H);
  const dx = Math.cos(z.angolo) / scala, dy = Math.sin(z.angolo) / scala;     // un passo lungo la riga
  const nx = -Math.sin(z.angolo) / scala, ny = Math.cos(z.angolo) / scala;    // un passo di traverso (verso il basso del testo)
  const ox = z.cx - (W / 2) * dx - (H / 2) * nx, oy = z.cy - (W / 2) * dy - (H / 2) * ny;
  for (let v = 0; v < H; v++) {
    let sx = ox + v * nx + 0.5 * (dx + nx), sy = oy + v * ny + 0.5 * (dy + ny);
    for (let u = 0; u < W; u++, sx += dx, sy += dy) {
      const x0 = Math.floor(sx - 0.5), y0 = Math.floor(sy - 0.5), fx = sx - 0.5 - x0, fy = sy - 0.5 - y0;
      if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) { out[v * W + u] = 255; continue; }
      const i = y0 * w + x0;
      out[v * W + u] = (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
    }
  }
  return { g: out, w: W, h: H };
}

export function ruota180(m) { const o = new Uint8Array(m.g.length); for (let i = 0; i < o.length; i++) o[i] = m.g[o.length - 1 - i]; return { g: o, w: m.w, h: m.h }; }

// Contrasto disteso (1° e 99° percentile), per le zone di testo da dare all'OCR in scala di grigi.
export function distendi(g) {
  const ist = new Uint32Array(256); for (let i = 0; i < g.length; i++) ist[g[i]]++;
  let basso = 0, alto = 255, somma = 0;
  for (let v = 0; v < 256; v++) { somma += ist[v]; if (somma >= g.length * 0.01) { basso = v; break; } }
  somma = 0; for (let v = 255; v >= 0; v--) { somma += ist[v]; if (somma >= g.length * 0.01) { alto = v; break; } }
  const k = alto > basso + 10 ? 255 / (alto - basso) : 1, out = new Uint8Array(g.length);
  for (let i = 0; i < g.length; i++) out[i] = Math.max(0, Math.min(255, (g[i] - basso) * k));
  return out;
}

// ---- MRZ: caratteri trovati nell'immagine e riconoscimento del «<» ----

// Forma del «<» (OCR-B): due tratti che partono dagli angoli a destra e si incontrano a sinistra, a metà altezza.
// Restituisce 1 per «<», -1 per un «<» capovolto (la MRZ è sottosopra), 0 altrimenti.
export function eChevron(lab, w, id, box) {
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  if (bw < 4 || bh < 6 || bw > bh * 1.2 || bw < bh * 0.35) return 0;
  // per ogni riga del glifo: primo e ultimo pixel d'inchiostro (in proporzione alla larghezza, 0..1)
  const L = [], R = [];
  for (let y = box.y0; y <= box.y1; y++) {
    let l = -1, r = -1;
    for (let x = box.x0; x <= box.x1; x++) if (lab[y * w + x] === id) { if (l < 0) l = x - box.x0; r = x - box.x0; }
    L.push(l < 0 ? null : l / (bw - 1)); R.push(r < 0 ? null : r / (bw - 1));
  }
  // forma a «V» coricata, qualunque sia lo spessore del tratto: al centro l'inchiostro parte da sinistra e non arriva a destra;
  // salendo e scendendo il bordo sinistro si sposta verso destra (il «C», che pure è aperto a destra, resta attaccato a sinistra)
  const prova = (Lv, Rv) => {
    let nc = 0, okc = 0, no = 0, oko = 0, ne = 0, oke = 0;
    for (let i = 0; i < bh; i++) {
      const d = Math.abs((i + 0.5) / bh - 0.5), l = Lv[i], r = Rv[i];
      if (d < 0.12) { nc++; if (l != null && l <= 0.2 && r <= 0.72) okc++; }
      if (d >= 0.15) { no++; if (l != null && l >= 1.5 * d - 0.2) oko++; }
      if (d >= 0.38) { ne++; if (l != null && r >= 0.7) oke++; }
    }
    return nc && okc >= 0.7 * nc && oko >= 0.75 * no && oke >= 0.6 * ne;
  };
  if (prova(L, R)) return 1;
  if (prova(R.map(x => x == null ? null : 1 - x), L.map(x => x == null ? null : 1 - x))) return -1;
  return 0;
}

// Caratteri della MRZ in un ritaglio in bianco e nero già dritto (righe orizzontali; `s` = altezza attesa delle lettere).
// Restituisce { righe: [{ glifi: [{ x0, y0, x1, y1, chevron, capovolto, id }], y0, y1, passo }], chevron, capovolti, lab }.
export function glifiMrz(bin, w, h, s) {
  const { comp, lab } = macchie(bin, w, h, true);
  const cc = catene(comp, false, { sMin: Math.max(5, s * 0.4), sMax: s * 1.6 });
  const gr = gruppoMrz(cc);
  const righe = gr ? gr.righe : cc.filter(c => c.n >= 10).sort((x, y) => x.mb - y.mb).slice(0, 3);
  let chevron = 0, capovolti = 0;
  const out = [];
  for (const c of righe) {
    const glifi = [], passo = c.passo;
    for (const q of c.v) {
      const k = q.c, larg = k.x1 - k.x0 + 1;
      // due caratteri attaccati (foto sfocata): si dividono in parti uguali secondo il passo
      const parti = larg > 1.55 * passo ? Math.round(larg / passo) : 1;
      for (let p = 0; p < parti; p++) {
        const x0 = k.x0 + Math.round(p * larg / parti), x1 = k.x0 + Math.round((p + 1) * larg / parti) - 1;
        const box = { x0, y0: k.y0, x1, y1: k.y1 };
        const forma = parti === 1 ? eChevron(lab, w, k.id, box) : 0;
        if (forma === 1) chevron++; else if (forma === -1) capovolti++;
        glifi.push({ x0, y0: k.y0, x1, y1: k.y1, chevron: forma === 1, capovolto: forma === -1, id: parti === 1 ? k.id : -1 });
      }
    }
    // pezzi di uno stesso carattere spezzato (centri troppo vicini): si tiene un solo glifo
    const uniti = [];
    for (const g of glifi) {
      const u = uniti[uniti.length - 1];
      if (u && ((g.x0 + g.x1) / 2 - (u.x0 + u.x1) / 2) < 0.45 * passo) {
        u.x0 = Math.min(u.x0, g.x0); u.x1 = Math.max(u.x1, g.x1); u.y0 = Math.min(u.y0, g.y0); u.y1 = Math.max(u.y1, g.y1);
        u.chevron = u.chevron && g.chevron; u.capovolto = u.capovolto && g.capovolto; u.id = -1;
      } else uniti.push(Object.assign({}, g));
    }
    out.push({ glifi: uniti, y0: c.b0, y1: c.b1, passo });
  }
  grigliaMrz(out);
  return { righe: out, chevron, capovolti, lab };
}

// La MRZ è una griglia: caratteri a passo fisso, righe allineate a sinistra e lunghe uguali. Dove manca un carattere (sbiadito
// da un riflesso, spezzato e scartato) si aggiunge una casella «ignota»: l'allineamento ci metterà la lettera letta dall'OCR.
function grigliaMrz(righe) {
  const centri = [];
  for (const r of righe) for (let i = 1; i < r.glifi.length; i++) centri.push((r.glifi[i].x0 + r.glifi[i].x1 - r.glifi[i - 1].x0 - r.glifi[i - 1].x1) / 2);
  const passo = mediana(centri.filter(d => d > 0));
  if (!passo) return;
  const ignota = (cx, r) => ({ x0: Math.round(cx - passo * 0.35), x1: Math.round(cx + passo * 0.35), y0: r.y0, y1: r.y1, chevron: false, capovolto: false, ignoto: true, id: -1 });
  const centro = g => (g.x0 + g.x1) / 2;
  for (const r of righe) {
    const nuovi = [];
    for (let i = 0; i < r.glifi.length; i++) {
      if (i > 0) {
        const d = centro(r.glifi[i]) - centro(r.glifi[i - 1]), k = Math.round(d / passo) - 1;
        for (let j = 1; j <= k && k <= 6; j++) nuovi.push(ignota(centro(r.glifi[i - 1]) + j * d / (k + 1), r));
      }
      nuovi.push(r.glifi[i]);
    }
    r.glifi = nuovi;
  }
  if (righe.length < 2) return;
  // inizio e fine comuni. Con tre righe vale la mediana; con due l'intersezione: ai bordi della fascia può entrare un pezzo
  // di sfondo (il bordo della carta, la tovaglia) che allunga una riga, mentre un carattere mancante all'inizio o alla fine
  // è raro (e la lettura poi prova a rimetterlo, lettura-documento.js, fondiMrz). Fuori dall'intervallo: si toglie; dentro,
  // fino a 3 caselle mancanti: caselle ignote.
  const inizi = righe.map(r => centro(r.glifi[0])).sort((a, b) => a - b), fini = righe.map(r => centro(r.glifi[r.glifi.length - 1])).sort((a, b) => a - b);
  const inizio = righe.length >= 3 ? inizi[1] : inizi[inizi.length - 1], fine = righe.length >= 3 ? fini[1] : fini[0];
  for (const r of righe) {
    const tenuti = r.glifi.filter(g => centro(g) >= inizio - passo * 0.6 && centro(g) <= fine + passo * 0.6);
    if (tenuti.length >= r.glifi.length - 4) r.glifi = tenuti;
    if (!r.glifi.length) continue;
    const prima = Math.round((centro(r.glifi[0]) - inizio) / passo), dopo = Math.round((fine - centro(r.glifi[r.glifi.length - 1])) / passo);
    if (prima > 0 && prima <= 3) for (let j = prima; j >= 1; j--) r.glifi.unshift(ignota(centro(r.glifi[0]) - passo, r));
    if (dopo > 0 && dopo <= 3) for (let j = 1; j <= dopo; j++) r.glifi.push(ignota(centro(r.glifi[r.glifi.length - 1]) + passo, r));
  }
}

// Immagine pulita per l'OCR: solo i caratteri delle righe della MRZ, tutto il resto bianco (fondo, disegni, bordo della
// tovaglia che l'OCR leggerebbe come lettere in più). Con `senzaChevron` anche i «<» riconosciuti spariscono: l'OCR legge
// meglio lettere e cifre se non deve indovinare le file di «<» (che si rimettono dopo, dalla forma).
export function soloGlifi(bin, w, h, lab, righe, senzaChevron) {
  const out = new Uint8Array(bin.length).fill(255);
  for (const r of righe) {
    const alt = r.y1 - r.y0 + 1, ya = Math.max(0, Math.round(r.y0 - alt * 0.12)), yb = Math.min(h - 1, Math.round(r.y1 + alt * 0.12));
    for (const g of r.glifi) {
      if (senzaChevron && g.chevron) continue;
      // tutta la casella del carattere (larga un passo): anche i pezzi staccati (la stanghetta di una E, un tratto sbiadito)
      const cx = (g.x0 + g.x1) / 2, x0 = Math.max(0, Math.round(cx - r.passo * 0.5)), x1 = Math.min(w - 1, Math.round(cx + r.passo * 0.5));
      for (let y = ya; y <= yb; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (!bin[i]) out[i] = 0; }
    }
  }
  return out;
}

// Riga della MRZ dai simboli letti dall'OCR (con i loro riquadri): ogni simbolo va nella casella della griglia più vicina.
// Dove l'immagine ha un «<» si scrive «<»; una casella senza simbolo resta «?» (nessun dato inventato).
// Restituisce { testo, conf } (conf: fiducia dell'OCR per ogni casella, 0..100).
export function allineaSimboli(simboli, riga) {
  const celle = riga.glifi.map(g => ({ cx: (g.x0 + g.x1) / 2, g, s: null }));
  const passo = riga.passo || 1, yc = (riga.y0 + riga.y1) / 2, alt = Math.max(1, riga.y1 - riga.y0);
  for (const s of simboli) {
    const t = String(s.text || '').trim();
    if (t.length !== 1) continue;
    const sy = (s.bbox.y0 + s.bbox.y1) / 2;
    if (Math.abs(sy - yc) > alt * 0.75) continue;                 // simbolo di un'altra riga
    const sx = (s.bbox.x0 + s.bbox.x1) / 2;
    let migliore = null, dist = Infinity;
    for (const c of celle) { const d = Math.abs(c.cx - sx); if (d < dist) { dist = d; migliore = c; } }
    if (!migliore || dist > passo * 0.6) continue;
    if (!migliore.s || s.confidence > migliore.s.confidence) migliore.s = { t, confidence: s.confidence };
  }
  const testo = celle.map((c, i) => c.g.chevron ? '<' : c.s ? (c.g.ignoto && vicinoChevron(riga.glifi, i) && CONFONDIBILI.includes(c.s.t) ? '<' : c.s.t) : '?').join('');
  return { testo, conf: celle.map(c => c.g.chevron ? 100 : c.s ? Math.max(1, c.s.confidence) : 0) };
}

// Allinea il testo letto dall'OCR per una riga della MRZ ai caratteri trovati nell'immagine: dove l'immagine ha un «<»
// si scrive «<» (anche se l'OCR ha letto L, K, C…), dove ha un'altra lettera si prende quella letta dall'OCR. Un carattere
// che l'OCR ha saltato resta «?» (la riga non passerà le cifre di controllo: nessun dato inventato).
const CONFONDIBILI = 'LKCEIXZS1(<';
// casella ignota in mezzo a una fila di «<» (o in fondo a una fila): con una L, una K… letta lì è un «<»
const vicinoChevron = (glifi, i) => (i > 0 && glifi[i - 1].chevron) && (i + 1 >= glifi.length || glifi[i + 1].chevron || glifi[i + 1].ignoto);
export function allineaRigaMrz(testo, glifi) {
  const t = String(testo || '').replace(/\s+/g, ''), n = glifi.length, m = t.length;
  const SALTA_GLIFO = 0.8, SALTA_LETTERA = 0.6;
  const costo = (g, c) => g.ignoto ? 0.1 : g.chevron ? (c === '<' ? 0 : CONFONDIBILI.includes(c) ? 0.25 : 0.95) : (c === '<' ? 0.7 : 0);
  const dp = new Float64Array((n + 1) * (m + 1)), da = new Uint8Array((n + 1) * (m + 1));
  const I = (i, j) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) { dp[I(i, 0)] = i * SALTA_GLIFO; da[I(i, 0)] = 1; }
  for (let j = 1; j <= m; j++) { dp[I(0, j)] = j * SALTA_LETTERA; da[I(0, j)] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const a = dp[I(i - 1, j - 1)] + costo(glifi[i - 1], t[j - 1]), b = dp[I(i - 1, j)] + SALTA_GLIFO, c = dp[I(i, j - 1)] + SALTA_LETTERA;
    if (a <= b && a <= c) { dp[I(i, j)] = a; da[I(i, j)] = 0; } else if (b <= c) { dp[I(i, j)] = b; da[I(i, j)] = 1; } else { dp[I(i, j)] = c; da[I(i, j)] = 2; }
  }
  const out = new Array(n);
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const d = da[I(i, j)];
    if (i > 0 && j > 0 && d === 0) { out[i - 1] = glifi[i - 1].chevron ? '<' : glifi[i - 1].ignoto && vicinoChevron(glifi, i - 1) && CONFONDIBILI.includes(t[j - 1]) ? '<' : t[j - 1]; i--; j--; }
    else if (i > 0 && (j === 0 || d === 1)) { out[i - 1] = glifi[i - 1].chevron ? '<' : '?'; i--; }
    else j--;
  }
  return out.join('');
}

// Nitidezza: deviazione del laplaciano su una copia piccola (lato lungo 512) con il contrasto disteso. Valori bassi = foto
// mossa o sfocata (stessa misura e stessa soglia di prima, calcolata sul grigio invece che sulla tela).
export function nitidezza(g, w, h) {
  const f = Math.min(1, 512 / Math.max(w, h)), pw = Math.max(3, Math.round(w * f)), ph = Math.max(3, Math.round(h * f));
  const p = distendi(f < 1 ? riduci(g, w, h, pw, ph) : g);
  let n = 0, s = 0, s2 = 0;
  for (let y = 1; y < ph - 1; y++) for (let x = 1; x < pw - 1; x++) {
    const i = y * pw + x, v = 4 * p[i] - p[i - 1] - p[i + 1] - p[i - pw] - p[i + pw];
    s += v; s2 += v * v; n++;
  }
  p.fill(0);
  return n ? Math.sqrt(s2 / n - (s / n) * (s / n)) : 0;
}
