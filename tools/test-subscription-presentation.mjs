import assert from "node:assert/strict";
import test from "node:test";
import { subscriptionPresentation } from "../apps/mobile/src/screens/subscriptionPresentation.ts";

const now = Date.parse("2026-10-19T18:00:00Z");
const paid = { accessPlan: "pro", source: "billing", status: "active", expiresAt: "2026-10-20T13:26:46Z" };

test("verified store access is presented as active PRO", () => {
  const state = subscriptionPresentation(paid, now);
  assert.equal(state.pro, true);
  assert.equal(state.store, true);
  assert.equal(state.badge, "PRO AKTIV");
});
test("expired cached access cannot still advertise active PRO", () => {
  const state = subscriptionPresentation(paid, Date.parse(paid.expiresAt));
  assert.equal(state.pro, false);
  assert.match(state.notice, /udløbet/);
});
test("a stored PRO plan never overrides backend Free access", () => {
  for (const status of ["expired", "billing_issue", "refunded_revoked", "cancelled"]) {
    assert.equal(subscriptionPresentation({ ...paid, plan: "pro", accessPlan: "free", status }, now).pro, false);
  }
});
test("complimentary access has a distinct identity and does not imply a purchase", () => {
  const state = subscriptionPresentation({ ...paid, source: "complimentary" }, now);
  assert.equal(state.pro, true);
  assert.equal(state.store, false);
  assert.equal(state.badge, "GRATIS PRO");
});
test("grace period retains backend-granted access and warns about payment", () => {
  const state = subscriptionPresentation({ ...paid, status: "grace_period" }, now);
  assert.equal(state.pro, true);
  assert.match(state.notice, /betalingen/);
});
