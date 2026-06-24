"use client";
import { useThree, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { Viewport2D } from "@/lib/spatialGrid";

const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
// A flat plane at Y=0 — we intersect camera frustum corners with it
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ray = new THREE.Ray();
const _target = new THREE.Vector3();

/** Unprojects an NDC corner through the camera onto the Y=0 ground plane */
function ndcToGround(
  camera: THREE.Camera,
  ndcX: number,
  ndcY: number,
  out: THREE.Vector3
): boolean {
  // Build a ray from the camera through the NDC point
  const ndc = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
  _ray.origin.copy(camera.position);
  _ray.direction.copy(ndc).sub(camera.position).normalize();
  const t = _groundPlane.distanceToPoint(_ray.origin) / -_groundPlane.normal.dot(_ray.direction);
  if (!isFinite(t) || t < 0) return false;
  out.copy(_ray.origin).addScaledVector(_ray.direction, t);
  return true;
}

interface Props {
  onViewportChange: (vp: Viewport2D) => void;
  /** How often to update in ms — 100ms is plenty for culling */
  intervalMs?: number;
}

export default function ViewportTracker({ onViewportChange, intervalMs = 100 }: Props) {
  const { camera } = useThree();
  const lastUpdate = useRef(0);
  const corners = [
    new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(), new THREE.Vector3(),
  ];

  useFrame((_, delta) => {
    lastUpdate.current += delta * 1000;
    if (lastUpdate.current < intervalMs) return;
    lastUpdate.current = 0;

    // Project the 4 NDC screen corners onto the ground plane
    const hits: THREE.Vector3[] = [];
    const ndcCorners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) {
      if (ndcToGround(camera, ndcCorners[i][0], ndcCorners[i][1], corners[i])) {
        hits.push(corners[i]);
      }
    }

    // Fallback: camera is looking horizontally (no ground intersection)
    // Use a wide box around camera XZ position instead
    if (hits.length < 2) {
      const fallbackRadius = 1500;
      onViewportChange({
        minX: camera.position.x - fallbackRadius,
        minZ: camera.position.z - fallbackRadius,
        maxX: camera.position.x + fallbackRadius,
        maxZ: camera.position.z + fallbackRadius,
      });
      return;
    }

    // Compute bounding box of ground intersections
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const h of hits) {
      if (h.x < minX) minX = h.x;
      if (h.x > maxX) maxX = h.x;
      if (h.z < minZ) minZ = h.z;
      if (h.z > maxZ) maxZ = h.z;
    }

    // Clamp to sane values (avoid Infinity when camera looks at horizon)
    const MAX_RANGE = 3000;
    minX = Math.max(minX, camera.position.x - MAX_RANGE);
    maxX = Math.min(maxX, camera.position.x + MAX_RANGE);
    minZ = Math.max(minZ, camera.position.z - MAX_RANGE);
    maxZ = Math.min(maxZ, camera.position.z + MAX_RANGE);

    onViewportChange({ minX, minZ, maxX, maxZ });
  });

  return null;
}