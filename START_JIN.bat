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
    echo Starting Ollama with 24h RAM retention...
    set OLLAMA_KEEP_ALIVE=24h
    start "OLLAMA" cmd /k "set OLLAMA_KEEP_ALIVE=24h && ollama serve"
    timeout /t 5 /nobreak >nul
) else (
    echo Ollama already ONLINE.
)

echo [1b] Pre-warming Qwen 3 into RAM (keep_alive: 24h)...
powershell -NoProfile -Command ^
"try { ^
  $res = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method POST -Body '{\"model\":\"qwen3:8b\",\"keep_alive\":\"24h\"}' -ContentType 'application/json' -TimeoutSec 60; ^
  Write-Host 'Qwen 3 successfully locked into RAM.'; ^
} catch { ^
  Write-Host ('Pre-warm warning: ' + $_.Exception.Message); ^
}"

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