# API Reference

This document describes the current HTTP API exposed by Agent Harbor.

Base URL:

```text
http://127.0.0.1:4317
```

All API routes live under `/api`.

## Auth Behavior

Routes that mutate configuration or inspect homes require the local Agent Harbor admin session.

Protected routes:

- `GET /api/config`
- `PUT /api/config`
- `GET /api/account-setup`
- `POST /api/account-setup/prepare`
- `POST /api/account-setup/launch`
- `POST /api/account-setup/settings`
- `POST /api/launchers/install`
- `POST /api/extensions/sync`
- `GET /api/health`
- `GET /api/homes`
- `POST /api/homes/archive`
- `GET /api/sessions`
- `POST /api/sessions/import`
- `POST /api/sessions/share-current`
- `POST /api/repair/home`
- `POST /api/repair/all`
- `POST /api/history/restore-shared`

If the admin user has not been created yet, protected routes return `403`.

If the admin user exists but the browser is not logged in, protected routes return `401`.

## `GET /api/auth/status`

Returns current UI auth state.

Example response:

```json
{
  "configured": false,
  "authenticated": false,
  "username": null,
  "appName": "Agent Harbor"
}
```

## `POST /api/auth/setup`

Creates the first and only local admin account.

Request body:

```json
{
  "username": "admin",
  "password": "strong-password"
}
```

Validation:

- `username` must be non-empty
- `password` must be at least 8 characters

Success response:

```json
{
  "ok": true,
  "username": "admin"
}
```

Side effects:

- stores admin credentials in `storage/app-config.json`
- sets the signed session cookie

## `POST /api/auth/login`

Logs in with the previously created admin account.

Request body:

```json
{
  "username": "admin",
  "password": "strong-password"
}
```

Success response:

```json
{
  "ok": true,
  "username": "admin"
}
```

## `POST /api/auth/logout`

Clears the session cookie.

Response:

```json
{
  "ok": true
}
```

## `GET /api/config`

Returns current app configuration without the password hash.

Example response:

```json
{
  "appName": "Agent Harbor",
  "roots": {
    "homeRoot": "/home/you",
    "mainCodexHome": "/home/you/.codex",
    "mainVSCodeExtensionsDir": "/home/you/.vscode/extensions",
    "isolatedProfilesRoot": "/home/you/.vscode-isolated",
    "sharedExtensionsDir": "/home/you/.vscode-agent-hub/extensions",
    "sharedSessionsRoot": "/home/you/.codex-shared",
    "launcherBinDir": "/home/you/.local/bin",
    "mainVSCodeStateDb": "/home/you/.config/Code/User/globalStorage/state.vscdb"
  },
  "setup": {
    "isolatedAccountSlots": 3,
    "extensionsMode": "shared"
  },
  "authConfigured": true
}
```

## `PUT /api/config`

Updates app-level path configuration.

Request body:

```json
{
  "appName": "Agent Harbor",
  "setup": {
    "isolatedAccountSlots": 3,
    "extensionsMode": "shared"
  },
  "roots": {
    "mainCodexHome": "/home/you/.codex",
    "mainVSCodeExtensionsDir": "/home/you/.vscode/extensions",
    "isolatedProfilesRoot": "/home/you/.vscode-isolated",
    "sharedExtensionsDir": "/home/you/.vscode-agent-hub/extensions",
    "sharedSessionsRoot": "/home/you/.codex-shared",
    "launcherBinDir": "/home/you/.local/bin",
    "mainVSCodeStateDb": "/home/you/.config/Code/User/globalStorage/state.vscdb"
  }
}
```

Behavior:

- provided paths are normalized to absolute paths
- omitted fields keep their previous value

## `GET /api/account-setup`

Returns onboarding data for the isolated account slots used to log in account 1, 2, 3, and so on.

Response shape:

```json
{
  "isolatedAccountSlots": 3,
  "guide": [
    "Prepare slot Account 1, Account 2, lalu Account 3 dari panel ini."
  ],
  "slots": [
    {
      "order": 1,
      "displayName": "Account 1",
      "slotKey": "codex-1",
      "status": "awaiting_login",
      "statusLabel": "slot ready, waiting for ChatGPT login",
      "prepared": true,
      "workspaceReady": true,
      "connected": false,
      "homePath": "/home/you/.vscode-isolated/codex-1/codex-home",
      "workspacePath": "/home/you/.vscode-isolated/codex-1/workspace/codex-1.code-workspace",
      "rootPath": "/home/you/.vscode-isolated/codex-1",
      "extensionsMode": "shared",
      "extensionsPath": "/home/you/.vscode-agent-hub/extensions",
      "launcherPath": "/home/you/.local/bin/code-codex-1",
      "launchMode": "empty",
      "launchTargetPath": "",
      "launchTargetValid": true,
      "launchTargetType": null,
      "launchValidationMessage": null,
      "account": {
        "authMode": null,
        "email": null,
        "plan": null,
        "accountIdSuffix": null
      },
      "sessionCount": 0
    }
  ]
}
```

