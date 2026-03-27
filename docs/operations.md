# Operations Guide

This document covers daily usage, recovery actions, development notes, and safe operating practices for Agent Harbor.

## Daily Usage

### Start the Service

```bash
cd /home/you/works/me/agent-harbor
npm start
```

`npm start` now checks port `4317` first:

- if Agent Harbor is already serving there, it exits cleanly
- if another process owns the port, it refuses to start a duplicate

For a deliberate restart:

```bash
npm run restart
```

Then open:

```text
http://127.0.0.1:4317
```

### First Login

If this is a fresh install:

1. create the local admin user
2. review the prefilled root paths
3. set `Isolated Account Slots` to the number of AI accounts you want to onboard, for example `3`
4. choose `Extensions Mode`
5. if you want one shared extension install, point `Shared Extensions Dir` to the common path and verify `Main VS Code Extensions Dir` points at the primary VS Code install
6. save any path adjustments if your homes live elsewhere
7. click `Sync Extensions` once if the shared extensions directory has not been seeded yet
8. optionally click `Install Launchers` so terminal wrappers follow the current launch model
9. use `Prepare All Slots` in the Account Login Dock
10. launch `Account 1`, sign in inside the AI extension you want, then refresh slots until the email appears
11. repeat for `Account 2` and `Account 3`

### Onboard Account 1, 2, 3

The intended setup flow is:

1. prepare the slot from Harbor so the profile gets isolated `user-data`, `xdg`, and `CODEX_HOME`
2. if you use `shared` extension mode, verify every slot points at the same `Shared Extensions Dir`
3. if the extension list looks empty in a codex window, run `Sync Extensions` from Harbor to copy binaries from the main VS Code install
4. click `Launch VS Code` and Harbor will open an empty fresh window by default, not a forced `.code-workspace`
5. in that fresh window, open the ChatGPT, Codex, Claude, Copilot, or Gemini extension and run its sign-in flow
6. complete browser login for the exact account that belongs to that slot
7. return to Harbor and click `Refresh Slots`
8. confirm the email now appears on that account card before moving to the next slot

### Shared Extensions, Isolated Auth

The safe model is:

1. extension binaries may be shared across slots
2. VS Code `user-data` must stay isolated per slot
3. `CODEX_HOME` must stay isolated per slot
4. `state.vscdb` must stay isolated per slot

This keeps install/update cost low without reintroducing cross-account auth leakage.

### Import a Session

1. choose the target home in the Session Shuttle panel
2. optionally narrow the source home
3. search by title or session id
4. click `Import`
5. reopen the target Codex profile if you want to continue the imported thread from that profile

### Repair a Home

Use repair when you suspect profiles still share the same session directory.

Per-home repair:

1. click `Repair Home` on the affected home
2. keep the reset toggle enabled unless you explicitly want to keep stale VS Code UI state

Global repair:

1. click `Repair All Homes`
2. restart the affected VS Code windows afterwards

### Archive a No-Auth Slot

Use this when a `codex-*` isolated slot was created, has local session data, but never completed login so it still shows `No auth.json`.

1. lower `Isolated Account Slots` first if you do not want the slot recreated later
2. open the `Homes` panel
3. click `Archive No-Auth Slot` on the target card
4. confirm the archive action
5. Harbor moves the entire slot root to `~/.vscode-isolated-archive/...` instead of deleting it
6. Harbor also archives the matching launcher wrappers when they exist
7. refresh Harbor or reopen the page

If you only want the UI cleaner temporarily, use `Hide No-Auth` in the Homes panel instead of archiving.

### Restore Shared-Era History

Use this when you want to pull the old chat history back from the parked shared sessions root that used to be symlinked across profiles.

1. open the Recovery panel
2. optionally filter the target list by account email or search by slot, email, or path
3. use `Select All`, `Clear All`, `Select Visible`, or `Clear Visible` to shape the target set quickly
4. click `Preview Shared History` to inspect how many sessions and archived files would be restored
5. click `Restore Shared History`
6. confirm the preview summary
7. let Harbor merge missing sessions and archived history into the selected local homes
8. reopen the affected VS Code windows so the restored history is visible in the extension

Harbor only restores missing local history. It does not recreate shared auth state or relink the homes.

## How to Recognize a Broken Shared Setup

Typical symptoms:

- one account hits a usage limit and several other profiles suddenly behave the same way
- session titles or recent prompts appear in the wrong profile
- imported threads appear everywhere even when you did not explicitly copy them
- `sessions`, `archived_sessions`, or `session_index.jsonl` are symlinked into one common folder

## Files the App Reads

Per home:

- `auth.json`
- `session_index.jsonl`
- `sessions/`
- `shell_snapshots/`

Repair-only:

- related VS Code `state.vscdb`

## Files the App Writes

Inside the project:

- `storage/app-config.json`
- `storage/session-secret.txt`

Inside Codex homes during import:

- copied thread JSONL file under `sessions/`
- copied shell snapshot under `shell_snapshots/`
- appended `session_index.jsonl` entry

Inside Codex homes during repair:

- parked symlink backup as `*.shared-link.<timestamp>`
- restored local `sessions`
- restored local `archived_sessions`
- restored local `session_index.jsonl`

Inside VS Code state during repair:

- backup `state.vscdb.pre-openai-reset.<timestamp>`
- deleted `openai.chatgpt` row

## Manual Inspection Commands

Check whether a home is still symlinked:

```bash
find ~/.codex ~/.vscode-isolated -maxdepth 2 \( -name sessions -o -name archived_sessions -o -name session_index.jsonl \) -type l -ls
```

Check the current app config:

```bash
cat /home/you/works/me/agent-harbor/storage/app-config.json
```

Check whether the admin setup exists:

```bash
ls -la /home/you/works/me/agent-harbor/storage
```

## Development Notes

### No Install Step

This project uses only Node built-ins, so you do not need:

- `npm install`
- `pnpm install`
- a bundler

### Main Entry Point

Backend entry:

- [server.mjs](../src/server.mjs)

Frontend entry:

- [app.js](../public/app.js)

### Hot Reload

```bash
npm run dev
```

This uses Node's built-in `--watch` mode and restarts the backend when server files change.

## Safe Operating Rules

These rules are the whole reason the project exists:

1. do not symlink `sessions`, `archived_sessions`, or `session_index.jsonl` across accounts
2. do not copy `auth.json` across homes
3. do not copy VS Code `state.vscdb` between homes
4. if you need portability, import threads one by one
5. if the setup was already polluted, repair first and then restart VS Code profiles

## Current Gaps

Things that are not implemented yet:

- preview of session content before import
- undo flow for imports
- audit log UI
- per-account labels editable from the app
- background sync rules
- multi-user authentication

## Suggested Admin Workflow

For day-to-day use, the cleanest pattern is:

1. keep every account's Codex home isolated
2. share extensions only if you still isolate `user-data` and `CODEX_HOME`
3. use Agent Harbor only when you want to bring a specific thread across
4. run repair only if you suspect a filesystem-level misconfiguration
5. avoid touching shared roots manually once the app is in use
