#!/bin/bash
cd "$(dirname "$0")"

echo "================================"
echo "  Subiendo Ebony Manager a GitHub..."
echo "================================"

# Configurar git si no está configurado
git config --global user.email "teofilohafeitz@gmail.com" 2>/dev/null || true
git config --global user.name "Teofilo" 2>/dev/null || true

# Inicializar git
git init
git branch -M main

# Agregar todos los archivos (excepto los ignorados)
git add -A

# Primer commit
git commit -m "feat: Ebony Manager v1.0 — Fase 1 Cotización"

# Conectar con GitHub
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/teofilohafeitz-eng/ebony-manager.git

# Subir el código
echo ""
echo "Subiendo archivos a GitHub..."
echo "(Te va a pedir tu usuario y contraseña de GitHub)"
echo ""
git push -u origin main

echo ""
echo "================================"
echo "  ¡Listo! Código subido a GitHub"
echo "================================"
read -p "Presiona Enter para cerrar..."
