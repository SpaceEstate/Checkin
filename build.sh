#!/bin/bash
# Script per copiare file statici in public/ durante il build Vercel

echo "📦 Copiando file statici in public/..."

# Copia i file HTML/CSS/JS in public/
cp index.html public/
cp checkin.css public/
cp checkin.js public/
cp successo-pagamento.html public/

echo "✅ File copiati con successo!"
ls -la public/
