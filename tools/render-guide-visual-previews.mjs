import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { visualAssets } from "./guide-visual-asset-manifest.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = join(projectRoot, "apps", "api", "assets", "guides", "matriva-modern-2023");
const previewRoot = join(assetRoot, "previews");

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function svg(width, height, body) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
}

function textBlock({ x, y, width, text, size = 24, color = "#172020", weight = 400, lineHeight = 1.35, maxLines = 8 }) {
  const words = text.split(/\s+/);
  const average = size * 0.53;
  const maxChars = Math.max(12, Math.floor(width / average));
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}">${lines.slice(0, maxLines).map((lineItem, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size * lineHeight}">${escapeXml(lineItem)}</tspan>`).join("")}</text>`;
}

async function imageBuffer(relativePath, width, height) {
  return sharp(join(assetRoot, relativePath)).resize(width, height, { fit: "cover" }).png().toBuffer();
}

async function masterBoard() {
  const width = 1800;
  const margin = 70;
  const gap = 20;
  const cardWidth = Math.floor((width - margin * 2 - gap * 2) / 3);
  const imageHeight = Math.round(cardWidth * 9 / 16);
  const cardHeight = imageHeight + 63;
  const headerHeight = 230;
  const sectionGap = 80;
  const sections = [
    { title: "EXTERIOR", assets: visualAssets.slice(0, 6) },
    { title: "TAGRENDER OG NEDLØB", assets: visualAssets.slice(6, 10) },
    { title: "VÅDRUM", assets: visualAssets.slice(10, 15) }
  ];
  let totalHeight = headerHeight + margin;
  for (const section of sections) totalHeight += 40 + Math.ceil(section.assets.length / 3) * cardHeight + sectionGap;
  totalHeight -= sectionGap;

  const composites = [{ input: svg(width, totalHeight, `<rect width="100%" height="100%" fill="#09131a"/><rect width="100%" height="${headerHeight}" fill="#0c1a20"/>${textBlock({ x: margin, y: 72, width: 1500, text: "HOUSE A · HISTORICAL PILOT BOARD", size: 18, color: "#cfac78", weight: 700 })}${textBlock({ x: margin, y: 135, width: 1600, text: "MATRIVA MODERN 2023 – SUPERSEDED PILOT REFERENCES", size: 46, color: "#ffffff", weight: 700 })}${textBlock({ x: margin, y: 180, width: 1600, text: "A01 er den eneste nuværende godkendte visuelle/materialemæssige reference. A02–A15 er bevaret pilotmateriale og afvist til canonical brug.", size: 21, color: "#d3dcda" })}`), left: 0, top: 0 }];
  let y = headerHeight + 30;

  for (const section of sections) {
    composites.push({ input: svg(width, 45, textBlock({ x: margin, y: 30, width: 1200, text: section.title, size: 21, color: "#cfac78", weight: 700 })), left: 0, top: y });
    y += 45;
    for (const [index, asset] of section.assets.entries()) {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = margin + column * (cardWidth + gap);
      const top = y + row * cardHeight;
      composites.push({ input: await imageBuffer(asset.sourcePath, cardWidth, imageHeight), left: x, top });
      const statusLabel = asset.approvalStatus === "approved"
        ? "APPROVED VISUAL REFERENCE"
        : asset.approvalStatus === "superseded"
          ? "PILOT · SUPERSEDED · REJECTED CANONICAL"
          : "PILOT · NOT FINAL GUIDE STANDARD";
      composites.push({ input: svg(cardWidth, 63, `<rect width="100%" height="100%" fill="#121f25"/>${textBlock({ x: 15, y: 23, width: cardWidth - 30, text: `${asset.id.replace("gasset_ma23_", "").toUpperCase()} · ${statusLabel}`, size: 13, color: "#cfac78", weight: 700, maxLines: 2 })}${textBlock({ x: 15, y: 46, width: cardWidth - 30, text: asset.altText, size: 14, color: "#e5e9e6", maxLines: 1 })}`), left: x, top: top + imageHeight });
    }
    y += Math.ceil(section.assets.length / 3) * cardHeight + sectionGap;
  }

  await sharp({ create: { width, height: totalHeight, channels: 4, background: "#09131a" } })
    .composite(composites)
    .png()
    .toFile(join(previewRoot, "approved-master-references-v1.png"));
}

