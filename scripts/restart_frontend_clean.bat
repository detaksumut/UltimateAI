@echo off
title JIN [RESTART FRONTEND] - Clean Start
color 0E
cd /d D:\Users\ultimateai

echo ============================================================
echo   [JIN FRONTEND] CLEAN RESTART SCRIPT
echo   Versi: Safe Kill + Cache Clear + Single Instance
echo ============================================================
echo.

echo [1/4] Menghentikan semua proses Vite / node yang menggantung...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5177 " ^| findstr LISTENING') do (
    echo     Killing PID %%a di port 5177...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [2/4] Bersihkan Vite cache...
if exist "node_modules\.vite" (
    rmdir /S /Q "node_modules\.vite"
    echo     Cache .vite dihapus.
) else (
    echo     Tidak ada cache .vite.
)

echo [3/4] Verifikasi port 5177 bebas...
netstat -ano | findstr ":5177 " | findstr LISTENING >nul 2>&1
if %errorlevel%==0 (
    echo     [PERINGATAN] Port 5177 masih terpakai! Coba kill manual.
) else (
    echo     Port 5177 bebas. Siap start!
)

echo [4/4] Memulai Vite dev server (satu instance saja)...
echo.
echo ============================================================
echo   http://localhost:5177/simulator
echo   http://192.168.1.3:5177/simulator  (LAN / HP lokal)
echo ============================================================
echo.

if exist "node_modules\vite\bin\vite.js" (
    node "node_modules\vite\bin\vite.js" --host 0.0.0.0 --port 5177
) else (
    call npm run dev -- --host 0.0.0.0 --port 5177
)

echo.
echo ============================================================
echo [JIN FRONTEND] Server berhenti (Exit Code: %errorlevel%).
echo ============================================================
pause
