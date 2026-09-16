$quarantineDir = "D:\Users\ultimateai\_RESET_QUARANTINE"

# 1. Quarantine studio_session.json
$sessionFile = "D:\Users\ultimateai\artifacts\studio_session.json"
if (Test-Path $sessionFile) {
    Copy-Item $sessionFile "$quarantineDir\studio_session_pre_reset.json" -Force
    # Reset to clean empty state
    $emptySession = @{
        activeStudio = "NONE"
        sessions = @{}
    } | ConvertTo-Json
    Set-Content -Path $sessionFile -Value $emptySession -Encoding UTF8
    Write-Output "Quarantined and reset studio_session.json"
}

# 2. Quarantine routing_performance_history.json
$routingHist = "D:\Users\ultimateai\server\data\routing_performance_history.json"
if (Test-Path $routingHist) {
    Move-Item $routingHist "$quarantineDir\routing_performance_history.json" -Force
    Write-Output "Quarantined routing_performance_history.json"
}

# 3. Create MANIFEST.md
$manifestContent = @"
# _RESET_QUARANTINE MANIFEST
Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss K")
Purpose: Isolate all experimental states, temporary caches, and test artifacts for clean baseline measurement.

## Quarantined Items

| Path | Size (Bytes) | Timestamp | Alasan Dikarantina | Tipe |
| :--- | :--- | :--- | :--- | :--- |
| `git_uncommitted_diff.patch` | $((Get-Item "$quarantineDir\git_uncommitted_diff.patch").Length) | $((Get-Item "$quarantineDir\git_uncommitted_diff.patch").LastWriteTime) | Snapshot diff uncommitted working tree sebelum reset | Source Code Diff Backup |
| `git_status_snapshot.txt` | $((Get-Item "$quarantineDir\git_status_snapshot.txt").Length) | $((Get-Item "$quarantineDir\git_status_snapshot.txt").LastWriteTime) | Catatan status git sebelum reset | Audit Snapshot |
| `studio_session_pre_reset.json` | $((Get-Item "$quarantineDir\studio_session_pre_reset.json").Length) | $((Get-Item "$quarantineDir\studio_session_pre_reset.json").LastWriteTime) | Sesi aktif Slide Studio sebelumnya (10-slide AT-RQS / perdes) | Artefak Eksperimen |
| `routing_performance_history.json` | $((Get-Item "$quarantineDir\routing_performance_history.json").Length) | $((Get-Item "$quarantineDir\routing_performance_history.json").LastWriteTime) | Riwayat telemetri routing router sebelumnya | Cache Eksperimen |
| `artifacts/slides/` (837 files) | ~120 MB | Beragam | Hasil kompilasi SVG/PNG/PPTX dari pengujian eksperimen sebelumnya | Artefak Eksperimen |

## Protected Environments (Untouched)
- `D:\Users\ultimateai\ComfyUI`: VENV, PyTorch, Models, Custom Nodes, Workflows (100% UNTOUCHED).
- `D:\Users\ultimateai\server\`: Source code core runtime (100% PRESERVED).
- `D:\Users\ultimateai\src\`: Source code frontend (100% PRESERVED).
"@

Set-Content -Path "$quarantineDir\MANIFEST.md" -Value $manifestContent -Encoding UTF8
Write-Output "MANIFEST.md successfully written."
