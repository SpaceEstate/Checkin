// api/_imposta-soggiorno.js — la regola dell'imposta di soggiorno, in un solo posto per il server (il prefisso "_" evita che Vercel lo
// esponga come endpoint). Il modulo (checkin.js) ne ha una copia con gli stessi valori: una prova (tests/pagamenti.test.mjs) controlla che
// coincidano.
//
// 14/11/2026, conferma del titolare (imposta provinciale di soggiorno del Trentino):
//  - 1,50 € a notte per ogni ospite di almeno 14 anni: i minori di 14 anni sono esenti;
//  - al massimo 10 notti per ospite: oltre la decima non si paga altro.
// Prima: dai 4 anni, nessun tetto di notti.
export const TASSA_PER_NOTTE = 1.50;
export const ETA_MINIMA_IMPOSTA = 14;
export const NOTTI_MASSIME_IMPOSTA = 10;

export const eSoggettoImposta = eta => Number.isFinite(eta) && eta >= ETA_MINIMA_IMPOSTA;

// Totale in euro: ospiti soggetti × notti tassate (al più NOTTI_MASSIME_IMPOSTA) × tassa a notte, arrotondato al centesimo.
export function totaleImposta(ospitiSoggetti, notti) {
  const n = Math.min(parseInt(notti, 10) || 0, NOTTI_MASSIME_IMPOSTA);
  return Math.round(ospitiSoggetti * n * TASSA_PER_NOTTE * 100) / 100;
}
