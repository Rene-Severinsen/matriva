# Architecture

Matriva is a clean-sheet React Native / Expo and Node.js TypeScript monorepo.

The mobile app should remain a native shell for backend-driven cards, tasks, entitlements, and dynamic content. The backend is the source of truth.

## Public House Data

Saved houses can be enriched with public BBR data through the backend-owned Datafordeler integration. After a house is successfully persisted, the API starts a best-effort public-data refresh in-process. House creation does not wait for Datafordeler and must still return the saved house when public-data enrichment is unavailable or fails.

The mobile app receives a compact `house_public_data_summary.v1` read model from the Matriva API. The summary is built from `house_public_data.v1` snapshots and focuses on product-safe public facts such as use, area, construction year, rooms, heating, and relevant physically existing product buildings. Raw provider payloads, Datafordeler request details, credentials, and technical upstream errors remain server-side.

Public BBR data is separate from user-owned house data. BBR refreshes do not overwrite user-owned house identity or user-created maintenance data. User confirmation for ambiguous public records and maintenance-rule generation from public data are outside this scope.

The current automatic trigger is a temporary V1 operational compromise, not a permanent queue. Its in-process dedupe only applies within one API process. If the process stops before the refresh completes, or if multiple API instances handle the same house, the trigger can be missed or duplicated. Snapshot persistence remains idempotent enough for repeated refreshes: failed or unavailable attempts are recorded without replacing an existing usable current snapshot.
