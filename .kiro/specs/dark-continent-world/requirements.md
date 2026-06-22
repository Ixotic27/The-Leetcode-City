# Requirements Document

## Introduction

The Dark Continent is a standalone procedural island rendered in its own dedicated Next.js page, completely separate from the LeetCode City island. It is a self-contained Three.js / React Three Fiber scene featuring a single large island surrounded by open ocean. The island is divided into six distinct biome zones arranged in a ring around a calm central highland, each with unique voxel aesthetics, lighting, particle systems, and landmark structures.

The existing `OuterWildlands.tsx` component contains a partial implementation of the six zones. This feature completes and polishes all six zones to production quality on the new standalone page, ensuring visual coherence, acceptable frame rates, and maintainability.

The six zones are:
- **Zone 1 — Ancient Jungle** (bioluminescent megaflora, temple ruins, firefly particles)
- **Zone 2 — Volcanic Badlands** (obsidian spires, lava rivers, volcano caldera, ember particles)
- **Zone 3 — Frozen Highlands** (ice mountains, crystal trees, cliff fortress, aurora + blizzard particles)
- **Zone 4 — Void Wastes** (floating islands, obelisks, reality tears, crumbling bridges)
- **Zone 5 — World Tree** (colossal single tree, glowing bark, multi-layer canopy, golden beacon)
- **Zone 6 — Desert Ruins** (sand dunes, buried pyramids, buried skyscrapers, sandstorm, teal oasis pools)

The island is encircled by an infinite ocean plane. The camera starts with a high bird's-eye view and supports free flyover navigation with an airplane controller. Structures are sized and spaced to create navigable flight corridors — the player should be able to fly between jungle canopy towers, through volcanic canyon gaps, around ice mountain ridges, and under the World Tree canopy. All solid structures have axis-aligned bounding box (AABB) collision volumes so the airplane cannot pass through terrain, trees, spires, ruins, or any landmark.

## Glossary

- **DarkContinent**: The standalone Next.js page and its associated Three.js / React Three Fiber scene, rendered independently from the city.
- **DarkContinentCanvas**: The root React component for the standalone page that sets up the `<Canvas>` context, camera, lighting, ocean, and mounts `OuterWildlands`.
- **OuterWildlands**: The React Three Fiber component that renders all six biome zones of the island.
- **Zone**: One of six angular sectors of the island ring, each corresponding to a distinct biome.
- **islandRadius**: The total radius of the Dark Continent island in Three.js world units (approximately 3000 units).
- **innerR**: The inner radius of the biome ring, computed as a fixed offset from the island center (≈ 180 units from center).
- **outerR**: The outer radius of the biome ring, equal to the island edge (≈ 3000 units from center).
- **OceanPlane**: An infinite flat plane mesh rendered below y = –18 to simulate open ocean surrounding the island.
- **InstancedMesh**: A Three.js `THREE.InstancedMesh` used to render many identical geometries in a single draw call.
- **SeededRNG**: A deterministic pseudo-random number generator initialized with a fixed integer seed, ensuring the procedural world is identical across renders.
- **AirplaneController**: The first-person flight controller that moves the player camera through the island. It reads keyboard/mouse input to apply thrust, pitch, yaw, and roll each frame.
- **CollisionVolume**: An axis-aligned bounding box (AABB) or bounding sphere stored in a flat JavaScript array alongside each instanced mesh, used to test whether the airplane intersects any solid structure each frame.
- **CollisionRegistry**: A module-level array of `{ min: Vector3, max: Vector3 }` AABB records populated once at mount time from all solid `InstancedMesh` instances (terrain, trees, spires, ruins, mountains, obelisks, pyramid, skyscraper stubs, World Tree trunk). The `AirplaneController` sweeps this array every frame.
- **FlightCorridor**: A gap between solid structures that is wide and tall enough for the airplane to fly through comfortably at normal flight speed. Minimum corridor width is 60 units; minimum height clearance is 40 units.
- **CanopyLayer**: A horizontal disc-shaped mesh forming the crown of a jungle tree or World Tree branch. Canopy layers are solid collision objects — flying below them into the jungle interior is intentional gameplay.
- **CanyonGap**: A deliberate spacing between adjacent obsidian spires or volcanic rock formations that forms a narrow passage the airplane can thread through.
- **TerrainCollider**: A per-sample terrain height lookup used to prevent the airplane from flying below the terrain surface. The airplane's Y position is clamped to `getTerrainHeight(x, z) + minAltitude` when not in free-fall.
- **TerrainRing**: The mesh covering the full island annulus from `innerR` to `outerR` with per-vertex height displacement and per-zone vertex colors.
- **EARS**: Easy Approach to Requirements Syntax — the pattern used to write each acceptance criterion.
- **LOD**: Level of Detail — reducing geometry complexity for objects far from the camera.
- **FPS**: Frames per second — the rendering performance metric.
- **Aurora**: Animated curtain-like ribbon particle system rendered in Zone 3 to simulate the northern lights.
- **Blizzard**: Dense directional particle system rendered in Zone 3 to simulate a snowstorm.
- **RealityTear**: A flickering vertical glitch-line mesh rendered in Zone 4 to simulate dimensional fractures.
- **WorldTree**: The single colossal procedural tree that anchors Zone 5, positioned at world coordinates (0, –18, –800).
- **GoldenBeacon**: The glowing sphere at the apex of the WorldTree that emits a `pointLight`.
- **SandstormWall**: The dense horizontal particle curtain rendered in Zone 6.
- **NearestFilter**: `THREE.NearestFilter` applied to all texture magnification and minification filters to preserve the voxel/pixel-art aesthetic.

