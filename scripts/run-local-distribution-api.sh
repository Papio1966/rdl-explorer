#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${RDL_LOCAL_INTEGRATION_ENV:-$HOME/.config/rdl-datagate-local/local-integration.env}"
if [[ -f "$CONFIG" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$CONFIG"
  set +a
fi
for f in "$ROOT/.env" "$ROOT/.env.local" "$ROOT/.env.development.local"; do
  if [[ -f "$f" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "$f"
    set +a
  fi
done
if [[ -z "${RDL_GOVERNANCE_AUTH_SECRET:-}" && -n "${RDL_EXPLORER_GOVERNANCE_AUTH_SECRET:-}" ]]; then
  export RDL_GOVERNANCE_AUTH_SECRET="$RDL_EXPLORER_GOVERNANCE_AUTH_SECRET"
fi
export RDL_RUNTIME_ENV="${RDL_RUNTIME_ENV:-development}"
export RDL_LOCAL_REPO="$ROOT"
exec "$ROOT/node_modules/.bin/tsx" "$ROOT/scripts/local-distribution-api.mjs"
