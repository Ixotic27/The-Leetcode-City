---
name: git-city-worldbuilding
description: Adapt srizzon/git-city island and town layout, instanced rendering, driving physics, racing, and performance patterns for LeetCode City. Use for this project's world structure, visual repairs, exploration, driving, race features, and lag reduction.
---

# Git City worldbuilding

Use inspected upstream patterns to improve LeetCode City's own architecture. Preserve LeetCode progression and existing additions. Inspect the local implementation before adding a second renderer, quality control, input loop, or layout system.

## Source and attribution

- Source: [Samuel Rizzon's Git City](https://github.com/srizzon/git-city).
- Snapshot: [`98cab64cf834eb1d7e6bec2302a468c0138ab841`](https://github.com/srizzon/git-city/tree/98cab64cf834eb1d7e6bec2302a468c0138ab841), dated 2026-10-23, inspected 2026-10-24. Local reference: `D:/git-city-reference`.
- Upstream declares `AGPL-3.0` in [package.json](https://github.com/srizzon/git-city/blob/98cab64cf834eb1d7e6bec2302a468c0138ab841/package.json) and includes [LICENSE](https://github.com/srizzon/git-city/blob/98cab64cf834eb1d7e6bec2302a468c0138ab841/LICENSE). Preserve source attribution and applicable notices when adapting code. Check separate asset notices before reusing models or artwork.
- This skill is a researched summary; it contains no copied implementation code. Older June snapshots lack the newer island, drive, and race implementations: verify the commit before making claims about missing features.

## Established upstream features

The snapshot implements editable league towns, multiple town templates, procedural island shores, a geographic Brasil map, a separate drift-track island, Rapier car driving, drift/boost behavior, road-based rally routes, time trials, live races, ghosts, and network presence. These are implemented systems, not merely roadmap ideas. Their services and data model are not drop-in compatible with LeetCode City.

Read [references/source-map.md](references/source-map.md) for exact pinned source locations before adapting the relevant system.

## World and islands

- Treat layout as data shared by meshes, spawn, physics, focus, minimap, and connections. Upstream `league-city/grid.ts` owns lot/world conversion, bounds and rotation; `types.ts` distinguishes lot surfaces from free-positioned props. Towns grow north/east/west from a stable entrance.
- `starter.ts` creates crew/race/hq/park/blank layouts; roads use neighbor masks from `roads.ts`, not hand-drawn disconnected pieces. Preserve approach-road and portal clearance when resizing or decorating.
- `towns/brasil-map.ts` lays out occupied blocks and roads with coastal clearance and explicit scale; `brasil-world.ts` turns that layout into shared town objects. Seed scenery deterministically.
- `towns/brasil-geo.ts` provides projected geography and cached land masks. `BrasilScene.tsx::Ground` builds an irregular 48-point shore around the resident island and a 64-point rounded-square shore around the drift site, with sand ribbons and sea below land. `drift/HarborGround.tsx` is the simpler circular sand/grass island variant.
- Match the terrain silhouette to actual occupied extents, including building footprints and drive routes. Apply city offsets consistently to all world systems; avoid independent visual-only offsets that leave focus or collision behind.

## Driving and racing

- Separate pure simulation from React. Upstream `drive/vehicle.ts` uses Rapier's four-wheel raycast vehicle controller; `tuning.ts` centralizes handling, drift, boost, and units. Physics uses meters; city rendering uses world units with `UNIT_TO_M = 0.4`. Do not mix these frames.
- `DriveWorld.tsx` loads only when driving, builds collider specifications from shared city objects, and runs physics at 1/60 with interpolation. `Car.tsx` steps the controller before physics and disposes it on cleanup; model transforms read the interpolated body.
- Reuse the input principles: keyboard/gamepad/touch converge on one input state; typing, pause and blur suppress/reset movement; single presses remain distinct from held inputs. Give one active controller the camera and preserve a smooth return to orbit.
- Upstream race `track.ts` samples a common centerline; `layout.ts` derives both visual walls and colliders. `laps.ts` validates ordered checkpoints, track corridor and plausible travel. Keep local timers and remote records separate.
- `trial.ts` owns menu/intro/countdown/run/finish flow, retries and launch timing; `ghost.ts` records bounded 20 Hz poses with checkpoint splits. `RaceWorld.tsx` reuses the car and shared timing rules.
- `party/race.ts`, `party/lapToken.ts`, `race/receipt.ts`, and the lap API support server-timed, signed lap results. Port a complete boundary if competitive records are added; do not turn a local client time into a trusted reward or global record.

## Performance and structure

- Reuse one Canvas across town view/edit/drive; upstream edit mode uses demand rendering. Load physics, car audio and models on entering drive. Split layout/simulation/network/render/HUD responsibilities rather than adding more concerns to the main canvas component.
- Batch common buildings, labels, roads, scenery and toys. Merge static terrain by material (`MergedStatic.tsx`). Keep dynamic effects and physics props bounded to nearby objects (`EffectsLayer.tsx`, `TreeBubble.tsx`).
- Precompute lookup maps and spatial grids; reuse temporary vectors, matrices and query buffers in hot loops. Throttle React-facing HUD updates. Dispose owned geometry/material/texture resources when replaced.
- Current upstream `perfMode.ts` resolves URL override, explicit preference, cached auto tier, then GPU benchmark/heuristic. Settle automatic quality before reveal; do not create abrupt mid-session theme/DPR changes. Inspect current code rather than transplanting obsolete thresholds.
- `city-snapshot-client.ts` and its workers move decode/layout/geometry preparation off the main thread and provide fallback paths. Adopt only when profiling shows load work is material.

## Verification

Establish current errors and frame-cost evidence before claiming improvements. Verify affected invariants: stable layout, shoreline clearance, shared bounds, road continuity, focus and selection, input cleanup, mode changes, reset, checkpoint order, pause and race completion. Run relevant existing tests and build/type checks; add focused tests for new pure layout or race logic. Clearly distinguish observed upstream behavior, intentional local adaptations, and future ideas.
