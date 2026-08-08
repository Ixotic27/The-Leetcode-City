"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { DISTRICT_ORIGINS } from "@/lib/github";

interface BridgeProps {
  start: [number, number, number];
  end: [number, number, number];
  themeAccent?: string;
}

// Helper to draw a dashed lane divider
function RoadMarkings({ start, end, y = 0.2 }: { start: THREE.Vector3; end: THREE.Vector3; y?: number }) {
  return useMemo(() => {
    const markings: React.ReactNode[] = [];
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    dir.normalize();
    const angle = Math.atan2(dir.x, dir.z);

    const step = 25;
    for (let d = 10; d < length - 10; d += step) {
      const pos = new THREE.Vector3().addScaledVector(dir, d).add(start);
      markings.push(
        <mesh
          key={`mark-${d}`}
          position={[pos.x, y, pos.z]}
          rotation={[0, angle, 0]}
        >
          <boxGeometry args={[1.5, 0.05, 8]} />
          <meshStandardMaterial
            color="#ffa116"
            emissive="#ffa116"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      );
    }
    return <>{markings}</>;
  }, [start, end, y]);
}

// ─── 1. Suspension Bridge (Golden Gate / LeetCode Style) ───────────
export function SuspensionBridge({ start: startCoords, end: endCoords }: BridgeProps) {
  const start = useMemo(() => new THREE.Vector3(...startCoords), [startCoords]);
  const end = useMemo(() => new THREE.Vector3(...endCoords), [endCoords]);
  const dir = useMemo(() => new THREE.Vector3().subVectors(end, start), [start, end]);
  const length = useMemo(() => dir.length(), [dir]);
  const angle = useMemo(() => Math.atan2(dir.x, dir.z), [dir]);
  const center = useMemo(() => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5), [start, end]);

  // Towers are placed at 22% and 78% of the span
  const towerPositions = useMemo(() => {
    const t1 = new THREE.Vector3().addScaledVector(dir, 0.22).add(start);
    const t2 = new THREE.Vector3().addScaledVector(dir, 0.78).add(start);
    return [t1, t2];
  }, [start, dir]);

  // Generate cables and vertical suspenders
  const cables = useMemo(() => {
    const mainCableSegments: React.ReactNode[] = [];
    const suspenders: React.ReactNode[] = [];
    const segmentsCount = 16;
    
    // Bridge relative vectors for side offset
    const rightOffset = new THREE.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(15);

    // Towers coordinates
    const [t1, t2] = towerPositions;
    const tower1X = 0.22 * length;
    const tower2X = 0.78 * length;
    
    // Parabolic main cable height profile along span
    const getCableHeight = (xDist: number) => {
      if (xDist < tower1X) {
        // Left side span anchorage to Tower 1
        const pct = xDist / tower1X;
        return THREE.MathUtils.lerp(4, 180, pct);
      } else if (xDist > tower2X) {
        // Right side span Tower 2 to anchorage
        const pct = (xDist - tower2X) / (length - tower2X);
        return THREE.MathUtils.lerp(180, 4, pct);
      } else {
        // Main suspended span parabola
        const midX = (tower1X + tower2X) / 2;
        const mainSpan = tower2X - tower1X;
        const normalized = (xDist - midX) / (mainSpan / 2); // -1 to 1
        // Parabola equation: dips from 180 down to 25 at the center
        return 25 + (180 - 25) * (normalized * normalized);
      }
    };

    // Calculate segments along the span
    for (let i = 0; i < segmentsCount; i++) {
      const d1 = (i / segmentsCount) * length;
      const d2 = ((i + 1) / segmentsCount) * length;
      
      const p1Base = new THREE.Vector3().addScaledVector(dir, i / segmentsCount).add(start);
      const p2Base = new THREE.Vector3().addScaledVector(dir, (i + 1) / segmentsCount).add(start);
      
      const h1 = getCableHeight(d1);
      const h2 = getCableHeight(d2);

      // We render two main cables (left & right sides of the road deck)
      [-1, 1].forEach((side) => {
        const offset = rightOffset.clone().multiplyScalar(side);
        const p1 = p1Base.clone().add(offset);
        p1.y = h1;
        const p2 = p2Base.clone().add(offset);
        p2.y = h2;

        const segDir = new THREE.Vector3().subVectors(p2, p1);
        const segLen = segDir.length();
        const segCenter = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        // Angle calculation for segments
        const yaw = Math.atan2(segDir.x, segDir.z);
        const pitch = -Math.asin(segDir.y / segLen);

        mainCableSegments.push(
          <mesh
            key={`cable-${side}-${i}`}
            position={[segCenter.x, segCenter.y, segCenter.z]}
            rotation={[pitch, yaw, 0]}
          >
            <boxGeometry args={[1.2, 1.2, segLen + 0.2]} />
            <meshStandardMaterial
              color="#ffa116"
              emissive="#ffa116"
              emissiveIntensity={2.5}
              toneMapped={false}
            />
          </mesh>
        );

        // Vertical suspender drop line (if inside the anchorage zones)
        // Add suspenders every ~25 units
        if (i % 2 === 0) {
          const suspY = h1;
          const roadY = 4;
          const suspH = suspY - roadY;
          if (suspH > 2) {
            suspenders.push(
              <mesh
                key={`susp-${side}-${i}`}
                position={[p1.x, roadY + suspH / 2, p1.z]}
              >
                <boxGeometry args={[0.3, suspH, 0.3]} />
                <meshStandardMaterial
                  color="#ffa116"
                  emissive="#ffa116"
                  emissiveIntensity={0.8}
                  toneMapped={false}
                />
              </mesh>
            );
          }
        }
      });
    }

    return { mainCableSegments, suspenders };
  }, [start, end, dir, length, towerPositions]);

  return (
    <group>
      {/* 1. Road Deck */}
      <mesh
        position={[center.x, 3, center.z]}
        rotation={[0, angle, 0]}
      >
        <boxGeometry args={[32, 2, length]} />
        <meshStandardMaterial color="#2d2d30" roughness={0.9} />
      </mesh>
      
      {/* Road Markings */}
      <RoadMarkings start={start} end={end} y={4.1} />

      {/* Bridge Side Barriers (LeetCode Orange glow rails) */}
      {[-1, 1].map((side) => {
        const perp = new THREE.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(15.5 * side);
        const barrierPos = center.clone().add(perp);
        return (
          <mesh
            key={`barrier-${side}`}
            position={[barrierPos.x, 4.5, barrierPos.z]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.8, 1.2, length]} />
            <meshStandardMaterial color="#4a4a4d" />
          </mesh>
        );
      })}

      {/* 2. Architectural Towers (Indian Style Pillar/Arch) */}
      {towerPositions.map((tPos, idx) => (
        <group key={`tower-${idx}`} position={[tPos.x, 0, tPos.z]} rotation={[0, angle, 0]}>
          {/* Main columns left & right */}
          {[-16, 16].map((columnOffset) => (
            <group key={columnOffset} position={[columnOffset, 0, 0]}>
              {/* Stepped stone foundation */}
              <mesh position={[0, 4, 0]}>
                <boxGeometry args={[14, 10, 14]} />
                <meshStandardMaterial color="#404348" roughness={0.9} />
              </mesh>
              {/* Main Pillar Shaft */}
              <mesh position={[0, 95, 0]}>
                <boxGeometry args={[8, 180, 8]} />
                <meshStandardMaterial color="#d1c5b0" roughness={0.7} />
              </mesh>
              {/* Horizontal bands */}
              {[40, 80, 120, 160].map((h) => (
                <mesh key={h} position={[0, h, 0]}>
                  <boxGeometry args={[9.5, 2, 9.5]} />
                  <meshStandardMaterial color="#ffa116" emissive="#ffa116" emissiveIntensity={1.5} toneMapped={false} />
                </mesh>
              ))}
              {/* Top cupola dome (Indian style) */}
              <mesh position={[0, 190, 0]}>
                <cylinderGeometry args={[4, 5, 6, 8]} />
                <meshStandardMaterial color="#bdae96" roughness={0.6} />
              </mesh>
              <mesh position={[0, 196, 0]}>
                <sphereGeometry args={[3.5, 8, 6]} />
                <meshStandardMaterial color="#ffa116" emissive="#ffa116" emissiveIntensity={3} toneMapped={false} />
              </mesh>
            </group>
          ))}

          {/* Cross portal beams (connecting the columns overhead) */}
          {[60, 110, 160].map((beamH) => (
            <mesh key={`beam-${beamH}`} position={[0, beamH, 0]}>
              <boxGeometry args={[32, 6, 5]} />
              <meshStandardMaterial color="#d1c5b0" roughness={0.7} />
            </mesh>
          ))}
          
          {/* Glowing Arch badge */}
          <mesh position={[0, 168, 2.6]}>
            <boxGeometry args={[16, 6, 0.4]} />
            <meshStandardMaterial color="#0d0d0f" />
          </mesh>
          <mesh position={[0, 168, 2.9]}>
            <boxGeometry args={[14, 3, 0.1]} />
            <meshStandardMaterial color="#ffa116" emissive="#ffa116" emissiveIntensity={2.5} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* 3. Cables and Suspenders */}
      {cables.mainCableSegments}
      {cables.suspenders}
    </group>
  );
}

