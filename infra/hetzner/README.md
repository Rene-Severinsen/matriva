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
5. Restart the QA Node application, either through `QA_RESTART_COMMAND` or
   through the explicit KonsoleH manual gate when no restart command is
   configured.
6. Verify `/health`, guide analytics, every guide asset exposed by the Admin
   API, optimized WebP delivery, task-cluster API responses, and applied
   migrations 0030/0031.

The deployment never resets the database, deletes S3 objects, deletes local
objects, changes guide publication status, or commits/pushes Git changes.

The operator supplies secrets through the environment, not through this repo:

```text
QA_BASE_URL=https://<qa-api-host>
QA_DATABASE_URL=<QA-only PostgreSQL URL ending in /matriva_qa>
QA_ADMIN_ACCESS_TOKEN=<temporary QA admin bearer token>
MATRIVA_S3_ENDPOINT=...
MATRIVA_S3_BUCKET=...
MATRIVA_S3_ACCESS_KEY_ID=...
MATRIVA_S3_SECRET_ACCESS_KEY=...
```

The runtime verifier expects the current QA guides `rens_tagrender` and
`tjek_fuger_vaadrum`. Override this only when the QA fixture intentionally
changes, using `QA_EXPECTED_GUIDE_KEYS=key1,key2`.

Optional values are `QA_REMOTE_HOST` (default `ravena-prod`),
`QA_REMOTE_ROOT` (default `/usr/home/b9kady/matriva-qa`),
`QA_HEALTH_TIMEOUT_SECONDS` (default `90`) and `QA_RESTART_COMMAND`.
`QA_RESTART_COMMAND`, when supplied, is executed remotely over SSH and must
be the already-approved command for restarting the KonsoleH QA Node
application. If it is omitted, the script pauses for the operator to restart
the application manually.

The one-time migration of existing QA local objects to S3 is a separate,
reviewed operation. It must be completed and independently verified before
switching the QA runtime to S3. The normal deployment only writes
repository-managed guide originals and their delivery variants; it does not
guess at or delete user-uploaded object prefixes.
