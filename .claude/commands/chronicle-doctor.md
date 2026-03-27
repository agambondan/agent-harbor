---
description: Check Chronicle API health and connectivity status
---

Run Chronicle doctor to verify API health.

1. Call the Chronicle MCP tool `doctor` (no arguments needed)
2. Report the health status of `/healthz` and `/api/v1/status`
3. If any endpoint is unhealthy, suggest troubleshooting steps:
   - Check if the API server is running (`make api-dev` or `make stack-up`)
   - Verify `~/.chronicle/config.json` has the correct `CHRONICLE_API_BASE_URL`
