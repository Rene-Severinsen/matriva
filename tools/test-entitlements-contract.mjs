import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  apiErrorSchema,
  entitlementsSchema
} from "../packages/shared/dist/index.js";

const migration = await readFile(new URL("../apps/api/src/migrations/0024_entitlements_v1.sql", import.meta.url), "utf8");

const freeFeatures = {
  "houses.maxActive": { kind: "limit", value: 1 },
  "documents.maxCount": { kind: "limit", value: 2 },
  "documents.maxStorageMb": { kind: "limit", value: 10 },
  "tasks.maxActive": { kind: "limit", value: 4 },
  "maintenance.fullPlan.enabled": { kind: "boolean", value: true },
  "seasonalRecommendations.enabled": { kind: "boolean", value: true },
  "advisories.enabled": { kind: "boolean", value: false },
  "localAdvisories.enabled": { kind: "boolean", value: false },
  "legalUpdates.enabled": { kind: "boolean", value: false },
  "documentExpiry.enabled": { kind: "boolean", value: true },
  "sharing.enabled": { kind: "boolean", value: false },
  "multiUser.enabled": { kind: "boolean", value: false },
  "export.enabled": { kind: "boolean", value: false },
  "history.extended.enabled": { kind: "boolean", value: false },
  "advancedReminders.enabled": { kind: "boolean", value: false }
};

test("Free entitlement contract has the product limits", () => {
  const result = entitlementsSchema.parse({
    plan: "free",
    configuredPlan: "free",
    accessPlan: "free",
    status: "free",
    source: "default",
    features: freeFeatures,
    usage: {
      houses: { active: 0, limit: 1 },
      documents: { active: 0, storageBytes: 0, limit: 2, storageLimitBytes: 10 * 1024 * 1024 },
      tasks: { active: 0, limit: 4 }
    },
    evaluatedAt: new Date().toISOString()
  });

  assert.equal(result.usage.houses.limit, 1);
  assert.equal(result.usage.documents.limit, 2);
  assert.equal(result.usage.documents.storageLimitBytes, 10 * 1024 * 1024);
  assert.equal(result.usage.tasks.limit, 4);
  assert.equal(result.features["sharing.enabled"].value, false);
});

test("limit errors expose stable machine-readable details", () => {
  const result = apiErrorSchema.parse({
    code: "entitlement_limit_reached",
    message: "Limit reached",
    details: { feature: "tasks.maxActive", limit: 4, current: 4 }
  });
  assert.equal(result.details?.feature, "tasks.maxActive");
  assert.equal(result.details?.limit, 4);
});

test("migration seeds both configurable plans and audit storage", () => {
  assert.match(migration, /create table if not exists entitlement_plan_configs/);
  assert.match(migration, /create table if not exists user_entitlements/);
  assert.match(migration, /create table if not exists entitlement_audit_log/);
  assert.match(migration, /\('free'/);
  assert.match(migration, /\('pro'/);
});
