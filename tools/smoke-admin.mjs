import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

import {
  assertSafeSmokeDatabase,
  cleanupSmokeUsers
} from "./smoke-database.mjs";

const host = "127.0.0.1";
const port = "4105";
const baseUrl = `http://${host}:${port}`;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const regularEmail = `admin-smoke-${Date.now()}@example.test`;
const temporarySuperAdminEmail = `admin-super-smoke-${Date.now()}@example.test`;
const superAdminEmail = "rene@joinit.dk";
const startupTimeoutMs = 20_000;
const pollIntervalMs = 250;

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

function fixtureId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function assertDashboardShape(dashboard, expectedPeriod) {
  const sharedCounts = [
    ...Object.values(dashboard.totals),
    ...Object.values(dashboard.periodMetrics),
    ...Object.values(dashboard.funnel)
  ];

  assert.equal(dashboard.period.key, expectedPeriod);
  assert.ok(Date.parse(dashboard.period.from));
  assert.ok(Date.parse(dashboard.period.to));
  assert.ok(Date.parse(dashboard.generatedAt));
  assert.ok(sharedCounts.every((value) => Number.isInteger(value) && value >= 0));
  assert.ok(
    Object.values(dashboard.ratios).every((value) => value >= 0 && value <= 1)
  );
  assert.equal(dashboard.dataQuality.acceptedRecommendations, "estimated");

  for (const points of Object.values(dashboard.series)) {
    assert.ok(points.length > 0);
    assert.ok(
      points.every(
        (point) =>
          Date.parse(point.bucketStart) &&
          Number.isInteger(point.value) &&
          point.value >= 0
      )
    );
  }

  const funnel = dashboard.funnel;
  assert.ok(funnel.registeredUsers >= funnel.usersWithCompletedProfile);
  assert.ok(funnel.usersWithCompletedProfile >= funnel.usersWithHouse);
  assert.ok(funnel.usersWithHouse >= funnel.usersWithTask);
  assert.ok(funnel.usersWithTask >= funnel.usersWithCompletion);
}

async function insertDashboardFixture(pool, userId) {
  const houseId = fixtureId("house");
  const completedTaskId = fixtureId("task");
  const openTaskId = fixtureId("task");
  const deletedTaskId = fixtureId("task");

  await pool.query(
    "update user_profiles set display_name = $2, updated_at = now() where user_id = $1",
    [userId, "Admin dashboard smoke"]
  );
  await pool.query(
    `
      insert into houses (id, user_id, address_label)
      values ($1, $2, $3)
    `,
    [houseId, userId, "Dashboardvej 1, 1000 København K"]
  );
  await pool.query(
    `
      insert into maintenance_tasks (
        id, house_id, user_id, title, source, status, timing_type, completed_at
      )
      values
        ($1, $4, $5, 'Dashboard completed task', 'user_created', 'done', 'none', now()),
        ($2, $4, $5, 'Dashboard open task', 'user_created', 'planned', 'none', null),
        ($3, $4, $5, 'Dashboard deleted task', 'user_created', 'planned', 'none', null)
    `,
    [completedTaskId, openTaskId, deletedTaskId, houseId, userId]
  );
  await pool.query(
    "update maintenance_tasks set deleted_at = now() where id = $1",
    [deletedTaskId]
  );
  await pool.query(
    `
      insert into maintenance_completions (
        id, task_id, house_id, user_id, title_snapshot, completed_date, source
      )
      values ($1, $2, $3, $4, 'Dashboard completed task', current_date, 'user_created')
    `,
    [fixtureId("mcomp"), completedTaskId, houseId, userId]
  );
  await pool.query(
    `
      insert into maintenance_recommendations (
        id,
        house_id,
        user_id,
        source_type,
        status,
        title,
        description,
        recommended_timing_label,
        timing_type,
        recommendation_key,
        version_key,
        accepted_task_id
      )
      values (
        $1,
        $2,
        $3,
        'matriva_catalog',
        'accepted',
        'Dashboard recommendation',
        'Controlled dashboard smoke recommendation',
        'Når det passer',
        'none',
        $4,
        $5,
        $6
      )
    `,
    [
      fixtureId("mrec"),
      houseId,
      userId,
      `dashboard_${randomUUID().slice(0, 8)}`,
      `dashboard_${randomUUID().slice(0, 8)}`,
      openTaskId
    ]
  );
  await pool.query(
    `
      insert into maintenance_recommendation_hides (
        id, house_id, catalog_key
      )
      values ($1, $2, $3)
    `,
    [fixtureId("mhide"), houseId, `dashboard_hide_${randomUUID().slice(0, 8)}`]
  );
}