Notes:

- `launchMode` is `empty` or `custom`
- `launchTargetPath` is used only when `launchMode` is `custom`
- `launchTargetValid` becomes `false` when the saved custom path is missing or not a directory / `.code-workspace` file

## `POST /api/account-setup/prepare`

Prepares one slot or all configured isolated slots.

Request body:

```json
{
  "slotKey": "codex-1"
}
```

If `slotKey` is omitted, all configured slots are prepared.

Response shape:

```json
{
  "ok": true,
  "results": [
    {
      "slot": {
        "displayName": "Account 1",
        "slotKey": "codex-1"
      },
      "operations": [
        "Prepared CODEX_HOME directory."
      ]
    }
  ]
}
```

## `POST /api/account-setup/launch`

Ensures a slot exists and launches a fresh isolated VS Code window for that slot without forcing a default `.code-workspace` file.

Request body:

```json
{
  "slotKey": "codex-1",
  "dryRun": false
}
```

Validation:

- if the slot is configured for `custom` launch mode, the saved target must exist
- valid custom targets are:
  - an existing directory
  - an existing `.code-workspace` file

## `POST /api/account-setup/settings`

Stores the default launch behavior for a slot.

Request body:

```json
{
  "slotKey": "codex-1",
  "launchMode": "custom",
  "launchTargetPath": "/home/you/work/project"
}
```

Behavior:

- `launchMode` accepts `empty` or `custom`
- when `launchMode` is `custom`, the path is normalized and validated before saving
- valid custom targets are:
  - an existing directory
  - an existing `.code-workspace` file
- the same validation is enforced again when launching a slot or regenerating launcher scripts

Success response:

```json
{
  "ok": true,
  "slot": {
    "slotKey": "codex-1",
    "launchMode": "custom",
    "launchTargetPath": "/home/you/work/project",
    "launchTargetValid": true,
    "launchTargetType": "directory",
    "launchValidationMessage": null
  }
}
```

Success response:

```json
{
  "ok": true,
  "slot": {
    "displayName": "Account 1",
    "slotKey": "codex-1"
  },
  "preparedOperations": [
    "Slot already prepared."
  ],
  "launched": true,
  "extensionsMode": "shared",
  "launch": {
    "command": "code",
    "args": [
      "--user-data-dir",
      "/home/you/.vscode-isolated/codex-1/user-data"
    ]
  },
  "nextSteps": [
    "Di window Account 1, buka extension ChatGPT/Codex lalu pilih Sign in."
  ]
}
```

## `POST /api/launchers/install`

Writes or refreshes the configured launcher wrappers into the launcher bin directory.
If Harbor is in shared extensions mode and the shared extensions directory is still empty, this call also seeds it from `mainVSCodeExtensionsDir`.

Request body:

```json
{}
```

Success response:

```json
{
  "ok": true,
  "binDir": "/home/you/.local/bin",
  "results": [
    {
      "slotKey": "codex-1",
      "wrapperPath": "/home/you/.local/bin/code-codex-1",
      "aliasPath": "/home/you/.local/bin/codex-1",
      "operations": [
        "Installed code-codex-1.",
        "Installed codex-1."
      ]
    }
  ]
}
```

## `POST /api/extensions/sync`

Copies extension folders from the configured main VS Code extensions directory into the configured shared extensions directory.

Request body:

```json
{
  "force": false
}
```

Behavior:

- copies regular extension folders from `roots.mainVSCodeExtensionsDir`
- skips folders that already exist in `roots.sharedExtensionsDir` unless `force` is `true`
- does not copy per-profile auth or runtime state

Success response:

```json
{
  "ok": true,
  "sharedExtensions": {
    "sourceDir": "/home/you/.vscode/extensions",
    "targetDir": "/home/you/.vscode-agent-hub/extensions",
    "totalSource": 52,
    "copied": 52,
    "skipped": 0,
    "operations": [
      "Synced 52 extension folders from /home/you/.vscode/extensions to /home/you/.vscode-agent-hub/extensions."
    ]
  }
}
```

## `GET /api/homes`

