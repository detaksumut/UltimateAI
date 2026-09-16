@echo off
:: ============================================================================
:: PEMBERSIH DRIVE C: (AUTO-ELEVATE ADMINISTRATOR)
:: ============================================================================
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo [!] Meminta hak akses Administrator...
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "cmd.exe", "/k """"%~s0""""", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B
)

pushd "%CD%"
CD /D "%~dp0"

title PEMBERSIH DRIVE C: (ADMINISTRATOR)
color 0A
cls
echo =======================================================================
echo          SEDANG MEMBERSIHKAN FILE SAMPAH SISTEM DRIVE C:
echo =======================================================================
echo.

echo [1/4] Menghentikan service Update sementara...
net stop wuauserv /y >nul 2>&1
net stop bits /y >nul 2>&1

echo [2/4] Membersihkan Cache Download Update...
del /f /s /q "C:\Windows\SoftwareDistribution\Download\*" >nul 2>&1

echo [3/4] Menyalakan kembali service Update...
net start bits >nul 2>&1
net start wuauserv >nul 2>&1

echo [4/4] Menghapus Temp, Prefetch, dan Error Reports...
del /f /s /q "C:\Windows\Temp\*" >nul 2>&1
del /f /s /q "C:\Windows\Prefetch\*" >nul 2>&1
del /f /s /q "C:\tmp\*" >nul 2>&1
del /f /s /q "C:\ProgramData\Microsoft\Windows\WER\ReportArchive\*" >nul 2>&1
del /f /s /q "C:\ProgramData\Microsoft\Windows\WER\ReportQueue\*" >nul 2>&1

echo.
echo =======================================================================
echo                  PEMBERSIHAN CEPAT SELESAI!
echo =======================================================================
echo.
set /p runDism="Ingin menjalankan DISM Component Cleanup untuk memangkas cadangan update WinSxS? (Y/N, butuh 3-5 menit): "
if /i "%runDism%"=="Y" (
    echo.
    echo Menjalankan DISM Component Cleanup...
    dism.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase
)

echo.
echo Selesai! Tekan sembarang tombol untuk keluar...
pause >nul
