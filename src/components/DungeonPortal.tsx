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
const ACCENT = "#ef4444";
const FACE = "#2a0a0a";
const LIT_COLORS = ["#ef4444", "#dc2626", "#ff6b6b", "#fca5a5", "#f87171"];

// Twin tower fortress dimensions
const TW_W = 50, TW_D = 50, TW_H_BASE = 200, TW_H_UPPER = 160;
const TOWER_OFFSET = 55;
const GATE_W = 90, GATE_H = 120;
const TOTAL_H = TW_H_BASE + TW_H_UPPER + 8; // ~368

// Skull pixel art (7×7)
const SKULL_BM: number[][] = [
  [0,1,1,1,1,1,0],
  [1,1,1,1,1,1,1],
  [1,0,1,1,1,0,1],
  [1,1,1,1,1,1,1],
  [0,1,0,1,0,1,0],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
];

function createVoxelSkull(accent: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: "#ffffff", emissive: "#332222", emissiveIntensity: 0.5, toneMapped: false,
    roughness: 0.1, metalness: 0.8,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 3.5, toneMapped: false,
  });

  const CUBE = 2.0;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const cols = SKULL_BM[0].length;
  const rows = SKULL_BM.length;

  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!SKULL_BM[r][c]) continue;
        const isEye = r === 2 && (c === 1 || c === 5);
        const mesh = new THREE.Mesh(geo, isEye ? eyeMat : mat);
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

interface DungeonPortalProps {
  onClick: () => void;
  position?: [number, number, number];
}

