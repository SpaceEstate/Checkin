'use strict';
// tests/browser/pdf-di-prova.cjs — PDF di prova costruiti al momento dai documenti sintetici (nel repository nessun PDF di documenti).
// Ogni pagina ha le sue immagini JPEG (inserite così come sono, filtro DCTDecode) messe dove si vuole: una foto per pagina, oppure
// fronte e retro su un foglio A4, come una scansione.

// Larghezza e altezza di un JPEG (marcatore SOFn)
function dimensioniJpeg(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error('JPEG senza dimensioni');
}

// pagine: [{ larghezza, altezza (punti), immagini: [{ jpeg: Buffer, x, y, w, h (punti, origine in basso a sinistra) }] }]
function pdfDaJpeg(pagine) {
  const oggetti = [];
  const aggiungi = contenuto => { oggetti.push(contenuto); return oggetti.length; };
  const catalogo = aggiungi(null), radice = aggiungi(null), figli = [];
  for (const p of pagine) {
    const risorse = [], disegno = [];
    p.immagini.forEach((im, n) => {
      const { w, h } = dimensioniJpeg(im.jpeg);
      const testa = Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`);
      const num = aggiungi(Buffer.concat([testa, im.jpeg, Buffer.from('\nendstream')]));
      risorse.push(`/Im${n} ${num} 0 R`);
      disegno.push(`q ${im.w.toFixed(2)} 0 0 ${im.h.toFixed(2)} ${im.x.toFixed(2)} ${im.y.toFixed(2)} cm /Im${n} Do Q`);
    });
    const flusso = Buffer.from(disegno.join('\n'));
    const contenuto = aggiungi(Buffer.concat([Buffer.from(`<< /Length ${flusso.length} >>\nstream\n`), flusso, Buffer.from('\nendstream')]));
    figli.push(aggiungi(Buffer.from(`<< /Type /Page /Parent ${radice} 0 R /MediaBox [0 0 ${p.larghezza.toFixed(2)} ${p.altezza.toFixed(2)}] ` +
      `/Resources << /XObject << ${risorse.join(' ')} >> >> /Contents ${contenuto} 0 R >>`)));
  }
  oggetti[catalogo - 1] = Buffer.from(`<< /Type /Catalog /Pages ${radice} 0 R >>`);
  oggetti[radice - 1] = Buffer.from(`<< /Type /Pages /Kids [${figli.map(k => k + ' 0 R').join(' ')}] /Count ${figli.length} >>`);
  const parti = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let pos = parti[0].length;
  const posizioni = [];
  oggetti.forEach((o, i) => {
    posizioni.push(pos);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from('\nendobj\n')]);
    parti.push(b); pos += b.length;
  });
  const xref = ['xref', `0 ${oggetti.length + 1}`, '0000000000 65535 f ', ...posizioni.map(x => String(x).padStart(10, '0') + ' 00000 n ')].join('\n') + '\n';
  parti.push(Buffer.from(`${xref}trailer\n<< /Size ${oggetti.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
  return Buffer.concat(parti);
}

// Una foto per pagina, la pagina della misura della foto a 150 dpi
const PT = 72 / 150;
function pdfUnaFotoPerPagina(jpegs) {
  return pdfDaJpeg(jpegs.map(j => { const { w, h } = dimensioniJpeg(j); return { larghezza: w * PT, altezza: h * PT, immagini: [{ jpeg: j, x: 0, y: 0, w: w * PT, h: h * PT }] }; }));
}

// Scansione su un foglio A4 (595 x 842 punti): fronte in alto e retro sotto. Nelle foto sintetiche la carta è larga l'80% circa
// dell'immagine: l'immagine è larga 303 punti (107 mm), così la carta ha la misura vera (85,6 mm)
function pdfA4FronteRetro(fronte, retro) {
  const posa = (j, y) => { const { w, h } = dimensioniJpeg(j); const larga = 303, alta = larga * h / w; return { jpeg: j, x: 60, y: y - alta, w: larga, h: alta }; };
  return pdfDaJpeg([{ larghezza: 595.28, altezza: 841.89, immagini: [posa(fronte, 841.89 - 60), posa(retro, 841.89 - 60 - 230)] }]);
}

module.exports = { pdfDaJpeg, pdfUnaFotoPerPagina, pdfA4FronteRetro, dimensioniJpeg };
