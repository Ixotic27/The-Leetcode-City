"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The Manyata VC Fund Building
 *
 * A lime-green landmark tower that represents the VC fund (Bank).
 * Clad in lime edge pillars and cornice, with a glowing symbol on its facade.
 */

const LIME = "#ffa116";
const LIME_HOT = "#ffb84d";
const DEEP = "#1c1c20";
const WHITE = "#e8dcc8";

const BANK_POSITION: [number, number, number] = [-519, 0, 0];
const BANK_SCALE = 0.6;

const W = 360;
const H = 560;
const D = 360;
const BASE_H = 30;
const BODY_Y = BASE_H + H / 2;
const CORNICE_Y = BASE_H + H + 16;
const MARK_Y = BASE_H + H * 0.55;

/** Rounded-square outline */
function roundedSquare(size: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const h = size / 2;
  const x = -h;
  const y = -h;
  s.moveTo(x + r, y);
  s.lineTo(x + size - r, y);
  s.quadraticCurveTo(x + size, y, x + size, y + r);
  s.lineTo(x + size, y + size - r);
  s.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  s.lineTo(x + r, y + size);
  s.quadraticCurveTo(x, y + size, x, y + size - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

interface BankBuildingProps {
  onClick?: () => void;
  themeAccent?: string;
  themeWindowLit?: string[];
  themeFace?: string;
  position?: [number, number, number];
}

type BankWindowFlags = Window & {
  __bankClicked?: boolean;
  __bankCursor?: boolean;
  __arcadeClicked?: boolean;
  __spireClicked?: boolean;
};

export default function BankBuilding({
  onClick,
  themeAccent = LIME,
  themeWindowLit,
  themeFace = DEEP,
  position = BANK_POSITION,
}: BankBuildingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { gl, camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  const onClickRef = useRef(onClick);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  const markGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedSquare(200, 32), {
      depth: 16,
      bevelEnabled: true,
      bevelThickness: 3,
      bevelSize: 3,
      bevelSegments: 2,
    });
    g.center();
    return g;
  }, []);

  const innerGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedSquare(124, 20), {
      depth: 8,
      bevelEnabled: false,
    });
    g.center();
    return g;
  }, []);

  const markMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: LIME,
        emissive: LIME,
        emissiveIntensity: 1.25,
        roughness: 0.25,
        metalness: 0.4,
        toneMapped: false,
      }),
    [],
  );

  const innerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: LIME_HOT,
        emissive: WHITE,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.4,
        toneMapped: false,
      }),
    [],
  );

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: LIME,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  const ledgerLines = useMemo(
    () => Array.from({ length: 7 }, (_, i) => BASE_H + (H / 8) * (i + 1)),
    [],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    const w = window as unknown as BankWindowFlags;

    const hitsBank = (e: PointerEvent): boolean => {
      const group = groupRef.current;
      if (!group) return false;
      const rect = canvas.getBoundingClientRect();
      ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);

      const bankHits = raycaster.current.intersectObject(group, true);
      if (bankHits.length === 0) return false;

      const bankDistance = bankHits[0].distance;
      const sceneHits = raycaster.current.intersectObjects(
        scene.children,
        true,
      );
      for (const hit of sceneHits) {
        if (hit.distance >= bankDistance) break;
        if ((hit.object as THREE.InstancedMesh).isInstancedMesh) return false;
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj === group) break;
          if (obj.userData?.isLandmark) return false;
          obj = obj.parent;
        }
      }
      return true;
    };

    let tap: { time: number; x: number; y: number } | null = null;

    const onDown = (e: PointerEvent) => {
      if (w.__arcadeClicked || w.__spireClicked) return;
      if (hitsBank(e)) {
        w.__bankClicked = true;
        tap = { time: performance.now(), x: e.clientX, y: e.clientY };
      }
    };

    const onUp = (e: PointerEvent) => {
      w.__bankClicked = false;
      if (!tap) return;
      const elapsed = performance.now() - tap.time;
      const dx = e.clientX - tap.x;
      const dy = e.clientY - tap.y;
      tap = null;
      if (elapsed > 400 || dx * dx + dy * dy > 625) return;
      onClickRef.current?.();
    };

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let lastMove = 0;
    const onMove = isTouch
      ? null
      : (e: PointerEvent) => {
          const now = performance.now();
          if (now - lastMove < 66) return;
          lastMove = now;
          if (hitsBank(e)) {
            document.body.style.cursor = "pointer";
            w.__bankCursor = true;
          } else if (w.__bankCursor) {
            w.__bankCursor = false;
          }
        };

    canvas.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    if (onMove) canvas.addEventListener("pointermove", onMove, true);

    return () => {
      canvas.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      if (onMove) canvas.removeEventListener("pointermove", onMove, true);
      w.__bankClicked = false;
      w.__bankCursor = false;
    };
  }, [gl, camera, scene]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    markMat.emissiveIntensity = 1.15 + Math.sin(t * 1.6) * 0.25;
    ringMat.opacity = 0.4 + Math.sin(t * 2) * 0.18;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      scale={BANK_SCALE}
      userData={{ isLandmark: true }}
    >
      {/* Invisible raycast hitbox covering the whole tower */}
      <mesh position={[0, BODY_Y, 0]}>
        <boxGeometry args={[D + 40, H + 80, W + 40]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Stepped base + glowing rim */}
      <mesh position={[0, BASE_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[D + 90, BASE_H, W + 90]} />
        <meshStandardMaterial
          color={DEEP}
          emissive={DEEP}
          emissiveIntensity={0.35}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[0, BASE_H + 1, 0]}>
        <boxGeometry args={[D + 100, 7, W + 100]} />
        <meshStandardMaterial
          color={LIME_HOT}
          emissive={LIME_HOT}
          emissiveIntensity={0.9}
          roughness={0.3}
          metalness={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Main tower body */}
      <mesh position={[0, BODY_Y, 0]} castShadow>
        <boxGeometry args={[D, H, W]} />
        <meshStandardMaterial
          color={DEEP}
          emissive={DEEP}
          emissiveIntensity={0.35}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {/* Faint ledger lines on the front face */}
      {ledgerLines.map((y, i) => (
        <mesh key={`l${i}`} position={[D / 2 + 1, y, 0]}>
          <boxGeometry args={[4, 3, W - 20]} />
          <meshStandardMaterial
            color={LIME_HOT}
            emissive={LIME_HOT}
            emissiveIntensity={0.7}
            roughness={0.3}
            metalness={0.5}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Glowing edge pillars on the four vertical corners */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`p${sx}${sz}`}
            position={[(sx * D) / 2, BODY_Y, (sz * W) / 2]}
          >
            <boxGeometry args={[14, H, 14]} />
            <meshStandardMaterial
              color={LIME}
              emissive={LIME}
              emissiveIntensity={1.25}
              roughness={0.25}
              metalness={0.4}
              toneMapped={false}
            />
          </mesh>
        )),
      )}

      {/* Cornice + dark roof slab */}
      <mesh position={[0, CORNICE_Y, 0]} castShadow>
        <boxGeometry args={[D + 34, 32, W + 34]} />
        <meshStandardMaterial
          color={LIME}
          emissive={LIME}
          emissiveIntensity={1.0}
          roughness={0.25}
          metalness={0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, CORNICE_Y + 22, 0]}>
        <boxGeometry args={[D - 6, 14, W - 6]} />
        <meshStandardMaterial
          color={DEEP}
          emissive={DEEP}
          emissiveIntensity={0.35}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {/* Base mark — front (+X) and back (−X) */}
      <mesh
        geometry={markGeo}
        material={markMat}
        position={[D / 2 + 8, MARK_Y, 0]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      />
      <mesh
        geometry={innerGeo}
        material={innerMat}
        position={[D / 2 + 24, MARK_Y, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <mesh
        geometry={markGeo}
        material={markMat}
        position={[-D / 2 - 8, MARK_Y, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
      />
      <mesh
        geometry={innerGeo}
        material={innerMat}
        position={[-D / 2 - 24, MARK_Y, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      />

      {/* Holographic plaza rings on the ground */}
      <mesh
        material={ringMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 2, 0]}
      >
        <ringGeometry args={[300, 330, 64]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, 0]}>
        <ringGeometry args={[360, 368, 64]} />
        <meshBasicMaterial
          color={LIME_HOT}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Beacon lighting */}
      <pointLight
        position={[360, MARK_Y, 0]}
        color={LIME}
        intensity={30}
        distance={700}
        decay={2}
      />
      <pointLight
        position={[60, CORNICE_Y + 80, 0]}
        color={LIME_HOT}
        intensity={22}
        distance={560}
        decay={2}
      />
      <pointLight
        position={[220, 120, 0]}
        color={LIME}
        intensity={20}
        distance={560}
        decay={2}
      />
    </group>
  );
}
