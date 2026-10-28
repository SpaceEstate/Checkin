// api/_sessione-checkin.js — riconosce le sessioni di pagamento create dal check-in.
//
// Lo stesso account Stripe incassa anche le prenotazioni del sito (La Columbera), e Stripe consegna a OGNI webhook registrato gli eventi
// di TUTTI i pagamenti dell'account. Il check-in elabora solo le proprie sessioni, riconoscibili dal metadato "dataCheckin"
// (obbligatorio in crea-pagamento-stripe.js, assente nelle sessioni del sito di prenotazione). Le altre vanno ignorate senza errore:
// altrimenti un pagamento di prenotazione verrebbe trattato come check-in (email di benvenuto e registro tecnico a vuoto).
export const eSessioneCheckin = session => !!(session && session.metadata && session.metadata.dataCheckin);
