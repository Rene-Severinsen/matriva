# ADR-0007: Datafordeler BBR Integration Strategy

## Status

Accepted

## Context

Matriva needs future enrichment from BBR through Datafordeler so a selected DAWA address can eventually produce more relevant house profiles, maintenance guidance, and backend-driven cards.

Matriva 2.0 is a clean-sheet native-first Expo/React Native app with backend-owned architecture. The mobile app is a thin native shell and must not call DAWA, BBR, Datafordeler, storage, databases, or other private/public upstream data sources directly.

The future Hetzner-hosted API and PostgreSQL backend will become the source of truth. The API must own private credentials, upstream contracts, mapping, caching, audit metadata, and dynamic cards/content.

BBR REST has deprecation risk toward the end of 2026. Before live BBR mapping is implemented, Matriva must evaluate the future direction across BBR GraphQL, API-key based access, and OAuth-based access.

## Decision

Datafordeler/BBR integration is backend-owned.

The mobile app may only see Matriva API contracts. It must never receive or depend on Datafordeler/BBR credentials, upstream request shapes, upstream response shapes, or private integration details.

`DATAFORDELER_API_KEY`, `DATAFORDELER_BASE_URL`, and `DATAFORDELER_AUTH_MODE` are handled only in the API runtime environment. Values must live only in local developer env or hosting secret configuration.

The API helper may expose only safe status and availability information. It must never expose secret values, derived credential material, or upstream payload details.

Skeleton and preview data must be clearly marked as not verified.

Verified BBR data may only be marked as verified after live integration, mapping, source timestamp handling, caching, and audit support are implemented.

No live BBR mapping is implemented in this task.

## Consequences

The `/v1/house-drafts/enrich` endpoint can keep returning a skeleton contract while the API reports whether Datafordeler config is missing, unsupported, or configured but not yet usable.

The mobile app remains decoupled from Datafordeler/BBR choices and can continue to render Matriva-owned response contracts.

Future backend work must choose and document the live integration direction before binding contracts to a specific BBR REST, GraphQL, API-key, or OAuth shape.

## Future Work

Caching strategy must be designed before live enrichment is enabled. It must cover TTL, source timestamps, manual refresh, stale-data warnings, and how cached enrichment affects dynamic cards.

Audit strategy must be designed before live enrichment is enabled. It must cover request metadata, upstream status, enrichment version, and operational diagnostics without logging secrets or person-sensitive payloads.

Live mapping must define how source timestamps, field provenance, mapping versions, partial failures, and stale data are represented in backend-owned contracts.

## Alternatives Considered

Calling Datafordeler/BBR directly from the mobile app was rejected because it would expose private credentials or upstream contracts and make the app own integration behavior.

Committing placeholder credentials or example secret values was rejected because secrets and secret-like values must never be stored in code, tests, fixtures, logs, README, or generated output.

Implementing live BBR mapping now was rejected because BBR REST has deprecation risk and the future GraphQL/API-key/OAuth direction needs assessment first.

## Security / Privacy Impact

Secrets remain API-runtime only.

API status helpers may reveal whether configuration is complete, but never the underlying secret values.

Logs and audit records must avoid secrets and person-sensitive upstream payloads.

## Operational Impact

Hosting configuration must provide Datafordeler env values only through secret configuration when live integration is later implemented.

Unsupported `DATAFORDELER_AUTH_MODE` values must keep the integration unavailable until corrected.

The skeleton endpoint must continue to warn that returned data is not verified BBR data.
