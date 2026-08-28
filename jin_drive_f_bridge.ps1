<#
 ====================================================================
  UltimateAI - JIN Active Memory Core & Event Daemon (Drive F:\)
  Operator: Rahman (Enterprise Admin)
  Target: F:\UltimateAI_Memory
  Port: 8080
 ====================================================================
#>

$BasePath = "F:\UltimateAI_Memory"
$Port = 8080

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [JIN AGENT] Active Memory Core Node (Drive F:\)    " -ForegroundColor Magenta
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Pastikan Struktur Folder Memori Lokal
$Folders = @(
    "$BasePath\01_Logs",
    "$BasePath\02_Documentation",
    "$BasePath\02_Documentation\Backups",
    "$BasePath\03_AgentState",
    "$BasePath\04_Outputs",
    "$BasePath\05_Vault"
)

foreach ($folder in $Folders) {
    if (-not (Test-Path -Path $folder)) {
        New-Item -Path $folder -ItemType Directory -Force | Out-Null
        Write-Host "[+] Directory created: $folder" -ForegroundColor Green
    } else {
        Write-Host "[=] Directory active: $folder" -ForegroundColor Yellow
    }
}

# 2. In-Memory Event Ring Buffer & Debounce Cache
$global:EventBuffer = [System.Collections.ArrayList]::new()
$global:DebounceCache = @{}
$global:MaxEvents = 50

function Add-MemoryEvent {
    param(
        [string]$Path,
        [string]$EventType,
        [string]$Severity = "NORMAL"
    )

    $now = Get-Date
    $key = "$Path-$EventType"

    # Debounce: abaikan event duplikat dalam kurun 500ms
    if ($global:DebounceCache.ContainsKey($key)) {
        $lastTime = $global:DebounceCache[$key]
        if (($now - $lastTime).TotalMilliseconds -lt 500) {
            return
        }
    }
    $global:DebounceCache[$key] = $now

    # Tentukan Severity
    $relPath = $Path.Replace($BasePath, "").TrimStart("\")
    if ($relPath.StartsWith("05_Vault")) {
        $Severity = "HIGH"
    } elseif ($relPath.StartsWith("03_AgentState")) {
        $Severity = "NORMAL"
    } elseif ($relPath.StartsWith("01_Logs")) {
        $Severity = "LOW"
    }

    $eventObj = [PSCustomObject]@{
        eventId = "evt_$(Get-Date -Format 'yyyyMMddHHmmssfff')_$([System.IO.Path]::GetRandomFileName().Substring(0,4))"
        path = $relPath
        fullPath = $Path
        eventType = $EventType
        severity = $Severity
        timestamp = $now.ToString("yyyy-MM-dd HH:mm:ss")
        source = "FileSystemWatcher.DriveF"
    }

    [void]$global:EventBuffer.Add($eventObj)
    if ($global:EventBuffer.Count -gt $global:MaxEvents) {
        $global:EventBuffer.RemoveAt(0)
    }

    $color = switch ($Severity) {
        "HIGH" { "Yellow" }
        "CRITICAL" { "Red" }
        "NORMAL" { "Cyan" }
        Default { "DarkGray" }
    }
    Write-Host "[EVENT: $Severity] $EventType ➔ $relPath" -ForegroundColor $color
}

# 3. Setup FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $BasePath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, DirectoryName'

# Register Watcher Events
Register-ObjectEvent $watcher "Created" -Action { Add-MemoryEvent $Event.SourceEventArgs.FullPath "CREATED" } | Out-Null
Register-ObjectEvent $watcher "Changed" -Action { Add-MemoryEvent $Event.SourceEventArgs.FullPath "CHANGED" } | Out-Null
Register-ObjectEvent $watcher "Deleted" -Action { Add-MemoryEvent $Event.SourceEventArgs.FullPath "DELETED" } | Out-Null
Register-ObjectEvent $watcher "Renamed" -Action { Add-MemoryEvent $Event.SourceEventArgs.FullPath "RENAMED" } | Out-Null

Write-Host "[+] Active FileSystemWatcher attached to $BasePath" -ForegroundColor Green

# 4. Menulis State Inisialisasi
$InitFile = "$BasePath\03_AgentState\bridge_status.json"
$InitData = @{
    agent = "JIN-UltimateAI"
    operator = "Rahman"
    drive = "F:\"
    permissions = "READ_WRITE"
    status = "CONNECTED"
    watcher = "ACTIVE"
    storage_mode = "LOCAL_AIRGAP_ACTIVE_MEMORY"
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json

$InitData | Out-File -FilePath $InitFile -Encoding utf8

# 5. HTTP Listener Service
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
    Write-Host "`n[SUCCESS] Active Memory Daemon running on http://localhost:$Port/" -ForegroundColor Green
    Write-Host "[CHANNELS] REST + Event Stream (/events, /status, /health, /list)" -ForegroundColor Cyan
    Write-Host "[INFO] Press CTRL+C to stop the active memory daemon.`n" -ForegroundColor Gray

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # GET Handling
        if ($request.HttpMethod -eq "GET") {
            $urlPath = $request.Url.LocalPath

            if ($urlPath -eq "/status") {
                $statusPayload = @{
                    status = "ONLINE"
                    targetDrive = "F:\"
                    basePath = $BasePath
                    agent = "JIN-Core"
                    mode = "LOCAL_AIRGAP_ACTIVE_MEMORY"
                    watcher = "ACTIVE"
                    eventCount = $global:EventBuffer.Count
                    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                } | ConvertTo-Json

                $buffer = [System.Text.Encoding]::UTF8.GetBytes($statusPayload)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }

            if ($urlPath -eq "/health") {
                $vaultFiles = (Get-ChildItem -Path "$BasePath\05_Vault" -Filter *.json -ErrorAction SilentlyContinue).Count
                $healthPayload = @{
                    status = "HEALTHY"
                    drive = "F:\"
                    vaultRecords = $vaultFiles
                    watcherAlive = $true
                    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                } | ConvertTo-Json

                $buffer = [System.Text.Encoding]::UTF8.GetBytes($healthPayload)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }

            if ($urlPath -eq "/events") {
                $eventsPayload = $global:EventBuffer | ConvertTo-Json
                if (-not $eventsPayload) { $eventsPayload = "[]" }

                $buffer = [System.Text.Encoding]::UTF8.GetBytes($eventsPayload)
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

        # POST Handling
        if ($request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            
            try {
                $payload = $body | ConvertFrom-Json
                $action = $payload.action
                $relPath = $payload.filePath
                $content = $payload.content

                $fullTarget = Join-Path -Path $BasePath -ChildPath $relPath

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
                    $parentDir = Split-Path -Path $fullTarget -Parent
                    if (-not (Test-Path -Path $parentDir)) { New-Item -Path $parentDir -ItemType Directory -Force | Out-Null }

                    if ($content -is [string]) {
                        [System.IO.File]::WriteAllText($fullTarget, $content, [System.Text.Encoding]::UTF8)
                    } else {
                        $jsonText = $content | ConvertTo-Json -Depth 10
                        [System.IO.File]::WriteAllText($fullTarget, $jsonText, [System.Text.Encoding]::UTF8)
                    }

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
    }
    if ($watcher -ne $null) {
        $watcher.EnableRaisingEvents = $false
        $watcher.Dispose()
    }
    Write-Host "`n[STOPPED] JIN Active Memory Bridge stopped." -ForegroundColor Yellow
}
