# Drone Dash: round 32 builder notes

Brief: the water must get calmer with height. Leftovers: A boat colliders, B wakes toward a low sun, C grid-snap pop, D ferry and routes (optional).

Dev server: my own on port 5190, stopped at the end. The owner's server on 5188 was left alone. Browsers ran one at a time, from `builder-scripts/queue32.sh` (`jobs32.txt`) and `queue32b.sh` (`jobs32b.txt`, the reruns on the final build).

Machine: BTLEServer used 99 to 100% of one core in every `cpu-*.txt`. XProtect used 40% during the water run. Headless Chromium still ran at 120 Hz. All wall-clock numbers are marked contaminated. The camera, boat and pop verdicts come from fixed-step probes.

Scripts: the round 31 critic scripts are copied to `builder-scripts/`. In the copies only the output folder (`./out/`) and the port (5190) changed. Some tools got extra switches that are off by default: `water31b.mjs` has `WAKEONLY`, `WAKESHOT` and `OPENWATER`. In `builder-scripts/out/` the file tag `r31` means "this build" (the tag comes from the port test in `water31.mjs`). New scripts: `wfast.mjs` + `cfast.py` (tuning loop), `boatcol32.mjs` (A), `pop32.mjs` (C), `bus32.mjs` (D shots), `ab32.py` (blind A/B), `dbg32*.mjs` (debug traces).

## 1. Water calms with height (`src/world/Water.ts`)

Design:

- `hiK` is 0 below 4 m camera height and 1 above 15 m. All the calming scales with it, so a low skim keeps the full close chop.
- The fine ripple layer fades by distance. It also fades by the metres one pixel covers on the water (`fwidth` of the world position). So it is mip-aware. Both limits are tighter from above. From play height the finest layer is gone past about 18 to 90 m.
- The middle layer fades the same way, to a 20% floor.
- A new broad, slow layer (74 m texture period, very slow scroll) carries the look from above. Its height channel also makes soft calm and ruffled wind patches tens of metres across.
- The analytic swell slopes ease off by up to 60% with distance from above. The vertex swell is unchanged near the camera (see C).
- Low sun: with a low sun and a high camera, the key light sees up to 60% less of the fine layer (`nL`). The fine slopes that fade out widen the glint instead (roughness 0.16 to 0.30, a Toksvig-like trade).
- Per mood `chop` (golden 1.0, morning 1.15, dusk 1.15, noon 0.68) sets how breezy the bay looks from above.
- Cost: the shader skips the finest layer where it is faded out (`textureGrad` with gradients taken outside the branch). The foam noise blends over to the coarser layer, so there is no seam.

Results (`water31.mjs` then `contrast31.py`, desktop, final build):

| Mood (seed) | Cruise | Low | Ratio | Round 31 ratio |
|---|---|---|---|---|
| Golden hour (130) | 18.2 | 34.1 | 0.53 | 0.90 to 1.09 range |
| Morning (22) | 16.6 | 29.4 | 0.56 | |
| Dusk (33) | 16.7 | 39.0 | 0.43 | |
| Hazy noon (58) | 16.8 | 29.9 | 0.56 | |

Pass marks: ratio at most 0.6 (pass on all 4), low at least 25 (pass), cruise at least 15 (pass).

Blind A/B against the round 31 views (`ab32.py`, hidden random key, picks by a fresh agent that saw only the 10 pairs):

- Final build: new 4, tie 4, old 2. New wins or ties 8 of 10 (target 6). `out/ab/picks.txt`.
- The first build of this round: new 5, tie 4, old 1 (`out/ab-first/`).
- Both losses are close or glint views in golden hour (130 g-low, 22 glint). The judge called the new side "hazy, smeared" there. Every cruise pair went to the new water or was a tie.

Water cost (`water31b.mjs`, throughput, contaminated): desktop +0.44 to 1.03 ms a frame in water views (round 31 critic: +0.5 to 0.9), about 0 in a city view. Phone +0.06 to 0.51 ms. The 1.03 is seed 33 low. Treat it as at the +1.0 ms line.

