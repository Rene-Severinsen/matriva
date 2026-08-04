# ADR-0013: Property identity and multi-user house memberships

## Status

Accepted for the Matriva property model migration.

## Decision

`houses.id` remains Matriva's internal primary key. `houses.bfe_number` is the official external property identity and is stored as text. Active houses have a partial unique index on BFE, so one physical property can have only one active Matriva row.

Access is represented by `house_memberships`, not by `houses.user_id`. Existing `user_id` data is retained as legacy metadata during migration, while all house-level authorization uses an active membership. Memberships are time-bounded and revoked rather than hard-deleted, which supports household changes and ownership changes while preserving shared property history.

When a BFE already exists and the requesting user has no membership, Matriva creates a `house_claim` and exposes only neutral text. Existing member identities are not disclosed. The first version uses manual admin approval. Invitations are one-time, expire after seven days, and store only a hash of the token.

No permanent active house is created without a verified BFE. BFE identification happens before house creation, and the database constraint remains the final race-condition guard.

House-scoped tasks, completions, recommendations, documents, improvements, document relations, and photos are shared after membership authorization. Their existing `user_id` values remain creator/actor audit data; they are not access predicates. Public-data snapshots are already house-scoped.

## Why no household table

A separate household entity would add another ownership and lifecycle concept before the product needs it. The property plus temporal memberships model supports the current requirements and can later be extended with private scopes without changing property identity.

## Privacy and future work

Onboarding must not reveal existing members, emails, or member counts. Existing house documents and notes may contain personal information despite being house-linked. A future scope model should distinguish `property_shared`, `household_private`, and `user_private`; that is intentionally outside this migration.
