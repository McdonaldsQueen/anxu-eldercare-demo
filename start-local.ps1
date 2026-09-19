$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath 'node_modules')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}

& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }

Write-Host 'Local demo: http://127.0.0.1:4173/ (Ctrl+C to stop)'
& npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort
