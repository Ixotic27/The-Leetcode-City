"use client";

import { useRef, useMemo, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";

const vertexShader = /* glsl */ `
  attribute float aRise;
  varying float vAlpha;

  uniform vec3 uSunDir;
  uniform float uActive;

  void main() {
    vec3 localPos = position;
    
    // Apply rise animation matching InstancedBuildings
    localPos.y = localPos.y * aRise + (aRise - 1.0) * 0.5;

    // Transform by instanceMatrix to get world position
    vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);

    // Height of this vertex above the ground
    float height = max(worldPos.y, 0.0);

    // Project/shear along the sun direction vector
    float clampSunY = max(uSunDir.y, 0.08);
    worldPos.xz += -uSunDir.xz * (height / clampSunY);

    // Squash to ground level with small Y offset to prevent z-fighting
    worldPos.y = 0.08;

    // Calculate length of the shadow projection to apply a soft fade-out
    float shadowLength = height / clampSunY;
    vAlpha = clamp(1.0 - (shadowLength / 450.0), 0.0, 1.0) * uActive;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    // Stylized dark purple-tinted shadow
    gl_FragColor = vec4(0.08, 0.04, 0.12, vAlpha * 0.45);
  }
`;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _sunDir = new THREE.Vector3();

interface InstancedShadowsProps {
  buildings: CityBuilding[];
  timeRef: React.MutableRefObject<number>;
  weatherMode?: "sunny" | "sunset" | "rainy" | "windy" | "stormy" | "snowy";
  themeIndex: number;
  active: boolean;
}

export default memo(function InstancedShadows({
  buildings,
  timeRef,
  weatherMode = "sunny",
  themeIndex,
  active,
}: InstancedShadowsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = buildings.length;

  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
        uActive: { value: 0.0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }, []);

  const riseData = useMemo(() => {
    const rise = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      rise[i] = 0;
    }
    return rise;
  }, [count]);

  // Set up instance matrices and custom attributes
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

    // Set bounding sphere to avoid premature culling
    let maxDist = 0;
    let maxHeight = 0;
    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      const d = Math.sqrt(b.position[0] ** 2 + b.position[2] ** 2);
      if (d > maxDist) maxDist = d;
      if (b.height > maxHeight) maxHeight = b.height;
    }
    mesh.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, maxHeight / 2, 0),
      (maxDist + maxHeight) * 1.5
    );

    const riseAttr = new THREE.InstancedBufferAttribute(riseData, 1);
    riseAttr.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute("aRise", riseAttr);

    mesh.count = count;
  }, [buildings, count, riseData]);

  // Update rise animation in sync with buildings
  useFrame(({ scene }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const bMesh = scene.getObjectByName("instanced-buildings") as THREE.InstancedMesh | null;
    const riseAttr = mesh.geometry.getAttribute("aRise") as THREE.InstancedBufferAttribute | undefined;
    if (bMesh && riseAttr) {
      const bRiseAttr = bMesh.geometry.getAttribute("aRise") as THREE.InstancedBufferAttribute | undefined;
      if (bRiseAttr) {
        (riseAttr.array as Float32Array).set(bRiseAttr.array as Float32Array);
        riseAttr.needsUpdate = true;
      }
    }
  });

  // Calculate sun direction and active state
  useFrame((state) => {
    if (!material.uniforms) return;

    // Check manual weather overrides
    const isSunsetWeather = weatherMode === "sunset";
    const isSunsetTheme = themeIndex === 1 && weatherMode === "sunny";

    // Calculate local sunset/sunrise intensity factor if day-night cycle is active
    let localSunsetSunriseIntensity = 0.0;
    const tVal = timeRef ? timeRef.current : 0.0;
    if (active) {
      // Sunrise: 5 AM - 7 AM (t between 0.2083 and 0.2917, peak at 0.25)
      let sunriseIntensity = 0.0;
      if (tVal >= 0.2083 && tVal <= 0.2917) {
        sunriseIntensity = 1.0 - Math.abs(tVal - 0.25) / 0.0417;
      }
      
      // Sunset: 5 PM - 7 PM (t between 0.7083 and 0.7917, peak at 0.75)
      let sunsetIntensity = 0.0;
      if (tVal >= 0.7083 && tVal <= 0.7917) {
        sunsetIntensity = 1.0 - Math.abs(tVal - 0.75) / 0.0417;
      }
      
      localSunsetSunriseIntensity = Math.max(sunriseIntensity, sunsetIntensity);
    }

    // Combine local time intensity with manual overrides
    const finalIntensity = Math.max(localSunsetSunriseIntensity, (isSunsetWeather || isSunsetTheme) ? 1.0 : 0.0);

    // Update active uniform
    material.uniforms.uActive.value = finalIntensity;

    if (finalIntensity > 0.01) {
      // Calculate dynamic sun coordinates matching AtmosphereCycleManager
      const theta = 2.0 * Math.PI * tVal - Math.PI / 2.0;

      // Position corresponds to AtmosphereCycleManager's sun position
      const sunX = Math.cos(theta) * 600;
      const sunY = Math.sin(theta) * 500;
      const sunZ = -200;

      _sunDir.set(sunX, sunY, sunZ).normalize();
      material.uniforms.uSunDir.value.copy(_sunDir);
    }
  });

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
      name="instanced-shadows"
    />
  );
});
