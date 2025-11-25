// === CONFIGURAZIONE GLOBALE ===
let currentStep = 0; // Inizia da 0 (verifica prenotazione)
let numeroOspiti = 0;
let numeroNotti = 0;
let dataCheckin = '';
let stepGenerated = false;
window.datiPrecompilati = false; // Flag globale per dati pre-compilati
 
const API_BASE_URL = 'https://checkin-six-coral.vercel.app/api';

// === ARRAY DATI ===
const stati = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua e Barbuda", "Arabia Saudita", "Argentina", "Armenia", "Australia", "Austria", "Azerbaigian", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belgio", "Belize", "Benin", "Bhutan", "Bielorussia", "Birmania", "Bolivia", "Bosnia ed Erzegovina", "Botswana", "Brasile", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambogia", "Camerun", "Canada", "Capo Verde", "Ciad", "Cile", "Cina", "Cipro", "Comore", "Corea del Nord", "Corea del Sud", "Costa d'Avorio", "Costa Rica", "Croazia", "Cuba", "Danimarca", "Dominica", "Ecuador", "Egitto", "El Salvador", "Emirati Arabi Uniti", "Eritrea", "Estonia", "Etiopia", "Figi", "Filippine", "Finlandia", "Francia", "Gabon", "Gambia", "Georgia", "Germania", "Ghana", "Giamaica", "Giappone", "Gibuti", "Giordania", "Grecia", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guinea Equatoriale", "Guyana", "Haiti", "Honduras", "India", "Indonesia", "Iran", "Iraq", "Irlanda", "Islanda", "Israele", "Italia", "Kazakistan", "Kenya", "Kirghizistan", "Kiribati", "Kuwait", "Laos", "Lesotho", "Lettonia", "Libano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Lussemburgo", "Macedonia del Nord", "Madagascar", "Malawi", "Malaysia", "Maldive", "Mali", "Malta", "Marocco", "Isole Marshall", "Mauritania", "Mauritius", "Messico", "Micronesia", "Moldavia", "Monaco", "Mongolia", "Montenegro", "Mozambico", "Namibia", "Nauru", "Nepal", "Nicaragua", "Niger", "Nigeria", "Norvegia", "Nuova Zelanda", "Oman", "Paesi Bassi", "Pakistan", "Palau", "Panama", "Papua Nuova Guinea", "Paraguay", "Peru", "Polonia", "Portogallo", "Qatar", "Regno Unito", "Repubblica Ceca", "Repubblica Centrafricana", "Repubblica del Congo", "Repubblica Democratica del Congo", "Repubblica Dominicana", "Romania", "Ruanda", "Russia", "Saint Kitts e Nevis", "Saint Lucia", "Saint Vincent e Grenadine", "Samoa", "San Marino", "São Tomé e Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Siria", "Slovacchia", "Slovenia", "Somalia", "Spagna", "Sri Lanka", "Stati Uniti", "Sudafrica", "Sudan", "Sudan del Sud", "Suriname", "Svezia", "Svizzera", "Swaziland", "Tagikistan", "Tanzania", "Thailandia", "Timor Est", "Togo", "Tonga", "Trinidad e Tobago", "Tunisia", "Turchia", "Turkmenistan", "Tuvalu", "Ucraina", "Uganda", "Ungheria", "Uruguay", "Uzbekistan", "Vanuatu", "Vaticano", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];

const tipiDocumento = ["PASSAPORTO ORDINARIO", "CARTA DI IDENTITA'", "CARTA IDENTITA' ELETTRONICA", "PATENTE DI GUIDA", "PASSAPORTO DIPLOMATICO", "PASSAPORTO DI SERVIZIO"];

const province = ["AG", "AL", "AN", "AO", "AR", "AP", "AT", "AV", "BA", "BT", "BL", "BN", "BG", "BI", "BO", "BZ", "BS", "BR", "CA", "CL", "CB", "CI", "CE", "CT", "CZ", "CH", "CO", "CS", "CR", "KR", "CN", "EN", "FM", "FE", "FI", "FG", "FC", "FR", "GE", "GO", "GR", "IM", "IS", "SP", "AQ", "LT", "LE", "LC", "LI", "LO", "LU", "MC", "MN", "MS", "MT", "ME", "MI", "MO", "MB", "NA", "NO", "NU", "OT", "OR", "PD", "PA", "PR", "PV", "PG", "PU", "PE", "PC", "PI", "PT", "PN", "PZ", "PO", "RG", "RA", "RC", "RE", "RI", "RN", "RM", "RO", "SA", "VS", "SS", "SV", "SI", "SR", "SO", "TA", "TE", "TR", "TO", "OG", "TP", "TN", "TV", "TS", "UD", "VA", "VE", "VB", "VC", "VR", "VV", "VI", "VT"];

