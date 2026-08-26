#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d dist ]; then
  echo "dist/ is missing. Run npm run build first." >&2
  exit 1
fi

mkdir -p artifacts
ARCHIVE="artifacts/rdl-explorer-deployment.tgz"
rm -f "$ARCHIVE"

tar -czf "$ARCHIVE" \
  dist \
  api \
  server \
  deployment/runtime-manifest.json \
  package.json \
  package-lock.json \
  vercel.json

echo "Created $ARCHIVE"
