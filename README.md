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

The API exposes:

```text
GET http://localhost:4000/health
GET http://localhost:4000/v1/bootstrap
GET http://localhost:4000/v1/addresses/search?q=Rådhuspladsen 1
POST http://localhost:4000/v1/house-drafts
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
```

`GET /v1/addresses/search` is the backend-owned address search contract. The mobile app must call the Matriva API, not DAWA/Dataforsyningen directly. The API currently uses DAWA/Dataforsyningen (`https://api.dataforsyningen.dk/adresser?q=`) as the address source and returns normalized `AddressSuggestion` objects with Matriva-owned `addr_<opaque>` suggestion IDs. BBR/Datafordeler lookup is not implemented yet.

`POST /v1/house-drafts` is a development-only skeleton contract for validating the next onboarding step after a user selects a DAWA address. The request must send DAWA source references (`source`, `sourceAddressId`, optional `sourceAccessAddressId`, and `label`), not the request-local `addr_<opaque>` suggestion ID. The response returns a `house_draft_<opaque>` draft and skeleton backend-driven Home cards. It does not use a database, does not implement auth, and does not fetch BBR/Datafordeler data yet.

Run the mobile app:

```sh
npm run dev:mobile
```

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
