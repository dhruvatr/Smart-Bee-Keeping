$root = if ($PSScriptRoot) { $PSScriptRoot } else { "D:\projects\portfolio\smart-hive" }
Set-Location -Path $root

Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "Starting Smart Hive: Backend API (8000) & Frontend (3000)" -ForegroundColor Green
Write-Host "Working Directory: $root" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host "`nBoth services started!" -ForegroundColor Green
Write-Host "Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
