#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-4317}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/auth/status"

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  if command -v lsof >/dev/null 2>&1; then
    PORT_PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${PORT_PIDS// }" ]]; then
      echo "$PORT_PIDS" | xargs kill
      sleep 1
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
    sleep 1
  else
    pkill -f 'node src/server.mjs' || true
    sleep 1
  fi
fi

exec "$ROOT_DIR/scripts/start-safe.sh"
