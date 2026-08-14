import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluateMaintenanceApplicability,
  maintenanceCatalogItems
} from "../apps/api/src/maintenance-catalog.ts";
import { guideContentSeeds } from "../apps/api/src/guide-content.ts";

const emptyState = { components: {}, facts: {} };

test("V1 catalog contains 50 unique canonical recommendations", () => {
  assert.equal(maintenanceCatalogItems.length, 50);
  assert.equal(new Set(maintenanceCatalogItems.map((item) => item.catalogKey)).size, 50);
});

test("existing guide-linked canonical keys remain stable", () => {
  const keys = new Set(maintenanceCatalogItems.map((item) => item.catalogKey));
  assert(keys.has("gutters_clean"));
  assert(keys.has("wetroom_joints_check"));
  for (const guide of guideContentSeeds) assert(keys.has(guide.catalogLink.catalogKey));
});

test("universal recommendations are relevant without house facts", () => {
  const smokeAlarm = maintenanceCatalogItems.find((item) => item.catalogKey === "smoke_alarm_check");
  assert(smokeAlarm);
  assert.equal(evaluateMaintenanceApplicability(smokeAlarm.eligibilityRules, emptyState).status, "relevant");
});

test("gas boiler recommendation is filtered when a heat pump is known", () => {
  const gas = maintenanceCatalogItems.find((item) => item.catalogKey === "gas_boiler_service");
  assert(gas);
  const result = evaluateMaintenanceApplicability(gas.eligibilityRules, {
    components: { heat_pump: "present", gas_boiler: "absent" },
    facts: { "bbr.heating.type": "heat_pump" }
  });
  assert.equal(result.status, "not_relevant");
  assert.equal(result.eligible, false);
});

test("unknown heating data is not treated as false", () => {
  const gas = maintenanceCatalogItems.find((item) => item.catalogKey === "gas_boiler_service");
  assert(gas);
  const result = evaluateMaintenanceApplicability(gas.eligibilityRules, emptyState);
  assert.equal(result.status, "possible");
  assert.equal(result.eligible, false);
});

test("enrichment-dependent recommendations keep working without enrichment", () => {
  const roof = maintenanceCatalogItems.find((item) => item.catalogKey === "roof_surface_check");
  assert(roof);
  const result = evaluateMaintenanceApplicability(roof.eligibilityRules, emptyState);
  assert.equal(result.status, "relevant");
  assert.equal(result.eligible, true);
});

test("house enrichment is persisted as reusable house/component data", () => {
  const migration = readFileSync(new URL("../apps/api/src/migrations/0032_recommendation_applicability_house_facts_v1.sql", import.meta.url), "utf8");
  const db = readFileSync(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  assert.match(migration, /create table if not exists house_facts/);
  assert.match(migration, /create table if not exists house_components/);
  assert.match(db, /upsertHouseFactForHouse/);
  assert.match(db, /upsertHouseComponentForHouse/);
});

test("catalog visibility is not gated by a recommendation-specific entitlement", () => {
  const server = readFileSync(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
  const db = readFileSync(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  assert.match(server, /maintenance-catalog/);
  assert.match(db, /scope: "recommended" \| "all"/);
  assert.match(db, /where is_active/);
});

test("existing task entitlements remain the activation authority", () => {
  const db = readFileSync(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  assert.match(db, /assertLimit\(\s*"tasks\.maxActive"/s);
  assert.match(db, /t\.source = 'user_created'/);
  assert.match(db, /tasks\.maxActive.*null/s);
});
