# Implementation Plan: Dark Continent World

## Overview

Implement the standalone Dark Continent page by (1) extracting shared helpers into `src/lib/darkContinent/`, (2) creating the canvas wrapper and standalone page, (3) extending `OuterWildlands.tsx` with missing features and the collision-registration hook, (4) implementing the `AirplaneController` with swept-AABB collision, and (5) wiring everything together with the HUD overlay.

All tasks extend or refactor existing code — the existing `OuterWildlands.tsx` is the single source of truth for zone rendering; it is never rewritten, only extended.

## Tasks

- [x] 1. Extract terrain and zone helpers into `src/lib/darkContinent/`
  - Create `src/lib/darkContinent/terrain.ts` — move `seededRandom`, `noise2D`, `fbmNoise`, `getTerrainHeight` verbatim from `OuterWildlands.tsx`
  - In `getTerrainHeight` case 2 (Frozen), add hard clamp: `return Math.max(20, Math.min(260, raw))`
  - Add NaN guard at top of `getTerrainHeight`: `if (isNaN(x) || isNaN(z)) return 0`
  - Create `src/lib/darkContinent/zones.ts` — move `ZONE_COUNT`, `getZone`, `getZoneWeight`, `ZONE_PALETTES`, `ZONE_NAMES` array out of `OuterWildlands.tsx`; add `ZONE_NAMES = ["Ancient Jungle", "Volcanic Badlands", "Frozen Highlands", "Void Wastes", "World Tree", "Desert Ruins"]`
  - Update `OuterWildlands.tsx` imports to use these lib files instead of inline definitions
  - _Requirements: 1.5, 1.6, 4.6, 6.7, 7.6, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 1.1 Write property tests for terrain height zones
    - Install `fast-check` as a dev dependency: `npm install --save-dev fast-check`
    - Create `src/lib/darkContinent/__tests__/terrain.test.ts`
    - **Property 2: seededRandom determinism** — for any seed and step count, two runs produce identical outputs
    - **Property 3: Zone 0 (Jungle) height in [−13, +82]** — `fc.float(-5000, 5000)` × 2
    - **Property 4: Zone 2 (Frozen) height clamped to [20, 260]**
    - **Property 5: Zone 3 (Void) height in [−45, −15]**
    - **Property 6: Lava channel component ≥ 0**
    - **Property 12: Desert dune amplitude in [−25, +25]**
    - _Requirements: 4.6, 5.6, 6.7, 7.6, 9.6, 11.2, 11.3_

  - [ ]* 1.2 Write property tests for zone sector coverage
    - Create `src/lib/darkContinent/__tests__/zones.test.ts`
    - **Property 1: Zone sectors cover [−π, π] without gaps** — for any zone index 0–5, sector width = `2π/6`
    - _Requirements: 1.4, 1.6_

- [x] 2. Implement AABB collision utilities in `src/lib/darkContinent/collision.ts`
  - Define `AABB` interface: `{ min: THREE.Vector3; max: THREE.Vector3 }`
  - Implement `instanceMatrixToAABB(matrix, halfExtents)`: extract translation from column 3, extract scale magnitudes from columns 0/1/2, compute min/max
  - Implement `computeInstanceAABBs(mesh, halfExtents?)`: iterate `mesh.count`, call `mesh.getMatrixAt(i, tmpM)`, return array of AABBs
  - Implement `closestPointOnAABB(point, aabb)`: per-axis clamp
  - Implement `sphereAABBPenetration(center, radius, aabb)`: find closest point, compute distance, return push vector (zero if no intersection)
  - _Requirements: 17.1, 17.4, 17.5_

  - [ ]* 2.1 Write property tests for collision utilities
    - Create `src/lib/darkContinent/__tests__/collision.test.ts`
    - **Property 11: Sphere-AABB penetration is zero when sphere is outside AABB** — generate sphere centers outside AABB bounds, assert zero-length result
    - **Property 11 (cont): Penetration vector points away from AABB when inside** — generate sphere centers inside AABB, assert returned vector moves center outside
    - _Requirements: 17.4, 17.5_

