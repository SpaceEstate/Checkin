// tests/browser/genera-documenti.cjs — genera le foto SINTETICHE dei documenti usate dalle prove della scansione.
// Dati interamente di fantasia (persone, numeri, codici), scritta «FAC-SIMILE · DATI DI FANTASIA» su ogni documento:
// non sono riproduzioni di documenti reali. Le immagini prodotte sono in tests/browser/documenti-sintetici/ (nel repository,
// così le prove danno lo stesso risultato su ogni computer: i caratteri installati cambiano da una macchina all'altra).
// Uso: node tests/browser/genera-documenti.cjs   (serve Playwright con Chromium)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIR = path.join(__dirname, 'documenti-sintetici');
const cd = s => String([...s].reduce((a, c, i) => a + (c === '<' ? 0 : /\d/.test(c) ? +c : c.charCodeAt(0) - 55) * [7, 3, 1][i % 3], 0) % 10);
const nomi = (cognome, nome) => cognome.replace(/ /g, '<') + '<<' + nome.replace(/ /g, '<');
function td3({ tipo = 'P<', stato, cognome, nome, numero, cittadinanza = stato, nascita, sesso, scadenza, personale = '' }) {
  const l1 = (tipo + stato.padEnd(3, '<') + nomi(cognome, nome)).padEnd(44, '<').slice(0, 44);
  const num = numero.padEnd(9, '<'), pers = personale.padEnd(14, '<'), pcd = personale ? cd(pers) : '<';
  const l2 = num + cd(num) + cittadinanza.padEnd(3, '<') + nascita + cd(nascita) + sesso + scadenza + cd(scadenza) + pers + pcd;
  return [l1, l2 + cd(num + cd(num) + nascita + cd(nascita) + scadenza + cd(scadenza) + pers + pcd)];
}
function td1({ tipo = 'I<', stato, cognome, nome, numero, cittadinanza = stato, nascita, sesso, scadenza, facoltativi1 = '' }) {
  const num = numero.padEnd(9, '<');
  const l1 = (tipo + stato.padEnd(3, '<') + num + cd(num) + facoltativi1).padEnd(30, '<').slice(0, 30);
  const l2a = nascita + cd(nascita) + sesso + scadenza + cd(scadenza) + cittadinanza.padEnd(3, '<') + '<'.repeat(11);
  const l2 = l2a + cd(l1.slice(5, 30) + l2a.slice(0, 7) + l2a.slice(8, 15) + l2a.slice(18, 29));
  return [l1, l2, nomi(cognome, nome).padEnd(30, '<').slice(0, 30)];
}
// codice fiscale di fantasia con il carattere di controllo giusto
const DISPARI = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };
const cf = b => b + String.fromCharCode(65 + [...b].reduce((s, c, i) => s + (i % 2 === 0 ? DISPARI[c] : (/\d/.test(c) ? +c : c.charCodeAt(0) - 65)), 0) % 26);

