"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { DistrictIsland } from "@/lib/city/world";

function islandShape(width: number, depth: number): THREE.Shape {
  const x = width / 2, z = depth / 2;
  const corner = Math.min(36, x / 3, z / 3);
  const shape = new THREE.Shape();
  shape.moveTo(-x + corner, -z);
  shape.lineTo(x - corner, -z);
  shape.quadraticCurveTo(x, -z, x, -z + corner);
  shape.lineTo(x, z - corner);
  shape.quadraticCurveTo(x, z, x - corner, z);
  shape.lineTo(-x + corner, z);
  shape.quadraticCurveTo(-x, z, -x, z - corner);
  shape.lineTo(-x, -z + corner);
  shape.quadraticCurveTo(-x, -z, -x + corner, -z);
  return shape;
}

/** Bounds and shore separation follow Git City's data-derived island approach. */
export default function DistrictIslands({ islands, color }: { islands: DistrictIsland[]; color: string }) {
  const terrain = useMemo(() => islands.map((island) => ({
    ...island,
    land: new THREE.ShapeGeometry(islandShape(island.width, island.depth), 6),
    sand: new THREE.ShapeGeometry(islandShape(island.width + 48, island.depth + 48), 6),
  })), [islands]);

  useEffect(() => () => terrain.forEach(({ land, sand }) => {
    land.dispose();
    sand.dispose();
  }), [terrain]);

  return <group>
    {terrain.map((island) => <group key={island.id} position={[island.center[0], 0, island.center[1]]}>
      <mesh geometry={island.sand} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
        <meshStandardMaterial color="#9b8964" roughness={1} />
      </mesh>
      <mesh geometry={island.land} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} roughness={0.95} />
      </mesh>
    </group>)}
  </group>;
}
