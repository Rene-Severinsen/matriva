# Recommendation, applicability and house-facts contract V1

Status: normative V1 contract.

## Canonical recommendations

Matriva's canonical recommendation is an editorially owned catalog row identified by the stable pair `catalogKey` and `catalogVersion`. A catalog row owns the title, description, timing defaults, recurrence, priority, safety disclaimer and optional guide link. It is not a user task and it is not user-authored content.

V1 contains 50 active canonical recommendations in `apps/api/src/maintenance-catalog.ts`. Existing keys remain stable, including `gutters_clean` (Rens tagrender) and `wetroom_joints_check` (Kontroller fuger i vådrum), and their guide links continue to be resolved from the existing guide seeds.

## Applicability

The persisted `eligibility_rules` JSON uses this vocabulary:

- `UNIVERSAL`: relevant without technical house knowledge. Examples include smoke alarms, visible moisture checks and general safety checks.
- `REQUIRES_COMPONENT`: relevant when a component is positively known to be present. A known absent component filters the recommendation; an unknown component is `possible`, not `false`.
- `EXCLUDES_COMPONENT`: filters a recommendation only when the excluded component is positively known to be present.
- `ENRICHED_BY_FACTS`: remains eligible without enrichment and may be made more specific when facts are available.

`unknown != false`. Missing BBR data, missing user data and provider limitations must never be converted into absence. The API may use `possible` in the catalog, while the personalized recommendation feed only creates instances whose applicability is `relevant`.

## House facts, components and tasks

Structured knowledge is stored on the house in `house_facts` and `house_components`:

- A fact is a typed value such as `bbr.heating.type`, `gutters.material` or `heat_pump.model`.
- A component is a stable house-level entity/status such as `heat_pump`, `roof`, `wetroom` or `gas_boiler`, with `present`, `absent` or `unknown` status and optional attributes.
- A maintenance task is an execution record. It may snapshot recommendation lineage, but it is never the source of truth for house facts.

BBR is an applicability input, not a canonical content author. Current V1 derives heating facts/components from the existing normalized BBR mapping and uses known building/material/basement/wetroom signals where available. No AI or manual-scanning pipeline is part of V1.

## Progressive profiling

Enrichment is contextual and optional. The app can ask for one relevant fact/component when a recommendation is opened; the user may skip it and continue. Answers are written to the house/component endpoint and reused by later recommendation evaluations. Producer, model and installation-year values fit the same fact/component model and can later be populated by manual or AI enrichment without changing the schema.

User answers remain house data. They are never automatically promoted to canonical Matriva recommendations or guides.

## Recommendation rules source and housing gate

The approved V1 recommendation rules are maintained in `docs/product/maintenance-recommendation-rules.xlsx`, sheet `Proposed Rules`. The `Recommendations` sheet is the historical/current-state baseline before V1 and is preserved for comparison; `Proposed Rules` is the approved source-of-truth. The workbook is not read by production runtime. `node tools/generate-maintenance-rules.mjs` validates the sheet and generates the versioned TypeScript ruleset at `apps/api/src/generated/maintenance-recommendation-rules.ts`; `npm run check:maintenance-rules` fails if the generated file is stale. Generated rules must not be edited manually: changes go through workbook → validator/generator → regression tests.

Runtime evaluates the housing-type gate before applicability. The gate uses explicit BBR/public-data signals from `building.use`, the primary unit's `housingType`, and `property.propertyType`: building use 120/110 maps to `villa`, 121/122/130/131/132 to `row_house`, 140 or property type 3 to `apartment`, and unit/building summer-house signals to `summer_house`. Conflicting or incomplete signals map to `unknown`; unknown does not apply housing-type exclusions. A `CONDITIONAL` housing value returns `possible` and is not eligible until the required evidence is available.

The generated catalog applicability rules are then evaluated using the existing component/fact engine. Housing metadata and `responsibility_scope` remain rule metadata; responsibility scope is not inferred from BBR and is not used as an implicit runtime exclusion.

## Catalog and entitlements

`GET /v1/houses/:houseId/maintenance-catalog?scope=all` exposes the complete active catalog to both Free and Pro. `scope=recommended` returns the currently relevant subset. The UI may label entries `Relevant for dit hus`, `Muligvis relevant` or `Ikke relevant ud fra dine husdata` without hiding the catalog.

Catalog visibility is separate from activation entitlement. Creating/accepting a task remains backend-authoritative and uses the existing `tasks.maxActive` limit for active `user_created` tasks. There is no recommendation-specific Free limit. Pro uses the existing Pro entitlement. System-generated and recommendation-accepted tasks continue to be excluded from user-created task usage under the existing entitlement contract.

## Future content-gap analytics

V1 does not create analytics jobs or canonical content automatically. The separate catalog key/version, guide link, house facts/components and task-cluster lineage provide the future join points for comparing BBR/house facts, canonical recommendations, guides and user task clusters.
