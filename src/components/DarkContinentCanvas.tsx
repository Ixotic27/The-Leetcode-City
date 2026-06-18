"use client";

import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Clone } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { VehicleMesh } from "./RaidSequence3D";
import OuterWildlands from "./OuterWildlands";
import { getZone, ZONE_NAMES } from "@/lib/darkContinent/zones";
import { getTerrainHeight, seededRandom } from "@/lib/darkContinent/terrain";
import type { AABB } from "@/lib/darkContinent/collision";

// ─────────────────────────────────────────────────────────────────────────────
// Constants — copied verbatim from CityCanvas.tsx
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FLY_SPEED = 55;
const MIN_FLY_SPEED = 30;
const MAX_FLY_SPEED = 200;
const MAX_ALT = 900;
const TURN_RATE = 2.0;
const CLIMB_RATE = 55;
const MAX_BANK = 0.55;
const MAX_PITCH = 0.7;
const DEADZONE = 0.08;

function deadzoneCurve(v: number): number {
  const abs = Math.abs(v);
  if (abs < DEADZONE) return 0;
  const adjusted = (abs - DEADZONE) / (1 - DEADZONE);
  return Math.sign(v) * adjusted * adjusted;
}

// Pre-allocated temp vectors (avoid GC in useFrame)
const _fwd = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _idealCamPos = new THREE.Vector3();
const _idealLook = new THREE.Vector3();
const _blendedPos = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);

// ─────────────────────────────────────────────────────────────────────────────
// PlaneModel — uses paper-plane.glb
// ─────────────────────────────────────────────────────────────────────────────

function PlaneModel() {
  const { scene } = useGLTF("/models/paper-plane.glb");
  return (
    <group scale={[3, 3, 3]} rotation={[0, Math.PI / 2, 0]}>
      <primitive object={scene} />
    </group>
  );
}
useGLTF.preload("/models/paper-plane.glb");

// ─────────────────────────────────────────────────────────────────────────────
// AirplaneFlight — copied verbatim from CityCanvas.tsx, terrain-aware MIN_ALT
// ─────────────────────────────────────────────────────────────────────────────

