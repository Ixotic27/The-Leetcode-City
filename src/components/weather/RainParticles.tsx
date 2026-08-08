'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from '@/lib/reducedMotion';

type RainParticlesProps = {
  dropCount?: number;
  speed?: number;
  windX?: number;
  areaSize?: number;
  height?: number;
  reducedMotion?: boolean;
};

function generateRainPositions(dropCount: number, areaSize: number, height: number): Float32Array {
  const pos = new Float32Array(dropCount * 3);
  let seed = 12345;
  for (let i = 0; i < dropCount; i++) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const r1 = seed / 4294967296;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const r2 = seed / 4294967296;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const r3 = seed / 4294967296;

    pos[i * 3] = (r1 - 0.5) * areaSize;
    pos[i * 3 + 1] = r2 * height;
    pos[i * 3 + 2] = (r3 - 0.5) * areaSize;
  }
  return pos;
}

export function RainParticles({
  dropCount = 15000,
  speed = 2.0,
  windX = 0.5,
  areaSize = 400,
  height = 200,
  reducedMotion: propReducedMotion,
}: RainParticlesProps) {
  const reducedMotion = useReducedMotion(propReducedMotion);
  const pointsRef = useRef<THREE.Points>(null);
  const shaderMaterialRef = useRef<THREE.ShaderMaterial>(null);
   
  const positions = useMemo(() => {
    return generateRainPositions(dropCount, areaSize, height);
  }, [dropCount, areaSize, height]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uWindX: { value: windX },
      uColor: { value: new THREE.Color(0x8899aa) },
      uAreaSize: { value: areaSize },
      uHeight: { value: height },
    }),
    [speed, windX, areaSize, height]
  );

  useFrame((state) => {
    if (shaderMaterialRef.current && !reducedMotion) {
      shaderMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }

    if (pointsRef.current) {
      pointsRef.current.position.x = state.camera.position.x;
      pointsRef.current.position.z = state.camera.position.z;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>

      <shaderMaterial
        ref={shaderMaterialRef}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uSpeed;
          uniform float uWindX;
          uniform float uAreaSize;
          uniform float uHeight;

          void main() {
            vec3 pos = position;

            pos.y -= mod(uTime * 15.0 * uSpeed, uHeight);
            pos.x += mod(uTime * 5.0 * uWindX, uAreaSize);

            if (pos.y < 0.0) {
              pos.y += uHeight;
            }

            if (pos.x > uAreaSize * 0.5) {
              pos.x -= uAreaSize;
            }

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = 3.0 * (100.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;

          void main() {
            float distanceToCenter = length(gl_PointCoord - vec2(0.5));

            if (distanceToCenter > 0.5) {
              discard;
            }

            gl_FragColor = vec4(uColor, 0.6);
          }
        `}
      />
    </points>
  );
}