const FAC = '<div class="fac">FAC-SIMILE · DATI DI FANTASIA · SPECIMEN</div>';
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #444; }
  .foto { width: 1600px; height: 1150px; display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 30% 20%, #8a7f72, #4d453d 70%); }
  .doc { position: relative; border-radius: 34px; box-shadow: 0 30px 60px rgba(0,0,0,.45); transform: rotate(-1.2deg); overflow: hidden;
         font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; color: #1d2430; }
  .card { width: 1280px; height: 807px; }
  .pagina { width: 1400px; height: 985px; border-radius: 18px; }
  .fac { position: absolute; right: 40px; top: 18px; font-size: 20px; letter-spacing: 2px; color: rgba(160, 20, 20, .55); font-weight: bold; }
  .etichetta { font-size: 21px; color: #44506a; letter-spacing: .5px; }
  .valore { font-size: 38px; font-weight: bold; letter-spacing: 1px; margin-bottom: 14px; }
  .foto-tessera { position: absolute; background: linear-gradient(160deg, #c9ced6, #9aa3b0); border-radius: 10px; }
  .mrz { position: absolute; left: 0; right: 0; font-family: 'DejaVu Sans Mono', 'Liberation Mono', monospace; color: #111; white-space: pre; text-align: center; }
  .mrz.td1 { bottom: 52px; font-size: 52px; letter-spacing: 6.6px; line-height: 70px; }
  .mrz.td3 { bottom: 40px; font-size: 40px; letter-spacing: 4.6px; line-height: 64px; }
`;
const mrz = (righe, cls) => `<div class="mrz ${cls}">${righe.join('\n').replace(/</g, '&lt;')}</div>`;

const DOCUMENTI = {
  // CIE: responsabile, nata a Roma
  'cie-fronte': `<div class="doc card" style="background: linear-gradient(120deg, #e8eef6, #f6f1e8 55%, #e9e3f2);">${FAC}
    <div style="position:absolute;left:60px;top:40px;font-size:30px;font-weight:bold;letter-spacing:2px;color:#23395d">REPUBBLICA ITALIANA</div>
    <div style="position:absolute;left:60px;top:84px;font-size:22px;color:#23395d">MINISTERO DELL'INTERNO</div>
    <div style="position:absolute;left:60px;top:122px;font-size:26px;font-weight:bold;color:#23395d">CARTA DI IDENTITÀ / IDENTITY CARD</div>
    <div style="position:absolute;right:60px;top:84px;font-size:40px;font-weight:bold;color:#a01818;letter-spacing:3px">CA12345XY</div>
    <div class="foto-tessera" style="left:60px;top:190px;width:300px;height:390px"></div>
    <div style="position:absolute;left:410px;top:185px;right:40px">
      <div class="etichetta">COGNOME / SURNAME</div><div class="valore">PROVACCIA</div>
      <div class="etichetta">NOME / NAME</div><div class="valore">ERMENEGILDA</div>
      <div class="etichetta">LUOGO E DATA DI NASCITA / PLACE AND DATE OF BIRTH</div><div class="valore">ROMA (RM) 19.04.1980</div>
      <div class="etichetta">SESSO / SEX &nbsp;&nbsp; STATURA / HEIGHT &nbsp;&nbsp; CITTADINANZA / NATIONALITY</div><div class="valore">F &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 165 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ITA</div>
      <div class="etichetta">EMISSIONE / ISSUING &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SCADENZA / EXPIRY</div><div class="valore">19.04.2021 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 19.04.2031</div>
    </div></div>`,
  'cie-retro': `<div class="doc card" style="background: linear-gradient(120deg, #eef2f7, #f6f1e8 60%, #ece6f3);">${FAC}
    <div style="position:absolute;left:60px;top:60px;right:60px">
      <div class="etichetta">CODICE FISCALE / FISCAL CODE</div><div class="valore">${cf('PRVRNG80D59H501')}</div>
      <div class="etichetta">INDIRIZZO DI RESIDENZA / RESIDENCE</div><div class="valore" style="font-size:30px">VIA DELLE PROVE 1, ROMA (RM)</div>
      <div class="etichetta">ESTREMI ATTO DI NASCITA</div><div class="valore" style="font-size:30px">00001 1 A 1980</div>
    </div>
    ${mrz(td1({ tipo: 'CI', stato: 'ITA', cognome: 'PROVACCIA', nome: 'ERMENEGILDA', numero: 'CA12345XY', nascita: '800419', sesso: 'F', scadenza: '310419' }), 'td1')}</div>`,
  // passaporto tedesco (codice «D»)
  'passaporto-de': `<div class="doc pagina" style="background: linear-gradient(135deg, #f3efe2, #e7eef0);">${FAC}
    <div style="position:absolute;left:50px;top:36px;font-size:30px;font-weight:bold;letter-spacing:3px;color:#5a2d2d">REISEPASS / PASSPORT / PASSEPORT</div>
    <div style="position:absolute;left:50px;top:80px;font-size:22px;color:#5a2d2d">BUNDESREPUBLIK DEUTSCHLAND</div>
    <div class="foto-tessera" style="left:50px;top:150px;width:330px;height:430px"></div>
    <div style="position:absolute;left:430px;top:140px;right:40px">
      <div class="etichetta">1. Name / Surname / Nom</div><div class="valore">PROVACCIA</div>
      <div class="etichetta">2. Vornamen / Given names / Prénoms</div><div class="valore">TEODORICO</div>
      <div class="etichetta">3. Staatsangehörigkeit / Nationality</div><div class="valore">DEUTSCH</div>
      <div class="etichetta">4. Geburtstag / Date of birth</div><div class="valore">10.11.2010</div>
      <div class="etichetta">5. Geschlecht / Sex / Sexe &nbsp;&nbsp;&nbsp; 6. Geburtsort / Place of birth</div><div class="valore">M &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; BERLIN</div>
      <div class="etichetta">8. Gültig bis / Date of expiry</div><div class="valore">01.01.2030</div>
    </div>
    ${mrz(td3({ stato: 'D', cittadinanza: 'D', cognome: 'PROVACCIA', nome: 'TEODORICO', numero: 'C01X00T47', nascita: '101110', sesso: 'M', scadenza: '300101' }), 'td3')}</div>`,
  // carta d'identità straniera (Spagna, TD1)
  'carta-estera-es': `<div class="doc card" style="background: linear-gradient(120deg, #f4ece4, #e8eff6);">${FAC}
    <div style="position:absolute;left:60px;top:44px;font-size:28px;font-weight:bold;letter-spacing:2px;color:#7a1d1d">REINO DE ESPAÑA · DOCUMENTO NACIONAL DE IDENTIDAD</div>
    <div class="foto-tessera" style="left:60px;top:120px;width:260px;height:330px"></div>
    <div style="position:absolute;left:370px;top:110px;right:40px">
      <div class="etichetta">APELLIDOS / SURNAME</div><div class="valore">ESEMPIO</div>
      <div class="etichetta">NOMBRE / NAME</div><div class="valore">LUCIA</div>
    </div>
    ${mrz(td1({ tipo: 'ID', stato: 'ESP', cognome: 'ESEMPIO', nome: 'LUCIA', numero: 'BAA012345', nascita: '920721', sesso: 'F', scadenza: '320721' }), 'td1')}</div>`,
  // patente UE italiana (nessuna MRZ, campi numerati)
  'patente-it': `<div class="doc card" style="background: linear-gradient(120deg, #f7e9ee, #eef3f7 60%, #f3eee4);">${FAC}
    <div style="position:absolute;left:60px;top:40px;width:120px;height:140px;background:#233c8c;border-radius:8px;color:#fff;font-size:56px;font-weight:bold;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px">I</div>
    <div style="position:absolute;left:210px;top:46px;font-size:36px;font-weight:bold;color:#7a1d3a;letter-spacing:2px">PATENTE DI GUIDA</div>
    <div style="position:absolute;left:210px;top:98px;font-size:24px;color:#7a1d3a">REPUBBLICA ITALIANA</div>
    <div class="foto-tessera" style="left:60px;top:230px;width:280px;height:360px"></div>
    <div style="position:absolute;left:390px;top:215px;right:40px;font-size:36px;font-weight:bold;line-height:62px">
      <div>1. PROVACCIA</div><div>2. BERTOLDO</div><div>3. 05/03/75 MILANO (MI)</div>
      <div>4a. 12/06/2018 &nbsp;&nbsp; 4c. MIT-UCO</div><div>4b. 05/03/2028</div><div>5. U1A23B456C</div><div>9. B</div>
    </div></div>`,
  // carta d'identità cartacea (pagina interna)
  'carta-cartacea-it': `<div class="doc pagina" style="background: linear-gradient(135deg, #efe6cf, #f5eedb); font-family: 'DejaVu Serif', serif;">${FAC}
    <div style="position:absolute;left:60px;top:40px;font-size:30px;font-weight:bold;letter-spacing:2px">REPUBBLICA ITALIANA</div>
    <div style="position:absolute;left:60px;top:86px;font-size:28px;font-weight:bold">CARTA D'IDENTITÀ</div>
    <div style="position:absolute;right:60px;top:86px;font-size:34px;font-weight:bold;color:#a01818">N. AX 1234567</div>
    <div class="foto-tessera" style="left:60px;top:170px;width:300px;height:390px"></div>
    <div style="position:absolute;left:420px;top:170px;right:40px;font-size:34px;line-height:64px">
      <div>COGNOME &nbsp; <b>PROVACCIA</b></div><div>NOME &nbsp; <b>CLOTILDE</b></div><div>NATA IL &nbsp; <b>15/01/2004</b></div>
      <div>(ATTO N. 123 P. I S. A)</div><div>A &nbsp; <b>REGGIO NELL'EMILIA (RE)</b></div><div>CITTADINANZA &nbsp; <b>ITALIANA</b></div>
      <div>RESIDENZA &nbsp; <b>REGGIO NELL'EMILIA</b></div><div>VIA &nbsp; <b>DELLE PROVE 2</b></div>
    </div></div>`
};

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [nome, html] of Object.entries(DOCUMENTI)) {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body><div class="foto">${html}</div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.locator('.foto').screenshot({ type: 'jpeg', quality: 88 });
    fs.writeFileSync(path.join(DIR, nome + '.jpg'), buf);
    console.log(nome + '.jpg', Math.round(buf.length / 1024) + ' KB');
  }
  await browser.close();
})();
