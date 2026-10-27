// Intervento 3 (informativa e link): controlli statici sulla pagina di check-in. Nessuna rete, nessun servizio reale.
//  - link all'informativa del sito presente e coerente (stesso URL) nel modulo, in ogni passaggio e nella pagina di successo;
//  - la casella "ho letto l'informativa" è una presa visione: non si chiama "consenso" e non viene inviata al server;
//  - testi nuovi presenti in tutte le lingue; nessun preconnect verso server di terzi non necessari;
//  - copie in public/ identiche agli originali (build.sh le sovrascrive comunque); nessun file locale mancante.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PRIVACY_URL = 'https://la-columbera.vercel.app/privacy.html';

test('informativa: link presente nel modulo, in ogni passaggio e nella pagina di successo (stesso URL)', () => {
  const idx = read('index.html'), ok = read('successo-pagamento.html');
  const links = s => [...s.matchAll(/href="([^"]*privacy[^"]*)"/g)].map(m => m[1]);
  assert.ok(links(idx).length >= 2, 'index.html: link nel passaggio finale e nel piè di pagina');
  assert.ok(links(ok).length >= 1, 'successo-pagamento.html: link mancante');
  for (const u of links(idx).concat(links(ok))) assert.equal(u, PRIVACY_URL);
  // il piè di pagina sta fuori dai passaggi del modulo, quindi è visibile in tutti
  const form = idx.slice(idx.indexOf('<form'), idx.indexOf('</form>'));
  assert.ok(idx.slice(idx.indexOf('</form>')).includes(PRIVACY_URL), 'link fuori dal modulo (visibile in ogni passaggio)');
  assert.ok(form.includes(PRIVACY_URL), 'link accanto alla casella del passaggio finale');
  if (process.env.LACOLUMBERA_DIR) assert.ok(fs.existsSync(path.join(process.env.LACOLUMBERA_DIR, 'privacy.html')), 'privacy.html esiste nel repo LaColumbera');
});

test('presa visione: non è un consenso e non viene inviata né registrata', () => {
  const idx = read('index.html'), js = read('checkin.js');
  assert.ok(!/consent/i.test(idx), 'index.html: niente "consent"');
  assert.ok(idx.includes('id="privacy-presa-visione"') && js.includes("getElementById('privacy-presa-visione')"));
  const i = js.indexOf('async function raccogliDatiPrenotazioneConCompressione'), body = js.slice(i, js.indexOf('\nasync function', i + 10) > 0 ? js.indexOf('\nasync function', i + 10) : i + 8000);
  assert.ok(i > 0 && !/privacy/i.test(body), 'i dati inviati al server non contengono la casella privacy');
});

test('testi: chiavi nuove presenti in it/en/de; informativa breve coerente con il flusso reale', () => {
  const ctx = { window: {}, document: { querySelectorAll: () => [], documentElement: {}, addEventListener() {} }, localStorage: undefined, console };
  vm.createContext(ctx);
  vm.runInContext(read('i18n.js') + '\n;this.__UI = I18N_UI;', ctx);
  const UI = ctx.__UI;
  for (const l of ['it', 'en', 'de']) for (const k of ['stepFinal.infoBreve', 'footer.privacy', 'stepFinal.privacyText', 'guest.subtitle', 'guest.documentoAvvisoIdentita', 'notif.privacyRichiesta', 'notif.privacyAccettata'])
    assert.ok(UI[l] && typeof UI[l][k] === 'string' && UI[l][k].length > 0, l + ': ' + k);
  const it = UI.it;
  assert.ok(!/accett|consenso/i.test(it['notif.privacyAccettata'] + it['notif.privacyRichiesta'] + it['stepFinal.privacyText']), 'nessun "accetto"/"consenso" per una presa visione');
  for (const w of ['Questura', 'imposta di soggiorno', 'Stripe', 'Browserless', 'Stati Uniti', '24 ore', 'non è un consenso']) assert.ok(it['stepFinal.infoBreve'].includes(w), 'informativa breve: ' + w);
  assert.ok(/non sostituisce/i.test(it['guest.documentoAvvisoIdentita']), "l'immagine non sostituisce il controllo del documento originale");
});

test('nessun preconnect verso Stripe (la pagina non carica script di Stripe)', () => {
  const idx = read('index.html');
  assert.ok(!/rel="(preconnect|dns-prefetch)"[^>]*stripe/i.test(idx));
  assert.ok(!/<script[^>]+stripe/i.test(idx));
});

test('copie in public/ identiche e nessun file locale mancante', () => {
  for (const f of ['index.html', 'checkin.css', 'checkin.js', 'i18n.js', 'successo-pagamento.html']) assert.equal(read('public/' + f), read(f), 'public/' + f);
  for (const f of ['index.html', 'successo-pagamento.html']) for (const m of read(f).matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1]; if (/^(https?:|mailto:|tel:|#|data:)/.test(u)) continue;
    const p = u.split('?')[0].split('#')[0]; if (!p) continue;
    assert.ok(fs.existsSync(path.join(ROOT, p)) || fs.existsSync(path.join(ROOT, 'public', p)), f + ': ' + u);
  }
});
