// SOSTITUISCI la sezione checkout.session.completed con questa:

if (event.type === 'checkout.session.completed') {
  try {
    const session = event.data.object;
    console.log('💰 Pagamento completato per sessione:', session.id);
    
    // Estrai email cliente da Stripe
    const emailCliente = session.customer_details?.email || null;
    console.log('📧 Email cliente da Stripe:', emailCliente || 'NESSUNA');
    
    // 1. Scrivi dati su Google Sheets (priorità)
    await scriviDatiSuGoogleSheets(session);
    console.log('✅ Dati scritti su Google Sheets');
    
    // 2. Genera PDF e invia email al proprietario
    try {
      await generaPDFEInviaEmailConDebug(session);
      console.log('✅ PDF e email proprietario processati');
    } catch (pdfError) {
      console.error('⚠️ Errore PDF/Email proprietario:', pdfError.message);
      
      // FALLBACK: Invia email semplice senza PDF
      try {
        await inviaEmailSemplice(session);
        console.log('✅ Email semplice proprietario inviata come fallback');
      } catch (fallbackError) {
        console.error('❌ Anche fallback email proprietario fallito:', fallbackError.message);
      }
    }
    
    // 3. NUOVO: Invia email ospite con codice accesso
    if (emailCliente) {
      try {
        await inviaEmailOspite(session, emailCliente);
        console.log('✅ Email ospite inviata con successo');
      } catch (emailError) {
        console.error('⚠️ Errore invio email ospite:', emailError.message);
        // Non bloccare il flusso se l'email ospite fallisce
      }
    } else {
      console.warn('⚠️ Email cliente non disponibile, email ospite non inviata');
    }
    
  } catch (error) {
    console.error('❌ Errore elaborazione webhook:', error);
    return res.status(500).json({ error: 'Errore interno: ' + error.message });
  }
}

// AGGIUNGI questa nuova funzione alla fine del file:

// FUNZIONE: Invia email all'ospite con codice accesso
async function inviaEmailOspite(session, emailCliente) {
  console.log('📧 === INIZIO INVIO EMAIL OSPITE (da webhook) ===');
  
  const metadata = session.metadata;
  const datiPrenotazione = ricostruisciDatiPrenotazione(metadata);
  
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://checkin-six-coral.vercel.app';
  
  const apiUrl = `${baseUrl}/api/invia-email-ospite`;
  console.log('🌐 Chiamata API email ospite:', apiUrl);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CheckinWebhook/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        emailOspite: emailCliente,
        datiPrenotazione: datiPrenotazione
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('📡 Status risposta API email ospite:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore API email ospite:', errorText);
      throw new Error(`Errore API (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Risposta API email ospite:', result);
    console.log('📧 === FINE INVIO EMAIL OSPITE (SUCCESSO) ===');
    
  } catch (error) {
    console.error('❌ Errore invio email ospite:', error.message);
    console.log('📧 === FINE INVIO EMAIL OSPITE (ERRORE) ===');
    throw error;
  }
}
