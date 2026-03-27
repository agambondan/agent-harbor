---
description: Search ingested code chunks using Chronicle retrieval
---

Search Chronicle's indexed codebase for the user's query.

1. Identify the active project ID from the Chronicle project binding (check `~/.chronicle/config.json` or use `list_projects` if unknown)
2. Call the Chronicle MCP tool `search` with:
   - `project_id`: the active project ID
   - `query`: $ARGUMENTS (the user's search query)
   - `mode`: "hybrid" (default, combines keyword + semantic)
   - `limit`: 10
3. Present the results showing file paths, line ranges, and matching content
4. If no results found, suggest running `/chronicle-sync` first to ensure the index is current
