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

test("component-specific recommendations require positive evidence", () => {
  for (const componentKey of [
    "basement",
    "chimney",
    "gas_boiler",
    "oil_boiler",
    "heat_pump",
    "district_heating",
    "ventilation",
    "heat_recovery",
    "drainage"
  ]) {
    const result = evaluateMaintenanceApplicability(
      { type: "REQUIRES_COMPONENT", componentKey },
      { components: {}, facts: {} }
    );
    assert.equal(result.status, "not_relevant", `${componentKey} must not be recommended when unknown`);
    assert.equal(result.eligible, false, `${componentKey} must not be eligible when unknown`);

    const present = evaluateMaintenanceApplicability(
      { type: "REQUIRES_COMPONENT", componentKey },
      { components: { [componentKey]: "present" }, facts: {} }
    );
    assert.equal(present.status, "relevant", `${componentKey} must be relevant when present`);
    assert.equal(present.eligible, true, `${componentKey} must be eligible when present`);
  }
});

test("composite component requirements use strict all and any semantics", () => {
  const requiresAll = { type: "REQUIRES_COMPONENT", requiresAll: ["basement", "basement_ventilation"] };
  assert.equal(
    evaluateMaintenanceApplicability(requiresAll, { components: { basement: "present" }, facts: {} }).status,
    "not_relevant"
  );
  assert.equal(
    evaluateMaintenanceApplicability(requiresAll, {
      components: { basement: "present", basement_ventilation: "present" },
      facts: {}
    }).status,
    "relevant"
  );
  assert.equal(
    evaluateMaintenanceApplicability(requiresAll, {
      components: { basement: "present", basement_ventilation: "unknown" },
      facts: {}
    }).eligible,
    false
  );

  const requiresAny = { type: "REQUIRES_COMPONENT", requiresAny: ["wood_stove", "fireplace", "chimney"] };
  assert.equal(
    evaluateMaintenanceApplicability(requiresAny, { components: { fireplace: "present" }, facts: {} }).status,
    "relevant"
  );
  assert.equal(
    evaluateMaintenanceApplicability(requiresAny, { components: { chimney: "unknown" }, facts: {} }).status,
    "not_relevant"
  );
});

test("unknown enrichment data does not block relevant recommendations", () => {
  for (const factKey of ["gutters.material", "bbr.roof.material_code", "bbr.facade.material_code", "bbr.ground.sewer"]) {
    const result = evaluateMaintenanceApplicability(
      { type: "ENRICHED_BY_FACTS", factKeys: [factKey] },
      { components: {}, facts: {} }
    );
    assert.equal(result.status, "relevant", `${factKey} must remain relevant without enrichment`);
    assert.equal(result.eligible, true, `${factKey} must remain eligible without enrichment`);
  }
});

test("catalog dependency classifications protect installation-specific tasks", () => {
  const byKey = new Map(maintenanceCatalogItems.map((item) => [item.catalogKey, item]));
  for (const [catalogKey, componentKey] of [
    ["basement_damp_check", "basement"],
    ["district_heating_unit_check", "district_heating"],
    ["gas_boiler_service", "gas_boiler"],
    ["oil_boiler_service", "oil_boiler"],
    ["heat_pump_service", "heat_pump"],
    ["ventilation_filter_check", "ventilation"],
    ["heat_recovery_check", "heat_recovery"]
  ]) {
    const item = byKey.get(catalogKey);
    assert(item);
    assert.equal(item.eligibilityRules.type, "REQUIRES_COMPONENT");
    assert.equal(item.eligibilityRules.componentKey, componentKey);
  }
  const basementVentilation = byKey.get("basement_ventilation_check");
  assert(basementVentilation);
  assert.deepEqual(basementVentilation.eligibilityRules.requiresAll, ["basement", "basement_ventilation"]);
  const chimney = byKey.get("chimney_and_flashing_check");
  assert(chimney);
  assert.deepEqual(chimney.eligibilityRules.requiresAny, ["chimney", "wood_stove", "fireplace"]);
  assert.equal(byKey.get("smoke_alarm_check")?.eligibilityRules.type, "UNIVERSAL");
  assert.equal(byKey.get("wetroom_joints_check")?.eligibilityRules.type, "UNIVERSAL");
});

test("Ringstedgade-like house cannot receive basement or chimney recommendations", () => {
  const byKey = new Map(maintenanceCatalogItems.map((item) => [item.catalogKey, item]));
  const ringstedgade = {
    components: {
      basement: "absent",
      heating_system: "present",
      gas_boiler: "present",
      chimney: "unknown",
      supplementary_heating: "absent"
    },
    facts: {
      "bbr.heating.type": "natural_gas",
      "bbr.heating.supplementary": "absent"
    }
  };

  for (const catalogKey of ["basement_ventilation_check", "chimney_and_flashing_check"]) {
    const item = byKey.get(catalogKey);
    assert(item);
    const result = evaluateMaintenanceApplicability(item.eligibilityRules, ringstedgade);
    assert.equal(result.status, "not_relevant", `${catalogKey} must not be relevant for Ringstedgade`);
    assert.equal(result.eligible, false, `${catalogKey} must not be eligible for Ringstedgade`);
  }

  const universal = byKey.get("smoke_alarm_check");
  assert(universal);
  assert.equal(evaluateMaintenanceApplicability(universal.eligibilityRules, ringstedgade).status, "relevant");
});

