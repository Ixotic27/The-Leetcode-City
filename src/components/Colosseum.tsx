"use client";

import React, { useRef, useState, useMemo } from "react";
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

  const THEME = {
    obsidian: "#080b12",
    deepNavy: "#101827",
    graphite: "#171923",
    stone: "#242938",
    gold: "#ffa116",
    sunset: "#ff7a1a",
    cyan: "#00e5ff",
    violet: "#8b5cf6",
  };

  const DARK = hovered ? THEME.deepNavy : THEME.obsidian;
  const MID_DARK = hovered ? THEME.stone : THEME.graphite;
  const LIGHT_TRIM = hovered ? THEME.cyan : THEME.gold;
  const accentGlow = hovered ? THEME.cyan : THEME.gold;

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
    }

    for (let i = 0; i < FRONT_COLS; i++) {
      const t = i / (FRONT_COLS - 1);
      cols.push([xStart + t * (xEnd - xStart), zBack]);
    }

    for (let i = 1; i < SIDE_COLS - 1; i++) {
      const t = i / (SIDE_COLS - 1);
      cols.push([xStart, zFront + t * (zBack - zFront)]);
    }

    for (let i = 1; i < SIDE_COLS - 1; i++) {
      const t = i / (SIDE_COLS - 1);
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
      {/* Stepped voxel base */}
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
                roughness={0.35}
                metalness={0.85}
              />
            </mesh>

            <mesh position={[0, y + STEP_H / 2 + 0.1, 0]}>
              <boxGeometry args={[stepW + 0.4, 0.3, stepD + 0.4]} />
              <meshBasicMaterial
                color={accentGlow}
                transparent
                opacity={hovered ? 0.75 : 0.35}
              />
            </mesh>
          </group>
        );
      })}

      {/* Main floor */}
      <mesh position={[0, BASE_TOP + 1.5, 0]} receiveShadow>
        <boxGeometry args={[W + 10, 3, D + 10]} />
        <meshStandardMaterial
          color={THEME.obsidian}
          roughness={0.4}
          metalness={0.9}
        />
      </mesh>

      {/* Low-poly voxel columns */}
      {columnPositions.map(([cx, cz], idx) => (
        <group key={idx} position={[cx, BASE_TOP + 3, cz]}>
          <mesh position={[0, COL_H / 2, 0]} castShadow>
            <cylinderGeometry args={[COL_R, COL_R * 1.08, COL_H, 6]} />
            <meshStandardMaterial color={DARK} roughness={0.2} metalness={0.9} />
          </mesh>

          {[0, 60, 120, 180, 240, 300].map((angle, fi) => {
            const rad = (angle * Math.PI) / 180;
            const fx = Math.cos(rad) * (COL_R + 0.3);
            const fz = Math.sin(rad) * (COL_R + 0.3);

            return (
              <mesh key={fi} position={[fx, COL_H / 2, fz]}>
                <boxGeometry args={[1, COL_H - 8, 1]} />
                <meshStandardMaterial
                  color={accentGlow}
                  emissive={accentGlow}
                  emissiveIntensity={hovered ? 3.2 : 1.1}
                />
              </mesh>
            );
          })}

          <mesh position={[0, COL_H + 4, 0]}>
            <boxGeometry args={[COL_R * 3, 8, COL_R * 3]} />
            <meshStandardMaterial color={MID_DARK} roughness={0.3} metalness={0.85} />
          </mesh>

          <mesh position={[0, 3, 0]}>
            <boxGeometry args={[COL_R * 2.7, 6, COL_R * 2.7]} />
            <meshStandardMaterial color={MID_DARK} roughness={0.3} metalness={0.8} />
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
              <meshStandardMaterial color={DARK} roughness={0.25} metalness={0.9} />
            </mesh>

            <mesh position={[0, entY + ENTABLATURE_H / 2 - 1.8, 0]}>
              <boxGeometry args={[W + 7, 4, D + 7]} />
              <meshStandardMaterial
                color={accentGlow}
                emissive={accentGlow}
                emissiveIntensity={hovered ? 4 : 1.5}
              />
            </mesh>

            <mesh position={[0, entY - ENTABLATURE_H / 2 + 1.8, 0]}>
              <boxGeometry args={[W + 7, 3, D + 7]} />
              <meshStandardMaterial
                color={accentGlow}
                emissive={accentGlow}
                emissiveIntensity={hovered ? 3 : 1}
              />
            </mesh>

            {Array.from({ length: 22 }).map((_, i) => {
              const xPos = -W / 2 + 18 + i * ((W - 36) / 21);

              return (
                <mesh key={`dentil-${i}`} position={[xPos, entY - 3, D / 2 + 3.5]}>
                  <boxGeometry args={[6, 5, 3]} />
                  <meshStandardMaterial
                    color={i % 2 === 0 ? MID_DARK : accentGlow}
                    emissive={i % 2 === 0 ? "#000000" : accentGlow}
                    emissiveIntensity={i % 2 === 0 ? 0 : hovered ? 2.5 : 0.9}
                    roughness={0.3}
                    metalness={0.85}
                  />
                </mesh>
              );
            })}
          </>
        );
      })()}

      {/* Front and back pediments */}
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
              <meshStandardMaterial color={DARK} roughness={0.25} metalness={0.9} />
            </mesh>

            <mesh ref={side > 0 ? glowRef : undefined} position={[0, PEDIMENT_H * 0.35, 8.5]}>
              <extrudeGeometry
                args={[
                  (() => {
                    const shape = new THREE.Shape();
                    const s = 0.6;
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
                color={accentGlow}
                emissive={accentGlow}
                emissiveIntensity={hovered ? 4 : 2}
                transparent
                opacity={0.9}
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
                color={LIGHT_TRIM}
                emissive={LIGHT_TRIM}
                emissiveIntensity={hovered ? 3 : 1}
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
                color={LIGHT_TRIM}
                emissive={LIGHT_TRIM}
                emissiveIntensity={hovered ? 3 : 1}
              />
            </mesh>

            <mesh position={[0, PEDIMENT_H + 8, 4]}>
              <octahedronGeometry args={[8, 0]} />
              <meshStandardMaterial
                color={THEME.sunset}
                emissive={THEME.sunset}
                emissiveIntensity={hovered ? 5 : 2}
              />
            </mesh>

            {[-W / 2 - 3, W / 2 + 3].map((xc, ci) => (
              <mesh key={ci} position={[xc, 6, 4]}>
                <boxGeometry args={[9, 9, 9]} />
                <meshStandardMaterial
                  color={accentGlow}
                  emissive={accentGlow}
                  emissiveIntensity={hovered ? 4 : 1.5}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Interior walls */}
      <mesh position={[0, BASE_TOP + 3 + COL_H / 2, -D / 2 + 36]}>
        <boxGeometry args={[W - 72, COL_H, 5]} />
        <meshStandardMaterial color={THEME.obsidian} roughness={0.3} metalness={0.9} />
      </mesh>

      <mesh position={[-W / 2 + 36, BASE_TOP + 3 + COL_H / 2, 0]}>
        <boxGeometry args={[5, COL_H, D - 72]} />
        <meshStandardMaterial color={THEME.obsidian} roughness={0.3} metalness={0.9} />
      </mesh>

      <mesh position={[W / 2 - 36, BASE_TOP + 3 + COL_H / 2, 0]}>
        <boxGeometry args={[5, COL_H, D - 72]} />
        <meshStandardMaterial color={THEME.obsidian} roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Coding icon */}
      <group position={[0, BASE_TOP + 3 + COL_H / 2, 0]}>
        <group position={[-22, 0, 0]}>
          <mesh position={[0, 12, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[3, 22, 3]} />
            <meshStandardMaterial color={accentGlow} emissive={accentGlow} emissiveIntensity={3} />
          </mesh>

          <mesh position={[0, -12, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[3, 22, 3]} />
            <meshStandardMaterial color={accentGlow} emissive={accentGlow} emissiveIntensity={3} />
          </mesh>
        </group>

        <mesh rotation={[0, 0, Math.PI / 7]}>
          <boxGeometry args={[2.5, 45, 2.5]} />
          <meshStandardMaterial color={THEME.sunset} emissive={THEME.sunset} emissiveIntensity={4} />
        </mesh>

        <group position={[22, 0, 0]}>
          <mesh position={[0, 12, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[3, 22, 3]} />
            <meshStandardMaterial color={accentGlow} emissive={accentGlow} emissiveIntensity={3} />
          </mesh>

          <mesh position={[0, -12, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[3, 22, 3]} />
            <meshStandardMaterial color={accentGlow} emissive={accentGlow} emissiveIntensity={3} />
          </mesh>
        </group>
      </group>

      {/* Premium voxel accent blocks */}
      {[-1, 1].map((side) =>
        Array.from({ length: 9 }).map((_, i) => {
          const y = BASE_TOP + 35 + i * 24;
          const z = side * (D / 2 + 18);
          const x = -W / 2 + 38 + i * 34;

          return (
            <mesh key={`voxel-accent-${side}-${i}`} position={[x, y, z]}>
              <boxGeometry args={[10, 10, 10]} />
              <meshStandardMaterial
                color={i % 3 === 0 ? THEME.sunset : accentGlow}
                emissive={i % 3 === 0 ? THEME.sunset : accentGlow}
                emissiveIntensity={hovered ? 3.5 : 1.4}
                roughness={0.25}
                metalness={0.7}
              />
            </mesh>
          );
        })
      )}

      {[-1, 1].map((side) =>
        Array.from({ length: 7 }).map((_, i) => (
          <mesh
            key={`side-voxel-trim-${side}-${i}`}
            position={[
              side * (W / 2 + 16),
              BASE_TOP + 50 + i * 32,
              -D / 2 + 42 + i * 22,
            ]}
          >
            <boxGeometry args={[9, 9, 9]} />
            <meshStandardMaterial
              color={LIGHT_TRIM}
              emissive={LIGHT_TRIM}
              emissiveIntensity={hovered ? 3 : 1.2}
              roughness={0.2}
              metalness={0.75}
            />
          </mesh>
        ))
      )}

      {/* Floating premium voxel halo */}
      <mesh
        position={[0, BASE_TOP + COL_H + 82, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[125, 3, 6, 48]} />
        <meshStandardMaterial
          color={THEME.cyan}
          emissive={THEME.cyan}
          emissiveIntensity={hovered ? 3.5 : 1.4}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Roof voxel crown blocks */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = -90 + i * 30;
        const color =
          i % 3 === 0 ? THEME.cyan : i % 3 === 1 ? THEME.sunset : THEME.violet;

        return (
          <mesh
            key={`roof-crown-${i}`}
            position={[x, BASE_TOP + COL_H + ENTABLATURE_H + PEDIMENT_H + 22, 0]}
          >
            <boxGeometry args={[12, 12, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={hovered ? 4 : 1.7}
              roughness={0.2}
              metalness={0.75}
            />
          </mesh>
        );
      })}

      {/* Premium corner glow pylons */}
      {[
        [-W / 2 - 8, D / 2 + 8],
        [W / 2 + 8, D / 2 + 8],
        [-W / 2 - 8, -D / 2 - 8],
        [W / 2 + 8, -D / 2 - 8],
      ].map(([x, z], i) => {
        const color = i % 2 === 0 ? THEME.cyan : THEME.violet;

        return (
          <group key={`corner-pylon-${i}`} position={[x, BASE_TOP + 20, z]}>
            {Array.from({ length: 5 }).map((_, j) => (
              <mesh key={j} position={[0, j * 34, 0]}>
                <boxGeometry args={[11, 18, 11]} />
                <meshStandardMaterial
                  color={j % 2 === 0 ? color : THEME.gold}
                  emissive={j % 2 === 0 ? color : THEME.gold}
                  emissiveIntensity={hovered ? 3.6 : 1.4}
                  roughness={0.25}
                  metalness={0.7}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Spotlight beam */}
      <mesh position={[0, BASE_TOP + 3 + COL_H + ENTABLATURE_H + PEDIMENT_H + 100, 0]}>
        <cylinderGeometry args={[20, 55, 200, 12, 1, true]} />
        <meshBasicMaterial
          color={accentGlow}
          transparent
          opacity={hovered ? 0.16 : 0.07}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight
        position={[0, BASE_TOP + 3 + COL_H / 2, 0]}
        color={accentGlow}
        intensity={hovered ? 120 : 55}
        distance={360}
        decay={2}
      />
    </group>
  );
}