import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultInput = join(repoRoot, "docs/product/maintenance-recommendation-rules.xlsx");
const defaultOutput = join(repoRoot, "apps/api/src/generated/maintenance-recommendation-rules.ts");
const RULESET_VERSION = "2026-08-30.approved-rules-v1";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const inputPath = valueAfter("--input") ?? defaultInput;
const outputPath = valueAfter("--output") ?? defaultOutput;

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

function unzipEntry(workbookPath, entry, optional = false) {
  try {
    return execFileSync("unzip", ["-p", workbookPath, entry], { encoding: "utf8" });
  } catch (error) {
    if (optional) return "";
    throw new Error(`Could not read ${entry} from ${workbookPath}: ${error.message}`);
  }
}

function xmlDecode(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`(?:^|\\s)(?:[A-Za-z0-9_]+:)?${name}="([^"]*)"`));
  return match ? xmlDecode(match[1]) : null;
}

function normalizeTarget(target) {
  const withoutPrefix = target.replace(/^\//, "");
  return withoutPrefix.startsWith("xl/") ? withoutPrefix : `xl/${withoutPrefix}`;
}

function columnIndex(cellRef) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0] ?? "";
  let index = 0;
  for (const letter of letters.toUpperCase()) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<(?:[A-Za-z0-9_]+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?si>/g)].map((match) =>
    [...match[1].matchAll(/<(?:[A-Za-z0-9_]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/g)]
      .map((text) => xmlDecode(text[1]))
      .join("")
  );
}

