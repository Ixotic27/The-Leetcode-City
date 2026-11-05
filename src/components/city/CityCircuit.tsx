"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  circuitPosition, circuitRoadEdge, circuitTelemetry, createDriveState, stepDriving,
  type CircuitTelemetry, type CircuitTrack, type DriveInput,
} from "@/lib/city/driving";

interface Props {
  track: CircuitTrack;
  active: boolean;
  onExit: () => void;
  onTelemetry: (telemetry: CircuitTelemetry) => void;
  restartSignal?: number;
  touchInput?: MutableRefObject<DriveInput>;
  reducedMotion?: boolean;
}

function isTyping() {
  const element = document.activeElement as HTMLElement | null;
  return !!element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
}

function CircuitDriver({ track, onExit, onTelemetry, restartSignal, touchInput, reducedMotion }: Omit<Props, "active">) {
  const car = useRef<THREE.Group>(null);
  const checkpointMarker = useRef<THREE.Mesh>(null);
  const state = useRef(createDriveState(track));
  const keys = useRef(new Set<string>());
  const paused = useRef(false);
  const publishAt = useRef(0);
  const bestSaved = useRef<number | null>(null);
  const callbacks = useRef({ onExit, onTelemetry });
  const { camera } = useThree();
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const input = useMemo<DriveInput>(() => ({ throttle: 0, steer: 0, brake: false }), []);

  useEffect(() => { callbacks.current = { onExit, onTelemetry }; }, [onExit, onTelemetry]);

  useEffect(() => {
    let best: number | null = null;
    try {
      const value = Number(localStorage.getItem(track.storageKey));
      if (Number.isFinite(value) && value > 0) best = value;
    } catch { /* Browser storage is optional for local records. */ }
    state.current = createDriveState(track, best);
    bestSaved.current = best;
    keys.current.clear();
    if (touchInput) Object.assign(touchInput.current, { throttle: 0, steer: 0, brake: false });
    publishAt.current = 0;
    callbacks.current.onTelemetry(circuitTelemetry(state.current));
  }, [track, restartSignal, touchInput]);

  useEffect(() => {
    const position = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    camera.position.set(state.current.x, 28, state.current.z - 44);
    camera.lookAt(state.current.x, 0, state.current.z + 24);
    const clear = () => {
      keys.current.clear();
      if (touchInput) Object.assign(touchInput.current, { throttle: 0, steer: 0, brake: false });
    };
    const down = (event: KeyboardEvent) => {
      if (isTyping() || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.code === "Escape") {
        event.preventDefault();
        callbacks.current.onExit();
        return;
      }
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        if (event.code === "Space" && (event.target as HTMLElement)?.tagName === "BUTTON") return;
        event.preventDefault();
        keys.current.add(event.code);
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const blur = () => { clear(); paused.current = true; };
    const focus = () => { clear(); paused.current = document.hidden; };
    const visibility = () => document.hidden ? blur() : focus();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clear();
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [camera, touchInput]);

  useFrame(({ clock, size }, delta) => {
    const st = state.current;
    const held = keys.current;
    const isPaused = paused.current || document.hidden || isTyping();
    if (!isPaused) {
      input.throttle = Number(held.has("KeyW") || held.has("ArrowUp")) - Number(held.has("KeyS") || held.has("ArrowDown"));
      input.steer = Number(held.has("KeyD") || held.has("ArrowRight")) - Number(held.has("KeyA") || held.has("ArrowLeft"));
      input.brake = held.has("Space");
      if (touchInput) {
        if (touchInput.current.throttle) input.throttle = touchInput.current.throttle;
        if (touchInput.current.steer) input.steer = touchInput.current.steer;
        input.brake ||= touchInput.current.brake;
      }
      stepDriving(st, input, delta, track);
    }
    if (car.current) {
      car.current.position.set(st.x, 0.4, st.z);
      car.current.rotation.y = st.yaw;
    }
    if (checkpointMarker.current) {
      const [x, z] = circuitPosition(track, st.checkpoint * Math.PI * 2 / track.checkpointCount);
      checkpointMarker.current.position.set(x, 14, z);
    }
    const portrait = size.height > size.width;
    const back = portrait ? 60 : 44;
    cameraTarget.set(st.x - Math.sin(st.yaw) * back, portrait ? 45 : 28, st.z - Math.cos(st.yaw) * back);
    lookTarget.set(st.x + Math.sin(st.yaw) * 24, 0, st.z + Math.cos(st.yaw) * 24);
    camera.position.lerp(cameraTarget, reducedMotion ? 1 : 1 - Math.exp(-delta * 7));
    camera.lookAt(lookTarget);
    if (st.bestMs !== bestSaved.current) {
      bestSaved.current = st.bestMs;
      if (st.bestMs !== null) {
        try { localStorage.setItem(track.storageKey, String(st.bestMs)); } catch { /* The trial still works without storage. */ }
      }
    }
    if (clock.elapsedTime - publishAt.current >= 0.1) {
      publishAt.current = clock.elapsedTime;
      callbacks.current.onTelemetry(circuitTelemetry(st, isPaused));
    }
  });

  return (
    <>
    <mesh ref={checkpointMarker}><octahedronGeometry args={[4]} /><meshBasicMaterial color="#70e4c0" /></mesh>
    <group ref={car} position={[track.center[0] + track.radiusX, 0.4, track.center[1]]}>
      <mesh position={[0, 2.4, 0]}><boxGeometry args={[7.5, 3, 13]} /><meshStandardMaterial color="#ffa116" roughness={0.45} /></mesh>
      <mesh position={[0, 4.7, -1]}><boxGeometry args={[6.3, 2.7, 6.5]} /><meshStandardMaterial color="#172f49" roughness={0.35} /></mesh>
      <mesh position={[0, 2.5, 6.6]}><boxGeometry args={[6.5, 1, 0.3]} /><meshBasicMaterial color="#fff4cf" /></mesh>
      <mesh position={[0, 2.5, -6.6]}><boxGeometry args={[6.5, 1, 0.3]} /><meshBasicMaterial color="#f34a49" /></mesh>
      {[-4, 4].flatMap((x) => [-4, 4].map((z) => (
        <mesh key={`${x}:${z}`} position={[x, 1.6, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.7, 1.7, 1.4, 10]} /><meshStandardMaterial color="#151820" />
        </mesh>
      )))}
    </group>
    </>
  );
}

export default function CityCircuit(props: Props) {
  const { track, active } = props;
  const [road, kerbs] = useMemo(() => {
    // Ring between two signed offsets from the centerline (positive = outside).
    const band = (outer: number, inner: number) => {
      const shape = new THREE.Shape();
      const hole = new THREE.Path();
      const edge = (offset: number, angle: number) => circuitRoadEdge(
        { ...track, center: [0, 0], roadHalfWidth: Math.abs(offset) }, angle, offset < 0 ? -1 : 1);
      for (let i = 0; i <= 256; i++) {
        const [x, z] = edge(outer, i / 256 * Math.PI * 2);
        const [innerX, innerZ] = edge(inner, -i / 256 * Math.PI * 2);
        if (i === 0) { shape.moveTo(x, z); hole.moveTo(innerX, innerZ); }
        else { shape.lineTo(x, z); hole.lineTo(innerX, innerZ); }
      }
      shape.closePath();
      hole.closePath();
      shape.holes.push(hole);
      return new THREE.ShapeGeometry(shape, 80);
    };
    const hw = track.roadHalfWidth;
    return [band(hw, -hw), [band(hw, hw - 1.6), band(1.6 - hw, -hw)]] as const;
  }, [track]);
  useEffect(() => () => { road.dispose(); kerbs.forEach((kerb) => kerb.dispose()); }, [road, kerbs]);

  return (
    <>
      <group position={[track.center[0], 0, track.center[1]]}>
        <mesh position={[0, -4, 0]}><boxGeometry args={[track.islandSize[0], 6, track.islandSize[1]]} /><meshStandardMaterial color="#886d45" /></mesh>
        <mesh position={[0, -0.8, 0]}><boxGeometry args={[track.islandSize[0] - 16, 0.4, track.islandSize[1] - 16]} /><meshStandardMaterial color="#32483a" /></mesh>
        <mesh geometry={road} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}><meshStandardMaterial color="#26313e" roughness={0.95} side={THREE.DoubleSide} /></mesh>
        {/* Unlit kerbs mark the exact track limits used by lap validation, readable in night themes. */}
        {kerbs.map((kerb, index) => <mesh key={index} geometry={kerb} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}><meshBasicMaterial color="#e8eef5" side={THREE.DoubleSide} /></mesh>)}
        {Array.from({ length: track.checkpointCount }, (_, index) => {
          const angle = index / track.checkpointCount * Math.PI * 2;
          const [x, z] = circuitPosition({ ...track, center: [0, 0] }, angle);
          const yaw = Math.atan2(-track.radiusX * Math.sin(angle), track.radiusZ * Math.cos(angle));
          return (
            <group key={index} position={[x, 0, z]} rotation={[0, yaw, 0]}>
              <mesh position={[0, 0.24, 0]}><boxGeometry args={[track.roadHalfWidth * 2, 0.2, index === 0 ? 5 : 1.2]} /><meshBasicMaterial color={index === 0 ? "#fff0cb" : "#718794"} /></mesh>
              {index === 0 && <>
                {[-1, 1].map((side) => <mesh key={side} position={[side * (track.roadHalfWidth + 3), 10, 0]}><boxGeometry args={[2, 20, 2]} /><meshStandardMaterial color="#ffa116" /></mesh>)}
                <mesh position={[0, 20, 0]}><boxGeometry args={[track.roadHalfWidth * 2 + 8, 3, 2]} /><meshStandardMaterial color="#ffa116" /></mesh>
              </>}
            </group>
          );
        })}
        <mesh position={[0, 1, 0]}><cylinderGeometry args={[26, 28, 3, 8]} /><meshStandardMaterial color="#3c6953" /></mesh>
      </group>
      {/* City lights are tuned for distant skylines; the car needs its own fill while racing. */}
      {active && <hemisphereLight args={["#dbe8ff", "#3a4030", 1.4]} />}
      {active && <CircuitDriver {...props} />}
    </>
  );
}