Discovers current homes using the configured root paths.

Response shape:

```json
{
  "homes": [
    {
      "label": "codex-1",
      "path": "/home/you/.vscode-isolated/codex-1/codex-home",
      "slotKey": "codex-1",
      "slotRoot": "/home/you/.vscode-isolated/codex-1",
      "isIsolatedSlot": true,
      "authMissing": false,
      "canArchive": false,
      "account": {
        "authMode": "chatgpt",
        "email": "example@gmail.com",
        "plan": "plus",
        "accountIdSuffix": "dbfc4723"
      },
      "sessionCount": 11,
      "stateDbPath": "/home/you/.vscode-isolated/codex-1/user-data/User/globalStorage/state.vscdb"
    }
  ]
}
```

## `GET /api/health`

Runs a read-only health inspection across all discovered homes.

Success response:

```json
{
  "generatedAt": "2026-03-27T12:00:00.000Z",
  "summary": {
    "total": 4,
    "ok": 2,
    "warning": 1,
    "critical": 1
  },
  "checks": [
    {
      "label": "codex-2",
      "path": "/home/you/.vscode-isolated/codex-2/codex-home",
      "status": "warning",
      "accountEmail": "example@gmail.com",
      "accountPlan": "team",
      "sessionCount": 85,
      "issues": [
        {
          "severity": "warning",
          "message": "Installed launcher wrapper is out of sync with current Harbor config."
        }
      ],
      "recommendations": [
        "Run Install Launchers so the terminal wrappers match current settings."
      ],
      "checks": {
        "authMissing": false,
        "sharedLinks": [],
        "stateDb": {
          "path": "/home/you/.vscode-isolated/codex-2/user-data/User/globalStorage/state.vscdb",
          "exists": true,
          "openAiStatePresent": true,
          "error": null
        },
        "extensions": {
          "path": "/home/you/.vscode-agent-hub/extensions",
          "exists": true,
          "count": 61
        },
        "launcher": {
          "wrapperPath": "/home/you/.local/bin/code-codex-2",
          "aliasPath": "/home/you/.local/bin/codex-2",
          "wrapperExists": true,
          "aliasExists": true,
          "wrapperSynced": false,
          "aliasSynced": true
        },
        "launchSettings": {
          "launchMode": "custom",
          "launchTargetPath": "/home/you/work/project",
          "valid": true,
          "targetType": "directory",
          "validationMessage": null
        }
      }
    }
  ]
}
```

Notes:

- `authMissing` is `true` when Harbor cannot read usable account identity from `auth.json`
- `canArchive` is `true` only for isolated `codex-*` slots that currently have no auth data

## `POST /api/homes/archive`

Archives a no-auth isolated `codex-*` slot by moving the entire slot root into a sibling archive directory.

Request body:

```json
{
  "homePath": "/home/you/.vscode-isolated/codex-4/codex-home"
}
```

Behavior:

- only works for isolated `codex-*` homes
- refuses to run when the target still has auth data
- moves the full slot root to `roots.isolatedProfilesRoot + "-archive"`
- archives matching launcher wrappers when present
- does not delete session history

Success response:

```json
{
  "ok": true,
  "home": "codex-4",
  "archivedSlotRoot": "/home/you/.vscode-isolated-archive/codex-4.20260326-204700",
  "archiveRoot": "/home/you/.vscode-isolated-archive",
  "operations": [
    "Archived /home/you/.vscode-isolated/codex-4 to /home/you/.vscode-isolated-archive/codex-4.20260326-204700."
  ]
}
```

## `POST /api/history/restore-shared`

Restores symlink-era history from the configured `sharedSessionsRoot` into every detected local home.

Request body:

```json
{
  "includeArchived": true,
  "dryRun": false,
  "targetPaths": [
    "/home/you/.vscode-isolated/codex-1/codex-home"
  ]
}
```

Behavior:

- reads `session_index.jsonl` and `sessions/` from `roots.sharedSessionsRoot`
- merges only sessions missing from each selected target home's index
- copies missing `archived_sessions/` files when `includeArchived` is `true`
- when `dryRun` is `true`, returns a preview summary without writing anything
- when `targetPaths` is omitted or empty, all detected homes are included
- writes a `session_index.jsonl.pre-shared-restore.<timestamp>.bak` backup before appending new rows
- reports unresolved session ids if the shared index references source session files that no longer exist

Success response:

