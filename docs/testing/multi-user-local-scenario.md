# Lokal multi-user smoke-scenario

This scenario is documented for manual execution after an explicitly approved local reset. It is not run automatically by Codex.

```text
MATRIVA_ENVIRONMENT=local RESET_CONFIRM=WIPE_MATRIVA_TEST_DATA DATABASE_URL='<local-test-url>' npm run db:reset-test
```

Use two test users, Cecilie and Emil, and `Ringstedgade 130, 4700 Næstved`.

1. Cecilie selects the address; Datafordeler resolves the BFE and creates one house plus owner membership.
2. Emil selects the same address and receives neutral `claim_required`; no second house is created.
3. Cecilie invites Emil. The invitation email contains a `matriva://house-invitation?token=...` link; only the hash is stored.
4. Emil opens the link, logs in with the invited email if needed, and is added as a member.
5. Cecilie creates a task; Emil sees and completes it. Both see the shared completion history.
6. Emil uploads a document and creates an improvement; Cecilie can read and edit the house-scoped records.
7. Refreshing BBR from either session updates the same current house snapshot.
8. Revoke or end Emil's membership; subsequent house APIs return `house_not_found`, while the house and history remain.

Verify that onboarding never displays existing members, email addresses, or technical identifiers.
