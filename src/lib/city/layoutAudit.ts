import type { CityBuilding, CityCanal, CityDecoration, CityPlaza, CityRiver } from "@/lib/github";
import { buildDistrictIslands } from "./world";
import { CAR_HALF_WIDTH, laneOffsets } from "./traffic";

/** Oriented rectangle on the XZ ground plane; `rot` turns the local X axis to (cos, -sin). */
interface Rect { cx: number; cz: number; hx: number; hz: number; rot: number }

// Approximate ground radius of solid props, matching their rendered models.
const PROP_RADIUS: Partial<Record<CityDecoration["type"], number>> = {
  tree: 3, streetLamp: 1, bench: 2, car: 4, autoRickshaw: 3, busStop: 5, chaiStall: 4, techParkSign: 4,
  fountain: 8, nandiBull: 8, gatewayArch: 12, clockTower: 8, templeGopuram: 12,
  vidhanaSoudha: 40, bangalorePalace: 40, tipuFortWall: 35, gatewayOfIndia: 30, charminar: 25,
  indiaGate: 25, marinaLighthouse: 15, shaniwarWada: 35, isroRocket: 15,
  landmarkSite: 65, // a custom landmark model fills most of its block
};
const LANDMARKS = new Set<CityDecoration["type"]>([
  "vidhanaSoudha", "bangalorePalace", "tipuFortWall", "gatewayOfIndia", "charminar", "indiaGate",
  "marinaLighthouse", "shaniwarWada", "isroRocket", "nandiBull", "gatewayArch", "clockTower", "templeGopuram",
]);

function overlaps(a: Rect, b: Rect): boolean {
  const axes = [a.rot, a.rot + Math.PI / 2, b.rot, b.rot + Math.PI / 2];
  return axes.every((angle) => {
    const ux = Math.cos(angle), uz = -Math.sin(angle);
    const extent = (r: Rect) => r.hx * Math.abs(ux * Math.cos(r.rot) + uz * -Math.sin(r.rot))
      + r.hz * Math.abs(ux * Math.sin(r.rot) + uz * Math.cos(r.rot));
    return Math.abs((b.cx - a.cx) * ux + (b.cz - a.cz) * uz) < extent(a) + extent(b) - 1e-6;
  });
}

const buildingRect = (b: CityBuilding): Rect => ({ cx: b.position[0], cz: b.position[2], hx: b.width / 2, hz: b.depth / 2, rot: 0 });
// Vehicles are long and thin, turned along their road; other props are treated as squares.
const propRect = (d: CityDecoration, r: number): Rect => d.type === "car" || d.type === "autoRickshaw"
  ? { cx: d.position[0], cz: d.position[2], hx: r, hz: 1.75, rot: d.rotation }
  : { cx: d.position[0], cz: d.position[2], hx: r, hz: r, rot: 0 };
const canalRect = (c: CityCanal): Rect => ({ cx: c.position[0], cz: c.position[2], hx: c.length / 2, hz: c.width / 2, rot: c.rotation });
// Road surfaces are sized [width, length] with the length along Z before rotation.
const roadRect = (d: CityDecoration): Rect => ({ cx: d.position[0], cz: d.position[2], hx: d.size![0] / 2, hz: d.size![1] / 2, rot: d.rotation });

/** Uniform-grid broad phase so the audit stays linear on ~20k buildings. */
function index(rects: Rect[], cell = 160) {
  const grid = new Map<string, number[]>();
  const keys = (r: Rect) => {
    // Axis-aligned extent of the rotated rectangle, so long roads only touch the cells they cross.
    const c = Math.abs(Math.cos(r.rot)), s = Math.abs(Math.sin(r.rot));
    const ex = r.hx * c + r.hz * s, ez = r.hx * s + r.hz * c;
    const out: string[] = [];
    for (let x = Math.floor((r.cx - ex) / cell); x <= Math.floor((r.cx + ex) / cell); x++)
      for (let z = Math.floor((r.cz - ez) / cell); z <= Math.floor((r.cz + ez) / cell); z++) out.push(`${x},${z}`);
    return out;
  };
  rects.forEach((r, i) => keys(r).forEach((k) => (grid.get(k) ?? grid.set(k, []).get(k)!).push(i)));
  return (r: Rect) => {
    const hits = new Set<number>();
    for (const k of keys(r)) for (const i of grid.get(k) ?? []) if (overlaps(r, rects[i])) hits.add(i);
    return hits;
  };
}

export interface LayoutIssues {
  buildingOverlaps: number;
  propsInBuildings: number;
  propsOnRoads: number;
  landmarkOverlaps: number;
  waterOverBuildings: number;
  waterOverRoads: number;
  riverOverBuildings: number;
  plazaOverBuildings: number;
  districtIntrusions: number;
  roadsOverBuildings: number;
  propsInWater: number;
  propOverlaps: number;
  islandOverlaps: number;
  vehiclesOffRoad: number;
  parkedInTrafficLanes: number;
}

