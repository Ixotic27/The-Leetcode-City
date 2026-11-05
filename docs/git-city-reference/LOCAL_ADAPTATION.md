# LeetCode City adaptation

The [reference skill](SKILL.md) records the inspected upstream implementation at
`srizzon/git-city@98cab64cf834eb1d7e6bec2302a468c0138ab841`. It was written before
the following adaptations. Ponytail full mode was used to keep the changes within
the existing Next.js, React Three Fiber, and Three.js stack.

## World

The city is a master plan (`generateCityLayout` in `src/lib/github.ts`); the
site plan for the live snapshot is `docs/city-plan.svg`
(`npx tsx scripts/layout-plan-svg.ts <snapshot.json> docs/city-plan.svg`).

- **Zoning.** The top 50 residents form downtown (Bengaluru). Everyone else lives
  in their chosen district, else their language's district, else one of the ten
  cities picked by a hash of their login, so cities stay balanced.
- **District form.** Every district is the same lattice of 4x4-lot blocks,
  mirrored into four quadrants around a civic square (monuments, fountain,
  benches, tree ring, bus stop). The district axes are 40-wide avenues; the
  lines at ±450 are boulevards with planted medians for the metro. One road per
  lattice gap spans the whole district, then a ring road and a tree-lined
  waterfront promenade. About 10% of blocks are parks (pond, small landmark,
  trees). Downtown also reserves 16 lots for the custom landmarks and the
  Founder Spire (`landmarkSite` decorations, read by `lib/city/landmarks.ts`).
- **Slots, not nudges.** Lamps and trees stand on sidewalks, parked cars in the
  curb lane, monuments on fixed spots of the square, so nothing overlaps by
  construction. `src/lib/city/layoutAudit.ts` checks 13 kinds of collision;
  `npx tsx scripts/layout-audit.ts <snapshot.json>` must report all zeros.
- **Scale.** Districts are built at a local origin, then set on their compass
  slot (`DISTRICT_ORIGINS` gives only column/row) with each column and row as
  wide as its largest member plus a 480-unit sea channel. Any population fits;
  islands never touch. Real positions come from the layout's plazas, which is
  what the metro, trams, inter-city links and buses read.
- **Water.** The river runs in the channel south of the downtown row, with a
  bridge on every column axis.
- `src/lib/city/world.ts` derives the islands from building, plaza, decoration
  and landmark footprints; `DistrictIslands.tsx` renders them.

## Racing

Choose **Race / Time trial** on the welcome panel, or **Race circuit** while
exploring. Drive with WASD or arrow keys; Space brakes. Touch controls are also
available. Follow the green checkpoint in order, stay on the asphalt, and cross
the finish. Restart resets the car and lap; Escape or Exit drive returns to the city.
Switching windows clears held controls and pauses the simulation.

`src/lib/city/driving.ts` owns the local simulation, track boundaries and lap
validation. `CityCircuit.tsx` renders the same boundaries and controls the camera.
`CircuitHUD.tsx` displays updates at 10 Hz. Best laps are stored only in this
browser. This is a local time trial; multiplayer races, ghosts and server records
are separate upstream systems and are not represented as implemented here.

## Rendering and interface repairs

- Building chunks have stable grid keys, progressive mounting, conservative
  distance culling and immediate availability for the focused building.
- One shared picker chooses the nearest visible building across all chunks.
  Camera drags, cancelled taps and disabled interactions do not open profiles.
- Focus dimming applies consistently across chunks.
- Landing and explore search share the same component; autocomplete requests
  cancel on changes. Search updates the complete layout and cache together.
- A compact welcome panel, collapsible settings and actual loading progress
  replace overlapping controls, duplicate search forms and scripted delays.
- Fonts use the existing local asset. Cursor preferences load after hydration.

## Verification

Focused tests cover resident footprint collisions, aliases, island bounds,
landmark clearance, chunk bounds and picking, checkpoint order, off-road and
backward laps, restart, frame-step consistency and road boundary agreement.
Use `npx vitest run`, `npx tsc --noEmit`, and `npm run build` for the full checks.

No deployment or database migration is performed by this adaptation. Browser
frame rates depend on the actual scene and GPU; unit-test timings are not FPS.
