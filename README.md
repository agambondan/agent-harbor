# Agent Harbor

Agent Harbor is a local control plane for working with multiple AI-agent-backed VS Code profiles without repeating the mistake of sharing raw session folders, auth state, or UI runtime across accounts.

The project provides a small browser UI and a local backend so you can:

- create a local admin login for the tool itself
- prepare isolated account slots for account 1, 2, 3, and launch each slot in its own VS Code window
- share extension binaries across slots while keeping auth and runtime state isolated
- install or refresh launcher scripts such as `code-codex-1` and `codex-1` from the UI
- discover Codex homes from `~/.codex` and `~/.vscode-isolated/*/codex-home`
- inspect account metadata derived from each home's `auth.json`
- search and import individual sessions from one profile into another
- broadcast the latest live session from one profile into every other detected profile
- repair broken setups where several profiles accidentally point at a shared `sessions` directory
- restore old symlink-era history from the parked shared sessions root back into local homes
- preview shared-era restore counts, filter targets by account, and choose exactly which homes should receive that history
- archive isolated `codex-*` slots that never got an `auth.json`, without deleting their session history
- batch-clean stale no-auth slots and optionally lower configured slot count when the removed slots were trailing
- browse Harbor-managed restore points and restore individual backup items from the web UI
- run a health check dashboard that flags auth gaps, shared-session leaks, launcher drift, empty extension dirs, and invalid custom launch targets
- customize where the app should look for Codex homes, shared storage, and VS Code state files

## Why This Exists

Sharing the full `sessions`, `session_index.jsonl`, or `archived_sessions` path between accounts looks convenient at first, but it leaks thread identity and profile state across accounts. That is how one account hitting a limit can make several VS Code profiles feel broken at the same time.

This project keeps the good part, connected history and reusable extensions, while removing the dangerous part, shared auth or shared runtime state.

## Quick Start

The project intentionally uses only built-in Node.js modules. There is no dependency install step.

```bash
cd /home/you/works/me/agent-harbor
npm start
```

`npm start` is safe now:

- if Agent Harbor is already running on port `4317`, it exits cleanly instead of spawning a duplicate
- if port `4317` is occupied by another process, it refuses to start

For a deliberate local restart:

```bash
npm run restart
```

Open:

```text
http://127.0.0.1:4317
```

For development with auto-reload:

```bash
npm run dev
```

## First Boot

On first run:

1. open the web UI
2. create a local admin account
3. log in automatically after setup
4. review the detected homes and path configuration
5. start importing sessions or running repair actions

The admin account is local to this project only. It does not reuse Codex auth or OpenAI auth.

## Core Features

### 1. Path Control

The UI lets you configure:

- `mainCodexHome`
- `mainVSCodeExtensionsDir`
- `isolatedProfilesRoot`
- `sharedSessionsRoot`
- `mainVSCodeStateDb`

This matters because some machines or launchers may place homes, shared extensions, or launcher scripts somewhere other than the defaults.

### 2. Home Discovery

The backend scans:

- the main Codex home, usually `~/.codex`
- isolated homes under `~/.vscode-isolated/*/codex-home`

For each home it reports:

- label such as `main`, `codex-1`, `codex-2`
- filesystem path
- email and plan decoded from `auth.json` when available
- session count from `session_index.jsonl`
- derived path to the related VS Code `state.vscdb`

### 3. Account Login Dock

The onboarding panel is meant for fresh multi-account setup:

- choose how many isolated account slots you want, default `3`
- choose whether extension binaries should be `shared` or fully `isolated`
- prepare each slot so it gets its own `user-data`, `xdg`, `cloudsdk`, optional workspace directory, and `CODEX_HOME`
- set a per-slot default launch mode: `empty window` or `custom workspace / folder`
- optionally point every slot at one shared extensions directory
- seed or refresh that shared extensions directory from the main VS Code install
- launch the slot in a fresh VS Code window from the web UI
- sign in to the ChatGPT, Codex, Claude, Copilot, or Gemini extension inside that window
- return to Harbor and refresh until the email shows up from `auth.json`
- install launcher scripts from the UI so terminal commands match the current isolation strategy

