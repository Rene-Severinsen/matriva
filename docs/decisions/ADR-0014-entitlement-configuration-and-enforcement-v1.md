# ADR-0014: Persistent entitlement configuration and atomic enforcement

## Status

Accepted

## Decision

Matriva stores plan configuration in `entitlement_plan_configs` and an optional per-user assignment in `user_entitlements`. Missing assignment means the safe Free access state. A Pro assignment grants Pro configuration only while its status is `trial`, `active`, or `grace_period` and it has not expired; other billing-like statuses fail closed to Free feature access while remaining visible to the client and Admin.

The API evaluates entitlements, current usage, and limits. Create-house, document-upload, and user-created-task operations acquire a per-user PostgreSQL transaction advisory lock before counting and inserting. This makes the Free limits safe under parallel requests. User-created task usage includes only active `user_created` tasks; generated and recommendation-accepted tasks are intentionally excluded.

Plan configuration writes are Admin-only and are recorded in `entitlement_audit_log`. Pro limits are nullable in configuration to represent an explicitly configured unlimited value; no Pro price or payment provider is part of this decision.

## Defaults

Free defaults are one active house, two active documents, 10 MB total active document storage, and four active user-created tasks. Existing data is not deleted when access changes. Existing over-limit data remains readable, while new constrained writes are rejected with stable entitlement error codes and machine-readable limit details.

## Consequences

The mobile app can display backend-provided access and usage, but it cannot grant access. Feature flags and limits can be changed from Admin without a mobile release. Billing integration may later populate `user_entitlements` with `source = billing` without changing API enforcement.

`sharing.enabled` is an outgoing capability: it controls whether the current user may invite another person to a house. Accepting a valid invitation is an inbound access grant and must not require the recipient to have `sharing.enabled`; therefore a Free user may receive shared house access without being able to create invitations.
