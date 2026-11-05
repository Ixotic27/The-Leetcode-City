import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";

export interface BuildingChunk {
  key: string;
  buildings: CityBuilding[];
  logins: Set<string>;
  bounds: THREE.Sphere;
}

export function createBuildingChunks(buildings: CityBuilding[], size = 1500): BuildingChunk[] {
  const groups = new Map<string, CityBuilding[]>();
  for (const building of buildings) {
    const key = `${Math.floor(building.position[0] / size)},${Math.floor(building.position[2] / size)}`;
    const group = groups.get(key);
    if (group) group.push(building);
    else groups.set(key, [building]);
  }

  const point = new THREE.Vector3();
  return Array.from(groups, ([key, residents]) => {
    const box = new THREE.Box3();
    for (const building of residents) {
      const [x, , z] = building.position;
      box.expandByPoint(point.set(x - building.width / 2, 0, z - building.depth / 2));
      box.expandByPoint(point.set(x + building.width / 2, building.height, z + building.depth / 2));
    }
    return {
      key,
      buildings: residents,
      logins: new Set(residents.map((building) => building.login.toLowerCase())),
      bounds: box.getBoundingSphere(new THREE.Sphere()),
    };
  });
}

export function isChunkWithinRange(chunk: BuildingChunk, camera: THREE.Vector3, far: number): boolean {
  // The margin covers camera travel between the scene's 5 Hz visibility checks.
  return chunk.bounds.center.distanceToSquared(camera) <= (far + chunk.bounds.radius + 400) ** 2;
}

export function chunkHasFocus(chunk: BuildingChunk, focusA: string | null, focusB: string | null): boolean {
  return (focusA !== null && chunk.logins.has(focusA)) || (focusB !== null && chunk.logins.has(focusB));
}
