# Drone Dash: round 22 builder report (street life)

Concern: the owner said "the cars in the street are looking basic. also add some people walking." This round replaces every vehicle with procedural low-poly vehicles. They drive like traffic. It also adds people on the sidewalks and in the parks.

My own dev server ran on port 5190 and is now stopped. The owner's server on 5188 was not touched. Every browser ran alone, one at a time. No assets were generated or downloaded.

## What was there before

- `Environment.createCars`: 44 identical boxy cars (one InstancedMesh), random colours, each on a straight road line at a fixed speed, wrapping from edge to edge. They drove through each other at every junction (visible in `before-d-s22-normal-street.jpg`: a pink car inside a white one) and never stopped or turned.
- Round 18 hover-vans: 18 boxes plus a separate glow-pad mesh, at 3.1 m on the two rush lanes. Same-lane vans overtook through each other, and the two lanes' vans crossed through each other at their shared junction.
- No people.

## Part 1: vehicles

**Models** (`src/world/StreetKit.ts`). Side profiles extruded across the width give real silhouettes, not stacked boxes. Every type has a narrower glass house, body-colour roof and pillars, dark bumpers and sills, a chrome grille strip, wheels, and head and tail lamps.
- Compact hatchback (3.8 m) and sedan (4.5 m, three-box).
- Taxi: the sedan in taxi yellow, with a lit roof sign and a dark check band.
- Delivery van (5 m): tall, sloped nose, orange depot stripe like the Dash Depot.
- Box truck (6.3 m): cream cargo box with the orange band, six wheels.
- Hover-van (rush hour) is redesigned as a rounded pod with a wrap-around windscreen, an orange belly band and four glowing cyan hover pads on struts. It keeps its 3.1 m height and lanes.
- Mix: 30% compact, 25% sedan, 15% taxi, 17% van, 13% truck.
- Paint comes from a palette per light mood, taken from the city's own walls and awnings: warmer at golden hour, deeper at rose dusk, lighter at bright morning and hazy noon. Vans are mostly cream white.
- Glass is glossy and slightly metallic, so it reflects the baked sky environment. Head and tail lamps are emissive, scaled by mood: weak in daylight, strong at rose dusk (they bloom on desktop). If a car brakes or stands, its tail lamps get brighter. **There is no night mood in the game** (the four moods are golden hour, bright morning, rose dusk, hazy noon). I used rose dusk (seed 4) as the "night" case and did not add a mood.

**One draw call for all vehicles.** All six body types sit in one merged geometry (about 5,000 vertices). Each instance has a type, and the vertex shader collapses every vertex that is not its type to a point. A matching depth material does the same for the shadow pass. Lamp glow, glass and paint are per-vertex roles in that same material. So cars, taxis, vans, trucks and hover-vans together are 1 draw plus 1 shadow draw. Before, that was 5 (cars, vans, van glow, and two shadows).

**Driving** (`src/world/Traffic.ts`):
- Right-hand lanes 2.9 m off the centre line. I moved the painted stop lines to match. They were on the other side before, and the old cars ignored them.
- At each junction a car goes straight or turns right on a quarter arc (3.1 m radius). It turns left (8.9 m arc) only where nothing can come the other way (edge and corner junctions). It slows to 4.6 m/s (right) or 6.4 m/s (left) before the arc.
- Every junction has a two-phase signal (18 s cycle, offset per junction) with all-red gaps.
- Three checks come before a car enters a junction. Its axis must have green. No car from the other axis can still be in the box. Its whole length must fit past the exit. If a check fails, the car brakes to the stop line. Thus paths never cross.
- Each car keeps a gap to the car ahead (and to the tail of a car turning out of its lane). It accelerates at 2.6 m/s² and brakes at up to 7 m/s².
- Cars never leave the road grid, so they never touch buildings, alleys or tunnels.
- Rush hour: 40 cars normally, 62 at rush hour (34 / 52 on touch devices). Cars are added and removed only more than 70 m from the camera. The 18 hover-vans run on top.
- Hover-vans keep a gap to the van ahead. At the one point where the two rush lanes cross, they take turns: a van that must wait hovers before the crossing. If the van before it is not yet 9 m into the lane, a van waits.
- Truck height is 2.1 m and the hover-van pads' lowest point is 2.2 m, so ground traffic under a rush lane never touches a van.
- Unchanged: vehicles are still not colliders and crash rules are untouched. `vanDraft` (the round 19 slipstream rule) is the same code, moved into `Traffic`.

## Part 2: people