async function insertAdminReadFixture(pool, userId, email) {
  const houseId = fixtureId("house");
  const taskId = fixtureId("task");
  const acceptedTaskId = fixtureId("task");
  const catalogItemId = fixtureId("mcat");
  const catalogKey = `admin_read_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const catalogVersion = "2026.07.smoke";

  await pool.query(
    "update user_profiles set display_name = $2, updated_at = now() where user_id = $1",
    [userId, "Admin read smoke"]
  );
  await pool.query(
    "insert into houses (id, user_id, address_label) values ($1, $2, $3)",
    [houseId, userId, "Admin Readvej 2, 2300 København S"]
  );
  await pool.query(
    `
      insert into house_public_data_snapshots (
        id,
        house_id,
        provider,
        register,
        status,
        mapping_version,
        codebook_version,
        raw_payload,
        raw_payload_hash,
        normalized_payload,
        is_current
      )
      values (
        $1,
        $2,
        'datafordeler',
        'bbr',
        'partial',
        'smoke',
        'smoke',
        '{"secretCandidate":"must-not-leak"}'::jsonb,
        'smoke-hash',
        $3::jsonb,
        true
      )
    `,
    [
      fixtureId("pubsnap"),
      houseId,
      JSON.stringify({
        contract: "house_public_data.v1",
        status: "partial",
        selection: { primaryBuildingId: "bbr-smoke", primaryUnitId: null },
        address: { label: "Admin Readvej 2, 2300 København S" },
        warnings: [
          { code: "partial_building_details", message: "Smoke warning" }
        ]
      })
    ]
  );
  await pool.query(
    `
      insert into house_public_buildings (
        id,
        snapshot_id,
        house_id,
        bbr_building_id,
        building_number,
        is_address_building,
        included_in_product_view,
        lifecycle_code,
        use_code,
        construction_year,
        residential_area_m2,
        total_building_area_m2,
        raw_normalized
      )
      select $1, id, $2, 'bbr-smoke', 1, true, true, '6', '120', 1978, 122, 140, '{}'::jsonb
      from house_public_data_snapshots
      where house_id = $2 and is_current
    `,
    [fixtureId("pubbld"), houseId]
  );
  await pool.query(
    `
      insert into maintenance_tasks (
        id, house_id, user_id, title, source, status, timing_type
      )
      values
        ($1, $3, $4, 'Admin read planned task', 'user_created', 'planned', 'none'),
        ($2, $3, $4, 'Admin read accepted task', 'recommendation_accepted', 'planned', 'none')
    `,
    [taskId, acceptedTaskId, houseId, userId]
  );
  await pool.query(
    `
      insert into maintenance_completions (
        id, task_id, house_id, user_id, title_snapshot, completed_date, source
      )
      values ($1, $2, $3, $4, 'Admin read planned task', current_date, 'user_created')
    `,
    [fixtureId("mcomp"), taskId, houseId, userId]
  );
  await pool.query(
    `
      insert into maintenance_catalog_items (
        id,
        catalog_key,
        catalog_version,
        title,
        short_description,
        component_key,
        season,
        recommended_period,
        default_recurrence_interval,
        priority,
        eligibility_rules,
        disclaimer_class,
        is_active
      )
      values (
        $1,
        $2,
        $3,
        'Admin read smoke recommendation',
        'Used by admin smoke tests.',
        'roof',
        'all_year',
        '{"type":"all_year"}'::jsonb,
        'yearly',
        'normal',
        '{"type":"universal_house"}'::jsonb,
        'general',
        true
      )
    `,
    [catalogItemId, catalogKey, catalogVersion]
  );
  await pool.query(
    `
      insert into maintenance_recommendations (
        id,
        house_id,
        user_id,
        source_type,
        status,
        title,
        description,
        recommended_timing_label,
        recommended_period,
        priority,
        disclaimer_class,
        timing_type,
        recurrence_interval,
        recurrence_anchor,
        component_key,
        recommendation_key,
        version_key,
        catalog_item_id,
        catalog_key,
        catalog_version,
        period_key,
        accepted_task_id
      )
      values
        ($1, $3, $4, 'matriva_catalog', 'accepted', 'Admin read accepted', 'Smoke accepted', 'Når det passer', '{"type":"all_year"}'::jsonb, 'normal', 'general', 'none', 'yearly', 'completed_date', 'roof', $5, $6 || ':accepted', $7, $5, $6, '2026', $8),
        ($2, $3, $4, 'matriva_catalog', 'pending', 'Admin read pending', 'Smoke pending', 'Når det passer', '{"type":"all_year"}'::jsonb, 'normal', 'general', 'none', 'yearly', 'completed_date', 'roof', $5, $6 || ':pending', $7, $5, $6, '2027', null)
    `,
    [
      fixtureId("mrec"),
      fixtureId("mrec"),
      houseId,
      userId,
      catalogKey,
      catalogVersion,
      catalogItemId,
      acceptedTaskId
    ]
  );
  await pool.query(
    "insert into maintenance_recommendation_hides (id, house_id, catalog_key) values ($1, $2, $3)",
    [fixtureId("mhide"), houseId, catalogKey]
  );

  return { catalogKey, email, houseId, userId };
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

async function provisionTemporarySuperAdmin(userId) {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    await pool.query(
      `
        insert into user_roles (user_id, role, provisioned_by)
        values ($1, 'SUPER_ADMIN', 'smoke_admin')
      `,
      [userId]
    );
  } finally {
    await pool.end();
  }
}

async function runSmoke() {
  const adminRoutes = [
    "/v1/admin/bootstrap",
    "/v1/admin/dashboard",
    "/v1/admin/users",
    "/v1/admin/houses",
    "/v1/admin/recommendations/catalog"
  ];

  for (const route of adminRoutes) {
    const missing = await request(route);
    assert.equal(missing.response.status, 401, `${route} must require auth`);
  }

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
  const forbiddenDashboard = await request("/v1/admin/dashboard", {
    headers: bearer(regularSession.tokens.accessToken)
  });
  assert.equal(forbiddenDashboard.response.status, 403);
  for (const route of adminRoutes.slice(2)) {
    const forbiddenRoute = await request(route, {
      headers: bearer(regularSession.tokens.accessToken)
    });
    assert.equal(forbiddenRoute.response.status, 403, `${route} must forbid regular users`);
  }

  const adminSession = await login(temporarySuperAdminEmail);
  await provisionTemporarySuperAdmin(adminSession.user.id);
  const bootstrap = await request("/v1/admin/bootstrap", {
    headers: bearer(adminSession.tokens.accessToken)
  });
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.admin.userId, adminSession.user.id);
  assert.equal(bootstrap.body.admin.email, temporarySuperAdminEmail);
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
  let adminReadFixture;
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

    const defaultDashboard = await request("/v1/admin/dashboard", {
      headers: bearer(adminSession.tokens.accessToken)
    });
    assert.equal(defaultDashboard.response.status, 200);
    assertDashboardShape(defaultDashboard.body, "30d");

    for (const period of ["7d", "30d", "90d", "365d"]) {
      const result = await request(`/v1/admin/dashboard?period=${period}`, {
        headers: bearer(adminSession.tokens.accessToken)
      });
      assert.equal(result.response.status, 200);
      assertDashboardShape(result.body, period);
    }

    const invalidPeriod = await request("/v1/admin/dashboard?period=14d", {
      headers: bearer(adminSession.tokens.accessToken)
    });
    assert.equal(invalidPeriod.response.status, 400);
    assert.equal(invalidPeriod.body.code, "admin_dashboard_period_invalid");

    const before = defaultDashboard.body;
    await insertDashboardFixture(pool, regularSession.user.id);
    const afterResult = await request("/v1/admin/dashboard?period=30d", {
      headers: bearer(adminSession.tokens.accessToken)
    });
    assert.equal(afterResult.response.status, 200);
    const after = afterResult.body;
    assertDashboardShape(after, "30d");
    assert.equal(after.totals.houses, before.totals.houses + 1);
    assert.equal(after.totals.maintenanceTasks, before.totals.maintenanceTasks + 2);
    assert.equal(
      after.totals.maintenanceCompletions,
      before.totals.maintenanceCompletions + 1
    );
    assert.equal(after.periodMetrics.newHouses, before.periodMetrics.newHouses + 1);
    assert.equal(
      after.periodMetrics.createdTasks,
      before.periodMetrics.createdTasks + 2,
      "soft-deleted tasks must not count"
    );
    assert.equal(
      after.periodMetrics.completedTasks,
      before.periodMetrics.completedTasks + 1
    );
    assert.equal(
      after.periodMetrics.acceptedRecommendations,
      before.periodMetrics.acceptedRecommendations + 1
    );
    assert.equal(
      after.periodMetrics.permanentRecommendationHides,
      before.periodMetrics.permanentRecommendationHides + 1
    );
    assert.equal(
      after.funnel.usersWithCompletedProfile,
      before.funnel.usersWithCompletedProfile + 1
    );
    assert.equal(after.funnel.usersWithHouse, before.funnel.usersWithHouse + 1);
    assert.equal(after.funnel.usersWithTask, before.funnel.usersWithTask + 1);
    assert.equal(
      after.funnel.usersWithCompletion,
      before.funnel.usersWithCompletion + 1
    );

    const expectedSnapshot = await pool.query(
      `
        select
          (
            select count(distinct task_id)::float
            from maintenance_completions
            where task_id in (
              select id from maintenance_tasks where deleted_at is null
            )
          ) as completed_tasks,
          (
            select count(*)::float
            from maintenance_tasks
            where deleted_at is null
          ) as total_tasks,
          (
            select count(distinct user_id)::int
            from auth_sessions
            where last_used_at >= $1 and last_used_at < $2
          ) as active_users
      `,
      [after.period.from, after.period.to]
    );
    const snapshot = expectedSnapshot.rows[0];
    const expectedCompletionRate =
      snapshot.total_tasks === 0
        ? 0
        : snapshot.completed_tasks / snapshot.total_tasks;
    assert.equal(after.ratios.completedTaskRate, expectedCompletionRate);
    assert.equal(after.periodMetrics.activeUsers, snapshot.active_users);
    assert.ok(
      after.series.newUsers.some((point) => point.value === 0),
      "zero-value buckets must be returned"
    );

    const leakedDashboard = JSON.stringify(after);
    for (const forbiddenValue of [
      "email",
      "accessToken",
      "refreshToken",
      "token_hash",
      "auth_sessions",
      regularEmail,
      temporarySuperAdminEmail
    ]) {
      assert.equal(
        leakedDashboard.includes(forbiddenValue),
        false,
        `dashboard must not leak ${forbiddenValue}`
      );
    }

    adminReadFixture = await insertAdminReadFixture(
      pool,
      regularSession.user.id,
      regularEmail
    );

    const users = await request(
      `/v1/admin/users?query=${encodeURIComponent(regularEmail)}&status=active&sort=email&order=asc&page=1&pageSize=10`,
      { headers: bearer(adminSession.tokens.accessToken) }
    );
    assert.equal(users.response.status, 200);
    assert.ok(users.body.users.some((user) => user.id === regularSession.user.id));
    assert.equal(users.body.users[0].houseCount >= 1, true);
    assert.equal(JSON.stringify(users.body).includes("token_hash"), false);
    const userDetail = await request(`/v1/admin/users/${regularSession.user.id}`, {
      headers: bearer(adminSession.tokens.accessToken)
    });
    assert.equal(userDetail.response.status, 200);
    assert.equal(userDetail.body.user.id, regularSession.user.id);
    assert.equal(userDetail.body.user.recommendationSummary.permanentHidden >= 1, true);
    const missingUser = await request("/v1/admin/users/usr_missing00000000", {
      headers: bearer(adminSession.tokens.accessToken)
    });
    assert.equal(missingUser.response.status, 404);

    const houses = await request(
      `/v1/admin/houses?query=${encodeURIComponent("Admin Readvej")}&publicDataStatus=with_warnings&sort=address&order=asc&page=1&pageSize=10`,
      { headers: bearer(adminSession.tokens.accessToken) }
    );
    assert.equal(houses.response.status, 200);
    assert.ok(houses.body.houses.some((house) => house.id === adminReadFixture.houseId));
    const houseDetail = await request(`/v1/admin/houses/${adminReadFixture.houseId}`, {
      headers: bearer(adminSession.tokens.accessToken)
    });
    assert.equal(houseDetail.response.status, 200);
    assert.equal(houseDetail.body.house.warningCount, 1);
    assert.equal(JSON.stringify(houseDetail.body).includes("secretCandidate"), false);
    const missingHouse = await request("/v1/admin/houses/house_missing000000", {
      headers: bearer(adminSession.tokens.accessToken)
    });
    assert.equal(missingHouse.response.status, 404);

    const catalog = await request(
      `/v1/admin/recommendations/catalog?query=${adminReadFixture.catalogKey}&active=active&category=roof&page=1&pageSize=10`,
      { headers: bearer(adminSession.tokens.accessToken) }
    );
    assert.equal(catalog.response.status, 200);
    assert.equal(catalog.body.items[0].catalogKey, adminReadFixture.catalogKey);
    assert.equal(catalog.body.items[0].acceptedCount, 1);
    assert.equal(catalog.body.items[0].permanentHideCount, 1);
    const catalogDetail = await request(
      `/v1/admin/recommendations/catalog/${adminReadFixture.catalogKey}`,
      { headers: bearer(adminSession.tokens.accessToken) }
    );
    assert.equal(catalogDetail.response.status, 200);
    assert.equal(catalogDetail.body.item.statusDistribution.pending, 1);
    assert.equal(catalogDetail.body.item.acceptedTaskCount, 1);
    assert.equal(catalogDetail.body.item.dataQuality.notNow, "not_available");
    assert.equal("notNowCount" in catalogDetail.body.item, false);
    const missingCatalog = await request(
      "/v1/admin/recommendations/catalog/not_a_real_catalog_key",
      { headers: bearer(adminSession.tokens.accessToken) }
    );
    assert.equal(missingCatalog.response.status, 404);
  } finally {
    if (adminReadFixture) {
      await pool.query("delete from maintenance_recommendations where catalog_key = $1", [
        adminReadFixture.catalogKey
      ]);
      await pool.query("delete from maintenance_recommendation_hides where catalog_key = $1", [
        adminReadFixture.catalogKey
      ]);
      await pool.query("delete from maintenance_catalog_items where catalog_key = $1", [
        adminReadFixture.catalogKey
      ]);
    }
    await pool.end();
  }

  const me = await request("/v1/me", {
    headers: bearer(adminSession.tokens.accessToken)
  });
  assert.equal(me.response.status, 200, "ordinary auth route must still work");
  assert.equal(me.body.user.email, temporarySuperAdminEmail);

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
  await cleanupSmokeUsers(databaseUrl, [
    regularEmail,
    temporarySuperAdminEmail
  ]);
}