function parseCell(cellXml, attributes, sharedStrings) {
  const type = xmlAttribute(attributes, "t");
  const inlineText = [...cellXml.matchAll(/<(?:[A-Za-z0-9_]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/g)]
    .map((match) => xmlDecode(match[1]))
    .join("");
  const rawValue = cellXml.match(/<(?:[A-Za-z0-9_]+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?v>/)?.[1] ?? "";

  if (type === "inlineStr") return inlineText;
  if (type === "s") return sharedStrings[Number.parseInt(rawValue, 10)] ?? "";
  if (type === "b") return rawValue === "1";
  if (rawValue === "") return inlineText || null;
  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? numeric : xmlDecode(rawValue);
}

function parseSheet(xml, sharedStrings) {
  const rows = new Map();
  for (const rowMatch of xml.matchAll(/<(?:[A-Za-z0-9_]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?row>/g)) {
    const rowNumber = Number.parseInt(xmlAttribute(rowMatch[1], "r") ?? "0", 10);
    if (!rowNumber) continue;
    const values = [];
    for (const cellMatch of rowMatch[2].matchAll(/<(?:[A-Za-z0-9_]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?c>)/g)) {
      const attributes = cellMatch[1];
      const cellRef = xmlAttribute(attributes, "r");
      if (!cellRef) continue;
      values[columnIndex(cellRef)] = parseCell(cellMatch[2] ?? "", attributes, sharedStrings);
    }
    rows.set(rowNumber, values);
  }
  return rows;
}

function loadWorkbookSheets(workbookPath) {
  const workbookXml = unzipEntry(workbookPath, "xl/workbook.xml");
  const relationshipsXml = unzipEntry(workbookPath, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(unzipEntry(workbookPath, "xl/sharedStrings.xml", true));
  const relationships = new Map();
  for (const match of relationshipsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = xmlAttribute(match[1], "Id") ?? xmlAttribute(match[1], "id");
    const target = xmlAttribute(match[1], "Target");
    if (id && target) relationships.set(id, normalizeTarget(target));
  }

  const sheets = new Map();
  for (const match of workbookXml.matchAll(/<(?:[A-Za-z0-9_]+:)?sheet\b([^>]*)\/>/g)) {
    const name = xmlAttribute(match[1], "name");
    const relationshipId = xmlAttribute(match[1], "id");
    const target = relationshipId ? relationships.get(relationshipId) : null;
    if (name && target) sheets.set(name, parseSheet(unzipEntry(workbookPath, target), sharedStrings));
  }
  return sheets;
}

function cell(row, index) {
  const value = row?.[index];
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseRows(sheetName, rows) {
  const header = rows.get(1) ?? [];
  const data = [];
  for (let rowNumber = 2; rowNumber <= 1000; rowNumber += 1) {
    const row = rows.get(rowNumber);
    if (!row || row.every((value) => value === null || value === undefined || value === "")) continue;
    data.push({rowNumber, values: row});
  }
  return {sheetName, header: header.map((value) => String(value ?? "")), data};
}

const housingValues = new Set(["YES", "NO", "CONDITIONAL"]);
const applicabilityValues = new Set(["UNIVERSAL", "REQUIRES_COMPONENT", "ENRICHED_BY_FACTS", "EXCLUDES_COMPONENT"]);
const scopeValues = new Set(["UNIT", "PRIVATE_BUILDING", "COMMON_BUILDING", "MIXED"]);

function requireEnum(value, allowed, label, errors, rowNumber) {
  if (!allowed.has(value)) errors.push(`row ${rowNumber}: ${label} must be one of ${[...allowed].join(", ")}; got ${JSON.stringify(value)}`);
}

function parseRequiredComponent(value) {
  if (value.includes(" + ")) return {requiresAll: value.split(" + ").map((part) => part.trim()).filter(Boolean)};
  if (value.includes(" OR ")) return {requiresAny: value.split(" OR ").map((part) => part.trim()).filter(Boolean)};
  return {componentKey: value};
}

function buildApplicability(proposedApplicability, requiredComponent, excludedComponent, factKey, rowNumber, errors) {
  if (proposedApplicability === "UNIVERSAL") return {type: "UNIVERSAL"};
  if (proposedApplicability === "ENRICHED_BY_FACTS") {
    if (!factKey) errors.push(`row ${rowNumber}: ENRICHED_BY_FACTS requires a fact_key in Recommendations`);
    return {type: "ENRICHED_BY_FACTS", factKeys: factKey ? [factKey] : []};
  }
  if (proposedApplicability === "EXCLUDES_COMPONENT") {
    if (!excludedComponent) {
      errors.push(`row ${rowNumber}: EXCLUDES_COMPONENT requires excluded_component`);
      return {type: "EXCLUDES_COMPONENT", componentKey: "__missing__"};
    }
    return {type: "EXCLUDES_COMPONENT", componentKey: excludedComponent};
  }
  if (!requiredComponent) {
    errors.push(`row ${rowNumber}: REQUIRES_COMPONENT requires required_component`);
    return {type: "REQUIRES_COMPONENT", componentKey: "__missing__"};
  }
  return {type: "REQUIRES_COMPONENT", ...parseRequiredComponent(requiredComponent), ...(excludedComponent ? {excludesComponentKey: excludedComponent} : {})};
}

function validateAndBuild(workbookPath) {
  if (!existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
  const sheets = loadWorkbookSheets(workbookPath);
  const proposedSheet = parseRows("Proposed Rules", sheets.get("Proposed Rules") ?? new Map());
  const baselineSheet = parseRows("Recommendations", sheets.get("Recommendations") ?? new Map());
  const errors = [];
  const expectedHeaders = [
    "catalog_key", "title", "current_applicability", "proposed_applicability", "required_component", "excluded_component",
    "villa", "row_house", "apartment", "summer_house", "responsibility_scope", "condition", "decision_note"
  ];
  if (JSON.stringify(proposedSheet.header) !== JSON.stringify(expectedHeaders)) {
    errors.push(`Proposed Rules header mismatch; expected ${expectedHeaders.join(", ")}`);
  }
  const baselineByKey = new Map();
  const baselineHeader = baselineSheet.header;
  const baselineIndexes = Object.fromEntries(baselineHeader.map((name, index) => [name, index]));
  for (const row of baselineSheet.data) {
    const key = cell(row.values, baselineIndexes.catalog_key);
    if (key) baselineByKey.set(key, row.values);
  }

  const records = [];
  const seen = new Set();
  for (const row of proposedSheet.data) {
    const [catalogKey, title, currentApplicability, proposedApplicability, requiredComponent, excludedComponent, villa, rowHouse, apartment, summerHouse, responsibilityScope, condition, decisionNote] = Array.from({length: 13}, (_, index) => cell(row.values, index));
    if (!catalogKey) errors.push(`row ${row.rowNumber}: catalog_key is required`);
    if (seen.has(catalogKey)) errors.push(`row ${row.rowNumber}: duplicate catalog_key ${catalogKey}`);
    seen.add(catalogKey);
    if (!title) errors.push(`row ${row.rowNumber}: title is required`);
    requireEnum(currentApplicability, applicabilityValues, "current_applicability", errors, row.rowNumber);
    requireEnum(proposedApplicability, applicabilityValues, "proposed_applicability", errors, row.rowNumber);
    for (const [name, value] of [["villa", villa], ["row_house", rowHouse], ["apartment", apartment], ["summer_house", summerHouse]]) {
      requireEnum(value, housingValues, name, errors, row.rowNumber);
      if (value === "CONDITIONAL" && condition.length < 10) errors.push(`row ${row.rowNumber}: ${name}=CONDITIONAL requires a concrete condition`);
    }
    requireEnum(responsibilityScope, scopeValues, "responsibility_scope", errors, row.rowNumber);
    if (proposedApplicability === "REQUIRES_COMPONENT" && !requiredComponent) errors.push(`row ${row.rowNumber}: REQUIRES_COMPONENT requires required_component`);
    if (proposedApplicability === "EXCLUDES_COMPONENT" && !excludedComponent) errors.push(`row ${row.rowNumber}: EXCLUDES_COMPONENT requires excluded_component`);
    if (proposedApplicability !== "REQUIRES_COMPONENT" && requiredComponent) errors.push(`row ${row.rowNumber}: required_component is only allowed for REQUIRES_COMPONENT`);
    if (proposedApplicability !== "REQUIRES_COMPONENT" && proposedApplicability !== "EXCLUDES_COMPONENT" && excludedComponent) errors.push(`row ${row.rowNumber}: excluded_component is only allowed for component-based applicability`);
    if (!decisionNote) errors.push(`row ${row.rowNumber}: decision_note is required`);
    const baseline = baselineByKey.get(catalogKey);
    if (!baseline) errors.push(`row ${row.rowNumber}: ${catalogKey} is missing from Recommendations baseline`);
    const factKey = baseline ? cell(baseline, baselineIndexes.fact_key) : "";
    if (baseline && cell(baseline, baselineIndexes.title) !== title) errors.push(`row ${row.rowNumber}: title does not match Recommendations for ${catalogKey}`);
    records.push({
      catalogKey,
      title,
      currentApplicability,
      proposedApplicability,
      requiredComponent,
      housing: {villa, row_house: rowHouse, apartment, summer_house: summerHouse},
      responsibilityScope,
      condition: condition || null,
      decisionNote,
      applicability: buildApplicability(proposedApplicability, requiredComponent, excludedComponent, factKey, row.rowNumber, errors)
    });
  }
  if (records.length !== 50) errors.push(`Proposed Rules must contain exactly 50 data rows; got ${records.length}`);
  if (baselineByKey.size !== 50) errors.push(`Recommendations baseline must contain exactly 50 data rows; got ${baselineByKey.size}`);
  for (const key of baselineByKey.keys()) if (!seen.has(key)) errors.push(`Recommendations key ${key} is missing from Proposed Rules`);
  if (errors.length) throw new Error(["Maintenance rules validation failed:", ...errors.map((error) => `- ${error}`)].join("\n"));
  return records;
}

function generateSource(records, workbookPath) {
  const relativeSource = relative(join(repoRoot, "apps/api/src/generated"), workbookPath).replaceAll("\\", "/");
  const payload = Object.fromEntries(records.map((record) => [record.catalogKey, {
    catalogKey: record.catalogKey,
    title: record.title,
    currentApplicability: record.currentApplicability,
    proposedApplicability: record.proposedApplicability,
    applicability: record.applicability,
    housing: record.housing,
    responsibilityScope: record.responsibilityScope,
    condition: record.condition,
    decisionNote: record.decisionNote
  }]));
  return `/* eslint-disable */
// This file is generated by tools/generate-maintenance-rules.mjs.
// Source: ${relativeSource}#Proposed Rules
// Do not edit by hand; run the generator after reviewing the workbook.

import type { MaintenanceCatalogApplicabilityRule } from "../maintenance-catalog.ts";

export type MaintenanceHousingType = "villa" | "row_house" | "apartment" | "summer_house" | "unknown";
export type MaintenanceHousingGateValue = "YES" | "NO" | "CONDITIONAL";
export type MaintenanceResponsibilityScope = "UNIT" | "PRIVATE_BUILDING" | "COMMON_BUILDING" | "MIXED";

export type GeneratedMaintenanceRecommendationRule = {
  catalogKey: string;
  title: string;
  currentApplicability: string;
  proposedApplicability: string;
  applicability: MaintenanceCatalogApplicabilityRule;
  housing: Record<Exclude<MaintenanceHousingType, "unknown">, MaintenanceHousingGateValue>;
  responsibilityScope: MaintenanceResponsibilityScope;
  condition: string | null;
  decisionNote: string;
};

export const MAINTENANCE_RULESET_VERSION = ${JSON.stringify(RULESET_VERSION)};
export const maintenanceRecommendationRules: Record<string, GeneratedMaintenanceRecommendationRule> = ${JSON.stringify(payload, null, 2)};
`;
}

const records = validateAndBuild(inputPath);
const generated = generateSource(records, inputPath);
if (checkOnly) {
  if (!existsSync(outputPath)) throw new Error(`Generated ruleset not found: ${outputPath}`);
  const current = readFileSync(outputPath, "utf8");
  if (current !== generated) throw new Error(`Generated ruleset is stale. Run: node tools/generate-maintenance-rules.mjs`);
  console.log(`Validated ${records.length} maintenance rules; generated ruleset is up to date.`);
} else {
  mkdirSync(dirname(outputPath), {recursive: true});
  writeFileSync(outputPath, generated);
  console.log(`Generated ${records.length} maintenance rules at ${outputPath}`);
}
