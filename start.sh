#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "[AI-Travel] Starting backend + admin..."

cd ai-travel-photo-app

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    echo "[AI-Travel] pnpm not found. Installing via corepack..."
    corepack enable
    corepack prepare pnpm@10.4.1 --activate
  else
    echo "[ERROR] pnpm not found and corepack is unavailable. Please install pnpm first."
    exit 1
  fi
fi

node scripts/init-env.mjs

pnpm install
pnpm run db:push
pnpm run dev
