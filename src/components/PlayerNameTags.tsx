"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityPlayer } from "@/lib/multiplayer/types";
import type { CityBuilding } from "@/lib/github";

// ─── Configuration ──────────────────────────────────────────
const TAG_HEIGHT_OFFSET = 20;
const TAG_SCALE = 0.8;
const LERP_SPEED = 0.08;
const MAX_VISIBLE_TAGS = 30;
const MAX_VIEW_DISTANCE = 800;

// ─── Helper: Create text sprite texture ─────────────────────
function createTextTexture(
  text: string,
  color: string = "#4ade80",
): { texture: THREE.CanvasTexture; aspect: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const fontSize = 28;
  const padding = 16;
  const font = `bold ${fontSize}px 'Courier New', monospace`;

  ctx.font = font;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(fontSize * 1.6 + padding);

  // Background pill
  ctx.fillStyle = "rgba(10, 10, 14, 0.75)";
  const radius = 6;
  const w = canvas.width;
  const h = canvas.height;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.quadraticCurveTo(w, 0, w, radius);
  ctx.lineTo(w, h - radius);
  ctx.quadraticCurveTo(w, h, w - radius, h);
  ctx.lineTo(radius, h);
  ctx.quadraticCurveTo(0, h, 0, h - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Border
  ctx.strokeStyle = `${color}44`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Text
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return { texture, aspect: canvas.width / canvas.height };
}

// ─── Single floating name tag ───────────────────────────────
interface FloatingTagData {
  targetX: number;
  targetY: number;
  targetZ: number;
  currentX: number;
  currentY: number;
  currentZ: number;
  login: string;
  texture: THREE.CanvasTexture;
  aspect: number;
}

// ─── Component ──────────────────────────────────────────────
interface PlayerNameTagsProps {
  /** Other players' state from the presence hook */
  players: Map<string, CityPlayer>;
  /** All city buildings (to resolve focused building positions) */
  buildings: CityBuilding[];
}

export default function PlayerNameTags({
  players,
  buildings,
}: PlayerNameTagsProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const tagsRef = useRef<Map<string, FloatingTagData>>(new Map());
  const meshesRef = useRef<Map<string, THREE.Sprite>>(new Map());

  // Build a lookup from login → building
  const buildingByLogin = useMemo(() => {
    const map = new Map<string, CityBuilding>();
    for (const b of buildings) {
      map.set(b.login.toLowerCase(), b);
    }
    return map;
  }, [buildings]);

  // Update tag data when players change
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const currentTags = tagsRef.current;
    const currentMeshes = meshesRef.current;
    const activeIds = new Set<string>();

    // Limit visible tags
    const playerEntries = [...players.entries()].slice(0, MAX_VISIBLE_TAGS);

    for (const [id, player] of playerEntries) {
      activeIds.add(id);

      // Determine target position: building they're looking at, or their camera pos
      let targetX = player.cx;
      let targetY = player.cy;
      let targetZ = player.cz;

      if (player.focusedBuilding) {
        const building = buildingByLogin.get(
          player.focusedBuilding.toLowerCase(),
        );
        if (building) {
          targetX = building.position[0];
          targetY = building.height + TAG_HEIGHT_OFFSET;
          targetZ = building.position[2];
        }
      }

      // Update existing or create new
      const existing = currentTags.get(id);
      if (existing) {
        existing.targetX = targetX;
        existing.targetY = targetY;
        existing.targetZ = targetZ;

        // Update login if changed
        if (existing.login !== player.login) {
          existing.texture.dispose();
          const { texture, aspect } = createTextTexture(
            `@${player.login}`,
          );
          existing.texture = texture;
          existing.aspect = aspect;
          existing.login = player.login;

          // Update mesh material
          const mesh = currentMeshes.get(id);
          if (mesh) {
            (mesh.material as THREE.SpriteMaterial).map = texture;
            (mesh.material as THREE.SpriteMaterial).needsUpdate = true;
            mesh.scale.set(aspect * TAG_SCALE * 16, TAG_SCALE * 16, 1);
          }
        }
      } else {
        // Create new tag
        const { texture, aspect } = createTextTexture(
          `@${player.login}`,
        );

        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
          sizeAttenuation: true,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(aspect * TAG_SCALE * 16, TAG_SCALE * 16, 1);
        sprite.position.set(targetX, targetY, targetZ);
        sprite.renderOrder = 998;

        group.add(sprite);
        currentMeshes.set(id, sprite);

        currentTags.set(id, {
          targetX,
          targetY,
          targetZ,
          currentX: targetX,
          currentY: targetY,
          currentZ: targetZ,
          login: player.login,
          texture,
          aspect,
        });
      }
    }

    // Remove tags for players that left
    for (const [id, tag] of currentTags) {
      if (!activeIds.has(id)) {
        tag.texture.dispose();
        const mesh = currentMeshes.get(id);
        if (mesh) {
          group.remove(mesh);
          (mesh.material as THREE.SpriteMaterial).dispose();
        }
        currentMeshes.delete(id);
        currentTags.delete(id);
      }
    }
  }, [players, buildingByLogin]);

  // Animate: lerp positions + fade based on camera distance + billboard
  useFrame(() => {
    const currentTags = tagsRef.current;
    const currentMeshes = meshesRef.current;

    for (const [id, tag] of currentTags) {
      // Smooth position lerp
      tag.currentX += (tag.targetX - tag.currentX) * LERP_SPEED;
      tag.currentY += (tag.targetY - tag.targetY) * LERP_SPEED;
      tag.currentZ += (tag.targetZ - tag.currentZ) * LERP_SPEED;

      const mesh = currentMeshes.get(id);
      if (!mesh) continue;

      mesh.position.set(tag.currentX, tag.targetY, tag.currentZ);

      // Distance-based opacity
      const dx = camera.position.x - tag.currentX;
      const dz = camera.position.z - tag.currentZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const targetOpacity = dist > MAX_VIEW_DISTANCE ? 0 : 1 - dist / MAX_VIEW_DISTANCE;
      const mat = mesh.material as THREE.SpriteMaterial;
      mat.opacity += (Math.max(0, Math.min(1, targetOpacity)) - mat.opacity) * 0.1;
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      for (const [, tag] of tagsRef.current) {
        tag.texture.dispose();
      }
      for (const [, mesh] of meshesRef.current) {
        (mesh.material as THREE.SpriteMaterial).dispose();
      }
      tagsRef.current.clear();
      meshesRef.current.clear();
    };
  }, []);

  return <group ref={groupRef} />;
}
