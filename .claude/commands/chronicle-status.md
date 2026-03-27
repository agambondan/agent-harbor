---
description: Show Chronicle project and workspace status
---

Show current Chronicle workspace and project information.

1. Call the Chronicle MCP tool `list_projects` to get all accessible projects
2. Call the Chronicle MCP tool `list_workspaces` to get workspace info
3. Check `~/.chronicle/config.json` for the active project binding
4. Present a summary:
   - Active workspace(s)
   - All accessible projects with their IDs
   - Which project is currently bound to this repo
   - API base URL being used
