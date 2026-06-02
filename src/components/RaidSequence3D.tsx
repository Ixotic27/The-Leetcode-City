"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RaidPhase } from "@/lib/useRaidSequence";
import type { RaidExecuteResponse } from "@/lib/raid";
import type { CityBuilding } from "@/lib/github";
import { playRaidSound } from "@/lib/raidAudio";

// ─── Types ────────────────────────────────────────────────────

interface Props {
  phase: RaidPhase;
  attacker: CityBuilding | null;
  defender: CityBuilding | null;
  raidData: RaidExecuteResponse | null;
  onPhaseComplete: (phase: RaidPhase) => void;
}
interface ExplosionData {
  id: number;
  position: THREE.Vector3;
  createdAt: number;
}

// ─── Constants ────────────────────────────────────────────────

const ATTACK_DURATION = 4;
const ORBIT_RADIUS = 55;
const ORBIT_HEIGHT = 30;
const ORBIT_SPEED = 0.8;
const PROJECTILE_COUNT = 15;
const TANK_SHELL_COUNT = 6;
const DEBRIS_COUNT = 50;
const SMOKE_COUNT = 40;
const TANK_FIRE_DELAY = 0.45;
const TANK_FIRE_INTERVAL = 0.65;
const TANK_FIRE_FLASH_DURATION = 0.16;

// Ground vehicle constants
const GROUND_FIRE_OFFSET = 85;
const GROUND_VEHICLES = new Set(["vehicle_tank"]);
const isGroundVehicle = (type: string) => GROUND_VEHICLES.has(type);

// ─── Easing ───────────────────────────────────────────────────

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

const getTankFirePulse = (elapsedTime: number) => {
  const fireTime = elapsedTime - TANK_FIRE_DELAY;
  if (fireTime < 0) return 0;

  const cycleTime = fireTime % TANK_FIRE_INTERVAL;
  if (cycleTime > TANK_FIRE_FLASH_DURATION) return 0;

  return 1 - cycleTime / TANK_FIRE_FLASH_DURATION;
};

// ─── Vehicle Components (all face -Z for correct lookAt) ─────

function AirplaneMesh() {
  const propRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (propRef.current) propRef.current.rotation.z += delta * 30;
  });

  return (
    <group>
      {/* Fuselage */}
      <mesh>
        <boxGeometry args={[1.2, 0.9, 5]} />
        <meshStandardMaterial color="#e0e0e0" emissive="#aaa" emissiveIntensity={0.4} />
      </mesh>
      {/* Nose taper */}
      <mesh position={[0, 0, -3]}>
        <boxGeometry args={[0.8, 0.6, 1.2]} />
        <meshStandardMaterial color="#ccc" emissive="#999" emissiveIntensity={0.3} />
      </mesh>
      {/* Nose tip */}
      <mesh position={[0, 0, -3.7]}>
        <boxGeometry args={[0.5, 0.4, 0.5]} />
        <meshStandardMaterial color="#bbb" emissive="#888" emissiveIntensity={0.3} />
      </mesh>
      {/* Cockpit glass */}
      <mesh position={[0, 0.55, -1.2]}>
        <boxGeometry args={[0.7, 0.35, 1]} />
        <meshStandardMaterial color="#3399dd" emissive="#2277bb" emissiveIntensity={0.8} />
      </mesh>
      {/* Main wings */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[8, 0.12, 2]} />
        <meshStandardMaterial color="#d8d8d8" emissive="#999" emissiveIntensity={0.3} />
      </mesh>
      {/* Wing tips */}
      <mesh position={[-4.2, 0.15, 0.3]}>
        <boxGeometry args={[0.6, 0.5, 0.8]} />
        <meshStandardMaterial color="#cc4444" emissive="#993333" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[4.2, 0.15, 0.3]}>
        <boxGeometry args={[0.6, 0.5, 0.8]} />
        <meshStandardMaterial color="#cc4444" emissive="#993333" emissiveIntensity={0.5} />
      </mesh>
      {/* Tail vertical stabilizer */}
      <mesh position={[0, 0.9, 2.4]}>
        <boxGeometry args={[0.12, 1.3, 1]} />
        <meshStandardMaterial color="#cc4444" emissive="#993333" emissiveIntensity={0.5} />
      </mesh>
      {/* Tail horizontal stabilizers */}
      <mesh position={[0, 0.35, 2.4]}>
        <boxGeometry args={[3, 0.1, 0.8]} />
        <meshStandardMaterial color="#d8d8d8" emissive="#999" emissiveIntensity={0.3} />
      </mesh>
      {/* Propeller hub */}
      <mesh position={[0, 0, -4]}>
        <boxGeometry args={[0.3, 0.3, 0.2]} />
        <meshStandardMaterial color="#555" emissive="#333" emissiveIntensity={0.3} />
      </mesh>
      {/* Spinning propeller */}
      <group ref={propRef} position={[0, 0, -4.1]}>
        <mesh>
          <boxGeometry args={[3, 0.25, 0.06]} />
          <meshStandardMaterial color="#666" emissive="#555" emissiveIntensity={0.4} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[3, 0.25, 0.06]} />
          <meshStandardMaterial color="#666" emissive="#555" emissiveIntensity={0.4} />
        </mesh>
      </group>
      {/* Engine glow */}
      <pointLight position={[0, 0, 2.8]} color="#ff8844" intensity={3} distance={10} />
    </group>
  );
}

function HelicopterMesh() {
  const rotorRef = useRef<THREE.Group>(null);
  const tailRotorRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (rotorRef.current) rotorRef.current.rotation.y += delta * 20;
    if (tailRotorRef.current) tailRotorRef.current.rotation.z += delta * 25;
  });

  return (
    <group>
      {/* Body */}
      <mesh>
        <boxGeometry args={[1.8, 1.6, 4]} />
        <meshStandardMaterial color="#556677" emissive="#334455" emissiveIntensity={0.5} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, -0.2, -2.3]}>
        <boxGeometry args={[1.4, 1, 1]} />
        <meshStandardMaterial color="#4a5a6a" emissive="#334455" emissiveIntensity={0.5} />
      </mesh>
      {/* Cockpit glass */}
      <mesh position={[0, 0.2, -2.5]}>
        <boxGeometry args={[1.2, 0.6, 0.6]} />
        <meshStandardMaterial color="#44aadd" emissive="#3388bb" emissiveIntensity={0.8} />
      </mesh>
      {/* Tail boom */}
      <mesh position={[0, 0.3, 3]}>
        <boxGeometry args={[0.5, 0.5, 2.5]} />
        <meshStandardMaterial color="#445566" emissive="#334455" emissiveIntensity={0.4} />
      </mesh>
      {/* Tail fin */}
      <mesh position={[0, 0.9, 4]}>
        <boxGeometry args={[0.1, 1, 0.6]} />
        <meshStandardMaterial color="#cc5555" emissive="#993333" emissiveIntensity={0.5} />
      </mesh>
      {/* Skids */}
      <mesh position={[-0.8, -1.2, 0]}>
        <boxGeometry args={[0.15, 0.15, 3.5]} />
        <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.8, -1.2, 0]}>
        <boxGeometry args={[0.15, 0.15, 3.5]} />
        <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.3} />
      </mesh>
      {/* Skid struts */}
      <mesh position={[-0.8, -0.7, -0.8]}>
        <boxGeometry args={[0.12, 1, 0.12]} />
        <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.8, -0.7, -0.8]}>
        <boxGeometry args={[0.12, 1, 0.12]} />
        <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.8, -0.7, 0.8]}>
        <boxGeometry args={[0.12, 1, 0.12]} />
        <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.8, -0.7, 0.8]}>
        <boxGeometry args={[0.12, 1, 0.12]} />
        <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.3} />
      </mesh>
      {/* Rotor mast */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.2]} />
        <meshStandardMaterial color="#555" emissive="#333" emissiveIntensity={0.3} />
      </mesh>
      {/* Main rotor */}
      <group ref={rotorRef} position={[0, 1.4, 0]}>
        <mesh>
          <boxGeometry args={[7, 0.08, 0.4]} />
          <meshStandardMaterial color="#888" emissive="#666" emissiveIntensity={0.4} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[7, 0.08, 0.4]} />
          <meshStandardMaterial color="#888" emissive="#666" emissiveIntensity={0.4} />
        </mesh>
      </group>
      {/* Tail rotor */}
      <mesh ref={tailRotorRef} position={[0.3, 0.9, 4.1]}>
        <boxGeometry args={[0.06, 1.5, 0.06]} />
        <meshStandardMaterial color="#888" emissive="#666" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function DroneMesh() {
  const rotorsRef = useRef<THREE.Group[]>([]);

  useFrame((_, delta) => {
    rotorsRef.current.forEach((r) => {
      if (r) r.rotation.y += delta * 25;
    });
  });

  return (
    <group>
      {/* Center body */}
      <mesh>
        <boxGeometry args={[1.5, 0.4, 1.5]} />
        <meshStandardMaterial color="#222" emissive="#111" emissiveIntensity={0.5} />
      </mesh>
      {/* Camera eye */}
      <mesh position={[0, -0.25, -0.5]}>
        <boxGeometry args={[0.4, 0.2, 0.4]} />
        <meshStandardMaterial color="#00ccff" emissive="#00aaff" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* Arms + motors + rotors */}
      {([
        [-1.8, 0, -1.8],
        [1.8, 0, -1.8],
        [-1.8, 0, 1.8],
        [1.8, 0, 1.8],
      ] as [number, number, number][]).map((pos, i) => (
        <group key={i}>
          <mesh position={[pos[0] * 0.5, 0, pos[2] * 0.5]}>
            <boxGeometry args={[
              Math.abs(pos[0]) > 0 ? Math.abs(pos[0]) : 0.15,
              0.15,
              Math.abs(pos[2]) > 0 ? 0.15 : Math.abs(pos[2]),
            ]} />
            <meshStandardMaterial color="#333" emissive="#222" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={pos}>
            <boxGeometry args={[0.5, 0.3, 0.5]} />
            <meshStandardMaterial color="#333" emissive="#222" emissiveIntensity={0.4} />
          </mesh>
          <group
            position={[pos[0], 0.2, pos[2]]}
            ref={(el) => { if (el) rotorsRef.current[i] = el; }}
          >
            <mesh>
              <boxGeometry args={[2, 0.05, 0.2]} />
              <meshStandardMaterial color="#00ccff" emissive="#00aadd" emissiveIntensity={1.5} toneMapped={false} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[2, 0.05, 0.2]} />
              <meshStandardMaterial color="#00ccff" emissive="#00aadd" emissiveIntensity={1.5} toneMapped={false} />
            </mesh>
          </group>
          <pointLight position={[pos[0], 0.3, pos[2]]} color="#00ccff" intensity={1} distance={5} />
        </group>
      ))}
    </group>
  );
}

