#!/bin/bash
# Build estático para GitHub Pages
# - Excluye API Routes (no compatibles con output: export)
# - Activa NEXT_PUBLIC_STATIC_MODE para que el frontend cargue desde /data/*.json
set -e

cd "$(dirname "$0")/.."

echo "📦 Build estático para GitHub Pages"
echo ""

# 1. Mover temporalmente api/ fuera de app/
if [ -d "src/app/api" ]; then
  echo "🔄 Excluyendo API Routes del build estático..."
  mv src/app/api /tmp/caliral-api-backup
fi

# 2. Build con output: export
export NEXT_PUBLIC_STATIC_MODE=true
export NEXT_TELEMETRY_DISABLED=1

echo "🔨 Ejecutando next build..."
next build

# 3. Restaurar api/
if [ -d "/tmp/caliral-api-backup" ]; then
  echo "🔄 Restaurando API Routes..."
  mv /tmp/caliral-api-backup src/app/api
fi

echo ""
echo "✅ Build estático completado en ./out"
echo "   Listo para GitHub Pages"
