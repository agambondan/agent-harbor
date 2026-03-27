#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-4317}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/auth/status"

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "Agent Harbor already running on $HEALTH_URL"
  exit 0
fi

PORT_PIDS=""
if command -v lsof >/dev/null 2>&1; then
  PORT_PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
elif command -v ss >/dev/null 2>&1; then
  PORT_PIDS="$(ss -ltnp 2>/dev/null | awk -v port=":$PORT" '$4 ~ port {print $NF}' | sed -E 's/.*pid=([0-9]+).*/\1/' | sort -u | tr '\n' ' ')"
fi

if [[ -n "${PORT_PIDS// }" ]]; then
  echo "Port $PORT is already in use by PID(s): $PORT_PIDS"
  echo "Refusing to start a second server on the same port."
  exit 1
fi

cd "$ROOT_DIR"
exec node src/server.mjs
