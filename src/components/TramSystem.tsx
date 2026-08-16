"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DISTRICT_ORIGINS } from "@/lib/github";
import { useReducedMotion } from "@/lib/reducedMotion";

interface LocalTramProps {
  center: [number, number, number];
  color: string;
  radius?: number;
  speed?: number;
  reducedMotion?: boolean;
}

function LocalTramLoop({ center, color, radius = 62, speed = 0.25, reducedMotion: propReducedMotion }: LocalTramProps) {
  const reducedMotion = useReducedMotion(propReducedMotion);
  const tramRef = useRef<THREE.Group>(null);
  const tramLength = 8.2;

  // Pre-calculate track segment lines (for visual details)
  const trackSegments = useMemo(() => {
    const list: React.ReactNode[] = [];
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      
      const x1 = Math.cos(a1) * radius;
      const z1 = Math.sin(a1) * radius;
      const x2 = Math.cos(a2) * radius;
      const z2 = Math.sin(a2) * radius;

      const pos = new THREE.Vector3((x1 + x2) / 2, 0.05, (z1 + z2) / 2);
      const angle = Math.atan2(x2 - x1, z2 - z1);
      const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);

      list.push(
        <group key={i} position={[pos.x, pos.y, pos.z]} rotation={[0, angle, 0]}>
          {/* Steel sleepers */}
          {i % 2 === 0 && (
            <mesh position={[0, -0.02, 0]}>
              <boxGeometry args={[4.5, 0.06, 0.6]} />
              <meshStandardMaterial color="#423528" roughness={0.9} />
            </mesh>
          )}
          {/* Rails */}
          <mesh position={[-1.6, 0.02, 0]}>
            <boxGeometry args={[0.15, 0.1, len + 0.1]} />
            <meshStandardMaterial color="#8a8f99" metalness={0.95} roughness={0.1} />
          </mesh>
          <mesh position={[1.6, 0.02, 0]}>
            <boxGeometry args={[0.15, 0.1, len + 0.1]} />
            <meshStandardMaterial color="#8a8f99" metalness={0.95} roughness={0.1} />
          </mesh>
          {/* Overhead electric wire spans */}
          <mesh position={[0, 5.25, 0]}>
            <boxGeometry args={[0.08, 0.08, len + 0.35]} />
            <meshStandardMaterial color="#d9f99d" emissive="#84cc16" emissiveIntensity={0.6} />
          </mesh>
          {i % 2 === 0 && (
            <>
              <mesh position={[-2.35, 2.65, 0]}>
                <boxGeometry args={[0.12, 5.25, 0.12]} />
                <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.35} />
              </mesh>
              <mesh position={[0, 5.15, 0]}>
                <boxGeometry args={[4.8, 0.1, 0.1]} />
                <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.35} />
              </mesh>
            </>
          )}
        </group>
      );
    }
    return list;
  }, [radius]);

  useFrame(({ clock }) => {
    if (!tramRef.current || reducedMotion) return;
    const time = clock.getElapsedTime() * speed;
    const x = Math.cos(time) * radius;
    const z = Math.sin(time) * radius;

    // Set position relative to the local city origin
    tramRef.current.position.set(x, 0.65, z);
    
    // Face the circular tangent so the car stays centered through curves.
    tramRef.current.rotation.y = Math.atan2(-Math.sin(time), Math.cos(time));
  });

  return (
    <group position={center}>
      {/* Visual steel tracks on the ground */}
      {trackSegments}

      {/* Animated Tram car */}
      <group ref={tramRef}>
        {/* Tram Body (Vintage styled box) */}
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[3.0, 2.45, tramLength]} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Yellow glowing strip at top */}
        <mesh position={[0, 2.65, 0]}>
          <boxGeometry args={[2.8, 0.2, tramLength + 0.25]} />
          <meshStandardMaterial color="#ffa116" emissive="#ffa116" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        {/* Roof (dark grey curved plate) */}
        <mesh position={[0, 2.8, 0]}>
          <boxGeometry args={[3.2, 0.2, tramLength + 0.5]} />
          <meshStandardMaterial color="#2d2d30" roughness={0.8} />
        </mesh>
        {/* Pantograph connecting the tram to the overhead wire */}
        <group position={[0, 3.65, 0]}>
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.12, 1.5, 0.12]} />
            <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[-0.45, 1.45, 0]} rotation={[0, 0, -0.55]}>
            <boxGeometry args={[0.1, 1.15, 0.1]} />
            <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[0.45, 1.45, 0]} rotation={[0, 0, 0.55]}>
            <boxGeometry args={[0.1, 1.15, 0.1]} />
            <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.25} />
          </mesh>
        </group>
        {/* Glowing Windows */}
        {[-2.7, -0.9, 0.9, 2.7].map((offsetZ) => (
          [-1.52, 1.52].map((side) => (
            <mesh key={`twin-${offsetZ}-${side}`} position={[side, 1.6, offsetZ]}>
              <boxGeometry args={[0.05, 1.0, 1.2]} />
              <meshStandardMaterial color="#ffde59" emissive="#ffde59" emissiveIntensity={1.8} toneMapped={false} />
            </mesh>
          ))
        ))}
        {/* Tram Headlights (Front and Back) */}
        <mesh position={[0, 0.9, tramLength / 2 + 0.05]}>
          <sphereGeometry args={[0.38, 8, 8]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={4} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.9, -tramLength / 2 - 0.05]}>
          <sphereGeometry args={[0.38, 8, 8]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export default function TramSystem({ reducedMotion }: { reducedMotion?: boolean } = {}) {
  const o = DISTRICT_ORIGINS;

  // We place a local tram loop around each city's plaza center (origins)
  return (
    <group>
      {o.downtown && <LocalTramLoop center={o.downtown} color="#ffa116" radius={150} speed={0.10} reducedMotion={reducedMotion} />}
      {o.frontend && <LocalTramLoop center={o.frontend} color="#34d399" radius={155} speed={0.12} reducedMotion={reducedMotion} />}
      {o.backend && <LocalTramLoop center={o.backend} color="#60a5fa" radius={148} speed={0.11} reducedMotion={reducedMotion} />}
      {o.fullstack && <LocalTramLoop center={o.fullstack} color="#f472b6" radius={152} speed={0.09} reducedMotion={reducedMotion} />}
      {o.mobile && <LocalTramLoop center={o.mobile} color="#a7f3d0" radius={150} speed={0.13} reducedMotion={reducedMotion} />}
      {o.devops && <LocalTramLoop center={o.devops} color="#f87171" radius={154} speed={0.11} reducedMotion={reducedMotion} />}
      {o.data_ai && <LocalTramLoop center={o.data_ai} color="#22d3ee" radius={149} speed={0.10} reducedMotion={reducedMotion} />}
      {o.security && <LocalTramLoop center={o.security} color="#818cf8" radius={153} speed={0.12} reducedMotion={reducedMotion} />}
    </group>
  );
}
