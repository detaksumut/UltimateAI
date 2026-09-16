$comfyPath = "D:\Users\ultimateai\ComfyUI"
$venvPath = Join-Path $comfyPath "venv\Scripts\python.exe"
$existsComfy = Test-Path $comfyPath
$existsVenv = Test-Path $venvPath
$pyVer = & $venvPath -c "import sys; print(sys.version.strip())"
$torchVer = & $venvPath -c "import torch; print(f'PyTorch: {torch.__version__} | CUDA: {torch.cuda.is_available()}')"
$customNodes = (Get-ChildItem (Join-Path $comfyPath "custom_nodes") | Select-Object -ExpandProperty Name) -join ", "
$modelDir = Join-Path $comfyPath "models"
$modelDirExists = Test-Path $modelDir

Write-Host "COMFYUI_PATH: $comfyPath (Exists: $existsComfy)"
Write-Host "VENV_PATH: $venvPath (Exists: $existsVenv)"
Write-Host "PYTHON_VERSION: $pyVer"
Write-Host "PYTORCH_VERSION: $torchVer"
Write-Host "CUSTOM_NODES: $customNodes"
Write-Host "MODEL_DIRECTORY: $modelDir (Exists: $modelDirExists)"
