// Draws the city master plan from above as an SVG site plan.
// Usage: npx tsx scripts/layout-plan-svg.ts <snapshot.json> <out.svg>
import { readFileSync, writeFileSync } from "node:fs";
import { DISTRICT_COLORS, generateCityLayout, type DeveloperRecord } from "../src/lib/github";
import { buildDistrictIslands } from "../src/lib/city/world";
import { placeCityLandmarks } from "../src/lib/city/landmarks";

const devs = (JSON.parse(readFileSync(process.argv[2], "utf8")) as { developers: DeveloperRecord[] }).developers;
const layout = generateCityLayout(devs);
const islands = buildDistrictIslands({ ...layout, extraPoints: placeCityLandmarks(layout.decorations) });
const minX = Math.min(...islands.map((i) => i.bounds.minX)) - 200, maxX = Math.max(...islands.map((i) => i.bounds.maxX)) + 200;
const minZ = Math.min(...islands.map((i) => i.bounds.minZ)) - 200, maxZ = Math.max(...islands.map((i) => i.bounds.maxZ)) + 200;
const r = (x: number) => Math.round(x * 10) / 10;
// SVG y grows downward, so north (+z) is drawn up.
const rect = (cx: number, cz: number, w: number, d: number, fill: string, extra = "") =>
  `<rect x="${r(cx - w / 2)}" y="${r(-cz - d / 2)}" width="${r(w)}" height="${r(d)}" fill="${fill}"${extra}/>`;

const out: string[] = [];
for (const i of islands) out.push(rect(i.center[0], i.center[1], i.width, i.depth, "#3a4a2f", ` rx="60"`));
if (layout.river) out.push(rect(layout.river.x + layout.river.width / 2, layout.river.centerZ, layout.river.width, layout.river.length, "#2f6f9f"));
for (const b of layout.bridges) out.push(rect(b.position[0], b.position[2], 40, b.width, "#b9a27a"));
for (const d of layout.decorations) {
  if (d.type === "sidewalk") out.push(rect(d.position[0], d.position[2], d.size![0], d.size![1], "#8d8a80"));
}
for (const d of layout.decorations) {
  if (d.type !== "roadSurface") continue;
  const [w, l] = d.size!;
  const alongZ = Math.abs(Math.sin(d.rotation)) < 0.5;
  out.push(rect(d.position[0], d.position[2], alongZ ? w : l, alongZ ? l : w, "#2b2d33"));
}
for (const c of layout.canals) out.push(rect(c.position[0], c.position[2], c.length, c.width, "#3d8fc4"));
for (const b of layout.buildings) out.push(rect(b.position[0], b.position[2], b.width, b.depth, DISTRICT_COLORS[b.district ?? ""] ?? "#999"));
for (const d of layout.decorations) {
  if (d.type === "tree") out.push(`<circle cx="${r(d.position[0])}" cy="${r(-d.position[2])}" r="3" fill="#4f8a3a"/>`);
  if (d.type === "landmarkSite") out.push(rect(d.position[0], d.position[2], 130, 110, "none", ` stroke="#ff4fd8" stroke-width="6"`));
}
for (const p of layout.plazas) out.push(`<text x="${r(p.position[0])}" y="${r(-p.position[2])}" font-size="90" fill="#fff" text-anchor="middle" font-family="monospace">${p.city}</text>`);

writeFileSync(process.argv[3], `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(minX)} ${r(-maxZ)} ${r(maxX - minX)} ${r(maxZ - minZ)}" style="background:#123049">${out.join("")}</svg>`);
console.log(`${out.length} shapes, ${Math.round(maxX - minX)} x ${Math.round(maxZ - minZ)} world units`);
