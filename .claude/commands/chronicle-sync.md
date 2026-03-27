---
description: Sync local repository to Chronicle index
---

Scan the local repository and queue an ingest job to update Chronicle's search index.

1. Identify the active project ID from Chronicle project binding
2. Call the Chronicle MCP tool `sync` with:
   - `project_id`: the active project ID
   - `root_path`: "." (current repo root)
3. Report the ingest job status
4. Remind the user that indexing runs asynchronously — search results may take a moment to reflect new changes
