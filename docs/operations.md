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
11. optionally save a short label such as `work`, `personal`, or `testing` for each slot
12. repeat for `Account 2` and `Account 3`

### Onboard Account 1, 2, 3

The intended setup flow is:

1. prepare the slot from Harbor so the profile gets isolated `user-data`, `xdg`, and `CODEX_HOME`
2. if you use `shared` extension mode, verify every slot points at the same `Shared Extensions Dir`
3. set `Default Launch Mode` per slot to either `Empty Window` or `Custom Workspace / Folder`
4. if you choose `Custom Workspace / Folder`, enter a path to an existing folder or `.code-workspace` file, then click `Save Launch Settings`
5. if the extension list looks empty in a codex window, run `Sync Extensions` from Harbor to copy binaries from the main VS Code install
6. click `Launch VS Code`
7. in that fresh window, open the ChatGPT, Codex, Claude, Copilot, or Gemini extension and run its sign-in flow
8. complete browser login for the exact account that belongs to that slot
9. return to Harbor and click `Refresh Slots`
10. optionally save or adjust the slot label once you know what that account is for
11. confirm the email now appears on that account card before moving to the next slot

If you also launch slots from the terminal using `code-codex-*`, run `Install Launchers` after saving launch settings so the wrappers pick up the new default target.

### Label Accounts / Homes

Use labels when `codex-1`, `codex-2`, and `main` are too abstract for daily work.

1. open either the `Account Login Dock` or `Homes` panel
2. enter a short label such as `work`, `personal`, `testing`, or a team name
3. click `Save Label`
4. Harbor stores the label in its own config and refreshes the UI

Behavior:

1. labels are Harbor-only metadata; they do not modify `auth.json`, session logs, or VS Code state
2. clearing the field and saving removes the label and falls back to the canonical key such as `main` or `codex-2`
3. the saved label is reused across:
   - Homes
   - Account Login Dock
   - Session Shuttle selectors and results
   - Recovery target selection and saved presets
   - Backup Catalog
   - Health Check
   - Audit summaries

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
4. click `Preview` if you want to inspect the thread first
5. click `Import`
6. review the preview summary shown in the confirmation modal
7. reopen the target Codex profile if you want to continue the imported thread from that profile

Preview currently shows:

1. source and target homes
2. whether the target already has that session
3. the session JSONL path or whether Harbor must materialize it from `history.jsonl`
4. shell snapshot presence
5. user/assistant record counts
6. first prompt, last prompt, and last assistant snippet when available

### Run Health Check

Use this when you want one panel that summarizes slot hygiene without manually checking homes, launchers, and state DB paths one by one.

1. open the `Health Check` panel
2. click `Refresh Health`
3. inspect any `Critical` or `Warning` cards
4. use the `Auto Fix` buttons when Harbor can repair the issue directly
5. use the text recommendations when a manual decision is still required

The panel currently checks:

1. whether auth identity is present
2. whether `sessions`, `archived_sessions`, or `session_index.jsonl` still leak to the shared root
3. whether the extensions directory exists and has extension folders
4. whether launcher wrappers exist and still match current Harbor config
5. whether a saved custom launch target is still valid
6. whether `state.vscdb` is present and readable

Auto-fix coverage currently includes:

1. `Repair Home` when shared-session symlink leaks are detected
2. `Sync Extensions` when shared extension slots point at an empty shared extension directory
3. `Install Launchers` when wrapper files are missing or stale
4. `Prepare Slot` when an isolated slot is missing its runtime directories
5. `Archive Slot` when a stale no-auth isolated slot should be parked
6. `Reset Launch To Empty` when a saved custom launch target is broken

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

### Browse Restore Points

Use the `Backup Catalog` panel when you want to inspect or restore Harbor-managed restore points.

1. open the `Backup Catalog` panel
2. click `Refresh Backups`
3. use `Home Filter`, `Kind Filter`, `Search Restore Points`, or `Sort` if the list is crowded
4. inspect the matching restore points
5. click `Restore This Backup` on the item you want
6. confirm the restore action

Restore rules:

1. Harbor backs up the current target first as `*.pre-catalog-restore.<timestamp>` when it exists
2. file and directory backups are copied back into place
3. archived isolated `codex-*` slots are copied back from `~/.vscode-isolated-archive/...`
4. archived launcher wrappers are restored together with a slot archive when present

### Browse Audit Trail

Use the `Audit` panel when you want a local timeline of Harbor actions that changed state.

1. open the `Audit` panel
2. click `Refresh Audit`
3. optionally narrow the list with `Action Filter` or the search box
4. inspect entry cards for actor, target, timestamp, status, and operation details
5. use the audit trail to confirm what Harbor already changed before running another repair or restore

Audit coverage currently includes:

1. config changes and launch-setting saves
2. launcher install or refresh actions
3. extension sync operations
4. repair and shared-history restore flows
5. backup restores and stale-slot cleanup actions
6. session import / broadcast actions
7. Health auto-fix executions

### Cleanup Stale Slots

Use the `Stale Slot Cleanup` panel when you want Harbor to archive multiple no-auth isolated slots in one pass.

1. open the `Stale Slot Cleanup` panel
2. click `Refresh Cleanup Plan`
3. review the stale slot candidates and select the ones you want
4. leave `Also lower slot count...` enabled if you want Harbor to reduce trailing unused slot capacity when safe
5. click `Archive Selected Stale Slots`
6. confirm the selected slots

Cleanup rules:

1. Harbor only targets isolated `codex-*` homes that currently still qualify for `canArchive`
2. the cleanup flow moves each slot into `~/.vscode-isolated-archive/...` instead of deleting it
3. matching launcher wrappers are archived together with the slot
4. slot count is reduced only when the retained homes no longer need the previous maximum slot number

### Restore Shared-Era History

Use this when you want to pull the old chat history back from the parked shared sessions root that used to be symlinked across profiles.

1. open the Recovery panel
2. optionally save the current target selection as a preset such as `main only` or `all codex slots`
3. apply a saved preset if you want to reuse a known target group
4. optionally filter the target list by account email or search by slot, email, or path
5. use `Select All`, `Clear All`, `Select Visible`, or `Clear Visible` to shape the target set quickly
6. click `Preview Shared History` to inspect how many sessions and archived files would be restored
7. click `Restore Shared History`
8. confirm the preview summary
9. let Harbor merge missing sessions and archived history into the selected local homes
10. reopen the affected VS Code windows so the restored history is visible in the extension

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
- `storage/audit-log.jsonl`

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

- undo flow for imports
- background sync rules
- multi-user authentication

## Suggested Admin Workflow

For day-to-day use, the cleanest pattern is:

1. keep every account's Codex home isolated
2. share extensions only if you still isolate `user-data` and `CODEX_HOME`
3. use Agent Harbor only when you want to bring a specific thread across
4. run repair only if you suspect a filesystem-level misconfiguration
5. avoid touching shared roots manually once the app is in use
