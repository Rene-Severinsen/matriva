#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

remote_host="${QA_REMOTE_HOST:-ravena-prod}"
remote_root="${QA_REMOTE_ROOT:-/usr/home/b9kady/matriva-qa}"
health_timeout="${QA_HEALTH_TIMEOUT_SECONDS:-90}"
remote_user="${QA_REMOTE_USER:-b9kady}"
qa_service_name="${QA_SERVICE_NAME:-nodejs_b9kady_760_D0703219126.service}"
qa_node_binary="${QA_NODE_BINARY:-/usr/local/nodejs/24/bin/node}"
qa_api_entrypoint="${QA_API_ENTRYPOINT:-apps/api/dist/server.js}"
qa_base_url="${QA_BASE_URL:-https://api-qa.matriva.dk}"

for command_name in git npm node rsync ssh curl; do
  command -v "$command_name" >/dev/null || {
    echo "ABORT: Required command not found: $command_name" >&2
    exit 1
  }
done

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
remote_qa_api_pid() {
  ssh "$remote_host" "
    set -eu
    pid=\$(ps -eo pid=,user=,args= | awk '\$2 == \"$remote_user\" && \$3 == \"$qa_node_binary\" && \$4 == \"$qa_api_entrypoint\" { print \$1; exit }')
    test -n \"\$pid\"
    test \"\$(readlink /proc/\$pid/cwd)\" = \"$remote_root\"
    grep -Fq \"$qa_service_name\" /proc/\$pid/cgroup
    printf '%s\\n' \"\$pid\"
  "
}

old_pid="$(remote_qa_api_pid)"
remote_env_value() {
  local key="$1"
  ssh "$remote_host" "
    set -eu
    tr '\\0' '\\n' < /proc/$old_pid/environ | awk -F= -v wanted='$key' '\$1 == wanted { sub(/^[^=]*=/, \"\", \$0); print; exit }'
  "
}

remote_storage_adapter="$(remote_env_value MATRIVA_STORAGE_ADAPTER)"
if [ "$remote_storage_adapter" != "s3" ]; then
  echo "ABORT: QA host is configured with MATRIVA_STORAGE_ADAPTER=$remote_storage_adapter." >&2
  echo "Set the persistent KonsoleH service environment to MATRIVA_STORAGE_ADAPTER=s3 before deploying." >&2
  exit 1
fi

if [ -z "${QA_DATABASE_URL:-}" ]; then
  QA_DATABASE_URL="$(remote_env_value DATABASE_URL)"
fi
if [ -z "${MATRIVA_S3_ENDPOINT:-}" ]; then
  MATRIVA_S3_ENDPOINT="$(remote_env_value MATRIVA_S3_ENDPOINT)"
  MATRIVA_S3_BUCKET="$(remote_env_value MATRIVA_S3_BUCKET)"
  MATRIVA_S3_REGION="$(remote_env_value MATRIVA_S3_REGION)"
  MATRIVA_S3_ACCESS_KEY_ID="$(remote_env_value MATRIVA_S3_ACCESS_KEY_ID)"
  MATRIVA_S3_SECRET_ACCESS_KEY="$(remote_env_value MATRIVA_S3_SECRET_ACCESS_KEY)"
fi
export QA_DATABASE_URL MATRIVA_S3_ENDPOINT MATRIVA_S3_BUCKET MATRIVA_S3_REGION
export MATRIVA_S3_ACCESS_KEY_ID MATRIVA_S3_SECRET_ACCESS_KEY
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

local_api_sha="$(shasum -a 256 apps/api/dist/server.js | awk '{print $1}')"
remote_api_sha="$(ssh "$remote_host" "sha256sum '$remote_root/apps/api/dist/server.js' | awk '{print \$1}'")"
if [ "$local_api_sha" != "$remote_api_sha" ]; then
  echo "ABORT: Remote API build checksum does not match local build." >&2
  exit 1
fi

ssh "$remote_host" "set -eu; test -f '$remote_root/packages/shared/dist/index.js'; test -f '$remote_root/packages/api-client/dist/index.js'; test -f '$remote_root/apps/api/dist/server.js'; test -f '$remote_root/apps/api/dist/migrations/0030_guide_open_events_v1.sql'; test -f '$remote_root/apps/api/dist/migrations/0031_user_task_cluster_analytics_v1.sql'"

echo "=== Graceful restart QA API via host supervisor ==="
old_pid="$(remote_qa_api_pid)"
echo "Current QA API PID: $old_pid"

ssh "$remote_host" "kill -TERM '$old_pid'"

restart_deadline="$(( $(date +%s) + health_timeout ))"
new_pid=""
while [ "$(date +%s)" -lt "$restart_deadline" ]; do
  new_pid="$(ssh "$remote_host" "ps -eo pid=,user=,args= | awk '\$2 == \"$remote_user\" && \$3 == \"$qa_node_binary\" && \$4 == \"$qa_api_entrypoint\" { print \$1; exit }'" || true)"
  if [ -n "$new_pid" ] && [ "$new_pid" != "$old_pid" ]; then
    if ssh "$remote_host" "test \"\$(readlink /proc/$new_pid/cwd)\" = \"$remote_root\" && grep -Fq \"$qa_service_name\" /proc/$new_pid/cgroup"; then
      break
    fi
  fi
  sleep 2
done

if [ -z "$new_pid" ] || [ "$new_pid" = "$old_pid" ]; then
  echo "ABORT: Host supervisor did not start a replacement QA API process." >&2
  exit 1
fi
echo "Replacement QA API PID: $new_pid"

echo "=== Wait for QA health ==="
deadline="$(( $(date +%s) + health_timeout ))"
while :; do
  if curl --fail --silent --show-error --location "$qa_base_url/health" >/dev/null; then
    break
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ABORT: QA /health did not return HTTP 2xx within ${health_timeout}s." >&2
    exit 1
  fi
  sleep 3
done

echo "=== Verify QA runtime ==="
export QA_BASE_URL="$qa_base_url"
npm run verify:qa-runtime

echo "=== QA deploy complete ==="
echo "Commit: $local_head"
echo "Remote: $remote_host:$remote_root"
echo "No commit, push, database reset, or local-object deletion was performed."
