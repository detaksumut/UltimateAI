@echo off
setlocal EnableExtensions
title JIN [LAUNCH] 9Router Image Gateway - MANUAL EXTERNAL
color 0E
cd /d D:\Users\ultimateai

rem ============================================================
rem  9Router Image Gateway : LAUNCHER MANUAL (external)
rem  Baca URL+KEY dari .env (SSOT) - BUKAN hardcode.
rem  START_JIN.bat TIDAK men-spawn 9Router; window ini adalah
rem  cara MANUAL yang benar untuk menjalankan gateway image.
rem ============================================================

set "NINEROUTER_URL="
set "NINEROUTER_KEY="
for /f "usebackq tokens=1,* delims==" %%A in ("D:\Users\ultimateai\.env") do (
    if /i "%%A"=="NINEROUTER_URL" set "NINEROUTER_URL=%%B"
    if /i "%%A"=="NINEROUTER_KEY" set "NINEROUTER_KEY=%%B"
)

if not defined NINEROUTER_URL goto NR_BAD_URL

echo.
echo  ============================================================
echo  9Router Image Gateway URL : %NINEROUTER_URL%
echo  Key                        : [DISEMBUNYIKAN - SSOT .env]
echo  ============================================================
echo.

rem --- Buka UI 9Router di browser (klien gateway external) ---
start "" "!NINEROUTER_URL!/"  2>nul || echo.

echo  [INFO] 9Router dikelola MANUAL/eksternal.
echo         Jika komunitas 9Router menyediakan binari penerima, kamu
echo         jalankan binari milik 9Router di sini / window eksternal.
echo.
echo  Menunggu 9Router benar-benar ONLINE...
:POLL
set "NRGATE_HTTP="
curl.exe -s -o NUL -w "%%{http_code}" --max-time 4 "%NINEROUTER_URL%/v1/models/image" > "%TEMP%\jn_nr_poll.txt"
set /p NRGATE_HTTP=<"%TEMP%\jn_nr_poll.txt"
if "%NRGATE_HTTP%"=="200" goto NR_ONLINE
if "%NRGATE_HTTP%"=="401" goto NR_ONLINE
echo  [poll %TIME%] masih offline (http=%NRGATE_HTTP%)...  tunggu 10 dtk
ping -n 11 127.0.0.1 >NUL
goto POLL

:NR_ONLINE
echo.
echo  ============================================================
echo   [OK] 9Router ONLINE : %NINEROUTER_URL%  (http=%NRGATE_HTTP%)
echo  ============================================================
echo   Sekarang jalankan START_JIN.bat untuk spawn 4 monitor JIN.
echo  ============================================================
echo.
pause
exit /b 0

:NR_BAD_URL
echo.
echo  ============================================================
echo   [FAIL] NINEROUTER_URL TIDAK ditemukan di .env
echo.
echo   Buka D:\Users\ultimateai\.env dan pastikan baris:
echo        NINEROUTER_URL=http://127.0.0.1:^<PORT_9ROUTER^>
echo.
echo   (lihat SSOT .env kamu - JIN tidak menebak port)
echo  ============================================================
pause
exit /b 1