test("unknown required heating data is not recommended", () => {
  const gas = maintenanceCatalogItems.find((item) => item.catalogKey === "gas_boiler_service");
  assert(gas);
  const result = evaluateMaintenanceApplicability(gas.eligibilityRules, emptyState);
  assert.equal(result.status, "not_relevant");
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

test("BBR explicitly records zero basement area as absent without inventing unknown absence", () => {
  const db = readFileSync(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  assert.match(db, /delete from house_facts where house_id = \$1 and source = 'bbr'/);
  assert.match(db, /delete from house_components where house_id = \$1 and source = 'bbr'/);
  assert.match(db, /basementAreas = buildings\.flatMap/);
  assert.match(db, /basementAreas\.some\(\(area\) => area > 0\) \? "present" : "absent"/);
  assert.match(db, /if \(basementAreas\.length > 0\)/);
});

test("catalog visibility is not gated by a recommendation-specific entitlement", () => {
  const server = readFileSync(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
  const db = readFileSync(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  assert.match(server, /maintenance-catalog/);
  assert.match(db, /scope: "recommended" \| "all"/);
  assert.match(db, /where is_active/);
});

test("all catalog scope can display non-applicable entries without relabeling them as relevant", () => {
  const db = readFileSync(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../apps/mobile/src/App.tsx", import.meta.url), "utf8");
  assert.match(db, /\.filter\(\(item\) => scope === "all" \|\| item\.relevance === "relevant"\)/);
  assert.match(app, /const scopedItems = scope === "recommended"/);
  assert.match(app, /: items;/);
  assert.match(app, /"Ikke relevant ud fra dine husdata"/);
});

test("existing task entitlements remain the activation authority", () => {
  const db = readFileSync(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  assert.match(db, /assertLimit\(\s*"tasks\.maxActive"/s);
  assert.match(db, /t\.source = 'user_created'/);
  assert.match(db, /tasks\.maxActive.*null/s);
});

test("mobile maintenance keeps tasks and recommendation discovery in separate views", () => {
  const app = readFileSync(new URL("../apps/mobile/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /title=\"Find opgaver\"/);
  assert.match(app, /onOpenAllRecommendations=\{\(\) => openMaintenanceView\("catalog", "main"\)\}/);
  assert.match(app, /onOpenItem=\{onOpenCatalogItem\}/);
  assert.match(app, /function FindTasksLinkRow/);
  assert.match(app, /onOpenFindTasks=\{\(\) => \{[\s\S]*setMaintenanceView\("catalog"\)/);
  const maintenanceScreenIndex = app.indexOf("function MaintenanceScreen(");
  const findTasksIndex = app.indexOf(
    '<FindTasksLinkRow onPress={onOpenAllRecommendations} />',
    maintenanceScreenIndex
  );
  const filtersIndex = app.indexOf('<View style={styles.maintenanceFilterGrid}>', maintenanceScreenIndex);
  assert(findTasksIndex > maintenanceScreenIndex && findTasksIndex < filtersIndex);
  assert.doesNotMatch(app, /requestCatalogEnrichment/);
});

test("mobile maintenance keeps future deadline tasks out of the current season", () => {
  const app = readFileSync(new URL("../apps/mobile/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /function isTaskInCurrentSeason\(task: MaintenanceTask\)/);
  assert.match(app, /task\.timing\.dueDate\.slice\(0, 4\) === todayDateOnly\(\)\.slice\(0, 4\)/);
  assert.match(app, /filter === "current" \|\| filter === "all"\) \{\s*return isTaskInCurrentSeason\(task\);/s);
});

test("mobile maintenance sorts undated tasks before ascending deadlines", () => {
  const app = readFileSync(new URL("../apps/mobile/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /if \(!aDueDate && bDueDate\) \{\s*return -1;/s);
  assert.match(app, /const laterTasks = takeSectionTasks\(filteredTasks\)\.sort\(compareMaintenanceTasksByDueDate\)/);
  assert.match(app, /\)\.sort\(compareMaintenanceTasksByDueDate\)\s*\);\s*const laterTasks/s);
});

test("mobile recommendation detail uses optional inline house enrichment", () => {
  const app = readFileSync(new URL("../apps/mobile/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /Om dit hus/);
  assert.match(app, /onSaveEnrichment=\{\(input\) => void saveCatalogEnrichment\(input\)\}/);
  assert.match(app, /Nu hvor opgaven er tilføjet, kan du udfylde oplysninger om dit hus/);
  assert.match(app, /Føj til Mine opgaver/);
  assert.doesNotMatch(app, /Har huset komponenten \$\{applicability\.componentKey\}/);
});

test("mobile catalog reflects an already activated recommendation task", () => {
  const app = readFileSync(new URL("../apps/mobile/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /task\.originCatalogKey === item\.catalogKey/);
  assert.match(app, /Allerede tilføjet til Mine opgaver/);
  assert.match(app, /Åbn i Mine opgaver/);
});

test("re-selecting an archived recommendation reopens the existing task", () => {
  const db = readFileSync(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  assert.match(db, /set status = 'pending',[\s\S]*accepted_task_id = \$4/);
  assert.match(db, /set archived_at = null,[\s\S]*status = case when status = 'dismissed' then 'planned'/);
  assert.match(db, /existingTask\.archived_at/);
});
