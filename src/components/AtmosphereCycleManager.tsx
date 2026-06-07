"use client";

import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

// Helper to interpolate two hex colors using THREE.Color
function lerpColor(c1: string, c2: string, alpha: number): string {
  const color1 = new THREE.Color(c1);
  const color2 = new THREE.Color(c2);
  color1.lerp(color2, alpha);
  return "#" + color1.getHexString();
}

interface AtmosphereState {
  fogColor: string;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  fillColor: string;
  fillIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  skyStops: string[]; // exactly 5 colors corresponding to stops [0, 0.25, 0.5, 0.75, 1.0]
  uTimeOfDay: number;
}

const ATMOSPHERE_STATES: AtmosphereState[] = [
  // 0: Midnight
  {
    fogColor: "#0a1428",
    ambientColor: "#304880",
    ambientIntensity: 0.18,
    sunColor: "#7090d0",
    sunIntensity: 0.25,
    fillColor: "#203060",
    fillIntensity: 0.15,
    hemiSky: "#305080",
    hemiGround: "#101828",
    hemiIntensity: 0.15,
    skyStops: ["#000206", "#020814", "#0a1428", "#0a1428", "#0a1428"],
    uTimeOfDay: 0.0,
  },
  // 1: Dawn
  {
    fogColor: "#4a2c3a",
    ambientColor: "#8a6a7c",
    ambientIntensity: 0.5,
    sunColor: "#ffcc88",
    sunIntensity: 0.7,
    fillColor: "#504070",
    fillIntensity: 0.3,
    hemiSky: "#9a6a8c",
    hemiGround: "#281e24",
    hemiIntensity: 0.45,
    skyStops: ["#080a15", "#d5836a", "#4a2c3a", "#4a2c3a", "#4a2c3a"],
    uTimeOfDay: 0.4,
  },
  // 2: Noon (Day)
  {
    fogColor: "#8cbeff",
    ambientColor: "#ffffff",
    ambientIntensity: 0.85,
    sunColor: "#fffcf0",
    sunIntensity: 1.3,
    fillColor: "#a0c0ff",
    fillIntensity: 0.4,
    hemiSky: "#a0c8ff",
    hemiGround: "#403830",
    hemiIntensity: 0.75,
    skyStops: ["#103ca0", "#2a68d0", "#8cbeff", "#8cbeff", "#8cbeff"],
    uTimeOfDay: 1.0,
  },
  // 3: Sunset
  {
    fogColor: "#602c40",
    ambientColor: "#d08060",
    ambientIntensity: 0.55,
    sunColor: "#f0a060",
    sunIntensity: 1.0,
    fillColor: "#503060",
    fillIntensity: 0.35,
    hemiSky: "#c06070",
    hemiGround: "#382028",
    hemiIntensity: 0.6,
    skyStops: ["#08040d", "#f0b878", "#602c40", "#602c40", "#602c40"],
    uTimeOfDay: 0.4,
  },
];

function getInterpolatedSkyStops(t: number): [number, string][] {
  const numStates = ATMOSPHERE_STATES.length;
  const val = t * numStates;
  const idx1 = Math.floor(val) % numStates;
  const idx2 = (idx1 + 1) % numStates;
  const f = val - Math.floor(val);

  const s1 = ATMOSPHERE_STATES[idx1];
  const s2 = ATMOSPHERE_STATES[idx2];

  const stops: [number, string][] = [];
  const stopValues = [0.0, 0.25, 0.5, 0.75, 1.0];
  for (let j = 0; j < 5; j++) {
    stops.push([
      stopValues[j],
      lerpColor(s1.skyStops[j], s2.skyStops[j], f),
    ]);
  }
  return stops;
}

// ─── Scene Background helper ──────────────────────────────────
function SceneBackground({ color }: { color: string }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(color);
  }, [color, scene]);
  return null;
}

// ─── Sky Dome Shader Definitions ──────────────────────────────
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
    // V coordinate from 0.0 (top, North Pole, dir.y = 1.0) to 1.0 (bottom, South Pole, dir.y = -1.0)
    float v = 0.5 - dir.y * 0.5;
    vec3 skyColor = getSkyColor(clamp(v, 0.0, 1.0));

    // Smoothly blend into the fog color near the horizon.
    float horizonBlend = 1.0 - smoothstep(-0.06, 0.18, dir.y);
    vec3 finalColor = mix(skyColor, uFogColor, horizonBlend);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ─── Dynamic Sky Dome ─────────────────────────────────────────
function SkyDome({
  timeRef,
  theme,
  active,
}: {
  timeRef: React.MutableRefObject<number>;
  theme: any;
  active: boolean;
}) {
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
        uFogColor: { value: new THREE.Color("#0a1428") },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    return { material, colors };
  }, []);

  useFrame(({ camera, scene }) => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }

    const { material, colors } = skyResources;

    // Dynamically update the fog color uniform from the scene fog in every frame
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      material.uniforms.uFogColor.value.copy(fog.color);
    }

    let currentStops: [number, string][];
    if (active) {
      currentStops = getInterpolatedSkyStops(timeRef.current);
    } else {
      currentStops = theme.sky;
    }

    // Set color uniforms dynamically on the GPU (100% shader interpolated, no textures!)
    for (let i = 0; i < 5; i++) {
      colors[i].set(currentStops[i][1]);
    }
  });

  useEffect(() => {
    return () => {
      skyResources.material.dispose();
    };
  }, [skyResources]);

  return (
    <mesh ref={meshRef} material={skyResources.material} renderOrder={-1}>
      <sphereGeometry args={[3500, 32, 48]} />
    </mesh>
  );
}

// ─── Cloud Data Interface ─────────────────────────────────────
interface CloudData {
  position: [number, number, number];
  speed: number;
  parts: { offset: [number, number, number]; scale: [number, number, number] }[];
}

