@echo off
title UltimateAI - Local Router

cd /d D:\users\ultimateai

echo ===============================================
echo       ULTIMATEAI LOCAL ROUTER
echo ===============================================
echo.
echo Checking Ollama :11434...

powershell -NoProfile -Command "try { $r=Invoke-RestMethod http://127.0.0.1:11434/api/tags -TimeoutSec 5; Write-Host 'Ollama :11434 ONLINE' -ForegroundColor Green } catch { Write-Host 'Ollama :11434 OFFLINE' -ForegroundColor Red; exit 1 }"

if errorlevel 1 (
    echo.
    echo Ollama belum aktif.
    echo Jalankan Ollama terlebih dahulu.
    pause
    exit /b 1
)

echo.
echo Starting UltimateAI Local Router :20200...
echo.
node .\server\server.mjs

echo.
echo Local Router berhenti.
pause