// === FUNZIONI UTILITÀ ===
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function raccogliDocumenti() {
  const documenti = [];
  
  for (let i = 1; i <= numeroOspiti; i++) {
    const fileInput = document.querySelector(`input[name="ospite${i}_documento_file"]`);
    if (fileInput?.files?.[0]) {
      try {
        const file = fileInput.files[0];
        const base64 = await fileToBase64(file);
        
        documenti.push({
          ospiteNumero: i,
          nomeFile: file.name,
          tipo: file.type,
          dimensione: file.size,
          base64: base64
        });
      } catch (error) {
        console.error(`Errore conversione documento ospite ${i}:`, error);
      }
    }
  }
  
  return documenti;
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
  if (!dataISO) return 'N/A';
  const data = new Date(dataISO);
  return data.toLocaleDateString('it-IT', {
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
    showNotification('Inserisci un numero di prenotazione', 'error');
    input?.focus();
    return;
  }
  
  const btn = document.querySelector('#step-0 .btn-primary');
  const originalText = btn?.innerHTML || 'Verifica e continua →';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Verifica in corso...';
  }
  
  try {
    showNotification('🔍 Ricerca prenotazione in corso...', 'info');
    
    const response = await fetch(`${API_BASE_URL}/verifica-prenotazione`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ numeroPrenotazione })
    });
    
    const result = await response.json();
    
    if (result.found && result.dati) {
      showNotification('✅ Prenotazione trovata!', 'success');
      precompilaDatiPrenotazione(result.dati);
      window.datiPrecompilati = true;
      currentStep = 1;
      mostraStepCorrente();
    } else {
      // RESTA SULLA SCHERMATA - NON VA AVANTI
      showNotification('❌ Numero di prenotazione non trovato. Verifica il codice o procedi con inserimento manuale.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
      input?.focus();
    }
  } catch (error) {
    console.error('Errore verifica prenotazione:', error);
    showNotification('Errore nella verifica. Riprova o procedi con inserimento manuale.', 'error');
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
  showNotification('Compila manualmente i dati della prenotazione', 'info');
}

// Funzione per tornare alla verifica
window.tornaAVerifica = function() {
  if (window.datiPrecompilati) {
    // Se i dati erano pre-compilati, chiedi conferma
    if (confirm('Vuoi tornare alla schermata di verifica? I dati precompilati rimarranno.')) {
      currentStep = 0;
      mostraStepCorrente();
    }
  } else {
    currentStep = 0;
    mostraStepCorrente();
  }
}

// Funzione per pre-compilare i dati
function precompilaDatiPrenotazione(dati) {
  console.log('📝 Pre-compilazione dati:', dati);
  
  // Data check-in
  const dataInput = document.getElementById('data-checkin');
  if (dataInput && dati.dataCheckin) {
    dataInput.value = dati.dataCheckin;
    dataInput.readOnly = true;
    dataInput.style.backgroundColor = '#f5f2e9';
    dataInput.style.cursor = 'not-allowed';
  }
  
  // Appartamento
  const appartamentoSelect = document.getElementById('appartamento');
  if (appartamentoSelect && dati.appartamento) {
    appartamentoSelect.value = dati.appartamento;
    appartamentoSelect.disabled = true;
    appartamentoSelect.style.backgroundColor = '#f5f2e9';
    appartamentoSelect.style.cursor = 'not-allowed';
  }
  
  // Numero ospiti
  const ospitiSelect = document.getElementById('numero-ospiti');
  if (ospitiSelect && dati.numeroOspiti) {
    ospitiSelect.value = dati.numeroOspiti.toString();
    ospitiSelect.disabled = true;
    ospitiSelect.style.backgroundColor = '#f5f2e9';
    ospitiSelect.style.cursor = 'not-allowed';
    
    // Trigger change per mostrare tipo gruppo se necessario
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
  
  // Tipo gruppo rimane VUOTO e modificabile
  const tipoGruppoSelect = document.getElementById('tipo-gruppo');
  if (tipoGruppoSelect) {
    tipoGruppoSelect.value = '';
    tipoGruppoSelect.disabled = false;
    tipoGruppoSelect.style.backgroundColor = 'white';
    tipoGruppoSelect.style.cursor = 'pointer';
  }
  
  // Aggiungi un badge per indicare dati pre-compilati
  const stepHeader = document.querySelector('#step-1 .step-subtitle');
  if (stepHeader) {
    stepHeader.innerHTML = `
      <span style="color: #27ae60; font-weight: 600;">✓ Dati prenotazione verificati</span><br>
      <span style="font-size: 0.9rem; color: #a0927f;">
        ${dati.numeroOspiti > 1 ? 'Seleziona il tipo di gruppo' : 'Verifica i dati e prosegui'}
      </span>
    `;
  }
  
  console.log('✅ Dati pre-compilati con successo');
}

// === NAVIGAZIONE STEP ===
window.prossimoStep = function() {
  if (currentStep === 1) {
    if (!validaStep1()) return;
    if (!stepGenerated) {
      generaStepOspiti();
      stepGenerated = true;
    }
    currentStep = 2;
  } else if (currentStep >= 2 && currentStep <= numeroOspiti + 1) {
    const ospiteCorrente = currentStep - 1;
    if (!validaStepOspite(ospiteCorrente)) return;
    if (currentStep === numeroOspiti + 1) {
      preparaRiepilogo();
      currentStep = 99;
    } else {
      currentStep++;
    }
  }
  mostraStepCorrente();
}

window.indietroStep = function() {
  if (currentStep === 99) {
    currentStep = numeroOspiti + 1;
  } else if (currentStep > 1) {
    currentStep--;
  }
  mostraStepCorrente();
}

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
    
    // ✅ Usa requestAnimationFrame per evitare forced reflow
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stepToShow.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
}

