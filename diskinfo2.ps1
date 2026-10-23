# Detailed cleanup inspection
function Write-Log($msg) { Write-Output $msg }

Write-Log "=== SOFTWARE DISTRIBUTION DOWNLOAD ==="
$sd = "C:\Windows\SoftwareDistribution\Download"
if (Test-Path $sd) {
    $sz = (Get-ChildItem $sd -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Log "SIZE_GB=" + ($sz / 1GB)
    Write-Log "FILE_COUNT=" + (Get-ChildItem $sd -Recurse -ErrorAction SilentlyContinue | Measure-Object { $_.FullName }).Count
    $files = Get-ChildItem $sd -Recurse -ErrorAction SilentlyContinue | Select-Object -First 20 -Property FullName, Length
    foreach ($f in $files) {
        Write-Log "  " + $f.FullName + " " + ([math]::Round($f.Length/1GB,2)) + " GB"
    }
} else {
    Write-Log "Folder tidak ada"
}

Write-Log "=== WIN-SXS (component store) ==="
$wsxs = "C:\Windows\WinSxS"
if (Test-Path $wsxs) {
    $sz = (Get-ChildItem $wsxs -Directory -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Log "DIRECTORY_SIZE_GB=" + ($sz / 1GB)
    $sz2 = (Get-ChildItem $wsxs -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Log "TOTAL_SIZE_GB=" + ($sz2 / 1GB)
    $dlls = Get-ChildItem $wsxs -Recurse -Filter "*.dll" -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
    Write-Log "DLL_COUNT=" + $dlls.Count
}

Write-Log "=== TEMP FOLDERS ==="
$path = $env:TEMP
if (Test-Path $path) {
    $sz = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Log "TEMP[" + $path + "] SIZE_GB=" + ($sz / 1GB)
}
if (Test-Path "C:\Windows\Temp") {
    $sz = (Get-ChildItem "C:\Windows\Temp" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Log "TEMP[C:\Windows\Temp] SIZE_GB=" + ($sz / 1GB)
}

Write-Log "=== PENDING REBOOT / UPDATE STATE ==="
$reg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing" -ErrorAction SilentlyContinue
if ($reg) {
    Write-Log "CBS_RebootPending=" + $reg.RebootPending
}
$reg2 = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update" -ErrorAction SilentlyContinue
if ($reg2) {
    Write-Log "AU_State=" + $reg2.AUState
}

Write-Log "=== C:\ WINDOWS DIRECT SUBDIR SIZE (top) ==="
Get-ChildItem "C:\Windows" -Directory | ForEach-Object {
    $sub = Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
    Write-Log "  " + $_.Name + " SIZE_GB=" + ([math]::Round($sub.Sum/1GB,2))
} | Sort-Object { $_ -replace '\s+','' } -Descending | Select-Object -First 15
