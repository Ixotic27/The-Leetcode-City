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

// ─── Building dimensions ────────────────────────────────
const BW = 105, BD = 58, BH = 125;   // Base
const MW = 100, MD = 56, MH = 155;   // Mid
const TW = 72,  TD = 45, TH = 95;    // Top
const TOTAL_H = BH + MH + TH + 12;

// ─── Flame pixel bitmap (11 × 16) for facades ───────────────────────
const FLAME_BM: number[][] = [
  [0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,0,1,1,1,1,1],
  [1,1,1,1,1,0,1,1,1,1,1],
  [1,1,1,1,0,0,1,1,1,1,1],
  [1,1,1,0,0,0,0,0,1,1,1],
  [0,1,1,0,0,0,0,0,1,1,0],
  [0,0,1,0,0,0,0,0,1,0,0],
];
const FLAME_CORE_BM: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,1,0,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0],
];

// ─── Narrow flame for sides (5 × 13) ────────────────────
const SIDE_FLAME_BM: number[][] = [
  [0,0,1,0,0],
  [0,0,1,0,0],
  [0,0,1,1,0],
  [0,1,1,1,0],
  [0,1,1,1,0],
  [0,1,1,1,0],
  [1,1,1,1,1],
  [1,1,1,1,1],
  [1,1,1,1,1],
  [1,1,0,1,1],
  [1,1,0,1,1],
  [1,0,0,0,1],
  [0,0,0,0,0],
];

// ─── 3D voxel flame (rooftop mascot) ────────────────────
const VOXEL_FLAME_BM: number[][] = [
  [0,0,0,1,0,0,0],
  [0,0,0,1,1,0,0],
  [0,0,1,1,1,0,0],
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
  [0,1,1,1,1,1,1],
  [0,1,1,1,1,1,1],
  [1,1,1,0,1,1,1],
  [1,1,1,0,1,1,1],
  [1,1,0,0,0,1,1],
  [0,1,0,0,0,1,0],
];
const VOXEL_CORE_BM: number[][] = [
  [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0],
  [0,0,0,1,0,0,0],
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
  [0,1,1,1,1,1,0],
  [0,1,1,1,1,1,0],
  [0,0,1,0,1,0,0],
  [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0],
];

interface VoxelFlame {
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  coreMat: THREE.MeshStandardMaterial;
}

function createVoxelFlame(accent: string): VoxelFlame {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 2.6, toneMapped: false,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: "#ffe27a", emissive: "#ffe27a", emissiveIntensity: 3.6, toneMapped: false,
  });

  const CUBE = 2.4;
  const CORE_CUBE = 1.6;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const coreGeo = new THREE.BoxGeometry(CORE_CUBE, CORE_CUBE, CORE_CUBE);
  const cols = VOXEL_FLAME_BM[0].length;
  const rows = VOXEL_FLAME_BM.length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!VOXEL_FLAME_BM[r][c]) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (c - (cols - 1) / 2) * CUBE,
        ((rows - 1 - r) - (rows - 1) / 2) * CUBE,
        0,
      );
      group.add(mesh);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!VOXEL_CORE_BM[r][c]) continue;
      const mesh = new THREE.Mesh(coreGeo, coreMat);
      mesh.position.set(
        (c - (cols - 1) / 2) * CUBE,
        ((rows - 1 - r) - (rows - 1) / 2) * CUBE,
        CUBE * 0.55,
      );
      group.add(mesh);
    }
  }

  return { group, mat, coreMat };
}

interface FirecrawlBuildingProps {
  onClick: () => void;
  position?: [number, number, number];
  themeAccent?: string;
  themeWindowLit?: string[];
  themeFace?: string;
}

