// ============================================================
// i18n.js — La Columbera Check-in — traduzioni IT / EN / DE
// Caricare questo file PRIMA di checkin.js (e prima dello script
// inline di successo-pagamento.html). Non è un modulo ES: tutte
// le funzioni/costanti sono nello scope globale condiviso dagli
// script classici della pagina.
// ============================================================

const I18N_UI = {
  it: {
    "meta.title": "Check-in Ospiti",
    "meta.description": "Completa la registrazione per il tuo soggiorno",
    "header.title": "Check-in Ospiti",
    "header.subtitle": "Completa la registrazione per il tuo soggiorno",
    "lang.switchLabel": "Lingua",
    "lang.it": "Italiano",
    "lang.en": "Inglese",
    "lang.de": "Tedesco",
    "step0.title": "Verifica prenotazione",
    "step0.subtitle": "Inserisci il tuo numero di prenotazione per iniziare",
    "step0.label": "Numero prenotazione",
    "step0.placeholder": "Es. BK12345",
    "step0.noBooking": "Non ho il numero di prenotazione",
    "step0.verifyBtn": "Verifica e continua →",
    "step0.verifyingBtn": "⏳ Verifica in corso...",
    "step1.title": "Informazioni generali",
    "step1.subtitle": "Inserisci i dettagli della tua prenotazione",
    "step1.dateLabel": "Data check-in",
    "step1.apartmentLabel": "Appartamento/i *",
    "step1.guestsLabel": "Numero ospiti",
    "step1.guestsPlaceholder": "Seleziona numero",
    "step1.nightsLabel": "Numero notti",
    "step1.nightsPlaceholder": "Es. 3",
    "step1.groupLabel": "Tipo di gruppo",
    "step1.groupPlaceholder": "Seleziona tipo",
    "step1.groupFamily": "Famiglia",
    "step1.groupGeneric": "Gruppo",
    "step1.backBtn": "← Torna indietro",
    "step1.nextBtn": "Avanti →",
    "apt.torreDesc": "2 camere da letto",
    "apt.corteDesc": "1 camera da letto",
    "apt.torreDescLong": "Appartamento con 2 camere da letto",
    "apt.corteDescLong": "Appartamento con 1 camera da letto",
    "guests.n1": "1 ospite",
    "guests.n2": "2 ospiti",
    "guests.n3": "3 ospiti",
    "guests.n4": "4 ospiti",
    "guests.n5": "5 ospiti",
    "guests.n6": "6 ospiti",
    "guests.n7": "7 ospiti",
    "guests.n8": "8 ospiti",
    "guests.n9": "9 ospiti",
    "verify.confirmed": "✓ Dati prenotazione verificati",
    "verify.selectGroupType": "Seleziona il tipo di gruppo",
    "verify.reviewAndProceed": "Verifica i dati e prosegui",
    "notif.numeroMancante": "Inserisci un numero di prenotazione",
    "notif.ricercaInCorso": "🔍 Ricerca prenotazione in corso...",
    "notif.prenotazioneTrovata": "✅ Prenotazione trovata!",
    "notif.prenotazioneNonTrovata": "❌ Numero di prenotazione non trovato. Verifica il codice o procedi con inserimento manuale.",
    "notif.erroreVerifica": "Errore nella verifica. Riprova o procedi con inserimento manuale.",
    "notif.compilaManualmente": "Compila manualmente i dati della prenotazione",
    "notif.erroreRiepilogoCaricamento": "Errore nel caricamento del riepilogo. Ricarica la pagina.",
    "notif.erroreRiepilogoVisualizzazione": "Errore nella visualizzazione del riepilogo",
    "notif.maxOspiti": "Con l'appartamento selezionato il massimo è {max} ospiti. Seleziona di nuovo il numero.",
    "notif.privacyAccettata": "✅ Presa visione confermata",
    "notif.fileTroppoGrande": "📦 File troppo grande: {size} MB\nLimite massimo: 20 MB\n\n💡 Suggerimenti:\n• Scatta una nuova foto invece di scegliere un file esistente\n• Comprimi la foto prima di caricarla",
    "notif.formatoNonSupportato": "Formato file non supportato. Usa: JPG, PNG, WebP o PDF",
    "notif.documentoCaricato": "Documento caricato correttamente",
    "notif.latoCaricatoProsegui": "✅ {lato} caricato — ora carica il {mancante}",
    "notif.documentiCompleti": "✅ Fronte e retro caricati",
    "notif.documentoCompleto": "✅ Documento caricato",
    "notif.fotocameraAttivata": "Fotocamera attivata. Posiziona il documento nel riquadro",
    "notif.fotocameraFrontale": "Fotocamera frontale attivata",
    "notif.fotocameraErrore": "Impossibile accedere alla fotocamera: {msg}",
    "notif.erroreCattura": "Errore nella cattura della foto",
    "notif.fotoTroppoPesante": "⚠️ Foto troppo pesante\nProva a scattare da più lontano o con meno luce",
    "notif.fotoAcquisita": "✅ Foto acquisita",
    "notif.privacyRichiesta": "⚠️ Per procedere conferma di aver letto l'informativa privacy",
    "notif.raccoltaDocumenti": "📦 Raccolta documenti in corso...",
    "notif.documentiGrandi": "⚠️ Documenti molto grandi, il salvataggio potrebbe richiedere più tempo...",
    "notif.pagamentoAnnullato": "Pagamento annullato. Puoi riprovare quando vuoi.",
    "notif.caricamentoDocResponsabile": "📄 Caricamento documento responsabile...",
    "notif.docResponsabileCaricato": "✅ Documento del responsabile caricato",
    "confirm.tornaVerifica": "Vuoi tornare alla schermata di verifica? I dati precompilati rimarranno.",
    "confirm.conferma": "Conferma",
    "confirm.annulla": "Annulla",
    "valid.dataRichiesta": "Seleziona la data di check-in",
    "valid.dataPassato": "La data di check-in non può essere nel passato",
    "valid.appartamentoRichiesto": "Seleziona almeno un appartamento",
    "valid.ospitiRichiesti": "Seleziona il numero di ospiti",
    "valid.nottiNonValide": "Inserisci un numero di notti valido (minimo 1)",
    "valid.tipoGruppoRichiesto": "Seleziona il tipo di gruppo",
    "field.cognome": "Cognome",
    "field.nome": "Nome",
    "field.genere": "Genere",
    "field.dataNascita": "Data di nascita",
    "field.cittadinanza": "Cittadinanza",
    "field.luogoNascita": "Luogo di nascita",
    "field.tipoDocumento": "Tipo documento",
    "field.numeroDocumento": "Numero documento",
    "field.luogoRilascio": "Luogo rilascio documento",
    "valid.campoObbligatorio": "{campo} è obbligatorio per l'ospite {n}",
    "valid.comuneProvinciaObbligatori": "Comune e provincia sono obbligatori per ospiti nati in Italia",
    "valid.maggiorenne": "Il responsabile deve essere maggiorenne (18+ anni)",
    "valid.documentoRichiesto": "È necessario caricare un documento per il responsabile",
    "valid.latoMancante": "Documento incompleto: manca il {lato}",
    "valid.latoMancanteResponsabile": "Manca il {lato} del documento del responsabile",
    "valid.dataMancante": "Data di check-in mancante",
    "valid.appartamentoMancante": "Nessun appartamento selezionato",
    "valid.ospitiNonValidi": "Numero ospiti non valido",
    "valid.nomeCognomeMancante": "Nome/cognome mancante per ospite {n}",
    "valid.dataNascitaMancante": "Data di nascita mancante per {nome} {cognome}",
    "valid.genereMancante": "Genere mancante per {nome} {cognome}",
    "valid.cittadinanzaMancante": "Cittadinanza mancante per {nome} {cognome}",
    "valid.luogoNascitaMancante": "Luogo di nascita mancante per {nome} {cognome}",
    "valid.comuneProvinciaMancanti": "Comune e provincia mancanti per {nome} {cognome} (nato in Italia)",
    "valid.documentoIncompleto": "Dati documento del responsabile incompleti",
    "valid.documentoMancanteResponsabile": "Documento mancante per il responsabile",
    "guest.title": "Ospite {n}",
    "guest.responsabileTag": " (Responsabile)",
    "guest.subtitle": "I campi con * sono richiesti dalla legge per la comunicazione obbligatoria degli ospiti alla Questura (art. 109 TULPS): senza questi dati non possiamo registrare il soggiorno.",
    "guest.cognome": "Cognome *",
    "guest.nome": "Nome *",
    "guest.genere": "Genere *",
    "guest.selezionaGenere": "Seleziona genere",
    "guest.maschio": "Maschio",
    "guest.femmina": "Femmina",
    "guest.dataNascita": "Data di nascita *",
    "guest.cittadinanza": "Cittadinanza *",
    "guest.selezionaCittadinanza": "Seleziona cittadinanza",
    "guest.luogoNascita": "Luogo di nascita *",
    "guest.selezionaLuogoNascita": "Seleziona luogo nascita",
    "guest.comune": "Comune *",
    "guest.comunePlaceholder": "Es. Napoli",
    "guest.provincia": "Provincia *",
    "guest.selezionaProvincia": "Seleziona provincia",
    "guest.tipoDocumento": "Tipo documento *",
    "guest.selezionaTipoDocumento": "Seleziona tipo documento",
    "guest.numeroDocumento": "Numero documento *",
    "guest.luogoRilascio": "Luogo rilascio documento *",
    "guest.selezionaLuogoRilascio": "Seleziona luogo rilascio",
    "guest.documentoTitolo": "📄 Documento di identità",
    "guest.documentoSottotitolo": "Servono due file: il fronte e il retro del documento (foto o PDF). Con il passaporto basta la pagina con i dati.",
    "guest.latoFronte": "Fronte",
    "guest.latoRetro": "Retro",
    "guest.latoFronteHint": "Il lato con la foto",
    "guest.latoRetroHint": "Il lato opposto",
    "guest.latoRetroPassaporto": "Non serve con il passaporto",
    "guest.facoltativo": "Facoltativo",
    "guest.fotografaFronte": "📷 Fotografa il fronte",
    "guest.fotografaRetro": "📷 Fotografa il retro",
    "guest.statoDocumenti": "{n} di {tot} file caricati",
    "guest.documentoCompleto": "✅ Documento caricato",
    "guest.documentiCompleti": "✅ Fronte e retro caricati",
    "guest.scegliFile": "📎 Scegli file",
    "guest.fotografaDocumento": "📷 Fotografa documento",
    "guest.scatta": "📸 Scatta",
    "guest.chiudi": "✕ Chiudi",
    "guest.backBtn": "← Indietro",
    "guest.nextBtnMore": "Prossimo ospite →",
    "guest.nextBtnSummary": "Vai al riepilogo →",
    "summary.dettagliTitle": "📍 Dettagli soggiorno",
    "summary.dataCheckin": "Data Check-in:",
    "summary.appartamenti": "Appartamento/i:",
    "summary.numeroOspiti": "Numero ospiti:",
    "summary.numeroNotti": "Numero notti:",
    "summary.ospitiTitle": "👥 Ospiti",
    "summary.responsabile": "(Responsabile)",
    "summary.etaSoggetta": "Età: {eta} anni (soggetto a tassa)",
    "summary.etaEsente": "Età: {eta} anni (esente)",
    "summary.totaleTitle": "💰 Totale tassa di soggiorno",
    "summary.totaleNota": "Tassa di €1,50 per notte per ospiti dai 4 anni in su",
    "stepFinal.title": "Riepilogo e pagamento",
    "stepFinal.subtitle": "Verifica i dati e procedi al pagamento",
    "stepFinal.summaryTitle": "Riepilogo prenotazione",
    "stepFinal.privacyText": "Dichiaro di aver letto l'informativa privacy.",
    "stepFinal.backBtn": "← Indietro",
    "stepFinal.payBtnInitial": "Procedi al pagamento",
    "payment.payButton": "💳 Paga €{amount} con Stripe",
    "payment.verificaDati": "⏳ Verifica dei dati...",
    "guest.comuneEtichetta": "Comune di nascita",
    "guest.documentoAvvisoIdentita": "L'immagine del documento viene inviata via email al gestore solo per controllare i dati da comunicare alla Questura e viene cancellata entro 24 ore dalla registrazione. Non sostituisce il controllo del documento originale.",
    "alloggiati.comuneNonTrovato": "Ospite {n}: il comune di nascita non risulta nell'elenco ufficiale per la provincia scelta. Scrivilo per intero, come sul documento.",
    "alloggiati.suggerimenti": " Possibili corrispondenze: {elenco}.",
    "alloggiati.caratteriNonAmmessi": "Ospite {n}: il campo «{campo}» contiene caratteri non accettati per la comunicazione alla Questura (nome e cognome: solo lettere, spazi e apostrofo; numero documento: lettere e cifre).",
    "alloggiati.troppoLungo": "Ospite {n}: il campo «{campo}» è troppo lungo per la comunicazione alla Questura.",
    "alloggiati.altriProblemi": "(Ci sono altri {quanti} dati da controllare.)",
    "stepFinal.identitaTitolo": "Verifica dell'identità all'arrivo",
    "stepFinal.identitaTesto": "Compilare questo modulo e inviare la foto del documento non basta per essere identificati. All'arrivo il gestore deve verificare di persona che i documenti originali corrispondano a chi soggiorna (oppure con un collegamento video in tempo reale, se idoneo). Tieni a portata di mano i documenti originali di tutti gli ospiti.",
    "stepFinal.privacyLink": "Leggi l'informativa privacy",
    "stepFinal.infoBreve": "In breve: i dati di tutti gli ospiti servono per la comunicazione obbligatoria alla Questura (portale Alloggiati Web) e, con le date di nascita, per calcolare l'imposta di soggiorno; il pagamento avviene sulla pagina di Stripe. Per controllare i dati, il gestore riceve via email l'immagine del documento e un riepilogo in PDF (generato dal servizio esterno Browserless, su server negli Stati Uniti): queste copie e il foglio di lavoro vengono cancellati entro 24 ore dalla registrazione su Alloggiati Web. I dati non sono usati per altri scopi. Questa conferma non è un consenso: serve solo a dichiarare che hai letto l'informativa.",
    "footer.privacy": "Informativa privacy",
    "payment.preparazioneDati": "⏳ Preparazione dati...",
    "payment.salvataggioDati": "⏳ Salvataggio dati (questo può richiedere fino a 30 secondi)...",
    "payment.creazionePagamento": "⏳ Creazione pagamento...",
    "payment.erroreGenerico": "Si è verificato un problema durante il salvataggio. Riprova tra qualche istante o contatta l'assistenza se il problema persiste.",
    "payment.timeoutSalvataggio": "Timeout nel salvataggio dati (45s). I documenti potrebbero essere troppo grandi. Riprova con foto più piccole.",
    "payment.salvataggioFallito": "Non è stato possibile salvare i dati. Riprova tra qualche istante.",
    "payment.documentoTroppoGrande": "Documento troppo grande anche dopo compressione ({size} KB). {suggerimento}",
    "payment.latoTroppoGrande": "Il file del documento ({lato}) è troppo grande anche dopo compressione ({size} KB). {suggerimento}",
    "payment.suggerimentoPdf": "Prova con una scansione più leggera, o fai una foto del documento invece del PDF.",
    "payment.suggerimentoFoto": "Usa una foto con risoluzione più bassa.",
    "payment.impossibileProcessare": "Impossibile processare il documento. Riprova con un'immagine diversa.",
    "payment.payloadTroppoGrande": "Payload troppo grande ({mb} MB). Riduci la qualità del documento.",
    "success.title": "✅ Check-in completato!",
    "success.line1": "Grazie per aver completato la registrazione.",
    "success.line2": "Ti auguriamo un soggiorno piacevole!",
    "success.refLabel": "Riferimento pratica:",
    "progress.label": "Passo {current} di {total}",

    "successPage.title": "Pagamento riuscito - La Columbera",
    "successPage.mainTitle": "Pagamento completato!",
    "successPage.subtitle": "Grazie per aver completato il check-in e il pagamento della tassa di soggiorno.",
    "successPage.bookingDetailsTitle": "📋 Dettagli prenotazione",
    "successPage.loadingDetails": "Caricamento dettagli...",
    "successPage.codeTitle": "🔑 Codice cassetta sicurezza",
    "successPage.codeNote": "Usa questo codice per accedere al tuo appartamento",
    "successPage.backHome": "🏠 Torna alla Home",
    "successPage.print": "🖨️ Stampa",
    "successPage.checkin": "Check-in:",
    "successPage.apartment": "Appartamento:",
    "successPage.guests": "Ospiti:",
    "successPage.nights": "Notti:",
    "successPage.totalPaid": "Totale pagato:",
    "successPage.sessionNotFound": "Sessione non trovata nell'URL",
    "successPage.dataNotAvailable": "Dati non disponibili",
    "successPage.noDataForSession": "Nessun dato disponibile per questa sessione",
    "successPage.errorLoadingSaved": "Errore nel caricamento dei dati salvati",
    "successPage.codeNotAvailable": "Codice non disponibile, contatta il proprietario",
    "successPage.errorLoadingTitle": "Errore nel caricamento",
    "successPage.unexpectedError": "Si è verificato un errore imprevisto",
  },
  en: {
    "meta.title": "Guest Check-in",
    "meta.description": "Complete the registration for your stay",
    "header.title": "Guest Check-in",
    "header.subtitle": "Complete the registration for your stay",
    "lang.switchLabel": "Language",
    "lang.it": "Italian",
    "lang.en": "English",
    "lang.de": "German",
    "step0.title": "Booking verification",
    "step0.subtitle": "Enter your booking number to get started",
    "step0.label": "Booking number",
    "step0.placeholder": "e.g. BK12345",
    "step0.noBooking": "I don't have my booking number",
    "step0.verifyBtn": "Verify and continue →",
    "step0.verifyingBtn": "⏳ Verifying...",
    "step1.title": "General information",
    "step1.subtitle": "Enter the details of your booking",
    "step1.dateLabel": "Check-in date",
    "step1.apartmentLabel": "Apartment(s) *",
    "step1.guestsLabel": "Number of guests",
    "step1.guestsPlaceholder": "Select a number",
    "step1.nightsLabel": "Number of nights",
    "step1.nightsPlaceholder": "e.g. 3",
    "step1.groupLabel": "Type of group",
    "step1.groupPlaceholder": "Select a type",
    "step1.groupFamily": "Family",
    "step1.groupGeneric": "Group",
    "step1.backBtn": "← Go back",
    "step1.nextBtn": "Next →",
    "apt.torreDesc": "2 bedrooms",
    "apt.corteDesc": "1 bedroom",
    "apt.torreDescLong": "Apartment with 2 bedrooms",
    "apt.corteDescLong": "Apartment with 1 bedroom",
    "guests.n1": "1 guest",
    "guests.n2": "2 guests",
    "guests.n3": "3 guests",
    "guests.n4": "4 guests",
    "guests.n5": "5 guests",
    "guests.n6": "6 guests",
    "guests.n7": "7 guests",
    "guests.n8": "8 guests",
    "guests.n9": "9 guests",
    "verify.confirmed": "✓ Booking details verified",
    "verify.selectGroupType": "Select the type of group",
    "verify.reviewAndProceed": "Review the details and proceed",
    "notif.numeroMancante": "Please enter a booking number",
    "notif.ricercaInCorso": "🔍 Looking up your booking...",
    "notif.prenotazioneTrovata": "✅ Booking found!",
    "notif.prenotazioneNonTrovata": "❌ Booking number not found. Check the code or continue with manual entry.",
    "notif.erroreVerifica": "Error during verification. Try again or continue with manual entry.",
    "notif.compilaManualmente": "Fill in the booking details manually",
    "notif.erroreRiepilogoCaricamento": "Error loading the summary. Please reload the page.",
    "notif.erroreRiepilogoVisualizzazione": "Error displaying the summary",
    "notif.maxOspiti": "With the selected apartment the maximum is {max} guests. Please select the number again.",
    "notif.privacyAccettata": "✅ Confirmed: privacy notice read",
    "notif.fileTroppoGrande": "📦 File too large: {size} MB\nMaximum limit: 20 MB\n\n💡 Suggestions:\n• Take a new photo instead of choosing an existing file\n• Compress the photo before uploading it",
    "notif.formatoNonSupportato": "File format not supported. Use JPG, PNG, WebP or PDF",
    "notif.documentoCaricato": "Document uploaded successfully",
    "notif.latoCaricatoProsegui": "✅ {lato} uploaded — now upload the {mancante}",
    "notif.documentiCompleti": "✅ Front and back uploaded",
    "notif.documentoCompleto": "✅ Document uploaded",
    "notif.fotocameraAttivata": "Camera activated. Position the document within the frame",
    "notif.fotocameraFrontale": "Front camera activated",
    "notif.fotocameraErrore": "Unable to access the camera: {msg}",
    "notif.erroreCattura": "Error capturing the photo",
    "notif.fotoTroppoPesante": "⚠️ Photo too large\nTry taking it from further away or with less light",
    "notif.fotoAcquisita": "✅ Photo captured",
    "notif.privacyRichiesta": "⚠️ To continue, please confirm that you have read the privacy notice",
    "notif.raccoltaDocumenti": "📦 Collecting documents...",
    "notif.documentiGrandi": "⚠️ The documents are quite large, saving may take longer...",
    "notif.pagamentoAnnullato": "Payment cancelled. You can try again whenever you like.",
    "notif.caricamentoDocResponsabile": "📄 Uploading the lead guest's document...",
    "notif.docResponsabileCaricato": "✅ Lead guest's document uploaded",
    "confirm.tornaVerifica": "Do you want to go back to the verification screen? The pre-filled details will stay.",
    "confirm.conferma": "Confirm",
    "confirm.annulla": "Cancel",
    "valid.dataRichiesta": "Select the check-in date",
    "valid.dataPassato": "The check-in date cannot be in the past",
    "valid.appartamentoRichiesto": "Select at least one apartment",
    "valid.ospitiRichiesti": "Select the number of guests",
    "valid.nottiNonValide": "Enter a valid number of nights (minimum 1)",
    "valid.tipoGruppoRichiesto": "Select the type of group",
    "field.cognome": "Last name",
    "field.nome": "First name",
    "field.genere": "Gender",
    "field.dataNascita": "Date of birth",
    "field.cittadinanza": "Citizenship",
    "field.luogoNascita": "Place of birth",
    "field.tipoDocumento": "Document type",
    "field.numeroDocumento": "Document number",
    "field.luogoRilascio": "Document issue place",
    "valid.campoObbligatorio": "{campo} is required for guest {n}",
    "valid.comuneProvinciaObbligatori": "City and province are required for guests born in Italy",
    "valid.maggiorenne": "The lead guest must be an adult (18+ years)",
    "valid.documentoRichiesto": "A document must be uploaded for the lead guest",
    "valid.latoMancante": "Incomplete document: the {lato} is missing",
    "valid.latoMancanteResponsabile": "The {lato} of the lead guest's document is missing",
    "valid.dataMancante": "Check-in date missing",
    "valid.appartamentoMancante": "No apartment selected",
    "valid.ospitiNonValidi": "Invalid number of guests",
    "valid.nomeCognomeMancante": "First/last name missing for guest {n}",
    "valid.dataNascitaMancante": "Date of birth missing for {nome} {cognome}",
    "valid.genereMancante": "Gender missing for {nome} {cognome}",
    "valid.cittadinanzaMancante": "Citizenship missing for {nome} {cognome}",
    "valid.luogoNascitaMancante": "Place of birth missing for {nome} {cognome}",
    "valid.comuneProvinciaMancanti": "City and province missing for {nome} {cognome} (born in Italy)",
    "valid.documentoIncompleto": "The lead guest's document details are incomplete",
    "valid.documentoMancanteResponsabile": "Document missing for the lead guest",
    "guest.title": "Guest {n}",
    "guest.responsabileTag": " (Lead guest)",
    "guest.subtitle": "Fields marked * are required by Italian law for the mandatory report of guests to the police (Art. 109 TULPS): without these data we cannot register your stay.",
    "guest.cognome": "Last name *",
    "guest.nome": "First name *",
    "guest.genere": "Gender *",
    "guest.selezionaGenere": "Select gender",
    "guest.maschio": "Male",
    "guest.femmina": "Female",
    "guest.dataNascita": "Date of birth *",
    "guest.cittadinanza": "Citizenship *",
    "guest.selezionaCittadinanza": "Select citizenship",
    "guest.luogoNascita": "Place of birth *",
    "guest.selezionaLuogoNascita": "Select place of birth",
    "guest.comune": "City *",
    "guest.comunePlaceholder": "e.g. Naples",
    "guest.provincia": "Province *",
    "guest.selezionaProvincia": "Select province",
    "guest.tipoDocumento": "Document type *",
    "guest.selezionaTipoDocumento": "Select document type",
    "guest.numeroDocumento": "Document number *",
    "guest.luogoRilascio": "Document issue place *",
    "guest.selezionaLuogoRilascio": "Select issue place",
    "guest.documentoTitolo": "📄 Identity document",
    "guest.documentoSottotitolo": "Two files are required: the front and the back of the document (photo or PDF). For a passport, the data page is enough.",
    "guest.latoFronte": "Front",
    "guest.latoRetro": "Back",
    "guest.latoFronteHint": "The side with the photo",
    "guest.latoRetroHint": "The opposite side",
    "guest.latoRetroPassaporto": "Not needed for a passport",
    "guest.facoltativo": "Optional",
    "guest.fotografaFronte": "📷 Photograph the front",
    "guest.fotografaRetro": "📷 Photograph the back",
    "guest.statoDocumenti": "{n} of {tot} files uploaded",
    "guest.documentoCompleto": "✅ Document uploaded",
    "guest.documentiCompleti": "✅ Front and back uploaded",
    "guest.scegliFile": "📎 Choose file",
    "guest.fotografaDocumento": "📷 Photograph document",
    "guest.scatta": "📸 Capture",
    "guest.chiudi": "✕ Close",
    "guest.backBtn": "← Back",
    "guest.nextBtnMore": "Next guest →",
    "guest.nextBtnSummary": "Go to summary →",
    "summary.dettagliTitle": "📍 Stay details",
    "summary.dataCheckin": "Check-in date:",
    "summary.appartamenti": "Apartment(s):",
    "summary.numeroOspiti": "Number of guests:",
    "summary.numeroNotti": "Number of nights:",
    "summary.ospitiTitle": "👥 Guests",
    "summary.responsabile": "(Lead guest)",
    "summary.etaSoggetta": "Age: {eta} years (subject to tax)",
    "summary.etaEsente": "Age: {eta} years (exempt)",
    "summary.totaleTitle": "💰 Total tourist tax",
    "summary.totaleNota": "Tax of €1.50 per night for guests aged 4 and over",
    "stepFinal.title": "Summary and payment",
    "stepFinal.subtitle": "Review the details and proceed to payment",
    "stepFinal.summaryTitle": "Booking summary",
    "stepFinal.privacyText": "I declare that I have read the privacy notice.",
    "stepFinal.backBtn": "← Back",
    "stepFinal.payBtnInitial": "Proceed to payment",
    "payment.payButton": "💳 Pay €{amount} with Stripe",
    "payment.verificaDati": "⏳ Checking your details...",
    "guest.comuneEtichetta": "City of birth",
    "guest.documentoAvvisoIdentita": "The ID image is emailed to the host only to check the data to be reported to the police and is deleted within 24 hours of registration. It does not replace the check of the original document.",
    "alloggiati.comuneNonTrovato": "Guest {n}: the city of birth is not in the official list for the selected province. Please write it in full, as shown on the document.",
    "alloggiati.suggerimenti": " Possible matches: {elenco}.",
    "alloggiati.caratteriNonAmmessi": "Guest {n}: the field “{campo}” contains characters that are not accepted for the police report (names: letters, spaces and apostrophes only; document number: letters and digits).",
    "alloggiati.troppoLungo": "Guest {n}: the field “{campo}” is too long for the police report.",
    "alloggiati.altriProblemi": "({quanti} more details need checking.)",
    "stepFinal.identitaTitolo": "Identity check on arrival",
    "stepFinal.identitaTesto": "Filling in this form and sending a photo of your ID is not enough to identify you. On arrival the host must check in person that the original documents match the people staying (or through a suitable real-time video connection). Please keep the original ID documents of all guests at hand.",
    "stepFinal.privacyLink": "Read the privacy notice",
    "stepFinal.infoBreve": "In short: the data of all guests are needed for the mandatory report to the police (Alloggiati Web portal) and, with dates of birth, to calculate the tourist tax; payment takes place on Stripe's page. To check the data, the host receives the ID image and a PDF summary by email (generated by the external service Browserless, on servers in the United States): these copies and the working sheet are deleted within 24 hours of registration on Alloggiati Web. The data are not used for any other purpose. This confirmation is not consent: it only states that you have read the notice.",
    "footer.privacy": "Privacy notice",
    "payment.preparazioneDati": "⏳ Preparing data...",
    "payment.salvataggioDati": "⏳ Saving data (this may take up to 30 seconds)...",
    "payment.creazionePagamento": "⏳ Creating payment...",
    "payment.erroreGenerico": "A problem occurred while saving. Please try again shortly or contact support if the problem persists.",
    "payment.timeoutSalvataggio": "Timeout while saving data (45s). The documents may be too large. Try again with smaller photos.",
    "payment.salvataggioFallito": "It was not possible to save the data. Please try again shortly.",
    "payment.documentoTroppoGrande": "Document still too large even after compression ({size} KB). {suggerimento}",
    "payment.latoTroppoGrande": "The document file ({lato}) is still too large even after compression ({size} KB). {suggerimento}",
    "payment.suggerimentoPdf": "Try a lighter scan, or take a photo of the document instead of the PDF.",
    "payment.suggerimentoFoto": "Use a lower-resolution photo.",
    "payment.impossibileProcessare": "Unable to process the document. Try again with a different image.",
    "payment.payloadTroppoGrande": "Payload too large ({mb} MB). Reduce the document quality.",
    "success.title": "✅ Check-in completed!",
    "success.line1": "Thank you for completing your registration.",
    "success.line2": "We wish you a pleasant stay!",
    "success.refLabel": "Booking reference:",
    "progress.label": "Step {current} of {total}",

    "successPage.title": "Payment successful - La Columbera",
    "successPage.mainTitle": "Payment completed!",
    "successPage.subtitle": "Thank you for completing check-in and paying the tourist tax.",
    "successPage.bookingDetailsTitle": "📋 Booking details",
    "successPage.loadingDetails": "Loading details...",
    "successPage.codeTitle": "🔑 Security lockbox code",
    "successPage.codeNote": "Use this code to access your apartment",
    "successPage.backHome": "🏠 Back to Home",
    "successPage.print": "🖨️ Print",
    "successPage.checkin": "Check-in:",
    "successPage.apartment": "Apartment:",
    "successPage.guests": "Guests:",
    "successPage.nights": "Nights:",
    "successPage.totalPaid": "Total paid:",
    "successPage.sessionNotFound": "Session not found in the URL",
    "successPage.dataNotAvailable": "Data not available",
    "successPage.noDataForSession": "No data available for this session",
    "successPage.errorLoadingSaved": "Error loading saved data",
    "successPage.codeNotAvailable": "Code not available, please contact the owner",
    "successPage.errorLoadingTitle": "Error loading data",
    "successPage.unexpectedError": "An unexpected error occurred",
  },
  de: {
    "meta.title": "Gäste-Check-in",
    "meta.description": "Schließen Sie die Anmeldung für Ihren Aufenthalt ab",
    "header.title": "Gäste-Check-in",
    "header.subtitle": "Schließen Sie die Anmeldung für Ihren Aufenthalt ab",
    "lang.switchLabel": "Sprache",
    "lang.it": "Italienisch",
    "lang.en": "Englisch",
    "lang.de": "Deutsch",
    "step0.title": "Buchungsprüfung",
    "step0.subtitle": "Geben Sie Ihre Buchungsnummer ein, um zu beginnen",
    "step0.label": "Buchungsnummer",
    "step0.placeholder": "z. B. BK12345",
    "step0.noBooking": "Ich habe keine Buchungsnummer",
    "step0.verifyBtn": "Prüfen und fortfahren →",
    "step0.verifyingBtn": "⏳ Wird geprüft...",
    "step1.title": "Allgemeine Informationen",
    "step1.subtitle": "Geben Sie die Details Ihrer Buchung ein",
    "step1.dateLabel": "Check-in-Datum",
    "step1.apartmentLabel": "Wohnung(en) *",
    "step1.guestsLabel": "Anzahl der Gäste",
    "step1.guestsPlaceholder": "Anzahl wählen",
    "step1.nightsLabel": "Anzahl der Nächte",
    "step1.nightsPlaceholder": "z. B. 3",
    "step1.groupLabel": "Gruppenart",
    "step1.groupPlaceholder": "Art wählen",
    "step1.groupFamily": "Familie",
    "step1.groupGeneric": "Gruppe",
    "step1.backBtn": "← Zurück",
    "step1.nextBtn": "Weiter →",
    "apt.torreDesc": "2 Schlafzimmer",
    "apt.corteDesc": "1 Schlafzimmer",
    "apt.torreDescLong": "Wohnung mit 2 Schlafzimmern",
    "apt.corteDescLong": "Wohnung mit 1 Schlafzimmer",
    "guests.n1": "1 Gast",
    "guests.n2": "2 Gäste",
    "guests.n3": "3 Gäste",
    "guests.n4": "4 Gäste",
    "guests.n5": "5 Gäste",
    "guests.n6": "6 Gäste",
    "guests.n7": "7 Gäste",
    "guests.n8": "8 Gäste",
    "guests.n9": "9 Gäste",
    "verify.confirmed": "✓ Buchungsdaten bestätigt",
    "verify.selectGroupType": "Wählen Sie die Gruppenart",
    "verify.reviewAndProceed": "Überprüfen Sie die Daten und fahren Sie fort",
    "notif.numeroMancante": "Bitte geben Sie eine Buchungsnummer ein",
    "notif.ricercaInCorso": "🔍 Buchung wird gesucht...",
    "notif.prenotazioneTrovata": "✅ Buchung gefunden!",
    "notif.prenotazioneNonTrovata": "❌ Buchungsnummer nicht gefunden. Überprüfen Sie den Code oder fahren Sie mit der manuellen Eingabe fort.",
    "notif.erroreVerifica": "Fehler bei der Prüfung. Versuchen Sie es erneut oder fahren Sie mit der manuellen Eingabe fort.",
    "notif.compilaManualmente": "Geben Sie die Buchungsdaten manuell ein",
    "notif.erroreRiepilogoCaricamento": "Fehler beim Laden der Übersicht. Bitte laden Sie die Seite neu.",
    "notif.erroreRiepilogoVisualizzazione": "Fehler bei der Anzeige der Übersicht",
    "notif.maxOspiti": "Mit der gewählten Wohnung sind maximal {max} Gäste möglich. Bitte wählen Sie die Anzahl erneut.",
    "notif.privacyAccettata": "✅ Kenntnisnahme bestätigt",
    "notif.fileTroppoGrande": "📦 Datei zu groß: {size} MB\nMaximale Grenze: 20 MB\n\n💡 Tipps:\n• Machen Sie ein neues Foto, anstatt eine vorhandene Datei auszuwählen\n• Komprimieren Sie das Foto vor dem Hochladen",
    "notif.formatoNonSupportato": "Dateiformat nicht unterstützt. Verwenden Sie JPG, PNG, WebP oder PDF",
    "notif.documentoCaricato": "Dokument erfolgreich hochgeladen",
    "notif.latoCaricatoProsegui": "✅ {lato} hochgeladen — jetzt die {mancante} hochladen",
    "notif.documentiCompleti": "✅ Vorder- und Rückseite hochgeladen",
    "notif.documentoCompleto": "✅ Dokument hochgeladen",
    "notif.fotocameraAttivata": "Kamera aktiviert. Positionieren Sie das Dokument im Rahmen",
    "notif.fotocameraFrontale": "Frontkamera aktiviert",
    "notif.fotocameraErrore": "Zugriff auf die Kamera nicht möglich: {msg}",
    "notif.erroreCattura": "Fehler bei der Fotoaufnahme",
    "notif.fotoTroppoPesante": "⚠️ Foto zu groß\nVersuchen Sie, aus größerer Entfernung oder bei weniger Licht zu fotografieren",
    "notif.fotoAcquisita": "✅ Foto aufgenommen",
    "notif.privacyRichiesta": "⚠️ Bitte bestätigen Sie, dass Sie die Datenschutzerklärung gelesen haben, um fortzufahren",
    "notif.raccoltaDocumenti": "📦 Dokumente werden zusammengestellt...",
    "notif.documentiGrandi": "⚠️ Die Dokumente sind sehr groß, das Speichern kann länger dauern...",
    "notif.pagamentoAnnullato": "Zahlung abgebrochen. Sie können es jederzeit erneut versuchen.",
    "notif.caricamentoDocResponsabile": "📄 Dokument des Hauptgasts wird hochgeladen...",
    "notif.docResponsabileCaricato": "✅ Dokument des Hauptgasts hochgeladen",
    "confirm.tornaVerifica": "Möchten Sie zur Prüfungsseite zurückkehren? Die vorausgefüllten Daten bleiben erhalten.",
    "confirm.conferma": "Bestätigen",
    "confirm.annulla": "Abbrechen",
    "valid.dataRichiesta": "Wählen Sie das Check-in-Datum",
    "valid.dataPassato": "Das Check-in-Datum darf nicht in der Vergangenheit liegen",
    "valid.appartamentoRichiesto": "Wählen Sie mindestens eine Wohnung aus",
    "valid.ospitiRichiesti": "Wählen Sie die Anzahl der Gäste",
    "valid.nottiNonValide": "Geben Sie eine gültige Anzahl von Nächten ein (mindestens 1)",
    "valid.tipoGruppoRichiesto": "Wählen Sie die Gruppenart",
    "field.cognome": "Nachname",
    "field.nome": "Vorname",
    "field.genere": "Geschlecht",
    "field.dataNascita": "Geburtsdatum",
    "field.cittadinanza": "Staatsangehörigkeit",
    "field.luogoNascita": "Geburtsort",
    "field.tipoDocumento": "Dokumententyp",
    "field.numeroDocumento": "Dokumentnummer",
    "field.luogoRilascio": "Ausstellungsort des Dokuments",
    "valid.campoObbligatorio": "{campo} ist für Gast {n} erforderlich",
    "valid.comuneProvinciaObbligatori": "Gemeinde und Provinz sind für in Italien geborene Gäste erforderlich",
    "valid.maggiorenne": "Der Hauptgast muss volljährig sein (18+ Jahre)",
    "valid.documentoRichiesto": "Für den Hauptgast muss ein Dokument hochgeladen werden",
    "valid.latoMancante": "Dokument unvollständig: Es fehlt die {lato}",
    "valid.latoMancanteResponsabile": "Die {lato} des Dokuments des Hauptgasts fehlt",
    "valid.dataMancante": "Check-in-Datum fehlt",
    "valid.appartamentoMancante": "Keine Wohnung ausgewählt",
    "valid.ospitiNonValidi": "Ungültige Anzahl von Gästen",
    "valid.nomeCognomeMancante": "Vor-/Nachname fehlt für Gast {n}",
    "valid.dataNascitaMancante": "Geburtsdatum fehlt für {nome} {cognome}",
    "valid.genereMancante": "Geschlecht fehlt für {nome} {cognome}",
    "valid.cittadinanzaMancante": "Staatsangehörigkeit fehlt für {nome} {cognome}",
    "valid.luogoNascitaMancante": "Geburtsort fehlt für {nome} {cognome}",
    "valid.comuneProvinciaMancanti": "Gemeinde und Provinz fehlen für {nome} {cognome} (in Italien geboren)",
    "valid.documentoIncompleto": "Die Dokumentdaten des Hauptgasts sind unvollständig",
    "valid.documentoMancanteResponsabile": "Dokument für den Hauptgast fehlt",
    "guest.title": "Gast {n}",
    "guest.responsabileTag": " (Hauptgast)",
    "guest.subtitle": "Die mit * gekennzeichneten Felder sind nach italienischem Recht für die vorgeschriebene Meldung der Gäste an die Polizei erforderlich (Art. 109 TULPS): Ohne diese Daten können wir Ihren Aufenthalt nicht registrieren.",
    "guest.cognome": "Nachname *",
    "guest.nome": "Vorname *",
    "guest.genere": "Geschlecht *",
    "guest.selezionaGenere": "Geschlecht wählen",
    "guest.maschio": "Männlich",
    "guest.femmina": "Weiblich",
    "guest.dataNascita": "Geburtsdatum *",
    "guest.cittadinanza": "Staatsangehörigkeit *",
    "guest.selezionaCittadinanza": "Staatsangehörigkeit wählen",
    "guest.luogoNascita": "Geburtsort *",
    "guest.selezionaLuogoNascita": "Geburtsort wählen",
    "guest.comune": "Gemeinde *",
    "guest.comunePlaceholder": "z. B. Neapel",
    "guest.provincia": "Provinz *",
    "guest.selezionaProvincia": "Provinz wählen",
    "guest.tipoDocumento": "Dokumententyp *",
    "guest.selezionaTipoDocumento": "Dokumententyp wählen",
    "guest.numeroDocumento": "Dokumentnummer *",
    "guest.luogoRilascio": "Ausstellungsort des Dokuments *",
    "guest.selezionaLuogoRilascio": "Ausstellungsort wählen",
    "guest.documentoTitolo": "📄 Ausweisdokument",
    "guest.documentoSottotitolo": "Es werden zwei Dateien benötigt: die Vorderseite und die Rückseite des Dokuments (Foto oder PDF). Beim Reisepass genügt die Datenseite.",
    "guest.latoFronte": "Vorderseite",
    "guest.latoRetro": "Rückseite",
    "guest.latoFronteHint": "Die Seite mit dem Foto",
    "guest.latoRetroHint": "Die gegenüberliegende Seite",
    "guest.latoRetroPassaporto": "Beim Reisepass nicht erforderlich",
    "guest.facoltativo": "Optional",
    "guest.fotografaFronte": "📷 Vorderseite fotografieren",
    "guest.fotografaRetro": "📷 Rückseite fotografieren",
    "guest.statoDocumenti": "{n} von {tot} Dateien hochgeladen",
    "guest.documentoCompleto": "✅ Dokument hochgeladen",
    "guest.documentiCompleti": "✅ Vorder- und Rückseite hochgeladen",
    "guest.scegliFile": "📎 Datei auswählen",
    "guest.fotografaDocumento": "📷 Dokument fotografieren",
    "guest.scatta": "📸 Aufnehmen",
    "guest.chiudi": "✕ Schließen",
    "guest.backBtn": "← Zurück",
    "guest.nextBtnMore": "Nächster Gast →",
    "guest.nextBtnSummary": "Zur Übersicht →",
    "summary.dettagliTitle": "📍 Aufenthaltsdetails",
    "summary.dataCheckin": "Check-in-Datum:",
    "summary.appartamenti": "Wohnung(en):",
    "summary.numeroOspiti": "Anzahl der Gäste:",
    "summary.numeroNotti": "Anzahl der Nächte:",
    "summary.ospitiTitle": "👥 Gäste",
    "summary.responsabile": "(Hauptgast)",
    "summary.etaSoggetta": "Alter: {eta} Jahre (steuerpflichtig)",
    "summary.etaEsente": "Alter: {eta} Jahre (befreit)",
    "summary.totaleTitle": "💰 Gesamte Kurtaxe",
    "summary.totaleNota": "Kurtaxe von 1,50 € pro Nacht für Gäste ab 4 Jahren",
    "stepFinal.title": "Übersicht und Zahlung",
    "stepFinal.subtitle": "Überprüfen Sie die Daten und fahren Sie mit der Zahlung fort",
    "stepFinal.summaryTitle": "Buchungsübersicht",
    "stepFinal.privacyText": "Ich erkläre, dass ich die Datenschutzerklärung gelesen habe.",
    "stepFinal.backBtn": "← Zurück",
    "stepFinal.payBtnInitial": "Weiter zur Zahlung",
    "payment.payButton": "💳 €{amount} mit Stripe bezahlen",
    "payment.verificaDati": "⏳ Daten werden geprüft...",
    "guest.comuneEtichetta": "Geburtsgemeinde",
    "guest.documentoAvvisoIdentita": "Das Bild des Ausweises wird per E-Mail an den Gastgeber gesendet, nur um die an die Polizei zu meldenden Daten zu prüfen, und wird innerhalb von 24 Stunden nach der Registrierung gelöscht. Es ersetzt nicht die Kontrolle des Originaldokuments.",
    "alloggiati.comuneNonTrovato": "Gast {n}: Die Geburtsgemeinde ist im amtlichen Verzeichnis für die gewählte Provinz nicht enthalten. Bitte vollständig wie im Dokument angeben.",
    "alloggiati.suggerimenti": " Mögliche Treffer: {elenco}.",
    "alloggiati.caratteriNonAmmessi": "Gast {n}: Das Feld „{campo}“ enthält Zeichen, die für die Meldung an die Polizei nicht zulässig sind (Namen: nur Buchstaben, Leerzeichen und Apostroph; Dokumentnummer: Buchstaben und Ziffern).",
    "alloggiati.troppoLungo": "Gast {n}: Das Feld „{campo}“ ist für die Meldung an die Polizei zu lang.",
    "alloggiati.altriProblemi": "(Weitere {quanti} Angaben sind zu prüfen.)",
    "stepFinal.identitaTitolo": "Identitätsprüfung bei der Ankunft",
    "stepFinal.identitaTesto": "Das Ausfüllen dieses Formulars und das Senden eines Fotos des Ausweises reichen für die Identifizierung nicht aus. Bei der Ankunft muss der Gastgeber persönlich prüfen, ob die Originaldokumente mit den übernachtenden Personen übereinstimmen (oder über eine geeignete Videoverbindung in Echtzeit). Bitte halten Sie die Originalausweise aller Gäste bereit.",
    "stepFinal.privacyLink": "Datenschutzerklärung lesen",
    "stepFinal.infoBreve": "Kurz gesagt: Die Daten aller Gäste werden für die vorgeschriebene Meldung an die Polizei (Portal Alloggiati Web) und, zusammen mit den Geburtsdaten, für die Berechnung der Kurtaxe benötigt; die Zahlung erfolgt auf der Seite von Stripe. Zur Prüfung der Daten erhält der Gastgeber per E-Mail das Bild des Ausweises und eine PDF-Zusammenfassung (erstellt vom externen Dienst Browserless auf Servern in den USA): Diese Kopien und das Arbeitsblatt werden innerhalb von 24 Stunden nach der Registrierung bei Alloggiati Web gelöscht. Die Daten werden für keine anderen Zwecke verwendet. Diese Bestätigung ist keine Einwilligung: Sie erklären damit nur, die Datenschutzerklärung gelesen zu haben.",
    "footer.privacy": "Datenschutzerklärung",
    "payment.preparazioneDati": "⏳ Daten werden vorbereitet...",
    "payment.salvataggioDati": "⏳ Daten werden gespeichert (dies kann bis zu 30 Sekunden dauern)...",
    "payment.creazionePagamento": "⏳ Zahlung wird erstellt...",
    "payment.erroreGenerico": "Beim Speichern ist ein Problem aufgetreten. Bitte versuchen Sie es in Kürze erneut oder wenden Sie sich an den Support, falls das Problem weiterhin besteht.",
    "payment.timeoutSalvataggio": "Zeitüberschreitung beim Speichern der Daten (45s). Die Dokumente sind möglicherweise zu groß. Versuchen Sie es erneut mit kleineren Fotos.",
    "payment.salvataggioFallito": "Die Daten konnten nicht gespeichert werden. Bitte versuchen Sie es in Kürze erneut.",
    "payment.documentoTroppoGrande": "Dokument auch nach der Komprimierung zu groß ({size} KB). {suggerimento}",
    "payment.latoTroppoGrande": "Die Dokumentdatei ({lato}) ist auch nach der Komprimierung zu groß ({size} KB). {suggerimento}",
    "payment.suggerimentoPdf": "Versuchen Sie einen leichteren Scan oder machen Sie ein Foto des Dokuments anstelle des PDFs.",
    "payment.suggerimentoFoto": "Verwenden Sie ein Foto mit geringerer Auflösung.",
    "payment.impossibileProcessare": "Das Dokument konnte nicht verarbeitet werden. Versuchen Sie es mit einem anderen Bild erneut.",
    "payment.payloadTroppoGrande": "Datenpaket zu groß ({mb} MB). Reduzieren Sie die Dokumentqualität.",
    "success.title": "✅ Check-in abgeschlossen!",
    "success.line1": "Vielen Dank für den Abschluss der Anmeldung.",
    "success.line2": "Wir wünschen Ihnen einen angenehmen Aufenthalt!",
    "success.refLabel": "Buchungsreferenz:",
    "progress.label": "Schritt {current} von {total}",

    "successPage.title": "Zahlung erfolgreich - La Columbera",
    "successPage.mainTitle": "Zahlung abgeschlossen!",
    "successPage.subtitle": "Vielen Dank für den Abschluss des Check-ins und die Zahlung der Kurtaxe.",
    "successPage.bookingDetailsTitle": "📋 Buchungsdetails",
    "successPage.loadingDetails": "Details werden geladen...",
    "successPage.codeTitle": "🔑 Code für die Sicherheitsbox",
    "successPage.codeNote": "Verwenden Sie diesen Code, um Zugang zu Ihrer Wohnung zu erhalten",
    "successPage.backHome": "🏠 Zurück zur Startseite",
    "successPage.print": "🖨️ Drucken",
    "successPage.checkin": "Check-in:",
    "successPage.apartment": "Wohnung:",
    "successPage.guests": "Gäste:",
    "successPage.nights": "Nächte:",
    "successPage.totalPaid": "Gesamtbetrag bezahlt:",
    "successPage.sessionNotFound": "Sitzung in der URL nicht gefunden",
    "successPage.dataNotAvailable": "Daten nicht verfügbar",
    "successPage.noDataForSession": "Keine Daten für diese Sitzung verfügbar",
    "successPage.errorLoadingSaved": "Fehler beim Laden der gespeicherten Daten",
    "successPage.codeNotAvailable": "Code nicht verfügbar, bitte kontaktieren Sie den Eigentümer",
    "successPage.errorLoadingTitle": "Fehler beim Laden",
    "successPage.unexpectedError": "Ein unerwarteter Fehler ist aufgetreten",
  },
};