// ─── Voxel Clouds Component ───────────────────────────────────
function VoxelClouds({
  active,
  timeRef,
}: {
  active: boolean;
  timeRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const clouds = useMemo(() => {
    const list: CloudData[] = [];
    // Spawn 20 clouds in a blocky retro configuration
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 3200;
      const y = 330 + Math.random() * 80;
      const z = (Math.random() - 0.5) * 3200;
      const speed = 8 + Math.random() * 12; // slowly drifting

      const w = 90 + Math.random() * 70;
      const h = 14 + Math.random() * 8;
      const d = 60 + Math.random() * 40;

      const parts = [
        { offset: [0, 0, 0] as [number, number, number], scale: [w, h, d] as [number, number, number] },
        { offset: [-w * 0.35, -h * 0.15, d * 0.1] as [number, number, number], scale: [w * 0.6, h * 0.7, d * 0.8] as [number, number, number] },
        { offset: [w * 0.35, -h * 0.1, -d * 0.1] as [number, number, number], scale: [w * 0.5, h * 0.8, d * 0.7] as [number, number, number] },
      ];

      list.push({ position: [x, y, z], speed, parts });
    }
    return list;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
  }, []);

  // Pre-allocate a single geometry instance to be shared across all cloud meshes!
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 1. Move and wrap clouds
    groupRef.current.children.forEach((cloudGroup: any, idx) => {
      const data = clouds[idx];
      if (!data) return;
      cloudGroup.position.x += data.speed * delta;
      // Infinite drift wrapping
      if (cloudGroup.position.x > 1800) {
        cloudGroup.position.x = -1800;
      }
    });

    // 2. Interpolate cloud colors matching Midnight -> Dawn -> Noon -> Sunset -> Midnight
    const t = active ? timeRef.current : 0.0;
    const numStates = ATMOSPHERE_STATES.length;
    const val = t * numStates;
    const idx1 = Math.floor(val) % numStates;
    const idx2 = (idx1 + 1) % numStates;
    const f = val - Math.floor(val);

    const cloudColors = ["#141c30", "#e8a898", "#ffffff", "#ff9070"];
    const currentColor = lerpColor(cloudColors[idx1], cloudColors[idx2], f);
    material.color.set(currentColor);
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
            <mesh key={pIdx} position={p.offset} scale={p.scale} geometry={boxGeo} material={material} />
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── Horizon Mist (Volumetric Ocean Fog) ──────────────────────


// ─── Ambient Ocean Ships Component ─────────────────────────────
interface ShipData {
  id: number;
  type: "cargo" | "cruise" | "speedboat";
  radius: number;
  angle: number;
  speed: number;
  scale: [number, number, number];
  hullColor: string;
  cabinColor: string;
}

function AmbientOceanShips({ cityRadius }: { cityRadius: number }) {
  const meshRef = useRef<THREE.Group>(null);

  const ships = useMemo(() => {
    const list: ShipData[] = [];
    let seed = 98765;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const colors = ["#2b3846", "#1a2530", "#3d2c1e", "#1b2d1c", "#2c3b2e", "#202a35"];
    const types: ("cargo" | "cruise" | "speedboat")[] = ["cargo", "cruise", "speedboat"];

    for (let i = 0; i < 18; i++) {
      const type = types[i % types.length];
      // Cruise in the open water further away from the city boundary!
      const radius = cityRadius * 1.45 + rng() * (cityRadius * 0.4);
      const angle = (i / 18) * Math.PI * 2 + rng() * 0.4;
      
      // Speedboats travel significantly faster!
      const speedMultiplier = type === "speedboat" ? 2.2 : 1.0;
      const speed = (0.008 + rng() * 0.012) * speedMultiplier;

      // Speedboats are smaller and sleeker; cargo and cruise are massive!
      let scaleVal = 35 + rng() * 20;
      if (type === "speedboat") {
        scaleVal = 16 + rng() * 8; // compact sleek speedboats
      }
      const scale: [number, number, number] = [scaleVal, scaleVal, scaleVal];
      
      const hullColor = type === "cruise" ? "#0f172a" : colors[i % colors.length];
      const cabinColor = "#f4ebd0";

      list.push({ id: i, type, radius, angle, speed, scale, hullColor, cabinColor });
    }
    return list;
  }, [cityRadius]);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 8), []);

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      cylinderGeo.dispose();
    };
  }, [boxGeo, cylinderGeo]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (!meshRef.current) return;

    meshRef.current.children.forEach((shipGroup: any, idx) => {
      const s = ships[idx];
      if (!s) return;

      // Circle around the city
      const currentAngle = s.angle + time * s.speed;
      const x = Math.cos(currentAngle) * s.radius;
      const z = Math.sin(currentAngle) * s.radius;

      // Cruising tangent direction for ship rotation
      const tx = -Math.sin(currentAngle);
      const tz = Math.cos(currentAngle);
      const yaw = Math.atan2(tx, tz);

      // Rocking motions optimized for size and style
      const bobMultiplier = s.type === "speedboat" ? 1.8 : 1.0;
      const pitchMultiplier = s.type === "speedboat" ? 2.5 : 1.0;
      
      const bobbing = (s.type === "speedboat" ? -20.0 : -23.5) + Math.sin(time * 0.8 * bobMultiplier + idx) * 0.6 * bobMultiplier;
      const pitch = Math.sin(time * 0.6 * pitchMultiplier + idx) * 0.02 * pitchMultiplier;
      const roll = Math.cos(time * 0.8 * pitchMultiplier + idx) * 0.03 * pitchMultiplier;

      shipGroup.position.set(x, bobbing, z);
      shipGroup.rotation.set(pitch, yaw, roll, "YXZ");
    });
  });

  return (
    <group ref={meshRef}>
      {ships.map((s) => (
        <group key={s.id} scale={s.scale}>
          {s.type === "cargo" && (
            <>
              {/* Hull - main ship body */}
              <mesh geometry={boxGeo} position={[0, 0.4, 0]} scale={[1.6, 0.8, 4.8]}>
                <meshStandardMaterial color={s.hullColor} roughness={0.8} metalness={0.1} />
              </mesh>
              {/* Stepped Voxel Bow - sharp, angled feel */}
              <mesh geometry={boxGeo} position={[0, 0.4, 2.7]} scale={[1.4, 0.8, 0.6]}>
                <meshStandardMaterial color={s.hullColor} roughness={0.8} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.4, 3.3]} scale={[1.0, 0.8, 0.6]}>
                <meshStandardMaterial color={s.hullColor} roughness={0.8} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.4, 3.9]} scale={[0.5, 0.8, 0.6]}>
                <meshStandardMaterial color={s.hullColor} roughness={0.8} />
              </mesh>
              {/* Stern / Transom step */}
              <mesh geometry={boxGeo} position={[0, 0.5, -2.5]} scale={[1.4, 0.6, 0.2]}>
                <meshStandardMaterial color="#1a2530" />
              </mesh>

              {/* White Cabin Tower at the back (Bridge) */}
              <mesh geometry={boxGeo} position={[0, 1.2, -1.2]} scale={[1.2, 0.8, 1.4]}>
                <meshStandardMaterial color="#f8fafc" roughness={0.5} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 1.8, -1.2]} scale={[1.2, 0.4, 1.0]}>
                <meshStandardMaterial color="#f8fafc" roughness={0.5} />
              </mesh>
              {/* Panoramic bridge window (glowing cyan or yellow) */}
              <mesh geometry={boxGeo} position={[0, 1.85, -0.68]} scale={[1.0, 0.2, 0.05]}>
                <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={2.5} toneMapped={false} />
              </mesh>
              
              {/* Mast / Radar Tower on top of cabin */}
              <mesh geometry={cylinderGeo} position={[0, 2.3, -1.2]} scale={[0.08, 0.6, 0.08]}>
                <meshStandardMaterial color="#475569" />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 2.6, -1.2]} scale={[0.6, 0.08, 0.08]}>
                <meshStandardMaterial color="#475569" />
              </mesh>
              {/* Rotating-style Radar scanner bar */}
              <mesh geometry={boxGeo} position={[0, 2.7, -1.2]} scale={[0.4, 0.06, 0.15]}>
                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.0} />
              </mesh>

              {/* Smokestack Pipe */}
              <mesh geometry={cylinderGeo} position={[0, 1.8, -1.7]} scale={[0.2, 0.8, 0.2]}>
                <meshStandardMaterial color="#dc2626" roughness={0.5} />
              </mesh>
              <mesh geometry={cylinderGeo} position={[0, 2.22, -1.7]} scale={[0.23, 0.1, 0.23]}>
                <meshStandardMaterial color="#1e293b" />
              </mesh>

              {/* Main Deck Crane for Cargo */}
              <mesh geometry={cylinderGeo} position={[0, 0.9, 0.8]} scale={[0.1, 0.4, 0.1]}>
                <meshStandardMaterial color="#eab308" />
              </mesh>
              <mesh geometry={cylinderGeo} position={[0, 1.1, 1.1]} scale={[0.08, 0.8, 0.08]} rotation={[0.5, 0, 0]}>
                <meshStandardMaterial color="#eab308" />
              </mesh>

              {/* Glowing Side Portholes (left side of hull) */}
              <mesh geometry={boxGeo} position={[0.81, 0.45, -1.8]} scale={[0.02, 0.12, 0.12]}>
                <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[0.81, 0.45, -0.8]} scale={[0.02, 0.12, 0.12]}>
                <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[0.81, 0.45, 0.2]} scale={[0.02, 0.12, 0.12]}>
                <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[0.81, 0.45, 1.2]} scale={[0.02, 0.12, 0.12]}>
                <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>

              {/* Glowing Side Portholes (right side of hull) */}
              <mesh geometry={boxGeo} position={[-0.81, 0.45, -1.8]} scale={[0.02, 0.12, 0.12]}>
                <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.81, 0.45, -0.8]} scale={[0.02, 0.12, 0.12]}>
                <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.81, 0.45, 0.2]} scale={[0.02, 0.12, 0.12]}>
                <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.81, 0.45, 1.2]} scale={[0.02, 0.12, 0.12]}>
                <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>

              {/* Detailed Cargo Containers on front/middle deck */}
              {/* Row 1 */}
              <mesh geometry={boxGeo} position={[0.35, 1.05, 0.2]} scale={[0.55, 0.5, 1.1]}>
                <meshStandardMaterial color="#ef4444" roughness={0.6} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.35, 1.05, 0.2]} scale={[0.55, 0.5, 1.1]}>
                <meshStandardMaterial color="#3b82f6" roughness={0.6} />
              </mesh>
              {/* Row 2 */}
              <mesh geometry={boxGeo} position={[0.35, 1.05, 1.4]} scale={[0.55, 0.5, 1.1]}>
                <meshStandardMaterial color="#10b981" roughness={0.6} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.35, 1.05, 1.4]} scale={[0.55, 0.5, 1.1]}>
                <meshStandardMaterial color="#f59e0b" roughness={0.6} />
              </mesh>
              {/* Stacking layer */}
              <mesh geometry={boxGeo} position={[0.2, 1.55, 0.2]} scale={[0.5, 0.5, 0.9]}>
                <meshStandardMaterial color="#8b5cf6" roughness={0.6} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.2, 1.55, 1.4]} scale={[0.5, 0.5, 0.9]}>
                <meshStandardMaterial color="#ec4899" roughness={0.6} />
              </mesh>
            </>
          )}

          {s.type === "cruise" && (
            <>
              {/* Hull - main ship body (dark charcoal bottom, white top strip) */}
              <mesh geometry={boxGeo} position={[0, 0.3, 0]} scale={[1.6, 0.6, 4.8]}>
                <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.3} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.7, 0]} scale={[1.6, 0.2, 4.8]}>
                <meshStandardMaterial color="#f8fafc" roughness={0.7} />
              </mesh>
              
              {/* Stepped Voxel Bow (Pointy but retro blocky) */}
              <mesh geometry={boxGeo} position={[0, 0.3, 2.7]} scale={[1.4, 0.6, 0.6]}>
                <meshStandardMaterial color="#0f172a" roughness={0.7} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.7, 2.7]} scale={[1.4, 0.2, 0.6]}>
                <meshStandardMaterial color="#f8fafc" roughness={0.7} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.3, 3.3]} scale={[1.0, 0.6, 0.6]}>
                <meshStandardMaterial color="#0f172a" roughness={0.7} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.7, 3.3]} scale={[1.0, 0.2, 0.6]}>
                <meshStandardMaterial color="#f8fafc" roughness={0.7} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.5, 3.9]} scale={[0.5, 0.8, 0.6]}>
                <meshStandardMaterial color="#0f172a" roughness={0.7} />
              </mesh>

              {/* Cruise Superstructure - Deck 1 */}
              <mesh geometry={boxGeo} position={[0, 1.0, -0.1]} scale={[1.4, 0.4, 3.4]}>
                <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
              </mesh>
              {/* Cruise Superstructure - Deck 2 */}
              <mesh geometry={boxGeo} position={[0, 1.4, -0.4]} scale={[1.3, 0.4, 2.6]}>
                <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
              </mesh>
              {/* Cruise Superstructure - Deck 3 (Bridge & Top Deck) */}
              <mesh geometry={boxGeo} position={[0, 1.8, -0.8]} scale={[1.1, 0.4, 1.6]}>
                <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
              </mesh>

              {/* Glowing passenger window bands on Deck 1 & 2 */}
              {/* Left Side */}
              <mesh geometry={boxGeo} position={[0.71, 1.0, -0.1]} scale={[0.02, 0.15, 2.8]}>
                <meshStandardMaterial color="#fef08a" emissive="#fbbf24" emissiveIntensity={2.5} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[0.66, 1.4, -0.4]} scale={[0.02, 0.15, 2.0]}>
                <meshStandardMaterial color="#fef08a" emissive="#fbbf24" emissiveIntensity={2.5} toneMapped={false} />
              </mesh>
              {/* Right Side */}
              <mesh geometry={boxGeo} position={[-0.71, 1.0, -0.1]} scale={[0.02, 0.15, 2.8]}>
                <meshStandardMaterial color="#fef08a" emissive="#fbbf24" emissiveIntensity={2.5} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.66, 1.4, -0.4]} scale={[0.02, 0.15, 2.0]}>
                <meshStandardMaterial color="#fef08a" emissive="#fbbf24" emissiveIntensity={2.5} toneMapped={false} />
              </mesh>

              {/* Panoramic Bridge Windows */}
              <mesh geometry={boxGeo} position={[0, 1.85, 0.01]} scale={[0.8, 0.18, 0.05]}>
                <meshStandardMaterial color="#0284c7" emissive="#0ea5e9" emissiveIntensity={2.0} toneMapped={false} />
              </mesh>

              {/* Swimming Pool on Top Deck (Deck 2 front open space) */}
              <mesh geometry={boxGeo} position={[0, 1.21, 1.0]} scale={[0.6, 0.02, 0.8]}>
                <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={1.5} roughness={0.1} toneMapped={false} />
              </mesh>
              {/* Swimming Pool Rim/Deck Chairs representation */}
              <mesh geometry={boxGeo} position={[0.4, 1.25, 1.0]} scale={[0.1, 0.08, 0.2]}>
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.4, 1.25, 1.0]} scale={[0.1, 0.08, 0.2]}>
                <meshStandardMaterial color="#ffffff" />
              </mesh>

              {/* Twin Red-and-Black Funnels (angled) */}
              <mesh geometry={cylinderGeo} position={[0, 2.3, -1.3]} scale={[0.18, 0.6, 0.18]} rotation={[-0.15, 0, 0]}>
                <meshStandardMaterial color="#ef4444" roughness={0.5} />
              </mesh>
              <mesh geometry={cylinderGeo} position={[0, 2.62, -1.35]} scale={[0.2, 0.1, 0.2]} rotation={[-0.15, 0, 0]}>
                <meshStandardMaterial color="#1e293b" />
              </mesh>

              <mesh geometry={cylinderGeo} position={[0, 2.2, -0.8]} scale={[0.18, 0.5, 0.18]} rotation={[-0.15, 0, 0]}>
                <meshStandardMaterial color="#ef4444" roughness={0.5} />
              </mesh>
              <mesh geometry={cylinderGeo} position={[0, 2.47, -0.84]} scale={[0.2, 0.1, 0.2]} rotation={[-0.15, 0, 0]}>
                <meshStandardMaterial color="#1e293b" />
              </mesh>

              {/* Orange Lifeboats hanging on sides */}
              <mesh geometry={boxGeo} position={[0.73, 1.0, -1.0]} scale={[0.14, 0.14, 0.4]}>
                <meshStandardMaterial color="#f97316" roughness={0.5} />
              </mesh>
              <mesh geometry={boxGeo} position={[0.73, 1.0, 0.2]} scale={[0.14, 0.14, 0.4]}>
                <meshStandardMaterial color="#f97316" roughness={0.5} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.73, 1.0, -1.0]} scale={[0.14, 0.14, 0.4]}>
                <meshStandardMaterial color="#f97316" roughness={0.5} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.73, 1.0, 0.2]} scale={[0.14, 0.14, 0.4]}>
                <meshStandardMaterial color="#f97316" roughness={0.5} />
              </mesh>

              {/* Rear Mast / Flag pole */}
              <mesh geometry={cylinderGeo} position={[0, 1.2, -1.7]} scale={[0.04, 0.8, 0.04]} rotation={[-0.3, 0, 0]}>
                <meshStandardMaterial color="#64748b" />
              </mesh>
            </>
          )}

          {s.type === "speedboat" && (
            <>
              {/* Hull - main speedboat body (sporty V shape) */}
              <mesh geometry={boxGeo} position={[0, 0.25, 0]} scale={[1.1, 0.5, 3.2]}>
                <meshStandardMaterial color={s.hullColor} metalness={0.7} roughness={0.2} />
              </mesh>
              
              {/* Aggressive wedge pointed front */}
              <mesh geometry={boxGeo} position={[0, 0.25, 1.8]} scale={[0.9, 0.5, 0.4]}>
                <meshStandardMaterial color={s.hullColor} metalness={0.7} roughness={0.2} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.25, 2.1]} scale={[0.54, 0.5, 0.3]}>
                <meshStandardMaterial color={s.hullColor} metalness={0.7} roughness={0.2} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.2, 2.35]} scale={[0.27, 0.4, 0.25]}>
                <meshStandardMaterial color={s.hullColor} metalness={0.7} roughness={0.2} />
              </mesh>

              {/* Colored sporty trim line along the side */}
              <mesh geometry={boxGeo} position={[0.56, 0.35, 0]} scale={[0.02, 0.08, 3.0]}>
                <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.8} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.56, 0.35, 0]} scale={[0.02, 0.08, 3.0]}>
                <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.8} />
              </mesh>

              {/* Open Cockpit with Brown Leather Seats */}
              {/* Floor cutout feel */}
              <mesh geometry={boxGeo} position={[0, 0.51, -0.2]} scale={[0.8, 0.02, 1.2]}>
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              {/* Seats */}
              <mesh geometry={boxGeo} position={[0.22, 0.6, 0.1]} scale={[0.3, 0.25, 0.3]}>
                <meshStandardMaterial color="#7c2d12" roughness={0.7} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.22, 0.6, 0.1]} scale={[0.3, 0.25, 0.3]}>
                <meshStandardMaterial color="#7c2d12" roughness={0.7} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.55, -0.6]} scale={[0.74, 0.25, 0.3]}>
                <meshStandardMaterial color="#7c2d12" roughness={0.7} />
              </mesh>

              {/* Curved/Slanted Sci-Fi Windshield */}
              <mesh geometry={boxGeo} position={[0, 0.68, 0.38]} scale={[0.84, 0.3, 0.6]} rotation={[-0.35, 0, 0]}>
                <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={2.5} transparent opacity={0.75} toneMapped={false} />
              </mesh>

              {/* Sporty Rear Spoiler Wing */}
              <mesh geometry={boxGeo} position={[0.4, 0.6, -1.2]} scale={[0.06, 0.4, 0.12]} rotation={[0.2, 0, 0]}>
                <meshStandardMaterial color="#0f172a" />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.4, 0.6, -1.2]} scale={[0.06, 0.4, 0.12]} rotation={[0.2, 0, 0]}>
                <meshStandardMaterial color="#0f172a" />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.8, -1.2]} scale={[0.9, 0.06, 0.25]}>
                <meshStandardMaterial color="#ef4444" />
              </mesh>

              {/* Outboard Engines at the back */}
              <mesh geometry={boxGeo} position={[0.25, 0.2, -1.68]} scale={[0.2, 0.4, 0.2]}>
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.25, 0.2, -1.68]} scale={[0.2, 0.4, 0.2]}>
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              {/* Dual Glowing Cyan Engine Exhaust / Thruster nozzle */}
              <mesh geometry={boxGeo} position={[0.25, 0.15, -1.8]} scale={[0.12, 0.12, 0.05]}>
                <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={3.0} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.25, 0.15, -1.8]} scale={[0.12, 0.12, 0.05]}>
                <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={3.0} toneMapped={false} />
              </mesh>

              {/* Sporty Chrome Flagpole with Neon Flag */}
              <mesh geometry={cylinderGeo} position={[0, 0.6, -1.0]} scale={[0.02, 0.7, 0.02]} rotation={[0.2, 0, 0]}>
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.85, -1.1]} scale={[0.02, 0.12, 0.25]}>
                <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.5} />
              </mesh>

              {/* Dual Headlights on the Bow */}
              <mesh geometry={cylinderGeo} position={[0.28, 0.35, 2.0]} scale={[0.08, 0.03, 0.08]} rotation={[Math.PI / 2, 0, 0.2]}>
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4.0} toneMapped={false} />
              </mesh>
              <mesh geometry={cylinderGeo} position={[-0.28, 0.35, 2.0]} scale={[0.08, 0.03, 0.08]} rotation={[Math.PI / 2, 0, -0.2]}>
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4.0} toneMapped={false} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

