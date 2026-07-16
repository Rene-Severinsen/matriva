# ADR-0009: Public Data Snapshot And Relational Persistence

## Status

Accepted

## Context

Matriva enriches user-owned houses with public Danish housing data from BBR through Datafordeler. The upstream data is external source data and must not become Matriva's internal house identity.

The product needs both auditability of the provider response and stable, queryable product fields for house profile, maintenance logic, and future backend-driven cards.

## Decision

Public BBR enrichment uses a hybrid persistence model:

* raw provider snapshot stored as JSONB
* normalized Matriva public-data contract stored as JSONB
* selected normalized entities stored relationally for buildings, units, floors, and parcels

Snapshots are immutable. A successful, partial, or ambiguous snapshot may become current for a house inside the same transaction that stores its normalized rows. Failed or unavailable provider attempts are recorded, but they do not replace an existing current successful snapshot.

External identifiers such as DAR address ID, BBR building ID, BBR unit ID, BBR floor ID, BBR ground ID, BFE number, and cadastral parcel ID are stored as source identifiers, not Matriva domain IDs.

## Consequences

Matriva can preserve source evidence while exposing a stable backend-owned contract to mobile clients.

Future remapping can create a new snapshot without mutating earlier source evidence.

User-owned house facts remain separate from public source data and are not overwritten by BBR refreshes.

## Security / Privacy Impact

Datafordeler credentials are read only from API runtime environment variables. They are not stored in snapshots, fixtures, logs, responses, or documentation.

Raw provider payloads are persisted server-side only and are not returned to mobile clients.

## Operational Impact

Database size will grow with snapshots. Later production work should define retention, refresh cadence, operator diagnostics, and audit/export behavior for public source snapshots.
