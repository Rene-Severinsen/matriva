import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  evaluateMaintenanceCatalogApplicability,
  maintenanceCatalogItems,
  recommendedPeriodLabel
} from "../apps/api/src/maintenance-catalog.ts";
import { deriveMaintenanceHousingType } from "../apps/api/src/maintenance-housing-type.ts";
import { MAINTENANCE_RULESET_VERSION } from "../apps/api/src/generated/maintenance-recommendation-rules.ts";

const CANONICAL_KEYS = new Set(maintenanceCatalogItems.map((item) => item.catalogKey));
const APPLY = process.argv.includes("--apply");

export function assertQaDatabaseUrl(value) {
  if (!value) throw new Error("QA_DATABASE_URL or DATABASE_URL is required.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("The database URL is not a valid URL.");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("The reconciliation only supports a PostgreSQL database URL.");
  }
  const host = parsed.hostname.toLowerCase();
  const database = parsed.pathname.replace(/^\//, "").toLowerCase();
  if (/(prod|production|live|primary)/i.test(`${host}/${database}`)) {
    throw new Error("Refusing a production-like database target.");
  }
  if (!/(^|[_-])qa([_-]|$)/i.test(database)) {
    throw new Error(`Refusing database ${database || "<unknown>"}; database name must identify QA.`);
  }
  return value;
}

export function isRelevantResult(result) {
  return result?.status === "relevant" && result?.eligible === true;
}

export function classifyStaleRecommendation(recommendation, result, currentVersion) {
  if (recommendation.source_type !== "matriva_catalog") return { stale: false, reason: "non_catalog_source" };
  if (recommendation.accepted_task_id) return { stale: false, reason: "accepted_task_preserved" };
  if (recommendation.status !== "pending") return { stale: false, reason: "not_pending" };
  if (!isRelevantResult(result)) return { stale: true, reason: result?.status ?? "not_relevant" };
  if (recommendation.catalog_version !== currentVersion) return { stale: true, reason: "old_catalog_version" };
  return { stale: false, reason: "current_and_relevant" };
}

export function classifySystemTask(task, result) {
  const active = task.deleted_at == null && task.archived_at == null && !["done", "dismissed"].includes(task.status);
  if (!active) return { action: "preserve", reason: "historical_or_inactive" };
  if (!task.origin_catalog_key) return task.source === "user_created"
    ? { action: "preserve", reason: "manual_task" }
    : { action: "unresolved", reason: "active_system_task_without_origin" };
  if (!CANONICAL_KEYS.has(task.origin_catalog_key)) return { action: "unresolved", reason: "unknown_origin_catalog_key" };
  if (!isRelevantResult(result)) return { action: "archive", reason: result?.status ?? "not_relevant" };
  return { action: "preserve", reason: "currently_relevant" };
}

function createId(prefix) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function dateOnlyFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateOnly, days) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function periodKeyForCatalogItem(item, today = currentDateOnly()) {
  const year = Number(today.slice(0, 4));
  return item.season === "spring" ? `${year}-spring` : item.season === "autumn" ? `${year}-autumn` : `${year}-all-year`;
}

function suggestedDueDateForCatalogItem(item, today = currentDateOnly()) {
  const year = Number(today.slice(0, 4));
  if (item.season === "spring") {
    const end = dateOnlyFromParts(year, 5, 31);
    if (today > end) return null;
    const defaultDate = dateOnlyFromParts(year, 4, 15);
    return today <= defaultDate ? defaultDate : addDays(today, 7) <= end ? addDays(today, 7) : end;
  }
  if (item.season === "autumn") {
    const end = dateOnlyFromParts(year, 11, 30);
    if (today > end) return null;
    const defaultDate = dateOnlyFromParts(year, 10, 15);
    return today <= defaultDate ? defaultDate : addDays(today, 7) <= end ? addDays(today, 7) : end;
  }
  const yearEnd = dateOnlyFromParts(year, 12, 31);
  const suggested = addDays(today, 30);
  return suggested <= yearEnd ? suggested : yearEnd;
}

