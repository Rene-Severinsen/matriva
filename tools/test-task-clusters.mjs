import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { classifyUserMaintenanceTask } from "../apps/api/src/maintenance-task-classifier.ts";

test("hybrid classifier groups known Danish formulations without changing source text", () => {
  const first = classifyUserMaintenanceTask("Rens tagrenderne", "Fjern blade og snavs");
  const second = classifyUserMaintenanceTask("Tjek tagrende", null);

  assert.equal(first.clusterKey, "catalog:gutters_clean");
  assert.equal(second.clusterKey, "catalog:gutters_clean");
  assert.equal(first.method, "known_match");
  assert.equal(first.confidence > 0.9, true);
});

test("low-confidence wording remains unclassified", () => {
  const result = classifyUserMaintenanceTask("Husk det", null);

  assert.equal(result.clusterKey, null);
  assert.equal(result.confidence < 0.55, true);
});

test("cluster migration keeps raw task data separate and supports admin operations", async () => {
  const migration = await readFile(new URL("../apps/api/src/migrations/0031_user_task_cluster_analytics_v1.sql", import.meta.url), "utf8");

  assert.match(migration, /create table if not exists maintenance_task_clusters/);
  assert.match(migration, /create table if not exists maintenance_task_cluster_memberships/);
  assert.match(migration, /create table if not exists maintenance_task_cluster_audit_log/);
  assert.match(migration, /classification_method in \('normalization', 'known_match', 'semantic', 'manual'\)/);
  assert.match(migration, /action in \('classified', 'corrected', 'merged', 'split', 'status_changed'\)/);
  assert.doesNotMatch(migration, /alter table maintenance_tasks/);
});

