// Runs generateCityLayout on a city snapshot and counts layout abnormalities.
// Usage: npx tsx scripts/layout-audit.ts <snapshot.json>
import { readFileSync } from "node:fs";
import { generateCityLayout, type DeveloperRecord } from "../src/lib/github";
import { auditCityLayout } from "../src/lib/city/layoutAudit";

const snapshot = JSON.parse(readFileSync(process.argv[2], "utf8")) as { developers: DeveloperRecord[] };
const devs = snapshot.developers;
const t0 = performance.now();
const layout = generateCityLayout(devs);
const ms = Math.round(performance.now() - t0);

const byDistrict: Record<string, number> = {};
for (const b of layout.buildings) byDistrict[b.district ?? "?"] = (byDistrict[b.district ?? "?"] ?? 0) + 1;
console.log({ developers: devs.length, buildings: layout.buildings.length, decorations: layout.decorations.length, canals: layout.canals.length, generateMs: ms });
console.log("population", byDistrict);
console.log("issues", auditCityLayout(layout));
