# Drone Dash: round 33 builder notes

Build: the round 33 work, not committed, on top of 46b183d (round 32). My dev server ran on port 5190. It is stopped.
For the A/B renders, a copy of the round 32 commit ran on port 5192 (git archive into my scratchpad). It is stopped too.
I did not touch the owner's server on 5188. Every browser job ran alone, one at a time.
The regression batch is in `builder-scripts/queue33.sh` and `jobs33.txt`.

Machine load: BTLEServer used 99 to 100% of one core all session (`cpu-*.txt`).
The headless browser still ran at the 120 Hz vsync (median 8.3 ms). All wall-clock numbers are contaminated.
The verdicts below come from fixed-step probes. The medal gate, HUD and perf runs are real time.

Scripts: I copied the critic's round 31 and 32 scripts into `builder-scripts/`.
I changed only the port (5190) and the output folders (`../builder-shots/`, `ab/`).
Small extras: `bus-stop32.mjs` takes STEPS and prints a summary line. `water31.mjs` names files `water33-<NAME>-...`.
`art27.mjs` takes PORT and NAME. `contrast31.py` reads the round 33 tags.
New scripts:

- `breakdown33.mjs`: triangles and draws per mesh at a spot.
- `slabverify33.mjs`: checks the city shadow slab (see part 2).
- `ab33.py`: blind pairs. It writes the key before any judging.
- `geo33.mjs`: instance counts.
- `slabcheck33.mjs`: a pixel diff. Not usable: two renders of the same frame already differ.

## 1. Harbour bus stall: fixed

**Cause.** `Boats.stepShuttle` braked on `sqrt(2 a (left - 0.05))`.
So the speed got to 0 at 5 cm before the stop. But the bus counted as "arrived" only under 2 cm.
The bus parked at speed 0 with 5 cm to go. Each step was 0, and the 9 s dwell never started.

**Fix.** The brake curve now aims at the stop itself.
While the bus has way to go, its speed stays at 0.25 m/s or more (`SHUTTLE.creep`).
Within 0.1 m of the stop, the bus is alongside (`SHUTTLE.arrive`).

**Test**: `bus-stop32.mjs`, fixed 0.5 s steps, seeds 22, 58, 4711 and 9001.

| Run | Stops per seed | Piers | Longest stop | Stalls |
|---|---|---|---|---|
| 300 s | 2, one at each pier | in turn | 9 to 9.5 s | 0 (on seed 22, the second stop is in its dwell at 300 s) |
| 700 s | 4, two at each pier | in turn | 9 s | 0 |

"Both piers at least 3 times in 300 s" is not possible on this route.
The bus lane is 1,583 m long. At 4.6 m/s one loop takes 344 s.
The two piers are half a loop apart (about 790 m). The time between stops is 165 to 175 s.
The critic's round 32 bar passes on all 4 seeds: 700 s, at least 4 stops per seed, never more than 15 s at speed 0.
For 3 visits in 300 s, the bus needs about 9 m/s, a third pier, or a turn-round shuttle. I did not change the route.

## 2. Budget: triangles and draw calls

| Check | Round 32 (critic) | Round 33 | Target |
|---|---|---|---|
| Full sweep, desktop seed 130 | 588k, 144 draws | **449k, 122 draws** | under 480k, under 125 |
| Full sweep, desktop seed 22 | 566k | **426k, 121 draws** | |
| Full sweep, iPhone seed 130 | 524k, 128 draws | **408k, 106 draws** | |
| Water and marina spots (1,920 per run), max | 463k | 350k | |
| Street run (perf-street), desktop max | 146 draws | **122 draws** (395k) | |
| Street run, iPhone max | | 103 draws (358k) | |

The sweep is `trisweep31.mjs`, not changed (3,256 spots, water and marina included).
Worst spot: seed 130 at (-90, 3, 0). Before: 554k and 140 draws. After: 419k and 115 draws.
See `breakdown-before.log` and `breakdown-after.log`.

What changed:

- **The shadow pass draws only what the shadow map holds.** The sun's shadow box is ±75 m round the drone.
  Before, every instanced mesh drew all its instances into it.
  The new `shadowSubset` writes instances nearest first. The shadow pass draws only the first `shadowCount`.
  It uses `onBeforeShadow` and `onAfterShadow` on the mesh. A count of 0 skips the draw.
  Users: lamp poles (115 m), blob tree canopies (115 m), street props (45 m), far people (to 40 m) and pines.
  The lamps sort again after 12 m of camera travel. Each lamp's part indices move with it, so the occlusion pass still works.
  When a boat or a dock is within 115 m, it casts a shadow. Further out, it casts none.
- **City shadow slab.** I sort the merged city mesh one time, by the distance across the sun's direction.
  The shadow pass draws only the slab that the shadow camera can reach.
  The slab is ±75 m plus half the widest triangle.
  Long faces that point at the sky, and the 4 cm diagonal paint strips, are not in the slab.
  For this material, the shadow pass culls faces that point at the sky. So this change has no effect on shadows.
  The promenade edge boxes are now in 40 m pieces, so they sort into the slab.
  Check: `slabverify33.mjs`, 8 seeds, 338 spots each, exact triangle-to-plane test.
  Result: 0 left-out triangles inside the shadow frustum.
  City cost at the worst spot: 113k before, 93k after.
