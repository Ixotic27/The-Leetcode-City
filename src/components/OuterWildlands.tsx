"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AABB } from "@/lib/darkContinent/collision";
import {
  seededRandom,
  noise2D,
  fbmNoise,
  getTerrainHeight,
} from "@/lib/darkContinent/terrain";
import {
  ZONE_COUNT,
  getZone,
  getZoneWeight,
  ZONE_PALETTES,
} from "@/lib/darkContinent/zones";

// ─── Props ──────────────────────────────────────────────────────
interface OuterWildlandsProps {
  innerR?: number;
  outerR?: number;
  collisionRegistryRef?: React.MutableRefObject<AABB[]>;
  // Legacy props kept for city compatibility
  cityRadius?: number;
  themeIndex?: number;
}

// ─── Shared geometries ──────────────────────────────────────────
const _box = new THREE.BoxGeometry(1, 1, 1);
const _cyl = new THREE.CylinderGeometry(1, 1, 1, 6);
const _cone = new THREE.ConeGeometry(1, 1, 7);
const _sphere = new THREE.SphereGeometry(1, 6, 5);
const _octahedron = new THREE.OctahedronGeometry(1, 0);
const _tetra = new THREE.TetrahedronGeometry(1, 0);
const _icosa = new THREE.IcosahedronGeometry(1, 0);

// ═══════════════════════════════════════════════════════════════
// ZONE 1 — THE ANCIENT JUNGLE
// ═══════════════════════════════════════════════════════════════

