Write-Host "Killing existing llama-server processes..."
Get-Process -Name "llama-server" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host ("Stopping PID " + $_.Id + " (" + $_.ProcessName + ")")
    Stop-Process -Id $_.Id -Force
}
Start-Sleep -Seconds 2
Write-Host "Remaining llama-server processes:"
Get-Process -Name "llama-server" -ErrorAction SilentlyContinue | Select-Object Id, ProcessName