// ─── Flying City Ships (Sci-Fi Hovering Skyships inside the city) ──────────────────────
interface FlyingShipData {
  id: number;
  type: "cargo" | "yacht" | "patrol" | "taxi" | "airplane";
  pathType: "circle" | "line";
  radius: number;
  angle: number;
  speed: number;
  altitude: number;
  direction: number;
  lineStart: number;
  lineEnd: number;
  lineOffset: number;
  scale: [number, number, number];
  color: string;
  glowColor: string;
  hasBanner?: boolean;
  bannerResources?: {
    tex: THREE.CanvasTexture;
  };
}

function createMiniLedTexture(text: string, color: string, bgColor: string) {
  if (typeof document === "undefined") {
    return { tex: new THREE.Texture() as THREE.CanvasTexture };
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 48);

  ctx.fillStyle = color;
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 24);

  // Simple dot grid overlay
  ctx.fillStyle = "#000000";
  ctx.globalAlpha = 0.45;
  for (let x = 3; x < 256; x += 4) ctx.fillRect(x, 0, 1, 48);
  for (let y = 3; y < 48; y += 4) ctx.fillRect(0, y, 256, 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return { tex };
}

function FlyingAirplane({ s }: { s: FlyingShipData }) {
  const { scene } = useGLTF("/models/paper-plane.glb");
  const clonedScene = useMemo(() => {
    return scene.clone();
  }, [scene]);

  return (
    <group scale={[1.0, 1.0, 1.0]} rotation={[0, Math.PI / 2, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function FlyingCityShips({ cityRadius }: { cityRadius: number }) {
  const groupRef = useRef<THREE.Group>(null);

  const ships = useMemo(() => {
    const list: FlyingShipData[] = [];
    let seed = 12345;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const types: ("cargo" | "yacht" | "patrol" | "taxi")[] = ["cargo", "yacht", "patrol", "taxi"];
    const colors = ["#ef4444", "#e2e8f0", "#1d4ed8", "#facc15"];
    const glows = ["#ff5030", "#38bdf8", "#3b82f6", "#eab308"];
    const bannerTexts = [
      "KEEP CODING ★",
      "COMMIT DAILY ★",
      "BUG FREE ZONE",
      "LEETCODE CITY",
      "HELLO WORLD!",
      "GIT PUSH ★",
      "DEV AT WORK",
      "NEVER GIVE UP"
    ];

    for (let i = 0; i < 16; i++) {
      const hasBanner = (i % 4 === 0);
      const type = hasBanner ? "airplane" : types[i % types.length];
      const pathType = rng() > 0.55 ? "circle" : "line";
      const radius = cityRadius * (0.22 + rng() * 0.65); // inside the circular city
      const angle = rng() * Math.PI * 2;
      const speed = 25 + rng() * 30; // cruising speed inside the city
      const altitude = hasBanner ? (235 + rng() * 75) : (110 + rng() * 140); // fly gracefully above buildings for airplanes
      const direction = rng() > 0.5 ? 1 : -1;

      const lineStart = -cityRadius * 0.85;
      const lineEnd = cityRadius * 0.85;
      const lineOffset = (rng() - 0.5) * cityRadius * 1.4;

      const scaleVal = hasBanner ? (6.5 + rng() * 2.5) : (2.4 + rng() * 1.6); // bigger/prominent for airplanes
      const scale: [number, number, number] = [scaleVal, scaleVal, scaleVal];

      let bannerResources;
      if (hasBanner) {
        const text = bannerTexts[(i / 4) % bannerTexts.length];
        bannerResources = createMiniLedTexture(text, glows[i % glows.length], "#100c14");
      }

      list.push({
        id: i,
        type,
        pathType,
        radius,
        angle,
        speed,
        altitude,
        direction,
        lineStart,
        lineEnd,
        lineOffset,
        scale,
        color: colors[i % colors.length],
        glowColor: glows[i % glows.length],
        hasBanner,
        bannerResources,
      });
    }
    return list;
  }, [cityRadius]);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const coneGeo = useMemo(() => new THREE.ConeGeometry(0.5, 1, 4), []);
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 6), []);

  useEffect(() => {
    return () => {
      ships.forEach((s) => {
        if (s.bannerResources && s.bannerResources.tex) {
          s.bannerResources.tex.dispose();
        }
      });
      boxGeo.dispose();
      coneGeo.dispose();
      cylinderGeo.dispose();
    };
  }, [ships, boxGeo, coneGeo, cylinderGeo]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    if (!groupRef.current) return;

    groupRef.current.children.forEach((shipGroup: any, idx) => {
      const s = ships[idx];
      if (!s) return;

      if (s.pathType === "circle") {
        const angularSpeed = (s.speed / s.radius) * s.direction;
        const currentAngle = s.angle + time * angularSpeed;
        const x = Math.cos(currentAngle) * s.radius;
        const z = Math.sin(currentAngle) * s.radius;

        const tx = -Math.sin(currentAngle) * s.direction;
        const tz = Math.cos(currentAngle) * s.direction;
        const yaw = (s.type === "airplane") ? Math.atan2(-tx, -tz) : Math.atan2(tx, tz);

        const bobbing = s.altitude + Math.sin(time * 1.5 + idx) * 1.5;

        shipGroup.position.set(x, bobbing, z);
        shipGroup.rotation.set(0, yaw, 0);
      } else {
        const pathLength = s.lineEnd - s.lineStart;
        const progress = ((time * s.speed + idx * 75) % pathLength) / pathLength;
        const mainCoord = s.lineStart + progress * pathLength;

        let x = 0, z = 0, yaw = 0;
        if (idx % 2 === 0) {
          x = mainCoord;
          z = s.lineOffset;
          yaw = (s.type === "airplane") ? -Math.PI / 2 : Math.PI / 2;
        } else {
          x = s.lineOffset;
          z = mainCoord;
          yaw = (s.type === "airplane") ? Math.PI : 0;
        }

        const bobbing = s.altitude + Math.sin(time * 1.2 + idx) * 1.0;
        shipGroup.position.set(x, bobbing, z);
        shipGroup.rotation.set(0, yaw, 0);
      }

      // Animate police flashing lights
      if (s.type === "patrol") {
        const flash = Math.floor(time * 6) % 2 === 0;
        shipGroup.children.forEach((child: any) => {
          if (child.name === "light-red" && child.material) {
            child.material.color.set(flash ? "#ef4444" : "#1e293b");
            child.material.emissive.set(flash ? "#ef4444" : "#000000");
          } else if (child.name === "light-blue" && child.material) {
            child.material.color.set(!flash ? "#3b82f6" : "#1e293b");
            child.material.emissive.set(!flash ? "#3b82f6" : "#000000");
          }
        });
      }
    });
  });

  return (
    <group ref={groupRef}>
      {ships.map((s) => (
        <group key={s.id} scale={s.scale}>
          {s.type === "cargo" && (
            <>
              {/* Main Cargo Container Body */}
              <mesh geometry={boxGeo} position={[0, 0, 0]} scale={[1.2, 0.8, 3.5]}>
                <meshStandardMaterial color={s.color} roughness={0.6} />
              </mesh>
              {/* Stacked Cargo Boxes on top */}
              <mesh geometry={boxGeo} position={[0, 0.6, 0.3]} scale={[0.9, 0.5, 0.9]}>
                <meshStandardMaterial color="#3b82f6" roughness={0.7} />
              </mesh>
              <mesh geometry={boxGeo} position={[0, 0.6, -0.7]} scale={[0.8, 0.4, 0.8]}>
                <meshStandardMaterial color="#10b981" roughness={0.7} />
              </mesh>
              {/* Thruster pods on sides */}
              <mesh geometry={boxGeo} position={[0.75, -0.1, 0.5]} scale={[0.3, 0.4, 1.2]}>
                <meshStandardMaterial color="#4b5563" />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.75, -0.1, 0.5]} scale={[0.3, 0.4, 1.2]}>
                <meshStandardMaterial color="#4b5563" />
              </mesh>
              {/* Thruster exhaust glow */}
              <mesh geometry={boxGeo} position={[0.75, -0.1, -0.15]} scale={[0.2, 0.2, 0.1]}>
                <meshStandardMaterial color={s.glowColor} emissive={s.glowColor} emissiveIntensity={2.5} toneMapped={false} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.75, -0.1, -0.15]} scale={[0.2, 0.2, 0.1]}>
                <meshStandardMaterial color={s.glowColor} emissive={s.glowColor} emissiveIntensity={2.5} toneMapped={false} />
              </mesh>
            </>
          )}

          {s.type === "yacht" && (
            <>
              {/* Sleek Aerodynamic Yacht Nose */}
              <mesh geometry={coneGeo} position={[0, 0, 1.0]} scale={[1.2, 3.0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color={s.color} metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Main Yacht Cabin */}
              <mesh geometry={boxGeo} position={[0, 0.1, -1.0]} scale={[1.2, 0.7, 2.0]}>
                <meshStandardMaterial color={s.color} metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Slanted Yacht Wing Fins */}
              <mesh geometry={boxGeo} position={[0.9, -0.1, -1.2]} scale={[0.8, 0.1, 0.8]} rotation={[0, 0, 0.2]}>
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.9, -0.1, -1.2]} scale={[0.8, 0.1, 0.8]} rotation={[0, 0, -0.2]}>
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              {/* Glowing Panoramic Yacht Windshield */}
              <mesh geometry={boxGeo} position={[0, 0.35, 0.1]} scale={[0.9, 0.3, 0.6]} rotation={[-0.2, 0, 0]}>
                <meshStandardMaterial color={s.glowColor} emissive={s.glowColor} emissiveIntensity={2.0} transparent opacity={0.85} toneMapped={false} />
              </mesh>
            </>
          )}

          {s.type === "patrol" && (
            <>
              {/* Compact Heavy Patrol Body */}
              <mesh geometry={boxGeo} position={[0, 0, 0]} scale={[1.3, 0.9, 2.2]}>
                <meshStandardMaterial color={s.color} roughness={0.4} />
              </mesh>
              {/* Upper Cockpit */}
              <mesh geometry={boxGeo} position={[0, 0.6, 0.2]} scale={[0.8, 0.4, 1.0]}>
                <meshStandardMaterial color="#0f172a" roughness={0.2} />
              </mesh>
              {/* Flashing Police Red and Blue Lightbars */}
              <mesh name="light-red" geometry={cylinderGeo} position={[0.3, 0.85, 0.2]} scale={[0.15, 0.1, 0.15]}>
                <meshStandardMaterial
                  color="#1e293b"
                  emissive="#000000"
                  emissiveIntensity={3.0}
                  toneMapped={false}
                />
              </mesh>
              <mesh name="light-blue" geometry={cylinderGeo} position={[-0.3, 0.85, 0.2]} scale={[0.15, 0.1, 0.15]}>
                <meshStandardMaterial
                  color="#1e293b"
                  emissive="#000000"
                  emissiveIntensity={3.0}
                  toneMapped={false}
                />
              </mesh>
              {/* Front searchlight beam cone removed */}
            </>
          )}

          {s.type === "taxi" && (
            <>
              {/* Dual-Pod Speeder Hull */}
              <mesh geometry={boxGeo} position={[0.35, 0, 0]} scale={[0.45, 0.5, 1.8]}>
                <meshStandardMaterial color={s.color} roughness={0.5} />
              </mesh>
              <mesh geometry={boxGeo} position={[-0.35, 0, 0]} scale={[0.45, 0.5, 1.8]}>
                <meshStandardMaterial color="#505050" roughness={0.5} />
              </mesh>
              {/* Connecting Central Wing bridge */}
              <mesh geometry={boxGeo} position={[0, 0.05, -0.2]} scale={[0.4, 0.12, 1.0]}>
                <meshStandardMaterial color="#334155" />
              </mesh>
              {/* Dual Headlights */}
              <mesh geometry={cylinderGeo} position={[0.35, 0, 0.95]} scale={[0.12, 0.05, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3.0} toneMapped={false} />
              </mesh>
              <mesh geometry={cylinderGeo} position={[-0.35, 0, 0.95]} scale={[0.12, 0.05, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3.0} toneMapped={false} />
              </mesh>
            </>
          )}

          {s.type === "airplane" && (
            <FlyingAirplane s={s} />
          )}

          {/* Towable dynamic LED banner inside the city! */}
          {s.hasBanner && s.bannerResources && (
            <group position={[0, -0.25, 3.0]}>
              {/* Left & Right Tow Ropes */}
              <mesh position={[0.3, 0.1, -0.7]} rotation={[-Math.PI / 2, 0, 0.1]} geometry={cylinderGeo} scale={[0.03, 1.4, 0.03]}>
                <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
              </mesh>
              <mesh position={[-0.3, 0.1, -0.7]} rotation={[-Math.PI / 2, 0, -0.1]} geometry={cylinderGeo} scale={[0.03, 1.4, 0.03]}>
                <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
              </mesh>
              {/* LED Banner Plane - Side 1 */}
              <mesh position={[0, 0, 0.1]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[3.7, 0.7]} />
                <meshStandardMaterial
                  color="#000000"
                  emissiveMap={s.bannerResources.tex}
                  emissive="#ffffff"
                  emissiveIntensity={1.8}
                  toneMapped={false}
                />
              </mesh>
              {/* LED Banner Plane - Side 2 */}
              <mesh position={[0, 0, 0.1]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[3.7, 0.7]} />
                <meshStandardMaterial
                  color="#000000"
                  emissiveMap={s.bannerResources.tex}
                  emissive="#ffffff"
                  emissiveIntensity={1.8}
                  toneMapped={false}
                />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

// ─── Moon Glow Shaders ───────────────────────────────────────
const moonVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const moonFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float intensity = dot(normal, viewDir);
    intensity = clamp(intensity, 0.0, 1.0);
    
    vec3 coreColor = vec3(1.0, 1.0, 1.0);
    vec3 edgeColor = vec3(0.85, 0.92, 1.0);
    
    float factor = pow(intensity, 1.5);
    vec3 finalColor = mix(edgeColor, coreColor, factor);
    
    float glow = pow(1.0 - intensity, 2.5);
    vec3 glowColor = vec3(0.6, 0.8, 1.0);
    
    vec3 color = finalColor + glowColor * glow * 0.4;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const moonGlowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const moonGlowFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    float intensity = max(dot(normal, viewDir), 0.0);
    // Smooth corona halo: peaks near the inner sphere boundary and fades to 0 at the outer edge
    float glow = pow(1.0 - intensity, 2.0) * intensity * 3.0;
    vec3 glowColor = vec3(0.8, 0.92, 1.0);
    
    gl_FragColor = vec4(glowColor, glow * 0.5);
  }
`;

// ─── Sun Shaders ─────────────────────────────────────────────
const sunVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const sunFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float intensity = dot(normal, viewDir);
    intensity = clamp(intensity, 0.0, 1.0);
    
    // Warm sun colors: bright white/yellow core, deep gold/orange edge
    vec3 coreColor = vec3(1.0, 0.98, 0.9);
    vec3 edgeColor = vec3(1.0, 0.65, 0.1);
    
    float factor = pow(intensity, 1.5);
    vec3 finalColor = mix(edgeColor, coreColor, factor);
    
    // Fresnel rim glow
    float glow = pow(1.0 - intensity, 2.5);
    vec3 glowColor = vec3(1.0, 0.5, 0.0);
    
    vec3 color = finalColor + glowColor * glow * 0.4;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const sunGlowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const sunGlowFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    float intensity = max(dot(normal, viewDir), 0.0);
    // Smooth corona halo: peaks near the inner sphere boundary and fades to 0 at the outer edge
    float glow = pow(1.0 - intensity, 2.0) * intensity * 3.0;
    vec3 glowColor = vec3(1.0, 0.63, 0.1);
    
    gl_FragColor = vec4(glowColor, glow * 0.5);
  }
`;

// ─── Starfield Component ───────────────────────────────────────
function Starfield({ timeRef, active }: { timeRef: React.MutableRefObject<number>; active: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, sizes, phases } = useMemo(() => {
    const count = 400;
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const ph = new Float32Array(count);

    const radius = 3400;
    for (let i = 0; i < count; i++) {
      // Spherical coordinates
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      // Bias phi to keep stars in the upper sky (Y >= 0)
      const phi = Math.acos(v) * 0.9; 

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y; 
      pos[i * 3 + 2] = z;

      sz[i] = 2.0 + Math.random() * 3.0; // star sizes
      ph[i] = Math.random() * Math.PI * 2.0; // random phase for twinkling
    }

    return { positions: pos, sizes: sz, phases: ph };
  }, []);

  const starShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uNightFactor;
        attribute float aSize;
        attribute float aPhase;
        varying float vOpacity;

        void main() {
          // Twinkle effect
          float twinkle = 0.5 + 0.5 * sin(uTime * 2.5 + aPhase);
          vOpacity = uNightFactor * twinkle;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vOpacity;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          if (length(coord) > 0.5) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, vOpacity);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uNightFactor: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => {
      starShader.dispose();
    };
  }, [starShader]);

  useFrame((state) => {
    const { camera, clock } = state;
    if (pointsRef.current) {
      pointsRef.current.position.copy(camera.position);
    }

    const t = active ? timeRef.current : 0.0;
    let nightFactor = 0;
    if (t < 0.25) {
      nightFactor = 1.0 - (t / 0.25);
    } else if (t > 0.75) {
      nightFactor = (t - 0.75) / 0.25;
    }

    starShader.uniforms.uTime.value = clock.getElapsedTime();
    starShader.uniforms.uNightFactor.value = nightFactor;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <primitive object={starShader} attach="material" />
    </points>
  );
}

// ─── VolumetricMoonRays Component ─────────────────────────────
function VolumetricMoonRays({ moonGroupRef }: { moonGroupRef: React.RefObject<THREE.Group | null> }) {
  return null;
}

// ─── MoonLensFlare Component ──────────────────────────────────
function MoonLensFlare({ moonGroupRef }: { moonGroupRef: React.RefObject<THREE.Group | null> }) {
  const flareRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!flareRef.current || !moonGroupRef.current) return;
    
    if (!moonGroupRef.current.visible) {
      flareRef.current.visible = false;
      return;
    }

    // Project the moon coordinates into clip-space coordinates
    const projPos = moonGroupRef.current.position.clone().project(camera);
    const isBehindCamera = projPos.z > 1;

    if (isBehindCamera) {
      flareRef.current.visible = false;
      return;
    }

    flareRef.current.visible = true;
    
    // Position individual flare rings across the screen vector
    const children = flareRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as THREE.Mesh;
      const offsetFactor = (i - children.length / 2) * 0.25;
      child.position.set(projPos.x * offsetFactor * 200, projPos.y * offsetFactor * 200, 0);
    }
  });

  return (
    <group ref={flareRef}>
      {/* Primary Optic Element */}
      <mesh frustumCulled={false}>
        <ringGeometry args={[0, 9, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthTest={false} />
      </mesh>
      {/* Secondary Diffused Halos */}
      <mesh scale={2.5} frustumCulled={false}>
        <ringGeometry args={[6, 8, 32]} />
        <meshBasicMaterial color="#d0e5ff" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthTest={false} />
      </mesh>
      <mesh scale={4.0} frustumCulled={false}>
        <ringGeometry args={[11, 12, 32]} />
        <meshBasicMaterial color="#aaccff" transparent opacity={0.03} blending={THREE.AdditiveBlending} depthTest={false} />
      </mesh>
    </group>
  );
}

// ─── AtmosphereCycleManager Component ─────────────────────────────
interface AtmosphereCycleManagerProps {
  theme: any;
  themeIndex: number;
  active: boolean;
  timeRef: React.MutableRefObject<number>;
  cityRadius?: number;
  weatherMode?: "sunny" | "rainy" | "windy" | "stormy" | "snowy";
}

export default function AtmosphereCycleManager({
  theme,
  themeIndex,
  active,
  timeRef,
  cityRadius,
  weatherMode = "sunny",
}: AtmosphereCycleManagerProps) {
  const { scene } = useThree();

  const moonMaterials = useMemo(() => {
    const body = new THREE.ShaderMaterial({
      vertexShader: moonVertexShader,
      fragmentShader: moonFragmentShader,
      fog: false,
    });
    const glow = new THREE.ShaderMaterial({
      vertexShader: moonGlowVertexShader,
      fragmentShader: moonGlowFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    return { body, glow };
  }, []);

  useEffect(() => {
    return () => {
      moonMaterials.body.dispose();
      moonMaterials.glow.dispose();
    };
  }, [moonMaterials]);

  const sunMaterials = useMemo(() => {
    const body = new THREE.ShaderMaterial({
      vertexShader: sunVertexShader,
      fragmentShader: sunFragmentShader,
      fog: false,
    });
    const glow = new THREE.ShaderMaterial({
      vertexShader: sunGlowVertexShader,
      fragmentShader: sunGlowFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    return { body, glow };
  }, []);

  useEffect(() => {
    return () => {
      sunMaterials.body.dispose();
      sunMaterials.glow.dispose();
    };
  }, [sunMaterials]);

  const fogRef = useRef<THREE.Fog>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);

  const sunGroupRef = useRef<THREE.Group>(null);
  const moonGroupRef = useRef<THREE.Group>(null);
  const boltGroupRef = useRef<THREE.Group>(null);
  const boltRef = useRef({
    visible: false,
    startX: 0,
    startZ: 0,
    dx1: 0,
    dz1: 0,
    dx2: 0,
    dz2: 0,
  });

  // Lightning state inside AtmosphereCycleManager
  const lightningTimeRef = useRef(0);
  const nextLightningTimeRef = useRef(4 + Math.random() * 8); // strike every 4-12 seconds
  const lightningIntensityRef = useRef(0);

  // Time loop (7 minutes full cycle with extended day and same night)
  useFrame((state, delta) => {
    const { clock, camera } = state;
    let t = 0.0;

    // Simulate Thunderstorm Lightning Flashes
    let lightningIntensity = 0;
    if (weatherMode === "stormy" && active) {
      lightningTimeRef.current += delta;
      if (lightningTimeRef.current >= nextLightningTimeRef.current) {
        lightningTimeRef.current = 0;
        nextLightningTimeRef.current = 5 + Math.random() * 8; // strike every 5-13 seconds
        
        // Generate new procedural jagged lightning bolt path
        boltRef.current = {
          visible: true,
          startX: (Math.random() - 0.5) * (cityRadius ?? 800) * 1.5,
          startZ: (Math.random() - 0.5) * (cityRadius ?? 800) * 1.5,
          dx1: (Math.random() - 0.5) * 140 + (Math.random() > 0.5 ? 60 : -60),
          dz1: (Math.random() - 0.5) * 140 + (Math.random() > 0.5 ? 60 : -60),
          dx2: (Math.random() - 0.5) * 140 + (Math.random() > 0.5 ? 60 : -60),
          dz2: (Math.random() - 0.5) * 140 + (Math.random() > 0.5 ? 60 : -60),
        };
      }
      
      const elapsed = lightningTimeRef.current;
      // Real lightning double strike/flicker
      if (elapsed < 0.08) {
        lightningIntensity = 3.8;
      } else if (elapsed < 0.15) {
        lightningIntensity = 0.5;
      } else if (elapsed < 0.25) {
        lightningIntensity = 4.8;
      } else if (elapsed < 0.5) {
        lightningIntensity = 4.8 * (1.0 - (elapsed - 0.25) / 0.25);
      }
      lightningIntensityRef.current = lightningIntensity;
    } else {
      lightningIntensityRef.current = 0;
    }

    // Update physical bolt positions
    if (boltGroupRef.current) {
      const visible = lightningIntensity > 0 && weatherMode === "stormy";
      boltGroupRef.current.visible = visible;
      if (visible) {
        const b = boltRef.current;
        const children = boltGroupRef.current.children;
        if (children.length >= 5) {
          // Segment 1 (Vertical top)
          children[0].position.set(b.startX, 290, b.startZ);
          // Segment 2 (Horizontal link 1)
          children[1].position.set(b.startX + b.dx1/2, 260, b.startZ + b.dz1/2);
          children[1].scale.set(Math.abs(b.dx1) + 8, 8, Math.abs(b.dz1) + 8);
          // Segment 3 (Vertical middle)
          children[2].position.set(b.startX + b.dx1, 190, b.startZ + b.dz1);
          // Segment 4 (Horizontal link 2)
          children[3].position.set(b.startX + b.dx1 + b.dx2/2, 150, b.startZ + b.dz1 + b.dz2/2);
          children[3].scale.set(Math.abs(b.dx2) + 8, 8, Math.abs(b.dz2) + 8);
          // Segment 5 (Vertical bottom)
          children[4].position.set(b.startX + b.dx1 + b.dx2, 70, b.startZ + b.dz1 + b.dz2);
        }
      }
    }

    if (active) {
      // Global Day/Night Cycle based on India Standard Time (IST: UTC+5:30)
      const now = Date.now();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istTime = new Date(now + istOffset);
      
      const hours = istTime.getUTCHours();
      const minutes = istTime.getUTCMinutes();
      const seconds = istTime.getUTCSeconds();
      const ms = istTime.getUTCMilliseconds();
      
      const totalMs = 24 * 60 * 60 * 1000;
      const elapsed = (hours * 3600000) + (minutes * 60000) + (seconds * 1000) + ms;
      
      // t goes linearly from 0.0 (midnight) -> 0.25 (6 AM) -> 0.5 (noon) -> 0.75 (6 PM) -> 1.0 (midnight)
      t = elapsed / totalMs;

      timeRef.current = t;

      // Interpolate atmosphere states
      const numStates = ATMOSPHERE_STATES.length;
      const val = t * numStates;
      const idx1 = Math.floor(val) % numStates;
      const idx2 = (idx1 + 1) % numStates;
      const f = val - Math.floor(val);

      const s1 = ATMOSPHERE_STATES[idx1];
      const s2 = ATMOSPHERE_STATES[idx2];

      const currentFog = lerpColor(s1.fogColor, s2.fogColor, f);
      const currentAmbientColor = lerpColor(s1.ambientColor, s2.ambientColor, f);
      const currentAmbientIntensity = s1.ambientIntensity + (s2.ambientIntensity - s1.ambientIntensity) * f;
      const currentSunColor = lerpColor(s1.sunColor, s2.sunColor, f);
      const currentSunIntensity = s1.sunIntensity + (s2.sunIntensity - s1.sunIntensity) * f;
      const currentFillColor = lerpColor(s1.fillColor, s2.fillColor, f);
      const currentFillIntensity = s1.fillIntensity + (s2.fillIntensity - s1.fillIntensity) * f;
      const currentHemiSky = lerpColor(s1.hemiSky, s2.hemiSky, f);
      const currentHemiGround = lerpColor(s1.hemiGround, s2.hemiGround, f);
      const currentHemiIntensity = s1.hemiIntensity + (s2.hemiIntensity - s1.hemiIntensity) * f;

      // 1. Update Fog (darken into stormy charcoal grey under stormy conditions, or a cozy cold winter grey under snowy conditions)
      let fogColorToUse = currentFog;
      if (weatherMode === "stormy") {
        fogColorToUse = lerpColor(currentFog, "#0b0c10", 0.78);
      } else if (weatherMode === "snowy") {
        fogColorToUse = lerpColor(currentFog, "#c8d6e5", 0.65);
      }

      const fog = scene.fog as THREE.Fog | null;
      if (fog) {
        fog.color.set(lightningIntensity > 0 ? "#e2f0ff" : fogColorToUse);
      }
      scene.background = new THREE.Color(lightningIntensity > 0 ? "#cbd5e1" : fogColorToUse);

      // 2. Update Lights
      if (ambientLightRef.current) {
        ambientLightRef.current.color.set(lightningIntensity > 0 ? "#cbd5e1" : currentAmbientColor);
        ambientLightRef.current.intensity = (currentAmbientIntensity + lightningIntensity * 0.7) * 3.0;
      }

      // Calculate dynamic positions for Sun and Moon
      const theta = 2.0 * Math.PI * t - Math.PI / 2.0;

      if (sunLightRef.current) {
        sunLightRef.current.color.set(lightningIntensity > 0 ? "#e2f0ff" : currentSunColor);
        sunLightRef.current.position.set(
          Math.cos(theta) * 600,
          Math.sin(theta) * 500,
          -200
        );
        const isAboveHorizon = Math.sin(theta) > 0.0;
        let intensityFactor = 1.0;
        if (weatherMode === "snowy") {
          intensityFactor = 0.45; // Dim the sun for cozy snow clouds!
        }
        sunLightRef.current.intensity = isAboveHorizon
          ? Math.sin(theta) * currentSunIntensity * 3.5 * intensityFactor + lightningIntensity * 1.5
          : lightningIntensity * 1.5;
      }

      if (fillLightRef.current) {
        fillLightRef.current.color.set(lightningIntensity > 0 ? "#cbd5e1" : currentFillColor);
        fillLightRef.current.position.set(
          -Math.cos(theta) * 600,
          -Math.sin(theta) * 500,
          200
        );
        const sunIsBelowHorizon = Math.sin(theta) <= 0.0;
        const baseIntensity = sunIsBelowHorizon
          ? -Math.sin(theta) * currentFillIntensity * 2.5
          : (1.0 - Math.sin(theta)) * currentFillIntensity * 1.5;
        fillLightRef.current.intensity = baseIntensity + lightningIntensity * 1.2;
      }

      if (hemiLightRef.current) {
        hemiLightRef.current.color.set(lightningIntensity > 0 ? "#e2f0ff" : currentHemiSky);
        hemiLightRef.current.groundColor.set(currentHemiGround);
        hemiLightRef.current.intensity = (currentHemiIntensity + lightningIntensity * 0.6) * 3.5;
      }

      // 3. Move Physical Sun and Moon relative to camera (unreachable background elements)
      const orbitRadius = 2200;
      const sunX = camera.position.x + Math.cos(theta) * orbitRadius;
      const sunY = camera.position.y + Math.sin(theta) * 1500;
      const sunZ = camera.position.z - 400;

      const moonX = camera.position.x - Math.cos(theta) * orbitRadius;
      const moonY = camera.position.y - Math.sin(theta) * 1500;
      const moonZ = camera.position.z + 400;

      if (sunGroupRef.current) {
        sunGroupRef.current.position.set(sunX, sunY, sunZ);
        sunGroupRef.current.visible = Math.sin(theta) > -0.1;
      }

      if (moonGroupRef.current) {
        moonGroupRef.current.position.set(moonX, moonY, moonZ);
        moonGroupRef.current.visible = Math.sin(theta) <= 0.1;
      }
    } else {
      // Static theme values
      if (themeIndex === 1) {
        t = 0.75; // Sunset
        timeRef.current = 0.75;
      } else {
        t = 0.0; // Midnight / Neon / Emerald
        timeRef.current = 0.0;
      }

      // 1. Reset Fog and Background
      const fog = scene.fog as THREE.Fog | null;
      if (fog) {
        fog.color.set(theme.fogColor);
      }
      scene.background = new THREE.Color(theme.fogColor);

      // 2. Reset Lights to Static Theme
      if (ambientLightRef.current) {
        ambientLightRef.current.color.set(theme.ambientColor);
        ambientLightRef.current.intensity = theme.ambientIntensity * 3.0;
      }

      if (sunLightRef.current) {
        sunLightRef.current.color.set(theme.sunColor);
        sunLightRef.current.position.set(theme.sunPos[0], theme.sunPos[1], theme.sunPos[2]);
        sunLightRef.current.intensity = theme.sunIntensity * 3.5;
      }

      if (fillLightRef.current) {
        fillLightRef.current.color.set(theme.fillColor);
        fillLightRef.current.position.set(theme.fillPos[0], theme.fillPos[1], theme.fillPos[2]);
        fillLightRef.current.intensity = theme.fillIntensity * 3.0;
      }

      if (hemiLightRef.current) {
        hemiLightRef.current.color.set(theme.hemiSky);
        hemiLightRef.current.groundColor.set(theme.hemiGround);
        hemiLightRef.current.intensity = theme.hemiIntensity * 3.5;
      }

      // 3. Static Physical Sun and Moon Placement relative to camera
      if (themeIndex === 1) { // Sunset
        if (sunGroupRef.current) {
          const sunDir = new THREE.Vector3(...theme.sunPos).normalize();
          const targetPos = sunDir.multiplyScalar(2200);
          sunGroupRef.current.position.set(
            camera.position.x + targetPos.x,
            camera.position.y + targetPos.y,
            camera.position.z + targetPos.z
          );
          sunGroupRef.current.visible = true;
        }
        if (moonGroupRef.current) {
          moonGroupRef.current.visible = false;
        }
      } else { // Midnight / Neon / Emerald
        if (sunGroupRef.current) {
          sunGroupRef.current.visible = false;
        }
        if (moonGroupRef.current) {
          const moonDir = new THREE.Vector3(...theme.fillPos).normalize();
          const targetPos = moonDir.multiplyScalar(2200);
          moonGroupRef.current.position.set(
            camera.position.x + targetPos.x,
            camera.position.y + targetPos.y,
            camera.position.z + targetPos.z
          );
          moonGroupRef.current.visible = true;
        }
      }
    }
  });

  return (
    <>
      <fog ref={fogRef} attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />
      <SceneBackground color={theme.fogColor} />

      <ambientLight ref={ambientLightRef} intensity={theme.ambientIntensity * 3} color={theme.ambientColor} />
      <directionalLight ref={sunLightRef} position={theme.sunPos} intensity={theme.sunIntensity * 3.5} color={theme.sunColor} />
      <directionalLight ref={fillLightRef} position={theme.fillPos} intensity={theme.fillIntensity * 3} color={theme.fillColor} />
      <hemisphereLight ref={hemiLightRef} args={[theme.hemiSky, theme.hemiGround, theme.hemiIntensity * 3.5]} />

      <SkyDome timeRef={timeRef} theme={theme} active={active} />
      <VoxelClouds active={active} timeRef={timeRef} />
      <AmbientOceanShips cityRadius={cityRadius ?? 800} />
      <FlyingCityShips cityRadius={cityRadius ?? 800} />

      {/* Visual Jagged Lightning Bolt (Voxel Aesthetic, themed accent color) */}
      <group ref={boltGroupRef} visible={false}>
        <mesh>
          <boxGeometry args={[8, 60, 8]} />
          <meshBasicMaterial color={theme.accent} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={theme.accent} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[8, 80, 8]} />
          <meshBasicMaterial color={theme.accent} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={theme.accent} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[8, 160, 8]} />
          <meshBasicMaterial color={theme.accent} toneMapped={false} />
        </mesh>
      </group>

      {/* Physical Sun */}
      <group ref={sunGroupRef}>
        <mesh material={sunMaterials.body}>
          <sphereGeometry args={[70, 32, 32]} />
        </mesh>
        <mesh material={sunMaterials.glow}>
          <sphereGeometry args={[105, 32, 32]} />
        </mesh>
      </group>

      {/* Physical Moon */}
      <group ref={moonGroupRef}>
        <mesh material={moonMaterials.body}>
          <sphereGeometry args={[60, 32, 32]} />
        </mesh>
        <mesh material={moonMaterials.glow}>
          <sphereGeometry args={[90, 32, 32]} />
        </mesh>
      </group>

      {/* Starfield for Night Sky */}
      <Starfield timeRef={timeRef} active={active} />

      {/* Moonlight Volumetric Rays and Lens Flare */}
      <VolumetricMoonRays moonGroupRef={moonGroupRef} />
      <MoonLensFlare moonGroupRef={moonGroupRef} />
    </>
  );
}