function RocketMesh() {
  const flameRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (flameRef.current) {
      const flicker = 0.8 + Math.sin(clock.elapsedTime * 20) * 0.2 + Math.sin(clock.elapsedTime * 33) * 0.15;
      flameRef.current.scale.set(flicker, flicker, 1 + Math.sin(clock.elapsedTime * 15) * 0.3);
    }
  });

  return (
    <group>
      {/* Nose cone */}
      <mesh position={[0, 0, -3]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.7, 1.8, 6]} />
        <meshStandardMaterial color="#cc3333" emissive="#aa2222" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0, -1.5]}>
        <boxGeometry args={[1.2, 1.2, 1.5]} />
        <meshStandardMaterial color="#dddddd" emissive="#aaa" emissiveIntensity={0.4} />
      </mesh>
      <mesh>
        <boxGeometry args={[1.4, 1.4, 3]} />
        <meshStandardMaterial color="#eeeeee" emissive="#aaa" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.45, 1.45, 0.4]} />
        <meshStandardMaterial color="#cc3333" emissive="#992222" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0, 1.8]}>
        <boxGeometry args={[1.3, 1.3, 0.8]} />
        <meshStandardMaterial color="#888" emissive="#555" emissiveIntensity={0.4} />
      </mesh>
      {/* Fins */}
      {([
        [0, -0.8, 2, 0],
        [0, 0.8, 2, 0],
        [-0.8, 0, 2, Math.PI / 2],
        [0.8, 0, 2, Math.PI / 2],
      ] as [number, number, number, number][]).map(([x, y, z, rot], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, rot]}>
          <boxGeometry args={[0.1, 1.5, 1.2]} />
          <meshStandardMaterial color="#cc3333" emissive="#992222" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* Engine flame */}
      <mesh ref={flameRef} position={[0, 0, 2.5]}>
        <boxGeometry args={[0.6, 0.6, 1.2]} />
        <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 3]} color="#ff6600" intensity={8} distance={15} />
    </group>
  );
}

function B2BomberMesh() {
  return (
    <group>
      {/* Main body (flying wing) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3, 0.2, 2]} />
        <meshStandardMaterial color="#1a1a1c" emissive="#0d0d0f" emissiveIntensity={0.5} />
      </mesh>
      {/* Cockpit hump */}
      <mesh position={[0, 0.2, -0.2]}>
        <boxGeometry args={[0.8, 0.3, 1]} />
        <meshStandardMaterial color="#111112" emissive="#080809" emissiveIntensity={0.4} />
      </mesh>
      {/* Wing sweeps (angled) */}
      <mesh position={[-2.4, 0, 0.8]} rotation={[0, -Math.PI / 5, 0]}>
        <boxGeometry args={[3, 0.15, 1.2]} />
        <meshStandardMaterial color="#1a1a1c" emissive="#0d0d0f" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[2.4, 0, 0.8]} rotation={[0, Math.PI / 5, 0]}>
        <boxGeometry args={[3, 0.15, 1.2]} />
        <meshStandardMaterial color="#1a1a1c" emissive="#0d0d0f" emissiveIntensity={0.5} />
      </mesh>
      {/* Wing tips */}
      <mesh position={[-4.5, 0, 1.4]} rotation={[0, -Math.PI / 3.5, 0]}>
        <boxGeometry args={[2.5, 0.1, 0.8]} />
        <meshStandardMaterial color="#1a1a1c" emissive="#0d0d0f" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[4.5, 0, 1.4]} rotation={[0, Math.PI / 3.5, 0]}>
        <boxGeometry args={[2.5, 0.1, 0.8]} />
        <meshStandardMaterial color="#1a1a1c" emissive="#0d0d0f" emissiveIntensity={0.5} />
      </mesh>
      {/* Engine exhausts */}
      <mesh position={[-1.2, 0.1, 1.0]}>
        <boxGeometry args={[0.7, 0.1, 0.3]} />
        <meshStandardMaterial color="#000" emissive="#000" emissiveIntensity={0} />
      </mesh>
      <mesh position={[1.2, 0.1, 1.0]}>
        <boxGeometry args={[0.7, 0.1, 0.3]} />
        <meshStandardMaterial color="#000" emissive="#000" emissiveIntensity={0} />
      </mesh>
      <pointLight position={[-1.2, 0, 1.2]} color="#44aaff" intensity={1} distance={4} />
      <pointLight position={[1.2, 0, 1.2]} color="#44aaff" intensity={1} distance={4} />
    </group>
  );
}

function UFOMesh() {
  const spinRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * 5;
  });

  return (
    <group>
      {/* Main saucer */}
      <mesh>
        <cylinderGeometry args={[2, 2, 0.3, 32]} />
        <meshStandardMaterial color="#d1d5db" emissive="#6b7280" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.6, 2.2, 0.4, 32]} />
        <meshStandardMaterial color="#9ca3af" emissive="#4b5563" emissiveIntensity={0.4} />
      </mesh>
      {/* Glass dome */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={1} transparent opacity={0.6} />
      </mesh>
      {/* Spinning lights ring */}
      <group ref={spinRef} position={[0, 0.15, 0]}>
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1]} rotation={[0, 0, Math.PI / 2]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={3} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
      {/* Bottom glowing core */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.8, 0.6, 0.3, 16]} />
        <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <pointLight position={[0, -0.5, 0]} color="#10b981" intensity={3} distance={8} />
    </group>
  );
}

