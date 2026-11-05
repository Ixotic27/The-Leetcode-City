"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CityDecoration } from "@/lib/github";
import { planTraffic, wrapAlong, type TrafficRoad } from "@/lib/city/traffic";

const MAX_CARS = 400;
const PAINT = ["#c03030", "#3050a0", "#d0d0d0", "#2a2a2a", "#e0b030", "#2f8f5a"];
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

/** Moving cars on the inner lanes of every road segment: one InstancedMesh, one useFrame. */
export default function StreetTraffic({ decorations, reducedMotion = false }: { decorations: CityDecoration[]; reducedMotion?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const plan = useMemo(
    () => planTraffic(decorations.filter((d) => d.type === "roadSurface") as TrafficRoad[], MAX_CARS),
    [decorations],
  );

  // Body + cabin share the instance paint; head/tail lights are emissive so night scenes read well. Forward = +X.
  const { geometry, materials } = useMemo(() => {
    const parts = [
      new THREE.BoxGeometry(8, 2.5, 3.5).translate(0, 1.25, 0),
      new THREE.BoxGeometry(4.6, 2, 3.2).translate(-0.6, 3.5, 0),
      mergeGeometries([new THREE.BoxGeometry(0.2, 0.6, 0.8).translate(4.05, 1.5, 1.1), new THREE.BoxGeometry(0.2, 0.6, 0.8).translate(4.05, 1.5, -1.1)])!,
      mergeGeometries([new THREE.BoxGeometry(0.2, 0.6, 0.8).translate(-4.05, 1.5, 1.1), new THREE.BoxGeometry(0.2, 0.6, 0.8).translate(-4.05, 1.5, -1.1)])!,
    ];
    const geometry = mergeGeometries(parts, true)!;
    parts.forEach((p) => p.dispose());
    const paint = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#303030", emissiveIntensity: 0.4, roughness: 0.6 });
    // Black base color so the per-instance paint tint does not darken the glow.
    const head = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#fff3c4", emissiveIntensity: 2, toneMapped: false });
    const tail = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ff2a2a", emissiveIntensity: 1.6, toneMapped: false });
    return { geometry, materials: [paint, paint, head, tail] };
  }, []);

  useEffect(() => () => {
    geometry.dispose();
    new Set(materials).forEach((m) => m.dispose());
  }, [geometry, materials]);

  // Rotation never changes per car, so set full matrices once and only touch translation per frame.
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < plan.count; i++) {
      _m.makeRotationY(Math.atan2(-plan.dz[i], plan.dx[i]));
      _m.setPosition(plan.x[i] + plan.dx[i] * plan.s[i], plan.y[i], plan.z[i] + plan.dz[i] * plan.s[i]);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.set(PAINT[plan.color[i]]));
    }
    mesh.count = plan.count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plan]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh || reducedMotion || plan.count === 0) return;
    // rAF pauses while the tab is hidden; clamping keeps cars from jumping on return.
    const dt = Math.min(delta, 0.1);
    const { x, z, dx, dz, s, half, speed } = plan;
    const a = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < plan.count; i++) {
      const si = (s[i] = wrapAlong(s[i] + speed[i] * dt, half[i]));
      a[i * 16 + 12] = x[i] + dx[i] * si;
      a[i * 16 + 14] = z[i] + dz[i] * si;
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (plan.count === 0) return null;
  // Cars span the whole city and move every frame, so per-mesh culling would only ever pass.
  return <instancedMesh ref={ref} args={[geometry, materials, MAX_CARS]} frustumCulled={false} />;
}