## A. Boat colliders (`CollisionWorld.ts`, `Boats.ts`, `Drone.ts`)

Design:

- `CollisionWorld` has a new list of turning boxes (`DynBox`: centre, heading as sin / cos, half sizes, height range, soft flag, velocity). `resolveSphere` and `surfaceBelow` check them every query (about 25 boxes, an early bounds check). A sphere never leaves one downwards. So a boat can push the drone sideways or up, never into the sea.
- `Boats` builds the boxes from the model sizes (`PARTS`): a hull box for every boat, a thin soft mast-and-sail column for sailboats, and the bus hull, deckhouse and funnel. Each frame the box centres come from the instance matrix (so heave, pitch and roll move them). The soft mast column widens by the lean, so the drone is held clear of the mast at every height. Moored boats and the three docks have static boxes. The hull boxes reach 1.5 m below the waterline.
- After the assets load, `Game` adds the boxes to the collision world.
- Crash rules: hulls go through the normal wall path. Soft parts glance like a lamp post (a scrape, never a crash). One change in `Drone`: a boat is never skimmed with the ledge hop. A gunwale low enough to step over (up to 0.9 m above the skids, like a kerb) is still free. Anything taller is a wall.
- A moving boat never bulldozes the drone. The crash test uses the drone's own speed only, so a boat running into a hovering drone is never a crash. After a contact with a closing boat face, the drone leaves at least as fast as the face moves. Off a bow or stern it also slides out to the side, so the boat goes past.

Results (`boatcol32.mjs`, fixed step, seeds 22, 58, 130, final build):

| Runs | What | Outcome |
|---|---|---|
| 30 into moving boats (10 per seed) | lane-31 sailboats (hull low, mid, mast, twice each) and the harbour bus (deckhouse, high, bow, stern, low hull) | bus: 12 crashes (tier rules), 3 wall hits under the threshold (bow, head-on). Sailboats: 15 scrapes (they step over the gunwale and glance off the sail) |
| 15 into moored boats (5 per seed) | sail hull, sail mast, two rowing boats, the rib | 9 step-overs, 3 scrapes, 3 none (the moored rib's top sits below the drone's lowest flight height) |
| 9 boats run into a hovering drone | bus head-on, bus 1 m off the centre line, sailboat | 0 crashes. The drone slides off the bow in under 1 s |
| All 54 runs | | 0 frames with the drone centre inside a hull. Deepest overlap 0. 0 stuck (a climb frees the drone every time). 0 frames under the flight floor |

Only the lane-31 sailboats, the bus and the marina are inside the flight bounds (soft edge 190 m from the centre, hard edge 215 m). The drone cannot reach the ribs on lane 52 or the lone sailboat on lane 74.

The critic's `boats31.mjs` fly-through at 4 m (seeds 22, 58, 4711, 130): 0 crashes, 0 frames in a solid, closest drone to the boat centre 0.84 to 1.01 m (round 31: 0.54, it flew through).

## B. Wakes toward a low sun (`Water.ts`)

Looking toward a low sun, the open water is bright sky reflection plus glint, brighter than sunlit foam. Foam is now always brighter than the bare water round it: by up to 150% at full foam, colour kept, capped at 1.4. The trail of slow boats is stronger and longer (floor 0.35 instead of 0.12, decay length +1 m +0.4 s of speed).

Results (`water31b.mjs` wake block, trail over open water, rib and ferry, 4 azimuths, 4 moods, final build):