export default function DungeonPortal({
  onClick,
  position = [-735, 0, -235], // Ring 1, plaza 2 (opposite to VoidObelisk)
}: DungeonPortalProps) {
  const groupRef = useRef<THREE.Group>(null);
  const chainRef1 = useRef<THREE.Group>(null);
  const chainRef2 = useRef<THREE.Group>(null);
  const portalGlowRef = useRef<THREE.Mesh>(null);
  const fireRef1 = useRef<THREE.PointLight>(null);
  const fireRef2 = useRef<THREE.PointLight>(null);
  const leftSkullRef = useRef<THREE.Group>(null);
  const rightSkullRef = useRef<THREE.Group>(null);

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

  const MIN_COLS = SKULL_BM[0].length + 4;
  const mRows = SKULL_BM.length + 2;
  const txCol = Math.floor((MIN_COLS - SKULL_BM[0].length) / 2);
  const txRow = Math.floor((mRows - SKULL_BM.length) / 2);

  const tFrontL = useMemo(() =>
    createGlassTex(MIN_COLS, mRows, 33, LIT_COLORS, windowOff, FACE, ACCENT, SKULL_BM, txCol, txRow),
    [windowOff, txCol, txRow]
  );
  const tFrontR = useMemo(() =>
    createGlassTex(MIN_COLS, mRows, 99, LIT_COLORS, windowOff, FACE, ACCENT, SKULL_BM, txCol, txRow),
    [windowOff, txCol, txRow]
  );
  const tSide = useMemo(() =>
    createGlassTex(5, mRows, 55, LIT_COLORS, windowOff, FACE),
    [windowOff]
  );
  const bFront = useMemo(() =>
    createGlassTex(MIN_COLS, 14, 71, LIT_COLORS, windowOff, FACE),
    [windowOff]
  );
  const bSide = useMemo(() =>
    createGlassTex(5, 14, 83, LIT_COLORS, windowOff, FACE),
    [windowOff]
  );

  useEffect(() => () => {
    tFrontL.dispose(); tFrontR.dispose(); tSide.dispose();
    bFront.dispose(); bSide.dispose();
  }, [tFrontL, tFrontR, tSide, bFront, bSide]);

  const B_Y = TW_H_BASE / 2 + 4;
  const U_Y = TW_H_BASE + 4 + TW_H_UPPER / 2;

  const leftSkull = useMemo(() => createVoxelSkull(ACCENT), []);
  const rightSkull = useMemo(() => createVoxelSkull(ACCENT), []);

  // Animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (chainRef1.current) chainRef1.current.rotation.z = Math.sin(t * 1.2) * 0.08;
    if (chainRef2.current) chainRef2.current.rotation.z = Math.sin(t * 1.2 + 1) * 0.08;
    
    if (portalGlowRef.current) {
      (portalGlowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2 + Math.sin(t * 2) * 1;
      portalGlowRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.08);
    }

    if (leftSkullRef.current) {
      leftSkullRef.current.rotation.y = t * 0.5;
      leftSkullRef.current.position.y = topY + 22 + Math.sin(t * 2) * 1.5;
    }
    if (rightSkullRef.current) {
      rightSkullRef.current.rotation.y = -(t * 0.5);
      rightSkullRef.current.position.y = topY + 22 + Math.sin(t * 2 + 1) * 1.5;
    }

    const flicker = 50 + Math.sin(t * 4.5) * 20 + Math.sin(t * 8) * 10;
    if (fireRef1.current) fireRef1.current.intensity = flicker;
    if (fireRef2.current) fireRef2.current.intensity = flicker;
  });

  const topY = TOTAL_H;

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      {/* Invisible hitbox */}
      <mesh position={[0, TOTAL_H / 2, 0]} visible={false}>
        <boxGeometry args={[TOWER_OFFSET * 2 + TW_W, TOTAL_H, TW_D + 20]} />
        <meshBasicMaterial />
      </mesh>

      {/* Shared platform */}
      <PlatformBase w={TOWER_OFFSET * 2 + TW_W} d={TW_D + 30} accent={ACCENT} shellColor={shellColor} />

      {/* Left Tower */}
      <group position={[-TOWER_OFFSET, 0, 0]}>
        <BoxSection w={TW_W} h={TW_H_BASE} d={TW_D} y={B_Y}
          shellColor={shellColor} glassFront={bFront} glassSide={bSide}
          emColor={LIT_COLORS[0]} accent={ACCENT}
        />
        <AccentBand w={TW_W} d={TW_D} y={TW_H_BASE + 4} accent={ACCENT} />
        <BoxSection w={TW_W - 10} h={TW_H_UPPER} d={TW_D - 10} y={U_Y}
          shellColor={shellColor} glassFront={tFrontL} glassSide={tSide}
          emColor={LIT_COLORS[0]} accent={ACCENT}
        />
        {/* Battlements */}
        {[-1, 0, 1].map(i => (
          <mesh key={`l-bat-${i}`} position={[i * 14, topY + 8, 0]}>
            <boxGeometry args={[8, 16, TW_D - 10]} />
            <meshStandardMaterial color={shellColor} roughness={0.3} metalness={0.7} />
          </mesh>
        ))}
        {/* Voxel Skull mascot */}
        <group ref={leftSkullRef} position={[0, topY + 22, 0]} scale={1.2}>
          <primitive object={leftSkull} />
        </group>
        <pointLight ref={fireRef1} position={[0, topY + 22, 0]} color={ACCENT} intensity={50} distance={100} decay={2} />
      </group>

      {/* Right Tower */}
      <group position={[TOWER_OFFSET, 0, 0]}>
        <BoxSection w={TW_W} h={TW_H_BASE} d={TW_D} y={B_Y}
          shellColor={shellColor} glassFront={bFront} glassSide={bSide}
          emColor={LIT_COLORS[0]} accent={ACCENT}
        />
        <AccentBand w={TW_W} d={TW_D} y={TW_H_BASE + 4} accent={ACCENT} />
        <BoxSection w={TW_W - 10} h={TW_H_UPPER} d={TW_D - 10} y={U_Y}
          shellColor={shellColor} glassFront={tFrontR} glassSide={tSide}
          emColor={LIT_COLORS[0]} accent={ACCENT}
        />
        {/* Battlements */}
        {[-1, 0, 1].map(i => (
          <mesh key={`r-bat-${i}`} position={[i * 14, topY + 8, 0]}>
            <boxGeometry args={[8, 16, TW_D - 10]} />
            <meshStandardMaterial color={shellColor} roughness={0.3} metalness={0.7} />
          </mesh>
        ))}
        {/* Voxel Skull mascot */}
        <group ref={rightSkullRef} position={[0, topY + 22, 0]} scale={1.2}>
          <primitive object={rightSkull} />
        </group>
        <pointLight ref={fireRef2} position={[0, topY + 22, 0]} color={ACCENT} intensity={50} distance={100} decay={2} />
      </group>

      {/* Connecting bridge/gate between towers */}
      <mesh position={[0, GATE_H + 4, TW_D / 2 + 0.3]}>
        <boxGeometry args={[TOWER_OFFSET * 2 - TW_W + 10, 20, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, GATE_H + 14, TW_D / 2 + 0.3]}>
        <boxGeometry args={[TOWER_OFFSET * 2 - TW_W + 10, 2, 6]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>

      {/* Hanging chains */}
      {[-1, 1].map(side => (
        <group key={`chain-${side}`} ref={side === -1 ? chainRef1 : chainRef2}
          position={[side * 20, GATE_H + 4, TW_D / 2 + 2]}>
          {[0, 1, 2, 3, 4].map(i => (
            <mesh key={i} position={[0, -i * 6 - 3, 0]}>
              <torusGeometry args={[1.5, 0.4, 6, 8]} />
              <meshStandardMaterial color="#555" roughness={0.3} metalness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Portal glow (between towers at ground level) */}
      <mesh ref={portalGlowRef} position={[0, 40, TW_D / 2 + 2]}>
        <planeGeometry args={[TOWER_OFFSET * 2 - TW_W - 10, 70]} />
        <meshStandardMaterial color="#200000" emissive={ACCENT} emissiveIntensity={2} toneMapped={false} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 40, TW_D / 2 + 8]} color={ACCENT} intensity={30} distance={80} decay={2} />
    </group>
  );
}