export default function FirecrawlBuilding({
  onClick,
  position = [85, 0, -840],
  themeAccent = "#ff5c1f",
  themeWindowLit = ["#ff6a2e", "#ff4a00", "#ffaa4c"],
  themeFace = "#3a1a0d",
}: FirecrawlBuildingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const flameGroupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const flameLightFront = useRef<THREE.PointLight>(null);
  const flameLightBack = useRef<THREE.PointLight>(null);
  const baseEmberRef = useRef<THREE.PointLight>(null);

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

  const fxCol = Math.floor((15 - 11) / 2);
  const fxRow = Math.floor((18 - 16) / 2);
  const sxCol = Math.floor((9 - 5) / 2);
  const sxRow = Math.floor((15 - 13) / 2);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;

  const mFront = useMemo(() =>
    createGlassTex(15, 18, 51, themeWindowLit, windowOff, themeFace, themeAccent, FLAME_BM, fxCol, fxRow),
    [themeWindowLit, windowOff, themeFace, themeAccent, fxCol, fxRow]
  );
  const mSide = useMemo(() =>
    createGlassTex(9, 15, 201, themeWindowLit, windowOff, themeFace, themeAccent, SIDE_FLAME_BM, sxCol, sxRow),
    [themeWindowLit, windowOff, themeFace, themeAccent, sxCol, sxRow]
  );
  const bFront = useMemo(() =>
    createGlassTex(15, 10, 76, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const bSide = useMemo(() =>
    createGlassTex(6, 10, 89, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const tFront = useMemo(() =>
    createGlassTex(15, 8, 58, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const tSide = useMemo(() =>
    createGlassTex(5, 8, 69, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );

  useEffect(() => () => {
    mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose();
  }, [mFront, mSide, bFront, bSide, tFront, tSide]);

  const voxelFlame = useMemo(() => createVoxelFlame(themeAccent), [themeAccent]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (flameGroupRef.current) {
      flameGroupRef.current.rotation.y = Math.sin(t * 1.2) * 0.18;
      flameGroupRef.current.position.y = Math.sin(t * 2.3) * 1.5;
      const sy = 1 + Math.sin(t * 4.7) * 0.07 + Math.sin(t * 2.1) * 0.04;
      flameGroupRef.current.scale.set(1, sy, 1);
      voxelFlame.mat.emissiveIntensity = 2.6 + Math.sin(t * 5.3) * 0.6 + Math.sin(t * 11.1) * 0.25;
    }

    if (beaconRef.current) {
      beaconRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.15);
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2 + Math.sin(t * 1.5) * 0.8;
    }

    const flameFlicker = 55 + Math.sin(t * 4.1) * 18 + Math.sin(t * 7.3) * 10;
    if (flameLightFront.current) flameLightFront.current.intensity = flameFlicker;
    if (flameLightBack.current) flameLightBack.current.intensity = flameFlicker;
    if (baseEmberRef.current) {
      baseEmberRef.current.intensity = 22 + Math.sin(t * 3.2) * 8 + Math.sin(t * 8.7) * 4;
    }
  });

  const topY = TOTAL_H;
  const antennaY = topY + 25;

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      {/* Invisible hitbox */}
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

      <pointLight ref={flameLightFront} position={[0, M_Y, MD / 2 + 22]} color={themeAccent} intensity={55} distance={110} decay={2} />
      <pointLight ref={flameLightBack} position={[0, M_Y, -MD / 2 - 22]} color={themeAccent} intensity={55} distance={110} decay={2} />

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

      {/* Antenna */}
      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Voxel mascot flame */}
      <group position={[0, antennaY + 38, 0]} scale={1.6}>
        <group ref={flameGroupRef}>
          <primitive object={voxelFlame.group} />
        </group>
        <pointLight color={themeAccent} intensity={70} distance={160} decay={2} />
      </group>

      {/* Beacon */}
      <mesh ref={beaconRef} position={[0, antennaY + 70, 0]}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshStandardMaterial color={themeAccent} emissive={themeAccent} emissiveIntensity={2.5} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, antennaY + 70, 0]} color={themeAccent} intensity={20} distance={100} decay={2} />

      <pointLight ref={baseEmberRef} position={[0, 10, BD / 2 + 10]} color={themeAccent} intensity={22} distance={55} decay={2} />
    </group>
  );
}
