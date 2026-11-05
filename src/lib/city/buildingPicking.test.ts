import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";
import { pickNearestBuilding, type BuildingPickTarget } from "./buildingPicking";

const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshBasicMaterial();
const raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
const hits: THREE.Intersection[] = [];
const target = (login: string, z: number): BuildingPickTarget => {
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, z));
  mesh.updateMatrixWorld();
  return { mesh, buildings: [{ login } as CityBuilding] };
};

afterEach(() => { hits.length = 0; });

describe("building picking", () => {
  it("chooses the nearest building across chunks regardless of registration order", () => {
    const far = target("far", -20), near = target("near", -10);
    expect(pickNearestBuilding(raycaster, [far, near], hits)?.login).toBe("near");
    expect(pickNearestBuilding(raycaster, [near, far], hits)?.login).toBe("near");
    expect(hits).toHaveLength(0);
  });

  it("ignores chunks hidden by any parent", () => {
    const far = target("far", -20), near = target("hidden", -10);
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(near.mesh);
    hidden.updateMatrixWorld();
    expect(pickNearestBuilding(raycaster, [near, far], hits)?.login).toBe("far");
    far.mesh.visible = false;
    expect(pickNearestBuilding(raycaster, [near, far], hits)).toBeNull();
  });

  it("returns the correct instance and ignores a hit without a resident", () => {
    const mesh = new THREE.InstancedMesh(geometry, material, 2);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, -20));
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 0, -10));
    mesh.updateMatrixWorld();
    const residents = [{ login: "far" }, { login: "near" }] as CityBuilding[];
    expect(pickNearestBuilding(raycaster, [{ mesh, buildings: residents }], hits)?.login).toBe("near");
    expect(pickNearestBuilding(raycaster, [{ mesh, buildings: residents.slice(0, 1) }], hits)?.login).toBe("far");
  });
});
