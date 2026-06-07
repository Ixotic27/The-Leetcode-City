"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createWindowAtlas, FocusBeacon } from "./Building3D";
import InstancedBuildings from "./InstancedBuildings";
import InstancedLabels from "./InstancedLabels";
import EffectsLayer from "./EffectsLayer";
import LiveDots from "./LiveDots";
import SunnyWeather from "./SunnyWeather";
import type { LiveSession } from "@/lib/useCodingPresence";
import type { CityBuilding } from "@/lib/github";
import type { BuildingColors } from "./CityCanvas";


const GRID_CELL_SIZE = 200;
const WEATHER_PARTICLE_COUNT = 900;
const WEATHER_AREA = 2200;
const WEATHER_HALF_AREA = WEATHER_AREA / 2;
const WEATHER_TOP = 420;
const WEATHER_BOTTOM = 10;
const WEATHER_RESPAWN_X_SEED = 17;
const WEATHER_RESPAWN_Z_SEED = 19;
const WEATHER_RESPAWN_CYCLE_SEED = 31;
const PRNG_MULTIPLIER = 12.9898;
const PRNG_SCALE = 43758.5453123;
const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed * PRNG_MULTIPLIER) * PRNG_SCALE;
  return x - Math.floor(x);
};
const wrapAroundCenter = (value: number, center: number) => {
  const wrapped = ((value - center + WEATHER_HALF_AREA) % WEATHER_AREA + WEATHER_AREA) % WEATHER_AREA;
  return center + wrapped - WEATHER_HALF_AREA;
};
const createInitialRainState = (centerX: number, centerZ: number) => {
  const positions = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const speeds = new Float32Array(WEATHER_PARTICLE_COUNT);
  const anchorX = new Float32Array(WEATHER_PARTICLE_COUNT);
  const anchorZ = new Float32Array(WEATHER_PARTICLE_COUNT);
  const respawnCycles = new Uint32Array(WEATHER_PARTICLE_COUNT);

  for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
    const base = i * 3;
    anchorX[i] = centerX + (pseudoRandom(i * 3 + 1) - 0.5) * WEATHER_AREA;
    anchorZ[i] = centerZ + (pseudoRandom(i * 3 + 3) - 0.5) * WEATHER_AREA;
    positions[base] = anchorX[i];
    positions[base + 1] = WEATHER_BOTTOM + pseudoRandom(i * 3 + 2) * (WEATHER_TOP - WEATHER_BOTTOM);
    positions[base + 2] = anchorZ[i];
    speeds[i] = 120 + pseudoRandom(i * 3 + 4) * 150;
  }

  return { positions, speeds, anchorX, anchorZ, respawnCycles };
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
  timeRef?: React.MutableRefObject<number>;
  weatherMode?: "sunny" | "rainy" | "windy" | "stormy" | "snowy";
}

