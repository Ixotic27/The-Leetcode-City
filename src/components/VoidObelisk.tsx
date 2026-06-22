"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGlassTex,
  BoxSection,
  AccentBand,
  PlatformBase,
  useShellColors,
} from "./LandmarkUtils";

// ─── Constants ───────────────────────────────────────────────
const ACCENT = "#c084fc";
const FACE = "#1a1030";
const LIT_COLORS = ["#c084fc", "#a855f7", "#7c3aed", "#e9d5ff", "#ddd6fe"];

// Building sections (massive tapered dark-crystal tower)
const BW = 100, BD = 75, BH = 180;
const MW = 80, MD = 60, MH = 160;
const TW = 55, TD = 42, TH = 120;
const TOTAL_H = BH + MH + TH + 12; // ~472

// ─── Void symbol pixel art (7×9) ────────────────────────────
const VOID_BM: number[][] = [
  [0,0,0,1,0,0,0],
  [0,0,1,1,1,0,0],
  [0,1,0,1,0,1,0],
  [1,0,0,1,0,0,1],
  [1,1,1,1,1,1,1],
  [1,0,0,1,0,0,1],
  [0,1,0,1,0,1,0],
  [0,0,1,1,1,0,0],
  [0,0,0,1,0,0,0],
];

// Orbiting Voxel Eye Mascot
function createVoxelEye(accent: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 3.2, toneMapped: false,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: "#251249", emissive: "#251249", emissiveIntensity: 0.8, toneMapped: false,
  });
  const CUBE = 2.4;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  
  const VOID_EYE_BM: number[][] = [
    [0,0,1,1,1,0,0],
    [0,1,0,0,0,1,0],
    [1,0,0,1,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,1,0,0,1],
    [0,1,0,0,0,1,0],
    [0,0,1,1,1,0,0],
  ];
  const cols = VOID_EYE_BM[0].length;
  const rows = VOID_EYE_BM.length;

  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!VOID_EYE_BM[r][c]) continue;
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const mesh = new THREE.Mesh(geo, isCore ? mat : darkMat);
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

interface VoidObeliskProps {
  onClick: () => void;
  position?: [number, number, number];
}

export default function VoidObelisk({
  onClick,
  position = [735, 0, 235], // Ring 1, plaza 0
}: VoidObeliskProps) {
  const groupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const crystalRef = useRef<THREE.Group>(null);

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

  const { shellColor, windowOff } = useShellColors(FACE);

  const MIN_COLS = VOID_BM[0].length + 4;
  const mRows = VOID_BM.length + 2;
  const txCol = Math.floor((MIN_COLS - VOID_BM[0].length) / 2);
  const txRow = Math.floor((mRows - VOID_BM.length) / 2);

  const mFront = useMemo(() =>
    createGlassTex(MIN_COLS, mRows, 44, LIT_COLORS, windowOff, FACE, ACCENT, VOID_BM, txCol, txRow),
    [windowOff, txCol, txRow]
  );
  const mFrontB = useMemo(() =>
    createGlassTex(MIN_COLS, mRows, 102, LIT_COLORS, windowOff, FACE, ACCENT, VOID_BM, txCol, txRow),
    [windowOff, txCol, txRow]
  );
  const mSide = useMemo(() =>
    createGlassTex(5, mRows, 85, LIT_COLORS, windowOff, FACE),
    [windowOff]
  );
  const bFront = useMemo(() =>
    createGlassTex(MIN_COLS, 12, 76, LIT_COLORS, windowOff, FACE),
    [windowOff]
  );
  const bSide = useMemo(() =>
    createGlassTex(6, 12, 89, LIT_COLORS, windowOff, FACE),
    [windowOff]
  );
  const tFront = useMemo(() =>
    createGlassTex(MIN_COLS, 8, 58, LIT_COLORS, windowOff, FACE),
    [windowOff]
  );
  const tSide = useMemo(() =>
    createGlassTex(4, 8, 69, LIT_COLORS, windowOff, FACE),
    [windowOff]
  );

  useEffect(() => () => {
    mFront.dispose(); mFrontB.dispose(); mSide.dispose();
    bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose();
  }, [mFront, mFrontB, mSide, bFront, bSide, tFront, tSide]);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;

  const voxelEye = useMemo(() => createVoxelEye(ACCENT), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beaconRef.current) {
      beaconRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.15);
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2 + Math.sin(t * 1.5) * 0.8;
    }
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.45;
      crystalRef.current.position.y = Math.sin(t * 1.5) * 2;
    }
  });

  const topY = TOTAL_H;
  const antennaY = topY + 25;

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      <mesh position={[0, TOTAL_H / 2, 0]} visible={false}>
        <cylinderGeometry args={[60, 60, TOTAL_H, 8]} />
        <meshBasicMaterial />
      </mesh>

      <PlatformBase w={BW} d={BD} accent={ACCENT} shellColor={shellColor} />

      <BoxSection
        w={BW} h={BH} d={BD} y={B_Y}
        shellColor={shellColor} glassFront={bFront} glassSide={bSide}
        emColor={LIT_COLORS[0]} accent={ACCENT}
      />
      <AccentBand w={BW} d={BD} y={BH + 4} accent={ACCENT} />

      <BoxSection
        w={MW} h={MH} d={MD} y={M_Y}
        shellColor={shellColor} glassFront={mFront} glassSide={mSide}
        emColor={LIT_COLORS[0]} accent={ACCENT}
      />
      <AccentBand w={MW} d={MD} y={BH + MH + 4} accent={ACCENT} />

      <BoxSection
        w={TW} h={TH} d={TD} y={T_Y}
        shellColor={shellColor} glassFront={tFront} glassSide={tSide}
        emColor={LIT_COLORS[0]} accent={ACCENT}
      />

      <mesh position={[0, topY, 0]}>
        <boxGeometry args={[TW + 4, 1.2, TD + 4]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1} toneMapped={false} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Voxel Eye Mascot */}
      <group position={[0, antennaY + 38, 0]} scale={1.8}>
        <group ref={crystalRef}>
          <primitive object={voxelEye} />
        </group>
        <pointLight color={ACCENT} intensity={70} distance={150} decay={2} />
      </group>

      {/* Beacon */}
      <mesh ref={beaconRef} position={[0, antennaY + 68, 0]}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={2.5} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, antennaY + 68, 0]} color={ACCENT} intensity={20} distance={100} decay={2} />

      {/* Lights */}
      <pointLight position={[0, M_Y, MD / 2 + 20]} color={ACCENT} intensity={40} distance={90} decay={2} />
      <pointLight position={[0, M_Y, -MD / 2 - 20]} color={ACCENT} intensity={40} distance={90} decay={2} />
      <pointLight position={[0, 10, BD / 2 + 10]} color={ACCENT} intensity={18} distance={50} decay={2} />
    </group>
  );
}
