# ADR-0011: Backend-Owned Maintenance Recommendation Catalog

## Status

Accepted

## Context

Maintenance v1 already separates pending recommendations from accepted user tasks.
Generic Matriva recommendations need a stable catalogue, audit-friendly instances,
dismissal per period, and permanent house-scoped hiding without moving catalogue
logic into the mobile app.

## Decision

Matriva uses a backend-owned, versioned maintenance recommendation catalogue.
Active catalogue versions are synced idempotently into PostgreSQL
`maintenance_catalog_items`. The mobile app receives only generated recommendation
instances through the Matriva API and must not contain catalogue entries or
eligibility logic.

Relevant catalogue items are materialized as `maintenance_recommendations` rows
for a house and period key. The existing recommendation table is the instance
model: it keeps status, suggested date, period, catalogue key/version,
eligibility snapshot, and the accepted task relation. This preserves the
existing API resource family and avoids a parallel active recommendation table.

Accepting a recommendation creates an ordinary editable maintenance task with
`source = recommendation_accepted`. The task stores catalogue lineage and an
origin snapshot. Later catalogue changes do not mutate accepted or historical
tasks.

After accept, task recurrence is the only recurrence mechanism. Completion keeps
the existing flow: a completion snapshot is written, the task becomes done, and
the recurring successor inherits the origin catalogue lineage. Active tasks or
successors with the same origin catalogue key block new catalogue instances.

Permanent hiding is scoped to `house_id + catalog_key` in
`maintenance_recommendation_hides`. It applies across catalogue versions for the
same house. V1 does not include UI to undo hides, but the data model supports
future unhide.

V1 only supports explicit `universal_house` eligibility. Unknown eligibility
rules are rejected safely and do not generate recommendations.

## Consequences

The backend remains the source of truth for catalogue content, eligibility,
periods, suggested dates, duplicate blocking, acceptance, dismissal, and hides.
Mobile stays a native shell for displaying and acting on API results.

The V1 catalogue intentionally avoids BBR-derived or uncertain recommendations.
Manual tasks without catalogue lineage do not block recommendations, because
semantic title matching is too brittle for V1.