---

## Requirements

### Requirement 1: Standalone Page and Six-Zone Island Composition

**User Story:** As a player visiting the Dark Continent page, I want to see a standalone island with six visually distinct biome zones arranged around a central highland, surrounded by open ocean, so that the world feels alive and each direction offers a unique visual experience.

#### Acceptance Criteria

1. THE Dark Continent SHALL be served from its own dedicated Next.js page route (e.g., `/dark-continent`) that is completely independent of the city page.
2. THE `DarkContinentCanvas` component SHALL set up a React Three Fiber `<Canvas>` with camera, fog, ambient lighting, an ocean plane, and the `OuterWildlands` component — with no dependency on any city building data.
3. THE `OceanPlane` SHALL render as a flat plane of size 40000 × 40000 units centered at the world origin at Y = –18, with a dark teal ocean color (`#061a18`) to simulate deep water surrounding the island.
4. THE `OuterWildlands` SHALL render exactly six biome zones arranged as contiguous angular sectors, each spanning 60 degrees of arc around the island center.
5. THE `OuterWildlands` SHALL use fixed internal constants `innerR = 180` and `outerR = 3000` as the ring boundaries of the island.
6. THE `OuterWildlands` SHALL assign Zone 0 (Ancient Jungle) to the angular sector starting at –π, Zone 1 (Volcanic Badlands) to the next sector, Zone 2 (Frozen Highlands) to the next, Zone 3 (Void Wastes) to the next, Zone 4 (World Tree) to the next, and Zone 5 (Desert Ruins) to the final sector ending at π. This exact zone-to-biome mapping SHALL be enforced — no two zones may share the same biome type, and the angular order SHALL not be changed.
7. THE `TerrainRing` SHALL cover the full annulus from `innerR` to `outerR` with a continuous mesh, applying per-vertex height displacement according to each zone's `getTerrainHeight` function.
8. THE `TerrainRing` SHALL apply per-vertex colors matching each zone's `terrain` palette entry so that biome boundaries are visible in the terrain mesh itself.

---

### Requirement 2: Voxel Aesthetic Constraints

**User Story:** As a developer maintaining the codebase, I want all geometry and textures to conform to the voxel / pixel-art look established by the city, so that the outer world visually belongs to the same game world.

#### Acceptance Criteria