// === VALIDAZIONE ===
function validaStep1() {
  const dataCheckinInput = document.getElementById("data-checkin");
  const appartamentoSelect = document.getElementById("appartamento");
  const numOspitiSelect = document.getElementById("numero-ospiti");
  const numNottiInput = document.getElementById("numero-notti");
  
  if (!dataCheckinInput?.value) {
    showNotification("Seleziona la data di check-in", "error");
    dataCheckinInput?.focus();
    return false;
  }

  const dataScelta = new Date(dataCheckinInput.value);
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  
  // MODIFICATO: Non bloccare se i dati sono pre-compilati
  if (!window.datiPrecompilati && dataScelta < oggi) {
    showNotification("La data di check-in non può essere nel passato", "error");
    dataCheckinInput?.focus();
    return false;
  }

  if (!appartamentoSelect?.value) {
    showNotification("Seleziona un appartamento", "error");
    appartamentoSelect?.focus();
    return false;
  }

  if (!numOspitiSelect?.value) {
    showNotification("Seleziona il numero di ospiti", "error");
    numOspitiSelect?.focus();
    return false;
  }

  const notti = parseInt(numNottiInput?.value) || 0;
  if (notti < 1) {
    showNotification("Inserisci un numero di notti valido (minimo 1)", "error");
    numNottiInput?.focus();
    return false;
  }

  dataCheckin = dataCheckinInput.value;
  numeroOspiti = parseInt(numOspitiSelect.value);
  numeroNotti = notti;

  if (numeroOspiti > 1) {
    const tipoGruppoSelect = document.getElementById("tipo-gruppo");
    if (!tipoGruppoSelect?.value) {
      showNotification("Seleziona il tipo di gruppo", "error");
      tipoGruppoSelect?.focus();
      return false;
    }
  }

  return true;
}

function validaStepOspite(numOspite) {
  const requiredFields = [
    { name: `ospite${numOspite}_cognome`, label: "Cognome" },
    { name: `ospite${numOspite}_nome`, label: "Nome" },
    { name: `ospite${numOspite}_genere`, label: "Genere" },
    { name: `ospite${numOspite}_nascita`, label: "Data di nascita" },
    { name: `ospite${numOspite}_cittadinanza`, label: "Cittadinanza" },
    { name: `ospite${numOspite}_luogo_nascita`, label: "Luogo di nascita" }
  ];

  if (numOspite === 1) {
    requiredFields.push(
      { name: `ospite1_tipo_documento`, label: "Tipo documento" },
      { name: `ospite1_numero_documento`, label: "Numero documento" },
      { name: `ospite1_luogo_rilascio`, label: "Luogo rilascio documento" }
    );
  }

  for (const field of requiredFields) {
    const input = document.querySelector(`[name="${field.name}"]`);
    if (!input?.value?.trim()) {
      showNotification(`${field.label} è obbligatorio per l'ospite ${numOspite}`, 'error');
      input?.focus();
      return false;
    }
  }

  const luogoNascita = document.querySelector(`[name="ospite${numOspite}_luogo_nascita"]`)?.value;
  if (luogoNascita === "Italia") {
    const comune = document.querySelector(`input[name="ospite${numOspite}_comune"]`)?.value?.trim();
    const provincia = document.querySelector(`select[name="ospite${numOspite}_provincia"]`)?.value;
    if (!comune || !provincia) {
      showNotification(`Comune e provincia sono obbligatori per ospiti nati in Italia`, 'error');
      return false;
    }
  }

  if (numOspite === 1) {
    const nascita = document.querySelector(`input[name="ospite1_nascita"]`)?.value;
    if (nascita) {
      const eta = calcolaEta(nascita);
      if (eta < 18) {
        showNotification("Il responsabile deve essere maggiorenne (18+ anni)", "error");
        return false;
      }
    }
  }

  const fileInput = document.querySelector(`input[name="ospite${numOspite}_documento_file"]`);
  if (!fileInput?.files?.length) {
    showNotification(`È necessario caricare un documento per l'ospite ${numOspite}`, 'error');
    return false;
  }

  return true;
}

