"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { VehicleMesh } from "@/components/RaidSequence3D";

function SpinningVehicle({ type }: { type: string }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.6;
  });
  return (
    <group ref={ref}>
      <VehicleMesh type={type} />
    </group>
  );
}

export default function RaidVehiclePreview({ vehicleType }: { vehicleType: string }) {
  return (
    <Canvas camera={{ position: [0, 3, 12], fov: 35 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, 2, -3]} intensity={0.3} />
      <SpinningVehicle type={vehicleType} />
    </Canvas>
  );
}