1. THE `OuterWildlands` SHALL use only low-polygon geometries: `BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry` (low segment counts ≤ 8 latitude × 6 longitude — this segment limit applies only to `SphereGeometry`, not to other geometry types), `OctahedronGeometry`, `TetrahedronGeometry`, and `IcosahedronGeometry`.
2. WHEN any texture is loaded via `THREE.TextureLoader`, THE `OuterWildlands` SHALL set both `texture.magFilter` and `texture.minFilter` to `THREE.NearestFilter` before the texture is applied to a material.
3. THE `OuterWildlands` SHALL NOT use subdivision surface smoothing, normal maps, or PBR textures that produce a non-voxel appearance.
4. THE `OuterWildlands` SHALL use `MeshStandardMaterial` exclusively for all opaque and transparent surfaces, with `roughness ≥ 0.7` for terrain and architectural elements. Non-terrain decorative props (e.g., particle glow spheres, beacon orbs) may use any roughness value appropriate to their visual role.

---

### Requirement 3: InstancedMesh Performance

**User Story:** As a player, I want the outer world to render at ≥ 30 FPS on mid-range hardware, so that the experience is smooth and enjoyable.

#### Acceptance Criteria

1. THE `OuterWildlands` SHALL render all repeated prop types (trees, spires, particles, ruins, dunes) using `THREE.InstancedMesh` with a fixed maximum instance count set at component mount.
2. THE `OuterWildlands` SHALL NOT create new `THREE.InstancedMesh` objects per frame; instance positions SHALL be updated by mutating `instanceMatrix` and setting `instanceMatrix.needsUpdate = true`.
3. THE `OuterWildlands` SHALL set `frustumCulled={false}` on all `InstancedMesh` elements whose instances span the full zone arc, to prevent the entire mesh from disappearing when the bounding sphere exits the camera frustum.
4. THE `OuterWildlands` SHALL use `SeededRNG` for all procedural placement, ensuring identical output on every render with the same seed.
5. WHEN computing per-instance data, THE `OuterWildlands` SHALL perform the computation inside `useMemo` hooks so it runs only when zone boundary props change, not on every frame.
6. WHERE the zone count exceeds 100 repeated mesh instances per component, THE `OuterWildlands` SHALL batch them into a single `InstancedMesh` of the appropriate maximum count.

---

### Requirement 4: Zone 1 — Ancient Jungle

**User Story:** As a player exploring the north sector, I want to see a bioluminescent jungle with towering megaflora, ancient temple ruins, pulsing mushrooms, and drifting fireflies, so that the zone feels mysterious and alive.

#### Acceptance Criteria

1. THE `JungleTrees` component SHALL render a minimum of 500 tree instances, distributed procedurally across Zone 1's angular sector and radial range.
2. THE `JungleTrees` component SHALL render at least three tree size classes: colossal (trunk height 80–180 units), medium (trunk height 45–95 units), and small (trunk height 8–23 units), with multi-layer canopy discs matching each class.
3. THE `JungleMushrooms` component SHALL render mushroom caps that pulse their `emissiveIntensity` between 1.2 and 2.8 using `Math.sin(clock.elapsedTime)` over time, creating a bioluminescent breathing effect.
4. THE `JungleFireflies` component SHALL animate each firefly instance along a smooth sinusoidal path updating position every frame inside `useFrame`. IF a frame update is skipped or the `useFrame` callback is not called, fireflies SHALL continue using their last computed sinusoidal positions rather than freezing at origin.
5. THE `JungleTempleRuins` component SHALL render step-pyramid wall segments, vertical pillars, and archway entrance blocks distributed across a minimum of 8 temple cluster positions within Zone 1.
6. WHEN the terrain height is computed for Zone 1, THE `getTerrainHeight` function SHALL return a value in the range [–13, +82] units (rolling hills with moderate elevation).

---

### Requirement 5: Zone 2 — Volcanic Badlands

**User Story:** As a player exploring the east sector, I want to see a scorched wasteland with obsidian spires cracked by lava veins, winding lava rivers, charred dead trees, a smoking volcano caldera, and rising ember sparks, so that the zone feels dangerous and hellish.

