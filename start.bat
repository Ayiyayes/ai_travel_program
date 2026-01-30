@echo off
setlocal

cd /d "%~dp0"
echo [AI-Travel] Starting backend + admin...

cd ai-travel-photo-app

where pnpm >nul 2>nul
if errorlevel 1 (
  where corepack >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] pnpm not found and corepack is unavailable. Please install pnpm first.
    exit /b 1
  )
  echo [AI-Travel] pnpm not found. Installing via corepack...
  corepack enable
  corepack prepare pnpm@10.4.1 --activate
)

node scripts/init-env.mjs

pnpm install
pnpm run db:push
pnpm run dev
