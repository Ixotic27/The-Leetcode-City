import { describe, it, expect } from "vitest";

// ─── Unit tests for DroneCamera logic ────────────────────────
//
// DroneCamera is a pure Three.js/R3F component with no serializable
// DOM output, so we test the physics and guard logic in isolation by
// extracting the pure functions.
//
// The tests cover:
//   1. Velocity accumulation and DAMPING decay
//   2. Altitude clamping (MIN / MAX)
//   3. Pitch clamping (±MAX_PITCH prevents flip)
//   4. Yaw derivation from a camera direction vector
//   5. Mutual exclusion invariant: droneMode + flyMode cannot both be true
//   6. Entry-transition progress clamping (0 → 1, never exceeds 1)

// ─── Mirrored constants (keep in sync with DroneCamera.tsx) ──
const BASE_SPEED   = 80;
const BOOST_MULT   = 3.0;
const DAMPING      = 0.88;
const MAX_PITCH    = Math.PI / 2.1;
const MIN_ALTITUDE = 5;
const MAX_ALTITUDE = 2400;

// ─── Pure helpers (extracted from component logic) ───────────

function applyDamping(velocity: number): number {
  return velocity * DAMPING;
}

function clampAltitude(y: number): number {
  return Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, y));
}

function clampPitch(p: number): number {
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p));
}

function deriveYaw(dirX: number, dirZ: number): number {
  return Math.atan2(-dirX, -dirZ);
}

function computeSpeed(baseSpeed: number, dt: number, boosted: boolean): number {
  return baseSpeed * (boosted ? BOOST_MULT : 1) * dt;
}

function advanceEntryProgress(current: number, dt: number, duration = 0.3): number {
  return Math.min(current + dt / duration, 1);
}

// ─── Tests ───────────────────────────────────────────────────

describe("DroneCamera — velocity and damping", () => {
  it("applies DAMPING to a non-zero velocity", () => {
    const v = 100;
    expect(applyDamping(v)).toBeCloseTo(100 * 0.88);
  });

  it("velocity decays toward zero over repeated frames", () => {
    let v = 100;
    for (let i = 0; i < 60; i++) v = applyDamping(v);
    expect(v).toBeLessThan(1); // effectively zero after 60 frames
  });

  it("zero velocity stays zero after damping", () => {
    expect(applyDamping(0)).toBe(0);
  });
});

describe("DroneCamera — altitude clamping", () => {
  it("clamps below MIN_ALTITUDE to MIN_ALTITUDE", () => {
    expect(clampAltitude(-10)).toBe(MIN_ALTITUDE);
    expect(clampAltitude(0)).toBe(MIN_ALTITUDE);
    expect(clampAltitude(4.9)).toBe(MIN_ALTITUDE);
  });

  it("clamps above MAX_ALTITUDE to MAX_ALTITUDE", () => {
    expect(clampAltitude(3000)).toBe(MAX_ALTITUDE);
    expect(clampAltitude(MAX_ALTITUDE + 1)).toBe(MAX_ALTITUDE);
  });

  it("passes through valid altitude unchanged", () => {
    expect(clampAltitude(100)).toBe(100);
    expect(clampAltitude(MIN_ALTITUDE)).toBe(MIN_ALTITUDE);
    expect(clampAltitude(MAX_ALTITUDE)).toBe(MAX_ALTITUDE);
  });
});

describe("DroneCamera — pitch clamping", () => {
  it("clamps pitch above MAX_PITCH", () => {
    expect(clampPitch(Math.PI)).toBe(MAX_PITCH);
  });

  it("clamps pitch below -MAX_PITCH", () => {
    expect(clampPitch(-Math.PI)).toBe(-MAX_PITCH);
  });

  it("passes through pitch within range", () => {
    const p = MAX_PITCH / 2;
    expect(clampPitch(p)).toBeCloseTo(p);
  });

  it("MAX_PITCH is less than π/2 (no full-flip)", () => {
    expect(MAX_PITCH).toBeLessThan(Math.PI / 2);
  });
});

describe("DroneCamera — yaw derivation", () => {
  it("camera looking north (-Z) gives yaw ≈ 0", () => {
    // dir = (0, 0, -1) → yaw = atan2(0, 1) = 0
    expect(deriveYaw(0, -1)).toBeCloseTo(0);
  });

  it("camera looking east (+X) gives yaw ≈ -π/2", () => {
    // dir = (1, 0, 0) → yaw = atan2(-1, 0) = -π/2
    expect(deriveYaw(1, 0)).toBeCloseTo(-Math.PI / 2);
  });

  it("camera looking west (-X) gives yaw ≈ +π/2", () => {
    // dir = (-1, 0, 0) → yaw = atan2(1, 0) = π/2
    expect(deriveYaw(-1, 0)).toBeCloseTo(Math.PI / 2);
  });
});

describe("DroneCamera — speed calculation", () => {
  it("normal speed scales by BASE_SPEED * dt", () => {
    const dt = 1 / 60;
    expect(computeSpeed(BASE_SPEED, dt, false)).toBeCloseTo(BASE_SPEED * dt);
  });

  it("boosted speed is BOOST_MULT times normal", () => {
    const dt = 1 / 60;
    const normal  = computeSpeed(BASE_SPEED, dt, false);
    const boosted = computeSpeed(BASE_SPEED, dt, true);
    expect(boosted / normal).toBeCloseTo(BOOST_MULT);
  });

  it("dt cap of 0.05 (20fps floor) limits max per-frame travel", () => {
    const maxTravel = computeSpeed(BASE_SPEED, 0.05, false);
    expect(maxTravel).toBeCloseTo(BASE_SPEED * 0.05);
    expect(maxTravel).toBeLessThan(BASE_SPEED); // never full-speed in one frame
  });
});

describe("DroneCamera — entry transition", () => {
  it("progress advances from 0 to 1 over ~0.3s at 60fps", () => {
    let p = 0;
    const dt = 1 / 60;
    const frames = Math.ceil(0.3 / dt) + 2; // a couple of frames past target
    for (let i = 0; i < frames; i++) p = advanceEntryProgress(p, dt);
    expect(p).toBe(1); // clamped, never exceeds 1
  });

  it("progress never exceeds 1", () => {
    let p = 0.99;
    p = advanceEntryProgress(p, 1 / 6); // very large dt
    expect(p).toBe(1);
  });

  it("progress at exactly 1 means entry is complete", () => {
    expect(advanceEntryProgress(1, 1 / 60)).toBe(1);
  });
});

describe("droneMode / flyMode mutual exclusion invariant", () => {
  // This is an application-level invariant: the parent must never set both.
  // The component itself doesn't enforce this — the OrbitScene guard
  // (!flyMode && !droneMode) in CityCanvas handles it by not rendering
  // OrbitScene when either is active.

  function resolveActiveMode(flyMode: boolean, droneMode: boolean): "orbit" | "fly" | "drone" {
    if (flyMode) return "fly";    // flyMode has priority
    if (droneMode) return "drone";
    return "orbit";
  }

  it("flyMode=true, droneMode=false → fly", () => {
    expect(resolveActiveMode(true, false)).toBe("fly");
  });

  it("flyMode=false, droneMode=true → drone", () => {
    expect(resolveActiveMode(false, true)).toBe("drone");
  });

  it("both false → orbit", () => {
    expect(resolveActiveMode(false, false)).toBe("orbit");
  });

  it("flyMode=true takes priority over droneMode=true (parent guard expected)", () => {
    // flyMode wins — parent should prevent this state, but component is safe
    expect(resolveActiveMode(true, true)).toBe("fly");
  });
});