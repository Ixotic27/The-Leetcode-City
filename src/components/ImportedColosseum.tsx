"use client";

import React, { useRef, useState, useMemo } from "react";
import { useGLTF, Clone } from "@react-three/drei";
import * as THREE from "three";

interface ImportedColosseumProps {
  /** World position offset [x, y, z]. Default is symmetrical to the other Colosseum. */
  position?: [number, number, number];
  onClick?: () => void;
}

export default function ImportedColosseum({
  position = [-350, 0, 300],
  onClick,
}: ImportedColosseumProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Load the GLB model from public folder
  const { scene } = useGLTF("/models/colosseum-model.glb");

  // Dynamically calculate the scale to match the other Colosseum's dimensions:
  // Other Colosseum width (W) = 340, depth (D) = 220, height = ~396
  const computedScale = useMemo(() => {
    if (!scene) return [1, 1, 1] as [number, number, number];
    
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);

    const targetWidth = 340;
    const targetDepth = 220;
    const targetHeight = 396;

    // We scale uniformly based on the horizontal dimensions to avoid visual distortion/stretching of the 3D model.
    // If size.x or size.z is close to 0, fallback to default.
    const sizeX = Math.max(0.1, size.x);
    const sizeZ = Math.max(0.1, size.z);
    const sizeY = Math.max(0.1, size.y);

    // Calculate scale factor using the horizontal bounds to match the other building's size
    const factorX = targetWidth / sizeX;
    const factorZ = targetDepth / sizeZ;
    const factor = Math.min(factorX, factorZ);

    // If height needs to match, we can scale height uniformly or non-uniformly if requested.
    // Let's use uniform scale so it matches the proportions correctly.
    return [factor, factor, factor] as [number, number, number];
  }, [scene]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (onClick) onClick();
    else window.location.href = "/arena";
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "auto";
  };

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Glow / highlight outline effect when hovered */}
      {hovered && (
        <mesh position={[0, 198, 0]}>
          <boxGeometry args={[350, 400, 230]} />
          <meshBasicMaterial
            color="#ffa116"
            wireframe
            transparent
            opacity={0.3}
          />
        </mesh>
      )}

      {/* Render the cloned model scene with the calculated scale */}
      <Clone
        object={scene}
        position={[0, 0, 0]}
        scale={computedScale}
        castShadow
        receiveShadow
      />

      {/* Point light matching the design theme */}
      <pointLight
        position={[0, 100, 0]}
        color="#ffa116"
        intensity={hovered ? 80 : 30}
        distance={350}
        decay={2}
      />
    </group>
  );
}

// Preload the asset to avoid pop-in
useGLTF.preload("/models/colosseum-model.glb");