#### Acceptance Criteria

1. THE `ObsidianSpires` component SHALL render a minimum of 200 spire instances with randomized height (15–95 units), radius (2–8 units), and Z-axis tilt (±0.15 radians).
2. THE `ObsidianSpires` component SHALL render a secondary lava-crack glow strip on the surface of each spire using a separate `InstancedMesh` with emissive lava color.
3. THE `LavaRivers` component SHALL render a minimum of 150 flat box instances representing lava channel segments, with `emissiveIntensity` animated between 2.0 and 3.0 per frame.
4. THE `VolcanoCaldera` component SHALL render a single large cone (base radius 120 units, height 120 units), a caldera rim cylinder, and a circular lava lake at the caldera interior with a `pointLight` of intensity ≥ 50.
5. THE `EmberParticles` component SHALL animate each of 250 ember instances rising from terrain level to a maximum height of 30–90 units in a looping cycle, with horizontal sinusoidal drift.
6. WHEN the terrain height is computed for Zone 2, THE `getTerrainHeight` function SHALL produce lava-channel valleys by computing `Math.abs(Math.sin(x * 0.005 + z * 0.003)) * 20`, creating sinusoidal low points.

---

### Requirement 6: Zone 3 — Frozen Highlands

**User Story:** As a player exploring the northeast sector, I want to see dramatic ice mountains with snow caps, translucent crystal trees, a cliff fortress with glowing amber windows, blizzard particles, and sweeping aurora ribbons, so that the zone feels majestic and cold.

#### Acceptance Criteria

1. THE `IceMountains` component SHALL render a minimum of 60 mountain formations, each consisting of a wide cone base, a narrower ice-colored peak cone, and a snow-cap cone layer.
2. THE `CrystalTrees` component SHALL render a minimum of 250 instances, each with a translucent ice-colored cylinder trunk and between 2 and 5 `OctahedronGeometry` crystal clusters attached at varying heights.
3. THE `CliffFortress` component SHALL render a minimum of 15 wall/tower box instances and 40 glowing amber window instances positioned within the fortress structure.
4. THE `SnowParticles` component SHALL animate 400 snow particle instances falling from a maximum height of 100–200 units to terrain level in a continuous loop, with per-particle sinusoidal horizontal drift.
5. THE `OuterWildlands` Zone 3 sector SHALL include an `AuroraBorealis` component that renders animated ribbon-like curtains using at least 3 color bands (green `#30e090`, blue `#3090e0`, purple `#9060e0`) across the sky above Zone 3.
6. WHEN rendering the aurora, THE `AuroraBorealis` component SHALL animate ribbon positions using `Math.sin(clock.elapsedTime + phaseOffset)` to produce a flowing, wave-like curtain motion each frame.
7. WHEN the terrain height is computed for Zone 3, THE `getTerrainHeight` function SHALL return a value in the range [+20, +260] units inclusive, producing dramatically tall mountain terrain. This range SHALL be enforced regardless of the underlying noise computation state — outputs SHALL be clamped to [20, 260] if the raw noise would exceed these bounds.

---

### Requirement 7: Zone 4 — Void Wastes

**User Story:** As a player exploring the south sector, I want to see a dark, surreal zone with floating islands drifting at various heights, rotating obelisks carved with glowing runes, flickering reality-tear glitch lines, and crumbling bridges between islands, so that the zone feels alien and unsettling.

#### Acceptance Criteria

