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

Run the mobile onboarding preview:

```sh
npm run dev:mobile
```

The mobile onboarding preview reads the API base URL from Expo public env:

```sh
EXPO_PUBLIC_MATRIVA_API_BASE_URL=http://127.0.0.1:4000 npm run dev:mobile
```

`apps/mobile/.env.example` documents the local default:

```text
EXPO_PUBLIC_MATRIVA_API_BASE_URL=http://127.0.0.1:4000
```

Do not put secrets in `EXPO_PUBLIC_` variables. Expo public env values are bundled into the mobile app. This setting is only development configuration for the temporary onboarding preview.

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

`GET /v1/addresses/search` is the backend-owned address search contract. The mobile app must call the Matriva API, not DAWA/Dataforsyningen directly. The API currently uses DAWA/Dataforsyningen (`https://api.dataforsyningen.dk/adresser?q=`) as the address source and returns normalized `AddressSuggestion` objects with Matriva-owned `addr_<opaque>` suggestion IDs. Live BBR/Datafordeler lookup is not implemented yet.

`POST /v1/house-drafts` is a development-only skeleton contract for validating the next onboarding step after a user selects a DAWA address. The request must send DAWA source references (`source`, `sourceAddressId`, optional `sourceAccessAddressId`, and `label`), not the request-local `addr_<opaque>` suggestion ID. The response returns a `house_draft_<opaque>` draft and skeleton backend-driven Home cards. It does not use a database, does not implement auth, and does not fetch BBR/Datafordeler data yet.

`POST /v1/house-drafts/enrich` is a development-only skeleton contract for future BBR/Datafordeler enrichment of a selected DAWA address. BBR/Datafordeler enrichment is backend-owned: the mobile app must call the Matriva API and must not call Datafordeler directly. The endpoint may return a skeleton response when local Datafordeler credentials are missing or while the live adapter is not implemented. It does not use a database, does not implement auth, and does not persist enrichment data.

Example local skeleton request:

```sh
curl -X POST http://127.0.0.1:4000/v1/house-drafts/enrich \
  -H "content-type: application/json" \
  -d '{"houseDraftId":"house_draft_demo12345","selectedAddress":{"source":"DAWA","sourceAddressId":"dawa-address-id","sourceAccessAddressId":"dawa-access-address-id","label":"Rådhuspladsen 1, 1550 København V"}}'
```

Future server-side Datafordeler integration may use these env var names: `DATAFORDELER_USERNAME`, `DATAFORDELER_PASSWORD`, and `DATAFORDELER_BASE_URL`. Do not commit credential values to the repository.

The mobile app currently shows a temporary onboarding preview for the first narrow product flow: search for an address, choose a DAWA-backed suggestion returned by Matriva API, create a skeleton house draft, and show the first backend-driven skeleton cards. It uses `@matriva/api-client`; the mobile app must not call DAWA/Dataforsyningen directly.

This preview is not finished V1 product UI. Auth, database persistence, live BBR/Datafordeler enrichment, billing, push, and document upload are not implemented yet.

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
