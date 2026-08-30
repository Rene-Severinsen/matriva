import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import pg from "pg";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

import {
  evaluateMaintenanceCatalogApplicability,
  maintenanceCatalogItems
} from "../apps/api/src/maintenance-catalog.ts";
import { deriveMaintenanceHousingType } from "../apps/api/src/maintenance-housing-type.ts";
import { MAINTENANCE_RULESET_VERSION, maintenanceRecommendationRules } from "../apps/api/src/generated/maintenance-recommendation-rules.ts";

const outputPath = path.resolve(
  process.argv[2] ?? "docs/product/qa-maintenance-recommendation-audit.xlsx"
);
const rulesWorkbookPath = path.resolve("docs/product/maintenance-recommendation-rules.xlsx");
const databaseUrl = process.env.QA_DATABASE_URL?.trim() ?? process.env.DATABASE_URL?.trim();

if (process.env.MATRIVA_ENVIRONMENT !== "qa") {
  throw new Error("Refusing live QA audit unless MATRIVA_ENVIRONMENT=qa.");
}
if (!databaseUrl) {
  throw new Error("QA_DATABASE_URL is required for the live QA audit.");
}

const { Pool } = pg;

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatAddressFallback(addressLabel) {
  const value = stringValue(addressLabel) ?? "UNKNOWN";
  const match = value.match(/^(.*?)(?:,?\s+(\d{4})\s+(.+))$/);
  return {
    address: match?.[1]?.trim() || value,
    postalCode: match?.[2] ?? null,
    city: match?.[3]?.trim() ?? null
  };
}

function primaryBuilding(publicData) {
  const buildings = publicData?.productBuildings ?? [];
  if (publicData?.selection?.primaryBuildingStatus === "automatic_address_relation") {
    return buildings.find((building) => building.bbrBuildingId === publicData.selection.primaryBuildingId) ?? null;
  }
  return buildings.length === 1 ? buildings[0] ?? null : null;
}

