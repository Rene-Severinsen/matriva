import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const geometryPath = join(projectRoot, "docs", "product", "house-a-canonical-geometry.json");
const cameraPath = join(projectRoot, "docs", "product", "house-a-canonical-camera-system.json");
const defaultOutput = join(projectRoot, "docs", "product", "house-a-geometric-previews");
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex === -1 ? defaultOutput : resolve(process.argv[outputIndex + 1] ?? defaultOutput);
const geometryBuffer = await readFile(geometryPath);
const cameraBuffer = await readFile(cameraPath);
const geometry = JSON.parse(geometryBuffer.toString("utf8"));
const cameraSystem = JSON.parse(cameraBuffer.toString("utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(`House A geometric preview invalid: ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function add(a, b) {
  return a.map((value, index) => value + b[index]);
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}

function scale(vector, amount) {
  return vector.map((value) => value * amount);
}

function dot(a, b) {
  return a.reduce((total, value, index) => total + value * b[index], 0);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(vector) {
  const length = Math.sqrt(dot(vector, vector));
  assert(length > 0, "camera vectors must have non-zero length");
  return scale(vector, 1 / length);
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function siteToWorld(x, y, z = 0) {
  return [x - geometry.site.houseOrigin.x, y - geometry.site.houseOrigin.y, z];
}

function horizontalQuad(x, y, width, depth, z = 0) {
  return [[x, y, z], [x + width, y, z], [x + width, y + depth, z], [x, y + depth, z]];
}

function cameraProjector(camera) {
  const forward = normalize(subtract(camera.targetMm, camera.positionMm));
  const right = normalize(cross(forward, camera.upVector));
  const up = normalize(cross(right, forward));
  const frame = cameraSystem.renderFrame;
  const focal = (frame.widthPx / 2) / Math.tan(camera.fieldOfViewDegrees * Math.PI / 360);
  return {
    project(point) {
      const offset = subtract(point, camera.positionMm);
      const depth = dot(offset, forward);
      assert(depth > 1, `${camera.id} has geometry behind its camera plane`);
      return {
        x: frame.widthPx / 2 + dot(offset, right) * focal / depth,
        y: frame.heightPx / 2 - dot(offset, up) * focal / depth,
        depth
      };
    },
    facing(normal, centre) {
      return dot(normal, subtract(camera.positionMm, centre)) > 0;
    }
  };
}

function face(id, vertices, fill, stroke = "#263438", strokeWidth = 2, normal = null) {
  return { id, vertices, fill, stroke, strokeWidth, normal };
}

function centre(vertices) {
  return vertices.reduce((total, vertex) => add(total, vertex), [0, 0, 0]).map((value) => value / vertices.length);
}

function modelFaces(camera, projector) {
  const { footprint, levels, roof, site } = geometry;
  const width = footprint.widthMm;
  const depth = footprint.depthMm;
  const eaves = levels.eavesMm;
  const ridge = levels.ridgeMm;
  const siteSouthWest = siteToWorld(0, 0, -40);
  const faces = [
    face("site", horizontalQuad(siteSouthWest[0], siteSouthWest[1], site.boundary.widthMm, site.boundary.depthMm, -40), "#cbd9bf", "#8ca082", 1),
    face("driveway", horizontalQuad(...siteToWorld(site.driveway.x, site.driveway.y, -20).slice(0, 2), site.driveway.widthMm, site.driveway.depthMm, -20), "#b8b8b2", "#969790", 1),
    face("front-path", horizontalQuad(...siteToWorld(site.frontPath.x, site.frontPath.y, -18).slice(0, 2), site.frontPath.widthMm, site.frontPath.depthMm, -18), "#c6c6c0", "#969790", 1),
    face("terrace", horizontalQuad(...siteToWorld(site.terrace.x, site.terrace.y, -15).slice(0, 2), site.terrace.widthMm, site.terrace.depthMm, -15), "#c9c7bf", "#969790", 1),
    face("front-wall", [[0,0,0],[width,0,0],[width,0,eaves],[0,0,eaves]], "#eee7d9", "#60635f", 2, [0,-1,0]),
    face("rear-wall", [[width,depth,0],[0,depth,0],[0,depth,eaves],[width,depth,eaves]], "#eee7d9", "#60635f", 2, [0,1,0]),
    face("left-wall", [[0,depth,0],[0,0,0],[0,0,eaves],[0,depth,eaves]], "#e4ddcf", "#60635f", 2, [-1,0,0]),
    face("right-wall", [[width,0,0],[width,depth,0],[width,depth,eaves],[width,0,eaves]], "#e4ddcf", "#60635f", 2, [1,0,0])
  ];

  const p1 = [-roof.overhangMm, -roof.overhangMm, eaves];
  const p2 = [width + roof.overhangMm, -roof.overhangMm, eaves];
  const p3 = [width + roof.overhangMm, depth + roof.overhangMm, eaves];
  const p4 = [-roof.overhangMm, depth + roof.overhangMm, eaves];
  const r1 = [roof.ridge.start.x, roof.ridge.start.y, ridge];
  const r2 = [roof.ridge.end.x, roof.ridge.end.y, ridge];
  faces.push(
    face("roof-front", [p1,p2,r2,r1], "#273136", "#11181b", 2),
    face("roof-rear", [p4,r1,r2,p3], "#20292d", "#11181b", 2),
    face("roof-left", [p1,r1,p4], "#222b2f", "#11181b", 2),
    face("roof-right", [p2,p3,r2], "#1a2226", "#11181b", 2)
  );

  return faces
    .filter((item) => !item.normal || projector.facing(item.normal, centre(item.vertices)))
    .map((item) => {
      const projected = item.vertices.map(projector.project);
      return { ...item, projected, depth: projected.reduce((total, point) => total + point.depth, 0) / projected.length };
    })
    .sort((a, b) => b.depth - a.depth);
}

function openingGeometry(opening) {
  const width = geometry.footprint.widthMm;
  const depth = geometry.footprint.depthMm;
  const start = opening.offsetMm;
  const end = start + opening.widthMm;
  const bottom = opening.sillMm;
  const top = bottom + opening.heightMm;
  if (opening.facade === "front") return { vertices: [[start,-8,bottom],[end,-8,bottom],[end,-8,top],[start,-8,top]], normal: [0,-1,0] };
  if (opening.facade === "rear") return { vertices: [[end,depth+8,bottom],[start,depth+8,bottom],[start,depth+8,top],[end,depth+8,top]], normal: [0,1,0] };
  if (opening.facade === "left") return { vertices: [[-8,end,bottom],[-8,start,bottom],[-8,start,top],[-8,end,top]], normal: [-1,0,0] };
  return { vertices: [[width+8,start,bottom],[width+8,end,bottom],[width+8,end,top],[width+8,start,top]], normal: [1,0,0] };
}

function polyline(points, projector, attributes) {
  const value = points.map(projector.project).map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  return `<polyline points="${value}" ${attributes}/>`;
}

function screenPlanting(projector) {
  let body = "";
  for (const item of geometry.site.planting) {
    if (item.radiusMm) {
      const base = siteToWorld(item.x, item.y, 0);
      const crown = projector.project(add(base, [0,0,item.radiusMm * 2.4]));
      const edge = projector.project(add(base, [item.radiusMm,0,item.radiusMm * 2.4]));
      const trunkBase = projector.project(base);
      body += `<line x1="${trunkBase.x.toFixed(2)}" y1="${trunkBase.y.toFixed(2)}" x2="${crown.x.toFixed(2)}" y2="${crown.y.toFixed(2)}" stroke="#66533e" stroke-width="8"/>`;
      body += `<circle cx="${crown.x.toFixed(2)}" cy="${crown.y.toFixed(2)}" r="${Math.max(12, Math.abs(edge.x - crown.x)).toFixed(2)}" fill="#6f9064" stroke="#496d4a" stroke-width="2"/>`;
    }
  }
  return body;
}

function renderCamera(camera) {
  const frame = cameraSystem.renderFrame;
  const projector = cameraProjector(camera);
  const faces = modelFaces(camera, projector);
  const landscapeIds = new Set(["site", "driveway", "front-path", "terrace"]);
  const drawFaces = (items) => items.map((item) => `<polygon points="${item.projected.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" stroke-linejoin="round"/>`).join("");
  let body = drawFaces(faces.filter((item) => landscapeIds.has(item.id)));

  const site = geometry.site;
  const hedgeCorners = [siteToWorld(0,0,550),siteToWorld(site.boundary.widthMm,0,550),siteToWorld(site.boundary.widthMm,site.boundary.depthMm,550),siteToWorld(0,site.boundary.depthMm,550),siteToWorld(0,0,550)];
  body += polyline(hedgeCorners, projector, `fill="none" stroke="#50754f" stroke-width="18" stroke-linejoin="round" opacity=".9"`);
  body += screenPlanting(projector);
  body += drawFaces(faces.filter((item) => !landscapeIds.has(item.id)));

  for (const opening of geometry.openings) {
    const opening3d = openingGeometry(opening);
    if (!projector.facing(opening3d.normal, centre(opening3d.vertices))) continue;
    const projected = opening3d.vertices.map(projector.project);
    const isWindow = opening.type === "window" || opening.type === "sliding_door";
    const fill = isWindow ? "#86aab8" : "#252b2e";
    body += `<polygon points="${projected.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}" fill="${fill}" stroke="#111719" stroke-width="4"/>`;
    if (opening.type === "sliding_door") {
      const midBottom = add(opening3d.vertices[0], scale(subtract(opening3d.vertices[1], opening3d.vertices[0]), 0.5));
      const midTop = add(opening3d.vertices[3], scale(subtract(opening3d.vertices[2], opening3d.vertices[3]), 0.5));
      body += polyline([midBottom, midTop], projector, `fill="none" stroke="#111719" stroke-width="3"`);
    }
  }

  const { widthMm, depthMm } = geometry.footprint;
  const eave = geometry.levels.eavesMm;
  const overhang = geometry.roof.overhangMm;
  body += polyline([[-overhang,-overhang,eave],[widthMm+overhang,-overhang,eave],[widthMm+overhang,depthMm+overhang,eave],[-overhang,depthMm+overhang,eave],[-overhang,-overhang,eave]], projector, `fill="none" stroke="#111719" stroke-width="7" stroke-linejoin="round"`);
  for (const pipe of geometry.roof.downpipes) {
    body += polyline([[pipe.x,pipe.y,eave],[pipe.x,pipe.y,0]], projector, `fill="none" stroke="#111719" stroke-width="7"`);
  }

  const metadata = `${camera.id} · ${camera.orientation} · ${camera.fieldOfViewDegrees}° FOV · ${camera.aspectRatio}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${frame.widthPx}" height="${frame.heightPx}" viewBox="0 0 ${frame.widthPx} ${frame.heightPx}" role="img" aria-label="${escapeXml(camera.purpose)}"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe7ec"/><stop offset="1" stop-color="#f7eee0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#sky)"/>${body}<rect x="24" y="24" width="620" height="55" rx="7" fill="#fff" opacity=".9"/><text x="42" y="48" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#182224">HOUSE A · GEOMETRIC PREVIEW · ${camera.id}</text><text x="42" y="68" font-family="Arial,sans-serif" font-size="12" fill="#4e5d58">${escapeXml(metadata)}</text><rect x="24" y="842" width="730" height="34" rx="5" fill="#132025" opacity=".86"/><text x="42" y="864" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#fff">APPROVED CANONICAL GEOMETRY · NOT A PHOTOREALISTIC ASSET</text></svg>\n`;
}

function validateSources() {
  assert(geometry.status === "approved_current_source_of_truth", "geometry must be approved");
  assert(cameraSystem.canonicalGeometryId === geometry.id, "camera system must reference canonical geometry ID");
  assert(cameraSystem.renderFrame.aspectRatio === "16:9", "render frame must remain 16:9");
  assert(cameraSystem.renderFrame.widthPx / cameraSystem.renderFrame.heightPx === 16 / 9, "render dimensions must be 16:9");
  const required = ["CAM_FRONT_HERO","CAM_FRONT","CAM_REAR","CAM_LEFT","CAM_RIGHT"];
  assert(required.every((id) => cameraSystem.cameras.some((camera) => camera.id === id)), "all canonical camera IDs must exist");
  assert(new Set(cameraSystem.cameras.map((camera) => camera.id)).size === cameraSystem.cameras.length, "camera IDs must be unique");
  for (const camera of cameraSystem.cameras) {
    assert(camera.positionMm[2] === camera.heightMm, `${camera.id} height must match position z`);
    assert(camera.aspectRatio === cameraSystem.renderFrame.aspectRatio, `${camera.id} aspect ratio must match render frame`);
    assert(camera.fieldOfViewDegrees > 20 && camera.fieldOfViewDegrees < 80, `${camera.id} FOV must be physically plausible`);
  }
}

validateSources();
await mkdir(outputPath, { recursive: true });
const manifest = {
  schemaVersion: 1,
  geometryId: geometry.id,
  geometrySha256: sha256(geometryBuffer),
  cameraSystemId: cameraSystem.id,
  cameraSystemSha256: sha256(cameraBuffer),
  renderer: "deterministic-svg-perspective-v1",
  outputs: []
};

for (const camera of cameraSystem.cameras) {
  const baseName = camera.id.toLowerCase().replaceAll("_", "-");
  const svgName = `${baseName}.svg`;
  const pngName = `${baseName}.png`;
  const svg = renderCamera(camera);
  const png = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
  await Promise.all([writeFile(join(outputPath, svgName), svg, "utf8"), writeFile(join(outputPath, pngName), png)]);
  manifest.outputs.push({ cameraId: camera.id, svg: svgName, png: pngName, svgSha256: sha256(svg), pngSha256: sha256(png) });
}

await writeFile(join(outputPath, "geometric-preview-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${cameraSystem.cameras.length} canonical House A geometric camera previews in ${outputPath}.`);
