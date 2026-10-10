#!/usr/bin/env sh
# Expose the local helio stack on a public https URL via cloudflared quick tunnel.
# No account needed. Usage: scripts/tunnel.sh [port]  (default 8787 — the agent
# serves the built PWA too, so one tunnel covers the whole app).
set -eu

PORT="${1:-8787}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  exit 1
fi

if ! curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && \
   ! curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "nothing answering on :${PORT} — start the stack first (npm run dev, SERVE_WEB=1 for prod build)" >&2
  exit 1
fi

echo "→ https://<random>.trycloudflare.com  →  http://127.0.0.1:${PORT}"
exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"