function JungleTrees({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopy1Ref = useRef<THREE.InstancedMesh>(null);
  const canopy2Ref = useRef<THREE.InstancedMesh>(null);
  const canopy3Ref = useRef<THREE.InstancedMesh>(null);

  const count = 500;
  const pal = ZONE_PALETTES.jungle;

  const treeData = useMemo(() => {
    const rng = seededRandom(12345);
    const trees: { x: number; z: number; trunkH: number; trunkR: number; canopyLayers: number; variant: number }[] = [];
    const placedColossal: { x: number; z: number }[] = [];
    const placedMedium: { x: number; z: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const sizeClass = rng();
      let trunkH: number, trunkR: number, canopyLayers: number;
      if (sizeClass < 0.08) {
        // Colossal 80-block trees — enforce 80-unit minimum spacing
        trunkH = 80 + rng() * 100;
        trunkR = 6 + rng() * 10;
        canopyLayers = 4;
        const tooClose = placedColossal.some(p => Math.sqrt((p.x - x) ** 2 + (p.z - z) ** 2) < 80);
        if (tooClose) { rng(); continue; } // consume variant rng slot and skip
        placedColossal.push({ x, z });
      } else if (sizeClass < 0.25) {
        // Medium trees — enforce 40-unit minimum spacing
        trunkH = 45 + rng() * 50;
        trunkR = 3 + rng() * 5;
        canopyLayers = 3;
        const tooClose = placedMedium.some(p => Math.sqrt((p.x - x) ** 2 + (p.z - z) ** 2) < 40);
        if (tooClose) { rng(); continue; } // consume variant rng slot and skip
        placedMedium.push({ x, z });
      } else if (sizeClass < 0.6) {
        trunkH = 20 + rng() * 30;
        trunkR = 1.5 + rng() * 3;
        canopyLayers = 2;
      } else {
        trunkH = 8 + rng() * 15;
        trunkR = 0.8 + rng() * 1.5;
        canopyLayers = 1;
      }
      trees.push({ x, z, trunkH, trunkR, canopyLayers, variant: Math.floor(rng() * 4) });
    }
    return trees;
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!trunkRef.current || !canopy1Ref.current || !canopy2Ref.current || !canopy3Ref.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const canopyColors = pal.treeCanopy.map(c => new THREE.Color(c));

    for (let i = 0; i < treeData.length; i++) {
      const t = treeData[i];
      const terrainY = getTerrainHeight(t.x, t.z, 0) - 18;

      // Trunk — tall cylinder
      m.makeScale(t.trunkR, t.trunkH, t.trunkR);
      m.setPosition(t.x, terrainY + t.trunkH / 2, t.z);
      trunkRef.current.setMatrixAt(i, m);
      color.set(pal.treeTrunk);
      trunkRef.current.setColorAt(i, color);

      // Layer 1 canopy — flat wide disc
      const c1R = t.trunkR * 5 + t.trunkH * 0.15;
      m.makeScale(c1R, t.trunkH * 0.12, c1R);
      m.setPosition(t.x, terrainY + t.trunkH * 0.85, t.z);
      canopy1Ref.current.setMatrixAt(i, m);
      color.copy(canopyColors[t.variant % canopyColors.length]);
      canopy1Ref.current.setColorAt(i, color);

      // Layer 2 canopy — smaller higher disc
      if (t.canopyLayers >= 2) {
        const c2R = c1R * 0.7;
        m.makeScale(c2R, t.trunkH * 0.08, c2R);
        m.setPosition(t.x, terrainY + t.trunkH * 0.95, t.z);
      } else {
        m.makeScale(0, 0, 0);
        m.setPosition(0, -999, 0);
      }
      canopy2Ref.current.setMatrixAt(i, m);
      color.copy(canopyColors[(t.variant + 1) % canopyColors.length]);
      canopy2Ref.current.setColorAt(i, color);

      // Layer 3 — sphere crown for colossal trees
      if (t.canopyLayers >= 3) {
        const c3R = c1R * 0.5;
        m.makeScale(c3R, c3R * 0.6, c3R);
        m.setPosition(t.x, terrainY + t.trunkH + c3R * 0.3, t.z);
      } else {
        m.makeScale(0, 0, 0);
        m.setPosition(0, -999, 0);
      }
      canopy3Ref.current.setMatrixAt(i, m);
      color.copy(canopyColors[(t.variant + 2) % canopyColors.length]);
      canopy3Ref.current.setColorAt(i, color);
    }

    [trunkRef, canopy1Ref, canopy2Ref, canopy3Ref].forEach(ref => {
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    });
  }, [treeData, pal]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[_cyl, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.treeTrunk} emissive="#0a1a04" emissiveIntensity={0.3} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={canopy1Ref} args={[_cyl, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.treeCanopy[0]} emissive={pal.accent} emissiveIntensity={0.4} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={canopy2Ref} args={[_cyl, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.treeCanopy[1]} emissive={pal.accent} emissiveIntensity={0.35} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={canopy3Ref} args={[_sphere, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.treeCanopy[2]} emissive={pal.accentAlt} emissiveIntensity={0.5} roughness={0.75} transparent opacity={0.9} />
      </instancedMesh>
    </>
  );
}

function JungleTempleRuins({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const pillarRef = useRef<THREE.InstancedMesh>(null);
  const archRef = useRef<THREE.InstancedMesh>(null);

  const pal = ZONE_PALETTES.jungle;
  const wallCount = 120;
  const pillarCount = 80;
  const archCount = 20;

  const data = useMemo(() => {
    const rng = seededRandom(54321);
    const walls: { x: number; z: number; w: number; h: number; d: number; ry: number }[] = [];
    const pillars: { x: number; z: number; r: number; h: number }[] = [];
    const arches: { x: number; z: number; w: number; h: number; ry: number }[] = [];

    // Temple clusters
    for (let c = 0; c < 8; c++) {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + 200 + rng() * (outerR - innerR - 400);
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;

      // Step-pyramid base walls
      const levels = 3 + Math.floor(rng() * 3);
      for (let lv = 0; lv < levels; lv++) {
        const size = 40 - lv * 8 + rng() * 10;
        const h = 8 + rng() * 5;
        for (let side = 0; side < 4; side++) {
          const ox = (side < 2 ? (side === 0 ? -1 : 1) : 0) * size / 2;
          const oz = (side >= 2 ? (side === 2 ? -1 : 1) : 0) * size / 2;
          walls.push({
            x: cx + ox, z: cz + oz,
            w: side < 2 ? 4 : size, h: h,
            d: side < 2 ? size : 4,
            ry: 0,
          });
        }
      }

      // Pillars around
      for (let p = 0; p < 6; p++) {
        const pa = rng() * Math.PI * 2;
        const pr = 30 + rng() * 30;
        pillars.push({
          x: cx + Math.cos(pa) * pr, z: cz + Math.sin(pa) * pr,
          r: 2 + rng() * 2, h: 20 + rng() * 40,
        });
      }

      // Archway entrance
      arches.push({
        x: cx, z: cz + 35,
        w: 15 + rng() * 10, h: 25 + rng() * 15,
        ry: rng() * Math.PI,
      });
    }

    return { walls: walls.slice(0, wallCount), pillars: pillars.slice(0, pillarCount), arches: arches.slice(0, archCount) };
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!wallRef.current || !pillarRef.current || !archRef.current) return;
    const m = new THREE.Matrix4();
    const rm = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < data.walls.length; i++) {
      const w = data.walls[i];
      const ty = getTerrainHeight(w.x, w.z, 0) - 18;
      m.makeScale(w.w, w.h, w.d);
      rm.makeRotationY(w.ry);
      m.premultiply(rm);
      m.setPosition(w.x, ty + w.h / 2, w.z);
      wallRef.current.setMatrixAt(i, m);
      color.set(pal.ruins);
      color.offsetHSL(0, 0, Math.sin(i * 3.7) * 0.04);
      wallRef.current.setColorAt(i, color);
    }
    wallRef.current.instanceMatrix.needsUpdate = true;
    if (wallRef.current.instanceColor) wallRef.current.instanceColor.needsUpdate = true;

    for (let i = 0; i < data.pillars.length; i++) {
      const p = data.pillars[i];
      const ty = getTerrainHeight(p.x, p.z, 0) - 18;
      m.makeScale(p.r, p.h, p.r);
      m.setPosition(p.x, ty + p.h / 2, p.z);
      pillarRef.current.setMatrixAt(i, m);
      color.set(pal.ruins);
      pillarRef.current.setColorAt(i, color);
    }
    pillarRef.current.instanceMatrix.needsUpdate = true;
    if (pillarRef.current.instanceColor) pillarRef.current.instanceColor.needsUpdate = true;

    for (let i = 0; i < data.arches.length; i++) {
      const a = data.arches[i];
      const ty = getTerrainHeight(a.x, a.z, 0) - 18;
      m.makeScale(a.w, a.h, 4);
      rm.makeRotationY(a.ry);
      m.premultiply(rm);
      m.setPosition(a.x, ty + a.h / 2, a.z);
      archRef.current.setMatrixAt(i, m);
      color.set(pal.accent);
      archRef.current.setColorAt(i, color);
    }
    archRef.current.instanceMatrix.needsUpdate = true;
    if (archRef.current.instanceColor) archRef.current.instanceColor.needsUpdate = true;
  }, [data, pal]);

  return (
    <>
      <instancedMesh ref={wallRef} args={[_box, undefined, wallCount]} frustumCulled={false}>
        <meshStandardMaterial color={pal.ruins} emissive={pal.ruinsEmissive} emissiveIntensity={0.15} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={pillarRef} args={[_cyl, undefined, pillarCount]} frustumCulled={false}>
        <meshStandardMaterial color={pal.ruins} emissive={pal.ruinsEmissive} emissiveIntensity={0.12} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={archRef} args={[_box, undefined, archCount]} frustumCulled={false}>
        <meshStandardMaterial color={pal.accent} emissive={pal.accent} emissiveIntensity={0.8} toneMapped={false} transparent opacity={0.6} />
      </instancedMesh>
    </>
  );
}

function JungleMushrooms({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const count = 350;
  const pal = ZONE_PALETTES.jungle;

  const data = useMemo(() => {
    const rng = seededRandom(99999);
    const items: { x: number; z: number; stemH: number; capR: number; hueShift: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      items.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        stemH: 1 + rng() * 5,
        capR: 1.5 + rng() * 4,
        hueShift: rng() * 0.15 - 0.075,
      });
    }
    return items;
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!stemRef.current || !capRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ty = getTerrainHeight(d.x, d.z, 0) - 18;
      m.makeScale(d.capR * 0.3, d.stemH, d.capR * 0.3);
      m.setPosition(d.x, ty + d.stemH / 2, d.z);
      stemRef.current.setMatrixAt(i, m);
      color.set("#1a1010");
      stemRef.current.setColorAt(i, color);

      m.makeScale(d.capR, d.capR * 0.5, d.capR);
      m.setPosition(d.x, ty + d.stemH + d.capR * 0.2, d.z);
      capRef.current.setMatrixAt(i, m);
      color.set(pal.mushroom);
      color.offsetHSL(d.hueShift, 0, 0);
      capRef.current.setColorAt(i, color);
    }
    [stemRef, capRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      }
    });
  }, [data, pal]);

  useFrame(({ clock }) => {
    if (capRef.current) {
      const mat = capRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2.0 + Math.sin(clock.elapsedTime * 1.5) * 0.8;
    }
  });

  return (
    <>
      <instancedMesh ref={stemRef} args={[_cyl, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color="#1a1010" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[_sphere, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.mushroom} emissive={pal.mushroom} emissiveIntensity={2.0} toneMapped={false} transparent opacity={0.85} />
      </instancedMesh>
    </>
  );
}

// Firefly particles for jungle
function JungleFireflies({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 300;

  const data = useMemo(() => {
    const rng = seededRandom(77111);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y: 5 + rng() * 80,
        speed: 0.5 + rng() * 2,
        phase: rng() * Math.PI * 2,
        drift: 5 + rng() * 20,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const t = clock.elapsedTime;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const px = d.x + Math.sin(t * d.speed + d.phase) * d.drift;
      const py = d.y + Math.sin(t * d.speed * 0.7 + d.phase * 2) * 10;
      const pz = d.z + Math.cos(t * d.speed * 0.5 + d.phase) * d.drift;
      const s = 0.3 + Math.sin(t * 3 + i) * 0.15;
      m.makeScale(s, s, s);
      m.setPosition(px, py, pz);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[_sphere, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#7affb0" emissive="#7affb0" emissiveIntensity={4} toneMapped={false} />
    </instancedMesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// ZONE 2 — THE VOLCANIC BADLANDS
// ═══════════════════════════════════════════════════════════════

function ObsidianSpires({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const spireRef = useRef<THREE.InstancedMesh>(null);
  const crackRef = useRef<THREE.InstancedMesh>(null);
  const count = 200;
  const pal = ZONE_PALETTES.volcanic;

  const data = useMemo(() => {
    const rng = seededRandom(66666);
    const clusterCount = 20;

    // Generate cluster centers first
    const clusters: { x: number; z: number }[] = [];
    for (let c = 0; c < clusterCount; c++) {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      clusters.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
      });
    }

    // Place 3–7 spires around each cluster center with 50–120 unit offsets
    const spires: { x: number; z: number; h: number; r: number; tilt: number }[] = [];
    for (let c = 0; c < clusterCount && spires.length < count; c++) {
      const cl = clusters[c];
      const spireCount = 3 + Math.floor(rng() * 5); // 3–7 per cluster
      for (let s = 0; s < spireCount && spires.length < count; s++) {
        const offsetAngle = rng() * Math.PI * 2;
        const offsetR = 50 + rng() * 70; // 50–120 units from cluster center
        spires.push({
          x: cl.x + Math.cos(offsetAngle) * offsetR,
          z: cl.z + Math.sin(offsetAngle) * offsetR,
          h: 15 + rng() * 80,
          r: 2 + rng() * 6,
          tilt: (rng() - 0.5) * 0.3,
        });
      }
    }

    return spires;
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!spireRef.current || !crackRef.current) return;
    const m = new THREE.Matrix4();
    const rm = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ty = getTerrainHeight(d.x, d.z, 1) - 18;

      // Sharp spire (tapered box)
      m.makeScale(d.r, d.h, d.r * 0.8);
      rm.makeRotationZ(d.tilt);
      m.premultiply(rm);
      m.setPosition(d.x, ty + d.h / 2, d.z);
      spireRef.current.setMatrixAt(i, m);
      color.set(pal.obsidian);
      color.offsetHSL(0, 0, Math.sin(i * 2.3) * 0.03);
      spireRef.current.setColorAt(i, color);

      // Lava crack glow on surface
      m.makeScale(d.r * 0.3, d.h * 0.8, d.r * 0.15);
      m.setPosition(d.x + d.r * 0.4, ty + d.h * 0.4, d.z);
      crackRef.current.setMatrixAt(i, m);
      color.set(pal.lava);
      crackRef.current.setColorAt(i, color);
    }
    [spireRef, crackRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      }
    });
  }, [data, pal]);

  return (
    <>
      <instancedMesh ref={spireRef} args={[_box, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.obsidian} emissive={pal.obsidianEmissive} emissiveIntensity={0.2} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={crackRef} args={[_box, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.lava} emissive={pal.lava} emissiveIntensity={3} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function LavaRivers({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 150;
  const pal = ZONE_PALETTES.volcanic;

  const data = useMemo(() => {
    const rng = seededRandom(44444);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        w: 5 + rng() * 15,
        l: 20 + rng() * 80,
        ry: rng() * Math.PI,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const rm = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ty = getTerrainHeight(d.x, d.z, 1) - 20;
      m.makeScale(d.l, 1, d.w);
      rm.makeRotationY(d.ry);
      m.premultiply(rm);
      m.setPosition(d.x, ty, d.z);
      ref.current.setMatrixAt(i, m);
      color.set(pal.lava);
      color.offsetHSL(Math.sin(i * 1.7) * 0.05, 0, Math.sin(i * 2.1) * 0.1);
      ref.current.setColorAt(i, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [data, pal]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2.5 + Math.sin(clock.elapsedTime * 0.8) * 0.5;
    }
  });

  return (
    <instancedMesh ref={ref} args={[_box, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={pal.lava} emissive={pal.lava} emissiveIntensity={2.5} toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function DeadTrees({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const branchRef = useRef<THREE.InstancedMesh>(null);
  const count = 150;

  const data = useMemo(() => {
    const rng = seededRandom(55555);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        h: 10 + rng() * 30,
        r: 0.5 + rng() * 1.5,
        branches: 2 + Math.floor(rng() * 3),
        branchAngle: rng() * Math.PI * 2,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!ref.current || !branchRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    let bIdx = 0;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ty = getTerrainHeight(d.x, d.z, 1) - 18;
      m.makeScale(d.r, d.h, d.r);
      m.setPosition(d.x, ty + d.h / 2, d.z);
      ref.current.setMatrixAt(i, m);
      color.set("#2a2020");
      ref.current.setColorAt(i, color);

      // Bare branches
      for (let b = 0; b < d.branches && bIdx < count * 3; b++) {
        const ba = d.branchAngle + b * 1.5;
        const bh = d.h * (0.5 + b * 0.15);
        const bl = 3 + d.h * 0.2;
        m.makeScale(d.r * 0.3, bl, d.r * 0.3);
        const rm = new THREE.Matrix4().makeRotationZ(0.5 + b * 0.2);
        m.premultiply(rm);
        m.setPosition(d.x + Math.cos(ba) * 2, ty + bh, d.z + Math.sin(ba) * 2);
        branchRef.current.setMatrixAt(bIdx, m);
        color.set("#1a1515");
        branchRef.current.setColorAt(bIdx, color);
        bIdx++;
      }
    }
    // Hide unused branch instances
    const emptyM = new THREE.Matrix4().makeScale(0, 0, 0);
    emptyM.setPosition(0, -999, 0);
    for (let i = bIdx; i < count * 3; i++) {
      branchRef.current.setMatrixAt(i, emptyM);
    }
    [ref, branchRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      }
    });
  }, [data]);

  return (
    <>
      <instancedMesh ref={ref} args={[_cyl, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color="#2a2020" emissive="#c84022" emissiveIntensity={0.08} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={branchRef} args={[_cyl, undefined, count * 3]} frustumCulled={false}>
        <meshStandardMaterial color="#1a1515" roughness={0.95} />
      </instancedMesh>
    </>
  );
}

// Volcano caldera
function VolcanoCaldera({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const midAngle = (startAngle + endAngle) / 2;
  const dist = (innerR + outerR) * 0.55;
  const cx = Math.cos(midAngle) * dist;
  const cz = Math.sin(midAngle) * dist;

  return (
    <group position={[cx, -18, cz]}>
      {/* Mountain cone */}
      <mesh position={[0, 60, 0]}>
        <coneGeometry args={[120, 120, 8]} />
        <meshStandardMaterial color="#1a1010" emissive="#0a0505" emissiveIntensity={0.2} roughness={0.95} />
      </mesh>
      {/* Caldera rim */}
      <mesh position={[0, 115, 0]}>
        <cylinderGeometry args={[40, 50, 15, 8]} />
        <meshStandardMaterial color="#1a0a0a" emissive="#3d0f00" emissiveIntensity={0.3} roughness={0.9} />
      </mesh>
      {/* Lava lake inside */}
      <mesh position={[0, 112, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[38, 8]} />
        <meshStandardMaterial color="#ff4800" emissive="#ff4800" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* Glow light */}
      <pointLight position={[0, 120, 0]} color="#ff4800" intensity={50} distance={400} decay={2} />
    </group>
  );
}

// Ember particles
function EmberParticles({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 250;

  const data = useMemo(() => {
    const rng = seededRandom(88888);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        speed: 1 + rng() * 3,
        phase: rng() * Math.PI * 2,
        maxY: 30 + rng() * 60,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const t = clock.elapsedTime;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const cycleY = ((t * d.speed + d.phase) % d.maxY);
      const px = d.x + Math.sin(t * 0.5 + d.phase) * 5;
      const pz = d.z + Math.cos(t * 0.3 + d.phase) * 5;
      const s = 0.2 + Math.sin(t * 5 + i) * 0.1;
      m.makeScale(s, s, s);
      m.setPosition(px, cycleY - 10, pz);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[_sphere, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#ff8030" emissive="#ff4800" emissiveIntensity={5} toneMapped={false} />
    </instancedMesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// ZONE 3 — THE FROZEN HIGHLANDS
// ═══════════════════════════════════════════════════════════════

function IceMountains({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const peakRef = useRef<THREE.InstancedMesh>(null);
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const snowCapRef = useRef<THREE.InstancedMesh>(null);
  const peakCount = 60;
  const pal = ZONE_PALETTES.frozen;

  const data = useMemo(() => {
    const rng = seededRandom(33333);
    return Array.from({ length: peakCount }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + 100 + rng() * (outerR - innerR - 200);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        h: 60 + rng() * 200,
        r: 30 + rng() * 60,
        snowLine: 0.6 + rng() * 0.2,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!peakRef.current || !baseRef.current || !snowCapRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ty = -18;

      // Mountain base (wide cone)
      m.makeScale(d.r, d.h * 0.6, d.r);
      m.setPosition(d.x, ty + d.h * 0.3, d.z);
      baseRef.current.setMatrixAt(i, m);
      color.set(pal.terrain);
      color.offsetHSL(0, 0, Math.sin(i * 1.7) * 0.05);
      baseRef.current.setColorAt(i, color);

      // Peak (narrower cone)
      const peakR = d.r * 0.5;
      m.makeScale(peakR, d.h * 0.5, peakR);
      m.setPosition(d.x, ty + d.h * 0.65, d.z);
      peakRef.current.setMatrixAt(i, m);
      color.set(pal.ice);
      color.offsetHSL(0, 0, Math.sin(i * 2.3) * 0.08);
      peakRef.current.setColorAt(i, color);

      // Snow cap
      const snowR = peakR * 0.8;
      m.makeScale(snowR, d.h * 0.15, snowR);
      m.setPosition(d.x, ty + d.h * 0.85, d.z);
      snowCapRef.current.setMatrixAt(i, m);
      color.set(pal.snow);
      snowCapRef.current.setColorAt(i, color);
    }
    [peakRef, baseRef, snowCapRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      }
    });
  }, [data, pal]);

  return (
    <>
      <instancedMesh ref={baseRef} args={[_cone, undefined, peakCount]} frustumCulled={false}>
        <meshStandardMaterial color={pal.terrain} emissive={pal.terrainEmissive} emissiveIntensity={0.15} roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={peakRef} args={[_cone, undefined, peakCount]} frustumCulled={false}>
        <meshStandardMaterial color={pal.ice} emissive={pal.ice} emissiveIntensity={0.5} roughness={0.3} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={snowCapRef} args={[_cone, undefined, peakCount]} frustumCulled={false}>
        <meshStandardMaterial color={pal.snow} emissive={pal.snowEmissive} emissiveIntensity={0.3} roughness={0.7} />
      </instancedMesh>
    </>
  );
}

function CrystalTrees({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crystalRef = useRef<THREE.InstancedMesh>(null);
  const count = 250;
  const pal = ZONE_PALETTES.frozen;

  const data = useMemo(() => {
    const rng = seededRandom(22222);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        h: 8 + rng() * 25,
        r: 0.5 + rng() * 1.5,
        crystalCount: 2 + Math.floor(rng() * 4),
        seed: rng() * 1000,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!trunkRef.current || !crystalRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    let cIdx = 0;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ty = getTerrainHeight(d.x, d.z, 2) - 18;
      m.makeScale(d.r, d.h, d.r);
      m.setPosition(d.x, ty + d.h / 2, d.z);
      trunkRef.current.setMatrixAt(i, m);
      color.set(pal.ice);
      color.offsetHSL(0, 0, -0.2);
      trunkRef.current.setColorAt(i, color);

      for (let c = 0; c < d.crystalCount && cIdx < count * 4; c++) {
        const ca = d.seed + c * 2.5;
        const ch = d.h * (0.4 + c * 0.15);
        const cs = 1 + d.h * 0.08;
        m.makeScale(cs, cs * 2, cs);
        const rm = new THREE.Matrix4().makeRotationZ(0.3 + c * 0.2);
        m.premultiply(rm);
        m.setPosition(d.x + Math.cos(ca) * d.r * 2, ty + ch, d.z + Math.sin(ca) * d.r * 2);
        crystalRef.current.setMatrixAt(cIdx, m);
        color.set(pal.iceAlt);
        color.offsetHSL(Math.sin(cIdx) * 0.05, 0, 0);
        crystalRef.current.setColorAt(cIdx, color);
        cIdx++;
      }
    }
    const emptyM = new THREE.Matrix4().makeScale(0, 0, 0);
    emptyM.setPosition(0, -999, 0);
    for (let i = cIdx; i < count * 4; i++) {
      crystalRef.current.setMatrixAt(i, emptyM);
    }
    [trunkRef, crystalRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      }
    });
  }, [data, pal]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[_cyl, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.ice} emissive={pal.ice} emissiveIntensity={0.3} roughness={0.3} metalness={0.1} transparent opacity={0.8} />
      </instancedMesh>
      <instancedMesh ref={crystalRef} args={[_octahedron, undefined, count * 4]} frustumCulled={false}>
        <meshStandardMaterial color={pal.iceAlt} emissive={pal.iceAlt} emissiveIntensity={1.5} toneMapped={false} transparent opacity={0.7} roughness={0.1} metalness={0.3} />
      </instancedMesh>
    </>
  );
}

function CliffFortress({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const windowRef = useRef<THREE.InstancedMesh>(null);
  const pal = ZONE_PALETTES.frozen;
  const wallCount = 60;
  const windowCount = 40;

  const data = useMemo(() => {
    const rng = seededRandom(11223);
    const midAngle = (startAngle + endAngle) / 2;
    const dist = (innerR + outerR) * 0.5;
    const cx = Math.cos(midAngle) * dist;
    const cz = Math.sin(midAngle) * dist;
    const walls: { x: number; z: number; w: number; h: number; d: number }[] = [];
    const windows: { x: number; y: number; z: number; s: number }[] = [];

    // Main fortress
    for (let i = 0; i < 15; i++) {
      const ox = (rng() - 0.5) * 100;
      const oz = (rng() - 0.5) * 60;
      const h = 30 + rng() * 60;
      walls.push({ x: cx + ox, z: cz + oz, w: 10 + rng() * 20, h, d: 8 + rng() * 15 });
      for (let w = 0; w < 3; w++) {
        const ty = getTerrainHeight(cx + ox, cz + oz, 2) - 18;
        windows.push({
          x: cx + ox + (rng() - 0.5) * 8,
          y: ty + 10 + rng() * (h - 15),
          z: cz + oz + (rng() - 0.5) * 6,
          s: 1.5 + rng(),
        });
      }
    }
    // Towers
    for (let i = 0; i < 4; i++) {
      const ta = midAngle - 0.15 + rng() * 0.3;
      const tr = dist - 20 + rng() * 40;
      walls.push({
        x: Math.cos(ta) * tr, z: Math.sin(ta) * tr,
        w: 8 + rng() * 6, h: 50 + rng() * 80, d: 8 + rng() * 6,
      });
    }

    return { walls: walls.slice(0, wallCount), windows: windows.slice(0, windowCount) };
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!wallRef.current || !windowRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.walls.length; i++) {
      const w = data.walls[i];
      const ty = getTerrainHeight(w.x, w.z, 2) - 18;
      m.makeScale(w.w, w.h, w.d);
      m.setPosition(w.x, ty + w.h / 2, w.z);
      wallRef.current.setMatrixAt(i, m);
      color.set(pal.fortress);
      wallRef.current.setColorAt(i, color);
    }
    for (let i = data.walls.length; i < wallCount; i++) {
      m.makeScale(0, 0, 0); m.setPosition(0, -999, 0);
      wallRef.current.setMatrixAt(i, m);
    }
    wallRef.current.instanceMatrix.needsUpdate = true;
    if (wallRef.current.instanceColor) wallRef.current.instanceColor.needsUpdate = true;

    for (let i = 0; i < data.windows.length; i++) {
      const w = data.windows[i];
      m.makeScale(w.s, w.s, w.s);
      m.setPosition(w.x, w.y, w.z);
      windowRef.current.setMatrixAt(i, m);
      color.set("#e8a030");
      windowRef.current.setColorAt(i, color);
    }
    for (let i = data.windows.length; i < windowCount; i++) {
      m.makeScale(0, 0, 0); m.setPosition(0, -999, 0);
      windowRef.current.setMatrixAt(i, m);
    }
    windowRef.current.instanceMatrix.needsUpdate = true;
    if (windowRef.current.instanceColor) windowRef.current.instanceColor.needsUpdate = true;
  }, [data, pal]);

  return (
    <>
      <instancedMesh ref={wallRef} args={[_box, undefined, wallCount]} frustumCulled={false}>
        <meshStandardMaterial color={pal.fortress} emissive={pal.fortressEmissive} emissiveIntensity={0.15} roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={windowRef} args={[_box, undefined, windowCount]} frustumCulled={false}>
        <meshStandardMaterial color="#e8a030" emissive="#e8a030" emissiveIntensity={3} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

// Snow particles
function SnowParticles({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 400;

  const data = useMemo(() => {
    const rng = seededRandom(44455);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        speed: 0.5 + rng() * 1.5,
        phase: rng() * Math.PI * 2,
        maxY: 100 + rng() * 100,
        drift: 3 + rng() * 10,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const t = clock.elapsedTime;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const y = d.maxY - ((t * d.speed * 8 + d.phase * 20) % d.maxY);
      const px = d.x + Math.sin(t * d.speed + d.phase) * d.drift;
      const pz = d.z + Math.cos(t * d.speed * 0.7 + d.phase) * d.drift;
      m.makeScale(0.3, 0.3, 0.3);
      m.setPosition(px, y, pz);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[_sphere, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#c0d8f0" emissive="#c0d8f0" emissiveIntensity={1.5} toneMapped={false} />
    </instancedMesh>
  );
}

function AuroraBorealis({ startAngle, endAngle, innerR, outerR }: {
  startAngle: number; endAngle: number; innerR: number; outerR: number;
}) {
  const ref0 = useRef<THREE.Mesh>(null);
  const ref1 = useRef<THREE.Mesh>(null);
  const ref2 = useRef<THREE.Mesh>(null);
  const midAngle = (startAngle + endAngle) / 2;
  const midR = (innerR + outerR) * 0.5;

  const ribbons = [
    { ref: ref0, color: "#30e090", y: 150, speed: 0.4, phase: 0 },
    { ref: ref1, color: "#3090e0", y: 230, speed: 0.3, phase: 1.5 },
    { ref: ref2, color: "#9060e0", y: 320, speed: 0.5, phase: 3.0 },
  ];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ribbons.forEach(({ ref, speed, phase }) => {
      if (!ref.current) return;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      // Animate opacity for flickering curtain effect
      mat.opacity = 0.55 + Math.sin(t * 0.7 + phase) * 0.25;
      // Gentle wave motion on position
      ref.current.position.y = ref.current.userData.baseY + Math.sin(t * speed + phase) * 15;
      // Scale width slightly for shimmer
      ref.current.scale.x = 1 + Math.sin(t * speed * 1.3 + phase) * 0.15;
    });
  });

  return (
    <group>
      {ribbons.map(({ ref, color, y }, i) => {
        const cx = Math.cos(midAngle) * midR;
        const cz = Math.sin(midAngle) * midR;
        return (
          <mesh
            key={i}
            ref={ref as React.RefObject<THREE.Mesh>}
            position={[cx, y, cz]}
            rotation={[0, -midAngle + Math.PI / 2, 0]}
            userData={{ baseY: y }}
          >
            <boxGeometry args={[800, 80, 3]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={2}
              toneMapped={false}
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// ZONE 4 — THE VOID WASTES
// ═══════════════════════════════════════════════════════════════

function FloatingIslands({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const islandRef = useRef<THREE.InstancedMesh>(null);
  const topRef = useRef<THREE.InstancedMesh>(null);
  const bridgeRef = useRef<THREE.InstancedMesh>(null);
  const count = 40;
  const bridgeCount = 25;
  const pal = ZONE_PALETTES.void;

  const data = useMemo(() => {
    const rng = seededRandom(77777);
    const islands: { x: number; y: number; z: number; r: number; h: number; topColor: string }[] = [];
    const biomeColors = ["#1a3a18", "#3a2020", "#2a2838", "#2a1a04"];

    for (let i = 0; i < count; i++) {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      islands.push({
        x: Math.cos(angle) * radius,
        y: -50 + rng() * 150,
        z: Math.sin(angle) * radius,
        r: 15 + rng() * 50,
        h: 10 + rng() * 30,
        topColor: biomeColors[Math.floor(rng() * biomeColors.length)],
      });
    }

    const bridges: { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number }[] = [];
    for (let i = 0; i < islands.length - 1 && bridges.length < bridgeCount; i++) {
      const a = islands[i];
      const b = islands[i + 1];
      const dist = Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
      if (dist < 300) {
        bridges.push({ x1: a.x, y1: a.y, z1: a.z, x2: b.x, y2: b.y, z2: b.z });
      }
    }

    return { islands, bridges };
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!islandRef.current || !topRef.current || !bridgeRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < data.islands.length; i++) {
      const d = data.islands[i];
      // Rocky underside (inverted cone)
      m.makeScale(d.r, d.h, d.r);
      m.setPosition(d.x, d.y, d.z);
      islandRef.current.setMatrixAt(i, m);
      color.set(pal.island);
      islandRef.current.setColorAt(i, color);

      // Top surface (flat disc with biome color)
      m.makeScale(d.r * 0.9, 2, d.r * 0.9);
      m.setPosition(d.x, d.y + d.h / 2, d.z);
      topRef.current.setMatrixAt(i, m);
      color.set(d.topColor);
      topRef.current.setColorAt(i, color);
    }

    for (let i = 0; i < data.bridges.length; i++) {
      const b = data.bridges[i];
      const dx = b.x2 - b.x1;
      const dz = b.z2 - b.z1;
      const dy = b.y2 - b.y1;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const angle = Math.atan2(dz, dx);
      m.makeScale(len, 1.5, 3);
      const rm = new THREE.Matrix4().makeRotationY(-angle);
      m.premultiply(rm);
      m.setPosition((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, (b.z1 + b.z2) / 2);
      bridgeRef.current.setMatrixAt(i, m);
      color.set(pal.bridge);
      bridgeRef.current.setColorAt(i, color);
    }
    const emptyM = new THREE.Matrix4().makeScale(0, 0, 0);
    emptyM.setPosition(0, -999, 0);
    for (let i = data.bridges.length; i < bridgeCount; i++) {
      bridgeRef.current.setMatrixAt(i, emptyM);
    }

    [islandRef, topRef, bridgeRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      }
    });
  }, [data, pal]);

  // Gentle float animation
  useFrame(({ clock }) => {
    if (!islandRef.current || !topRef.current) return;
    const m = new THREE.Matrix4();
    const t = clock.elapsedTime;
    for (let i = 0; i < data.islands.length; i++) {
      const d = data.islands[i];
      const floatY = Math.sin(t * 0.3 + i * 1.7) * 3;
      m.makeScale(d.r, d.h, d.r);
      m.setPosition(d.x, d.y + floatY, d.z);
      islandRef.current.setMatrixAt(i, m);
      m.makeScale(d.r * 0.9, 2, d.r * 0.9);
      m.setPosition(d.x, d.y + d.h / 2 + floatY, d.z);
      topRef.current.setMatrixAt(i, m);
    }
    islandRef.current.instanceMatrix.needsUpdate = true;
    topRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={islandRef} args={[_cone, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.island} emissive={pal.islandEmissive} emissiveIntensity={0.2} roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={topRef} args={[_cyl, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.island} emissive={pal.islandEmissive} emissiveIntensity={0.15} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={bridgeRef} args={[_box, undefined, bridgeCount]} frustumCulled={false}>
        <meshStandardMaterial color={pal.bridge} emissive={pal.accent} emissiveIntensity={0.1} roughness={0.9} />
      </instancedMesh>
    </>
  );
}

function VoidObelisks({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const obeliskRef = useRef<THREE.InstancedMesh>(null);
  const runeRef = useRef<THREE.InstancedMesh>(null);
  const count = 30;
  const pal = ZONE_PALETTES.void;

  const data = useMemo(() => {
    const rng = seededRandom(99988);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        y: -20 + rng() * 100,
        z: Math.sin(angle) * radius,
        h: 30 + rng() * 80,
        w: 5 + rng() * 8,
        phase: rng() * Math.PI * 2,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useFrame(({ clock }) => {
    if (!obeliskRef.current || !runeRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const t = clock.elapsedTime;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const floatY = Math.sin(t * 0.2 + d.phase) * 5;
      const rot = t * 0.05 + d.phase;

      // Obelisk body
      m.makeScale(d.w, d.h, d.w);
      const rm = new THREE.Matrix4().makeRotationY(rot);
      m.premultiply(rm);
      m.setPosition(d.x, d.y + floatY, d.z);
      obeliskRef.current.setMatrixAt(i, m);
      color.set(pal.obelisk);
      obeliskRef.current.setColorAt(i, color);

      // Glowing rune strip
      m.makeScale(d.w * 0.3, d.h * 0.7, d.w * 0.15);
      m.premultiply(rm);
      m.setPosition(d.x + d.w * 0.5, d.y + floatY, d.z);
      runeRef.current.setMatrixAt(i, m);
      color.set(pal.accent);
      const pulse = 2 + Math.sin(t * 2 + i) * 1;
      runeRef.current.setColorAt(i, color);
    }
    [obeliskRef, runeRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      }
    });
    if (runeRef.current) {
      const mat = runeRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2 + Math.sin(t * 2) * 1;
    }
  });

  return (
    <>
      <instancedMesh ref={obeliskRef} args={[_box, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.obelisk} emissive={pal.obeliskEmissive} emissiveIntensity={0.4} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={runeRef} args={[_box, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.accent} emissive={pal.accent} emissiveIntensity={2} toneMapped={false} transparent opacity={0.8} />
      </instancedMesh>
    </>
  );
}

// Reality tear particles
function RealityTears({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 60;

  const data = useMemo(() => {
    const rng = seededRandom(11199);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        y: -20 + rng() * 120,
        z: Math.sin(angle) * radius,
        h: 20 + rng() * 60,
        phase: rng() * Math.PI * 2,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const t = clock.elapsedTime;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const flicker = Math.sin(t * 8 + d.phase) > 0.3 ? 1 : 0;
      const w = 0.3 * flicker;
      m.makeScale(w, d.h, w);
      m.setPosition(d.x, d.y + Math.sin(t + d.phase) * 5, d.z);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[_box, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={5} toneMapped={false} transparent opacity={0.6} />
    </instancedMesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// ZONE 5 — THE WORLD TREE
// ═══════════════════════════════════════════════════════════════

function WorldTree() {
  const pal = ZONE_PALETTES.worldTree;
  const treeX = 0;
  const treeZ = -800;
  const trunkH = 400;
  const trunkR = 25;

  return (
    <group position={[treeX, -18, treeZ]}>
      {/* Main trunk — massive cylinder with bark glow */}
      <mesh position={[0, trunkH / 2, 0]}>
        <cylinderGeometry args={[trunkR * 0.7, trunkR, trunkH, 8]} />
        <meshStandardMaterial color={pal.trunk} emissive={pal.trunkEmissive} emissiveIntensity={0.6} roughness={0.85} />
      </mesh>

      {/* Bark crack glow strips */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={`crack-${i}`} position={[Math.cos(angle) * trunkR * 0.95, trunkH * 0.3 + i * 40, Math.sin(angle) * trunkR * 0.95]}>
            <boxGeometry args={[1.5, trunkH * 0.4, 0.5]} />
            <meshStandardMaterial color="#e8a030" emissive="#e8a030" emissiveIntensity={3} toneMapped={false} transparent opacity={0.7} />
          </mesh>
        );
      })}

      {/* Canopy layer 1 — widest */}
      <mesh position={[0, trunkH * 0.75, 0]}>
        <cylinderGeometry args={[120, 140, 20, 8]} />
        <meshStandardMaterial color={pal.canopy[0]} emissive={pal.canopy[0]} emissiveIntensity={0.6} roughness={0.7} transparent opacity={0.85} />
      </mesh>

      {/* Canopy layer 2 */}
      <mesh position={[0, trunkH * 0.85, 0]}>
        <cylinderGeometry args={[90, 110, 15, 8]} />
        <meshStandardMaterial color={pal.canopy[1]} emissive={pal.canopyGlow} emissiveIntensity={0.8} roughness={0.7} transparent opacity={0.8} />
      </mesh>

      {/* Canopy layer 3 — crown */}
      <mesh position={[0, trunkH * 0.92, 0]}>
        <sphereGeometry args={[70, 8, 6]} />
        <meshStandardMaterial color={pal.canopy[2]} emissive={pal.canopyGlow} emissiveIntensity={1.0} roughness={0.6} transparent opacity={0.75} />
      </mesh>

      {/* Golden beacon at top */}
      <mesh position={[0, trunkH + 20, 0]}>
        <sphereGeometry args={[8, 8, 6]} />
        <meshStandardMaterial color={pal.beacon} emissive={pal.beacon} emissiveIntensity={5} toneMapped={false} />
      </mesh>
      <pointLight position={[0, trunkH + 25, 0]} color={pal.beacon} intensity={200} distance={800} decay={2} />

      {/* Major roots extending outward — start at radius 40 to leave approach path */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
        const angle = (i / 8) * Math.PI * 2;
        const rootLen = 150 + Math.sin(i * 2.3) * 60;
        const rootR = 4 + Math.sin(i * 3.1) * 2;
        // Root starts at radius 40 from trunk center and extends outward
        const startOffset = 40;
        const midX = Math.cos(angle) * (startOffset + rootLen / 2);
        const midZ = Math.sin(angle) * (startOffset + rootLen / 2);
        return (
          <mesh
            key={`root-${i}`}
            position={[midX, 3, midZ]}
            rotation={[0, -angle, Math.PI / 2 - 0.15]}
          >
            <cylinderGeometry args={[rootR * 0.3, rootR, rootLen, 6]} />
            <meshStandardMaterial color={pal.roots} emissive={pal.trunkEmissive} emissiveIntensity={0.2} roughness={0.9} />
          </mesh>
        );
      })}

      {/* Tiny houses on branches */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = (i / 6) * Math.PI * 2 + 0.3;
        const branchR = 60 + i * 10;
        const houseY = trunkH * 0.7 + i * 15;
        return (
          <group key={`house-${i}`} position={[Math.cos(angle) * branchR, houseY, Math.sin(angle) * branchR]}>
            <mesh>
              <boxGeometry args={[6, 5, 5]} />
              <meshStandardMaterial color={pal.houses} emissive="#2a1808" emissiveIntensity={0.3} roughness={0.9} />
            </mesh>
            <mesh position={[0, 3.5, 0]}>
              <coneGeometry args={[5, 3, 4]} />
              <meshStandardMaterial color="#1a0a04" roughness={0.9} />
            </mesh>
            {/* Window glow */}
            <mesh position={[0, 0, 2.6]}>
              <boxGeometry args={[2, 2, 0.2]} />
              <meshStandardMaterial color="#e8a030" emissive="#e8a030" emissiveIntensity={3} toneMapped={false} />
            </mesh>
          </group>
        );
      })}

      {/* Ambient glow */}
      <pointLight position={[0, trunkH * 0.8, 0]} color="#40b870" intensity={80} distance={500} decay={2} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// ZONE 6 — THE DESERT RUINS
// ═══════════════════════════════════════════════════════════════

function DesertDunes({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const geometry = useMemo(() => {
    const segments = 80;
    const rings = 30;
    const geo = new THREE.RingGeometry(innerR, outerR, segments, rings);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const a = Math.atan2(y, x);
      // Only affect desert zone angle range
      if (a >= startAngle && a <= endAngle) {
        const height = getTerrainHeight(x, y, 5);
        pos.setZ(i, height);
      } else {
        pos.setZ(i, 0);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, [innerR, outerR, startAngle, endAngle]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -18, 0]}>
      <meshStandardMaterial color={ZONE_PALETTES.desert.sand} emissive={ZONE_PALETTES.desert.terrainEmissive} emissiveIntensity={0.2} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Pyramids({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const count = 15;
  const pal = ZONE_PALETTES.desert;

  const data = useMemo(() => {
    const rng = seededRandom(55577);
    const placed: { x: number; z: number }[] = [];
    const pyramids: { x: number; z: number; size: number; buried: number }[] = [];
    for (let i = 0; i < count * 4 && pyramids.length < count; i++) {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + 200 + rng() * (outerR - innerR - 400);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const size = 25 + rng() * 50;
      const buried = rng() * 0.5;
      // Skip if any existing pyramid is within 200 units
      const tooClose = placed.some(p => Math.sqrt((p.x - x) ** 2 + (p.z - z) ** 2) < 200);
      if (tooClose) continue;
      placed.push({ x, z });
      pyramids.push({ x, z, size, buried });
    }
    return pyramids;
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!ref.current || !glowRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ty = getTerrainHeight(d.x, d.z, 5) - 18;
      const visibleH = d.size * (1 - d.buried);
      m.makeScale(d.size, visibleH, d.size);
      m.setPosition(d.x, ty + visibleH / 2 - d.size * d.buried * 0.3, d.z);
      ref.current.setMatrixAt(i, m);
      color.set(pal.pyramid);
      color.offsetHSL(0, 0, Math.sin(i * 2.7) * 0.05);
      ref.current.setColorAt(i, color);

      // Glowing capstone
      m.makeScale(3, 3, 3);
      m.setPosition(d.x, ty + visibleH + 1, d.z);
      glowRef.current.setMatrixAt(i, m);
      color.set(pal.accent);
      glowRef.current.setColorAt(i, color);
    }
    [ref, glowRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      }
    });
  }, [data, pal]);

  return (
    <>
      <instancedMesh ref={ref} args={[_cone, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.pyramid} emissive={pal.pyramidEmissive} emissiveIntensity={0.2} roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[_octahedron, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={pal.accent} emissive={pal.accent} emissiveIntensity={3} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function BuriedSkyscrapers({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const windowRef = useRef<THREE.InstancedMesh>(null);
  const count = 25;
  const windowCount = 80;

  const data = useMemo(() => {
    const rng = seededRandom(66677);
    const buildings: { x: number; z: number; w: number; h: number; d: number; exposed: number }[] = [];
    const windows: { x: number; y: number; z: number; s: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = 30 + rng() * 50;
      const exposed = 8 + rng() * 15;
      buildings.push({ x, z, w: 8 + rng() * 12, h, d: 8 + rng() * 12, exposed });
      // Windows on exposed part
      for (let w = 0; w < 3 && windows.length < windowCount; w++) {
        const ty = getTerrainHeight(x, z, 5) - 18;
        windows.push({
          x: x + (rng() - 0.5) * 6,
          y: ty + exposed * 0.3 + rng() * exposed * 0.5,
          z: z + (rng() - 0.5) * 6,
          s: 1 + rng(),
        });
      }
    }
    return { buildings, windows };
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!ref.current || !windowRef.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.buildings.length; i++) {
      const b = data.buildings[i];
      const ty = getTerrainHeight(b.x, b.z, 5) - 18;
      m.makeScale(b.w, b.exposed, b.d);
      m.setPosition(b.x, ty + b.exposed / 2 - 3, b.z);
      ref.current.setMatrixAt(i, m);
      color.set(ZONE_PALETTES.desert.buried);
      ref.current.setColorAt(i, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;

    for (let i = 0; i < data.windows.length; i++) {
      const w = data.windows[i];
      m.makeScale(w.s, w.s, w.s);
      m.setPosition(w.x, w.y, w.z);
      windowRef.current.setMatrixAt(i, m);
      color.set("#20b8a0");
      windowRef.current.setColorAt(i, color);
    }
    const emptyM = new THREE.Matrix4().makeScale(0, 0, 0);
    emptyM.setPosition(0, -999, 0);
    for (let i = data.windows.length; i < windowCount; i++) {
      windowRef.current.setMatrixAt(i, emptyM);
    }
    windowRef.current.instanceMatrix.needsUpdate = true;
    if (windowRef.current.instanceColor) windowRef.current.instanceColor.needsUpdate = true;
  }, [data]);

  return (
    <>
      <instancedMesh ref={ref} args={[_box, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color={ZONE_PALETTES.desert.buried} emissive="#1a1020" emissiveIntensity={0.15} roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={windowRef} args={[_box, undefined, windowCount]} frustumCulled={false}>
        <meshStandardMaterial color="#20b8a0" emissive="#20b8a0" emissiveIntensity={2.5} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function OasisPools({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 12;

  const data = useMemo(() => {
    const rng = seededRandom(77788);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        r: 8 + rng() * 15,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useMemo(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ty = getTerrainHeight(d.x, d.z, 5) - 18;
      m.makeScale(d.r, 0.5, d.r);
      m.setPosition(d.x, ty + 0.5, d.z);
      ref.current.setMatrixAt(i, m);
      color.set(ZONE_PALETTES.desert.oasis);
      ref.current.setColorAt(i, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(clock.elapsedTime) * 0.5;
    }
  });

  return (
    <instancedMesh ref={ref} args={[_cyl, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={ZONE_PALETTES.desert.oasis} emissive={ZONE_PALETTES.desert.oasis} emissiveIntensity={1.5} toneMapped={false} transparent opacity={0.8} />
    </instancedMesh>
  );
}

// Sand particles
function SandstormParticles({ innerR, outerR, startAngle, endAngle }: {
  innerR: number; outerR: number; startAngle: number; endAngle: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 300;

  const data = useMemo(() => {
    const rng = seededRandom(99977);
    return Array.from({ length: count }, () => {
      const angle = startAngle + rng() * (endAngle - startAngle);
      const radius = innerR + rng() * (outerR - innerR);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y: rng() * 40,
        speed: 5 + rng() * 15,
        phase: rng() * Math.PI * 2,
        drift: 20 + rng() * 40,
      };
    });
  }, [innerR, outerR, startAngle, endAngle]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const t = clock.elapsedTime;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      // Horizontal drift
      const px = d.x + Math.sin(t * 0.5 + d.phase) * d.drift;
      const pz = d.z + t * d.speed % (outerR * 2) - outerR;
      const py = d.y + Math.sin(t * 2 + d.phase) * 3;
      m.makeScale(0.4, 0.2, 0.4);
      m.setPosition(px, py, pz);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[_sphere, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#c8900a" emissive="#c8900a" emissiveIntensity={0.8} transparent opacity={0.4} />
    </instancedMesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// TERRAIN RING — multi-biome terrain mesh
// ═══════════════════════════════════════════════════════════════

function TerrainRing({ innerRadius, outerRadius }: {
  innerRadius: number; outerRadius: number;
}) {
  const geometry = useMemo(() => {
    const segments = 160;
    const rings = 50;
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, segments, rings);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const zone = getZone(x, y);
      const height = getTerrainHeight(x, y, zone);
      pos.setZ(i, height);

      // Color by zone
      const color = new THREE.Color();
      switch (zone) {
        case 0: color.set(ZONE_PALETTES.jungle.terrain); break;
        case 1: color.set(ZONE_PALETTES.volcanic.terrain); break;
        case 2: color.set(ZONE_PALETTES.frozen.terrain); break;
        case 3: color.set(ZONE_PALETTES.void.terrain); break;
        case 4: color.set(ZONE_PALETTES.worldTree.fog); break;
        case 5: color.set(ZONE_PALETTES.desert.terrain); break;
        default: color.set("#1a1a1a");
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [innerRadius, outerRadius]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -18, 0]}>
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// ZONE LIGHTING
// ═══════════════════════════════════════════════════════════════

function ZoneLighting({ innerR, outerR }: { innerR: number; outerR: number }) {
  const midR = (innerR + outerR) / 2;
  const zones = [
    { angle: Math.PI / 2, color: "#22c87a", intensity: 30 },       // Jungle North
    { angle: 0, color: "#c84022", intensity: 40 },                 // Volcanic East
    { angle: Math.PI / 4, color: "#3090e0", intensity: 25 },       // Frozen NE
    { angle: -Math.PI / 2, color: "#9060e0", intensity: 20 },      // Void South
    { angle: -Math.PI * 3 / 4, color: "#40b870", intensity: 35 },  // World Tree
    { angle: Math.PI, color: "#c8900a", intensity: 30 },           // Desert West
  ];

  return (
    <>
      {zones.map((z, i) => (
        <pointLight
          key={`zone-light-${i}`}
          position={[Math.cos(z.angle) * midR, 80, Math.sin(z.angle) * midR]}
          color={z.color}
          intensity={z.intensity}
          distance={outerR * 0.8}
          decay={2}
        />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATURES — roaming entities across all zones
// ═══════════════════════════════════════════════════════════════

function Creatures({ innerR, outerR }: { innerR: number; outerR: number }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const eyeRef = useRef<THREE.InstancedMesh>(null);
  const count = 100;

  const data = useMemo(() => {
    const rng = seededRandom(33322);
    return Array.from({ length: count }, () => {
      const angle = rng() * Math.PI * 2;
      const radius = innerR + rng() * (outerR - innerR);
      const type = Math.floor(rng() * 4);
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        bodyH: type === 0 ? 8 + rng() * 12 : type === 2 ? 12 + rng() * 8 : 3 + rng() * 4,
        bodyW: type === 1 ? 2 + rng() * 3 : 3 + rng() * 3,
        speed: 0.3 + rng() * 0.8,
        phase: rng() * Math.PI * 2,
        wanderR: 15 + rng() * 40,
        eyeCount: 1 + Math.floor(rng() * 3),
        type,
        zone: getZone(Math.cos(angle) * radius, Math.sin(angle) * radius),
      };
    });
  }, [innerR, outerR]);

  const totalEyes = useMemo(() => data.reduce((s, c) => s + c.eyeCount, 0), [data]);

  const zoneGlowColors = ["#22c87a", "#ff4800", "#80d4ff", "#9060e0", "#40b870", "#ff8800"];

  useFrame(({ clock }) => {
    if (!bodyRef.current || !eyeRef.current) return;
    const t = clock.elapsedTime;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    let eyeIdx = 0;

    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const wx = c.x + Math.sin(t * c.speed + c.phase) * c.wanderR;
      const wz = c.z + Math.cos(t * c.speed * 0.7 + c.phase) * c.wanderR;
      const ty = getTerrainHeight(wx, wz, c.zone) - 18;
      const floatY = c.type === 3 ? Math.sin(t * 1.5 + c.phase) * 5 + 10 : 0;

      m.makeScale(c.bodyW, c.bodyH, c.bodyW);
      m.setPosition(wx, ty + c.bodyH / 2 + floatY, wz);
      bodyRef.current.setMatrixAt(i, m);
      color.set(zoneGlowColors[c.zone] || "#40e0c0");
      color.offsetHSL(0, 0, -0.4);
      bodyRef.current.setColorAt(i, color);

      for (let e = 0; e < c.eyeCount && eyeIdx < totalEyes; e++) {
        const eyeY = ty + c.bodyH * 0.7 + floatY + e * 1.5;
        const eyeX = wx + (e - (c.eyeCount - 1) / 2) * 1.2;
        const eyeS = 0.5 + Math.sin(t * 3 + i + e) * 0.15;
        m.makeScale(eyeS, eyeS, eyeS);
        m.setPosition(eyeX, eyeY, wz + c.bodyW * 0.5 + 0.3);
        eyeRef.current.setMatrixAt(eyeIdx, m);
        color.set(zoneGlowColors[c.zone] || "#40e0c0");
        eyeRef.current.setColorAt(eyeIdx, color);
        eyeIdx++;
      }
    }

    bodyRef.current.instanceMatrix.needsUpdate = true;
    if (bodyRef.current.instanceColor) bodyRef.current.instanceColor.needsUpdate = true;
    eyeRef.current.instanceMatrix.needsUpdate = true;
    if (eyeRef.current.instanceColor) eyeRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[_box, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color="#0a0a0a" emissive="#202020" emissiveIntensity={0.15} roughness={0.9} transparent opacity={0.7} />
      </instancedMesh>
      <instancedMesh ref={eyeRef} args={[_sphere, undefined, totalEyes]} frustumCulled={false}>
        <meshStandardMaterial color="#40e0c0" emissive="#40e0c0" emissiveIntensity={3} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHORELINE ROCKS — transition from ocean to land
// ═══════════════════════════════════════════════════════════════

function ShorelineRocks({ outerR }: { outerR: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 250;

  const data = useMemo(() => {
    const rng = seededRandom(11111);
    // Place rocks straddling the island edge: outerR-300 to outerR+100
    return Array.from({ length: count }, () => {
      const angle = rng() * Math.PI * 2;
      const radius = outerR - 300 + rng() * 400;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        sx: 3 + rng() * 15,
        sy: 2 + rng() * 10,
        sz: 3 + rng() * 15,
        ry: rng() * Math.PI,
      };
    });
  }, [outerR]);

  useMemo(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const rm = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      m.makeScale(r.sx, r.sy, r.sz);
      rm.makeRotationY(r.ry);
      m.premultiply(rm);
      m.setPosition(r.x, -18 + r.sy / 2 - 2, r.z);
      ref.current.setMatrixAt(i, m);
      color.set("#3a3a38");
      color.offsetHSL(0, -0.1, Math.sin(i * 2.7) * 0.06);
      ref.current.setColorAt(i, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [data]);

  return (
    <instancedMesh ref={ref} args={[_box, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#3a3a38" emissive="#1a1a18" emissiveIntensity={0.1} roughness={0.95} />
    </instancedMesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function OuterWildlands(props: OuterWildlandsProps) {
  const innerR = props.innerR ?? (props.cityRadius ?? 0) + 180;
  const outerR = props.outerR ?? (props.cityRadius ?? 0) + 3000;

  // Zone angle ranges (6 zones, each ~60 degrees)
  const zoneAngle = (Math.PI * 2) / 6;
  const zoneAngles = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      start: -Math.PI + i * zoneAngle,
      end: -Math.PI + (i + 1) * zoneAngle,
    })),
    [zoneAngle]
  );

  // Populate collision registry once at mount with approximate terrain/structure AABBs
  useEffect(() => {
    const reg = props.collisionRegistryRef;
    if (!reg) return;

    // Clear and repopulate
    reg.current = [];

    // Add terrain floor AABBs per zone as large flat boxes
    // These prevent flying through the ground
    for (let z = 0; z < 6; z++) {
      const startAngle = -Math.PI + z * (Math.PI * 2 / 6);
      const endAngle = startAngle + Math.PI * 2 / 6;
      const midAngle = (startAngle + endAngle) / 2;
      const midR = (innerR + outerR) * 0.5;
      const cx = Math.cos(midAngle) * midR;
      const cz = Math.sin(midAngle) * midR;
      const terrainY = getTerrainHeight(cx, cz, z);
      // Wide flat AABB representing terrain surface per zone
      reg.current.push({
        min: new THREE.Vector3(cx - (outerR - innerR) * 0.5, terrainY - 20, cz - (outerR - innerR) * 0.5),
        max: new THREE.Vector3(cx + (outerR - innerR) * 0.5, terrainY, cz + (outerR - innerR) * 0.5),
      });
    }

    // Zone 5: World Tree trunk AABB (trunk at 0, -18, -800, radius 25, height 400)
    reg.current.push({
      min: new THREE.Vector3(-25, -18, -825),
      max: new THREE.Vector3(25, 382, -775),
    });

    // Zone 2: Volcano AABB (approximate position based on VolcanoCaldera midpoint)
    const volMidAngle = -Math.PI + 1 * (Math.PI * 2 / 6) + Math.PI / 6;
    const volDist = (innerR + outerR) * 0.55;
    const vcx = Math.cos(volMidAngle) * volDist;
    const vcz = Math.sin(volMidAngle) * volDist;
    reg.current.push({
      min: new THREE.Vector3(vcx - 120, -18, vcz - 120),
      max: new THREE.Vector3(vcx + 120, 140, vcz + 120),
    });
  }, []); // Run once at mount

  return (
    <group position={[0, 20, 0]}>
      {/* Multi-biome terrain ring */}
      <TerrainRing innerRadius={innerR} outerRadius={outerR} />

      {/* Shoreline rocks */}
      <ShorelineRocks outerR={outerR} />

      {/* ── ZONE 1: Ancient Jungle (slot 0) ── */}
      <JungleTrees innerR={innerR} outerR={outerR} startAngle={zoneAngles[0].start} endAngle={zoneAngles[0].end} />
      <JungleTempleRuins innerR={innerR} outerR={outerR} startAngle={zoneAngles[0].start} endAngle={zoneAngles[0].end} />
      <JungleMushrooms innerR={innerR} outerR={outerR} startAngle={zoneAngles[0].start} endAngle={zoneAngles[0].end} />
      <JungleFireflies innerR={innerR} outerR={outerR} startAngle={zoneAngles[0].start} endAngle={zoneAngles[0].end} />

      {/* ── ZONE 2: Volcanic Badlands (slot 1) ── */}
      <ObsidianSpires innerR={innerR} outerR={outerR} startAngle={zoneAngles[1].start} endAngle={zoneAngles[1].end} />
      <LavaRivers innerR={innerR} outerR={outerR} startAngle={zoneAngles[1].start} endAngle={zoneAngles[1].end} />
      <DeadTrees innerR={innerR} outerR={outerR} startAngle={zoneAngles[1].start} endAngle={zoneAngles[1].end} />
      <VolcanoCaldera innerR={innerR} outerR={outerR} startAngle={zoneAngles[1].start} endAngle={zoneAngles[1].end} />
      <EmberParticles innerR={innerR} outerR={outerR} startAngle={zoneAngles[1].start} endAngle={zoneAngles[1].end} />

      {/* ── ZONE 3: Frozen Highlands (slot 2) ── */}
      <IceMountains innerR={innerR} outerR={outerR} startAngle={zoneAngles[2].start} endAngle={zoneAngles[2].end} />
      <CrystalTrees innerR={innerR} outerR={outerR} startAngle={zoneAngles[2].start} endAngle={zoneAngles[2].end} />
      <CliffFortress innerR={innerR} outerR={outerR} startAngle={zoneAngles[2].start} endAngle={zoneAngles[2].end} />
      <SnowParticles innerR={innerR} outerR={outerR} startAngle={zoneAngles[2].start} endAngle={zoneAngles[2].end} />
      <AuroraBorealis startAngle={zoneAngles[2].start} endAngle={zoneAngles[2].end} innerR={innerR} outerR={outerR} />

      {/* ── ZONE 4: Void Wastes (slot 3) ── */}
      <FloatingIslands innerR={innerR} outerR={outerR} startAngle={zoneAngles[3].start} endAngle={zoneAngles[3].end} />
      <VoidObelisks innerR={innerR} outerR={outerR} startAngle={zoneAngles[3].start} endAngle={zoneAngles[3].end} />
      <RealityTears innerR={innerR} outerR={outerR} startAngle={zoneAngles[3].start} endAngle={zoneAngles[3].end} />

      {/* ── ZONE 5: World Tree (slot 4) ── */}
      <WorldTree />

      {/* ── ZONE 6: Desert Ruins (slot 5) ── */}
      <DesertDunes innerR={innerR} outerR={outerR} startAngle={zoneAngles[5].start} endAngle={zoneAngles[5].end} />
      <Pyramids innerR={innerR} outerR={outerR} startAngle={zoneAngles[5].start} endAngle={zoneAngles[5].end} />
      <BuriedSkyscrapers innerR={innerR} outerR={outerR} startAngle={zoneAngles[5].start} endAngle={zoneAngles[5].end} />
      <OasisPools innerR={innerR} outerR={outerR} startAngle={zoneAngles[5].start} endAngle={zoneAngles[5].end} />
      <SandstormParticles innerR={innerR} outerR={outerR} startAngle={zoneAngles[5].start} endAngle={zoneAngles[5].end} />

      {/* ── Zone lighting ── */}
      <ZoneLighting innerR={innerR} outerR={outerR} />

      {/* ── Creatures across all zones ── */}
      <Creatures innerR={innerR} outerR={outerR} />
    </group>
  );
}