// === GENERAZIONE STEP OSPITI ===
function generaStepOspiti() {
  const form = document.getElementById('checkin-form');
  const stepFinal = document.getElementById('step-final');
  if (!form || !stepFinal) return;
  
  // ✅ Crea tutti gli step in un DocumentFragment
  const fragment = document.createDocumentFragment();
  
  for (let i = 1; i <= numeroOspiti; i++) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.id = `step-${i + 1}`;
    
    const campiDocumento = i === 1 ? `
      <div class="form-group">
        <label class="form-label" for="ospite1_tipo_documento">Tipo documento *</label>
        <select id="ospite1_tipo_documento" name="ospite1_tipo_documento" class="form-select" required>
          <option value="">Seleziona tipo documento</option>
          ${tipiDocumento.map(tipo => `<option value="${tipo}">${tipo}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ospite1_numero_documento">Numero documento *</label>
        <input type="text" id="ospite1_numero_documento" name="ospite1_numero_documento" 
               class="form-input" required placeholder="Es. AA1234567" maxlength="20" pattern="[A-Za-z0-9]+">
      </div>
      <div class="form-group">
        <label class="form-label" for="ospite1_luogo_rilascio">Luogo rilascio documento *</label>
        <select id="ospite1_luogo_rilascio" name="ospite1_luogo_rilascio" class="form-select" required>
          <option value="">Seleziona luogo rilascio</option>
          ${stati.map(stato => `<option value="${stato}">${stato}</option>`).join('')}
        </select>
      </div>
    ` : '';
    
    stepDiv.innerHTML = `
      <div class="step-header">
        <h2 class="step-title">Ospite ${i}${i === 1 ? ' (Responsabile)' : ''}</h2>
        <p class="step-subtitle">Inserisci i dati dell'ospite</p>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="ospite${i}_cognome">Cognome *</label>
          <input type="text" id="ospite${i}_cognome" name="ospite${i}_cognome" class="form-input" required maxlength="50">
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_nome">Nome *</label>
          <input type="text" id="ospite${i}_nome" name="ospite${i}_nome" class="form-input" required maxlength="50">
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_genere">Genere *</label>
          <select id="ospite${i}_genere" name="ospite${i}_genere" class="form-select" required>
            <option value="">Seleziona genere</option>
            <option value="M">Maschio</option>
            <option value="F">Femmina</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_nascita">Data di nascita *</label>
          <input type="date" id="ospite${i}_nascita" name="ospite${i}_nascita" 
                 class="form-input" required max="${new Date().toISOString().split('T')[0]}" min="1900-01-01">
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_cittadinanza">Cittadinanza *</label>
          <select id="ospite${i}_cittadinanza" name="ospite${i}_cittadinanza" class="form-select" required>
            <option value="">Seleziona cittadinanza</option>
            ${stati.map(stato => `<option value="${stato}">${stato}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ospite${i}_luogo_nascita">Luogo di nascita *</label>
          <select id="ospite${i}_luogo_nascita" name="ospite${i}_luogo_nascita" 
                  class="form-select" required onchange="toggleComuneProvincia(${i})">
            <option value="">Seleziona luogo nascita</option>
            ${stati.map(stato => `<option value="${stato}">${stato}</option>`).join('')}
          </select>
        </div>
        <div id="comune-provincia-wrapper-${i}" style="display: none;" class="form-group full-width">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ospite${i}_comune">Comune *</label>
              <input type="text" id="ospite${i}_comune" name="ospite${i}_comune" 
                     class="form-input" placeholder="Es. Napoli" maxlength="50">
            </div>
            <div class="form-group">
              <label class="form-label" for="ospite${i}_provincia">Provincia *</label>
              <select id="ospite${i}_provincia" name="ospite${i}_provincia" class="form-select">
                <option value="">Seleziona provincia</option>
                ${province.map(prov => `<option value="${prov}">${prov}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        ${campiDocumento}
      </div>
      <div class="document-section">
        <h3 class="document-title">📄 Documento di identità</h3>
        <p class="document-subtitle">Carica una foto o scansione del documento</p>
        <div class="document-upload">
          <div class="upload-group">
            <label for="ospite${i}_documento_file" class="upload-label">📎 Scegli file</label>
            <input type="file" id="ospite${i}_documento_file" name="ospite${i}_documento_file" 
                   class="upload-input" accept="image/*,.pdf" onchange="handleFileUpload(this, ${i})">
          </div>
          <div class="camera-group">
            <button type="button" class="camera-btn" onclick="openCamera(${i})">📷 Fotografa documento</button>
          </div>
        </div>
        <div id="camera-preview-${i}" class="camera-preview" style="display: none;">
          <video id="camera-video-${i}" autoplay playsinline></video>
          <canvas id="camera-canvas-${i}" style="display: none;"></canvas>
          <div class="camera-controls">
            <button type="button" class="capture-btn" onclick="capturePhoto(${i})">📸 Scatta</button>
            <button type="button" class="close-camera-btn" onclick="closeCamera(${i})">✕ Chiudi</button>
          </div>
        </div>
      </div>
      <div class="button-group">
        <button type="button" class="btn btn-secondary" onclick="indietroStep()">← Indietro</button>
        <button type="button" class="btn btn-primary" onclick="prossimoStep()">
          ${i === numeroOspiti ? 'Vai al riepilogo →' : 'Prossimo ospite →'}
        </button>
      </div>
    `;
    
    fragment.appendChild(stepDiv);
  }
  
  // ✅ Un solo inserimento nel DOM
  form.insertBefore(fragment, stepFinal);
}

// === RIEPILOGO ===
function preparaRiepilogo() {
  const totale = calcolaTotale();
  const summaryContent = document.getElementById('summary-content');
  if (!summaryContent) return;
  
  // ✅ Crea tutto in memoria prima di inserire nel DOM
  const fragment = document.createDocumentFragment();
  
  // Sezione dettagli soggiorno
  const dettagliSection = document.createElement('div');
  dettagliSection.className = 'summary-section';
  dettagliSection.innerHTML = `
    <h3>📍 Dettagli soggiorno</h3>
    <div class="summary-item"><span>Data Check-in:</span><span><strong>${formatDataItaliana(dataCheckin)}</strong></span></div>
    <div class="summary-item"><span>Appartamento:</span><span><strong>${document.getElementById('appartamento')?.value || 'N/A'}</strong></span></div>
    <div class="summary-item"><span>Numero ospiti:</span><span><strong>${numeroOspiti}</strong></span></div>
    <div class="summary-item"><span>Numero notti:</span><span><strong>${numeroNotti}</strong></span></div>
  `;
  fragment.appendChild(dettagliSection);
  
  // Sezione ospiti
  const ospitiSection = document.createElement('div');
  ospitiSection.className = 'summary-section';
  ospitiSection.innerHTML = '<h3>👥 Ospiti</h3>';
  
  for (let i = 1; i <= numeroOspiti; i++) {
    const cognome = document.querySelector(`input[name="ospite${i}_cognome"]`)?.value || '';
    const nome = document.querySelector(`input[name="ospite${i}_nome"]`)?.value || '';
    const nascita = document.querySelector(`input[name="ospite${i}_nascita"]`)?.value || '';
    const eta = nascita ? calcolaEta(nascita) : 0;
    
    const guestDiv = document.createElement('div');
    guestDiv.className = 'guest-summary';
    guestDiv.innerHTML = `
      <strong>${cognome} ${nome}</strong> ${i === 1 ? '(Responsabile)' : ''}
      <span class="age">Età: ${eta} anni ${eta >= 4 ? '(soggetto a tassa)' : '(esente)'}</span>
    `;
    ospitiSection.appendChild(guestDiv);
  }
  fragment.appendChild(ospitiSection);
  
  // Sezione totale
  const totaleSection = document.createElement('div');
  totaleSection.className = 'summary-section';
  totaleSection.innerHTML = `
    <h3>💰 Totale tassa di soggiorno</h3>
    <div class="total-amount">€${totale.toFixed(2)}</div>
    <small class="tax-note">Tassa di €1,50 per notte per ospiti dai 4 anni in su</small>
  `;
  fragment.appendChild(totaleSection);
  
  // ✅ Un solo inserimento nel DOM
  summaryContent.innerHTML = '';
  summaryContent.appendChild(fragment);
  
  aggiornaBottonePagamento(totale);
}
/**
 * Precarica risorse Stripe quando l'utente arriva al riepilogo
 * Riduce il tempo di attesa al click su "Paga"
 */
function precaricaStripe() {
  console.log('🚀 Precaricamento risorse Stripe...');
  
  // Precarica script Stripe
  const stripeSupportScript = document.createElement('link');
  stripeSupportScript.rel = 'preload';
  stripeSupportScript.as = 'script';
  stripeSupportScript.href = 'https://js.stripe.com/v3/';
  document.head.appendChild(stripeSupportScript);
  
  // Prefetch pagina checkout (warm up DNS)
  const stripePrefetch = document.createElement('link');
  stripePrefetch.rel = 'prefetch';
  stripePrefetch.href = 'https://checkout.stripe.com';
  document.head.appendChild(stripePrefetch);
  
  // Warm up API backend
  const apiPrefetch = document.createElement('link');
  apiPrefetch.rel = 'prefetch';
  apiPrefetch.href = `${API_BASE_URL}/crea-pagamento-stripe`;
  document.head.appendChild(apiPrefetch);
}

// ✅ MODIFICA preparaRiepilogo() - AGGIUNGI questa chiamata alla fine:
function preparaRiepilogo() {
  const totale = calcolaTotale();
  const summaryContent = document.getElementById('summary-content');
  if (!summaryContent) return;
  
  // ... tutto il codice esistente ...
  
  aggiornaBottonePagamento(totale);
  
  // ✅ NUOVO: Precarica Stripe quando l'utente arriva qui
  precaricaStripe();
}

// SOSTITUISCI TUTTA LA FUNZIONE con questa:
function aggiornaBottonePagamento(totale) {
  const finalStep = document.getElementById('step-final');
  const buttonGroup = finalStep?.querySelector('.button-group');
  if (!buttonGroup) return;
  buttonGroup.innerHTML = `
    <button type="button" class="btn btn-secondary" onclick="indietroStep()">← Indietro</button>
    <button type="button" class="btn btn-primary btn-payment" id="btn-procedi-pagamento" disabled onclick="procediAlPagamento()">
      💳 Paga €${totale.toFixed(2)} con Stripe
    </button>
  `;
  
  // Gestione checkbox privacy
  setTimeout(() => {
    const privacyCheckbox = document.getElementById('privacy-consent');
    const paymentBtn = document.getElementById('btn-procedi-pagamento');
    
    if (privacyCheckbox && paymentBtn) {
      paymentBtn.disabled = !privacyCheckbox.checked;
      
      privacyCheckbox.addEventListener('change', function() {
        paymentBtn.disabled = !this.checked;
        if (this.checked) {
          showNotification('✅ Privacy accettata', 'success');
        }
      });
    }
  }, 100);
}

// === GESTIONE FOTOCAMERA ===
let currentStream = null;

window.handleFileUpload = function(input, ospiteNum) {
  const file = input.files?.[0];
  const label = input.previousElementSibling;
  if (!label) return;
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      showNotification('Il file è troppo grande. Dimensione massima: 5MB', 'error');
      input.value = '';
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showNotification('Formato file non supportato. Usa: JPG, PNG, WebP o PDF', 'error');
      input.value = '';
      return;
    }
    label.textContent = `✅ ${file.name}`;
    label.classList.add('has-file');
    showNotification('Documento caricato con successo', 'success');
  } else {
    label.textContent = '📎 Scegli file';
    label.classList.remove('has-file');
  }
}

window.openCamera = async function(ospiteNum) {
  const preview = document.getElementById(`camera-preview-${ospiteNum}`);
  const video = document.getElementById(`camera-video-${ospiteNum}`);
  if (!preview || !video) return;
  try {
    const constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    preview.style.display = 'block';
    showNotification('Fotocamera attivata. Posiziona il documento nel riquadro', 'info');
  } catch (err) {
    try {
      const fallbackConstraints = { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } };
      currentStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      video.srcObject = currentStream;
      preview.style.display = 'block';
      showNotification('Fotocamera frontale attivata', 'info');
    } catch (fallbackErr) {
      showNotification('Impossibile accedere alla fotocamera: ' + fallbackErr.message, 'error');
    }
  }
}

window.capturePhoto = function(ospiteNum) {
  const video = document.getElementById(`camera-video-${ospiteNum}`);
  const canvas = document.getElementById(`camera-canvas-${ospiteNum}`);
  if (!video || !canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) {
      showNotification('Errore nella cattura della foto', 'error');
      return;
    }
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `documento_ospite_${ospiteNum}_${timestamp}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    const fileInput = document.getElementById(`ospite${ospiteNum}_documento_file`);
    if (fileInput) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      const label = fileInput.previousElementSibling;
      if (label) {
        label.textContent = `📷 ${fileName}`;
        label.classList.add('has-file');
      }
    }
    showNotification('Foto acquisita con successo!', 'success');
  }, 'image/jpeg', 0.85);
  closeCamera(ospiteNum);
}

