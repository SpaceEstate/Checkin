// === CONFIGURAZIONE GLOBALE ===
let currentStep = 0; // Inizia da 0 (verifica prenotazione)
let numeroOspiti = 0;
let numeroNotti = 0;
let dataCheckin = ''; 
let stepGenerated = false;
window.datiPrecompilati = false; // Flag globale per dati pre-compilati
 
const API_BASE_URL = 'https://checkin-six-coral.vercel.app/api';

// === SELEZIONE APPARTAMENTO (checkbox al posto del vecchio <select multiple>) ===
// NOTA: questa sezione prima conteneva anche aggiornaAppartamentiSelezionati()
// (mai chiamata da nessuna parte del file) e una PRIMA versione di validaStep1
// che veniva sempre sovrascritta dalla seconda dichiarazione più sotto nel file
// (in JS l'ultima "function nome(){}" con lo stesso nome vince sempre) — erano
// quindi entrambe morte al 100%. Rimosse.
function getAppartamentiSelezionati() {
  return Array.from(document.querySelectorAll('.apartment-chip input[type="checkbox"]:checked'))
    .map(cb => cb.value);
}

// === Numero massimo ospiti per appartamento/i selezionato/i ===
// Torre: max 5 · Corte: max 4 · entrambi: max 9
function getMaxOspitiPerSelezione() {
  const appartamenti = getAppartamentiSelezionati();
  const haTorre = appartamenti.some(a => a.toLowerCase().includes('torre'));
  const haCorte = appartamenti.some(a => a.toLowerCase().includes('corte'));

  if (haTorre && haCorte) return 9;
  if (haTorre) return 5;
  if (haCorte) return 4;
  return 9; // nessun appartamento ancora selezionato: nessun limite finché non sceglie
}

function aggiornaMaxOspiti() {
  const select = document.getElementById('numero-ospiti');
  if (!select) return;

  const max = getMaxOspitiPerSelezione();
  let valoreResettato = false;

  Array.from(select.options).forEach(opt => {
    if (!opt.value) return; // "Seleziona numero"
    const val = parseInt(opt.value, 10);
    const troppiOspiti = val > max;
    opt.disabled = troppiOspiti;
    opt.hidden = troppiOspiti;
  });

  if (select.value && parseInt(select.value, 10) > max) {
    select.value = '';
    valoreResettato = true;
  }

  if (valoreResettato && typeof showNotification === 'function') {
    showNotification(t('notif.maxOspiti', { max }), 'info');
  }
}

// === MODIFICA: precompilaDatiPrenotazione ===
function precompilaDatiPrenotazione(dati) {
  console.log('📝 Pre-compilazione dati:', dati);
  
  // Data check-in
  const dataInput = document.getElementById('data-checkin');
  if (dataInput && dati.dataCheckin) {
    dataInput.value = dati.dataCheckin;
    // Un <input type="date"> rifiuta silenziosamente valori non in formato
    // AAAA-MM-GG: se succede, .value resta "". In quel caso NON blocchiamo
    // il campo in sola lettura (altrimenti l'ospite si ritroverebbe con un
    // campo vuoto e anche il calendario disabilitato, senza modo di
    // procedere). Lo blocchiamo solo se il valore è stato davvero accettato.
    if (dataInput.value) {
      dataInput.readOnly = true;
      dataInput.style.backgroundColor = '#f5f2e9';
      dataInput.style.cursor = 'not-allowed';
    } else {
      console.warn('⚠️ Data check-in non valida ricevuta dal server, campo lasciato modificabile:', dati.dataCheckin);
    }
  }
  
  // Appartamenti pre-verificati: selezione + blocco delle checkbox corrispondenti
  const appartamentoCheckboxes = document.querySelectorAll('.apartment-chip input[type="checkbox"]');
  if (appartamentoCheckboxes.length && dati.appartamento) {
    // Gestione formati multipli: " + " oppure ","
    let appartamenti;
    if (dati.appartamento.includes(' + ')) {
      appartamenti = dati.appartamento.split(' + ');
    } else if (dati.appartamento.includes(',')) {
      appartamenti = dati.appartamento.split(',');
    } else {
      appartamenti = [dati.appartamento];
    }
    appartamenti = appartamenti.map(a => a.trim());

    // Deseleziona tutto prima
    appartamentoCheckboxes.forEach(cb => { cb.checked = false; });

    // Seleziona le checkbox corrispondenti (match flessibile su "corte"/"torre")
    appartamenti.forEach(app => {
      const appLower = app.trim().toLowerCase();
      appartamentoCheckboxes.forEach(cb => {
        const valueLower = cb.value.toLowerCase();
        if (appLower.includes('corte') && valueLower.includes('corte')) cb.checked = true;
        if (appLower.includes('torre') && valueLower.includes('torre')) cb.checked = true;
      });
    });

    // Blocca la selezione: prenotazione già verificata, l'ospite non deve poterla cambiare
    appartamentoCheckboxes.forEach(cb => { cb.disabled = true; });
  }
  
  // Numero ospiti
  const ospitiSelect = document.getElementById('numero-ospiti');
  if (ospitiSelect && dati.numeroOspiti) {
    ospitiSelect.value = dati.numeroOspiti.toString();
    ospitiSelect.disabled = true;
    ospitiSelect.style.backgroundColor = '#f5f2e9';
    ospitiSelect.style.cursor = 'not-allowed';
    ospitiSelect.dispatchEvent(new Event('change'));
  }
  
  // Numero notti
  const nottiInput = document.getElementById('numero-notti');
  if (nottiInput && dati.numeroNotti) {
    nottiInput.value = dati.numeroNotti;
    nottiInput.readOnly = true;
    nottiInput.style.backgroundColor = '#f5f2e9';
    nottiInput.style.cursor = 'not-allowed';
  }
  
  // Tipo gruppo rimane modificabile
  const tipoGruppoSelect = document.getElementById('tipo-gruppo');
  if (tipoGruppoSelect) {
    tipoGruppoSelect.value = '';
    tipoGruppoSelect.disabled = false;
  }
  
  const stepHeader = document.querySelector('#step-1 .step-subtitle');
  if (stepHeader) {
    const sottoChiave = dati.numeroOspiti > 1 ? 'verify.selectGroupType' : 'verify.reviewAndProceed';
    stepHeader.innerHTML = `
      <span style="color: #27ae60; font-weight: 600;" data-i18n="verify.confirmed">✓ Dati prenotazione verificati</span><br>
      <span style="font-size: 0.9rem; color: #a0927f;" data-i18n="${sottoChiave}">
        ${t(sottoChiave)}
      </span>
    `;
    applicaTraduzioni(stepHeader);
  }
  
  console.log('✅ Dati pre-compilati con successo');
}
// (I codici cassetta NON vengono più calcolati né tenuti qui: prima erano
// hardcoded in chiaro in questo file pubblico, scaricabile da chiunque anche
// senza aver pagato. Ora arrivano solo dal backend, dopo verifica del
// pagamento — vedi api/get-session.js)
// === ARRAY DATI ===
const stati = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua e Barbuda", "Arabia Saudita", "Argentina", "Armenia", "Australia", "Austria", "Azerbaigian", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belgio", "Belize", "Benin", "Bhutan", "Bielorussia", "Birmania", "Bolivia", "Bosnia ed Erzegovina", "Botswana", "Brasile", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambogia", "Camerun", "Canada", "Capo Verde", "Ciad", "Cile", "Cina", "Cipro", "Comore", "Corea del Nord", "Corea del Sud", "Costa d'Avorio", "Costa Rica", "Croazia", "Cuba", "Danimarca", "Dominica", "Ecuador", "Egitto", "El Salvador", "Emirati Arabi Uniti", "Eritrea", "Estonia", "Etiopia", "Figi", "Filippine", "Finlandia", "Francia", "Gabon", "Gambia", "Georgia", "Germania", "Ghana", "Giamaica", "Giappone", "Gibuti", "Giordania", "Grecia", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guinea Equatoriale", "Guyana", "Haiti", "Honduras", "India", "Indonesia", "Iran", "Iraq", "Irlanda", "Islanda", "Israele", "Italia", "Kazakistan", "Kenya", "Kirghizistan", "Kiribati", "Kuwait", "Laos", "Lesotho", "Lettonia", "Libano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Lussemburgo", "Macedonia del Nord", "Madagascar", "Malawi", "Malaysia", "Maldive", "Mali", "Malta", "Marocco", "Isole Marshall", "Mauritania", "Mauritius", "Messico", "Micronesia", "Moldavia", "Monaco", "Mongolia", "Montenegro", "Mozambico", "Namibia", "Nauru", "Nepal", "Nicaragua", "Niger", "Nigeria", "Norvegia", "Nuova Zelanda", "Oman", "Paesi Bassi", "Pakistan", "Palau", "Panama", "Papua Nuova Guinea", "Paraguay", "Peru", "Polonia", "Portogallo", "Qatar", "Regno Unito", "Repubblica Ceca", "Repubblica Centrafricana", "Repubblica del Congo", "Repubblica Democratica del Congo", "Repubblica Dominicana", "Romania", "Ruanda", "Russia", "Saint Kitts e Nevis", "Saint Lucia", "Saint Vincent e Grenadine", "Samoa", "San Marino", "São Tomé e Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Siria", "Slovacchia", "Slovenia", "Somalia", "Spagna", "Sri Lanka", "Stati Uniti", "Sudafrica", "Sudan", "Sudan del Sud", "Suriname", "Svezia", "Svizzera", "Swaziland", "Tagikistan", "Tanzania", "Thailandia", "Timor Est", "Togo", "Tonga", "Trinidad e Tobago", "Tunisia", "Turchia", "Turkmenistan", "Tuvalu", "Ucraina", "Uganda", "Ungheria", "Uruguay", "Uzbekistan", "Vanuatu", "Vaticano", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];

const tipiDocumento = ["PASSAPORTO ORDINARIO", "CARTA DI IDENTITA'", "CARTA IDENTITA' ELETTRONICA", "PATENTE DI GUIDA", "PASSAPORTO DIPLOMATICO", "PASSAPORTO DI SERVIZIO"];

const province = ["AG", "AL", "AN", "AO", "AR", "AP", "AT", "AV", "BA", "BT", "BL", "BN", "BG", "BI", "BO", "BZ", "BS", "BR", "CA", "CL", "CB", "CI", "CE", "CT", "CZ", "CH", "CO", "CS", "CR", "KR", "CN", "EN", "FM", "FE", "FI", "FG", "FC", "FR", "GE", "GO", "GR", "IM", "IS", "SP", "AQ", "LT", "LE", "LC", "LI", "LO", "LU", "MC", "MN", "MS", "MT", "ME", "MI", "MO", "MB", "NA", "NO", "NU", "OT", "OR", "PD", "PA", "PR", "PV", "PG", "PU", "PE", "PC", "PI", "PT", "PN", "PZ", "PO", "RG", "RA", "RC", "RE", "RI", "RN", "RM", "RO", "SA", "VS", "SS", "SV", "SI", "SR", "SO", "TA", "TE", "TR", "TO", "OG", "TP", "TN", "TV", "TS", "UD", "VA", "VE", "VB", "VC", "VR", "VV", "VI", "VT"];

