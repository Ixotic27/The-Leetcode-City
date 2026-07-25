"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface NeonGridOverlayProps {
  accentColor: string;
}

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vec2 pos = vWorldPosition.xz;
    float dist = length(pos);

    // Fade out at city boundaries (fade completely by 2500 units)
    float fade = smoothstep(2500.0, 1000.0, dist);
    if (fade <= 0.0) {
      discard;
    }

    // Grid sizes
    float primarySpacing = 100.0;
    float secondarySpacing = 20.0;

    // Calculate grid lines using derivatives for infinite resolution and anti-aliasing
    vec2 grid1 = abs(fract(pos / primarySpacing - 0.5) - 0.5) / (fwidth(pos / primarySpacing) * 1.2);
    float primaryGrid = 1.0 - min(min(grid1.x, grid1.y), 1.0);

    vec2 grid2 = abs(fract(pos / secondarySpacing - 0.5) - 0.5) / (fwidth(pos / secondarySpacing) * 1.0);
    float secondaryGrid = 1.0 - min(min(grid2.x, grid2.y), 1.0);

    // Emissive pulsing wave emanating from the center
    float waveSpeed = 2.5;
    float waveFreq = 0.008;
    float wave = sin(dist * waveFreq - uTime * waveSpeed) * 0.5 + 0.5;
    // Make wave sharp/narrow for a cleaner energy pulse line
    float pulse = pow(wave, 8.0) * 1.5;

    // Moving data flow pulses along the grid lines
    float flowSpeed = 15.0;
    float flowDensity = 80.0;
    float flowX = step(0.96, primaryGrid) * step(0.85, fract((pos.y - uTime * flowSpeed) / flowDensity));
    float flowY = step(0.96, primaryGrid) * step(0.85, fract((pos.x - uTime * flowSpeed) / flowDensity));
    float dataFlow = clamp(flowX + flowY, 0.0, 1.0);

    // Combine neon grid components
    // Base glow (secondary grid is faint, primary grid is bright)
    float intensity = primaryGrid * 0.7 + secondaryGrid * 0.15;
    
    // Add the energy pulse wave and data flow pulses
    intensity += pulse * (primaryGrid * 0.6 + 0.15);
    intensity += dataFlow * 0.8;

    // Final color with cyberpunk emissive style
    vec3 finalColor = uColor * intensity;

    gl_FragColor = vec4(finalColor, intensity * fade * 0.85);
  }
`;

export default function NeonGridOverlay({ accentColor }: NeonGridOverlayProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color() },
    }),
    []
  );

  // Keep color in sync with prop updates
  useMemo(() => {
    uniforms.uColor.value.set(accentColor);
  }, [accentColor, uniforms]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]} renderOrder={1}>
      <planeGeometry args={[6000, 6000]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
