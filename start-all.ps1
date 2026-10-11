Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "Starting Smart Hive: Backend API (8000) & Frontend (3000)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; npm run dev"

Write-Host "`nBoth services started!" -ForegroundColor Green
Write-Host "Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