`src/world/Pedestrians.ts`:
- **Figures**: legs, shoes, hips, a tapered torso, arms with hands, neck, head and hair. That is about 330 vertices. Per person: shirt and trousers from palettes, 4 skin tones, 4 hair colours, height 0.92 to 1.08, and 7% children.
- **Walk cycle**: in the vertex shader. Legs and arms swing about the hip and shoulder, with a small bob and rotated normals. The phase follows distance walked, so feet match speed.
- **Where they walk**: two loops round every block's sidewalk, 1.75 m and 2.35 m in from the curb, one each way, so people keep right. Walkers keep a gap and queue behind someone who stops. Nobody walks through anybody on the same loop. There are 9 to 26 walkers a block: more downtown, and +6 next to parks. In parks, walkers go out and back along the four paths to the fountain. At build time, each loop is checked against all colliders, trees and lamp posts. If a loop touches one, it is dropped. On the seeds tried, 0 were dropped.
- **Standing**: at a corner, 30% of walkers stop for 1.5 to 5.5 s. They face the road, like people who wait to cross. The queue builds behind them. Some people stand beside shop doorsteps near the facade, facing out or toward the door. Others stand round the fountain. About 810 to 850 people per city in total.
- **Reaction**: the trigger is a drone pass within 6 m, below 7.5 m, at more than 8 m/s. The person stops, ducks and throws the arms up over the head. The head tips back to look up. The person steps up to 0.55 m away from the drone and stays on the sidewalk. It lasts 1.4 s, then a 2.5 s cooldown.
- **Pads**: walkers inside the live pickup or drop pad (+0.6 m) jog off it at 2.6 m/s and never pause there. Walkers about to step onto it turn round onto the other loop. Nobody is ever placed to stand on any pad.
- **Never in the way**: people are not colliders and are not in the crash logic.
- **Cost**: people are drawn and updated only within 105 m of the camera (82 m on touch). They fade out over the last 10 m. About 300 to 375 are drawn, in 1 draw call plus 1 shadow draw.

## Acceptance

| Test | Result | Pass |
|---|---|---|
| Body types in shots | 5 ground types plus the hover-van (`after-d-s22-rush-street.jpg`, `after-m-s4-rush-junction.jpg`). The traffic probe saw all 6 types on seeds 22, 58 and 130 | Yes |
| Lamps at the dark mood | Rose dusk (seed 4): headlights and tail lamps glow (`after-d-s4-*`, `after-m-s4-*`). No true night mood exists | Yes (dusk) |
| People visible in a busy street view (cone, within 104 m, with a clear sight line past buildings, counted per shot) | Street views: desktop 37 to 43, mobile 39 to 51. Junction views 38 to 51. Side street 24 to 30, cruise 24 to 29 | Yes |
| 60 s traffic probe, seeds 22 / 58 / 130 (30 s normal, then 30 s rush), every 0.1 s (`traffic-probe.mjs`) | 101,635 vehicle samples (13,693 of them hover-vans): **0 overlaps** (3D, oriented boxes), **0 off lane** (max 0.0000 m from lane or arc), **0 off road**, **0 in buildings**. 40 cars normally, 62 at rush plus 18 vans. 25 to 29% of car samples were stopped at lights or in queues | Yes |
| People placement (`ped-probe.mjs`) | 49,820 samples over 3 seeds: **0 inside a solid, 0 on the road** | Yes |
| People on the active pad | 30 ground-pad pickups and drops (doorstep, park, depot) over 3 seeds, checked every 0.05 s for the last 2.5 s and at the arrival frame: **0 people on the pad**. People were within 4 m of the rim on most legs (up to 6) | Yes |
| Reaction | A low pass at 3 m along a curb set off 21 / 9 / 9 reactions (up to 8 at once). The same pass at 30 m set off 0. Shots: `react-s22.jpg`, `react-s58.jpg`, `react-s130.jpg` | Yes |

## Performance (`street-shots.mjs`, 20 s real-time flight: 12 s along streets at 4 m, 8 s at 30 m, seed 22)

| Run | Desktop p95 / median / max (ms) | iPhone 13 (sideways) p95 / median / max | Draw calls desktop | Draw calls mobile |
|---|---|---|---|---|
| Before (round 21 code) | 9.9 / 8.3 / 10.4 | 9.7 / 8.3 / 10.2 | 77 to 85 | 61 to 69 |
| After, street life off (`PARTS=none`) | 9.5 / 8.3 / 10.4 | 9.6 / 8.3 / 10.4 | 72 to 80 | 56 to 64 |
| After, traffic only | 9.5 / 8.3 / 10.4 | 9.8 / 8.3 / 10.4 | 74 to 82 | 58 to 66 |
| After, traffic plus people | 9.6 / 8.3 / 10.4 | 9.5 / 8.3 / 10.4 | 76 to 84 | 60 to 68 |
| After, seed 4 (rose dusk, rush shots first) | 9.6 / 8.3 / 10.4 | 9.6 / 8.3 / 10.4 | 73 to 83 | 57 to 67 |

