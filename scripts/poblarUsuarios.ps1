# Script para poblar usuarios de ejemplo con roles
# Asegúrate de que MongoDB esté ejecutándose antes de ejecutar este script

Write-Host "🚀 Poblando usuarios de ejemplo..." -ForegroundColor Green

# Cambiar al directorio del backend
Set-Location -Path "c:\Users\pc1\Desktop\invmant\backend"

# Compilar y ejecutar el script de población
Write-Host "📦 Compilando TypeScript..." -ForegroundColor Yellow
npx tsc src/scripts/poblarUsuarios.ts --outDir dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck

if ($LASTEXITCODE -eq 0) {
    Write-Host "🏃‍♂️ Ejecutando población de usuarios..." -ForegroundColor Yellow
    node dist/scripts/poblarUsuarios.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Población de usuarios completada exitosamente!" -ForegroundColor Green
    } else {
        Write-Host "❌ Error ejecutando la población de usuarios" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Error compilando TypeScript" -ForegroundColor Red
}

Write-Host "🏁 Script finalizado" -ForegroundColor Cyan