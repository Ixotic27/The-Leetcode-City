# Design Document: Dark Continent World

## Overview

The Dark Continent is a standalone Next.js page at `/dark-continent` — a fully self-contained React Three Fiber scene that renders a large procedural island surrounded by open ocean. It is architecturally independent of the LeetCode City codebase: no city building data, no city canvas, no shared state.

The island is divided into six biome zones arranged as 60-degree angular sectors around a central highland. An airplane flight controller lets the player explore the island from a first-person cockpit view. A flat-array AABB collision system registers every solid instanced mesh at mount time and is swept each frame.

The implementation extends the existing `OuterWildlands.tsx` rather than replacing it. The existing Zones 1–4 + 6 are already substantially built; the main additions are:
- Zone 3 AuroraBorealis component (missing)
- Standalone page + canvas wrapper (new files)
- AirplaneController with swept-AABB collision (new files)
- CollisionRegistry infrastructure (new lib files)
- Extracted terrain/zone helpers into `src/lib/darkContinent/`
- `OuterWildlands` props change from `{ cityRadius, themeIndex }` to `{ innerR?, outerR? }` for standalone use
- HUD overlay on the Dark Continent canvas

---

## Architecture

```
src/app/dark-continent/page.tsx          ← Next.js page (dynamic import, no SSR)
src/components/DarkContinentCanvas.tsx   ← Canvas wrapper: <Canvas>, lighting, fog, ocean
src/components/OuterWildlands.tsx        ← All 6 biome zones (extended from existing)
src/components/AirplaneController.tsx   ← Flight + AABB collision
src/lib/darkContinent/collision.ts       ← AABB types + helpers
src/lib/darkContinent/terrain.ts         ← seededRandom, noise2D, fbmNoise, getTerrainHeight
src/lib/darkContinent/zones.ts           ← ZONE_PALETTES, ZONE_COUNT, getZone, getZoneWeight
```

### Dependency Graph

```
page.tsx
  └─ DarkContinentCanvas (dynamic, ssr:false)
       ├─ <Canvas> (R3F)
       │    ├─ AirplaneController   ← reads CollisionRegistry ref
       │    └─ OuterWildlands       ← populates CollisionRegistry ref at mount
       └─ HUD overlay (DOM, absolute positioned)
```

### Key Architectural Decisions

**Standalone vs. city-integrated**: The page imports nothing from city modules. `DarkContinentCanvas` needs no props.

**CollisionRegistry as a React ref**: The registry is a `React.MutableRefObject<AABB[]>` created in `DarkContinentCanvas` and passed down to both `OuterWildlands` (write) and `AirplaneController` (read). This avoids global state while keeping the array alive across frames without causing re-renders.

**Lib extraction**: `terrain.ts`, `zones.ts`, and `collision.ts` are plain TypeScript modules (no React) so they can be unit-tested without a DOM or R3F context. `OuterWildlands.tsx` imports from these instead of defining helpers inline.

**OuterWildlands props migration**: The existing component receives `{ cityRadius, themeIndex }` and computes `innerR = cityRadius + 180`, `outerR = cityRadius + 3000`. For the standalone page we pass `innerR = 180`, `outerR = 3000` directly. The component will accept `{ innerR?: number; outerR?: number }` with defaults matching the existing math.

---

## Components and Interfaces

### `src/app/dark-continent/page.tsx`

```tsx
"use client";
import dynamic from "next/dynamic";
const DarkContinentCanvas = dynamic(
  () => import("@/components/DarkContinentCanvas"),
  { ssr: false }
);
export default function DarkContinentPage() { ... }
```

- Suspense boundary with pixel-art loading fallback
- Keyboard ESC handler navigates to `/`
- Renders `DarkContinentCanvas` once loaded

### `src/components/DarkContinentCanvas.tsx`

```tsx
interface DarkContinentCanvasProps {} // no required props

export default function DarkContinentCanvas() { ... }
```

Internal structure:
```
<div className="relative w-screen h-screen">
  <Canvas camera={{ position, fov, near, far }}>
    <fog ... />
    <ambientLight ... />
    <directionalLight ... />
    <OceanPlane />
    <OuterWildlands innerR={180} outerR={3000} collisionRegistryRef={regRef} />
    <AirplaneController collisionRegistryRef={regRef} onHud={setHud} />
  </Canvas>
  <HUD hud={hud} zone={hud.zoneName} />
</div>
```

Camera: `position={[0, 300, 800]}`, `fov={70}`, `near={1}`, `far={12000}`

Fog: `<fog attach="fog" color="#020a06" near={800} far={6000} />`

