# ADR-0012: Admin Foundation And Super Admin Role

## Status

Accepted

## Context

Matriva needs a separate browser-based admin module before external testing.
The admin surface will expose operational data across users and houses over
time, so admin authorization cannot rely on frontend checks, request-supplied
roles, or direct database access from the browser.

The existing V1 authentication decision uses backend-owned magic links,
opaque access tokens, refresh-token rotation, and PostgreSQL as source of truth.
The mobile app must keep its existing session flow.

## Decision

Matriva Admin v1 starts as a separate `apps/admin` webapp in the monorepo.
It uses React, TypeScript, and Vite, and calls the Matriva API over HTTP.
The browser admin app does not access PostgreSQL directly.

Admin sessions reuse the existing magic-link and bearer-token contracts.
The browser keeps the access token in memory and may keep the refresh token in
`sessionStorage` for reload restore. Cookie-based SSO is out of scope.

Admin authorization is backend-owned through `user_roles`.
The first supported role is `SUPER_ADMIN`.
The permanent superuser email `rene@joinit.dk` is normalized by the backend and
provisioned idempotently as `SUPER_ADMIN` when present or when the user is later
created/authenticated.

Admin API routes must use a central admin authorization boundary that:

* validates the existing access token
* derives identity from the backend session
* loads backend-owned roles
* rejects authenticated non-admin users with forbidden
* never trusts role, email, or user ID values supplied by the client

## Consequences

The admin frontend can display admin state, but it cannot grant access.
Future admin read APIs can use the same authorization boundary without weakening
ordinary owner-scoped mobile routes.

Admin write actions still need an audit-log decision before implementation.
Dashboard metrics, user lists, house lists, recommendation analytics, and role
management remain separate scopes.

## Compliance Impact

The API remains the data boundary for privacy, authorization, and secret
handling. Browser CORS is restricted to explicit admin origins and does not use
wildcard origins.

## Test And Rollout Requirements

Admin foundation must cover:

* missing and invalid bearer token rejection
* authenticated non-admin forbidden response
* permanent superuser idempotent provisioning
* limited admin bootstrap response
* no auth/session secret leakage in admin bootstrap
* existing auth routes continuing to work
* admin app typecheck and build