- Headless Chromium caps at 120 Hz, so the median sits at 8.3 ms. Frame time is the same as before within noise, and every run is well under 12 ms.
- CPU cost measured in the game (smoothed): traffic update 0.02 to 0.04 ms a frame, people update 0.10 to 0.19 ms.
- Draw calls: traffic +2, people +2. That is 1 fewer than before overall, because the old cars and vans used 5.
- Triangles went from about 260k to about 490k to 510k, mostly the collapsed vehicle types (degenerate, so no pixels) and the people. GPU time did not move.
- `npm run build` passes. JS is 812 KB (226 KB gzipped), +27 KB. No new assets, so first load is unchanged apart from that.

## Regressions

Round 21 scripts with only the port changed (`regress22.sh`), plus the round 19 van probe and the round 21 orbit test.

| Check | Round 21 | Round 22 | Pass |
|---|---|---|---|
| Hand-fly first payout, desktop | 5.7 s | 6.7 s | Yes (under 10 s) |
| Hand-fly first payout, mobile | 6.4 s | 5.5 s | Yes |
| Flat-frame probe | 1,012 frames, 0 flat | 956 frames, 0 flat, 0 errors | Yes |
| Crash-classify 12 m, seeds 22 / 58 / 130 | 7 / 7 / 8 | 11 / 6 / 7 (24 in 218 s). 4 near the target, 0 hop-like: **0 pad lips** | Yes |
| Low bot 22 / 58 / 130 | 5,148 / 2,795 / 3,821 = 11,764 | 3,945 / 2,753 / 3,780 = 10,478, all Silver | Yes. Seed 22 made 4 drops, not 5. Round 20 had 3,867 there |
| High bot 22 / 58 / 130 | 2,418 / 1,734 / 2,760 = 6,912 | 2,835 / 363 / 1,626 = 4,824 | See below |
| High bot seed 58, rerun alone | | 2,221 (5 drops, 2 crashes). With it, the total is 6,682 | Yes |
| perf18 desktop / iPhone | p95 9.2 / 9.9 | p95 9.4 / 9.3, max 16.6, 0 over 20 ms | Yes |
| Hand-fly 80 s frame time | p95 9.7 / 9.5 | Desktop p95 9.8, max 16.5. Mobile p95 9.9, max 16.7, 0 over 20 ms | Yes |
| Van slipstream (`van-probe.mjs`, seed 22) | | Behind a live van, the draft was on for 62, 62 and 77 frames, and 224 points were banked. Before rush hour it was 0 | Yes |
| Camera orbit (`orbit-desktop.mjs`) | | Right-drag held at -63 degrees. Back behind after 1.33 s. Pitch 3.4 to 68.8. Left click boosts. Wheel zoom 4.1 to 10.0 m | Yes |
| Console errors (`console-check.mjs`) | | 0 | Yes |

The high bot runs in real time. In the first run on seed 58 it stalled for most of the run (0 crashes, 1 drop, 76 s). A rerun of that seed alone scored 2,221, higher than round 21. Vehicles and people are not colliders and do not touch flight or scoring, so I read it as noise. The critic can rerun it to check.

## Files changed

- New `src/world/StreetKit.ts`: the vehicle and people geometry, their shader-patched materials, the palettes and the lamp strength per mood.
- New `src/world/Traffic.ts`: lanes, junction signals and occupancy, turns, following and the rush-hour count. Also the hover-vans (following, crossing turns, entry spacing), `vanDraft` and `vanPositions` (same rule as round 19), and the test snapshot and stats.
- New `src/world/Pedestrians.ts`: loops, walkers, standers, corner pauses, pad avoidance, reactions, near-camera drawing, and test snapshot.
- `src/world/Environment.ts`: the old cars and van meshes removed (their random draws are kept, so the skyline is unchanged). Traffic and people added. `setFocus`, `setStreetLife` and `streetMs`. Stop lines moved to the right-hand lanes.
- `src/game/Game.ts`: passes the mood and touch flag to Environment, the camera, drone and live pad each frame. New hooks `rush(on)`, `streetLife(traffic, people)`, `traffic()`, `people()`, and the diagnostics block `street`. Every existing hook is unchanged.
- `src/vite-env.d.ts`: types for the above.
- `src/entities/ObjectiveMarker.ts` was not touched, so the bloom clamps are unchanged.

Scripts in `builder-scripts/`, with their logs:
- `street-shots.mjs`, `traffic-probe.mjs`, `ped-probe.mjs`: the new tests.
- `console-check.mjs`: 0 console errors.
- `van-probe.mjs`: a copy of the round 19 probe.
- `accept22.sh`: the whole queue. `regress22.sh`: a copy of round 21's.

## Open points for the critic

- There is no night mood, so "lights at night" is shown at rose dusk. A new night mood changes the mood of existing seeds, so I left it alone.
- No visible traffic-light heads: cars stop at the stop lines on an invisible signal.
- People wait at corners but never cross the street.
- Wheels do not spin.
- The reaction is clear up close but small from the chase camera at speed.
