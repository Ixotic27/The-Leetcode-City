"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const CAR_COUNT = 30;
const ROAD_Y = 2.5;
const TRAFFIC_RADIUS = 700;

type CarData = {
  progress: number;
  speed: number;
  variant: number;
  laneOffset: number;
};

export default function TrafficSystem() {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const bodyGeometry = useMemo(() => new THREE.BoxGeometry(35, 8, 16), []);
  const cabinGeometry = useMemo(() => new THREE.BoxGeometry(20, 6, 12), []);

  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#808080",
        emissive: "#808080",
        emissiveIntensity: 1,
        roughness: 0.75,
        metalness: 0.15,
      }),
    []
  );

  const cabinMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#505050",
        emissive: "#505050",
        emissiveIntensity: 1,
        roughness: 0.7,
        metalness: 0.1,
      }),
    []
  );

  const carColors = useMemo(
    () => [
      new THREE.Color("#ff3030"),
      new THREE.Color("#30d0ff"),
      new THREE.Color("#ffd930"),
      new THREE.Color("#ff4dff"),
      new THREE.Color("#40ff70"),
    ],
    []
  );

  const cars = useMemo<CarData[]>(() => {
    return Array.from({ length: CAR_COUNT }, (_, index) => ({
      progress: index / CAR_COUNT,
      speed: 0.018 + Math.random() * 0.015,
      variant: index % carColors.length,
      laneOffset: index % 2 === 0 ? -12 : 12,
    }));
  }, [carColors.length]);

  useEffect(() => {
    if (!bodyRef.current || !cabinRef.current) return;

    for (let i = 0; i < cars.length; i++) {
      const color = carColors[cars[i].variant];
      bodyRef.current.setColorAt(i, color);
      cabinRef.current.setColorAt(i, color);
    }

    if (bodyRef.current.instanceColor) {
      bodyRef.current.instanceColor.needsUpdate = true;
    }

    if (cabinRef.current.instanceColor) {
      cabinRef.current.instanceColor.needsUpdate = true;
    }
  }, [cars, carColors]);

  useFrame((_, delta) => {
    if (!bodyRef.current || !cabinRef.current) return;

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      car.progress = (car.progress + car.speed * delta) % 1;

      const angle = car.progress * Math.PI * 2;
      const radius = TRAFFIC_RADIUS + car.laneOffset;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = ROAD_Y;

      const rotationY = -angle + Math.PI / 2;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyRef.current.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, y + 7, z);
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cabinRef.current.setMatrixAt(i, dummy.matrix);
    }

    bodyRef.current.instanceMatrix.needsUpdate = true;
    cabinRef.current.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    return () => {
      bodyGeometry.dispose();
      cabinGeometry.dispose();
      bodyMaterial.dispose();
      cabinMaterial.dispose();
    };
  }, [bodyGeometry, cabinGeometry, bodyMaterial, cabinMaterial]);

  return (
    <>
      <instancedMesh
        ref={bodyRef}
        args={[bodyGeometry, bodyMaterial, CAR_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={cabinRef}
        args={[cabinGeometry, cabinMaterial, CAR_COUNT]}
        frustumCulled={false}
      />
    </>
  );
}