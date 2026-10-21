# Subscription screen

The subscription screen uses backend `entitlements.accessPlan` and expiry to
distinguish Free, active PRO and complimentary PRO. A stored plan assignment or
an unverified StoreKit callback never grants access. Dates are access-period
endpoints, not a claim about automatic renewal. Expired cached access is not
displayed as active PRO. The server remains responsible for enforcement.

Active store subscribers see their access period, usage and an Apple subscription
management action instead of another purchase button. Free users see current Free
limits, PRO benefits and a choice between monthly and yearly products. Both prices
come localized from StoreKit, and the selected product ID is the one sent to Apple.
Complimentary PRO is identified as free access, with permanent or dated access.
Billing issues direct users to Apple management rather than another purchase.
Android displays current access but does not offer Google Play purchases.

Bootstrap is refreshed on entry and foreground return, including returning from
Apple subscription management. Stale refresh responses cannot replace a newer
purchase sync response. Purchase and restore results immediately update both the
screen and the app's shared bootstrap entitlements. Store transactions are still
sent to the existing authenticated Apple sync endpoint and finished only after
the backend accepts them. Restoration uses active purchases from the store rather
than waiting on a possibly stale hook state. Only the configured PRO product is
synced, oldest first if multiple records are returned.

## Data, platform and review impact

No additional backend fields, migrations, permissions, analytics or SDKs.
Existing entitlement/usage data is presented in plain Danish. No transaction
tokens are logged. Apple management uses the installed expo-iap management API.
The configured products default to `matriva.pro.monthly` and
`matriva.pro.yearly`; they can be overridden by `EXPO_PUBLIC_MATRIVA_APPLE_PRO_PRODUCT_ID`
and `EXPO_PUBLIC_MATRIVA_APPLE_PRO_YEARLY_PRODUCT_ID`. Neither price is hardcoded
in app UI. The monthly product is selected by default.
Existing App Store terms and purchase confirmation remain handled by Apple.
No change to privacy inventory or Google billing support.

Text scales with device accessibility settings. Actions have at least 44-point
touch targets, button roles, disabled states, readable contrast and wrapping
layouts. Backend/store failures use readable retry and restoration messages.

## Verification

- `node --experimental-strip-types --test tools/test-subscription-presentation.mjs`
- `npm run typecheck -w @matriva/mobile`
- Offline Expo iOS export validates Metro/Hermes bundling without starting an EAS build.
- `node tools/preview-subscription.mjs`: renders the actual presentation component
  through HTML primitives with fixture data, checks Free/PRO action visibility,
  and writes a design preview into `/private/tmp/matriva-subscription-preview`.
  This is a layout preview, not StoreKit or native-device runtime proof.

Native acceptance in the next iOS build: open with an active subscription, Free
account, complimentary access and expired access; purchase and restore in Sandbox;
cancel an Apple purchase sheet; return from subscription management; test offline
bootstrap/store failures and large text. Confirm that the active account never
shows a purchase CTA and global limits update after successful verification.
Review the Android access-only state on device as part of the next Android test.
