import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import pg from "pg";

import { getObject, putObjectIfAbsent } from "./s3-object-storage.mjs";
import {
  GUIDE_ASSET_VARIANT_MIME_TYPE,
  GUIDE_ASSET_VARIANT_QUALITY,
  guideAssetVariantKey
} from "./guide-asset-delivery.mjs";
import { assertSafeSmokeDatabase } from "./smoke-database.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageEnvironment = (process.env.MATRIVA_ENVIRONMENT ?? process.env.NODE_ENV ?? "local")
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, "_") || "local";
const sharedStorageEnvironment = ["qa", "production", "prod"].includes(storageEnvironment.toLowerCase());
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const localObjectStorageRoot = process.env.MATRIVA_ATTACHMENT_STORAGE_DIR ?? process.env.MATRIVA_OBJECT_STORAGE_DIR ?? join(projectRoot, "apps", "api", "var", "objects");
const guide02Only = process.argv.includes("--guide-02-only");
const dryRun = process.argv.includes("--dry-run");
const configuredAdapter = (process.env.MATRIVA_STORAGE_ADAPTER ?? "").trim().toLowerCase();

if (sharedStorageEnvironment && configuredAdapter !== "s3") {
  throw new Error("Guide asset variant backfill requires MATRIVA_STORAGE_ADAPTER=s3 in QA/production.");
}

if (storageEnvironment === "qa") {
  const parsedDatabaseUrl = new URL(databaseUrl);
  if (parsedDatabaseUrl.protocol !== "postgresql:" || parsedDatabaseUrl.pathname !== "/matriva_qa") {
    throw new Error("QA guide asset variant backfill requires the matriva_qa PostgreSQL database.");
  }
} else {
  assertSafeSmokeDatabase(databaseUrl);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function localPath(storageKey) {
  const normalized = storageKey.replace(/^[/\\]+/, "");
  if (normalized.includes("..")) throw new Error(`Unsafe storage key: ${storageKey}`);
  return join(localObjectStorageRoot, normalized);
}

async function readOriginal(storageKey, mimeType) {
  if (sharedStorageEnvironment) return getObject(storageKey, mimeType);
  return readFile(localPath(storageKey));
}

async function writeLocalIfAbsent(storageKey, content) {
  const destination = localPath(storageKey);
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(destination, content, { flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readFile(destination);
    assert.equal(sha256(existing), sha256(content), `Variant ${storageKey} already exists with different content.`);
  }
}

async function writeVariant(storageKey, content) {
  if (dryRun) return;
  if (sharedStorageEnvironment) {
    await putObjectIfAbsent(storageKey, content, GUIDE_ASSET_VARIANT_MIME_TYPE, process.env, {
      cacheControl: "private, max-age=31536000, immutable"
    });
    return;
  }
  await writeLocalIfAbsent(storageKey, content);
}

async function loadAssets(client) {
  const guideFilter = guide02Only ? "and gt.guide_key = 'tjek_fuger_vaadrum'" : "";
  const result = await client.query(`
    select
      ga.asset_key,
      ga.storage_key,
      ga.mime_type,
      ga.checksum_sha256,
      bool_or(gva.placement in ('cover', 'inline', 'before', 'after', 'print_appendix')) as has_large_placement
    from guide_assets ga
    join guide_version_assets gva on gva.guide_asset_id = ga.id
    join guide_versions gv on gv.id = gva.guide_version_id
    join guide_templates gt on gt.id = gv.guide_template_id
    where ga.archived_at is null
      and ga.mime_type in ('image/png', 'image/jpeg')
      ${guideFilter}
    group by ga.id, ga.asset_key, ga.storage_key, ga.mime_type, ga.checksum_sha256
    order by ga.asset_key
  `);
  return result.rows;
}

async function run() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    const assets = await loadAssets(client);
    const report = [];
    for (const asset of assets) {
      assert.match(asset.checksum_sha256 ?? "", /^[a-f0-9]{64}$/, `${asset.asset_key} has no immutable source checksum.`);
      const original = await readOriginal(asset.storage_key, asset.mime_type);
      assert.equal(sha256(original), asset.checksum_sha256, `${asset.asset_key} original checksum changed; refusing variant generation.`);
      const width = asset.has_large_placement ? 1440 : 1024;
      const key = guideAssetVariantKey(asset.storage_key, asset.checksum_sha256, width, GUIDE_ASSET_VARIANT_QUALITY);
      const sourceMetadata = await sharp(original).metadata();
      const variant = await sharp(original)
        .resize({ width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: GUIDE_ASSET_VARIANT_QUALITY, effort: 4 })
        .toBuffer();
      const variantMetadata = await sharp(variant).metadata();
      assert.ok(variantMetadata.width && variantMetadata.height, `${asset.asset_key} variant is not a readable image.`);
      assert.ok((variantMetadata.width ?? 0) <= width, `${asset.asset_key} variant exceeds target width.`);
      assert.ok(variant.length < original.length, `${asset.asset_key} variant is not smaller than its original.`);
      await writeVariant(key, variant);
      report.push({
        assetKey: asset.asset_key,
        width,
        sourceBytes: original.length,
        variantBytes: variant.length,
        reductionPercent: Number(((1 - variant.length / original.length) * 100).toFixed(1)),
        sourceWidth: sourceMetadata.width ?? null,
        variantWidth: variantMetadata.width ?? null,
        key,
        dryRun
      });
    }
    console.log(JSON.stringify({ storageEnvironment, guide02Only, dryRun, assets: report }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