function TankMesh({ isAttacking = false, targetPos }: { isAttacking?: boolean; targetPos?: THREE.Vector3 }) {
  const tankRef = useRef<THREE.Group>(null);
  const turretRef = useRef<THREE.Group>(null);
  const cannonRef = useRef<THREE.Group>(null);
  const muzzleFlashRef = useRef<THREE.Group>(null);
  const treadsRef = useRef<THREE.Group>(null);
  const attackElapsedRef = useRef(0);
  const _localTarget = useMemo(() => new THREE.Vector3(), []);
  
  // Animate treads moving slightly
  useFrame((state, delta) => {
    if (treadsRef.current) {
      treadsRef.current.position.z = (state.clock.elapsedTime * 2) % 0.2;
    }

    attackElapsedRef.current = isAttacking ? attackElapsedRef.current + delta : 0;

    if (turretRef.current && tankRef.current && targetPos) {
      _localTarget.copy(targetPos);
      tankRef.current.worldToLocal(_localTarget);

      const targetYaw = Math.atan2(_localTarget.x, _localTarget.z + 0.2);
      turretRef.current.rotation.y = THREE.MathUtils.lerp(
        turretRef.current.rotation.y,
        targetYaw,
        Math.min(delta * 8, 1),
      );
    }

    const firePulse = isAttacking ? getTankFirePulse(attackElapsedRef.current) : 0;
    if (cannonRef.current) {
      cannonRef.current.position.z = -firePulse * 0.35;
    }

    if (muzzleFlashRef.current) {
      muzzleFlashRef.current.visible = firePulse > 0;
      const flashScale = 0.4 + firePulse * 1.4;
      muzzleFlashRef.current.scale.set(flashScale, flashScale, flashScale);
    }
  });

  return (
    <group ref={tankRef} position={[0, 0.4, 0]}> {/* Offset up to set treads bottom at local Y=0 */}
      {/* Main Hull */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.5, 0.6, 2.5]} />
        <meshStandardMaterial color="#4b5320" emissive="#2c3012" emissiveIntensity={0.2} />
      </mesh>
      {/* Rotating Turret */}
      <group ref={turretRef} position={[0, 0.45, -0.2]}>
        {/* Turret Structure */}
        <mesh>
          <cylinderGeometry args={[0.5, 0.6, 0.4, 8]} />
          <meshStandardMaterial color="#3a4018" />
        </mesh>
        <group ref={cannonRef}>
          {/* Main Cannon */}
          <mesh position={[0, 0, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 1.8, 8]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          {/* Cannon Muzzle Brake */}
          <mesh position={[0, 0, 2.3]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.2, 8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          {/* Muzzle flash */}
          <group ref={muzzleFlashRef} position={[0, 0, 2.55]} visible={false}>
            <mesh>
              <sphereGeometry args={[0.32, 8, 8]} />
              <meshBasicMaterial color="#fff3a3" transparent opacity={0.9} depthWrite={false} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.45, 0.9, 8]} />
              <meshBasicMaterial color="#ff7a18" transparent opacity={0.75} depthWrite={false} />
            </mesh>
            <pointLight color="#ff9d2e" intensity={7} distance={8} />
          </group>
        </group>
      </group>
      {/* Treads/Tracks (Left) */}
      <group position={[-0.85, -0.15, 0]}>
        <mesh>
          <boxGeometry args={[0.3, 0.5, 2.8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <group ref={treadsRef}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} position={[0, 0, -1.2 + i * 0.35]}>
              <boxGeometry args={[0.32, 0.52, 0.05]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          ))}
        </group>
      </group>
      {/* Treads/Tracks (Right) */}
      <group position={[0.85, -0.15, 0]}>
        <mesh>
          <boxGeometry args={[0.3, 0.5, 2.8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Wheels inside tracks */}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`r-wheel-${i}`} position={[0, 0, -1 + i * 0.5]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.35, 16]} />
            <meshStandardMaterial color="#2a2e12" />
          </mesh>
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`l-wheel-${i}`} position={[-1.7, 0, -1 + i * 0.5]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.35, 16]} />
            <meshStandardMaterial color="#2a2e12" />
          </mesh>
        ))}
      </group>
      {/* Headlights */}
      <mesh position={[-0.6, 0.1, 1.26]}>
        <boxGeometry args={[0.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position={[0.6, 0.1, 1.26]}>
        <boxGeometry args={[0.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <pointLight position={[-0.6, 0.1, 1.5]} color="#ffaa00" intensity={1} distance={3} />
      <pointLight position={[0.6, 0.1, 1.5]} color="#ffaa00" intensity={1} distance={3} />
    </group>
  );
}

function FuturisticJetMesh() {
  const afterburnerRef = useRef<THREE.Group>(null);
  const wingLightLRef = useRef<THREE.Mesh>(null);
  const wingLightRRef = useRef<THREE.Mesh>(null);
  
  // Wing trail attachment points for the particle system
  const trailLRef = useRef<THREE.Group>(null);
  const trailRRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    
    // Afterburner flicker
    if (afterburnerRef.current) {
      const flicker = 0.75 + Math.sin(t * 30) * 0.15 + Math.sin(t * 47) * 0.1;
      afterburnerRef.current.scale.set(flicker, flicker, 1 + Math.sin(t * 20) * 0.4);
    }
    
    // Wing tip strobe
    const strobe = Math.sin(t * 6) > 0.7 ? 1 : 0.1;
    if (wingLightLRef.current) {
      const mat = wingLightLRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = strobe * 4;
    }
    if (wingLightRRef.current) {
      const mat = wingLightRRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = strobe * 4;
    }
  });

  return (
    <group>
      {/* Central spine/fuselage */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.9, 0.55, 4.5]} />
        <meshStandardMaterial color="#21252b" roughness={0.7} metalness={0.3} />
      </mesh>
      
      {/* Wing root blend (widens fuselage in the middle) */}
      <mesh position={[0, -0.05, 0.5]}>
        <boxGeometry args={[1.8, 0.35, 3.5]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Nose Section — Flat-bottomed, downward-sloping "Duckbill" shape (Super Monarch style) */}
      <group position={[0, -0.05, -3.2]}>
        {/* Main upper nose slope */}
        <mesh position={[0, -0.05, 0]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.55, 0.35, 2.5]} />
          <meshStandardMaterial color="#1f2329" roughness={0.7} />
        </mesh>
        {/* Lower nose flat belly */}
        <mesh position={[0, -0.2, 0]} rotation={[-0.02, 0, 0]}>
          <boxGeometry args={[0.45, 0.15, 2.4]} />
          <meshStandardMaterial color="#1a1d24" roughness={0.7} />
        </mesh>
        
        {/* Pointy Nose tip — White/Light Grey, pinched and flat */}
        <mesh position={[0, -0.15, -1.6]} rotation={[0.05, 0, 0]}>
          <boxGeometry args={[0.15, 0.08, 1.2]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.5} emissive="#e5e7eb" emissiveIntensity={0.1} />
        </mesh>
        {/* Extreme front tip point */}
        <mesh position={[0, -0.16, -2.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.08, 0.4, 4]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.5} emissive="#e5e7eb" emissiveIntensity={0.2} />
        </mesh>
      </group>

      {/* Cockpit Canopy — Glowing Amber/Gold to stand out against the night sky */}
      <mesh position={[0, 0.35, -1.8]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 1.6, 8]} />
        <meshStandardMaterial color="#ffb700" roughness={0.2} emissive="#ff8800" emissiveIntensity={0.8} />
      </mesh>

      {/* Main Swept Wings — delta shape base (swept BACKWARDS) */}
      <group position={[0, -0.1, 0.5]}>
        <mesh position={[-2.2, 0, 0.6]} rotation={[0, -Math.PI / 6, 0]}>
          <boxGeometry args={[3.8, 0.08, 1.8]} />
          <meshStandardMaterial color="#1f2329" roughness={0.7} />
        </mesh>
        <mesh position={[2.2, 0, 0.6]} rotation={[0, Math.PI / 6, 0]}>
          <boxGeometry args={[3.8, 0.08, 1.8]} />
          <meshStandardMaterial color="#1f2329" roughness={0.7} />
        </mesh>
      </group>

      {/* Canards (Front Wings) */}
      <mesh position={[-0.9, 0, -2.1]} rotation={[0, -Math.PI / 5, 0]}>
        <boxGeometry args={[1.2, 0.06, 0.6]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.7} />
      </mesh>
      <mesh position={[0.9, 0, -2.1]} rotation={[0, Math.PI / 5, 0]}>
        <boxGeometry args={[1.2, 0.06, 0.6]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.7} />
      </mesh>

      {/* Tall Dual Tail Fins (V-Tail, angled slightly out) */}
      <group position={[0, 0.65, 2.0]}>
        {/* Left Fin Base (Dark) */}
        <mesh position={[-0.7, 0, 0]} rotation={[0.2, 0, -0.2]}>
          <boxGeometry args={[0.08, 1.4, 1.2]} />
          <meshStandardMaterial color="#1f2329" roughness={0.7} />
        </mesh>
        {/* Left Fin Tip (Orange) */}
        <mesh position={[-0.85, 0.8, 0.3]} rotation={[0.2, 0, -0.2]}>
          <boxGeometry args={[0.09, 0.5, 1.0]} />
          <meshStandardMaterial color="#ea580c" roughness={0.5} emissive="#ea580c" emissiveIntensity={0.2} />
        </mesh>
        
        {/* Right Fin Base (Dark) */}
        <mesh position={[0.7, 0, 0]} rotation={[0.2, 0, 0.2]}>
          <boxGeometry args={[0.08, 1.4, 1.2]} />
          <meshStandardMaterial color="#1f2329" roughness={0.7} />
        </mesh>
        {/* Right Fin Tip (Orange) */}
        <mesh position={[0.85, 0.8, 0.3]} rotation={[0.2, 0, 0.2]}>
          <boxGeometry args={[0.09, 0.5, 1.0]} />
          <meshStandardMaterial color="#ea580c" roughness={0.5} emissive="#ea580c" emissiveIntensity={0.2} />
        </mesh>
      </group>

      {/* Twin Engine Pods (Rear) */}
      <mesh position={[-0.55, -0.25, 1.8]}>
        <boxGeometry args={[0.55, 0.55, 1.8]} />
        <meshStandardMaterial color="#111827" roughness={0.8} />
      </mesh>
      <mesh position={[0.55, -0.25, 1.8]}>
        <boxGeometry args={[0.55, 0.55, 1.8]} />
        <meshStandardMaterial color="#111827" roughness={0.8} />
      </mesh>

      {/* Exhaust Nozzles */}
      <mesh position={[-0.55, -0.25, 2.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.4, 8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} />
      </mesh>
      <mesh position={[0.55, -0.25, 2.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.4, 8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} />
      </mesh>
      
      {/* Afterburner flames */}
      <group ref={afterburnerRef} position={[0, -0.25, 3.1]}>
        {/* Left */}
        <mesh position={[-0.55, 0, 0]}>
          <boxGeometry args={[0.3, 0.3, 1.5]} />
          <meshStandardMaterial color="#00ccff" emissive="#0088ff" emissiveIntensity={6} toneMapped={false} transparent opacity={0.85} />
        </mesh>
        <mesh position={[-0.55, 0, 0]}>
          <boxGeometry args={[0.15, 0.15, 1.8]} />
          <meshStandardMaterial color="#ffffff" emissive="#aaddff" emissiveIntensity={8} toneMapped={false} transparent opacity={0.6} />
        </mesh>
        {/* Right */}
        <mesh position={[0.55, 0, 0]}>
          <boxGeometry args={[0.3, 0.3, 1.5]} />
          <meshStandardMaterial color="#00ccff" emissive="#0088ff" emissiveIntensity={6} toneMapped={false} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0.55, 0, 0]}>
          <boxGeometry args={[0.15, 0.15, 1.8]} />
          <meshStandardMaterial color="#ffffff" emissive="#aaddff" emissiveIntensity={8} toneMapped={false} transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Tiny subtle green/cyan emissive decal details to match the sci-fi look exactly */}
      <mesh position={[-0.8, 0.28, -1.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.15, 0.4]} />
        <meshBasicMaterial color="#34d399" />
      </mesh>
      <mesh position={[0.8, 0.28, -1.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.15, 0.4]} />
        <meshBasicMaterial color="#34d399" />
      </mesh>

      {/* Wing tip strobe lights */}
      <mesh ref={wingLightLRef} position={[-4.0, -0.1, 1.5]}>
        <boxGeometry args={[0.15, 0.1, 0.15]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <mesh ref={wingLightRRef} position={[4.0, -0.1, 1.5]}>
        <boxGeometry args={[0.15, 0.1, 0.15]} />
        <meshStandardMaterial color="#33ff33" emissive="#00ff00" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      
      {/* Wingtip Vapor Trails (Using actual scattering particle system) */}
      <group position={[-4.0, -0.1, 1.6]} ref={trailLRef} />
      <group position={[4.0, -0.1, 1.6]} ref={trailRRef} />

      {/* Engine glow point lights */}
      <pointLight position={[-0.55, -0.25, 3.4]} color="#00aaff" intensity={6} distance={12} />
      <pointLight position={[0.55, -0.25, 3.4]} color="#00aaff" intensity={6} distance={12} />
    </group>
  );
}

export function VehicleMesh({ type, isAttacking = false, targetPos }: {
  type: string;
  isAttacking?: boolean;
  targetPos?: THREE.Vector3;
}) {
  switch (type) {
    case "raid_helicopter": return <HelicopterMesh />;
    case "raid_drone": return <DroneMesh />;
    case "raid_rocket": return <RocketMesh />;
    case "raid_b2_bomber": return <B2BomberMesh />;
    case "raid_ufo": return <UFOMesh />;
    case "vehicle_tank": return <TankMesh isAttacking={isAttacking} targetPos={targetPos} />;
    case "futuristic_jet": return <FuturisticJetMesh />;
    default: return <AirplaneMesh />;
  }
}

// ─── Smoke Trail ──────────────────────────────────────────────

