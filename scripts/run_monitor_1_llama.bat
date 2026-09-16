@echo off
setlocal EnableExtensions EnableDelayedExpansion
title JIN [MONITOR 1] - LLAMA.CPP QWEN 2.5 3B ENGINE :8080
color 0A
cd /d D:\Users\ultimateai

set "SELECTED_MODEL=qwen2.5-3b-instruct-q4_k_m.gguf"
set "MODEL_PATH=D:\Users\ultimateai\runtimes\llama.cpp\models\%SELECTED_MODEL%"

REM ============================================================
REM 1. DETEKSI DUKUNGAN CPU THREAD & CORE SECARA DINAMIS
REM ============================================================
set "DETECTED_PROCESSORS=%NUMBER_OF_PROCESSORS%"
if "%DETECTED_PROCESSORS%"=="" set "DETECTED_PROCESSORS=4"

REM Hitung alokasi thread:
REM - Threads Gen (Inference): Optimal pada jumlah Physical Cores untuk mencegah L3 cache contention
REM   Untuk CPU Hyper-Threading (mis. 8 logical threads), gunakan DETECTED / 2.
set /a GEN_THREADS=%DETECTED_PROCESSORS% / 2
if %GEN_THREADS% LSS 2 set /a GEN_THREADS=2
if %GEN_THREADS% GTR 8 set /a GEN_THREADS=8

REM - Threads Batch (Prompt Ingestion): Memanfaatkan lebih banyak throughput thread
set /a BATCH_THREADS=%DETECTED_PROCESSORS% - 2
if %BATCH_THREADS% LSS %GEN_THREADS% set /a BATCH_THREADS=%GEN_THREADS%
if %BATCH_THREADS% GTR 12 set /a BATCH_THREADS=12

set /a HTTP_THREADS=2
if %DETECTED_PROCESSORS% LEQ 2 set /a HTTP_THREADS=1

REM Dukung custom override dari environment (.env atau shell)
if not "%LLAMACPP_THREADS%"=="" set "GEN_THREADS=%LLAMACPP_THREADS%"
if not "%LLAMACPP_THREADS_BATCH%"=="" set "BATCH_THREADS=%LLAMACPP_THREADS_BATCH%"
if not "%LLAMACPP_THREADS_HTTP%"=="" set "HTTP_THREADS=%LLAMACPP_THREADS_HTTP%"

REM ============================================================
REM 2. KONFIGURASI CONTEXT WINDOW (32768 SINKRON DENGAN QWEN 2.5)
REM ============================================================
set "CTX_SIZE=32768"
if not "%LLAMACPP_CTX_SIZE%"=="" set "CTX_SIZE=%LLAMACPP_CTX_SIZE%"

REM ============================================================
REM 3. EVALUASI GPU OFFLOAD
REM ============================================================
REM Evaluasi Hardware: Intel UHD Graphics 620 + Radeon 530 (GCN 3.0 / 2GB)
REM Backend CUDA: Tidak tersedia (Bukan GPU Nvidia)
REM Backend ROCm Windows: Tidak mendukung GCN 3.0
REM Hasil Evaluasi: CPU Native AVX2 Mode adalah jalur optimal & paling stabil.
set "GPU_STATUS=CPU AVX2 Native (Hardware GPU tidak mendukung CUDA/ROCm)"

echo ============================================================
echo   [MONITOR 1] LLAMA.CPP HIGH-SPEED INFERENCE ENGINE
echo ============================================================
echo   Host / Port      : 127.0.0.1:8080
echo   Model Aktif      : Qwen 2.5 3B Instruct (Ultra Fast CPU)
echo   Model Path       : %MODEL_PATH%
echo   CPU Logical      : %DETECTED_PROCESSORS% Processors
echo   Threads Gen      : %GEN_THREADS% Cores (Auto-detected dynamic)
echo   Threads Batch    : %BATCH_THREADS% Cores (Auto-detected dynamic)
echo   Threads HTTP     : %HTTP_THREADS% Cores
echo   Context Window   : %CTX_SIZE% Tokens (Native Qwen 2.5 Context)
echo   GPU Offload      : %GPU_STATUS%
echo   Batch / UBatch   : 512 / 256
echo ============================================================
echo.

D:\Users\ultimateai\runtimes\llama.cpp\bin\llama-server.exe ^
  --model "%MODEL_PATH%" ^
  --host 127.0.0.1 ^
  --port 8080 ^
  --threads %GEN_THREADS% ^
  --threads-batch %BATCH_THREADS% ^
  --threads-http %HTTP_THREADS% ^
  --ctx-size %CTX_SIZE% ^
  --batch-size 512 ^
  --ubatch-size 256 ^
  --parallel 1 ^
  --cont-batching

echo.
echo ============================================================
echo [MONITOR 1] Llama-server telah berhenti (Exit Code: %errorlevel%).
echo ============================================================
pause
