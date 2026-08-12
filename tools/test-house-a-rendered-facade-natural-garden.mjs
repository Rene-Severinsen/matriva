import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const provenance = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-rendered-facade-natural-garden-provenance.json"), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const verify = async (record) => {
  const buffer = await readFile(join(projectRoot, record.path));
  assert.equal(sha256(buffer), record.sha256, `${record.path} checksum`);
  if (record.widthPx) {
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.width, record.widthPx);
    assert.equal(metadata.height, record.heightPx);
  }
};

assert.equal(provenance.status, "HUMAN_APPROVED_PROMOTED_TO_CURRENT_CANONICAL_REFERENCE");
assert.equal(provenance.approvalStatus, "HUMAN_APPROVED");
assert.equal(provenance.approvedAt, "2026-08-12");
assert.deepEqual(provenance.scope, ["A01", "A02", "A03", "A04", "A05"]);
assert.equal(provenance.canonicalGeometry.mutation, "NONE");
assert.equal(provenance.landscapeSpecification.siteGeometryMutation, "NONE");
assert.deepEqual(provenance.approvalGate, ["FACADE", "GARDEN", "HOUSE_CONSISTENCY", "A02_DOOR_HANDLE", "A05_DRAINAGE"]);
for (const authority of [provenance.canonicalGeometry, provenance.materialSpecification, provenance.landscapeSpecification]) await verify(authority);
const expectedCameras = { A01: "CAM_FRONT_HERO", A02: "CAM_FRONT", A03: "CAM_REAR", A04: "CAM_LEFT", A05: "CAM_RIGHT" };
for (const render of provenance.renders) {
  assert.equal(render.cameraId, expectedCameras[render.id]);
  await verify(render.source);
  await verify(render.approvedCandidate);
  await verify(render.output);
  assert.equal(render.currentStatus, "HUMAN_APPROVED_CURRENT_CANONICAL_REFERENCE");
  assert.equal(render.approvedCandidate.sha256, render.output.sha256);
}
const a05 = provenance.renders.find((render) => render.id === "A05");
const a02 = provenance.renders.find((render) => render.id === "A02");
assert.equal(a02.doorHandleCorrection.geometryMutation, "NONE");
assert.equal(a02.doorHandleCorrection.preservedHandle, "left side of the front door in image space");
assert.equal(a02.doorHandleCorrection.removedHandle, "duplicate right side of the front door in image space");
assert.equal(a02.doorHandleCorrection.status, "HUMAN_APPROVED_2026_08_12");
await verify(a02.doorHandleCorrection.before);
const [a02Before, a02After] = await Promise.all([
  sharp(join(projectRoot, a02.doorHandleCorrection.before.path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  sharp(join(projectRoot, a02.output.path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
]);
const bounds = a02.doorHandleCorrection.changedPixelBounds;
let changedInside = 0;
let changedOutside = 0;
for (let y = 0; y < a02Before.info.height; y += 1) {
  for (let x = 0; x < a02Before.info.width; x += 1) {
    const offset = (y * a02Before.info.width + x) * a02Before.info.channels;
    const changed = Array.from({ length: a02Before.info.channels }, (_, channel) => a02Before.data[offset + channel] !== a02After.data[offset + channel]).some(Boolean);
    if (!changed) continue;
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) changedInside += 1;
    else changedOutside += 1;
  }
}
assert.ok(changedInside > 0, "A02 door-handle correction changes pixels inside its declared mask");
assert.equal(changedOutside, 0, "A02 door-handle correction changes no pixels outside its declared mask");
assert.equal(a05.drainageCorrection.preservedLeftDownpipe, true);
assert.equal(a05.drainageCorrection.status, "HUMAN_APPROVED_2026_08_12");
await verify(a05.drainageCorrection.before);
await verify(a05.drainageCorrection.rejectedAttempt);

const handleCorrector = join(projectRoot, "tools/correct-house-a-a02-door-handle.mjs");
const referenceboardGenerator = join(projectRoot, "tools/generate-house-a-rendered-facade-natural-garden-board.mjs");
const checkedIn = join(projectRoot, "docs/product/house-a-rendered-facade-natural-garden-drainage-approval-board.png");
const currentReferenceboard = join(projectRoot, "docs/product/house-a-current-canonical-referenceboard-v1.png");
const root = await mkdtemp(join(tmpdir(), "matriva-house-a-final-board-"));
try {
  const regeneratedA02 = join(root, "a02.png");
  const firstBoard = join(root, "first-board.png");
  const secondBoard = join(root, "second-board.png");
  await run(process.execPath, [handleCorrector, "--output", regeneratedA02], { cwd: projectRoot });
  await run(process.execPath, [referenceboardGenerator, "--output", firstBoard], { cwd: projectRoot });
  await run(process.execPath, [referenceboardGenerator, "--output", secondBoard], { cwd: projectRoot });
  assert.equal(sha256(await readFile(checkedIn)), provenance.approvalReference.sha256, "frozen human approval board checksum");
  assert.equal(sha256(await readFile(regeneratedA02)), a02.output.sha256, "A02 door-handle correction byte-identical regeneration");
  assert.equal(sha256(await readFile(firstBoard)), sha256(await readFile(secondBoard)), "current canonical referenceboard byte-identical regeneration");
  assert.equal(sha256(await readFile(firstBoard)), sha256(await readFile(currentReferenceboard)), "current canonical referenceboard matches checked-in artifact");
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("House A A01-A05 facade, landscape, drainage provenance and deterministic approval board validated.");
