# Apple billing support timeline

The API remains the source of truth for feature access. The admin user detail shows the evaluated entitlement beside the latest Apple subscription record and a paginated event timeline. `PURCHASE_SYNC` is a signed transaction submitted by the app; other entries are App Store Server Notifications V2. A transaction's purchase date, Apple notification signed date, subscription expiration, server receipt, and server processing time are distinct timestamps.

## Ingestion and evidence

- Verify the outer notification JWS and each present signed transaction and renewal JWS against the configured pinned Apple root. An absent renewal JWS is recorded as not provided; it is not treated as a failed signature.
- Persist the compact signed strings verbatim in `billing_events`. Store decoded transaction and renewal data separately. The general `payload` column contains the decoded notification without embedded signed transaction or renewal strings for new events.
- Store notification UUID, type, subtype, signed time, transaction IDs, environment, product, signature results, processing steps, processing result, attempt count, and correlation ID. `processed` means the subscription and entitlement transaction committed. `unmatched` and `failed` remain visible and do not claim access was changed.
- A verified notification that cannot be matched to a user, or is already being processed, receives HTTP 503 so Apple is not told it succeeded. Apple retries failed production notifications, but not sandbox notifications. When the app later syncs a verified purchase, the backend replays up to 100 previously unmatched signed notifications for that original transaction; failures remain visible for investigation. Older or additional missed events require notification-history reconciliation.
- Renewals, billing retry, grace period, refunds, and expiration use the notification type plus verified signed data. Current auto-renewal details come only from signed renewal data. Older purchase syncs cannot replace a newer notification state.
- The timeline loads 100 events per page using an ID cursor. Older rows remain readable with `legacy_unknown` processing state; compact JWS strings that were not saved before migration cannot be recreated.

## Access and privacy

All raw payload endpoints use the existing `SUPER_ADMIN` guard, validate that the event belongs to the requested user, disable HTTP caching, and record every view/copy/download action in `billing_payload_access_audit`. The ordinary user and billing list endpoints never return signed strings. The admin browser loads raw evidence only after an explicit click.

The raw Apple transaction can contain an app account token, storefront, purchase and offer information. Access to the admin database and backups therefore governs its retention and deletion, including the existing user deletion behavior. Do not forward raw JWS to analytics, query parameters, or general server logs. Structured server logs contain only event and transaction IDs, status, duration, and error codes. Apple does not provide the customer's Apple ID or card details in these JWS payloads.

## Platform and operations

This work changes API and admin only; mobile purchase permissions and Google Play integration do not change. Monthly and yearly Matriva product IDs are permitted by the API, while the existing mobile paywall still offers the configured monthly product. Production notification and transaction evidence requires a separately deployed API and real Apple Sandbox or production traffic. A local test certificate is only useful for code tests, never as proof of Apple's live delivery.
