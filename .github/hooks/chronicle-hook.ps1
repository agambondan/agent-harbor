param(
  [string]$Event = "",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$commandPath = $env:CHRONICLE_COMMAND_PATH
if ([string]::IsNullOrWhiteSpace($commandPath) -or -not (Test-Path $commandPath)) {
  $existing = Get-Command chronicle-agent -ErrorAction SilentlyContinue
  if ($existing) {
    $commandPath = $existing.Source
  }
}
if ([string]::IsNullOrWhiteSpace($commandPath) -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
  $candidate = Join-Path $env:LOCALAPPDATA "Chronicle\bin\chronicle-agent.exe"
  if (Test-Path $candidate) {
    $commandPath = $candidate
  }
}

if ([string]::IsNullOrWhiteSpace($commandPath)) {
  if ($Event -eq "pre-tool-use") {
    Write-Output '{"permissionDecision":"deny","permissionDecisionReason":"Chronicle hook bridge could not find chronicle-agent. Re-run chronicle-agent install before continuing."}'
  } else {
    Write-Error "Chronicle hook bridge could not find chronicle-agent. Re-run chronicle-agent install before continuing."
  }
  exit 0
}

$stdinData = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($stdinData)) {
  & $commandPath hook copilot $Event @Rest
} else {
  $stdinData | & $commandPath hook copilot $Event @Rest
}