function primaryUnit(publicData, building) {
  if (!building || publicData?.selection?.primaryUnitStatus !== "automatic_unambiguous") return null;
  return building.units.find((unit) => unit.bbrUnitId === publicData.selection.primaryUnitId) ?? null;
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

function bbrHeatingCandidates(publicData) {
  const building = primaryBuilding(publicData);
  const heatingType = deriveHeatingType(building);
  const components = {};
  if (heatingType) {
    components.heating_system = heatingType === "none" ? "absent" : "present";
    for (const key of ["heat_pump", "district_heating", "gas_boiler", "oil_boiler"]) {
      components[key] = heatingType === key ? "present" : "absent";
    }
    components.central_heating = ["district_heating", "gas_boiler", "oil_boiler", "central_heating"].includes(heatingType)
      ? "present"
      : "absent";
    const supplementaryCode = building?.heating?.supplementary?.code ?? null;
    const installationCode = building?.heating?.installation?.code ?? null;
    if (installationCode === "3" || ["2", "5"].includes(supplementaryCode ?? "")) components.chimney = "present";
    if (supplementaryCode === "2") components.wood_stove = "present";
    if (supplementaryCode === "5") components.fireplace = "present";
  }
  return components;
}

function housingTypeSource(publicData, housingType) {
  if (!publicData) return "NO_BBR_SNAPSHOT";
  if (housingType !== "unknown") return "BBR_PUBLIC_DATA_MAPPING";
  if (publicData.selection?.primaryBuildingStatus !== "automatic_address_relation" && (publicData.productBuildings ?? []).length !== 1) {
    return "BBR_PRIMARY_BUILDING_AMBIGUOUS";
  }
  return "BBR_CODES_UNMAPPED_OR_INCOMPLETE";
}

function housingTypeEvidence(publicData, housingType) {
  const building = primaryBuilding(publicData);
  const unit = primaryUnit(publicData, building);
  const propertyTypeCode = publicData?.property?.propertyType?.code ?? "missing";
  const buildingUseCode = building?.use?.code ?? "missing";
  const unitHousingTypeCode = unit?.housingType?.code ?? "missing";
  if (propertyTypeCode === "3") return `sfeEjendomstype=3 -> apartment (byg021=${buildingUseCode}, enh023=${unitHousingTypeCode})`;
  if (buildingUseCode === "140") return `byg021BygningensAnvendelse=140 -> apartment (sfe=${propertyTypeCode}, enh023=${unitHousingTypeCode})`;
  if (["110", "120", "121", "122"].includes(buildingUseCode)) return `byg021BygningensAnvendelse=${buildingUseCode} -> villa (sfe=${propertyTypeCode}, enh023=${unitHousingTypeCode})`;
  if (["130", "131", "132"].includes(buildingUseCode)) return `byg021BygningensAnvendelse=${buildingUseCode} -> row_house (sfe=${propertyTypeCode}, enh023=${unitHousingTypeCode})`;
  if (["510", "540", "585"].includes(buildingUseCode)) return `byg021BygningensAnvendelse=${buildingUseCode} -> summer_house (sfe=${propertyTypeCode}, enh023=${unitHousingTypeCode})`;
  return `no safe explicit mapping (sfe=${propertyTypeCode}, byg021=${buildingUseCode}, enh023=${unitHousingTypeCode}) -> ${housingType}`;
}

function recommendationCategoryMap(workbook) {
  const sheet = workbook.worksheets.getItem("Recommendations");
  const values = sheet.getUsedRange().values ?? [];
  const headers = values[0] ?? [];
  const keyIndex = headers.indexOf("catalog_key");
  const categoryIndex = headers.indexOf("category");
  const map = new Map();
  if (keyIndex < 0 || categoryIndex < 0) return map;
  for (const row of values.slice(1)) {
    const key = stringValue(row[keyIndex]);
    if (key) map.set(key, stringValue(row[categoryIndex]) ?? "UNKNOWN");
  }
  return map;
}

function ruleComponentKeys(rule) {
  if (rule.type !== "REQUIRES_COMPONENT") return [];
  return [
    ...(rule.componentKey ? [rule.componentKey] : []),
    ...(rule.requiresAll ?? []),
    ...(rule.requiresAny ?? []),
    ...(rule.excludesComponentKey ? [rule.excludesComponentKey] : [])
  ].filter((key, index, all) => all.indexOf(key) === index);
}

function requiredComponentLabel(rule) {
  if (rule.type !== "REQUIRES_COMPONENT") return "–";
  if (rule.componentKey) return rule.componentKey;
  if (rule.requiresAll?.length) return rule.requiresAll.join(" + ");
  if (rule.requiresAny?.length) return rule.requiresAny.join(" OR ");
  return "UNKNOWN";
}

function componentStatusLabel(rule, components, facts) {
  if (rule.type === "REQUIRES_COMPONENT") {
    return ruleComponentKeys(rule)
      .map((key) => `${key}=${Object.prototype.hasOwnProperty.call(components, key) ? components[key] : "missing"}`)
      .join("; ") || "–";
  }
  if (rule.type === "ENRICHED_BY_FACTS") {
    return rule.factKeys
      .map((key) => `${key}=${Object.prototype.hasOwnProperty.call(facts, key) ? JSON.stringify(facts[key]) : "missing"}`)
      .join("; ") || "–";
  }
  return "–";
}

function shortReason(reason) {
  return (stringValue(reason) ?? "UNKNOWN").replace(/\s+/g, " ").slice(0, 240);
}

function isApartmentReviewCandidate(item, generatedRule) {
  const text = `${item.title} ${generatedRule.responsibilityScope}`.toLowerCase();
  return generatedRule.responsibilityScope === "COMMON_BUILDING" ||
    generatedRule.responsibilityScope === "MIXED" ||
    /(tag|tagrende|nedløb|facade|fundament|terræn|dræn|kloak|skorsten|ventilation|solcell|udendørs|varmeinstallation|varmeunit)/i.test(text);
}

function columnName(number) {
  let n = number;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function styleSheet(sheet, rowCount, columnCount, widths, tableName) {
  const lastColumn = columnName(columnCount);
  const header = sheet.getRange(`A1:${lastColumn}1`);
  const body = rowCount > 1 ? sheet.getRange(`A2:${lastColumn}${rowCount}`) : null;
  sheet.showGridLines = false;
  header.format = {
    fill: "#0F766E",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
    verticalAlignment: "center"
  };
  header.format.rowHeight = 32;
  if (body) {
    body.format = { wrapText: true, verticalAlignment: "center" };
    body.format.rowHeight = 30;
    body.format.borders = { insideHorizontal: { style: "thin", color: "#D9E2E1" } };
  }
  widths.forEach((width, index) => {
    sheet.getRange(`${columnName(index + 1)}:${columnName(index + 1)}`).format.columnWidth = width;
  });
  sheet.freezePanes.freezeRows(1);
  if (rowCount > 1) {
    const table = sheet.tables.add(`A1:${lastColumn}${rowCount}`, true, tableName);
    table.style = "TableStyleMedium2";
    table.showFilterButton = true;
  }
}

function addYesNoFormatting(sheet, address) {
  sheet.getRange(address).conditionalFormats.add("containsText", {
    text: "YES",
    format: { fill: "#FEE2E2", font: { bold: true, color: "#991B1B" } }
  });
}

async function queryQaData() {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const houses = await pool.query(`
      select
        h.id as house_id,
        h.address_label,
        h.bfe_number,
        s.status as snapshot_status,
        s.normalized_payload
      from houses h
      left join house_public_data_snapshots s
        on s.house_id = h.id and s.is_current
      where h.status = 'saved'
      order by h.address_label, h.id
    `);
    const houseIds = houses.rows.map((row) => row.house_id);
    const facts = houseIds.length
      ? await pool.query(`select house_id, fact_key, value, source, confidence from house_facts where house_id = any($1::text[]) order by house_id, fact_key`, [houseIds])
      : { rows: [] };
    const components = houseIds.length
      ? await pool.query(`select house_id, component_key, status, source, confidence from house_components where house_id = any($1::text[]) order by house_id, component_key`, [houseIds])
      : { rows: [] };
    const recommendations = houseIds.length
      ? await pool.query(`select id, house_id, catalog_item_id, catalog_key, catalog_version, period_key, status, accepted_task_id, source_type from maintenance_recommendations where house_id = any($1::text[]) order by house_id, created_at`, [houseIds])
      : { rows: [] };
    const tasks = houseIds.length
      ? await pool.query(`select id, house_id, status, source, origin_catalog_key, origin_catalog_version, origin_recommendation_instance_id, recommendation_id, archived_at, deleted_at, completed_at from maintenance_tasks where house_id = any($1::text[]) order by house_id, created_at`, [houseIds])
      : { rows: [] };
    const hides = houseIds.length
      ? await pool.query(`select house_id, catalog_key from maintenance_recommendation_hides where house_id = any($1::text[]) and unhidden_at is null`, [houseIds])
      : { rows: [] };
    return { houses: houses.rows, facts: facts.rows, components: components.rows, recommendations: recommendations.rows, tasks: tasks.rows, hides: hides.rows };
  } finally {
    await pool.end();
  }
}

function buildAuditRows(data, categoryMap) {
  const factsByHouse = new Map();
  const componentsByHouse = new Map();
  const recommendationsByHouse = new Map();
  const tasksByHouse = new Map();
  const hidesByHouse = new Map();
  for (const row of data.facts) {
    if (!factsByHouse.has(row.house_id)) factsByHouse.set(row.house_id, {});
    factsByHouse.get(row.house_id)[row.fact_key] = row.value;
  }
  for (const row of data.components) {
    if (!componentsByHouse.has(row.house_id)) componentsByHouse.set(row.house_id, {});
    componentsByHouse.get(row.house_id)[row.component_key] = row.status;
  }
  for (const row of data.recommendations ?? []) {
    if (!recommendationsByHouse.has(row.house_id)) recommendationsByHouse.set(row.house_id, []);
    recommendationsByHouse.get(row.house_id).push(row);
  }
  for (const row of data.tasks ?? []) {
    if (!tasksByHouse.has(row.house_id)) tasksByHouse.set(row.house_id, []);
    tasksByHouse.get(row.house_id).push(row);
  }
  for (const row of data.hides ?? []) {
    if (!hidesByHouse.has(row.house_id)) hidesByHouse.set(row.house_id, new Set());
    hidesByHouse.get(row.house_id).add(row.catalog_key);
  }

  const houses = [];
  const recommended = [];
  const apartmentReview = [];
  const heating = [];
  const possible = [];
  const dataQuality = [];
  let possibleRemovedDueAbsentPrecedence = 0;
  let possibleRemovedDueUnknownPrecedence = 0;
  const heatingKeys = ["district_heating", "heat_pump", "gas_boiler", "oil_boiler", "wood_stove", "fireplace"];
  const heatingTaskKeys = new Set([
    "heating_system_service",
    "radiator_valves_check",
    "district_heating_unit_check",
    "gas_boiler_service",
    "oil_boiler_service",
    "heat_pump_service",
    "heat_pump_filter_check"
  ]);

  for (const row of data.houses) {
    let publicData = row.normalized_payload ?? null;
    const fallback = formatAddressFallback(row.address_label);
    const address = stringValue(publicData?.address?.label) ?? fallback.address;
    const postalCode = stringValue(publicData?.address?.postalCode) ?? fallback.postalCode;
    const city = stringValue(publicData?.address?.postalDistrict) ?? fallback.city;
    let housingType = "unknown";
    try {
      housingType = deriveMaintenanceHousingType(publicData);
    } catch {
      publicData = null;
      dataQuality.push({ houseId: row.house_id, issue: "BBR normalized payload could not be interpreted." });
    }
    const facts = factsByHouse.get(row.house_id) ?? {};
    const components = componentsByHouse.get(row.house_id) ?? {};
    const state = { facts, components, housingType };
    const materializedRecommendations = recommendationsByHouse.get(row.house_id) ?? [];
    const materializedTasks = tasksByHouse.get(row.house_id) ?? [];
    const activeSystemTasks = materializedTasks.filter((task) => task.origin_catalog_key && task.deleted_at == null && task.archived_at == null && !["done", "dismissed"].includes(task.status));
    const pendingCatalogRecommendations = materializedRecommendations.filter((recommendation) => recommendation.source_type === "matriva_catalog" && recommendation.status === "pending");
    const currentPendingByKey = new Map(pendingCatalogRecommendations.map((recommendation) => [recommendation.catalog_key, recommendation]));
    const activeTaskByKey = new Map(activeSystemTasks.filter((task) => task.origin_catalog_key).map((task) => [task.origin_catalog_key, task]));
    const snapshotNotes = [];
    if (!row.normalized_payload) snapshotNotes.push("BBR snapshot missing");
    if (row.snapshot_status && row.snapshot_status !== "success") snapshotNotes.push(`BBR status=${row.snapshot_status}`);
    if (Array.isArray(publicData?.warnings) && publicData.warnings.length > 0) {
      snapshotNotes.push(`BBR warnings: ${publicData.warnings.map((warning) => warning.code ?? "UNKNOWN").join(", ")}`);
    }
    if (housingType === "unknown") snapshotNotes.push(`housing type unknown (${housingTypeSource(publicData, housingType)})`);
    if (!data.components.some((component) => component.house_id === row.house_id)) snapshotNotes.push("no house_components rows");
    if (!data.facts.some((fact) => fact.house_id === row.house_id)) snapshotNotes.push("no house_facts rows");

    const results = [];
    for (const item of maintenanceCatalogItems) {
      const generatedRule = maintenanceRecommendationRules[item.catalogKey];
      const result = evaluateMaintenanceCatalogApplicability(item.catalogKey, item.eligibilityRules, state);
      const generatedGate = generatedRule?.housing?.[housingType];
      if (generatedGate === "CONDITIONAL" && result.status === "not_relevant") {
        const requiredKeys = ruleComponentKeys(item.eligibilityRules);
        if (requiredKeys.some((key) => components[key] === "absent")) possibleRemovedDueAbsentPrecedence += 1;
        else if (requiredKeys.some((key) => components[key] === "unknown" || !Object.prototype.hasOwnProperty.call(components, key))) possibleRemovedDueUnknownPrecedence += 1;
      }
      const resultLabel = result.status === "relevant" && result.eligible ? "RELEVANT" : result.status === "possible" ? "POSSIBLE" : "NOT_RELEVANT";
      const rowData = {
        address,
        housingType,
        catalogKey: item.catalogKey,
        recommendation: item.title,
        category: categoryMap.get(item.catalogKey) ?? "UNKNOWN",
        applicability: generatedRule?.proposedApplicability ?? item.eligibilityRules.type,
        requiredComponent: requiredComponentLabel(item.eligibilityRules),
        componentStatus: componentStatusLabel(item.eligibilityRules, components, facts),
        responsibilityScope: generatedRule?.responsibilityScope ?? "UNKNOWN",
        reason: shortReason(result.reason),
        condition: generatedRule?.condition ?? "–",
        result: resultLabel,
        materializedPending: currentPendingByKey.has(item.catalogKey) ? "YES" : "NO",
        activeSystemTask: activeTaskByKey.has(item.catalogKey) ? "YES" : "NO",
        manualReview: housingType === "apartment" && isApartmentReviewCandidate(item, generatedRule ?? { responsibilityScope: "MIXED" }) ? "YES" : "NO"
      };
      results.push(rowData);
      if (resultLabel === "RELEVANT") {
        recommended.push(rowData);
        if (housingType === "apartment") apartmentReview.push(rowData);
      } else if (resultLabel === "POSSIBLE") {
        possible.push(rowData);
        if (housingType === "apartment") apartmentReview.push(rowData);
      }
    }

    const heatingRow = {
      address,
      housingType,
      heatingSystem: components.heating_system ?? "missing",
      districtHeating: components.district_heating ?? "missing",
      centralHeating: components.central_heating ?? "missing",
      heatPump: components.heat_pump ?? "missing",
      gasBoiler: components.gas_boiler ?? "missing",
      oilBoiler: components.oil_boiler ?? "missing",
      woodStove: components.wood_stove ?? "missing",
      fireplace: components.fireplace ?? "missing",
      chimney: components.chimney ?? "missing",
      recommendedHeatingTasks: results.filter((result) => heatingTaskKeys.has(result.catalogKey) && result.result === "RELEVANT").map((result) => result.recommendation).join("; ") || "–"
    };
    heating.push(heatingRow);
    const simultaneouslyPresent = heatingKeys.filter((key) => components[key] === "present");
    if (simultaneouslyPresent.length > 1) snapshotNotes.push(`multiple heating sources: ${simultaneouslyPresent.join(", ")}`);
    const bbrCandidates = bbrHeatingCandidates(publicData);
    for (const component of data.components.filter((candidate) => candidate.house_id === row.house_id)) {
      if (["user", "manual", "ai"].includes(component.source) && bbrCandidates[component.component_key] && bbrCandidates[component.component_key] !== component.status) {
        snapshotNotes.push(`component conflict: ${component.component_key} source=${component.source}, BBR candidate=${bbrCandidates[component.component_key]}, stored=${component.status}`);
        dataQuality.push({ houseId: row.house_id, issue: `component conflict ${component.component_key}` });
      }
    }
    for (const item of maintenanceCatalogItems) {
      const rule = item.eligibilityRules;
      if (rule.type !== "REQUIRES_COMPONENT") continue;
      for (const key of ruleComponentKeys(rule)) {
        if (!Object.prototype.hasOwnProperty.call(components, key)) {
          dataQuality.push({ houseId: row.house_id, issue: `required component missing: ${key}`, catalogKey: item.catalogKey });
        } else if (components[key] === "unknown") {
          dataQuality.push({ houseId: row.house_id, issue: `required component unknown: ${key}`, catalogKey: item.catalogKey });
        }
      }
    }
    const stalePendingCount = pendingCatalogRecommendations.filter((recommendation) => {
      const result = results.find((candidate) => candidate.catalogKey === recommendation.catalog_key);
      return result && (result.result !== "RELEVANT" || recommendation.catalog_version !== maintenanceCatalogItems.find((item) => item.catalogKey === recommendation.catalog_key)?.catalogVersion);
    }).length;
    const staleActiveTaskCount = activeSystemTasks.filter((task) => {
      const result = results.find((candidate) => candidate.catalogKey === task.origin_catalog_key);
      return result && result.result !== "RELEVANT";
    }).length;
    houses.push({
      houseId: row.house_id,
      address,
      postalCode: postalCode ?? "UNKNOWN",
      city: city ?? "UNKNOWN",
      bfeNumber: stringValue(row.bfe_number) ?? stringValue(publicData?.property?.bfeNumber) ?? "UNKNOWN",
      housingType,
      housingTypeSource: housingTypeSource(publicData, housingType),
      housingTypeEvidence: housingTypeEvidence(publicData, housingType),
      recommendedCount: results.filter((result) => result.result === "RELEVANT").length,
      possibleCount: results.filter((result) => result.result === "POSSIBLE").length,
      notRelevantCount: results.filter((result) => result.result === "NOT_RELEVANT").length,
      pendingRecommendationCount: pendingCatalogRecommendations.length,
      activeSystemTaskCount: activeSystemTasks.length,
      staleMaterializedCount: stalePendingCount + staleActiveTaskCount,
      stateAlignment: stalePendingCount + staleActiveTaskCount === 0 ? "MATCH" : "REVIEW",
      notes: snapshotNotes.join("; ") || "–"
    });
  }
  houses.sort((a, b) => `${a.housingType}|${a.address}`.localeCompare(`${b.housingType}|${b.address}`, "da"));
  recommended.sort((a, b) => `${a.address}|${a.category}|${a.recommendation}`.localeCompare(`${b.address}|${b.category}|${b.recommendation}`, "da"));
  apartmentReview.sort((a, b) => `${a.address}|${a.recommendation}`.localeCompare(`${b.address}|${b.recommendation}`, "da"));
  possible.sort((a, b) => `${a.address}|${a.recommendation}`.localeCompare(`${b.address}|${b.recommendation}`, "da"));
  heating.sort((a, b) => a.address.localeCompare(b.address, "da"));
  return {
    houses,
    recommended,
    apartmentReview,
    heating,
    possible,
    dataQuality,
    possibleRemovedDueAbsentPrecedence,
    possibleRemovedDueUnknownPrecedence
  };
}

async function writeWorkbook(audit, categoryMap) {
  const workbook = Workbook.create();
  const housesSheet = workbook.worksheets.add("Houses");
  const recommendedSheet = workbook.worksheets.add("Recommended");
  const apartmentSheet = workbook.worksheets.add("Apartment Review");
  const heatingSheet = workbook.worksheets.add("Heating");
  const possibleSheet = workbook.worksheets.add("Possible");
  const readmeSheet = workbook.worksheets.add("README");

  housesSheet.getRange(`A1:O${Math.max(1, audit.houses.length + 1)}`).values = [
    ["house_id", "address", "postal_code", "city", "bfe_number", "housing_type", "housing_type_source", "recommended_count", "possible_count", "not_relevant_count", "pending_recommendation_count", "active_system_task_count", "stale_materialized_count", "state_alignment", "notes"],
    ...audit.houses.map((row) => [row.houseId, row.address, row.postalCode, row.city, row.bfeNumber, row.housingType, row.housingTypeSource, row.recommendedCount, row.possibleCount, row.notRelevantCount, row.pendingRecommendationCount, row.activeSystemTaskCount, row.staleMaterializedCount, row.stateAlignment, row.notes])
  ];
  styleSheet(housesSheet, audit.houses.length + 1, 15, [28, 30, 12, 18, 18, 16, 30, 16, 14, 18, 22, 20, 20, 16, 55], "QaHouses");

  recommendedSheet.getRange(`A1:L${Math.max(1, audit.recommended.length + 1)}`).values = [
    ["address", "housing_type", "catalog_key", "recommendation", "category", "applicability", "required_component", "component_status", "responsibility_scope", "materialized_pending", "active_system_task", "reason"],
    ...audit.recommended.map((row) => [row.address, row.housingType, row.catalogKey, row.recommendation, row.category, row.applicability, row.requiredComponent, row.componentStatus, row.responsibilityScope, row.materializedPending, row.activeSystemTask, row.reason])
  ];
  styleSheet(recommendedSheet, audit.recommended.length + 1, 12, [30, 16, 30, 36, 18, 24, 30, 54, 22, 20, 20, 58], "QaRecommended");

  apartmentSheet.getRange(`A1:K${Math.max(1, audit.apartmentReview.length + 1)}`).values = [
    ["address", "recommendation", "result", "responsibility_scope", "applicability", "required_component", "component_status", "materialized_pending", "active_system_task", "reason", "manual_review"],
    ...audit.apartmentReview.map((row) => [row.address, row.recommendation, row.result, row.responsibilityScope, row.applicability, row.requiredComponent, row.componentStatus, row.materializedPending, row.activeSystemTask, row.reason, row.manualReview])
  ];
  styleSheet(apartmentSheet, audit.apartmentReview.length + 1, 11, [30, 38, 16, 22, 24, 30, 54, 20, 20, 58, 16], "QaApartmentReview");
  addYesNoFormatting(apartmentSheet, `K2:K${Math.max(2, audit.apartmentReview.length + 1)}`);

  heatingSheet.getRange(`A1:L${Math.max(1, audit.heating.length + 1)}`).values = [
    ["address", "housing_type", "heating_system", "district_heating", "central_heating", "heat_pump", "gas_boiler", "oil_boiler", "wood_stove", "fireplace", "chimney", "recommended_heating_tasks"],
    ...audit.heating.map((row) => [row.address, row.housingType, row.heatingSystem, row.districtHeating, row.centralHeating, row.heatPump, row.gasBoiler, row.oilBoiler, row.woodStove, row.fireplace, row.chimney, row.recommendedHeatingTasks])
  ];
  styleSheet(heatingSheet, audit.heating.length + 1, 12, [30, 16, 18, 18, 18, 16, 16, 16, 16, 16, 14, 70], "QaHeating");

  possibleSheet.getRange(`A1:G${Math.max(1, audit.possible.length + 1)}`).values = [
    ["address", "housing_type", "recommendation", "condition", "required_component", "component_status", "reason"],
    ...audit.possible.map((row) => [row.address, row.housingType, row.recommendation, row.condition, row.requiredComponent, row.componentStatus, row.reason])
  ];
  styleSheet(possibleSheet, audit.possible.length + 1, 7, [30, 16, 38, 58, 30, 54, 58], "QaPossible");

  const housingDistribution = Object.fromEntries(["villa", "row_house", "apartment", "summer_house", "unknown"].map((type) => [type, audit.houses.filter((row) => row.housingType === type).length]));
  const multipleHeating = audit.heating.filter((row) => [row.districtHeating, row.heatPump, row.gasBoiler, row.oilBoiler, row.woodStove, row.fireplace].filter((value) => value === "present").length > 1);
  readmeSheet.getRange("A1:B22").values = [
    ["QA maintenance recommendation audit", "Current-state live QA snapshot"],
    ["Generated at", new Date()],
    ["Ruleset version", MAINTENANCE_RULESET_VERSION],
    ["Rules source", "docs/product/maintenance-recommendation-rules.xlsx#Proposed Rules"],
    ["QA source", "QA Postgres: houses, current BBR normalized snapshot, house_facts, house_components"],
    ["Evaluation", "Uses evaluateMaintenanceCatalogApplicability from the application runtime; no simplified copy of rules."],
    ["Read/write scope", "Read-only QA SELECTs and local workbook export. Reconciliation is a separate QA-only command; this audit itself performs no QA writes."],
    ["Relevant", "Evaluator status=relevant and eligible=true."],
    ["Possible", "Evaluator status=possible; currently driven by housing-type CONDITIONAL gates."],
    ["Not relevant", "All other evaluator results, including component requirements not positively documented."],
    ["Housing mapping", "Derived from explicit BBR/public-data signals using the same application mapping; unknown is retained as unknown."],
    ["Apartment Review", "Includes relevant and possible apartment rows. manual_review is audit help only and does not alter results."],
    ["Materialized state", "Recommended includes pending recommendation and active originated system-task columns. Houses state_alignment is REVIEW when stale active state remains."],
    ["State semantics", "The engine result is authoritative for eligibility; materialized columns show current QA database state after lifecycle processing."],
    ["Heating", "Heating sources are listed independently so simultaneous sources can be reviewed."],
    ["QA houses", audit.houses.length],
    ["Housing distribution", JSON.stringify(housingDistribution)],
    ["Total relevant", audit.houses.reduce((sum, row) => sum + row.recommendedCount, 0)],
    ["Total possible", audit.houses.reduce((sum, row) => sum + row.possibleCount, 0)],
    ["Apartment review rows", audit.apartmentReview.length],
    ["Multiple heating sources", multipleHeating.length],
    ["Data-quality flags", audit.dataQuality.length]
  ];
  readmeSheet.showGridLines = false;
  readmeSheet.getRange("A1:B1").format = { fill: "#0F766E", font: { bold: true, color: "#FFFFFF" } };
  readmeSheet.getRange("A1:B22").format.wrapText = true;
  readmeSheet.getRange("A:A").format.columnWidth = 28;
  readmeSheet.getRange("B:B").format.columnWidth = 105;
  readmeSheet.getRange("A1:B22").format.borders = { insideHorizontal: { style: "thin", color: "#D9E2E1" } };
  readmeSheet.freezePanes.freezeRows(1);
  readmeSheet.getRange("B2").format.numberFormat = "yyyy-mm-dd hh:mm";

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const previewDir = await fs.mkdtemp(path.join(os.tmpdir(), "matriva-qa-audit-"));
  for (const sheetName of ["Houses", "Recommended", "Apartment Review", "Heating", "Possible", "README"]) {
    const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(path.join(previewDir, `${sheetName.replaceAll(" ", "-")}.png`), new Uint8Array(await preview.arrayBuffer()));
  }
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputPath);

  const verificationWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
  const expectedSheets = ["Houses", "Recommended", "Apartment Review", "Heating", "Possible", "README"];
  for (const sheetName of expectedSheets) {
    const sheet = verificationWorkbook.worksheets.getItem(sheetName);
    if (!sheet.getUsedRange().values?.length) throw new Error(`Workbook verification failed: ${sheetName} is empty.`);
  }
  const formulaErrors = await verificationWorkbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
    summary: "QA audit workbook formula error scan"
  });
  if (formulaErrors.ndjson && /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/.test(formulaErrors.ndjson)) {
    throw new Error("Workbook verification failed: formula error found.");
  }
  console.log(JSON.stringify({
    workbookVerification: "passed",
    sheets: expectedSheets,
    renderedSheets: expectedSheets,
    formulaErrorScan: "passed",
    outputPath
  }));
}

