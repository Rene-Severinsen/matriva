import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputIndex = process.argv.indexOf("--output");
const defaultOutput = join(projectRoot, "docs/product/house-a-current-canonical-referenceboard-v1.png");
const frozenApprovalBoard = join(projectRoot, "docs/product/house-a-rendered-facade-natural-garden-drainage-approval-board.png");
const outputPath = outputIndex === -1 ? defaultOutput : resolve(process.argv[outputIndex + 1] ?? defaultOutput);
if (outputPath === frozenApprovalBoard) throw new Error("The human-approved board is frozen; choose a different derived-review output path");
const provenance = JSON.parse(await readFile(join(projectRoot, "docs/product/house-a-rendered-facade-natural-garden-provenance.json"), "utf8"));
const byId = Object.fromEntries(provenance.renders.map((render) => [render.id, render]));
const load = (path) => readFile(join(projectRoot, path));
const originalA01 = await load(byId.A01.source.path);
const renderedA01 = await load("apps/api/assets/house-profiles/matriva-modern-2023/canonical-renders/corrections/a01-rendered-facade-test-v1.png");
const candidates = Object.fromEntries(await Promise.all(provenance.renders.map(async (render) => [render.id, await load(render.output.path)])));

const topSize = { width: 1000, height: 563 };
const midSize = { width: 760, height: 428 };
const top = await Promise.all([originalA01, renderedA01, candidates.A01].map((buffer) => sharp(buffer).resize(topSize.width, topSize.height).png().toBuffer()));
const middle = await Promise.all(["A02", "A03", "A04", "A05"].map((id) => sharp(candidates[id]).resize(midSize.width, midSize.height).png().toBuffer()));
const details = await Promise.all([
  sharp(candidates.A01).extract({ left: 900, top: 300, width: 772, height: 470 }).resize(600, 360).png().toBuffer(),
  sharp(candidates.A01).extract({ left: 0, top: 500, width: 1050, height: 441 }).resize(600, 360).png().toBuffer(),
  sharp(candidates.A05).extract({ left: 120, top: 360, width: 240, height: 360 }).resize(600, 360).png().toBuffer(),
  sharp(candidates.A05).extract({ left: 1320, top: 360, width: 240, height: 360 }).resize(600, 360).png().toBuffer(),
  sharp(candidates.A05).extract({ left: 520, top: 345, width: 650, height: 300 }).resize(600, 360, { fit: "cover" }).png().toBuffer()
]);

const panel = (x, y, width, height) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff" stroke="#9ba9a4"/>`;
const label = (x, y, value, size = 18) => `<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="700" fill="#263332">${value}</text>`;
const topXs = [40, 1100, 2160];
const midXs = [40, 830, 1620, 2410];
const detailXs = [40, 670, 1300, 1930, 2560];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3200" height="2050">
  <rect width="3200" height="2050" fill="#edf1ef"/><rect width="3200" height="140" fill="#1f2b2a"/>
  <text x="40" y="54" font-family="Arial" font-size="36" font-weight="700" fill="#fff">HOUSE A · DERIVED CURRENT-REFERENCE REVIEW</text>
  <text x="40" y="101" font-family="Arial" font-size="21" fill="#cfdad6">NOT THE FROZEN 2026-08-12 APPROVAL RECORD · current canonical assets</text>
  ${label(40, 185, "A01 ORIGINAL · BRICK SUPERSEDED")}${label(1100, 185, "A01 RENDERED · APPROVED FACADE LOOK")}${label(2160, 185, "A01 FINAL CANDIDATE · NATURAL GARDEN")}
  ${topXs.map((x) => panel(x, 210, 1000, 563)).join("")}
  ${label(40, 840, "A02 FRONT · HUMAN APPROVED")}${label(830, 840, "A03 REAR · HUMAN APPROVED")}${label(1620, 840, "A04 LEFT · HUMAN APPROVED")}${label(2410, 840, "A05 RIGHT · HUMAN APPROVED")}
  ${midXs.map((x) => panel(x, 865, 760, 428)).join("")}
  ${label(40, 1415, "FACADE DETAIL")}${label(670, 1415, "NATURAL PLANTING")}${label(1300, 1415, "A05 LEFT DOWNSPOUT")}${label(1930, 1415, "A05 RIGHT DOWNSPOUT")}${label(2560, 1415, "A05 GUTTER")}
  ${detailXs.map((x) => panel(x, 1440, 600, 360)).join("")}
  <rect x="40" y="1850" width="3120" height="155" rx="8" fill="#fff" stroke="#9ba9a4"/>
  <text x="70" y="1895" font-family="Arial" font-size="20" font-weight="700" fill="#263332">CURRENT CANONICAL REFERENCE · APPROVED 2026-08-12</text>
  <text x="70" y="1940" font-family="Arial" font-size="24" font-weight="700" fill="#27664d">FACADE · GARDEN · HOUSE CONSISTENCY · A02 HANDLE · A05 DRAINAGE · APPROVED</text>
  <text x="70" y="1980" font-family="Arial" font-size="16" fill="#40504d">Geometry ${provenance.canonicalGeometry.sha256} · Materials ${provenance.materialSpecification.sha256} · Landscape ${provenance.landscapeSpecification.sha256}</text>
</svg>`;
await mkdir(dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg)).composite([
  ...top.map((input, index) => ({ input, left: topXs[index], top: 210 })),
  ...middle.map((input, index) => ({ input, left: midXs[index], top: 865 })),
  ...details.map((input, index) => ({ input, left: detailXs[index], top: 1440 }))
]).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(outputPath);
console.log(`Generated House A rendered-facade/natural-garden/drainage approval board at ${outputPath}`);
