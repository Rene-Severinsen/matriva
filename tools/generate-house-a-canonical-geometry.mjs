import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(projectRoot, "docs", "product", "house-a-canonical-geometry.json");
const defaultOutput = join(projectRoot, "docs", "product", "house-a-canonical-geometry");
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex === -1 ? defaultOutput : resolve(process.argv[outputIndex + 1] ?? defaultOutput);

const model = JSON.parse(await readFile(sourcePath, "utf8"));
const colors = {
  ink: "#172020",
  muted: "#53635d",
  line: "#98a5a0",
  grid: "#dfe6e2",
  paper: "#fbfcfa",
  panel: "#f0f4f1",
  accent: "#bd7d32",
  warning: "#9f4a20",
  roof: "#20282c",
  roofLine: "#66757a",
  opening: "#256b87",
  siteGreen: "#dce9d7",
  hedge: "#5f8061",
  paving: "#d8d8d4"
};

function assert(condition, message) {
  if (!condition) throw new Error(`House A canonical geometry invalid: ${message}`);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function f(value) {
  return Number(value.toFixed(2));
}

function svgDocument(title, width, height, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">\n<title id="title">${escapeXml(title)}</title><desc id="description">Deterministic technical drawing derived from House A canonical geometry JSON.</desc>\n<style>text{font-family:Arial,sans-serif}.title{font-size:28px;font-weight:700;fill:${colors.ink}}.subtitle{font-size:15px;fill:${colors.muted}}.label{font-size:13px;fill:${colors.ink}}.small{font-size:11px;fill:${colors.muted}}.dim{font-size:12px;fill:${colors.muted}}.tablehead{font-size:12px;font-weight:700;fill:#fff}.cell{font-size:12px;fill:${colors.ink}}</style>\n<rect width="100%" height="100%" fill="${colors.paper}"/>${body}\n</svg>\n`;
}

function titleBlock(title, subtitle, width) {
  return `<text class="title" x="50" y="46">${escapeXml(title)}</text><text class="subtitle" x="50" y="72">${escapeXml(subtitle)}</text><line x1="50" y1="92" x2="${width - 50}" y2="92" stroke="${colors.grid}"/>`;
}

function approvalBanner(width, y) {
  return `<rect x="50" y="${y}" width="${width - 100}" height="32" rx="4" fill="#e9f3e9" stroke="#9ebfa0"/><text x="64" y="${y + 21}" font-size="12" font-weight="700" fill="#2f6736">APPROVED CURRENT SOURCE OF TRUTH · future changes begin in this canonical model, never in a derived image.</text>`;
}

function rect(x, y, width, height, attributes = "") {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(height)}" ${attributes}/>`;
}

