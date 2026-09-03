#!/bin/bash
# Script per copiare file statici in public/ durante il build Vercel

echo "📦 Copiando file statici in public/..."

# Crea le directory necessarie
mkdir -p public/images/cassetta

# Copia i file HTML/CSS/JS in public/
cp index.html public/
cp checkin.css public/
cp checkin.js public/
cp successo-pagamento.html public/

# ✅ CRITICAL: Copia le immagini della cassetta
if [ -d "public/images/cassetta" ]; then
  echo "✅ Directory public/images/cassetta già esistente"
else
  mkdir -p public/images/cassetta
  echo "✅ Directory public/images/cassetta creata"
fi

# Se le immagini sono in un'altra cartella sorgente, copiale
if [ -d "images/cassetta" ]; then
  cp images/cassetta/*.jpg public/images/cassetta/ 2>/dev/null || echo "⚠️ Nessuna immagine .jpg trovata in images/cassetta"
  cp images/cassetta/*.png public/images/cassetta/ 2>/dev/null || echo "⚠️ Nessuna immagine .png trovata in images/cassetta"
fi

echo "✅ File copiati con successo!"
echo "📂 Contenuto public/:"
ls -la public/

echo "📂 Contenuto public/images/:"
ls -la public/images/ 2>/dev/null || echo "⚠️ Directory public/images/ non trovata"

echo "📂 Contenuto public/images/cassetta/:"
ls -la public/images/cassetta/ 2>/dev/null || echo "⚠️ Directory public/images/cassetta/ non trovata"

