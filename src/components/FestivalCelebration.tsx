"use client";

import { memo, useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Festival = "diwali" | "holi" | "tricolor" | "eid" | "christmas" | null;

// Get the active festival based on date or url override
export function getActiveFestival(date: Date, override?: string | null): Festival {
  if (override) {
    const norm = override.toLowerCase();
    if (norm === "diwali") return "diwali";
    if (norm === "holi") return "holi";
    if (norm === "tricolor" || norm === "republic" || norm === "independence") return "tricolor";
    if (norm === "eid") return "eid";
    if (norm === "christmas" || norm === "newyear" || norm === "xmas") return "christmas";
  }

  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1-indexed
  const d = date.getDate();

  // 1. Republic Day (Jan 26) & Independence Day (Aug 15)
  if ((m === 1 && d === 26) || (m === 8 && d === 15)) {
    return "tricolor";
  }

  // 2. Christmas / New Year holiday season (Dec 24 - Jan 2)
  if ((m === 12 && d >= 24) || (m === 1 && d <= 2)) {
    return "christmas";
  }

  // 3. Holi (approximate dates for 2026-2030)
  if (
    (y === 2026 && m === 3 && d === 3) ||
    (y === 2027 && m === 3 && d === 22) ||
    (y === 2028 && m === 3 && d === 11) ||
    (y === 2029 && m === 3 && d === 1) ||
    (y === 2030 && m === 3 && d === 19)
  ) {
    return "holi";
  }

  // 4. Diwali (approximate dates for 2026-2030)
  if (
    (y === 2026 && m === 11 && d === 8) ||
    (y === 2027 && m === 10 && d === 29) ||
    (y === 2028 && m === 11 && d === 17) ||
    (y === 2029 && m === 11 && d === 5) ||
    (y === 2030 && m === 10 && d === 26)
  ) {
    return "diwali";
  }

  // 5. Eid (approximate major dates for Eid al-Fitr / Eid al-Adha 2026-2030)
  if (
    (y === 2026 && ((m === 3 && d === 20) || (m === 5 && d === 27))) ||
    (y === 2027 && ((m === 3 && d === 10) || (m === 5 && d === 17))) ||
    (y === 2028 && ((m === 2 && d === 27) || (m === 5 && d === 5))) ||
    (y === 2029 && ((m === 2 && d === 16) || (m === 4 && d === 25))) ||
    (y === 2030 && ((m === 2 && d === 5) || (m === 4 && d === 14)))
  ) {
    return "eid";
  }

  return null;
}

interface FestivalCelebrationProps {
  cityRadius: number;
  festivalOverride?: string | null;
}

export default memo(function FestivalCelebration({
  cityRadius,
  festivalOverride,
}: FestivalCelebrationProps) {
  const [festival, setFestival] = useState<Festival>(null);

  useEffect(() => {
    // Recalculate once on mount or when override changes
    setFestival(getActiveFestival(new Date(), festivalOverride));
  }, [festivalOverride]);

  if (!festival) return null;

  return (
    <>
      {festival === "diwali" && <DiwaliCelebration cityRadius={cityRadius} />}
      {festival === "holi" && <HoliCelebration cityRadius={cityRadius} />}
      {festival === "tricolor" && <TricolorCelebration cityRadius={cityRadius} />}
      {festival === "eid" && <EidCelebration cityRadius={cityRadius} />}
      {festival === "christmas" && <ChristmasCelebration cityRadius={cityRadius} />}
    </>
  );
});

// ─────────────────────────────────────────────────────────────
// DIWALI CELEBRATION (Festival of Lights)
// Warm lanterns floating up, golden sparkler explosions
// ─────────────────────────────────────────────────────────────
const DIWALI_LANTERN_COUNT = 80;
const DIWALI_SPARK_COUNT = 400;

function DiwaliCelebration({ cityRadius }: { cityRadius: number }) {
  const lanternsRef = useRef<THREE.Points>(null);
  const sparklersRef = useRef<THREE.Points>(null);

  // Lanterns: float slowly upwards
  const lanternData = useMemo(() => {
    const positions = new Float32Array(DIWALI_LANTERN_COUNT * 3);
    const speeds = new Float32Array(DIWALI_LANTERN_COUNT);
    for (let i = 0; i < DIWALI_LANTERN_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * cityRadius * 0.9;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      speeds[i] = 2.0 + Math.random() * 5.0;
    }
    return { positions, speeds };
  }, [cityRadius]);

  // Sparklers: rocket shell states
  const sparklers = useMemo(() => {
    const positions = new Float32Array(DIWALI_SPARK_COUNT * 3);
    const velocities = new Float32Array(DIWALI_SPARK_COUNT * 3);
    const colors = new Float32Array(DIWALI_SPARK_COUNT * 3);

    // Initialize in a resting state (below ground)
    for (let i = 0; i < DIWALI_SPARK_COUNT; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;
    }

    return { positions, velocities, colors };
  }, []);

  const shells = useRef([
    { active: false, timer: 0, x: 0, y: 0, z: 0, burstHeight: 60, progress: 0 },
    { active: false, timer: 0, x: 0, y: 0, z: 0, burstHeight: 80, progress: 0 },
    { active: false, timer: 0, x: 0, y: 0, z: 0, burstHeight: 70, progress: 0 },
  ]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // 1. Update Lanterns
    if (lanternsRef.current) {
      const posAttr = lanternsRef.current.geometry.attributes.position;
      const posArr = posAttr.array as Float32Array;
      for (let i = 0; i < DIWALI_LANTERN_COUNT; i++) {
        posArr[i * 3 + 1] += lanternData.speeds[i] * dt;
        // Sway slightly
        posArr[i * 3] += Math.sin(posArr[i * 3 + 1] * 0.05 + i) * 2.0 * dt;
        // Reset when too high
        if (posArr[i * 3 + 1] > 120) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * cityRadius * 0.9;
          posArr[i * 3] = Math.cos(angle) * r;
          posArr[i * 3 + 1] = 0;
          posArr[i * 3 + 2] = Math.sin(angle) * r;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 2. Update Sparkler/Firecracker Shells & Particles
    if (sparklersRef.current) {
      const posAttr = sparklersRef.current.geometry.attributes.position;
      const colAttr = sparklersRef.current.geometry.attributes.color;
      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;

      // Handle shells launch and burst
      shells.current.forEach((shell, index) => {
        if (!shell.active) {
          // Launch a new shell periodically
          if (Math.random() < 0.015) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * cityRadius * 0.6;
            shell.x = Math.cos(angle) * r;
            shell.z = Math.sin(angle) * r;
            shell.y = 0;
            shell.burstHeight = 60 + Math.random() * 50;
            shell.timer = 0;
            shell.active = true;
            shell.progress = 0; // 0 = rising, 1 = exploding
          }
        } else {
          shell.timer += dt;
          const particlesPerShell = Math.floor(DIWALI_SPARK_COUNT / shells.current.length);
          const startIdx = index * particlesPerShell;

          if (shell.progress === 0) {
            // Rising trail
            shell.y += 60 * dt;
            for (let p = 0; p < particlesPerShell; p++) {
              const idx = (startIdx + p) * 3;
              // Sparkles trailing behind rising shell
              posArr[idx] = shell.x + (Math.random() - 0.5) * 2;
              posArr[idx + 1] = Math.max(0, shell.y - Math.random() * 5);
              posArr[idx + 2] = shell.z + (Math.random() - 0.5) * 2;

              // Spark color (golden yellow)
              colArr[idx] = 1.0;
              colArr[idx + 1] = 0.8 + Math.random() * 0.2;
              colArr[idx + 2] = 0.2;
            }

            if (shell.y >= shell.burstHeight) {
              // Explode!
              shell.progress = 1;
              shell.timer = 0;
              // Distribute explosion velocities
              for (let p = 0; p < particlesPerShell; p++) {
                const idx = (startIdx + p) * 3;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 2 - 1);
                const speed = 15 + Math.random() * 25;
                sparklers.velocities[idx] = Math.sin(phi) * Math.cos(theta) * speed;
                sparklers.velocities[idx + 1] = Math.sin(phi) * Math.sin(theta) * speed;
                sparklers.velocities[idx + 2] = Math.cos(phi) * speed;

                posArr[idx] = shell.x;
                posArr[idx + 1] = shell.y;
                posArr[idx + 2] = shell.z;
              }
            }
          } else {
            // Exploding particles flying out
            const decay = Math.max(0, 1 - shell.timer * 0.9); // fade in 1.1s
            for (let p = 0; p < particlesPerShell; p++) {
              const idx = (startIdx + p) * 3;

              posArr[idx] += sparklers.velocities[idx] * dt;
              posArr[idx + 1] += sparklers.velocities[idx + 1] * dt;
              posArr[idx + 2] += sparklers.velocities[idx + 2] * dt;

              // Pull down with gravity
              sparklers.velocities[idx + 1] -= 9.8 * dt;

              // Fade colors to orange/red
              colArr[idx] = 1.0 * decay;
              colArr[idx + 1] = (0.7 * decay) + (Math.random() * 0.1);
              colArr[idx + 2] = 0.1 * decay;
            }

            if (shell.timer > 1.2) {
              shell.active = false;
            }
          }
        }
      });

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Golden lanterns floating up */}
      <points ref={lanternsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lanternData.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={2.5}
          color="#ffaa33"
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Sparklers fireworks */}
      <points ref={sparklersRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparklers.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[sparklers.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={1.8}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HOLI CELEBRATION (Festival of Colors)
// High-velocity color powder sprays from street-level cannons
// ─────────────────────────────────────────────────────────────
const HOLI_GUNS_COUNT = 6;
const PARTICLES_PER_GUN = 80;
const TOTAL_HOLI_PARTICLES = HOLI_GUNS_COUNT * PARTICLES_PER_GUN;

const HOLI_COLORS = [
  new THREE.Color("#ff007f"), // gulal pink
  new THREE.Color("#00ffff"), // cyan
  new THREE.Color("#ffff00"), // yellow
  new THREE.Color("#39ff14"), // neon green
  new THREE.Color("#ff5f1f"), // neon orange
  new THREE.Color("#bd00ff"), // neon purple
];

function HoliCelebration({ cityRadius }: { cityRadius: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const guns = useMemo(() => {
    const list = [];
    for (let i = 0; i < HOLI_GUNS_COUNT; i++) {
      const angle = (i / HOLI_GUNS_COUNT) * Math.PI * 2;
      const r = cityRadius * 0.45;
      list.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        colorIndex: i % HOLI_COLORS.length,
        shootTimer: Math.random() * 2, // staggered starts
      });
    }
    return list;
  }, [cityRadius]);

  const { positions, colors, velocities, lifetimes } = useMemo(() => {
    const pos = new Float32Array(TOTAL_HOLI_PARTICLES * 3);
    const col = new Float32Array(TOTAL_HOLI_PARTICLES * 3);
    const vel = new Float32Array(TOTAL_HOLI_PARTICLES * 3);
    const life = new Float32Array(TOTAL_HOLI_PARTICLES); // stores elapsed life time

    for (let g = 0; g < HOLI_GUNS_COUNT; g++) {
      const base = g * PARTICLES_PER_GUN;
      const color = HOLI_COLORS[guns[g].colorIndex];

      for (let p = 0; p < PARTICLES_PER_GUN; p++) {
        const idx = (base + p) * 3;
        pos[idx] = guns[g].x;
        pos[idx + 1] = -50; // hide below ground until fired
        pos[idx + 2] = guns[g].z;

        col[idx] = color.r;
        col[idx + 1] = color.g;
        col[idx + 2] = color.b;

        life[base + p] = 999.0; // dead initially
      }
    }

    return { positions: pos, colors: col, velocities: vel, lifetimes: life };
  }, [guns]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const dt = Math.min(delta, 0.05);

    const posAttr = pointsRef.current.geometry.attributes.position;
    const colAttr = pointsRef.current.geometry.attributes.color;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;

    guns.forEach((gun, gIndex) => {
      gun.shootTimer += dt;
      const base = gIndex * PARTICLES_PER_GUN;

      // Every 2.5 seconds, the cannon blasts a colorful gulal spray
      if (gun.shootTimer > 2.5) {
        gun.shootTimer = 0;
        const color = HOLI_COLORS[Math.floor(Math.random() * HOLI_COLORS.length)];

        for (let p = 0; p < PARTICLES_PER_GUN; p++) {
          const pIdx = base + p;
          const idx = pIdx * 3;

          // Spawn at cannon position
          posArr[idx] = gun.x;
          posArr[idx + 1] = 0;
          posArr[idx + 2] = gun.z;

          // Random upward blast velocities
          const angle = Math.random() * Math.PI * 2;
          const spread = 8.0 + Math.random() * 10.0;
          velocities[idx] = Math.cos(angle) * spread;
          velocities[idx + 1] = 20.0 + Math.random() * 25.0; // Shoot up!
          velocities[idx + 2] = Math.sin(angle) * spread;

          // Assign selected color
          colArr[idx] = color.r;
          colArr[idx + 1] = color.g;
          colArr[idx + 2] = color.b;

          lifetimes[pIdx] = 0.0; // reset lifetime
        }
      }

      // Update active particles
      for (let p = 0; p < PARTICLES_PER_GUN; p++) {
        const pIdx = base + p;
        const idx = pIdx * 3;

        if (lifetimes[pIdx] < 2.0) {
          lifetimes[pIdx] += dt;

          // Apply physics
          posArr[idx] += velocities[idx] * dt;
          posArr[idx + 1] += velocities[idx + 1] * dt;
          posArr[idx + 2] += velocities[idx + 2] * dt;

          // Gravity pull down and wind resistance
          velocities[idx + 1] -= 12 * dt;
          velocities[idx] *= Math.max(0.2, 1 - 0.5 * dt);
          velocities[idx + 2] *= Math.max(0.2, 1 - 0.5 * dt);

          // Bounce off ground gently
          if (posArr[idx + 1] < 0) {
            posArr[idx + 1] = 0;
            velocities[idx + 1] = -velocities[idx + 1] * 0.3; // bounce slightly
          }
        } else {
          // Dead, hide under ground
          posArr[idx + 1] = -50;
        }
      }
    });

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={3.0}
        vertexColors
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// TRICOLOR CELEBRATION (Independence Day / Republic Day)
// Indian Flag waving in the sky with Ashoka Chakra, and spark fountains on the ground
// ─────────────────────────────────────────────────────────────
const FLAG_COLS = 60;
const FLAG_ROWS = 36;
const TRICOLOR_PARTICLE_COUNT = 300;
const TRICOLOR_COLORS = [
  new THREE.Color("#FF9933"), // Saffron
  new THREE.Color("#FFFFFF"), // White
  new THREE.Color("#138808"), // Green
];

function TricolorCelebration({ cityRadius }: { cityRadius: number }) {
  const flagRef = useRef<THREE.Points>(null);
  const fountainsRef = useRef<THREE.Points>(null);

  // 1. Grid geometry for the giant waving Indian flag in the sky
  const flagGrid = useMemo(() => {
    const total = FLAG_COLS * FLAG_ROWS;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);

    for (let r = 0; r < FLAG_ROWS; r++) {
      for (let c = 0; c < FLAG_COLS; c++) {
        const u = c / (FLAG_COLS - 1);
        const v = r / (FLAG_ROWS - 1);
        const idx = (r * FLAG_COLS + c) * 3;

        // Base coordinates: attached to tower at X=0, Z=0, flying on the top section of the spire
        const baseX = u * 90;
        const baseY = 730 + v * 54;
        const baseZ = 0;

        pos[idx] = baseX;
        pos[idx + 1] = baseY;
        pos[idx + 2] = baseZ;

        // Stripe colors
        let color = new THREE.Color("#FFFFFF"); // White center
        if (v >= 2 / 3) {
          color = new THREE.Color("#FF9933"); // Saffron top
        } else if (v <= 1 / 3) {
          color = new THREE.Color("#138808"); // Green bottom
        } else {
          // Ashoka Chakra check (placed in the middle of white stripe)
          const dx = (u - 0.5) * 90;
          const dy = (v - 0.5) * 54;
          const dist = Math.sqrt(dx * dx + dy * dy * 2.7);

          if (dist < 8.0) {
            // Compute angle to draw spokes
            const theta = Math.atan2(dy * 1.67, dx);
            const step = Math.PI / 12; // 24 spokes
            const isSpoke = Math.abs((theta + Math.PI * 2) % step) < 0.08 || Math.abs(step - ((theta + Math.PI * 2) % step)) < 0.08;

            if (dist < 1.6 || dist > 7.0 || isSpoke) {
              color = new THREE.Color("#000080"); // Navy Blue Chakra
            }
          }
        }

        col[idx] = color.r;
        col[idx + 1] = color.g;
        col[idx + 2] = color.b;
      }
    }
    return { positions: pos, colors: col };
  }, []);

  // 2. Fountains: color spark fountain jets below on the ground
  const { fountainPositions, fountainColors, fountainVelocities, fountainPhases } = useMemo(() => {
    const pos = new Float32Array(TRICOLOR_PARTICLE_COUNT * 3);
    const col = new Float32Array(TRICOLOR_PARTICLE_COUNT * 3);
    const vel = new Float32Array(TRICOLOR_PARTICLE_COUNT * 3);
    const phs = new Float32Array(TRICOLOR_PARTICLE_COUNT);

    for (let i = 0; i < TRICOLOR_PARTICLE_COUNT; i++) {
      const section = i % 3; // 0=Saffron, 1=White, 2=Green
      const angle = (section / 3) * Math.PI * 2;
      const r = cityRadius * 0.15;

      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      const tc = TRICOLOR_COLORS[section];
      col[i * 3] = tc.r;
      col[i * 3 + 1] = tc.g;
      col[i * 3 + 2] = tc.b;

      vel[i * 3] = (Math.random() - 0.5) * 5;
      vel[i * 3 + 1] = 30 + Math.random() * 40;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 5;

      phs[i] = Math.random() * 2.0;
    }

    return { fountainPositions: pos, fountainColors: col, fountainVelocities: vel, fountainPhases: phs };
  }, [cityRadius]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);

    // Update Waving Flag
    if (flagRef.current) {
      const time = state.clock.getElapsedTime();
      const posAttr = flagRef.current.geometry.attributes.position;
      const posArr = posAttr.array as Float32Array;

      for (let r = 0; r < FLAG_ROWS; r++) {
        for (let c = 0; c < FLAG_COLS; c++) {
          const idx = (r * FLAG_COLS + c) * 3;
          const u = c / (FLAG_COLS - 1);
          const v = r / (FLAG_ROWS - 1);

          const baseX = u * 90;
          const baseY = 730 + v * 54;
          const baseZ = 0;

          // Wave propagation equation: waves move left to right (pole is at u=0)
          // Amplitude increases from 0 at the pole (left) to maximum at the tip (right)
          const amp = u * 12.0;
          const speed = 4.0;
          const waveFreq = 0.06;

          const zOffset = Math.sin(time * speed - baseX * waveFreq) * amp;
          const zSecondary = Math.cos(time * speed * 2.0 - baseX * waveFreq * 1.5) * amp * 0.25;
          const yOffset = Math.cos(time * speed * 0.9 - baseX * waveFreq * 0.8) * amp * 0.15;

          posArr[idx] = baseX;
          posArr[idx + 1] = baseY + yOffset;
          posArr[idx + 2] = baseZ + zOffset + zSecondary;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Update Fountains
    if (fountainsRef.current) {
      const posAttr = fountainsRef.current.geometry.attributes.position;
      const posArr = posAttr.array as Float32Array;

      for (let i = 0; i < TRICOLOR_PARTICLE_COUNT; i++) {
        const idx = i * 3;
        fountainPhases[i] += dt;

        if (fountainPhases[i] > 0) {
          posArr[idx] += fountainVelocities[idx] * dt;
          posArr[idx + 1] += fountainVelocities[idx + 1] * dt;
          posArr[idx + 2] += fountainVelocities[idx + 2] * dt;

          fountainVelocities[idx + 1] -= 15 * dt; // gravity

          if (posArr[idx + 1] <= 0 && fountainVelocities[idx + 1] < 0) {
            const section = i % 3;
            const angle = (section / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const r = cityRadius * 0.15;

            posArr[idx] = Math.cos(angle) * r;
            posArr[idx + 1] = 0;
            posArr[idx + 2] = Math.sin(angle) * r;

            fountainVelocities[idx] = (Math.random() - 0.5) * 10;
            fountainVelocities[idx + 1] = 40 + Math.random() * 35;
            fountainVelocities[idx + 2] = (Math.random() - 0.5) * 10;
          }
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Waving Indian Flag */}
      <points ref={flagRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[flagGrid.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[flagGrid.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={3.0}
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Tri-color ground sparks fountains */}
      <points ref={fountainsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fountainPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[fountainColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={2.2}
          vertexColors
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// EID CELEBRATION
// Floating emerald green and gold starry points
// ─────────────────────────────────────────────────────────────
const EID_STAR_COUNT = 120;

function EidCelebration({ cityRadius }: { cityRadius: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const starData = useMemo(() => {
    const pos = new Float32Array(EID_STAR_COUNT * 3);
    const col = new Float32Array(EID_STAR_COUNT * 3);
    const spds = new Float32Array(EID_STAR_COUNT);
    const phaseOffset = new Float32Array(EID_STAR_COUNT);

    for (let i = 0; i < EID_STAR_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * cityRadius * 0.95;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = 10 + Math.random() * 80;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      // Alternating green (#10b981) and gold (#fbbf24) colors
      const isGreen = i % 2 === 0;
      const color = isGreen ? new THREE.Color("#10b981") : new THREE.Color("#fbbf24");
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;

      spds[i] = 1.0 + Math.random() * 3.0;
      phaseOffset[i] = Math.random() * Math.PI * 2;
    }

    return { positions: pos, colors: col, speeds: spds, phaseOffset };
  }, [cityRadius]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const dt = Math.min(delta, 0.05);

    const posAttr = pointsRef.current.geometry.attributes.position;
    const posArr = posAttr.array as Float32Array;

    for (let i = 0; i < EID_STAR_COUNT; i++) {
      // Gentle drift upward
      posArr[i * 3 + 1] += starData.speeds[i] * dt;
      // Float horizontally like stars drifting
      posArr[i * 3] += Math.sin(state.clock.elapsedTime * 0.3 + starData.phaseOffset[i]) * 1.5 * dt;

      if (posArr[i * 3 + 1] > 100) {
        posArr[i * 3 + 1] = 5; // Reset down low
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[starData.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[starData.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={2.0}
        vertexColors
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// CHRISTMAS & NEW YEAR CELEBRATION
// Gentle snowy weather across the city
// ─────────────────────────────────────────────────────────────
const SNOW_FLAKE_COUNT = 1500;

function ChristmasCelebration({ cityRadius }: { cityRadius: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const snowData = useMemo(() => {
    const pos = new Float32Array(SNOW_FLAKE_COUNT * 3);
    const vels = new Float32Array(SNOW_FLAKE_COUNT); // fall speeds
    const sways = new Float32Array(SNOW_FLAKE_COUNT); // lateral sways

    for (let i = 0; i < SNOW_FLAKE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * cityRadius * 1.1;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.random() * 140;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      vels[i] = 12.0 + Math.random() * 16.0; // moderate snowfall speed
      sways[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, velocities: vels, sways };
  }, [cityRadius]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const dt = Math.min(delta, 0.05);

    const posAttr = pointsRef.current.geometry.attributes.position;
    const posArr = posAttr.array as Float32Array;

    for (let i = 0; i < SNOW_FLAKE_COUNT; i++) {
      // Fall down
      posArr[i * 3 + 1] -= snowData.velocities[i] * dt;
      // Sway in the wind
      posArr[i * 3] += Math.sin(state.clock.elapsedTime * 0.8 + snowData.sways[i]) * 2.5 * dt;

      // Reset to cloud height if hit ground
      if (posArr[i * 3 + 1] < 0) {
        posArr[i * 3 + 1] = 140;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * cityRadius * 1.1;
        posArr[i * 3] = Math.cos(angle) * r;
        posArr[i * 3 + 2] = Math.sin(angle) * r;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[snowData.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={1.6}
        color="#ffffff"
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
}
