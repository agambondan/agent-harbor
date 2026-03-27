# Architecture

This document explains how Agent Harbor is structured today, why it is designed this way, and what boundaries it intentionally keeps.

## Goal

The system solves one specific problem:

> make AI-agent sessions portable across multiple local VS Code slots without sharing account identity, runtime state, or extension auth.

This is why the design looks more like a local control plane than a chat application.

## High-Level Shape

Agent Harbor is a single-process local web application.

- backend: one Node.js HTTP server using only built-in modules
- frontend: one static HTML page with a browser-side JavaScript controller
- storage: JSON files and generated secrets stored inside the project

There is no database server, no framework runtime, and no dependency graph outside Node itself.

## Major Components

### Backend

Implemented in [server.mjs](../src/server.mjs).

Responsibilities:

- load and persist app configuration
- create and verify local admin authentication
- discover Codex homes from configured roots
- decide whether extensions are shared or isolated per slot
- generate or refresh launcher scripts for each slot
- decode account metadata from `auth.json`
- enumerate session metadata from `session_index.jsonl`
- import sessions between homes
- repair shared-session symlink setups
- serve static frontend files

### Frontend

Implemented in:

- [index.html](../public/index.html)
- [app.js](../public/app.js)
- [styles.css](../public/styles.css)

Responsibilities:

- render first-boot setup or login state
- render discovered homes and onboarding slots
- manage path, launcher, and shared-extension configuration
- search and filter session candidates
- invoke import, repair, launcher, and onboarding operations
- show lightweight logs and short-lived toasts

The frontend stays intentionally simple:

- no build step
- no client framework
- no generated bundles

### Runtime Storage

Stored under `storage/`.

- `app-config.json`
  Purpose: user-editable app configuration plus the local admin user record
- `session-secret.txt`
  Purpose: secret used to sign the session cookie

These files are local runtime state, not source-controlled state.

## Data Sources

Agent Harbor reads from several external local sources.

### Agent Home

Each managed home is expected to look roughly like:

- `auth.json`
- `session_index.jsonl`
- `sessions/`
- `archived_sessions/`
- `shell_snapshots/`

### VS Code Runtime State

Used for onboarding visibility and repair operations.

- per-slot `user-data/User/globalStorage/state.vscdb`
- per-slot `user-data/User/globalStorage/*`

The app treats `openai.chatgpt` and similar keys inside this DB as disposable UI state, not as durable source of truth.

### Shared Extensions Directory

When `extensionsMode` is `shared`, every slot points at one common extensions directory.

Harbor treats the main VS Code extensions directory as the seed source for that shared directory. If the shared directory is empty, Harbor can populate it automatically during slot preparation or launcher installation, and the UI also exposes an explicit sync action.

What this shares:

- extension binaries
- extension install artifacts

What this does not share:

- extension auth state
- VS Code global storage
- VS Code secret storage
- `CODEX_HOME`
- session files

That boundary is the key difference between a safe setup and the old broken “share everything” approach.

## Trust Boundaries

### Trusted

- local filesystem owned by the current machine user
- runtime files stored inside the project folder
- explicit configuration entered through the UI

### Semi-Trusted

- `auth.json` inside managed homes
- `session_index.jsonl` metadata
- session JSONL files under `sessions/`

These files are trusted enough to read and copy, but the app still avoids using them to authenticate users into Agent Harbor itself.

### Untrusted or Disposable

- browser-side state
- stale extension UI state inside VS Code DBs
- symlinked shared-session layouts created by older experiments

## Launcher Model

Launcher generation exists because the correct isolation model is wider than `CODEX_HOME` alone.

Each generated `code-codex-N` launcher:

- isolates `--user-data-dir`
- isolates `CODEX_HOME`
- isolates `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_DATA_HOME`
- isolates `CLOUDSDK_CONFIG`
- chooses either a shared or isolated `--extensions-dir` based on app config

The launcher itself does not copy extensions. It only points at the resolved directory. Populating a shared directory is handled separately by Harbor so extension code can be mirrored from the main VS Code install without touching per-slot auth state.

This supports:

- shared extension installs for convenience
- isolated auth and runtime state for safety

## Session Import Model

Import is deliberately narrow.

What gets copied:

- one matching session JSONL file
- one matching shell snapshot if present
- one matching `session_index.jsonl` row if missing in target

What does not get copied:

- `auth.json`
- token data
- browser cookies
- `state_5.sqlite`
- VS Code state databases

This preserves thread content while avoiding the identity and rate-limit coupling that originally caused trouble.

## Repair Model

Repair works by inspecting each home for these three entries:

- `sessions`
- `archived_sessions`
- `session_index.jsonl`

If any of them are symlinks into the configured shared root:

1. the symlink is parked as `*.shared-link.<timestamp>`
2. a local replacement is restored from a `.bak*` snapshot if available
3. otherwise the current shared target is copied into a local real file or directory

If enabled, repair then also:

1. copies `state.vscdb` to `*.pre-openai-reset.<timestamp>`
2. deletes the `openai.chatgpt` row

## Authentication Model

The application has its own local admin account.

Why this is separate from agent auth:

- agent auth answers “which account owns this slot?”
- Agent Harbor auth answers “who is allowed to operate this management UI?”

Implementation details:

- password hashing uses `crypto.scryptSync`
- session cookie is signed with HMAC-SHA256
- cookie lifetime is 12 hours
- cookie is `HttpOnly` and `SameSite=Lax`

## Why No Framework

This project intentionally avoids Express, React, Next.js, or SQLite for the MVP.

Reasons:

- zero install friction
- easier portability between machines
- easier auditing for file operations
- smaller blast radius during repair actions

## Future Evolution

The most natural next architectural changes are:

1. split backend modules out of `server.mjs` once the route surface grows
2. add a small audit log file for imports, launcher installs, and repairs
3. add session preview extraction from JSONL content
4. add optional scheduled safe sync rules
