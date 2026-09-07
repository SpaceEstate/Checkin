#!/bin/bash
# Script per copiare file statici in public/ durante il build Vercel

echo "📦 Copiando file statici in public/..."

# Copia i file HTML/CSS/JS in public/
cp index.html public/
cp checkin.css public/
cp checkin.js public/
cp successo-pagamento.html public/

# Le immagini della cassetta sono già committate in public/images/cassetta/
# (non serve copiarle da nessun'altra parte: non esiste una cartella
# images/cassetta/ alla radice del repo).

echo "✅ File copiati con successo!"
echo "📂 Contenuto public/:"
ls -la public/

echo "📂 Contenuto public/images/:"
ls -la public/images/ 2>/dev/null || echo "⚠️ Directory public/images/ non trovata"

echo "📂 Contenuto public/images/cassetta/:"
ls -la public/images/cassetta/ 2>/dev/null || echo "⚠️ Directory public/images/cassetta/ non trovata"
