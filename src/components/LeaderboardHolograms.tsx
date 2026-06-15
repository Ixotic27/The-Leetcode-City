"use client";

import React, { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";

interface LeaderboardHologramsProps {
  buildings: CityBuilding[];
  onBuildingClick?: (building: CityBuilding) => void;
}

interface PedestalConfig {
  type: "contributor" | "competitor" | "survivor";
  title: string;
  subtitle: string;
  color: string;
  glowColor: string;
  angle: number;
}

export default function LeaderboardHolograms({
  buildings,
  onBuildingClick,
}: LeaderboardHologramsProps) {
  // Identify the Top 3 Developers
  const topDevs = useMemo(() => {
    if (!buildings || buildings.length === 0) return null;

    // 1. Top Contributor: Highest contributions (solved problems)
    const contributorList = [...buildings].sort((a, b) => b.contributions - a.contributions);
    const topContributor = contributorList[0];

    // 2. Top Competitor: Highest contest_rating, excluding Top Contributor
    const competitorList = [...buildings]
      .filter((b) => b.login !== topContributor?.login && (b.contest_rating ?? 0) > 0)
      .sort((a, b) => (b.contest_rating ?? 0) - (a.contest_rating ?? 0));
    const topCompetitor = competitorList[0] || contributorList[1]; // fallback to 2nd contributor

    // 3. Top Survivor: Highest active streak (lc_streak or app_streak), excluding the top 2
    const topTwoLogins = new Set([topContributor?.login, topCompetitor?.login].filter(Boolean));
    const survivorList = [...buildings]
      .filter((b) => !topTwoLogins.has(b.login))
      .sort((a, b) => {
        const streakA = Math.max(a.lc_streak ?? 0, a.app_streak ?? 0);
        const streakB = Math.max(b.lc_streak ?? 0, b.app_streak ?? 0);
        return streakB - streakA;
      });
    const topSurvivor = survivorList[0] || contributorList[2]; // fallback to 3rd contributor

    return {
      contributor: topContributor,
      competitor: topCompetitor,
      survivor: topSurvivor,
    };
  }, [buildings]);

  // Pedestal layouts around the Spire (radius = 56, angles = 0, 2π/3, 4π/3)
  const RADIUS = 56;
  const pedestalConfigs: PedestalConfig[] = [
    {
      type: "contributor",
      title: "🏆 TOP SOLVER",
      subtitle: "Most LeetCode Problems Solved",
      color: "#10b981", // Emerald Green
      glowColor: "rgba(16,185,129,0.7)",
      angle: 0,
    },
    {
      type: "competitor",
      title: "⚔️ TOP COMPETITOR",
      subtitle: "Highest LeetCode Contest Rating",
      color: "#f59e0b", // Amber Orange
      glowColor: "rgba(245,158,11,0.7)",
      angle: (2 * Math.PI) / 3,
    },
    {
      type: "survivor",
      title: "🔥 STREAK SURVIVOR",
      subtitle: "Longest Active Coding Streak",
      color: "#06b6d4", // Cyan Blue
      glowColor: "rgba(6,182,212,0.7)",
      angle: (4 * Math.PI) / 3,
    },
  ];

  if (!topDevs) return null;

  return (
    <group>
      {pedestalConfigs.map((config) => {
        const dev =
          config.type === "contributor"
            ? topDevs.contributor
            : config.type === "competitor"
            ? topDevs.competitor
            : topDevs.survivor;

        if (!dev) return null;

        const x = RADIUS * Math.cos(config.angle);
        const z = RADIUS * Math.sin(config.angle);

        // Ground is at y = 0.2. Base of pedestal is on ground.
        // Pedestal is 8 units high, so center y is 4.2.
        const pedestalPos: [number, number, number] = [x, 4.2, z];
        const hologramPos: [number, number, number] = [x, 13, z];

        const handleSelect = () => {
          if (onBuildingClick) {
            onBuildingClick(dev);
          }
        };

        return (
          <group key={config.type}>
            {/* Hologram Pedestal */}
            <Pedestal
              position={pedestalPos}
              color={config.color}
              onClick={handleSelect}
            />

            {/* Glowing Hologram Building and Projector Beams */}
            <HologramBuilding
              position={hologramPos}
              dev={dev}
              color={config.color}
              onClick={handleSelect}
            />
          </group>
        );
      })}
    </group>
  );
}

// ─── Pedestal Subcomponent ───────────────────────────────────
interface PedestalProps {
  position: [number, number, number];
  color: string;
  onClick: () => void;
}

function Pedestal({ position, color, onClick }: PedestalProps) {
  const [hovered, setHovered] = useState(false);

  // Capture phase handling to trigger custom pointer events cleanly
  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "auto";
  };

  return (
    <group
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Pedestal Base Body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[5, 6, 8, 8]} />
        <meshStandardMaterial
          color={hovered ? "#262626" : "#141414"}
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>

      {/* Top Glowing Trim */}
      <mesh position={[0, 4.1, 0]}>
        <cylinderGeometry args={[4.8, 4.8, 0.3, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 3.5 : 2.0}
        />
      </mesh>

      {/* Under-Glow Aura (faint light below) */}
      <mesh position={[0, -3.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5, 6.5, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* Projection Spotlight Cone (Beam of light shooting up) */}
      <mesh position={[0, 6.5, 0]}>
        <cylinderGeometry args={[4.2, 4.8, 5, 8, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.12 : 0.06}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Hologram Building Subcomponent ───────────────────────────
interface HologramBuildingProps {
  position: [number, number, number];
  dev: CityBuilding;
  color: string;
  onClick: () => void;
}

function HologramBuilding({ position, dev, color, onClick }: HologramBuildingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Rotate hologram slowly
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.45;
      // Soft floating bobbing effect
      groupRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 1.5) * 0.35;
    }
  });

  // Scale down custom building dimensions to fit hologram style
  const SCALE_FACTOR = 0.085;
  const w = Math.max(15, dev.width || 30) * SCALE_FACTOR;
  const d = Math.max(15, dev.depth || 30) * SCALE_FACTOR;
  const h = Math.max(30, dev.height || 100) * SCALE_FACTOR;
  const floors = Math.max(1, dev.floors || 3);

  // Precompute heights for floor markers
  const floorMarkers = useMemo(() => {
    const markers = [];
    const floorHeight = h / floors;
    for (let i = 1; i < floors; i++) {
      markers.push(i * floorHeight - h / 2);
    }
    return markers;
  }, [h, floors]);

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Volumetric Glowing Core */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w * 0.95, h * 0.95, d * 0.95]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.25 : 0.12}
        />
      </mesh>

      {/* Main Outer Wireframe Structure */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial
          color={color}
          wireframe={true}
          transparent
          opacity={hovered ? 0.75 : 0.4}
        />
      </mesh>

      {/* Floor Divider Wireframes (Horizontal panes to represent floors) */}
      {floorMarkers.map((yOffset, i) => (
        <mesh key={i} position={[0, yOffset, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial
            color={color}
            wireframe={true}
            transparent
            opacity={hovered ? 0.5 : 0.25}
          />
        </mesh>
      ))}

      {/* Orbiting Hologram Particle Ring */}
      <mesh position={[0, Math.sin(0) * (h/2), 0]} rotation={[0.2, 0, 0]}>
        <torusGeometry args={[Math.max(w, d) * 0.9, 0.1, 8, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Floating Crown / Category Icon on Top */}
      <group position={[0, h / 2 + 1.2, 0]}>
        <mesh>
          <octahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2}
          />
        </mesh>
      </group>
    </group>
  );
}
