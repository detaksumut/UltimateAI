# Disk usage report
$drive = Get-PSDrive C
Write-Output "TOTAL_GB=" + ($drive.Total / 1GB)
Write-Output "FREE_GB=" + ($drive.Free / 1GB)
Write-Output "USED_GB=" + ($drive.Used / 1GB)

# Windows version
$os = Get-CimInstance Win32_OperatingSystem
Write-Output "OS=" + $os.Caption
Write-Output "BUILD=" + $os.BuildNumber
Write-Output "LASTBOOT=" + $os.ConvertToDateTime($os.LastBootUpTime)

# Check Windows Update service status
$wu = Get-Service -Name wuauserv -ErrorAction SilentlyContinue
if ($wu) {
    Write-Output "WUASUERV_STATUS=" + $wu.Status
    Write-Output "WUASUERV_START=" + $wu.StartType
}
$bits = Get-Service -Name BITS -ErrorAction SilentlyContinue
if ($bits) {
    Write-Output "BITS_STATUS=" + $bits.Status
}