window.closeCamera = function(ospiteNum) {
  const preview = document.getElementById(`camera-preview-${ospiteNum}`);
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  if (preview) preview.style.display = 'none';
}

// === PAGAMENTO ===
window.procediAlPagamento = async function() {
 const privacyCheckbox = document.getElementById('privacy-consent');
  if (!privacyCheckbox?.checked) {
    showNotification('⚠️ Devi accettare l\'informativa privacy per procedere', 'error');
    privacyCheckbox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!validaPrenotazioneCompleta()) return;
  
  const payButton = document.querySelector('.btn-payment');
  if (payButton) {
    payButton.disabled = true;
    payButton.innerHTML = '⏳ Preparazione dati...';
  }
  
  try {
    showNotification('📦 Raccolta documenti in corso...', 'info');
    const datiCompleti = await raccogliDatiPrenotazione();
    
    console.log(`✅ Dati raccolti: ${datiCompleti.ospiti.length} ospiti, ${datiCompleti.documenti.length} documenti`);
    
    const tempSessionId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('🔑 Session ID temporaneo:', tempSessionId);
    
    if (payButton) payButton.innerHTML = '⏳ Salvataggio dati...';
    
    const salvataggioResponse = await fetch(`${API_BASE_URL}/salva-dati-temporanei`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: tempSessionId,
        datiPrenotazione: datiCompleti
      })
    });
    
    if (!salvataggioResponse.ok) {
      throw new Error('Errore nel salvataggio dei dati');
    }
    
    console.log('💾 Dati salvati temporaneamente sul server');
    
    if (payButton) payButton.innerHTML = '⏳ Creazione pagamento...';
    
    await creaLinkPagamentoConSessionId(datiCompleti, tempSessionId);
    
  } catch (error) {
    console.error('💥 Errore nel processo di pagamento:', error);
    if (payButton) {
      payButton.disabled = false;
      payButton.innerHTML = `💳 Paga €${calcolaTotale().toFixed(2)} con Stripe`;
    }
    showNotification('Errore: ' + error.message, 'error');
  }
}

