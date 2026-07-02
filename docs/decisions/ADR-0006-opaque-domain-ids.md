# ADR-0006: Opaque Domain IDs

## Status

Accepted

## Context

Matriva domain contracts need stable references for users, houses, cards, tasks, documents, and subscriptions. These references cross mobile, API, backend, audit, entitlement, and future storage boundaries.

Because Matriva handles sensitive home and person-related data, IDs must not leak private information or imply business logic that clients can depend on.

## Decision

Matriva domain IDs are opaque server-generated strings.

The format is a short domain prefix followed by a random opaque suffix:

* `usr_<opaque>`
* `house_<opaque>`
* `card_<opaque>`
* `task_<opaque>`
* `doc_<opaque>`
* `sub_<opaque>`
* `addr_<opaque>`
* `house_draft_<opaque>`

Clients must not parse IDs.

Clients must not generate server-owned domain IDs.

IDs must not contain personal data, address data, matrikelnummer, BBR ID, postal code, email, timestamp, sequence logic, or any other meaningful domain data.

IDs may only be used as opaque references.

The backend is responsible for ID generation and uniqueness.

## Consequences

Shared contracts can validate broad prefix shape, but they must not encourage clients to infer meaning beyond the resource family.

The API can change suffix generation strategy without breaking clients.

Debugging and logs can show resource family prefixes without exposing private source data.

## Alternatives Considered

Plain UUIDs were considered but rejected as the default contract shape because prefixes make API payloads and logs easier to inspect while still preserving opacity.

Sequential numeric IDs were rejected because they expose sequence logic and can encourage enumeration.

IDs derived from address, BBR data, matrikelnummer, email, timestamps, or other domain values were rejected because they can leak private information and create brittle coupling.

## App Store / Google Play Impact

Opaque IDs support clearer privacy documentation because identifiers do not embed personal, address, property, or regulatory data.

The app must not describe or rely on IDs as user-readable property data.

## Security / Privacy Impact

Opaque random suffixes reduce the risk of leaking sensitive data and make enumeration harder.

Authorization must still be enforced by the backend. Opaque IDs are not access control.

## Operational Impact

The backend must own ID generation, uniqueness checks, collision handling, and migration strategy if ID generation changes.

Logs and support tooling may use IDs for reference, but must not treat prefixes as permission or routing authority by themselves.