- **People.** The low-detail figure starts at 24 m (was 40 m). Far people still cast shadows to 40 m, as before.
  Far limbs are boxes with open ends (about 150 triangles a figure).
  The near head is 8x6 (was 9x7). Skirt and cap have 8 sides.
  The near shadow skips the small parts (hands, shoes, nose, phone, strap, brim, bun, hips). A draw range does this.
- **Lamps.** 66 triangles a pole (was 88): no hidden caps, 7 sides.
- **Building detail.** Draw distance 74 m on desktop and 62 m on the phone (was 95 m and 75 m).
- **Street props.** Range 66 m on desktop and 55 m on the phone (was 80 m and 60 m). Shadows only within 45 m.
- **Skyline.** The blocks have no bottom face now. They stay, in one draw.
- **Draw calls.** The 4 rotors are one mesh. The vertex shader turns each blade (no shadow).
  The 4 blur discs are one mesh in one pass. The red, green and white nav lights share one material.
  The duct lips and motor caps cast no shadow. The parcel is one mesh with vertex colours (was 6 meshes, 7 draws).
  Car wheels cast no shadow. They are inside the shadow of the body.
  The drone was 34 draws. Now it is 19.

**Blind A/B, round 32 against round 33.** `ab33.py` picks sides with SystemRandom and shuffles the order.
It wrote the key to `builder-shots/ab/.key.json` before any judging.
I wrote `ab/picks.txt` before I opened the key. Each side of a pair is 640 px wide.

- Street set (art27): golden street, shopfront and people, morning street and shopfront, phone golden street.
  **6 ties, 0 losses. Pass.** I saw no difference in any pair.
- Water set (golden and dusk g-low and 14 m glint, noon cruise, golden marina): **2 wins, 2 ties, 2 losses.**
  That is 4 of 6. **It fails the 5-of-6 bar.** I picked round 32 for dusk g-low and dusk glint.
  After I opened the key, I compared these two at full size. This check is not blind, so it does not count.
  At full size, round 33 has the crisper ripples and glitter in both.
  At half size, the larger, smoother shapes of round 32 looked more defined.
  The critic must judge these again at full size.

## 3. Leftovers

**(A) Hazy close water at a low sun.** Two changes in `Water.ts`:

- A fine near layer: ripples about 2 m across, from a third detail-texture sample.
  It shows only near the camera, where one pixel covers less than a few cm.
- The calm-with-height blend now goes from 6 m to 20 m of camera height (was 4 m to 15 m).
  The 14 m glint views keep their glitter. The game camera at cruise (29 m) does not change.

`contrast31.py`:

| Mood | Cruise | Low | Ratio |
|---|---|---|---|
| Golden 130 | 18.2 | 35.1 | 0.52 |
| Morning 22 | 16.6 | 30.1 | 0.55 |
| Dusk 33 | 16.7 | 40.6 | 0.41 |
| Noon 58 | 16.8 | 31.2 | 0.54 |

All marks pass: ratio at most 0.6, low at least 25, cruise at least 15.
Open issue: the soft radial streaks at the bottom of the golden g-low frame are still there.
They are not the city's shadows: half the shadow on the water changed nothing, and I removed that change.
I did not find the cause in the time box. The near layer puts crisp ripples on top of them.

