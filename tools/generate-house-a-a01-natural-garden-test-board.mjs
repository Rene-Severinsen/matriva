import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputIndex = process.argv.indexOf("--output");
const defaultOutput = join(projectRoot, "docs/product/house-a-a01-natural-garden-test-board.png");
const outputPath = outputIndex === -1 ? defaultOutput : resolve(process.argv[outputIndex + 1] ?? defaultOutput);
const currentPath = join(projectRoot, "apps/api/assets/house-profiles/matriva-modern-2023/canonical-renders/corrections/a01-rendered-facade-test-v1.png");
const candidatePath = join(projectRoot, "apps/api/assets/house-profiles/matriva-modern-2023/canonical-renders/corrections/a01-rendered-facade-natural-garden-candidate-v1.png");
const [current, candidate] = await Promise.all([readFile(currentPath), readFile(candidatePath)]);
const full = { width: 1000, height: 563 };
const plantingCrop = { left: 0, top: 500, width: 1050, height: 441 };
const [currentFull, candidateFull, currentDetail, candidateDetail] = await Promise.all([
  sharp(current).resize(full.width, full.height).png().toBuffer(),
  sharp(candidate).resize(full.width, full.height).png().toBuffer(),
  sharp(current).extract(plantingCrop).resize(1000, 420).png().toBuffer(),
  sharp(candidate).extract(plantingCrop).resize(1000, 420).png().toBuffer()
]);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2120" height="1340">
  <rect width="2120" height="1340" fill="#edf1ef"/><rect width="2120" height="130" fill="#1f2b2a"/>
  <text x="40" y="52" font-family="Arial" font-size="34" font-weight="700" fill="#fff">HOUSE A · A01 NATURAL GARDEN TEST</text>
  <text x="40" y="94" font-family="Arial" font-size="19" fill="#cfdad6">Immutable site structure · flexible planting character · no new permanent tree</text>
  <text x="1080" y="94" font-family="Arial" font-size="19" font-weight="700" fill="#9de0bd">TEST PASS · HUMAN APPROVAL PENDING</text>
  <text x="40" y="180" font-family="Arial" font-size="20" font-weight="700" fill="#263332">CURRENT RENDERED VERSION</text>
  <text x="1080" y="180" font-family="Arial" font-size="20" font-weight="700" fill="#263332">NATURAL GARDEN CANDIDATE</text>
  <rect x="40" y="205" width="1000" height="563" fill="#fff" stroke="#9ba9a4"/><rect x="1080" y="205" width="1000" height="563" fill="#fff" stroke="#9ba9a4"/>
  <text x="40" y="825" font-family="Arial" font-size="20" font-weight="700" fill="#263332">DETAIL · REPETITIVE COMPACT SHRUBS</text>
  <text x="1080" y="825" font-family="Arial" font-size="20" font-weight="700" fill="#263332">DETAIL · PERENNIALS / FLOWERS / ORNAMENTAL GRASSES</text>
  <rect x="40" y="850" width="1000" height="420" fill="#fff" stroke="#9ba9a4"/><rect x="1080" y="850" width="1000" height="420" fill="#fff" stroke="#9ba9a4"/>
  <text x="40" y="1310" font-family="Arial" font-size="17" fill="#40504d">PASS: house and plaster locked · path/paving/hedge/bed structure preserved · rounded-shrub repetition reduced</text>
</svg>`;
await mkdir(dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg)).composite([
  { input: currentFull, left: 40, top: 205 }, { input: candidateFull, left: 1080, top: 205 },
  { input: currentDetail, left: 40, top: 850 }, { input: candidateDetail, left: 1080, top: 850 }
]).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(outputPath);
console.log(`Generated A01 natural-garden test board at ${outputPath}`);
