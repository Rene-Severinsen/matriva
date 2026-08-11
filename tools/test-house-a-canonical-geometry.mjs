import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const projectRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const generator = join(projectRoot, "tools", "generate-house-a-canonical-geometry.mjs");
const checkedInOutput = join(projectRoot, "docs", "product", "house-a-canonical-geometry");
const expectedFiles = [
  "01-dimensioned-floor-plan.svg",
  "02-roof-plan.svg",
  "03-front-elevation.svg",
  "04-rear-elevation.svg",
  "05-left-elevation.svg",
  "06-right-elevation.svg",
  "07-opening-schedule.svg",
  "08-room-and-interior-visibility-map.svg",
  "09-site-plan.svg",
  "10-materials-and-immutable-rules.svg",
  "11-technical-referenceboard.svg"
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const root = await mkdtemp(join(tmpdir(), "matriva-house-a-geometry-"));
const first = join(root, "first");
const second = join(root, "second");

try {
  await run(process.execPath, [generator, "--output", first], { cwd: projectRoot });
  await run(process.execPath, [generator, "--output", second], { cwd: projectRoot });
  assert.deepEqual((await readdir(first)).sort(), expectedFiles);
  assert.deepEqual((await readdir(second)).sort(), expectedFiles);
  assert.deepEqual((await readdir(checkedInOutput)).sort(), expectedFiles, "checked-in technical artifacts must be complete");
  for (const fileName of expectedFiles) {
    const [one, two, checkedIn] = await Promise.all([readFile(join(first, fileName)), readFile(join(second, fileName)), readFile(join(checkedInOutput, fileName))]);
    assert.equal(sha256(one), sha256(two), `${fileName} must be byte-identical after deterministic regeneration`);
    assert.equal(sha256(one), sha256(checkedIn), `${fileName} must match the checked-in deterministic artifact`);
    assert.match(one.toString("utf8"), /APPROVED CURRENT SOURCE OF TRUTH/, `${fileName} must visibly retain the source-of-truth marker`);
  }
  console.log("House A canonical geometry validation and deterministic regeneration passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
