import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

const host = "127.0.0.1";
const port = "4105";
const baseUrl = `http://${host}:${port}`;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const regularEmail = `admin-smoke-${Date.now()}@example.test`;
const superAdminEmail = "rene@joinit.dk";
const startupTimeoutMs = 20_000;
const pollIntervalMs = 250;

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
      throw new Error("API exited before admin smoke could run.");
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

  throw new Error(
    `Timed out waiting for ${baseUrl}/health: ${lastError?.message ?? "unknown"}`
  );
}

async function login(email) {
  const link = await request("/v1/auth/magic-link/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
  assert.equal(link.response.status, 200);
  assert.match(link.body.devMagicLink, /^matriva:\/\/auth\/magic-link\?token=/);

  const token = new URL(link.body.devMagicLink).searchParams.get("token");
  assert(token, "dev magic link must contain token");

  const session = await request("/v1/auth/magic-link/consume", {
    method: "POST",
    body: JSON.stringify({ token })
  });
  assert.equal(session.response.status, 200);
  assert.ok(session.body.tokens.accessToken);
  assert.ok(session.body.tokens.refreshToken);

  return session.body;
}

async function runSmoke() {
  const missing = await request("/v1/admin/bootstrap");
  assert.equal(missing.response.status, 401, "admin route must require auth");

  const invalid = await request("/v1/admin/bootstrap", {
    headers: bearer("not-a-valid-access-token")
  });
  assert.equal(invalid.response.status, 401, "invalid token must be rejected");

  const regularSession = await login(regularEmail);
  const forbidden = await request("/v1/admin/bootstrap", {
    headers: bearer(regularSession.tokens.accessToken)
  });
  assert.equal(
    forbidden.response.status,
    403,
    "regular authenticated users must not access admin"
  );
  assert.equal(forbidden.body.code, "admin_forbidden");

  const adminSession = await login(superAdminEmail);
  const bootstrap = await request("/v1/admin/bootstrap", {
    headers: bearer(adminSession.tokens.accessToken)
  });
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.admin.userId, adminSession.user.id);
  assert.equal(bootstrap.body.admin.email, superAdminEmail);
  assert.deepEqual(bootstrap.body.admin.roles, ["SUPER_ADMIN"]);
  assert.ok(bootstrap.body.generatedAt);

  const leaked = JSON.stringify(bootstrap.body);
  assert.equal(leaked.includes("accessToken"), false);
  assert.equal(leaked.includes("refreshToken"), false);
  assert.equal(leaked.includes("token_hash"), false);
  assert.equal(leaked.includes("auth_sessions"), false);

  const secondBootstrap = await request("/v1/admin/bootstrap", {
    headers: bearer(adminSession.tokens.accessToken)
  });
  assert.equal(secondBootstrap.response.status, 200);

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const roleCount = await pool.query(
      `
        select count(*)::int as count
        from user_roles ur
        join users u on u.id = ur.user_id
        where u.email = $1 and ur.role = 'SUPER_ADMIN'
      `,
      [superAdminEmail]
    );
    assert.equal(
      roleCount.rows[0]?.count,
      1,
      "permanent SUPER_ADMIN provisioning must be idempotent"
    );
  } finally {
    await pool.end();
  }

  const me = await request("/v1/me", {
    headers: bearer(adminSession.tokens.accessToken)
  });
  assert.equal(me.response.status, 200, "ordinary auth route must still work");
  assert.equal(me.body.user.email, superAdminEmail);

  const refreshed = await request("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: adminSession.tokens.refreshToken })
  });
  assert.equal(refreshed.response.status, 200);
  assert.notEqual(
    refreshed.body.tokens.refreshToken,
    adminSession.tokens.refreshToken,
    "refresh token should still rotate"
  );

  console.log("Admin smoke passed.");
}

const child = startApi();

try {
  await waitForHealth(child);
  await runSmoke();
} finally {
  stopApi(child);
}