function validaPrenotazioneCompleta() {
  if (!validaStep1()) {
    showNotification('Errore nei dati generali della prenotazione', 'error');
    return false;
  }
  for (let i = 1; i <= numeroOspiti; i++) {
    if (!validaStepOspite(i)) {
      showNotification(`Errore nei dati dell'ospite ${i}`, 'error');
      return false;
    }
  }
  return true;
}

async function raccogliDatiPrenotazione() {
  const datiPrenotazione = {
    dataCheckin: dataCheckin,
    appartamento: document.getElementById('appartamento')?.value,
    numeroOspiti: numeroOspiti,
    numeroNotti: numeroNotti,
    tipoGruppo: document.getElementById('tipo-gruppo')?.value || null,
    totale: calcolaTotale(),
    ospiti: [],
    timestamp: new Date().toISOString()
  };

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
    
    datiPrenotazione.ospiti.push(ospite);
  }
  
  datiPrenotazione.documenti = await raccogliDocumenti();
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
    window.location.href = `successo-pagamento.html?session_id=${sessionId}&temp_session=${tempSessionId}&success=true`;
    return;
  }

  try {
    const API_ENDPOINT = `${API_BASE_URL}/crea-pagamento-stripe`;
    console.log("🌐 Chiamata API ->", API_ENDPOINT);

    const datiConMetadata = {
      ...datiPrenotazione,
      tempSessionId: tempSessionId,
      successUrl: `https://spaceestate.github.io/Checkin/successo-pagamento.html?session_id={CHECKOUT_SESSION_ID}&temp_session=${tempSessionId}`,
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
      throw new Error(`Errore server (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    if (!result.checkoutUrl) {
      throw new Error("URL di pagamento non ricevuto dal server");
    }

    console.log("🔄 Redirect a Stripe:", result.checkoutUrl);
    window.location.href = result.checkoutUrl;

  } catch (error) {
    console.error("💥 Errore creazione pagamento:", error);
    showNotification("Errore: " + error.message, "error");
    throw error;
  }
}

function gestisciRitornoStripe() {
  const urlParams = new URLSearchParams(window.location.search);
  const canceled = urlParams.get('canceled');
  
  if (canceled === 'true') {
    console.log("👈 Pagamento annullato");
    showNotification('Pagamento annullato. Puoi riprovare quando vuoi.', 'info');
    const url = new URL(window.location);
    url.searchParams.delete('canceled');
    window.history.replaceState({}, document.title, url.toString());
    const payButton = document.querySelector('.btn-payment');
    if (payButton) {
      payButton.disabled = false;
      payButton.innerHTML = `💳 Paga €${calcolaTotale().toFixed(2)} con Stripe`;
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
      const formatted = date.toLocaleDateString('it-IT', {
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

  originalInput.style.display = 'none';
  originalInput.type = 'hidden';

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
    
    originalInput.type = 'date';
    originalInput.style.cssText = `
      position: absolute;
      left: -9999px;
      width: 1px;
      height: 1px;
      opacity: 0.01;
      pointer-events: auto;
    `;
    
    setTimeout(() => {
      originalInput.focus();
      originalInput.click();
      
      setTimeout(() => {
        originalInput.style.cssText = '';
        originalInput.type = 'hidden';
      }, 500);
    }, 50);
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
  if (!isMobile) return;
  
  const dateInputs = document.querySelectorAll('input[type="date"]');
  
  dateInputs.forEach(input => {
    if (isOldAndroid || !supportaDateInput()) {
      creaCustomDateInput(input);
    } else {
      miglioraDateInputNativo(input);
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

  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport) {
    metaViewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5');
  }
}

let scrollTimeout;
function gestisciKeyboardVirtuale() {
  if (!isMobile) return;

  document.addEventListener('focusin', function(e) {
    if (e.target.classList.contains('form-input') || 
        e.target.classList.contains('form-select') ||
        e.target.classList.contains('date-text-input')) {
      
      // ✅ Debounce per evitare troppi scroll
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }, 300);
    }
  });

  let lastInnerHeight = window.innerHeight;
  
  // ✅ Throttle resize events
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const currentInnerHeight = window.innerHeight;
      
      if (currentInnerHeight < lastInnerHeight - 100) {
        document.body.style.paddingBottom = '10px';
      } else {
        document.body.style.paddingBottom = '0';
      }
      
      lastInnerHeight = currentInnerHeight;
    }, 150);
  });
}

// === INIZIALIZZAZIONE ===
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Check-in form inizializzato');
  console.log(`📱 Dispositivo: ${isMobile ? 'Mobile' : 'Desktop'}, Android: ${isAndroid}, Vecchio Android: ${isOldAndroid}`);
  
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
  
  gestisciRitornoStripe();
  
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
  
  // Ottimizzazioni mobile
  if (isMobile) {
    potenziaTuosDateInput();
    ottimizzaSelectMobile();
    ottimizzaFormMobile();
    gestisciKeyboardVirtuale();
    
    setTimeout(() => {
      const originalForm = document.getElementById('checkin-form');
      if (originalForm) {
        const observer = new MutationObserver(() => {
          potenziaTuosDateInput();
        });
        observer.observe(originalForm, { childList: true, subtree: true });
      }
    }, 100);
  }
  
  window.addEventListener('beforeunload', function() {
    if (currentStream) currentStream.getTracks().forEach(track => track.stop());
  });
});

// Stili aggiuntivi per input errore
const dateErrorStyle = document.createElement('style');
dateErrorStyle.textContent = `
  .date-text-input.error {
    border-color: #e74c3c !important;
    background-color: #fadbd8 !important;
    color: #c0392b;
  }

  .date-picker-btn {
    box-shadow: 0 2px 8px rgba(184, 153, 104, 0.3) !important;
  }

  .date-picker-btn:active {
    transform: scale(0.95) !important;
  }

  @media (hover: none) and (pointer: coarse) {
    .date-picker-btn:hover {
      transform: none !important;
    }

    .date-picker-btn:active {
      transform: scale(0.95) !important;
    }
  }
`;
document.head.appendChild(dateErrorStyle);