1. THE `FloatingIslands` component SHALL render a minimum of 40 islands, each consisting of an inverted cone underside and a flat cylinder top surface, animating vertically with a smooth sinusoidal float of ±3 units per island.
2. THE `FloatingIslands` component SHALL render crumbling bridge segments connecting adjacent island pairs whose horizontal distance is less than 300 units, up to a maximum of 25 bridges.
3. THE `VoidObelisks` component SHALL animate each obelisk with slow Y-axis rotation (`t * 0.05 + phase`) and vertical floating (`Math.sin(t * 0.2 + phase) * 5`) every frame.
4. THE `VoidObelisks` component SHALL render a secondary rune-strip `InstancedMesh` on each obelisk with `emissiveIntensity` pulsing between 1 and 3 using `Math.sin(clock.elapsedTime * 2)`.
5. THE `RealityTears` component SHALL render a minimum of 60 flickering glitch-line instances that switch between visible (scale.x = 0.3) and invisible (scale.x = 0) states based on `Math.sin(t * 8 + phase) > 0.3`, creating an erratic glitch effect.
6. WHEN the terrain height is computed for Zone 4, THE `getTerrainHeight` function SHALL return a value in the range [–45, –15] units, keeping base terrain below sea level to emphasize the floating islands above.

---

### Requirement 8: Zone 5 — World Tree

**User Story:** As a player looking south from the city, I want to see a single colossal tree that dwarfs the skyline, with a vast multi-layer canopy, glowing bark fissures, extensive surface roots, tiny tree-house structures in the branches, and a golden beacon at its apex, so that the zone serves as a dramatic landmark visible from anywhere in the city.

#### Acceptance Criteria

1. THE `WorldTree` component SHALL render a single trunk cylinder with a bottom radius of 25 units, top radius of approximately 17.5 units (0.7× bottom), and height of 400 units.
2. THE `WorldTree` component SHALL render at least 3 canopy layers as progressively smaller discs/spheres at approximately 75%, 85%, and 92% of the actual rendered trunk height, so canopy positions scale correctly if trunk height changes.
3. THE `WorldTree` component SHALL render at least 6 glowing bark-crack strips distributed radially around the trunk, each emitting orange (`#e8a030`) light with `emissiveIntensity ≥ 3`.
4. THE `WorldTree` component SHALL render at least 8 surface roots as tapered cylinders radiating outward from the trunk base, using `rotation={[0, -angle, Math.PI / 2 - 0.15]}` to angle them into the ground.
5. THE `WorldTree` component SHALL render a golden beacon sphere at position `[0, trunkH + 20, 0]` with `emissiveIntensity = 5` and a `pointLight` of intensity ≥ 200 and distance ≥ 800.
6. THE `WorldTree` component SHALL render at least 6 tree-house structures on branches, each with a box body, a cone roof, and a glowing amber window plane.
7. THE `WorldTree` SHALL be positioned at world coordinates `(0, –18, –800)` so the trunk is centered at `(0, 0, –800)` at ground level.
8. WHEN the terrain height is computed for Zone 4 (World Tree zone), THE `getTerrainHeight` function SHALL add a root-bump of up to 30 units within 400 units of the tree center to create elevated root terrain.

---

### Requirement 9: Zone 6 — Desert Ruins

**User Story:** As a player exploring the west sector, I want to see rolling sand dunes, partially buried stone pyramids, the tips of ancient skyscrapers jutting from the sand, teal glowing oasis pools, and a howling sandstorm of drifting particles, so that the zone feels like a lost civilization swallowed by the desert.

#### Acceptance Criteria

1. THE `Pyramids` component SHALL render a minimum of 15 pyramid instances (and may render more) as cone geometries with base size 25–75 units, each with a random burial fraction (0–50%) controlling how much of the pyramid is below terrain level.
2. THE `Pyramids` component SHALL render a glowing `OctahedronGeometry` capstone at the apex of each pyramid with the desert accent color (`#ff8800`) and `emissiveIntensity = 3`.
3. THE `BuriedSkyscrapers` component SHALL render 25 exposed building stubs as box geometries, with only 8–23 units of height visible above the terrain surface, plus glowing teal window boxes on the exposed faces.
4. THE `OasisPools` component SHALL render 12 flat cylinder instances at terrain level with the desert oasis color (`#20b8a0`) and `emissiveIntensity` animated between 1.0 and 2.0 per frame.
5. THE `SandstormParticles` component SHALL animate 300 flat ellipsoid instances drifting horizontally across Zone 6 at heights of 0–40 units above terrain, looping continuously.
6. WHEN the terrain height is computed for Zone 6, THE `getTerrainHeight` function SHALL use `Math.sin(x * 0.008 + 1.5) * Math.sin(z * 0.006 + 0.7) * 25` to produce sine-wave dune ridges with amplitude ±25 units.

