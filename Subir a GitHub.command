#!/bin/bash
cd "$(dirname "$0")"

echo "================================"
echo "  Subiendo Ebony Manager a GitHub"
echo "================================"
echo ""

# Pedir el token via dialogo de macOS
TOKEN=$(osascript -e 'Tell application "System Events" to display dialog "Pega tu GitHub Personal Access Token:" default answer "" with hidden answer buttons {"Cancelar", "OK"} default button "OK"' -e 'text returned of result' 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Cancelado."
  exit 1
fi

# Configurar identidad git
git config user.email "teofilohafeitz@gmail.com"
git config user.name "Teofilo"

# Inicializar y subir
git init
git branch -M main
git add -A
git commit -m "feat: Ebony Manager v1.0 — Fase 1 Cotización" 2>/dev/null || git commit --allow-empty -m "feat: Ebony Manager v1.0"

git remote remove origin 2>/dev/null || true
git remote add origin "https://teofilohafeitz-eng:${TOKEN}@github.com/teofilohafeitz-eng/ebony-manager.git"

git push -u origin main

echo ""
echo "================================"
echo "  ✅ ¡Código subido a GitHub!"
echo "================================"
read -p "Presiona Enter para cerrar..."
