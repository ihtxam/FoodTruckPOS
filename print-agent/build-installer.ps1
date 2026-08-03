# Builds Chaslay Print Agent Windows EXE + copies installer to backend/public/downloads/
# Usage (from print-agent/):
#   powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Dist = Join-Path $Root "dist"
$Downloads = Join-Path $Root "..\backend\public\downloads"

Write-Host "==> Installing npm dependencies..."
Push-Location $Root
try {
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

  New-Item -ItemType Directory -Force -Path $Dist | Out-Null
  New-Item -ItemType Directory -Force -Path $Downloads | Out-Null

  Write-Host "==> Building runtime EXE (pkg)..."
  npx pkg . --targets node18-win-x64 --output (Join-Path $Dist "chaslay-print-agent.exe")
  if ($LASTEXITCODE -ne 0) { throw "pkg build (agent) failed" }

  Write-Host "==> Building setup EXE (same binary; auto-installs when filename contains 'setup')..."
  Copy-Item -Force (Join-Path $Dist "chaslay-print-agent.exe") (Join-Path $Dist "chaslay-print-agent-setup.exe")

  # Companion script for portable installs
  Copy-Item -Force (Join-Path $Root "win-raw-print.ps1") (Join-Path $Dist "win-raw-print.ps1")

  $setupSrc = Join-Path $Dist "chaslay-print-agent-setup.exe"
  $setupDest = Join-Path $Downloads "chaslay-print-agent-setup.exe"

  # Reject empty / non-PE output (would surface as "corrupted" on Windows)
  $bytes = [System.IO.File]::ReadAllBytes($setupSrc)
  if ($bytes.Length -lt 1MB) { throw "Built EXE too small ($($bytes.Length) bytes) — pkg likely failed" }
  if ($bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) { throw "Built EXE missing MZ (PE) header — not a Windows binary" }

  Copy-Item -Force $setupSrc $setupDest

  # Also keep non-setup agent binary available
  Copy-Item -Force (Join-Path $Dist "chaslay-print-agent.exe") (Join-Path $Downloads "chaslay-print-agent.exe")

  # Write a small version marker for the dashboard
  @"
{
  "name": "chaslay-print-agent",
  "version": "1.2.0",
  "setupFile": "chaslay-print-agent-setup.exe",
  "builtAt": "$(Get-Date -Format o)",
  "platform": "win32-x64",
  "signed": false
}
"@ | Set-Content -Encoding utf8 (Join-Path $Downloads "chaslay-print-agent.json")

  Write-Host ""
  Write-Host "Build complete."
  Write-Host "  Agent:  $(Join-Path $Dist 'chaslay-print-agent.exe')"
  Write-Host "  Setup:  $setupDest ($([math]::Round($bytes.Length/1MB, 1)) MB, MZ OK)"
  Write-Host "  URL:    /downloads/chaslay-print-agent-setup.exe"
  Write-Host ""
  Write-Host "Note: EXE is unsigned. Windows SmartScreen may warn on first run."
  Write-Host "Deploy: push these fixes, then run scripts/deploy-hetzner.sh on Hetzner"
  Write-Host "  (or scp $setupDest to server backend/public/downloads/)."
}
finally {
  Pop-Location
}
