import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const provenance = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-photorealistic-pilot.json"), "utf8"));
const geometry = JSON.parse(await readFile(join(projectRoot, provenance.canonicalGeometry.path), "utf8"));
const cameras = JSON.parse(await readFile(join(projectRoot, provenance.cameraSystem.path), "utf8"));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function verifyFile(record) {
  const contents = await readFile(join(projectRoot, record.path));
  assert.equal(sha256(contents), record.sha256, `${record.path} checksum must match provenance`);
  return contents;
}

assert.equal(geometry.status, "approved_current_source_of_truth");
assert.equal(provenance.status, "SUPERSEDED_RETAINED_FOR_GEOMETRY_AND_RENDER_PROVENANCE");
assert.equal(provenance.humanApproval, "HISTORICAL_A02_A03_APPROVED_AT_8b846b4_A04_A05_PRE_PROMOTION_RECORD");
assert.equal(provenance.currentCanonicalManifest, "docs/product/house-a-canonical-render-manifest.json");
assert.deepEqual(provenance.scope, ["A02", "A03", "A04", "A05"], "pilot scope must contain A02-A05 only");
assert.equal(provenance.renders.length, 4, "pilot must contain exactly four renders");
assert.deepEqual(provenance.renders.map((render) => render.id), ["A02", "A03", "A04", "A05"]);
assert.equal(sha256(await readFile(join(projectRoot, provenance.canonicalGeometry.path))), provenance.canonicalGeometry.sha256);
assert.equal(sha256(await readFile(join(projectRoot, provenance.cameraSystem.path))), provenance.cameraSystem.sha256);
assert.equal(provenance.canonicalGeometry.id, geometry.id);
assert.equal(provenance.cameraSystem.id, cameras.id);
await verifyFile(provenance.materialReference);

const expected = {
  A02: { cameraId: "CAM_FRONT", facade: "front", status: "APPROVED", visible: ["GARAGE_DOOR_01", "FRONT_DOOR_01", "FRONT_WINDOW_01", "FRONT_WINDOW_02"] },
  A03: { cameraId: "CAM_REAR", facade: "rear", status: "APPROVED", visible: ["REAR_SLIDER_02", "REAR_WINDOW_02", "REAR_SLIDER_01", "REAR_WINDOW_01"] },
  A04: { cameraId: "CAM_LEFT", facade: "left", status: "VALIDATED", visible: ["LEFT_WINDOW_01", "LEFT_GARAGE_DOOR_01"] },
  A05: { cameraId: "CAM_RIGHT", facade: "right", status: "VALIDATED", visible: ["RIGHT_WINDOW_01", "RIGHT_WINDOW_02"] }
};

for (const render of provenance.renders) {
  const rule = expected[render.id];
  assert(rule, `${render.id} is outside the A02-A05 approval scope`);
  assert.equal(render.status, rule.status);
  assert.equal(render.humanApproval, rule.status === "APPROVED" ? "APPROVED" : "PENDING");
  assert.equal(render.cameraId, rule.cameraId);
  assert.equal(render.facade, rule.facade);
  assert(cameras.cameras.some((camera) => camera.id === render.cameraId), `${render.cameraId} must exist`);
  const facadeIds = geometry.openings.filter((opening) => opening.facade === render.facade).map((opening) => opening.id);
  assert.deepEqual(render.canonicalOpeningIds, facadeIds, `${render.id} canonical openings must match geometry`);
  assert.deepEqual(render.visibleLeftToRightOpeningIds, rule.visible, `${render.id} visible opening order must match its camera`);
  await verifyFile(render.preview);
  const image = await verifyFile(render.image);
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, render.image.widthPx);
  assert.equal(metadata.height, render.image.heightPx);
  assert(Math.abs(metadata.width / metadata.height - 16 / 9) < 0.003, `${render.id} must be 16:9`);
  assert(!render.image.path.includes("/guides/"), `${render.id} must not overwrite guide imagery`);
}

assert.equal(provenance.manualValidation.result, "PASS_FOR_HUMAN_APPROVAL_GATE");
console.log("House A A02-A05 provenance, camera binding and artifact integrity validated.");
