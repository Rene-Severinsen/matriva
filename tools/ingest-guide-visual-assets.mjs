import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants, copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { assertSafeSmokeDatabase } from "./smoke-database.mjs";
import {
  gutterGuideHotspots,
  gutterGuidePlacements,
  houseProfile,
  visualAssets
} from "./guide-visual-asset-manifest.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "apps", "api", "assets", "guides", "matriva-modern-2023");
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

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", "Only PNG guide assets are supported by this pilot importer.");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function ensureStorageObject(asset, source, checksum) {
  const storageKey = `${storageEnvironment}/${asset.storagePath}`;
  const destination = join(localObjectStorageRoot, storageKey);
  await mkdir(dirname(destination), { recursive: true });

  try {
    await copyFile(join(sourceRoot, asset.sourcePath), destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }

    const existing = await readFile(destination);
    assert.equal(
      sha256(existing),
      checksum,
      `Storage object ${storageKey} already exists with different content.`
    );
  }

  return storageKey;
}

function productionMetadata(asset) {
  return {
    houseProfileId: houseProfile.id,
    houseProfileKey: houseProfile.key,
    guideId: asset.guideId ?? null,
    guideKey: asset.guideKey ?? null,
    guideVersion: asset.guideVersion ?? null,
    assetCategory: asset.category,
    viewOrComponent: asset.viewOrComponent,
    purpose: asset.purpose,
    approvalStatus: asset.approvalStatus,
    canonicalUse: asset.canonicalUse,
    statusNote: asset.statusNote,
    referenceAssetKeys: asset.referenceAssetKeys,
    derivedProvenance: asset.derivedProvenance,
    validationStatus: asset.validationStatus ?? "not_requested",
    provenance: asset.sourceType === "other"
      ? { type: "repository_original", sourcePath: "apps/website/public/images/HeroImage.png", provenanceStatus: "pending_external_source_confirmation" }
      : { type: "ai_generated", tool: "built_in_image_gen", model: null },
    qa: { status: asset.approvalStatus, scope: "house_identity_and_visual_quality", reviewedInPilot: true }
  };
}

async function run() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const profile = await client.query("select id from house_profiles where id = $1 and profile_key = $2", [houseProfile.id, houseProfile.key]);
    assert.equal(profile.rowCount, 1, "House A must be seeded before visual assets are ingested.");

    for (const asset of visualAssets) {
      const sourcePath = join(sourceRoot, asset.sourcePath);
      const source = await readFile(sourcePath);
      const { size } = await stat(sourcePath);
      const { width, height } = pngDimensions(source);
      const checksum = sha256(source);
      const storageKey = await ensureStorageObject(asset, source, checksum);
      const existing = await client.query(
        "select id, storage_key, checksum_sha256 from guide_assets where asset_key = $1",
        [asset.assetKey]
      );

      if (existing.rowCount > 0) {
        assert.deepEqual(existing.rows[0], { id: asset.id, storage_key: storageKey, checksum_sha256: checksum }, `Guide asset ${asset.assetKey} conflicts with the preserved pilot asset.`);
        await client.query(
          "update guide_assets set source_type = $1, alt_text = $2, production_metadata = $3::jsonb, updated_at = now() where id = $4",
          [asset.sourceType, asset.altText, JSON.stringify(productionMetadata(asset)), asset.id]
        );
        continue;
      }

      await client.query(
        `insert into guide_assets (
          id, asset_key, asset_type, storage_key, mime_type, size_bytes, width, height,
          checksum_sha256, source_type, alt_text, production_metadata
        ) values ($1, $2, 'image', $3, 'image/png', $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [asset.id, asset.assetKey, storageKey, size, width, height, checksum, asset.sourceType, asset.altText, JSON.stringify(productionMetadata(asset))]
      );
    }

    const activePlacementIds = gutterGuidePlacements.map((placement) => placement.id);
    await client.query(
      `delete from guide_hotspots
       where guide_version_asset_id in (
         select id from guide_version_assets
         where guide_version_id = 'gver_rens_tagrender_v1'
           and not (id = any($1::text[]))
       )`,
      [activePlacementIds]
    );
    await client.query(
      `delete from guide_version_assets
       where guide_version_id = 'gver_rens_tagrender_v1'
         and not (id = any($1::text[]))`,
      [activePlacementIds]
    );

    for (const placement of gutterGuidePlacements) {
      const asset = visualAssets.find((candidate) => candidate.id === placement.assetId);
      assert.ok(asset, `Guide placement ${placement.id} refers to an unknown asset.`);
      await client.query(
        `insert into guide_version_assets (
          id, guide_version_id, guide_asset_id, placement, position, alt_text, caption, print_visible
        ) values ($1, 'gver_rens_tagrender_v1', $2, $3, $4, $5, $6, true)
        on conflict (guide_version_id, placement, position) do update
          set id = excluded.id,
              guide_asset_id = excluded.guide_asset_id,
              alt_text = excluded.alt_text,
              caption = excluded.caption,
              print_visible = excluded.print_visible,
              updated_at = now()`,
        [placement.id, placement.assetId, placement.placement, placement.position, asset.altText, placement.caption]
      );
    }

    for (const hotspot of gutterGuideHotspots) {
      await client.query(
        `insert into guide_hotspots (
          id, guide_version_asset_id, hotspot_type, position, x, y, title, body
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (guide_version_asset_id, position) do nothing`,
        [hotspot.id, hotspot.guideVersionAssetId, hotspot.hotspotType, hotspot.position, hotspot.x, hotspot.y, hotspot.title, hotspot.body]
      );
    }

    console.log(`Ingested ${visualAssets.length} House A and guide pilot visual assets with explicit review status into ${storageEnvironment} storage.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
