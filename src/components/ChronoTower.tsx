"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGlassTex, BoxSection, AccentBand, PlatformBase, useShellColors,
} from "./LandmarkUtils";

const ACCENT = "#eab308";
const FACE = "#1a1508";
const LIT_COLORS = ["#eab308", "#facc15", "#fde047", "#ca8a04", "#a16207"];

const BW = 80, BD = 80, BH = 200;
const MW = 65, MD = 65, MH = 180;
const TW = 50, TD = 50, TH = 130;
const TOTAL_H = BH + MH + TH + 12;

// Clock pixel art (7×7)
const CLOCK_BM: number[][] = [
  [0,1,1,1,1,1,0],
  [1,0,0,1,0,0,1],
  [1,0,0,1,0,0,1],
  [1,0,0,1,1,0,1],
  [1,0,0,0,0,0,1],
  [1,0,0,0,0,0,1],
  [0,1,1,1,1,1,0],
];

// Voxel Hourglass Mascot
function createVoxelHourglass(accent: string): THREE.Group {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: "#d97706", emissive: "#78350f", emissiveIntensity: 0.6, toneMapped: false,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#ffffff", emissive: accent, emissiveIntensity: 1.5, toneMapped: false,
    transparent: true, opacity: 0.4,
  });
  const sandMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 3.0, toneMapped: false,
  });

  const CUBE = 2.0;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const HG_BM: number[][] = [
    [1,1,1,1,1,1,1],
    [1,2,2,2,2,2,1],
    [0,1,2,2,2,1,0],
    [0,0,1,3,1,0,0],
    [0,0,0,3,0,0,0],
    [0,0,1,3,1,0,0],
    [0,1,3,3,3,1,0],
    [1,3,3,3,3,3,1],
    [1,1,1,1,1,1,1],
  ];
  const cols = HG_BM[0].length;
  const rows = HG_BM.length;

  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = HG_BM[r][c];
        if (val === 0) continue;
        const mat = val === 1 ? frameMat : val === 2 ? glassMat : sandMat;
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

