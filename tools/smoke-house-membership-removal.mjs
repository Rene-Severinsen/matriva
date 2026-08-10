import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

import { assertSafeSmokeDatabase, cleanupSmokeUsers } from "./smoke-database.mjs";

const host = "127.0.0.1";
const port = "4103";
const baseUrl = `http://${host}:${port}`;
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const runId = Date.now();
const ownerEmail = `membership-owner-${runId}@example.test`;
const memberEmail = `membership-member-${runId}@example.test`;
const emails = [ownerEmail, memberEmail];

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
  assert(token);
  const consumed = await request("/v1/auth/magic-link/consume", { method: "POST", body: JSON.stringify({ token }) });
  assert.equal(consumed.response.status, 200);
  return consumed.body;
}

async function waitForHealth(child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null) throw new Error("API exited before membership smoke could run.");
    try { const result = await request("/health"); if (result.response.status === 200) return; } catch {}
    await delay(250);
  }
  throw new Error("Timed out waiting for the API.");
}

const child = spawn("npm", ["run", "dev:api"], { cwd: process.cwd(), detached: true, env: { ...process.env, DATABASE_URL: databaseUrl, HOST: host, PORT: port, MATRIVA_AUTH_DISABLE_LIMITS: "true" }, stdio: "ignore" });
const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  await waitForHealth(child);
  const owner = await login(ownerEmail);
  const member = await login(memberEmail);
  const houseId = `house_membership_${runId}`;
  await pool.query("insert into houses (id, user_id, address_label, dawa_address_id, status, data_confidence, bfe_number) values ($1, $2, $3, $4, 'saved', 'not_verified', $5)", [houseId, owner.user.id, "Medlemstest 1, 1000 København K", `membership-${runId}`, `bfe-membership-${runId}`]);
  await pool.query("insert into house_memberships (id, house_id, user_id, role, status) values ($1, $2, $3, 'owner', 'active')", [`hm_owner_${runId}`, houseId, owner.user.id]);
  const membershipId = `hm_membership_${runId}`;
  await pool.query("insert into house_memberships (id, house_id, user_id, role, status, invited_by_user_id) values ($1, $2, $3, 'member', 'active', $4)", [membershipId, houseId, member.user.id, owner.user.id]);

  const ownerMembers = await request(`/v1/houses/${houseId}/members`, { headers: bearer(owner.tokens.accessToken) });
  assert.equal(ownerMembers.response.status, 200);
  assert.equal(ownerMembers.body.members.some((item) => item.id === membershipId), true);

  const selfRemoval = await request(`/v1/houses/${houseId}/members/${ownerMembers.body.members.find((item) => item.userId === owner.user.id).id}`, { method: "DELETE", headers: bearer(owner.tokens.accessToken) });
  assert.equal(selfRemoval.response.status, 400);
  assert.equal(selfRemoval.body.code, "owner_self_removal_forbidden");

  const unauthorizedRemoval = await request(`/v1/houses/${houseId}/members/${ownerMembers.body.members.find((item) => item.userId === owner.user.id).id}`, { method: "DELETE", headers: bearer(member.tokens.accessToken) });
  assert.equal(unauthorizedRemoval.response.status, 403);

  const removed = await request(`/v1/houses/${houseId}/members/${membershipId}`, { method: "DELETE", headers: bearer(owner.tokens.accessToken) });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.status, "revoked");
  const stored = await pool.query("select status, valid_to from house_memberships where id = $1", [membershipId]);
  assert.equal(stored.rows[0].status, "revoked");
  assert.ok(stored.rows[0].valid_to);

  const memberAfterRemoval = await request(`/v1/houses/${houseId}`, { headers: bearer(member.tokens.accessToken) });
  assert.equal(memberAfterRemoval.response.status, 404);
  const ownerAfterRemoval = await request(`/v1/houses/${houseId}`, { headers: bearer(owner.tokens.accessToken) });
  assert.equal(ownerAfterRemoval.response.status, 200);
  assert.equal(ownerAfterRemoval.body.house.id, houseId);
  console.log("House membership removal smoke passed.");
} finally {
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  await pool.end();
  await cleanupSmokeUsers(databaseUrl, emails);
}
