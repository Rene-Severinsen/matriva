import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  MAINTENANCE_RULESET_VERSION,
  maintenanceRecommendationRules
} from "../apps/api/src/generated/maintenance-recommendation-rules.ts";

test("maintenance workbook validates and generated ruleset is current", () => {
  const output = execFileSync(process.execPath, ["tools/generate-maintenance-rules.mjs", "--check"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  assert.match(output, /Validated 50 maintenance rules/);
});

test("generated maintenance ruleset is versioned and complete", () => {
  assert.match(MAINTENANCE_RULESET_VERSION, /^2026-\d{2}-\d{2}\./);
  assert.equal(Object.keys(maintenanceRecommendationRules).length, 50);
});
