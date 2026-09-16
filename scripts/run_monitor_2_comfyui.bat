@echo off
title JIN [MONITOR 2] - COMFYUI CPU :8188
color 0B
cd /d D:\Users\ultimateai\ComfyUI

echo ============================================================
echo   [MONITOR 2] COMFYUI CPU IMAGE GENERATION ENGINE
echo   Port     : 8188 (http://127.0.0.1:8188)
echo   Mode     : CPU (--cpu --disable-auto-launch)
echo   Status   : Protected Environment Untouched
echo ============================================================
echo.

if exist "D:\Users\ultimateai\ComfyUI\venv\Scripts\python.exe" (
    "D:\Users\ultimateai\ComfyUI\venv\Scripts\python.exe" main.py --cpu --listen 127.0.0.1 --port 8188 --disable-auto-launch
) else (
    python main.py --cpu --listen 127.0.0.1 --port 8188 --disable-auto-launch
)

echo.
echo ============================================================
echo [MONITOR 2] ComfyUI telah berhenti (Exit Code: %errorlevel%).
echo ============================================================
pause
