import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const generator = join(projectRoot, "tools/generate-house-a-a01-natural-garden-test-board.mjs");
const checkedIn = join(projectRoot, "docs/product/house-a-a01-natural-garden-test-board.png");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const root = await mkdtemp(join(tmpdir(), "matriva-house-a-a01-garden-board-"));
try {
  const first = join(root, "first.png");
  const second = join(root, "second.png");
  await run(process.execPath, [generator, "--output", first], { cwd: projectRoot });
  await run(process.execPath, [generator, "--output", second], { cwd: projectRoot });
  const [one, two, versioned] = await Promise.all([readFile(first), readFile(second), readFile(checkedIn)]);
  assert.equal(sha256(one), sha256(two));
  assert.equal(sha256(one), sha256(versioned));
  console.log("House A A01 natural-garden test board deterministic regeneration validated.");
} finally {
  await rm(root, { recursive: true, force: true });
}