**(B) Sailboat hull kick: not fixed.** I added a cap on the boat's push.
After the push, the drone moves no faster than the boat speed plus 2 m/s, or its own speed before the hit.
I measured no change from the cap, because the 6.5 to 8.6 m/s does not come from the boat.
The inner sailboat lane is about 195 m from the centre. That is 3 m past the soft city bound (192 m).
The boat pushes the parked drone 6 to 12 m further out. Then the bound's spring (`over * 6` m/s²) throws it back.
I tried a cap on the spring's return speed (4 m/s and 5.5 m/s). The speed went down to 5.2 to 6.6 m/s.
But in 2 ram runs the drone then slid over a low hull for more than 2 s (the probe's "stuck"). I removed that change.
A slower slide off the bow (2x, not 5x) made the bus push the drone for longer. I removed that change too.
Next step: move the inner sailboat lane inside the bound (d about 26). Then run boats31 again for lane overlap.

**(C) Low bus hit hops over the cabin: fixed.** The rule "boats are never a ledge hop" missed one case.
That case is the belly on the hull's top edge (contact normal 0.35 to 0.7 up). The rule now applies there too.
A hull taller than a step is a wall.
`boats32.mjs`: 16 of 16 bus ram hits charged exactly one Crash, and 0 hops.
Round 32: 15 of 16, with one hop to 4.3 m.

**(D) Bus wake toward a golden-hour sun: better, but not 1.3 in all views.**

- A large hull now makes more foam than its speed gives, and its trail lasts longer.
- In the glitter path of a low sun, a wake's foam trail gets a minimum brightness.
  The minimum follows how directly the view looks down the glitter path. It stays under the bloom threshold.
  A stronger first version glowed like a laser beam. I removed it.

`water31b.mjs`, golden-hour views toward the sun (trail brightness over open water):

| Boat | Round 32 | Round 33 |
|---|---|---|
| Bus | 1.79 / 0.93 / 0.67 | **2.15 / 1.49 / 1.07** |
| Rib | 0.96 / 1.28 / 1.66 | 1.15 / 2.17 / 2.72 |
| Sail | 0.69 / 0.82 / 1.31 | 1.11 / 1.60 / 1.71 |

The last bus view stays under 1.3. There the open water ahead of the bow is 190 to 200 of 255.
For 1.3, the trail needs to be brighter than white.
All dusk views were 2.4 or more, but I measured them with the stronger first version.
I did not measure dusk again after the change. Shot: `wake32-130-sunward-ferry.jpg`.

## Regressions (all on the final code)

| Check | Result |
|---|---|
| Flat frames, bloom on (`acceptance-probe.mjs`) | 938 frames, 0 flat, 0 errors: pass |
| Crash-classify 12 m, seeds 22, 58, 130 | 21 crashes, 0 hop-like, **0 pad lips** |
| Crash-classify 20 m | 12 crashes, 0 hop-like, **0 pad lips** |
| boats32 (4 seeds, 156 approaches) | 0 frames inside a hull, 0 near a mast, 0 stuck, 0 drop: pass |
| boats31 (22, 58, 9001) | 0 hull overlaps, 0 hulls on a dock, moving hulls 17.4 m from the wall: pass |
| cam-clip30 (22, no orbit), cam-clip24 (22, 58) | 0 hidden, 0 in solid, 0 pops over 1 m: pass |
| climb30, desktop and phone | 0 jumps over 1.8 m (max 0.90 m), 0 frames in solid: pass |
| People probe | 0 people on active pads (48 legs): pass |
| Traffic overlap | 0 pair frames on 22, 58, 130: pass |
| Phone HUD probe (22, 58, 130) | marker on controls 0, drone under pills 0, pops on the drone 0%, 0% and 0.44% (one medal-pop sample on 130) |
| Medal gate, street (22, 58, 130) | Silver, Silver, Silver. Breakdown exact on all 3. Scores 4,259 / 3,054 / 5,890 |
| No-delivery farm | 0 points on 22, 58, 130: pass |
| Production build | `npm run build` is clean. 2.78 MB without source maps (7.3 MB with): pass |
| Street frame time (contaminated) | p95 9.4 to 9.6 ms, desktop and phone, 0 frames over 20 ms |

Medal note: round 32 scored 5,892 / 3,745 / 5,836. These runs are real time on a loaded machine.
On seed 22 the bot made 3 drops, not 4.

Not run this round: cam-clip24 on the phone, the desktop HUD pops probe, the lazy medal runs, capfarm, boats31 at 400 s.
Note: cam-clip30 saved two `-hidden` shots while it lined up. These are outside the measured passes. The passes report occ 0.

I kept the bloom clamps in `ObjectiveMarker.ts` (not touched) and every debug hook that the bots use.
`triBreakdown` now also gives the draws per mesh.
New hook `shadowSlab(on?)`: it gives the slab stats and turns the slab on or off for comparisons.

## Files changed

- `src/world/Boats.ts`: bus arrival fix. Boat and dock shadows only within range.
- `src/world/shadowSubset.ts` (new): `shadowSubset`, `shadowSlab` with its check hook, shadow radii.
- `src/world/Environment.ts`: lamp geometry and sort, canopy shadow subset, open trunks, pines, skyline, prop range.
- `src/world/StreetProps.ts`: props nearest first, shadows within 45 m.
- `src/world/Pedestrians.ts`: LOD at 24 m, far shadows to 40 m, near shadow draw range.
- `src/world/StreetKit.ts`: lighter people figures, small parts last.
- `src/world/Traffic.ts`: wheels cast no shadow.
- `src/world/CityGenerator.ts`: promenade edge in 40 m pieces.
- `src/world/Water.ts`: near ripple layer, calm-with-height range, bus wake foam and glitter-path trail minimum.
- `src/entities/Drone.ts`: merged rotors, discs, nav lights and parcel. Fewer shadow casters.
  Boat edge hits are walls. Boat push cap.
- `src/game/Game.ts`: detail distance, city shadow slab, debug hooks.
- `src/vite-env.d.ts`: type for the new hook.

## Screenshots (`builder-shots/`, 58 JPEGs)

- `ab/street-01..06.jpg`, `ab/water-01..06.jpg`, `ab/picks.txt`, `ab/.key.json`.
- `water33-r32-*` and `water33-r33-*`: golden and dusk g-low and glint, round 32 against round 33.
- `wake32-130-sunward-*`, `bus32-130-*` (the bus at its pier, then under way again), `tris33-*-worst.jpg`.
- Camera, crash and HUD probe shots: `cam-clip*`, `N-*`, `M-*`, `raw/fr33-*`.
