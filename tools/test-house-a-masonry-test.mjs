import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const generator = join(projectRoot, "tools/generate-house-a-masonry-test.mjs");
const checkedIn = join(projectRoot, "docs/product/house-a-masonry-tests");
const expected = ["a01-masonry-test-patch-after.png", "masonry-pattern-tile.png", "masonry-test-manifest.json", "masonry-test-patch-board.png"].sort();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const root = await mkdtemp(join(tmpdir(), "matriva-house-a-masonry-test-"));
const first = join(root, "first");
const second = join(root, "second");
try {
  await run(process.execPath, [generator, "--output", first], { cwd: projectRoot });
  await run(process.execPath, [generator, "--output", second], { cwd: projectRoot });
  assert.deepEqual((await readdir(first)).sort(), expected);
  assert.deepEqual((await readdir(second)).sort(), expected);
  assert.deepEqual((await readdir(checkedIn)).sort(), expected);
  for (const fileName of expected) {
    const [one, two, versioned] = await Promise.all([readFile(join(first, fileName)), readFile(join(second, fileName)), readFile(join(checkedIn, fileName))]);
    assert.equal(sha256(one), sha256(two), `${fileName} must regenerate byte-identically`);
    assert.equal(sha256(one), sha256(versioned), `${fileName} must match the checked-in artifact`);
  }
  const config = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-masonry-pattern-v1.json"), "utf8"));
  assert.equal(config.status, "REJECTED_SUPERSEDED");
  assert.equal(config.canonicalUse, "PROHIBITED");
  assert.equal(config.testPatch.visualGate.status, "FAIL");
  assert.equal(config.testPatch.visualGate.decision, "REJECTED_SUPERSEDED_BY_RENDERED_FACADE_DECISION");
  assert.equal(config.pattern.adjacentRowOffsetMm * 2, config.pattern.horizontalModuleMm);
  assert(config.pattern.verticalJointMm > 0 && config.pattern.horizontalJointMm > 0);
  assert.equal(config.pattern.brickVisibleLengthMm + config.pattern.verticalJointMm, config.pattern.horizontalModuleMm);
  assert(Math.abs(config.pattern.brickVisibleHeightMm + config.pattern.horizontalJointMm - config.pattern.verticalModuleMm) < 0.001);
  console.log("House A rejected/superseded masonry history and byte-identical evidence regeneration validated.");
} finally {
  await rm(root, { recursive: true, force: true });
}
