import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

import { assertSafeSmokeDatabase, cleanupSmokeUsers } from "./smoke-database.mjs";

const host = "127.0.0.1";
const port = "4105";
const baseUrl = `http://${host}:${port}`;
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const runId = Date.now();
const ownerEmail = `invitation-owner-${runId}@example.test`;
const freeMemberEmail = `invitation-free-member-${runId}@example.test`;
const freeTokenMemberEmail = `invitation-free-token-${runId}@example.test`;
const emails = [ownerEmail, freeMemberEmail, freeTokenMemberEmail];

assertSafeSmokeDatabase(databaseUrl);

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {})
    }
  });
  return { response, body: await response.json().catch(() => ({})) };
}

function bearer(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}

async function login(email) {
  const requested = await request("/v1/auth/magic-link/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
  assert.equal(requested.response.status, 200, JSON.stringify(requested.body));
  const token = new URL(requested.body.devMagicLink).searchParams.get("token");
  assert(token);
  const consumed = await request("/v1/auth/magic-link/consume", {
    method: "POST",
    body: JSON.stringify({ token })
  });
  assert.equal(consumed.response.status, 200, JSON.stringify(consumed.body));
  return consumed.body;
}

async function waitForHealth(child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null) throw new Error("API exited before invitation entitlement smoke could run.");
    try {
      const result = await request("/health");
      if (result.response.status === 200) return;
    } catch {}
    await delay(250);
  }
  throw new Error("Timed out waiting for the API.");
}

const child = spawn("npm", ["run", "dev:api"], {
  cwd: process.cwd(),
  detached: true,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    HOST: host,
    PORT: port,
    MATRIVA_AUTH_DISABLE_LIMITS: "true",
    MATRIVA_MAIL_TRANSPORT: "console"
  },
  stdio: "ignore"
});
const pool = new pg.Pool({ connectionString: databaseUrl });
let houseId;

try {
  await waitForHealth(child);
  const owner = await login(ownerEmail);
  const freeMember = await login(freeMemberEmail);
  const freeTokenMember = await login(freeTokenMemberEmail);
  houseId = `house_invitation_entitlements_${runId}`;

  await pool.query(
    `insert into user_entitlements (user_id, plan, status, source, starts_at)
     values ($1, 'pro', 'active', 'admin', now())
     on conflict (user_id) do update set plan = 'pro', status = 'active', source = 'admin', expires_at = null, updated_at = now()`,
    [owner.user.id]
  );
  await pool.query(
    "insert into houses (id, user_id, address_label, dawa_address_id, status, data_confidence, bfe_number) values ($1, $2, $3, $4, 'saved', 'not_verified', $5)",
    [houseId, owner.user.id, "Invitationstest 1, 1000 København K", `invitation-entitlements-${runId}`, `bfe-invitation-entitlements-${runId}`]
  );
  await pool.query(
    "insert into house_memberships (id, house_id, user_id, role, status) values ($1, $2, $3, 'owner', 'active')",
    [`hm_invitation_owner_${runId}`, houseId, owner.user.id]
  );

  const byIdInvitation = await request(`/v1/houses/${houseId}/members`, {
    method: "POST",
    headers: bearer(owner.tokens.accessToken),
    body: JSON.stringify({ email: freeMemberEmail, role: "member" })
  });
  assert.equal(byIdInvitation.response.status, 201, JSON.stringify(byIdInvitation.body));
  const byIdInvitationId = byIdInvitation.body.invitation.id;

  const bootstrap = await request("/v1/app-bootstrap", { headers: bearer(freeMember.tokens.accessToken) });
  assert.equal(bootstrap.response.status, 200, JSON.stringify(bootstrap.body));
  assert.equal(bootstrap.body.pendingHouseInvitations.some((invitation) => invitation.id === byIdInvitationId), true);

  const acceptedById = await request(`/v1/house-invitations/${byIdInvitationId}/accept`, {
    method: "POST",
    headers: bearer(freeMember.tokens.accessToken)
  });
  assert.equal(acceptedById.response.status, 200, JSON.stringify(acceptedById.body));
  assert.equal(acceptedById.body.houseId, houseId);

  const byTokenInvitation = await request(`/v1/houses/${houseId}/members`, {
    method: "POST",
    headers: bearer(owner.tokens.accessToken),
    body: JSON.stringify({ email: freeTokenMemberEmail, role: "member" })
  });
  assert.equal(byTokenInvitation.response.status, 201, JSON.stringify(byTokenInvitation.body));
  const invitationLink = byTokenInvitation.body.delivery?.devInvitationLink;
  assert(invitationLink, "console invitation delivery must expose a dev invitation link");
  const invitationToken = new URL(invitationLink).searchParams.get("token");
  assert(invitationToken);

  const acceptedByToken = await request("/v1/house-invitations/accept", {
    method: "POST",
    headers: bearer(freeTokenMember.tokens.accessToken),
    body: JSON.stringify({ token: invitationToken })
  });
  assert.equal(acceptedByToken.response.status, 200, JSON.stringify(acceptedByToken.body));
  assert.equal(acceptedByToken.body.houseId, houseId);

  const freeCannotInvite = await request(`/v1/houses/${houseId}/members`, {
    method: "POST",
    headers: bearer(freeMember.tokens.accessToken),
    body: JSON.stringify({ email: `not-invited-${runId}@example.test`, role: "member" })
  });
  assert.equal(freeCannotInvite.response.status, 403, JSON.stringify(freeCannotInvite.body));
  assert.equal(freeCannotInvite.body.code, "entitlement_feature_not_included");

  const memberships = await pool.query(
    "select count(*)::int as count from house_memberships where house_id = $1 and status = 'active'",
    [houseId]
  );
  assert.equal(memberships.rows[0].count, 3);
  console.log("House invitation entitlement smoke passed.");
} finally {
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  if (houseId) {
    await pool.query("delete from house_invitations where house_id = $1", [houseId]);
    await pool.query("delete from houses where id = $1", [houseId]);
  }
  await pool.end();
  await cleanupSmokeUsers(databaseUrl, emails);
}