- [x] 3. Checkpoint — run tests before proceeding
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add `AuroraBorealis` component to `OuterWildlands.tsx` (Zone 3, missing feature)
  - Add `AuroraBorealis` function component inside `OuterWildlands.tsx`
  - Render 3 ribbon `<mesh>` elements as thin elongated boxes (e.g. `boxGeometry args={[600, 80, 2]}`) oriented vertically along the Zone 2 arc
  - Place ribbons at Y heights 150, 230, and 320 units
  - Animate each ribbon's position and scale each frame in `useFrame` using `Math.sin(clock.elapsedTime * speed + phaseOffset)` per ribbon
  - Animate `opacity` between 0.3 and 0.8 each frame: `mat.opacity = 0.55 + Math.sin(t * 0.7 + phase) * 0.25`
  - Use emissive colors `#30e090`, `#3090e0`, `#9060e0` with `emissiveIntensity={2}` and `toneMapped={false}`
  - Add `<AuroraBorealis>` inside the Zone 2 (Frozen) block in `OuterWildlands`'s return
  - _Requirements: 6.5, 6.6, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 5. Update `OuterWildlands.tsx` props and add collision registration hook
  - Change prop type from `{ cityRadius: number; themeIndex: number }` to:
    ```ts
    interface OuterWildlandsProps {
      innerR?: number;
      outerR?: number;
      collisionRegistryRef?: React.MutableRefObject<AABB[]>;
      cityRadius?: number;  // legacy, kept for city compatibility
      themeIndex?: number;  // legacy
    }
    ```
  - Compute `innerR = props.innerR ?? (props.cityRadius ?? 0) + 180` and `outerR = props.outerR ?? (props.cityRadius ?? 0) + 3000`
  - Import `AABB`, `computeInstanceAABBs` from `src/lib/darkContinent/collision.ts`
  - Add `useEffect` (runs once on mount) that iterates all solid mesh refs and pushes computed AABBs into `collisionRegistryRef.current`:
    - Solid refs to register: jungle trunk/canopy refs, temple wall/pillar refs, obsidian spire ref, ice mountain base/peak refs, cliff fortress wall ref, void obelisk ref, World Tree trunk ref + canopy mesh refs, pyramid ref, buried skyscraper ref
    - Use `computeInstanceAABBs(meshRef.current)` for each InstancedMesh ref that is non-null
    - For non-instanced meshes (WorldTree trunk, caldera cone): compute a single AABB from `mesh.geometry.boundingBox` + `mesh.matrixWorld`
  - _Requirements: 17.1, 17.2, 17.3, 12.3, 12.4_

- [x] 6. Implement `src/components/AirplaneController.tsx`
  - Create component with `{ collisionRegistryRef, onHud }` props
  - Use `useThree` to get `camera` and `gl` (for pointer lock)
  - Store all flight state in `useRef` (no `useState` to avoid re-render): `yaw`, `pitch`, `roll`, `speed`, `targetYaw`, `targetPitch`, `targetSpeed`, `velocity`
  - Attach `keydown`/`keyup` event listeners via `useEffect` — track `keysHeld: Set<string>`
  - Attach `mousemove` listener: accumulate `deltaY` into `targetPitch`
  - Implement `useFrame` loop:
    1. Read held keys, apply thrust delta (W: +30/s, S: -30/s per frame × delta)
    2. Clamp `targetSpeed` to `[30, 400]`
    3. Apply yaw rate from A/D (±1.0 rad/s) with delta
    4. Apply pitch rate from mouse Y (scale by 0.002) with delta
    5. Clamp `targetPitch` to `[-Math.PI * 75/180, Math.PI * 75/180]`
    6. Lerp `speed`, `yaw`, `pitch`, `roll` toward targets with factor `0.08`
    7. Compute forward direction: `new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))`
    8. `velocity.copy(forward).multiplyScalar(speed * delta)`
    9. `camera.position.add(velocity)`
    10. Terrain floor: `getTerrainHeight(camera.position.x, camera.position.z) - 18 + 12`; if below, push up
    11. Ocean floor: `camera.position.y = Math.max(-10, camera.position.y)`
    12. Out-of-bounds soft spring: if `radius > outerR + 1000`, apply inward nudge
    13. Sweep collision registry: iterate all AABBs, call `sphereAABBPenetration(camera.position, 8, aabb)`, if non-zero push `camera.position` by penetration vector
    14. Camera orientation: `camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'))`
    15. Determine zone name: `ZONE_NAMES[getZone(camera.position.x, camera.position.z)]`
    16. Call `onHud({ speed, altitude: camera.position.y, zoneName, collision: hadCollision })`
  - On Escape key: `router.push('/')` (import `useRouter` from `next/navigation`)
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 17.4, 17.5, 17.6, 17.7, 17.8_

  - [ ]* 6.1 Write property tests for flight state clamps
    - Create `src/lib/darkContinent/__tests__/flight.test.ts`
    - **Property 9: Speed always in [30, 400]** — `fc.float(-1000, 2000)` initial speed × `fc.float(-500, 500)` delta → clamped result in range
    - **Property 10: Pitch always in [−75°, +75°]** — `fc.float(-Math.PI * 2, Math.PI * 2)` input pitch → clamped output in range
    - Test the pure clamp functions (extracted from AirplaneController as helpers in `collision.ts` or a small `flight.ts`)
    - _Requirements: 16.2, 16.4_

