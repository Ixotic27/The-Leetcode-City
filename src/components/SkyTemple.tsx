"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGlassTex, BoxSection, AccentBand, PlatformBase, useShellColors,
} from "./LandmarkUtils";

const ACCENT = "#ec4899";
const FACE = "#1a0818";
const LIT_COLORS = ["#ec4899", "#f472b6", "#fb7185", "#be185d", "#db2777"];

const BW = 95, BD = 72, BH = 165;
const MW = 78, MD = 58, MH = 148;
const TW = 56, TD = 42, TH = 105;
const TOTAL_H = BH + MH + TH + 12;

// Lotus/flame pixel art (7×9)
const LOTUS_BM: number[][] = [
  [0,0,0,1,0,0,0],
  [0,0,1,1,1,0,0],
  [0,1,0,1,0,1,0],
  [1,0,0,1,0,0,1],
  [1,0,1,1,1,0,1],
  [1,1,0,1,0,1,1],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
  [0,0,0,1,0,0,0],
];

// Voxel Lotus Mascot
function createVoxelLotus(accent: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 2.8, toneMapped: false,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 3.2, toneMapped: false,
  });

  const CUBE = 2.0;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const cols = LOTUS_BM[0].length;
  const rows = LOTUS_BM.length;

  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!LOTUS_BM[r][c]) continue;
        const isCore = r >= 3 && r <= 5 && c === 3;
        const mesh = new THREE.Mesh(geo, isCore ? coreMat : mat);
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

interface Props { onClick: () => void; position?: [number, number, number]; }

export default function SkyTemple({ onClick, position = [-687, 0, -490] }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lotusGroupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);

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
    const onDown = (e: PointerEvent) => { if (hits(e)) tap = { time: performance.now(), x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => { if (!tap) return; const el = performance.now() - tap.time; const dx = e.clientX - tap.x; const dy = e.clientY - tap.y; tap = null; if (el > 300 || dx*dx+dy*dy > 100) return; onClickRef.current(); };
    canvas.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    return () => { canvas.removeEventListener("pointerdown", onDown, true); window.removeEventListener("pointerup", onUp, true); };
  }, [gl, camera]);

  const { shellColor, windowOff } = useShellColors(FACE);
  const MIN_COLS = LOTUS_BM[0].length + 4;
  const mRows = LOTUS_BM.length + 2;
  const txCol = Math.floor((MIN_COLS - LOTUS_BM[0].length) / 2);
  const txRow = Math.floor((mRows - LOTUS_BM.length) / 2);

  const mFront = useMemo(() => createGlassTex(MIN_COLS, mRows, 45, LIT_COLORS, windowOff, FACE, ACCENT, LOTUS_BM, txCol, txRow), [windowOff, txCol, txRow]);
  const mSide = useMemo(() => createGlassTex(5, mRows, 86, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bFront = useMemo(() => createGlassTex(MIN_COLS, 11, 75, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bSide = useMemo(() => createGlassTex(6, 11, 90, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tFront = useMemo(() => createGlassTex(MIN_COLS, 7, 56, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tSide = useMemo(() => createGlassTex(5, 7, 67, LIT_COLORS, windowOff, FACE), [windowOff]);

  useEffect(() => () => { mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose(); },
    [mFront, mSide, bFront, bSide, tFront, tSide]);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;
  const topY = TOTAL_H;
  const antennaY = topY + 25;

  const voxelLotus = useMemo(() => createVoxelLotus(ACCENT), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (lotusGroupRef.current) {
      lotusGroupRef.current.rotation.y = t * 0.45;
      lotusGroupRef.current.position.y = antennaY + 38 + Math.sin(t * 1.5) * 1.5;
    }
    if (haloRef.current) {
      haloRef.current.rotation.z = t * 0.3;
      (haloRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(t * 1.8) * 0.5;
    }
  });

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      <mesh position={[0, TOTAL_H / 2, 0]} visible={false}>
        <cylinderGeometry args={[55, 55, TOTAL_H + 60, 8]} />
        <meshBasicMaterial />
      </mesh>

      <PlatformBase w={BW} d={BD} accent={ACCENT} shellColor={shellColor} />

      <BoxSection w={BW} h={BH} d={BD} y={B_Y} shellColor={shellColor} glassFront={bFront} glassSide={bSide} emColor={LIT_COLORS[0]} accent={ACCENT} />
      <AccentBand w={BW} d={BD} y={BH + 4} accent={ACCENT} />

      <BoxSection w={MW} h={MH} d={MD} y={M_Y} shellColor={shellColor} glassFront={mFront} glassSide={mSide} emColor={LIT_COLORS[0]} accent={ACCENT} />
      <AccentBand w={MW} d={MD} y={BH + MH + 4} accent={ACCENT} />

      <BoxSection w={TW} h={TH} d={TD} y={T_Y} shellColor={shellColor} glassFront={tFront} glassSide={tSide} emColor={LIT_COLORS[0]} accent={ACCENT} />

      {/* Pagoda eaves */}
      {[BH + 4, BH + MH + 4, topY].map((y, i) => {
        const w = [BW + 12, MW + 10, TW + 8][i];
        const d = [BD + 12, MD + 10, TD + 8][i];
        return (
          <mesh key={`eave-${i}`} position={[0, y + 2, 0]}>
            <boxGeometry args={[w, 2, d]} />
            <meshStandardMaterial color={shellColor} roughness={0.3} metalness={0.7} />
          </mesh>
        );
      })}

      {/* Antenna */}
      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Voxel Lotus Mascot */}
      <group ref={lotusGroupRef} position={[0, antennaY + 38, 0]} scale={1.8}>
        <primitive object={voxelLotus} />
        <pointLight color={ACCENT} intensity={60} distance={130} decay={2} />
      </group>

      {/* Glowing halo ring */}
      <mesh ref={haloRef} position={[0, antennaY + 55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[20, 1, 8, 24]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>

      <pointLight position={[0, M_Y, MD / 2 + 18]} color={ACCENT} intensity={30} distance={80} decay={2} />
      <pointLight position={[0, M_Y, -MD / 2 - 18]} color={ACCENT} intensity={30} distance={80} decay={2} />
    </group>
  );
}
