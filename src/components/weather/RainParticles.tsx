'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function RainParticles({ dropCount = 15000, speed = 2.0, windX = 0.5 }) {
  const shaderMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(dropCount * 3);
    for (let i = 0; i < dropCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 400;     // X spread
      pos[i * 3 + 1] = Math.random() * 200;         // Y height
      pos[i * 3 + 2] = (Math.random() - 0.5) * 400; // Z depth
    }
    return pos;
  }, [dropCount]);

  useFrame((state) => {
    if (shaderMaterialRef.current) {
      shaderMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderMaterialRef}
        transparent
        depthWrite={false}
        uniforms={{
          uTime: { value: 0 },
          uSpeed: { value: speed },
          uWindX: { value: windX },
          uColor: { value: new THREE.Color(0x8899aa) }
        }}
        vertexShader={`
          uniform float uTime;
          uniform float uSpeed;
          uniform float uWindX;
          void main() {
            vec3 pos = position;
            pos.y -= mod(uTime * 15.0 * uSpeed, 200.0);
            pos.x += mod(uTime * 5.0 * uWindX, 400.0);
            
            if (pos.y < 0.0) pos.y += 200.0; 
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = 3.0 * (100.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          void main() {
            float distance = length(gl_PointCoord - vec2(0.5));
            if (distance > 0.5) discard;
            gl_FragColor = vec4(uColor, 0.6); 
          }
        `}
      />
    </points>
  );
}