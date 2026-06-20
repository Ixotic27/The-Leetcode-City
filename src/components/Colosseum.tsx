"use client";

import React, { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ColosseumProps {
  position?: [number, number, number];
  onClick?: () => void;
}

export default function Colosseum({
  position = [350, 0, -300],
  onClick,
}: ColosseumProps) {
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.25;
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

  const THEME = {
    obsidian: "#050806",
    deepGreen: "#07160f",
    forest: "#0d2518",
    graphite: "#121812",
    stone: "#20281e",
    gold: "#f0c45a",
    amber: "#c8752f",
    cyan: "#63d7ff",
  };

  const DARK = hovered ? THEME.deepGreen : THEME.obsidian;
  const MID_DARK = hovered ? THEME.stone : THEME.graphite;

  const W = 340;
  const D = 220;
  const STEP_H = 8;
  const STEPS = 3;
  const COL_H = 280;
  const COL_R = 9;
  const ENTABLATURE_H = 22;
  const PEDIMENT_H = 70;
  const BASE_TOP = STEPS * STEP_H;

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

    for (let i = 0; i < FRONT_COLS; i++) {
      const t = i / (FRONT_COLS - 1);
      cols.push([xStart + t * (xEnd - xStart), zFront]);
      cols.push([xStart + t * (xEnd - xStart), zBack]);
    }

    for (let i = 1; i < SIDE_COLS - 1; i++) {
      const t = i / (SIDE_COLS - 1);
      cols.push([xStart, zFront + t * (zBack - zFront)]);
      cols.push([xEnd, zFront + t * (zBack - zFront)]);
    }

    return cols;
  }, []);

  return (
    <group
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Dark stepped base */}
      {Array.from({ length: STEPS }).map((_, i) => {
        const stepW = W + (STEPS - i) * 22;
        const stepD = D + (STEPS - i) * 16;
        const y = i * STEP_H + STEP_H / 2;

        return (
          <group key={`step-${i}`}>
            <mesh position={[0, y, 0]} castShadow receiveShadow>
              <boxGeometry args={[stepW, STEP_H, stepD]} />
              <meshStandardMaterial
                color={i === 0 ? THEME.obsidian : MID_DARK}
                roughness={0.45}
                metalness={0.65}
              />
            </mesh>

            <mesh position={[0, y + STEP_H / 2 + 0.1, 0]}>
              <boxGeometry args={[stepW + 0.4, 0.25, stepD + 0.4]} />
              <meshBasicMaterial
                color={THEME.gold}
                transparent
                opacity={hovered ? 0.5 : 0.25}
              />
            </mesh>
          </group>
        );
      })}

      {/* Main floor */}
      <mesh position={[0, BASE_TOP + 1.5, 0]} receiveShadow>
        <boxGeometry args={[W + 10, 3, D + 10]} />
        <meshStandardMaterial color={THEME.obsidian} roughness={0.45} metalness={0.75} />
      </mesh>

      {/* Low-poly temple columns */}
      {columnPositions.map(([cx, cz], idx) => (
        <group key={idx} position={[cx, BASE_TOP + 3, cz]}>
          <mesh position={[0, COL_H / 2, 0]} castShadow>
            <cylinderGeometry args={[COL_R, COL_R * 1.08, COL_H, 6]} />
            <meshStandardMaterial color={DARK} roughness={0.35} metalness={0.75} />
          </mesh>

          {[0, 120, 240].map((angle, fi) => {
            const rad = (angle * Math.PI) / 180;
            const fx = Math.cos(rad) * (COL_R + 0.3);
            const fz = Math.sin(rad) * (COL_R + 0.3);

            return (
              <mesh key={fi} position={[fx, COL_H / 2, fz]}>
                <boxGeometry args={[1, COL_H - 10, 1]} />
                <meshStandardMaterial
                  color={THEME.gold}
                  emissive={THEME.gold}
                  emissiveIntensity={hovered ? 1.25 : 0.45}
                  roughness={0.45}
                  metalness={0.45}
                />
              </mesh>
            );
          })}

          <mesh position={[0, COL_H + 4, 0]}>
            <boxGeometry args={[COL_R * 3, 8, COL_R * 3]} />
            <meshStandardMaterial color={MID_DARK} roughness={0.38} metalness={0.7} />
          </mesh>

          <mesh position={[0, 3, 0]}>
            <boxGeometry args={[COL_R * 2.7, 6, COL_R * 2.7]} />
            <meshStandardMaterial color={MID_DARK} roughness={0.38} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Entablature */}
      {(() => {
        const entY = BASE_TOP + 3 + COL_H + 8 + ENTABLATURE_H / 2;

        return (
          <>
            <mesh position={[0, entY, 0]} castShadow>
              <boxGeometry args={[W + 6, ENTABLATURE_H, D + 6]} />
              <meshStandardMaterial color={DARK} roughness={0.35} metalness={0.75} />
            </mesh>

            <mesh position={[0, entY + ENTABLATURE_H / 2 - 1.8, 0]}>
              <boxGeometry args={[W + 7, 4, D + 7]} />
              <meshStandardMaterial
                color={THEME.gold}
                emissive={THEME.gold}
                emissiveIntensity={hovered ? 1.6 : 0.55}
                roughness={0.35}
                metalness={0.7}
              />
            </mesh>

            <mesh position={[0, entY - ENTABLATURE_H / 2 + 1.8, 0]}>
              <boxGeometry args={[W + 7, 3, D + 7]} />
              <meshStandardMaterial
                color={THEME.amber}
                emissive={THEME.amber}
                emissiveIntensity={hovered ? 1.35 : 0.45}
                roughness={0.35}
                metalness={0.65}
              />
            </mesh>

            {Array.from({ length: 22 }).map((_, i) => {
              const xPos = -W / 2 + 18 + i * ((W - 36) / 21);
              const active = i % 3 === 0;

              return (
                <mesh key={`dentil-${i}`} position={[xPos, entY - 3, D / 2 + 3.5]}>
                  <boxGeometry args={[6, 5, 3]} />
                  <meshStandardMaterial
                    color={active ? THEME.gold : MID_DARK}
                    emissive={active ? THEME.gold : "#000000"}
                    emissiveIntensity={active ? (hovered ? 1.1 : 0.35) : 0}
                    roughness={0.4}
                    metalness={0.65}
                  />
                </mesh>
              );
            })}
          </>
        );
      })()}

      {/* Pediments */}
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
              <meshStandardMaterial color={DARK} roughness={0.35} metalness={0.75} />
            </mesh>

            <mesh ref={side > 0 ? glowRef : undefined} position={[0, PEDIMENT_H * 0.35, 8.5]}>
              <extrudeGeometry
                args={[
                  (() => {
                    const shape = new THREE.Shape();
                    const s = 0.56;
                    shape.moveTo((-W / 2) * s, 0);
                    shape.lineTo((W / 2) * s, 0);
                    shape.lineTo(0, PEDIMENT_H * s);
                    shape.closePath();
                    return shape;
                  })(),
                  { depth: 1.5, bevelEnabled: false },
                ]}
              />
              <meshStandardMaterial
                color={THEME.gold}
                emissive={THEME.gold}
                emissiveIntensity={hovered ? 1.5 : 0.65}
                transparent
                opacity={0.85}
              />
            </mesh>

            <mesh
              position={[-W / 4 - 1, PEDIMENT_H / 2, 9]}
              rotation={[0, 0, Math.atan2(PEDIMENT_H, W / 2 + 3)]}
            >
              <boxGeometry
                args={[
                  Math.sqrt((W / 2 + 3) ** 2 + PEDIMENT_H ** 2) / 2 + 5,
                  3.5,
                  4,
                ]}
              />
              <meshStandardMaterial
                color={THEME.gold}
                emissive={THEME.gold}
                emissiveIntensity={hovered ? 1.25 : 0.42}
                roughness={0.38}
                metalness={0.7}
              />
            </mesh>

            <mesh
              position={[W / 4 + 1, PEDIMENT_H / 2, 9]}
              rotation={[0, 0, -Math.atan2(PEDIMENT_H, W / 2 + 3)]}
            >
              <boxGeometry
                args={[
                  Math.sqrt((W / 2 + 3) ** 2 + PEDIMENT_H ** 2) / 2 + 5,
                  3.5,
                  4,
                ]}
              />
              <meshStandardMaterial
                color={THEME.gold}
                emissive={THEME.gold}
                emissiveIntensity={hovered ? 1.25 : 0.42}
                roughness={0.38}
                metalness={0.7}
              />
            </mesh>

            <mesh position={[0, PEDIMENT_H + 8, 4]}>
              <boxGeometry args={[11, 11, 11]} />
              <meshStandardMaterial
                color={THEME.gold}
                emissive={THEME.gold}
                emissiveIntensity={hovered ? 1.6 : 0.55}
                roughness={0.38}
                metalness={0.7}
              />
            </mesh>
          </group>
        );
      })}

      {/* Interior walls */}
      <mesh position={[0, BASE_TOP + 3 + COL_H / 2, -D / 2 + 36]}>
        <boxGeometry args={[W - 72, COL_H, 5]} />
        <meshStandardMaterial color={THEME.obsidian} roughness={0.35} metalness={0.75} />
      </mesh>

      <mesh position={[-W / 2 + 36, BASE_TOP + 3 + COL_H / 2, 0]}>
        <boxGeometry args={[5, COL_H, D - 72]} />
        <meshStandardMaterial color={THEME.obsidian} roughness={0.35} metalness={0.75} />
      </mesh>

      <mesh position={[W / 2 - 36, BASE_TOP + 3 + COL_H / 2, 0]}>
        <boxGeometry args={[5, COL_H, D - 72]} />
        <meshStandardMaterial color={THEME.obsidian} roughness={0.35} metalness={0.75} />
      </mesh>

      {/* GitCity-style window pixels */}
      {[1, -1].map((side) =>
        Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 8 }).map((_, col) => {
            if ((row + col) % 2 !== 0) return null;

            const color = (row + col) % 3 === 0 ? THEME.amber : THEME.gold;

            return (
              <mesh
                key={`window-${side}-${row}-${col}`}
                position={[
                  -126 + col * 36,
                  BASE_TOP + 48 + row * 38,
                  side * (D / 2 + 5),
                ]}
              >
                <boxGeometry args={[5, 13, 3]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={hovered ? 1.25 : 0.42}
                  roughness={0.45}
                  metalness={0.35}
                />
              </mesh>
            );
          })
        )
      )}

      {/* Front coding emblem */}
      <group position={[0, BASE_TOP + 3 + COL_H / 2, D / 2 + 8]}>
        <group position={[-24, 0, 0]}>
          <mesh position={[0, 12, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[3, 24, 3]} />
            <meshStandardMaterial
              color={THEME.gold}
              emissive={THEME.gold}
              emissiveIntensity={hovered ? 1.8 : 0.9}
            />
          </mesh>
          <mesh position={[0, -12, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[3, 24, 3]} />
            <meshStandardMaterial
              color={THEME.gold}
              emissive={THEME.gold}
              emissiveIntensity={hovered ? 1.8 : 0.9}
            />
          </mesh>
        </group>

        <mesh rotation={[0, 0, Math.PI / 7]}>
          <boxGeometry args={[2.5, 48, 2.5]} />
          <meshStandardMaterial
            color={THEME.amber}
            emissive={THEME.amber}
            emissiveIntensity={hovered ? 1.9 : 1}
          />
        </mesh>

        <group position={[24, 0, 0]}>
          <mesh position={[0, 12, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[3, 24, 3]} />
            <meshStandardMaterial
              color={THEME.gold}
              emissive={THEME.gold}
              emissiveIntensity={hovered ? 1.8 : 0.9}
            />
          </mesh>
          <mesh position={[0, -12, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[3, 24, 3]} />
            <meshStandardMaterial
              color={THEME.gold}
              emissive={THEME.gold}
              emissiveIntensity={hovered ? 1.8 : 0.9}
            />
          </mesh>
        </group>
      </group>

      {/* Small stacked roof block inspired by GitCity */}
      <mesh position={[0, BASE_TOP + COL_H + ENTABLATURE_H + PEDIMENT_H + 12, 0]}>
        <boxGeometry args={[86, 14, 54]} />
        <meshStandardMaterial color={THEME.forest} roughness={0.42} metalness={0.62} />
      </mesh>

      <mesh position={[0, BASE_TOP + COL_H + ENTABLATURE_H + PEDIMENT_H + 25, 0]}>
        <boxGeometry args={[102, 5, 68]} />
        <meshStandardMaterial
          color={THEME.gold}
          emissive={THEME.gold}
          emissiveIntensity={hovered ? 1.1 : 0.38}
        />
      </mesh>

      <mesh position={[0, BASE_TOP + COL_H + ENTABLATURE_H + PEDIMENT_H + 46, 0]}>
        <boxGeometry args={[48, 32, 34]} />
        <meshStandardMaterial color={THEME.deepGreen} roughness={0.42} metalness={0.6} />
      </mesh>

      {[-1, 1].map((side) =>
        Array.from({ length: 3 }).map((_, i) => (
          <mesh
            key={`top-window-${side}-${i}`}
            position={[
              -12 + i * 12,
              BASE_TOP + COL_H + ENTABLATURE_H + PEDIMENT_H + 46,
              side * 19,
            ]}
          >
            <boxGeometry args={[5, 12, 3]} />
            <meshStandardMaterial
              color={i === 1 ? THEME.amber : THEME.gold}
              emissive={i === 1 ? THEME.amber : THEME.gold}
              emissiveIntensity={hovered ? 1.1 : 0.4}
            />
          </mesh>
        ))
      )}

      <mesh position={[0, BASE_TOP + COL_H + ENTABLATURE_H + PEDIMENT_H + 66, 0]}>
        <boxGeometry args={[14, 14, 14]} />
        <meshStandardMaterial
          color={THEME.gold}
          emissive={THEME.gold}
          emissiveIntensity={hovered ? 1.6 : 0.55}
        />
      </mesh>

      {/* Subtle cyan accents */}
      {[-1, 1].map((side) =>
        [-W / 2 + 42, W / 2 - 42].map((x, i) => (
          <mesh key={`cyan-${side}-${i}`} position={[x, BASE_TOP + 28, side * (D / 2 - 22)]}>
            <boxGeometry args={[6, 12, 6]} />
            <meshStandardMaterial
              color={THEME.cyan}
              emissive={THEME.cyan}
              emissiveIntensity={hovered ? 1.1 : 0.35}
            />
          </mesh>
        ))
      )}

      <pointLight
        position={[0, BASE_TOP + COL_H / 2, 0]}
        color={THEME.gold}
        intensity={hovered ? 32 : 14}
        distance={260}
        decay={2}
      />
    </group>
  );
}