// Nome italiano (= valore salvato/inviato al backend, invariato) -> {en, de}
const I18N_PAESI = {
  "Afghanistan": { en: "Afghanistan", de: "Afghanistan" },
  "Albania": { en: "Albania", de: "Albanien" },
  "Algeria": { en: "Algeria", de: "Algerien" },
  "Andorra": { en: "Andorra", de: "Andorra" },
  "Angola": { en: "Angola", de: "Angola" },
  "Antigua e Barbuda": { en: "Antigua and Barbuda", de: "Antigua und Barbuda" },
  "Arabia Saudita": { en: "Saudi Arabia", de: "Saudi-Arabien" },
  "Argentina": { en: "Argentina", de: "Argentinien" },
  "Armenia": { en: "Armenia", de: "Armenien" },
  "Australia": { en: "Australia", de: "Australien" },
  "Austria": { en: "Austria", de: "Österreich" },
  "Azerbaigian": { en: "Azerbaijan", de: "Aserbaidschan" },
  "Bahamas": { en: "Bahamas", de: "Bahamas" },
  "Bahrain": { en: "Bahrain", de: "Bahrain" },
  "Bangladesh": { en: "Bangladesh", de: "Bangladesch" },
  "Barbados": { en: "Barbados", de: "Barbados" },
  "Belgio": { en: "Belgium", de: "Belgien" },
  "Belize": { en: "Belize", de: "Belize" },
  "Benin": { en: "Benin", de: "Benin" },
  "Bhutan": { en: "Bhutan", de: "Bhutan" },
  "Bielorussia": { en: "Belarus", de: "Belarus" },
  "Birmania": { en: "Myanmar", de: "Myanmar" },
  "Bolivia": { en: "Bolivia", de: "Bolivien" },
  "Bosnia ed Erzegovina": { en: "Bosnia and Herzegovina", de: "Bosnien und Herzegowina" },
  "Botswana": { en: "Botswana", de: "Botsuana" },
  "Brasile": { en: "Brazil", de: "Brasilien" },
  "Brunei": { en: "Brunei", de: "Brunei" },
  "Bulgaria": { en: "Bulgaria", de: "Bulgarien" },
  "Burkina Faso": { en: "Burkina Faso", de: "Burkina Faso" },
  "Burundi": { en: "Burundi", de: "Burundi" },
  "Cambogia": { en: "Cambodia", de: "Kambodscha" },
  "Camerun": { en: "Cameroon", de: "Kamerun" },
  "Canada": { en: "Canada", de: "Kanada" },
  "Capo Verde": { en: "Cape Verde", de: "Kap Verde" },
  "Ciad": { en: "Chad", de: "Tschad" },
  "Cile": { en: "Chile", de: "Chile" },
  "Cina": { en: "China", de: "China" },
  "Cipro": { en: "Cyprus", de: "Zypern" },
  "Comore": { en: "Comoros", de: "Komoren" },
  "Corea del Nord": { en: "North Korea", de: "Nordkorea" },
  "Corea del Sud": { en: "South Korea", de: "Südkorea" },
  "Costa d'Avorio": { en: "Ivory Coast", de: "Elfenbeinküste" },
  "Costa Rica": { en: "Costa Rica", de: "Costa Rica" },
  "Croazia": { en: "Croatia", de: "Kroatien" },
  "Cuba": { en: "Cuba", de: "Kuba" },
  "Danimarca": { en: "Denmark", de: "Dänemark" },
  "Dominica": { en: "Dominica", de: "Dominica" },
  "Ecuador": { en: "Ecuador", de: "Ecuador" },
  "Egitto": { en: "Egypt", de: "Ägypten" },
  "El Salvador": { en: "El Salvador", de: "El Salvador" },
  "Emirati Arabi Uniti": { en: "United Arab Emirates", de: "Vereinigte Arabische Emirate" },
  "Eritrea": { en: "Eritrea", de: "Eritrea" },
  "Estonia": { en: "Estonia", de: "Estland" },
  "Etiopia": { en: "Ethiopia", de: "Äthiopien" },
  "Figi": { en: "Fiji", de: "Fidschi" },
  "Filippine": { en: "Philippines", de: "Philippinen" },
  "Finlandia": { en: "Finland", de: "Finnland" },
  "Francia": { en: "France", de: "Frankreich" },
  "Gabon": { en: "Gabon", de: "Gabun" },
  "Gambia": { en: "Gambia", de: "Gambia" },
  "Georgia": { en: "Georgia", de: "Georgien" },
  "Germania": { en: "Germany", de: "Deutschland" },
  "Ghana": { en: "Ghana", de: "Ghana" },
  "Giamaica": { en: "Jamaica", de: "Jamaika" },
  "Giappone": { en: "Japan", de: "Japan" },
  "Gibuti": { en: "Djibouti", de: "Dschibuti" },
  "Giordania": { en: "Jordan", de: "Jordanien" },
  "Grecia": { en: "Greece", de: "Griechenland" },
  "Grenada": { en: "Grenada", de: "Grenada" },
  "Guatemala": { en: "Guatemala", de: "Guatemala" },
  "Guinea": { en: "Guinea", de: "Guinea" },
  "Guinea-Bissau": { en: "Guinea-Bissau", de: "Guinea-Bissau" },
  "Guinea Equatoriale": { en: "Equatorial Guinea", de: "Äquatorialguinea" },
  "Guyana": { en: "Guyana", de: "Guyana" },
  "Haiti": { en: "Haiti", de: "Haiti" },
  "Honduras": { en: "Honduras", de: "Honduras" },
  "India": { en: "India", de: "Indien" },
  "Indonesia": { en: "Indonesia", de: "Indonesien" },
  "Iran": { en: "Iran", de: "Iran" },
  "Iraq": { en: "Iraq", de: "Irak" },
  "Irlanda": { en: "Ireland", de: "Irland" },
  "Islanda": { en: "Iceland", de: "Island" },
  "Israele": { en: "Israel", de: "Israel" },
  "Italia": { en: "Italy", de: "Italien" },
  "Kazakistan": { en: "Kazakhstan", de: "Kasachstan" },
  "Kenya": { en: "Kenya", de: "Kenia" },
  "Kirghizistan": { en: "Kyrgyzstan", de: "Kirgisistan" },
  "Kiribati": { en: "Kiribati", de: "Kiribati" },
  "Kuwait": { en: "Kuwait", de: "Kuwait" },
  "Laos": { en: "Laos", de: "Laos" },
  "Lesotho": { en: "Lesotho", de: "Lesotho" },
  "Lettonia": { en: "Latvia", de: "Lettland" },
  "Libano": { en: "Lebanon", de: "Libanon" },
  "Liberia": { en: "Liberia", de: "Liberia" },
  "Libia": { en: "Libya", de: "Libyen" },
  "Liechtenstein": { en: "Liechtenstein", de: "Liechtenstein" },
  "Lituania": { en: "Lithuania", de: "Litauen" },
  "Lussemburgo": { en: "Luxembourg", de: "Luxemburg" },
  "Macedonia del Nord": { en: "North Macedonia", de: "Nordmazedonien" },
  "Madagascar": { en: "Madagascar", de: "Madagaskar" },
  "Malawi": { en: "Malawi", de: "Malawi" },
  "Malaysia": { en: "Malaysia", de: "Malaysia" },
  "Maldive": { en: "Maldives", de: "Malediven" },
  "Mali": { en: "Mali", de: "Mali" },
  "Malta": { en: "Malta", de: "Malta" },
  "Marocco": { en: "Morocco", de: "Marokko" },
  "Isole Marshall": { en: "Marshall Islands", de: "Marshallinseln" },
  "Mauritania": { en: "Mauritania", de: "Mauretanien" },
  "Mauritius": { en: "Mauritius", de: "Mauritius" },
  "Messico": { en: "Mexico", de: "Mexiko" },
  "Micronesia": { en: "Micronesia", de: "Mikronesien" },
  "Moldavia": { en: "Moldova", de: "Moldawien" },
  "Monaco": { en: "Monaco", de: "Monaco" },
  "Mongolia": { en: "Mongolia", de: "Mongolei" },
  "Montenegro": { en: "Montenegro", de: "Montenegro" },
  "Mozambico": { en: "Mozambique", de: "Mosambik" },
  "Namibia": { en: "Namibia", de: "Namibia" },
  "Nauru": { en: "Nauru", de: "Nauru" },
  "Nepal": { en: "Nepal", de: "Nepal" },
  "Nicaragua": { en: "Nicaragua", de: "Nicaragua" },
  "Niger": { en: "Niger", de: "Niger" },
  "Nigeria": { en: "Nigeria", de: "Nigeria" },
  "Norvegia": { en: "Norway", de: "Norwegen" },
  "Nuova Zelanda": { en: "New Zealand", de: "Neuseeland" },
  "Oman": { en: "Oman", de: "Oman" },
  "Paesi Bassi": { en: "Netherlands", de: "Niederlande" },
  "Pakistan": { en: "Pakistan", de: "Pakistan" },
  "Palau": { en: "Palau", de: "Palau" },
  "Panama": { en: "Panama", de: "Panama" },
  "Papua Nuova Guinea": { en: "Papua New Guinea", de: "Papua-Neuguinea" },
  "Paraguay": { en: "Paraguay", de: "Paraguay" },
  "Peru": { en: "Peru", de: "Peru" },
  "Polonia": { en: "Poland", de: "Polen" },
  "Portogallo": { en: "Portugal", de: "Portugal" },
  "Qatar": { en: "Qatar", de: "Katar" },
  "Regno Unito": { en: "United Kingdom", de: "Vereinigtes Königreich" },
  "Repubblica Ceca": { en: "Czech Republic", de: "Tschechische Republik" },
  "Repubblica Centrafricana": { en: "Central African Republic", de: "Zentralafrikanische Republik" },
  "Repubblica del Congo": { en: "Republic of the Congo", de: "Republik Kongo" },
  "Repubblica Democratica del Congo": { en: "Democratic Republic of the Congo", de: "Demokratische Republik Kongo" },
  "Repubblica Dominicana": { en: "Dominican Republic", de: "Dominikanische Republik" },
  "Romania": { en: "Romania", de: "Rumänien" },
  "Ruanda": { en: "Rwanda", de: "Ruanda" },
  "Russia": { en: "Russia", de: "Russland" },
  "Saint Kitts e Nevis": { en: "Saint Kitts and Nevis", de: "St. Kitts und Nevis" },
  "Saint Lucia": { en: "Saint Lucia", de: "St. Lucia" },
  "Saint Vincent e Grenadine": { en: "Saint Vincent and the Grenadines", de: "St. Vincent und die Grenadinen" },
  "Samoa": { en: "Samoa", de: "Samoa" },
  "San Marino": { en: "San Marino", de: "San Marino" },
  "São Tomé e Príncipe": { en: "São Tomé and Príncipe", de: "São Tomé und Príncipe" },
  "Senegal": { en: "Senegal", de: "Senegal" },
  "Serbia": { en: "Serbia", de: "Serbien" },
  "Seychelles": { en: "Seychelles", de: "Seychellen" },
  "Sierra Leone": { en: "Sierra Leone", de: "Sierra Leone" },
  "Singapore": { en: "Singapore", de: "Singapur" },
  "Siria": { en: "Syria", de: "Syrien" },
  "Slovacchia": { en: "Slovakia", de: "Slowakei" },
  "Slovenia": { en: "Slovenia", de: "Slowenien" },
  "Somalia": { en: "Somalia", de: "Somalia" },
  "Spagna": { en: "Spain", de: "Spanien" },
  "Sri Lanka": { en: "Sri Lanka", de: "Sri Lanka" },
  "Stati Uniti": { en: "United States", de: "Vereinigte Staaten" },
  "Sudafrica": { en: "South Africa", de: "Südafrika" },
  "Sudan": { en: "Sudan", de: "Sudan" },
  "Sudan del Sud": { en: "South Sudan", de: "Südsudan" },
  "Suriname": { en: "Suriname", de: "Suriname" },
  "Svezia": { en: "Sweden", de: "Schweden" },
  "Svizzera": { en: "Switzerland", de: "Schweiz" },
  "Swaziland": { en: "Eswatini", de: "Swasiland" },
  "Tagikistan": { en: "Tajikistan", de: "Tadschikistan" },
  "Tanzania": { en: "Tanzania", de: "Tansania" },
  "Thailandia": { en: "Thailand", de: "Thailand" },
  "Timor Est": { en: "East Timor", de: "Osttimor" },
  "Togo": { en: "Togo", de: "Togo" },
  "Tonga": { en: "Tonga", de: "Tonga" },
  "Trinidad e Tobago": { en: "Trinidad and Tobago", de: "Trinidad und Tobago" },
  "Tunisia": { en: "Tunisia", de: "Tunesien" },
  "Turchia": { en: "Turkey", de: "Türkei" },
  "Turkmenistan": { en: "Turkmenistan", de: "Turkmenistan" },
  "Tuvalu": { en: "Tuvalu", de: "Tuvalu" },
  "Ucraina": { en: "Ukraine", de: "Ukraine" },
  "Uganda": { en: "Uganda", de: "Uganda" },
  "Ungheria": { en: "Hungary", de: "Ungarn" },
  "Uruguay": { en: "Uruguay", de: "Uruguay" },
  "Uzbekistan": { en: "Uzbekistan", de: "Usbekistan" },
  "Vanuatu": { en: "Vanuatu", de: "Vanuatu" },
  "Vaticano": { en: "Vatican City", de: "Vatikanstadt" },
  "Venezuela": { en: "Venezuela", de: "Venezuela" },
  "Vietnam": { en: "Vietnam", de: "Vietnam" },
  "Yemen": { en: "Yemen", de: "Jemen" },
  "Zambia": { en: "Zambia", de: "Sambia" },
  "Zimbabwe": { en: "Zimbabwe", de: "Simbabwe" },
};

