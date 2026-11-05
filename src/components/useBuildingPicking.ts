"use client";

import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";
import { pickNearestBuilding, type BuildingPickTarget } from "@/lib/city/buildingPicking";
import { wasAdPointerConsumed } from "./SkyAds";

export type RegisterBuildingMesh = (mesh: THREE.InstancedMesh, buildings: readonly CityBuilding[]) => () => void;

export function useBuildingPicking(onBuildingClick: ((building: CityBuilding) => void) | undefined, disabled: boolean): RegisterBuildingMesh {
  const { gl, camera } = useThree();
  const targets = useRef(new Map<THREE.InstancedMesh, BuildingPickTarget>());
  const current = useRef({ onBuildingClick, disabled });
  useEffect(() => { current.current = { onBuildingClick, disabled }; }, [onBuildingClick, disabled]);

  const register = useCallback<RegisterBuildingMesh>((mesh, buildings) => {
    const target = { mesh, buildings };
    targets.current.set(mesh, target);
    return () => { if (targets.current.get(mesh) === target) targets.current.delete(mesh); };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hits: THREE.Intersection[] = [];
    let tap: { pointerId: number; time: number; building: CityBuilding; x: number; y: number } | null = null;
    let lastMove = 0;
    let changedCursor = false;
    const originalCursor = canvas.style.cursor;
    const flags = window as Window & { __spireClicked?: boolean; __spireCursor?: boolean };
    const blocked = () => current.current.disabled || wasAdPointerConsumed() || flags.__spireClicked;
    const resetCursor = () => {
      if (changedCursor) canvas.style.cursor = originalCursor;
      changedCursor = false;
    };
    const pick = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.near = camera.near;
      raycaster.far = camera.far;
      raycaster.setFromCamera(pointer, camera);
      return pickNearestBuilding(raycaster, targets.current.values(), hits);
    };
    const cancel = () => { tap = null; resetCursor(); };
    const down = (event: PointerEvent) => {
      tap = null;
      if (!event.isPrimary || event.button !== 0 || blocked()) return;
      const building = pick(event);
      if (building) tap = { pointerId: event.pointerId, time: performance.now(), building, x: event.clientX, y: event.clientY };
    };
    const up = (event: PointerEvent) => {
      const pressed = tap;
      tap = null;
      if (!pressed || pressed.pointerId !== event.pointerId || blocked()) return;
      if (performance.now() - pressed.time > 400 || (event.clientX - pressed.x) ** 2 + (event.clientY - pressed.y) ** 2 > 625) return;
      const building = pick(event);
      if (building?.login === pressed.building.login) current.current.onBuildingClick?.(building);
    };
    const move = (event: PointerEvent) => {
      if (tap && (event.clientX - tap.x) ** 2 + (event.clientY - tap.y) ** 2 > 625) tap = null;
      if (event.pointerType === "touch" || event.buttons || flags.__spireCursor) return;
      if (blocked()) { resetCursor(); return; }
      const now = performance.now();
      if (now - lastMove < 125) return;
      lastMove = now;
      canvas.style.cursor = pick(event) ? "pointer" : originalCursor;
      changedCursor = true;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", resetCursor);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", resetCursor);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      resetCursor();
    };
  }, [gl, camera]);
  return register;
}
