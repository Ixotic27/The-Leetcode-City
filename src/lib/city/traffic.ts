/** Pure lane/segment math for moving street traffic (rendered by components/city/StreetTraffic). */

export interface TrafficRoad {
  position: [number, number, number];
  /** 0 = road runs along Z, PI/2 = road runs along X. */
  rotation: number;
  /** [width, length]; length lies along the road's travel axis. */
  size?: [number, number];
}

export const CAR_HALF_LENGTH = 4;
export const CAR_HALF_WIDTH = 1.75;
const MIN_GAP = 14; // bumper-to-bumper spacing floor between cars sharing a lane

/**
 * Signed lateral offsets of the moving-traffic lanes from the road centerline.
 * Positive lanes drive toward +length, negative toward -length. Curb lanes are left to parked cars.
 */
export function laneOffsets(width: number): number[] {
  const half = width / 2;
  // Streets and boulevard carriageways are lined with parked cars on both curbs: no room to drive past them.
  if (width < 30) return [];
  // Wide roads: the outer ~6 units per side are the parking/curb lane; two inner lanes per direction.
  const inner = half - 6;
  return [inner * 0.3, inner * 0.8, -inner * 0.3, -inner * 0.8];
}

/** Wrap a position along a segment into [-half, half). */
export function wrapAlong(s: number, half: number): number {
  const span = 2 * half;
  const t = (s + half) % span;
  return (t < 0 ? t + span : t) - half;
}

export interface TrafficPlan {
  count: number;
  /** Lane center at the segment midpoint. */
  x: Float32Array; y: Float32Array; z: Float32Array;
  /** Unit travel direction on the ground plane. */
  dx: Float32Array; dz: Float32Array;
  /** Car centers travel within [-half, half) so the whole car stays on its segment. */
  half: Float32Array;
  s: Float32Array;
  speed: Float32Array;
  color: Uint8Array;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically spread up to `maxCars` cars over the lanes of the given road segments.
 * Cars in one lane share a speed and are evenly spaced, so wrapping never makes them overlap.
 */
export function planTraffic(roads: TrafficRoad[], maxCars = 400, seed = 1337, colors = 6): TrafficPlan {
  const rand = mulberry32(seed);
  const lanes: { x: number; y: number; z: number; dx: number; dz: number; half: number; weight: number }[] = [];
  let totalWeight = 0;
  for (const r of roads) {
    if (!r.size) continue;
    const [width, length] = r.size;
    const half = length / 2 - CAR_HALF_LENGTH;
    if (half <= 0) continue;
    const ax = Math.sin(r.rotation), az = Math.cos(r.rotation); // along the road
    const lx = Math.cos(r.rotation), lz = -Math.sin(r.rotation); // across the road
    for (const o of laneOffsets(width)) {
      const dir = Math.sign(o);
      const weight = length * (width < 30 ? 1 : 1.6); // avenues/boulevards carry more traffic per lane
      lanes.push({ x: r.position[0] + lx * o, y: r.position[1], z: r.position[2] + lz * o, dx: ax * dir, dz: az * dir, half, weight });
      totalWeight += weight;
    }
  }

  const target = Math.min(maxCars, Math.floor(totalWeight / 60));
  const density = totalWeight > 0 ? target / totalWeight : 0;
  const plan: TrafficPlan = {
    count: 0,
    x: new Float32Array(maxCars), y: new Float32Array(maxCars), z: new Float32Array(maxCars),
    dx: new Float32Array(maxCars), dz: new Float32Array(maxCars),
    half: new Float32Array(maxCars), s: new Float32Array(maxCars),
    speed: new Float32Array(maxCars), color: new Uint8Array(maxCars),
  };

  for (const lane of lanes) {
    const span = 2 * lane.half;
    const k = Math.min(Math.floor(lane.weight * density + rand()), Math.floor(span / (2 * CAR_HALF_LENGTH + MIN_GAP)));
    if (k <= 0) continue;
    const speed = 10 + rand() * 14;
    const start = rand() * span;
    for (let j = 0; j < k && plan.count < maxCars; j++) {
      const i = plan.count++;
      plan.x[i] = lane.x; plan.y[i] = lane.y; plan.z[i] = lane.z;
      plan.dx[i] = lane.dx; plan.dz[i] = lane.dz;
      plan.half[i] = lane.half;
      plan.s[i] = wrapAlong(start + (j * span) / k, lane.half);
      plan.speed[i] = speed;
      plan.color[i] = Math.floor(rand() * colors);
    }
    if (plan.count >= maxCars) break;
  }
  return plan;
}
