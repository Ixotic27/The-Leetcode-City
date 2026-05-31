"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

export const DynamicSky = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { clock } = useThree();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSunPosition: { value: new THREE.Vector3(0, 1, 0) },
    uTopColor: { value: new THREE.Color("#3366ff") },
    uBottomColor: { value: new THREE.Color("#ffcc88") },
  }), []);

  useFrame(() => {
    if (materialRef.current) {
      const time = clock.getElapsedTime() * 0.05;
      materialRef.current.uniforms.uTime.value = time;
      const sunX = Math.sin(time);
      const sunY = Math.cos(time);
      materialRef.current.uniforms.uSunPosition.value.set(sunX, sunY, 0).normalize();
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[1000, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        side={THREE.BackSide}
        attach="material"
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uSunPosition;
          uniform vec3 uTopColor;
          uniform vec3 uBottomColor;
          varying vec3 vWorldPosition;
          void main() {
            vec3 unitDir = normalize(vWorldPosition);
            float sunIntensity = max(dot(unitDir, uSunPosition), 0.0);
            float skyGradient = pow(1.0 - max(unitDir.y, 0.0), 3.0);
            vec3 skyColor = mix(uBottomColor, uTopColor, skyGradient);
            vec3 sunColor = vec3(1.0, 0.9, 0.7) * pow(sunIntensity, 20.0);
            gl_FragColor = vec4(skyColor + sunColor, 1.0);
          }
        `}
      />
    </mesh>
  );
};