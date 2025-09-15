Param(
  [int]$Port = 5000
)

Write-Host "Killing any process listening on port $Port..."
$pids = (netstat -ano | Select-String ":$Port\b" | ForEach-Object { ($_ -split '\s+')[-1] } ) | Select-Object -Unique
foreach ($pid in $pids) {
  if ([int]::TryParse($pid, [ref]$null)) {
    Write-Host "Stopping PID $pid"
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Starting production server (node dist/index.js) on port $Port..."
Set-Location -Path (Join-Path $PSScriptRoot '..')
$env:PORT = $Port
Start-Process -FilePath node -ArgumentList 'dist/index.js' -WorkingDirectory (Get-Location).Path -NoNewWindow -PassThru
Write-Host "Started. Use Get-Process to inspect the node process."
