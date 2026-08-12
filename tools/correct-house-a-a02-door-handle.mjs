import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const sourcePath = join(projectRoot, "apps/api/assets/house-profiles/matriva-modern-2023/canonical-renders/corrections/a02-front-rendered-facade-natural-garden-candidate-v1.png");
const outputIndex = process.argv.indexOf("--output");
const defaultOutput = join(projectRoot, "apps/api/assets/house-profiles/matriva-modern-2023/canonical-renders/corrections/a02-front-rendered-facade-natural-garden-door-handle-candidate-v3.png");
const outputPath = outputIndex === -1 ? defaultOutput : resolve(process.argv[outputIndex + 1] ?? defaultOutput);

const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(info.width, 1672);
assert.equal(info.height, 941);
assert.equal(info.channels, 4);

// User-reported duplicate handle center: x=55.1%, y=57.6% => approximately (921, 542).
// The replacement interval is bounded by clean matte-black door samples and does
// not intersect the approved left handle or the door frame/panel boundaries.
const repair = { left: 897, right: 939, topSampleY: 510, bottomSampleY: 566 };
const output = Buffer.from(data);
for (let y = repair.topSampleY + 1; y < repair.bottomSampleY; y += 1) {
  const t = (y - repair.topSampleY) / (repair.bottomSampleY - repair.topSampleY);
  for (let x = repair.left; x <= repair.right; x += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const top = data[(repair.topSampleY * info.width + x) * info.channels + channel];
      const bottom = data[(repair.bottomSampleY * info.width + x) * info.channels + channel];
      output[(y * info.width + x) * info.channels + channel] = Math.round(top * (1 - t) + bottom * t);
    }
  }
}

await mkdir(dirname(outputPath), { recursive: true });
await sharp(output, { raw: info }).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(outputPath);
console.log(`Corrected A02 duplicate right-side door handle at ${outputPath}`);
