---
description: Store a fact, decision, preference, lesson, or correction in Chronicle memory
---

Save a memory event to Chronicle for cross-session recall.

1. Parse $ARGUMENTS to extract the memory content
2. Identify the active project ID from Chronicle project binding
3. Call the Chronicle MCP tool `remember` with:
   - `project_id`: the active project ID
   - `title`: a concise title summarizing the memory (generate from content)
   - `content`: the full memory content from $ARGUMENTS
   - `type`: "fact" (default; use "decision" for architecture, "preference" for user style, "lesson"/"correction" for reusable guardrails)
   - `tags`: extract relevant tags from the content (e.g., feature names, component names)
4. Confirm what was stored and the memory type used
