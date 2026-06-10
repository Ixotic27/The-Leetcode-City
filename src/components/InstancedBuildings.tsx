import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const InstancedBuildings: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, 100]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4f46e5" />
    </instancedMesh>
  );
};
