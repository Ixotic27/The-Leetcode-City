"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createWindowAtlas, FocusBeacon } from "./Building3D";
import InstancedBuildings from "./InstancedBuildings";
import InstancedLabels from "./InstancedLabels";
import EffectsLayer from "./EffectsLayer";
import LiveDots from "./LiveDots";
import type { LiveSession } from "@/lib/useCodingPresence";
import type { CityBuilding } from "@/lib/github";
import type { BuildingColors } from "./CityCanvas";

const GRID_CELL_SIZE = 200;
const WEATHER_PARTICLE_COUNT = 900;
const WEATHER_AREA = 2200;
const WEATHER_TOP = 420;
const WEATHER_BOTTOM = 10;
const WEATHER_RESPAWN_TICK_RATE = 60;
const WEATHER_RESPAWN_X_SEED = 17;
const WEATHER_RESPAWN_Z_SEED = 19;
const PRNG_MULTIPLIER = 12.9898;
const PRNG_SCALE = 43758.5453123;
const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed * PRNG_MULTIPLIER) * PRNG_SCALE;
  return x - Math.floor(x);
};

const _position = new THREE.Vector3();

export interface FocusInfo {
  dist: number;
  screenX: number;
  screenY: number;
}

interface GridIndex {
  cells: Map<string, number[]>;
  cellSize: number;
}

function buildSpatialGrid(
  buildings: CityBuilding[],
  cellSize: number,
): GridIndex {
  const cells = new Map<string, number[]>();
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const cx = Math.floor(b.position[0] / cellSize);
    const cz = Math.floor(b.position[2] / cellSize);
    const key = `${cx},${cz}`;
    let arr = cells.get(key);
    if (!arr) {
      arr = [];
      cells.set(key, arr);
    }
    arr.push(i);
  }
  return { cells, cellSize };
}

interface BuildingLookup {
  indexByLogin: Map<string, number>;
}

function buildLookup(buildings: CityBuilding[]): BuildingLookup {
  const indexByLogin = new Map<string, number>();
  for (let i = 0; i < buildings.length; i++) {
    indexByLogin.set(buildings[i].login.toLowerCase(), i);
  }
  return { indexByLogin };
}

// ─── Day/Night Environment (Sky, Sun, Moon & Stars) ─────────────
function DayNightEnvironment({ colors }: { colors: BuildingColors }) {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const starsRef = useRef<THREE.Points>(null);

  const starGeo = useMemo(() => {
    const positions = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4000;
      positions[i * 3 + 1] = Math.random() * 1000 + 300;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4000;
    }
    return positions;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.05;
    const timeOfDay = (Math.sin(t) + 1.0) / 2.0; // Matches InstancedBuildings cycle

    const dayColor = new THREE.Color("#4a7cff");
    const sunsetColor = new THREE.Color("#ff7b00");
    const nightColor = new THREE.Color("#050814");

    let currentColor = new THREE.Color();
    if (timeOfDay > 0.5) {
      currentColor.lerpColors(sunsetColor, dayColor, (timeOfDay - 0.5) * 2.0);
    } else {
      currentColor.lerpColors(nightColor, sunsetColor, timeOfDay * 2.0);
    }

    scene.background = currentColor;
    if (scene.fog) {
      scene.fog.color.copy(currentColor);
    }

    if (sunRef.current) {
      sunRef.current.position.set(Math.cos(t) * 800, Math.sin(t) * 800, -400);
      sunRef.current.intensity = Math.max(0, Math.sin(t)) * 2.5;
    }
    if (moonRef.current) {
      moonRef.current.position.set(
        Math.cos(t + Math.PI) * 800,
        Math.sin(t + Math.PI) * 800,
        -400,
      );
      moonRef.current.intensity = Math.max(0, Math.sin(t + Math.PI)) * 1.5;
    }

    if (starsRef.current) {
      const mat = starsRef.current.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1.0 - timeOfDay * 2.0);
    }
  });

  return (
    <group>
      <directionalLight ref={sunRef} color="#ffeedd" />
      <directionalLight ref={moonRef} color="#aaccff" />
      <ambientLight intensity={0.2} />
      <points ref={starsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starGeo, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={2}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

// ─── Component ──────────────────────────────────────────────────
interface CitySceneProps {
  buildings: CityBuilding[];
  colors: BuildingColors;
  focusedBuilding?: string | null;
  focusedBuildingB?: string | null;
  hideEffectsFor?: string | null;
  accentColor?: string;
  onBuildingClick?: (building: CityBuilding) => void;
  onFocusInfo?: (info: FocusInfo) => void;
  introMode?: boolean;
  flyMode?: boolean;
  ghostPreviewLogin?: string | null;
  holdRise?: boolean;
  liveByLogin?: Map<string, LiveSession>;
  cityEnergy?: number;
}

function RainWeather() {
  const pointsRef = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
    const speeds = new Float32Array(WEATHER_PARTICLE_COUNT);
    for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
      const base = i * 3;
      positions[base] = (pseudoRandom(i * 3 + 1) - 0.5) * WEATHER_AREA;
      positions[base + 1] =
        WEATHER_BOTTOM +
        pseudoRandom(i * 3 + 2) * (WEATHER_TOP - WEATHER_BOTTOM);
      positions[base + 2] = (pseudoRandom(i * 3 + 3) - 0.5) * WEATHER_AREA;
      speeds[i] = 120 + pseudoRandom(i * 3 + 4) * 150;
    }
    return { positions, speeds };
  }, []);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const positionArray = pts.geometry.attributes.position
      .array as Float32Array;
    const tick = Math.floor(
      state.clock.elapsedTime * WEATHER_RESPAWN_TICK_RATE,
    );
    for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
      const base = i * 3;
      positionArray[base + 1] -= speeds[i] * delta;
      if (positionArray[base + 1] < WEATHER_BOTTOM) {
        positionArray[base] =
          (pseudoRandom(i * WEATHER_RESPAWN_X_SEED + tick) - 0.5) *
          WEATHER_AREA;
        positionArray[base + 1] = WEATHER_TOP;
        positionArray[base + 2] =
          (pseudoRandom(i * WEATHER_RESPAWN_Z_SEED + tick * 2) - 0.5) *
          WEATHER_AREA;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#a7c7ff"
        size={4}
        sizeAttenuation={false}
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </points>
  );
}

