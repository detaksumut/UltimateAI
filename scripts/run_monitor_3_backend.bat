@echo off
title JIN [MONITOR 3] - BACKEND ROUTER :20200
color 0E
cd /d D:\Users\ultimateai

echo ============================================================
echo   [MONITOR 3] JIN BACKEND LOCAL ROUTER
echo   Port     : 20200 (http://127.0.0.1:20200)
echo   Router   : server\local_router\LocalRouterServer.mjs
echo   LLM Host : LLAMA_CPP (Qwen 2.5 3B @ :8080)
echo ============================================================
echo.

node server\local_router\LocalRouterServer.mjs

echo.
echo ============================================================
echo [MONITOR 3] Backend router telah berhenti (Exit Code: %errorlevel%).
echo ============================================================
pause