const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(rulesWorkbookPath));
const categoryMap = recommendationCategoryMap(sourceWorkbook);
const data = await queryQaData();
const audit = buildAuditRows(data, categoryMap);
await writeWorkbook(audit, categoryMap);

const housingDistribution = Object.fromEntries(["villa", "row_house", "apartment", "summer_house", "unknown"].map((type) => [type, audit.houses.filter((row) => row.housingType === type).length]));
  const multipleHeating = audit.heating.filter((row) => [row.districtHeating, row.heatPump, row.gasBoiler, row.oilBoiler, row.woodStove, row.fireplace].filter((value) => value === "present").length > 1);
  const suspiciousApartments = audit.apartmentReview.filter((row) => row.manualReview === "YES");
  const dataQualityByIssue = Object.entries(audit.dataQuality.reduce((counts, row) => {
    const key = row.issue.split(":")[0];
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {})).sort(([a], [b]) => a.localeCompare(b));
  console.log(JSON.stringify({
  outputPath,
  rulesetVersion: MAINTENANCE_RULESET_VERSION,
  qaHouses: audit.houses.length,
  housingDistribution,
  housingTypeDetails: audit.houses.map((row) => ({ address: row.address, housingType: row.housingType, evidence: row.housingTypeEvidence })),
  totalRelevant: audit.houses.reduce((sum, row) => sum + row.recommendedCount, 0),
  totalPossible: audit.houses.reduce((sum, row) => sum + row.possibleCount, 0),
  averageRelevantByHousingType: Object.fromEntries(["villa", "row_house", "apartment", "summer_house", "unknown"].map((type) => {
    const rows = audit.houses.filter((row) => row.housingType === type);
    return [type, rows.length ? Number((rows.reduce((sum, row) => sum + row.recommendedCount, 0) / rows.length).toFixed(2)) : 0];
  })),
  apartmentRecommendations: audit.apartmentReview.length,
  suspiciousApartmentRecommendations: suspiciousApartments.length,
  suspiciousApartmentRecommendationKeys: [...new Set(suspiciousApartments.map((row) => row.catalogKey))],
  multipleHeatingSources: multipleHeating.map((row) => ({ address: row.address, housingType: row.housingType })),
  unknownHousingTypeHouses: audit.houses.filter((row) => row.housingType === "unknown").map((row) => row.address),
  dataQualityFlags: audit.dataQuality.length,
  dataQualityByIssue,
  recommendationRows: audit.recommended.length,
  possibleRows: audit.possible.length,
  pendingRecommendationState: audit.houses.reduce((sum, row) => sum + row.pendingRecommendationCount, 0),
  activeSystemTaskState: audit.houses.reduce((sum, row) => sum + row.activeSystemTaskCount, 0),
  stateAlignmentReviewHouses: audit.houses.filter((row) => row.stateAlignment === "REVIEW").map((row) => row.address),
  staleMaterializedState: audit.houses.reduce((sum, row) => sum + row.staleMaterializedCount, 0),
  possibleRemovedDueAbsentPrecedence: audit.possibleRemovedDueAbsentPrecedence,
  possibleRemovedDueUnknownPrecedence: audit.possibleRemovedDueUnknownPrecedence,
  notes: "Credentials and raw public-data payloads are not written to the workbook."
}, null, 2));
