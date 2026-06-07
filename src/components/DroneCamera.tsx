"use client";

/**
 * DroneCamera — cinematic free-flight camera controller for CityCanvas.
 *
 * Design constraints (mirrors FlightController / IntroFlyover patterns):
 *  - NO React state for physics — all flight data lives in useRef so there
 *    are zero re-renders during flight.
 *  - Camera writes ONLY inside useFrame — never in useEffect.
 *  - Quaternion-based look to avoid gimbal lock.
 *  - Accepts onExit prop; emits it on Escape (same as FlightController line 693).
 *  - No EffectComposer / post-processing — the canvas is pixelated (dpr=1,
 *    imageRendering: pixelated). Post-processing is a separate follow-up.
 *
 * Keybindings:
 *  WASD / Arrow keys — forward / back / strafe
 *  Q / E             — ascend / descend
 *  Mouse move        — look (pitch + yaw)
 *  Shift             — boost speed (3×)
 *  Escape            — exit drone mode
 */

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ─── Tuning constants ─────────────────────────────────────────

const BASE_SPEED     = 80;   // units/s at normal speed
const BOOST_MULT     = 3.0;  // Shift multiplier
const DAMPING        = 0.88; // velocity decay per frame (applied after move)
const MOUSE_SENS_X   = 0.0018; // yaw sensitivity (radians per pixel)
const MOUSE_SENS_Y   = 0.0014; // pitch sensitivity
const MAX_PITCH      = Math.PI / 2.1; // ±~85° — prevents full flip
const MIN_ALTITUDE   = 5;    // don't go underground
const MAX_ALTITUDE   = 2400; // stay below fog far (2500)
const ENTRY_LERP     = 0.06; // fraction per frame for entry transition

// ─── Pre-allocated module-level temps (never in useFrame hot path) ────────
const _forward = new THREE.Vector3();
const _right   = new THREE.Vector3();
const _up      = new THREE.Vector3(0, 1, 0);
const _move    = new THREE.Vector3();
const _qYaw    = new THREE.Quaternion();
const _qPitch  = new THREE.Quaternion();
const _qTarget = new THREE.Quaternion();
const _pitchAxis = new THREE.Vector3(1, 0, 0);

// ─── Props ────────────────────────────────────────────────────

interface DroneCameraProps {
  onExit: () => void;
}

// ─── Component ────────────────────────────────────────────────

export default function DroneCamera({ onExit }: DroneCameraProps) {
  const { camera } = useThree();

  // ── Flight state (all refs — zero re-renders) ──────────────
  const velocity   = useRef(new THREE.Vector3());
  const yaw        = useRef(0);   // radians, world Y axis
  const pitch      = useRef(0);   // radians, camera-local X axis
  const keys       = useRef<Record<string, boolean>>({});
  const mouse      = useRef({ dx: 0, dy: 0 }); // accumulated delta since last frame
  const entered    = useRef(false); // false until entry lerp completes
  const entryFrom  = useRef(new THREE.Vector3());
  const entryTo    = useRef(new THREE.Vector3());
  const entryProg  = useRef(0); // 0→1

  // ── Derive initial yaw/pitch from current camera orientation ─
  useEffect(() => {
    // Derive yaw from camera world direction projected onto XZ plane
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    yaw.current   = Math.atan2(-dir.x, -dir.z);
    pitch.current = Math.asin(Math.max(-1, Math.min(1, dir.y)));

    // Entry lerp: start at current orbit pos, stay put (no teleport)
    entryFrom.current.copy(camera.position);
    entryTo.current.copy(camera.position);
    entryProg.current = 0;
    entered.current   = false;

    velocity.current.set(0, 0, 0);
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Input handlers ─────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "Escape") onExit();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      mouse.current.dx += e.movementX;
      mouse.current.dy += e.movementY;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [onExit]);

  // ── Per-frame flight logic ─────────────────────────────────
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05); // cap at 50ms (20fps floor)
    const k  = keys.current;

    // ── Entry transition (smooth 0.3s lerp from orbit position) ──
    if (!entered.current) {
      entryProg.current = Math.min(entryProg.current + dt / 0.3, 1);
      camera.position.lerpVectors(entryFrom.current, entryTo.current, entryProg.current);
      if (entryProg.current >= 1) entered.current = true;
      // Still apply look during transition so it doesn't snap
      applyLook();
      return;
    }

    // ── Look: consume accumulated mouse delta ──────────────────
    const dx = mouse.current.dx;
    const dy = mouse.current.dy;
    mouse.current.dx = 0;
    mouse.current.dy = 0;

    yaw.current   -= dx * MOUSE_SENS_X;
    pitch.current -= dy * MOUSE_SENS_Y;
    pitch.current  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch.current));

    applyLook();

    // ── Move: build world-space delta from WASD in camera frame ─
    const boost = k["ShiftLeft"] || k["ShiftRight"] ? BOOST_MULT : 1;
    const speed = BASE_SPEED * boost * dt;

    // Camera forward (projected, not pitched — keeps altitude stable on W/S)
    _forward.set(Math.sin(-yaw.current), 0, Math.cos(-yaw.current));
    _right.crossVectors(_forward, _up).normalize().negate();

    _move.set(0, 0, 0);
    if (k["KeyW"] || k["ArrowUp"])    _move.addScaledVector(_forward,  speed);
    if (k["KeyS"] || k["ArrowDown"])  _move.addScaledVector(_forward, -speed);
    if (k["KeyA"] || k["ArrowLeft"])  _move.addScaledVector(_right,    speed);
    if (k["KeyD"] || k["ArrowRight"]) _move.addScaledVector(_right,   -speed);
    if (k["KeyQ"])                    _move.y += speed;
    if (k["KeyE"])                    _move.y -= speed;

    // Accumulate into velocity then damp
    velocity.current.add(_move);
    velocity.current.multiplyScalar(DAMPING);

    camera.position.add(velocity.current);

    // Altitude clamp
    camera.position.y = Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, camera.position.y));
  });

  // ── Helper: write yaw + pitch into camera.quaternion ────────
  function applyLook() {
    _qYaw.setFromAxisAngle(_up, yaw.current);
    _qPitch.setFromAxisAngle(_pitchAxis, pitch.current);
    _qTarget.multiplyQuaternions(_qYaw, _qPitch);
    camera.quaternion.slerp(_qTarget, 0.25); // smooth look, not snap
  }

  return null; // renders nothing — pure camera controller
}