import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const canonicalRootRelative = "apps/api/assets/house-profiles/matriva-modern-2023/canonical-renders";
const defaultOutputDir = join(projectRoot, canonicalRootRelative);
const defaultManifestPath = join(projectRoot, "docs/product/house-a-canonical-render-manifest.json");
const outputDirIndex = process.argv.indexOf("--output-dir");
const manifestIndex = process.argv.indexOf("--manifest");
const outputDir = outputDirIndex === -1 ? defaultOutputDir : resolve(process.argv[outputDirIndex + 1] ?? defaultOutputDir);
const manifestPath = manifestIndex === -1 ? defaultManifestPath : resolve(process.argv[manifestIndex + 1] ?? defaultManifestPath);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const authorities = {
  geometry: {
    path: "docs/product/house-a-canonical-geometry.json",
    id: "matriva_modern_2023_house_a_canonical_geometry",
    sha256: "5a1c2a6c5e5373b9a67c26e86ca9d2ba70bfc536b6209a9f65adfd13723e98cb"
  },
  material: {
    path: "docs/product/house-a-canonical-material-specification.json",
    id: "matriva_modern_2023_house_a_canonical_materials_v1",
    sha256: "f4e22be4388991d44b03c2253d86a69b2485cd3bb92a5a510820aa69826f6431"
  },
  landscape: {
    path: "docs/product/house-a-canonical-landscape-specification.json",
    id: "matriva_modern_2023_house_a_canonical_landscape_v1",
    sha256: "c73ffb0dee23a28bfe788fd3cceab5afa6bc29941645e0fe60c5cbcefe49af39"
  },
  cameraSystem: {
    path: "docs/product/house-a-canonical-camera-system.json",
    id: "matriva_modern_2023_house_a_canonical_cameras_v1",
    sha256: "ad9516cff7c8acfee8457b231a303b6b41147783873b5cb6d7d5d2297de78e73"
  }
};

const approved = [
  {
    renderId: "A01",
    cameraId: "CAM_FRONT_HERO",
    fileName: "a01-front-hero-canonical-v1.png",
    approvedCandidatePath: `${canonicalRootRelative}/corrections/a01-rendered-facade-natural-garden-candidate-v1.png`,
    sha256: "d9549012d55f2405e9c6d3f0581f5e49ae5502f23ff3c6e067bd7d3fcbf2c919",
    approvalScope: ["rendered facade", "natural garden", "overall House A visual look"],
    supersedes: ["apps/api/assets/guides/matriva-modern-2023/masters/a01-exterior-entry-original-v1.png as current photorealistic/material reference; original retained as historical visual reference"]
  },
  {
    renderId: "A02",
    cameraId: "CAM_FRONT",
    fileName: "a02-front-canonical-v1.png",
    approvedCandidatePath: `${canonicalRootRelative}/corrections/a02-front-rendered-facade-natural-garden-door-handle-candidate-v3.png`,
    sha256: "8804dc550186126a4632f99f87d17674a1fcc9b3b3a634f5815445f83a597f8e",
    approvalScope: ["rendered facade", "natural garden", "geometry consistency", "deterministic single door handle correction"],
    supersedes: [`${canonicalRootRelative}/a02-front-canonical-draft-v1.png`, `${canonicalRootRelative}/corrections/a02-front-rendered-facade-natural-garden-candidate-v1.png`]
  },
  {
    renderId: "A03",
    cameraId: "CAM_REAR",
    fileName: "a03-rear-garden-canonical-v1.png",
    approvedCandidatePath: `${canonicalRootRelative}/corrections/a03-rear-garden-rendered-facade-natural-garden-candidate-v1.png`,
    sha256: "130c096440cf863ee87a9b6da168196b37d3a464db838c8bc966556b69fec84b",
    approvalScope: ["rendered facade", "natural garden", "previously approved geometry and interior", "current House A consistency"],
    supersedes: [`${canonicalRootRelative}/a03-rear-garden-canonical-draft-v1.png`]
  },
  {
    renderId: "A04",
    cameraId: "CAM_LEFT",
    fileName: "a04-left-canonical-v1.png",
    approvedCandidatePath: `${canonicalRootRelative}/corrections/a04-left-rendered-facade-natural-garden-candidate-v1.png`,
    sha256: "dc2045c1623d4569cdc3151755b9ed1c8cca025cfcb5d743b808766d4925405d",
    approvalScope: ["rendered facade", "natural garden", "previously approved geometry and interior", "current House A consistency"],
    supersedes: [`${canonicalRootRelative}/a04-left-canonical-draft-v1.png`]
  },
  {
    renderId: "A05",
    cameraId: "CAM_RIGHT",
    fileName: "a05-right-canonical-v1.png",
    approvedCandidatePath: `${canonicalRootRelative}/corrections/a05-right-rendered-facade-natural-garden-drainage-candidate-v2.png`,
    sha256: "3323073cf0783d8cde248722f510f25591718fcb5e4e4a4ea05ac8e76fc7e589",
    approvalScope: ["rendered facade", "natural garden", "current House A consistency", "drainage v2"],
    supersedes: [`${canonicalRootRelative}/a05-right-canonical-draft-v1.png`, `${canonicalRootRelative}/corrections/a05-right-rendered-facade-natural-garden-before-drainage-v1.png`, `${canonicalRootRelative}/corrections/a05-right-rendered-facade-natural-garden-drainage-candidate-v1.png`]
  }
];