// Tipo documento italiano (= valore salvato/inviato al backend) -> {en, de}
const I18N_DOCUMENTI = {
  "PASSAPORTO ORDINARIO": { en: "ORDINARY PASSPORT", de: "REISEPASS" },
  "CARTA DI IDENTITA'": { en: "IDENTITY CARD", de: "PERSONALAUSWEIS" },
  "CARTA IDENTITA' ELETTRONICA": { en: "ELECTRONIC IDENTITY CARD", de: "ELEKTRONISCHER PERSONALAUSWEIS" },
  "PATENTE DI GUIDA": { en: "DRIVING LICENCE", de: "FÜHRERSCHEIN" },
  "PASSAPORTO DIPLOMATICO": { en: "DIPLOMATIC PASSPORT", de: "DIPLOMATENPASS" },
  "PASSAPORTO DI SERVIZIO": { en: "SERVICE PASSPORT", de: "DIENSTPASS" },
};
// ------------------------------------------------------------------
// Stato lingua corrente
// ------------------------------------------------------------------
const LINGUE_SUPPORTATE = ['it', 'en', 'de'];
const LINGUA_STORAGE_KEY = 'columbera_lingua';
const LINGUA_DEFAULT = 'it';

function getLingua() {
  try {
    const salvata = window.localStorage?.getItem(LINGUA_STORAGE_KEY);
    if (salvata && LINGUE_SUPPORTATE.includes(salvata)) return salvata;
  } catch (e) { /* localStorage non disponibile (es. modalità privata): si ignora */ }
  return LINGUA_DEFAULT;
}

