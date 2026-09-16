@echo off
setlocal EnableExtensions
title ULTIMATEAI JIN - MASTER START
color 0F

cd /d D:\Users\ultimateai

rem ============================================================
rem ============================================================
rem
rem              ULTIMATEAI JIN MASTER START
rem
rem  9Router:
rem    - SUDAH BERJALAN SECARA EKSTERNAL
rem    - TIDAK DI-START OLEH BAT INI
rem    - TIDAK DI-STOP OLEH BAT INI
rem    - HANYA DI-CHECK / DIGUNAKAN SEBAGAI GATEWAY
rem
rem ============================================================
rem ============================================================

set "NINEROUTER_URL=http://localhost:20128"

echo.
echo ============================================================
echo                 ULTIMATEAI JIN
echo                 MASTER START
echo ============================================================
echo.
echo   Checking external 9Router...
echo   Gateway : %NINEROUTER_URL%
echo.

rem ============================================================
rem 9ROUTER CHECK ONLY
rem ============================================================

set "NR_HTTP="

curl.exe -s -o nul -w "%%{http_code}" --max-time 5 ^
 "%NINEROUTER_URL%/v1/models/image" ^
 > "%TEMP%\jin_9router_check.txt" 2>nul

set /p NR_HTTP=<"%TEMP%\jin_9router_check.txt"

del /q "%TEMP%\jin_9router_check.txt" >nul 2>&1

rem ------------------------------------------------------------
rem 200 = gateway hidup dan endpoint dapat diakses
rem 401 = gateway hidup tetapi membutuhkan API key
rem ------------------------------------------------------------

if "%NR_HTTP%"=="200" goto NINEROUTER_OK
if "%NR_HTTP%"=="401" goto NINEROUTER_OK

goto NINEROUTER_FAIL


:NINEROUTER_FAIL

echo.
echo ============================================================
echo              [FAIL] 9ROUTER TIDAK AKTIF
echo ============================================================
echo.
echo   Gateway : %NINEROUTER_URL%
echo   HTTP    : %NR_HTTP%
echo.
echo   START_JIN TIDAK AKAN MENJALANKAN 9Router.
echo.
echo   9Router harus tersedia terlebih dahulu.
echo.
echo ============================================================
echo.
pause
exit /b 1


:NINEROUTER_OK

echo.
echo ============================================================
echo              [PASS] 9ROUTER TERDETEKSI
echo ============================================================
echo.
echo   Gateway : %NINEROUTER_URL%
echo   HTTP    : %NR_HTTP%
echo.
echo   Melanjutkan startup UltimateAI JIN...
echo.


rem ============================================================
rem [1/4] LLAMA.CPP
rem ============================================================

echo [1/4] Membuka MONITOR 1 - Llama.cpp Qwen :8080

start "JIN [MONITOR 1] - LLAMA.CPP :8080" ^
cmd.exe /k "D:\Users\ultimateai\scripts\run_monitor_1_llama.bat"


rem ============================================================
rem [2/4] COMFYUI
rem ============================================================

echo [2/4] Membuka MONITOR 2 - ComfyUI :8188

start "JIN [MONITOR 2] - COMFYUI :8188" ^
cmd.exe /k "D:\Users\ultimateai\scripts\run_monitor_2_comfyui.bat"


rem ============================================================
rem [3/4] BACKEND
rem ============================================================

echo [3/4] Membuka MONITOR 3 - Backend :20200

start "JIN [MONITOR 3] - BACKEND :20200" ^
cmd.exe /k "D:\Users\ultimateai\scripts\run_monitor_3_backend.bat"


rem ============================================================
rem [4/4] FRONTEND
rem ============================================================

echo [4/4] Membuka MONITOR 4 - Frontend :5177

start "JIN [MONITOR 4] - FRONTEND :5177" ^
cmd.exe /k "D:\Users\ultimateai\scripts\run_monitor_4_frontend.bat"


rem ============================================================
rem DASHBOARD
rem ============================================================

echo.
echo ============================================================
echo              ULTIMATEAI JIN READY
echo ============================================================
echo.
echo   [9ROUTER] External Gateway
echo              %NINEROUTER_URL%
echo.
echo   [MONITOR 1] Llama.cpp Qwen
echo              http://localhost:8080
echo.
echo   [MONITOR 2] ComfyUI
echo              http://localhost:8188
echo.
echo   [MONITOR 3] Backend Router
echo              http://localhost:20200
echo.
echo   [MONITOR 4] Frontend
echo              http://localhost:5177
echo.
echo   [JIN]      Simulator
echo              http://localhost:5177/simulator
echo.
echo ============================================================
echo.
echo   9Router TIDAK dikontrol oleh START_JIN.bat.
echo   9Router hanya digunakan sebagai external image gateway.
echo.
echo   CMD monitor tetap terbuka untuk kontrol dan log.
echo ============================================================
echo.


rem ============================================================
rem OPEN ULTIMATEAI SIMULATOR
rem ============================================================

start "" "http://localhost:5177/simulator"

pause