# Safe local/QA reset procedure

This procedure is documentation only. Codex did not execute a reset.

The reset command must be run from the repository with an explicit environment and confirmation:

```bash
MATRIVA_ENVIRONMENT=local RESET_CONFIRM=WIPE_MATRIVA_TEST_DATA DATABASE_URL='<local-test-url>' npm run db:reset-test
```

For QA, use the same command with `MATRIVA_ENVIRONMENT=qa` and the QA-only connection string after an operator has explicitly approved the wipe. Never pass a production connection string.

The reset implementation must refuse every value other than `local` or `qa`, require the exact confirmation string, and reject connection hosts or database names identified as production. It should execute `TRUNCATE ... RESTART IDENTITY CASCADE` only for the allow-listed Matriva test database, then run the normal API migration runner. Credentials and connection strings must never be logged.

There is no production reset procedure. Production data must be preserved and any production cleanup requires a separately reviewed migration or incident process.

## QA-deployplan

QA is not wiped by this task. For a later controlled QA deployment:

1. Inform active QA testers and pause their test sessions.
2. Verify the desired backup/restore point.
3. Deploy the API code and migrations using the existing deployment procedure.
4. Manually run the exact reset with `MATRIVA_ENVIRONMENT=qa RESET_CONFIRM=WIPE_MATRIVA_TEST_DATA` and the QA-only `DATABASE_URL`.
5. Restart the QA API using the normal operations procedure.
6. Run the multi-user smoke scenario, then invite QA testers again.
7. Verify that the same BFE resolves to one house with multiple memberships.