### `src/components/OuterWildlands.tsx` (extended)

New prop signature (backward-compatible):
```tsx
interface OuterWildlandsProps {
  innerR?: number;           // default 180
  outerR?: number;           // default 3000
  collisionRegistryRef?: React.MutableRefObject<AABB[]>;
  // legacy props kept for city compatibility:
  cityRadius?: number;
  themeIndex?: number;
}
```

New components added to this file:
- `AuroraBorealis` — ribbon curtains for Zone 3 (3 color bands, animated)

CollisionRegistry population: at mount (`useEffect` with `[]` deps), each solid mesh's `InstancedMesh` ref is iterated and AABBs are computed via `computeInstanceAABBs()` from `collision.ts`, then pushed into `collisionRegistryRef.current`.

Solid meshes registered (per Requirement 17.2):
- `JungleTrees`: trunk InstancedMesh + canopy InstancedMesh refs
- `JungleTempleRuins`: wallRef, pillarRef
- `ObsidianSpires`: spireRef
- `VolcanoCaldera`: cone mesh
- `IceMountains`: baseRef, peakRef
- `CliffFortress`: wallRef
- `VoidObelisks`: obeliskRef
- `WorldTree`: trunk mesh, canopy layer meshes
- `Pyramids`: ref (cone geometry)
- `BuriedSkyscrapers`: ref (box geometry)

### `src/components/AirplaneController.tsx`

```tsx
interface AirplaneControllerProps {
  collisionRegistryRef: React.MutableRefObject<AABB[]>;
  onHud: (hud: HudState) => void;
}

interface HudState {
  speed: number;
  altitude: number;
  zoneName: string;
  collision: boolean; // triggers red flash
}
```

Uses `useThree({ camera })` to move the camera directly each frame inside `useFrame`.

Flight state (all stored in `useRef` to avoid re-renders):
- `velocity: THREE.Vector3` — current velocity vector
- `yaw: number` — horizontal rotation
- `pitch: number` — vertical rotation  
- `roll: number` — bank angle (visual only)
- `speed: number` — scalar speed

Key input mappings:
| Key | Action |
|-----|--------|
| W | Increase thrust toward max 400 |
| S | Decrease thrust toward min 30 |
| A | Yaw left |
| D | Yaw right |
| Q | Roll left |
| E | Roll right |
| Mouse Y | Pitch |
| Escape | Navigate to `/` |

Physics per frame (`useFrame` delta):
1. Apply input → update target yaw/pitch/roll/speed
2. Lerp current values toward targets with factor 0.08
3. Compute forward direction from yaw+pitch
4. `velocity = forward * speed`
5. Integrate: `camera.position += velocity * delta`
6. Terrain floor clamp: if `camera.position.y < getTerrainHeight(x, z) + 12`, push up
7. Ocean floor clamp: `camera.position.y = Math.max(-10, camera.position.y)`
8. Sweep collision registry: sphere (r=8) vs every AABB → resolve penetration
9. Call `onHud` with updated state

### `src/lib/darkContinent/collision.ts`

```ts
import * as THREE from "three";

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/** 
 * Compute AABB for a single instance given its 4x4 world matrix and
 * unit geometry half-extents (pre-scale). For box: [0.5, 0.5, 0.5].
 */
export function instanceMatrixToAABB(
  matrix: THREE.Matrix4,
  halfExtents: THREE.Vector3
): AABB

/**
 * Iterate all instances of an InstancedMesh and return one AABB per instance.
 */
export function computeInstanceAABBs(
  mesh: THREE.InstancedMesh,
  halfExtents?: THREE.Vector3
): AABB[]

/**
 * Test sphere vs AABB intersection.
 * Returns penetration vector (zero-length if no intersection).
 */
export function sphereAABBPenetration(
  sphereCenter: THREE.Vector3,
  sphereRadius: number,
  aabb: AABB
): THREE.Vector3

/**
 * Find closest point on AABB to a sphere center.
 */
export function closestPointOnAABB(
  point: THREE.Vector3,
  aabb: AABB
): THREE.Vector3
```

Implementation notes:
- `instanceMatrixToAABB`: extract scale (sx, sy, sz) from matrix column magnitudes, extract translation from matrix column 3. `min = pos - halfExtents * scale`, `max = pos + halfExtents * scale`.
- `sphereAABBPenetration`: find closest point on AABB, compute distance to sphere center. If `dist < radius`, return `(center - closest).normalize() * (radius - dist)`.
- The flat array is iterated sequentially each frame — no BVH needed at this scale (~2000 AABBs).