export function auditCityLayout(layout: {
  buildings: CityBuilding[]; decorations: CityDecoration[]; canals: CityCanal[];
  plazas: CityPlaza[]; river: CityRiver | null;
}): LayoutIssues {
  const buildings = layout.buildings.map(buildingRect);
  const hitBuilding = index(buildings);
  const roads = layout.decorations.filter((d) => d.type === "roadSurface" && d.size).map(roadRect);
  const hitRoad = index(roads);
  const props = layout.decorations.filter((d) => PROP_RADIUS[d.type] !== undefined);
  const landmarks = props.filter((d) => LANDMARKS.has(d.type)).map((d) => propRect(d, PROP_RADIUS[d.type]!));
  const water = layout.canals.map(canalRect);

  let buildingOverlaps = 0;
  buildings.forEach((r, i) => { for (const j of hitBuilding(r)) if (j > i) buildingOverlaps++; });

  let propsInBuildings = 0, propsOnRoads = 0;
  for (const d of props) {
    const r = propRect(d, PROP_RADIUS[d.type]!);
    if (hitBuilding(r).size) propsInBuildings++;
    // Vehicles belong on roads; everything else must stay off them.
    if (d.type !== "car" && d.type !== "autoRickshaw" && hitRoad(r).size) propsOnRoads++;
  }

  let landmarkOverlaps = 0;
  landmarks.forEach((a, i) => landmarks.forEach((b, j) => { if (j > i && overlaps(a, b)) landmarkOverlaps++; }));

  const waterOverBuildings = water.filter((w) => hitBuilding(w).size).length;
  const waterOverRoads = water.filter((w) => hitRoad(w).size).length;

  const river = layout.river;
  const riverOverBuildings = river
    ? hitBuilding({ cx: river.x + river.width / 2, cz: river.centerZ, hx: river.width / 2, hz: river.length / 2, rot: 0 }).size
    : 0;

  const plazaOverBuildings = layout.plazas.filter((p) =>
    hitBuilding({ cx: p.position[0], cz: p.position[2], hx: p.size / 2, hz: p.size / 2, rot: 0 }).size).length;

  // A building sitting inside another district's bounding box means districts interleave.
  const boxes = new Map<string, { minX: number; maxX: number; minZ: number; maxZ: number }>();
  for (const b of layout.buildings) {
    const box = boxes.get(b.district ?? "") ?? { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    box.minX = Math.min(box.minX, b.position[0]); box.maxX = Math.max(box.maxX, b.position[0]);
    box.minZ = Math.min(box.minZ, b.position[2]); box.maxZ = Math.max(box.maxZ, b.position[2]);
    boxes.set(b.district ?? "", box);
  }
  let districtIntrusions = 0;
  for (const b of layout.buildings) for (const [id, box] of boxes) {
    if (id !== b.district && b.position[0] > box.minX && b.position[0] < box.maxX
      && b.position[2] > box.minZ && b.position[2] < box.maxZ) { districtIntrusions++; break; }
  }

  const roadsOverBuildings = roads.filter((r) => hitBuilding(r).size).length;
  const hitWater = index(water);
  const propRects = props.map((d) => propRect(d, PROP_RADIUS[d.type]!));
  const propsInWater = propRects.filter((r) => hitWater(r).size).length;
  const hitProp = index(propRects);
  let propOverlaps = 0;
  propRects.forEach((r, i) => { for (const j of hitProp(r)) if (j > i) propOverlaps++; });

  // District islands (not the separate scenery islets) must stay apart.
  const islands = buildDistrictIslands({ buildings: layout.buildings, plazas: layout.plazas, decorations: [] });
  let islandOverlaps = 0;
  islands.forEach((a, i) => islands.forEach((b, j) => {
    if (j > i && a.bounds.minX < b.bounds.maxX && b.bounds.minX < a.bounds.maxX
      && a.bounds.minZ < b.bounds.maxZ && b.bounds.minZ < a.bounds.maxZ) islandOverlaps++;
  }));

  // Parked vehicles must stand on asphalt, and out of the lanes StreetTraffic drives in.
  const vehicles = layout.decorations.filter((d) => d.type === "car" || d.type === "autoRickshaw")
    .map((d) => propRect(d, PROP_RADIUS[d.type]!));
  const vehiclesOffRoad = vehicles.filter((v) => !hitRoad({ ...v, hx: 0.01, hz: 0.01 }).size).length;
  const lanes = layout.decorations.filter((d) => d.type === "roadSurface" && d.size).flatMap((d) =>
    laneOffsets(d.size![0]).map((o): Rect => ({
      cx: d.position[0] + Math.cos(d.rotation) * o, cz: d.position[2] - Math.sin(d.rotation) * o,
      hx: CAR_HALF_WIDTH, hz: d.size![1] / 2, rot: d.rotation,
    })));
  const hitLane = index(lanes);
  const parkedInTrafficLanes = vehicles.filter((v) => hitLane(v).size).length;

  return {
    buildingOverlaps, propsInBuildings, propsOnRoads, landmarkOverlaps, waterOverBuildings,
    waterOverRoads, riverOverBuildings, plazaOverBuildings, districtIntrusions,
    roadsOverBuildings, propsInWater, propOverlaps, islandOverlaps, vehiclesOffRoad, parkedInTrafficLanes,
  };
}
