<#
 ====================================================================
  UltimateAI - JIN Local Agent Bridge (Drive F:\ Read/Write Daemon)
  Operator: Rahman (Enterprise Admin)
  Target: F:\UltimateAI_Memory
  Port: 8080
 ====================================================================
#>

$BasePath = "F:\UltimateAI_Memory"
$Port = 8080

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [JIN AGENT] Initializing Local Bridge Node for F:\ " -ForegroundColor Magenta
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Membuat Struktur Folder Memori Lokal
$Folders = @(
    "$BasePath\01_Logs",
    "$BasePath\02_Documentation",
    "$BasePath\03_AgentState",
    "$BasePath\04_Outputs",
    "$BasePath\05_Vault"
)

foreach ($folder in $Folders) {
    if (-not (Test-Path -Path $folder)) {
        New-Item -Path $folder -ItemType Directory -Force | Out-Null
        Write-Host "[+] Directory created: $folder" -ForegroundColor Green
    } else {
        Write-Host "[=] Directory exists: $folder" -ForegroundColor Yellow
    }
}

# 2. Menulis File Inisialisasi Pertama
$InitFile = "$BasePath\03_AgentState\bridge_status.json"
$InitData = @{
    agent = "JIN-UltimateAI"
    operator = "Rahman"
    drive = "F:\"
    permissions = "READ_WRITE"
    status = "CONNECTED"
    storage_mode = "LOCAL_AIRGAP_OFFLINE"
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json

$InitData | Out-File -FilePath $InitFile -Encoding utf8
Write-Host "[+] Memory Init file written to: $InitFile" -ForegroundColor Green

# 3. Menjalankan HTTP Listener Service (API Bridge)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
    Write-Host "`n[SUCCESS] JIN Local Bridge actively listening on http://localhost:$Port/" -ForegroundColor Green
    Write-Host "[ACCESS LEVEL] FULL READ/WRITE ENABLED FOR DRIVE F:\" -ForegroundColor Cyan
    Write-Host "[INFO] Press CTRL+C in this terminal window to stop the agent bridge.`n" -ForegroundColor Gray

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Enable CORS
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # Handling GET: Status & Read
        if ($request.HttpMethod -eq "GET") {
            $urlPath = $request.Url.LocalPath

            if ($urlPath -eq "/status") {
                $statusPayload = @{
                    status = "ONLINE"
                    targetDrive = "F:\"
                    basePath = $BasePath
                    agent = "JIN-Core"
                    mode = "LOCAL_AIRGAP"
                    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                } | ConvertTo-Json

                $buffer = [System.Text.Encoding]::UTF8.GetBytes($statusPayload)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }

            if ($urlPath -eq "/list") {
                $files = Get-ChildItem -Path $BasePath -Recurse -File | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($files)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
        }

        # Handling POST: Read/Write Request
        if ($request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            
            try {
                $payload = $body | ConvertFrom-Json
                $action = $payload.action # "write" | "read" | "append_log"
                $relPath = $payload.filePath
                $content = $payload.content

                $fullTarget = Join-Path -Path $BasePath -ChildPath $relPath

                # Security check: must remain inside F:\UltimateAI_Memory
                if (-not $fullTarget.StartsWith($BasePath)) {
                    $resJson = @{ success = $false; error = "ACCESS_DENIED: Path must be inside $BasePath" } | ConvertTo-Json
                    $response.StatusCode = 403
                } elseif ($action -eq "read") {
                    if (Test-Path -Path $fullTarget) {
                        $fileContent = Get-Content -Path $fullTarget -Raw -Encoding utf8
                        $resJson = @{ success = $true; content = $fileContent; path = $fullTarget } | ConvertTo-Json
                        $response.StatusCode = 200
                    } else {
                        $resJson = @{ success = $false; error = "FILE_NOT_FOUND" } | ConvertTo-Json
                        $response.StatusCode = 404
                    }
                } elseif ($action -eq "append_log") {
                    $parentDir = Split-Path -Path $fullTarget -Parent
                    if (-not (Test-Path -Path $parentDir)) { New-Item -Path $parentDir -ItemType Directory -Force | Out-Null }
                    
                    $logLine = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $content`r`n"
                    [System.IO.File]::AppendAllText($fullTarget, $logLine, [System.Text.Encoding]::UTF8)
                    $resJson = @{ success = $true; action = "append_log"; path = $fullTarget } | ConvertTo-Json
                    $response.StatusCode = 200
                } else {
                    # Default: Write / Overwrite
                    $parentDir = Split-Path -Path $fullTarget -Parent
                    if (-not (Test-Path -Path $parentDir)) { New-Item -Path $parentDir -ItemType Directory -Force | Out-Null }

                    if ($content -is [string]) {
                        [System.IO.File]::WriteAllText($fullTarget, $content, [System.Text.Encoding]::UTF8)
                    } else {
                        $jsonText = $content | ConvertTo-Json -Depth 10
                        [System.IO.File]::WriteAllText($fullTarget, $jsonText, [System.Text.Encoding]::UTF8)
                    }

                    Write-Host "[+] Wrote file: $relPath" -ForegroundColor Green
                    $resJson = @{ success = $true; action = "write"; path = $fullTarget; timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") } | ConvertTo-Json
                    $response.StatusCode = 200
                }
            } catch {
                $resJson = @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
                $response.StatusCode = 500
            }

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
        }
    }
} catch {
    Write-Host "`n[ERROR] Failed to start listener: $_" -ForegroundColor Red
} finally {
    if ($listener -ne $null) {
        $listener.Stop()
        $listener.Close()
        Write-Host "`n[STOPPED] JIN Local Bridge stopped." -ForegroundColor Yellow
    }
}
