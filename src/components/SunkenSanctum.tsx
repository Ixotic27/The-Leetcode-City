"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGlassTex, BoxSection, AccentBand, PlatformBase, useShellColors,
} from "./LandmarkUtils";

const ACCENT = "#3b82f6";
const FACE = "#0a0f28";
const LIT_COLORS = ["#3b82f6", "#60a5fa", "#93c5fd", "#2563eb", "#1d4ed8"];

const BW = 100, BD = 80, BH = 170;
const MW = 85, MD = 65, MH = 145;
const TW = 60, TD = 45, TH = 110;
const TOTAL_H = BH + MH + TH + 12;

// Wave symbol bitmap (7×7)
const WAVE_BM: number[][] = [
  [0,0,1,1,1,0,0],
  [0,1,0,0,0,1,0],
  [1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1],
  [0,0,1,0,0,1,0],
  [0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0],
];

// Voxel Trident Mascot
function createVoxelTrident(accent: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: "#60a5fa", emissive: "#2563eb", emissiveIntensity: 2.8, toneMapped: false,
    roughness: 0.1, metalness: 0.8,
  });
  const CUBE = 2.4;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const TRIDENT_BM: number[][] = [
    [1,0,1,0,1],
    [1,0,1,0,1],
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ];
  const cols = TRIDENT_BM[0].length;
  const rows = TRIDENT_BM.length;

  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!TRIDENT_BM[r][c]) continue;
        const mesh = new THREE.Mesh(geo, mat);
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

export default function SunkenSanctum({ onClick, position = [687, 0, 490] }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const waterRingRef = useRef<THREE.Mesh>(null);
  const tridentGroupRef = useRef<THREE.Group>(null);
  const bubbleRef = useRef<THREE.Points>(null);

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
  const MIN_COLS = WAVE_BM[0].length + 4;
  const mRows = WAVE_BM.length + 2;
  const txCol = Math.floor((MIN_COLS - WAVE_BM[0].length) / 2);
  const txRow = Math.floor((mRows - WAVE_BM.length) / 2);

  const mFront = useMemo(() => createGlassTex(MIN_COLS, mRows, 82, LIT_COLORS, windowOff, FACE, ACCENT, WAVE_BM, txCol, txRow), [windowOff, txCol, txRow]);
  const mSide = useMemo(() => createGlassTex(5, mRows, 95, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bFront = useMemo(() => createGlassTex(MIN_COLS, 12, 45, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bSide = useMemo(() => createGlassTex(6, 12, 60, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tFront = useMemo(() => createGlassTex(MIN_COLS, 8, 38, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tSide = useMemo(() => createGlassTex(4, 8, 49, LIT_COLORS, windowOff, FACE), [windowOff]);

  useEffect(() => () => { mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose(); },
    [mFront, mSide, bFront, bSide, tFront, tSide]);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;
  const topY = TOTAL_H;
  const antennaY = topY + 25;

  const bubbleGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 40;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * (BW + 20);
      pos[i * 3 + 1] = Math.random() * TOTAL_H;
      pos[i * 3 + 2] = (Math.random() - 0.5) * (BD + 20);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  const voxelTrident = useMemo(() => createVoxelTrident(ACCENT), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (waterRingRef.current) {
      waterRingRef.current.rotation.z = t * 0.5;
      (waterRingRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(t * 1.5) * 0.4;
    }
    if (tridentGroupRef.current) {
      tridentGroupRef.current.position.y = antennaY + 38 + Math.sin(t * 1.5) * 2;
      tridentGroupRef.current.rotation.y = t * 0.45;
    }
    if (bubbleRef.current) {
      const pos = bubbleRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + 0.3);
        if (pos.getY(i) > TOTAL_H + 20) pos.setY(i, -10);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      <mesh position={[0, TOTAL_H / 2, 0]} visible={false}>
        <cylinderGeometry args={[55, 55, TOTAL_H + 50, 8]} />
        <meshBasicMaterial />
      </mesh>

      <PlatformBase w={BW} d={BD} accent={ACCENT} shellColor={shellColor} />

      <BoxSection w={BW} h={BH} d={BD} y={B_Y} shellColor={shellColor} glassFront={bFront} glassSide={bSide} emColor={LIT_COLORS[0]} accent={ACCENT} />
      <AccentBand w={BW} d={BD} y={BH + 4} accent={ACCENT} />

      <BoxSection w={MW} h={MH} d={MD} y={M_Y} shellColor={shellColor} glassFront={mFront} glassSide={mSide} emColor={LIT_COLORS[0]} accent={ACCENT} />
      <AccentBand w={MW} d={MD} y={BH + MH + 4} accent={ACCENT} />

      <BoxSection w={TW} h={TH} d={TD} y={T_Y} shellColor={shellColor} glassFront={tFront} glassSide={tSide} emColor={LIT_COLORS[0]} accent={ACCENT} />

      {/* Water ring around base */}
      <mesh ref={waterRingRef} position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[(BW + 20) / 2 + 8, 3, 8, 32]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.2} toneMapped={false} transparent opacity={0.4} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Voxel Trident Mascot */}
      <group ref={tridentGroupRef} position={[0, antennaY + 38, 0]} scale={1.8}>
        <primitive object={voxelTrident} />
        <pointLight color={ACCENT} intensity={60} distance={130} decay={2} />
      </group>

      {/* Bubble particles */}
      <points ref={bubbleRef} geometry={bubbleGeo}>
        <pointsMaterial color={ACCENT} size={2} transparent opacity={0.6} sizeAttenuation />
      </points>

      <pointLight position={[0, M_Y, MD / 2 + 18]} color={ACCENT} intensity={30} distance={80} decay={2} />
      <pointLight position={[0, M_Y, -MD / 2 - 18]} color={ACCENT} intensity={30} distance={80} decay={2} />
    </group>
  );
}
