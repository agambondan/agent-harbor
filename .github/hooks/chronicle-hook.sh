#!/usr/bin/env bash
set -euo pipefail

event="${1:-}"
if [[ $# -gt 0 ]]; then
  shift
fi

resolve_chronicle() {
  if [[ -n "${CHRONICLE_COMMAND_PATH:-}" && -x "${CHRONICLE_COMMAND_PATH}" ]]; then
    printf '%s' "${CHRONICLE_COMMAND_PATH}"
    return 0
  fi
  if command -v chronicle-agent >/dev/null 2>&1; then
    command -v chronicle-agent
    return 0
  fi
  if [[ -n "${HOME:-}" && -x "${HOME}/.local/bin/chronicle-agent" ]]; then
    printf '%s' "${HOME}/.local/bin/chronicle-agent"
    return 0
  fi
  return 1
}

if ! command_path="$(resolve_chronicle)"; then
  if [[ "${event}" == "pre-tool-use" ]]; then
    printf '%s\n' '{"permissionDecision":"deny","permissionDecisionReason":"Chronicle hook bridge could not find chronicle-agent. Re-run chronicle-agent install before continuing."}'
  else
    printf 'Chronicle hook bridge could not find chronicle-agent. Re-run chronicle-agent install before continuing.\n' >&2
  fi
  exit 0
fi

exec "${command_path}" hook copilot "${event}" "$@"
