"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { CityPlaza, CityBridge } from "@/lib/github";
import { DISTRICT_COLORS } from "@/lib/github";

interface BusTransitProps {
  plazas: CityPlaza[];
  bridges: CityBridge[];
  transitState: {
    active: boolean;
    fromDistrict: string;
    toDistrict: string;
  } | null;
  onArrival: (targetDistrict: string) => void;
  onOpenTransitMenu: (fromDistrict: string) => void;
}

// ─── 3D BMTC Bus Stop Shelter ──────────────────────────────────
export function BusStop({
  position,
  rotation,
  districtName,
  onClick,
}: {
  position: [number, number, number];
  rotation: number;
  districtName: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = "pointer";
    } else {
      document.body.style.cursor = "auto";
    }
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      {/* Platform */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[14, 0.4, 8]} />
        <meshStandardMaterial color="#4a4d52" roughness={0.9} />
      </mesh>

      {/* Back Wall */}
      <mesh position={[0, 2.8, -3.8]}>
        <boxGeometry args={[14, 5.2, 0.4]} />
        <meshStandardMaterial color="#8b929c" roughness={0.8} />
      </mesh>

      {/* Side Pillars */}
      <mesh position={[-6.8, 2.8, 0]}>
        <boxGeometry args={[0.4, 5.2, 7.6]} />
        <meshStandardMaterial color="#8b929c" roughness={0.8} />
      </mesh>
      <mesh position={[6.8, 2.8, 0]}>
        <boxGeometry args={[0.4, 5.2, 7.6]} />
        <meshStandardMaterial color="#8b929c" roughness={0.8} />
      </mesh>

      {/* Blue Roof */}
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[15, 0.6, 9]} />
        <meshStandardMaterial color="#0055a5" emissive="#002255" emissiveIntensity={0.25} roughness={0.5} />
      </mesh>

      {/* Wooden Bench */}
      <mesh position={[0, 0.9, -1.8]}>
        <boxGeometry args={[9, 0.8, 2.2]} />
        <meshStandardMaterial color="#704825" roughness={0.95} />
      </mesh>

      {/* Bus Stop Route Pole */}
      <group position={[7.8, 0, 3.5]}>
        <mesh position={[0, 3.5, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 7, 6]} />
          <meshStandardMaterial color="#2d3033" roughness={0.7} />
        </mesh>
        {/* Blue board */}
        <mesh position={[0, 6.5, 0]}>
          <boxGeometry args={[2.5, 1.8, 0.2]} />
          <meshStandardMaterial color="#0055a5" roughness={0.5} />
        </mesh>
        {/* Glowing Board Panel */}
        <mesh position={[0, 6.5, 0.12]}>
          <boxGeometry args={[1.8, 1.0, 0.05]} />
          <meshStandardMaterial color="#ffa116" emissive="#ffa116" emissiveIntensity={hovered ? 3.0 : 1.5} toneMapped={false} />
        </mesh>
      </group>

      {/* Pulsing indicator when hovered */}
      {hovered && (
        <mesh position={[0, 7.5, 0]}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#ffa116" emissive="#ffa116" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

// ─── Floating Sky Transit Board ──────────────────────────────────
export function SkyTransitBoard({
  position,
  district,
}: {
  position: [number, number, number];
  district: string;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const laserRef = useRef<THREE.Mesh>(null);
  const [fontReady, setFontReady] = useState(false);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    document.fonts.ready.then(() => setFontReady(true));
  }, []);

  const color = DISTRICT_COLORS[district] ?? "#ffa116";

  const texture = useMemo(() => {
    if (!fontReady) return null;

    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 512, 128);

    // Semi-transparent dark background
    ctx.fillStyle = "rgba(12, 16, 24, 0.9)";
    ctx.fillRect(0, 0, 512, 128);

    // Draw neon border with glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 116);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Text selection based on district
    let icon = "🚌";
    let typeText = "BUS STATION";
    if (district === "backend" || district === "data_ai" || district === "security") {
      icon = "🛺";
      typeText = "AUTO STAND";
    } else if (district === "fullstack" || district === "gamedev" || district === "vibe_coder") {
      icon = "🚇";
      typeText = "METRO STATION";
    } else if (district === "downtown") {
      icon = "🚀";
      typeText = "CENTRAL PORT";
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 34px "Silkscreen", Courier, monospace';
    ctx.fillText(`${icon} ${typeText} ${icon}`, 256, 64);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    texRef.current = tex;
    return tex;
  }, [fontReady, district, color]);

  useEffect(() => {
    return () => {
      texRef.current?.dispose();
    };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      // Gentle floating bobbing
      meshRef.current.position.y = Math.sin(t * 1.5) * 2.5;
      meshRef.current.rotation.x = Math.sin(t * 0.8) * 0.04;
      meshRef.current.rotation.z = Math.cos(t * 0.8) * 0.04;
    }
    if (laserRef.current) {
      const laserMat = laserRef.current.material as THREE.MeshStandardMaterial;
      laserMat.emissiveIntensity = 2.0 + Math.sin(t * 4.0) * 1.0;
      laserMat.opacity = 0.2 + Math.sin(t * 4.0) * 0.08;
    }
  });

  return (
    <Billboard position={[position[0], 200, position[2]]} follow lockX={false} lockY={false} lockZ={false}>
      <group ref={meshRef}>
      {/* Neon laser beam pointing down to anchor the board */}
      <mesh ref={laserRef} position={[0, -100, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 200, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.0}
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>

      {/* Main Board Frame */}
      <mesh>
        <boxGeometry args={[70, 24, 3]} />
        <meshStandardMaterial
          color="#151922"
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Glowing Neon Outline Frame */}
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[72, 26, 0.5]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3.0}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Screen Face (Front) */}
      {texture && (
        <mesh position={[0, 0, 1.55]}>
          <planeGeometry args={[68, 22]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.05}
          />
        </mesh>
      )}
      </group>
    </Billboard>
  );
}


