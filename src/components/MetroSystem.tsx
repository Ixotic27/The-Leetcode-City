"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DISTRICT_ORIGINS } from "@/lib/github";

interface TrackSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  name: string;
}

// ─── Elevated Metro Station Platform ──────────────────────────────
interface MetroStationProps {
  position: [number, number, number];
  name: string;
}

function MetroStation({ position, name }: MetroStationProps) {
  return (
    <group position={position}>
      {/* 1. Large pillars holding the station */}
      {[-16, 16].map((x) =>
        [-30, 0, 30].map((z) => (
          <mesh key={`sp-${x}-${z}`} position={[x, 20, z]}>
            <cylinderGeometry args={[2.5, 3.2, 40, 6]} />
            <meshStandardMaterial color="#3a3d45" roughness={0.8} />
          </mesh>
        )),
      )}

      {/* 2. Platform slab at Y=40 */}
      <mesh position={[0, 39, 0]}>
        <boxGeometry args={[45, 2, 90]} />
        <meshStandardMaterial color="#2d2d30" roughness={0.9} />
      </mesh>

      {/* 3. Platform Roof canopy */}
      <mesh position={[0, 58, 0]}>
        <boxGeometry args={[48, 1, 94]} />
        <meshStandardMaterial color="#4a4c52" roughness={0.8} />
      </mesh>
      {[-22, 22].map((x) =>
        [-40, -20, 20, 40].map((z) => (
          <mesh key={`roof-p-${x}-${z}`} position={[x, 49, z]}>
            <cylinderGeometry args={[0.4, 0.45, 20, 5]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        )),
      )}

      {/* 4. Glass platform screens with neon glow strips */}
      {[-21, 21].map((x) => (
        <group key={`screen-${x}`} position={[x, 42.5, 0]}>
          <mesh>
            <boxGeometry args={[0.4, 5, 80]} />
            <meshStandardMaterial
              color="#00ffcc"
              transparent
              opacity={0.3}
              roughness={0.2}
            />
          </mesh>
          {/* Glowing strip */}
          <mesh position={[0, 2.5, 0]}>
            <boxGeometry args={[0.5, 0.2, 80]} />
            <meshStandardMaterial
              color="#ffa116"
              emissive="#ffa116"
              emissiveIntensity={2.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* 5. Stairs to ground */}
      <group position={[0, 20, -50]} rotation={[0.4, 0, 0]}>
        <mesh>
          <boxGeometry args={[10, 2, 60]} />
          <meshStandardMaterial color="#404348" />
        </mesh>
      </group>

      {/* 6. Glowing neon signboard */}
      <group position={[0, 50, 46]}>
        <mesh>
          <boxGeometry args={[26, 6, 0.6]} />
          <meshStandardMaterial color="#0d0d0f" />
        </mesh>
        <mesh position={[0, 0, 0.35]}>
          <boxGeometry args={[24, 4, 0.1]} />
          <meshStandardMaterial
            color="#ffa116"
            emissive="#ffa116"
            emissiveIntensity={3}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.42]}>
          <boxGeometry args={[22, 3, 0.1]} />
          <meshStandardMaterial color="#0a0a0d" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Animated Metro Train ─────────────────────────────────────────
interface TrainProps {
  segment: TrackSegment;
  speedMultiplier?: number;
}

function MetroTrain({ segment, speedMultiplier = 1.0 }: TrainProps) {
  const trainRef = useRef<THREE.Group>(null);

  const dir = useMemo(
    () => new THREE.Vector3().subVectors(segment.end, segment.start),
    [segment],
  );
  const length = useMemo(() => dir.length(), [dir]);
  const normDir = useMemo(() => dir.clone().normalize(), [dir]);
  const angle = useMemo(() => Math.atan2(dir.x, dir.z), [dir]);

  useFrame(({ clock }) => {
    if (!trainRef.current) return;

    // Train cycle loop: speed up, glide, slow down at station
    const time = clock.getElapsedTime() * 0.08 * speedMultiplier;
    // We want the t parameter to pause at 0 and 1 representing the stations
    const progress = (Math.sin(time * Math.PI - Math.PI / 2) + 1) / 2; // Smooth sine ramp 0 -> 1 -> 0

    const trainPos = new THREE.Vector3()
      .addScaledVector(normDir, progress * length)
      .add(segment.start);
    trainRef.current.position.copy(trainPos);

    // Smooth coach bobbing
    const bob = Math.sin(clock.getElapsedTime() * 8) * 0.15;
    trainRef.current.position.y = segment.start.y + bob;
  });

  // Render 3 coaches connected to each other
  return (
    <group ref={trainRef} rotation={[0, angle, 0]}>
      {[-24, 0, 24].map((offsetZ) => (
        <group key={offsetZ} position={[0, 2.5, offsetZ]}>
          {/* Coach Body (Silver grey metallic) */}
          <mesh>
            <boxGeometry args={[6.5, 5, 22]} />
            <meshStandardMaterial
              color="#a0a5ad"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          {/* Window bands (Black glass + neon yellow lit) */}
          {[-8, -4, 0, 4, 8].map((wZ) =>
            [-1.1, 1.1].map((side) => (
              <group key={`win-${wZ}-${side}`} position={[3.3 * side, 1.2, wZ]}>
                <mesh>
                  <boxGeometry args={[0.1, 1.5, 2.2]} />
                  <meshStandardMaterial
                    color="#00ffcc"
                    emissive="#00ffcc"
                    emissiveIntensity={1.8}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            )),
          )}
          {/* Orange streak details */}
          <mesh position={[0, -1.2, 0]}>
            <boxGeometry args={[6.7, 0.4, 22.2]} />
            <meshStandardMaterial
              color="#ffa116"
              emissive="#ffa116"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Front Headlight (on lead coach depending on direction of travel) */}
      <mesh position={[0, 2.2, 37]}>
        <sphereGeometry args={[0.8, 8, 6]} />
        <meshStandardMaterial
          color="#fff"
          emissive="#fff"
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ─── Main Elevated Track & Pillars Assembly ───────────────────────
export default function MetroSystem() {
  const o = DISTRICT_ORIGINS;

  // Define elevated track paths (Y=40)
  const trackSegments = useMemo<TrackSegment[]>(() => {
    const list: TrackSegment[] = [];

    // Track 1: Downtown (Bengaluru) to Delhi (fullstack) - Offset outside city perimeters by [+450, 0, +450]
    if (o.downtown && o.fullstack) {
      list.push({
        start: new THREE.Vector3(o.downtown[0] + 450, 40, o.downtown[2] + 450),
        end: new THREE.Vector3(o.fullstack[0] + 450, 40, o.fullstack[2] + 450),
        name: "bengaluru-delhi",
      });
    }

    // Track 2: Delhi (fullstack) to Kolkata (devops) - Offset outside city perimeters by [+450, 0, +450]
    if (o.fullstack && o.devops) {
      list.push({
        start: new THREE.Vector3(
          o.fullstack[0] + 450,
          40,
          o.fullstack[2] + 450,
        ),
        end: new THREE.Vector3(o.devops[0] + 450, 40, o.devops[2] + 450),
        name: "delhi-kolkata",
      });
    }

    return list;
  }, [o]);

  const railsAndPillars = useMemo(() => {
    const pillars: React.ReactNode[] = [];
    const rails: React.ReactNode[] = [];
    const step = 300;

    trackSegments.forEach((segment) => {
      const dir = new THREE.Vector3().subVectors(segment.end, segment.start);
      const length = dir.length();
      const normDir = dir.clone().normalize();
      const angle = Math.atan2(dir.x, dir.z);
      const center = new THREE.Vector3()
        .addVectors(segment.start, segment.end)
        .multiplyScalar(0.5);

      // Track beams structure
      rails.push(
        <group
          key={`track-${segment.name}`}
          position={[center.x, 39.5, center.z]}
          rotation={[0, angle, 0]}
        >
          {/* Main viaduct bed */}
          <mesh>
            <boxGeometry args={[14, 1.2, length]} />
            <meshStandardMaterial color="#50525c" roughness={0.8} />
          </mesh>
          {/* Left Rail line */}
          <mesh position={[-3.5, 1.0, 0]}>
            <boxGeometry args={[0.5, 0.4, length]} />
            <meshStandardMaterial
              color="#ffa116"
              emissive="#ffa116"
              emissiveIntensity={1.0}
              toneMapped={false}
            />
          </mesh>
          {/* Right Rail line */}
          <mesh position={[3.5, 1.0, 0]}>
            <boxGeometry args={[0.5, 0.4, length]} />
            <meshStandardMaterial
              color="#ffa116"
              emissive="#ffa116"
              emissiveIntensity={1.0}
              toneMapped={false}
            />
          </mesh>
        </group>,
      );

      // Support pillars
      for (let d = step; d < length - step; d += step) {
        const pos = new THREE.Vector3()
          .addScaledVector(normDir, d)
          .add(segment.start);
        pillars.push(
          <group key={`metro-pill-${segment.name}-${d}`}>
            {/* Main support column */}
            <mesh position={[pos.x, 20, pos.z]}>
              <cylinderGeometry args={[2.8, 3.8, 40, 6]} />
              <meshStandardMaterial color="#42454f" roughness={0.85} />
            </mesh>
            {/* T-bar lintel supporting the tracks */}
            <mesh position={[pos.x, 39, pos.z]} rotation={[0, angle, 0]}>
              <boxGeometry args={[16, 2, 4.5]} />
              <meshStandardMaterial color="#32353d" roughness={0.9} />
            </mesh>
          </group>,
        );
      }
    });

    return { pillars, rails };
  }, [trackSegments]);

  return (
    <group>
      {/* Rails & Pillars */}
      {railsAndPillars.rails}
      {railsAndPillars.pillars}

      {/* Stations */}
      {o.downtown && (
        <MetroStation
          position={[o.downtown[0] + 450, 0, o.downtown[2] + 450]}
          name="BENGALURU CENTRAL"
        />
      )}
      {o.fullstack && (
        <MetroStation
          position={[o.fullstack[0] + 450, 0, o.fullstack[2] + 450]}
          name="DELHI JUNCTION"
        />
      )}
      {o.devops && (
        <MetroStation
          position={[o.devops[0] + 450, 0, o.devops[2] + 450]}
          name="KOLKATA TERMINUS"
        />
      )}

      {/* Animated Metro Trains running on the track segments */}
      {trackSegments.map((seg, idx) => (
        <MetroTrain
          key={`train-${idx}`}
          segment={seg}
          speedMultiplier={idx % 2 === 0 ? 1.0 : 1.2}
        />
      ))}
    </group>
  );
}
