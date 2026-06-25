"use client";
import { useThree, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { Viewport2D } from "@/lib/spatialGrid";

// Pre-allocated to avoid GC pressure in useFrame
const _ray = new THREE.Ray();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _corners = [
  new THREE.Vector3(), new THREE.Vector3(),
  new THREE.Vector3(), new THREE.Vector3(),
];
const _ndc = new THREE.Vector3();

/**
 * Unprojects an NDC point through the camera and intersects with Y=0 ground plane.
 * Returns false if the ray points away from the ground (camera looking up/horizontal).
 */
function ndcToGround(camera: THREE.Camera, ndcX: number, ndcY: number, out: THREE.Vector3): boolean {
  _ndc.set(ndcX, ndcY, 0.5).unproject(camera);
  _ray.origin.copy(camera.position);
  _ray.direction.copy(_ndc).sub(camera.position).normalize();

  // dot(normal, direction) — if >= 0 ray is parallel or pointing away from ground
  const denom = _groundPlane.normal.dot(_ray.direction);
  if (denom >= -0.0001) return false;

  const t = -(_groundPlane.distanceToPoint(_ray.origin)) / denom;
  if (t < 0 || !isFinite(t)) return false;

  out.copy(_ray.origin).addScaledVector(_ray.direction, t);
  return true;
}

const NDC_CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

interface Props {
  onViewportChange: (vp: Viewport2D) => void;
  /**
   * How often to recompute (ms). 200ms gives smooth culling without
   * triggering excessive React re-renders during fast orbit.
   */
  intervalMs?: number;
}

export default function ViewportTracker({ onViewportChange, intervalMs = 200 }: Props) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  // Store last emitted viewport to skip unchanged updates
  const lastVp = useRef<Viewport2D>({ minX: -9999, minZ: -9999, maxX: 9999, maxZ: 9999 });

  useFrame((_, delta) => {
    elapsed.current += delta * 1000;
    if (elapsed.current < intervalMs) return;
    elapsed.current = 0;

    const hits: THREE.Vector3[] = [];

    for (let i = 0; i < 4; i++) {
      if (ndcToGround(camera, NDC_CORNERS[i][0], NDC_CORNERS[i][1], _corners[i])) {
        hits.push(_corners[i]);
      }
    }

    let minX: number, minZ: number, maxX: number, maxZ: number;

    if (hits.length < 2) {
      // Camera is looking nearly horizontal or upward — use a wide fallback
      // centered on where the camera is pointing at ground level
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);

      // Project camera forward direction onto ground to find approximate look-at point
      let lookX = camera.position.x;
      let lookZ = camera.position.z;
      if (Math.abs(camDir.y) > 0.01) {
        const t = -camera.position.y / camDir.y;
        if (t > 0 && t < 5000) {
          lookX = camera.position.x + camDir.x * t;
          lookZ = camera.position.z + camDir.z * t;
        }
      }

      // Wide fallback — show everything within 2500 units of look target
      const R = 2500;
      minX = lookX - R; minZ = lookZ - R;
      maxX = lookX + R; maxZ = lookZ + R;
    } else {
      minX = Infinity; minZ = Infinity; maxX = -Infinity; maxZ = -Infinity;
      for (const h of hits) {
        if (h.x < minX) minX = h.x;
        if (h.x > maxX) maxX = h.x;
        if (h.z < minZ) minZ = h.z;
        if (h.z > maxZ) maxZ = h.z;
      }

      // Cap at 4000 units — beyond this everything is fog anyway
      const MAX = 4000;
      const cx = camera.position.x;
      const cz = camera.position.z;
      minX = Math.max(minX, cx - MAX);
      maxX = Math.min(maxX, cx + MAX);
      minZ = Math.max(minZ, cz - MAX);
      maxZ = Math.min(maxZ, cz + MAX);
    }

    // Skip update if viewport hasn't changed meaningfully (50 unit threshold)
    const prev = lastVp.current;
    const THRESHOLD = 50;
    if (
      Math.abs(minX - prev.minX) < THRESHOLD &&
      Math.abs(minZ - prev.minZ) < THRESHOLD &&
      Math.abs(maxX - prev.maxX) < THRESHOLD &&
      Math.abs(maxZ - prev.maxZ) < THRESHOLD
    ) return;

    const vp: Viewport2D = { minX, minZ, maxX, maxZ };
    lastVp.current = vp;
    onViewportChange(vp);
  });

  return null;
}
