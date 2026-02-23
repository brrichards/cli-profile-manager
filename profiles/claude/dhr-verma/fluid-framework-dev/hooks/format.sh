#!/usr/bin/env bash
# PostToolUse hook: runs Biome format + ESLint fix after every Edit or Write.
# Receives the tool call JSON on stdin. Never blocks Claude (always exits 0).

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

# Nothing to do if no file path in the tool input
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Resolve the repo root (where package.json with fluid-build lives)
REPO_ROOT=$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$REPO_ROOT" ]]; then
  exit 0
fi

cd "$REPO_ROOT"

# Format all files changed since main — Biome handles the extensions it supports
pnpm run format:changed:main 2>&1 || true

exit 0
