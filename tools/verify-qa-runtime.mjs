import assert from "node:assert/strict";
import pg from "pg";

const baseUrl = process.env.QA_BASE_URL?.trim().replace(/\/+$/, "");
const databaseUrl = process.env.QA_DATABASE_URL?.trim();
const token = process.env.QA_ADMIN_ACCESS_TOKEN?.trim();
const expectedGuideKeys = (process.env.QA_EXPECTED_GUIDE_KEYS ?? "rens_tagrender,tjek_fuger_vaadrum")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!baseUrl) throw new Error("QA_BASE_URL is required for QA runtime verification.");
if (!databaseUrl) throw new Error("QA_DATABASE_URL is required for QA runtime verification.");

function url(path) {
  return `${baseUrl}${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(url(path), {
    ...options,
    headers: {
      accept: "application/json",
      ...options.headers
    }
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  return { response, body };
}

function jsonBody(result, path) {
  try {
    return JSON.parse(result.body);
  } catch {
    throw new Error(`${path} did not return JSON.`);
  }
}

const health = await request("/health");
const healthBody = jsonBody(health, "/health");
assert.equal(healthBody.status, "ok", "QA health endpoint did not report ok.");

const assetResults = [];
let guideList = null;
let taskClusters = null;
const adminHeaders = token ? { authorization: `Bearer ${token}` } : null;
if (token) {
  const guideListResult = await request("/v1/admin/guides?status=all", { headers: adminHeaders });
  guideList = jsonBody(guideListResult, "/v1/admin/guides?status=all");
  assert.ok(Array.isArray(guideList.guides), "Guide analytics response has no guides array.");
  assert.ok(Array.isArray(guideList.openHeatmap), "Guide analytics response has no openHeatmap array.");
  for (const guideKey of expectedGuideKeys) {
    assert.ok(guideList.guides.some((guide) => guide.key === guideKey), `Expected QA guide is missing: ${guideKey}.`);
  }
}

for (const guide of guideList?.guides ?? []) {
  const detailPath = `/v1/admin/guides/${encodeURIComponent(guide.id)}`;
  const detailResult = await request(detailPath, { headers: adminHeaders });
  const detail = jsonBody(detailResult, detailPath);
  const assets = detail?.guide?.version?.assets;
  assert.ok(Array.isArray(assets), `${detailPath} has no assets array.`);

  for (const asset of assets) {
    const assetPath = asset.contentPath;
    const assetResult = await fetch(url(assetPath), { headers: adminHeaders });
    const bytes = Buffer.from(await assetResult.arrayBuffer());
    assert.equal(assetResult.status, 200, `${assetPath} returned HTTP ${assetResult.status}.`);
    assert.match(
      assetResult.headers.get("content-type") ?? "",
      /^image\//,
      `${assetPath} did not return an image MIME type.`
    );
    assert.ok(bytes.length > 100, `${assetPath} returned an implausibly small body.`);
    if (asset.mimeType !== "image/svg+xml") {
      assert.equal(
        assetResult.headers.get("x-matriva-asset-variant"),
        "webp",
        `${assetPath} did not return the optimized WebP variant.`
      );
    }
    assetResults.push({
      guide: guide.key,
      asset: asset.assetKey,
      bytes: bytes.length,
      contentType: assetResult.headers.get("content-type"),
      variant: assetResult.headers.get("x-matriva-asset-variant") ?? "original"
    });
  }
}

if (token) {
  const taskClusterResult = await request("/v1/admin/task-clusters", {
    headers: { authorization: `Bearer ${token}` }
  });
  taskClusters = jsonBody(taskClusterResult, "/v1/admin/task-clusters");
  assert.ok(Array.isArray(taskClusters.clusters), "Task-cluster response has no clusters array.");
}

const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const migrationResult = await pool.query(
    "select name from schema_migrations where name = any($1::text[])",
    [["0030_guide_open_events_v1.sql", "0031_user_task_cluster_analytics_v1.sql"]]
  );
  const appliedMigrations = new Set(migrationResult.rows.map((row) => row.name));
  for (const migration of ["0030_guide_open_events_v1.sql", "0031_user_task_cluster_analytics_v1.sql"]) {
    assert.ok(appliedMigrations.has(migration), `QA migration is not applied: ${migration}.`);
  }
} finally {
  await pool.end();
}

console.log(JSON.stringify({
  health: healthBody.status,
  guideAnalytics: {
    verified: Boolean(token),
    guides: guideList?.guides.length ?? null,
    heatmapDays: guideList?.openHeatmap.length ?? null
  },
  guideAssets: assetResults,
  taskClusters: taskClusters?.clusters.length ?? null,
  migrations: ["0030_guide_open_events_v1.sql", "0031_user_task_cluster_analytics_v1.sql"]
}, null, 2));