function SignboardText({ text }: { text: string }) {
  const [fontReady, setFontReady] = React.useState(false);
  React.useEffect(() => {
    document.fonts.ready.then(() => setFontReady(true));
  }, []);

  const texture = useMemo(() => {
    if (!fontReady) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    
    ctx.fillStyle = "#0c2813";
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = "#ffa116";
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 116);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffa116";
    ctx.font = 'bold 32px "Silkscreen", Courier, monospace';
    ctx.fillText(text, 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [fontReady, text]);

  if (!texture) return null;
  return (
    <mesh position={[0, 0, 0.28]}>
      <planeGeometry args={[16.8, 3.8]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

// ─── 2. Highway Flyover (Elevated highway ribbon) ────────────────
export interface HighwayFlyoverProps {
  start: [number, number, number];
  end: [number, number, number];
  labelText?: string;
}

export function HighwayFlyover({ start: startCoords, end: endCoords, labelText }: HighwayFlyoverProps) {
  const start = useMemo(() => new THREE.Vector3(...startCoords), [startCoords]);
  const end = useMemo(() => new THREE.Vector3(...endCoords), [endCoords]);
  const dir = useMemo(() => new THREE.Vector3().subVectors(end, start), [start, end]);
  const length = useMemo(() => dir.length(), [dir]);
  const angle = useMemo(() => Math.atan2(dir.x, dir.z), [dir]);
  const center = useMemo(() => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5), [start, end]);

  const pillarsAndLamps = useMemo(() => {
    const pillars: React.ReactNode[] = [];
    const lamps: React.ReactNode[] = [];
    const step = 250;
    const normDir = dir.clone().normalize();
    const rightOffset = new THREE.Vector3(dir.z, 0, -dir.x).normalize();

    for (let d = 50; d < length - 50; d += step) {
      const pos = new THREE.Vector3().addScaledVector(normDir, d).add(start);
      
      // Concrete pillar supporting the flyover deck at Y=15
      pillars.push(
        <mesh key={`pillar-${d}`} position={[pos.x, 7.5, pos.z]}>
          <cylinderGeometry args={[2.5, 3.2, 15, 6]} />
          <meshStandardMaterial color="#888c94" roughness={0.8} />
        </mesh>
      );

      // Support crossbeam
      pillars.push(
        <mesh key={`crossbeam-${d}`} position={[pos.x, 14, pos.z]} rotation={[0, angle, 0]}>
          <boxGeometry args={[22, 2, 4]} />
          <meshStandardMaterial color="#747880" roughness={0.85} />
        </mesh>
      );

      // Street lamps on sides
      [-1, 1].forEach((side) => {
        const sidePos = pos.clone().addScaledVector(rightOffset, 12 * side);
        lamps.push(
          <group key={`lamp-${d}-${side}`} position={[sidePos.x, 15, sidePos.z]} rotation={[0, angle + (side > 0 ? 0 : Math.PI), 0]}>
            {/* Lamp post */}
            <mesh position={[0, 8, 0]}>
              <cylinderGeometry args={[0.2, 0.35, 16, 5]} />
              <meshStandardMaterial color="#3a3c40" />
            </mesh>
            {/* Lamp arm bending inwards */}
            <mesh position={[2, 16, 0]} rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[4, 0.4, 0.4]} />
              <meshStandardMaterial color="#3a3c40" />
            </mesh>
            {/* Glowing lantern */}
            <mesh position={[3.5, 14.5, 0]}>
              <sphereGeometry args={[0.9, 8, 6]} />
              <meshStandardMaterial color="#ffc107" emissive="#ffc107" emissiveIntensity={3} toneMapped={false} />
            </mesh>
          </group>
        );
      });
    }
    return { pillars, lamps };
  }, [start, end, dir, length, angle]);

  // Midpoint signboard information
  const signboardPos = useMemo(() => {
    return center.clone().add({ x: 0, y: 32, z: 0 });
  }, [center]);

  return (
    <group>
      {/* Concrete roadway deck */}
      <mesh position={[center.x, 14.5, center.z]} rotation={[0, angle, 0]}>
        <boxGeometry args={[20, 1.2, length]} />
        <meshStandardMaterial color="#3e4147" roughness={0.85} />
      </mesh>
      
      {/* Side barrier walls */}
      {[-1, 1].map((side) => {
        const perp = new THREE.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(9.6 * side);
        const barrierPos = center.clone().add(perp);
        return (
          <mesh
            key={`barrier-${side}`}
            position={[barrierPos.x, 15.6, barrierPos.z]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.6, 1.2, length]} />
            <meshStandardMaterial color="#5c5f66" />
          </mesh>
        );
      })}

      {/* Road Markings */}
      <RoadMarkings start={start} end={end} y={15.15} />

      {/* Pillars and Streetlights */}
      {pillarsAndLamps.pillars}
      {pillarsAndLamps.lamps}

      {/* Highway signs */}
      <group position={[signboardPos.x, signboardPos.y, signboardPos.z]} rotation={[0, angle, 0]}>
        {/* Support structure */}
        <mesh position={[-9, -8, 0]}>
          <cylinderGeometry args={[0.3, 0.35, 18, 5]} />
          <meshStandardMaterial color="#2d2d30" />
        </mesh>
        <mesh position={[9, -8, 0]}>
          <cylinderGeometry args={[0.3, 0.35, 18, 5]} />
          <meshStandardMaterial color="#2d2d30" />
        </mesh>
        
        {/* Signboard */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[18, 5, 0.4]} />
          <meshStandardMaterial color="#0f2613" roughness={0.7} />
        </mesh>
        {/* Glow neon border */}
        <mesh position={[0, 0, 0.22]}>
          <boxGeometry args={[17.4, 4.4, 0.05]} />
          <meshStandardMaterial color="#ffa116" emissive="#ffa116" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
        {/* Sign text label background */}
        <mesh position={[0, 0, 0.25]}>
          <boxGeometry args={[16.8, 3.8, 0.05]} />
          <meshStandardMaterial color="#0a1a0d" />
        </mesh>
        {labelText && <SignboardText text={labelText} />}
      </group>
    </group>
  );
}

// ─── 3. Jungle/Forest Corridor ───────────────────────────────────
export function JungleCorridor({ start: startCoords, end: endCoords }: BridgeProps) {
  const start = useMemo(() => new THREE.Vector3(...startCoords), [startCoords]);
  const end = useMemo(() => new THREE.Vector3(...endCoords), [endCoords]);
  const dir = useMemo(() => new THREE.Vector3().subVectors(end, start), [start, end]);
  const length = useMemo(() => dir.length(), [dir]);
  const angle = useMemo(() => Math.atan2(dir.x, dir.z), [dir]);
  const center = useMemo(() => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5), [start, end]);

  // Forest foliage scattering along the road corridor
  const trees = useMemo(() => {
    const list: React.ReactNode[] = [];
    const normDir = dir.clone().normalize();
    const rightOffset = new THREE.Vector3(dir.z, 0, -dir.x).normalize();

    // Pseudo-random helper for local calculations
    const prng = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const treeCount = Math.floor(length / 40);
    for (let i = 0; i < treeCount; i++) {
      const dist = (i / treeCount) * length;
      const pos = new THREE.Vector3().addScaledVector(normDir, dist).add(start);
      
      // Place tree randomly on the left or right side of the road corridor
      const side = prng(i * 351 + 79) > 0.5 ? 1 : -1;
      const offDist = 18 + prng(i * 773 + 13) * 35; // keep road clear
      const treePos = pos.clone().addScaledVector(rightOffset, offDist * side);
      
      const height = 12 + prng(i * 123) * 18;
      const width = 6 + prng(i * 456) * 8;
      
      list.push(
        <group key={`jtree-${i}`} position={[treePos.x, 0, treePos.z]}>
          {/* Trunk */}
          <mesh position={[0, height / 2, 0]}>
            <cylinderGeometry args={[width * 0.15, width * 0.25, height, 5]} />
            <meshStandardMaterial color="#4a2e12" roughness={0.9} />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, height + width / 2, 0]}>
            <coneGeometry args={[width * 0.8, width * 1.5, 6]} />
            <meshStandardMaterial color="#1b4d1a" roughness={0.85} />
          </mesh>
          {/* Glow fireflies inside canopy */}
          {prng(i * 888) > 0.6 && (
            <mesh position={[0, height + 4, 0]}>
              <sphereGeometry args={[width * 0.3, 5, 4]} />
              <meshStandardMaterial color="#22c87a" emissive="#22c87a" emissiveIntensity={2.5} toneMapped={false} transparent opacity={0.6} />
            </mesh>
          )}
        </group>
      );
    }
    return list;
  }, [start, end, dir, length]);

  return (
    <group>
      {/* Winding asphalt road corridor */}
      <mesh position={[center.x, 0.1, center.z]} rotation={[0, angle, 0]}>
        <boxGeometry args={[16, 0.2, length]} />
        <meshStandardMaterial color="#232529" roughness={0.95} />
      </mesh>
      
      {/* Road Markings */}
      <RoadMarkings start={start} end={end} y={0.22} />
      
      {/* Surrounding Forest */}
      {trees}
    </group>
  );
}

