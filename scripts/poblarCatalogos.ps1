# Script para poblar datos de catálogos
Write-Host "🚀 Iniciando población de catálogos..." -ForegroundColor Green

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "src\scripts\poblarCatalogos.ts")) {
    Write-Host "❌ Error: Ejecuta este script desde el directorio backend" -ForegroundColor Red
    exit 1
}

# Verificar que MongoDB esté corriendo
Write-Host "🔍 Verificando conexión a MongoDB..." -ForegroundColor Yellow
try {
    mongo --quiet --eval "db.runCommand('ping').ok" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: MongoDB no está corriendo o no es accesible" -ForegroundColor Red
        Write-Host "   Asegúrate de que MongoDB esté iniciado" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ MongoDB está corriendo" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: No se pudo verificar MongoDB" -ForegroundColor Red
    exit 1
}

# Compilar y ejecutar el script TypeScript
Write-Host "🔨 Compilando y ejecutando script..." -ForegroundColor Yellow
try {
    npx ts-node src/scripts/poblarCatalogos.ts
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ ¡Población completada exitosamente!" -ForegroundColor Green
    } else {
        Write-Host "❌ Error durante la población" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error ejecutando el script: $_" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 ¡Proceso completado!" -ForegroundColor Green