// api/test-email.js
// API per testare la configurazione email

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  console.log('🧪 === TEST EMAIL INIZIATO ===');
  console.log('Timestamp:', new Date().toISOString());
  
  // Step 1: Verifica variabili d'ambiente
  console.log('\n📋 Step 1: Verifica variabili d\'ambiente');
  const config = {
    EMAIL_USER: process.env.EMAIL_USER || 'MISSING',
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '✅ SET (hidden)' : '❌ MISSING',
    EMAIL_PROPRIETARIO: process.env.EMAIL_PROPRIETARIO || 'MISSING'
  };
  
  console.log('Config:', config);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || !process.env.EMAIL_PROPRIETARIO) {
    console.error('❌ Variabili d\'ambiente mancanti!');
    return res.status(500).json({
      success: false,
      error: 'Variabili d\'ambiente mancanti',
      config: config,
      help: 'Configura EMAIL_USER, EMAIL_PASSWORD e EMAIL_PROPRIETARIO su Vercel'
    });
  }
  
  console.log('✅ Variabili d\'ambiente presenti');
  
  try {
    // Step 2: Crea transporter
    console.log('\n🔧 Step 2: Creazione transporter Nodemailer');
    
    const transporter = nodemailer.createTransport({
      service: 'yahoo',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      debug: true, // Abilita debug
      logger: true // Abilita logging
    });
    
    console.log('✅ Transporter creato');
    
    // Step 3: Verifica connessione SMTP
    console.log('\n🔌 Step 3: Verifica connessione SMTP...');
    
    try {
      await transporter.verify();
      console.log('✅ Connessione SMTP verificata con successo!');
    } catch (verifyError) {
      console.error('❌ Errore verifica SMTP:', verifyError.message);
      throw new Error(`Verifica SMTP fallita: ${verifyError.message}`);
    }
    
    // Step 4: Prepara email di test
    console.log('\n📧 Step 4: Preparazione email di test');
    
    const timestamp = new Date().toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      dateStyle: 'full',
      timeStyle: 'long'
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_PROPRIETARIO,
      subject: `🧪 Test Email Sistema Check-in - ${new Date().toISOString().slice(0,10)}`,
      text: `
Test Email Sistema Check-in
============================

Questa è un'email di test inviata dal sistema di check-in.

Dettagli:
- Inviata da: ${process.env.EMAIL_USER}
- Inviata a: ${process.env.EMAIL_PROPRIETARIO}
- Timestamp: ${timestamp}
- Server: Vercel
- Service: Yahoo Mail

Se ricevi questa email, la configurazione è corretta! ✅

---
Sistema Check-in Automatico
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
    .success { color: #4CAF50; font-size: 48px; text-align: center; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 Test Email Sistema Check-in</h1>
    </div>
    <div class="content">
      <div class="success">✅</div>
      <h2 style="text-align: center; color: #4CAF50;">Configurazione Corretta!</h2>
      <p>Questa è un'email di test inviata dal sistema di check-in.</p>
      
      <div class="info-box">
        <strong>📋 Dettagli Test:</strong><br>
        <strong>Da:</strong> ${process.env.EMAIL_USER}<br>
        <strong>A:</strong> ${process.env.EMAIL_PROPRIETARIO}<br>
        <strong>Timestamp:</strong> ${timestamp}<br>
        <strong>Server:</strong> Vercel<br>
        <strong>Service:</strong> Yahoo Mail
      </div>
      
      <p>Se ricevi questa email, significa che:</p>
      <ul>
        <li>✅ Le variabili d'ambiente sono configurate correttamente</li>
        <li>✅ La connessione SMTP a Yahoo funziona</li>
        <li>✅ L'invio email è operativo</li>
      </ul>
      
      <p><strong>Prossimi passi:</strong></p>
      <ol>
        <li>Testa il flusso completo con un pagamento di test</li>
        <li>Verifica che il webhook riceva correttamente i dati</li>
        <li>Controlla che il PDF venga generato e allegato</li>
      </ol>
    </div>
    <div class="footer">
      <p>Sistema Check-in Automatico<br>
      Generato automaticamente - Non rispondere a questa email</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    };
    
    console.log('Email preparata:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    // Step 5: Invio email
    console.log('\n📤 Step 5: Invio email in corso...');
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email inviata con successo!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
    // Step 6: Risposta finale
    console.log('\n🎉 === TEST COMPLETATO CON SUCCESSO ===\n');
    
    return res.status(200).json({
      success: true,
      message: 'Email di test inviata con successo!',
      details: {
        messageId: info.messageId,
        response: info.response,
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_PROPRIETARIO,
        timestamp: timestamp
      },
      nextSteps: [
        'Controlla la tua casella email',
        'Verifica che l\'email non sia finita in spam',
        'Se tutto funziona, testa il flusso completo con un pagamento'
      ]
    });
    
  } catch (error) {
    console.error('\n❌ === TEST FALLITO ===');
    console.error('Errore:', error.message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    
    // Analisi errore comune
    let suggerimento = '';
    
    if (error.message.includes('Invalid login')) {
      suggerimento = 'Credenziali Yahoo errate. Assicurati di usare una "password per le app" e non la password normale del tuo account Yahoo.';
    } else if (error.message.includes('ECONNECTION')) {
      suggerimento = 'Problema di connessione. Verifica che Vercel possa connettersi a smtp.mail.yahoo.com';
    } else if (error.message.includes('auth')) {
      suggerimento = 'Problema di autenticazione. Verifica EMAIL_USER e EMAIL_PASSWORD su Vercel.';
    }
    
    return res.status(500).json({
      success: false,
      error: error.message,
      errorCode: error.code,
      suggerimento: suggerimento,
      config: {
        EMAIL_USER: process.env.EMAIL_USER || 'MISSING',
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'SET' : 'MISSING',
        EMAIL_PROPRIETARIO: process.env.EMAIL_PROPRIETARIO || 'MISSING'
      },
      help: {
        passwordApp: 'Per Yahoo: https://login.yahoo.com/account/security → App passwords',
        vercelEnv: 'Per Vercel: Dashboard → Settings → Environment Variables'
      }
    });
  }
}
