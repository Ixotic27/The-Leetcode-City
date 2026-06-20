"use client";

import React, { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ColosseumProps {
  /** World position offset [x, y, z]. */
  position?: [number, number, number];
  onClick?: () => void;
}

/*
 * Greek Temple / Colosseum – Daily Problems Building
 *
 * Sized to 50% of the FounderSpire (800 units) = ~400 units tall.
 * Wide, grand, and visible from the sky.
 */

export default function Colosseum({
  position = [350, 0, -300],
  onClick,
}: ColosseumProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.8 + Math.sin(clock.getElapsedTime() * 2) * 0.6;
    }
  });

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

  // ── Colors ──
  const GOLD = "#ffa116";
  const DARK = "#111111";
  const MID_DARK = "#1a1a1a";
  const LIGHT_TRIM = "#ffd700";

  // ── Dimensions — 50% of FounderSpire (800) ──
  const W = 340;           // total width (X)
  const D = 220;           // total depth (Z)
  const STEP_H = 8;        // height per step
  const STEPS = 3;
  const COL_H = 280;       // column height — main body
  const COL_R = 9;         // column radius
  const ENTABLATURE_H = 22;
  const PEDIMENT_H = 70;
  const BASE_TOP = STEPS * STEP_H;
  // Total height ≈ 24 + 280 + 22 + 70 = ~396

  const FRONT_COLS = 6;
  const SIDE_COLS = 4;

  const columnPositions = useMemo(() => {
    const cols: [number, number][] = [];
    const marginX = 32;
    const marginZ = 28;

    const xStart = -W / 2 + marginX;
    const xEnd = W / 2 - marginX;
    const zFront = D / 2 - marginZ;
    const zBack = -D / 2 + marginZ;

    // Front row
    for (let i = 0; i < FRONT_COLS; i++) {
      const t = i / (FRONT_COLS - 1);
      cols.push([xStart + t * (xEnd - xStart), zFront]);
    }
    // Back row
    for (let i = 0; i < FRONT_COLS; i++) {
      const t = i / (FRONT_COLS - 1);
      cols.push([xStart + t * (xEnd - xStart), zBack]);
    }
    // Left side (excluding corners)
    for (let i = 1; i < SIDE_COLS - 1; i++) {
      const t = i / (SIDE_COLS - 1);
      cols.push([xStart, zFront + t * (zBack - zFront)]);
    }
    // Right side
    for (let i = 1; i < SIDE_COLS - 1; i++) {
      const t = i / (SIDE_COLS - 1);
      cols.push([xEnd, zFront + t * (zBack - zFront)]);
    }

    return cols;
  }, []);

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* ═══ STEPPED BASE (Stylobate) ═══ */}
      {Array.from({ length: STEPS }).map((_, i) => {
        const stepW = W + (STEPS - i) * 22;
        const stepD = D + (STEPS - i) * 16;
        const y = i * STEP_H + STEP_H / 2;
        return (
          <group key={`step-${i}`}>
            <mesh position={[0, y, 0]} castShadow receiveShadow>
              <boxGeometry args={[stepW, STEP_H, stepD]} />
              <meshStandardMaterial
                color={i === 0 ? "#0e0e0e" : MID_DARK}
                roughness={0.35}
                metalness={0.85}
              />
            </mesh>
            <mesh position={[0, y + STEP_H / 2 + 0.1, 0]}>
              <boxGeometry args={[stepW + 0.4, 0.3, stepD + 0.4]} />
              <meshBasicMaterial color={GOLD} transparent opacity={hovered ? 0.7 : 0.3} />
            </mesh>
          </group>
        );
      })}

      {/* ═══ FLOOR PLATFORM ═══ */}
      <mesh position={[0, BASE_TOP + 1.5, 0]} receiveShadow>
        <boxGeometry args={[W + 10, 3, D + 10]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.4} metalness={0.9} />
      </mesh>

      {/* ═══ COLUMNS ═══ */}
      {columnPositions.map(([cx, cz], idx) => (
        <group key={idx} position={[cx, BASE_TOP + 3, cz]}>
          {/* Main shaft */}
          <mesh position={[0, COL_H / 2, 0]} castShadow>
            <cylinderGeometry args={[COL_R, COL_R * 1.08, COL_H, 14]} />
            <meshStandardMaterial
              color={hovered ? "#222" : DARK}
              roughness={0.2}
              metalness={0.9}
            />
          </mesh>

          {/* Fluting grooves */}
          {[0, 60, 120, 180, 240, 300].map((angle, fi) => {
            const rad = (angle * Math.PI) / 180;
            const fx = Math.cos(rad) * (COL_R + 0.3);
            const fz = Math.sin(rad) * (COL_R + 0.3);
            return (
              <mesh key={fi} position={[fx, COL_H / 2, fz]}>
                <boxGeometry args={[0.8, COL_H - 6, 0.8]} />
                <meshStandardMaterial
                  color={GOLD}
                  emissive={GOLD}
                  emissiveIntensity={hovered ? 2.5 : 0.8}
                />
              </mesh>
            );
          })}

          {/* Capital (Doric abacus) */}
          <mesh position={[0, COL_H + 4, 0]}>
            <boxGeometry args={[COL_R * 2.8, 8, COL_R * 2.8]} />
            <meshStandardMaterial color={MID_DARK} roughness={0.3} metalness={0.85} />
          </mesh>

          {/* Base torus */}
          <mesh position={[0, 2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[COL_R * 1.15, 1.5, 8, 14]} />
            <meshStandardMaterial color={MID_DARK} roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* ═══ ENTABLATURE ═══ */}
      {(() => {
        const entY = BASE_TOP + 3 + COL_H + 8 + ENTABLATURE_H / 2;
        return (
          <>
            <mesh position={[0, entY, 0]} castShadow>
              <boxGeometry args={[W + 6, ENTABLATURE_H, D + 6]} />
              <meshStandardMaterial color={DARK} roughness={0.25} metalness={0.9} />
            </mesh>
            {/* Top gold trim (offset slightly upwards to avoid z-fighting with entablature top) */}
            <mesh position={[0, entY + ENTABLATURE_H / 2 - 1.8, 0]}>
              <boxGeometry args={[W + 7, 4, D + 7]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={hovered ? 4 : 1.5} />
            </mesh>
            {/* Bottom gold trim (offset slightly upwards to avoid z-fighting with entablature bottom) */}
            <mesh position={[0, entY - ENTABLATURE_H / 2 + 1.8, 0]}>
              <boxGeometry args={[W + 7, 3, D + 7]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={hovered ? 3 : 1.0} />
            </mesh>
            {/* Dentil row */}
            {Array.from({ length: 20 }).map((_, i) => {
              const xPos = -W / 2 + 20 + i * ((W - 40) / 19);
              return (
                <mesh key={`dentil-${i}`} position={[xPos, entY - 3, D / 2 + 3.5]}>
                  <boxGeometry args={[6, 5, 3]} />
                  <meshStandardMaterial color={MID_DARK} roughness={0.3} metalness={0.85} />
                </mesh>
              );
            })}
          </>
        );
      })()}

      {/* ═══ TRIANGULAR PEDIMENT (front & back) ═══ */}
      {[1, -1].map((side) => {
        const pedimentY = BASE_TOP + 3 + COL_H + 8 + ENTABLATURE_H;
        const pedimentZ = side * (D / 2 + 3);
        const groupRotation: [number, number, number] = [0, side > 0 ? 0 : Math.PI, 0];

        return (
          <group
            key={`pediment-${side}`}
            position={[0, pedimentY, pedimentZ]}
            rotation={groupRotation}
          >
            {/* Main triangle */}
            <mesh>
              <extrudeGeometry
                args={[
                  (() => {
                    const shape = new THREE.Shape();
                    shape.moveTo(-W / 2 - 3, 0);
                    shape.lineTo(W / 2 + 3, 0);
                    shape.lineTo(0, PEDIMENT_H);
                    shape.closePath();
                    return shape;
                  })(),
                  { depth: 8, bevelEnabled: false },
                ]}
              />
              <meshStandardMaterial color={DARK} roughness={0.25} metalness={0.9} />
            </mesh>

            {/* Inner tympanum glow */}
            <mesh
              ref={side > 0 ? glowRef : undefined}
              position={[0, PEDIMENT_H * 0.35, 8.5]}
            >
              <extrudeGeometry
                args={[
                  (() => {
                    const shape = new THREE.Shape();
                    const s = 0.6;
                    shape.moveTo(-W / 2 * s, 0);
                    shape.lineTo(W / 2 * s, 0);
                    shape.lineTo(0, PEDIMENT_H * s);
                    shape.closePath();
                    return shape;
                  })(),
                  { depth: 1.5, bevelEnabled: false },
                ]}
              />
              <meshStandardMaterial
                color={GOLD}
                emissive={GOLD}
                emissiveIntensity={hovered ? 4 : 2}
                transparent
                opacity={0.9}
              />
            </mesh>

            {/* Raking cornice — left slope */}
            <mesh
              position={[-W / 4 - 1, PEDIMENT_H / 2, 9]}
              rotation={[0, 0, Math.atan2(PEDIMENT_H, W / 2 + 3)]}
            >
              <boxGeometry args={[Math.sqrt((W / 2 + 3) ** 2 + PEDIMENT_H ** 2) / 2 + 5, 3.5, 4]} />
              <meshStandardMaterial color={LIGHT_TRIM} emissive={GOLD} emissiveIntensity={hovered ? 3 : 1} />
            </mesh>
            {/* Raking cornice — right slope */}
            <mesh
              position={[W / 4 + 1, PEDIMENT_H / 2, 9]}
              rotation={[0, 0, -Math.atan2(PEDIMENT_H, W / 2 + 3)]}
            >
              <boxGeometry args={[Math.sqrt((W / 2 + 3) ** 2 + PEDIMENT_H ** 2) / 2 + 5, 3.5, 4]} />
              <meshStandardMaterial color={LIGHT_TRIM} emissive={GOLD} emissiveIntensity={hovered ? 3 : 1} />
            </mesh>

            {/* Peak acroterion */}
            <mesh position={[0, PEDIMENT_H + 8, 4]}>
              <octahedronGeometry args={[8, 0]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={hovered ? 5 : 2} />
            </mesh>

            {/* Corner acroteria */}
            {[-W / 2 - 3, W / 2 + 3].map((xc, ci) => (
              <mesh key={ci} position={[xc, 6, 4]}>
                <sphereGeometry args={[5, 8, 8]} />
                <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={hovered ? 4 : 1.5} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* ═══ INTERIOR CELLA WALLS ═══ */}
      <mesh position={[0, BASE_TOP + 3 + COL_H / 2, -D / 2 + 36]}>
        <boxGeometry args={[W - 72, COL_H, 5]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[-W / 2 + 36, BASE_TOP + 3 + COL_H / 2, 0]}>
        <boxGeometry args={[5, COL_H, D - 72]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[W / 2 - 36, BASE_TOP + 3 + COL_H / 2, 0]}>
        <boxGeometry args={[5, COL_H, D - 72]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* ═══ INTERIOR CODING ICON (< / >) ═══ */}
      <group position={[0, BASE_TOP + 3 + COL_H / 2, 0]}>
        {/* '<' bracket */}
        <group position={[-22, 0, 0]}>
          <mesh position={[0, 12, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[3, 22, 3]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={3} />
          </mesh>
          <mesh position={[0, -12, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[3, 22, 3]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={3} />
          </mesh>
        </group>
        {/* '/' slash */}
        <mesh rotation={[0, 0, Math.PI / 7]}>
          <boxGeometry args={[2.5, 45, 2.5]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={4} />
        </mesh>
        {/* '>' bracket */}
        <group position={[22, 0, 0]}>
          <mesh position={[0, 12, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[3, 22, 3]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={3} />
          </mesh>
          <mesh position={[0, -12, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[3, 22, 3]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={3} />
          </mesh>
        </group>
      </group>

      {/* ═══ SPOTLIGHT BEAM ═══ */}
      <mesh position={[0, BASE_TOP + 3 + COL_H + ENTABLATURE_H + PEDIMENT_H + 100, 0]}>
        <cylinderGeometry args={[20, 55, 200, 16, 1, true]} />
        <meshBasicMaterial
          color={GOLD}
          transparent
          opacity={hovered ? 0.12 : 0.04}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ═══ POINT LIGHT ═══ */}
      <pointLight
        position={[0, BASE_TOP + 3 + COL_H / 2, 0]}
        color={GOLD}
        intensity={hovered ? 80 : 30}
        distance={350}
        decay={2}
      />
    </group>
  );
}
