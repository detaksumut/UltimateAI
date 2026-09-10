$ErrorActionPreference = 'SilentlyContinue'

Write-Host "=== 1. DETAIL D:\OllamaModels ===" -ForegroundColor Cyan
if (Test-Path "D:\OllamaModels") {
    $blobs = Get-ChildItem -Path "D:\OllamaModels\blobs" -ErrorAction SilentlyContinue
    Write-Host "Total Blobs di D:\OllamaModels\blobs: $($blobs.Count) file"
    $totalSize = ($blobs | Measure-Object -Property Length -Sum).Sum
    Write-Host "Total Ukuran Blobs: $([math]::Round($totalSize/1GB, 2)) GB" -ForegroundColor Green
    $blobs | Sort-Object Length -Descending | Select-Object -First 5 | ForEach-Object {
        Write-Host "  * $($_.Name) - $([math]::Round($_.Length/1GB, 2)) GB" -ForegroundColor White
    }
} else {
    Write-Host "D:\OllamaModels TIDAK DITEMUKAN" -ForegroundColor Red
}

Write-Host "`n=== 2. DETAIL DRIVE F: (PHYSICAL & MEMORY) ===" -ForegroundColor Cyan
if (Test-Path "F:\") {
    $f = Get-PSDrive -Name "F" -ErrorAction SilentlyContinue
    Write-Host "Drive F: TERPASANG | Bebas: $([math]::Round($f.Free/1GB, 2)) GB | Terpakai: $([math]::Round($f.Used/1GB, 2)) GB" -ForegroundColor Green
    Write-Host "Folder di Root F:\:"
    Get-ChildItem -Path "F:\" -Depth 0 -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  [DIR] $($_.FullName)" -ForegroundColor Cyan
    }
    
    if (Test-Path "F:\UltimateAI_Memory") {
        Write-Host "`nFolder F:\UltimateAI_Memory Terdeteksi:" -ForegroundColor Green
        Get-ChildItem -Path "F:\UltimateAI_Memory" -Depth 1 -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $files = Get-ChildItem -Path $_.FullName -File -ErrorAction SilentlyContinue
            Write-Host "  [DIR] $($_.Name) ($($files.Count) files)" -ForegroundColor White
        }
    }
} else {
    Write-Host "Drive F: TIDAK TERDETEKSI" -ForegroundColor Red
}

Write-Host "`n=== 3. TES EKSEKUSI OLLAMA HERMES 3 (LIVE PROMPT) ===" -ForegroundColor Cyan
Write-Host "Mencoba mengirimkan 1 token uji ke hermes3:8b via http://127.0.0.1:11434/api/generate..." -ForegroundColor Yellow
$t0 = [DateTime]::Now
try {
    $body = @{
        model = "hermes3:8b"
        prompt = "Hi"
        stream = $false
        options = @{ num_predict = 5 }
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/generate" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 20 -ErrorAction Stop
    $latency = ([DateTime]::Now - $t0).TotalMilliseconds
    Write-Host "[SUKSES] hermes3:8b MERESPONS! Waktu respon: $latency ms" -ForegroundColor Green
    Write-Host "Jawaban Model: $($resp.response)" -ForegroundColor White
} catch {
    $latency = ([DateTime]::Now - $t0).TotalMilliseconds
    Write-Host "[GAGAL/TIMEOUT] hermes3:8b TIDAK DAPAT MERESPONS dalam kurun waktu (${latency}ms): $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 4. TES EKSEKUSI OLLAMA QWEN 3 (LIVE PROMPT) ===" -ForegroundColor Cyan
Write-Host "Mencoba mengirimkan 1 token uji ke qwen3:8b via http://127.0.0.1:11434/api/generate..." -ForegroundColor Yellow
$t0 = [DateTime]::Now
try {
    $body = @{
        model = "qwen3:8b"
        prompt = "Hi"
        stream = $false
        options = @{ num_predict = 5 }
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/generate" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 20 -ErrorAction Stop
    $latency = ([DateTime]::Now - $t0).TotalMilliseconds
    Write-Host "[SUKSES] qwen3:8b MERESPONS! Waktu respon: $latency ms" -ForegroundColor Green
    Write-Host "Jawaban Model: $($resp.response)" -ForegroundColor White
} catch {
    $latency = ([DateTime]::Now - $t0).TotalMilliseconds
    Write-Host "[GAGAL/TIMEOUT] qwen3:8b TIDAK DAPAT MERESPONS dalam kurun waktu (${latency}ms): $($_.Exception.Message)" -ForegroundColor Red
}