- [x] 7. Implement `src/components/DarkContinentCanvas.tsx`
  - Import and set up `<Canvas>` from `@react-three/fiber`
  - Camera props: `camera={{ position: [0, 300, 800], fov: 70, near: 1, far: 12000 }}`
  - Add `<fog attach="fog" color="#020a06" near={800} far={6000} />`
  - Add `<ambientLight intensity={0.15} color="#060a06" />`
  - Add `<directionalLight position={[500, 800, 200]} intensity={0.3} color="#a0c0ff" />`
  - Add `<OceanPlane />` — flat `<mesh>` with `planeGeometry args={[40000, 40000]}` at `position={[0, -18, 0]}` `rotation={[-Math.PI/2, 0, 0]}`, `MeshStandardMaterial color="#061a18"` roughness `0.7` metalness `0.2`
  - Create `const registryRef = useRef<AABB[]>([])`
  - Mount `<OuterWildlands innerR={180} outerR={3000} collisionRegistryRef={registryRef} />`
  - Mount `<AirplaneController collisionRegistryRef={registryRef} onHud={setHud} />`
  - Add HUD overlay as absolute-positioned DOM div (outside Canvas):
    - Top bar: zone name with fade-in on zone change
    - Speed bar and altitude readout (bottom left, pixel-art font)
    - Collision flash: red tint overlay, 200ms, triggered when `hud.collision`
    - Back button / ESC label (top right)
  - _Requirements: 1.2, 1.3, 12.1, 12.2, 16.6, 16.7, 17.8_

- [x] 8. Create `src/app/dark-continent/page.tsx`
  - `"use client"` directive
  - Dynamic import of `DarkContinentCanvas` with `{ ssr: false }`
  - Suspense boundary with fallback: `<div className="h-screen w-screen bg-black flex items-center justify-center"><span className="text-white font-pixel animate-pulse">Loading Dark Continent...</span></div>`
  - Handle ESC at page level: `useEffect` adds `keydown` listener; on `Escape` calls `router.push('/')`
  - Render `<DarkContinentCanvas />` once loaded
  - _Requirements: 1.1, 12.1, 12.2, 16.5_

- [x] 9. Checkpoint — end-to-end integration check
  - Ensure all tests pass, ask the user if questions arise.
  - Verify the page compiles without TypeScript errors (`npm run build` or `tsc --noEmit`)
  - Note: Manual browser check of `/dark-continent` route is needed to confirm the scene renders

- [x] 10. Wire zone spacing / flight corridor enforcement
  - In `JungleTrees`, update the `treeData` generation loop to enforce minimum spacing: track placed colossal positions; for each new colossal candidate, skip if any existing colossal is within 80 units; for medium trees, skip if any existing medium is within 40 units
  - In `ObsidianSpires`, group spires into clusters of 3–7 by computing cluster centers first (seeded), then placing spires at `clusterCenter + offset` where `offset` is 50–120 units
  - In `FloatingIslands`, sort islands by Y before generating bridges; add minimum 80-unit vertical gap enforcement: reject new island positions that violate gap with existing islands
  - In `Pyramids`, enforce 200-unit minimum center-to-center spacing using same skip-if-too-close pattern
  - In `WorldTree`, verify the existing `120-unit clear radius` around trunk before roots begin (roots start at `trunkR * 0.95` which is ~24 units — add initial offset to root mesh positions so they start at radius 40 and extend outward)
  - In `WorldTree` canopy layer 1, add a deliberate 80×80-unit gap by offsetting one canopy segment: split the canopy into two half-cylinder meshes with a gap between them (or use a torus/ring geometry with a cutout angle)
  - _Requirements: 18.1, 18.2, 18.4, 18.5, 18.6, 18.8_