for (const authority of Object.values(authorities)) {
  const buffer = await readFile(join(projectRoot, authority.path));
  assert.equal(sha256(buffer), authority.sha256, `${authority.path} checksum`);
}

await mkdir(outputDir, { recursive: true });
const renders = [];
for (const render of approved) {
  const sourcePath = join(projectRoot, render.approvedCandidatePath);
  const source = await readFile(sourcePath);
  assert.equal(sha256(source), render.sha256, `${render.renderId} approved candidate checksum`);
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.width, 1672, `${render.renderId} width`);
  assert.equal(metadata.height, 941, `${render.renderId} height`);
  await copyFile(sourcePath, join(outputDir, render.fileName));
  renders.push({
    renderId: render.renderId,
    canonicalPath: `${canonicalRootRelative}/${render.fileName}`,
    approvedCandidatePath: render.approvedCandidatePath,
    sha256: render.sha256,
    widthPx: metadata.width,
    heightPx: metadata.height,
    geometryVersion: authorities.geometry.id,
    geometrySha256: authorities.geometry.sha256,
    cameraId: render.cameraId,
    materialSpecificationVersion: authorities.material.id,
    materialSpecificationSha256: authorities.material.sha256,
    landscapeSpecificationVersion: authorities.landscape.id,
    landscapeSpecificationSha256: authorities.landscape.sha256,
    approvalStatus: "HUMAN_APPROVED",
    approvedAt: "2026-08-12",
    approvalReference: {
      path: "docs/product/house-a-rendered-facade-natural-garden-drainage-approval-board.png",
      sha256: "5b70a0367ba27d4bd6e65acde4434200a0f0cbeafe6dfcdb80391df8946b7aec"
    },
    approvalScope: render.approvalScope,
    supersedes: render.supersedes
  });
}

const manifest = {
  schemaVersion: 1,
  id: "matriva_modern_2023_house_a_current_canonical_renders_v1",
  status: "CURRENT_CANONICAL_REFERENCE",
  approvedAt: "2026-08-12",
  approvalStatus: "HUMAN_APPROVED",
  changePolicy: "Not immutable forever. Future canonical-reference changes must be explicit, versioned, documented, provenance-preserving, validated and human-approved where applicable; no silent overwrite.",
  scope: approved.map(({ renderId }) => renderId),
  authorities,
  derivedRepresentationRule: "Photorealistic renders are derived representations and cannot modify architectural geometry, material specification, landscape specification, camera bindings or room/interior visibility authority.",
  renders,
  historicalReferences: {
    originalA01: {
      path: "apps/api/assets/guides/matriva-modern-2023/masters/a01-exterior-entry-original-v1.png",
      sha256: "1b4416fdbbf431107fb021e7be9b567a79537e1b0860bfdc4ec7998c4f990573",
      status: "HISTORICAL_VISUAL_REFERENCE_BRICK_MATERIAL_SUPERSEDED"
    },
    masonryTrackStatus: "REJECTED_SUPERSEDED_CANONICAL_USE_PROHIBITED",
    previousPilotStatus: "SUPERSEDED_RETAINED_FOR_PROVENANCE"
  }
};

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Promoted ${renders.length} byte-identical House A canonical renders and wrote ${manifestPath}`);
