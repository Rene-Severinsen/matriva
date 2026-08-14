import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAppVersionLabel,
  nonProductionEnvironmentLabel,
  normalizeAppIdentityValue
} from "../apps/mobile/src/config/appIdentity.ts";

test("app identity labels use version and build without hardcoded values", () => {
  assert.equal(formatAppVersionLabel("0.1.0", "5"), "Version 0.1.0 (5)");
  assert.equal(formatAppVersionLabel(null, null), "Version ukendt (ukendt)");
});

test("missing or malformed runtime values are safe", () => {
  assert.equal(normalizeAppIdentityValue(undefined), null);
  assert.equal(normalizeAppIdentityValue("  "), null);
  assert.equal(normalizeAppIdentityValue(5), "5");
});

test("production is never shown as an environment label", () => {
  assert.equal(nonProductionEnvironmentLabel("production"), null);
  assert.equal(nonProductionEnvironmentLabel("QA"), "QA");
  assert.equal(nonProductionEnvironmentLabel(undefined), null);
});
