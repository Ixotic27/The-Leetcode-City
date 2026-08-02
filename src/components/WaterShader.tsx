"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Lightweight animated water surface.
 *
 * Uses a simple ShaderMaterial with:
 * - Vertex: gentle sine-wave swell (2 waves only)
 * - Fragment: basic animated color shift + Fresnel edge highlight
 * - Fog integration: fades into scene fog at distance
 * - Low segment count for minimal vertex processing
 */

interface WaterPlaneProps {
  position: [number, number, number];
  size: [number, number];
  rotation?: [number, number, number];
  deepColor: string;
  shallowColor: string;
  /** Segments per axis for vertex displacement (default 8) */
  segments?: number;
  renderOrder?: number;
}

export function WaterPlane({
  position,
  size,
  rotation = [-Math.PI / 2, 0, 0],
  deepColor,
  shallowColor,
  segments = 8,
  renderOrder = -1,
}: WaterPlaneProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true, // Enable Three.js fog integration
        uniforms: {
          ...THREE.UniformsLib.fog, // Include fog uniforms (fogColor, fogNear, fogFar)
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(deepColor) },
          uShallow: { value: new THREE.Color(shallowColor) },
        },

        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vWPos;
          varying float vFogDepth;

          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            // Gentle swell — 2 sine waves only
            wp.y += sin(wp.x * 0.003 + uTime * 0.4) * 0.3
                   + sin(wp.z * 0.004 - uTime * 0.35) * 0.25;
            vWPos = wp.xyz;

            vec4 mvPosition = viewMatrix * wp;
            vFogDepth = -mvPosition.z;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,

        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          varying vec3 vWPos;
          varying float vFogDepth;

          // Three.js fog uniforms (injected by fog: true)
          #ifdef USE_FOG
            uniform vec3 fogColor;
            #ifdef FOG_EXP2
              uniform float fogDensity;
            #else
              uniform float fogNear;
              uniform float fogFar;
            #endif
          #endif

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

            float alpha = mix(0.8, 0.95, fresnel);

            // Apply fog — blend water color toward fog color at distance
            #ifdef USE_FOG
              #ifdef FOG_EXP2
                float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
              #else
                float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
              #endif
              col = mix(col, fogColor, fogFactor);
              alpha = mix(alpha, 0.0, fogFactor); // Fade out water transparency at distance
            #endif

            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    [deepColor, shallowColor],
  );

  useFrame(({ clock }) => {
    if (matRef.current) {
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