// ─── 3D BMTC Bus Model ────────────────────────────────────────
export function BusModel({
  position,
  rotation,
}: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Red Body */}
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[7.2, 4.4, 16]} />
        <meshStandardMaterial color="#cc2222" roughness={0.4} />
      </mesh>

      {/* White Accent Stripe */}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[7.25, 0.5, 16.05]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>

      {/* Windshields (Front & Rear) */}
      <mesh position={[0, 3.8, 8.02]}>
        <boxGeometry args={[6.2, 2.0, 0.1]} />
        <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[0, 3.8, -8.02]}>
        <boxGeometry args={[6.2, 2.0, 0.1]} />
        <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Side Windows */}
      {[-6, -3, 0, 3, 6].map((z, idx) => (
        <group key={idx} position={[0, 3.8, z]}>
          <mesh position={[3.62, 0, 0]}>
            <boxGeometry args={[0.05, 1.3, 1.8]} />
            <meshStandardMaterial color="#222222" roughness={0.1} transparent opacity={0.85} />
          </mesh>
          <mesh position={[-3.62, 0, 0]}>
            <boxGeometry args={[0.05, 1.3, 1.8]} />
            <meshStandardMaterial color="#222222" roughness={0.1} transparent opacity={0.85} />
          </mesh>
        </group>
      ))}

      {/* Headlights */}
      <mesh position={[-2.5, 1.6, 8.02]}>
        <boxGeometry args={[0.7, 0.7, 0.1]} />
        <meshStandardMaterial color="#ffffdd" emissive="#ffffcc" emissiveIntensity={3.0} toneMapped={false} />
      </mesh>
      <mesh position={[2.5, 1.6, 8.02]}>
        <boxGeometry args={[0.7, 0.7, 0.1]} />
        <meshStandardMaterial color="#ffffdd" emissive="#ffffcc" emissiveIntensity={3.0} toneMapped={false} />
      </mesh>

      {/* LED Destination Marquee */}
      <mesh position={[0, 4.6, 8.03]}>
        <boxGeometry args={[4.0, 0.5, 0.05]} />
        <meshStandardMaterial color="#151515" />
      </mesh>
      <mesh position={[0, 4.6, 8.05]}>
        <boxGeometry args={[3.6, 0.35, 0.01]} />
        <meshStandardMaterial color="#ff9000" emissive="#ff9000" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      {/* Wheels */}
      {[-2.0, 2.0].map((x) =>
        [-4.5, 4.5].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * 1.5, 0.7, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.0, 1.0, 1.2, 8]} />
            <meshStandardMaterial color="#1f1f1f" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ─── Main Bus Transit Manager ─────────────────────────────────
