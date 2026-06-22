"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGlassTex,
  BoxSection,
  PlatformBase,
  useShellColors,
} from "./LandmarkUtils";

// ─── CyberStation dimensions ────────────────────────────────
const BW = 95, BD = 75, BH = 160;   // Base
const MW = 80, MD = 62, MH = 150;   // Mid
const TW = 60, TD = 48, TH = 110;   // Top
const TOTAL_H = BH + MH + TH + 12;

// Custom neon cyber symbol bitmap (7×7)
const CYBER_BM: number[][] = [
  [1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1],
  [1,0,1,0,1,0,1],
  [1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1],
];

// Orbiting Voxel Planet / Satellite
function createVoxelSatellite(accent: string): THREE.Group {
  const group = new THREE.Group();
  
  const greenMat = new THREE.MeshStandardMaterial({
    color: "#22c55e", emissive: "#22c55e", emissiveIntensity: 2.8, toneMapped: false,
  });
  const cyanMat = new THREE.MeshStandardMaterial({
    color: "#06b6d4", emissive: "#06b6d4", emissiveIntensity: 2.8, toneMapped: false,
  });

  const CUBE = 2.4;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);

  // Draw a core 3x3x3 sphere
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // Round off corners
        if (Math.abs(x) + Math.abs(y) + Math.abs(z) > 2) continue;
        const mesh = new THREE.Mesh(geo, cyanMat);
        mesh.position.set(x * CUBE, y * CUBE, z * CUBE);
        group.add(mesh);
      }
    }
  }

  // Draw flat ring
  const ringGroup = new THREE.Group();
  ringGroup.name = "ring";
  for (let r = 0; r < 12; r++) {
    const angle = (r / 12) * Math.PI * 2;
    const radius = 9.0;
    const mesh = new THREE.Mesh(geo, greenMat);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    ringGroup.add(mesh);
  }
  group.add(ringGroup);

  return group;
}

interface CyberStationProps {
  onClick: () => void;
  position?: [number, number, number];
  themeAccent?: string;
  themeWindowLit?: string[];
  themeFace?: string;
}

export default function CyberStation({
  onClick,
  position = [-910, 0, 111],
  themeAccent = "#10b981",
  themeWindowLit = ["#10b981", "#3b82f6", "#06b6d4", "#a855f7"],
  themeFace = "#061510",
}: CyberStationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mascotGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  const { gl, camera } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  const onClickRef = useRef(onClick);
  useEffect(() => { onClickRef.current = onClick; }, [onClick]);

  useEffect(() => {
    const canvas = gl.domElement;
    const hits = (e: PointerEvent): boolean => {
      const group = groupRef.current;
      if (!group) return false;
      const rect = canvas.getBoundingClientRect();
      ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);
      return raycaster.current.intersectObject(group, true).length > 0;
    };

    let tap: { time: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (hits(e)) tap = { time: performance.now(), x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!tap) return;
      const elapsed = performance.now() - tap.time;
      const dx = e.clientX - tap.x;
      const dy = e.clientY - tap.y;
      tap = null;
      if (elapsed > 300 || dx * dx + dy * dy > 100) return;
      onClickRef.current();
    };

    canvas.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    return () => {
      canvas.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
    };
  }, [gl, camera]);

  const { shellColor, windowOff } = useShellColors(themeFace);

  const fxCol = Math.floor((12 - 7) / 2);
  const fxRow = Math.floor((12 - 7) / 2);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;

  const mFront = useMemo(() =>
    createGlassTex(12, 12, 88, themeWindowLit, windowOff, themeFace, themeAccent, CYBER_BM, fxCol, fxRow),
    [themeWindowLit, windowOff, themeFace, themeAccent, fxCol, fxRow]
  );
  const mSide = useMemo(() =>
    createGlassTex(8, 12, 94, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const bFront = useMemo(() =>
    createGlassTex(12, 9, 33, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const bSide = useMemo(() =>
    createGlassTex(6, 9, 44, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const tFront = useMemo(() =>
    createGlassTex(12, 7, 55, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const tSide = useMemo(() =>
    createGlassTex(5, 7, 66, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );

  useEffect(() => () => {
    mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose();
  }, [mFront, mSide, bFront, bSide, tFront, tSide]);

  const voxelMascot = useMemo(() => createVoxelSatellite(themeAccent), [themeAccent]);

  // Extract the ring group for custom animation
  useEffect(() => {
    if (voxelMascot) {
      const ring = voxelMascot.getObjectByName("ring") as THREE.Group;
      if (ring) {
        ringRef.current = ring;
      }
    }
  }, [voxelMascot]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (mascotGroupRef.current) {
      mascotGroupRef.current.rotation.y = t * 0.4;
      mascotGroupRef.current.position.y = Math.sin(t * 1.8) * 1.5;
    }

    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.8;
      ringRef.current.rotation.y = t * 0.2;
    }

    if (beaconRef.current) {
      beaconRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.15);
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2 + Math.sin(t * 1.5) * 0.8;
    }
  });

  const topY = TOTAL_H;
  const antennaY = topY + 25;

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      <mesh position={[0, TOTAL_H / 2, 0]} visible={false}>
        <cylinderGeometry args={[65, 65, TOTAL_H, 8]} />
        <meshBasicMaterial />
      </mesh>

      <PlatformBase w={BW} d={BD} accent={themeAccent} shellColor={shellColor} />

      <BoxSection
        w={BW} h={BH} d={BD} y={B_Y}
        shellColor={shellColor} glassFront={bFront} glassSide={bSide}
        emColor={themeWindowLit[0]} accent={themeAccent}
      />

      <mesh position={[0, BH + 4, 0]}>
        <boxGeometry args={[BW + 2, 1.5, BD + 2]} />
        <meshStandardMaterial color={themeAccent} emissive={themeAccent} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>

      <BoxSection
        w={MW} h={MH} d={MD} y={M_Y}
        shellColor={shellColor} glassFront={mFront} glassSide={mSide}
        emColor={themeWindowLit[0]} accent={themeAccent}
      />

      <mesh position={[0, BH + MH + 8, 0]}>
        <boxGeometry args={[MW + 2, 1.5, MD + 2]} />
        <meshStandardMaterial color={themeAccent} emissive={themeAccent} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>

      <BoxSection
        w={TW} h={TH} d={TD} y={T_Y}
        shellColor={shellColor} glassFront={tFront} glassSide={tSide}
        emColor={themeWindowLit[0]} accent={themeAccent}
      />

      <mesh position={[0, topY, 0]}>
        <boxGeometry args={[TW + 4, 1.2, TD + 4]} />
        <meshStandardMaterial color={themeAccent} emissive={themeAccent} emissiveIntensity={1} toneMapped={false} />
      </mesh>

      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Orbiting Voxel Planet */}
      <group position={[0, antennaY + 38, 0]} scale={1.8}>
        <group ref={mascotGroupRef}>
          <primitive object={voxelMascot} />
        </group>
        <pointLight color={themeAccent} intensity={60} distance={130} decay={2} />
      </group>

      <mesh ref={beaconRef} position={[0, antennaY + 68, 0]}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshStandardMaterial color={themeAccent} emissive={themeAccent} emissiveIntensity={2.5} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, antennaY + 68, 0]} color={themeAccent} intensity={20} distance={100} decay={2} />
    </group>
  );
}