### `src/lib/darkContinent/terrain.ts`

Exports the pure terrain functions extracted from `OuterWildlands.tsx`:

```ts
export function seededRandom(seed: number): () => number
export function noise2D(x: number, z: number, scale: number, seed: number): number
export function fbmNoise(x: number, z: number, octaves: number, seed: number): number
export function getTerrainHeight(x: number, z: number, zone?: number): number
```

`getTerrainHeight` Zone 2 (Frozen) MUST clamp output to `[20, 260]`:
```ts
case 2: {
  const raw = Math.abs(base) * 180 + noise2D(x, z, 0.004, 33) * 60
            + Math.abs(noise2D(x, z, 0.015, 55)) * 40 + 20;
  return Math.max(20, Math.min(260, raw));
}
```

### `src/lib/darkContinent/zones.ts`

```ts
export const ZONE_COUNT = 6;
export const ZONE_NAMES = [
  "Ancient Jungle",
  "Volcanic Badlands", 
  "Frozen Highlands",
  "Void Wastes",
  "World Tree",
  "Desert Ruins",
];
export function getZone(x: number, z: number): number
export function getZoneWeight(x: number, z: number, zone: number): number
export const ZONE_PALETTES: { ... }  // moved from OuterWildlands.tsx
```

---

## Data Models

### AABB Registry

```ts
// Populated once at mount, never mutated after
type CollisionRegistry = AABB[];

interface AABB {
  min: THREE.Vector3;  // world-space minimum corner
  max: THREE.Vector3;  // world-space maximum corner
}
```

Expected count at runtime: ~1800–2400 AABBs across all solid meshes.

### Flight State

```ts
interface FlightState {
  position: THREE.Vector3;   // camera world position
  yaw: number;               // radians, horizontal
  pitch: number;             // radians, clamped ±75°
  roll: number;              // radians, visual banking
  speed: number;             // units/sec, [30, 400]
  targetYaw: number;
  targetPitch: number;
  targetSpeed: number;
}
```

### HUD State

```ts
interface HudState {
  speed: number;             // current speed units/sec
  altitude: number;          // camera Y position
  zoneName: string;          // "Ancient Jungle", etc.
  collision: boolean;        // true → red flash (200ms)
}
```

### Zone Sector