function SmokeTrail({ vehicleRef, active }: {
  vehicleRef: React.RefObject<THREE.Group | null>;
  active: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    age: number;
    maxAge: number;
  }[]>([]);
  const _matrix = useMemo(() => new THREE.Matrix4(), []);
  const _scale = useMemo(() => new THREE.Vector3(), []);
  const _worldPos = useMemo(() => new THREE.Vector3(), []);
  const _backward = useMemo(() => new THREE.Vector3(), []);
  const spawnTimer = useRef(0);

  useEffect(() => {
  if (!active) {
    particles.current = [];
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    if (active && vehicleRef.current) {
      spawnTimer.current += delta;
      if (spawnTimer.current >= 0.03) {
        spawnTimer.current = 0;
        vehicleRef.current.getWorldPosition(_worldPos);
        _backward.set(0, 0, 1).applyQuaternion(vehicleRef.current.quaternion);

        const spawnPos = _worldPos.clone().add(_backward.clone().multiplyScalar(6));

        if (particles.current.length < SMOKE_COUNT) {
          particles.current.push({
            pos: spawnPos,
            vel: new THREE.Vector3(
              (Math.random() - 0.5) * 2,
              Math.random() * 3 + 1,
              (Math.random() - 0.5) * 2,
            ),
            age: 0,
            maxAge: 0.8 + Math.random() * 0.6,
          });
        } else {
          let oldest = 0;
          for (let i = 1; i < particles.current.length; i++) {
            if (particles.current[i].age > particles.current[oldest].age) oldest = i;
          }
          const p = particles.current[oldest];
          p.pos.copy(spawnPos);
          p.vel.set(
            (Math.random() - 0.5) * 2,
            Math.random() * 3 + 1,
            (Math.random() - 0.5) * 2,
          );
          p.age = 0;
          p.maxAge = 0.8 + Math.random() * 0.6;
        }
      }
    }

    for (let i = 0; i < SMOKE_COUNT; i++) {
      const p = particles.current[i];
      if (!p || p.age >= p.maxAge) {
        _matrix.makeScale(0, 0, 0);
        meshRef.current.setMatrixAt(i, _matrix);
        continue;
      }

      p.age += delta;
      p.pos.addScaledVector(p.vel, delta);
      p.vel.y += delta * 2;
      p.vel.x += (Math.random() - 0.5) * delta * 4;
      p.vel.z += (Math.random() - 0.5) * delta * 4;

      const life = p.age / p.maxAge;
      const scale = (0.5 + life * 3) * 1.5;

      _matrix.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
      _scale.setScalar(scale);
      _matrix.scale(_scale);
      meshRef.current.setMatrixAt(i, _matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SMOKE_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial color="#888" transparent opacity={0.12} depthWrite={false} />
    </instancedMesh>
  );
}

// ─── Shockwave Ring ──────────────────────────────────────────

function Shockwave({ active, position, isMissile = false }: {
  active: boolean;
  position: THREE.Vector3;
  isMissile?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    if (active) timeRef.current = 0;
  }, [active]);

  useFrame((_, delta) => {
    if (!active || !meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;

    const scale = t * (isMissile ? 95 : 60);
    meshRef.current.scale.set(scale, scale, 1);

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 0.7 * (1 - t * 1.5));
  });

  if (!active) return null;

  return (
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.7, 1, 32]} />
      <meshBasicMaterial
        color="#ff6600"
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Projectile Pool (fires FROM vehicle) ────────────────────

function ProjectilePool({
  active,
  vehicleRef,
  targetPos,
  onImpact,
  origin = "vehicle",
  isDrone = false,
  vehicleType,
  flightDir,
}: {
  active: boolean;
  vehicleRef: React.RefObject<THREE.Group | null>;
  targetPos: THREE.Vector3;
  onImpact: () => void;
  origin?: "vehicle" | "tank_cannon";
  isDrone?: boolean;
  vehicleType?: string;
  flightDir?: THREE.Vector3;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const isTankShell = origin === "tank_cannon";
  const isBomber = vehicleType === "raid_b2_bomber";
  const projectileCount = isTankShell ? TANK_SHELL_COUNT : PROJECTILE_COUNT;
  const [explosions, setExplosions] = useState<ExplosionData[]>([]);
  const projectiles = useRef<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    target: THREE.Vector3;
    alive: boolean;
    spawned: boolean;
  }[]>([]);
  const nextSpawnIdx = useRef(0);
  const spawnTimer = useRef(0);
  const impactCount = useRef(0);
  const _matrix = useMemo(() => new THREE.Matrix4(), []);
  const _worldPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    projectiles.current = Array.from({ length: projectileCount }, () => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      target: new THREE.Vector3(),
      alive: false,
      spawned: false,
    }));
    nextSpawnIdx.current = 0;
    if (isTankShell) {
      spawnTimer.current = TANK_FIRE_INTERVAL - TANK_FIRE_DELAY;
    } else if (isBomber) {
      spawnTimer.current = -0.8; // Starts spawning at t = 0.8s
    } else {
      spawnTimer.current = -1.8; // Starts spawning at t = 1.8s
    }
    impactCount.current = 0;
  }, [active, projectileCount, isTankShell, isBomber]);

  useFrame((_, delta) => {
    if (!active || !meshRef.current) return;
    spawnTimer.current += delta;

    const spawnInterval = isTankShell ? TANK_FIRE_INTERVAL : (isBomber ? 0.10 : 0.18);
    if (nextSpawnIdx.current < projectileCount && spawnTimer.current >= spawnInterval) {
      spawnTimer.current = 0;
      const p = projectiles.current[nextSpawnIdx.current];
      if (p && !p.spawned && vehicleRef.current) {
        p.alive = true;
        p.spawned = true;
        vehicleRef.current.getWorldPosition(_worldPos);
        p.pos.copy(_worldPos);

        if (isTankShell) {
          const aimDir = targetPos.clone().sub(p.pos);
          aimDir.y = 0;
          if (aimDir.lengthSq() < 0.001) aimDir.set(0, 0, 1);
          aimDir.normalize();
          p.pos.addScaledVector(aimDir, 4.9);
          p.pos.y = _worldPos.y + 1.7;

          p.target.copy(targetPos);
          p.vel
            .copy(targetPos)
            .sub(p.pos)
            .normalize()
            .multiplyScalar(95)
            .add(new THREE.Vector3(
              (Math.random() - 0.5) * 4,
              12 + Math.random() * 4,
              (Math.random() - 0.5) * 4,
            ));
        } else if (isDrone) {
          // Dual alternating wingtip lasers for the drone!
          const sideOffset = nextSpawnIdx.current % 2 === 0 ? -1.2 : 1.2;
          const _localOffset = new THREE.Vector3(sideOffset, -0.2, -0.8);
          _localOffset.applyQuaternion(vehicleRef.current.quaternion);
          p.pos.add(_localOffset);

          p.target.copy(targetPos);
          p.vel
            .copy(targetPos)
            .sub(p.pos)
            .normalize()
            .multiplyScalar(150)
            .add(new THREE.Vector3(
              (Math.random() - 0.5) * 6,
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 6,
            ));
        } else if (isBomber) {
          // B-2 Bomber bomb: drops from plane with physics/gravity
          const T = 0.8 + Math.random() * 0.3; // duration of fall (staggered)
          // Add a random offset on the roof of the building so they bomb different parts of it
          const tPos = targetPos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 14,
            0,
            (Math.random() - 0.5) * 14
          ));
          p.target.copy(tPos);
          p.vel.x = (tPos.x - p.pos.x) / T;
          p.vel.z = (tPos.z - p.pos.z) / T;
          p.vel.y = (tPos.y - p.pos.y) / T + 0.5 * 20 * T; // Account for gravity acceleration of 20 units/s^2
        } else {
          p.target.copy(targetPos);
          p.vel
            .copy(targetPos)
            .sub(p.pos)
            .normalize()
            .multiplyScalar(120)
            .add(new THREE.Vector3(
              (Math.random() - 0.5) * 15,
              (Math.random() - 0.5) * 8,
              (Math.random() - 0.5) * 15,
            ));
        }
      }
      nextSpawnIdx.current++;
    }

    for (let i = 0; i < projectiles.current.length; i++) {
      const p = projectiles.current[i];
      if (!p.alive) {
        _matrix.makeScale(0, 0, 0);
        meshRef.current.setMatrixAt(i, _matrix);
        if (glowRef.current) glowRef.current.setMatrixAt(i, _matrix);
        continue;
      }

      p.vel.y -= (isTankShell ? 12 : 20) * delta;
      p.pos.addScaledVector(p.vel, delta);

      const checkDist = isTankShell ? 12 : (isBomber ? 3 : 10);
      if (p.pos.distanceTo(p.target) < checkDist || (isBomber && p.pos.y <= p.target.y)) {
        p.alive = false;
        impactCount.current++;
        if (impactCount.current % 2 === 0) playRaidSound("impact");
        // This triggers the screen shake on every projectile impact
        onImpact();
        if (impactCount.current >= projectileCount * 0.8) onImpact();
        setExplosions((prev) => [
          ...prev,
          {
            id: Math.random(),
            position: p.pos.clone(),
            createdAt: Date.now(),
          },
        ]);
      }

      if (p.pos.y < 0) p.alive = false;

      _matrix.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
      if (isTankShell) {
        _matrix.scale(new THREE.Vector3(1.6, 1.6, 1.6));
      }
      meshRef.current.setMatrixAt(i, _matrix);
      if (glowRef.current) glowRef.current.setMatrixAt(i, _matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (glowRef.current) glowRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Core — small bright bullet */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, projectileCount]} frustumCulled={false}>
        <sphereGeometry args={[isTankShell ? 0.45 : (isDrone ? 0.35 : (isBomber ? 0.85 : 0.6)), 6, 6]} />
        <meshStandardMaterial
          color={isTankShell ? "#f5d08a" : (isDrone ? "#00f5ff" : (isBomber ? "#ff3333" : "#ffaa00"))}
          emissive={isTankShell ? "#ff8c1a" : (isDrone ? "#0099ff" : (isBomber ? "#cc0000" : "#ff6600"))}
          emissiveIntensity={isTankShell ? 10 : (isDrone ? 12 : 8)}
          toneMapped={false}
        />
      </instancedMesh>
      {/* Glow halo — larger, transparent, trails behind */}
      <instancedMesh ref={glowRef} args={[undefined, undefined, projectileCount]} frustumCulled={false}>
        <sphereGeometry args={[isTankShell ? 1.35 : (isDrone ? 1.4 : (isBomber ? 2.5 : 2)), 8, 8]} />
        <meshBasicMaterial
          color={isTankShell ? "#ffb347" : (isDrone ? "#00baff" : (isBomber ? "#ff1111" : "#ff4400"))}
          transparent
          opacity={isTankShell ? 0.35 : (isDrone ? 0.4 : (isBomber ? 0.35 : 0.25))}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Render the updated explosion particle bursts */}
      {explosions.map((exp) => (
        <ExplosionParticles
          key={exp.id}
          position={exp.position}
          isDrone={isDrone}
          onComplete={() => {
            // Clean up the explosion state once the animation finishes
            setExplosions((prev) => prev.filter((e) => e.id !== exp.id));
          }}
        />
      ))}
    </group>
  );
}

// ─── Debris Particles (enhanced with fire) ───────────────────

function DebrisParticles({ active, origin, isMissile = false }: { active: boolean; origin: THREE.Vector3; isMissile?: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const particles = useRef<{ pos: THREE.Vector3; vel: THREE.Vector3; alive: boolean; size: number }[]>([]);
  const _matrix = useMemo(() => new THREE.Matrix4(), []);
  const _scale = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!active) return;
    particles.current = Array.from({ length: DEBRIS_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = isMissile ? (28 + Math.random() * 42) : (15 + Math.random() * 30);
      return {
        pos: origin.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 5,
          (Math.random() - 0.5) * 6,
        )),
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.random() * (isMissile ? 45 : 25) + 15,
          Math.sin(angle) * speed,
        ),
        alive: true,
        size: isMissile ? (0.4 + Math.random() * 0.9) : (0.2 + Math.random() * 0.5),
      };
    });
  }, [active, origin, isMissile]);

  useFrame((_, delta) => {
    if (!active || !meshRef.current) return;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      if (!p || !p.alive) {
        _matrix.makeScale(0, 0, 0);
        meshRef.current.setMatrixAt(i, _matrix);
        if (glowRef.current) glowRef.current.setMatrixAt(i, _matrix);
        continue;
      }

      p.vel.y -= 35 * delta;
      p.vel.multiplyScalar(0.995);
      p.pos.addScaledVector(p.vel, delta);

      if (p.pos.y < 0) p.alive = false;

      _matrix.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
      _scale.setScalar(p.size);
      _matrix.scale(_scale);
      meshRef.current.setMatrixAt(i, _matrix);
      if (glowRef.current) glowRef.current.setMatrixAt(i, _matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (glowRef.current) glowRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#555" />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.8, 4, 4]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.5} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

// ─── Fire Glow (post-explosion light) ────────────────────────

function FireGlow({ active, position, isMissile = false }: { active: boolean; position: THREE.Vector3; isMissile?: boolean }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!active || !lightRef.current) return;
    const flicker = 0.7
      + Math.sin(clock.elapsedTime * 15) * 0.15
      + Math.sin(clock.elapsedTime * 23) * 0.1
      + Math.sin(clock.elapsedTime * 37) * 0.05;
    lightRef.current.intensity = (isMissile ? 80 : 30) * flicker;
  });

  if (!active) return null;

  return (
    <pointLight
      ref={lightRef}
      position={[position.x, position.y + 5, position.z]}
      color="#ff4400"
      intensity={isMissile ? 80 : 30}
      distance={isMissile ? 140 : 80}
      decay={1.8}
    />
  );
}