- 28 of 32 at 1.3 or more. Under 1.3: 130 rib 1.12, 33 ferry 1.04 and 1.08, 58 ferry 1.17. Round 31 critic: 6 of 32 under 1.2.
- The ferry is now the harbour bus on a lane 19 m off the wall. Its side samples ("open water" 14 m to the island side) land 5 m from the wall, in the shore foam, or on the promenade. With samples closer than 8 m to the wall left out (`OPENWATER=1`, `wake-open.log`): ferry 15 of 16 at 1.3 or more (58 noon 1.22). The golden-hour rib at 0.96 has its open samples in the bright glint path. Its wake is plain to see (`r32-wake-130-rib0.jpg`).
- Screenshots toward a low sun: `r32-wake-130-rib0.jpg`, `r32-wake-130-ferry0.jpg` (golden hour), `r32-wake-33-rib2.jpg`, `r32-wake-33-ferry2.jpg` (dusk).

## C. Grid-snap pop (`Water.ts`)

Cause: only the centre vertex of the grid was world-stable. A 2.5 m snap moved every other vertex to a new place. Far vertices sampled waves too short for their cells. So the surface height, and the point where the view ray hits it, jumped.

Fix:

- The grid now has 10 even 2.5 m steps round the centre (8 x 3.2 m on phones), then grows by 8% (10% on phones). A one-step snap maps every even vertex exactly onto an old one.
- The vertex swell lives only inside that even part: full to 12 m, gone by 21 m from the camera. It keeps only the waves the cells can carry (5.1 m wave out, 8.3 m wave about half). Further out the swell stays in the per-pixel normals, as before.
- The swell fade is now per pixel, not a varying.
- The boats still ride the full swell (`waveHeight` with the distance fade), as in round 31. New hook `waterShown(x, z)` gives the height as drawn. `waterAt` is unchanged.
- Triangles: desktop water grid 26.9k (was 22.5k), phone 16.9k (was 14.1k).

Threshold: a move across a snap line must change the water band no more than the same move without a line (ratio at most 1.1).

Results (`pop32.mjs`, time frozen, band from the horizon down to the near water):

| Test | Across a line | Control | Round 31 (critic) |
|---|---|---|---|
| 2 cm move at 20 lines, 4 m up, desktop 130 | 3.30% big pixels, mean 6.00 | 3.27%, mean 5.98 | 14 to 18% against 0.1 to 1.7% |
| same, 25 m up | 0%, mean 0.76 | 0%, mean 0.76 | |
| sweep, 0.25 m a frame over 20 lines, 4 m up | mean 69.0 (20 frames) | 68.8 (180 frames) | |
| desktop 33, phone 22 | across equals control within 0.1 | | |

The critic's own pop block in `water31.mjs` agrees: across equals control on all 4 moods at 4 m and 25 m.

## D. Ferry and routes (`Boats.ts`)

- The 20 m cruise ship is now drawn at 0.72 scale (14.4 m) as a harbour bus. No new model, no Blender run, no generation (ASSETS.md has a line).
- The bus has its own lane 19 m off the wall, inside the sailboats. It brakes, stops alongside a pier head for 9 s, then pulls out. There are two stops: the marina and a new landing pier on the north wall (the same CC0 dock model, 2 more instances, with leg foam and colliders). It starts each city under way, part of the way between stops. So it does not sit still during the first tests.
- Sailboats speed up and slow down with slow gusts (up to 30 to 35%). The gust is the same for every boat on a lane, so the spacing holds.
- Each city moves the lanes by up to 2.5, 3 and 6 m, so the loops differ. The lone sailboat now sails a tighter loop (74 m off the wall, 2.3 m/s).
- `boats31.mjs`, 120 s at 30 Hz on seeds 22, 58, 4711 and 130: 0 hull-hull, 0 hull-dock, 0 hull corners in a solid. Its `minGap` is the centre distance minus the half lengths. It goes to -0.98 m as the bus and a sailboat pass side by side on their lanes. That is a crude metric. The oriented test finds no overlap, and the closest hull edges are 6.5 m apart.
- Not done: a better CC0 ferry or tug model (optional).

## Regressions (final build unless marked)

