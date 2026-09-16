@echo off
title JIN [MONITOR 4] - FRONTEND VITE :5177
color 0D
cd /d D:\Users\ultimateai

echo ============================================================
echo   [MONITOR 4] JIN FRONTEND VITE WEB SERVER
echo   Port     : 5177 (http://127.0.0.1:5177)
echo   UI       : React Vite Dev Server
echo ============================================================
echo.

call npm run dev -- --host 127.0.0.1 --port 5177

echo.
echo ============================================================
echo [MONITOR 4] Frontend dev server telah berhenti (Exit Code: %errorlevel%).
echo ============================================================
pause