function primaryBuilding(publicData) {
  const buildings = publicData?.productBuildings ?? publicData?.buildings ?? [];
  return buildings.find((building) => building.bbrBuildingId === publicData?.selection?.primaryBuildingId) ?? buildings[0] ?? null;
}

function deriveHeatingType(building) {
  const installationCode = building?.heating?.installation?.code ?? null;
  const sourceCode = building?.heating?.source?.code ?? null;
  const supplementaryCode = building?.heating?.supplementary?.code ?? null;
  if (installationCode === "5" || supplementaryCode === "1") return "heat_pump";
  if (installationCode === "1") return "district_heating";
  if (installationCode === "2" && sourceCode === "7") return "gas_boiler";
  if (installationCode === "2" && sourceCode === "3") return "oil_boiler";
  if (["2", "3", "6"].includes(installationCode ?? "")) return "central_heating";
  if (installationCode === "7") return "electric_heating";
  if (installationCode === "9") return "none";
  return null;
}

function bbrCandidates(publicData) {
  const buildings = publicData?.productBuildings ?? publicData?.buildings ?? [];
  const primary = primaryBuilding(publicData);
  const heating = primary?.heating;
  const installationCode = heating?.installation?.code ?? null;
  const sourceCode = heating?.source?.code ?? null;
  const supplementaryCode = heating?.supplementary?.code ?? null;
  const heatingType = deriveHeatingType(primary);
  const facts = [
    ["bbr.heating.installation_code", installationCode],
    ["bbr.heating.source_code", sourceCode],
    ["bbr.heating.supplementary_code", supplementaryCode],
    ["bbr.heating.type", heatingType],
    ["bbr.roof.material_code", primary?.materials?.roof?.code ?? null],
    ["bbr.facade.material_code", primary?.materials?.outerWall?.code ?? null]
  ].filter(([, value]) => value !== null);

  const components = [];
  if (heatingType) {
    components.push(["heating_system", heatingType === "none" ? "absent" : "present"]);
    for (const key of ["heat_pump", "district_heating", "gas_boiler", "oil_boiler"]) {
      components.push([key, heatingType === key ? "present" : "absent"]);
    }
    components.push(["central_heating", ["district_heating", "gas_boiler", "oil_boiler", "central_heating"].includes(heatingType) ? "present" : "absent"]);
    if (installationCode === "3" || ["2", "5"].includes(supplementaryCode ?? "")) components.push(["chimney", "present"]);
    if (supplementaryCode === "2") components.push(["wood_stove", "present"]);
    if (supplementaryCode === "5") components.push(["fireplace", "present"]);
  }
  if (primary) {
    components.push(["roof", "present"], ["facade", "present"]);
    const basementAreas = buildings.flatMap((building) => (building.floors ?? [])
      .map((floor) => floor.basementAreaM2)
      .filter((value) => typeof value === "number" && Number.isFinite(value)));
    if (basementAreas.length > 0) components.push(["basement", basementAreas.some((area) => area > 0) ? "present" : "absent"]);
    const hasWetroom = (primary.units ?? []).some((unit) => unit.facilities?.bathType?.code === "V" || (unit.facilities?.bathroomCount ?? 0) > 0);
    if (hasWetroom) components.push(["wetroom", "present"]);
  }
  return { facts, components };
}

function mergeState(existingFacts, existingComponents, candidates) {
  const facts = {...existingFacts};
  for (const [key, value] of candidates.facts) if (!Object.hasOwn(existingFacts, key) || existingFacts[key] === undefined) facts[key] = value;
  const components = {...existingComponents};
  for (const [key, value] of candidates.components) if (!Object.hasOwn(existingComponents, key)) components[key] = value;
  return { facts, components };
}

