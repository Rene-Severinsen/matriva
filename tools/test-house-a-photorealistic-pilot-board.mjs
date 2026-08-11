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
const generator = join(projectRoot, "tools/generate-house-a-photorealistic-pilot-board.mjs");
const checkedIn = join(projectRoot, "docs/product/house-a-photorealistic-pilot-board.png");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const root = await mkdtemp(join(tmpdir(), "matriva-house-a-pilot-board-"));
const first = join(root, "first.png");
const second = join(root, "second.png");

try {
  await run(process.execPath, [generator, "--output", first], { cwd: projectRoot });
  await run(process.execPath, [generator, "--output", second], { cwd: projectRoot });
  const [one, two, versioned] = await Promise.all([readFile(first), readFile(second), readFile(checkedIn)]);
  assert.equal(sha256(one), sha256(two), "pilot board must regenerate byte-identically");
  assert.equal(sha256(one), sha256(versioned), "pilot board must match the checked-in artifact");
  const metadata = await sharp(one).metadata();
  assert.equal(metadata.width, 2400);
  assert.equal(metadata.height, 1500);
  console.log("House A A02/A03 approval board deterministic regeneration validated.");
} finally {
  await rm(root, { recursive: true, force: true });
}
