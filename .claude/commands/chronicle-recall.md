---
description: Search Chronicle memories for past guardrails, decisions, facts, or preferences
---

Search Chronicle's memory store for relevant past context.

1. Identify the active project ID from Chronicle project binding
2. Call the Chronicle MCP tool `recall` with:
   - `project_id`: the active project ID
   - `query`: $ARGUMENTS (the user's recall query)
   - `limit`: 10
3. Present matching memories with their type, title, content, and tags
4. If no memories found, suggest using `/chronicle-remember` to store new memories
