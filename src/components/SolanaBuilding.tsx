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

// ─── Solana building dimensions ────────────────────────────────
const BW = 110, BD = 60, BH = 130;   // Base
const MW = 90,  MD = 50, MH = 120;   // Mid
const TW = 60,  TD = 40, TH = 100;   // Top
const TOTAL_H = BH + MH + TH + 12;

// Solana Logo Facade Grid
const SOLANA_BM: number[][] = [
  [0,0,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,0,0],
  [1,1,1,1,1,1,0,0,0,0],
];

// Voxel Solana logo (3 slices of slanted parallelograms)
const VOXEL_SOLANA_BM: number[][] = [
  [0,0,1,1,1,1,1],
  [0,1,1,1,1,1,0],
  [1,1,1,1,1,0,0],
  [0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1],
  [0,1,1,1,1,1,0],
  [1,1,1,1,1,0,0],
  [0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1],
  [0,1,1,1,1,1,0],
  [1,1,1,1,1,0,0],
];

function createVoxelSolana(accent: string): THREE.Group {
  const group = new THREE.Group();
  
  // Custom materials for gradient
  const purpleMat = new THREE.MeshStandardMaterial({
    color: "#9945FF", emissive: "#9945FF", emissiveIntensity: 2.8, toneMapped: false,
  });
  const cyanMat = new THREE.MeshStandardMaterial({
    color: "#14F195", emissive: "#14F195", emissiveIntensity: 2.8, toneMapped: false,
  });

  const CUBE = 2.4;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const cols = VOXEL_SOLANA_BM[0].length;
  const rows = VOXEL_SOLANA_BM.length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!VOXEL_SOLANA_BM[r][c]) continue;
      // Determine material based on row position (gradient top-to-bottom)
      const mat = r < 4 ? purpleMat : r < 8 ? cyanMat : purpleMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (c - (cols - 1) / 2) * CUBE,
        ((rows - 1 - r) - (rows - 1) / 2) * CUBE,
        0,
      );
      group.add(mesh);
    }
  }

  return group;
}

interface SolanaBuildingProps {
  onClick: () => void;
  position?: [number, number, number];
  themeAccent?: string;
  themeWindowLit?: string[];
  themeFace?: string;
}

export default function SolanaBuilding({
  onClick,
  position = [767, 0, -352],
  themeAccent = "#9945FF",
  themeWindowLit = ["#9945FF", "#14F195", "#8b5cf6", "#06b6d4"],
  themeFace = "#100926",
}: SolanaBuildingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const logoGroupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const lightFront = useRef<THREE.PointLight>(null);
  const lightBack = useRef<THREE.PointLight>(null);

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

  const fxCol = Math.floor((15 - 10) / 2);
  const fxRow = Math.floor((15 - 11) / 2);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;

  const mFront = useMemo(() =>
    createGlassTex(15, 15, 77, themeWindowLit, windowOff, themeFace, themeAccent, SOLANA_BM, fxCol, fxRow),
    [themeWindowLit, windowOff, themeFace, themeAccent, fxCol, fxRow]
  );
  const mSide = useMemo(() =>
    createGlassTex(9, 15, 91, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const bFront = useMemo(() =>
    createGlassTex(15, 10, 55, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const bSide = useMemo(() =>
    createGlassTex(6, 10, 66, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const tFront = useMemo(() =>
    createGlassTex(15, 8, 88, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const tSide = useMemo(() =>
    createGlassTex(5, 8, 99, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );

  useEffect(() => () => {
    mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose();
  }, [mFront, mSide, bFront, bSide, tFront, tSide]);

  const voxelSolana = useMemo(() => createVoxelSolana(themeAccent), [themeAccent]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (logoGroupRef.current) {
      logoGroupRef.current.rotation.y = t * 0.5;
      logoGroupRef.current.position.y = Math.sin(t * 1.5) * 2;
    }

    if (beaconRef.current) {
      beaconRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.15);
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2 + Math.sin(t * 1.5) * 0.8;
    }

    const lightI = 45 + Math.sin(t * 2) * 15;
    if (lightFront.current) lightFront.current.intensity = lightI;
    if (lightBack.current) lightBack.current.intensity = lightI;
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

      <pointLight ref={lightFront} position={[0, M_Y, MD / 2 + 20]} color={themeAccent} intensity={30} distance={80} decay={2} />
      <pointLight ref={lightBack} position={[0, M_Y, -MD / 2 - 20]} color={themeAccent} intensity={30} distance={80} decay={2} />

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

      {/* Voxel Solana Mascot */}
      <group position={[0, antennaY + 38, 0]} scale={1.8}>
        <group ref={logoGroupRef}>
          <primitive object={voxelSolana} />
        </group>
        <pointLight color={themeAccent} intensity={60} distance={130} decay={2} />
      </group>

      {/* Beacon */}
      <mesh ref={beaconRef} position={[0, antennaY + 68, 0]}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshStandardMaterial color={themeAccent} emissive={themeAccent} emissiveIntensity={2.5} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, antennaY + 68, 0]} color={themeAccent} intensity={20} distance={100} decay={2} />
    </group>
  );
}
