$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonCandidates = @(
    "C:\Users\BI News\AppData\Local\Programs\Python\Python312\python.exe",
    (Get-Command python.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $pythonCandidates) { throw "Python tidak ditemukan. Instal Python 3.12 atau atur PATH." }
$python = $pythonCandidates[0]
$bridge = Join-Path $PSScriptRoot "xm_mt5_jin_bridge.py"
$terminal = if ($env:XM_MT5_PATH) { $env:XM_MT5_PATH } else { "C:\Program Files\XM Global MT5\terminal64.exe" }
$router = if ($env:ULTIMATEAI_ROUTER_URL) { $env:ULTIMATEAI_ROUTER_URL.TrimEnd("/") } else { "http://127.0.0.1:20200" }

if (-not (Test-Path $bridge)) { throw "File konektor tidak ditemukan: $bridge" }
if (-not (Test-Path $terminal)) { throw "Terminal XM MT5 tidak ditemukan: $terminal" }

try {
    $null = Invoke-RestMethod -Uri "$router/api/trading/ohlc/status?symbol=XAUUSD" -TimeoutSec 3
} catch {
    throw "Local Router tidak dapat diakses di $router. Jalankan npm run serve pada terminal lain dahulu."
}

Write-Host "Memeriksa paket MetaTrader5..." -ForegroundColor Cyan
& $python -c "import MetaTrader5; print(123)"
if ($LASTEXITCODE -ne 0) { throw "Paket MetaTrader5 tidak tersedia pada interpreter yang dipilih. Instal paket MetaTrader5 untuk Python tersebut." }

Write-Host "Pastikan XM Global MT5 sudah terbuka dan login ke akun yang benar." -ForegroundColor Yellow
Write-Host "Router : $router"
Write-Host "Terminal: $terminal"
Write-Host "Simbol broker: $($env:XM_MT5_SYMBOL)"
Write-Host "Bridge berjalan di foreground; tekan Ctrl+C untuk menghentikannya." -ForegroundColor Green

Set-Location $projectRoot
& $python $bridge
exit $LASTEXITCODE