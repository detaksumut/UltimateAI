@echo off
setlocal
title JIN - UltimateAI
cd /d D:\Users\ultimateai

echo ==========================================
echo        JIN / ULTIMATEAI STARTUP
echo ==========================================
echo.

echo [1/4] Checking Ollama :11434...
powershell -NoProfile -Command "$x=Test-NetConnection 127.0.0.1 -Port 11434 -WarningAction SilentlyContinue; if($x.TcpTestSucceeded){exit 0}else{exit 1}"

if errorlevel 1 (
    echo Starting Ollama...
    start "OLLAMA" cmd /k "ollama serve"
    timeout /t 5 /nobreak >nul
) else (
    echo Ollama already ONLINE.
)

echo.
echo [2/4] Checking existing JIN Backend :20200...

powershell -NoProfile -Command ^
"$c=Get-NetTCPConnection -LocalPort 20200 -State Listen -ErrorAction SilentlyContinue; ^
if($c){ ^
  $p=$c.OwningProcess; ^
  Write-Host ('Existing backend PID: ' + $p); ^
  Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; ^
  Start-Sleep -Seconds 2 ^
} else { ^
  Write-Host 'No existing backend found.' ^
}"

echo.
echo [3/4] Starting LATEST JIN Backend...
echo Project : D:\Users\ultimateai
echo Command : npm run serve
echo.

start "JIN BACKEND - LATEST" cmd /k "cd /d D:\Users\ultimateai && npm run serve"

echo Waiting for Backend :20200...

powershell -NoProfile -Command ^
"$ok=$false; ^
for($i=0;$i-lt60;$i++){ ^
  $x=Test-NetConnection 127.0.0.1 -Port 20200 -WarningAction SilentlyContinue; ^
  if($x.TcpTestSucceeded){$ok=$true;break}; ^
  Start-Sleep 1 ^
}; ^
if($ok){exit 0}else{exit 1}"

if errorlevel 1 (
    echo.
    echo ==========================================
    echo ERROR: Backend :20200 gagal start.
    echo ==========================================
    pause
    exit /b 1
)

echo Backend ONLINE.

echo.
echo [4/4] Checking JIN Frontend :5177...

powershell -NoProfile -Command "$x=Test-NetConnection 127.0.0.1 -Port 5177 -WarningAction SilentlyContinue; if($x.TcpTestSucceeded){exit 0}else{exit 1}"

if errorlevel 1 (
    echo Starting JIN Frontend...
    start "JIN FRONTEND" cmd /k "cd /d D:\Users\ultimateai && npm run dev -- --host 127.0.0.1"
) else (
    echo Frontend already ONLINE.
)

echo Waiting for Frontend :5177...

powershell -NoProfile -Command ^
"$ok=$false; ^
for($i=0;$i-lt60;$i++){ ^
  $x=Test-NetConnection 127.0.0.1 -Port 5177 -WarningAction SilentlyContinue; ^
  if($x.TcpTestSucceeded){$ok=$true;break}; ^
  Start-Sleep 1 ^
}; ^
if($ok){exit 0}else{exit 1}"

if errorlevel 1 (
    echo.
    echo ==========================================
    echo ERROR: Frontend :5177 gagal start.
    echo ==========================================
    pause
    exit /b 1
)

echo.
echo ==========================================
echo          JIN SEMUA ONLINE
echo ==========================================
echo Ollama  : 11434
echo Backend : 20200
echo Frontend: 5177
echo ==========================================
echo.

start "" "http://127.0.0.1:5177"

exit /b 0