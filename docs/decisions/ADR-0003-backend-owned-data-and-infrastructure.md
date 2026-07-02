# ADR-0003: Backend-Owned Data And Infrastructure

## Status

Accepted

## Context

Matriva needs clear ownership of data access to protect private user, house, document, subscription, entitlement, and dynamic content data.

Mobile clients are distributed, hard to revoke instantly, and reviewed by platform stores. Sensitive infrastructure access should therefore be centralized behind the Matriva API.

## Decision

Matriva uses backend-owned data access.

The mobile app must not communicate directly with databases, object storage, private infrastructure, subscription backends, entitlement stores, or dynamic content sources.

All access to user data, house data, documents, subscriptions, entitlements, and dynamic content must go through the Matriva API.

Direct client SDKs for data, storage, auth, backend, or infrastructure platforms must not be added without a separate ADR.

Third-party backend, BaaS, storage, auth, or infrastructure platforms require a separate architecture decision before implementation.

## Consequences

The API is responsible for authorization, validation, audit, data minimization, account deletion, data export, storage access, and compliance-relevant dataflows.

The mobile app should use typed API clients and shared schemas instead of private infrastructure SDKs.

Future feature work must define API contracts and backend behavior rather than bypassing the API from the app.

## Alternatives Considered

Direct mobile access to object storage was rejected because document access must be protected by backend authorization and revocation rules.

Direct mobile access to database services was rejected because it makes data deletion/export, auditing, and server-side policy enforcement harder to guarantee.

Client SDKs for third-party backend platforms were rejected as a default because they can introduce hidden dataflows, SDK privacy manifest requirements, and Google Data Safety impact.

## App Store / Google Play Impact

Centralizing data access through the API supports clearer App Store and Google Play review documentation.

Any future SDK that accesses user data, identifiers, documents, storage, auth, analytics, or subscriptions must be reviewed for Apple privacy manifest and Google Data Safety impact.

## Security / Privacy Impact

Backend-owned access improves privacy, security, auditability, account deletion, GDPR export/delete, and data minimization.

The mobile app should hold only the data needed for the current user experience and must handle stale or revoked access safely.

## Operational Impact

The backend must provide reliable API availability and clear error behavior because the app cannot fall back to private infrastructure access.

Operational tooling must support audit trails, revocation, backups, export/delete flows, and incident response.
