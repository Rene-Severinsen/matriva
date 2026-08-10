import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { assertSafeSmokeDatabase, cleanupSmokeUsers } from "./smoke-database.mjs";

const host = "127.0.0.1";
const port = "4104";
const baseUrl = `http://${host}:${port}`;
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const runId = Date.now();
const ownerEmail = `house-default-owner-${runId}@example.test`;
const otherEmail = `house-default-other-${runId}@example.test`;
const emails = [ownerEmail, otherEmail];
assertSafeSmokeDatabase(databaseUrl);

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers ?? {}) } });
  return { response, body: await response.json().catch(() => ({})) };
}
function bearer(token) { return { authorization: `Bearer ${token}` }; }
async function login(email) {
  const requested = await request("/v1/auth/magic-link/request", { method: "POST", body: JSON.stringify({ email }) });
  assert.equal(requested.response.status, 200);
  const token = new URL(requested.body.devMagicLink).searchParams.get("token");
  const consumed = await request("/v1/auth/magic-link/consume", { method: "POST", body: JSON.stringify({ token }) });
  assert.equal(consumed.response.status, 200);
  return consumed.body;
}
async function waitForHealth(child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null) throw new Error("API exited before house default smoke could run.");
    try { if ((await request("/health")).response.status === 200) return; } catch {}
    await delay(250);
  }
  throw new Error("Timed out waiting for the API.");
}

const child = spawn("npm", ["run", "dev:api"], { cwd: process.cwd(), detached: true, env: { ...process.env, DATABASE_URL: databaseUrl, HOST: host, PORT: port, MATRIVA_AUTH_DISABLE_LIMITS: "true" }, stdio: "ignore" });
const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  await waitForHealth(child);
  const owner = await login(ownerEmail);
  const other = await login(otherEmail);
  const houseOne = `house_default_one_${runId}`;
  const houseTwo = `house_default_two_${runId}`;
  const houseThree = `house_default_three_${runId}`;
  const otherHouse = `house_default_other_${runId}`;
  await pool.query("insert into houses (id, user_id, address_label, status, data_confidence, bfe_number) values ($1, $2, $3, 'saved', 'not_verified', $4), ($5, $6, $7, 'saved', 'not_verified', $8), ($9, $10, $11, 'saved', 'not_verified', $12), ($13, $14, $15, 'saved', 'not_verified', $16)", [houseOne, owner.user.id, "Defaulttest 1, 1000 København K", `bfe-one-${runId}`, houseTwo, owner.user.id, "Defaulttest 2, 1000 København K", `bfe-two-${runId}`, houseThree, owner.user.id, "Defaulttest 3, 1000 København K", `bfe-three-${runId}`, otherHouse, other.user.id, "Anden bruger 1, 1000 København K", `bfe-other-${runId}`]);
  await pool.query("insert into house_memberships (id, house_id, user_id, role, status) values ($1, $2, $3, 'owner', 'active')", [`hm_default_one_${runId}`, houseOne, owner.user.id]);
  let bootstrap = await request("/v1/app-bootstrap", { headers: bearer(owner.tokens.accessToken) });
  assert.equal(bootstrap.body.activeHouseId, houseOne, "one house auto-selects");

  await pool.query("insert into house_memberships (id, house_id, user_id, role, status) values ($1, $2, $3, 'owner', 'active'), ($4, $5, $6, 'owner', 'active'), ($7, $8, $9, 'owner', 'active')", [`hm_default_two_${runId}`, houseTwo, owner.user.id, `hm_default_three_${runId}`, houseThree, owner.user.id, `hm_default_other_${runId}`, otherHouse, other.user.id]);
  bootstrap = await request("/v1/app-bootstrap", { headers: bearer(owner.tokens.accessToken) });
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.houses.length, 3);
  assert.equal(bootstrap.body.activeHouseId, null, "multiple houses without default require selection");

  const setDefault = await request("/v1/me/default-house", { method: "PUT", headers: bearer(owner.tokens.accessToken), body: JSON.stringify({ houseId: houseTwo }) });
  assert.equal(setDefault.response.status, 200);
  assert.equal(setDefault.body.profile.defaultHouseId, houseTwo);
  bootstrap = await request("/v1/app-bootstrap", { headers: bearer(owner.tokens.accessToken) });
  assert.equal(bootstrap.body.activeHouseId, houseTwo, "valid default auto-selects");

  const invalid = await request("/v1/me/default-house", { method: "PUT", headers: bearer(owner.tokens.accessToken), body: JSON.stringify({ houseId: otherHouse }) });
  assert.equal(invalid.response.status, 400, "default must require active membership");

  const reset = await request("/v1/me/default-house", { method: "PUT", headers: bearer(owner.tokens.accessToken), body: JSON.stringify({ houseId: null }) });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.profile.defaultHouseId, null);
  bootstrap = await request("/v1/app-bootstrap", { headers: bearer(owner.tokens.accessToken) });
  assert.equal(bootstrap.body.activeHouseId, null, "reset shows selector again");

  await request("/v1/me/default-house", { method: "PUT", headers: bearer(owner.tokens.accessToken), body: JSON.stringify({ houseId: houseOne }) });
  await pool.query("update house_memberships set status = 'revoked', valid_to = now() where house_id = $1 and user_id = $2", [houseOne, owner.user.id]);
  bootstrap = await request("/v1/app-bootstrap", { headers: bearer(owner.tokens.accessToken) });
  assert.equal(bootstrap.body.activeHouseId, null, "lost access invalidates default safely");
  console.log("House default selection smoke passed.");
} finally {
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  await pool.end();
  await cleanupSmokeUsers(databaseUrl, emails);
}