export default function CityScene({
  buildings,
  colors,
  focusedBuilding,
  focusedBuildingB,
  hideEffectsFor,
  accentColor,
  onBuildingClick,
  onFocusInfo,
  introMode,
  flyMode,
  ghostPreviewLogin,
  holdRise,
  liveByLogin,
  cityEnergy,
}: CitySceneProps) {
  const atlasTexture = useMemo(() => createWindowAtlas(colors), [colors]);
  const grid = useMemo(
    () => buildSpatialGrid(buildings, GRID_CELL_SIZE),
    [buildings],
  );
  const lookup = useMemo(() => buildLookup(buildings), [buildings]);

  const focusedLower = focusedBuilding?.toLowerCase() ?? null;
  const focusedBLower = focusedBuildingB?.toLowerCase() ?? null;

  const focusedBuildingData = useMemo(() => {
    if (!focusedLower) return null;
    const idx = lookup.indexByLogin.get(focusedLower);
    if (idx === undefined) return null;
    return buildings[idx];
  }, [focusedLower, lookup, buildings]);

  const focusedBuildingBData = useMemo(() => {
    if (!focusedBLower) return null;
    const idx = lookup.indexByLogin.get(focusedBLower);
    if (idx === undefined) return null;
    return buildings[idx];
  }, [focusedBLower, lookup, buildings]);

  const lastFocusUpdate = useRef(-1);

  useFrame(({ camera, clock, size }) => {
    const elapsed = clock.elapsedTime;
    if (elapsed - lastFocusUpdate.current < 0.2) return;
    lastFocusUpdate.current = elapsed;

    if (!onFocusInfo || (!focusedLower && !focusedBLower)) return;

    const fi = focusedLower ? lookup.indexByLogin.get(focusedLower) : undefined;
    const fbi = focusedBLower
      ? lookup.indexByLogin.get(focusedBLower)
      : undefined;
    const targetIdx = fi ?? fbi;
    if (targetIdx === undefined) return;

    const b = buildings[targetIdx];
    const dx = camera.position.x - b.position[0];
    const dz = camera.position.z - b.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    _position.set(b.position[0], b.height * 0.65, b.position[2]);
    _position.project(camera);
    const screenX = (_position.x * 0.5 + 0.5) * size.width;
    const screenY = (-_position.y * 0.5 + 0.5) * size.height;
    onFocusInfo({ dist, screenX, screenY });
  });

  useEffect(() => {
    return () => atlasTexture.dispose();
  }, [atlasTexture]);

  return (
    <>
      <InstancedBuildings
        buildings={buildings}
        colors={colors}
        atlasTexture={atlasTexture}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
        introMode={introMode}
        onBuildingClick={onBuildingClick}
        holdRise={holdRise}
        liveByLogin={liveByLogin}
        cityEnergy={cityEnergy}
      />

      {/* Renders Day, Night, Stars dynamically */}
      <DayNightEnvironment colors={colors} />

      {liveByLogin && liveByLogin.size > 0 && (
        <LiveDots buildings={buildings} liveByLogin={liveByLogin} />
      )}

      <InstancedLabels
        buildings={buildings}
        introMode={introMode}
        flyMode={flyMode}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
      />

      <EffectsLayer
        buildings={buildings}
        grid={grid}
        colors={colors}
        accentColor={accentColor ?? colors.accent ?? "#ffa116"}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
        hideEffectsFor={hideEffectsFor}
        introMode={introMode}
        flyMode={flyMode}
        ghostPreviewLogin={ghostPreviewLogin}
      />

      {!introMode && <RainWeather />}

      {!introMode && focusedBuildingData && (
        <group
          position={[
            focusedBuildingData.position[0],
            0,
            focusedBuildingData.position[2],
          ]}
        >
          <FocusBeacon
            height={focusedBuildingData.height}
            width={focusedBuildingData.width}
            depth={focusedBuildingData.depth}
            accentColor={accentColor ?? "#ffa116"}
          />
        </group>
      )}

      {!introMode &&
        focusedBuildingBData &&
        focusedBuildingBData !== focusedBuildingData && (
          <group
            position={[
              focusedBuildingBData.position[0],
              0,
              focusedBuildingBData.position[2],
            ]}
          >
            <FocusBeacon
              height={focusedBuildingBData.height}
              width={focusedBuildingBData.width}
              depth={focusedBuildingBData.depth}
              accentColor={accentColor ?? "#ffa116"}
            />
          </group>
        )}
    </>
  );
}
