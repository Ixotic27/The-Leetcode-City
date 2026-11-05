import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";

export interface BuildingPickTarget {
  mesh: THREE.InstancedMesh;
  buildings: readonly CityBuilding[];
}

export function pickNearestBuilding(
  raycaster: THREE.Raycaster,
  targets: Iterable<BuildingPickTarget>,
  hits: THREE.Intersection[],
): CityBuilding | null {
  let nearestDistance = Infinity;
  let nearest: CityBuilding | null = null;
  for (const { mesh, buildings } of targets) {
    let object: THREE.Object3D | null = mesh;
    while (object?.visible) object = object.parent;
    if (object) continue;
    hits.length = 0;
    mesh.raycast(raycaster, hits);
    for (const hit of hits) {
      if (hit.instanceId === undefined || hit.distance >= nearestDistance) continue;
      const building = buildings[hit.instanceId];
      if (!building) continue;
      nearestDistance = hit.distance;
      nearest = building;
    }
  }
  hits.length = 0;
  return nearest;
}
