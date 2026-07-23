# Matriva

Matriva 2.0 is a clean-sheet native-first homeowner app foundation.

The old prototype repository must not be used as the basis for this codebase. Development in this repository must follow:

* [MATRIVA_RULESET.md](./MATRIVA_RULESET.md)
* [MATRIVA_SCOPE_V1.md](./MATRIVA_SCOPE_V1.md)

## Direction

* One shared React Native / Expo codebase for iOS and Android
* No Firebase dependencies or Firebase architecture
* Hetzner-hosted API direction
* PostgreSQL as future source of truth
* Backend-controlled entitlements
* Backend-driven dynamic content/cards
* Free/Pro architecture prepared from the start

## Repository Layout

```text
apps/
  mobile/        Expo React Native TypeScript app skeleton
  api/           Node.js TypeScript API skeleton
packages/
  shared/        Shared types and schemas
  api-client/    Typed API client skeleton
docs/
  product/
  architecture/
  compliance/
  decisions/
infra/
  docker/
  hetzner/
```

## Local Setup

Install dependencies:

```sh
npm install
```

Run the API:

```sh
npm run dev:api
```

By default the API binds to `127.0.0.1:4000`. To make it reachable from a physical device on your local network, bind to all interfaces:

```sh
HOST=0.0.0.0 PORT=4000 npm run dev:api
```

Smoke-check API dev startup and `GET /health` without adding it to the full check pipeline:

```sh
npm run smoke:api:dev
```

Smoke-check the onboarding-preview API routes on a separate test port:

```sh
npm run smoke:api:routes
```

`smoke:api:dev` only verifies startup and `GET /health`. `smoke:api:routes` verifies the backend-owned onboarding-preview flow through `/health`, `/v1/bootstrap`, `/v1/addresses/search`, `/v1/house-drafts`, and `/v1/house-drafts/enrich`. It requires DAWA/address-search to be reachable through the Matriva API, but it does not call DAWA directly and does not perform live BBR/Datafordeler enrichment.

Smoke-check the BBR/public-data mapper with sanitized local fixtures:

```sh
npm run smoke:bbr
```

Run the mobile onboarding preview:

```sh
npm run dev:mobile
```

The mobile onboarding preview reads the API base URL from Expo public env:

```sh
EXPO_PUBLIC_MATRIVA_API_BASE_URL=http://127.0.0.1:4000 npm run dev:mobile
```

Run the local admin webapp:

```sh
npm run dev:admin
```

The admin app is a separate browser app in `apps/admin`. It expects the Matriva
API at `VITE_MATRIVA_API_BASE_URL`, defaulting locally to
`http://127.0.0.1:4000`. Local admin development uses
`http://127.0.0.1:5173`; the future production origin is
`https://admin.matriva.dk`.

Admin v1 reuses the existing magic-link/session API. Access tokens are held in
browser memory, refresh tokens may be kept in `sessionStorage` for reloads, and
`SUPER_ADMIN` authorization is enforced by the backend. The permanent
superuser is `rene@joinit.dk`. Admin v1 is read-only foundation work; dashboard
data, user lists, house lists, recommendation analytics, writes, role
management, and deployment are not implemented yet.

`apps/mobile/.env.example` documents the local default:

```text
EXPO_PUBLIC_MATRIVA_API_BASE_URL=http://127.0.0.1:4000
```

Do not put secrets in `EXPO_PUBLIC_` variables. Expo public env values are bundled into the mobile app. `EXPO_PUBLIC_*` must never be used for private upstream credentials. This setting is only development configuration for the temporary onboarding preview.

Server-side Datafordeler integration uses these API runtime env var names:

```text
DATAFORDELER_API_KEY
DATAFORDELER_GRAPHQL_URL
DATAFORDELER_TIMEOUT_MS
```

`DATAFORDELER_GRAPHQL_URL` defaults to `https://graphql.datafordeler.dk/flexibleCurrent/v1` if unset. The URL is not a secret. `DATAFORDELER_API_KEY` has no code default and may only live in local developer env or hosting secret configuration. Never commit secrets to code, docs, tests, fixtures, logs, or generated output.

Local URL notes:

* iOS simulator: usually `http://127.0.0.1:4000` or `http://localhost:4000`
* Android emulator: usually `http://10.0.2.2:4000`
* Physical device: start the API with `HOST=0.0.0.0`, then use the Mac's LAN IP, for example `http://192.168.x.x:4000`

The API exposes:

```text
GET http://localhost:4000/health
GET http://localhost:4000/v1/bootstrap
GET http://localhost:4000/v1/addresses/search?q=Rådhuspladsen 1
POST http://localhost:4000/v1/house-drafts
POST http://localhost:4000/v1/house-drafts/enrich
GET http://localhost:4000/v1/houses/:id/public-data
POST http://localhost:4000/v1/houses/:id/public-data/refresh
```

`GET /v1/bootstrap` is a development-only skeleton contract for validating the first shared domain/API shape: user summary, house summary, entitlements, and backend-driven Home cards. It is not a production feature, does not create seed data, does not use a database, and does not implement authentication.

The typed client can be used locally from `@matriva/api-client`:

```ts
import { createMatrivaApiClient } from "@matriva/api-client";

const client = createMatrivaApiClient({
  baseUrl: "http://127.0.0.1:4000"
});

const bootstrap = await client.getBootstrap();
const addresses = await client.searchAddresses("Rådhuspladsen 1");
const draft = await client.createHouseDraft({
  source: "DAWA",
  sourceAddressId: "dawa-address-id",
  sourceAccessAddressId: "dawa-access-address-id",
  label: "Rådhuspladsen 1, 1550 København V"
});

const enrichment = await client.enrichHouseDraft({
  houseDraftId: draft.houseDraft.id,
  selectedAddress: draft.houseDraft.selectedAddress
});
```

