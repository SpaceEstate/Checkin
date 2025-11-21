// Sostituisci questa parte nel tuo codice (nella funzione generaHTMLRiepilogo)

const ospitiHTML = (dati.ospiti || []).map((ospite, index) => {
  const documento = documentiValidi.find(d => 
    d && d.ospiteNumero && d.ospiteNumero === ospite.numero
  );
  
  // ✅ NUOVA LOGICA CORRETTA:
  // Pag 1: Dettagli + Ospite 1 (index 0)
  // Pag 2: Ospite 2, 3, 4 (index 1, 2, 3) - break prima dell'ospite 2
  // Pag 3: Ospite 5, 6, 7 (index 4, 5, 6) - break prima dell'ospite 5
  // Pag 4: Ospite 8, 9, 10 (index 7, 8, 9) - break prima dell'ospite 8
  
  // Break se: index è 1 (secondo ospite) OPPURE ogni 3 ospiti dopo il primo
  // Formula: break quando (index - 1) è multiplo di 3
  const needsPageBreak = index === 1 || (index > 1 && (index - 1) % 3 === 0);
  
  return `
    <div class="ospite ${ospite.isResponsabile ? 'responsabile' : ''}" ${needsPageBreak ? 'style="page-break-before: always;"' : ''}>
      <div class="ospite-header">
        <div class="ospite-nome">
          ${ospite.cognome || 'N/A'} ${ospite.nome || 'N/A'}
        </div>
        ${ospite.isResponsabile ? '<div class="ospite-badge">RESPONSABILE</div>' : `<div class="ospite-number">Ospite ${ospite.numero}</div>`}
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Genere</div>
          <div class="info-value">${ospite.genere === 'M' ? 'Maschio' : ospite.genere === 'F' ? 'Femmina' : 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Data Nascita</div>
          <div class="info-value">${ospite.nascita ? new Date(ospite.nascita).toLocaleDateString('it-IT') : 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Età</div>
          <div class="info-value">${ospite.eta || 0} anni ${(ospite.eta || 0) >= 4 ? '(tassabile)' : '(esente)'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Cittadinanza</div>
          <div class="info-value">${ospite.cittadinanza || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Luogo Nascita</div>
          <div class="info-value">${ospite.luogoNascita || 'N/A'}</div>
        </div>
        ${ospite.comune && ospite.provincia ? `
        <div class="info-item">
          <div class="info-label">Comune/Provincia</div>
          <div class="info-value">${ospite.comune} (${ospite.provincia})</div>
        </div>
        ` : ''}
      </div>
      
      ${ospite.isResponsabile && ospite.tipoDocumento ? `
      <div class="info-grid" style="margin-top: 10px;">
        <div class="info-item">
          <div class="info-label">Tipo Documento</div>
          <div class="info-value">${ospite.tipoDocumento}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Numero Documento</div>
          <div class="info-value">${ospite.numeroDocumento || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Luogo Rilascio</div>
          <div class="info-value">${ospite.luogoRilascio || 'N/A'}</div>
        </div>
      </div>
      ` : ''}
      
      ${documento ? `
      <div class="documento-note">
        <strong>📎 Documento allegato:</strong> ${documento.nomeFile || 'Documento'} 
        (${Math.round(documento.dimensione / 1024)} KB) - 
        <em>Vedi allegati email separati</em>
      </div>
      ` : ''}
    </div>
  `;
}).join('');
