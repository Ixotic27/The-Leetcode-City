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

// ─── DeveloperPalace dimensions ────────────────────────────────
const BW = 100, BD = 80, BH = 145;   // Base
const MW = 85,  MD = 65, MH = 135;   // Mid
const TW = 65,  TD = 50, TH = 105;   // Top
const TOTAL_H = BH + MH + TH + 12;

// Crown logo/symbol bitmap (7×5)
const CROWN_BM: number[][] = [
  [1,0,0,1,0,0,1],
  [1,1,0,1,0,1,1],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [0,1,1,1,1,1,0],
];

// Crossed 3D Voxel Crown
function createVoxelCrown(accent: string): THREE.Group {
  const group = new THREE.Group();
  
  const goldMat = new THREE.MeshStandardMaterial({
    color: "#fbbf24", // gold
    emissive: "#d97706",
    emissiveIntensity: 2.6,
    toneMapped: false,
    roughness: 0.1,
    metalness: 0.9,
  });
  
  const rubyMat = new THREE.MeshStandardMaterial({
    color: "#ef4444", // ruby red gems
    emissive: "#ef4444",
    emissiveIntensity: 3.2,
    toneMapped: false,
  });

  const CUBE = 2.4;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const cols = CROWN_BM[0].length;
  const rows = CROWN_BM.length;

  // Two crossed planes for 3D appearance
  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!CROWN_BM[r][c]) continue;
        const isGem = r === 1 && (c === 0 || c === 3 || c === 6);
        const mesh = new THREE.Mesh(geo, isGem ? rubyMat : goldMat);
        mesh.position.set(
          (c - (cols - 1) / 2) * CUBE,
          ((rows - 1 - r) - (rows - 1) / 2) * CUBE,
          0,
        );
        plane.add(mesh);
      }
    }
    group.add(plane);
  }

  return group;
}

interface DeveloperPalaceProps {
  onClick: () => void;
  position?: [number, number, number];
  themeAccent?: string;
  themeWindowLit?: string[];
  themeFace?: string;
}

export default function DeveloperPalace({
  onClick,
  position = [-548, 0, -735],
  themeAccent = "#fbbf24",
  themeWindowLit = ["#fbbf24", "#f59e0b", "#fffbeb", "#fef3c7"],
  themeFace = "#241805",
}: DeveloperPalaceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const crownGroupRef = useRef<THREE.Group>(null);
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
  const fxRow = Math.floor((12 - 5) / 2);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;

  const mFront = useMemo(() =>
    createGlassTex(12, 12, 99, themeWindowLit, windowOff, themeFace, themeAccent, CROWN_BM, fxCol, fxRow),
    [themeWindowLit, windowOff, themeFace, themeAccent, fxCol, fxRow]
  );
  const mSide = useMemo(() =>
    createGlassTex(8, 12, 105, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const bFront = useMemo(() =>
    createGlassTex(12, 9, 44, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const bSide = useMemo(() =>
    createGlassTex(6, 9, 55, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const tFront = useMemo(() =>
    createGlassTex(12, 7, 66, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );
  const tSide = useMemo(() =>
    createGlassTex(5, 7, 77, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace]
  );

  useEffect(() => () => {
    mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose();
  }, [mFront, mSide, bFront, bSide, tFront, tSide]);

  const voxelCrown = useMemo(() => createVoxelCrown(themeAccent), [themeAccent]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (crownGroupRef.current) {
      crownGroupRef.current.rotation.y = t * 0.45;
      crownGroupRef.current.position.y = Math.sin(t * 1.5) * 1.5;
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

      {/* Voxel Crown Mascot */}
      <group position={[0, antennaY + 38, 0]} scale={1.8}>
        <group ref={crownGroupRef}>
          <primitive object={voxelCrown} />
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
