---
description: Build a context pack from Chronicle search + memory for the current task
---

Build a combined context pack from code search and memory results.

1. Identify the active project ID from Chronicle project binding
2. Call the Chronicle MCP tool `context` (or `context_build`) with:
   - `project_id`: the active project ID
   - `query`: $ARGUMENTS (the user's task or question)
   - `search_limit`: 4
   - `memory_limit`: 4
   - `max_chars`: 3000
3. Present the context pack showing:
   - Relevant code snippets found via search
   - Relevant memories and guardrails (lessons, corrections, decisions, facts, preferences)
4. Use this context to inform subsequent work in the conversation