function mostraStepCorrente() {
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
  let stepToShow;
  if (currentStep === 99) {
    stepToShow = document.getElementById('step-final');
  } else {
    stepToShow = document.getElementById(`step-${currentStep}`);
  }
  if (stepToShow) {
    stepToShow.classList.add('active');
    stepToShow.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  aggiornaProgressBar();
}

// Passi totali: verifica (1) + info generali (1) + un passo per ospite + riepilogo (1).
// Prima dello step 1, numeroOspiti non è ancora noto: si usa un totale provvisorio di 3
// che si aggiusta automaticamente appena il numero di ospiti viene scelto.
function aggiornaProgressBar() {
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  if (!progressFill || !progressLabel) return;

  const totalSteps = (numeroOspiti > 0 ? numeroOspiti : 0) + 3;
  const currentIndex = currentStep === 99 ? totalSteps : Math.min(currentStep + 1, totalSteps);

  const percent = Math.round((currentIndex / totalSteps) * 100);
  progressFill.style.width = `${percent}%`;
  progressLabel.setAttribute('data-i18n-key', 'progress.label');
  progressLabel.setAttribute('data-i18n-params', JSON.stringify({ current: currentIndex, total: totalSteps }));
  progressLabel.textContent = t('progress.label', { current: currentIndex, total: totalSteps });
}

// === FUNZIONI UTILITÀ ===
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}



function calcolaEta(dataNascita) {
  if (!dataNascita) return 0;
  const nascita = new Date(dataNascita);
  const oggi = new Date();
  if (isNaN(nascita.getTime())) return 0;
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const meseCompleanno = oggi.getMonth() - nascita.getMonth();
  if (meseCompleanno < 0 || (meseCompleanno === 0 && oggi.getDate() < nascita.getDate())) {
    eta--;
  }
  return Math.max(0, eta);
}

function calcolaTotale() {
  const tassaPerNotte = 1.50;
  let ospitiSoggetti = 0;
  
  for (let i = 1; i <= numeroOspiti; i++) {
    const nascitaInput = document.querySelector(`input[name="ospite${i}_nascita"]`);
    if (nascitaInput && nascitaInput.value) {
      const eta = calcolaEta(nascitaInput.value);
      if (eta >= 4) ospitiSoggetti++;
    }
  }
  
  return Math.round((ospitiSoggetti * numeroNotti * tassaPerNotte) * 100) / 100;
}

