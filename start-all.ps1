# ============================================
# Contract Approval System - Startup Script
# ============================================

$ErrorActionPreference = "Continue"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Starting Contract Approval System..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Backend ---
Write-Host "[1/3] Starting Backend API Server..." -ForegroundColor Yellow
$backendDir = Join-Path $ROOT "backend"

$backendProcess = Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $backendDir -PassThru -WindowStyle Normal
Write-Host "  STARTED: Backend API (PID: $($backendProcess.Id))" -ForegroundColor Green
Write-Host "  URL: http://localhost:5000" -ForegroundColor Gray

Start-Sleep -Seconds 2

# --- 2. Admin Dashboard ---
Write-Host ""
Write-Host "[2/3] Starting Admin Dashboard (Vite)..." -ForegroundColor Yellow
$adminDir = Join-Path $ROOT "admin-dashboard-vite"

$adminProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $adminDir -PassThru -WindowStyle Normal
Write-Host "  STARTED: Admin Server (PID: $($adminProcess.Id))" -ForegroundColor Green
Write-Host "  URL: http://localhost:5173" -ForegroundColor Gray

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

# --- 3. Employee PWA ---
Write-Host ""
Write-Host "[3/3] Starting Employee PWA..." -ForegroundColor Yellow
$pwaDir = Join-Path $ROOT "employee-pwa"

$pwaProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $pwaDir -PassThru -WindowStyle Normal
Write-Host "  STARTED: Employee PWA (PID: $($pwaProcess.Id))" -ForegroundColor Green
Write-Host "  URL: http://localhost:5174" -ForegroundColor Gray

Start-Sleep -Seconds 2
Start-Process "http://localhost:5174"

# --- Wait ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ALL SERVICES STARTED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Press ENTER to stop all services..." -ForegroundColor Yellow
Read-Host

# Cleanup
Write-Host "Stopping services..." -ForegroundColor Yellow
try { Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Id $adminProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Id $pwaProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
Write-Host "DONE." -ForegroundColor Green
