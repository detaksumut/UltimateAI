$targetDir = "D:\Users\ultimateai\runtimes\llama.cpp\bin"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}
Write-Host "Copying llama.cpp binaries..."
Copy-Item -Path "C:\Users\BI News\AppData\Local\Programs\Ollama\lib\ollama\*" -Destination $targetDir -Recurse -Force

$modelDir = "D:\Users\ultimateai\runtimes\llama.cpp\models"
if (-not (Test-Path $modelDir)) {
    New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
}

$hermesBlob = "D:\OllamaModels\blobs\sha256-c8985d236593f7a17da2a3da49588aa951a9b1e57ce97753364fbf59e63af84a"
$qwenBlob = "D:\OllamaModels\blobs\sha256-a3de86cd1c132c822487ededd47a324c50491393e6565cd14bafa40d0b8e686f"

$hermesLink = Join-Path $modelDir "hermes-3-8b.Q4_0.gguf"
$qwenLink = Join-Path $modelDir "qwen-3-8b.gguf"

if (-not (Test-Path $hermesLink)) {
    Write-Host "Creating hardlink for Hermes 3:8B GGUF..."
    New-Item -ItemType HardLink -Path $hermesLink -Target $hermesBlob | Out-Null
}
if (-not (Test-Path $qwenLink)) {
    Write-Host "Creating hardlink for Qwen 3:8B GGUF..."
    New-Item -ItemType HardLink -Path $qwenLink -Target $qwenBlob | Out-Null
}

Write-Host "`n=== ISOLATED LLAMA.CPP MODELS ==="
Get-ChildItem -Path $modelDir | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "=== ISOLATED LLAMA.CPP EXECUTABLES ==="
Get-ChildItem -Path $targetDir -Filter "*.exe" | Select-Object Name, Length | Format-Table -AutoSize | Out-String | Write-Host
