import * as THREE from "three";

import { DISTRICT_ORIGINS } from "@/lib/github";

const METRO_OFFSET = 450;
const CONTACT_EPSILON = 0.05;
const PARALLEL_EPSILON = 1e-8;

export const METRO_VEHICLE_COLLISION_RADIUS = 6;

export const METRO_DIMENSIONS = {
  trackY: 40,
  trackCenterY: 39.5,
  trackWidth: 14,
  trackHeight: 1.2,
  trackPillarStep: 300,
  pillarCenterY: 20,
  pillarHeight: 40,
  trackPillarTopRadius: 2.8,
  trackPillarBottomRadius: 3.8,
  stationPillarTopRadius: 2.5,
  stationPillarBottomRadius: 3.2,
} as const;

export const METRO_STATION_PILLAR_X_OFFSETS = [-16, 16] as const;
export const METRO_STATION_PILLAR_Z_OFFSETS = [-30, 0, 30] as const;

export interface MetroTrackSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  name: string;
}

export interface MetroStationDefinition {
  position: [number, number, number];
  name: string;
}

export interface MetroCollider {
  id: string;
  kind: "track" | "pillar";
  center: THREE.Vector3;
  halfSize: THREE.Vector3;
  yaw: number;
}

export interface MetroLayout {
  trackSegments: readonly MetroTrackSegment[];
  stations: readonly MetroStationDefinition[];
  colliders: readonly MetroCollider[];
}

type DistrictOrigins = Record<string, [number, number, number]>;

function getStationDefinitions(origins: DistrictOrigins): MetroStationDefinition[] {
  const definitions: Array<[string, string]> = [
    ["downtown", "BENGALURU CENTRAL"],
    ["fullstack", "DELHI JUNCTION"],
    ["devops", "KOLKATA TERMINUS"],
  ];

  return definitions.flatMap(([district, name]) => {
    const origin = origins[district];
    if (!origin) return [];

    return [{
      position: [origin[0] + METRO_OFFSET, 0, origin[2] + METRO_OFFSET] as [number, number, number],
      name,
    }];
  });
}

function getTrackSegments(origins: DistrictOrigins): MetroTrackSegment[] {
  const routes: Array<[string, string, string]> = [
    ["downtown", "fullstack", "bengaluru-delhi"],
    ["fullstack", "devops", "delhi-kolkata"],
  ];

  return routes.flatMap(([from, to, name]) => {
    const startOrigin = origins[from];
    const endOrigin = origins[to];
    if (!startOrigin || !endOrigin) return [];

    return [{
      start: new THREE.Vector3(
        startOrigin[0] + METRO_OFFSET,
        METRO_DIMENSIONS.trackY,
        startOrigin[2] + METRO_OFFSET,
      ),
      end: new THREE.Vector3(
        endOrigin[0] + METRO_OFFSET,
        METRO_DIMENSIONS.trackY,
        endOrigin[2] + METRO_OFFSET,
      ),
      name,
    }];
  });
}

function createMetroColliders(
  trackSegments: readonly MetroTrackSegment[],
  stations: readonly MetroStationDefinition[],
): MetroCollider[] {
  const colliders: MetroCollider[] = [];

  for (const segment of trackSegments) {
    const direction = new THREE.Vector3().subVectors(segment.end, segment.start);
    const length = direction.length();
    if (length === 0) continue;

    const normalizedDirection = direction.multiplyScalar(1 / length);
    const yaw = Math.atan2(normalizedDirection.x, normalizedDirection.z);
    const center = new THREE.Vector3().addVectors(segment.start, segment.end).multiplyScalar(0.5);
    center.y = METRO_DIMENSIONS.trackCenterY;

    colliders.push({
      id: `track-${segment.name}`,
      kind: "track",
      center,
      halfSize: new THREE.Vector3(
        METRO_DIMENSIONS.trackWidth / 2,
        METRO_DIMENSIONS.trackHeight / 2,
        length / 2,
      ),
      yaw,
    });

    for (
      let distance = METRO_DIMENSIONS.trackPillarStep;
      distance < length - METRO_DIMENSIONS.trackPillarStep;
      distance += METRO_DIMENSIONS.trackPillarStep
    ) {
      const position = new THREE.Vector3()
        .addScaledVector(normalizedDirection, distance)
        .add(segment.start);

      colliders.push({
        id: `pillar-${segment.name}-${distance}`,
        kind: "pillar",
        center: new THREE.Vector3(position.x, METRO_DIMENSIONS.pillarCenterY, position.z),
        halfSize: new THREE.Vector3(
          METRO_DIMENSIONS.trackPillarBottomRadius,
          METRO_DIMENSIONS.pillarHeight / 2,
          METRO_DIMENSIONS.trackPillarBottomRadius,
        ),
        yaw: 0,
      });
    }
  }

  for (const station of stations) {
    const [stationX, , stationZ] = station.position;
    for (const offsetX of METRO_STATION_PILLAR_X_OFFSETS) {
      for (const offsetZ of METRO_STATION_PILLAR_Z_OFFSETS) {
        colliders.push({
          id: `station-pillar-${station.name}-${offsetX}-${offsetZ}`,
          kind: "pillar",
          center: new THREE.Vector3(
            stationX + offsetX,
            METRO_DIMENSIONS.pillarCenterY,
            stationZ + offsetZ,
          ),
          halfSize: new THREE.Vector3(
            METRO_DIMENSIONS.stationPillarBottomRadius,
            METRO_DIMENSIONS.pillarHeight / 2,
            METRO_DIMENSIONS.stationPillarBottomRadius,
          ),
          yaw: 0,
        });
      }
    }
  }

  return colliders;
}