---

### Requirement 10: Per-Zone Lighting

**User Story:** As a player, I want each zone to be lit with colors that reinforce its biome theme, so that each sector has a distinct atmospheric mood even at a distance.

#### Acceptance Criteria

1. THE `ZoneLighting` component SHALL render one `pointLight` per zone, placed at the radial midpoint of that zone's sector at height 80 units, with zone-specific color and intensity.
2. THE `ZoneLighting` Zone 1 light SHALL use color `#22c87a` (jungle green) with `intensity = 30`.
3. THE `ZoneLighting` Zone 2 light SHALL use color `#c84022` (volcanic red) with `intensity = 40`.
4. THE `ZoneLighting` Zone 3 light SHALL use color `#3090e0` (frozen blue) with `intensity = 25`.
5. THE `ZoneLighting` Zone 4 light SHALL use color `#9060e0` (void purple) with `intensity = 20`.
6. THE `ZoneLighting` Zone 5 light SHALL use color `#40b870` (world tree green) with `intensity = 35`.
7. THE `ZoneLighting` Zone 6 light SHALL use color `#c8900a` (desert amber) with `intensity = 30`.
8. WHEN rendered, each zone `pointLight` SHALL have `distance = outerR * 0.8` and `decay = 2` to produce physically correct falloff that does not bleed into neighboring zones.

---

### Requirement 11: Procedural Determinism

**User Story:** As a developer, I want the procedural world layout to be identical on every page load and every React re-render, so that the scene is reproducible for debugging and visual regression testing.

#### Acceptance Criteria

1. THE `OuterWildlands` SHALL use `seededRandom(seed)` for all procedural position and size generation, where `seed` is a fixed integer constant specific to each component.
2. THE `seededRandom` function SHALL implement the LCG formula `s = (s * 16807 + 0) % 2147483647` and return `(s - 1) / 2147483646`, producing values in `[0, 1)`.
3. WHEN the same seed is used, THE `seededRandom` function SHALL produce an identical sequence of values on every invocation.
4. THE `OuterWildlands` SHALL NOT use `Math.random()` anywhere in procedural generation; all randomness SHALL pass through `seededRandom`.

---

### Requirement 12: Standalone Page Integration

**User Story:** As a developer, I want the Dark Continent to live in its own self-contained Next.js page with its own canvas setup, so that it can be developed, deployed, and navigated to independently without touching the city codebase.

#### Acceptance Criteria

1. THE Dark Continent page SHALL exist at `src/app/dark-continent/page.tsx` and SHALL render `DarkContinentCanvas` as its root component.
2. THE `DarkContinentCanvas` component SHALL accept no required props and SHALL NOT import from any city-specific modules (e.g., building data, atlas textures, city grid logic, `CityScene`, `CityCanvas`).
3. THE `OuterWildlands` component SHALL accept exactly two props: `innerR: number` and `outerR: number`, both optional with defaults of 180 and 3000 respectively.
4. THE `OuterWildlands` component SHALL be a default export from `src/components/OuterWildlands.tsx`.
5. WHEN imported and placed inside the `DarkContinentCanvas` `<Canvas>` context, THE `OuterWildlands` SHALL render without errors or missing context warnings.
6. THE Dark Continent page SHALL include a navigation link or `ESC` handler that returns the user to the home page.

---

### Requirement 13: Aurora Borealis (Zone 3)

**User Story:** As a player looking toward the Frozen Highlands, I want to see shimmering aurora curtains sweeping across the night sky, so that the zone has an ethereal, otherworldly atmosphere above the mountains.

#### Acceptance Criteria

