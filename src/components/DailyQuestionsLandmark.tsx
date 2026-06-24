"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ─── Constants ───────────────────────────────────────────────
const ACCENT_FALLBACK = "#ffa116";
// Daily Questions building — positioned at landmarkPositions[14] or a free slot
const DEFAULT_POS: [number, number, number] = [0, 0, 380];

// Building: wide low base + mid tower + slim top (arcade cabinet silhouette)
const SECTIONS = [
  { w: 110, d: 90,  h: 120, y: 60  }, // base — wide arcade cabinet base
  { w: 80,  d: 65,  h: 160, y: 260 }, // mid tower
  { w: 55,  d: 45,  h: 120, y: 450 }, // slim top
];
const TOTAL_H = 520;

// ─── "DQ" logo texture ───────────────────────────────────────
function createLogoTexture(color: string): THREE.CanvasTexture {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, s, s);

  // Draw "?" icon — question mark in arcade pixel style
  ctx.fillStyle = color;
  ctx.font = "bold 160px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", s / 2, s / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// ─── Sign texture: "DAILY QUESTIONS" ────────────────────────
function createSignTexture(accent: string): THREE.CanvasTexture {
  const cw = 320, ch = 48;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cw, ch);

  ctx.font = "bold 22px monospace";
  ctx.textBaseline = "middle";

  // "DAILY" in accent color, "QUESTIONS" in white
  ctx.fillStyle = accent;
  ctx.textAlign = "left";
  ctx.fillText("DAILY", 16, ch / 2);

  ctx.fillStyle = "#e8dcc8";
  ctx.fillText("QUESTIONS", 120, ch / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// ─── Ticker tape texture: scrolling "SOLVE · STREAK · REPEAT" ─
function createTickerTexture(accent: string): THREE.CanvasTexture {
  const cw = 512, ch = 32;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, cw, ch);

  ctx.font = "bold 18px monospace";
  ctx.fillStyle = accent;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const msg = "SOLVE  ·  STREAK  ·  REPEAT  ·  SOLVE  ·  STREAK  ·  REPEAT  ·  ";
  ctx.fillText(msg, 8, ch / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// ─── Glass facade texture ─────────────────────────────────────
function createGlassTex(
  cols: number, rows: number, seed: number,
  litColors: string[], offColor: string, faceColor: string,
): THREE.CanvasTexture {
  const cellW = 10, cellH = 12;
  const cw = cols * cellW, ch = rows * cellH;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, cw, ch);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hash = ((r * 11 + c * 17 + seed) * 2654435761) >>> 0;
      const x = c * cellW + 1;
      const y = r * cellH + 1;
      const ww = cellW - 2;
      const hh = cellH - 2;
      const lit = (hash % 100) < 40;
      if (lit) {
        ctx.fillStyle = litColors[hash % litColors.length];
        ctx.globalAlpha = 0.4 + (hash % 30) / 100;
      } else {
        ctx.fillStyle = offColor;
        ctx.globalAlpha = 0.8;
      }
      ctx.fillRect(x, y, ww, hh);
      ctx.globalAlpha = 1;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// ─── Component ───────────────────────────────────────────────

interface DailyQuestionsLandmarkProps {
  onClick: () => void;
  position?: [number, number, number];
  themeAccent?: string;
  themeWindowLit?: string[];
  themeFace?: string;
}

type DQWindowFlags = Window & {
  __dqClicked?: boolean;
  __dqCursor?: boolean;
};

export default function DailyQuestionsLandmark({
  onClick,
  position = DEFAULT_POS,
  themeAccent = ACCENT_FALLBACK,
  themeWindowLit = ["#a0c0f0", "#80a0e0", "#6080c8"],
  themeFace = "#101828",
}: DailyQuestionsLandmarkProps) {
  const groupRef = useRef<THREE.Group>(null);
  const signGlowRef = useRef<THREE.PointLight>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const tickerRef = useRef<THREE.Mesh>(null);
  const tickerMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const { gl, camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  const onClickRef = useRef(onClick);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  // ── Textures ──
  const logoTex   = useMemo(() => createLogoTexture(themeAccent), [themeAccent]);
  const signTex   = useMemo(() => createSignTexture(themeAccent), [themeAccent]);
  const tickerTex = useMemo(() => createTickerTexture(themeAccent), [themeAccent]);

  const windowOff = useMemo(() => {
    const c = new THREE.Color(themeFace);
    c.multiplyScalar(0.6);
    return "#" + c.getHexString();
  }, [themeFace]);

  const glassFront = useMemo(
    () => createGlassTex(10, 45, 99, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace],
  );
  const glassSide = useMemo(
    () => createGlassTex(8, 45, 55, themeWindowLit, windowOff, themeFace),
    [themeWindowLit, windowOff, themeFace],
  );

  const shellColor = useMemo(() => {
    const c = new THREE.Color(themeFace);
    c.multiplyScalar(1.8);
    return "#" + c.getHexString();
  }, [themeFace]);

  // Cleanup
  useEffect(() => {
    return () => {
      logoTex.dispose();
      signTex.dispose();
      tickerTex.dispose();
      glassFront.dispose();
      glassSide.dispose();
    };
  }, [logoTex, signTex, tickerTex, glassFront, glassSide]);

  // ── Click + cursor (same pattern as EArcadeLandmark) ──
  useEffect(() => {
    const canvas = gl.domElement;
    const w = window as DQWindowFlags;

    const hitsDQ = (e: PointerEvent): boolean => {
      const group = groupRef.current;
      if (!group) return false;
      const rect = canvas.getBoundingClientRect();
      ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);

      const dqHits = raycaster.current.intersectObject(group, true);
      if (dqHits.length === 0) return false;

      const dqDistance = dqHits[0].distance;
      const sceneHits = raycaster.current.intersectObjects(scene.children, true);
      for (const hit of sceneHits) {
        if (hit.distance >= dqDistance) break;
        if ((hit.object as THREE.Object3D & { isInstancedMesh?: boolean }).isInstancedMesh) return false;
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
      if (hitsDQ(e)) {
        w.__dqClicked = true;
        tap = { time: performance.now(), x: e.clientX, y: e.clientY };
      }
    };

    const onUp = (e: PointerEvent) => {
      w.__dqClicked = false;
      if (!tap) return;
      const elapsed = performance.now() - tap.time;
      const dx = e.clientX - tap.x;
      const dy = e.clientY - tap.y;
      tap = null;
      if (elapsed > 400 || dx * dx + dy * dy > 625) return;
      onClickRef.current();
    };

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let lastMove = 0;
    const onMove = isTouch
      ? null
      : (e: PointerEvent) => {
          const now = performance.now();
          if (now - lastMove < 66) return;
          lastMove = now;
          if (hitsDQ(e)) {
            document.body.style.cursor = "pointer";
            w.__dqCursor = true;
          } else if (w.__dqCursor) {
            w.__dqCursor = false;
          }
        };

    canvas.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    if (onMove) canvas.addEventListener("pointermove", onMove, true);

    return () => {
      canvas.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      if (onMove) canvas.removeEventListener("pointermove", onMove, true);
      w.__dqClicked = false;
      w.__dqCursor = false;
    };
  }, [gl, camera, scene]);

  // ── Animations ──
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Pulsing sign glow
    if (signGlowRef.current) {
      signGlowRef.current.intensity = 55 + Math.sin(t * 1.5) * 20;
    }

    // Beacon pulse
    if (beaconRef.current) {
      const s = 1 + Math.sin(t * 2.5) * 0.25;
      beaconRef.current.scale.setScalar(s);
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2.5 + Math.sin(t * 2.5) * 1;
    }

    // Ticker scroll — shift UV offset to simulate scrolling text
    if (tickerMatRef.current?.map) {
      tickerMatRef.current.map.offset.x = (t * 0.04) % 1;
      tickerMatRef.current.map.needsUpdate = true;
    }
  });

  const base = SECTIONS[0];

  return (
    <group ref={groupRef} position={position} userData={{ isLandmark: true }}>
      {/* Invisible hitbox */}
      <mesh position={[0, TOTAL_H / 2, 0]} visible={false}>
        <boxGeometry args={[base.w + 30, TOTAL_H + 100, base.d + 30]} />
        <meshBasicMaterial />
      </mesh>

      {/* ── Ground plaza ── */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[base.w + 40, 2, base.d + 40]} />
        <meshStandardMaterial color={shellColor} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* ── Stepped tower sections (same pattern as E.Arcade) ── */}
      {SECTIONS.map((sec, i) => {
        const hw = sec.w / 2;
        const hd = sec.d / 2;

        return (
          <group key={i}>
            {/* Section body */}
            <mesh position={[0, sec.y, 0]}>
              <boxGeometry args={[sec.w, sec.h, sec.d]} />
              <meshStandardMaterial
                color={shellColor}
                roughness={0.25}
                metalness={0.8}
              />
            </mesh>

            {/* Glass facade — front */}
            <mesh position={[0, sec.y, hd + 0.3]}>
              <planeGeometry args={[sec.w - 4, sec.h - 4]} />
              <meshStandardMaterial
                map={glassFront}
                emissive={themeWindowLit[0] ?? "#fff"}
                emissiveMap={glassFront}
                emissiveIntensity={0.7}
                toneMapped={false}
                transparent
              />
            </mesh>
            {/* Glass facade — back */}
            <mesh position={[0, sec.y, -hd - 0.3]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[sec.w - 4, sec.h - 4]} />
              <meshStandardMaterial
                map={glassFront}
                emissive={themeWindowLit[0] ?? "#fff"}
                emissiveMap={glassFront}
                emissiveIntensity={0.7}
                toneMapped={false}
                transparent
              />
            </mesh>
            {/* Glass facade — right */}
            <mesh position={[hw + 0.3, sec.y, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[sec.d - 4, sec.h - 4]} />
              <meshStandardMaterial
                map={glassSide}
                emissive={themeWindowLit[0] ?? "#fff"}
                emissiveMap={glassSide}
                emissiveIntensity={0.7}
                toneMapped={false}
                transparent
              />
            </mesh>
            {/* Glass facade — left */}
            <mesh position={[-hw - 0.3, sec.y, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[sec.d - 4, sec.h - 4]} />
              <meshStandardMaterial
                map={glassSide}
                emissive={themeWindowLit[0] ?? "#fff"}
                emissiveMap={glassSide}
                emissiveIntensity={0.7}
                toneMapped={false}
                transparent
              />
            </mesh>

            {/* Ledge at top of each section */}
            <mesh position={[0, sec.y + sec.h / 2 + 1, 0]}>
              <boxGeometry args={[sec.w + 3, 2, sec.d + 3]} />
              <meshStandardMaterial color={shellColor} roughness={0.3} metalness={0.7} />
            </mesh>

            {/* Accent trim at ledge — matches E.Arcade style */}
            <mesh position={[0, sec.y + sec.h / 2 + 2.5, 0]}>
              <boxGeometry args={[sec.w + 4, 0.5, sec.d + 4]} />
              <meshStandardMaterial
                color={themeAccent}
                emissive={themeAccent}
                emissiveIntensity={1}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* ── "?" logo on upper front and back face ── */}
      <mesh position={[0, SECTIONS[2].y + 18, SECTIONS[2].d / 2 + 0.5]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial
          map={logoTex}
          emissive="#ffffff"
          emissiveMap={logoTex}
          emissiveIntensity={2.5}
          toneMapped={false}
          transparent
          alphaTest={0.1}
        />
      </mesh>
      <mesh
        position={[0, SECTIONS[2].y + 18, -SECTIONS[2].d / 2 - 0.5]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial
          map={logoTex}
          emissive="#ffffff"
          emissiveMap={logoTex}
          emissiveIntensity={2.5}
          toneMapped={false}
          transparent
          alphaTest={0.1}
        />
      </mesh>

      {/* Logo glow */}
      <pointLight
        ref={signGlowRef}
        position={[0, SECTIONS[2].y + 18, SECTIONS[2].d / 2 + 20]}
        color={themeAccent}
        intensity={55}
        distance={130}
        decay={2}
      />

      {/* ── "DAILY QUESTIONS" sign ── */}
      <mesh position={[0, SECTIONS[2].y - 28, SECTIONS[2].d / 2 + 0.5]}>
        <planeGeometry args={[56, 9]} />
        <meshStandardMaterial
          map={signTex}
          emissive="#ffffff"
          emissiveMap={signTex}
          emissiveIntensity={1.5}
          toneMapped={false}
          transparent
          alphaTest={0.1}
        />
      </mesh>

      {/* ── Scrolling ticker tape on mid section ── */}
      <mesh ref={tickerRef} position={[0, SECTIONS[1].y - 20, SECTIONS[1].d / 2 + 0.5]}>
        <planeGeometry args={[SECTIONS[1].w - 6, 7]} />
        <meshStandardMaterial
          ref={tickerMatRef}
          map={tickerTex}
          emissive="#ffffff"
          emissiveMap={tickerTex}
          emissiveIntensity={1.2}
          toneMapped={false}
          transparent
        />
      </mesh>
      {/* Ticker frame border */}
      <mesh position={[0, SECTIONS[1].y - 20, SECTIONS[1].d / 2 + 0.3]}>
        <boxGeometry args={[SECTIONS[1].w - 4, 9, 0.5]} />
        <meshStandardMaterial
          color={themeAccent}
          emissive={themeAccent}
          emissiveIntensity={0.6}
          toneMapped={false}
        />
      </mesh>

      {/* ── Vertical accent strips (left & right, all sections) ── */}
      {SECTIONS.map((sec, i) => (
        <group key={`strips-${i}`}>
          <mesh position={[sec.w / 2 + 0.4, sec.y, 0]}>
            <boxGeometry args={[0.3, sec.h, 2]} />
            <meshStandardMaterial
              color={themeAccent}
              emissive={themeAccent}
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[-sec.w / 2 - 0.4, sec.y, 0]}>
            <boxGeometry args={[0.3, sec.h, 2]} />
            <meshStandardMaterial
              color={themeAccent}
              emissive={themeAccent}
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* ── Arcade cabinet crown (flat top instead of spire) ── */}
      <mesh position={[0, TOTAL_H + 4, 0]}>
        <boxGeometry args={[36, 10, 28]} />
        <meshStandardMaterial color={shellColor} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Crown accent glow strip */}
      <mesh position={[0, TOTAL_H + 10, 0]}>
        <boxGeometry args={[38, 1, 30]} />
        <meshStandardMaterial
          color={themeAccent}
          emissive={themeAccent}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>

      {/* ── Antenna ── */}
      <mesh position={[0, TOTAL_H + 32, 0]}>
        <cylinderGeometry args={[0.5, 2, 44, 6]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* ── Top beacon ── */}
      <mesh ref={beaconRef} position={[0, TOTAL_H + 58, 0]}>
        <sphereGeometry args={[4, 8, 8]} />
        <meshStandardMaterial
          color={themeAccent}
          emissive={themeAccent}
          emissiveIntensity={3}
          toneMapped={false}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight
        position={[0, TOTAL_H + 58, 0]}
        color={themeAccent}
        intensity={50}
        distance={180}
        decay={2}
      />

      {/* ── Entrance glow (ground level) ── */}
      <mesh position={[0, 12, base.d / 2 + 0.5]}>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial
          color={themeFace}
          emissive={themeAccent}
          emissiveIntensity={0.3}
        />
      </mesh>
      <pointLight
        position={[0, 14, base.d / 2 + 14]}
        color={themeAccent}
        intensity={20}
        distance={55}
        decay={2}
      />
    </group>
  );
}