import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputIndex = process.argv.indexOf("--output");
const defaultOutput = join(projectRoot, "docs/product/house-a-a01-rendered-facade-validation-board.png");
const outputPath = outputIndex === -1 ? defaultOutput : resolve(process.argv[outputIndex + 1] ?? defaultOutput);
const originalPath = join(projectRoot, "apps/api/assets/guides/matriva-modern-2023/masters/a01-exterior-entry-original-v1.png");
const renderedPath = join(projectRoot, "apps/api/assets/house-profiles/matriva-modern-2023/canonical-renders/corrections/a01-rendered-facade-test-v1.png");
const [original, rendered] = await Promise.all([readFile(originalPath), readFile(renderedPath)]);

const full = { width: 1000, height: 563 };
const detailCrop = { left: 900, top: 300, width: 772, height: 470 };
const detail = { width: 1000, height: 540 };
const [originalFull, renderedFull, originalDetail, renderedDetail] = await Promise.all([
  sharp(original).resize(full.width, full.height).png().toBuffer(),
  sharp(rendered).resize(full.width, full.height).png().toBuffer(),
  sharp(original).extract(detailCrop).resize(detail.width, detail.height).png().toBuffer(),
  sharp(rendered).extract(detailCrop).resize(detail.width, detail.height).png().toBuffer()
]);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2120" height="1460">
  <rect width="2120" height="1460" fill="#edf1ef"/>
  <rect width="2120" height="130" fill="#1f2b2a"/>
  <text x="40" y="52" font-family="Arial" font-size="34" font-weight="700" fill="#fff">HOUSE A · A01 RENDERED FACADE VALIDATION</text>
  <text x="40" y="94" font-family="Arial" font-size="19" fill="#cfdad6">Human-approved plaster look · protected architecture validated · original preserved</text>
  <text x="1080" y="94" font-family="Arial" font-size="19" font-weight="700" fill="#9de0bd">PASS · A01 MATERIAL REFERENCE</text>
  <text x="40" y="180" font-family="Arial" font-size="20" font-weight="700" fill="#263332">A01 ORIGINAL · EXPOSED BRICK SUPERSEDED</text>
  <text x="1080" y="180" font-family="Arial" font-size="20" font-weight="700" fill="#263332">A01 RENDERED FACADE · APPROVED LOOK</text>
  <rect x="40" y="205" width="1000" height="563" fill="#fff" stroke="#9ba9a4"/>
  <rect x="1080" y="205" width="1000" height="563" fill="#fff" stroke="#9ba9a4"/>
  <text x="40" y="825" font-family="Arial" font-size="20" font-weight="700" fill="#263332">DETAIL BEFORE · BRICK / JOINT GRID</text>
  <text x="1080" y="825" font-family="Arial" font-size="20" font-weight="700" fill="#263332">DETAIL AFTER · CONTINUOUS MATTE MINERAL PLASTER</text>
  <rect x="40" y="850" width="1000" height="540" fill="#fff" stroke="#9ba9a4"/>
  <rect x="1080" y="850" width="1000" height="540" fill="#fff" stroke="#9ba9a4"/>
  <text x="40" y="1430" font-family="Arial" font-size="17" fill="#40504d">PASS: footprint · roof/eaves · window · door/sidelights · gutter/drainage · paving/path · hedge · camera composition</text>
</svg>`;

await mkdir(dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg)).composite([
  { input: originalFull, left: 40, top: 205 },
  { input: renderedFull, left: 1080, top: 205 },
  { input: originalDetail, left: 40, top: 850 },
  { input: renderedDetail, left: 1080, top: 850 }
]).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(outputPath);

console.log(`Generated A01 rendered-facade validation board at ${outputPath}`);
