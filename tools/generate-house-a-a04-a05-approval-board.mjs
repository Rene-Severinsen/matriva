import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultOutput = join(projectRoot, "docs/product/house-a-a02-a05-photorealistic-approval-board.png");
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex === -1 ? defaultOutput : resolve(process.argv[outputIndex + 1] ?? defaultOutput);
const provenance = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-photorealistic-pilot.json"), "utf8"));
const renderById = Object.fromEntries(provenance.renders.map((render) => [render.id, render]));

const width = 2400;
const height = 1500;
const panelWidth = 746;
const imageHeight = 420;
const columns = [40, 827, 1614];
const rows = [235, 815];

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function text(x, y, value, size, weight = 400, fill = "#263332") {
  return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(value)}</text>`;
}

const labels = [
  [columns[0], 205, "A02 FRONT · APPROVED"],
  [columns[1], 205, "CAM_LEFT · DETERMINISTIC GEOMETRY"],
  [columns[2], 205, "A04 LEFT · VALIDATED · APPROVAL PENDING"],
  [columns[0], 785, "A03 REAR / GARDEN · APPROVED"],
  [columns[1], 785, "CAM_RIGHT · DETERMINISTIC GEOMETRY"],
  [columns[2], 785, "A05 RIGHT · VALIDATED · APPROVAL PENDING"]
];

let background = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#edf1ef"/><rect x="0" y="0" width="${width}" height="150" fill="#1f2b2a"/>${text(40, 62, "MATRIVA HOUSE A · FOUR-DIRECTION APPROVAL BOARD", 34, 700, "#ffffff")}${text(40, 108, "One approved geometry · CAM_FRONT / REAR / LEFT / RIGHT · A01 material authority only", 23, 400, "#cfdad6")}`;
for (const [x, y, label] of labels) background += text(x, y, label, 19, 700);
for (const x of columns) {
  for (const y of rows) background += `<rect x="${x}" y="${y}" width="${panelWidth}" height="${imageHeight}" rx="5" fill="#ffffff" stroke="#9ba9a4" stroke-width="2"/>`;
}
background += `<rect x="40" y="1290" width="2320" height="160" rx="8" fill="#ffffff" stroke="#9ba9a4"/>${text(68, 1334, "VALIDATION RESULT", 19, 700)}${text(68, 1373, "PASS FOR HUMAN APPROVAL GATE · A04/A05 are VALIDATED, not APPROVED", 25, 700, "#27664d")}${text(68, 1414, "Canonical geometry SHA-256: " + provenance.canonicalGeometry.sha256, 16)}${text(1260, 1414, "Camera system SHA-256: " + provenance.cameraSystem.sha256, 16)}</svg>`;

const sourcePaths = [
  renderById.A02.image.path,
  renderById.A04.preview.path,
  renderById.A04.image.path,
  renderById.A03.image.path,
  renderById.A05.preview.path,
  renderById.A05.image.path
];
const buffers = await Promise.all(sourcePaths.map((path) => sharp(join(projectRoot, path)).resize(panelWidth, imageHeight, { fit: "contain", background: "#ffffff" }).png().toBuffer()));
const placements = [
  [columns[0], rows[0]], [columns[1], rows[0]], [columns[2], rows[0]],
  [columns[0], rows[1]], [columns[1], rows[1]], [columns[2], rows[1]]
];

await mkdir(dirname(outputPath), { recursive: true });
await sharp(Buffer.from(background)).composite(buffers.map((input, index) => ({ input, left: placements[index][0], top: placements[index][1] }))).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(outputPath);
console.log(`Generated ${outputPath}`);
