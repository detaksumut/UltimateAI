if (-not (Test-Path 'D:\Users\ultimateai\_RESET_QUARANTINE')) {
    New-Item -ItemType Directory -Path 'D:\Users\ultimateai\_RESET_QUARANTINE' -Force | Out-Null
}

# 1. Save uncommitted diff
git diff HEAD > 'D:\Users\ultimateai\_RESET_QUARANTINE\git_uncommitted_diff.patch'

# 2. Save git status
git status > 'D:\Users\ultimateai\_RESET_QUARANTINE\git_status_snapshot.txt'

# 3. Create backup branch
try {
    git branch -D backup-pre-clean-reset 2>&1 | Out-Null
} catch {}
git branch backup-pre-clean-reset 2>&1 | Out-Null

Write-Output "Snapshot completed in _RESET_QUARANTINE"
