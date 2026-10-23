# update_cf_token.ps1
# Rotasi CLOUDFLARE_API_TOKEN di .env dari clipboard — TANPA menampilkan token.
# Cara pakai:
#   1. Di dashboard Cloudflare, klik ikon copy pada token baru (token masuk clipboard).
#   2. Jalankan:  powershell -ExecutionPolicy Bypass -File update_cf_token.ps1
#   3. Balas "Token sudah diperbarui" di chat Antigravity.

$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'

if (-not (Test-Path $envPath)) { Write-Host 'ERROR: .env tidak ditemukan di direktori proyek.'; exit 1 }

# 1. Baca token dari clipboard
$tok = (Get-Clipboard -Raw).Trim()

# 2. Validasi format (tanpa mencetak nilai)
if ($tok -notmatch '^cfut_[A-Za-z0-9_-]+$') {
    Write-Host 'ERROR: Clipboard bukan token Cloudflare yang valid (harus diawali cfut_ lalu alphanumeric/underscore/dash). Kosongkan clipboard lalu copy ulang token dari dashboard.'
    exit 1
}
if ($tok.Length -lt 30 -or $tok.Length -gt 80) {
    Write-Host ("ERROR: Panjang token tidak wajar (" + $tok.Length + " karakter). Pastikan token sudah di-copy penuh dari dashboard.")
    exit 1
}

# 3. Backup .env (ditimpa, tetap ter-ignore git via pola *.bak)
Copy-Item $envPath ($envPath + '.bak') -Force

# 4. Ganti baris CLOUDFLARE_API_TOKEN (tanpa mencetak nilai)
$lines = Get-Content $envPath
$found = $false
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^CLOUDFLARE_API_TOKEN=') {
        $lines[$i] = 'CLOUDFLARE_API_TOKEN=' + $tok
        $found = $true
        break
    }
}
if (-not $found) { $lines += 'CLOUDFLARE_API_TOKEN=' + $tok }
$lines | Set-Content $envPath

# 5. Konfirmasi aman: hanya prefix dan panjang
Write-Host ("OK: CLOUDFLARE_API_TOKEN diperbarui. prefix=" + $tok.Substring(0, 8) + "*** panjang=" + $tok.Length + " backup=.env.bak")
exit 0
