// Original local simulation informed by Git City's separated drive/lap architecture.
// Source: srizzon/git-city@98cab64, src/lib/league-city/{drive,race}; AGPL-3.0.
export interface DriveInput { throttle: number; steer: number; brake: boolean }

export interface CircuitTrack {
  center: [number, number];
  radiusX: number;
  radiusZ: number;
  roadHalfWidth: number;
  islandSize: [number, number];
  checkpointCount: number;
  storageKey: string;
}

export interface CircuitTelemetry {
  speed: number;
  elapsedMs: number;
  bestMs: number | null;
  lastLapMs: number | null;
  lap: number;
  checkpoint: number;
  checkpointCount: number;
  valid: boolean;
  wrongWay: boolean;
  paused: boolean;
}

export interface DriveState extends Omit<CircuitTelemetry, "paused"> {
  x: number;
  z: number;
  yaw: number;
  angle: number;
  reverseTravel: number;
  started: boolean;
}

const TAU = Math.PI * 2;
export const MAX_DRIVE_SPEED = 72;
export const INITIAL_CIRCUIT_TELEMETRY: CircuitTelemetry = {
  speed: 0, elapsedMs: 0, bestMs: null, lastLapMs: null, lap: 1,
  checkpoint: 1, checkpointCount: 8, valid: true, wrongWay: false, paused: false,
};

export function createCityCircuit(maxX: number): CircuitTrack {
  return {
    center: [Math.max(20000, Number.isFinite(maxX) ? maxX : 20000) + 440, 0],
    radiusX: 180, radiusZ: 125, roadHalfWidth: 24,
    islandSize: [520, 410], checkpointCount: 8,
    storageKey: "leetcodecity:circuit:oval-v1:best",
  };
}

export function createDriveState(track: CircuitTrack, bestMs: number | null = null): DriveState {
  return {
    x: track.center[0] + track.radiusX, z: track.center[1], yaw: 0,
    speed: 0, angle: 0, reverseTravel: 0, started: false,
    elapsedMs: 0, bestMs, lastLapMs: null, lap: 1, checkpoint: 1,
    checkpointCount: track.checkpointCount, valid: true, wrongWay: false,
  };
}

export function circuitPosition(track: CircuitTrack, angle: number): [number, number] {
  return [track.center[0] + Math.cos(angle) * track.radiusX,
    track.center[1] + Math.sin(angle) * track.radiusZ];
}

/** Asphalt follows the same radial corridor as lap validation. */
export function circuitRoadEdge(track: CircuitTrack, angle: number, side: -1 | 1): [number, number] {
  const x = Math.cos(angle) * track.radiusX;
  const z = Math.sin(angle) * track.radiusZ;
  // Inset covers the tiny chord error between sampled vertices at the inner edge.
  const scale = 1 + side * (track.roadHalfWidth - 0.05) / Math.hypot(x, z);
  return [track.center[0] + x * scale, track.center[1] + z * scale];
}

export function circuitLocation(track: CircuitTrack, x: number, z: number) {
  const angle = (Math.atan2((z - track.center[1]) / track.radiusZ,
    (x - track.center[0]) / track.radiusX) + TAU) % TAU;
  const [roadX, roadZ] = circuitPosition(track, angle);
  return { angle, distance: Math.hypot(x - roadX, z - roadZ) };
}

/** Ordered forward crossings, independent from the rendering frame rate. */
export function updateCircuitProgress(state: DriveState, track: CircuitTrack, deltaSeconds: number) {
  const location = circuitLocation(track, state.x, state.z);
  const delta = ((location.angle - state.angle + Math.PI * 3) % TAU) - Math.PI;
  if (location.distance > track.roadHalfWidth) state.valid = false;
  if (delta < 0) state.reverseTravel -= delta;
  else if (delta > 0.001) state.reverseTravel = Math.max(0, state.reverseTravel - delta * 2);
  state.wrongWay = state.reverseTravel > 0.18;
  if (state.wrongWay) state.valid = false;

  const nextAngle = state.checkpoint * TAU / track.checkpointCount;
  const ahead = (nextAngle - state.angle + TAU) % TAU;
  const maxTravel = MAX_DRIVE_SPEED * Math.max(0, deltaSeconds) + 2;
  const plausible = Math.abs(delta) * Math.min(track.radiusX, track.radiusZ) <= maxTravel;
  if (!plausible || delta > TAU / track.checkpointCount) state.valid = false;

  if (state.started && delta > 0 && ahead > 0 && ahead <= delta + 1e-8) {
    if (state.checkpoint === 0) {
      const minLap = TAU * Math.min(track.radiusX, track.radiusZ) / MAX_DRIVE_SPEED * 1000;
      state.lastLapMs = Math.round(state.elapsedMs);
      if (state.valid && state.elapsedMs >= minLap
        && (state.bestMs === null || state.elapsedMs < state.bestMs)) {
        state.bestMs = state.lastLapMs;
      }
      state.lap++;
      state.elapsedMs = 0;
      state.valid = location.distance <= track.roadHalfWidth;
      state.reverseTravel = 0;
    }
    state.checkpoint = (state.checkpoint + 1) % track.checkpointCount;
  }
  state.angle = location.angle;
}

export function stepDriving(state: DriveState, input: DriveInput, seconds: number, track: CircuitTrack) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const throttle = Math.max(-1, Math.min(1, Number.isFinite(input.throttle) ? input.throttle : 0));
  const steer = Math.max(-1, Math.min(1, Number.isFinite(input.steer) ? input.steer : 0));
  let remaining = Math.min(seconds, 0.1);
  while (remaining > 1e-8) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    const offroad = circuitLocation(track, state.x, state.z).distance > track.roadHalfWidth;
    if (Math.abs(throttle) > 0.01 || Math.abs(state.speed) > 0.1) state.started = true;
    if (state.started) state.elapsedMs += dt * 1000;
    state.speed += throttle * 36 * dt;
    const drag = input.brake ? 5 : offroad ? 1.8 : throttle ? 0.16 : 0.75;
    state.speed *= Math.exp(-drag * dt);
    state.speed = Math.max(-22, Math.min(offroad ? 30 : MAX_DRIVE_SPEED, state.speed));
    state.yaw += steer * 1.9 * Math.min(1, Math.abs(state.speed) / 25)
      * Math.sign(state.speed) * dt;
    state.x += Math.sin(state.yaw) * state.speed * dt;
    state.z += Math.cos(state.yaw) * state.speed * dt;
    const limitX = track.islandSize[0] / 2 - 14;
    const limitZ = track.islandSize[1] / 2 - 14;
    const x = Math.max(track.center[0] - limitX, Math.min(track.center[0] + limitX, state.x));
    const z = Math.max(track.center[1] - limitZ, Math.min(track.center[1] + limitZ, state.z));
    if (x !== state.x || z !== state.z) state.speed *= -0.2;
    state.x = x; state.z = z;
    updateCircuitProgress(state, track, dt);
  }
}

export function circuitTelemetry(state: DriveState, paused = false): CircuitTelemetry {
  return {
    speed: Math.round(Math.abs(state.speed) * 1.44), elapsedMs: state.elapsedMs,
    bestMs: state.bestMs, lastLapMs: state.lastLapMs, lap: state.lap,
    checkpoint: state.checkpoint, checkpointCount: state.checkpointCount,
    valid: state.valid, wrongWay: state.wrongWay, paused,
  };
}

export function formatCircuitTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "--:--.---";
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms % 1000)).padStart(3, "0")}`;
}