// ─── Main Connections Assembly ──────────────────────────────────
export default function InterCityConnections() {
  const connections = useMemo(() => {
    const list: React.ReactNode[] = [];

    // Origins map
    const o = DISTRICT_ORIGINS;

    // Connect Downtown (Bengaluru) to all main suburbs
    
    // 1. Downtown to Mumbai (frontend) - Suspension Bridge
    if (o.downtown && o.frontend) {
      list.push(<SuspensionBridge key="bengaluru-mumbai" start={o.downtown} end={o.frontend} />);
    }

    // 2. Downtown to Hyderabad (backend) - Highway Flyover
    if (o.downtown && o.backend) {
      list.push(<HighwayFlyover key="bengaluru-hyderabad" start={o.downtown} end={o.backend} labelText="HYDERABAD 2.5 KM ->" />);
    }
 
    // 3. Downtown to Pune (mobile) - Highway Flyover
    if (o.downtown && o.mobile) {
      list.push(<HighwayFlyover key="bengaluru-pune" start={o.downtown} end={o.mobile} labelText="PUNE 1.8 KM ->" />);
    }
 
    // 4. Mumbai (frontend) to Chennai (security) - Jungle Corridor
    if (o.frontend && o.security) {
      list.push(<JungleCorridor key="mumbai-chennai" start={o.frontend} end={o.security} />);
    }
 
    // 5. Hyderabad (backend) to Chennai (security) - Highway Flyover
    if (o.backend && o.security) {
      list.push(<HighwayFlyover key="hyderabad-chennai" start={o.backend} end={o.security} labelText="CHENNAI 3.2 KM ->" />);
    }
 
    // 6. Mumbai (frontend) to Ahmedabad (data_ai) - Suspension Bridge
    if (o.frontend && o.data_ai) {
      list.push(<SuspensionBridge key="mumbai-ahmedabad" start={o.frontend} end={o.data_ai} />);
    }
 
    // 7. Pune (mobile) to Ahmedabad (data_ai) - Highway Flyover
    if (o.mobile && o.data_ai) {
      list.push(<HighwayFlyover key="pune-ahmedabad" start={o.mobile} end={o.data_ai} labelText="MUMBAI 4.1 KM ->" />);
    }
 
    // 8. Pune (mobile) to Kolkata (devops) - Highway Flyover
    if (o.mobile && o.devops) {
      list.push(<HighwayFlyover key="pune-kolkata" start={o.mobile} end={o.devops} labelText="KOLKATA 5.0 KM ->" />);
    }

    return list;
  }, []);

  return <>{connections}</>;
}
