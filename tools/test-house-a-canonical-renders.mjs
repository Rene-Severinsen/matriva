import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(projectRoot, "docs/product/house-a-canonical-render-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(manifest.status, "CURRENT_CANONICAL_REFERENCE");
assert.equal(manifest.approvalStatus, "HUMAN_APPROVED");
assert.equal(manifest.approvedAt, "2026-08-12");
assert.deepEqual(manifest.scope, ["A01", "A02", "A03", "A04", "A05"]);
assert.equal(manifest.renders.length, 5);
assert.equal(manifest.historicalReferences.masonryTrackStatus, "REJECTED_SUPERSEDED_CANONICAL_USE_PROHIBITED");

const expectedCameras = { A01: "CAM_FRONT_HERO", A02: "CAM_FRONT", A03: "CAM_REAR", A04: "CAM_LEFT", A05: "CAM_RIGHT" };
for (const authority of Object.values(manifest.authorities)) {
  assert.equal(sha256(await readFile(join(projectRoot, authority.path))), authority.sha256, `${authority.path} checksum`);
}
for (const render of manifest.renders) {
  assert.equal(render.approvalStatus, "HUMAN_APPROVED");
  assert.equal(render.approvedAt, "2026-08-12");
  assert.equal(render.cameraId, expectedCameras[render.renderId]);
  assert.equal(render.geometrySha256, manifest.authorities.geometry.sha256);
  assert.equal(render.materialSpecificationSha256, manifest.authorities.material.sha256);
  assert.equal(render.landscapeSpecificationSha256, manifest.authorities.landscape.sha256);
  const [canonical, candidate, approvalBoard] = await Promise.all([
    readFile(join(projectRoot, render.canonicalPath)),
    readFile(join(projectRoot, render.approvedCandidatePath)),
    readFile(join(projectRoot, render.approvalReference.path))
  ]);
  assert.equal(sha256(canonical), render.sha256, `${render.renderId} canonical checksum`);
  assert.equal(sha256(candidate), render.sha256, `${render.renderId} approved candidate must be byte-identical`);
  assert.equal(sha256(approvalBoard), render.approvalReference.sha256, `${render.renderId} frozen approval board checksum`);
  const metadata = await sharp(canonical).metadata();
  assert.equal(metadata.width, render.widthPx);
  assert.equal(metadata.height, render.heightPx);
}

const a02 = manifest.renders.find(({ renderId }) => renderId === "A02");
const a05 = manifest.renders.find(({ renderId }) => renderId === "A05");
assert(a02.approvedCandidatePath.endsWith("door-handle-candidate-v3.png"));
assert(a02.approvalScope.includes("deterministic single door handle correction"));
assert(a05.approvedCandidatePath.endsWith("drainage-candidate-v2.png"));
assert(a05.approvalScope.includes("drainage v2"));
for (const render of manifest.renders) assert(!render.canonicalPath.includes("corrections/"));

const root = await mkdtemp(join(tmpdir(), "matriva-house-a-canonical-promotion-"));
try {
  const outputDir = join(root, "renders");
  const regeneratedManifestPath = join(root, "manifest.json");
  await run(process.execPath, [join(projectRoot, "tools/promote-house-a-canonical-renders.mjs"), "--output-dir", outputDir, "--manifest", regeneratedManifestPath], { cwd: projectRoot });
  assert.equal(sha256(await readFile(regeneratedManifestPath)), sha256(await readFile(manifestPath)), "canonical manifest byte-identical regeneration");
  for (const render of manifest.renders) {
    assert.equal(sha256(await readFile(join(outputDir, basename(render.canonicalPath)))), render.sha256, `${render.renderId} byte-identical promotion`);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("House A A01-A05 current canonical render promotion, approval and byte identity validated.");