// Mappa lingua interna -> locale BCP47 usato per Intl/toLocaleDateString
function localeCorrente(lingua) {
  const lang = lingua || getLingua();
  return { it: 'it-IT', en: 'en-GB', de: 'de-DE' }[lang] || 'it-IT';
}

// Mappa lingua interna -> locale Stripe Checkout (usato in crea-pagamento-stripe.js
// lato server, ma la stessa funzione di mapping è duplicata lì: se cambi le chiavi
// qui, aggiorna anche quella copia).
function localeStripe(lingua) {
  const lang = lingua || getLingua();
  return { it: 'it', en: 'en', de: 'de' }[lang] || 'it';
}

// ------------------------------------------------------------------
// Traduzione di una stringa
// ------------------------------------------------------------------
function t(key, params) {
  const lang = getLingua();
  const dict = I18N_UI[lang] || I18N_UI[LINGUA_DEFAULT];
  let str = dict[key];
  if (str === undefined) str = I18N_UI[LINGUA_DEFAULT][key];
  if (str === undefined) return key; // fallback estremo: mai un campo vuoto in UI
  if (params) {
    Object.keys(params).forEach(k => {
      str = str.split(`{${k}}`).join(params[k]);
    });
  }
  return str;
}

// Nome paese: il VALORE inviato al backend (Google Sheets, PDF proprietario,
// Stripe) resta sempre quello italiano — qui si traduce solo l'ETICHETTA
// mostrata all'ospite.
function traduciPaese(nomeItaliano) {
  const lang = getLingua();
  if (lang === 'it' || !nomeItaliano) return nomeItaliano;
  return I18N_PAESI[nomeItaliano]?.[lang] || nomeItaliano;
}