// ─── Shield Dome ──────────────────────────────────────────────

function ShieldDome({ active, position, size, strength, hitIntensity }: {
  active: boolean;
  position: THREE.Vector3;
  size: number;
  strength: "weak" | "medium" | "strong";
  hitIntensity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!active || !meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    const basePulse = Math.sin(clock.elapsedTime * 4) * 0.05;
    const hitPulse = hitIntensity * 0.3;
    const baseOpacity = strength === "strong" ? 0.15 : strength === "medium" ? 0.1 : 0.05;
    mat.opacity = baseOpacity + basePulse + hitPulse;

    if (wireRef.current) {
      const wireMat = wireRef.current.material as THREE.MeshBasicMaterial;
      wireMat.opacity = (strength === "strong" ? 0.35 : strength === "medium" ? 0.2 : 0.1) + hitPulse * 0.5;
    }
  });

  if (!active) return null;

  const radius = size * 0.8;
  const color = strength === "strong" ? "#4080ff" : strength === "medium" ? "#40a0ff" : "#6060ff";

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wireRef}>
        <sphereGeometry args={[radius * 1.01, 20, 20]} />
        <meshBasicMaterial color="#00ccff" wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function RaidSequence3D({ phase, attacker, defender, raidData, onPhaseComplete }: Props) {
  const { camera } = useThree();
  const vehicleRef = useRef<THREE.Group>(null);
  const phaseTimeRef = useRef(0);
  const prevPhaseRef = useRef<RaidPhase>("idle");

  // Camera shake state (sine-based)
  const shakeRef = useRef({ intensity: 0, elapsed: 0 });

  const flightProgress = useRef(0);
  const soundPlayed = useRef(false);
  const climaxTriggered = useRef(false);
  const projectilesActive = useRef(false);
  const debrisActive = useRef(false);
  const shockwaveActive = useRef(false);
  const hitIntensityRef = useRef(0);
  const cameraSnapped = useRef(false);

  // Force re-render when refs that gate JSX visibility change
  const [, forceRender] = useState(0);

  // ── Positions ──

  const attackerPos = useMemo(() => {
    if (!attacker) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(attacker.position[0], attacker.height + 10, attacker.position[2]);
  }, [attacker]);

  const defenderTopPos = useMemo(() => {
    if (!defender) return new THREE.Vector3(100, 80, 0);
    return new THREE.Vector3(defender.position[0], defender.height + 5, defender.position[2]);
  }, [defender]);

  const defenderMiddlePos = useMemo(() => {
    if (!defender) return new THREE.Vector3(100, 40, 0);
    return new THREE.Vector3(defender.position[0], defender.height * 0.5, defender.position[2]);
  }, [defender]);

  const defenderLowerPos = useMemo(() => {
    if (!defender) return new THREE.Vector3(100, 15, 0);
    return new THREE.Vector3(defender.position[0], Math.max(6, defender.height * 0.15), defender.position[2]);
  }, [defender]);

  // Orbit entry: arrive from the attacker's direction
  const orbitStartAngle = useMemo(() => {
    return Math.atan2(
      attackerPos.z - defenderTopPos.z,
      attackerPos.x - defenderTopPos.x,
    );
  }, [attackerPos, defenderTopPos]);

  const orbitEntryPos = useMemo(() => {
    return new THREE.Vector3(
      defenderTopPos.x + Math.cos(orbitStartAngle) * ORBIT_RADIUS,
      defenderTopPos.y + ORBIT_HEIGHT,
      defenderTopPos.z + Math.sin(orbitStartAngle) * ORBIT_RADIUS,
    );
  }, [defenderTopPos, orbitStartAngle]);

  // Direction from attacker toward defender (horizontal)
  const flightDir = useMemo(() => {
    const dir = new THREE.Vector3(
      defenderTopPos.x - attackerPos.x,
      0,
      defenderTopPos.z - attackerPos.z,
    );
    if (dir.lengthSq() < 1.0) {
      // Fallback direction if attacker and defender are at the same spot (e.g. self-attack)
      return new THREE.Vector3(1, 0, 0);
    }
    return dir.normalize();
  }, [attackerPos, defenderTopPos]);

  const rocketImpactPos = useMemo(() => {
    if (!defender) return defenderTopPos;
    const buildingRadius = Math.max(defender.width ?? 10, defender.depth ?? 10) * 0.5;
    return new THREE.Vector3(
      defender.position[0] - flightDir.x * buildingRadius,
      defenderTopPos.y,
      defender.position[2] - flightDir.z * buildingRadius
    );
  }, [defender, defenderTopPos, flightDir]);

  // Where the intro liftoff ends (must match intro phase final position)
  const liftEndPos = useMemo(() => {
    const rooftopY = attackerPos.y - 10;
    return new THREE.Vector3(
      attackerPos.x + flightDir.x * 8,
      rooftopY + 8,
      attackerPos.z + flightDir.z * 8,
    );
  }, [attackerPos, flightDir]);

  // Flight path: starts where intro ends, high cruise, descend to orbit entry
  const flightCurve = useMemo(() => {
    const cruiseHeight = Math.max(liftEndPos.y, orbitEntryPos.y) + 80;
    const mid = new THREE.Vector3().lerpVectors(liftEndPos, orbitEntryPos, 0.5);
    mid.y = cruiseHeight;

    // Depart forward + up (not straight up)
    const depart = liftEndPos.clone()
      .add(flightDir.clone().multiplyScalar(35))
      .setY(liftEndPos.y + 25);

    // Approach from behind orbit entry, slightly above
    const approach = orbitEntryPos.clone()
      .add(flightDir.clone().multiplyScalar(-25))
      .setY(orbitEntryPos.y + 15);

    return new THREE.CatmullRomCurve3([
      liftEndPos.clone(),
      depart,
      mid,
      approach,
      orbitEntryPos.clone(),
    ]);
  }, [liftEndPos, orbitEntryPos, flightDir]);

  // Vehicle type detection
  const vehicleType = raidData?.vehicle ?? "airplane";
  const isGround = useMemo(() => isGroundVehicle(vehicleType), [vehicleType]);

  // Ground vehicle positions: start at attacker ground level, drive to defender
  const groundStartPos = useMemo(() => {
    return new THREE.Vector3(
      attackerPos.x,
      0.35, // ground level (concrete walkways)
      attackerPos.z,
    );
  }, [attackerPos]);

  const groundFirePos = useMemo(() => {
    // Fire position: on the ground, GROUND_FIRE_OFFSET away from defender
    return new THREE.Vector3(
      defenderTopPos.x - flightDir.x * GROUND_FIRE_OFFSET,
      0.35, // ground level (concrete walkways)
      defenderTopPos.z - flightDir.z * GROUND_FIRE_OFFSET,
    );
  }, [defenderTopPos, flightDir]);

  const groundDriveEndPos = useMemo(() => {
    // Where the intro drive-forward ends (ground level, 8 units forward)
    return new THREE.Vector3(
      attackerPos.x + flightDir.x * 8,
      0.35, // ground level (concrete walkways)
      attackerPos.z + flightDir.z * 8,
    );
  }, [attackerPos, flightDir]);

  // Ground flight curve: straight line on the ground with slight approach curve
  const groundFlightCurve = useMemo(() => {
    const mid = new THREE.Vector3().lerpVectors(groundDriveEndPos, groundFirePos, 0.5);
    mid.y = 0.35; // flat on walkway ground level
    // Slight S-curve for visual interest (not a straight line)
    const perpX = -flightDir.z;
    const perpZ = flightDir.x;
    mid.x += perpX * 8;
    mid.z += perpZ * 8;

    return new THREE.CatmullRomCurve3([
      groundDriveEndPos.clone(),
      mid,
      groundFirePos.clone(),
    ]);
  }, [groundDriveEndPos, groundFirePos, flightDir]);

  // Defense strength
  const defenseStrength = useMemo((): "weak" | "medium" | "strong" => {
    if (!raidData) return "medium";
    const ds = raidData.defense_score;
    if (ds <= 15) return "weak";
    if (ds <= 40) return "medium";
    return "strong";
  }, [raidData]);

  // Phase change reset
  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      phaseTimeRef.current = 0;
      prevPhaseRef.current = phase;
      flightProgress.current = 0;
      soundPlayed.current = false;
      climaxTriggered.current = false;
      projectilesActive.current = false;
      hitIntensityRef.current = 0;
      cameraSnapped.current = false;

      // Keep explosion effects alive through outro phases
      if (phase !== "outro_win" && phase !== "outro_lose") {
        debrisActive.current = false;
        shockwaveActive.current = false;
      }
    }
  }, [phase]);

  const triggerShake = (intensity: number) => {
    shakeRef.current.intensity = Math.max(shakeRef.current.intensity, intensity);
    shakeRef.current.elapsed = 0;
  };

  // Reusable vectors (avoid GC)
  const _camTarget = useMemo(() => new THREE.Vector3(), []);
  const _tempVec = useMemo(() => new THREE.Vector3(), []);
  const _vehicleTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    phaseTimeRef.current += delta;
    const t = phaseTimeRef.current;

    // Direct frame-perfect visibility control for the kamikaze rocket to keep it hidden/destroyed
    if (vehicleRef.current) {
      const shouldHideRocket = vehicleType === "raid_rocket" && (
        climaxTriggered.current ||
        phase === "outro_win" ||
        phase === "outro_lose" ||
        phase === "share"
      );
      vehicleRef.current.visible = !shouldHideRocket;
    }

    // ── Camera Shake: sine oscillation with exponential decay ──
    const s = shakeRef.current;
    if (s.intensity > 0.01) {
      s.elapsed += delta;
      const decay = Math.exp(-s.elapsed * 5);
      camera.position.set(
        camera.position.x + Math.sin(s.elapsed * 25) * s.intensity * decay,
        camera.position.y + Math.cos(s.elapsed * 30) * s.intensity * 0.6 * decay,
        camera.position.z,
      );
      camera.rotation.set(
        camera.rotation.x,
        camera.rotation.y,
        camera.rotation.z + Math.sin(s.elapsed * 20) * s.intensity * 0.012 * decay,
      );

      if (decay < 0.01) s.intensity = 0;
    }

    // ── Decay hit intensity ──
    if (hitIntensityRef.current > 0) {
      hitIntensityRef.current *= 0.92;
      if (hitIntensityRef.current < 0.01) hitIntensityRef.current = 0;
    }

    switch (phase) {
      // ───────── INTRO: camera focuses, vehicle starts, then moves out ─────────
      case "intro": {
        const rooftopY = attackerPos.y - 10;

        if (isGround) {
          // ── GROUND INTRO: tank rumbles on the ground then drives forward ──
          const camProgress = Math.min(t / 1.5, 1);
          const camEase = smoothstep(camProgress);

          // Camera: low behind attacker, dolly in close to ground
          const camBehindX = -flightDir.x;
          const camBehindZ = -flightDir.z;
          const camStartDist = 60 - camEase * 25;
          const camStartY = 8 + camEase * 6;

          _camTarget.set(
            groundStartPos.x + camBehindX * camStartDist,
            camStartY,
            groundStartPos.z + camBehindZ * camStartDist,
          );

          if (!cameraSnapped.current) {
            cameraSnapped.current = true;
            camera.position.copy(_camTarget);
          } else {
            camera.position.lerp(_camTarget, 0.08);
          }
          camera.lookAt(groundStartPos);

          if (vehicleRef.current) {
            // Drive forward on the ground
            const driveProgress = Math.max(0, Math.min((t - 1.0) / 1.5, 1));
            const driveEase = smoothstep(driveProgress);

            vehicleRef.current.position.set(
              groundStartPos.x + flightDir.x * driveEase * 8,
              0.35,
              groundStartPos.z + flightDir.z * driveEase * 8,
            );

            // Face toward defender
            _vehicleTarget.set(defenderTopPos.x, 0.35, defenderTopPos.z);
            vehicleRef.current.lookAt(_vehicleTarget);
            vehicleRef.current.rotateY(Math.PI);
            vehicleRef.current.scale.setScalar(2);
          }

          if (t >= 3.0) onPhaseComplete("intro");
        } else {
          // ── AIR INTRO: liftoff from rooftop ──
          const camProgress = Math.min(t / 1.8, 1);
          const camEase = smoothstep(camProgress);

          const camBehindX = -flightDir.x;
          const camBehindZ = -flightDir.z;
          const camStartDist = 90 - camEase * 45;
          const camStartY = attackerPos.y + 50 - camEase * 25;

          _camTarget.set(
            attackerPos.x + camBehindX * camStartDist,
            camStartY,
            attackerPos.z + camBehindZ * camStartDist,
          );

          if (!cameraSnapped.current) {
            cameraSnapped.current = true;
            camera.position.copy(_camTarget);
          } else {
            camera.position.lerp(_camTarget, 0.08);
          }
          camera.lookAt(attackerPos);

          if (vehicleRef.current) {
            const liftProgress = Math.max(0, Math.min((t - 1.5) / 1.5, 1));
            const liftEase = smoothstep(liftProgress);

            const startY = rooftopY + 6;
            vehicleRef.current.position.set(
              attackerPos.x + flightDir.x * liftEase * 8,
              startY + liftEase * 8,
              attackerPos.z + flightDir.z * liftEase * 8,
            );

            _vehicleTarget.set(
              defenderTopPos.x,
              rooftopY + liftEase * 10,
              defenderTopPos.z,
            );
            vehicleRef.current.lookAt(_vehicleTarget);
            vehicleRef.current.rotateY(Math.PI);
            vehicleRef.current.rotateX(liftProgress * 0.08);
            vehicleRef.current.scale.setScalar(2);
          }

          if (t >= 3.5) onPhaseComplete("intro");
        }
        break;
      }

      // ───────── FLIGHT: follow spline, trailing camera ─────────
      case "flight": {
        if (isGround) {
          // ── GROUND FLIGHT: drive along ground toward defender ──
          flightProgress.current = Math.min(flightProgress.current + delta * 0.28, 1);
          const fp = flightProgress.current;
          const eased = smoothstep(fp);

          const point = groundFlightCurve.getPoint(eased);
          const tangent = groundFlightCurve.getTangent(eased).normalize();
          const lookTarget = point.clone().add(tangent);

          if (vehicleRef.current) {
            vehicleRef.current.position.copy(point);
            vehicleRef.current.position.y = 0; // stay on ground
            vehicleRef.current.lookAt(lookTarget.x, 0, lookTarget.z);
            vehicleRef.current.rotateY(Math.PI);
            vehicleRef.current.scale.setScalar(2);
          }

          // Camera: low trailing shot, behind and slightly above
          const hTangentLen = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z) || 1;
          const hTanX = tangent.x / hTangentLen;
          const hTanZ = tangent.z / hTangentLen;
          const perpX = -hTanZ;
          const perpZ = hTanX;

          const trailDist = 30 + (1 - fp) * 15;
          const trailHeight = 8 + Math.sin(fp * Math.PI) * 5;
          const sideDist = 10 + Math.sin(fp * Math.PI) * 6;

          _camTarget.set(
            point.x - hTanX * trailDist + perpX * sideDist,
            trailHeight,
            point.z - hTanZ * trailDist + perpZ * sideDist,
          );
          camera.position.lerp(_camTarget, 0.12);

          _tempVec.lerpVectors(point, lookTarget, 0.5);
          _tempVec.y = 2;
          camera.lookAt(_tempVec);

          if (fp >= 1.0) onPhaseComplete("flight");
        } else {
          // ── AIR FLIGHT: follow spline, faster ──
          flightProgress.current = Math.min(flightProgress.current + delta * 0.24, 1);
          const fp = flightProgress.current;
          const eased = smoothstep(fp);

          const point = flightCurve.getPoint(eased);
          const tangent = flightCurve.getTangent(eased).normalize();
          const lookTarget = point.clone().add(tangent);

          if (vehicleRef.current) {
            vehicleRef.current.position.copy(point);
            vehicleRef.current.lookAt(lookTarget);
            vehicleRef.current.rotateY(Math.PI);
            vehicleRef.current.scale.setScalar(2);

            const bankAmount = Math.sin(fp * Math.PI) * -0.12;
            vehicleRef.current.rotateZ(bankAmount);
          }

          const hTangentLen = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z) || 1;
          const hTanX = tangent.x / hTangentLen;
          const hTanZ = tangent.z / hTangentLen;
          const perpX = -hTanZ;
          const perpZ = hTanX;

          const trailDist = 50 + (1 - fp) * 20;
          const trailHeight = 20 + Math.sin(fp * Math.PI) * 15;
          const sideDist = 20 + Math.sin(fp * Math.PI) * 10;

          _camTarget.set(
            point.x - hTanX * trailDist + perpX * sideDist,
            point.y + trailHeight,
            point.z - hTanZ * trailDist + perpZ * sideDist,
          );
          camera.position.lerp(_camTarget, 0.1);

          _tempVec.lerpVectors(point, lookTarget, 0.5);
          camera.lookAt(_tempVec);

          if (fp >= 1.0) onPhaseComplete("flight");
        }
        break;
      }

      // ───────── ATTACK: vehicle-specific attack pattern ─────────
      case "attack": {
        const topX = defenderTopPos.x;
        const topY = defenderTopPos.y;
        const topZ = defenderTopPos.z;
        const ap = t / ATTACK_DURATION; // 0 → 1

        if (isGround) {
          // ── GROUND ATTACK: tank parked on ground, fires shells at building ──
          if (vehicleRef.current) {
            // Tank is stationary at fire position, slight recoil shake
            const recoilPulse = getTankFirePulse(t);
            const recoilX = recoilPulse * (-flightDir.x) * 0.3;
            const recoilZ = recoilPulse * (-flightDir.z) * 0.3;

            vehicleRef.current.position.set(
              groundFirePos.x + recoilX,
              0.35,
              groundFirePos.z + recoilZ,
            );

            // Face the defender building
            _vehicleTarget.set(topX, 0.35, topZ);
            vehicleRef.current.lookAt(_vehicleTarget);
            vehicleRef.current.rotateY(Math.PI);
            vehicleRef.current.scale.setScalar(2);
          }

          // Camera: over-the-shoulder behind the tank on its level, looking at the middle of the building
          const behindDist = 26 - ap * 5; // Dolly in from 26 to 21
          const camY = 5.5 - ap * 1.5;    // Keep it low, slowly lowering from 5.5 to 4.0
          const perpX = -flightDir.z;
          const perpZ = flightDir.x;
          // Slight offset to the side for a gorgeous over-the-shoulder composition
          const sideOffset = 3.5;

          _camTarget.set(
            groundFirePos.x - flightDir.x * behindDist + perpX * sideOffset,
            camY,
            groundFirePos.z - flightDir.z * behindDist + perpZ * sideOffset,
          );
          camera.position.lerp(_camTarget, 0.08);

          // Focus on the lower midpoint between tank and building base to keep tank fully in frame
          _tempVec.set(
            (groundFirePos.x + topX) * 0.5,
            Math.max(6, topY * 0.15),
            (groundFirePos.z + topZ) * 0.5,
          );
          camera.lookAt(_tempVec);

        } else {
          // ── AIR ATTACK: vehicle-specific trajectories ──
          let vehicleX = topX;
          let vehicleY = topY + ORBIT_HEIGHT;
          let vehicleZ = topZ;
          let lookAtTarget = defenderTopPos.clone();
          let extraRotateZ = 0;
          let extraRotateX = 0;

          if (vehicleType === "raid_helicopter") {
            // Hover gunship pattern: flies to position, hovers with sway
            const hoverX = topX - flightDir.x * 28;
            const hoverZ = topZ - flightDir.z * 28;
            const hoverY = topY + 12 + Math.sin(t * 3) * 1.5;

            vehicleX = hoverX + Math.sin(t * 1.5) * 2;
            vehicleY = hoverY;
            vehicleZ = hoverZ + Math.cos(t * 1.5) * 2;
            lookAtTarget.copy(defenderTopPos);
            extraRotateX = 0.08; // slightly nose down
          } 
          else if (vehicleType === "raid_drone") {
            // Stealth Drone: hovers close, slides left and right
            const slideWidth = Math.sin(t * 2.5) * 8;
            const perpX = -flightDir.z;
            const perpZ = flightDir.x;

            vehicleX = topX - flightDir.x * 22 + perpX * slideWidth;
            vehicleY = topY + 16 + Math.sin(t * 4) * 0.8;
            vehicleZ = topZ - flightDir.z * 22 + perpZ * slideWidth;
            lookAtTarget.copy(defenderTopPos);
          }
          else if (vehicleType === "raid_ufo") {
            // UFO: hovers directly above the building, slowly spinning
            vehicleX = topX;
            vehicleY = topY + 28 + Math.sin(t * 2) * 1.0;
            vehicleZ = topZ;
            // Face straight forward relative to original path, spin is inside UFOMesh
            lookAtTarget.set(topX + flightDir.x * 10, vehicleY, topZ + flightDir.z * 10);
          }
          else if (vehicleType === "raid_b2_bomber") {
            // B-2 Bomber: high-altitude straight bombing run
            const startPos = defenderTopPos.clone().sub(flightDir.clone().multiplyScalar(50)).setY(topY + 35);
            const endPos = defenderTopPos.clone().add(flightDir.clone().multiplyScalar(50)).setY(topY + 35);
            const currentPos = new THREE.Vector3().lerpVectors(startPos, endPos, ap);

            vehicleX = currentPos.x;
            vehicleY = currentPos.y;
            vehicleZ = currentPos.z;
            lookAtTarget.copy(currentPos).add(flightDir);
          }
          else if (vehicleType === "raid_rocket") {
            // Rocket: high-speed kamikaze charge, impacts at ap = 0.8
            const startPos = orbitEntryPos.clone().setY(topY + 20);
            // Hit defender building facade instead of center to avoid clipping!
            const currentPos = new THREE.Vector3().lerpVectors(startPos, rocketImpactPos, Math.min(ap * 1.25, 1));

            vehicleX = currentPos.x;
            vehicleY = currentPos.y;
            vehicleZ = currentPos.z;
            const rocketDir = new THREE.Vector3().subVectors(rocketImpactPos, startPos).normalize();
            lookAtTarget.copy(currentPos).add(rocketDir);
          }
          else if (vehicleType === "futuristic_jet") {
            // Futuristic Jet: supersonic swooping strafing run
            const swoopHeight = topY + 8 + Math.pow(ap - 0.5, 2) * 90;
            const startX = topX - flightDir.x * 60;
            const endX = topX + flightDir.x * 60;
            const currentX = THREE.MathUtils.lerp(startX, endX, ap);
            const startZ = topZ - flightDir.z * 60;
            const endZ = topZ + flightDir.z * 60;
            const currentZ = THREE.MathUtils.lerp(startZ, endZ, ap);

            vehicleX = currentX;
            vehicleY = swoopHeight;
            vehicleZ = currentZ;
            lookAtTarget.set(currentX + flightDir.x * 10, swoopHeight - (ap - 0.5) * 15, currentZ + flightDir.z * 10);
            extraRotateZ = Math.sin(t * 8) * 0.15; // supersonic wings wobble
          }
          else {
            // Default Airplane: Orbiting gun run
            const orbitAngle = orbitStartAngle - t * ORBIT_SPEED;
            vehicleX = topX + Math.cos(orbitAngle) * ORBIT_RADIUS;
            vehicleZ = topZ + Math.sin(orbitAngle) * ORBIT_RADIUS;
            vehicleY = topY + ORBIT_HEIGHT + Math.sin(t * 2) * 3;

            const tangentX = Math.sin(orbitAngle);
            const tangentZ = -Math.cos(orbitAngle);

            lookAtTarget.set(
              vehicleX + tangentX * 30,
              vehicleY - 2,
              vehicleZ + tangentZ * 30,
            );
            extraRotateZ = 0.25;
          }

          if (vehicleRef.current) {
            vehicleRef.current.position.set(vehicleX, vehicleY, vehicleZ);
            vehicleRef.current.scale.setScalar(2);
            vehicleRef.current.lookAt(lookAtTarget);
            vehicleRef.current.rotateY(Math.PI);
            if (extraRotateZ) vehicleRef.current.rotateZ(extraRotateZ);
            if (extraRotateX) vehicleRef.current.rotateX(extraRotateX);
          }

          // Camera: Orbiting dynamic view
          const orbitAngle = orbitStartAngle - t * ORBIT_SPEED;
          const camOrbitOffset = Math.PI * 0.5;
          const camAngle = orbitAngle + camOrbitOffset + ap * Math.PI * 0.25;
          const camDist = ORBIT_RADIUS * 1.5;
          const camY = topY + 30 + ap * 10;

          _camTarget.set(
            topX + Math.cos(camAngle) * camDist,
            camY,
            topZ + Math.sin(camAngle) * camDist,
          );
          camera.position.lerp(_camTarget, 0.06);

          const vehicleBlend = Math.max(0, 0.25 - ap * 0.4);
          _tempVec.set(
            vehicleX * vehicleBlend + topX * (1 - vehicleBlend),
            vehicleY * vehicleBlend + topY * (1 - vehicleBlend),
            vehicleZ * vehicleBlend + topZ * (1 - vehicleBlend),
          );
          camera.lookAt(_tempVec);
        }

        // ── Event triggers (shared for all vehicle types) ──

        // Sound at 0.8s
        if (t >= 0.8 && !soundPlayed.current) {
          soundPlayed.current = true;
          playRaidSound("shoot");
        }

        // Progressive shake during strafing (1.5s+)
        if (t >= 1.5 && t < 3.2) {
          const strafeProgress = (t - 1.5) / 1.7;
          triggerShake((0.15 + strafeProgress * 0.4) * delta * 8);
        }

        // Climax at 3.2s (adjusted for 4s duration)
        if (t >= 3.2 && !climaxTriggered.current) {
          climaxTriggered.current = true;
          const isMissile = vehicleType === "raid_rocket";
          if (raidData?.success) {
            triggerShake(isMissile ? 6.0 : 4.0);
            playRaidSound("explosion");
            debrisActive.current = true;
            shockwaveActive.current = true;
          } else {
            triggerShake(isMissile ? 3.5 : 1.5);
            playRaidSound("shield_hit");
            hitIntensityRef.current = 1;
          }
          forceRender(n => n + 1);
        }

        // Vehicle reacts after climax
        if (climaxTriggered.current && vehicleRef.current) {
          if (isGround) {
            // Tank: dramatic halt/recoil, no flying away
            if (raidData?.success) {
              // Tank stays but camera pulls up for dramatic reveal
              vehicleRef.current.position.copy(groundFirePos);
              vehicleRef.current.position.y = 0.35;
              _vehicleTarget.set(defenderTopPos.x, 0.35, defenderTopPos.z);
              vehicleRef.current.lookAt(_vehicleTarget);
              vehicleRef.current.rotateY(Math.PI);
              vehicleRef.current.scale.setScalar(2);
            } else {
              vehicleRef.current.rotation.z += Math.sin(t * 8) * delta * 0.5;
            }
          } else {
            // Air: vehicle rises/wobbles
            if (raidData?.success) {
              vehicleRef.current.position.y += delta * 15;
            } else {
              vehicleRef.current.rotation.z += Math.sin(t * 12) * delta * 2;
              vehicleRef.current.position.y += delta * 5;
            }
          }
        }

        if (t >= ATTACK_DURATION) onPhaseComplete("attack");
        break;
      }

      // ───────── OUTRO WIN: dramatic crane shot ─────────
      case "outro_win": {
        const progress = Math.min(t / 3.0, 1);
        const ease = easeOutCubic(progress);

        if (isGround) {
          // Tank stays on the ground, camera cranes up for dramatic reveal
          if (vehicleRef.current) {
            vehicleRef.current.position.copy(groundFirePos);
            vehicleRef.current.position.y = 0.35;
            _vehicleTarget.set(defenderTopPos.x, 0.35, defenderTopPos.z);
            vehicleRef.current.lookAt(_vehicleTarget);
            vehicleRef.current.rotateY(Math.PI);
            vehicleRef.current.scale.setScalar(2);
          }

          const riseY = 8 + ease * 40;
          const slowAngle = t * 0.2;
          const dist = GROUND_FIRE_OFFSET * 2;

          _camTarget.set(
            groundFirePos.x + Math.cos(slowAngle) * dist,
            riseY,
            groundFirePos.z + Math.sin(slowAngle) * dist,
          );
          camera.position.lerp(_camTarget, 0.07);
          camera.lookAt(defenderTopPos);
        } else {
          // Air: vehicle circles in victory
          const topX = defenderTopPos.x;
          const topY = defenderTopPos.y;
          const topZ = defenderTopPos.z;
          const riseY = defenderTopPos.y + 15 + ease * 35;
          const slowAngle = t * 0.15;
          const dist = ORBIT_RADIUS * 1.6;

          _camTarget.set(
            defenderTopPos.x + Math.cos(slowAngle) * dist,
            riseY,
            defenderTopPos.z + Math.sin(slowAngle) * dist,
          );
          camera.position.lerp(_camTarget, 0.07);
          camera.lookAt(defenderTopPos);

          if (vehicleRef.current) {
            if (vehicleType === "raid_ufo") {
              // UFO: hovers directly above, pulsing tractor beam
              vehicleRef.current.position.set(topX, topY + 28 + Math.sin(t * 1.5) * 0.5, topZ);
              _vehicleTarget.set(topX + flightDir.x * 10, vehicleRef.current.position.y, topZ + flightDir.z * 10);
              vehicleRef.current.lookAt(_vehicleTarget);
              vehicleRef.current.rotateY(Math.PI);
            }
            else if (vehicleType === "raid_b2_bomber") {
              // B-2: flies straight away into the distance
              const startX = topX + flightDir.x * 50;
              const startZ = topZ + flightDir.z * 50;
              const currentX = startX + flightDir.x * t * 30;
              const currentZ = startZ + flightDir.z * t * 30;
              const lookAtTarget = new THREE.Vector3();
              vehicleRef.current.position.set(currentX, topY + 35 + t * 4, currentZ);
              lookAtTarget.set(currentX + flightDir.x * 10, topY + 35 + t * 4, currentZ + flightDir.z * 10);
              vehicleRef.current.lookAt(lookAtTarget);
              vehicleRef.current.rotateY(Math.PI);
            }
            else if (vehicleType === "raid_rocket") {
              // Rocket is hidden/destroyed (visible logic handles this)
            }
            else if (vehicleType === "futuristic_jet") {
              // Supersonic vertical climb!
              const currentX = topX + flightDir.x * t * 25;
              const currentZ = topZ + flightDir.z * t * 25;
              const currentY = topY + 8 + t * 45;
              const lookAtTarget = new THREE.Vector3();
              vehicleRef.current.position.set(currentX, currentY, currentZ);

              const climbDir = flightDir.clone().setY(2.2).normalize();
              lookAtTarget.copy(vehicleRef.current.position).add(climbDir);
              vehicleRef.current.lookAt(lookAtTarget);
              vehicleRef.current.rotateY(Math.PI);
            }
            else if (vehicleType === "raid_helicopter") {
              // Helicopter: hovers and slowly ascends while swaying
              const hoverX = topX - flightDir.x * 28 + Math.sin(t * 2) * 3;
              const hoverZ = topZ - flightDir.z * 28 + Math.cos(t * 2) * 3;
              const hoverY = topY + 12 + t * 8;
              vehicleRef.current.position.set(hoverX, hoverY, hoverZ);
              vehicleRef.current.lookAt(defenderTopPos);
              vehicleRef.current.rotateY(Math.PI);
            }
            else {
              // Default airplane victory circle
              const victoryAngle = orbitStartAngle - (phaseTimeRef.current + ATTACK_DURATION) * ORBIT_SPEED * 0.3;
              const victoryDist = ORBIT_RADIUS * 1.5;
              vehicleRef.current.position.set(
                defenderTopPos.x + Math.cos(victoryAngle) * victoryDist,
                defenderTopPos.y + ORBIT_HEIGHT + 20 + t * 5,
                defenderTopPos.z + Math.sin(victoryAngle) * victoryDist,
              );

              const vTangentX = Math.sin(victoryAngle);
              const vTangentZ = -Math.cos(victoryAngle);
              _vehicleTarget.set(
                vehicleRef.current.position.x + vTangentX * 30,
                vehicleRef.current.position.y,
                vehicleRef.current.position.z + vTangentZ * 30,
              );
              vehicleRef.current.lookAt(_vehicleTarget);
              vehicleRef.current.rotateY(Math.PI);
              vehicleRef.current.rotateZ(0.15);
            }
          }
        }
        if (t >= 3.0) {
          onPhaseComplete("outro_win");
        }
        break;
      }

      // ───────── OUTRO LOSE: vehicle retreats ─────────
      case "outro_lose": {
        const progress = Math.min(t / 2.5, 1);

        if (vehicleRef.current) {
          _tempVec.set(
            attackerPos.x - defenderTopPos.x,
            0,
            attackerPos.z - defenderTopPos.z,
          ).normalize();

          if (isGround) {
            // Tank reverses on the ground
            vehicleRef.current.position.addScaledVector(_tempVec, delta * 25);
            vehicleRef.current.position.y = 0;

            // Damaged smoking wobble on ground
            vehicleRef.current.rotation.z = Math.sin(t * 6) * 0.08 * (1 - progress);

            _vehicleTarget.copy(vehicleRef.current.position).addScaledVector(_tempVec, 20);
            _vehicleTarget.setY(0);
            vehicleRef.current.lookAt(_vehicleTarget);
            vehicleRef.current.rotateY(Math.PI);
          } else {
            // Fly away back towards attacker direction
            vehicleRef.current.position.addScaledVector(_tempVec, delta * 40);
            vehicleRef.current.position.y += delta * 8;

            vehicleRef.current.rotation.z = Math.sin(t * 8) * 0.3 * (1 - progress);

            _vehicleTarget.copy(vehicleRef.current.position).addScaledVector(_tempVec, 20);
            _vehicleTarget.setY(vehicleRef.current.position.y);
            vehicleRef.current.lookAt(_vehicleTarget);
            vehicleRef.current.rotateY(Math.PI);
          }

          const scale = Math.max(0.01, 2 * (1 - progress * 0.5));
          vehicleRef.current.scale.setScalar(scale);

          if (progress < 0.6) {
            camera.lookAt(vehicleRef.current.position);
          }
        }

        // Camera pull back
        const loseAngle = t * 0.12;
        const loseDist = isGround ? GROUND_FIRE_OFFSET * 2 : ORBIT_RADIUS * 1.4;
        const loseY = isGround ? 8 + progress * 20 : defenderTopPos.y + 20 + progress * 25;
        _camTarget.set(
          defenderTopPos.x + Math.cos(loseAngle) * loseDist,
          loseY,
          defenderTopPos.z + Math.sin(loseAngle) * loseDist,
        );
        camera.position.lerp(_camTarget, 0.05);

        if (progress > 0.6) {
          camera.lookAt(defenderTopPos);
        }
        if (t >= 2.5) {
          onPhaseComplete("outro_lose");
        }
        break;
      }

      default:
        break;
    }
  });

  if (phase === "idle" || phase === "preview" || phase === "done") return null;

  const isTank = vehicleType === "vehicle_tank";
  const isAttack = phase === "attack";
  const isOutro = phase === "outro_win" || phase === "outro_lose";
  const showSmoke = phase === "flight" || isAttack;

  return (
    <group>
      {/* Vehicle */}
      <group
        ref={vehicleRef}
        scale={2}
        visible={!(vehicleType === "raid_rocket" && (
          climaxTriggered.current || 
          phase === "outro_win" || 
          phase === "outro_lose" || 
          phase === "share"
        ))}
      >
        <VehicleMesh type={vehicleType} isAttacking={isAttack} targetPos={isGround ? defenderLowerPos : defenderTopPos} />
      </group>

      {/* UFO Tractor Beam */}
      {isAttack && vehicleType === "raid_ufo" && (
        <mesh position={[defenderTopPos.x, defenderTopPos.y + 12.5, defenderTopPos.z]}>
          <cylinderGeometry args={[2.5, 4.5, 25, 16]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.25 + Math.sin(phaseTimeRef.current * 18) * 0.12} depthWrite={false} />
        </mesh>
      )}

      {/* Smoke Trail */}
      <SmokeTrail vehicleRef={vehicleRef} active={showSmoke} />

      {/* Red targeting light on defender */}
      {(phase === "flight" || phase === "attack") && (
        <group position={[defenderTopPos.x, defenderTopPos.y + 30, defenderTopPos.z]}>
          <pointLight color="#ff2020" intensity={8} distance={60} />
        </group>
      )}

      {/* Projectiles from vehicle */}
      <ProjectilePool
        active={isAttack && vehicleType !== "raid_rocket"}
        vehicleRef={vehicleRef}
        targetPos={isGround ? defenderLowerPos : defenderTopPos}
        origin={isTank ? "tank_cannon" : "vehicle"}
        isDrone={vehicleType === "raid_drone"}
        vehicleType={vehicleType}
        flightDir={flightDir}
        onImpact={() => {
          triggerShake(0.8);
          hitIntensityRef.current = 0.5;
        }}
      />

      {/* Shield dome */}
      <ShieldDome
        active={isAttack && defenseStrength !== "weak"}
        position={isGround ? defenderMiddlePos : defenderTopPos}
        size={Math.max(defender?.width ?? 10, defender?.depth ?? 10)}
        strength={defenseStrength}
        hitIntensity={hitIntensityRef.current}
      />

      {/* Shockwave ring */}
      <Shockwave 
        active={(isAttack || isOutro) && (!!raidData?.success || vehicleType === "raid_rocket") && climaxTriggered.current} 
        position={vehicleType === "raid_rocket" ? rocketImpactPos : (isGround ? defenderLowerPos : defenderTopPos)} 
        isMissile={vehicleType === "raid_rocket"}
      />

      {/* Debris */}
      <DebrisParticles 
        active={(isAttack || isOutro) && !!raidData?.success && climaxTriggered.current} 
        origin={vehicleType === "raid_rocket" ? rocketImpactPos : (isGround ? defenderLowerPos : defenderTopPos)} 
        isMissile={vehicleType === "raid_rocket"}
      />

      {/* Fire glow */}
      <FireGlow 
        active={(isAttack || isOutro) && !!raidData?.success && climaxTriggered.current} 
        position={vehicleType === "raid_rocket" ? rocketImpactPos : (isGround ? defenderLowerPos : defenderTopPos)} 
        isMissile={vehicleType === "raid_rocket"}
      />

      {/* Climax Fireball Explosion (engulfs building) */}
      <ClimaxExplosion 
        active={(isAttack || isOutro) && (!!raidData?.success || vehicleType === "raid_rocket") && climaxTriggered.current} 
        position={vehicleType === "raid_rocket" ? rocketImpactPos : (isGround ? defenderLowerPos : defenderTopPos)}
        isMissile={vehicleType === "raid_rocket"}
      />
    </group>
  );
}
interface ClimaxExplosionProps {
  active: boolean;
  position: THREE.Vector3;
  isMissile?: boolean;
}

