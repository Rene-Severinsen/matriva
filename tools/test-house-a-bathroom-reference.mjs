import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { visualAssets } from "./guide-visual-asset-manifest.mjs";

const projectRoot = new URL("..", import.meta.url).pathname;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function run() {
  const geometry = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-canonical-geometry.json"), "utf8"));
  const bathroom = geometry.rooms.find((room) => room.id === "bathroom");
  assert.deepEqual(
    { id: bathroom.id, x: bathroom.x, y: bathroom.y, widthMm: bathroom.widthMm, depthMm: bathroom.depthMm },
    { id: "bathroom", x: 5800, y: 3500, widthMm: 2200, depthMm: 2500 }
  );
  assert.equal(geometry.openings.filter((opening) => opening.roomId === "bathroom").length, 0);

  const reference = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-bathroom-reference-v1.json"), "utf8"));
  assert.equal(reference.status, "derived_reference_human_approved");
  assert.equal(reference.validation.technicalValidation, "PASS");
  assert.equal(reference.validation.humanApproval, "APPROVED");

  const expectedKeys = [
    "house_a_bathroom_reference_v1",
    "tjek_fuger_vaadrum_shower_v1",
    "tjek_fuger_vaadrum_cracked_joint_v1",
    "tjek_fuger_vaadrum_discoloration_v1",
    "tjek_fuger_vaadrum_intact_joint_v1"
  ];
  const assets = visualAssets.filter((asset) => expectedKeys.includes(asset.assetKey));
  assert.equal(assets.length, expectedKeys.length);
  const dimensions = new Set();
  for (const asset of assets) {
    const file = join(projectRoot, "apps/api/assets/guides/matriva-modern-2023", asset.sourcePath);
    const bytes = await readFile(file);
    const { width, height } = pngDimensions(bytes);
    const fileStat = await stat(file);
    assert.ok(fileStat.size > 0);
    assert.equal(asset.sourceType, "ai_generated");
    assert.equal(asset.validationStatus, "passed");
    assert.equal(asset.approvalStatus, "approved");
    assert.equal(asset.guideVersion, "gver_tjek_fuger_vaadrum_v1");
    assert.equal(asset.guideKey, "tjek_fuger_vaadrum");
    assert.equal(asset.houseProfileId, "hprof_matriva_modern_2023");
    dimensions.add(`${width}x${height}`);
    if (asset.assetKey === "house_a_bathroom_reference_v1") assert.equal(sha256(bytes), reference.sha256);
  }
  assert.equal(dimensions.size, 1, "Reference and guide images must share a stable output frame.");

  const guideSource = await readFile(join(projectRoot, "apps/api/src/guide-content.ts"), "utf8");
  for (const key of ["wetroom_overview", "wetroom_shower", "wetroom_cracked_joint", "wetroom_discoloration", "wetroom_intact_joint"]) {
    assert.match(guideSource, new RegExp(`key: "${key}"`));
  }
  assert.match(guideSource, /ingen reparation, udskiftning eller indgreb/);
  console.log(`House A bathroom reference and ${assets.length} Guide 02 visual files validated.`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
