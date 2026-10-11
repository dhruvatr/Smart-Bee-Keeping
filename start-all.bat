@echo off
cd /d "%~dp0"
title Smart Hive Platform Launcher
echo ========================================================
echo Starting Smart Hive: Backend API (8000) ^& Frontend (3000)
echo Working Directory: %~dp0
echo ========================================================

start "Smart Hive Backend API (Port 8000)" cmd /k "cd /d "%~dp0" && python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000"
timeout /t 2 /nobreak > nul
start "Smart Hive Web UI (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers launched!
echo Open dashboard at: http://localhost:3000
echo Backend API docs at: http://localhost:8000/docs