function ClimaxExplosion({ active, position, isMissile = false }: ClimaxExplosionProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startTime = useRef<number | null>(null);
  const particleCount = isMissile ? 35 : 20;
  const particles = useRef<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    scale: number;
    maxScale: number;
    elapsed: number;
    life: number;
  }[]>([]);

  const _matrix = useMemo(() => new THREE.Matrix4(), []);
  const _scale = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!active) {
      startTime.current = null;
      return;
    }
    if (startTime.current !== null) return;
    startTime.current = Date.now();

    particles.current = Array.from({ length: particleCount }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const speed = isMissile ? (8 + Math.random() * 26) : (5 + Math.random() * 12);
      
      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed + (isMissile ? 7 : 3),
        Math.cos(phi) * speed
      );

      const maxScale = isMissile ? (12.0 + Math.random() * 12.0) : (4.0 + Math.random() * 5.0);
      
      return {
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * (isMissile ? 6 : 2),
          (Math.random() - 0.5) * (isMissile ? 6 : 2),
          (Math.random() - 0.5) * (isMissile ? 6 : 2)
        ),
        vel,
        scale: 0.1,
        maxScale,
        elapsed: 0,
        life: isMissile ? (1.5 + Math.random() * 0.9) : (0.8 + Math.random() * 0.5),
      };
    });
  }, [active, isMissile, particleCount]);

  useFrame((_, delta) => {
    if (!active || !meshRef.current || startTime.current === null) return;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      if (!p) continue;

      p.elapsed += delta;
      const progress = p.elapsed / p.life;

      if (progress >= 1.0) {
        _matrix.makeScale(0, 0, 0);
        meshRef.current.setMatrixAt(i, _matrix);
        continue;
      }

      p.pos.addScaledVector(p.vel, delta);
      p.vel.multiplyScalar(0.94);

      let size = p.scale;
      if (progress < 0.2) {
        size = THREE.MathUtils.lerp(0.1, p.maxScale, progress / 0.2);
      } else {
        size = THREE.MathUtils.lerp(p.maxScale, 0.0, (progress - 0.2) / 0.8);
      }
      p.scale = size;

      _matrix.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
      _scale.set(size, size, size);
      _matrix.scale(_scale);
      meshRef.current.setMatrixAt(i, _matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff8800"
          emissiveIntensity={10}
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

interface ExplosionParticlesProps {
  position: THREE.Vector3;
  isDrone?: boolean;
  onComplete: () => void;
}

function ExplosionParticles({ position, isDrone = false, onComplete }: ExplosionParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startTime = useRef(Date.now());
  const particleCount = 15;

  // Generate directions and scales for our 3D debris cubes
  const [velocities, matrices] = useMemo(() => {
    const vels: THREE.Vector3[] = [];
    const mats: THREE.Matrix4[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      // Burst outward uniformly
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const speed = 6 + Math.random() * 12;

      vels.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      ));

      // Create a transformation matrix for each cube particle
      const matrix = new THREE.Matrix4();
      const scale = 0.3 + Math.random() * 0.5; // Random particle size
      matrix.makeScale(scale, scale, scale);
      mats.push(matrix);
    }
    return [vels, mats];
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const elapsed = Date.now() - startTime.current;

    // Fade out and move particles over time
    for (let i = 0; i < particleCount; i++) {
      const mat = matrices[i];
      const vel = velocities[i];
      
      // Extract position from matrix, add velocity, and update matrix
      const pos = new THREE.Vector3().setFromMatrixPosition(mat);
      pos.addScaledVector(vel, delta);
      
      // Apply deceleration/gravity slightly
      vel.y -= 5 * delta;

      // Rebuild the matrix with new position
      mat.setPosition(pos);
      meshRef.current.setMatrixAt(i, mat);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Remove the explosion from memory after 0.5 seconds
    if (elapsed > 500) {
      onComplete();
    }
  });

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
          color={isDrone ? "#00e5ff" : "#ff4400"} 
          emissive={isDrone ? "#0066ff" : "#ff1100"} 
          emissiveIntensity={3} 
          toneMapped={false} 
        />
      </instancedMesh>
    </group>
  );
}