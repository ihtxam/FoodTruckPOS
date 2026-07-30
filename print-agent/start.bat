@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\" (
  echo Installing print agent dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting ChaslayReborn Print Agent on http://127.0.0.1:9101
echo Keep this window open while using WebPOS.
echo.
node server.js