| Check | Result |
|---|---|
| Flat frames, bloom on | `acceptance-probe.mjs`: 945 frames, 0 flat, 0 errors. `water31b.mjs` water and glint views: 960 desktop + 240 phone frames, 0 flat, 0 black pixels, at least 39 distinct colours of 49. New `pow` bases: none. One new division, guarded |
| Crash-classify, seeds 22, 58, 130 (first build of this round, Drone change already in) | 12 m: 20 charged crashes in 183 s, 0 pad lips, 0 hop-like rises. 20 m: 9 in 253 s, 0 pad lips |
| Boat probe 120 s | 0 overlaps on 4 seeds (see D) |
| Alley camera (first build) | cam-clip30 seed 22 no orbit: 0 hidden frames, 0 in solid, 0 jumps over 1 m. cam-clip24 seeds 22 and 58: the same, all 0 |
| climb30 (first build) | desktop and iPhone: 0 of 4,800 frames over 1.0 m (max 0.896), 0 in solid, max height share 0.394 |
| People probe (first build) | 0 people on active pads, 48 legs, 1,536 samples |
| Traffic overlap (first build) | 0 pair frames in all 6 runs |
| Phone HUD (first build) | iPhone 22, 58, 130: marker on controls 0, drone under pills 0, pops on the drone 0% |
| Street medal gate (first build, real time, contaminated) | 22: 4,643 Silver, 58: 3,548 Silver, 130: 7,020 Gold. Breakdown and game-over sums exact on all 3 |
| No-delivery farm (first build) | 0 points on 22, 58, 130 |
| Triangles | desktop 130: max 593,704 (3,256 spots, 0 over 600k). desktop 22 (first build): 570k. iPhone 130 (first build): 527k |
| Draw calls | max 145 desktop, 128 phone. 0 over 150 |
| First load | production build 2.9 MB without source maps (JS 944 KB). `npm run build` passes (tsc clean) |

"First build" means the build before the last three small changes. (1) The mast column widens with the lean. (2) The broad layer is weaker at low height. (3) The shader skips the finest layer where it is faded out. Those touch only the water shader and the soft mast box. After them I reran the water, flat, pop, boat-collider, boat-route and triangle tests. The bloom clamps in `src/entities/ObjectiveMarker.ts` and the debug hooks are untouched.

## Known gaps

- The chase camera does not see the boat boxes. If the drone hugs the bus, the camera can pass through the hull. `segmentFraction` and `pushOutPoint` cover only the static boxes.
- The bus is still the cruise-ship shape, just smaller.
- From 4 to 15 m up, golden-hour close views look a little softer and hazier than round 31 (the 2 A/B losses).
- Water cost sits at the +1.0 ms line in one contaminated view.

## Files changed

- `src/world/Water.ts`: calming with height, the broad layer, wind patches, low-sun specular and roughness. Also the finest-layer skip, the foam lift and the stronger trail. Also the even inner grid, the near-only vertex swell, the per-pixel swell fade and `surfaceHeight`.
- `src/world/Boats.ts`: collider boxes, harbour bus with stops, north landing pier, gusts, lane jitter, ferry scale.
- `src/systems/CollisionWorld.ts`: turning boxes in `resolveSphere` and `surfaceBelow`, push data for moving faces.
- `src/entities/Drone.ts`: no ledge hop on boats, slide off a moving boat face.
- `src/game/Game.ts`: boat boxes join the collision world, hooks `boatColliders`, `waterShown`, `boatsOn` also turns the boxes off.
- `src/world/Environment.ts`: `focusCam` is readable (for `waterShown`).
- `src/vite-env.d.ts`: hook types.
- `ASSETS.md`: one line for the scaled ferry and the reused dock.

Screenshots: `builder-shots/` (37 JPEG). `r32-water-*` are the final water views (all 4 moods, cruise, low, glint, shore, phone). `r31-before-water-*` are the critic's round 31 views of the same frames. `r32-wake-*` are wakes toward a low sun. `r32-bus32-*` show the bus at the marina, under way, and the routes. `r32-boatcol32-*` show the drone against the bus and a mast. `r32-pop32-*` are the pop test views.
