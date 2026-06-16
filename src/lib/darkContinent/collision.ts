import * as THREE from "three";

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

// Reusable temp objects to avoid garbage collection
const _tmpM = new THREE.Matrix4();
const _tmpV = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _delta = new THREE.Vector3();

/**
 * Extract AABB from a single instance matrix.
 * The matrix encodes scale in column magnitudes and translation in column 3.
 * halfExtents is for a unit geometry (e.g. [0.5, 0.5, 0.5] for BoxGeometry).
 */
export function instanceMatrixToAABB(
  matrix: THREE.Matrix4,
  halfExtents: THREE.Vector3 = new THREE.Vector3(0.5, 0.5, 0.5)
): AABB {
  // Extract scale from column magnitudes
  const el = matrix.elements; // column-major
  const sx = Math.sqrt(el[0]*el[0] + el[1]*el[1] + el[2]*el[2]);
  const sy = Math.sqrt(el[4]*el[4] + el[5]*el[5] + el[6]*el[6]);
  const sz = Math.sqrt(el[8]*el[8] + el[9]*el[9] + el[10]*el[10]);
  // Extract translation from column 3
  const tx = el[12];
  const ty = el[13];
  const tz = el[14];

  const ex = halfExtents.x * sx;
  const ey = halfExtents.y * sy;
  const ez = halfExtents.z * sz;

  return {
    min: new THREE.Vector3(tx - ex, ty - ey, tz - ez),
    max: new THREE.Vector3(tx + ex, ty + ey, tz + ez),
  };
}

/**
 * Compute one AABB per instance from an InstancedMesh.
 * Uses the mesh's own geometry bounding box half-extents if available,
 * falling back to [0.5, 0.5, 0.5] for unit geometries.
 */
export function computeInstanceAABBs(
  mesh: THREE.InstancedMesh,
  halfExtents?: THREE.Vector3
): AABB[] {
  // Compute geometry half-extents once
  let he = halfExtents;
  if (!he) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb) {
      const size = new THREE.Vector3();
      bb.getSize(size);
      he = size.multiplyScalar(0.5);
    } else {
      he = new THREE.Vector3(0.5, 0.5, 0.5);
    }
  }

  const aabbs: AABB[] = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    aabbs.push(instanceMatrixToAABB(m, he));
  }
  return aabbs;
}

/**
 * Find the closest point on an AABB to the given point.
 */
export function closestPointOnAABB(
  point: THREE.Vector3,
  aabb: AABB
): THREE.Vector3 {
  return new THREE.Vector3(
    Math.max(aabb.min.x, Math.min(point.x, aabb.max.x)),
    Math.max(aabb.min.y, Math.min(point.y, aabb.max.y)),
    Math.max(aabb.min.z, Math.min(point.z, aabb.max.z))
  );
}

/**
 * Test sphere vs AABB and return penetration push vector.
 * Returns a zero-length vector if no intersection.
 * If intersecting, returns the vector to push the sphere OUT of the AABB.
 */
export function sphereAABBPenetration(
  sphereCenter: THREE.Vector3,
  sphereRadius: number,
  aabb: AABB
): THREE.Vector3 {
  const closest = closestPointOnAABB(sphereCenter, aabb);
  const dx = sphereCenter.x - closest.x;
  const dy = sphereCenter.y - closest.y;
  const dz = sphereCenter.z - closest.z;
  const distSq = dx*dx + dy*dy + dz*dz;

  if (distSq >= sphereRadius * sphereRadius) {
    return new THREE.Vector3(0, 0, 0);
  }

  const dist = Math.sqrt(distSq);
  const penetration = sphereRadius - dist;

  // If sphere center is exactly at closest point (inside AABB), push up
  if (dist < 0.0001) {
    return new THREE.Vector3(0, penetration, 0);
  }

  return new THREE.Vector3(
    (dx / dist) * penetration,
    (dy / dist) * penetration,
    (dz / dist) * penetration
  );
}

/**
 * Clamp speed to flight range [30, 400]
 */
export function clampSpeed(speed: number): number {
  return Math.max(30, Math.min(400, speed));
}

/**
 * Clamp pitch to ±75 degrees in radians
 */
export function clampPitch(pitch: number): number {
  const MAX_PITCH = Math.PI * 75 / 180;
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
}