1. THE `AuroraBorealis` component SHALL render at least 3 ribbon segments, each as a thin elongated box or plane mesh oriented vertically and distributed along the arc of Zone 3.
2. THE `AuroraBorealis` component SHALL animate each ribbon's Y-position and width with independent `Math.sin(clock.elapsedTime * speed + phaseOffset)` expressions to produce wave-like shimmer.
3. THE `AuroraBorealis` component SHALL use emissive colors cycling through `#30e090`, `#3090e0`, and `#9060e0` with `emissiveIntensity ≥ 2` and `toneMapped={false}` to produce bloom-ready glow.
4. THE `AuroraBorealis` component SHALL place ribbons at heights between 150 and 350 units above the terrain, ensuring they appear in the sky and not underground.
5. WHEN rendered, THE `AuroraBorealis` ribbon meshes SHALL have `transparent={true}` and `opacity` animated between 0.3 and 0.8 to produce a translucent, flickering curtain effect.

---

### Requirement 14: Creatures

**User Story:** As a player, I want to see small wandering creatures roaming across all biome zones, so that the world feels inhabited and dynamic beyond static scenery.

#### Acceptance Criteria

1. THE `Creatures` component SHALL render a minimum of 100 creature instances distributed across all zones, with body shape and size varying by zone.
2. THE `Creatures` component SHALL animate each creature's position using sinusoidal wandering (`Math.sin`, `Math.cos`) evaluated every frame inside `useFrame`.
3. THE `Creatures` component SHALL render glowing eye instances as a separate `InstancedMesh`, with eye color matching the zone's accent color and `emissiveIntensity = 3`.
4. THE `Creatures` component SHALL compute terrain Y-position for each creature's current (wandering) position using `getTerrainHeight` each frame, so creatures follow the terrain surface.

---

### Requirement 15: Shoreline Transition

**User Story:** As a player standing at the edge of the island, I want to see a band of rocky outcroppings at the water's edge that transitions the terrain into the surrounding ocean, so that there is no jarring seam between land and sea.

#### Acceptance Criteria

1. THE `ShorelineRocks` component SHALL render a minimum of 250 rock instances as scaled `BoxGeometry` meshes distributed in a ring from radius 2700 to 3100 units from the island center (straddling the island edge).
2. THE `ShorelineRocks` component SHALL vary each rock's width, height, and depth independently using seeded random values in the ranges [3, 18], [2, 12], and [3, 18] units respectively.
3. THE `ShorelineRocks` component SHALL apply a Y-axis rotation to each rock using a seeded random value, so rocks appear naturally irregular.
4. THE `ShorelineRocks` component SHALL position each rock base at Y = `–18 + sy/2 – 2` so rocks appear to partially emerge from the water surface at the island's shoreline.

---

### Requirement 16: Airplane Flight Controller

**User Story:** As a player, I want to pilot an airplane through the Dark Continent island, flying between jungle canopy towers, threading through volcanic canyon gaps, swooping under the World Tree, and skimming over desert dunes, so that exploration feels dynamic and spatial rather than a static camera pan.

#### Acceptance Criteria