async function queryData(pool) {
  const houses = await pool.query(`select h.id as house_id, h.user_id, h.address_label, h.bfe_number, s.status as snapshot_status, s.normalized_payload from houses h left join house_public_data_snapshots s on s.house_id = h.id and s.is_current where h.status = 'saved' order by h.address_label, h.id`);
  const houseIds = houses.rows.map((row) => row.house_id);
  const any = (sql) => houseIds.length ? pool.query(sql, [houseIds]) : Promise.resolve({rows: []});
  const [facts, components, catalog, recommendations, tasks, hides] = await Promise.all([
    any(`select house_id, fact_key, value, source, confidence from house_facts where house_id = any($1::text[]) order by house_id, fact_key`),
    any(`select house_id, component_key, status, source, confidence from house_components where house_id = any($1::text[]) order by house_id, component_key`),
    pool.query(`select id, catalog_key, catalog_version, title, short_description, guide_template_id, guide_version_id, is_active from maintenance_catalog_items where is_active order by catalog_key, catalog_version`),
    any(`select id, house_id, catalog_item_id, catalog_key, catalog_version, period_key, status, accepted_task_id, source_type from maintenance_recommendations where house_id = any($1::text[]) order by house_id, created_at`),
    any(`select id, house_id, status, source, origin_catalog_key, origin_catalog_version, origin_recommendation_instance_id, recommendation_id, archived_at, deleted_at, completed_at, title from maintenance_tasks where house_id = any($1::text[]) order by house_id, created_at`),
    any(`select house_id, catalog_key from maintenance_recommendation_hides where house_id = any($1::text[]) and unhidden_at is null`)
  ]);
  return {houses: houses.rows, facts: facts.rows, components: components.rows, catalog: catalog.rows, recommendations: recommendations.rows, tasks: tasks.rows, hides: hides.rows};
}

