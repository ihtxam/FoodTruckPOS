@echo off
setlocal
cd /d "%~dp0"

if exist "dist\chaslay-print-agent.exe" (
  echo Starting installed-style EXE...
  start "" "dist\chaslay-print-agent.exe" --run
  exit /b 0
)

if not exist "node_modules\" (
  echo Installing print agent dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting ChaslayReborn Print Agent on http://127.0.0.1:9101
echo Tip: run build-installer.ps1 then the setup EXE to install permanently.
echo.
node server.js --run
