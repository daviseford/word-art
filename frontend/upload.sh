#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v pwsh >/dev/null 2>&1; then
  exec pwsh -NoProfile -File "${SCRIPT_DIR}/deploy.ps1" "$@"
fi

if command -v powershell.exe >/dev/null 2>&1; then
  exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${SCRIPT_DIR}/deploy.ps1" "$@"
fi

echo "PowerShell is required. Run ./deploy.ps1 from PowerShell instead." >&2
exit 1