function formatDataItaliana(dataISO) {
  // Nome storico invariato per non toccare gli altri punti di chiamata;
  // il formato ora segue la lingua selezionata dall'ospite (vedi i18n.js).
  if (!dataISO) return 'N/A';
  const data = new Date(dataISO);
  if (isNaN(data.getTime())) return 'N/A';
  return data.toLocaleDateString(localeCorrente(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function showNotification(message, type = 'info') {
  document.querySelectorAll('.notification').forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 15px 25px;
    border-radius: 8px; color: white; font-weight: 500; z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: slideIn 0.3s ease-out;
    max-width: 350px; word-wrap: break-word;
    ${type === 'error' ? 'background-color: #e74c3c;' : ''}
    ${type === 'success' ? 'background-color: #27ae60;' : ''}
    ${type === 'info' ? 'background-color: #3498db;' : ''}
  `;
  
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  setTimeout(() => { if (notification.parentNode) notification.remove(); }, 4000);
}

// Modale di conferma personalizzata, al posto del confirm() nativo del
// browser (incoerente tra i browser mobile, in particolare quelli in-app
// come Gmail/Booking/Airbnb). Ritorna una Promise<boolean>.
function showConfirm(message, { confermaLabel = t('confirm.conferma'), annullaLabel = t('confirm.annulla') } = {}) {
  return new Promise(resolve => {
    document.querySelectorAll('.confirm-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const box = document.createElement('div');
    box.className = 'confirm-box';

    const text = document.createElement('p');
    text.className = 'confirm-message';
    text.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'button-group';

    const btnAnnulla = document.createElement('button');
    btnAnnulla.type = 'button';
    btnAnnulla.className = 'btn btn-secondary';
    btnAnnulla.textContent = annullaLabel;

    const btnConferma = document.createElement('button');
    btnConferma.type = 'button';
    btnConferma.className = 'btn btn-primary';
    btnConferma.textContent = confermaLabel;

    function chiudi(risultato) {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(risultato);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') chiudi(false);
    }

    btnAnnulla.addEventListener('click', () => chiudi(false));
    btnConferma.addEventListener('click', () => chiudi(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) chiudi(false); });
    document.addEventListener('keydown', onKeydown);

    actions.appendChild(btnAnnulla);
    actions.appendChild(btnConferma);
    box.appendChild(text);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    btnConferma.focus();
  });
}

// === GESTIONE TOGGLE ===
window.toggleComuneProvincia = function(ospiteNum) {
  const luogoNascitaSelect = document.querySelector(`select[name="ospite${ospiteNum}_luogo_nascita"]`);
  const comuneProvinciaWrapper = document.getElementById(`comune-provincia-wrapper-${ospiteNum}`);
  if (!luogoNascitaSelect || !comuneProvinciaWrapper) return;
  const luogoNascita = luogoNascitaSelect.value;
  const comuneInput = document.querySelector(`input[name="ospite${ospiteNum}_comune"]`);
  const provinciaSelect = document.querySelector(`select[name="ospite${ospiteNum}_provincia"]`);
  if (luogoNascita === "Italia") {
    comuneProvinciaWrapper.style.display = "block";
    if (comuneInput) comuneInput.required = true;
    if (provinciaSelect) provinciaSelect.required = true;
  } else {
    comuneProvinciaWrapper.style.display = "none";
    if (comuneInput) { comuneInput.required = false; comuneInput.value = ""; }
    if (provinciaSelect) { provinciaSelect.required = false; provinciaSelect.value = ""; }
  }
}

// === GESTIONE VERIFICA PRENOTAZIONE ===

// Funzione per verificare la prenotazione
// SOSTITUISCI TUTTA LA FUNZIONE verificaPrenotazione con questa:
window.verificaPrenotazione = async function() {
  const input = document.getElementById('numero-prenotazione');
  const numeroPrenotazione = input?.value?.trim();
  
  if (!numeroPrenotazione) {
    showNotification(t('notif.numeroMancante'), 'error');
    input?.focus();
    return;
  }
  
  const btn = document.querySelector('#step-0 .btn-primary');
  const originalText = btn?.innerHTML || t('step0.verifyBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = t('step0.verifyingBtn');
  }
  
  try {
    showNotification(t('notif.ricercaInCorso'), 'info');
    
    const response = await fetch(`${API_BASE_URL}/verifica-prenotazione`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ numeroPrenotazione })
    });
    
    const result = await response.json();
    
    if (result.found && result.dati) {
      showNotification(t('notif.prenotazioneTrovata'), 'success');
      window.datiPrecompilati = true;
      currentStep = 1;
      mostraStepCorrente();
      // IMPORTANTE: precompilaDatiPrenotazione va chiamata DOPO
      // mostraStepCorrente(), cioè quando #step-1 è già visibile.
      // Il campo <input type="date"> è dentro .step, che ha
      // display:none + content-visibility:hidden finché non è .active:
      // se gli si assegna un valore mentre è ancora nascosto, Chrome lo
      // registra correttamente nel DOM (per questo la validazione passava
      // e la data arrivava giusta nel riepilogo) ma non ridisegna il
      // widget nativo, che resta visivamente vuoto finché non si tocca il
      // campo. Un requestAnimationFrame in più assicura che il browser
      // abbia già applicato il cambio di visibilità prima di scrivere il
      // valore, evitando che il bug si ripresenti per timing.
      requestAnimationFrame(() => {
        precompilaDatiPrenotazione(result.dati);
      });
    } else {
      // RESTA SULLA SCHERMATA - NON VA AVANTI
      showNotification(t('notif.prenotazioneNonTrovata'), 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
      input?.focus();
    }
  } catch (error) {
    console.error('Errore verifica prenotazione:', error);
    showNotification(t('notif.erroreVerifica'), 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
    input?.focus();
  } finally {
    if (currentStep === 0 && btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Funzione per saltare la verifica
window.saltaVerifica = function() {
  window.datiPrecompilati = false;
  currentStep = 1;
  mostraStepCorrente();
  showNotification(t('notif.compilaManualmente'), 'info');
}

// Funzione per tornare alla verifica
window.tornaAVerifica = async function() {
  if (window.datiPrecompilati) {
    // Se i dati erano pre-compilati, chiedi conferma
    const confermato = await showConfirm(
      t('confirm.tornaVerifica')
    );
    if (confermato) {
      currentStep = 0;
      mostraStepCorrente();
    }
  } else {
    currentStep = 0;
    mostraStepCorrente();
  }
}


// === NAVIGAZIONE STEP ===
window.prossimoStep = function() {
  console.log(`🚀 prossimoStep - currentStep: ${currentStep}`);
  
  if (currentStep === 1) {
    if (!validaStep1()) return;
    if (!stepGenerated) {
      generaStepOspiti();
      stepGenerated = true;
    }
    currentStep = 2;
  } else if (currentStep >= 2 && currentStep <= numeroOspiti + 1) {
    const ospiteCorrente = currentStep - 1;
    console.log(`✅ Validazione ospite ${ospiteCorrente}...`);
    
    if (!validaStepOspite(ospiteCorrente)) return;
    
    if (currentStep === numeroOspiti + 1) {
      console.log('📋 === ULTIMO OSPITE - VAI AL RIEPILOGO ===');
      console.log(`Dati: ospiti=${numeroOspiti}, notti=${numeroNotti}, dataCheckin=${dataCheckin}`);
      
      // Verifica che l'elemento esista prima di chiamare preparaRiepilogo
      const summaryContent = document.getElementById('summary-content');
      if (!summaryContent) {
        console.error('❌ ERRORE CRITICO: #summary-content non trovato!');
        showNotification(t('notif.erroreRiepilogoCaricamento'), 'error');
        return;
      }
      
      preparaRiepilogo();
      currentStep = 99;
      
      // Verifica che il riepilogo sia stato effettivamente creato
      setTimeout(() => {
        if (summaryContent.children.length === 0) {
          console.error('❌ RIEPILOGO VUOTO DOPO preparaRiepilogo()!');
          showNotification(t('notif.erroreRiepilogoVisualizzazione'), 'error');
        } else {
          console.log('✅ Riepilogo visualizzato con successo:', summaryContent.children.length, 'sezioni');
        }
      }, 100);
    } else {
      currentStep++;
    }
  }
  
  mostraStepCorrente();
}

// === AGGIUNGI QUESTA FUNZIONE DI VERIFICA ALL'INIZIALIZZAZIONE ===


window.indietroStep = function() {
  if (currentStep === 99) {
    currentStep = numeroOspiti + 1;
  } else if (currentStep > 1) {
    currentStep--;
  }
  mostraStepCorrente();
}


// === VALIDAZIONE ===
function validaStep1() {
  const dataCheckinInput = document.getElementById("data-checkin");
  const numOspitiSelect = document.getElementById("numero-ospiti");
  const numNottiInput = document.getElementById("numero-notti");
  
  if (!dataCheckinInput?.value) {
    showNotification(t('valid.dataRichiesta'), "error");
    dataCheckinInput?.focus();
    return false;
  }

  const dataScelta = new Date(dataCheckinInput.value);
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  
  if (!window.datiPrecompilati && dataScelta < oggi) {
    showNotification(t('valid.dataPassato'), "error");
    dataCheckinInput?.focus();
    return false;
  }

  const appartamentiSelezionati = getAppartamentiSelezionati();
  if (appartamentiSelezionati.length === 0) {
    showNotification(t('valid.appartamentoRichiesto'), "error");
    document.getElementById('appartamento-group')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  if (!numOspitiSelect?.value) {
    showNotification(t('valid.ospitiRichiesti'), "error");
    numOspitiSelect?.focus();
    return false;
  }

  const notti = parseInt(numNottiInput?.value) || 0;
  if (notti < 1) {
    showNotification(t('valid.nottiNonValide'), "error");
    numNottiInput?.focus();
    return false;
  }

  dataCheckin = dataCheckinInput.value;
  numeroOspiti = parseInt(numOspitiSelect.value);
  numeroNotti = notti;

  if (numeroOspiti > 1) {
    const tipoGruppoSelect = document.getElementById("tipo-gruppo");
    if (!tipoGruppoSelect?.value) {
      showNotification(t('valid.tipoGruppoRichiesto'), "error");
      tipoGruppoSelect?.focus();
      return false;
    }
  }

  return true;
}


function validaStepOspite(numOspite) {
  const requiredFields = [
    { name: `ospite${numOspite}_cognome`, label: t('field.cognome') },
    { name: `ospite${numOspite}_nome`, label: t('field.nome') },
    { name: `ospite${numOspite}_genere`, label: t('field.genere') },
    { name: `ospite${numOspite}_nascita`, label: t('field.dataNascita') },
    { name: `ospite${numOspite}_cittadinanza`, label: t('field.cittadinanza') },
    { name: `ospite${numOspite}_luogo_nascita`, label: t('field.luogoNascita') }
  ];

  // ✅ CAMPI DOCUMENTO SOLO PER OSPITE 1
  if (numOspite === 1) {
    requiredFields.push(
      { name: `ospite1_tipo_documento`, label: t('field.tipoDocumento') },
      { name: `ospite1_numero_documento`, label: t('field.numeroDocumento') },
      { name: `ospite1_luogo_rilascio`, label: t('field.luogoRilascio') }
    );
  }

  for (const field of requiredFields) {
    const input = document.querySelector(`[name="${field.name}"]`);
    if (!input?.value?.trim()) {
      showNotification(t('valid.campoObbligatorio', { campo: field.label, n: numOspite }), 'error');
      input?.focus();
      return false;
    }
  }

  const luogoNascita = document.querySelector(`[name="ospite${numOspite}_luogo_nascita"]`)?.value;
  if (luogoNascita === "Italia") {
    const comune = document.querySelector(`input[name="ospite${numOspite}_comune"]`)?.value?.trim();
    const provincia = document.querySelector(`select[name="ospite${numOspite}_provincia"]`)?.value;
    if (!comune || !provincia) {
      showNotification(t('valid.comuneProvinciaObbligatori'), 'error');
      return false;
    }
  }

  // ✅ VALIDAZIONE MAGGIORENNE E DOCUMENTO SOLO PER OSPITE 1
  if (numOspite === 1) {
    const nascita = document.querySelector(`input[name="ospite1_nascita"]`)?.value;
    if (nascita) {
      const eta = calcolaEta(nascita);
      if (eta < 18) {
        showNotification(t('valid.maggiorenne'), "error");
        return false;
      }
    }
    
    // Servono entrambi i lati: si segnala il primo mancante e lo si porta
    // a schermo, così l'ospite vede subito dove intervenire.
    const mancanti = latiMancanti(1);
    if (mancanti.length > 0) {
      showNotification(t('valid.latoMancante', { lato: nomeLato(mancanti[0]) }), 'error');
      document.getElementById(`upload-side-1-${mancanti[0]}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
  }

  return true;
}
/**
 * Valida che tutti i dati della prenotazione siano completi
 */
function validaPrenotazioneCompleta() {
  console.log('🔍 Validazione prenotazione completa...');
  
  // Verifica dati base prenotazione
  if (!dataCheckin) {
    showNotification(t('valid.dataMancante'), 'error');
    return false;
  }
  
  if (getAppartamentiSelezionati().length === 0) {
    showNotification(t('valid.appartamentoMancante'), 'error');
    return false;
  }
  
  if (!numeroOspiti || numeroOspiti < 1) {
    showNotification(t('valid.ospitiNonValidi'), 'error');
    return false;
  }
  
  // Verifica che tutti gli ospiti abbiano i dati obbligatori
  for (let i = 1; i <= numeroOspiti; i++) {
    const cognome = document.querySelector(`input[name="ospite${i}_cognome"]`)?.value?.trim();
    const nome = document.querySelector(`input[name="ospite${i}_nome"]`)?.value?.trim();
    const nascita = document.querySelector(`input[name="ospite${i}_nascita"]`)?.value;
    const genere = document.querySelector(`select[name="ospite${i}_genere"]`)?.value;
    const cittadinanza = document.querySelector(`select[name="ospite${i}_cittadinanza"]`)?.value;
    const luogoNascita = document.querySelector(`select[name="ospite${i}_luogo_nascita"]`)?.value;
    
    if (!cognome || !nome) {
      showNotification(t('valid.nomeCognomeMancante', { n: i }), 'error');
      return false;
    }
    
    if (!nascita) {
      showNotification(t('valid.dataNascitaMancante', { nome, cognome }), 'error');
      return false;
    }
    
    if (!genere) {
      showNotification(t('valid.genereMancante', { nome, cognome }), 'error');
      return false;
    }
    
    if (!cittadinanza) {
      showNotification(t('valid.cittadinanzaMancante', { nome, cognome }), 'error');
      return false;
    }
    
    if (!luogoNascita) {
      showNotification(t('valid.luogoNascitaMancante', { nome, cognome }), 'error');
      return false;
    }
    
    // Verifica comune/provincia se nato in Italia
    if (luogoNascita === 'Italia') {
      const comune = document.querySelector(`input[name="ospite${i}_comune"]`)?.value?.trim();
      const provincia = document.querySelector(`select[name="ospite${i}_provincia"]`)?.value;
      
      if (!comune || !provincia) {
        showNotification(t('valid.comuneProvinciaMancanti', { nome, cognome }), 'error');
        return false;
      }
    }
    
    // ✅ VERIFICA DOCUMENTI AGGIUNTIVI SOLO PER OSPITE 1
    if (i === 1) {
      const tipoDocumento = document.querySelector(`select[name="ospite1_tipo_documento"]`)?.value;
      const numeroDocumento = document.querySelector(`input[name="ospite1_numero_documento"]`)?.value?.trim();
      const luogoRilascio = document.querySelector(`select[name="ospite1_luogo_rilascio"]`)?.value;
      
      if (!tipoDocumento || !numeroDocumento || !luogoRilascio) {
        showNotification(t('valid.documentoIncompleto'), 'error');
        return false;
      }
      
      // ✅ VERIFICA FILE CARICATI (FRONTE + RETRO) SOLO PER OSPITE 1
      const latiDaCaricare = latiMancanti(1);
      if (latiDaCaricare.length > 0) {
        showNotification(t('valid.latoMancanteResponsabile', { lato: nomeLato(latiDaCaricare[0]) }), 'error');
        return false;
      }
    }
  }
  
  console.log('✅ Validazione completata con successo');
  return true;
}

// === DOCUMENTO RESPONSABILE: FRONTE + RETRO ===
// Il responsabile deve fornire SEMPRE due file distinti: fronte e retro del
// documento. Vale sia per l'upload da dispositivo sia per le foto scattate
// dalla fotocamera (due scatti separati, uno per lato). Ogni lato ha il
// proprio input file: `ospite1_documento_fronte` e `ospite1_documento_retro`.
const LATI_DOCUMENTO = ['fronte', 'retro'];

// Unica eccezione all'obbligo dei due file: il passaporto non ha un retro da
// fotografare, la pagina con i dati e la foto è una sola. Il confronto è per
// sottostringa in maiuscolo, così copre tutte le voci dell'elenco
// (PASSAPORTO ORDINARIO / DIPLOMATICO / DI SERVIZIO). Per aggiungere altri
// documenti senza retro basta estendere questo array.
const DOCUMENTI_SENZA_RETRO = ['PASSAPORTO'];

function inputDocumento(ospiteNum, lato) {
  return document.getElementById(`ospite${ospiteNum}_documento_${lato}`);
}

function tipoDocumentoSelezionato(ospiteNum) {
  return document.querySelector(`select[name="ospite${ospiteNum}_tipo_documento"]`)?.value || '';
}

function retroObbligatorio(ospiteNum) {
  const tipo = tipoDocumentoSelezionato(ospiteNum).toUpperCase();
  return !DOCUMENTI_SENZA_RETRO.some(senzaRetro => tipo.includes(senzaRetro));
}

// Lati effettivamente richiesti per il documento scelto.
function latiRichiesti(ospiteNum) {
  return retroObbligatorio(ospiteNum) ? LATI_DOCUMENTO : ['fronte'];
}

// Nome del lato nella lingua scelta dall'ospite (usato nelle notifiche e
// nei messaggi di errore, dove non basta l'attributo data-i18n).
function nomeLato(lato) {
  return t(lato === 'fronte' ? 'guest.latoFronte' : 'guest.latoRetro');
}

// Lati ancora da caricare, nell'ordine fronte -> retro.
function latiMancanti(ospiteNum) {
  return latiRichiesti(ospiteNum).filter(lato => !inputDocumento(ospiteNum, lato)?.files?.length);
}

// Messaggio di "caricamento completato": cambia se il retro non serve.
function chiaveCompletamento(ospiteNum) {
  return latiRichiesti(ospiteNum).length === 1 ? 'guest.documentoCompleto' : 'guest.documentiCompleti';
}

// Aggiorna la label del singolo riquadro (nome file o testo tradotto).
function aggiornaLabelUpload(ospiteNum, lato) {
  const input = inputDocumento(ospiteNum, lato);
  if (!input) return;
  const label = document.querySelector(`label[for="${input.id}"]`) || input.previousElementSibling;
  const riquadro = document.getElementById(`upload-side-${ospiteNum}-${lato}`);
  const file = input.files?.[0];

  if (file) {
    // Il nome del file non è una stringa traducibile: si toglie data-i18n,
    // altrimenti al cambio lingua applicaTraduzioni() riscriverebbe
    // "Scegli file" sopra un file in realtà già allegato.
    if (label) {
      label.removeAttribute('data-i18n');
      label.textContent = `✅ ${accorciaNomeFile(file.name)}`;
      label.classList.add('has-file');
    }
    riquadro?.classList.add('completo');
  } else {
    if (label) {
      label.setAttribute('data-i18n', 'guest.scegliFile');
      label.textContent = t('guest.scegliFile');
      label.classList.remove('has-file');
    }
    riquadro?.classList.remove('completo');
  }
}

// Contatore "X di 2 file caricati" sotto al titolo della sezione documento.
function aggiornaStatoDocumenti(ospiteNum) {
  const stato = document.getElementById(`upload-status-${ospiteNum}`);
  if (!stato) return;
  const richiesti = latiRichiesti(ospiteNum);
  const caricati = richiesti.length - latiMancanti(ospiteNum).length;
  const completo = caricati === richiesti.length;
  const chiave = completo ? chiaveCompletamento(ospiteNum) : 'guest.statoDocumenti';
  const params = { n: caricati, tot: richiesti.length };
  // data-i18n-key/params: così il contatore si ritraduce da solo se
  // l'ospite cambia lingua a documento già caricato.
  stato.setAttribute('data-i18n-key', chiave);
  stato.setAttribute('data-i18n-params', JSON.stringify(params));
  stato.textContent = t(chiave, params);
  stato.classList.toggle('completo', completo);
}

// Notifica unica dopo ogni caricamento: conferma il lato appena caricato e,
// se manca ancora l'altro, dice subito quale.
function notificaLatoCaricato(ospiteNum, lato) {
  const mancanti = latiMancanti(ospiteNum);
  if (mancanti.length === 0) {
    showNotification(t(chiaveCompletamento(ospiteNum) === 'guest.documentoCompleto'
      ? 'notif.documentoCompleto'
      : 'notif.documentiCompleti'), 'success');
  } else {
    showNotification(t('notif.latoCaricatoProsegui', {
      lato: nomeLato(lato),
      mancante: nomeLato(mancanti[0])
    }), 'info');
  }
}

// Con il passaporto il retro diventa facoltativo: il riquadro resta a schermo
// (se l'ospite vuole può comunque allegare una seconda pagina) ma perde
// l'asterisco, cambia il testo di aiuto e non blocca più la validazione.
// Richiamata all'onchange del tipo documento e dopo la creazione dello step.
window.aggiornaObbligoRetro = function(ospiteNum) {
  const riquadro = document.getElementById(`upload-side-${ospiteNum}-retro`);
  if (!riquadro) return;

  const obbligatorio = retroObbligatorio(ospiteNum);
  riquadro.classList.toggle('facoltativo', !obbligatorio);

  const asterisco = riquadro.querySelector('.required-mark');
  if (asterisco) asterisco.style.display = obbligatorio ? '' : 'none';

  const badge = riquadro.querySelector('.upload-side-badge');
  if (badge) badge.style.display = obbligatorio ? 'none' : '';

  const hint = riquadro.querySelector('.upload-side-hint');
  if (hint) {
    // Si aggiorna anche data-i18n, così il testo resta corretto se l'ospite
    // cambia lingua dopo aver scelto il tipo di documento.
    const chiave = obbligatorio ? 'guest.latoRetroHint' : 'guest.latoRetroPassaporto';
    hint.setAttribute('data-i18n', chiave);
    hint.textContent = t(chiave);
  }

  aggiornaStatoDocumenti(ospiteNum);
}

// Markup di un riquadro di upload (uno per lato).
function bloccoUploadLato(ospiteNum, lato) {
  const isFronte = lato === 'fronte';
  const keyTitolo = isFronte ? 'guest.latoFronte' : 'guest.latoRetro';
  const keyHint = isFronte ? 'guest.latoFronteHint' : 'guest.latoRetroHint';
  const keyFoto = isFronte ? 'guest.fotografaFronte' : 'guest.fotografaRetro';
  const inputId = `ospite${ospiteNum}_documento_${lato}`;
  const suffisso = `${ospiteNum}-${lato}`;

  return `
            <div class="upload-side" id="upload-side-${suffisso}">
              <div class="upload-side-header">
                <span class="upload-side-step">${isFronte ? '1' : '2'}</span>
                <span class="upload-side-title" data-i18n="${keyTitolo}">${t(keyTitolo)}</span>
                <span class="required-mark">*</span>
                ${isFronte ? '' : `<span class="upload-side-badge" data-i18n="guest.facoltativo" style="display: none;">${t('guest.facoltativo')}</span>`}
              </div>
              <p class="upload-side-hint" data-i18n="${keyHint}">${t(keyHint)}</p>
              <div class="upload-group">
                <label for="${inputId}" class="upload-label" data-i18n="guest.scegliFile">${t('guest.scegliFile')}</label>
                <input type="file" id="${inputId}" name="${inputId}"
                       class="upload-input" accept="image/*,.pdf"
                       onchange="handleFileUpload(this, ${ospiteNum}, '${lato}')">
              </div>
              <div class="camera-group">
                <button type="button" class="camera-btn" onclick="openCamera(${ospiteNum}, '${lato}')" data-i18n="${keyFoto}">${t(keyFoto)}</button>
              </div>
              <div id="camera-preview-${suffisso}" class="camera-preview" style="display: none;">
                <video id="camera-video-${suffisso}" autoplay playsinline></video>
                <canvas id="camera-canvas-${suffisso}" style="display: none;"></canvas>
                <div class="camera-controls">
                  <button type="button" class="capture-btn" onclick="capturePhoto(${ospiteNum}, '${lato}')" data-i18n="guest.scatta">${t('guest.scatta')}</button>
                  <button type="button" class="close-camera-btn" onclick="closeCamera(${ospiteNum}, '${lato}')" data-i18n="guest.chiudi">${t('guest.chiudi')}</button>
                </div>
              </div>
            </div>`;
}

// === GENERAZIONE STEP OSPITI ===
function generaStepOspiti() {
  const form = document.getElementById('checkin-form');
  const stepFinal = document.getElementById('step-final');
  if (!form || !stepFinal) return;
  
  for (let i = 1; i <= numeroOspiti; i++) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.id = `step-${i + 1}`;
    
    // ✅ CAMPI DOCUMENTO SOLO PER OSPITE 1
    let campiDocumento = '';
    
    // Opzioni Paese/documento: il value inviato al backend resta SEMPRE il
    // nome italiano (coerente con Google Sheets, PDF proprietario, Stripe);
    // data-i18n-country/doctype permette a applicaTraduzioni() di aggiornare
    // solo l'etichetta visibile se l'ospite cambia lingua più avanti.
    const opzioniStati = stati.map(stato =>
      `<option value="${stato}" data-i18n-country="${stato}">${traduciPaese(stato)}</option>`
    ).join('');
    const opzioniProvince = province.map(prov => `<option value="${prov}">${prov}</option>`).join('');

    if (i === 1) {
      const opzioniDocumenti = tipiDocumento.map(tipo =>
        `<option value="${tipo}" data-i18n-doctype="${tipo}">${traduciDocumento(tipo)}</option>`
      ).join('');

      campiDocumento = `
        <div class="form-group">
          <label class="form-label" for="ospite1_tipo_documento" data-i18n="guest.tipoDocumento">Tipo documento *</label>
          <select id="ospite1_tipo_documento" name="ospite1_tipo_documento" class="form-select" required
                  onchange="aggiornaObbligoRetro(1)">
            <option value="" data-i18n="guest.selezionaTipoDocumento">Seleziona tipo documento</option>
            ${opzioniDocumenti}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite1_numero_documento" data-i18n="guest.numeroDocumento">Numero documento *</label>
          <input type="text" id="ospite1_numero_documento" name="ospite1_numero_documento" 
                 class="form-input" required placeholder="Es. AA1234567" maxlength="20" pattern="[A-Za-z0-9]+">
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite1_luogo_rilascio" data-i18n="guest.luogoRilascio">Luogo rilascio documento *</label>
          <select id="ospite1_luogo_rilascio" name="ospite1_luogo_rilascio" class="form-select" required>
            <option value="" data-i18n="guest.selezionaLuogoRilascio">Seleziona luogo rilascio</option>
            ${opzioniStati}
          </select>
        </div>
        <div class="document-section" style="grid-column: 1 / -1;">
          <h3 class="document-title" data-i18n="guest.documentoTitolo">📄 Documento di identità</h3>
          <p class="document-subtitle" data-i18n="guest.documentoSottotitolo">Servono due file: il fronte e il retro del documento (foto o PDF). Con il passaporto basta la pagina con i dati.</p>
          <p class="upload-status" id="upload-status-1" data-i18n-key="guest.statoDocumenti" data-i18n-params='{"n":0}'>${t('guest.statoDocumenti', { n: 0 })}</p>
          <div class="document-upload">
${bloccoUploadLato(1, 'fronte')}
${bloccoUploadLato(1, 'retro')}
          </div>
        </div>
      `;
    }

    const titoloOspite = t('guest.title', { n: i }) + (i === 1 ? t('guest.responsabileTag') : '');

    stepDiv.innerHTML = `
      <div class="step-header">
        <h2 class="step-title" data-i18n-key="guest.title" data-i18n-params='${JSON.stringify({ n: i })}'${i === 1 ? ' data-i18n-suffix="guest.responsabileTag"' : ''}>${titoloOspite}</h2>
        <p class="step-subtitle" data-i18n="guest.subtitle">Inserisci i dati dell'ospite</p>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="ospite${i}_cognome" data-i18n="guest.cognome">Cognome *</label>
          <input type="text" id="ospite${i}_cognome" name="ospite${i}_cognome" class="form-input" required maxlength="50">
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_nome" data-i18n="guest.nome">Nome *</label>
          <input type="text" id="ospite${i}_nome" name="ospite${i}_nome" class="form-input" required maxlength="50">
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_genere" data-i18n="guest.genere">Genere *</label>
          <select id="ospite${i}_genere" name="ospite${i}_genere" class="form-select" required>
            <option value="" data-i18n="guest.selezionaGenere">Seleziona genere</option>
            <option value="M" data-i18n="guest.maschio">Maschio</option>
            <option value="F" data-i18n="guest.femmina">Femmina</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_nascita" data-i18n="guest.dataNascita">Data di nascita *</label>
          <input type="date" id="ospite${i}_nascita" name="ospite${i}_nascita" 
                 class="form-input" required max="${new Date().toISOString().split('T')[0]}" min="1900-01-01">
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_cittadinanza" data-i18n="guest.cittadinanza">Cittadinanza *</label>
          <select id="ospite${i}_cittadinanza" name="ospite${i}_cittadinanza" class="form-select" required>
            <option value="" data-i18n="guest.selezionaCittadinanza">Seleziona cittadinanza</option>
            ${opzioniStati}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_luogo_nascita" data-i18n="guest.luogoNascita">Luogo di nascita *</label>
          <select id="ospite${i}_luogo_nascita" name="ospite${i}_luogo_nascita" 
                  class="form-select" required onchange="toggleComuneProvincia(${i})">
            <option value="" data-i18n="guest.selezionaLuogoNascita">Seleziona luogo nascita</option>
            ${opzioniStati}
          </select>
        </div>
        <div id="comune-provincia-wrapper-${i}" style="display: none;" class="form-group full-width">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ospite${i}_comune" data-i18n="guest.comune">Comune *</label>
              <input type="text" id="ospite${i}_comune" name="ospite${i}_comune" 
                     class="form-input" placeholder="Es. Napoli" data-i18n-placeholder="guest.comunePlaceholder" maxlength="50">
            </div>
            <div class="form-group">
              <label class="form-label" for="ospite${i}_provincia" data-i18n="guest.provincia">Provincia *</label>
              <select id="ospite${i}_provincia" name="ospite${i}_provincia" class="form-select">
                <option value="" data-i18n="guest.selezionaProvincia">Seleziona provincia</option>
                ${opzioniProvince}
              </select>
            </div>
          </div>
        </div>
        ${campiDocumento}
      </div>
      
      <div class="button-group">
        <button type="button" class="btn btn-secondary" onclick="indietroStep()" data-i18n="guest.backBtn">← Indietro</button>
        <button type="button" class="btn btn-primary" onclick="prossimoStep()" data-i18n="${i === numeroOspiti ? 'guest.nextBtnSummary' : 'guest.nextBtnMore'}">
          ${i === numeroOspiti ? t('guest.nextBtnSummary') : t('guest.nextBtnMore')}
        </button>
      </div>
    `;
    form.insertBefore(stepDiv, stepFinal);
    applicaTraduzioni(stepDiv);
    if (i === 1) aggiornaObbligoRetro(1);
  }
}

// === RIEPILOGO ===
// mantieniPosizione=true viene usato quando la funzione è richiamata per
// ri-tradurre il riepilogo dopo un cambio lingua (in quel caso non ha senso
// far scattare di nuovo lo scroll automatico verso lo step).
function preparaRiepilogo(mantieniPosizione) {
  console.log('📋 === PREPARAZIONE RIEPILOGO ===');
  
  const totale = calcolaTotale();
  const summaryContent = document.getElementById('summary-content');
  
  if (!summaryContent) {
    console.error('❌ Elemento summary-content non trovato!');
    return;
  }
  
  console.log('✅ Container riepilogo trovato');
  console.log(`💰 Totale calcolato: €${totale.toFixed(2)}`);
  
  summaryContent.innerHTML = '';
  
  const fragment = document.createDocumentFragment();
  
  // === SEZIONE DETTAGLI SOGGIORNO ===
  const dettagliSection = document.createElement('div');
  dettagliSection.className = 'summary-section';
  
  const appartamenti = getAppartamentiSelezionati();
  const appartamentoDisplay = appartamenti.length === 1 
    ? nomeAppartamentoTradotto(appartamenti[0])
    : appartamenti.map(a => nomeAppartamentoTradotto(a)).join('<br>➕ ');
  
  const dataFormatted = formatDataItaliana(dataCheckin);
  
  console.log('📍 Dettagli:', { dataCheckin, appartamenti, numeroOspiti, numeroNotti });
  
  dettagliSection.innerHTML = `
    <h3 style="font-size: 1.5rem; color: #8b7d6b; margin-bottom: 20px;" data-i18n="summary.dettagliTitle">📍 Dettagli soggiorno</h3>
    <div class="summary-item">
      <span data-i18n="summary.dataCheckin">Data Check-in:</span>
      <span><strong>${dataFormatted}</strong></span>
    </div>
    <div class="summary-item">
      <span data-i18n="summary.appartamenti">Appartamento/i:</span>
      <span><strong>${appartamentoDisplay}</strong></span>
    </div>
    <div class="summary-item">
      <span data-i18n="summary.numeroOspiti">Numero ospiti:</span>
      <span><strong>${numeroOspiti}</strong></span>
    </div>
    <div class="summary-item">
      <span data-i18n="summary.numeroNotti">Numero notti:</span>
      <span><strong>${numeroNotti}</strong></span>
    </div>
  `;
  fragment.appendChild(dettagliSection);
  
  // === SEZIONE OSPITI ===
  const ospitiSection = document.createElement('div');
  ospitiSection.className = 'summary-section';
  ospitiSection.style.marginTop = '20px';
  
  let ospitiHTML = '<h3 style="font-size: 1.5rem; color: #8b7d6b; margin-bottom: 20px;" data-i18n="summary.ospitiTitle">👥 Ospiti</h3>';
  
  for (let i = 1; i <= numeroOspiti; i++) {
    const cognome = document.querySelector(`input[name="ospite${i}_cognome"]`)?.value || '';
    const nome = document.querySelector(`input[name="ospite${i}_nome"]`)?.value || '';
    const nascita = document.querySelector(`input[name="ospite${i}_nascita"]`)?.value || '';
    const eta = nascita ? calcolaEta(nascita) : 0;
    const etaChiave = eta >= 4 ? 'summary.etaSoggetta' : 'summary.etaEsente';
    
    ospitiHTML += `
      <div class="guest-summary" style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 12px; border: 1px solid #e8dcc0;">
        <strong style="color: #8b7d6b; font-size: 1.05rem; display: block;">${cognome} ${nome}</strong>
        ${i === 1 ? `<span style="color: #a67c52; font-size: 0.9rem; display: block;" data-i18n="summary.responsabile">(Responsabile)</span>` : ''}
        <span class="age" style="color: #a0927f; font-size: 0.9rem; display: block; margin-top: 5px;"
              data-i18n-key="${etaChiave}" data-i18n-params='${JSON.stringify({ eta })}'>
          ${t(etaChiave, { eta })}
        </span>
      </div>
    `;
  }
  
  ospitiSection.innerHTML = ospitiHTML;
  fragment.appendChild(ospitiSection);
  
  // === SEZIONE TOTALE ===
  const totaleSection = document.createElement('div');
  totaleSection.className = 'summary-section';
  totaleSection.style.marginTop = '20px';
  totaleSection.innerHTML = `
    <h3 style="font-size: 1.5rem; color: #8b7d6b; margin-bottom: 20px;" data-i18n="summary.totaleTitle">💰 Totale tassa di soggiorno</h3>
    <div class="total-amount" style="font-size: 2rem; font-weight: 700; color: #a67c52; text-align: center; margin: 20px 0; padding: 20px; background: linear-gradient(135deg, rgba(184, 153, 104, 0.1) 0%, rgba(166, 124, 82, 0.1) 100%); border-radius: 12px;">
      €${totale.toFixed(2)}
    </div>
    <small class="tax-note" style="display: block; text-align: center; color: #a0927f; font-size: 0.85rem; font-style: italic; margin-top: 10px;" data-i18n="summary.totaleNota">
      Tassa di €1,50 per notte per ospiti dai 4 anni in su
    </small>
  `;
  fragment.appendChild(totaleSection);
  
  summaryContent.appendChild(fragment);
  
  console.log('✅ Riepilogo inserito nel DOM');
  console.log('📋 === FINE PREPARAZIONE RIEPILOGO ===');
  
  aggiornaBottonePagamento(totale);

  // ✅ FIX: i blocchi appena inseriti (dettagli soggiorno, ospiti, totale,
  // pulsante indietro) hanno gli attributi data-i18n già pronti, ma finché
  // nessuno passa a ritradurre il DOM restano con il testo italiano scritto
  // nel template. Per gli step ospite questo sweep veniva già fatto in
  // generaStepOspiti(); qui mancava, quindi al primo caricamento del
  // riepilogo (non solo al cambio lingua) il testo statico restava in
  // italiano anche con EN/DE selezionato.
  applicaTraduzioni(document);
  
  if (!mantieniPosizione) {
    setTimeout(() => {
      const finalStep = document.getElementById('step-final');
      if (finalStep) {
        finalStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
}

// === FUNZIONE DI DEBUG ===
// Aggiungi questa funzione per testare il riepilogo
window.testRiepilogo = function() {
  console.log('🧪 Test visualizzazione riepilogo');
  
  // Verifica che l'elemento esista
  const summaryContent = document.getElementById('summary-content');
  console.log('Container riepilogo:', summaryContent);
  
  if (!summaryContent) {
    console.error('❌ #summary-content NON TROVATO nel DOM!');
    console.log('HTML del form:', document.getElementById('checkin-form')?.innerHTML.substring(0, 500));
    return;
  }
  
  // Verifica che i dati siano presenti
  console.log('Dati globali:', {
    currentStep,
    numeroOspiti,
    numeroNotti,
    dataCheckin,
    stepGenerated
  });
  
  // Forza preparazione riepilogo
  console.log('🔄 Forzando preparazione riepilogo...');
  preparaRiepilogo();
  
  // Verifica il contenuto
  console.log('Contenuto summary-content:', summaryContent.innerHTML.substring(0, 500));
}
// SOSTITUISCI TUTTA LA FUNZIONE con questa:
function aggiornaBottonePagamento(totale) {
  const finalStep = document.getElementById('step-final');
  const buttonGroup = finalStep?.querySelector('.button-group');
  if (!buttonGroup) return;
  const importo = totale.toFixed(2);
  buttonGroup.innerHTML = `
    <button type="button" class="btn btn-secondary" onclick="indietroStep()" data-i18n="stepFinal.backBtn">← Indietro</button>
    <button type="button" class="btn btn-primary btn-payment" id="btn-procedi-pagamento" disabled onclick="procediAlPagamento()"
            data-i18n-key="payment.payButton" data-i18n-params='${JSON.stringify({ amount: importo })}'>
      ${t('payment.payButton', { amount: importo })}
    </button>
  `;
  
  // Gestione checkbox privacy
  setTimeout(() => {
    const privacyCheckbox = document.getElementById('privacy-consent');
    const paymentBtn = document.getElementById('btn-procedi-pagamento');
    
    if (privacyCheckbox && paymentBtn) {
      paymentBtn.disabled = !privacyCheckbox.checked;
      
      // La funzione può essere richiamata più volte (es. dopo un cambio
      // lingua, per ritradurre l'importo): l'input privacy invece resta
      // sempre lo stesso elemento del DOM, quindi il listener va agganciato
      // una volta sola, altrimenti si accumulano copie duplicate e la
      // notifica "Privacy accettata" comparirebbe più volte.
      if (privacyCheckbox.dataset.listenerAgganciato !== 'true') {
        privacyCheckbox.addEventListener('change', function() {
          const btn = document.getElementById('btn-procedi-pagamento');
          if (btn) btn.disabled = !this.checked;
          if (this.checked) {
            showNotification(t('notif.privacyAccettata'), 'success');
          }
        });
        privacyCheckbox.dataset.listenerAgganciato = 'true';
      }
    }
  }, 100);
}

// === UPLOAD FILE DOCUMENTO ===
// I telefoni generano spesso nomi file molto lunghi (es. screenshot,
// foto della galleria). Senza accorciarli, il testo mandava in overflow
// la label e "spingeva" fuori schermo la colonna accanto nella griglia
// fronte/retro documento.
function accorciaNomeFile(nome, maxLen = 22) {
  if (!nome || nome.length <= maxLen) return nome;
  const puntoIdx = nome.lastIndexOf('.');
  const estensione = puntoIdx > 0 ? nome.slice(puntoIdx) : '';
  const base = puntoIdx > 0 ? nome.slice(0, puntoIdx) : nome;
  const maxBase = Math.max(maxLen - estensione.length - 1, 3);
  return base.slice(0, maxBase) + '…' + estensione;
}

window.handleFileUpload = function(input, ospiteNum, lato) {
  // `lato` arriva dal markup ('fronte' / 'retro'); in fallback lo si deduce
  // dall'id dell'input (ospite1_documento_fronte -> fronte).
  const latoEffettivo = lato || input?.id?.split('_').pop();
  const file = input.files?.[0];

  if (file) {
    // Il limite qui era fissato a 2 MB, PRIMA che la compressione (più sotto,
    // comprimiImmagineBase64) avesse la possibilità di agire — quella riduce
    // qualunque immagine a ~600 KB ridimensionandola a 1024px. Una foto scattata
    // con un telefono moderno (spesso 4-8 MB) veniva quindi rifiutata anche se
    // la pipeline di compressione l'avrebbe gestita senza problemi. Il limite
    // qui serve solo a scartare file anomali, non foto normali: alzato a 20 MB.
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      showNotification(t('notif.fileTroppoGrande', { size: fileSizeMB }), 'error');
      input.value = '';
      aggiornaLabelUpload(ospiteNum, latoEffettivo);
      aggiornaStatoDocumenti(ospiteNum);
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showNotification(t('notif.formatoNonSupportato'), 'error');
      input.value = '';
      aggiornaLabelUpload(ospiteNum, latoEffettivo);
      aggiornaStatoDocumenti(ospiteNum);
      return;
    }
  }

  aggiornaLabelUpload(ospiteNum, latoEffettivo);
  aggiornaStatoDocumenti(ospiteNum);

  if (file) notificaLatoCaricato(ospiteNum, latoEffettivo);
}

console.log('✅ Documento responsabile: fronte + retro obbligatori (solo fronte per il passaporto) - supporto fino a 9 ospiti');

// === GESTIONE FOTOCAMERA ===
let currentStream = null;
// Una sola fotocamera aperta per volta: se l'ospite passa dal fronte al retro
// senza chiudere la precedente, lo stream della prima va fermato (altrimenti
// resta la spia della camera accesa e su alcuni Android il secondo
// getUserMedia fallisce).
let cameraApertaKey = null;

function chiaveCamera(ospiteNum, lato) {
  return `${ospiteNum}-${lato}`;
}

window.openCamera = async function(ospiteNum, lato) {
  const latoEffettivo = lato || 'fronte';
  const chiave = chiaveCamera(ospiteNum, latoEffettivo);

  if (cameraApertaKey && cameraApertaKey !== chiave) {
    const [numPrecedente, latoPrecedente] = cameraApertaKey.split('-');
    closeCamera(numPrecedente, latoPrecedente);
  }

  const preview = document.getElementById(`camera-preview-${chiave}`);
  const video = document.getElementById(`camera-video-${chiave}`);
  if (!preview || !video) return;

  try {
    const constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    preview.style.display = 'block';
    cameraApertaKey = chiave;
    preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showNotification(t('notif.fotocameraAttivata'), 'info');
  } catch (err) {
    try {
      const fallbackConstraints = { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } };
      currentStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      video.srcObject = currentStream;
      preview.style.display = 'block';
      cameraApertaKey = chiave;
      showNotification(t('notif.fotocameraFrontale'), 'info');
    } catch (fallbackErr) {
      showNotification(t('notif.fotocameraErrore', { msg: fallbackErr.message }), 'error');
    }
  }
}

window.capturePhoto = function(ospiteNum, lato) {
  const latoEffettivo = lato || 'fronte';
  const chiave = chiaveCamera(ospiteNum, latoEffettivo);
  const video = document.getElementById(`camera-video-${chiave}`);
  const canvas = document.getElementById(`camera-canvas-${chiave}`);
  if (!video || !canvas) return;

  const ctx = canvas.getContext('2d');

  // ✅ RIDUZIONE RISOLUZIONE AUTOMATICA per rispettare limite 1 MB
  const maxWidth = 1280;
  const maxHeight = 720;

  let width = video.videoWidth;
  let height = video.videoHeight;

  if (width > maxWidth || height > maxHeight) {
    if (width > height) {
      height = (height / width) * maxWidth;
      width = maxWidth;
    } else {
      width = (width / height) * maxHeight;
      height = maxHeight;
    }
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);

  // ✅ COMPRESSIONE AGGRESSIVA: qualità 0.7
  canvas.toBlob((blob) => {
    if (!blob) {
      showNotification(t('notif.erroreCattura'), 'error');
      return;
    }

    if (blob.size > 1 * 1024 * 1024) {
      showNotification(t('notif.fotoTroppoPesante'), 'error');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    // Il lato NON va nel nome file qui: viene aggiunto come prefisso in fase
    // di raccolta dati (fronte_... / retro_...), così foto e file caricati
    // arrivano al proprietario con la stessa convenzione di nome.
    const fileName = `documento_ospite_${ospiteNum}_${timestamp}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    const fileInput = inputDocumento(ospiteNum, latoEffettivo);

    if (fileInput) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      aggiornaLabelUpload(ospiteNum, latoEffettivo);
      aggiornaStatoDocumenti(ospiteNum);
    }

    closeCamera(ospiteNum, latoEffettivo);
    notificaLatoCaricato(ospiteNum, latoEffettivo);

    // Se manca ancora un lato, si apre direttamente la fotocamera per
    // quello: l'ospite che sta fotografando deve fare due scatti.
    const mancanti = latiMancanti(ospiteNum);
    if (mancanti.length > 0) {
      setTimeout(() => openCamera(ospiteNum, mancanti[0]), 600);
    }
  }, 'image/jpeg', 0.7);
}

window.closeCamera = function(ospiteNum, lato) {
  const latoEffettivo = lato || 'fronte';
  const chiave = chiaveCamera(ospiteNum, latoEffettivo);
  const preview = document.getElementById(`camera-preview-${chiave}`);
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  if (preview) preview.style.display = 'none';
  if (cameraApertaKey === chiave) cameraApertaKey = null;
}

// === PAGAMENTO ===
window.procediAlPagamento = async function() {
  const privacyCheckbox = document.getElementById('privacy-consent');
  if (!privacyCheckbox?.checked) {
    showNotification(t('notif.privacyRichiesta'), 'error');
    privacyCheckbox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  
  if (!validaPrenotazioneCompleta()) return;
  
  const payButton = document.querySelector('.btn-payment');
  if (payButton) {
    payButton.disabled = true;
    payButton.innerHTML = t('payment.preparazioneDati');
  }
  
  try {
    showNotification(t('notif.raccoltaDocumenti'), 'info');
    
    // ✅ Raccogli dati completi
    const datiCompleti = await raccogliDatiPrenotazioneConCompressione();
    
    // ✅ CRITICAL: Genera tempSessionId PRIMA di salvare
    const tempSessionId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('🔑 CREATO temp_session_id:', tempSessionId);
    
    // ✅ Verifica dati prima del salvataggio
    console.log('📊 DATI DA SALVARE:', {
      ospiti: datiCompleti.ospiti?.length,
      documenti: datiCompleti.documenti?.length,
      appartamento: datiCompleti.appartamento,
      totale: datiCompleti.totale,
      dataCheckin: datiCompleti.dataCheckin
    });
    
    const payloadSize = JSON.stringify(datiCompleti).length;
    const payloadSizeMB = (payloadSize / 1024 / 1024).toFixed(2);
    
    console.log(`📦 Dimensione payload: ${payloadSizeMB} MB (${payloadSize} bytes)`);
    
    if (payloadSize > 4 * 1024 * 1024) {
      showNotification(t('notif.documentiGrandi'), 'info');
    }
    
    if (payButton) payButton.innerHTML = t('payment.salvataggioDati');
    
    // ✅ Salvataggio con timeout aumentato
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    
    try {
      const salvataggioResponse = await fetch(`${API_BASE_URL}/salva-dati-temporanei`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sessionId: tempSessionId,  // ✅ USA LO STESSO ID
          datiPrenotazione: datiCompleti
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!salvataggioResponse.ok) {
        const errorText = await salvataggioResponse.text();
        console.error('❌ Errore HTTP salvataggio:', salvataggioResponse.status, errorText);
        const errHttp = new Error('Salvataggio fallito (HTTP ' + salvataggioResponse.status + ')');
        errHttp.code = 'SALVATAGGIO_FALLITO';
        throw errHttp;
      }
      
      const result = await salvataggioResponse.json();
      console.log('💾 Risposta salvataggio:', result);
      
      if (!result.success) {
        const errSalv = new Error(result.error || 'Salvataggio fallito');
        errSalv.code = 'SALVATAGGIO_FALLITO';
        throw errSalv;
      }
      
      console.log('✅ Dati salvati su Redis con chiave:', tempSessionId);
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        const errTimeout = new Error('Timeout salvataggio dati (45s)');
        errTimeout.code = 'TIMEOUT_SALVATAGGIO';
        throw errTimeout;
      }
      throw fetchError;
    }
    
    if (payButton) payButton.innerHTML = t('payment.creazionePagamento');
    
    // ✅ Passa tempSessionId a Stripe
    await creaLinkPagamentoConSessionId(datiCompleti, tempSessionId);
    
  } catch (error) {
    console.error('💥 Errore nel processo di pagamento:', error);
    console.error('Stack:', error.stack);
    
    if (payButton) {
      payButton.disabled = false;
      payButton.innerHTML = t('payment.payButton', { amount: calcolaTotale().toFixed(2) });
    }
    
    let errorMessage;
    
    switch (error.code) {
      case 'TIMEOUT_SALVATAGGIO':
        errorMessage = t('payment.timeoutSalvataggio');
        break;
      case 'SALVATAGGIO_FALLITO':
        errorMessage = t('payment.salvataggioFallito');
        break;
      case 'DOCUMENTO_TROPPO_GRANDE': {
        const suggerimento = error.tipoSuggerimento === 'pdf'
          ? t('payment.suggerimentoPdf')
          : t('payment.suggerimentoFoto');
        // Con due file caricati serve dire all'ospite QUALE dei due rifare.
        errorMessage = error.lato
          ? t('payment.latoTroppoGrande', { lato: nomeLato(error.lato), size: error.sizeKB, suggerimento })
          : t('payment.documentoTroppoGrande', { size: error.sizeKB, suggerimento });
        break;
      }
      case 'IMPOSSIBILE_PROCESSARE':
        errorMessage = t('payment.impossibileProcessare');
        break;
      case 'PAYLOAD_TROPPO_GRANDE':
        errorMessage = t('payment.payloadTroppoGrande', { mb: error.payloadMB });
        break;
      default:
        errorMessage = t('payment.erroreGenerico');
    }
    
    showNotification(errorMessage, 'error');
  }
}

// ✅ NUOVA FUNZIONE: Compressione immagini
async function comprimiImmagineBase64(base64String, maxSizeKB = 150) { // ⬅️ RIDOTTO a 150KB
  return new Promise((resolve, reject) => {
    const matches = base64String.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      resolve(base64String);
      return;
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    
    if (!mimeType.startsWith('image/')) {
      resolve(base64String);
      return;
    }
    
    const currentSizeKB = (base64Data.length * 0.75) / 1024;
    
    if (currentSizeKB <= maxSizeKB) {
      console.log(`✅ Immagine già sotto ${maxSizeKB}KB (${currentSizeKB.toFixed(2)}KB)`);
      resolve(base64String);
      return;
    }
    
    console.log(`🔄 Compressione immagine: ${currentSizeKB.toFixed(2)}KB → target ${maxSizeKB}KB`);
    
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // ✅ RIDUZIONE MOLTO AGGRESSIVA
      let width = img.width;
      let height = img.height;
      const maxDimension = 1024; // ⬅️ Ridotto da 1280
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // ✅ COMPRESSIONE MOLTO AGGRESSIVA
      let quality = 0.6; // ⬅️ Inizia da 0.6 invece di 0.7
      let compressed = canvas.toDataURL('image/jpeg', quality);
      let compressedSizeKB = (compressed.split(',')[1].length * 0.75) / 1024;
      
      while (compressedSizeKB > maxSizeKB && quality > 0.1) {
        quality -= 0.05;
        compressed = canvas.toDataURL('image/jpeg', quality);
        compressedSizeKB = (compressed.split(',')[1].length * 0.75) / 1024;
      }
      
      console.log(`✅ Compresso: ${currentSizeKB.toFixed(2)}KB → ${compressedSizeKB.toFixed(2)}KB (qualità ${(quality * 100).toFixed(0)}%)`);
      resolve(compressed);
    };
    
    img.onerror = () => {
      console.warn('⚠️ Errore caricamento immagine, uso originale');
      resolve(base64String);
    };
    
    img.src = base64String;
  });
}

// ✅ NUOVA FUNZIONE: Raccogli dati con compressione
// ✅ COMPRESSIONE DOCUMENTI CON VALIDAZIONE E STATISTICHE
async function raccogliDatiPrenotazioneConCompressione() {
  const appartamenti = getAppartamentiSelezionati();
  const appartamentoValore = appartamenti.length === 1 
    ? appartamenti[0] 
    : appartamenti.join(' + ');

  console.log('🏠 APPARTAMENTO SELEZIONATO:', appartamentoValore);

  const datiPrenotazione = {
    dataCheckin: dataCheckin,
    appartamento: appartamentoValore, // ✅ CRITICAL
    numeroOspiti: numeroOspiti,
    numeroNotti: numeroNotti,
    tipoGruppo: document.getElementById('tipo-gruppo')?.value || null,
    totale: calcolaTotale(),
    lingua: getLingua(), // Lingua scelta dall'ospite: usata da crea-pagamento-stripe.js
                          // (locale pagina Stripe) e da invia-email-ospite.js (email finale).
                          // Google Sheets, il PDF al proprietario e la Questura ricevono
                          // sempre i dati in italiano, indipendentemente da questo campo.
    ospiti: [],
    documenti: [],
    timestamp: new Date().toISOString()
  };

  // Raccogli dati ospiti
  for (let i = 1; i <= numeroOspiti; i++) {
    const ospite = {
      numero: i,
      cognome: document.querySelector(`input[name="ospite${i}_cognome"]`)?.value?.trim(),
      nome: document.querySelector(`input[name="ospite${i}_nome"]`)?.value?.trim(),
      genere: document.querySelector(`select[name="ospite${i}_genere"]`)?.value,
      nascita: document.querySelector(`input[name="ospite${i}_nascita"]`)?.value,
      eta: 0,
      cittadinanza: document.querySelector(`select[name="ospite${i}_cittadinanza"]`)?.value,
      luogoNascita: document.querySelector(`select[name="ospite${i}_luogo_nascita"]`)?.value
    };
    
    if (ospite.nascita) ospite.eta = calcolaEta(ospite.nascita);
    
    if (ospite.luogoNascita === 'Italia') {
      ospite.comune = document.querySelector(`input[name="ospite${i}_comune"]`)?.value?.trim();
      ospite.provincia = document.querySelector(`select[name="ospite${i}_provincia"]`)?.value;
    }
    
    if (i === 1) {
      ospite.tipoDocumento = document.querySelector(`select[name="ospite1_tipo_documento"]`)?.value;
      ospite.numeroDocumento = document.querySelector(`input[name="ospite1_numero_documento"]`)?.value?.trim();
      ospite.luogoRilascio = document.querySelector(`select[name="ospite1_luogo_rilascio"]`)?.value;
      ospite.isResponsabile = true;
    }
    
    console.log(`✅ Ospite ${i}:`, ospite.cognome, ospite.nome);
    datiPrenotazione.ospiti.push(ospite);
  }
  
  // Raccogli documento responsabile: SEMPRE due file (fronte + retro).
  // L'array `documenti` conteneva un solo elemento; ora ne contiene due,
  // entrambi con ospiteNumero = 1 e un campo `lato` che il backend usa per
  // nominare gli allegati (genera-pdf-email.js).
  showNotification(t('notif.caricamentoDocResponsabile'), 'info');

  let documentiRaccolti = 0;

  for (const lato of LATI_DOCUMENTO) {
    const fileInput = inputDocumento(1, lato);
    const file = fileInput?.files?.[0];
    if (!file) continue;

    try {
      const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.log(`📸 Documento responsabile (${lato}): ${file.name} - ${originalSizeMB} MB (originale)`);

      const base64 = await fileToBase64(file);
      // Con due documenti invece di uno il target per lato scende da 700 a
      // 600 KB e il tetto da 1200 a 900 KB: anche nel caso peggiore (due file
      // al massimo consentito) il payload resta ben sotto il limite di ~4.5 MB
      // che Vercel impone sull'intera richiesta.
      const base64Finale = await comprimiImmagineBase64(base64, 600);
      const sizeKB = (base64Finale.split(',')[1].length * 0.75) / 1024;

      if (sizeKB > 900) {
        const errGrande = new Error(`Documento ${lato} troppo grande anche dopo compressione (${sizeKB.toFixed(0)} KB)`);
        errGrande.code = 'DOCUMENTO_TROPPO_GRANDE';
        errGrande.sizeKB = sizeKB.toFixed(0);
        errGrande.lato = lato;
        errGrande.tipoSuggerimento = file.type === 'application/pdf' ? 'pdf' : 'foto';
        throw errGrande;
      }

      console.log(`✅ Documento responsabile (${lato}) compresso: ${sizeKB.toFixed(2)} KB`);

      datiPrenotazione.documenti.push({
        ospiteNumero: 1,
        lato: lato,
        nomeFile: `${lato}_${file.name}`,
        tipo: file.type,
        dimensione: base64Finale.split(',')[1].length,
        base64: base64Finale
      });

      documentiRaccolti++;

    } catch (error) {
      console.error(`❌ Errore conversione documento (${lato}):`, error);
      if (error.code === 'DOCUMENTO_TROPPO_GRANDE') {
        throw error;
      }
      const errProc = new Error(`Impossibile processare il documento (${lato})`);
      errProc.code = 'IMPOSSIBILE_PROCESSARE';
      errProc.lato = lato;
      throw errProc;
    }
  }

  // Verifica finale
  const payloadSize = JSON.stringify(datiPrenotazione).length;
  const payloadSizeMB = (payloadSize / 1024 / 1024).toFixed(2);
  
  console.log(`📦 PAYLOAD FINALE:`, {
    size: `${payloadSizeMB} MB`,
    ospiti: datiPrenotazione.ospiti.length,
    documenti: datiPrenotazione.documenti.length,
    appartamento: datiPrenotazione.appartamento,
    totale: datiPrenotazione.totale
  });
  
  if (payloadSize > 4 * 1024 * 1024) {
    const errPayload = new Error(`Payload troppo grande (${payloadSizeMB} MB)`);
    errPayload.code = 'PAYLOAD_TROPPO_GRANDE';
    errPayload.payloadMB = payloadSizeMB;
    throw errPayload;
  }
  
  // Con il passaporto il retro non è richiesto: il confronto va fatto sui lati
  // effettivamente obbligatori, non sempre su due.
  if (documentiRaccolti >= latiRichiesti(1).length) {
    showNotification(t('notif.docResponsabileCaricato'), 'success');
  }
  
  return datiPrenotazione;
}


async function creaLinkPagamentoConSessionId(datiPrenotazione, tempSessionId) {
  console.log("💳 Creazione link pagamento Stripe");

  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    console.log("🧪 MODALITÀ TEST");
    await new Promise(resolve => setTimeout(resolve, 2000));
    const sessionId = 'test_session_' + Date.now();
    window.location.href = `successo-pagamento.html?session_id=${sessionId}&temp_session=${tempSessionId}&success=true&lang=${getLingua()}`;
    return;
  }

  try {
    const API_ENDPOINT = `${API_BASE_URL}/crea-pagamento-stripe`;
    console.log("🌐 Chiamata API ->", API_ENDPOINT);

    const datiConMetadata = {
      ...datiPrenotazione,
      tempSessionId: tempSessionId,
      successUrl: `https://spaceestate.github.io/Checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}&temp_session=${tempSessionId}&lang=${getLingua()}`,
      cancelUrl: `${window.location.href}?canceled=true`
    };
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(datiConMetadata)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Errore server (${response.status}):`, errorText);
      throw new Error('Non è stato possibile avviare il pagamento. Riprova tra qualche istante.');
    }

    const result = await response.json();
    if (!result.checkoutUrl) {
      throw new Error("URL di pagamento non ricevuto dal server");
    }

    console.log("🔄 Redirect a Stripe:", result.checkoutUrl);
    window.location.href = result.checkoutUrl;

  } catch (error) {
    console.error("💥 Errore creazione pagamento:", error);
    throw error;
  }
}

function gestisciRitornoStripe() {
  const urlParams = new URLSearchParams(window.location.search);
  const canceled = urlParams.get('canceled');
  
  if (canceled === 'true') {
    console.log("👈 Pagamento annullato");
    showNotification(t('notif.pagamentoAnnullato'), 'info');
    const url = new URL(window.location);
    url.searchParams.delete('canceled');
    window.history.replaceState({}, document.title, url.toString());
    const payButton = document.querySelector('.btn-payment');
    if (payButton) {
      payButton.disabled = false;
      payButton.innerHTML = t('payment.payButton', { amount: calcolaTotale().toFixed(2) });
    }
  }
}

// === OTTIMIZZAZIONI MOBILE ===
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);
const isOldAndroid = isAndroid && /Android [0-5]/.test(navigator.userAgent);

function supportaDateInput() {
  const input = document.createElement('input');
  input.type = 'date';
  input.value = '2024-01-01';
  return input.type === 'date' && input.value === '2024-01-01';
}

function miglioraDateInputNativo(input) {
  input.addEventListener('change', function() {
    if (this.value) {
      const date = new Date(this.value + 'T00:00:00');
      const formatted = date.toLocaleDateString(localeCorrente(), {
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      });
      this.setAttribute('data-selected', formatted);
    }
  });

  input.addEventListener('focus', function() {
    setTimeout(() => {
      this.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  });
}

function validaData(giorno, mese, anno) {
  const g = parseInt(giorno);
  const m = parseInt(mese);
  const a = parseInt(anno);

  if (g < 1 || g > 31 || m < 1 || m > 12 || a < 1900 || a > new Date().getFullYear()) {
    return false;
  }

  const date = new Date(a, m - 1, g);
  return date.getDate() === g && date.getMonth() === m - 1 && date.getFullYear() === a;
}

function creaCustomDateInput(originalInput) {
  if (originalInput.parentElement.classList.contains('date-input-wrapper')) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'date-input-wrapper mobile-date-input';
  originalInput.parentElement.insertBefore(wrapper, originalInput);

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.placeholder = 'GG/MM/AAAA';
  textInput.className = 'date-text-input form-input';
  textInput.maxLength = '10';
  textInput.pattern = '[0-9/]*';
  textInput.inputMode = 'numeric';

  // Il campo nativo resta type="date" (serve al bottone calendario per aprire
  // il picker del browser) ma è reso invisibile e non cliccabile. Copre SOLO
  // l'area del bottone calendario, non il campo di testo: se coprisse anche
  // quello, cliccandoci sopra per scrivere a mano il calendario nativo
  // rimarrebbe ancorato lì e non si chiuderebbe, bloccando la digitazione.
  originalInput.style.cssText = `
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 60px;
    opacity: 0;
    pointer-events: none;
    border: 0;
    margin: 0;
    padding: 0;
  `;

  textInput.addEventListener('input', function(e) {
    let value = this.value.replace(/\D/g, '');
    
    if (value.length > 0) {
      if (value.length <= 2) {
        this.value = value;
      } else if (value.length <= 4) {
        this.value = value.slice(0, 2) + '/' + value.slice(2);
      } else {
        this.value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4, 8);
      }
    }

    if (value.length === 8) {
      const giorno = value.slice(0, 2);
      const mese = value.slice(2, 4);
      const anno = value.slice(4, 8);
      
      if (validaData(giorno, mese, anno)) {
        originalInput.value = `${anno}-${mese}-${giorno}`;
        originalInput.dispatchEvent(new Event('change', { bubbles: true }));
        textInput.classList.remove('error');
      } else {
        textInput.classList.add('error');
      }
    }
  });

  textInput.addEventListener('paste', function(e) {
    e.preventDefault();
    let pasted = (e.clipboardData || window.clipboardData).getData('text');
    pasted = pasted.replace(/\D/g, '');
    
    if (pasted.length >= 8) {
      const anno = pasted.slice(-4);
      const mese = pasted.slice(-6, -4);
      const giorno = pasted.slice(-8, -6);
      
      if (validaData(giorno, mese, anno)) {
        this.value = giorno + '/' + mese + '/' + anno;
        originalInput.value = `${anno}-${mese}-${giorno}`;
        originalInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  const pickerBtn = document.createElement('button');
  pickerBtn.type = 'button';
  pickerBtn.innerHTML = '📅';
  pickerBtn.className = 'date-picker-btn';

  pickerBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    originalInput.focus();
    if (typeof originalInput.showPicker === 'function') {
      try {
        originalInput.showPicker();
        return;
      } catch (err) {
        // showPicker può non essere invocabile in certi contesti:
        // si prosegue con il fallback qui sotto.
      }
    }
    originalInput.click();
  });

  originalInput.addEventListener('change', function() {
    if (this.value) {
      const parts = this.value.split('-');
      const textValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
      textInput.value = textValue;
    }
  });

  wrapper.appendChild(textInput);
  wrapper.appendChild(pickerBtn);
  wrapper.appendChild(originalInput);
}

function potenziaTuosDateInput() {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  
  dateInputs.forEach(input => {
    if (isMobile) {
      if (isOldAndroid || !supportaDateInput()) {
        creaCustomDateInput(input);
      } else {
        miglioraDateInputNativo(input);
      }
    } else {
      // Desktop: campo digitabile GG/MM/AAAA + bottone calendario,
      // invece del solo <input type="date"> nativo (scomodo da scrivere
      // e da navigare manualmente).
      creaCustomDateInput(input);
    }
  });
}

function ottimizzaSelectMobile() {
  const selects = document.querySelectorAll('.form-select');
  
  selects.forEach(select => {
    select.style.fontSize = '16px';
    
    const label = select.previousElementSibling;
    if (label && label.classList.contains('form-label')) {
      select.setAttribute('aria-labelledby', label.id || '');
    }
  });
}

function ottimizzaFormMobile() {
  if (!isMobile) return;

  const inputs = document.querySelectorAll('.form-input, .form-select');
  
  inputs.forEach(input => {
    if (!input.style.fontSize) {
      input.style.fontSize = '16px';
    }

    if (input.name && (input.name.includes('cognome') || input.name.includes('nome'))) {
      input.setAttribute('autocomplete', 'on');
      input.setAttribute('autocorrect', 'off');
    }

    if (input.name && input.name.includes('email')) {
      input.type = 'email';
      input.setAttribute('inputmode', 'email');
    }

    if (input.name && input.name.includes('numero') && input.type !== 'date' && input.name !== 'numero-prenotazione') {
      input.setAttribute('inputmode', 'numeric');
    }
  });

  // NOTA: qui prima veniva riscritto anche il tag <meta name="viewport">,
  // ma la stringa non includeva "viewport-fit=cover" e quindi disattivava
  // env(safe-area-inset-*) usato in checkin.css per il notch. Il viewport
  // è già impostato correttamente in index.html: non va toccato via JS.
}

function gestisciKeyboardVirtuale() {
  if (!isMobile) return;

  document.addEventListener('focusin', function(e) {
    if (e.target.classList.contains('form-input') || 
        e.target.classList.contains('form-select') ||
        e.target.classList.contains('date-text-input')) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  });

  let lastInnerHeight = window.innerHeight;
  window.addEventListener('resize', function() {
    const currentInnerHeight = window.innerHeight;
    
    if (currentInnerHeight < lastInnerHeight - 100) {
      document.body.style.paddingBottom = '10px';
    } else {
      document.body.style.paddingBottom = '0';
    }
    
    lastInnerHeight = currentInnerHeight;
  });
}

// === INIZIALIZZAZIONE ===
// ✅ VERSIONE CORRETTA - Tutto il codice è DENTRO l'event listener
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Check-in form inizializzato');
  console.log(`📱 Dispositivo: ${isMobile ? 'Mobile' : 'Desktop'}, Android: ${isAndroid}, Vecchio Android: ${isOldAndroid}`);

  // Se l'ospite cambia lingua mentre è già avanti nel check-in, la maggior
  // parte del testo si aggiorna da sola tramite applicaTraduzioni() (vedi
  // i18n.js), perché sia il markup statico che quello generato dinamicamente
  // usano gli stessi attributi data-i18n*. Le uniche eccezioni sono la label
  // della progress bar (sempre aggiornata) e — solo se il riepilogo finale è
  // già a schermo — il riepilogo stesso, che viene ricostruito da zero per
  // tradurre correttamente il nome degli appartamenti e le note sull'età,
  // che non sono semplici sostituzioni di placeholder.
  onCambioLingua(() => {
    aggiornaProgressBar();
    if (currentStep === 99) {
      preparaRiepilogo(true); // true = non fare lo scroll automatico
    }
  });
  
  // Imposta data minima per check-in
  const dataCheckinInput = document.getElementById('data-checkin');
  if (dataCheckinInput) {
    const oggi = new Date().toISOString().split('T')[0];
    dataCheckinInput.min = oggi;
  }
  
  // Inizializza mostrando lo step 0 (verifica prenotazione)
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
  const firstStep = document.getElementById('step-0');
  if (firstStep) firstStep.classList.add('active');
  
  // Event listener per Enter sulla prenotazione
  const numeroPrenotazioneInput = document.getElementById('numero-prenotazione');
  if (numeroPrenotazioneInput) {
    numeroPrenotazioneInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        verificaPrenotazione();
      }
    });
  }
  
  // Gestisci ritorno da Stripe
  gestisciRitornoStripe();
  
  // Limite ospiti in base all'appartamento/i selezionato/i (Torre 5 · Corte 4 · entrambi 9)
  document.querySelectorAll('.apartment-checkbox').forEach(cb => {
    cb.addEventListener('change', aggiornaMaxOspiti);
  });
  aggiornaMaxOspiti();

  // Event listener per numero ospiti
  const numeroOspitiSelect = document.getElementById('numero-ospiti');
  if (numeroOspitiSelect) {
    numeroOspitiSelect.addEventListener('change', function() {
      const gruppoWrapper = document.getElementById("gruppo-wrapper");
      if (!gruppoWrapper) return;
      
      const numOspiti = parseInt(this.value) || 0;
      
      if (numOspiti > 1) {
        gruppoWrapper.classList.add("show");
        const tipoGruppoSelect = document.getElementById("tipo-gruppo");
        if (tipoGruppoSelect) tipoGruppoSelect.required = true;
      } else {
        gruppoWrapper.classList.remove("show");
        const tipoGruppoSelect = document.getElementById("tipo-gruppo");
        if (tipoGruppoSelect) {
          tipoGruppoSelect.required = false;
          tipoGruppoSelect.value = "";
        }
      }
    });
  }
  
  // Campo data digitabile (GG/MM/AAAA + bottone calendario): su tutti i dispositivi
  potenziaTuosDateInput();
  
  setTimeout(() => {
    const originalForm = document.getElementById('checkin-form');
    if (originalForm) {
      const observer = new MutationObserver(() => {
        potenziaTuosDateInput();
      });
      observer.observe(originalForm, { childList: true, subtree: true });
    }
  }, 100);
  
  // Altre ottimizzazioni specifiche mobile
  if (isMobile) {
    ottimizzaSelectMobile();
    ottimizzaFormMobile();
    gestisciKeyboardVirtuale();
  }
  
  // Cleanup fotocamera prima di chiudere
  window.addEventListener('beforeunload', function() {
    if (currentStream) currentStream.getTracks().forEach(track => track.stop());
  });

  // Verifica che summary-content esista
  setTimeout(() => {
    const summaryContent = document.getElementById('summary-content');
    if (!summaryContent) {
      console.error('⚠️ ATTENZIONE: #summary-content non trovato nel DOM al caricamento!');
      console.log('Verifica che index.html contenga <div id="summary-content"></div> dentro #step-final');
    } else {
      console.log('✅ #summary-content presente nel DOM');
    }
  }, 500);
  
}); // ⬅️ FINE DOMContentLoaded - CHIUSURA CORRETTA

// Nota: gli stili per .date-text-input.error e .date-picker-btn erano prima
// iniettati qui a runtime, duplicando (con un valore diverso per lo scale
// dello stato :active, 0.95 invece di 0.98) regole già presenti in
// checkin.css. Rimossi da qui; checkin.css è ora l'unica fonte per questi
// stili, con 0.95 come valore corretto.
