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
const generator = join(projectRoot, "tools", "generate-house-a-geometric-previews.mjs");
const checkedIn = join(projectRoot, "docs", "product", "house-a-geometric-previews");
const cameraIds = ["cam-front-hero","cam-front","cam-rear","cam-left","cam-right"];
const expectedFiles = [...cameraIds.flatMap((id) => [`${id}.png`, `${id}.svg`]), "geometric-preview-manifest.json"].sort();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "matriva-house-a-previews-"));
const first = join(temporaryRoot, "first");
const second = join(temporaryRoot, "second");

try {
  await run(process.execPath, [generator, "--output", first], { cwd: projectRoot });
  await run(process.execPath, [generator, "--output", second], { cwd: projectRoot });
  assert.deepEqual((await readdir(first)).sort(), expectedFiles);
  assert.deepEqual((await readdir(second)).sort(), expectedFiles);
  assert.deepEqual((await readdir(checkedIn)).sort(), expectedFiles);
  for (const fileName of expectedFiles) {
    const [one, two, versioned] = await Promise.all([readFile(join(first,fileName)), readFile(join(second,fileName)), readFile(join(checkedIn,fileName))]);
    assert.equal(sha256(one), sha256(two), `${fileName} must regenerate byte-identically`);
    assert.equal(sha256(one), sha256(versioned), `${fileName} must match the checked-in preview`);
  }
  const manifest = JSON.parse(await readFile(join(first, "geometric-preview-manifest.json"), "utf8"));
  assert.equal(manifest.outputs.length, 5);
  assert.deepEqual(manifest.outputs.map((output) => output.cameraId), ["CAM_FRONT_HERO","CAM_FRONT","CAM_REAR","CAM_LEFT","CAM_RIGHT"]);
  console.log("House A camera system and deterministic geometric previews validated.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
