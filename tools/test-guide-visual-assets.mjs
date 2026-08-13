import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { assertSafeSmokeDatabase } from "./smoke-database.mjs";
import {
  gutterGuideHotspots,
  gutterGuidePlacements,
  houseProfile,
  visualAssets,
  wetroomGuideHotspots,
  wetroomGuidePlacements
} from "./guide-visual-asset-manifest.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const localObjectStorageRoot =
  process.env.MATRIVA_ATTACHMENT_STORAGE_DIR ??
  process.env.MATRIVA_OBJECT_STORAGE_DIR ??
  join(projectRoot, "apps", "api", "var", "objects");
const storageEnvironment = (process.env.MATRIVA_ENVIRONMENT ?? process.env.NODE_ENV ?? "local")
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, "_") || "local";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";

assertSafeSmokeDatabase(databaseUrl);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function run() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const profile = await client.query("select id, profile_key from house_profiles where id = $1", [houseProfile.id]);
    assert.deepEqual(profile.rows[0], { id: houseProfile.id, profile_key: houseProfile.key });

    const assets = await client.query(
      `select id, asset_key, storage_key, checksum_sha256, source_type, production_metadata
       from guide_assets where id = any($1::text[]) order by id`,
      [visualAssets.map((asset) => asset.id)]
    );
    assert.equal(assets.rowCount, visualAssets.length, "Every House A and guide pilot visual must be registered as a guide asset.");

    for (const expected of visualAssets) {
      const asset = assets.rows.find((row) => row.id === expected.id);
      assert.ok(asset, `${expected.assetKey} must exist.`);
      assert.equal(asset.asset_key, expected.assetKey);
      assert.equal(asset.source_type, expected.sourceType);
      assert.equal(asset.production_metadata.houseProfileKey, houseProfile.key);
      assert.equal(asset.production_metadata.approvalStatus, expected.approvalStatus);
      assert.equal(asset.production_metadata.canonicalUse, expected.canonicalUse);
      assert.equal(asset.production_metadata.statusNote, expected.statusNote);
      assert.deepEqual(asset.production_metadata.derivedProvenance ?? null, expected.derivedProvenance ?? null);
      assert.equal(asset.production_metadata.technicalValidation?.status, expected.validationStatus === "passed" ? "pass" : "not_requested");
      assert.equal(asset.production_metadata.humanApproval?.status, expected.approvalStatus === "pending_human" ? "pending" : expected.approvalStatus);
      const storagePath = join(localObjectStorageRoot, asset.storage_key);
      const stored = await readFile(storagePath);
      assert.equal(sha256(stored), asset.checksum_sha256, `${expected.assetKey} storage checksum must match metadata.`);
    }

    assert.deepEqual(
      visualAssets
        .filter((asset) => asset.id.startsWith("gasset_ma23_"))
        .filter((asset) => asset.approvalStatus === "approved")
        .map((asset) => asset.id),
      ["gasset_ma23_a01_entry"],
      "A01 must be the only current approved House A visual/material reference."
    );

    const placements = await client.query(
      `select id, guide_asset_id, placement, position, print_visible
       from guide_version_assets where guide_version_id = 'gver_rens_tagrender_v1' order by placement, position`
    );
    assert.equal(placements.rowCount, gutterGuidePlacements.length);
    for (const expected of gutterGuidePlacements) {
      assert.deepEqual(
        placements.rows.find((row) => row.id === expected.id),
        { id: expected.id, guide_asset_id: expected.assetId, placement: expected.placement, position: expected.position, print_visible: true }
      );
    }

    const hotspots = await client.query(
      `select id, guide_version_asset_id, hotspot_type, position, x::float8 as x, y::float8 as y, title
       from guide_hotspots where id = any($1::text[]) order by id`,
      [gutterGuideHotspots.map((hotspot) => hotspot.id)]
    );
    assert.equal(hotspots.rowCount, gutterGuideHotspots.length);
    for (const expected of gutterGuideHotspots) {
      assert.deepEqual(
        hotspots.rows.find((row) => row.id === expected.id),
        { id: expected.id, guide_version_asset_id: expected.guideVersionAssetId, hotspot_type: expected.hotspotType, position: expected.position, x: expected.x, y: expected.y, title: expected.title }
      );
    }

    const wetroomPlacements = await client.query(
      `select id, guide_asset_id, placement, position, print_visible
       from guide_version_assets where guide_version_id = 'gver_tjek_fuger_vaadrum_v1' order by placement, position`
    );
    assert.equal(wetroomPlacements.rowCount, wetroomGuidePlacements.length);
    for (const expected of wetroomGuidePlacements) {
      assert.deepEqual(
        wetroomPlacements.rows.find((row) => row.id === expected.id),
        { id: expected.id, guide_asset_id: expected.assetId, placement: expected.placement, position: expected.position, print_visible: true }
      );
    }

    const wetroomHotspots = await client.query(
      `select id, guide_version_asset_id, hotspot_type, position, x::float8 as x, y::float8 as y, title
       from guide_hotspots where id = any($1::text[]) order by id`,
      [wetroomGuideHotspots.map((hotspot) => hotspot.id)]
    );
    assert.equal(wetroomHotspots.rowCount, wetroomGuideHotspots.length);
    for (const expected of wetroomGuideHotspots) {
      assert.deepEqual(
        wetroomHotspots.rows.find((row) => row.id === expected.id),
        { id: expected.id, guide_version_asset_id: expected.guideVersionAssetId, hotspot_type: expected.hotspotType, position: expected.position, x: expected.x, y: expected.y, title: expected.title }
      );
    }

    console.log("Guide 01 and Guide 02 visual assets, storage objects, placements and hotspots validated.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