async function gutterGuidePreview() {
  const width = 1200;
  const margin = 70;
  const contentWidth = width - margin * 2;
  const heroHeight = Math.round(contentWidth * 9 / 16);
  const stepHeight = Math.round(contentWidth * 9 / 16);
  const headerHeight = 290;
  const height = headerHeight + heroHeight + 245 + 590 + 4 * (stepHeight + 190) + 360;
  const composites = [
    { input: svg(width, height, `<rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="${headerHeight}" fill="#0c1a20"/>${textBlock({ x: margin, y: 58, width: 1050, text: "MATRIVA GUIDE · PILOTOUTPUT · IKKE ENDELIG VISUEL STANDARD", size: 16, color: "#cfac78", weight: 700 })}${textBlock({ x: margin, y: 139, width: 900, text: "Rens tagrender", size: 64, color: "#ffffff", weight: 700 })}${textBlock({ x: margin, y: 192, width: 900, text: "En sikker gennemgang af tagrender og nedløb, så regnvand kan ledes væk fra huset.", size: 22, color: "#d3dcda" })}`), left: 0, top: 0 }
  ];
  let y = headerHeight;
  composites.push({ input: await imageBuffer("masters/a06-exterior-rear-v1.png", contentWidth, heroHeight), left: margin, top: y });
  y += heroHeight + 48;
  composites.push({ input: svg(width, 180, `${textBlock({ x: margin, y: 28, width: contentWidth, text: "Rensning af tagrender er enkel, men vigtig vedligeholdelse. Gør kun arbejdet, hvis du kan komme sikkert til fra jorden eller et stabilt arbejdssted.", size: 24, color: "#172020", lineHeight: 1.4 })}<rect x="${margin}" y="112" width="${contentWidth}" height="52" rx="8" fill="#edf2ef"/>${textBlock({ x: margin + 18, y: 142, width: contentWidth - 36, text: "CA. 60 MIN.     ·     MIDDEL     ·     FORÅR OG EFTERÅR", size: 16, color: "#385348", weight: 700 })}`), left: 0, top: y });
  y += 220;
  composites.push({ input: svg(width, 190, `${textBlock({ x: margin, y: 34, width: contentWidth, text: "Værktøj og forberedelse", size: 30, color: "#172020", weight: 700 })}<rect x="${margin}" y="57" width="${contentWidth}" height="100" rx="10" fill="#edf2ef"/>${textBlock({ x: margin + 20, y: 92, width: contentWidth - 40, text: "Arbejdshandsker · stabil stige eller andet sikkert arbejdsudstyr · lille spand eller pose · haveslange, hvis skylning kan ske sikkert.", size: 18, color: "#385348" })}`), left: 0, top: y });
  y += 190;
  composites.push({ input: svg(width, 330, `${textBlock({ x: margin, y: 34, width: contentWidth, text: "Hvorfor det er vigtigt", size: 34, color: "#172020", weight: 700 })}${textBlock({ x: margin, y: 79, width: contentWidth, text: "Blade, mos og snavs kan holde vand tilbage. Overløb kan belaste facade, sokkel og arealer tæt ved huset. En visuel kontrol kan opdage løse beslag og utætte samlinger tidligt.", size: 20, color: "#33413d" })}<rect x="${margin}" y="212" width="${contentWidth}" height="94" rx="10" fill="#f5ead7"/>${textBlock({ x: margin + 20, y: 246, width: contentWidth - 40, text: "SIKKERHED FØRST", size: 16, color: "#79552b", weight: 700 })}${textBlock({ x: margin + 20, y: 275, width: contentWidth - 40, text: "Arbejd ikke på våd, glat eller ustabil stige. Stop, hvis adgangsforholdene føles usikre.", size: 17, color: "#493d2e" })}`), left: 0, top: y });
  y += 350;
  const steps = [
    { title: "1. Fjern blade og snavs", path: "guides/rens-tagrender/g02-problem-debris-v1.png", note: "1   Blade og snavs – læg materialet i en spand eller pose i stedet for at flytte blokeringen." },
    { title: "2. Rens arbejdsområdet", path: "guides/rens-tagrender/g03-cleaning-v1.png", note: "Arbejd roligt med handsker fra et stabilt arbejdssted." },
    { title: "3. Skyl og kontrollér vandets vej", path: "guides/rens-tagrender/g04-flow-check-v1.png", note: "2   Kontrollér faldet     3   Kontrollér samlingen     4   Tjek nedløbet" },
    { title: "4. Kontrollér resultatet", path: "guides/rens-tagrender/g05-correct-result-v1.png", note: "Resultat: ren rende, synlig vandvej og frit nedløb." }
  ];
  for (const step of steps) {
    composites.push({ input: svg(width, 54, textBlock({ x: margin, y: 34, width: contentWidth, text: step.title, size: 29, color: "#172020", weight: 700 })), left: 0, top: y });
    y += 54;
    composites.push({ input: await imageBuffer(step.path, contentWidth, stepHeight), left: margin, top: y });
    y += stepHeight + 14;
    composites.push({ input: svg(width, 110, `<rect x="${margin}" y="0" width="${contentWidth}" height="96" rx="8" fill="#0c1a20"/>${textBlock({ x: margin + 18, y: 34, width: contentWidth - 36, text: step.note, size: 17, color: "#ffffff", weight: 500, lineHeight: 1.4 })}`), left: 0, top: y });
    y += 126;
  }
  composites.push({ input: svg(width, 280, `${textBlock({ x: margin, y: 35, width: contentWidth, text: "Færdig?", size: 34, color: "#172020", weight: 700 })}<rect x="${margin}" y="60" width="${contentWidth}" height="102" rx="10" fill="#eff6f0"/>${textBlock({ x: margin + 20, y: 94, width: contentWidth - 40, text: "Tagrende og nedløb er fri for synligt løst materiale. Vandet bevæger sig mod nedløbet uden at løbe over.", size: 18, color: "#244b36" })}${textBlock({ x: margin, y: 211, width: contentWidth, text: "Hvornår bør du få hjælp?", size: 28, color: "#172020", weight: 700 })}${textBlock({ x: margin, y: 247, width: contentWidth, text: "Ved synlige skader, tilbagevendende blokeringer eller vand, der bliver stående efter rensning.", size: 18, color: "#33413d" })}`), left: 0, top: y });

  await sharp({ create: { width, height, channels: 4, background: "#ffffff" } })
    .composite(composites)
    .png()
    .toFile(join(previewRoot, "rens-tagrender-visual-preview-v2.png"));
}

await mkdir(previewRoot, { recursive: true });
if (!process.argv.includes("--guide-only")) {
  await masterBoard();
}
await gutterGuidePreview();
console.log("Rendered the Rens tagrender pilot preview and, unless --guide-only was used, the superseded House A pilot board.");
