import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const configPath = join(projectRoot, "docs/product/house-a-masonry-pattern-v1.json");
const outputIndex = process.argv.indexOf("--output");
const defaultOutput = join(projectRoot, "docs/product/house-a-masonry-tests");
const outputPath = outputIndex === -1 ? defaultOutput : resolve(process.argv[outputIndex + 1] ?? defaultOutput);
const configBuffer = await readFile(configPath);
const config = JSON.parse(configBuffer.toString("utf8"));
const sourcePath = join(projectRoot, config.testPatch.sourceImage);
const sourceBuffer = await readFile(sourcePath);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(`House A masonry test invalid: ${message}`);
}

function solve(matrix, values) {
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < values.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < rows.length; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    assert(Math.abs(rows[column][column]) > 1e-10, "homography points must form a non-degenerate quadrilateral");
    const divisor = rows[column][column];
    for (let index = column; index <= values.length; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < rows.length; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= values.length; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map((row) => row.at(-1));
}

function homography(from, to) {
  const matrix = [];
  const values = [];
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = from[index];
    const { x: u, y: v } = to[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]); values.push(v);
  }
  return [...solve(matrix, values), 1];
}

function project(matrix, x, y) {
  const denominator = matrix[6] * x + matrix[7] * y + matrix[8];
  return { x: (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator, y: (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator };
}

function insidePolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function edgeDistance(point, polygon) {
  let minimum = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const amount = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    minimum = Math.min(minimum, Math.hypot(point.x - (a.x + amount * dx), point.y - (a.y + amount * dy)));
  }
  return minimum;
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function noise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 4;
}

function xml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

assert(config.status === "REJECTED_SUPERSEDED", "masonry artifact must remain rejected historic evidence");
assert(config.canonicalUse === "PROHIBITED", "masonry artifact must never become canonical input");
const image = sharp(sourceBuffer).ensureAlpha();
const metadata = await image.metadata();
const { data: original, info } = await image.raw().toBuffer({ resolveWithObject: true });
const blurred = await sharp(sourceBuffer).ensureAlpha().blur(3).raw().toBuffer();
const output = Buffer.from(original);
const polygon = config.testPatch.destinationQuadPx;
const plane = config.testPatch.sourcePlaneSizeMm;
const destinationToPlane = homography(polygon, [{ x: 0, y: 0 }, { x: plane.width, y: 0 }, { x: plane.width, y: plane.height }, { x: 0, y: plane.height }]);
const pattern = config.pattern;
const minX = Math.floor(Math.min(...polygon.map((point) => point.x)));
const maxX = Math.ceil(Math.max(...polygon.map((point) => point.x)));
const minY = Math.floor(Math.min(...polygon.map((point) => point.y)));
const maxY = Math.ceil(Math.max(...polygon.map((point) => point.y)));
const sampled = [0, 0, 0];
let sampleCount = 0;

for (let y = minY; y <= maxY; y += 1) {
  for (let x = minX; x <= maxX; x += 1) {
    if (!insidePolygon({ x: x + 0.5, y: y + 0.5 }, polygon)) continue;
    const source = project(destinationToPlane, x + 0.5, y + 0.5);
    const row = Math.floor(source.y / pattern.verticalModuleMm);
    const rowOffset = modulo(row, 2) * pattern.adjacentRowOffsetMm;
    const withinX = modulo(source.x - rowOffset, pattern.horizontalModuleMm);
    const withinY = modulo(source.y, pattern.verticalModuleMm);
    const mortar = withinX >= pattern.brickVisibleLengthMm || withinY >= pattern.brickVisibleHeightMm;
    const pixel = (y * info.width + x) * info.channels;
    const featherDistance = 12;
    const linearFeather = Math.min(1, edgeDistance({ x: x + 0.5, y: y + 0.5 }, polygon) / featherDistance);
    const feather = linearFeather * linearFeather * (3 - 2 * linearFeather);
    for (let channel = 0; channel < 3; channel += 1) {
      const lowFrequency = blurred[pixel + channel];
      const sourceDetail = Math.max(-3, Math.min(8, original[pixel + channel] - lowFrequency));
      const materialVariation = noise(source.x + channel * 19, source.y) * 0.35;
      const target = mortar
        ? lowFrequency * 0.93 + sourceDetail * 0.2
        : lowFrequency + sourceDetail * 0.55 + materialVariation;
      output[pixel + channel] = Math.round(original[pixel + channel] * (1 - feather) + Math.max(0, Math.min(255, target)) * feather);
      if (!mortar) sampled[channel] += lowFrequency;
    }
    sampleCount += mortar ? 0 : 1;
  }
}

await mkdir(outputPath, { recursive: true });
const patchedPath = join(outputPath, "a01-masonry-test-patch-after.png");
await sharp(output, { raw: info }).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(patchedPath);

const averageBrick = sampled.map((value) => Math.round(value / sampleCount));
const tileWidth = 960;
const tileHeight = 400;
const tile = Buffer.alloc(tileWidth * tileHeight * 4, 255);
for (let y = 0; y < tileHeight; y += 1) {
  const row = Math.floor(y / pattern.verticalModuleMm);
  for (let x = 0; x < tileWidth; x += 1) {
    const withinX = modulo(x - modulo(row, 2) * pattern.adjacentRowOffsetMm, pattern.horizontalModuleMm);
    const withinY = modulo(y, pattern.verticalModuleMm);
    const mortar = withinX >= pattern.brickVisibleLengthMm || withinY >= pattern.brickVisibleHeightMm;
    const offset = (y * tileWidth + x) * 4;
    for (let channel = 0; channel < 3; channel += 1) tile[offset + channel] = Math.max(0, Math.min(255, mortar ? averageBrick[channel] * 0.93 : averageBrick[channel] + noise(x + channel * 19, y) * 0.35));
  }
}
await sharp(tile, { raw: { width: tileWidth, height: tileHeight, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(join(outputPath, "masonry-pattern-tile.png"));

const context = { left: 920, top: 285, width: 680, height: 390 };
const zoom = { left: 1215, top: 325, width: 190, height: 280 };
const beforeContext = await sharp(sourceBuffer).extract(context).resize(920, 527).png().toBuffer();
const afterBuffer = await readFile(patchedPath);
const afterContext = await sharp(afterBuffer).extract(context).resize(920, 527).png().toBuffer();
const beforeZoom = await sharp(sourceBuffer).extract(zoom).resize(920, 527, { fit: "contain", background: "#ffffff" }).png().toBuffer();
const afterZoom = await sharp(afterBuffer).extract(zoom).resize(920, 527, { fit: "contain", background: "#ffffff" }).png().toBuffer();
const boardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1360"><rect width="2000" height="1360" fill="#edf1ef"/><rect width="2000" height="130" fill="#1f2b2a"/><text x="40" y="51" font-family="Arial" font-size="34" font-weight="700" fill="#fff">HOUSE A · DETERMINISTIC MASONRY TEST PATCH</text><text x="40" y="91" font-family="Arial" font-size="18" fill="#cfdad6">A01 facade plane · masked inverse homography · original pixels outside patch</text><text x="1040" y="91" font-family="Arial" font-size="18" font-weight="700" fill="#ffb4a8">VISUAL GATE: FAIL · STOP BEFORE A05 / FULL CORRECTION</text>${[[40,180,"BEFORE · CONTEXT"],[1040,180,"AFTER · CONTEXT"],[40,775,"ZOOM BEFORE · STACKED / REJECTED"],[1040,775,"ZOOM AFTER · OFFSET / REJECTED"]].map(([x,y,label]) => `<text x="${x}" y="${y}" font-family="Arial" font-size="20" font-weight="700" fill="#263332">${xml(label)}</text><rect x="${x}" y="${y + 25}" width="920" height="527" fill="#fff" stroke="#9ba9a4"/>`).join("")}</svg>`;
await sharp(Buffer.from(boardSvg)).composite([
  { input: beforeContext, left: 40, top: 205 }, { input: afterContext, left: 1040, top: 205 },
  { input: beforeZoom, left: 40, top: 800 }, { input: afterZoom, left: 1040, top: 800 }
]).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(join(outputPath, "masonry-test-patch-board.png"));

const manifest = {
  schemaVersion: 1,
  patternId: config.id,
  configSha256: sha256(configBuffer),
  sourceImage: config.testPatch.sourceImage,
  sourceSha256: sha256(sourceBuffer),
  method: "deterministic masked inverse-homography compositing with source-derived low-frequency illumination",
  status: config.status,
  canonicalUse: config.canonicalUse,
  visualGate: config.testPatch.visualGate,
  destinationQuadPx: polygon,
  destinationToPlaneHomography: destinationToPlane.map((value) => Number(value.toFixed(10))),
  sampledAverageBrickRgb: averageBrick,
  outputs: {}
};
for (const fileName of ["a01-masonry-test-patch-after.png", "masonry-pattern-tile.png", "masonry-test-patch-board.png"]) manifest.outputs[fileName] = sha256(await readFile(join(outputPath, fileName)));
await writeFile(join(outputPath, "masonry-test-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated deterministic House A masonry test in ${outputPath}`);
