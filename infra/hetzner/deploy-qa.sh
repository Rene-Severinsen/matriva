#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

remote_host="${QA_REMOTE_HOST:-ravena-prod}"
remote_root="${QA_REMOTE_ROOT:-/usr/home/b9kady/matriva-qa}"
health_timeout="${QA_HEALTH_TIMEOUT_SECONDS:-90}"

: "${QA_BASE_URL:?QA_BASE_URL is required, for example https://qa.example.invalid}"
: "${QA_DATABASE_URL:?QA_DATABASE_URL is required for idempotent QA asset sync}"
: "${QA_ADMIN_ACCESS_TOKEN:?QA_ADMIN_ACCESS_TOKEN is required for post-deploy runtime checks}"
: "${MATRIVA_S3_ENDPOINT:?MATRIVA_S3_ENDPOINT is required for QA asset sync}"
: "${MATRIVA_S3_BUCKET:?MATRIVA_S3_BUCKET is required for QA asset sync}"
: "${MATRIVA_S3_ACCESS_KEY_ID:?MATRIVA_S3_ACCESS_KEY_ID is required for QA asset sync}"
: "${MATRIVA_S3_SECRET_ACCESS_KEY:?MATRIVA_S3_SECRET_ACCESS_KEY is required for QA asset sync}"

for command_name in git npm node rsync ssh curl; do
  command -v "$command_name" >/dev/null || {
    echo "ABORT: Required command not found: $command_name" >&2
    exit 1
  }
done

if [ -z "${QA_RESTART_COMMAND:-}" ] && [ ! -t 0 ]; then
  echo "ABORT: QA_RESTART_COMMAND is required for non-interactive deploys." >&2
  echo "No build, asset sync, upload, or restart was performed." >&2
  exit 1
fi

if [ -n "${RESET_CONFIRM:-}" ]; then
  echo "ABORT: RESET_CONFIRM is set. QA deploy never accepts reset confirmation." >&2
  exit 1
fi

echo "=== QA deploy preflight ==="
git status --short
if [ -n "$(git status --porcelain)" ]; then
  echo "ABORT: Working tree must be clean." >&2
  exit 1
fi
if [ "$(git branch --show-current)" != "main" ]; then
  echo "ABORT: Current branch must be main." >&2
  exit 1
fi

git fetch origin main
local_head="$(git rev-parse HEAD)"
origin_head="$(git rev-parse origin/main)"
echo "Local main:  $local_head"
echo "Origin main: $origin_head"
if [ "$local_head" != "$origin_head" ]; then
  echo "ABORT: Local main does not match origin/main. Push or reconcile before QA deploy." >&2
  exit 1
fi

echo "=== Checks and API build ==="
npm run check
npm run build:packages
npm run build -w @matriva/api
node tools/test-guide-asset-delivery.mjs

test -f packages/shared/dist/index.js
test -f packages/api-client/dist/index.js
test -f apps/api/dist/server.js
test -d apps/api/dist/migrations
test -f apps/api/dist/migrations/0030_guide_open_events_v1.sql
test -f apps/api/dist/migrations/0031_user_task_cluster_analytics_v1.sql

echo "=== QA S3 asset sync and delivery variants ==="
export MATRIVA_ENVIRONMENT=qa
export MATRIVA_STORAGE_ADAPTER=s3
export DATABASE_URL="$QA_DATABASE_URL"
node tools/ingest-guide-visual-assets.mjs
node tools/backfill-guide-asset-variants.mjs

echo "=== Upload API runtime ==="
ssh "$remote_host" "set -eu; mkdir -p '$remote_root/packages/shared/dist' '$remote_root/packages/api-client/dist' '$remote_root/apps/api/dist'"
rsync -a --delete packages/shared/dist/ "$remote_host:$remote_root/packages/shared/dist/"
rsync -a --delete packages/api-client/dist/ "$remote_host:$remote_root/packages/api-client/dist/"
rsync -a --delete apps/api/dist/ "$remote_host:$remote_root/apps/api/dist/"
rsync -a app.mjs "$remote_host:$remote_root/app.mjs"

local_api_sha="$(shasum -a 256 apps/api/dist/server.js | awk '{print $1}')"
remote_api_sha="$(ssh "$remote_host" "sha256sum '$remote_root/apps/api/dist/server.js' | awk '{print \$1}'")"
if [ "$local_api_sha" != "$remote_api_sha" ]; then
  echo "ABORT: Remote API build checksum does not match local build." >&2
  exit 1
fi

ssh "$remote_host" "set -eu; test -f '$remote_root/packages/shared/dist/index.js'; test -f '$remote_root/packages/api-client/dist/index.js'; test -f '$remote_root/apps/api/dist/server.js'; test -f '$remote_root/apps/api/dist/migrations/0030_guide_open_events_v1.sql'; test -f '$remote_root/apps/api/dist/migrations/0031_user_task_cluster_analytics_v1.sql'"

echo "=== Restart QA API ==="
if [ -n "${QA_RESTART_COMMAND:-}" ]; then
  echo "Running configured remote restart command."
  ssh "$remote_host" "$QA_RESTART_COMMAND"
else
  if [ ! -t 0 ]; then
    echo "ABORT: QA_RESTART_COMMAND is not set and this is not an interactive terminal." >&2
    echo "Runtime was uploaded but not restarted. Restart the KonsoleH QA Node application, then rerun with QA_RESTART_COMMAND or interactively." >&2
    exit 2
  fi
  echo "Upload is complete. Restart the QA Node application in KonsoleH now."
  echo "Press Enter only after the restart has completed."
  read -r
fi

echo "=== Wait for QA health ==="
deadline="$(( $(date +%s) + health_timeout ))"
while :; do
  if curl --fail --silent --show-error --location "$QA_BASE_URL/health" >/dev/null; then
    break
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ABORT: QA /health did not return HTTP 2xx within ${health_timeout}s." >&2
    exit 1
  fi
  sleep 3
done

echo "=== Verify QA runtime ==="
npm run verify:qa-runtime

echo "=== QA deploy complete ==="
echo "Commit: $local_head"
echo "Remote: $remote_host:$remote_root"
echo "No commit, push, database reset, or local-object deletion was performed."