1. THE `AirplaneController` component SHALL move the player camera through the scene each frame using keyboard input: W/S for thrust forward/backward, A/D for yaw left/right, Q/E for roll, and mouse Y-axis for pitch. THE airplane SHALL move continuously forward at the current speed regardless of whether any input is being held, never stopping unless blocked by a collision.
2. THE `AirplaneController` SHALL apply a constant base forward speed of 120 units/second, with W increasing thrust to a maximum of 400 units/second and S decelerating to a minimum of 30 units/second.
3. THE `AirplaneController` SHALL apply smooth exponential interpolation (`lerp` with factor 0.08 per frame) to velocity, pitch, yaw, and roll so that direction changes feel like a plane banking rather than instant teleportation.
4. THE `AirplaneController` SHALL clamp the camera's pitch angle to ±75 degrees to prevent the player from flying straight up or down indefinitely.
5. WHEN the player presses Escape or clicks a UI back button, THE `AirplaneController` SHALL halt flight and navigate back to the home page.
6. THE `DarkContinentCanvas` SHALL render a minimal HUD showing current speed (units/second), altitude (Y position), and active zone name as an overlay on the canvas.
7. WHEN the airplane enters a new zone (determined by the angular sector of the camera's XZ position), THE HUD SHALL update the displayed zone name with a brief fade-in transition.

---

### Requirement 17: Structure Collision System

**User Story:** As a player flying through the island, I want the airplane to be blocked by solid structures — trees, spires, ruins, mountain faces, the World Tree trunk — so that flying feels physically grounded and navigating flight corridors requires actual skill.

#### Acceptance Criteria

1. THE `CollisionRegistry` SHALL be populated at component mount time by reading the `instanceMatrix` of every solid `InstancedMesh` and computing an AABB `{ min: THREE.Vector3, max: THREE.Vector3 }` for each instance, stored in a flat JavaScript array.
2. THE `CollisionRegistry` SHALL include AABBs for the following solid mesh types: jungle tree trunks, jungle tree canopy layers, obsidian spires, volcano caldera cone, ice mountains, cliff fortress walls, void obelisks, World Tree trunk, World Tree canopy layers, desert pyramids, and buried skyscraper stubs.
3. THE `CollisionRegistry` SHALL NOT include AABBs for particle systems (fireflies, embers, snow, sandstorm), lava rivers, oasis pool surfaces, or purely decorative glow strips, since these should not block flight.
4. EACH FRAME, THE `AirplaneController` SHALL test the airplane's bounding sphere (radius 8 units) against every AABB in the `CollisionRegistry` using a sphere–AABB intersection test.
5. WHEN a collision is detected, THE `AirplaneController` SHALL resolve it by computing the penetration vector from the AABB surface to the airplane center and pushing the airplane back along that vector, halting velocity in the penetration direction.
6. THE terrain surface SHALL act as an implicit floor collider: IF the airplane's Y position falls below `getTerrainHeight(cameraX, cameraZ) + 12`, THE `AirplaneController` SHALL push the airplane upward to that minimum altitude each frame.
7. THE ocean surface (Y = –18) SHALL act as a hard floor: THE `AirplaneController` SHALL prevent the camera from descending below Y = –10 regardless of terrain height.
8. WHEN a collision occurs with a solid structure, THE HUD SHALL briefly flash a collision indicator (red tint, 200 ms duration) so the player has clear feedback.

---

### Requirement 18: Flight-Worthy Structure Scale and Corridor Design

**User Story:** As a player, I want the structures and terrain in each zone to be sized and spaced so that flying between them feels cinematic — like threading through a canyon, diving under a canopy, or spiralling around a spire — so that the island is a game-design-quality flight course, not just a visual backdrop.

#### Acceptance Criteria

1. THE jungle trees in Zone 1 SHALL be placed with a minimum center-to-center spacing of 80 units for colossal trees and 40 units for medium trees, ensuring flight corridors of at least 60 units width exist between adjacent trunks.
2. THE obsidian spires in Zone 2 SHALL be placed in loose clusters of 3–7 spires with intra-cluster spacing of 50–120 units, creating canyon-like gaps that the airplane can thread through at normal speed.
3. THE ice mountains in Zone 3 SHALL be arranged with valley corridors at least 150 units wide between adjacent mountain bases, wide enough to fly through at high speed.
4. THE floating islands in Zone 4 SHALL have vertical separation of at least 80 units between any two adjacent islands, creating layered flight levels the airplane can navigate between.
5. THE World Tree trunk (radius 25 units) SHALL be surrounded by a clear radius of 120 units at ground level before root meshes begin, giving the airplane a clear approach path for circling the trunk.
6. THE desert pyramids in Zone 6 SHALL be placed with minimum 200-unit separation between adjacent pyramid centers so the airplane can weave between them at full speed.
7. WHEN the zone terrain height varies by more than 60 units within a 200-unit horizontal distance (e.g., cliff edges in Zone 3), THE terrain geometry SHALL include a visible cliff face mesh so the player can read the obstacle before reaching it.
8. THE World Tree canopy SHALL have at least one deliberate gap of 80 × 80 units in the lowest canopy layer through which the airplane can pass vertically, entering the interior under-canopy space.
