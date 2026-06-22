"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGlassTex, BoxSection, AccentBand, PlatformBase, useShellColors,
} from "./LandmarkUtils";

const ACCENT = "#06b6d4";
const FACE = "#0a1a28";
const LIT_COLORS = ["#06b6d4", "#22d3ee", "#67e8f9", "#a5f3fc", "#0891b2"];

const BW = 90, BD = 90, BH = 140;
const MW = 70, MD = 70, MH = 130;
const TW = 50, TD = 50, TH = 100;
const TOTAL_H = BH + MH + TH + 12;

// Constellation logo bitmap (7×7)
const STAR_BM: number[][] = [
  [0,0,0,1,0,0,0],
  [0,1,0,1,0,1,0],
  [0,0,1,1,1,0,0],
  [1,1,1,0,1,1,1],
  [0,0,1,1,1,0,0],
  [0,1,0,1,0,1,0],
  [0,0,0,1,0,0,0],
];

// Voxel Planet with Saturn-like Rings
function createVoxelPlanet(accent: string): THREE.Group {
  const group = new THREE.Group();
  
  const planetMat = new THREE.MeshStandardMaterial({
    color: "#0891b2", emissive: "#0891b2", emissiveIntensity: 2.8, toneMapped: false,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 2.8, toneMapped: false,
  });

  const CUBE = 2.4;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  
  const planetBM: number[][] = [
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
  ];

  const cols = planetBM[0].length;
  const rows = planetBM.length;

  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!planetBM[r][c]) continue;
        const mesh = new THREE.Mesh(geo, planetMat);
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

  const ringGroup = new THREE.Group();
  ringGroup.name = "ring";
  for (let r = 0; r < 16; r++) {
    const angle = (r / 16) * Math.PI * 2;
    const radius = 13.0;
    const mesh = new THREE.Mesh(geo, ringMat);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    ringGroup.add(mesh);
  }
  group.add(ringGroup);

  return group;
}

interface Props { onClick: () => void; position?: [number, number, number]; }

export default function AstralObservatory({ onClick, position = [-235, 0, 735] }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const domeRef = useRef<THREE.Mesh>(null);
  const mascotGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);

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
  const MIN_COLS = STAR_BM[0].length + 4;
  const mRows = STAR_BM.length + 2;
  const txCol = Math.floor((MIN_COLS - STAR_BM[0].length) / 2);
  const txRow = Math.floor((mRows - STAR_BM.length) / 2);

  const mFront = useMemo(() => createGlassTex(MIN_COLS, mRows, 61, LIT_COLORS, windowOff, FACE, ACCENT, STAR_BM, txCol, txRow), [windowOff, txCol, txRow]);
  const mSide = useMemo(() => createGlassTex(5, mRows, 88, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bFront = useMemo(() => createGlassTex(MIN_COLS, 12, 77, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bSide = useMemo(() => createGlassTex(6, 12, 90, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tFront = useMemo(() => createGlassTex(MIN_COLS, 8, 59, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tSide = useMemo(() => createGlassTex(4, 8, 70, LIT_COLORS, windowOff, FACE), [windowOff]);

  useEffect(() => () => { mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose(); },
    [mFront, mSide, bFront, bSide, tFront, tSide]);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;
  const topY = TOTAL_H;
  const antennaY = topY + 25;

  const voxelPlanet = useMemo(() => createVoxelPlanet(ACCENT), []);

  useEffect(() => {
    if (voxelPlanet) {
      ringRef.current = voxelPlanet.getObjectByName("ring") as THREE.Group;
    }
  }, [voxelPlanet]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (domeRef.current) domeRef.current.rotation.y = t * 0.15;
    
    if (mascotGroupRef.current) {
      mascotGroupRef.current.rotation.y = t * 0.45;
      mascotGroupRef.current.position.y = Math.sin(t * 1.5) * 1.5;
    }

    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.6;
      ringRef.current.rotation.y = t * 0.2;
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

      {/* Observatory dome */}
      <mesh ref={domeRef} position={[0, topY + 18, 0]}>
        <sphereGeometry args={[28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0a2030" emissive={ACCENT} emissiveIntensity={1.5} toneMapped={false} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Orbiting Voxel Planet Mascot */}
      <group position={[0, antennaY + 38, 0]} scale={1.6}>
        <group ref={mascotGroupRef}>
          <primitive object={voxelPlanet} />
        </group>
        <pointLight color={ACCENT} intensity={60} distance={130} decay={2} />
      </group>

      <pointLight position={[0, M_Y, MD / 2 + 18]} color={ACCENT} intensity={35} distance={80} decay={2} />
      <pointLight position={[0, M_Y, -MD / 2 - 18]} color={ACCENT} intensity={35} distance={80} decay={2} />
      <pointLight position={[0, 10, BD / 2 + 10]} color={ACCENT} intensity={15} distance={45} decay={2} />
    </group>
  );
}