function WeatherSystem({ weatherMode }: { weatherMode: "sunny" | "rainy" | "windy" | "stormy" | "snowy" }) {
  const pointsRef = useRef<THREE.Points>(null);
  const leavesRef = useRef<THREE.Points>(null);
  const { camera } = useThree();
  
  const [initialState] = useState(() => createInitialRainState(camera.position.x, camera.position.z));
  const [initialLeavesState] = useState(() => {
    // Generate separate particles specifically optimized for swirling leaves!
    const leafCount = Math.floor(WEATHER_PARTICLE_COUNT * 0.08); // 72 leaves (very few!)
    const positions = new Float32Array(leafCount * 3);
    const speeds = new Float32Array(leafCount);
    const anchorX = new Float32Array(leafCount);
    const anchorZ = new Float32Array(leafCount);
    const respawnCycles = new Uint32Array(leafCount);

    for (let i = 0; i < leafCount; i++) {
      const base = i * 3;
      anchorX[i] = camera.position.x + (pseudoRandom(i * 7 + 2) - 0.5) * WEATHER_AREA;
      anchorZ[i] = camera.position.z + (pseudoRandom(i * 7 + 5) - 0.5) * WEATHER_AREA;
      positions[base] = anchorX[i];
      positions[base + 1] = WEATHER_BOTTOM + pseudoRandom(i * 7 + 9) * (WEATHER_TOP - WEATHER_BOTTOM);
      positions[base + 2] = anchorZ[i];
      speeds[i] = 70 + pseudoRandom(i * 7 + 12) * 60; // leaves float slower than rain
    }
    return { positions, speeds, anchorX, anchorZ, respawnCycles };
  });

  const anchorXRef = useRef(initialState.anchorX);
  const anchorZRef = useRef(initialState.anchorZ);
  const respawnCyclesRef = useRef(initialState.respawnCycles);

  const leafAnchorXRef = useRef(initialLeavesState.anchorX);
  const leafAnchorZRef = useRef(initialLeavesState.anchorZ);
  const leafRespawnCyclesRef = useRef(initialLeavesState.respawnCycles);

  useFrame((state, delta) => {
    if (weatherMode === "sunny") return;

    const centerX = state.camera.position.x;
    const centerZ = state.camera.position.z;

    // 1. Simulate Wind/Rain lines
    const pts = pointsRef.current;
    if (pts) {
      const positionArray = (pts.geometry.attributes.position.array as Float32Array);
      const { speeds } = initialState;
      const anchorX = anchorXRef.current;
      const anchorZ = anchorZRef.current;
      const respawnCycles = respawnCyclesRef.current;

      let speedFactor = 1.0;
      let driftX = 0.0;
      let driftZ = 0.0;

      if (weatherMode === "windy") {
        speedFactor = 0.65;
        driftX = 250.0; // Smooth horizontal wind speed in Windy mode
        driftZ = 75.0;
      } else if (weatherMode === "stormy") {
        speedFactor = 1.9;
        driftX = -90.0; // Smooth driving rain drift in Stormy mode
        driftZ = -45.0;
      } else if (weatherMode === "snowy") {
        speedFactor = 0.18; // Fluffy slow snowfall!
        driftX = 35.0; // Gentle wind drift
        driftZ = 12.0;
      }

      for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
        const base = i * 3;

        // Cumulative horizontal wind drift (completely smooth, zero frame-rate jitter!)
        anchorX[i] += driftX * delta;
        anchorZ[i] += driftZ * delta;

        positionArray[base] = wrapAroundCenter(anchorX[i], centerX);
        positionArray[base + 2] = wrapAroundCenter(anchorZ[i], centerZ);
        positionArray[base + 1] -= speeds[i] * speedFactor * delta;

        // Beautiful swaying motion only for snow
        if (weatherMode === "snowy") {
          const swayX = Math.sin(state.clock.elapsedTime * 1.8 + i) * 3.5;
          const swayZ = Math.cos(state.clock.elapsedTime * 1.4 + i) * 3.5;
          positionArray[base] += swayX;
          positionArray[base + 2] += swayZ;
        }

        if (positionArray[base + 1] < WEATHER_BOTTOM) {
          respawnCycles[i] += 1;
          anchorX[i] = centerX + (pseudoRandom(i * WEATHER_RESPAWN_X_SEED + respawnCycles[i] * WEATHER_RESPAWN_CYCLE_SEED) - 0.5) * WEATHER_AREA;
          anchorZ[i] = centerZ + (pseudoRandom(i * WEATHER_RESPAWN_Z_SEED + respawnCycles[i] * WEATHER_RESPAWN_CYCLE_SEED * 2) - 0.5) * WEATHER_AREA;
          positionArray[base] = wrapAroundCenter(anchorX[i], centerX);
          positionArray[base + 1] = WEATHER_TOP;
          positionArray[base + 2] = wrapAroundCenter(anchorZ[i], centerZ);
        }
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }

    // 2. Simulate Swirling Leaves (Only in Windy Weather)
    const leafPts = leavesRef.current;
    if (leafPts && weatherMode === "windy") {
      const positionArray = (leafPts.geometry.attributes.position.array as Float32Array);
      const { speeds } = initialLeavesState;
      const anchorX = leafAnchorXRef.current;
      const anchorZ = leafAnchorZRef.current;
      const respawnCycles = leafRespawnCyclesRef.current;

      const driftX = 250.0;
      const driftZ = 75.0;
      const speedFactor = 0.65; // Matches the wind speed factor for buoyant gliding

      for (let i = 0; i < initialLeavesState.speeds.length; i++) {
        const base = i * 3;

        // Apply exactly the same cumulative wind drift as the wind lines
        anchorX[i] += driftX * delta;
        anchorZ[i] += driftZ * delta;

        // Fall at the same wind-buoyant rate
        positionArray[base + 1] -= speeds[i] * speedFactor * delta;

        if (positionArray[base + 1] < WEATHER_BOTTOM) {
          respawnCycles[i] += 1;
          anchorX[i] = centerX + (pseudoRandom(i * 13 + respawnCycles[i] * 17) - 0.5) * WEATHER_AREA;
          anchorZ[i] = centerZ + (pseudoRandom(i * 19 + respawnCycles[i] * 23) - 0.5) * WEATHER_AREA;
          positionArray[base + 1] = WEATHER_TOP;
        }

        // Beautiful 3D helical vortex swirl representing movie-like leaf swirls in gusty wind
        const swirlSpeed = 4.5;
        const swirlAngle = state.clock.elapsedTime * swirlSpeed + i * 0.75;
        const swirlRadius = 7.0 + Math.sin(state.clock.elapsedTime * 1.2 + i) * 3.0;

        const swirlX = Math.cos(swirlAngle) * swirlRadius;
        const swirlZ = Math.sin(swirlAngle) * swirlRadius;
        const swirlY = Math.sin(swirlAngle * 2.0) * (swirlRadius * 0.4);

        // Position exactly matching the wind's main trajectory plus the swirling vortex offset (completely smooth!)
        positionArray[base] = wrapAroundCenter(anchorX[i], centerX) + swirlX;
        positionArray[base + 1] = positionArray[base + 1] + swirlY;
        positionArray[base + 2] = wrapAroundCenter(anchorZ[i], centerZ) + swirlZ;
      }
      leafPts.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (weatherMode === "sunny") {
    return (
      <SunnyWeather
        intensity={1.0}
        sunPosition={[600, 400, -300]}
      />
    );
  }

  // Weather style adjustments
  let particleColor = "#a7c7ff";
  let size = 4.0;
  let opacity = 0.6;

  if (weatherMode === "windy") {
    particleColor = "#a5d0ff"; // slightly lighter blue wind lines
    size = 4.5;
    opacity = 0.5;
  } else if (weatherMode === "stormy") {
    particleColor = "#cbd5e1"; // thick grey-ish downpour particles
    size = 6.0;
    opacity = 0.8;
  } else if (weatherMode === "snowy") {
    particleColor = "#ffffff"; // Beautiful fluffy white snow flakes
    size = 6.0;
    opacity = 0.9;
  }

  return (
    <>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initialState.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={particleColor}
          size={size}
          sizeAttenuation={false}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </points>

      {/* Swirling Cherry Blossom Pink Leaves for Windy Weather */}
      {weatherMode === "windy" && (
        <points ref={leavesRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[initialLeavesState.positions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color="#4ade80" // beautiful vibrant green leaves
            size={7.0}
            sizeAttenuation={false}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </points>
      )}
    </>
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
  timeRef,
  weatherMode = "sunny",
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
        onBuildingClick={onBuildingClick}
        introMode={introMode}
        holdRise={holdRise}
        liveByLogin={liveByLogin}
        cityEnergy={cityEnergy}
        timeRef={timeRef}
        weatherMode={weatherMode}
      />



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

      {!introMode && <WeatherSystem weatherMode={weatherMode} />}

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