- [x] 11. Add `DesertDunes` dune terrain mesh to Zone 6 and verify Zone 6 components render correctly
  - Verify `DesertDunes` component is included in the Zone 6 section of the `OuterWildlands` return (it exists in file but check it is actually mounted)
  - Verify `SandstormParticles` count is 300 and animates horizontally per Requirement 9.5
  - Verify `OasisPools` `useFrame` animates `emissiveIntensity` between 1.0 and 2.0 (current code uses `1.5 + sin * 0.5` → range [1.0, 2.0] ✓)
  - Verify `Pyramids` has `count = 15` minimum; if not, increase
  - Verify `BuriedSkyscrapers` exposed height is 8–23 units (current `exposed = 8 + rng() * 15` → max 23 ✓)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 12. Verify and fix Zone 3 (Frozen) requirements gaps
  - Confirm `IceMountains` has `peakCount = 60` ✓ and renders base + peak + snow-cap layers ✓
  - Confirm `CrystalTrees` has `count = 250` ✓ and crystal cluster count per tree is 2–5 ✓ (current `2 + floor(rng() * 4)` = 2–5 ✓)
  - Confirm `CliffFortress` has at least 15 wall instances and 40 window instances (current `wallCount = 60`, `windowCount = 40` ✓)
  - Confirm `SnowParticles` count is 400 ✓ and loops continuously ✓
  - Add `AuroraBorealis` component (done in task 4) — verify it is added to Zone 2 (index 2) slot
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 13. Verify Zone 4 (Void Wastes) and Zone 5 (World Tree) requirements
  - Confirm `FloatingIslands` count is 40 with float animation (±3 units) ✓ and bridges ≤ 25 ✓
  - Confirm `VoidObelisks` animate rotation + float each frame ✓ and rune pulse `[1, 3]` ✓
  - Confirm `RealityTears` count is 60 and uses `Math.sin(t * 8 + phase) > 0.3` flicker ✓
  - Confirm `WorldTree` trunk uses `cylinderGeometry args={[trunkR * 0.7, trunkR, trunkH, 8]}` (top radius 0.7×, bottom 25) ✓
  - Confirm canopy layers are at `trunkH * 0.75`, `trunkH * 0.85`, `trunkH * 0.92` ✓
  - Confirm 6 bark-crack strips ✓, 8 roots ✓, 6 treehouses ✓, golden beacon at `trunkH + 20` ✓
  - Confirm `WorldTree` group positioned at `[0, -18, -800]` — check existing code has this ✓; fix if not
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 14. Verify shoreline rocks and per-zone lighting
  - Confirm `ShorelineRocks` uses `cityRadius` equivalent — for standalone page pass `outerR` (3000) as the base; update `ShorelineRocks` to accept `{ outerR: number }` and place rocks at radii 2700–3100 (ring straddling island edge per Requirement 15.1)
  - Update `ShorelineRocks` rock dimensions to match Requirement 15.2: `sx = 3 + rng() * 15`, `sy = 2 + rng() * 10`, `sz = 3 + rng() * 15` ✓ (verify current code)
  - Confirm `ZoneLighting` uses correct zone midpoint angles and color/intensity values per Requirements 10.1–10.8
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 15.1, 15.2, 15.3, 15.4_

  - [ ]* 14.1 Write example tests for zone lighting configuration
    - Create `src/lib/darkContinent/__tests__/zones.test.ts` (or add to existing)
    - Assert `ZONE_PALETTES` contains entries for all 6 biomes with correct color strings
    - Assert zone lighting config array has 6 entries with correct colors from Req 10.2–10.7
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 15. Final checkpoint — full integration and TypeScript clean
  - Run `npm run build` or `npx tsc --noEmit` and fix any type errors
  - Run `npm test` and confirm all property and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- fast-check is the PBT library (`npm install --save-dev fast-check`)
- Property tests validate pure functions extracted to `src/lib/darkContinent/` — the R3F components themselves are tested only via manual browser review
- The existing `OuterWildlands.tsx` city integration (accepting `cityRadius` + `themeIndex`) is preserved — the new props are additive
- The collision registry is populated asynchronously at mount — `AirplaneController` must handle an initially-empty registry gracefully (skip sweep if length === 0)
- Do NOT run `npm run dev` as part of tasks — start the dev server manually: `npm run dev`

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] },
    { "wave": 4, "tasks": ["4", "5", "6"] },
    { "wave": 5, "tasks": ["7"] },
    { "wave": 6, "tasks": ["8"] },
    { "wave": 7, "tasks": ["9"] },
    { "wave": 8, "tasks": ["10", "11", "12", "13", "14"] },
    { "wave": 9, "tasks": ["15"] }
  ]
}
```
