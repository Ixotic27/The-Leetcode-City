"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function CinematicDroneTour({ active }: { active: boolean }) {
  const cameraRef = useRef<THREE.Camera | null>(null);

  useFrame((state) => {
    if (!active) return;

    // Use elapsedTime as the clock variable (t) to drive the continuous tour
    const t = state.clock.getElapsedTime() * 0.15; // Multiply by 0.15 to keep it steady and cinematic

    // Calculate circular coordinates orbiting around the center of the city
    const radius = 120; // The distance / radius away from the center matrix
    const x = Math.sin(t) * radius;
    const z = Math.cos(t) * radius;
    const y = 45 + Math.sin(t * 2) * 15; // Smoothly bob up and down over time for dynamic altitude shifts

    // Dynamically update the camera's structural position configurations
    state.camera.position.set(x, y, z);

    // Explicitly clamp the lens vector focus to look directly at the center of the grid coordinate map
    state.camera.lookAt(0, 5, 0);
  });

  return null;
}
