Write-Host "=== ENVIRONMENT & HARDWARE AUDIT ==="
Write-Host ("OS: " + [System.Environment]::OSVersion.VersionString)
Write-Host ("Arch: " + $env:PROCESSOR_ARCHITECTURE)

$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors
Write-Host ("CPU: " + $cpu.Name + " (Cores: " + $cpu.NumberOfCores + ", Threads: " + $cpu.NumberOfLogicalProcessors + ")")

$os = Get-CimInstance Win32_OperatingSystem
$totalRam = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
$freeRam = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
Write-Host ("RAM: Total $totalRam GB, Free $freeRam GB")

$gpus = Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion
foreach ($g in $gpus) {
    Write-Host ("GPU: " + $g.Name + " (VRAM: " + [math]::Round($g.AdapterRAM/1MB, 0) + " MB, Driver: " + $g.DriverVersion + ")")
}

Write-Host "`n=== DISK SPACE ==="
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}}, @{N='Used(GB)';E={[math]::Round(($_.Used)/1GB,2)}} | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "=== CHECKING EXISTING LLAMA.CPP / LLAMA-SERVER EXECUTABLES ==="
Get-ChildItem -Path "C:\Users\BI News\AppData\Local\Programs\Ollama" -Filter "*llama*" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host
Get-Command llama*, *llama* -ErrorAction SilentlyContinue | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "=== CHECKING OLLAMA MANIFESTS (EXACT GGUF BLOBS FOR HERMES & QWEN) ==="
$manifests = Get-ChildItem -Path "D:\OllamaModels\manifests" -Recurse -File -ErrorAction SilentlyContinue
foreach ($m in $manifests) {
    Write-Host ("MANIFEST: " + $m.FullName)
    $content = Get-Content $m.FullName -Raw | ConvertFrom-Json
    foreach ($layer in $content.layers) {
        if ($layer.mediaType -like "*model*") {
            $blobPath = "D:\OllamaModels\blobs\" + ($layer.digest -replace ':', '-')
            $exists = Test-Path $blobPath
            $sizeGB = [math]::Round($layer.size / 1GB, 2)
            Write-Host ("  Model Layer Digest: " + $layer.digest + " | Size: $sizeGB GB | File Exists: $exists ($blobPath)")
        }
    }
}

Write-Host "`n=== CHECKING STANDALONE GGUF FILES IN C: AND D: ==="
Get-ChildItem -Path "D:\" -Filter "*.gguf" -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select-Object FullName, Length | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "`n=== PYTHON ENVIRONMENTS IN SYSTEM ==="
Get-Command python* -ErrorAction SilentlyContinue | Select-Object Source, Version | Format-Table -AutoSize | Out-String | Write-Host
