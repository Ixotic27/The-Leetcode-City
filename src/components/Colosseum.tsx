"use client";

import React, { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ColosseumProps {
  position?: [number, number, number];
  onClick?: () => void;
  themeAccent?: string;
  themeWindowLit?: string[];
  themeFace?: string;
}

function LeetCodeSymbol({ hovered, accentColor }: { hovered: boolean; accentColor: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.8;
      groupRef.current.position.y = 230 + Math.sin(clock.getElapsedTime() * 1.5) * 10;
    }
  });

  const blockGeo = useMemo(() => new THREE.BoxGeometry(7, 7, 7), []);
  const goldMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: hovered ? 2.8 : 1.6,
    roughness: 0.2,
    metalness: 0.8,
  }), [hovered, accentColor]);

  // Voxel blocks to form a 3D blocky tilted LeetCode loop
  const blocks = [
    // Top-left to top-center
    [-2, 4, 0], [-1, 5, 0], [0, 6, 0],
    // Top-right
    [1, 5, 0],
    // Left edge
    [-3, 3, 0], [-3, 2, 0], [-3, 1, 0],
    // Bottom-left to bottom-center
    [-2, 0, 0], [-1, -1, 0], [0, -2, 0],
    // Bottom-right to right edge
    [1, -1, 0], [2, 0, 0], [3, 1, 0],
    // Right edge going up (with gap at top-right)
    [3, 2, 0],
    // Folded inner line in center
    [-1, 2, 0], [0, 2, 0], [1, 2, 0]
  ];

  return (
    <group ref={groupRef} position={[0, 230, 0]}>
      {blocks.map(([x, y, z], idx) => (
        <mesh
          key={idx}
          position={[x * 7.5, y * 7.5, z * 7.5]}
          geometry={blockGeo}
          material={goldMat}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

export default function Colosseum({
  position = [350, 0, -300],
  onClick,
  themeAccent,
  themeWindowLit,
  themeFace,
}: ColosseumProps) {
  const [hovered, setHovered] = useState(false);

  // Defaults matching the user's red/black screenshot and gold logo
  const accentColor = themeAccent || "#ffa116";
  const windowColor = (themeWindowLit && themeWindowLit[0]) || "#ff3333";
  const faceColor = themeFace || "#0c0c0c";

  // Derive base/secondary colors
  const baseColor = useMemo(() => {
    const c = new THREE.Color(faceColor);
    c.multiplyScalar(0.7);
    return "#" + c.getHexString();
  }, [faceColor]);

  const outlineColor = useMemo(() => {
    const c = new THREE.Color(windowColor);
    c.multiplyScalar(0.8);
    return "#" + c.getHexString();
  }, [windowColor]);

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
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* 1. Base Platform */}
      <group>
        {/* Main Base slab */}
        <mesh position={[0, 10, 0]} castShadow receiveShadow>
          <boxGeometry args={[340, 20, 220]} />
          <meshStandardMaterial color={baseColor} roughness={0.5} metalness={0.7} />
        </mesh>
        {/* Red outline strip around the base */}
        <mesh position={[0, 20, 0]}>
          <boxGeometry args={[342, 1.5, 222]} />
          <meshStandardMaterial
            color={outlineColor}
            emissive={outlineColor}
            emissiveIntensity={hovered ? 1.5 : 0.6}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* 2. Left Tower (at X = -85) */}
      <group position={[-85, 0, 0]}>
        {/* Lower Tower section (Y from 20 to 180) */}
        <mesh position={[0, 100, 0]} castShadow receiveShadow>
          <boxGeometry args={[80, 160, 80]} />
          <meshStandardMaterial color={faceColor} roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Red window panels on lower tower front face */}
        {[-30, -10, 10, 30].map((xOffset) =>
          [40, 70, 100, 130, 160].map((yHeight) => (
            <mesh key={`l-win-low-${xOffset}-${yHeight}`} position={[xOffset, yHeight, 40.5]}>
              <boxGeometry args={[8, 16, 1]} />
              <meshStandardMaterial
                color={windowColor}
                emissive={windowColor}
                emissiveIntensity={hovered ? 2.5 : 1.2}
                toneMapped={false}
              />
            </mesh>
          ))
        )}

        {/* Upper Tower section (Y from 180 to 440) */}
        <mesh position={[0, 310, 0]} castShadow receiveShadow>
          <boxGeometry args={[60, 260, 60]} />
          <meshStandardMaterial color={faceColor} roughness={0.35} metalness={0.7} />
        </mesh>
        {/* Tall vertical windows on upper tower front face */}
        {[-15, 15].map((xOffset) =>
          [210, 250, 290, 330, 370, 410].map((yHeight) => (
            <mesh key={`l-win-high-${xOffset}-${yHeight}`} position={[xOffset, yHeight, 30.5]}>
              <boxGeometry args={[12, 28, 1]} />
              <meshStandardMaterial
                color={windowColor}
                emissive={windowColor}
                emissiveIntensity={hovered ? 3.0 : 1.5}
                toneMapped={false}
              />
            </mesh>
          ))
        )}

        {/* Crown Spires (Top at Y = 440) */}
        {[-28, 28].map((xOffset) =>
          [-28, 28].map((zOffset) => (
            <mesh key={`l-crown-${xOffset}-${zOffset}`} position={[xOffset, 452, zOffset]} castShadow>
              <boxGeometry args={[8, 24, 8]} />
              <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.8} />
            </mesh>
          ))
        )}
        {/* Glowing red top beacon in center */}
        <mesh position={[0, 448, 0]}>
          <boxGeometry args={[16, 16, 16]} />
          <meshStandardMaterial
            color={windowColor}
            emissive={windowColor}
            emissiveIntensity={hovered ? 3.5 : 1.8}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* 3. Right Tower (at X = 85) */}
      <group position={[85, 0, 0]}>
        {/* Lower Tower section */}
        <mesh position={[0, 100, 0]} castShadow receiveShadow>
          <boxGeometry args={[80, 160, 80]} />
          <meshStandardMaterial color={faceColor} roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Red window panels on lower tower front face */}
        {[-30, -10, 10, 30].map((xOffset) =>
          [40, 70, 100, 130, 160].map((yHeight) => (
            <mesh key={`r-win-low-${xOffset}-${yHeight}`} position={[xOffset, yHeight, 40.5]}>
              <boxGeometry args={[8, 16, 1]} />
              <meshStandardMaterial
                color={windowColor}
                emissive={windowColor}
                emissiveIntensity={hovered ? 2.5 : 1.2}
                toneMapped={false}
              />
            </mesh>
          ))
        )}

        {/* Upper Tower section */}
        <mesh position={[0, 310, 0]} castShadow receiveShadow>
          <boxGeometry args={[60, 260, 60]} />
          <meshStandardMaterial color={faceColor} roughness={0.35} metalness={0.7} />
        </mesh>
        {/* Tall vertical windows on upper tower front face */}
        {[-15, 15].map((xOffset) =>
          [210, 250, 290, 330, 370, 410].map((yHeight) => (
            <mesh key={`r-win-high-${xOffset}-${yHeight}`} position={[xOffset, yHeight, 30.5]}>
              <boxGeometry args={[12, 28, 1]} />
              <meshStandardMaterial
                color={windowColor}
                emissive={windowColor}
                emissiveIntensity={hovered ? 3.0 : 1.5}
                toneMapped={false}
              />
            </mesh>
          ))
        )}

        {/* Crown Spires */}
        {[-28, 28].map((xOffset) =>
          [-28, 28].map((zOffset) => (
            <mesh key={`r-crown-${xOffset}-${zOffset}`} position={[xOffset, 452, zOffset]} castShadow>
              <boxGeometry args={[8, 24, 8]} />
              <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.8} />
            </mesh>
          ))
        )}
        {/* Glowing red top beacon in center */}
        <mesh position={[0, 448, 0]}>
          <boxGeometry args={[16, 16, 16]} />
          <meshStandardMaterial
            color={windowColor}
            emissive={windowColor}
            emissiveIntensity={hovered ? 3.5 : 1.8}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* 4. Connecting horizontal bridge */}
      <mesh position={[0, 160, 0]} castShadow receiveShadow>
        <boxGeometry args={[90, 16, 24]} />
        <meshStandardMaterial color={faceColor} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* 5. Floating LeetCode symbol in the center */}
      <LeetCodeSymbol hovered={hovered} accentColor={accentColor} />

      {/* 6. Dynamic Point Light */}
      <pointLight
        position={[0, 230, 0]}
        color={accentColor}
        intensity={hovered ? 90 : 35}
        distance={450}
        decay={2}
      />
    </group>
  );
}