function traduciDocumento(nomeItaliano) {
  const lang = getLingua();
  if (lang === 'it' || !nomeItaliano) return nomeItaliano;
  return I18N_DOCUMENTI[nomeItaliano]?.[lang] || nomeItaliano;
}

// Nome appartamento mostrato all'ospite (riepilogo, pagina di successo).
// Il valore sottostante (checkbox value / dati.appartamento inviato al
// backend) resta sempre la stringa italiana originale: qui si traduce
// solo cosa vede l'ospite a schermo.
function nomeAppartamentoTradotto(valoreOriginale) {
  const lang = getLingua();
  if (lang === 'it' || !valoreOriginale) return valoreOriginale;
  // L'unico separatore reale tra più appartamenti è ' + ' (vedi
  // raccogliDatiPrenotazioneConCompressione in checkin.js). Il valore di
  // un singolo appartamento contiene già una virgola al suo interno
  // (es. "La Columbera - Torre, Appartamento con 2 camere da letto"),
  // quindi NON va usata la virgola come separatore.
  const parti = valoreOriginale.includes(' + ') ? valoreOriginale.split(' + ') : [valoreOriginale];

  const traduciSingolo = (val) => {
    const v = val.toLowerCase();
    if (v.includes('torre')) return `La Columbera - Torre, ${t('apt.torreDescLong')}`;
    if (v.includes('corte')) return `La Columbera - Corte, ${t('apt.corteDescLong')}`;
    return val.trim();
  };

  return parti.map(p => traduciSingolo(p.trim())).join(' + ');
}

