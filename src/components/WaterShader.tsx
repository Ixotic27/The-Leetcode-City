"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Animated water surface with GPU-driven ripples and Fresnel reflections.
 *
 * Features:
 * - Vertex: gentle large-scale swell (two sine waves)
 * - Fragment: per-pixel ripple normals from 3 octaves of animated sin waves
 * - Fresnel blending between deep/shallow water and reflected sky color
 * - Ripple detail fades with distance to prevent aliasing
 * - All-GPU, no render targets or off-screen passes
 */

interface WaterPlaneProps {
  position: [number, number, number];
  size: [number, number];
  rotation?: [number, number, number];
  /** Deep water body color */
  deepColor: string;
  /** Shallow/near-surface tint */
  shallowColor: string;
  /** Sky color reflected at grazing angles */
  skyColor: string;
  /** Primary specular highlight color (sun/moon) */
  specularColor: string;
  /** 0 = full day, 1 = full night — dims specular, shifts palette */
  nightFactor?: number;
  /** PlaneGeometry subdivisions for vertex displacement (default 64) */
  segments?: number;
  renderOrder?: number;
}

export function WaterPlane({
  position,
  size,
  rotation = [-Math.PI / 2, 0, 0],
  deepColor,
  shallowColor,
  skyColor,
  specularColor,
  nightFactor = 0.7,
  segments = 64,
  renderOrder = -1,
}: WaterPlaneProps) {
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
          uSky: { value: new THREE.Color(skyColor) },
          uSpecCol: { value: new THREE.Color(specularColor) },
          uNight: { value: nightFactor },
        },

        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vWPos;
          varying vec2 vUv;

          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);

            // Gentle large-scale swell — stays well below shoreline geometry
            wp.y += sin(wp.x * 0.003 + uTime * 0.4) * 0.35
                   + sin(wp.z * 0.004 - uTime * 0.35) * 0.3;

            vWPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,

        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uSky;
          uniform vec3 uSpecCol;
          uniform float uNight;

          varying vec3 vWPos;
          varying vec2 vUv;

          // Multi-octave animated ripple normal
          vec3 rippleNormal(vec2 p, float t) {
            float scale1 = 0.04, scale2 = 0.09, scale3 = 0.17;
            float speed1 = 0.6, speed2 = 0.45, speed3 = 0.8;

            float h = 0.0;
            // Octave 1: large gentle ripples
            h += sin(p.x * scale1 + t * speed1) * cos(p.y * scale1 * 1.3 - t * speed1 * 0.7) * 0.5;
            // Octave 2: medium chop
            h += sin(p.x * scale2 * 1.1 - t * speed2) * cos(p.y * scale2 + t * speed2 * 0.8) * 0.3;
            // Octave 3: fine detail
            h += sin(p.x * scale3 + t * speed3 * 1.1) * cos(p.y * scale3 * 0.9 - t * speed3) * 0.2;

            // Finite-difference gradient for the normal
            float eps = 0.8;
            float hx = 0.0;
            hx += sin((p.x + eps) * scale1 + t * speed1) * cos(p.y * scale1 * 1.3 - t * speed1 * 0.7) * 0.5;
            hx += sin((p.x + eps) * scale2 * 1.1 - t * speed2) * cos(p.y * scale2 + t * speed2 * 0.8) * 0.3;
            hx += sin((p.x + eps) * scale3 + t * speed3 * 1.1) * cos(p.y * scale3 * 0.9 - t * speed3) * 0.2;

            float hy = 0.0;
            hy += sin(p.x * scale1 + t * speed1) * cos((p.y + eps) * scale1 * 1.3 - t * speed1 * 0.7) * 0.5;
            hy += sin(p.x * scale2 * 1.1 - t * speed2) * cos((p.y + eps) * scale2 + t * speed2 * 0.8) * 0.3;
            hy += sin(p.x * scale3 + t * speed3 * 1.1) * cos((p.y + eps) * scale3 * 0.9 - t * speed3) * 0.2;

            return normalize(vec3(h - hx, 1.0, h - hy));
          }

          void main() {
            // Distance-based detail fade — ripples vanish beyond ~2000 units
            float dist = length(vWPos.xz - cameraPosition.xz);
            float detailFade = smoothstep(2000.0, 400.0, dist);

            // Ripple normal (blended toward flat at distance)
            vec3 N = rippleNormal(vWPos.xz, uTime);
            N = normalize(mix(vec3(0.0, 1.0, 0.0), N, detailFade));

            // View direction and Fresnel
            vec3 V = normalize(cameraPosition - vWPos);
            float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
            fresnel = mix(fresnel, fresnel * 0.6, uNight); // softer at night

            // Deep/shallow blend based on view angle (steeper = deeper)
            float depthMix = pow(max(dot(N, V), 0.0), 0.6);
            vec3 waterCol = mix(uDeep, uShallow, depthMix);

            // Sky reflection at grazing angles
            vec3 col = mix(waterCol, uSky, fresnel * 0.55);

            // Sun/moon specular highlight
            vec3 sunDir = normalize(vec3(0.3, 0.8, 0.4));
            vec3 H = normalize(sunDir + V);
            float spec = pow(max(dot(N, H), 0.0), 128.0);
            spec *= (1.0 - uNight * 0.5); // dimmer at night
            col += uSpecCol * spec * 0.6;

            // Subtle sparkle at grazing angles
            float sparkle = pow(max(dot(N, H), 0.0), 512.0) * detailFade;
            col += vec3(sparkle * 0.3);

            // Edge transparency: water is more transparent when looking straight down
            float alpha = mix(0.75, 0.95, fresnel);

            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    [deepColor, shallowColor, skyColor, specularColor, nightFactor],
  );

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <mesh position={position} rotation={rotation} renderOrder={renderOrder}>
      <planeGeometry args={[size[0], size[1], segments, segments]} />
      <primitive object={mat} ref={matRef} attach="material" />
    </mesh>
  );
}

/**
 * Simplified water for small canal segments — fewer subdivisions,
 * same shader. Reuses a single shared material for all canals.
 */
export function CanalWater({
  position,
  length,
  width,
  rotation,
  deepColor,
  shallowColor,
  skyColor,
  specularColor,
  nightFactor = 0.7,
}: {
  position: [number, number, number];
  length: number;
  width: number;
  rotation: number;
  deepColor: string;
  shallowColor: string;
  skyColor: string;
  specularColor: string;
  nightFactor?: number;
}) {
  return (
    <WaterPlane
      position={position}
      size={[length, width]}
      rotation={[-Math.PI / 2, 0, rotation]}
      deepColor={deepColor}
      shallowColor={shallowColor}
      skyColor={skyColor}
      specularColor={specularColor}
      nightFactor={nightFactor}
      segments={16}
      renderOrder={1}
    />
  );
}