function groupRows(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

function resultMapForHouse(house, facts, components) {
  const housingType = deriveMaintenanceHousingType(house.normalized_payload ?? null);
  const state = {housingType, facts, components};
  const results = new Map();
  for (const item of maintenanceCatalogItems) {
    results.set(item.catalogKey, evaluateMaintenanceCatalogApplicability(item.catalogKey, item.eligibilityRules, state));
  }
  return {housingType, results};
}

function addressLabel(house) {
  return house.address_label || house.house_id;
}

async function reconcile() {
  if (process.env.MATRIVA_ENVIRONMENT !== "qa") throw new Error("Refusing reconciliation unless MATRIVA_ENVIRONMENT=qa.");
  const databaseUrl = assertQaDatabaseUrl(process.env.QA_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim());
  const pool = new pg.Pool({connectionString: databaseUrl, max: 2});
  const client = await pool.connect();
  const data = await queryData(pool);
  const factsByHouse = groupRows(data.facts, "house_id");
  const componentsByHouse = groupRows(data.components, "house_id");
  const recommendationsByHouse = groupRows(data.recommendations, "house_id");
  const tasksByHouse = groupRows(data.tasks, "house_id");
  const hidesByHouse = groupRows(data.hides, "house_id");
  const catalogByKey = new Map(data.catalog.map((row) => [row.catalog_key, row]));
  const unresolvedCases = [];
  let staleRecommendationsRemoved = 0;
  let recommendationsCreated = 0;
  let activeSystemTasksRemoved = 0;
  let tasksPreservedManualOrHistorical = 0;
  let possibleCount = 0;
  const perHouse = [];
  const today = currentDateOnly();

  try {
    await client.query("begin");
    for (const house of data.houses) {
      const existingFactsRows = factsByHouse.get(house.house_id) ?? [];
      const existingComponentsRows = componentsByHouse.get(house.house_id) ?? [];
      const existingFacts = Object.fromEntries(existingFactsRows.map((row) => [row.fact_key, row.value]));
      const existingComponents = Object.fromEntries(existingComponentsRows.map((row) => [row.component_key, row.status]));
      const bbr = bbrCandidates(house.normalized_payload ?? null);
      const stateData = mergeState(existingFacts, existingComponents, bbr);
      const evaluated = resultMapForHouse(house, stateData.facts, stateData.components);
      const currentRecommendations = [...(recommendationsByHouse.get(house.house_id) ?? [])];
      const currentTasks = [...(tasksByHouse.get(house.house_id) ?? [])];
      const canonicalRecommendationRows = currentRecommendations.filter((row) => CANONICAL_KEYS.has(row.catalog_key));
      const beforePending = canonicalRecommendationRows.filter((row) => row.status === "pending").length;
      const beforeActiveSystemTasks = currentTasks.filter((task) => task.origin_catalog_key && task.deleted_at == null && task.archived_at == null && !["done", "dismissed"].includes(task.status)).length;
      const beforePendingAll = currentRecommendations.filter((row) => row.status === "pending").length;

      if (APPLY) {
        await client.query("delete from house_facts where house_id = $1 and source = 'bbr'", [house.house_id]);
        await client.query("delete from house_components where house_id = $1 and source = 'bbr'", [house.house_id]);
      }
      for (const [factKey, value] of bbr.facts) {
        if (APPLY) await client.query(`insert into house_facts (id, house_id, fact_key, value, source, confidence) values ($1, $2, $3, $4::jsonb, 'bbr', 'high') on conflict (house_id, fact_key) do update set value = excluded.value, source = excluded.source, confidence = excluded.confidence, updated_at = now() where house_facts.source = 'bbr'`, [createId("hfact"), house.house_id, factKey, JSON.stringify(value)]);
      }
      for (const [componentKey, status] of bbr.components) {
        if (APPLY) await client.query(`insert into house_components (id, house_id, component_key, status, source, confidence) values ($1, $2, $3, $4, 'bbr', 'high') on conflict (house_id, component_key) do update set status = excluded.status, source = excluded.source, confidence = excluded.confidence, updated_at = now() where house_components.source = 'bbr'`, [createId("hcomp"), house.house_id, componentKey, status]);
      }

      for (const recommendation of canonicalRecommendationRows) {
        const item = maintenanceCatalogItems.find((candidate) => candidate.catalogKey === recommendation.catalog_key);
        if (!item) continue;
        const decision = classifyStaleRecommendation(recommendation, evaluated.results.get(item.catalogKey), item.catalogVersion);
        if (!decision.stale) {
          if (decision.reason === "accepted_task_preserved") unresolvedCases.push({address: addressLabel(house), catalogKey: item.catalogKey, kind: "recommendation_has_accepted_task", recommendationId: recommendation.id});
          continue;
        }
        staleRecommendationsRemoved += 1;
        if (APPLY) await client.query("delete from maintenance_recommendations where id = $1 and status = 'pending' and accepted_task_id is null and source_type = 'matriva_catalog'", [recommendation.id]);
        const staleIndex = currentRecommendations.indexOf(recommendation);
        if (staleIndex >= 0) currentRecommendations.splice(staleIndex, 1);
      }

      const activeSystemTasks = currentTasks.filter((task) => task.origin_catalog_key && task.deleted_at == null && task.archived_at == null && !["done", "dismissed"].includes(task.status));
      for (const task of currentTasks) {
        const decision = classifySystemTask(task, evaluated.results.get(task.origin_catalog_key));
        if (decision.action === "archive") {
          activeSystemTasksRemoved += 1;
          if (APPLY) await client.query("update maintenance_tasks set archived_at = now(), updated_at = now() where id = $1 and house_id = $2 and deleted_at is null and archived_at is null", [task.id, house.house_id]);
        } else if (decision.action === "unresolved") {
          unresolvedCases.push({address: addressLabel(house), kind: decision.reason, taskId: task.id, catalogKey: task.origin_catalog_key});
        } else if (task.source === "user_created" || task.status === "done" || task.status === "dismissed" || task.archived_at || task.deleted_at || !task.origin_catalog_key) {
          tasksPreservedManualOrHistorical += 1;
        }
      }

      const activeHides = new Set((hidesByHouse.get(house.house_id) ?? []).map((row) => row.catalog_key));
      for (const item of maintenanceCatalogItems) {
        const result = evaluated.results.get(item.catalogKey);
        if (result?.status === "possible") possibleCount += 1;
        if (!isRelevantResult(result)) continue;
        const catalogRow = catalogByKey.get(item.catalogKey);
        if (!catalogRow || catalogRow.catalog_version !== item.catalogVersion) {
          unresolvedCases.push({address: addressLabel(house), catalogKey: item.catalogKey, kind: "active_catalog_row_missing_or_version_mismatch"});
          continue;
        }
        const periodKey = periodKeyForCatalogItem(item, today);
        const dueDate = suggestedDueDateForCatalogItem(item, today);
        if (!dueDate) continue;
        const currentPeriodRecommendation = currentRecommendations.find((row) => row.catalog_item_id === catalogRow.id && row.period_key === periodKey);
        const activeOriginTask = currentTasks.find((task) => task.origin_catalog_key === item.catalogKey && task.deleted_at == null && task.archived_at == null && !["done", "dismissed"].includes(task.status));
        if (activeHides.has(item.catalogKey) || activeOriginTask || currentPeriodRecommendation) continue;
        recommendationsCreated += 1;
        if (APPLY) {
          const eligibilitySnapshot = {type: item.eligibilityRules.type, eligible: true, relevance: result.status, reason: result.reason};
          await client.query(`insert into maintenance_recommendations (id, house_id, user_id, catalog_item_id, catalog_key, catalog_version, guide_template_id, guide_version_id, source_type, title, description, recommended_timing_label, recommended_period, period_key, suggested_due_date, timing_type, due_date, season, recurrence_interval, recurrence_anchor, provenance, eligibility_snapshot, recommendation_key, version_key, priority, disclaimer_class, why) values ($1, $2, $3, $4, $5, $6, $7, $8, 'matriva_catalog', $9, $10, $11, $12::jsonb, $13, $14::date, 'specific_deadline', $14::date, null, $15, 'completed_date', $16::jsonb, $17::jsonb, $5, $18, $19, $20, $21) on conflict (house_id, catalog_item_id, period_key) where catalog_item_id is not null and period_key is not null do nothing`, [createId("mrec"), house.house_id, house.user_id, catalogRow.id, item.catalogKey, item.catalogVersion, catalogRow.guide_template_id, catalogRow.guide_version_id, item.title, item.shortDescription, recommendedPeriodLabel(item.recommendedPeriod), JSON.stringify(item.recommendedPeriod), periodKey, dueDate, item.defaultRecurrenceInterval, JSON.stringify({extractionMethod: "matriva_catalog", originalTitle: item.title, originalDescription: item.shortDescription, originalTiming: recommendedPeriodLabel(item.recommendedPeriod)}), JSON.stringify(eligibilitySnapshot), `${item.catalogKey}:${item.catalogVersion}:${periodKey}`, item.priority, item.disclaimerClass, result.reason]);
        }
      }

      const relevant = [...evaluated.results.values()].filter(isRelevantResult).length;
      const possible = [...evaluated.results.values()].filter((result) => result.status === "possible").length;
      const notRelevant = maintenanceCatalogItems.length - relevant - possible;
      perHouse.push({address: addressLabel(house), houseId: house.house_id, housingType: evaluated.housingType, before: {pending: beforePending, pendingAll: beforePendingAll, activeSystemTasks: beforeActiveSystemTasks}, engine: {relevant, possible, notRelevant}});
    }
    if (APPLY) await client.query("commit");
    else await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify({mode: APPLY ? "apply" : "dry-run", rulesetVersion: MAINTENANCE_RULESET_VERSION, housesProcessed: data.houses.length, beforePendingRecommendations: perHouse.reduce((sum, row) => sum + row.before.pending, 0), afterPendingRecommendations: perHouse.reduce((sum, row) => sum + row.before.pending, 0) - staleRecommendationsRemoved + recommendationsCreated, staleRecommendationsRemoved, recommendationsCreated, activeSystemTasksRemoved, tasksPreservedManualOrHistorical, possibleCount, unresolvedCases, perHouse}, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await reconcile();
}