function line(x1, y1, x2, y2, attributes = "") {
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${attributes}/>`;
}

function polygon(points, attributes = "") {
  return `<polygon points="${points.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" ${attributes}/>`;
}

function roomPoints(room) {
  if (room.polygon) return room.polygon;
  return [[room.x, room.y], [room.x + room.widthMm, room.y], [room.x + room.widthMm, room.y + room.depthMm], [room.x, room.y + room.depthMm]];
}

function roomCentre(room) {
  if (!room.polygon) return [room.x + room.widthMm / 2, room.y + room.depthMm / 2];
  const points = room.polygon;
  return [points.reduce((total, point) => total + point[0], 0) / points.length, points.reduce((total, point) => total + point[1], 0) / points.length];
}

function openingTouchesAssignedRoom(opening, room) {
  if (room.polygon) return false;
  const openingStart = opening.offsetMm;
  const openingEnd = opening.offsetMm + opening.widthMm;
  if (opening.facade === "front") return room.y === 0 && openingStart >= room.x && openingEnd <= room.x + room.widthMm;
  if (opening.facade === "rear") return room.y + room.depthMm === model.footprint.depthMm && openingStart >= room.x && openingEnd <= room.x + room.widthMm;
  if (opening.facade === "left") return room.x === 0 && openingStart >= room.y && openingEnd <= room.y + room.depthMm;
  return room.x + room.widthMm === model.footprint.widthMm && openingStart >= room.y && openingEnd <= room.y + room.depthMm;
}

function validate() {
  const { footprint, garage, roof, openings, rooms, levels } = model;
  assert(model.status === "approved_current_source_of_truth", "status must identify the approved current source of truth");
  assert(footprint.corners.length === 4, "footprint must have four corners");
  assert(footprint.corners[0].x === 0 && footprint.corners[0].y === 0, "C01 must be origin");
  assert(footprint.corners[2].x === footprint.widthMm && footprint.corners[2].y === footprint.depthMm, "C03 must match footprint extent");
  assert(garage.x === 0 && garage.y === 0, "garage must remain at the front-west footprint corner");
  assert(garage.widthMm <= footprint.widthMm && garage.depthMm <= footprint.depthMm, "garage must fit footprint");
  assert(Math.abs((footprint.areaM2 - garage.areaM2) - model.dwellingAreaM2) < 0.01, "dwelling area must equal footprint area minus garage area");
  assert(levels.ridgeMm > levels.eavesMm && levels.roofPitchDegrees > 0, "ridge must be above eaves with positive pitch");
  const minRoofX = -roof.overhangMm;
  const maxRoofX = footprint.widthMm + roof.overhangMm;
  const minRoofY = -roof.overhangMm;
  const maxRoofY = footprint.depthMm + roof.overhangMm;
  assert(roof.eavesOutline.length === 4, "roof must have one four-corner eaves outline");
  assert(roof.ridge.start.y === roof.ridge.end.y, "ridge must be east-west");
  assert(roof.ridge.start.x > minRoofX && roof.ridge.end.x < maxRoofX, "ridge must be inside roof eaves");
  assert(roof.ridge.start.y > minRoofY && roof.ridge.start.y < maxRoofY, "ridge must be inside roof eaves");
  const expectedRidgeLength = (maxRoofX - minRoofX) - (maxRoofY - minRoofY);
  assert(Math.abs((roof.ridge.end.x - roof.ridge.start.x) - expectedRidgeLength) < 0.01, "ridge length must derive from hipped roof eaves dimensions");
  const ids = new Set();
  for (const opening of openings) {
    assert(!ids.has(opening.id), `duplicate opening ID ${opening.id}`);
    ids.add(opening.id);
    const room = rooms.find((candidate) => candidate.id === opening.roomId);
    assert(room, `${opening.id} references a known room`);
    const wallLength = opening.facade === "front" || opening.facade === "rear" ? footprint.widthMm : footprint.depthMm;
    assert(["front", "rear", "left", "right"].includes(opening.facade), `${opening.id} has a valid facade`);
    assert(opening.offsetMm >= 0 && opening.offsetMm + opening.widthMm <= wallLength, `${opening.id} fits its facade`);
    assert(opening.heightMm + opening.sillMm <= levels.eavesMm, `${opening.id} fits below eaves`);
    assert(openingTouchesAssignedRoom(opening, room), `${opening.id} must touch the assigned room on its listed exterior facade`);
  }
  for (const room of rooms) {
    for (const [x, y] of roomPoints(room)) {
      assert(x >= 0 && x <= footprint.widthMm && y >= 0 && y <= footprint.depthMm, `${room.id} must remain inside footprint`);
    }
  }
  for (const downpipe of roof.downpipes) {
    assert(downpipe.x >= minRoofX && downpipe.x <= maxRoofX && downpipe.y >= minRoofY && downpipe.y <= maxRoofY, `${downpipe.id} must be on roof extent`);
  }
  assert(model.site.houseOrigin.x + footprint.widthMm <= model.site.boundary.widthMm, "site plan must contain house width");
  assert(model.site.houseOrigin.y + footprint.depthMm <= model.site.boundary.depthMm, "site plan must contain house depth");
}

function dimensions(x, y, width, height, labelX, labelY) {
  return `${line(x, y, x + width, y, `stroke="${colors.muted}" stroke-width="1" marker-start="url(#arrow)" marker-end="url(#arrow)"`)}<text class="dim" x="${x + width / 2}" y="${y - 7}" text-anchor="middle">${labelX}</text>${line(x, y, x, y + height, `stroke="${colors.muted}" stroke-width="1" marker-start="url(#arrow)" marker-end="url(#arrow)"`)}<text class="dim" x="${x - 9}" y="${y + height / 2}" text-anchor="middle" transform="rotate(-90 ${x - 9} ${y + height / 2})">${labelY}</text>`;
}

const arrowDefs = `<defs><marker id="arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="${colors.muted}"/></marker></defs>`;

function floorPlanBody({ x = 110, y = 165, scale = 0.04, showDimensions = true, labelSize = 13 } = {}) {
  const { footprint, rooms, openings } = model;
  const tx = (value) => x + value * scale;
  const ty = (value) => y + (footprint.depthMm - value) * scale;
  let body = rect(x, y, footprint.widthMm * scale, footprint.depthMm * scale, `fill="#fff" stroke="${colors.ink}" stroke-width="3"`);
  for (const room of rooms) {
    const points = roomPoints(room).map(([px, py]) => [tx(px), ty(py)]);
    body += polygon(points, `fill="${room.color}" stroke="${colors.ink}" stroke-width="1.4"`);
    const [cx, cy] = roomCentre(room);
    body += `<text x="${tx(cx)}" y="${ty(cy)}" text-anchor="middle" font-size="${labelSize}" font-weight="700" fill="${colors.ink}">${escapeXml(room.label)}</text>`;
  }
  for (const opening of openings) {
    const stroke = opening.type.includes("door") ? "#a14d21" : colors.opening;
    if (opening.facade === "front") body += line(tx(opening.offsetMm), ty(0), tx(opening.offsetMm + opening.widthMm), ty(0), `stroke="${stroke}" stroke-width="6"`);
    if (opening.facade === "rear") body += line(tx(opening.offsetMm), ty(footprint.depthMm), tx(opening.offsetMm + opening.widthMm), ty(footprint.depthMm), `stroke="${stroke}" stroke-width="6"`);
    if (opening.facade === "left") body += line(tx(0), ty(opening.offsetMm), tx(0), ty(opening.offsetMm + opening.widthMm), `stroke="${stroke}" stroke-width="6"`);
    if (opening.facade === "right") body += line(tx(footprint.widthMm), ty(opening.offsetMm), tx(footprint.widthMm), ty(opening.offsetMm + opening.widthMm), `stroke="${stroke}" stroke-width="6"`);
  }
  if (showDimensions) {
    body += dimensions(x, y + footprint.depthMm * scale + 35, footprint.widthMm * scale, 0, `${(footprint.widthMm / 1000).toFixed(1)} m overall`, "");
    body += `${line(x - 35, y, x, y, `stroke="${colors.muted}"`)}${line(x - 35, y + footprint.depthMm * scale, x, y + footprint.depthMm * scale, `stroke="${colors.muted}"`)}${dimensions(x - 35, y, 0, footprint.depthMm * scale, "", `${(footprint.depthMm / 1000).toFixed(1)} m overall`)}`;
  }
  return body;
}

function floorPlan() {
  const width = 1120;
  const height = 850;
  const subtitle = `Coordinate system: origin C01 at front-west. Footprint ${model.footprint.widthMm / 1000} m × ${model.footprint.depthMm / 1000} m · dwelling layout ${model.dwellingAreaM2.toFixed(2)} m² + garage ${model.garage.areaM2.toFixed(2)} m².`;
  const legend = `<rect x="750" y="165" width="320" height="225" rx="8" fill="${colors.panel}" stroke="${colors.grid}"/><text class="label" x="770" y="192" font-weight="700">KEY</text><text class="small" x="770" y="218">Blue = window / glazed opening</text><text class="small" x="770" y="240">Brown = external door</text><text class="small" x="770" y="272">C01–C04 = immutable footprint corners</text><text class="small" x="770" y="294">Garage = GARAGE_01 only</text><text class="small" x="770" y="326">Room dimensions are approved</text><text class="small" x="770" y="348">canonical design data.</text>`;
  return svgDocument("House A dimensioned floor plan", width, height, `${arrowDefs}${titleBlock("01 · DIMENSIONED FLOOR PLAN", subtitle, width)}${approvalBanner(width, 108)}${floorPlanBody()}${legend}<text class="small" x="110" y="760">FRONT / SOUTH ↓</text><text class="small" x="110" y="780">External dimensions shown; wall thicknesses and internal door swings are deliberately out of scope for this canonical reference.</text>`);
}

function roofPlanBody({ x = 110, y = 165, scale = 0.04, labels = true } = {}) {
  const { footprint, roof } = model;
  const tx = (value) => x + (value + roof.overhangMm) * scale;
  const ty = (value) => y + (footprint.depthMm + roof.overhangMm - value) * scale;
  const outerWidth = (footprint.widthMm + roof.overhangMm * 2) * scale;
  const outerHeight = (footprint.depthMm + roof.overhangMm * 2) * scale;
  const centreY = ty(roof.ridge.start.y);
  const eaveLeft = tx(-roof.overhangMm);
  const eaveRight = tx(footprint.widthMm + roof.overhangMm);
  const eaveTop = ty(footprint.depthMm + roof.overhangMm);
  const eaveBottom = ty(-roof.overhangMm);
  const ridgeStart = [tx(roof.ridge.start.x), centreY];
  const ridgeEnd = [tx(roof.ridge.end.x), centreY];
  let body = rect(eaveLeft, eaveTop, outerWidth, outerHeight, `fill="${colors.roof}" stroke="${colors.ink}" stroke-width="3"`);
  body += polygon([[eaveLeft, eaveTop], [eaveRight, eaveTop], ridgeEnd, ridgeStart], `fill="#29343a" stroke="${colors.roofLine}" stroke-width="1"`);
  body += polygon([[eaveLeft, eaveBottom], [eaveRight, eaveBottom], ridgeEnd, ridgeStart], `fill="#1a2226" stroke="${colors.roofLine}" stroke-width="1"`);
  body += line(eaveLeft, eaveTop, ridgeStart[0], ridgeStart[1], `stroke="${colors.roofLine}"`);
  body += line(eaveRight, eaveTop, ridgeEnd[0], ridgeEnd[1], `stroke="${colors.roofLine}"`);
  body += line(eaveLeft, eaveBottom, ridgeStart[0], ridgeStart[1], `stroke="${colors.roofLine}"`);
  body += line(eaveRight, eaveBottom, ridgeEnd[0], ridgeEnd[1], `stroke="${colors.roofLine}"`);
  body += line(ridgeStart[0], ridgeStart[1], ridgeEnd[0], ridgeEnd[1], `stroke="#d5e0e2" stroke-width="4"`);
  for (const pipe of roof.downpipes) {
    body += `<circle cx="${tx(pipe.x)}" cy="${ty(pipe.y)}" r="6" fill="${colors.accent}" stroke="#fff" stroke-width="1.5"/>`;
    if (labels) body += `<text class="small" x="${tx(pipe.x) + 10}" y="${ty(pipe.y) - 8}">${pipe.id}</text>`;
  }
  if (labels) {
    body += `<text class="label" x="${(ridgeStart[0] + ridgeEnd[0]) / 2}" y="${centreY - 10}" text-anchor="middle" fill="#fff">RIDGE · ${(roof.ridge.end.x - roof.ridge.start.x) / 1000} m · east–west</text>`;
    body += `<text class="small" x="${eaveLeft + 14}" y="${eaveTop + 23}" fill="#fff">25° hipped roof · 450 mm continuous eaves</text>`;
  }
  return body;
}

function roofPlan() {
  const width = 1120;
  const height = 830;
  const roof = model.roof;
  return svgDocument("House A roof plan", width, height, `${titleBlock("02 · CANONICAL ROOF PLAN", "One symmetrical hipped roof: mathematically derived ridge, eaves, gutters and four downpipes.", width)}${approvalBanner(width, 108)}${roofPlanBody()}<rect x="750" y="165" width="320" height="195" rx="8" fill="${colors.panel}" stroke="${colors.grid}"/><text class="label" x="770" y="194" font-weight="700">ROOF CONTRACT</text><text class="small" x="770" y="220">Pitch: ${model.levels.roofPitchDegrees}°</text><text class="small" x="770" y="242">Eaves: ${model.levels.eavesMm} mm above FFL</text><text class="small" x="770" y="264">Ridge: ${model.levels.ridgeMm} mm above FFL</text><text class="small" x="770" y="286">Gutter: continuous black perimeter</text><text class="small" x="770" y="308">No chimney, dormer, roof window</text><text class="small" x="770" y="330">or unlisted penetration.</text><text class="small" x="110" y="746">The outer roof is the same 16.4 m × 12.0 m footprint with a fixed 450 mm eaves projection. Orange points are fixed downpipes.</text>`);
}

function elevationBody(facade, { x = 95, ground = 475, scale = 0.04, labelOpenings = true } = {}) {
  const frontRear = facade === "front" || facade === "rear";
  const axisLength = frontRear ? model.footprint.widthMm : model.footprint.depthMm;
  const wallHeight = model.levels.eavesMm * scale;
  const roofRise = (model.levels.ridgeMm - model.levels.eavesMm) * scale;
  const width = axisLength * scale;
  const wallTop = ground - wallHeight;
  const hipStart = frontRear ? model.roof.ridge.start.x * scale : width / 2;
  const hipEnd = frontRear ? model.roof.ridge.end.x * scale : width / 2;
  let body = line(x, ground, x + width, ground, `stroke="${colors.ink}" stroke-width="2"`);
  body += rect(x, wallTop, width, wallHeight, `fill="#f2ecdf" stroke="${colors.ink}" stroke-width="2"`);
  body += polygon([[x, wallTop], [x + width, wallTop], [x + hipEnd, wallTop - roofRise], [x + hipStart, wallTop - roofRise]], `fill="${colors.roof}" stroke="${colors.ink}" stroke-width="2"`);
  body += line(x + hipStart, wallTop - roofRise, x + hipEnd, wallTop - roofRise, `stroke="#cbd7da" stroke-width="2" stroke-dasharray="5 4"`);
  const openings = model.openings.filter((opening) => opening.facade === facade);
  for (const opening of openings) {
    const left = x + opening.offsetMm * scale;
    const top = ground - (opening.sillMm + opening.heightMm) * scale;
    const height = opening.heightMm * scale;
    const fill = opening.type.includes("door") ? "#30363a" : "#a9c9d8";
    body += rect(left, top, opening.widthMm * scale, height, `fill="${fill}" stroke="${colors.ink}" stroke-width="1.3"`);
    if (labelOpenings) body += `<text class="small" x="${left + opening.widthMm * scale / 2}" y="${top - 7}" text-anchor="middle">${opening.id}</text>`;
  }
  body += `<text class="small" x="${x}" y="${ground + 26}">${facade.toUpperCase()} · ${axisLength / 1000} m facade span</text>`;
  return body;
}

function elevation(facade, number, label) {
  const width = 1120;
  const height = 680;
  const facadeOpenings = model.openings.filter((opening) => opening.facade === facade);
  return svgDocument(`House A ${label} elevation`, width, height, `${titleBlock(`${number} · ${label.toUpperCase()} ELEVATION`, `${facadeOpenings.length} stable openings derived from the canonical floor plan. Dark roof, pale brick and black frames are visual intent from A01.`, width)}${approvalBanner(width, 108)}${elevationBody(facade)}<rect x="770" y="170" width="300" height="190" rx="8" fill="${colors.panel}" stroke="${colors.grid}"/><text class="label" x="790" y="198" font-weight="700">ELEVATION RULES</text><text class="small" x="790" y="225">Eaves: ${model.levels.eavesMm} mm</text><text class="small" x="790" y="247">Ridge: ${model.levels.ridgeMm} mm</text><text class="small" x="790" y="269">Roof pitch: ${model.levels.roofPitchDegrees}°</text><text class="small" x="790" y="291">All opening IDs, offsets,</text><text class="small" x="790" y="313">sizes and sills are immutable</text><text class="small" x="790" y="335">unless this source JSON changes.</text><text class="small" x="95" y="585">This is an architectural reference elevation, not a construction drawing: exact brick module, lintels, wall build-up and structural detailing are intentionally unspecified.</text>`);
}

function table(headers, rows, widths, x, y, rowHeight = 36) {
  let body = "";
  let cursor = x;
  headers.forEach((header, index) => {
    body += rect(cursor, y, widths[index], rowHeight, `fill="${colors.ink}"`);
    body += `<text class="tablehead" x="${cursor + 8}" y="${y + 23}">${escapeXml(header)}</text>`;
    cursor += widths[index];
  });
  rows.forEach((row, rowIndex) => {
    cursor = x;
    const rowY = y + rowHeight * (rowIndex + 1);
    row.forEach((cell, index) => {
      body += rect(cursor, rowY, widths[index], rowHeight, `fill="${rowIndex % 2 ? "#f5f7f5" : "#fff"}" stroke="${colors.grid}"`);
      body += `<text class="cell" x="${cursor + 8}" y="${rowY + 23}">${escapeXml(cell)}</text>`;
      cursor += widths[index];
    });
  });
  return body;
}

function openingSchedule() {
  const width = 1600;
  const rows = model.openings.map((opening) => [opening.id, opening.facade, `${opening.offsetMm}`, `${opening.widthMm} × ${opening.heightMm}`, `${opening.sillMm}`, opening.type.replaceAll("_", " "), model.rooms.find((room) => room.id === opening.roomId).label]);
  const headers = ["Opening ID", "Facade", "Offset", "W × H (mm)", "Sill", "Type", "Room behind"];
  const widths = [270, 90, 110, 150, 85, 210, 350];
  return svgDocument("House A opening schedule", width, 760, `${titleBlock("07 · OPENING / WINDOW SCHEDULE", "Offsets follow the coordinate system in the JSON: front/rear from west; left/right from south. Values are approved canonical design data.", width)}${approvalBanner(width, 108)}${table(headers, rows, widths, 50, 165, 39)}<text class="small" x="50" y="708">Opening identity is canonical: a later view may change weather, light, furniture styling or camera position, but never an opening's facade, offset, width, height, sill or room mapping.</text>`);
}

function roomVisibility() {
  const width = 1600;
  const rows = model.openings.map((opening) => [opening.id, model.rooms.find((room) => room.id === opening.roomId).label, opening.visible.join(" · ")]);
  const headers = ["Opening", "Room behind opening", "Allowed visible interior elements"];
  const widths = [300, 300, 900];
  const body = table(headers, rows, widths, 50, 510, 44);
  return svgDocument("House A room and interior visibility map", width, 1120, `${titleBlock("08 · ROOM MAP + INTERIOR VISIBILITY MAP", "Each exterior opening has one room assignment and a deliberately domestic visibility contract.", width)}${approvalBanner(width, 108)}${floorPlanBody({ x: 50, y: 170, scale: 0.03, showDimensions: false, labelSize: 10 })}<rect x="600" y="170" width="950" height="250" rx="8" fill="${colors.panel}" stroke="${colors.grid}"/><text class="label" x="625" y="200" font-weight="700">INTERIOR CONSISTENCY CONTRACT</text><text class="small" x="625" y="228">Kitchen / alrum may show an island, dining table and pendants only through its assigned openings.</text><text class="small" x="625" y="254">Living room may show sofa-led furnishing only through REAR_SLIDER_02 and RIGHT_WINDOW_02.</text><text class="small" x="625" y="280">Bedrooms remain bedroom-scale; garage stays non-domestic. No repeated dining set across multiple rooms.</text><text class="small" x="625" y="306">Future renders must be rejected if visible furniture conflicts with this map or makes the home read as a hall, restaurant, hotel or showroom.</text>${body}`);
}

function sitePlan() {
  const width = 1500;
  const height = 1080;
  const scale = 0.032;
  const { boundary, houseOrigin, driveway, frontPath, terrace, planting } = model.site;
  const sx = (value) => 100 + value * scale;
  const sy = (value) => 180 + (boundary.depthMm - value) * scale;
  let body = rect(100, 180, boundary.widthMm * scale, boundary.depthMm * scale, `fill="${colors.siteGreen}" stroke="${colors.ink}" stroke-width="2"`);
  body += rect(sx(driveway.x), sy(driveway.y + driveway.depthMm), driveway.widthMm * scale, driveway.depthMm * scale, `fill="${colors.paving}" stroke="#9da19e"`);
  body += rect(sx(frontPath.x), sy(frontPath.y + frontPath.depthMm), frontPath.widthMm * scale, frontPath.depthMm * scale, `fill="${colors.paving}" stroke="#9da19e"`);
  body += rect(sx(terrace.x), sy(terrace.y + terrace.depthMm), terrace.widthMm * scale, terrace.depthMm * scale, `fill="${colors.paving}" stroke="#9da19e"`);
  body += rect(sx(houseOrigin.x), sy(houseOrigin.y + model.footprint.depthMm), model.footprint.widthMm * scale, model.footprint.depthMm * scale, `fill="#f2ecdf" stroke="${colors.ink}" stroke-width="3"`);
  body += `<text class="label" x="${sx(houseOrigin.x + 8200)}" y="${sy(houseOrigin.y + 6000)}" text-anchor="middle">HOUSE A · 16.4 × 12.0 m</text>`;
  for (const item of planting) {
    if (item.radiusMm) {
      body += `<circle cx="${sx(item.x)}" cy="${sy(item.y)}" r="${item.radiusMm * scale}" fill="#789b70" stroke="#4d764e"/>`;
      body += `<text class="small" x="${sx(item.x) + 8}" y="${sy(item.y) - 8}">${item.id}</text>`;
    } else {
      body += rect(sx(item.x), sy(item.y + item.depthMm), item.widthMm * scale, item.depthMm * scale, `rx="14" fill="#a6c589" stroke="#739d65"`);
      body += `<text class="small" x="${sx(item.x) + 8}" y="${sy(item.y + item.depthMm / 2)}">${item.id}</text>`;
    }
  }
  body += `<rect x="100" y="180" width="${boundary.widthMm * scale}" height="${boundary.depthMm * scale}" fill="none" stroke="${colors.hedge}" stroke-width="12"/>`;
  body += `<text class="small" x="100" y="${180 + boundary.depthMm * scale + 28}">FRONT / SOUTH</text><text class="small" x="${100 + boundary.widthMm * scale - 110}" y="${180 - 16}">REAR / NORTH</text>`;
  const legend = `<rect x="1110" y="180" width="340" height="355" rx="8" fill="${colors.panel}" stroke="${colors.grid}"/><text class="label" x="1135" y="210" font-weight="700">CANONICAL SITE ELEMENTS</text><text class="small" x="1135" y="240">Grey: driveway, front path, terrace</text><text class="small" x="1135" y="268">Green edge: mixed perimeter hedge</text><text class="small" x="1135" y="296">BED_01 / BED_02: varied perennial,</text><text class="small" x="1135" y="316">ornamental-grass and shrub planting</text><text class="small" x="1135" y="344">TREE_01 / TREE_02: fixed tree locations</text><text class="small" x="1135" y="372">Seasonal growth and planting mix may vary;</text><text class="small" x="1135" y="392">permanent spatial positions may not.</text><text class="small" x="1135" y="432">No repeated spherical-shrub pattern.</text><text class="small" x="1135" y="462">Approved canonical site decision.</text>`;
  return svgDocument("House A site plan", width, height, `${titleBlock("09 · CANONICAL SITE / LANDSCAPE PLAN", "Simple, stable site geometry for consistent later views; planting remains varied and natural rather than repetitive.", width)}${approvalBanner(width, 108)}${body}${legend}<text class="small" x="100" y="1015">Site boundary: ${boundary.widthMm / 1000} m × ${boundary.depthMm / 1000} m · house origin: ${houseOrigin.x / 1000} m east, ${houseOrigin.y / 1000} m north of site south-west corner.</text>`);
}

function materialsAndRules() {
  const width = 1600;
  const materialRows = model.materials.map((material) => [material.element, material.visualSpecification, material.source, material.physicalProduct]);
  const materialTable = table(["Element", "Visual specification", "Source / authority", "Product / build-up"], materialRows, [220, 390, 480, 350], 50, 170, 43);
  let rules = `<text class="label" x="50" y="485" font-weight="700">IMMUTABLE GEOMETRY RULES</text>`;
  model.immutableGeometryRules.forEach((rule, index) => {
    const y = 520 + index * 67;
    rules += `<circle cx="68" cy="${y - 4}" r="12" fill="${colors.ink}"/><text x="68" y="${y}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${index + 1}</text><text class="label" x="92" y="${y}">${escapeXml(rule)}</text>`;
  });
  return svgDocument("House A materials and immutable geometry rules", width, 1030, `${titleBlock("10 · MATERIAL SPECIFICATION + IMMUTABLE RULES", "A01 is the visual/material authority only. Manufacturer choices remain unspecified; geometry is approved canonical source data.", width)}${approvalBanner(width, 108)}${materialTable}${rules}`);
}

function referenceBoard() {
  const width = 1800;
  const height = 1420;
  const miniElevations = [
    ["front", "FRONT"], ["rear", "REAR"], ["left", "LEFT"], ["right", "RIGHT"]
  ].map(([facade, label], index) => `<g transform="translate(${65 + (index % 2) * 430},${810 + Math.floor(index / 2) * 220}) scale(.55)">${elevationBody(facade, { x: 0, ground: 250, scale: 0.032, labelOpenings: false })}<text class="label" x="0" y="285">${label}</text></g>`).join("");
  const summary = `<rect x="1190" y="165" width="555" height="555" rx="12" fill="${colors.panel}" stroke="${colors.grid}"/><text class="label" x="1220" y="202" font-size="18" font-weight="700">CANONICAL CONTRACT</text><text class="small" x="1220" y="236">Source file: docs/product/house-a-canonical-geometry.json</text><text class="small" x="1220" y="266">Status: approved current source of truth</text><line x1="1220" y1="286" x2="1715" y2="286" stroke="${colors.grid}"/><text class="label" x="1220" y="322">1 footprint</text><text class="small" x="1245" y="346">16.4 m × 12.0 m rectangular envelope</text><text class="label" x="1220" y="382">1 garage</text><text class="small" x="1245" y="406">5.8 m × 7.2 m, front-west, integrated</text><text class="label" x="1220" y="442">1 roof</text><text class="small" x="1245" y="466">25° hipped, 450 mm eaves, 4 downpipes</text><text class="label" x="1220" y="502">12 stable exterior openings</text><text class="small" x="1245" y="526">IDs bind plan, elevation and interior map</text><text class="label" x="1220" y="562">1 site plan</text><text class="small" x="1245" y="586">fixed drive, path, terrace, hedge, beds, trees</text><text class="label" x="1220" y="642">Source-of-truth hierarchy</text><text class="small" x="1245" y="666">A01 material → geometry → room map → site → renders</text>`;
  return svgDocument("House A technical referenceboard", width, height, `${titleBlock("MATRIVA MODERN 2023 · HOUSE A", "CANONICAL TECHNICAL REFERENCEBOARD · approved deterministic geometry · controlled change process", width)}${approvalBanner(width, 108)}<text class="label" x="65" y="150" font-weight="700">DIMENSIONED FLOOR PLAN</text>${floorPlanBody({ x: 65, y: 175, scale: 0.034, showDimensions: false, labelSize: 10 })}<text class="label" x="655" y="150" font-weight="700">ROOF PLAN</text>${roofPlanBody({ x: 655, y: 175, scale: 0.034, labels: false })}${summary}<rect x="1190" y="750" width="555" height="500" rx="12" fill="#fff" stroke="${colors.grid}"/><text class="label" x="1220" y="790" font-size="18" font-weight="700">APPROVED CHANGE CONTROL</text><text class="small" x="1220" y="828">Floor plan, roof, elevations, room allocations, openings, terrace,</text><text class="small" x="1220" y="850">garage and site describe one approved physical House A.</text><text class="small" x="1220" y="890">A01 remains unchanged as visual/material reference.</text><text class="small" x="1220" y="924">A02–A15 remain historical pilot / rejected canonical reference.</text><text class="small" x="1220" y="970">Future derived imagery starts from this model. Any approved change</text><text class="small" x="1220" y="992">must update this JSON before regenerating technical or photo assets.</text><rect x="1220" y="1040" width="475" height="95" rx="8" fill="#e9f3e9" stroke="#9ebfa0"/><text x="1240" y="1073" font-size="14" font-weight="700" fill="#2f6736">APPROVED CURRENT SOURCE OF TRUTH</text><text class="small" x="1240" y="1100">Unobserved geometry remains explicit, controlled design data.</text>${miniElevations}<text class="label" x="65" y="775" font-weight="700">FOUR DERIVED ELEVATIONS</text><text class="small" x="65" y="1285">Generated deterministically from one JSON source. Programmatic checks enforce footprint, garage, hipped roof/ridge, openings, rooms and site containment; regeneration must produce byte-identical SVG output.</text>`);
}

validate();

const outputs = {
  "01-dimensioned-floor-plan.svg": floorPlan(),
  "02-roof-plan.svg": roofPlan(),
  "03-front-elevation.svg": elevation("front", "03", "Front"),
  "04-rear-elevation.svg": elevation("rear", "04", "Rear / garden"),
  "05-left-elevation.svg": elevation("left", "05", "Left"),
  "06-right-elevation.svg": elevation("right", "06", "Right"),
  "07-opening-schedule.svg": openingSchedule(),
  "08-room-and-interior-visibility-map.svg": roomVisibility(),
  "09-site-plan.svg": sitePlan(),
  "10-materials-and-immutable-rules.svg": materialsAndRules(),
  "11-technical-referenceboard.svg": referenceBoard()
};

await mkdir(outputPath, { recursive: true });
for (const [fileName, contents] of Object.entries(outputs)) {
  await writeFile(join(outputPath, fileName), contents, "utf8");
}
console.log(`Generated ${Object.keys(outputs).length} deterministic House A technical SVGs in ${outputPath}.`);