This keeps account 1, 2, and 3 separate from day one instead of trying to split them after they have already shared state.

### 4. Session Shuttle

The import flow copies a single session from one home to another by:

- copying the session JSONL file under `sessions/...`
- copying the matching shell snapshot when present
- appending the matching `session_index.jsonl` row when needed

It does not copy:

- auth tokens
- `state_5.sqlite`
- browser cookies
- VS Code extension state

That keeps history portable while account identity stays isolated.

Before import, Harbor can now preview the session and show:

- source and target homes
- whether the target already has that thread
- whether the portable session file already exists or still needs to be materialized from `history.jsonl`
- shell snapshot availability
- first prompt, last prompt, and latest assistant snippet when available

The same panel also provides a one-click broadcast action:

- choose a source home
- use the latest thread found in that home's `history.jsonl`
- materialize a portable session first if the live thread has not flushed into `sessions/` yet
- copy the thread into every other discovered home in one operation

### 5. Isolation Repair

If several profiles were previously wired to a shared session root, the repair flow can:

- detect whether `sessions`, `archived_sessions`, or `session_index.jsonl` are symlinks
- detach them from the configured shared root
- restore local copies from `.bak*` snapshots when present
- otherwise restore from the current shared target
- optionally clear the VS Code `openai.chatgpt` state entry from `state.vscdb`

### 6. Backup Catalog

Harbor also catalogs the restore points it creates itself, including:

- `session_index.jsonl` snapshots created before shared merge / shared restore actions
- `state.vscdb.pre-openai-reset.*`
- archived isolated `codex-*` slot folders
- launcher backups
- `auth.json.pre-restore-*`

Each item can be restored from the UI. If the current target already exists, Harbor moves it aside first as `*.pre-catalog-restore.<timestamp>` before applying the selected backup item.

The catalog can also be narrowed directly in the UI:

- filter by home label
- filter by backup kind
- search across title, paths, kind, and notes
- sort by newest, oldest, size, title, or kind

### 7. Stale Slot Cleanup

Harbor can also detect isolated `codex-*` homes that still contain local session history but never completed login, then archive them in one pass.

The cleanup wizard:

- lists only stale no-auth isolated slots
- lets you select several slots at once
- archives launcher wrappers together with the slot when present
- can reduce `isolatedAccountSlots` automatically when the removed stale slots were trailing

## Safety Model

The project is intentionally conservative:

- session logs are copied thread-by-thread
- auth state is never merged between homes
- extension code may be shared, but extension state is not
- VS Code `openai.chatgpt` state is treated as disposable UI state, not trusted state
- repair actions preserve a parked copy of old symlinks using `*.shared-link.<timestamp>`
- database reset actions preserve a backup of `state.vscdb` as `*.pre-openai-reset.<timestamp>`

## Runtime Files

These files are generated at runtime and ignored by git:

- `storage/app-config.json`
- `storage/session-secret.txt`

The project also keeps `storage/.gitkeep` so the directory exists in the repo.

## Project Structure

```text
agent-harbor/
├── public/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── favicon.svg
├── src/
│   └── server.mjs
├── storage/
│   └── .gitkeep
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── operations.md
├── package.json
└── README.md
```

## Documentation Map

- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Operations Guide](./docs/operations.md)

## Current Limits

This is a local MVP, not a multi-tenant platform.

Current deliberate limits:

- one local admin account
- no HTTPS termination inside the app
- no user management or RBAC
- no background worker or queue
- no automatic continuous sync yet
- no session preview content yet, only metadata plus import
- shared extensions are synced on demand or when Harbor detects an empty shared directory, not watched continuously

## Recommended Next Steps

The current shape is strong enough for daily local use, but the most valuable follow-ups are:

1. add session preview before import
2. add background sync rules that copy only new sessions safely
3. add richer audit logs for repair and import actions
4. add explicit account labels or tags on the UI
