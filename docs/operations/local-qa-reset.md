# Safe local/QA reset procedure

This procedure is documentation only. Codex did not execute a reset.

The reset command must be run from the repository with an explicit environment and confirmation:

```bash
MATRIVA_ENVIRONMENT=local RESET_CONFIRM=WIPE_MATRIVA_TEST_DATA DATABASE_URL='<local-test-url>' npm run db:reset-test
```

For QA, use the same command with `MATRIVA_ENVIRONMENT=qa` and the QA-only connection string after an operator has explicitly approved the wipe. Never pass a production connection string.

The reset implementation must refuse every value other than `local` or `qa`, require the exact confirmation string, and reject connection hosts or database names identified as production. It should execute `TRUNCATE ... RESTART IDENTITY CASCADE` only for the allow-listed Matriva test database, then run the normal API migration runner. Credentials and connection strings must never be logged.

There is no production reset procedure. Production data must be preserved and any production cleanup requires a separately reviewed migration or incident process.

## QA user/house data reset

This is a separate, narrower operation. It only accepts `MATRIVA_ENVIRONMENT=qa` and the exact confirmation `WIPE_MATRIVA_QA_USER_HOUSE_DATA`. It explicitly deletes user/house data in dependency order, preserves `schema_migrations`, `user_roles`, and `maintenance_catalog_items`, and preserves every user that has any role in `user_roles` (including the permanent super-admin). It aborts if the expected current schema is incomplete or if an unexpected public foreign-key relation is detected.

Dry-run first; output contains table names and counts only:

```bash
MATRIVA_ENVIRONMENT=qa RESET_CONFIRM=WIPE_MATRIVA_QA_USER_HOUSE_DATA DRY_RUN=1 DATABASE_URL='<qa-only-url>' npm run db:reset-qa-user-house-data
```

After reviewing the counts, run the same command without `DRY_RUN=1` only with explicit operator approval:

```bash
MATRIVA_ENVIRONMENT=qa RESET_CONFIRM=WIPE_MATRIVA_QA_USER_HOUSE_DATA DATABASE_URL='<qa-only-url>' npm run db:reset-qa-user-house-data
```

The database reset does not delete object-storage objects. The API uses the environment prefix `qa/houses/<house_id>/photos/` for house photos and `qa/houses/<house_id>/documents/` for documents. Because database rows are removed first, a DB-only reset leaves orphaned S3 objects. A separate, reviewed cleanup must list and delete only those two prefixes for house IDs captured before the reset, after independently verifying the QA endpoint and bucket. Never perform a bucket-wide delete and never log access keys or object contents.

## QA-deployplan

QA is not wiped by this task. For a later controlled QA deployment:

1. Inform active QA testers and pause their test sessions.
2. Verify the desired backup/restore point.
3. Deploy the API code and migrations using the existing deployment procedure.
4. Manually run the exact reset with `MATRIVA_ENVIRONMENT=qa RESET_CONFIRM=WIPE_MATRIVA_TEST_DATA` and the QA-only `DATABASE_URL`.
5. Restart the QA API using the normal operations procedure.
6. Run the multi-user smoke scenario, then invite QA testers again.
7. Verify that the same BFE resolves to one house with multiple memberships.
