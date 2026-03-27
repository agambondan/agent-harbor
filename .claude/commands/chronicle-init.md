---
description: Initialize Chronicle session with health check, binding, and initial context
---

Initialize a Chronicle session for this conversation.

1. Call the Chronicle MCP tool `init` (or `session_init`) with:
   - `user_message`: $ARGUMENTS (optional, the user's first task/question for semantic context)
   - `search_limit`: 4
   - `memory_limit`: 4
   - `max_chars`: 3000
2. Report:
   - API health status
   - Active project binding
   - Accessible projects count
   - Initial context pack (if user_message provided)
3. If health check fails, suggest running `/chronicle-doctor` for detailed diagnostics