`GET /v1/app-bootstrap` is the authenticated app-start contract. It returns the current user, profile, backend-computed `onboarding.state`, houses owned by the current user, `activeHouseId`, entitlements, cards, and `generatedAt`. The mobile app must route from this backend-returned state instead of deriving onboarding completion locally.

`GET /v1/addresses/search` is the backend-owned address search contract. The mobile app must call the Matriva API, not DAWA/Dataforsyningen directly. The API currently uses DAWA/Dataforsyningen (`https://api.dataforsyningen.dk/adresser?q=`) as the address source and returns normalized `AddressSuggestion` objects with Matriva-owned `addr_<opaque>` suggestion IDs.

`POST /v1/house-drafts` is a development-only skeleton contract for validating the next onboarding step after a user selects a DAWA address. The request must send DAWA source references (`source`, `sourceAddressId`, optional `sourceAccessAddressId`, and `label`), not the request-local `addr_<opaque>` suggestion ID. The response returns a `house_draft_<opaque>` draft and skeleton backend-driven Home cards. It does not use a database, does not implement auth, and does not fetch BBR/Datafordeler data yet.

`POST /v1/house-drafts/enrich` remains a development-only skeleton contract for the non-persistent onboarding draft flow. Saved-house public data enrichment is implemented on authenticated house routes instead.

`GET /v1/houses/:id/public-data` returns the current backend-owned `house_public_data.v1` contract for a saved house owned by the session user. If no enrichment has run yet, it returns `status: "not_started"`.

`POST /v1/houses/:id/public-data/refresh` reads the house's stored DAR address identity, calls Datafordeler from the API process only, maps BBR source data into Matriva public-data entities, stores the raw provider snapshot as JSONB, stores normalized relation rows for buildings, units, floors, and parcels, and returns the stable `house_public_data.v1` response. The mobile app must not send BFE, ground ID, BBR IDs, or Datafordeler credentials.

The response separates:

* `buildings`: all normalized source buildings from the ground
* `productBuildings`: buildings included in normal product view, currently driven by lifecycle/status `6`
* `warnings`: data-quality warnings and partial mapping signals

Area mapping keeps BBR meanings separate:

* `enh027ArealTilBeboelse` is the primary residential unit area
* `enh026EnhedensSamledeAreal` remains unit total area
* `byg038SamletBygningsareal` remains total building area
* basement fields such as `eta022Kælderareal` and `eta023ArealAfLovligBeboelseIKælder` stay on floor data and are not automatically added to residential area

Codebooks are backend-owned and versioned. Returned code values include `code`, `label`, `known`, and `codebookKey`. Unknown codes are preserved with `known: false` and may produce `unknown_code` warnings.

Example local skeleton request:

```sh
curl -X POST http://127.0.0.1:4000/v1/house-drafts/enrich \
  -H "content-type: application/json" \
  -d '{"houseDraftId":"house_draft_demo12345","selectedAddress":{"source":"DAWA","sourceAddressId":"dawa-address-id","sourceAccessAddressId":"dawa-access-address-id","label":"Rådhuspladsen 1, 1550 København V"}}'
```

The mobile app starts with welcome/login, restores or refreshes the SecureStore session, loads `/v1/app-bootstrap`, then routes to profile onboarding, first-house creation, or the normal tab app according to backend-owned onboarding state. First-house creation reuses the Matriva API address and house flow; the mobile app must not call DAWA/Dataforsyningen directly.

Billing, push, and document upload are not implemented yet.

If `EXPO_PUBLIC_MATRIVA_API_BASE_URL` is not set, the onboarding preview falls back to `http://127.0.0.1:4000` and shows that fallback in the app.

## Quality Checks

```sh
npm run typecheck
npm run lint
npm run check
```

`npm run check` verifies that the workspace has no Firebase dependencies/references, no common hardcoded secret patterns, and passes package type/lint scripts.

## Current Foundation Only

This repository currently contains only the deployment-ready skeleton/foundation.

Not implemented yet:

* payment integration
* document upload
* push notifications
* database schema
* finished V1 screens or feature flows
* Firebase of any kind

Architectural uncertainty should be captured in `docs/decisions/` before implementation.


## Authentication foundation

Matriva uses backend-owned magic-link authentication for V1. Local development defaults to `MATRIVA_MAIL_TRANSPORT=console`, which exposes a development-only `devMagicLink` in the API response and console output. This keeps local tests from sending real email unless SMTP is explicitly enabled.

Production email uses `MATRIVA_MAIL_TRANSPORT=smtp` with STARTTLS SMTP through `mail.your-server.de:587`. Set `MATRIVA_SMTP_HOST=mail.your-server.de`, `MATRIVA_SMTP_PORT=587`, `MATRIVA_SMTP_USER=login@matriva.dk`, `MATRIVA_SMTP_FROM=login@matriva.dk`, and `MATRIVA_SMTP_PASSWORD` from secret environment configuration. SMTP credentials must not be committed to the repository.

For local development and automated tests only, `MATRIVA_AUTH_DISABLE_LIMITS=true` disables auth request limits so repeated magic-link requests can be generated without waiting. The API fails fast if this flag is enabled with `NODE_ENV=production`. Never enable it in production or shared production-like environments.

Native deep links use `matriva://auth/magic-link?token=...`. Universal links/app links still require production domain association files and platform signing configuration; no fake production domain is hardcoded.

Protected API calls require `Authorization: Bearer <accessToken>`. Refresh tokens rotate through `POST /v1/auth/refresh`, and logout invalidates the active session when the API is reachable.
