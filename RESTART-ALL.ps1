# RESTART-ALL.ps1 — Kill semua node, start ulang server + vite
# Run: powershell -ExecutionPolicy Bypass -File RESTART-ALL.ps1

Write-Host "`n[1/3] Killing all node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Verify killed
$remaining = Get-Process node -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "Force killing remaining..." -ForegroundColor Red
    $remaining | Stop-Process -Force
    Start-Sleep -Seconds 1
}
Write-Host "[OK] All node processes killed.`n" -ForegroundColor Green

Write-Host "[2/3] Starting backend server on :20200..." -ForegroundColor Cyan
$serverJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'D:\Users\ultimateai'; node server/server.mjs"
) -PassThru
Write-Host "[OK] Server PID: $($serverJob.Id)`n" -ForegroundColor Green

Start-Sleep -Seconds 3

Write-Host "[3/3] Starting Vite dev server on :5177..." -ForegroundColor Cyan
$viteJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'D:\Users\ultimateai'; npx vite --host 127.0.0.1 --port 5177"
) -PassThru
Write-Host "[OK] Vite PID: $($viteJob.Id)`n" -ForegroundColor Green

Start-Sleep -Seconds 5

# Test
Write-Host "Testing backend..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:20200/api/conversations" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[OK] Backend responding: $($r.StatusCode)`n" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Backend not ready yet, give it a few seconds`n" -ForegroundColor Yellow
}

Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5177/simulator" -ForegroundColor Cyan
Write-Host "Backend:  http://127.0.0.1:20200`n" -ForegroundColor Cyan
