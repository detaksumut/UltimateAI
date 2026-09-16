# System and Environment Baseline Audit
Write-Output "=== 1. COMFYUI AUDIT (PROTECTED EXTERNAL ENVIRONMENT) ==="
$comfyRoot = "D:\Users\ultimateai\ComfyUI"
$comfyPy = "D:\Users\ultimateai\ComfyUI\venv\Scripts\python.exe"

Write-Output "COMFYUI_PATH: $comfyRoot (Exists: $(Test-Path $comfyRoot))"
Write-Output "VENV_PATH: $comfyPy (Exists: $(Test-Path $comfyPy))"

if (Test-Path $comfyPy) {
    & $comfyPy -c "import sys, torch; print('PYTHON_VERSION:', sys.version); print('PYTORCH_VERSION:', torch.__version__); print('CUDA_AVAILABLE:', torch.cuda.is_available()); print('CUDA_VERSION:', torch.version.cuda if torch.cuda.is_available() else 'N/A')"
}

if (Test-Path "$comfyRoot\custom_nodes") {
    Write-Output "CUSTOM_NODES:"
    Get-ChildItem "$comfyRoot\custom_nodes" | ForEach-Object { Write-Output " - $($_.Name)" }
}

if (Test-Path "$comfyRoot\models") {
    Write-Output "MODEL_DIRECTORY: $comfyRoot\models (Exists: True)"
}

Write-Output ""
Write-Output "=== 2. OLLAMA & RUNTIME STATUS ==="
try {
    $ollamaTags = curl.exe -s http://127.0.0.1:11434/api/tags
    Write-Output "OLLAMA_STATUS: ONLINE"
    Write-Output "OLLAMA_TAGS_RAW: $ollamaTags"
} catch {
    Write-Output "OLLAMA_STATUS: OFFLINE or unreachable ($($_.Exception.Message))"
}

try {
    $backendHealth = curl.exe -s http://127.0.0.1:20200/health
    Write-Output "BACKEND_STATUS: $backendHealth"
} catch {
    Write-Output "BACKEND_STATUS: OFFLINE"
}

try {
    $frontendCheck = curl.exe -s -I http://127.0.0.1:5177/
    Write-Output "FRONTEND_STATUS: $frontendCheck"
} catch {
    Write-Output "FRONTEND_STATUS: OFFLINE"
}

Write-Output ""
Write-Output "=== 3. GIT REPOSITORY STATE ==="
try {
    # Check if git works via full path or command
    git status --short
} catch {
    Write-Output "GIT_STATUS_ERROR: $($_.Exception.Message)"
}
