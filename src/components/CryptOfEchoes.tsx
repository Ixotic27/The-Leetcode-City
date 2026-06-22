"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGlassTex, BoxSection, AccentBand, PlatformBase, useShellColors,
} from "./LandmarkUtils";

const ACCENT = "#22c55e";
const FACE = "#0a1a0a";
const LIT_COLORS = ["#22c55e", "#16a34a", "#4ade80", "#86efac", "#15803d"];

const BW = 95, BD = 70, BH = 160;
const MW = 80, MD = 58, MH = 150;
const TW = 60, TD = 45, TH = 110;
const TOTAL_H = BH + MH + TH + 12;

// Echo waves bitmap (7×7)
const ECHO_BM: number[][] = [
  [1,0,0,0,0,0,1],
  [0,1,0,0,0,1,0],
  [0,0,1,0,1,0,0],
  [0,0,0,1,0,0,0],
  [0,0,1,0,1,0,0],
  [0,1,0,0,0,1,0],
  [1,0,0,0,0,0,1],
];

// Voxel Key Mascot
function createVoxelKey(accent: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 2.8, toneMapped: false,
    roughness: 0.1, metalness: 0.8,
  });
  const CUBE = 2.4;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const KEY_BM: number[][] = [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
    [0,0,1,0,0],
    [0,1,1,0,0],
    [0,0,1,0,0],
    [0,1,1,0,0],
  ];
  const cols = KEY_BM[0].length;
  const rows = KEY_BM.length;

  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!KEY_BM[r][c]) continue;
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

export default function CryptOfEchoes({ onClick, position = [235, 0, -735] }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lanternRef1 = useRef<THREE.PointLight>(null);
  const lanternRef2 = useRef<THREE.PointLight>(null);
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
  const MIN_COLS = ECHO_BM[0].length + 4;
  const mRows = ECHO_BM.length + 2;
  const txCol = Math.floor((MIN_COLS - ECHO_BM[0].length) / 2);
  const txRow = Math.floor((mRows - ECHO_BM.length) / 2);

  const mFront = useMemo(() => createGlassTex(MIN_COLS, mRows, 52, LIT_COLORS, windowOff, FACE, ACCENT, ECHO_BM, txCol, txRow), [windowOff, txCol, txRow]);
  const mSide = useMemo(() => createGlassTex(5, mRows, 79, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bFront = useMemo(() => createGlassTex(MIN_COLS, 12, 63, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bSide = useMemo(() => createGlassTex(6, 12, 85, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tFront = useMemo(() => createGlassTex(MIN_COLS, 8, 41, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tSide = useMemo(() => createGlassTex(4, 8, 52, LIT_COLORS, windowOff, FACE), [windowOff]);

  useEffect(() => () => { mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose(); },
    [mFront, mSide, bFront, bSide, tFront, tSide]);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;
  const topY = TOTAL_H;
  const antennaY = topY + 25;

  const voxelKey = useMemo(() => createVoxelKey(ACCENT), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    if (mascotGroupRef.current) {
      mascotGroupRef.current.rotation.y = t * 0.45;
      mascotGroupRef.current.position.y = Math.sin(t * 1.5) * 1.5;
    }

    const flick = 25 + Math.sin(t * 5) * 10;
    if (lanternRef1.current) lanternRef1.current.intensity = flick;
    if (lanternRef2.current) lanternRef2.current.intensity = flick;
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

      {/* Gothic spire on top */}
      <mesh position={[0, topY + 25, 0]}>
        <coneGeometry args={[18, 50, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Voxel Key Mascot */}
      <group position={[0, antennaY + 38, 0]} scale={1.8}>
        <group ref={mascotGroupRef}>
          <primitive object={voxelKey} />
        </group>
        <pointLight color={ACCENT} intensity={60} distance={130} decay={2} />
      </group>

      {/* Side lanterns */}
      {[-1, 1].map(side => (
        <group key={`lantern-${side}`}>
          <mesh position={[side * (BW / 2 + 5), 60, BD / 2 + 5]}>
            <boxGeometry args={[4, 8, 4]} />
            <meshStandardMaterial color="#333" roughness={0.4} metalness={0.8} />
          </mesh>
          <pointLight ref={side === -1 ? lanternRef1 : lanternRef2} position={[side * (BW / 2 + 5), 66, BD / 2 + 5]} color={ACCENT} intensity={25} distance={50} decay={2} />
        </group>
      ))}

      <pointLight position={[0, M_Y, MD / 2 + 18]} color={ACCENT} intensity={30} distance={80} decay={2} />
      <pointLight position={[0, M_Y, -MD / 2 - 18]} color={ACCENT} intensity={30} distance={80} decay={2} />
    </group>
  );
}
