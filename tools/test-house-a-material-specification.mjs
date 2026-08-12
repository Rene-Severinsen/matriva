import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const specification = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-canonical-material-specification.json"), "utf8"));
const geometryBuffer = await readFile(join(projectRoot, "docs/product/house-a-canonical-geometry.json"));
const geometry = JSON.parse(geometryBuffer.toString("utf8"));
const masonryHistory = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-masonry-pattern-v1.json"), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(specification.status, "APPROVED_CURRENT_CANONICAL_MATERIAL");
assert.equal(specification.approvalStatus, "HUMAN_APPROVED");
assert.equal(specification.approvedAt, "2026-08-12");
assert.equal(specification.geometryMutation, "NONE");
assert.equal(specification.canonicalGeometryId, geometry.id);
assert.equal(specification.canonicalGeometrySha256, sha256(geometryBuffer));
assert.equal(specification.facade.canonicalMaterial, "LIGHT RENDERED / PLASTERED FACADE");
assert(specification.facade.prohibitedAppearance.includes("visible brick"));
assert(specification.facade.prohibitedAppearance.includes("masonry joints or grid"));
assert(specification.immutableVisualMaterialRules.some((rule) => rule.includes("same continuous light rendered/plastered facade system")));
assert.equal(specification.photorealisticReference.status, "HUMAN_APPROVED_CURRENT_CANONICAL_REFERENCE");
assert.equal(specification.photorealisticReference.sha256, sha256(await readFile(join(projectRoot, specification.photorealisticReference.path))));
assert.equal(masonryHistory.status, "REJECTED_SUPERSEDED");
assert.equal(masonryHistory.canonicalUse, "PROHIBITED");

console.log("House A canonical rendered-facade material decision and superseded masonry history validated.");