// Data localizzata in formato lungo (es. "giovedì 10 settembre 2026")
function formatDataLocalizzata(dataISO, lingua) {
  if (!dataISO) return 'N/A';
  const data = new Date(dataISO);
  if (isNaN(data.getTime())) return 'N/A';
  return data.toLocaleDateString(localeCorrente(lingua), {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ------------------------------------------------------------------
// Applica le traduzioni al DOM corrente. Va richiamata:
//  - al caricamento della pagina
//  - ogni volta che l'utente cambia lingua
//  - dopo ogni innerHTML che genera nuovi elementi con attributi data-i18n*
// Funziona in modo uniforme sia sul markup statico di index.html sia su
// quello generato dinamicamente da checkin.js, perché entrambi usano gli
// stessi attributi data-i18n*.
// ------------------------------------------------------------------
function applicaTraduzioni(root) {
  const scope = root || document;
  const lang = getLingua();

  // Testo semplice, nessun parametro
  scope.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });

  // Testo con parametri (es. "Ospite {n}"): i parametri sono stati salvati
  // come JSON nell'attributo data-i18n-params al momento della creazione
  // dell'elemento.
  scope.querySelectorAll('[data-i18n-key]').forEach(el => {
    let params = null;
    const raw = el.getAttribute('data-i18n-params');
    if (raw) {
      try { params = JSON.parse(raw); } catch (e) { params = null; }
    }
    let testo = t(el.getAttribute('data-i18n-key'), params);
    const suffixKey = el.getAttribute('data-i18n-suffix');
    if (suffixKey) testo += t(suffixKey);
    el.textContent = testo;
  });

  // Placeholder di input/textarea
  scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });

  // Opzioni <option> per Paese (value = nome italiano, testo tradotto)
  scope.querySelectorAll('[data-i18n-country]').forEach(el => {
    el.textContent = traduciPaese(el.getAttribute('data-i18n-country'));
  });

  // Opzioni <option> per tipo documento
  scope.querySelectorAll('[data-i18n-doctype]').forEach(el => {
    el.textContent = traduciDocumento(el.getAttribute('data-i18n-doctype'));
  });

  document.documentElement.setAttribute('lang', lang);
  const titleEl = document.querySelector('title');
  if (titleEl && !titleEl.hasAttribute('data-i18n')) titleEl.textContent = t('meta.title');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', t('meta.description'));

  scope.querySelectorAll('.lang-flag').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
}