export function createMetroLayout(origins: DistrictOrigins): MetroLayout {
  const trackSegments = getTrackSegments(origins);
  const stations = getStationDefinitions(origins);

  return {
    trackSegments,
    stations,
    colliders: createMetroColliders(trackSegments, stations),
  };
}

export const METRO_LAYOUT = createMetroLayout(DISTRICT_ORIGINS);

function toColliderLocal(
  point: THREE.Vector3,
  collider: MetroCollider,
  target: THREE.Vector3,
): THREE.Vector3 {
  const dx = point.x - collider.center.x;
  const dz = point.z - collider.center.z;
  const cosine = Math.cos(collider.yaw);
  const sine = Math.sin(collider.yaw);

  return target.set(
    cosine * dx - sine * dz,
    point.y - collider.center.y,
    sine * dx + cosine * dz,
  );
}

function isInsideExpandedCollider(
  point: THREE.Vector3,
  halfSize: THREE.Vector3,
): boolean {
  return Math.abs(point.x) + PARALLEL_EPSILON < halfSize.x
    && Math.abs(point.y) + PARALLEL_EPSILON < halfSize.y
    && Math.abs(point.z) + PARALLEL_EPSILON < halfSize.z;
}

function startsOnBoundaryWithoutEntering(
  start: THREE.Vector3,
  end: THREE.Vector3,
  halfSize: THREE.Vector3,
): boolean {
  for (const axis of ["x", "y", "z"] as const) {
    const startValue = start[axis];
    const extent = halfSize[axis];
    if (Math.abs(Math.abs(startValue) - extent) > PARALLEL_EPSILON) continue;

    const outwardDelta = Math.sign(startValue) * (end[axis] - startValue);

    // Outward or tangential movement on any contacted face cannot enter the box.
    if (outwardDelta >= 0) return true;
  }

  return false;
}

function segmentExpandedBoxEntry(
  start: THREE.Vector3,
  end: THREE.Vector3,
  halfSize: THREE.Vector3,
): number | null {
  if (isInsideExpandedCollider(start, halfSize)) {
    // Let a vehicle that loaded inside legacy geometry move back out instead of trapping it.
    return null;
  }

  if (startsOnBoundaryWithoutEntering(start, end, halfSize)) return null;


  let entryTime = 0;
  let exitTime = 1;

  for (const axis of ["x", "y", "z"] as const) {
    const startValue = start[axis];
    const delta = end[axis] - startValue;
    const extent = halfSize[axis];

    if (Math.abs(delta) < PARALLEL_EPSILON) {
      if (startValue < -extent || startValue > extent) return null;
      continue;
    }

    const first = (-extent - startValue) / delta;
    const second = (extent - startValue) / delta;
    const axisEntry = Math.min(first, second);
    const axisExit = Math.max(first, second);

    entryTime = Math.max(entryTime, axisEntry);
    exitTime = Math.min(exitTime, axisExit);
    if (entryTime > exitTime) return null;
  }

  return entryTime >= 0 && entryTime <= 1 ? entryTime : null;
}

const localStart = new THREE.Vector3();
const localEnd = new THREE.Vector3();
const expandedHalfSize = new THREE.Vector3();

/**
 * Moves `output` to the proposed position, or to the last safe point before the
 * earliest metro collision. Returns true when movement was blocked.
 */
export function resolveMetroMovement(
  start: THREE.Vector3,
  proposed: THREE.Vector3,
  colliders: readonly MetroCollider[],
  vehicleRadius: number,
  output: THREE.Vector3,
): boolean {
  let earliestEntry = Number.POSITIVE_INFINITY;

  for (const collider of colliders) {
    toColliderLocal(start, collider, localStart);
    toColliderLocal(proposed, collider, localEnd);
    expandedHalfSize.copy(collider.halfSize).addScalar(vehicleRadius);

    const entry = segmentExpandedBoxEntry(localStart, localEnd, expandedHalfSize);
    if (entry !== null && entry < earliestEntry) earliestEntry = entry;
  }

  if (!Number.isFinite(earliestEntry)) {
    output.copy(proposed);
    return false;
  }

  const travelDistance = start.distanceTo(proposed);
  const safeEntry = travelDistance > 0
    ? Math.max(0, earliestEntry - CONTACT_EPSILON / travelDistance)
    : 0;
  output.lerpVectors(start, proposed, safeEntry);
  return true;
}
