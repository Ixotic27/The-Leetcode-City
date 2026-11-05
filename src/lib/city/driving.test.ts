import { describe, expect, it } from "vitest";
import {
  circuitLocation, circuitPosition, circuitRoadEdge, createCityCircuit, createDriveState, formatCircuitTime,
  MAX_DRIVE_SPEED, stepDriving, updateCircuitProgress, type DriveState,
} from "./driving";

const track = createCityCircuit(1200);
const accelerate = { throttle: 1, steer: 0, brake: false };
function move(state: DriveState, angle: number, dt = 0.05) {
  [state.x, state.z] = circuitPosition(track, angle);
  state.elapsedMs += dt * 1000;
  updateCircuitProgress(state, track, dt);
}
function finish(state: DriveState) {
  state.started = true;
  for (let angle = 0.01; angle < Math.PI * 2; angle += 0.01) move(state, angle);
  move(state, Math.PI * 2);
}

describe("city circuit", () => {
  it("keeps every visible asphalt edge and sampled inner chord inside the valid corridor", () => {
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 256; i++) {
        const angle = i / 256 * Math.PI * 2;
        const point = circuitRoadEdge(track, angle, side);
        const next = circuitRoadEdge(track, (i + 1) / 256 * Math.PI * 2, side);
        expect(circuitLocation(track, ...point).distance).toBeCloseTo(track.roadHalfWidth - 0.05, 6);
        const middle: [number, number] = [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
        expect(circuitLocation(track, ...middle).distance).toBeLessThanOrEqual(track.roadHalfWidth);
      }
    }
  });
  it("reserves the circuit beyond the occupied world and keeps it stable during small profile updates", () => {
    const first = createCityCircuit(9000);
    const later = createCityCircuit(9500);
    expect(first).toEqual(later);
    const expanded = createCityCircuit(25000);
    expect(expanded.center[0] - expanded.islandSize[0] / 2).toBeGreaterThan(25000);
    expect(createCityCircuit(NaN).center.every(Number.isFinite)).toBe(true);
  });

  it("starts the clock on driving, limits speed, brakes, and does not run away after a suspended frame", () => {
    const state = createDriveState(track);
    stepDriving(state, { throttle: 0, steer: 0, brake: false }, 0.05, track);
    expect(state.elapsedMs).toBe(0);
    for (let frame = 0; frame < 30; frame++) stepDriving(state, accelerate, 1 / 60, track);
    expect(state.speed).toBeGreaterThan(0);
    expect(state.speed).toBeLessThanOrEqual(MAX_DRIVE_SPEED);
    const before = state.speed;
    stepDriving(state, { throttle: 0, steer: 0, brake: true }, 0.1, track);
    expect(state.speed).toBeLessThan(before);
    const elapsed = state.elapsedMs;
    stepDriving(state, accelerate, 1000, track);
    expect(state.elapsedMs - elapsed).toBeCloseTo(100, 5);
  });

  it.each([10, 30])("keeps simulation consistent across %i and 120 fps", (fps) => {
    const slow = createDriveState(track), fast = createDriveState(track);
    for (let i = 0; i < fps; i++) stepDriving(slow, accelerate, 1 / fps, track);
    for (let i = 0; i < 120; i++) stepDriving(fast, accelerate, 1 / 120, track);
    expect(slow.x).toBeCloseTo(fast.x, 6);
    expect(slow.z).toBeCloseTo(fast.z, 6);
    expect(slow.speed).toBeCloseTo(fast.speed, 6);
  });

  it("records a valid lap only after every forward checkpoint", () => {
    const state = createDriveState(track);
    finish(state);
    expect(state.lap).toBe(2);
    expect(state.checkpoint).toBe(1);
    expect(state.lastLapMs).toBeGreaterThan(10000);
    expect(state.bestMs).toBe(state.lastLapMs);
    expect(state.valid).toBe(true);
  });

  it("lets a car steering along the road finish a valid lap through the real physics", () => {
    const state = createDriveState(track);
    for (let frame = 0; frame < 60 * 120 && state.lap === 1; frame++) {
      const [tx, tz] = circuitPosition(track, circuitLocation(track, state.x, state.z).angle + 0.35);
      const heading = Math.atan2(tx - state.x, tz - state.z);
      const error = ((heading - state.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      stepDriving(state, { throttle: 1, steer: Math.max(-1, Math.min(1, error * 3)), brake: false }, 1 / 60, track);
    }
    expect(state.lap).toBe(2);
    expect(state.bestMs).toBe(state.lastLapMs);
  });

  it("invalidates shortcuts and keeps an existing best after an off-road lap", () => {
    const state = createDriveState(track, 20000);
    state.started = true;
    state.x += 40;
    updateCircuitProgress(state, track, 0.05);
    expect(state.valid).toBe(false);
    finish(state);
    expect(state.lap).toBe(2);
    expect(state.bestMs).toBe(20000);
    expect(state.valid).toBe(true);
    const skipped = createDriveState(track);
    skipped.started = true;
    move(skipped, Math.PI);
    move(skipped, Math.PI * 2);
    expect(skipped.bestMs).toBeNull();
  });

  it("reports backward driving and a restart restores a clean lap", () => {
    const state = createDriveState(track, 23000);
    state.started = true;
    for (let angle = -0.01; angle > -0.3; angle -= 0.01) move(state, angle);
    expect(state.wrongWay).toBe(true);
    expect(state.valid).toBe(false);
    const restarted = createDriveState(track, state.bestMs);
    expect(restarted).toMatchObject({ speed: 0, elapsedMs: 0, checkpoint: 1, valid: true, wrongWay: false, bestMs: 23000 });
  });

  it("formats the local clock without layout-changing precision", () => {
    expect(formatCircuitTime(83456)).toBe("1:23.456");
    expect(formatCircuitTime(null)).toBe("--:--.---");
  });
});
