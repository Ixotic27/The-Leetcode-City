"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type RainRippleGroundProps = {
  intensity?: number;
  size?: number;
};

export function RainRippleGround({
  intensity = 1,
  size = 1800,
}: RainRippleGroundProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uColor: { value: new THREE.Color("#6f8fa8") },
    }),
    [intensity]
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uIntensity;
          uniform vec3 uColor;

          varying vec2 vUv;

          void main() {
            float d1 = distance(vUv, vec2(0.25, 0.35));
            float d2 = distance(vUv, vec2(0.65, 0.45));
            float d3 = distance(vUv, vec2(0.45, 0.75));

            float ripple =
              sin(d1 * 70.0 - uTime * 4.0) +
              sin(d2 * 80.0 - uTime * 5.0) +
              sin(d3 * 75.0 - uTime * 3.5);

            ripple = max(ripple, 0.0);
            float alpha = ripple * 0.035 * uIntensity;

            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </mesh>
  );
}
