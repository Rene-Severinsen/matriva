import test from "node:test";
import assert from "node:assert/strict";

import {
  assertQaDatabaseUrl,
  classifyStaleRecommendation,
  classifySystemTask
} from "./reconcile-qa-maintenance-recommendations.mjs";

test("QA database guard accepts QA and rejects production-like targets", () => {
  assert.equal(assertQaDatabaseUrl("postgresql://user:secret@db.example/matriva_qa"), "postgresql://user:secret@db.example/matriva_qa");
  assert.throws(() => assertQaDatabaseUrl("postgresql://user:secret@db.example/matriva_prod"), /production-like|database name/);
  assert.throws(() => assertQaDatabaseUrl("postgresql://user:secret@db.example/matriva_dev"), /must identify QA/);
  assert.throws(() => assertQaDatabaseUrl("postgresql://user:secret@prod.example/matriva_qa"), /production-like/);
});

test("pending catalog recommendations are stale only when ineligible or old", () => {
  const base = {source_type: "matriva_catalog", accepted_task_id: null, status: "pending", catalog_version: "v1"};
  assert.deepEqual(classifyStaleRecommendation(base, {status: "relevant", eligible: true}, "v1"), {stale: false, reason: "current_and_relevant"});
  assert.deepEqual(classifyStaleRecommendation(base, {status: "not_relevant", eligible: false}, "v1"), {stale: true, reason: "not_relevant"});
  assert.deepEqual(classifyStaleRecommendation({...base, catalog_version: "old"}, {status: "relevant", eligible: true}, "v1"), {stale: true, reason: "old_catalog_version"});
  assert.deepEqual(classifyStaleRecommendation({...base, accepted_task_id: "task_1"}, {status: "not_relevant", eligible: false}, "v1"), {stale: false, reason: "accepted_task_preserved"});
});

test("system task cleanup archives only active originated tasks", () => {
  assert.deepEqual(classifySystemTask({status: "planned", source: "recommendation_accepted", origin_catalog_key: "water_stopcock_check", archived_at: null, deleted_at: null}, {status: "not_relevant", eligible: false}), {action: "archive", reason: "not_relevant"});
  assert.deepEqual(classifySystemTask({status: "planned", source: "user_created", origin_catalog_key: null, archived_at: null, deleted_at: null}, {status: "not_relevant", eligible: false}), {action: "preserve", reason: "manual_task"});
  assert.deepEqual(classifySystemTask({status: "planned", source: "recommendation_accepted", origin_catalog_key: null, archived_at: null, deleted_at: null}, {status: "not_relevant", eligible: false}), {action: "unresolved", reason: "active_system_task_without_origin"});
  assert.deepEqual(classifySystemTask({status: "done", source: "recommendation_accepted", origin_catalog_key: "water_stopcock_check", archived_at: null, deleted_at: null}, {status: "not_relevant", eligible: false}), {action: "preserve", reason: "historical_or_inactive"});
});
