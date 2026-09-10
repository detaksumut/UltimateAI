$ErrorActionPreference = 'SilentlyContinue'

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  AUDIT LENGKAP DRIVE D:, F:, & POOL OLLAMA" -ForegroundColor Magenta
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Pengecekan API Ollama
Write-Host "`n[1/5] Memeriksa status Ollama API (http://127.0.0.1:11434)..." -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[OK] Ollama Service ONLINE di port 11434" -ForegroundColor Green
    if ($res.models -and $res.models.Count -gt 0) {
        Write-Host "Model yang TERPASANG dan TERDAFTAR di Ollama:" -ForegroundColor Green
        foreach ($m in $res.models) {
            $sz = [math]::Round($m.size / 1GB, 2)
            Write-Host "  * $($m.name) (Ukuran: $sz GB)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "[WARNING] Ollama aktif TETAPI belum ada model yang terpasang (0 models)." -ForegroundColor Red
    }
} catch {
    Write-Host "[OFFLINE] Ollama service tidak dapat dihubungi: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Lokasi Direktori Default Ollama di Windows
Write-Host "`n[2/5] Memeriksa Environment & Direktori Default Ollama..." -ForegroundColor Yellow
Write-Host "Variabel OLLAMA_MODELS: $($env:OLLAMA_MODELS)"
$defaultOllama = "$env:USERPROFILE\.ollama"
Write-Host "Path Default: $defaultOllama"
if (Test-Path $defaultOllama) {
    Write-Host "[OK] Folder .ollama ditemukan di profil user." -ForegroundColor Green
    $modelsPath = "$defaultOllama\models"
    if (Test-Path $modelsPath) {
        $manifests = Get-ChildItem -Path "$modelsPath\manifests" -Recurse -File -ErrorAction SilentlyContinue
        Write-Host "Manifest model di $modelsPath\manifests:"
        foreach ($mf in $manifests) {
            Write-Host "  * $($mf.FullName.Replace($modelsPath, ''))" -ForegroundColor White
        }
    }
} else {
    Write-Host "[INFO] Folder default .ollama tidak ditemukan di user profile." -ForegroundColor Gray
}

# 3. Pengecekan Drive D:
Write-Host "`n[3/5] Memeriksa Drive D: ..." -ForegroundColor Yellow
if (Test-Path "D:\") {
    Write-Host "[OK] Drive D: TERPASANG" -ForegroundColor Green
    Write-Host "Direktori tingkat atas di D:\:"
    Get-ChildItem -Path "D:\" -Depth 0 -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  [DIR] $($_.FullName)" -ForegroundColor Cyan
    }

    Write-Host "Mencari file model (*hermes*, *qwen*, *.gguf) di D:\ (kedalaman 2 level):"
    Get-ChildItem -Path "D:\" -Depth 2 -File -Include "*.gguf", "*hermes*", "*qwen*" -ErrorAction SilentlyContinue | ForEach-Object {
        $szMb = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  [FILE] $($_.FullName) ($szMb MB)" -ForegroundColor Green
    }
} else {
    Write-Host "[FAIL] Drive D: tidak ditemukan!" -ForegroundColor Red
}

# 4. Pengecekan Drive F:
Write-Host "`n[4/5] Memeriksa Drive F: ..." -ForegroundColor Yellow
if (Test-Path "F:\") {
    Write-Host "[OK] Drive F: TERPASANG & TERBACA" -ForegroundColor Green
    $driveFInfo = Get-PSDrive -Name "F" -ErrorAction SilentlyContinue
    if ($driveFInfo) {
        $freeGb = [math]::Round($driveFInfo.Free / 1GB, 2)
        $usedGb = [math]::Round($driveFInfo.Used / 1GB, 2)
        Write-Host "Kapasitas F: Free: $freeGb GB | Used: $usedGb GB" -ForegroundColor White
    }
    Write-Host "Direktori di root F:\:"
    Get-ChildItem -Path "F:\" -Depth 1 -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  [DIR] $($_.FullName)" -ForegroundColor Cyan
    }

    Write-Host "Mencari file model (*hermes*, *qwen*, *.gguf, *model*) di F:\:"
    Get-ChildItem -Path "F:\" -Depth 3 -Include "*.gguf", "*hermes*", "*qwen*", "*model*" -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.PSIsContainer) {
            Write-Host "  [DIR] $($_.FullName)" -ForegroundColor Yellow
        } else {
            $szMb = [math]::Round($_.Length / 1MB, 2)
            Write-Host "  [FILE] $($_.FullName) ($szMb MB)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "[OFFLINE] Drive F: TIDAK TERPASANG / TIDAK DITEMUKAN" -ForegroundColor Red
}

# 5. Pengecekan Proses & Port
Write-Host "`n[5/5] Memeriksa Proses Aktif..." -ForegroundColor Yellow
Get-Process -Name "ollama*", "node*", "python*" -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, @{Name='RAM (MB)';Expression={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table -AutoSize

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  AUDIT SELESAI" -ForegroundColor Magenta
Write-Host "====================================================" -ForegroundColor Cyan
