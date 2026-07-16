# ADR-0008: Native Authentication With Magic Links

## Status

Accepted

## Context

Matriva needs a production user foundation before houses, tasks, documents, entitlements, deletion, export, and notifications can be trusted. The previous `DevUser` boundary was useful for persistence smoke tests, but it must not remain the normal runtime identity.

The app is native-first with Expo and the backend is the source of truth. Authentication must therefore work on iOS and Android without moving identity decisions into the mobile client.

## Decision

Matriva V1 uses email magic links as the primary login method.

The backend owns users, profiles, magic-link tokens, token expiry, token consumption, sessions, refresh-token rotation, onboarding state, house ownership, task authorization, logout invalidation, and audit-relevant auth events.

Passwords, password reset, OAuth, Sign in with Apple, Google login, and SMS login are not implemented now. The schema can support future login methods through new decisions, but this task does not add unused provider abstractions.

Magic links use `matriva://auth/magic-link?token=...` for the native development flow. Universal links and Android app links require later domain files, hosted association statements, signing details, and production deployment configuration. The app parses and consumes the internal route now; no fake production domain is hardcoded.

## Session Model

Magic-link tokens are cryptographically random, stored only as SHA-256 hashes, expire after a short TTL, and are single-use. Reuse, expiry, and unknown tokens do not create sessions.

After a valid magic link, the API issues an opaque short-lived access token and a longer-lived refresh token. The database stores token hashes, not raw token values. Refresh rotates both access and refresh tokens on every successful refresh.

The mobile app stores session credentials only in Expo SecureStore. Auth secrets must not be placed in AsyncStorage.

Logout invalidates the active backend session when possible. If the backend is unavailable, the app still removes local credentials so the device no longer has usable stored auth; the server-side session will remain valid until expiry or later invalidation.

## Backend Ownership And Authorization

Mobile never sends email or user ID as ownership proof. Protected routes derive user identity from the bearer access token.

Houses are owned by `users.id`. Maintenance task access is authorized through the authenticated user's house ownership. Opaque IDs remain identifiers only; they are not access control.

`/v1/app-bootstrap` returns current user, profile, backend-computed onboarding state, the primary house, entitlements, and cards. The mobile app follows this state instead of defining the authoritative onboarding rule locally.

## Migration From DevUser

Existing `dev_users` data is preserved. The migration creates matching `users` and `user_profiles` rows, maps existing houses from `dev_user_id` to `user_id`, and keeps `dev_users` only as an explicit development fixture boundary.

The existing `rene@joinit.dk` development data is linked to a real `users` row without deleting houses, drafts, tasks, or relations.

## Email Delivery

Magic-link email delivery is a backend-owned boundary. Local development defaults to an explicit console transport that returns a development-only link for smoke testing, so tests do not send real email accidentally.

Production email uses SMTP over STARTTLS via `mail.your-server.de` on port `587`. `MATRIVA_MAIL_TRANSPORT=smtp` must be set explicitly, and SMTP credentials must come only from environment/secret configuration. The sender and SMTP user are `login@matriva.dk`.

Raw magic-link tokens must not be written to production logs. Development exposure is limited to the explicit console/dev response path.

## Consequences

Matriva now has a real production user boundary for V1 features.

Future Apple/Google login can be added later through a separate ADR by creating sessions for an already verified backend user identity. Password login remains out of scope unless a later product decision accepts its recovery, storage, abuse, and support costs.