```ts
interface ZoneSector {
  start: number;  // radians, start angle
  end: number;    // radians, end angle
}
// Sectors: [-π, -2π/3, -π/3, 0, π/3, 2π/3, π]
// Zone 0 → [-π, -2π/3], Zone 1 → [-2π/3, -π/3], etc.
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Zone sectors cover [−π, π] without gaps or overlaps

*For any* valid `ZONE_COUNT` and zone index `i ∈ [0, ZONE_COUNT)`, the computed sector `[−π + i*(2π/ZONE_COUNT), −π + (i+1)*(2π/ZONE_COUNT)]` spans exactly `2π/ZONE_COUNT` radians, and the union of all sectors equals exactly `[−π, π]` (no gaps, no overlaps).

**Validates: Requirements 1.4, 1.6**

### Property 2: seededRandom determinism

*For any* fixed integer seed and any step count N, calling `seededRandom(seed)` and advancing N steps always produces the same Nth value on every invocation.

**Validates: Requirements 11.2, 11.3**

### Property 3: getTerrainHeight Zone 0 (Jungle) output in [−13, +82]

*For any* (x, z) coordinates in the Island's radial range, `getTerrainHeight(x, z, 0)` returns a value in the closed interval `[−13, +82]`.

**Validates: Requirements 4.6**

### Property 4: getTerrainHeight Zone 2 (Frozen) output clamped to [20, 260]

*For any* (x, z) coordinates, `getTerrainHeight(x, z, 2)` returns a value in the closed interval `[20, 260]`. The implementation must clamp raw noise output to enforce this bound.

**Validates: Requirements 6.7**

### Property 5: getTerrainHeight Zone 3 (Void) output in [−45, −15]

*For any* (x, z) coordinates, `getTerrainHeight(x, z, 3)` returns a value in the closed interval `[−45, −15]`.

**Validates: Requirements 7.6**

### Property 6: Lava channel terrain component is non-negative

*For any* (x, z) coordinates in Zone 1 (Volcanic), the lava channel contribution `Math.abs(Math.sin(x * 0.005 + z * 0.003)) * 20` is always ≥ 0.

**Validates: Requirements 5.6**

### Property 7: Mushroom emissive pulse stays in [1.2, 2.8]

*For any* elapsed time `t`, the expression `2.0 + Math.sin(t * 1.5) * 0.8` produces a value in the closed interval `[1.2, 2.8]`.

**Validates: Requirements 4.3**

### Property 8: LavaRivers emissive intensity in [2.0, 3.0]

*For any* elapsed time `t`, the expression `2.5 + Math.sin(t * 0.8) * 0.5` produces a value in the closed interval `[2.0, 3.0]`.

**Validates: Requirements 5.3**

### Property 9: Airplane speed always clamped to [30, 400]

*For any* initial speed and thrust input (W/S key), the resulting speed after one frame update is always within `[30, 400]` units/sec.

**Validates: Requirements 16.2**

### Property 10: Pitch always clamped to [−75°, +75°]

*For any* accumulated pitch input, the current pitch value in degrees is always within `[−75, +75]`.

**Validates: Requirements 16.4**

### Property 11: Sphere-AABB intersection is symmetric and conservative

*For any* sphere center and AABB, if the sphere does not intersect the AABB then `sphereAABBPenetration` returns a zero-length vector; if it does intersect, the returned vector has a positive magnitude proportional to the penetration depth.

**Validates: Requirements 17.4, 17.5**

### Property 12: getTerrainHeight Zone 5 (Desert) dune amplitude

*For any* (x, z) coordinates, the dune component `Math.sin(x * 0.008 + 1.5) * Math.sin(z * 0.006 + 0.7) * 25` produces a value in `[−25, +25]`.

**Validates: Requirements 9.6**

---

## Error Handling

**Canvas mount failure**: `DarkContinentCanvas` wraps the Canvas in a React error boundary. If WebGL is unavailable, it renders a static fallback message with a link back to the city.

**CollisionRegistry empty**: `AirplaneController` checks if `collisionRegistryRef.current.length === 0` before sweeping — this handles the window between page mount and `OuterWildlands` populating the registry (typically one frame).

**Terrain height NaN**: `getTerrainHeight` guards against NaN inputs by returning `0` if `isNaN(x) || isNaN(z)`.

**Flight out of bounds**: If the camera escapes the island entirely (radius > outerR + 1000), it is gently nudged back toward the center with a soft spring force, preventing players from getting lost.

---

## Testing Strategy

### Unit Tests (Vitest)

Target: pure functions in `src/lib/darkContinent/`

- `terrain.ts`: `seededRandom`, `getTerrainHeight` — test all zone branches with specific inputs, verify range properties
- `zones.ts`: `getZone`, `getZoneWeight` — verify sector coverage
- `collision.ts`: `sphereAABBPenetration`, `instanceMatrixToAABB` — geometric correctness

### Property-Based Tests (Vitest + fast-check)

[fast-check](https://github.com/dubzzz/fast-check) is the property-based testing library. It is already available in the Node ecosystem and works with Vitest.

Each property test runs **minimum 100 iterations** with randomized inputs.

Tag format: `// Feature: dark-continent-world, Property N: <title>`

Properties to implement:
- **Property 1**: Zone sector coverage — `fc.integer(0, 5)` → verify sector width = `2π/6`
- **Property 2**: seededRandom determinism — `fc.integer()` seed + `fc.integer(1, 50)` steps → two runs produce identical sequences
- **Properties 3, 4, 5, 6**: terrain height ranges — `fc.float(-5000, 5000)` × 2 → verify output bounds per zone
- **Property 7**: Mushroom pulse — `fc.float(0, 10000)` elapsed time → verify `[1.2, 2.8]`
- **Property 8**: Lava intensity — `fc.float(0, 10000)` → verify `[2.0, 3.0]`
- **Properties 9, 10**: Flight state clamps — `fc.float(-1000, 1000)` inputs → verify bounded output
- **Property 11**: Sphere-AABB — `fc.record({ center: fc.tuple(fc.float(), fc.float(), fc.float()), radius: fc.float(0.1, 50) })` + random AABB → verify penetration vector sign and magnitude
- **Property 12**: Dune amplitude — `fc.float(-5000, 5000)` × 2 → verify `[-25, 25]`

### Integration / Visual Checks (manual)

- Load `/dark-continent` in browser, confirm 6 distinct biomes visible
- Fly through each zone, confirm collision stops airplane at solid structures
- Confirm HUD updates zone name when crossing sector boundaries
- Confirm ESC returns to home page

### Non-PBT Zones

- `DarkContinentCanvas` render: snapshot test verifying Canvas, lights, OceanPlane present
- Zone lighting config: example test against `ZONE_LIGHTING` constant array
- Page routing: example test that `src/app/dark-continent/page.tsx` exports a default function