```json
{
  "ok": true,
  "sourceRoot": "/home/you/.codex-shared",
  "totalIndexedSessions": 102,
  "uniqueIndexedSessions": 87,
  "mappableSourceSessions": 353,
  "includeArchived": true,
  "unresolvedSessionIds": [
    "019bf293-af22-75f2-89b2-45bc2e420b84"
  ],
  "results": [
    {
      "home": "codex-1",
      "restoredSessions": 74,
      "restoredArchived": 92,
      "actions": [
        "Backed up session_index.jsonl before shared-era restore.",
        "Restored 74 shared-era session index entries.",
        "Copied 92 archived shared-era session files."
      ]
    }
  ]
}
```

## `GET /api/sessions`

Lists import candidates across homes.

Query params:

- `targetPath`
  Purpose: home that will receive the imported session
- `sourcePath`
  Purpose: optional filter for one source home only
- `query`
  Purpose: case-insensitive search over thread title or session id
- `limit`
  Purpose: max number of results, default `120`

Example:

```text
/api/sessions?targetPath=/home/you/.codex&query=limit
```

Response shape:

```json
{
  "sessions": [
    {
      "id": "019ce71d-cc12-7b81-9839-279ca9de78c4",
      "title": "Reply to greeting message",
      "updatedAt": "2026-03-13T12:13:38.193368298Z",
      "sourceLabel": "codex-3",
      "sourcePath": "/home/you/.vscode-isolated/codex-3/codex-home",
      "sourceEmail": "example@gmail.com",
      "sourcePlan": "free",
      "existsInTarget": false
    }
  ]
}
```

## `POST /api/sessions/import`

Imports a specific session into a target home.

Request body:

```json
{
  "sourcePath": "/home/you/.vscode-isolated/codex-3/codex-home",
  "targetPath": "/home/you/.codex",
  "sessionId": "019ce71d-cc12-7b81-9839-279ca9de78c4",
  "overwrite": false
}
```

Response shape:

```json
{
  "ok": true,
  "operations": [
    "Session log copied into main.",
    "Session index updated."
  ]
}
```

Import rules:

- source and target homes must both exist
- source and target must be different
- if the target session file already exists and `overwrite` is false, main copy is skipped
- shell snapshot is copied only when present
- `session_index.jsonl` is appended only when the target lacks the thread id

## `POST /api/sessions/share-current`

Broadcasts the latest session from one source home into every other discovered home.

Request body:

```json
{
  "sourcePath": "/home/you/.vscode-isolated/codex-2/codex-home",
  "overwrite": false
}
```

Behavior:

- reads the newest `session_id` from the source home's `history.jsonl`
- if the live thread is not yet present under `sessions/`, creates a portable JSONL session first
- copies that session into every other discovered home
- copies the matching shell snapshot when present
- appends `session_index.jsonl` only where the target lacks the thread id

Response shape:

```json
{
  "ok": true,
  "sessionId": "019d296c-1b25-7ed0-b425-3979a6b2c944",
  "sourceLabel": "codex-2",
  "sourcePath": "/home/you/.vscode-isolated/codex-2/codex-home",
  "threadName": "Fix shared Codex sessions and continue in VS Code",
  "materializedFromHistory": false,
  "results": [
    {
      "targetLabel": "main",
      "targetPath": "/home/you/.codex",
      "operations": [
        "Session log copied into main.",
        "Session index updated."
      ]
    }
  ]
}
```

## `POST /api/repair/home`

Repairs one home that may still be wired to a shared session root.

Request body:

```json
{
  "homePath": "/home/you/.vscode-isolated/codex-1/codex-home",
  "resetOpenAIState": true
}
```

Response shape:

```json
{
  "home": "codex-1",
  "path": "/home/you/.vscode-isolated/codex-1/codex-home",
  "actions": [
    "Detached sessions from shared root.",
    "Detached archived_sessions from shared root.",
    "Detached session_index.jsonl from shared root.",
    "Reset VS Code openai.chatgpt state."
  ]
}
```

## `POST /api/repair/all`

Runs the same repair flow for every discovered home.

Request body:

```json
{
  "resetOpenAIState": true
}
```

Response shape:

```json
{
  "results": [
    {
      "home": "main",
      "path": "/home/you/.codex",
      "actions": [
        "Detached sessions from shared root."
      ]
    }
  ]
}
```

## Static Routes

Non-API paths are served from `public/`.

Important paths:

- `/`
- `/index.html`
- `/app.js`
- `/styles.css`
- `/favicon.svg`

## Error Model

The backend generally returns:

- `400` for bad input
- `401` for missing login
- `403` for setup-required flows
- `404` for unknown routes or missing homes
- `409` when setup already exists
- `500` for unexpected server-side failures
