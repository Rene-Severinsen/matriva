# Hetzner

QA and production must use S3-compatible object storage for every API-managed
object: guide assets, house photos, and house documents. Local file storage is
reserved for local development and automated tests.

The Hetzner runtime must provide these values through the hosting environment
configuration, never through committed files:

```text
MATRIVA_ENVIRONMENT=qa            # production on the production runtime
MATRIVA_STORAGE_ADAPTER=s3
MATRIVA_S3_ENDPOINT=...
MATRIVA_S3_REGION=...
MATRIVA_S3_BUCKET=...
MATRIVA_S3_ACCESS_KEY_ID=...
MATRIVA_S3_SECRET_ACCESS_KEY=...
MATRIVA_S3_FORCE_PATH_STYLE=true
MATRIVA_S3_PRIVATE_OBJECTS=true
```

The API fails closed at startup when QA or production is configured for local
storage or when the S3 configuration is incomplete. Before switching an
existing runtime, copy and verify its local objects in the target bucket; only
then restart the API with `MATRIVA_STORAGE_ADAPTER=s3`. Do not delete local
objects until the S3 copy has been independently verified.

No secrets should be committed here.

## QA deployment

The canonical QA deployment entrypoint is:

```sh
npm run deploy:qa
```

Run it from a clean local `main` checkout. The command refuses to deploy when
the branch differs from `origin/main`, when the working tree is dirty, when
the required S3/QA variables are missing, or when `RESET_CONFIRM` is present.

The deploy performs these operations in order:

1. Run the repository checks and build the shared, API-client and API runtime.
2. Verify that the API build contains migrations `0030_guide_open_events_v1.sql`
   and `0031_user_task_cluster_analytics_v1.sql`.
3. Idempotently ingest repository-managed guide originals into the QA S3
   prefix and backfill the content-addressed WebP delivery variants. The
   source files and database checksums are verified before a variant is made.
4. Upload the runtime to the fixed QA runtime root and verify the API build
   checksum and required remote files.
5. Gracefully terminate the exact QA API process. The Hetzner host supervisor
   starts the replacement process automatically; `systemctl` access is not
   required from the SSH shell.
6. Verify `/health`, supervisor replacement, applied migrations 0030/0031,
   and—when a temporary Admin token is supplied—guide analytics, every guide
   asset exposed by the Admin API, optimized WebP delivery, and task-cluster
   API responses.

The deployment never resets the database, deletes S3 objects, deletes local
objects, changes guide publication status, or commits/pushes Git changes.

The deploy reuses the existing QA runtime configuration on Hetzner. It reads
the current API process environment over the existing SSH account for the QA
database and S3 asset sync; values are held in memory and never printed. The
operator may override these values through the environment, but does not need
to copy them into the local shell for a normal deploy:

```text
QA_BASE_URL=https://<qa-api-host>
QA_DATABASE_URL=<QA-only PostgreSQL URL ending in /matriva_qa>
QA_ADMIN_ACCESS_TOKEN=<optional temporary QA admin bearer token>
```

If `QA_ADMIN_ACCESS_TOKEN` is supplied, the runtime verifier also checks the
current QA guides `rens_tagrender` and `tjek_fuger_vaadrum`, every guide asset,
optimized WebP delivery, and task clusters. Without it, the deploy still
verifies health, migrations, and the supervisor replacement; authenticated
endpoint verification can be run separately with `npm run verify:qa-runtime`.
Override the expected guide keys only when the QA fixture intentionally
changes, using `QA_EXPECTED_GUIDE_KEYS=key1,key2`.

Optional values are `QA_REMOTE_HOST` (default `ravena-prod`),
`QA_REMOTE_ROOT` (default `/usr/home/b9kady/matriva-qa`),
`QA_HEALTH_TIMEOUT_SECONDS` (default `90`), `QA_REMOTE_USER` (default
`b9kady`), `QA_SERVICE_NAME` (default
`nodejs_b9kady_760_D0703219126.service`), `QA_NODE_BINARY` (default
`/usr/local/nodejs/24/bin/node`) and `QA_API_ENTRYPOINT` (default
`apps/api/dist/server.js`).

The restart is graceful: the script locates the exact QA API process, verifies
its runtime root and host-supervisor cgroup, sends `SIGTERM`, then waits for a
replacement process from the same supervisor before checking `/health`. It
refuses to kill a process when any of those identity checks fail.

The one-time migration of existing QA local objects to S3 is a separate,
reviewed operation. It must be completed and independently verified before
switching the QA runtime to S3. The normal deployment only writes
repository-managed guide originals and their delivery variants; it does not
guess at or delete user-uploaded object prefixes.
