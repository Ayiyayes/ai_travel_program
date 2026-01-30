#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "[AI-Travel] Starting backend + admin..."

cd ai-travel-photo-app

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[ERROR] pnpm not found. Please install pnpm first."
  exit 1
fi

pnpm install
pnpm run db:push
pnpm run dev