// ------------------------------------------------------------------
// Cambio lingua: salva la preferenza e ritraduce tutto ciò che è già
// a schermo. Le pagine (checkin.js / successo-pagamento.html) possono
// registrare callback extra da eseguire dopo il cambio lingua (per
// aggiornare testi che includono valori calcolati a runtime, es. il
// pulsante di pagamento con l'importo già formattato).
// ------------------------------------------------------------------
const _onCambioLinguaCallbacks = [];
function onCambioLingua(fn) {
  if (typeof fn === 'function') _onCambioLinguaCallbacks.push(fn);
}

function impostaLingua(lingua) {
  if (!LINGUE_SUPPORTATE.includes(lingua)) return;
  try { window.localStorage?.setItem(LINGUA_STORAGE_KEY, lingua); } catch (e) { /* ignora */ }
  applicaTraduzioni(document);
  _onCambioLinguaCallbacks.forEach(fn => {
    try { fn(lingua); } catch (e) { console.warn('Callback cambio lingua fallita:', e); }
  });
}

// ------------------------------------------------------------------
// Selettore a bandierine: cerca un contenitore #language-selector nella
// pagina e vi inserisce i tre pulsanti, se non sono già presenti.
// ------------------------------------------------------------------
function inizializzaSelettoreLingua() {
  const contenitore = document.getElementById('language-selector');
  if (!contenitore || contenitore.dataset.inizializzato === 'true') return;

  const bandiere = [
    { lang: 'it', flag: '🇮🇹' },
    { lang: 'en', flag: '🇬🇧' },
    { lang: 'de', flag: '🇩🇪' }
  ];

  bandiere.forEach(({ lang, flag }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-flag';
    btn.setAttribute('data-lang', lang);
    btn.setAttribute('aria-label', I18N_UI[lang]['lang.' + lang] || lang);
    btn.title = I18N_UI[lang]['lang.' + lang] || lang;
    btn.textContent = flag;
    btn.addEventListener('click', () => impostaLingua(lang));
    contenitore.appendChild(btn);
  });

  contenitore.dataset.inizializzato = 'true';
  applicaTraduzioni(document);
}

document.addEventListener('DOMContentLoaded', () => {
  inizializzaSelettoreLingua();
  applicaTraduzioni(document);
});
