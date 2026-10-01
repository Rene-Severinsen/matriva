import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { apiErrorSchema, entitlementsSchema, billingEventSchema, billingSubscriptionSchema } from "../packages/shared/dist/index.js";

const migration = await readFile(new URL("../apps/api/src/migrations/0037_apple_billing_v1.sql", import.meta.url), "utf8");

test("Free entitlement contract remains backend-compatible", () => {
  const result = entitlementsSchema.parse({ plan: "free", configuredPlan: "free", accessPlan: "free", status: "free", source: "default", features: { "houses.maxActive": { kind: "limit", value: 1 } }, usage: { houses: { active: 0, limit: 1 }, documents: { active: 0, storageBytes: 0, limit: 2, storageLimitBytes: 10 * 1024 * 1024 }, tasks: { active: 0, limit: 4 } }, evaluatedAt: new Date().toISOString() });
  assert.equal(result.plan, "free");
});

test("billing contracts are provider-neutral and Apple-ready", () => {
  const subscription = billingSubscriptionSchema.parse({ id: "bsub_12345678", userId: "usr_12345678", provider: "apple", providerSubscriptionId: "transaction-1", productId: "matriva.pro.monthly", plan: "pro", status: "active", environment: "sandbox", originalTransactionId: "original-1", currentPeriodStartsAt: null, currentPeriodEndsAt: null, autoRenew: true, lastVerifiedAt: null, updatedAt: new Date().toISOString() });
  const event = billingEventSchema.parse({ provider: "apple", environment: "sandbox", providerEventId: "event-1", eventType: "SUBSCRIBED", providerSubscriptionId: "transaction-1", occurredAt: null, payload: {} });
  assert.equal(subscription.provider, event.provider);
  assert.equal(subscription.plan, "pro");
});

test("billing migration removes manual PRO and adds idempotent event storage", () => {
  assert.match(migration, /delete from user_entitlements where source = 'complimentary'/);
  assert.match(migration, /create table if not exists billing_subscriptions/);
  assert.match(migration, /create table if not exists billing_events/);
  assert.match(migration, /unique index if not exists billing_events_provider_event_unique/);
  assert.match(migration, /source in \('default', 'subscription', 'billing'\)/);
  assert.doesNotMatch(migration, /complimentary_pro/);
});

test("limit errors expose stable machine-readable details", () => {
  const result = apiErrorSchema.parse({ code: "entitlement_limit_reached", message: "Limit reached", details: { feature: "tasks.maxActive", limit: 4, current: 4 } });
  assert.equal(result.details?.feature, "tasks.maxActive");
});