export default function BusTransit({
  plazas,
  bridges,
  transitState,
  onArrival,
  onOpenTransitMenu,
}: BusTransitProps) {
  const { camera } = useThree();
  const [progress, setProgress] = useState(0);
  const busPos = useMemo(() => new THREE.Vector3(), []);
  const busRot = useMemo(() => new THREE.Euler(), []);

  // Compute travel path spline between the two plazas
  const curve = useMemo(() => {
    if (!transitState?.active) return null;

    const fromPlaza = plazas.find((p) => p.district === transitState.fromDistrict);
    const toPlaza = plazas.find((p) => p.district === transitState.toDistrict);

    if (!fromPlaza || !toPlaza) return null;

    const fromRotY = Math.atan2(fromPlaza.position[0], fromPlaza.position[2]) + Math.PI;
    const fromPos: [number, number, number] = [
      fromPlaza.position[0] + Math.sin(fromRotY) * 45,
      fromPlaza.position[1],
      fromPlaza.position[2] + Math.cos(fromRotY) * 45,
    ];

    const toRotY = Math.atan2(toPlaza.position[0], toPlaza.position[2]) + Math.PI;
    const toPos: [number, number, number] = [
      toPlaza.position[0] + Math.sin(toRotY) * 45,
      toPlaza.position[1],
      toPlaza.position[2] + Math.cos(toRotY) * 45,
    ];

    const points: THREE.Vector3[] = [];
    points.push(new THREE.Vector3(...fromPos));

    // Check if we need to cross the central horizontal river (Z = 0)
    const crossedRiver = (fromPos[2] > 0 && toPos[2] < 0) || (fromPos[2] < 0 && toPos[2] > 0);

    if (crossedRiver && bridges.length > 0) {
      // Find the closest bridge on X to fromPos
      let bestBridge = bridges[0];
      let minXDist = Infinity;
      for (const b of bridges) {
        const dist = Math.abs(b.position[0] - fromPos[0]);
        if (dist < minXDist) {
          minXDist = dist;
          bestBridge = b;
        }
      }

      const bx = bestBridge.position[0];
      const bz = bestBridge.position[2];

      // Route through bridge coordinates
      const startZ = fromPos[2] > 0 ? 80 : -80;
      const endZ = toPos[2] > 0 ? 80 : -80;

      points.push(new THREE.Vector3(bx, 0.5, startZ));
      points.push(new THREE.Vector3(bx, 0.5, bz)); // Center of bridge
      points.push(new THREE.Vector3(bx, 0.5, endZ));
    } else {
      // Direct routing with a curved midpoint
      const mx = (fromPos[0] + toPos[0]) / 2;
      const mz = (fromPos[2] + toPos[2]) / 2 + (fromPos[0] > toPos[0] ? 40 : -40);
      points.push(new THREE.Vector3(mx, 0.5, mz));
    }

    points.push(new THREE.Vector3(...toPos));
    return new THREE.CatmullRomCurve3(points);
  }, [transitState, plazas, bridges]);

  // Reset transit progress when state becomes active
  useEffect(() => {
    if (transitState?.active) {
      setProgress(0);
    }
  }, [transitState]);

  // Update bus position and snap camera behind it
  useFrame((_, delta) => {
    if (!transitState?.active || !curve) return;

    // Travel duration is roughly 5 seconds
    const speed = 0.2;
    const nextProg = Math.min(progress + delta * speed, 1);
    setProgress(nextProg);

    const pos = curve.getPointAt(nextProg);
    const tangent = curve.getTangentAt(nextProg);

    busPos.copy(pos);
    busRot.set(0, Math.atan2(tangent.x, tangent.z), 0);

    // Position camera slightly behind the bus direction
    const yaw = Math.atan2(tangent.x, tangent.z);
    const camOffset = new THREE.Vector3(0, 18, -32).applyEuler(new THREE.Euler(0, yaw, 0));
    camera.position.copy(pos).add(camOffset);
    camera.lookAt(pos.x, pos.y + 4, pos.z);

    if (nextProg >= 1) {
      onArrival(transitState.toDistrict);
    }
  });

  return (
    <>
      {/* Bus Stop Shelters rendered at plazas */}
      {plazas.map((p, idx) => {
        if (!p.district) return null;
        // Face the bus stops slightly inward toward the center
        const rotY = Math.atan2(p.position[0], p.position[2]) + Math.PI;
        // Offset to the edge of the plaza along its facing direction so it doesn't overlap the center monument
        const stopPos: [number, number, number] = [
          p.position[0] + Math.sin(rotY) * 45,
          p.position[1],
          p.position[2] + Math.cos(rotY) * 45,
        ];
        return (
          <group key={`transit-node-${idx}`}>
            <group position={stopPos} scale={[5, 5, 5]}>
              <BusStop
                position={[0, 0, 0]}
                rotation={rotY}
                districtName={p.district}
                onClick={() => onOpenTransitMenu(p.district!)}
              />
            </group>
            <SkyTransitBoard
              position={stopPos}
              district={p.district}
            />
            {/* Tall pulsing beacon column visible from far away */}
            {/* Tall beacon visible from across the city */}
            <mesh position={[stopPos[0], 250, stopPos[2]]}>
              <cylinderGeometry args={[1.2, 1.2, 500, 6]} />
              <meshStandardMaterial
                color="#ffa116"
                emissive="#ffa116"
                emissiveIntensity={2.0}
                transparent
                opacity={0.35}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* Bus model flying along route */}
      {transitState?.active && curve && (
        <BusModel position={busPos} rotation={busRot} />
      )}
    </>
  );
}
