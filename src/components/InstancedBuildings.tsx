"use client";

import { useRef, useMemo, useEffect, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";
import type { BuildingColors } from "./CityCanvas";
import { wasAdPointerConsumed } from "./SkyAds";

// ─── Atlas Constants ───────────────
const ATLAS_SIZE = 2048;
const ATLAS_CELL = 8;
const ATLAS_COLS = ATLAS_SIZE / ATLAS_CELL; // 256
const ATLAS_BAND_ROWS = 42;

// ─── Shader ────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  attribute vec4 aUvFront;
  attribute vec4 aUvSide;
  attribute float aRise;
  attribute vec4 aTint;
  attribute float aLive;
  attribute vec3 aLcStats;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;
  varying float vInstanceId;
  varying vec4 vTint;
  varying float vLive;
  varying vec3 vLcStats;

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vUvFront = aUvFront;
    vUvSide = aUvSide;
    vTint = aTint;
    vLive = aLive;
    vLcStats = aLcStats;

    vec3 localPos = position;
    localPos.y = localPos.y * aRise + (aRise - 1.0) * 0.5;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(localPos, 1.0);
    vViewPos = mvPos.xyz;
    vInstanceId = float(gl_InstanceID);

    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uRoofColor;
  uniform vec3 uFaceColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFocusedId;
  uniform float uFocusedIdB;
  uniform float uDimOpacity;
  uniform float uDimEmissive;
  uniform float uCityEnergy;
  uniform float uTimeOfDay; // 0.0 = Night, 1.0 = Day
  uniform float uSnowIntensity; // 0.0 to 1.0

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;
  varying float vInstanceId;
  varying vec4 vTint;
  varying float vLive;
  varying vec3 vLcStats;

  void main() {
    float fogDepth = length(vViewPos);

    vec3 absN = abs(vNormal);
    float isRoof = step(0.5, absN.y);

    bool isFrontBack = absN.z > absN.x;
    vec4 uvParams = isFrontBack ? vUvFront : vUvSide;

    vec2 atlasUv = uvParams.xy + vUv * uvParams.zw;
    vec3 wallColor = texture2D(uAtlas, atlasUv).rgb;

    if (vTint.a > 0.5) {
      float isFacePixel = step(length(wallColor - uFaceColor), 0.08);
      vec3 blendedTint = mix(uFaceColor, vTint.rgb, 0.5);
      wallColor = mix(wallColor, blendedTint, isFacePixel);
    }

    float isWindow = step(0.12, length(wallColor - uFaceColor));
    float totalSolved = vLcStats.x + vLcStats.y + vLcStats.z;
    if (totalSolved > 0.01 && isRoof < 0.5 && isWindow > 0.5) {
      float easyEdge = vLcStats.x / totalSolved;
      float medEdge = easyEdge + (vLcStats.y / totalSolved);
      vec3 zoneColor;
      if (vUv.y < easyEdge) zoneColor = vec3(0.13, 0.77, 0.36);
      else if (vUv.y < medEdge) zoneColor = vec3(0.96, 0.62, 0.04);
      else zoneColor = vec3(0.93, 0.26, 0.26);

      wallColor *= (zoneColor * 2.0);
    }

    float energyCube = uCityEnergy * uCityEnergy * uCityEnergy;

    // Dynamic Day/Night lighting logic
    float ambientDay = mix(0.08, 0.7, uTimeOfDay);
    float ambientBase = ambientDay + 0.22 * energyCube;

    // Windows glow more at night
    float nightGlowMultiplier = mix(3.5, 0.5, uTimeOfDay);
    vec3 emissive = wallColor * nightGlowMultiplier * energyCube * isWindow;

    vec3 wallFinal = wallColor * ambientBase + emissive;
    if (uSnowIntensity > 0.01) {
      vec3 frostColor = vec3(0.93, 0.95, 1.0);
      wallFinal = mix(wallFinal, frostColor * ambientBase, uSnowIntensity * 0.12);
    }
    vec3 liveBoost = vec3(1.4, 1.35, 1.2);
    wallFinal = mix(wallFinal, wallFinal * liveBoost, vLive);

    vec3 roofFinal = uRoofColor * (ambientDay + 1.4 * uCityEnergy);
    vec3 snowColor = vec3(0.97, 0.98, 1.0);
    roofFinal = mix(roofFinal, snowColor * (ambientDay + 1.0), uSnowIntensity);

    vec3 color = mix(wallFinal, roofFinal, isRoof);

    // Directional light changes based on time
    vec3 lightDir = normalize(vec3(0.3, mix(0.2, 1.0, uTimeOfDay), 0.5));
    float diffuse = max(dot(vNormal, lightDir), 0.0) * mix(0.2, 0.5, uTimeOfDay) + mix(0.5, 0.8, uTimeOfDay);
    color *= diffuse;

    float isFocused = step(abs(vInstanceId - uFocusedId), 0.5)
                    + step(abs(vInstanceId - uFocusedIdB), 0.5);
    isFocused = min(isFocused, 1.0);

    float hasFocus = step(0.0, uFocusedId);

    float dimFactor = mix(1.0, mix(uDimOpacity, 1.0, isFocused), hasFocus);
    float emissiveMult = mix(1.0, mix(uDimEmissive, 1.0, isFocused), hasFocus);
    color *= emissiveMult * dimFactor;

    float isUnfocused = hasFocus * (1.0 - isFocused);
    if (isUnfocused > 0.5) {
      int x = int(mod(gl_FragCoord.x, 4.0));
      int y = int(mod(gl_FragCoord.y, 4.0));
      int idx = x + y * 4;
      float bayer;
      if (idx == 0) bayer = 0.0;    else if (idx == 1) bayer = 0.5;
      else if (idx == 2) bayer = 0.125; else if (idx == 3) bayer = 0.625;
      else if (idx == 4) bayer = 0.75;  else if (idx == 5) bayer = 0.25;
      else if (idx == 6) bayer = 0.875; else if (idx == 7) bayer = 0.375;
      else if (idx == 8) bayer = 0.1875; else if (idx == 9) bayer = 0.6875;
      else if (idx == 10) bayer = 0.0625; else if (idx == 11) bayer = 0.5625;
      else if (idx == 12) bayer = 0.9375; else if (idx == 13) bayer = 0.4375;
      else if (idx == 14) bayer = 0.8125; else bayer = 0.3125;
      if (bayer > uDimOpacity) discard;
    }

    float fogFactor = smoothstep(uFogNear, uFogFar, fogDepth);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);

interface InstancedBuildingsProps {
  buildings: CityBuilding[];
  colors: BuildingColors;
  atlasTexture: THREE.CanvasTexture;
  focusedBuilding?: string | null;
  focusedBuildingB?: string | null;
  introMode?: boolean;
  onBuildingClick?: (building: CityBuilding) => void;
  dimOpacity?: number;
  dimEmissive?: number;
  holdRise?: boolean;
  liveByLogin?: Map<string, unknown>;
  cityEnergy?: number;
  timeRef?: React.MutableRefObject<number>;
  weatherMode?: "sunny" | "rainy" | "windy" | "stormy" | "snowy";
}

interface RiseState {
  startTime: number;
  idx: number;
}

const RISE_DURATION = 0.85;
const MAX_RISE_TOTAL = 4;
let hasPlayedRiseGlobal = false;

export default memo(function InstancedBuildings({
  buildings,
  colors,
  atlasTexture,
  focusedBuilding,
  focusedBuildingB,
  introMode,
  onBuildingClick,
  dimOpacity,
  dimEmissive,
  holdRise,
  liveByLogin,
  cityEnergy = 1.0,
  timeRef,
  weatherMode = "sunny",
}: InstancedBuildingsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = buildings.length;

  const loginToIdx = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < buildings.length; i++) {
      map.set(buildings[i].login.toLowerCase(), i);
    }
    return map;
  }, [buildings]);

  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlasTexture },
        uRoofColor: { value: new THREE.Color(colors.roof) },
        uFaceColor: { value: new THREE.Color(colors.face) },
        uFogColor: { value: new THREE.Color("#0a1428") },
        uFogNear: { value: 500 },
        uFogFar: { value: 3500 },
        uFocusedId: { value: -1.0 },
        uFocusedIdB: { value: -1.0 },
        uDimOpacity: { value: dimOpacity },
        uDimEmissive: { value: dimEmissive },
        uCityEnergy: { value: cityEnergy },
        uTimeOfDay: { value: 1.0 },
        uSnowIntensity: { value: weatherMode === "snowy" ? 1.0 : 0.0 },
      },
      vertexShader,
      fragmentShader,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update uniforms in-place when theme/atlas changes so the instancedMesh
  // is NOT recreated (which would lose all instance attributes).
  useEffect(() => {
    material.uniforms.uAtlas.value = atlasTexture;
    material.uniforms.uRoofColor.value.set(colors.roof);
    material.uniforms.uFaceColor.value.set(colors.face);
    material.uniforms.uDimOpacity.value = dimOpacity;
    material.uniforms.uDimEmissive.value = dimEmissive;
    material.uniforms.uCityEnergy.value = cityEnergy;
    material.uniforms.uSnowIntensity.value = weatherMode === "snowy" ? 1.0 : 0.0;
    material.needsUpdate = true;
  }, [atlasTexture, colors.roof, colors.face, dimOpacity, dimEmissive, cityEnergy, weatherMode, material]);

  const { uvFrontData, uvSideData, riseData, tintData, lcData } =
    useMemo(() => {
      const uvF = new Float32Array(count * 4);
      const uvS = new Float32Array(count * 4);
      const rise = new Float32Array(count);
      const tint = new Float32Array(count * 4);
      const lc = new Float32Array(count * 3);
      const _c = new THREE.Color();

      for (let i = 0; i < count; i++) {
        const b = buildings[i];
        const seed =
          b.login.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 137;

        const bandIndex = Math.min(
          5,
          Math.max(0, Math.round(b.litPercentage * 5)),
        );
        const bandRowOffset = bandIndex * ATLAS_BAND_ROWS;

        const frontColStart = Math.abs(
          seed % Math.max(1, ATLAS_COLS - b.windowsPerFloor),
        );
        uvF[i * 4 + 0] = frontColStart / ATLAS_COLS;
        uvF[i * 4 + 1] = bandRowOffset / ATLAS_COLS;
        uvF[i * 4 + 2] = b.windowsPerFloor / ATLAS_COLS;
        uvF[i * 4 + 3] = b.floors / ATLAS_COLS;

        const sideColStart = Math.abs(
          (seed + 7919) % Math.max(1, ATLAS_COLS - b.sideWindowsPerFloor),
        );
        uvS[i * 4 + 0] = sideColStart / ATLAS_COLS;
        uvS[i * 4 + 1] = bandRowOffset / ATLAS_COLS;
        uvS[i * 4 + 2] = b.sideWindowsPerFloor / ATLAS_COLS;
        uvS[i * 4 + 3] = b.floors / ATLAS_COLS;

        rise[i] = 0;

        if (b.custom_color) {
          _c.set(b.custom_color);
          tint[i * 4 + 0] = _c.r;
          tint[i * 4 + 1] = _c.g;
          tint[i * 4 + 2] = _c.b;
          tint[i * 4 + 3] = 1.0;
        } else {
          tint[i * 4 + 0] = 0;
          tint[i * 4 + 1] = 0;
          tint[i * 4 + 2] = 0;
          tint[i * 4 + 3] = 0;
        }

        lc[i * 3 + 0] = b.easy_solved || 0;
        lc[i * 3 + 1] = b.medium_solved || 0;
        lc[i * 3 + 2] = b.hard_solved || 0;
      }

      return {
        uvFrontData: uvF,
        uvSideData: uvS,
        riseData: rise,
        tintData: tint,
        lcData: lc,
      };
    }, [buildings, count]);

  const liveData = useMemo(() => new Float32Array(count), [count]);
  const risingRef = useRef<RiseState[]>([]);
  const riseInitialized = useRef(false);
  const holdRiseRef = useRef(holdRise);
  holdRiseRef.current = holdRise;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      _position.set(b.position[0], b.height / 2, b.position[2]);
      _scale.set(b.width, b.height, b.depth);
      _matrix.compose(_position, _quaternion, _scale);
      mesh.setMatrixAt(i, _matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    let maxDist = 0;
    let maxHeight = 0;
    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      const d = Math.sqrt(
        b.position[0] * b.position[0] + b.position[2] * b.position[2],
      );
      if (d > maxDist) maxDist = d;
      if (b.height > maxHeight) maxHeight = b.height;
    }
    const radius = Math.sqrt(maxDist * maxDist + maxHeight * maxHeight) + 100;
    
    // FIX: Increased bounding sphere radius by 50% to prevent buildings from being culled during fast camera movement
    const expandedRadius = radius * 1.5;
    mesh.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, maxHeight / 2, 0),
      expandedRadius,
    );
    mesh.boundingBox = null;

    const uvFrontAttr = new THREE.InstancedBufferAttribute(uvFrontData, 4);
    const uvSideAttr = new THREE.InstancedBufferAttribute(uvSideData, 4);
    const riseAttr = new THREE.InstancedBufferAttribute(riseData, 1);
    riseAttr.setUsage(THREE.DynamicDrawUsage);
    const tintAttr = new THREE.InstancedBufferAttribute(tintData, 4);
    const liveAttr = new THREE.InstancedBufferAttribute(liveData, 1);
    liveAttr.setUsage(THREE.DynamicDrawUsage);

    mesh.geometry.setAttribute("aUvFront", uvFrontAttr);
    mesh.geometry.setAttribute("aUvSide", uvSideAttr);
    mesh.geometry.setAttribute("aRise", riseAttr);
    mesh.geometry.setAttribute("aTint", tintAttr);
    mesh.geometry.setAttribute("aLive", liveAttr);
    mesh.geometry.setAttribute(
      "aLcStats",
      new THREE.InstancedBufferAttribute(lcData, 3),
    );

    if (hasPlayedRiseGlobal) {
      for (let i = 0; i < count; i++) riseData[i] = 1;
      riseAttr.needsUpdate = true;
      riseInitialized.current = true;
      risingRef.current = [];
    } else {
      hasPlayedRiseGlobal = true;
      riseInitialized.current = false;
      risingRef.current = [];
    }

    const safetyTimer = setTimeout(() => {
      const m = meshRef.current;
      if (!m) return;
      const attr = m.geometry.getAttribute("aRise") as
        | THREE.InstancedBufferAttribute
        | undefined;
      if (!attr) return;
      const arr = attr.array as Float32Array;
      let anyZero = false;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] < 0.99) {
          arr[i] = 1;
          anyZero = true;
        }
      }
      if (anyZero) {
        attr.needsUpdate = true;
        riseInitialized.current = true;
        risingRef.current = [];
      }
    }, 8000);

    mesh.count = count;
    return () => clearTimeout(safetyTimer);
  }, [
    buildings,
    count,
    uvFrontData,
    uvSideData,
    riseData,
    tintData,
    liveData,
    lcData,
  ]);

  const lastFogNear = useRef(0);
  const lastFogFar = useRef(0);
  const cityEnergyRef = useRef(cityEnergy);
  cityEnergyRef.current = cityEnergy;

  // Global Time Cycle Logic
  useFrame(({ scene, clock }) => {
    if (!material.uniforms) return;
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;

    const tVal = timeRef ? timeRef.current : 0.0;
    // Map cycle progress [0, 1] to uTimeOfDay [0, 1] using cosine curve
    const uTimeVal = (1.0 - Math.cos(tVal * 2.0 * Math.PI)) / 2.0;
    material.uniforms.uTimeOfDay.value = uTimeVal;

    const lastFogColorHex = material.uniforms.uFogColor.value.getHex();
    const currentFogHex = fog.color.getHex();
    if (fog.near !== lastFogNear.current || fog.far !== lastFogFar.current || currentFogHex !== lastFogColorHex) {
      material.uniforms.uFogColor.value.copy(fog.color);
      material.uniforms.uFogNear.value = fog.near;
      material.uniforms.uFogFar.value = fog.far;
      lastFogNear.current = fog.near;
      lastFogFar.current = fog.far;
    }

    const current = material.uniforms.uCityEnergy.value;
    const target = cityEnergyRef.current;
    if (Math.abs(current - target) > 0.001) {
      material.uniforms.uCityEnergy.value += (target - current) * 0.04;
    }
  });

  useEffect(() => {
    if (!material.uniforms) return;
    const idA = focusedBuilding
      ? loginToIdx.get(focusedBuilding.toLowerCase())
      : undefined;
    const idB = focusedBuildingB
      ? loginToIdx.get(focusedBuildingB.toLowerCase())
      : undefined;
    material.uniforms.uFocusedId.value = idA !== undefined ? idA : -1.0;
    material.uniforms.uFocusedIdB.value = idB !== undefined ? idB : -1.0;
  }, [focusedBuilding, focusedBuildingB, loginToIdx, material]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const liveAttr = mesh.geometry.getAttribute("aLive") as
      | THREE.InstancedBufferAttribute
      | undefined;
    if (!liveAttr) return;
    const arr = liveAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const login = buildings[i].login.toLowerCase();
      arr[i] = liveByLogin?.has(login)
        ? login === "ixotic27"
          ? 1.5
          : 1.0
        : 0.0;
    }
    liveAttr.needsUpdate = true;
  }, [liveByLogin, buildings, count]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (holdRiseRef.current) return;

    const now = clock.elapsedTime;
    if (!riseInitialized.current) {
      riseInitialized.current = true;
      const staggerDelay = Math.min(0.003, MAX_RISE_TOTAL / Math.max(1, count));
      const queue: RiseState[] = [];
      for (let i = 0; i < count; i++) {
        queue.push({ startTime: now + i * staggerDelay, idx: i });
      }
      risingRef.current = queue;
    }

    const rising = risingRef.current;
    if (rising.length === 0) return;

    const riseAttr = mesh.geometry.getAttribute(
      "aRise",
    ) as THREE.InstancedBufferAttribute;
    if (!riseAttr) return;
    const arr = riseAttr.array as Float32Array;

    let anyChanged = false;
    const nextRising: RiseState[] = [];

    for (let r = 0; r < rising.length; r++) {
      const state = rising[r];
      const elapsed = now - state.startTime;
      if (elapsed < 0) {
        for (let j = r; j < rising.length; j++) nextRising.push(rising[j]);
        break;
      }
      const progress = Math.min(1, elapsed / RISE_DURATION);
      const t = 1 - Math.pow(1 - progress, 3);
      arr[state.idx] = t;
      anyChanged = true;

      if (progress < 1) nextRising.push(state);
    }

    risingRef.current = nextRising;
    if (anyChanged) riseAttr.needsUpdate = true;
  });

  const { gl, camera } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerNDC = useRef(new THREE.Vector2());

  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;
  const onClickRef = useRef(onBuildingClick);
  onClickRef.current = onBuildingClick;
  const introRef = useRef(introMode);
  introRef.current = introMode;

  const tapRef = useRef<{
    time: number;
    id: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;

    const screenToNDC = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const raycastInstance = (
      clientX: number,
      clientY: number,
    ): number | null => {
      const mesh = meshRef.current;
      if (!mesh) return null;
      screenToNDC(clientX, clientY);
      raycasterRef.current.setFromCamera(pointerNDC.current, camera);
      const hits: THREE.Intersection[] = [];
      mesh.raycast(raycasterRef.current, hits);
      if (hits.length > 0) {
        hits.sort((a, b) => a.distance - b.distance);
        if (hits[0].instanceId !== undefined) return hits[0].instanceId;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (
        introRef.current ||
        wasAdPointerConsumed() ||
        (window as any).__spireClicked
      )
        return;
      const id = raycastInstance(e.clientX, e.clientY);
      if (id !== null && id < buildingsRef.current.length) {
        tapRef.current = {
          time: performance.now(),
          id,
          x: e.clientX,
          y: e.clientY,
        };
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const tap = tapRef.current;
      if (!tap) return;
      tapRef.current = null;

      const elapsed = performance.now() - tap.time;
      if (elapsed > 400) return;

      const dx = e.clientX - tap.x;
      const dy = e.clientY - tap.y;
      if (dx * dx + dy * dy > 625) return;

      if (tap.id < buildingsRef.current.length) {
        onClickRef.current?.(buildingsRef.current[tap.id]);
      }
    };

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let lastMoveTime = 0;
    const onPointerMove = isTouch
      ? null
      : (e: PointerEvent) => {
          if (introRef.current) {
            document.body.style.cursor = "auto";
            return;
          }
          if ((window as any).__spireCursor) return;
          const now = performance.now();
          if (now - lastMoveTime < 125) return;
          lastMoveTime = now;
          const id = raycastInstance(e.clientX, e.clientY);
          document.body.style.cursor = id !== null ? "pointer" : "auto";
        };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    if (onPointerMove) canvas.addEventListener("pointermove", onPointerMove);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      if (onPointerMove)
        canvas.removeEventListener("pointermove", onPointerMove);
      document.body.style.cursor = "auto";
    };
  }, [gl, camera]);

  useEffect(() => {
    return () => {
      geo.dispose();
      material.dispose();
    };
  }, [geo, material]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, material, count]}
      frustumCulled={false}
      receiveShadow={false}
      castShadow={false}
    />
  );
});