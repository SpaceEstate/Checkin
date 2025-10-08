// === CONFIGURAZIONE GLOBALE ===
let currentStep = 1;
let numeroOspiti = 0;
let numeroNotti = 0;
let dataCheckin = '';
let stepGenerated = false;

const API_BASE_URL = 'https://checkin-six-coral.vercel.app/api';

// Stati, documenti, province (come prima - omessi per brevità)
const stati = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua e Barbuda", "Arabia Saudita", "Argentina", "Armenia", "Australia", "Austria", "Azerbaigian", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belgio", "Belize", "Benin", "Bhutan", "Bielorussia", "Birmania", "Bolivia", "Bosnia ed Erzegovina", "Botswana", "Brasile", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambogia", "Camerun", "Canada", "Capo Verde", "Ciad", "Cile", "Cina", "Cipro", "Comore", "Corea del Nord", "Corea del Sud", "Costa d'Avorio", "Costa Rica", "Croazia", "Cuba", "Danimarca", "Dominica", "Ecuador", "Egitto", "El Salvador", "Emirati Arabi Uniti", "Eritrea", "Estonia", "Etiopia", "Figi", "Filippine", "Finlandia", "Francia", "Gabon", "Gambia", "Georgia", "Germania", "Ghana", "Giamaica", "Giappone", "Gibuti", "Giordania", "Grecia", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guinea Equatoriale", "Guyana", "Haiti", "Honduras", "India", "Indonesia", "Iran", "Iraq", "Irlanda", "Islanda", "Israele", "Italia", "Kazakistan", "Kenya", "Kirghizistan", "Kiribati", "Kuwait", "Laos", "Lesotho", "Lettonia", "Libano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Lussemburgo", "Macedonia del Nord", "Madagascar", "Malawi", "Malaysia", "Maldive", "Mali", "Malta", "Marocco", "Isole Marshall", "Mauritania", "Mauritius", "Messico", "Micronesia", "Moldavia", "Monaco", "Mongolia", "Montenegro", "Mozambico", "Namibia", "Nauru", "Nepal", "Nicaragua", "Niger", "Nigeria", "Norvegia", "Nuova Zelanda", "Oman", "Paesi Bassi", "Pakistan", "Palau", "Panama", "Papua Nuova Guinea", "Paraguay", "Peru", "Polonia", "Portogallo", "Qatar", "Regno Unito", "Repubblica Ceca", "Repubblica Centrafricana", "Repubblica del Congo", "Repubblica Democratica del Congo", "Repubblica Dominicana", "Romania", "Ruanda", "Russia", "Saint Kitts e Nevis", "Saint Lucia", "Saint Vincent e Grenadine", "Samoa", "San Marino", "São Tomé e Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Siria", "Slovacchia", "Slovenia", "Somalia", "Spagna", "Sri Lanka", "Stati Uniti", "Sudafrica", "Sudan", "Sudan del Sud", "Suriname", "Svezia", "Svizzera", "Swaziland", "Tagikistan", "Tanzania", "Thailandia", "Timor Est", "Togo", "Tonga", "Trinidad e Tobago", "Tunisia", "Turchia", "Turkmenistan", "Tuvalu", "Ucraina", "Uganda", "Ungheria", "Uruguay", "Uzbekistan", "Vanuatu", "Vaticano", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];

const tipiDocumento = ["PASSAPORTO ORDINARIO", "CARTA DI IDENTITA'", "CARTA IDENTITA' ELETTRONICA", "PATENTE DI GUIDA", "PASSAPORTO DIPLOMATICO", "PASSAPORTO DI SERVIZIO"];

const province = ["AG", "AL", "AN", "AO", "AR", "AP", "AT", "AV", "BA", "BT", "BL", "BN", "BG", "BI", "BO", "BZ", "BS", "BR", "CA", "CL", "CB", "CI", "CE", "CT", "CZ", "CH", "CO", "CS", "CR", "KR", "CN", "EN", "FM", "FE", "FI", "FG", "FC", "FR", "GE", "GO", "GR", "IM", "IS", "SP", "AQ", "LT", "LE", "LC", "LI", "LO", "LU", "MC", "MN", "MS", "MT", "ME", "MI", "MO", "MB", "NA", "NO", "NU", "OT", "OR", "PD", "PA", "PR", "PV", "PG", "PU", "PE", "PC", "PI", "PT", "PN", "PZ", "PO", "RG", "RA", "RC", "RE", "RI", "RN", "RM", "RO", "SA", "VS", "SS", "SV", "SI", "SR", "SO", "TA", "TE", "TR", "TO", "OG", "TP", "TN", "TV", "TS", "UD", "VA", "VE", "VB", "VC", "VR", "VV", "VI", "VT"];

// Funzioni di utilità (come prima)
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

// Funzioni di gestione step (come prima - omesse per brevità)
window.toggleTipoGruppo = function() {
  const numeroOspitiInput = document.getElementById("numero-ospiti");
  const gruppoWrapper = document.getElementById("gruppo-wrapper");
  if (!numeroOspitiInput || !gruppoWrapper) return;
  const numOspiti = parseInt(numeroOspitiInput.value) || 0;
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
}

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
    stepToShow.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

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
  
  if (dataScelta < oggi) {
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

function generaStepOspiti() {
  const form = document.getElementById('checkin-form');
  const stepFinal = document.getElementById('step-final');
  if (!form || !stepFinal) return;
  
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
