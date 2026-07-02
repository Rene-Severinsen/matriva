# ADR-0004: Backend-Controlled Entitlements

## Status

Accepted

## Context

Matriva uses a Free/Pro model. Pro may unlock higher document limits, full maintenance plans, advanced reminders, local homeowner advisories, legal/regulatory updates, secure sharing/export, and extended history.

Feature access must remain consistent across devices, platforms, subscription states, refunds, revocations, downgrades, and future billing integrations.

## Decision

Matriva feature access is controlled by backend-owned entitlements.

The backend is the source of truth for entitlement status.

The app must not hardcode access using only a plan name such as `free` or `pro`.

The mobile app may cache entitlement state for user experience, but it must handle stale, expired, revoked, or unavailable entitlement state safely.

Payment integration will be implemented later.

RevenueCat, StoreKit, Google Play Billing, or another billing abstraction must not be added without a separate architecture decision.

If a user downgrades from Pro to Free, Matriva must not automatically delete private user data. The system must instead handle read-only and over-limit states clearly and restrict creation of new Pro-only resources where relevant.

## Consequences

Feature gates should be expressed through entitlement keys and limits rather than plan-name checks.

The API client and mobile app should be prepared to receive entitlement status and use safe fallback behavior.

Backend implementation must eventually account for trials, active subscriptions, grace periods, billing issues, expiry, cancellation, refunds, and revocations.

## Alternatives Considered

Hardcoded plan checks in the app were rejected because they are brittle, hard to revoke, and unsafe across billing edge cases.

Immediate billing SDK integration was rejected for the foundation because payment integration is not part of the first skeleton task and requires separate App Store / Google Play review documentation.

Deleting data on downgrade was rejected because it would create privacy, trust, support, and compliance risks.

## App Store / Google Play Impact

Subscription implementation must eventually document Apple App Store impact, Google Play impact, product IDs, entitlement mapping, trial/intro offer behavior, cancellation/expired behavior, refund/revocation handling, and backend webhook behavior.

Paywalls must avoid dark patterns, misleading trials, hidden renewal terms, and confusing subscription states.

## Security / Privacy Impact

Backend-controlled entitlements allow the server to enforce access even when cached app state is stale.

Downgrades must preserve private data unless the user explicitly deletes it or a documented retention policy applies.

## Operational Impact

The backend must eventually process billing webhooks, reconcile subscription status, expose entitlement state, and handle billing provider outages safely.

If billing status cannot be verified, the app and backend must fail safely without silently granting inappropriate access.