function AirplaneFlight({
  onExit,
  onHud,
  onPause,
  pauseSignal = 0,
  hasOverlay = false,
  startPaused = false,
  vehicleType = "airplane",
  posRef,
  cityRadius,
  hasTraveledToNewWorld,
  initialPosition,
  initialYaw,
}: {
  onExit: (aborted: boolean) => void;
  onHud: (s: number, a: number, x: number, z: number, yaw: number) => void;
  onPause: (paused: boolean) => void;
  pauseSignal?: number;
  hasOverlay?: boolean;
  startPaused?: boolean;
  vehicleType?: string;
  posRef?: React.MutableRefObject<THREE.Vector3>;
  cityRadius: number;
  hasTraveledToNewWorld?: boolean;
  initialPosition?: THREE.Vector3;
  initialYaw?: number;
}) {
  const { camera } = useThree();
  const ref = useRef<THREE.Group>(null);
  const orbitRef = useRef<any>(null);

  const mouse = useRef({ x: 0, y: 0 });
  const keys = useRef<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(startPaused);
  const paused = useRef(startPaused);
  const isFirstResume = useRef(startPaused);

  // Flight state
  const yaw = useRef(0);
  const pos = useRef(new THREE.Vector3(0, 120, 400));
  const flySpeed = useRef(DEFAULT_FLY_SPEED);
  const bank = useRef(0);
  const pitch = useRef(0);

  // Camera smoothing
  const camPos = useRef(new THREE.Vector3(0, 140, 450));
  const camLook = useRef(new THREE.Vector3(0, 120, 400));

  // Transition state (unpause camera blend)
  const transitionProgress = useRef(1);
  const transitionFrom = useRef(new THREE.Vector3());
  const transitionLookFrom = useRef(new THREE.Vector3());
  const wasJustUnpaused = useRef(false);

  const hudTimer = useRef(0);

  // Initialize from current camera position or provided initial position
  useEffect(() => {
    if (initialPosition) {
      pos.current.copy(initialPosition);
      yaw.current = initialYaw ?? 0;
      const behindOffset = new THREE.Vector3(
        Math.sin(yaw.current) * 50,
        20,
        Math.cos(yaw.current) * 50
      );
      camPos.current.copy(initialPosition).add(behindOffset);
      camLook.current.copy(initialPosition);
      camera.position.copy(camPos.current);
      camera.lookAt(camLook.current);
      if (startPaused) onPause(true);
      return;
    }

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const initialYawDerived = Math.atan2(-camDir.x, -camDir.z);
    yaw.current = initialYawDerived;

    const startPos = camera.position.clone();
    const terrainY = getTerrainHeight(startPos.x, startPos.z);
    const minAlt = terrainY - 18 + 12;
    startPos.y = Math.max(minAlt, Math.min(MAX_ALT, startPos.y));
    pos.current.copy(startPos);

    const behindOffset = new THREE.Vector3(
      Math.sin(yaw.current) * 50,
      20,
      Math.cos(yaw.current) * 50
    );
    camPos.current.copy(startPos).add(behindOffset);
    camLook.current.copy(startPos);
    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);
    if (startPaused) onPause(true);
  }, [camera, initialPosition, initialYaw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse + wheel
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!paused.current) {
        mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!paused.current) {
        flySpeed.current = Math.max(
          MIN_FLY_SPEED,
          Math.min(MAX_FLY_SPEED, flySpeed.current - e.deltaY * 0.05)
        );
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  // External pause signal
  const prevSignal = useRef(pauseSignal);
  useEffect(() => {
    if (pauseSignal !== prevSignal.current) {
      prevSignal.current = pauseSignal;
      if (!paused.current) {
        paused.current = true;
        setIsPaused(true);
        onPause(true);
      }
    }
  }, [pauseSignal, onPause]);

  const hasOverlayRef = useRef(hasOverlay);
  hasOverlayRef.current = hasOverlay;

  // Keyboard
  useEffect(() => {
    const doPause = () => {
      if (paused.current) return;
      paused.current = true;
      setIsPaused(true);
      onPause(true);
    };
    const doResume = () => {
      if (!paused.current) return;
      paused.current = false;
      setIsPaused(false);
      if (isFirstResume.current) {
        isFirstResume.current = false;
        transitionProgress.current = 1;
        wasJustUnpaused.current = false;
      } else {
        wasJustUnpaused.current = true;
        transitionProgress.current = 0;
        transitionFrom.current.copy(camera.position);
        transitionLookFrom.current.copy(camLook.current);
      }
      onPause(false);
    };

    const FLIGHT_KEYS = new Set([
      "KeyW", "KeyA", "KeyS", "KeyD",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "ShiftLeft", "ShiftRight", "Shift", "AltLeft", "AltRight", "Alt",
    ]);

    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.key === "Shift") keys.current["Shift"] = true;
      if (e.key === "Alt") keys.current["Alt"] = true;

      if (e.code === "Escape") {
        if (!paused.current) {
          doPause();
        } else if (hasOverlayRef.current) {
          return;
        } else {
          onExit(true);
        }
      } else if (e.code === "KeyP" || e.code === "Space") {
        e.preventDefault();
        if (paused.current) doResume();
        else doPause();
      } else if (
        paused.current &&
        (FLIGHT_KEYS.has(e.code) || FLIGHT_KEYS.has(e.key))
      ) {
        doResume();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      if (e.key === "Shift") keys.current["Shift"] = false;
      if (e.key === "Alt") keys.current["Alt"] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [camera, onExit, onPause]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = keys.current;

    if (paused.current) {
      if (ref.current) ref.current.visible = true;
      if (orbitRef.current) {
        orbitRef.current.target.copy(pos.current);
        orbitRef.current.update();
      }
      hudTimer.current += dt;
      if (hudTimer.current > 0.25) {
        hudTimer.current = 0;
        onHud(0, pos.current.y, pos.current.x, pos.current.z, yaw.current);
      }
      return;
    }

    // Unpause blend
    if (wasJustUnpaused.current) {
      if (ref.current) ref.current.visible = true;
      transitionProgress.current += dt * 2;
      if (transitionProgress.current >= 1) {
        transitionProgress.current = 1;
        wasJustUnpaused.current = false;
      }
    }

    // Turn input
    let turnInput = 0;
    if (k["KeyA"] || k["ArrowLeft"]) turnInput = -1;
    if (k["KeyD"] || k["ArrowRight"]) turnInput = 1;

    // Mouse yaw
    const mxApplied = deadzoneCurve(mouse.current.x);
    turnInput += mxApplied * 1.2;
    yaw.current -= turnInput * TURN_RATE * dt;

    // Altitude input
    let altInput = 0;
    if (k["KeyW"] || k["ArrowUp"]) altInput = 1;
    if (k["KeyS"] || k["ArrowDown"]) altInput = -1;
    const myApplied = deadzoneCurve(mouse.current.y);
    altInput += myApplied;

    // Speed modifiers
    let speedMult = 1;
    if (k["ShiftLeft"] || k["ShiftRight"] || k["Shift"]) speedMult = 2.5;
    if (k["AltLeft"] || k["AltRight"] || k["Alt"]) speedMult = 0.3;

    const actualSpeed = flySpeed.current * speedMult;
    const climbScale = Math.sqrt(actualSpeed / DEFAULT_FLY_SPEED);

    pos.current.y += altInput * CLIMB_RATE * climbScale * dt;

    // Terrain-aware MIN_ALT
    const terrainY = getTerrainHeight(pos.current.x, pos.current.z);
    const minAlt = terrainY - 18 + 12;
    pos.current.y = Math.max(minAlt, Math.min(MAX_ALT, pos.current.y));

    _fwd.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    pos.current.addScaledVector(_fwd, actualSpeed * dt);

    if (posRef) posRef.current.copy(pos.current);

    // Bank and pitch
    const targetBank = -turnInput * MAX_BANK;
    bank.current += (targetBank - bank.current) * 5 * dt;

    const targetPitch = altInput * MAX_PITCH;
    pitch.current += (targetPitch - pitch.current) * 6 * dt;

    if (ref.current) {
      ref.current.visible = true;
      ref.current.position.copy(pos.current);
      ref.current.rotation.set(pitch.current, yaw.current, bank.current, "YXZ");
    }

    // Camera follow
    const camDist = 35 + flySpeed.current * 0.2;
    _camOffset.set(0, 15, camDist).applyAxisAngle(_yAxis, yaw.current);
    _idealCamPos.copy(pos.current).add(_camOffset);
    _idealLook.copy(pos.current).addScaledVector(_fwd, 5);
    _idealLook.y += 2;

    const lerpXZ = 2.0 * dt;
    const lerpY = 1.8 * dt;
    camPos.current.x += (_idealCamPos.x - camPos.current.x) * lerpXZ;
    camPos.current.z += (_idealCamPos.z - camPos.current.z) * lerpXZ;
    camPos.current.y += (_idealCamPos.y - camPos.current.y) * lerpY;
    camLook.current.lerp(_idealLook, 4.0 * dt);

    if (wasJustUnpaused.current && transitionProgress.current < 1) {
      const tEase = 1 - Math.pow(1 - transitionProgress.current, 3);
      _blendedPos.copy(transitionFrom.current).lerp(camPos.current, tEase);
      camera.position.copy(_blendedPos);
    } else {
      camera.position.copy(camPos.current);
    }
    camera.lookAt(camLook.current);

    hudTimer.current += dt;
    if (hudTimer.current > 0.25) {
      hudTimer.current = 0;
      onHud(actualSpeed, pos.current.y, pos.current.x, pos.current.z, yaw.current);
    }
  });

  return (
    <>
      <group ref={ref}>
        <group scale={[4, 4, 4]}>
          <VehicleMesh type={vehicleType} />
        </group>
        <pointLight position={[0, -2, 0]} color="#f0c870" intensity={15} distance={60} />
        <pointLight position={[0, 3, -4]} color="#ffffff" intensity={5} distance={30} />
      </group>
      {isPaused && (
        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={20}
          maxDistance={300}
          maxPolarAngle={Math.PI / 2.1}
          target={pos.current.toArray() as [number, number, number]}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sky shader — copied verbatim from AtmosphereCycleManager.tsx
// ─────────────────────────────────────────────────────────────────────────────

const skyVertexShader = `
  varying vec3 vPosition;
  void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = `
  uniform vec3 uSkyColors[5];
  uniform vec3 uFogColor;
  varying vec3 vPosition;

  vec3 getSkyColor(float v) {
    if (v < 0.25) {
      return mix(uSkyColors[0], uSkyColors[1], v / 0.25);
    } else if (v < 0.5) {
      return mix(uSkyColors[1], uSkyColors[2], (v - 0.25) / 0.25);
    } else if (v < 0.75) {
      return mix(uSkyColors[2], uSkyColors[3], (v - 0.5) / 0.25);
    } else {
      return mix(uSkyColors[3], uSkyColors[4], (v - 0.75) / 0.25);
    }
  }

  void main() {
    vec3 dir = normalize(vPosition);
    float v = 0.5 - dir.y * 0.5;
    vec3 skyColor = getSkyColor(clamp(v, 0.0, 1.0));
    float horizonBlend = 1.0 - smoothstep(-0.06, 0.18, dir.y);
    vec3 finalColor = mix(skyColor, uFogColor, horizonBlend);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Zone sky configs
const ZONE_SKIES = [
  { stops: ["#000a04","#031408","#051a0a","#071e0c","#0a2810"], fogColor: "#051a0a" }, // jungle
  { stops: ["#050202","#0a0404","#180806","#2a0e05","#1a0a04"], fogColor: "#0a0505" }, // volcanic
  { stops: ["#000408","#020810","#051018","#081828","#0a2038"], fogColor: "#05080f" }, // frozen
  { stops: ["#020005","#04010a","#080214","#0d0420","#100528"], fogColor: "#05020f" }, // void
  { stops: ["#010402","#020806","#031008","#04180a","#06200c"], fogColor: "#020a04" }, // worldTree
  { stops: ["#050300","#0a0602","#150c04","#200e04","#2a1204"], fogColor: "#0a0804" }, // desert
];

// ─────────────────────────────────────────────────────────────────────────────
// DarkContinentSkyDome — zone-aware sky
// ─────────────────────────────────────────────────────────────────────────────

function DarkContinentSkyDome({ zone }: { zone: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const skyResources = useMemo(() => {
    const colors = [
      new THREE.Color(),
      new THREE.Color(),
      new THREE.Color(),
      new THREE.Color(),
      new THREE.Color(),
    ];
    const material = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uSkyColors: { value: colors },
        uFogColor: { value: new THREE.Color("#051a0a") },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    return { material, colors };
  }, []);

  // Lerp between zone skies
  const currentZoneRef = useRef(zone);
  const blendRef = useRef(1.0);
  const prevColors = useRef(ZONE_SKIES[0].stops.map(() => new THREE.Color()));
  const prevFog = useRef(new THREE.Color(ZONE_SKIES[0].fogColor));

  useEffect(() => {
    if (zone !== currentZoneRef.current) {
      // Save previous values as blend start
      const prev = ZONE_SKIES[currentZoneRef.current];
      prev.stops.forEach((s, i) => prevColors.current[i].set(s));
      prevFog.current.set(prev.fogColor);
      blendRef.current = 0;
      currentZoneRef.current = zone;
    }
  }, [zone]);

  useFrame(({ camera, scene }, delta) => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }

    blendRef.current = Math.min(1, blendRef.current + delta * 0.8);
    const t = blendRef.current;
    const targetCfg = ZONE_SKIES[currentZoneRef.current] ?? ZONE_SKIES[0];
    const { material, colors } = skyResources;

    for (let i = 0; i < 5; i++) {
      const target = new THREE.Color(targetCfg.stops[i]);
      colors[i].copy(prevColors.current[i]).lerp(target, t);
    }

    const targetFog = new THREE.Color(targetCfg.fogColor);
    const blendedFog = prevFog.current.clone().lerp(targetFog, t);
    material.uniforms.uFogColor.value.copy(blendedFog);

    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(blendedFog);
  });

  useEffect(() => {
    return () => { skyResources.material.dispose(); };
  }, [skyResources]);

  return (
    <mesh ref={meshRef} material={skyResources.material} renderOrder={-1}>
      <sphereGeometry args={[3500, 32, 48]} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VoxelClouds — copied from AtmosphereCycleManager.tsx, tinted per zone
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_CLOUD_COLORS = [
  "#1a3020", // jungle — dark mossy green
  "#2a1a16", // volcanic — ash grey/red
  "#d8eaf8", // frozen — bright white
  "#2a1040", // void — deep purple
  "#1a2c14", // world tree — deep forest
  "#3a2810", // desert — dusty ochre
];

interface CloudData {
  position: [number, number, number];
  speed: number;
  parts: { offset: [number, number, number]; scale: [number, number, number] }[];
}

function DarkContinentClouds({ zone }: { zone: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const clouds = useMemo<CloudData[]>(() => {
    const list: CloudData[] = [];
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 3200;
      const y = 330 + Math.random() * 80;
      const z = (Math.random() - 0.5) * 3200;
      const speed = 8 + Math.random() * 12;
      const w = 90 + Math.random() * 70;
      const h = 14 + Math.random() * 8;
      const d = 60 + Math.random() * 40;
      list.push({
        position: [x, y, z],
        speed,
        parts: [
          { offset: [0, 0, 0], scale: [w, h, d] },
          { offset: [-w * 0.35, -h * 0.15, d * 0.1], scale: [w * 0.6, h * 0.7, d * 0.8] },
          { offset: [w * 0.35, -h * 0.1, -d * 0.1], scale: [w * 0.5, h * 0.8, d * 0.7] },
        ],
      });
    }
    return list;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: ZONE_CLOUD_COLORS[0],
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    []
  );

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((cg: any, idx) => {
      const data = clouds[idx];
      if (!data) return;
      cg.position.x += data.speed * delta;
      if (cg.position.x > 1800) cg.position.x = -1800;
    });
    // Tint toward current zone
    const target = new THREE.Color(ZONE_CLOUD_COLORS[zone] ?? ZONE_CLOUD_COLORS[0]);
    material.color.lerp(target, delta * 0.5);
  });

  useEffect(() => {
    return () => {
      material.dispose();
      boxGeo.dispose();
    };
  }, [material, boxGeo]);

  return (
    <group ref={groupRef}>
      {clouds.map((c, idx) => (
        <group key={idx} position={c.position}>
          {c.parts.map((p, pIdx) => (
            <mesh
              key={pIdx}
              position={p.offset}
              scale={p.scale}
              geometry={boxGeo}
              material={material}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-zone atmospheric lighting
// ─────────────────────────────────────────────────────────────────────────────

interface ZoneLight {
  ambient: string;
  ambientI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  dirColor: string;
  dirI: number;
}

const ZONE_LIGHTS: ZoneLight[] = [
  { ambient: "#0a2010", ambientI: 0.4, hemiSky: "#22c87a", hemiGround: "#041208", hemiI: 0.6, dirColor: "#40e880", dirI: 0.8 }, // jungle
  { ambient: "#200808", ambientI: 0.5, hemiSky: "#c84022", hemiGround: "#0a0202", hemiI: 0.8, dirColor: "#ff6030", dirI: 1.2 }, // volcanic
  { ambient: "#080c18", ambientI: 0.4, hemiSky: "#3090e0", hemiGround: "#030608", hemiI: 0.5, dirColor: "#80c0ff", dirI: 0.7 }, // frozen
  { ambient: "#100820", ambientI: 0.3, hemiSky: "#9060e0", hemiGround: "#040210", hemiI: 0.4, dirColor: "#c090ff", dirI: 0.6 }, // void
  { ambient: "#081004", ambientI: 0.5, hemiSky: "#40b870", hemiGround: "#020802", hemiI: 0.7, dirColor: "#a0ff80", dirI: 0.9 }, // world tree
  { ambient: "#180c02", ambientI: 0.6, hemiSky: "#c8900a", hemiGround: "#080400", hemiI: 0.7, dirColor: "#ffb040", dirI: 1.0 }, // desert
];

function ZoneAtmosphere({ zone }: { zone: number }) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);

  const current = useRef<ZoneLight>({ ...ZONE_LIGHTS[0] });
  const ambientColor = useRef(new THREE.Color(ZONE_LIGHTS[0].ambient));
  const hemiSkyColor = useRef(new THREE.Color(ZONE_LIGHTS[0].hemiSky));
  const hemiGroundColor = useRef(new THREE.Color(ZONE_LIGHTS[0].hemiGround));
  const dirLightColor = useRef(new THREE.Color(ZONE_LIGHTS[0].dirColor));

  useFrame((_, delta) => {
    const target = ZONE_LIGHTS[zone] ?? ZONE_LIGHTS[0];
    const lf = Math.min(1, delta * 1.5);

    ambientColor.current.lerp(new THREE.Color(target.ambient), lf);
    hemiSkyColor.current.lerp(new THREE.Color(target.hemiSky), lf);
    hemiGroundColor.current.lerp(new THREE.Color(target.hemiGround), lf);
    dirLightColor.current.lerp(new THREE.Color(target.dirColor), lf);

    current.current.ambientI += (target.ambientI - current.current.ambientI) * lf;
    current.current.hemiI += (target.hemiI - current.current.hemiI) * lf;
    current.current.dirI += (target.dirI - current.current.dirI) * lf;

    if (ambientRef.current) {
      ambientRef.current.color.copy(ambientColor.current);
      ambientRef.current.intensity = current.current.ambientI;
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(hemiSkyColor.current);
      hemiRef.current.groundColor.copy(hemiGroundColor.current);
      hemiRef.current.intensity = current.current.hemiI;
    }
    if (dirRef.current) {
      dirRef.current.color.copy(dirLightColor.current);
      dirRef.current.intensity = current.current.dirI;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} color={ZONE_LIGHTS[0].ambient} intensity={ZONE_LIGHTS[0].ambientI} />
      <hemisphereLight
        ref={hemiRef}
        color={ZONE_LIGHTS[0].hemiSky}
        groundColor={ZONE_LIGHTS[0].hemiGround}
        intensity={ZONE_LIGHTS[0].hemiI}
      />
      <directionalLight
        ref={dirRef}
        position={[400, 800, 300]}
        color={ZONE_LIGHTS[0].dirColor}
        intensity={ZONE_LIGHTS[0].dirI}
        castShadow={false}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GLB asset scattering per zone
// ─────────────────────────────────────────────────────────────────────────────

// Zone angle ranges (each zone covers 60° = π/3 radians)
function getZoneAngleRange(zone: number): [number, number] {
  const slice = (Math.PI * 2) / 6;
  const start = zone * slice - Math.PI;
  return [start, start + slice];
}

function scatterPositions(
  count: number,
  zone: number,
  innerR: number,
  outerR: number,
  seed: number
): THREE.Vector3[] {
  const rng = seededRandom(seed);
  const [startAngle, endAngle] = getZoneAngleRange(zone);
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + rng() * (endAngle - startAngle);
    const r = innerR + rng() * (outerR - innerR);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = getTerrainHeight(x, z);
    positions.push(new THREE.Vector3(x, y, z));
  }
  return positions;
}

// Jungle mushrooms (zone 0)
function JungleMushrooms({ innerR, outerR }: { innerR: number; outerR: number }) {
  const { scene } = useGLTF("/models/mushroom.glb");
  const positions = useMemo(
    () => scatterPositions(35, 0, innerR + 50, outerR - 200, 11111),
    [innerR, outerR]
  );
  return (
    <>
      {positions.map((pos, i) => (
        <Clone
          key={i}
          object={scene}
          position={[pos.x, pos.y, pos.z]}
          scale={[3 + (i % 3), 3 + (i % 3), 3 + (i % 3)]}
          rotation={[0, (i * 1.3) % (Math.PI * 2), 0]}
        />
      ))}
    </>
  );
}

// Jungle spring pools (zone 0)
function JungleSpringPools({ innerR, outerR }: { innerR: number; outerR: number }) {
  const { scene } = useGLTF("/models/spring-pool.glb");
  const positions = useMemo(
    () => scatterPositions(15, 0, innerR + 100, outerR - 300, 22222),
    [innerR, outerR]
  );
  return (
    <>
      {positions.map((pos, i) => (
        <Clone
          key={i}
          object={scene}
          position={[pos.x, pos.y, pos.z]}
          scale={[5, 5, 5]}
          rotation={[0, (i * 0.9) % (Math.PI * 2), 0]}
        />
      ))}
    </>
  );
}

// Frozen ice trees (zone 2)
function FrozenIceTrees({ innerR, outerR }: { innerR: number; outerR: number }) {
  const { scene: scene1 } = useGLTF("/models/ice-tree-1.glb");
  const { scene: scene2 } = useGLTF("/models/ice-tree-2.glb");
  const positions1 = useMemo(
    () => scatterPositions(25, 2, innerR + 80, outerR - 200, 33333),
    [innerR, outerR]
  );
  const positions2 = useMemo(
    () => scatterPositions(20, 2, innerR + 60, outerR - 150, 44444),
    [innerR, outerR]
  );
  return (
    <>
      {positions1.map((pos, i) => (
        <Clone
          key={`it1-${i}`}
          object={scene1}
          position={[pos.x, pos.y, pos.z]}
          scale={[4 + (i % 4), 4 + (i % 4), 4 + (i % 4)]}
          rotation={[0, (i * 1.1) % (Math.PI * 2), 0]}
        />
      ))}
      {positions2.map((pos, i) => (
        <Clone
          key={`it2-${i}`}
          object={scene2}
          position={[pos.x, pos.y, pos.z]}
          scale={[3 + (i % 3), 3 + (i % 3), 3 + (i % 3)]}
          rotation={[0, (i * 1.7) % (Math.PI * 2), 0]}
        />
      ))}
    </>
  );
}

// Volcanic dead trees (zone 1)
function VolcanicDeadTrees({ innerR, outerR }: { innerR: number; outerR: number }) {
  const { scene } = useGLTF("/models/dead-tree.glb");
  const positions = useMemo(
    () => scatterPositions(40, 1, innerR + 60, outerR - 200, 55555),
    [innerR, outerR]
  );
  return (
    <>
      {positions.map((pos, i) => (
        <Clone
          key={i}
          object={scene}
          position={[pos.x, pos.y, pos.z]}
          scale={[4 + (i % 5), 4 + (i % 5), 4 + (i % 5)]}
          rotation={[0, (i * 0.77) % (Math.PI * 2), 0]}
        />
      ))}
    </>
  );
}

// Chests — scattered in desert and void zones
function ScatteredChests({ innerR, outerR }: { innerR: number; outerR: number }) {
  const { scene } = useGLTF("/models/chest.glb");
  // desert = zone 5, void = zone 3
  const desertPositions = useMemo(
    () => scatterPositions(15, 5, innerR + 120, outerR - 300, 66666),
    [innerR, outerR]
  );
  const voidPositions = useMemo(
    () => scatterPositions(12, 3, innerR + 100, outerR - 400, 77777),
    [innerR, outerR]
  );
  return (
    <>
      {desertPositions.map((pos, i) => (
        <Clone
          key={`dc-${i}`}
          object={scene}
          position={[pos.x, pos.y, pos.z]}
          scale={[2, 2, 2]}
          rotation={[0, (i * 1.4) % (Math.PI * 2), 0]}
        />
      ))}
      {voidPositions.map((pos, i) => (
        <Clone
          key={`vc-${i}`}
          object={scene}
          position={[pos.x, pos.y, pos.z]}
          scale={[2, 2, 2]}
          rotation={[0, (i * 2.1) % (Math.PI * 2), 0]}
        />
      ))}
    </>
  );
}

function DarkContinentGLBAssets({
  innerR,
  outerR,
}: {
  innerR: number;
  outerR: number;
}) {
  return (
    <>
      <JungleMushrooms innerR={innerR} outerR={outerR} />
      <JungleSpringPools innerR={innerR} outerR={outerR} />
      <FrozenIceTrees innerR={innerR} outerR={outerR} />
      <VolcanicDeadTrees innerR={innerR} outerR={outerR} />
      <ScatteredChests innerR={innerR} outerR={outerR} />
    </>
  );
}

// Preload GLBs
useGLTF.preload("/models/mushroom.glb");
useGLTF.preload("/models/spring-pool.glb");
useGLTF.preload("/models/ice-tree-1.glb");
useGLTF.preload("/models/ice-tree-2.glb");
useGLTF.preload("/models/dead-tree.glb");
useGLTF.preload("/models/chest.glb");

// ─────────────────────────────────────────────────────────────────────────────
// Ocean plane
// ─────────────────────────────────────────────────────────────────────────────

function OceanPlane() {
  return (
    <mesh position={[0, -18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[40000, 40000]} />
      <meshStandardMaterial
        color="#040e0c"
        roughness={0.6}
        metalness={0.3}
        emissive="#020806"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneBackground — sets scene.background to fog color
// ─────────────────────────────────────────────────────────────────────────────

function SceneBackground({ zone }: { zone: number }) {
  const { scene } = useThree();
  useFrame(() => {
    const cfg = ZONE_SKIES[zone] ?? ZONE_SKIES[0];
    const target = new THREE.Color(cfg.fogColor);
    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(target, 0.02);
    } else {
      scene.background = target.clone();
    }
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD
// ─────────────────────────────────────────────────────────────────────────────

interface HudData {
  speed: number;
  altitude: number;
  x: number;
  z: number;
  yaw: number;
}

// ACCENT COLOR for dark continent — use #ffa116 (same as city default amber)
const DC_ACCENT = "#ffa116";

interface DarkContinentHUDProps {
  speed: number;
  altitude: number;
  zoneName: string;
  isPaused: boolean;
  onExit: () => void;
}

function DarkContinentHUD({ speed, altitude, zoneName, isPaused, onExit }: DarkContinentHUDProps) {
  const [elapsed, setElapsed] = React.useState(0);
  const startRef = React.useRef(Date.now());
  const pausedAtRef = React.useRef(0);
  const totalPausedRef = React.useRef(0);

  React.useEffect(() => {
    if (isPaused) {
      pausedAtRef.current = Date.now();
      return;
    }
    if (pausedAtRef.current > 0) {
      totalPausedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
    }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current - totalPausedRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="pointer-events-none fixed inset-0 z-30 font-pixel uppercase">

      {/* ── TOP CENTER: PAUSED indicator + zone name + EXIT ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div className="inline-flex items-center gap-3 border-[3px] border-border bg-bg/70 px-5 py-2 backdrop-blur-sm">
          {/* Pause/fly dot */}
          <span
            className={`h-2 w-2 flex-shrink-0 ${isPaused ? "" : "blink-dot"}`}
            style={{ backgroundColor: isPaused ? "#f85149" : DC_ACCENT }}
          />
          {/* Paused label or zone name */}
          <span className="text-[10px] text-cream">
            {isPaused ? "Paused" : zoneName}
          </span>

          <span className="mx-1 text-border">|</span>

          {/* Vehicle icon */}
          <span className="pointer-events-auto btn-press border border-border/40 px-1.5 py-0.5 text-[11px]"
            style={{ borderColor: DC_ACCENT, backgroundColor: DC_ACCENT + "22", color: DC_ACCENT }}
          >
            ✈
          </span>

          {/* EXIT button */}
          <button
            onClick={onExit}
            className="pointer-events-auto btn-press ml-2 border border-border-light bg-bg-raised/80 px-2 py-1 text-[9px] font-bold text-cream transition-colors hover:bg-border"
          >
            EXIT
          </button>
        </div>
      </div>

      {/* ── TOP RIGHT: Time elapsed ── */}
      <div className="absolute top-4 right-3 text-right text-[9px] text-muted sm:right-4 sm:text-[10px]">
        <div className="text-[10px] text-cream tracking-wide">DARK CONTINENT</div>
        <div className="mt-1.5 text-[8px]">
          <span className="text-muted">TIME </span>
          <span style={{ color: DC_ACCENT }}>
            {mins}:{secs}
          </span>
        </div>
      </div>

      {/* ── BOTTOM LEFT: SPD + ALT (same pixel positions as city) ── */}
      <div className="absolute bottom-14 left-3 text-[9px] leading-loose text-muted sm:left-4 sm:text-[10px]">
        <div className="flex items-center gap-2">
          <span>SPD</span>
          <span style={{ color: DC_ACCENT }} className="w-6 text-right">
            {Math.round(speed)}
          </span>
          <div className="flex h-[6px] w-20 items-center border border-border/60 bg-bg/50">
            <div
              className="h-full transition-all duration-150"
              style={{
                width: `${Math.min(100, Math.round(((speed - 20) / 180) * 100))}%`,
                backgroundColor: DC_ACCENT,
              }}
            />
          </div>
        </div>
        <div>
          ALT{" "}
          <span style={{ color: DC_ACCENT }}>{Math.round(altitude)}</span>
        </div>
      </div>

      {/* ── ZONE ANNOUNCEMENT (bottom-left, above SPD) — shown when paused ── */}
      {isPaused && (
        <div className="absolute bottom-32 left-3 sm:left-4">
          <div
            className="border-l-4 bg-bg/80 px-4 py-2 backdrop-blur-sm"
            style={{ borderColor: DC_ACCENT }}
          >
            <div className="text-[8px] uppercase tracking-widest text-muted">Zone</div>
            <div className="font-pixel text-sm text-cream">{zoneName}</div>
          </div>
        </div>
      )}

      {/* ── BOTTOM RIGHT: Controls hint (exact same as city) ── */}
      <div className="absolute bottom-[140px] right-3 text-right text-[8px] leading-loose text-muted sm:right-4 sm:text-[9px]">
        {isPaused ? (
          <>
            <div><span className="text-cream">Drag</span> orbit</div>
            <div><span className="text-cream">Scroll</span> zoom</div>
            <div><span className="text-cream">WASD</span> resume</div>
            <div><span style={{ color: DC_ACCENT }}>ESC</span> exit</div>
          </>
        ) : (
          <>
            <div><span className="text-cream">Mouse</span> steer</div>
            <div><span className="text-cream">Shift</span> boost</div>
            <div><span className="text-cream">Alt</span> slow</div>
            <div><span className="text-cream">Scroll</span> base speed</div>
            <div><span style={{ color: DC_ACCENT }}>P</span> pause</div>
            <div><span style={{ color: DC_ACCENT }}>ESC</span> pause</div>
          </>
        )}
      </div>

      {/* ── PAUSED CENTER MESSAGE ── */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-[3px] border-border bg-bg/70 px-8 py-3 backdrop-blur-sm">
            <span className="text-[10px] tracking-[0.3em] text-cream/70">
              PAUSED — PRESS P OR SPACE TO RESUME
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root scene wrapper — reads zone from hud for lighting/sky
// ─────────────────────────────────────────────────────────────────────────────

function DarkContinentScene({
  registryRef,
  onHud,
  onPause,
  onExit,
}: {
  registryRef: React.MutableRefObject<AABB[]>;
  onHud: (s: number, a: number, x: number, z: number, yaw: number) => void;
  onPause: (p: boolean) => void;
  onExit: (aborted: boolean) => void;
}) {
  const [zone, setZone] = useState(0);

  const handleHud = useCallback(
    (s: number, a: number, x: number, z: number, yaw: number) => {
      onHud(s, a, x, z, yaw);
      setZone(getZone(x, z));
    },
    [onHud]
  );

  return (
    <>
      <fog attach="fog" args={[ZONE_SKIES[zone].fogColor, 600, 5500]} />
      <SceneBackground zone={zone} />
      <DarkContinentSkyDome zone={zone} />
      <ZoneAtmosphere zone={zone} />
      <DarkContinentClouds zone={zone} />
      <OceanPlane />
      <OuterWildlands
        innerR={180}
        outerR={3000}
        collisionRegistryRef={registryRef}
      />
      <DarkContinentGLBAssets innerR={180} outerR={3000} />
      <AirplaneFlight
        onExit={onExit}
        onHud={handleHud}
        onPause={onPause}
        cityRadius={0}
        hasTraveledToNewWorld={true}
      />
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.35}
          luminanceSmoothing={0.85}
          blendFunction={BlendFunction.ADD}
        />
      </EffectComposer>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DarkContinentCanvas — root export
// ─────────────────────────────────────────────────────────────────────────────

export default function DarkContinentCanvas() {
  const [hud, setHud] = useState<HudData>({
    speed: 0,
    altitude: 300,
    x: 0,
    z: 0,
    yaw: 0,
  });
  const [isPaused, setIsPaused] = useState(false);
  const registryRef = useRef<AABB[]>([]);

  const handleExit = useCallback(() => {
    window.location.href = "/";
  }, []);

  const handleHud = useCallback(
    (s: number, a: number, x: number, z: number, yaw: number) => {
      setHud({ speed: s, altitude: a, x, z, yaw });
    },
    []
  );

  const handlePause = useCallback((p: boolean) => {
    setIsPaused(p);
  }, []);

  const handleExit3D = useCallback(
    (_aborted: boolean) => {
      handleExit();
    },
    [handleExit]
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Canvas
        camera={{ position: [0, 300, 800], fov: 65, near: 1, far: 12000 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={[1, 1.5]}
        style={{ position: "absolute", inset: 0 }}
      >
        <DarkContinentScene
          registryRef={registryRef}
          onHud={handleHud}
          onPause={handlePause}
          onExit={handleExit3D}
        />
      </Canvas>
      <DarkContinentHUD
        speed={hud.speed}
        altitude={hud.altitude}
        zoneName={ZONE_NAMES[getZone(hud.x, hud.z)] ?? "Unknown"}
        isPaused={isPaused}
        onExit={handleExit}
      />
    </div>
  );
}
