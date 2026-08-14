import assert from "node:assert/strict";
import test from "node:test";

import {
  apiErrorSchema,
  appBootstrapResponseSchema,
  entitlementsSchema,
  homeBootstrapResponseSchema
} from "../packages/shared/dist/index.js";
import {
  createMatrivaApiClient,
  MatrivaApiError
} from "../packages/api-client/dist/index.js";
import {
  evaluateMobileCompatibility,
  mobileClientIdentityFromHeaders,
  mobileCompatibilityPolicyFromEnvironment
} from "../apps/api/src/mobile-compatibility.ts";

const now = new Date().toISOString();

function entitlements() {
  const features = {
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

  return {
    plan: "free",
    configuredPlan: "free",
    accessPlan: "free",
    status: "free",
    source: "default",
    complimentaryProGrant: null,
    features,
    usage: {
      houses: { active: 0, limit: 1 },
      documents: { active: 0, storageBytes: 0, limit: 2, storageLimitBytes: 10 * 1024 * 1024 },
      tasks: { active: 0, limit: 4 }
    },
    evaluatedAt: now
  };
}

function compatibility(status = "supported") {
  return {
    status,
    minimumSupportedAppVersion: null,
    minimumSupportedAppBuild: null,
    reason: null,
    updateUrl: null
  };
}

function homeBootstrapPayload() {
  return {
    user: {
      id: "usr_12345678",
      displayName: "Test user",
      email: "test@example.com"
    },
    house: null,
    entitlements: entitlements(),
    cards: [],
    compatibility: compatibility(),
    generatedAt: now,
    skeleton: true
  };
}

function appBootstrapPayload() {
  return {
    user: {
      id: "usr_12345678",
      email: "test@example.com",
      emailVerifiedAt: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    },
    profile: {
      displayName: "Test user",
      preferredLocale: "da-DK",
      promptForCompletionNote: true,
      defaultHouseId: null
    },
    onboarding: { state: "house_required" },
    houses: [],
    activeHouseId: null,
    pendingHouseClaims: [],
    ownerPendingHouseClaims: [],
    pendingHouseInvitations: [],
    publicDataSummaries: [],
    entitlements: entitlements(),
    cards: [],
    compatibility: compatibility(),
    generatedAt: now
  };
}

test("legacy bootstrap schema ignores additive response fields, including entitlement fields", () => {
  const legacyPayload = appBootstrapPayload();
  delete legacyPayload.compatibility;
  assert.equal(appBootstrapResponseSchema.parse(legacyPayload).compatibility.status, "supported");

  const payload = {
    ...appBootstrapPayload(),
    newBootstrapField: { introducedBy: "backend-a" },
    entitlements: {
      ...entitlements(),
      newEntitlementField: true,
      features: {
        ...entitlements().features,
        "future.feature.enabled": { kind: "boolean", value: true }
      },
      usage: {
        ...entitlements().usage,
        newUsageMetric: 7,
        houses: { ...entitlements().usage.houses, futureLimit: 2 }
      }
    }
  };

  const parsed = appBootstrapResponseSchema.parse(payload);

  assert.equal(parsed.onboarding.state, "house_required");
  assert.equal(parsed.entitlements.usage.houses.active, 0);
  assert.equal("newBootstrapField" in parsed, false);
  assert.equal("newEntitlementField" in parsed.entitlements, false);
  assert.equal(parsed.entitlements.features["future.feature.enabled"].value, true);
  assert.equal("newUsageMetric" in parsed.entitlements.usage, false);
  assert.equal("futureLimit" in parsed.entitlements.usage.houses, false);
});

test("known response fields remain type validated", () => {
  assert.throws(
    () => entitlementsSchema.parse({ ...entitlements(), usage: { ...entitlements().usage, tasks: { active: "0", limit: 4 } } }),
    /"tasks"[\s\S]*"active"/
  );
  assert.throws(
    () => homeBootstrapResponseSchema.parse({ ...homeBootstrapPayload(), generatedAt: 123 }),
    /generatedAt/
  );
});

test("a supported client receives normal bootstrap and sends Expo identity headers", async () => {
  const requests = [];
  const client = createMatrivaApiClient({
    baseUrl: "https://api.example.test",
    appVersion: "1.2.3",
    appBuild: "42",
    fetchImpl: async (input, init) => {
      requests.push({ input: String(input), headers: new Headers(init?.headers) });
      return new Response(JSON.stringify(homeBootstrapPayload()), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const result = await client.getBootstrap();

  assert.equal(result.skeleton, true);
  assert.equal(result.compatibility.status, "supported");
  assert.equal(requests[0].headers.get("x-matriva-app-version"), "1.2.3");
  assert.equal(requests[0].headers.get("x-matriva-app-build"), "42");
});

test("an explicitly unsupported client gets a controlled upgrade-required API error", async () => {
  const policy = mobileCompatibilityPolicyFromEnvironment({
    MATRIVA_MIN_SUPPORTED_APP_VERSION: "2.0.0",
    MATRIVA_MIN_SUPPORTED_APP_BUILD: "100",
    MATRIVA_APP_UPDATE_URL: "https://apps.apple.com/app/id123"
  });
  const evaluated = evaluateMobileCompatibility(
    mobileClientIdentityFromHeaders({
      "x-matriva-app-version": "1.9.9",
      "x-matriva-app-build": "99"
    }),
    policy
  );

  assert.deepEqual(evaluated, {
    status: "upgrade_required",
    minimumSupportedAppVersion: "2.0.0",
    minimumSupportedAppBuild: 100,
    reason: "minimum_app_version",
    updateUrl: "https://apps.apple.com/app/id123"
  });
  const parsedError = apiErrorSchema.parse({
    code: "app_update_required",
    message: "Update required",
    details: { compatibility: evaluated }
  });
  assert.equal(parsedError.details.compatibility.status, "upgrade_required");

  const client = createMatrivaApiClient({
    baseUrl: "https://api.example.test",
    fetchImpl: async () => new Response(JSON.stringify({
      code: "app_update_required",
      message: "Denne version af Matriva skal opdateres for at fortsætte.",
      details: { compatibility: evaluated }
    }), { status: 426, headers: { "content-type": "application/json" } })
  });

  await assert.rejects(
    () => client.getBootstrap(),
    (error) => {
      assert.ok(error instanceof MatrivaApiError);
      assert.equal(error.status, 426);
      assert.equal(error.code, "app_update_required");
      assert.match(error.message, /opdateres/);
      return true;
    }
  );
});

test("missing version headers remain supported even when a policy is configured", async () => {
  const policy = mobileCompatibilityPolicyFromEnvironment({
    MATRIVA_MIN_SUPPORTED_APP_VERSION: "2.0.0",
    MATRIVA_MIN_SUPPORTED_APP_BUILD: "100"
  });
  assert.equal(
    evaluateMobileCompatibility({ appVersion: null, appBuild: null }, policy).status,
    "supported"
  );

  const requests = [];
  const client = createMatrivaApiClient({
    baseUrl: "https://api.example.test",
    fetchImpl: async (input, init) => {
      requests.push(new Headers(init?.headers));
      return new Response(JSON.stringify(homeBootstrapPayload()), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });
  const result = await client.getBootstrap();

  assert.equal(result.compatibility.status, "supported");
  assert.equal(requests[0].has("x-matriva-app-version"), false);
  assert.equal(requests[0].has("x-matriva-app-build"), false);
});
