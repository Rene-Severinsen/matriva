import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const landscape = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-canonical-landscape-specification.json"), "utf8"));
const geometryBuffer = await readFile(join(projectRoot, "docs/product/house-a-canonical-geometry.json"));
const geometry = JSON.parse(geometryBuffer.toString("utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(landscape.status, "APPROVED_CURRENT_LANDSCAPE_CHARACTER");
assert.equal(landscape.approvalStatus, "HUMAN_APPROVED");
assert.equal(landscape.approvedAt, "2026-08-12");
assert.equal(landscape.siteGeometryMutation, "NONE");
assert.equal(landscape.canonicalGeometryId, geometry.id);
assert.equal(landscape.canonicalGeometrySha256, sha256(geometryBuffer));
assert.equal(landscape.character, "NATURAL MODERN DANISH RESIDENTIAL GARDEN");
assert.equal(landscape.roundedShrubRule.immutableVisualRule, "No repeated rows or clusters of nearly identical rounded shrubs.");
assert.deepEqual(landscape.registeredTrees.map((tree) => tree.id), ["TREE_01", "TREE_02"]);
for (const tree of landscape.registeredTrees) {
  const canonical = geometry.site.planting.find((item) => item.id === tree.id);
  assert(canonical, `${tree.id} must exist in canonical site geometry`);
  assert.deepEqual(tree.canonicalPosition, { xMm: canonical.x, yMm: canonical.y });
  assert(tree.maximumVisualHeightMm <= 3000);
  assert.equal(tree.movementProhibited, true);
}
assert.equal(landscape.photorealisticReference.status, "HUMAN_APPROVED_CURRENT_CANONICAL_REFERENCE");
assert.equal(landscape.photorealisticReference.sha256, sha256(await readFile(join(projectRoot, landscape.photorealisticReference.path))));

console.log("House A natural-garden character and immutable canonical site binding validated.");
