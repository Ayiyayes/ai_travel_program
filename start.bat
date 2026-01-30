@echo off
setlocal

cd /d "%~dp0"
echo [AI-Travel] Starting backend + admin...

cd ai-travel-photo-app

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pnpm not found. Please install pnpm first.
  exit /b 1
)

pnpm install
pnpm run db:push
pnpm run dev

