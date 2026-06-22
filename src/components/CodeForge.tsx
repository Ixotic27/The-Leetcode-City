"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  createGlassTex, BoxSection, AccentBand, PlatformBase, useShellColors,
} from "./LandmarkUtils";

const ACCENT = "#f97316";
const FACE = "#1a1208";
const LIT_COLORS = ["#f97316", "#fb923c", "#fdba74", "#ea580c", "#c2410c"];

const BW = 105, BD = 75, BH = 180;
const MW = 88, MD = 62, MH = 155;
const TW = 62, TD = 46, TH = 110;
const TOTAL_H = BH + MH + TH + 12;

// Anvil pixel art (9×7)
const ANVIL_BM: number[][] = [
  [0,0,0,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1],
  [0,0,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,0,0],
];

// Voxel Hammer Mascot
function createVoxelHammer(accent: string): THREE.Group {
  const group = new THREE.Group();
  const handleMat = new THREE.MeshStandardMaterial({
    color: "#d97706", emissive: "#78350f", emissiveIntensity: 0.8, toneMapped: false,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: "#4b5563", emissive: accent, emissiveIntensity: 2.2, toneMapped: false,
    roughness: 0.1, metalness: 0.8,
  });

  const CUBE = 2.0;
  const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const HAMMER_BM: number[][] = [
    [1,1,1,1,1],
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ];
  const cols = HAMMER_BM[0].length;
  const rows = HAMMER_BM.length;

  for (let rot = 0; rot < 2; rot++) {
    const plane = new THREE.Group();
    plane.rotation.y = (rot * Math.PI) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!HAMMER_BM[r][c]) continue;
        const isHead = r < 2;
        const mesh = new THREE.Mesh(geo, isHead ? ironMat : handleMat);
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

export default function CodeForge({ onClick, position = [-85, 0, 840] }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const gearRef1 = useRef<THREE.Mesh>(null);
  const gearRef2 = useRef<THREE.Mesh>(null);
  const hammerGroupRef = useRef<THREE.Group>(null);
  const smokeRef = useRef<THREE.Points>(null);

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
  const MIN_COLS = ANVIL_BM[0].length + 2;
  const mRows = ANVIL_BM.length + 4;
  const txCol = Math.floor((MIN_COLS - ANVIL_BM[0].length) / 2);
  const txRow = Math.floor((mRows - ANVIL_BM.length) / 2);

  const mFront = useMemo(() => createGlassTex(MIN_COLS, mRows, 43, LIT_COLORS, windowOff, FACE, ACCENT, ANVIL_BM, txCol, txRow), [windowOff, txCol, txRow]);
  const mSide = useMemo(() => createGlassTex(5, mRows, 81, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bFront = useMemo(() => createGlassTex(MIN_COLS, 13, 77, LIT_COLORS, windowOff, FACE), [windowOff]);
  const bSide = useMemo(() => createGlassTex(6, 13, 93, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tFront = useMemo(() => createGlassTex(MIN_COLS, 8, 51, LIT_COLORS, windowOff, FACE), [windowOff]);
  const tSide = useMemo(() => createGlassTex(4, 8, 62, LIT_COLORS, windowOff, FACE), [windowOff]);

  useEffect(() => () => { mFront.dispose(); mSide.dispose(); bFront.dispose(); bSide.dispose(); tFront.dispose(); tSide.dispose(); },
    [mFront, mSide, bFront, bSide, tFront, tSide]);

  // Smoke particles
  const smokeGeo = useMemo(() => {
    const count = 30;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = TOTAL_H + Math.random() * 80;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 8 + TH / 2;
  const topY = TOTAL_H;
  const antennaY = topY + 25;

  const voxelHammer = useMemo(() => createVoxelHammer(ACCENT), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (gearRef1.current) gearRef1.current.rotation.z = t * 0.3;
    if (gearRef2.current) gearRef2.current.rotation.z = -t * 0.2;
    
    if (hammerGroupRef.current) {
      hammerGroupRef.current.rotation.y = t * 0.45;
      hammerGroupRef.current.position.y = antennaY + 38 + Math.sin(t * 1.5) * 1.5;
    }

    if (smokeRef.current) {
      const pos = smokeRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + 0.4);
        pos.setX(i, pos.getX(i) + Math.sin(t + i) * 0.1);
        if (pos.getY(i) > TOTAL_H + 100) {
          pos.setY(i, TOTAL_H);
          pos.setX(i, (Math.random() - 0.5) * 20);
        }
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      <mesh position={[0, TOTAL_H / 2, 0]} visible={false}>
        <cylinderGeometry args={[60, 60, TOTAL_H + 60, 8]} />
        <meshBasicMaterial />
      </mesh>

      <PlatformBase w={BW} d={BD} accent={ACCENT} shellColor={shellColor} />

      <BoxSection w={BW} h={BH} d={BD} y={B_Y} shellColor={shellColor} glassFront={bFront} glassSide={bSide} emColor={LIT_COLORS[0]} accent={ACCENT} />
      <AccentBand w={BW} d={BD} y={BH + 4} accent={ACCENT} />

      <BoxSection w={MW} h={MH} d={MD} y={M_Y} shellColor={shellColor} glassFront={mFront} glassSide={mSide} emColor={LIT_COLORS[0]} accent={ACCENT} />
      <AccentBand w={MW} d={MD} y={BH + MH + 4} accent={ACCENT} />

      <BoxSection w={TW} h={TH} d={TD} y={T_Y} shellColor={shellColor} glassFront={tFront} glassSide={tSide} emColor={LIT_COLORS[0]} accent={ACCENT} />

      <mesh position={[0, topY, 0]}>
        <boxGeometry args={[TW + 4, 1.2, TD + 4]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1} toneMapped={false} />
      </mesh>

      {/* Chimney stacks */}
      {[-1, 1].map(side => (
        <mesh key={`chimney-${side}`} position={[side * 18, topY + 20, 0]}>
          <cylinderGeometry args={[4, 6, 40, 6]} />
          <meshStandardMaterial color="#2a1a08" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}

      {/* Large gears on facade */}
      <mesh ref={gearRef1} position={[BW / 2 + 1, M_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[18, 3, 6, 8]} />
        <meshStandardMaterial color="#8B7355" emissive={ACCENT} emissiveIntensity={0.3} roughness={0.3} metalness={0.9} toneMapped={false} />
      </mesh>
      <mesh ref={gearRef2} position={[-BW / 2 - 1, M_Y - 20, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[14, 2.5, 6, 8]} />
        <meshStandardMaterial color="#8B7355" emissive={ACCENT} emissiveIntensity={0.3} roughness={0.3} metalness={0.9} toneMapped={false} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Voxel Hammer Mascot */}
      <group ref={hammerGroupRef} position={[0, antennaY + 38, 0]} scale={1.8}>
        <primitive object={voxelHammer} />
        <pointLight color={ACCENT} intensity={60} distance={130} decay={2} />
      </group>

      {/* Smoke particles */}
      <points ref={smokeRef} geometry={smokeGeo}>
        <pointsMaterial color="#888" size={4} transparent opacity={0.3} sizeAttenuation />
      </points>

      <pointLight position={[0, M_Y, MD / 2 + 18]} color={ACCENT} intensity={35} distance={85} decay={2} />
      <pointLight position={[0, M_Y, -MD / 2 - 18]} color={ACCENT} intensity={35} distance={85} decay={2} />
      <pointLight position={[0, 10, BD / 2 + 10]} color={ACCENT} intensity={20} distance={50} decay={2} />
    </group>
  );
}
