import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  createMetroLayout,
  resolveMetroMovement,
  type MetroCollider,
} from "../metroCollisions";

const testOrigins: Record<string, [number, number, number]> = {
  downtown: [0, 0, 0],
  fullstack: [100, 0, 100],
  devops: [200, 0, 0],
};

describe("metro collision layout", () => {
  it("uses the same route and station coordinates for rendering and collisions", () => {
    const layout = createMetroLayout(testOrigins);

    expect(layout.trackSegments).toHaveLength(2);
    expect(layout.stations).toHaveLength(3);
    expect(layout.trackSegments[0].start.toArray()).toEqual([450, 40, 450]);
    expect(layout.trackSegments[0].end.toArray()).toEqual([550, 40, 550]);
    expect(layout.stations[0].position).toEqual([450, 0, 450]);
    expect(layout.colliders.filter((collider) => collider.kind === "track")).toHaveLength(2);
    expect(layout.colliders.filter((collider) => collider.id.startsWith("station-pillar"))).toHaveLength(18);
  });

  it("blocks movement across a diagonal track without using an oversized world AABB", () => {
    const layout = createMetroLayout(testOrigins);
    const track = layout.colliders.find((collider) => collider.id === "track-bengaluru-delhi");
    expect(track).toBeDefined();

    const perpendicular = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
    const start = track!.center.clone().addScaledVector(perpendicular, 20);
    const proposed = track!.center.clone().addScaledVector(perpendicular, -20);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [track!], 2, output)).toBe(true);
    expect(output.clone().sub(track!.center).dot(perpendicular)).toBeGreaterThan(8.9);
  });

  it("allows movement that passes safely above the elevated track", () => {
    const layout = createMetroLayout(testOrigins);
    const track = layout.colliders.find((collider) => collider.kind === "track");
    expect(track).toBeDefined();

    const start = new THREE.Vector3(track!.center.x - 30, 80, track!.center.z);
    const proposed = new THREE.Vector3(track!.center.x + 30, 80, track!.center.z);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [track!], 2, output)).toBe(false);
    expect(output.toArray()).toEqual(proposed.toArray());
  });
});

describe("metro movement resolution", () => {
  const pillar: MetroCollider = {
    id: "test-pillar",
    kind: "pillar",
    center: new THREE.Vector3(0, 20, 0),
    halfSize: new THREE.Vector3(2, 20, 2),
    yaw: 0,
  };

  it("prevents high-speed movement from tunnelling through a pillar", () => {
    const start = new THREE.Vector3(-100, 20, 0);
    const proposed = new THREE.Vector3(100, 20, 0);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [pillar], 1, output)).toBe(true);
    expect(output.x).toBeCloseTo(-3.05, 5);
    expect(output.y).toBe(20);
    expect(output.z).toBe(0);
  });

  it("does not trap a vehicle that starts inside legacy collision geometry", () => {
    const start = new THREE.Vector3(0, 20, 0);
    const proposed = new THREE.Vector3(10, 20, 0);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [pillar], 1, output)).toBe(false);
    expect(output.toArray()).toEqual(proposed.toArray());
  });

  it("blocks inward movement that starts exactly on the expanded collider boundary", () => {
    const start = new THREE.Vector3(3, 20, 0);
    const proposed = new THREE.Vector3(0, 20, 0);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [pillar], 1, output)).toBe(true);
    expect(output.toArray()).toEqual(start.toArray());
  });

  it("allows outward movement that starts exactly on the expanded collider boundary", () => {
    const start = new THREE.Vector3(3, 20, 0);
    const proposed = new THREE.Vector3(10, 20, 0);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [pillar], 1, output)).toBe(false);
    expect(output.toArray()).toEqual(proposed.toArray());
  });

  it("allows tangential movement along the expanded collider boundary", () => {
    const start = new THREE.Vector3(3, 20, 0);
    const proposed = new THREE.Vector3(3, 20, 10);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [pillar], 1, output)).toBe(false);
    expect(output.toArray()).toEqual(proposed.toArray());
  });

  it("blocks inward movement from a numerically near-boundary position", () => {
    const start = new THREE.Vector3(3 - 5e-9, 20, 0);
    const proposed = new THREE.Vector3(0, 20, 0);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [pillar], 1, output)).toBe(true);
    expect(output.toArray()).toEqual(start.toArray());
  });

  it("blocks sub-epsilon inward movement from the boundary", () => {
    const start = new THREE.Vector3(3, 20, 0);
    const proposed = new THREE.Vector3(3 - 5e-9, 20, 0);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [pillar], 1, output)).toBe(true);
    expect(output.toArray()).toEqual(start.toArray());
  });

  it("blocks a vehicle from re-entering after it has left a collider", () => {
    const start = new THREE.Vector3(10, 20, 0);
    const proposed = new THREE.Vector3(0, 20, 0);
    const output = new THREE.Vector3();

    expect(resolveMetroMovement(start, proposed, [pillar], 1, output)).toBe(true);
    expect(output.x).toBeGreaterThan(3);
  });
});
