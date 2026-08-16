"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "@/lib/reducedMotion";

/**
 * Lightweight animated water surface.
 *
 * Simulates low-poly ocean/river waves with custom vertex displacement
 * and dual-color HSL gradient reflections.
 */
interface WaterPlaneProps {
  position: [number, number, number];
  size: [number, number];
  rotation?: [number, number, number];
  deepColor?: string;
  shallowColor?: string;
  segments?: number;
  renderOrder?: number;
}

export function WaterPlane({
  position,
  size,
  rotation = [-Math.PI / 2, 0, 0],
  deepColor = "#006994",
  shallowColor = "#77d1e8",
  segments = 8,
  renderOrder = -1,
}: WaterPlaneProps) {
  const reducedMotion = useReducedMotion();
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(deepColor) },
          uShallow: { value: new THREE.Color(shallowColor) },
        },

        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vWPos;

          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            // Gentle swell — 2 sine waves only
            wp.y += sin(wp.x * 0.003 + uTime * 0.4) * 0.3
                   + sin(wp.z * 0.004 - uTime * 0.35) * 0.25;
            vWPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,

        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          varying vec3 vWPos;

          void main() {
            // View-angle based deep/shallow blend
            vec3 V = normalize(cameraPosition - vWPos);
            vec3 N = vec3(0.0, 1.0, 0.0);
            float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

            // Simple animated color variation
            float wave = sin(vWPos.x * 0.01 + uTime * 0.3) * 0.5 + 0.5;
            vec3 col = mix(uDeep, uShallow, wave * 0.3 + fresnel * 0.4);

            // Edge glow at horizon
            col += uShallow * fresnel * 0.2;

            gl_FragColor = vec4(col, mix(0.8, 0.95, fresnel));
          }
        `,
      }),
    [deepColor, shallowColor],
  );

  useFrame(({ clock }) => {
    if (matRef.current && !reducedMotion) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <mesh
      position={position}
      rotation={rotation}
      renderOrder={renderOrder}
      frustumCulled={false}
    >
      <planeGeometry args={[size[0], size[1], segments, segments]} />
      <primitive object={mat} ref={matRef} attach="material" />
    </mesh>
  );
}
