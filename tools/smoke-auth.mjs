import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

import {
  assertSafeSmokeDatabase,
  cleanupSmokeUsers
} from "./smoke-database.mjs";

const host = "127.0.0.1";
const port = "4102";
const baseUrl = `http://${host}:${port}`;
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const email = `auth-smoke-${Date.now()}@example.test`;
const unknownEmail = `unknown-${email}`;
const selectedAddress = {
  source: "DAWA",
  sourceAddressId: `dawa-smoke-${Date.now()}`,
  label: "Testvej 1, 1000 København K"
};

assertSafeSmokeDatabase(databaseUrl);

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function bearer(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}


const startupTimeoutMs = 20_000;
const pollIntervalMs = 250;

function startApi() {
  return spawn("npm", ["run", "dev:api"], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      HOST: host,
      PORT: port,
      MATRIVA_AUTH_DISABLE_LIMITS: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function stopApi(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    child.kill("SIGTERM");
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function waitForHealth(child) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("API exited before auth smoke could run.");
    }

    try {
      const health = await request("/health");
      if (health.response.status === 200) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${baseUrl}/health: ${lastError?.message ?? "unknown"}`);
}

async function runSmoke() {
  const missingSession = await request("/v1/houses");
assert.equal(missingSession.response.status, 401, "protected route should require auth");

const first = await request("/v1/auth/magic-link/request", {
  method: "POST",
  body: JSON.stringify({ email })
});
assert.equal(first.response.status, 200);
assert.equal(first.body.ok, true);
assert.match(first.body.devMagicLink, /^matriva:\/\/auth\/magic-link\?token=/);

const repeatOne = await request("/v1/auth/magic-link/request", {
  method: "POST",
  body: JSON.stringify({ email })
});
const repeatTwo = await request("/v1/auth/magic-link/request", {
  method: "POST",
  body: JSON.stringify({ email })
});
assert.equal(repeatOne.response.status, 200);
assert.equal(repeatTwo.response.status, 200);
assert.notEqual(repeatOne.body.devMagicLink, first.body.devMagicLink, "test-mode should create a new dev magic link without cooldown");
assert.notEqual(repeatTwo.body.devMagicLink, repeatOne.body.devMagicLink, "test-mode should create a new token for each request");

const second = await request("/v1/auth/magic-link/request", {
  method: "POST",
  body: JSON.stringify({ email: unknownEmail })
});
assert.equal(second.response.status, 200);
assert.equal(second.body.ok, true);
assert.equal(second.body.message, first.body.message, "known and unknown emails must receive same public response");

const token = new URL(repeatTwo.body.devMagicLink).searchParams.get("token");
assert(token, "dev magic link must contain token");

const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const storedToken = await pool.query(
    "select token_hash from magic_link_tokens order by created_at desc limit 1"
  );
  assert.notEqual(storedToken.rows[0]?.token_hash, token, "database must not store raw magic link token");
  assert.match(storedToken.rows[0]?.token_hash, /^[a-f0-9]{64}$/);
} finally {
  await pool.end();
}

const consumed = await request("/v1/auth/magic-link/consume", {
  method: "POST",
  body: JSON.stringify({ token })
});
assert.equal(consumed.response.status, 200);
assert.ok(consumed.body.tokens.accessToken);
assert.ok(consumed.body.tokens.refreshToken);
assert.equal(consumed.body.user.email, email);

const reused = await request("/v1/auth/magic-link/consume", {
  method: "POST",
  body: JSON.stringify({ token })
});
assert.equal(reused.response.status, 401, "magic link reuse must be rejected");

const invalid = await request("/v1/auth/magic-link/consume", {
  method: "POST",
  body: JSON.stringify({ token: "not-a-real-token-but-long-enough-for-schema-123456789" })
});
assert.equal(invalid.response.status, 401, "invalid magic link must be rejected");

const bootstrapBeforeProfile = await request("/v1/app-bootstrap", {
  headers: bearer(consumed.body.tokens.accessToken)
});
assert.equal(bootstrapBeforeProfile.response.status, 200);
assert.equal(bootstrapBeforeProfile.body.onboarding.state, "profile_required");
assert.deepEqual(bootstrapBeforeProfile.body.houses, []);
assert.equal(bootstrapBeforeProfile.body.activeHouseId, null);

const blankProfile = await request("/v1/me/profile", {
  method: "PUT",
  headers: bearer(consumed.body.tokens.accessToken),
  body: JSON.stringify({ displayName: "   ", preferredLocale: "da-DK" })
});
assert.equal(blankProfile.response.status, 400, "blank profile names must be rejected");

const profile = await request("/v1/me/profile", {
  method: "PUT",
  headers: bearer(consumed.body.tokens.accessToken),
  body: JSON.stringify({ displayName: "  Auth Smoke  ", preferredLocale: "da-DK" })
});
assert.equal(profile.response.status, 200);
assert.equal(profile.body.profile.displayName, "Auth Smoke");

const bootstrapBeforeHouse = await request("/v1/app-bootstrap", {
  headers: bearer(consumed.body.tokens.accessToken)
});
assert.equal(bootstrapBeforeHouse.body.onboarding.state, "house_required");
assert.equal(bootstrapBeforeHouse.body.houses.length, 0);

const savedHouse = await request("/v1/houses", {
  method: "POST",
  headers: bearer(consumed.body.tokens.accessToken),
  body: JSON.stringify({ selectedAddress })
});
assert.equal(savedHouse.response.status, 201);
assert.equal(savedHouse.body.house.ownerUserId, consumed.body.user.id);

const bootstrapComplete = await request("/v1/app-bootstrap", {
  headers: bearer(consumed.body.tokens.accessToken)
});
assert.equal(bootstrapComplete.body.onboarding.state, "complete");
assert.equal(bootstrapComplete.body.houses.length, 1);
assert.equal(bootstrapComplete.body.activeHouseId, savedHouse.body.house.id);

const refreshed = await request("/v1/auth/refresh", {
  method: "POST",
  body: JSON.stringify({ refreshToken: consumed.body.tokens.refreshToken })
});
assert.equal(refreshed.response.status, 200);
assert.notEqual(refreshed.body.tokens.refreshToken, consumed.body.tokens.refreshToken, "refresh token should rotate");

const oldRefresh = await request("/v1/auth/refresh", {
  method: "POST",
  body: JSON.stringify({ refreshToken: consumed.body.tokens.refreshToken })
});
assert.equal(oldRefresh.response.status, 401, "old refresh token should be invalid after rotation");

const logout = await request("/v1/auth/logout", {
  method: "POST",
  headers: bearer(refreshed.body.tokens.accessToken),
  body: JSON.stringify({ refreshToken: refreshed.body.tokens.refreshToken })
});
assert.equal(logout.response.status, 200);

const afterLogout = await request("/v1/houses", {
  headers: bearer(refreshed.body.tokens.accessToken)
});
assert.equal(afterLogout.response.status, 401, "logout must invalidate active session");

  console.log("Auth smoke passed.");
}

const child = startApi();

try {
  await waitForHealth(child);
  await runSmoke();
} finally {
  stopApi(child);
  await cleanupSmokeUsers(databaseUrl, [email, unknownEmail]);
}