export default function ChronoTower({ onClick, position = [-767, 0, 352] }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const pendulumRef = useRef<THREE.Group>(null);
  const hourHandRef = useRef<THREE.Mesh>(null);
  const minuteHandRef = useRef<THREE.Mesh>(null);
  const mascotGroupRef = useRef<THREE.Group>(null);

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
  const MIN_COLS = CLOCK_BM[0].length + 4;
  const mRows = CLOCK_BM.length + 4;
  const txCol = Math.floor((MIN_COLS - CLOCK_BM[0].length) / 2);
  const txRow = Math.floor((mRows - CLOCK_BM.length) / 2);

  const mFront = useMemo(() => createGlassTex(MIN_COLS, mRows, 39, LIT_COLORS, windowOff, FACE, ACCENT, CLOCK_BM, txCol, txRow), [windowOff, txCol, txRow]);
  const mSide = useMemo(() => createGlassTex(6, mRows, 79, LIT_COLORS, windowOff, FACE, ACCENT, CLOCK_BM, txCol, txRow), [windowOff, txCol, txRow]);
  const bFront = useMemo(() => createGlassTex(MIN_COLS, 14, 78, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bSide = useMemo(() => createGlassTex(6, 14, 94, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tFront = useMemo(() => createGlassTex(MIN_COLS, 9, 52, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tSide = useMemo(() => createGlassTex(5, 9, 63, LIT_COLORS, windowOff, FACE), [windowOff]);

  useEffect(() => () => { mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose(); },
    [mFront, mSide, bFront, bSide, tFront, tSide]);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;
  const topY = TOTAL_H;
  const antennaY = topY + 25;

  const voxelHourglass = useMemo(() => createVoxelHourglass(ACCENT), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (hourHandRef.current) hourHandRef.current.rotation.z = -(t * 0.05);
    if (minuteHandRef.current) minuteHandRef.current.rotation.z = -(t * 0.6);
    if (pendulumRef.current) pendulumRef.current.rotation.z = Math.sin(t * 1.5) * 0.25;
    
    if (mascotGroupRef.current) {
      mascotGroupRef.current.rotation.y = t * 0.55;
      mascotGroupRef.current.position.y = antennaY + 38 + Math.sin(t * 1.5) * 1.5;
    }
  });

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      <mesh position={[0, TOTAL_H / 2, 0]} visible={false}>
        <cylinderGeometry args={[50, 50, TOTAL_H + 80, 8]} />
        <meshBasicMaterial />
      </mesh>

      <PlatformBase w={BW} d={BD} accent={ACCENT} shellColor={shellColor} />

      <BoxSection w={BW} h={BH} d={BD} y={B_Y} shellColor={shellColor} glassFront={bFront} glassSide={bSide} emColor={LIT_COLORS[0]} accent={ACCENT} />
      <AccentBand w={BW} d={BD} y={BH + 4} accent={ACCENT} />

      <BoxSection w={MW} h={MH} d={MD} y={M_Y} shellColor={shellColor} glassFront={mFront} glassSide={mSide} emColor={LIT_COLORS[0]} accent={ACCENT} />
      <AccentBand w={MW} d={MD} y={BH + MH + 4} accent={ACCENT} />

      <BoxSection w={TW} h={TH} d={TD} y={T_Y} shellColor={shellColor} glassFront={tFront} glassSide={tSide} emColor={LIT_COLORS[0]} accent={ACCENT} />

      {/* Clock face with hands (on front + back of top tier) */}
      {[1, -1].map(side => (
        <group key={`clock-${side}`} position={[0, T_Y, side * (TD / 2 + 1)]}>
          <mesh rotation={[0, side === -1 ? Math.PI : 0, 0]}>
            <circleGeometry args={[22, 24]} />
            <meshStandardMaterial color="#0a0a0a" emissive={ACCENT} emissiveIntensity={0.3} toneMapped={false} />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 18, Math.sin(a) * 18, side * 0.5]}>
                <sphereGeometry args={[1, 4, 4]} />
                <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={2} toneMapped={false} />
              </mesh>
            );
          })}
          <group rotation={[0, side === -1 ? Math.PI : 0, 0]}>
            <mesh ref={side === 1 ? hourHandRef : undefined} position={[0, 0, 1]}>
              <boxGeometry args={[1.5, 12, 0.5]} />
              <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1} toneMapped={false} />
            </mesh>
          </group>
          <group rotation={[0, side === -1 ? Math.PI : 0, 0]}>
            <mesh ref={side === 1 ? minuteHandRef : undefined} position={[0, 0, 1.5]}>
              <boxGeometry args={[0.8, 18, 0.3]} />
              <meshStandardMaterial color="#fff" emissive={ACCENT} emissiveIntensity={0.8} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Spire */}
      <mesh position={[0, topY + 20, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Voxel Hourglass Mascot */}
      <group ref={mascotGroupRef} position={[0, antennaY + 38, 0]} scale={1.8}>
        <primitive object={voxelHourglass} />
        <pointLight color={ACCENT} intensity={60} distance={130} decay={2} />
      </group>

      {/* Pendulum inside base */}
      <group ref={pendulumRef} position={[0, B_Y, BD / 2 + 2]}>
        <mesh position={[0, -10, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 30, 4]} />
          <meshStandardMaterial color="#8B7355" roughness={0.3} metalness={0.9} />
        </mesh>
        <mesh position={[0, -26, 0]}>
          <sphereGeometry args={[5, 8, 8]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      </group>

      <pointLight position={[0, M_Y, MD / 2 + 18]} color={ACCENT} intensity={35} distance={85} decay={2} />
      <pointLight position={[0, M_Y, -MD / 2 - 18]} color={ACCENT} intensity={35} distance={85} decay={2} />
    </group>
  );
}
