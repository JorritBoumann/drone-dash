# Drone Dash: round 27 builder notes

Concern: visual detail of buildings and people (owner: "still very basic, add more detail to make it more realistic").
Everything is procedural in code. No downloaded or generated assets.

## How I tested
- I served a production build of the working tree with `vite preview` on 127.0.0.1:5190 (`builder-scripts/rebuild27.sh`).
- For before/after comparisons I built the round 26 code (the working tree without my changes) and served it on 5191.
- The owner's server on 5188 was not touched. Both of my servers are stopped.
- One browser at a time, from one queue (`queue27.sh`, `jobs27.txt`, log `queue27.log`). The final build was locked before the queue started.
- New scripts:
  - `shots27.mjs`: fixed camera poses (street, second street, junction, facade, mid 10 m, cruise 24 m, high 45 m, park, shop door). It also logs calls, triangles and archetypes in view.
  - `perf27.mjs`: frame cost with vsync off, so costs under the 8.3 ms cap show. It toggles the detail kit and people on and off.
  - `firstframe27.mjs`: load time, the title frame, `start()` time and the first-flight hitch, with a cold browser.
  - `layout-check27.mjs`: every solid collider, every site and the pad audit, new against baseline.
  - `detail-audit27.mjs`: detail geometry inside pad landing columns, alley or tunnel corridors, or over roads.
  - `diag27.mjs` and `console27.mjs`: small helpers.
- I copied the rest from round 26 (and `pad-people23.mjs` from round 25, set to port 5190).

## Design

### Buildings
**1. Six archetypes, picked per lot.** Code: `archetypeOf` in `CityGenerator.ts`.
- The pick uses the window style, the height and a hash of the lot position. The hash draws nothing from the city's random stream, so the layout is unchanged (checked below).
- The archetypes:
  - brick walk-up
  - painted-plaster townhouse
  - precast-concrete apartments
  - stone classic
  - office (metal and glass)
  - glass tower
- The wall material is packed into the existing seed attribute (seed + 256 × material). No new vertex attribute.

**2. Facade shader.** Code: `CityMaterial.ts`, one material for the whole city, as before.
- Brick: running bond, a tone per brick and mortar joints. The joints fade out where a brick gets smaller than a pixel. There are three brick colours plus painted brick.
- Concrete: a panel per bay and storey, with joints and a tone per panel.
- Stone: courses with staggered joints. The ground floor is rusticated (deeper joints).
- Plaster: soft mottling.
- Office: metal spandrels with seams.
- Wear on every material: vertical weathering, grime and splash-back near the ground, rain streaks under the sills, and a ledge line at each storey.
- Windows look set into the wall:
  - a frame, a sill and a lintel (brick and stone)
  - shadow along the top and one side of each opening (the reveal)
  - a glazing-bar cross
- Behind the glass there is an interior: a dark floor, a back wall and a lighter ceiling. Homes have curtains in three widths and colours. Offices have blinds lowered to random heights.
- Painted townhouses get shutters with slats.
- Lit windows get brighter toward the ceiling and dimmer behind curtains.
- How many windows are lit now follows the light mood: golden hour 22%, morning 7%, rose dusk 36%, noon 5%. Before, it was 16% in every mood.
- Ground-floor shop fronts on every street-facing building with punched, ribbon or tall windows:
  - a coloured fascia sign with blocky letters (the letters glow a little at dusk)
  - big windows with a centre bar, a door in some bays, and a dark kick plate
  - inside: shelves of coloured goods, lit in some shops
- About 20% of ground-floor bays are a home entrance instead of a shop: a panelled door with a lit transom window.
- Glass towers have a lit lobby.
- The relief (mortar, joints, reveals, sills, sign boards) is a bump in the shader: the normal is bent using screen-space derivatives. No textures. All pattern detail and bump fade out with distance (`far`), so nothing shimmers far away.
- Flat roofs get membrane seams and patches.

**3. Detail kit.** Code: new `BuildingDetail.ts`. Real geometry, merged, using the city material (no new shader).
- On street faces only:
  - window sills
  - apartment balconies: slab, solid front and a rail (0.6 m deep)
  - Juliet balconies with iron rails, and flower planters, on townhouses
  - fire escapes on walk-ups (platforms, rails, stair flights and a drop ladder), up to 0.58 m deep
  - window AC units
  - drain pipes
  - corner quoins on stone buildings
  - vertical fins on offices and glass towers
  - blade signs over shops: a board with a glowing edge and a bracket
- Rooftops: vents, exhaust stacks, skylights, satellite dishes, antennas with cross bars, and a rail on rooftop-pad roofs. They stay off the existing roof colliders and at least 5.2 m from rooftop pads.
- Park benches beside the four park paths, clear of the park pad, trees and lamps.
- Awnings are now sloped, striped canvas with a valance (new `Style.awning`). They are drawn inside the same box as before, so the pad audit is unchanged.
- **Collision:** nothing new collides. The collider list is identical. Every added part is within 0.62 m of its face (the drone's radius is 0.95 m) or small.
- **Kept clear:**
  - In blocks with an alley or tunnel, only flush parts are added: sills, pipes, quoins and fins.
  - In the column above a doorstep pad (2.9 m along the face), only sills.
  - No fire escape over a doorstep, and no blade sign within 3.8 m of one.
  - Corner fins are clamped onto their face. One stuck 7 cm into an alley on seed 317. The audit found it, and it is fixed.
- **Distance detail:** the kit is a 4 × 4 grid of merged chunks. A chunk draws only while the camera is within 95 m of it (75 m on touch devices). Above 30 m, that range grows by 0.5 m for every metre of height. Only chunks within 30 m cast shadows. That keeps the draw-call rise small.

### People
Code: `StreetKit.ts` and `Pedestrians.ts`.
- **New figure:** separate thighs and shins, upper arms and forearms, hands, shoes, a neck and a nose. The shoulders are wider than the waist. The head is a smoother sphere (detail 1). The hair is a cap over the back and top of the head, so the face shows.
- **Smoother walk:** knees bend in the swing phase, elbows bend with the arm swing, and the upper body sways a little with each step.
- **Outfits** (per person, from their own random stream, so placement is unchanged): shirt and trousers, T-shirt and shorts (bare lower legs and forearms), dress (skirt, bare legs), jacket, long coat.
- **Hair:** short cap, long hair, a bun, or cropped, in four hair colours.
- **Accessories:** caps with a brim (18%), shoulder bags with a strap (20%), backpacks.
- Hats and bags take a second and third accent colour, so nobody is one colour head to toe. Some people wear white sneakers.
- **Poses:**
  - Phone: walking or standing, the forearm is raised with a phone and the head tilted down. 10% of walkers walk 15% slower with a phone. About half of the people standing alone at a shop door read a phone.
  - Talking pairs: two people at a shop door stand together, turned toward each other, and gesture.
  - Sitting: people sit on the new park benches (one or two per bench).
- A sitting person reacts to a low pass with the arms and head only (the legs stay seated), and does not side-step.
- Kept from round 22 and 23:
  - instancing (a near mesh and a far mesh, one draw call each) and thinning with distance
  - the paths, the pad rules and the reaction to low passes
- The far figure is now its own smaller geometry (about 110 triangles). Far people (40 m and more) no longer cast shadows.

## Numbers

### Collision and layout (`layout-check.log`, `detail-audit.log`)
- Solid colliders, sites and the pad audit on seeds 22, 58, 130, 4 and 317 match the baseline exactly (same hash). Pad audit issues: 0. **Layout unchanged.**
- Detail audit on the same 5 seeds:
  - vertices in pad landing columns (1.2 m radius, up to 40 m above the pad): 0
  - vertices in alley or tunnel corridors below 12 m: 0
  - vertices over roads: 0

### Crash-classify, seeds 22, 58, 130 (`ccv12.log`, `ccv20.log`)
- 12 m: 19 crashes in 220 s, **5.2 a minute** (round 26: 6.3).
- 20 m: 18 crashes in 267 s, **4.0 a minute** (round 26: 4.3).
- Pad lips: **0.** No crash within 8 m of the target.
- **Pass:** both rates are below round 26.

### Camera tunnel and 2 m tests
- `cam-clip24` (seed 22, orbit): **10 of 10 PASS**. In solid 0, under 0, occluded 0.
- Phone HUD probe with the camera log (iPhone 22, `hud-m-22.log`): frames within 2 m: **0**. Closest: 4.06 m.

### People (`street-probe.log`, `pad-people.log`)
- On 4 seeds, normal and rush hour:
  - people inside solids: 0
  - people hit by cars: 0
  - people on the live pad: 0
  - share of people on roads: 0 (about 100,000 samples a seed)
- `pad-people23`, 4 seeds, 48 legs: on the pad 0 (by the game's count and by mine).
- People per city: about 840 to 875 (sitters added). People drawn at street level: 290 to 300 on desktop, about 190 on iPhone.

### Other regressions
- Traffic probe: 0 overlaps, 0 cars in solids, 0 off lane.
- Flat-frame probe: 931 frames, **0 flat**, 0 errors.
- Phone HUD (iPhone 22):
  - marker on the "Fly" label 0, pops over the controls 0, gate tag on "Fly" 0
  - p95 9.3 ms (round 26: 9.6)
- `npm run build`: **pass** (the type check is clean).
- First-load files: index.html 11.2 KB, CSS 39.7 KB, JS 865.8 KB. Total **0.92 MB** (was 0.88 MB). Gzip transfer at load: 256 KB (was 244 KB).
- Bloom clamps in `ObjectiveMarker.ts` are untouched. The bot hooks are untouched. New hooks: `detailOn`, `detailAudit`, `archetypesInView`, and a `detail` block in diagnostics.

### Medals and gates, seeds 22, 58, 130 (`m-low-a.log`, `m-high-a.log`, `m-lazy-a.log`, `m-high-rep22.log`)
| Run | 22 | 58 | 130 | Total |
|---|---|---|---|---|
| Street (low) | 4,531 Silver, 3 drops | 3,959 Silver, 3 | 5,551 Silver, 3 | 14,041 |
| Strict delivery share | 65% | 69% | 59% | 63.8% |
| Roof (high) | **856 none, 1 drop** | 3,917 Silver, 4 | 3,652 Silver, 4 | 8,425 |
| Lazy | 1,195 Bronze, 2 | 1,202 Bronze, 2 | 1,013 Bronze, 2 | 3,410 |

- The breakdown is exact (bot sum = game-over card = score) on every run: **pass**.
- Strict delivery share at least 55%: **pass**.
- Street over roof: 1.67 (line 0.85): **pass**.
- No Ace: **pass**.
- Lazy runs are Bronze or below, as in round 26 (1,224 / 1,169 / 1,009).
- **Roof bot on seed 22:** it crashed at 25 s and then made no progress until the clock ran out. The colliders are identical to round 26, and this real-time bot is noisy. Two reruns of seed 22: 1,892 Bronze (3 drops) and 5,194 Silver (5 drops). Round 26 had 4,939.

### Performance
Street route (`perf-street.mjs`, 60 Hz-cap logic, 120 Hz display):

| | p95 desktop normal / rush | p95 iPhone 13 normal / rush | Draw calls (median) desktop / iPhone | Triangles max desktop / iPhone |
|---|---|---|---|---|
| Before | 8.8 / 8.6 ms | 8.7 / 8.9 ms | 95–101 / 79–81 | 334k / 304k |
| After | **9.2 / 9.2 ms** | **9.2 / 9.3 ms** | 104–106 / 86–89 | 423k / 388k |

- p95 is under 12 ms: **pass**. Frames over 20 ms: 0.
- Draw calls rise by about 9 (max 107 to 111 desktop and 89 to 92 iPhone, was 97 to 102 and 81 to 86): **pass** (limit about 15).
- In the fixed-pose shots, calls are 91–109 desktop (before 84–98).

Cost of each part with the frame cap off (`perf27-*.log`, median frame ms, 10 s a case):

| Case | Desktop new | Desktop base | iPhone new | iPhone base |
|---|---|---|---|---|
| Everything | 3.7–4.0 | 3.3–3.5 | 2.4–2.6 | 2.2 |
| No detail kit | 3.6 | n/a | 2.3 | n/a |
| No people | 3.5 | 3.3 | 2.3 | 2.3 |
| No detail, no people | 3.5 | 3.2 | 2.3 | 2.3 |

- Estimates:
  - facade shader: about +0.3 ms desktop, about 0 on iPhone emulation
  - detail kit: +0.1 to 0.3 ms
  - new people: +0.1 to 0.3 ms
  - total: about +0.5 ms desktop, +0.3 ms iPhone
- Triangles at street level, desktop:
  - detail kit: about +45k on screen (+122k for the whole city, but chunks are culled by distance)
  - people: about +50k
- The emulated iPhone runs on the desktop GPU. A real phone can pay more for the extra triangles (about 380k, above the 300k mobile starting budget in the graphics skill). If a real phone struggles, the first lever is a smaller `near` for touch in `Game.ts`.

First frame and first flight (`firstframe.log`, cold browser):

| | Longest title frame (load) | `start()` | First flight frame | Frames over 33 ms after it |
|---|---|---|---|---|
| Desktop, new / base | 633 / 542 ms | 227 / 230 ms | 242 / 250 ms | 0 / 0 |
| iPhone, new / base | 608 / 517 ms | 227 / 236 ms | 249 / 258 ms | 0 / 0 |

- The load frame is about 90 ms longer: building the detail kit and compiling the larger city shader.
- **No new hitch on the first flight.** The 240 to 250 ms frame at start is `start()` itself. It takes about 230 ms, the same as in round 26 (the delivery reset). It is not shader compiling. I tried `renderer.compile()` at load: it did not change that frame, so I took it out. A pre-existing item for a later round.

### Acceptance shots (`builder-shots/`)
- `before-*` and `after-*`, `d` (desktop 1280 × 720) and `m` (iPhone 13, held sideways).
- Seeds:
  - 130 golden hour
  - 4 rose dusk
  - 22 bright morning
- Same poses before and after: street, street-b, junction, facade, mid (10 m), cruise (24 m), high (45 m), park, door.
- 4 or more archetypes in one street view (from `archetypesInView`, buildings in view within 70 m, occlusion not tested):
  - 130 junction: glass, walk-up, apartments, townhouse
  - 4 junction: apartments, office, walk-up, townhouse
  - 22 door: walk-up, apartments, office, townhouse
  - 4 door: office, walk-up, townhouse, apartments
  - Also visible in the shots, for example `after-d-4-junction.jpg` and `after-d-22-junction.jpg`.
- Street-facing blocks show shop fronts. 3 to 13 shop-front buildings in view per pose.
- Good pairs to compare: `*-130-street`, `*-130-cruise`, `*-4-junction`, `*-130-facade`, `*-130-park`.

### Scorecard (affected categories only)
- **World / environment: 1.5 → 2.**
  - Before: flat boxes with a window grid.
  - After: layered facades (shop fronts, balconies, fire escapes, signs, rooftop clutter), 6 archetypes, seated and talking people.
- **Materials / textures: 1 → 2.**
  - Before: one window shader on flat colour.
  - After: brick, concrete, stone, plaster and metal, with joints, a bump, grime, streaks, interiors, curtains and lit shops.
- Other categories: not changed this round.

## Files changed
- `src/world/BuildingDetail.ts` (new): archetype types, `lotHash`, `benchSpots`, the detail kit, distance culling, the audit and archetypes-in-view hooks.
- `src/world/CityMaterial.ts`: wall materials, windows with reveals and interiors, shop fronts, bump, roof seams, awning canvas, uniforms exposed.
- `src/world/CityGenerator.ts`:
  - archetype and material per lot
  - building list for the kit (`layout.buildings`)
  - sloped striped awnings
  - tunnel bridge floors counted from 2, so the bridge does not get shop fronts
- `src/world/GeometryBuilder.ts`: `Style.awning`.
- `src/world/StreetKit.ts`: new pedestrian geometry (near and far) and material (joints, outfits, hair, accessories, poses).
- `src/world/Pedestrians.ts`: looks from their own stream, phone walkers, talking pairs, bench sitters, the `iextra` instance attribute, no shadows from far people.
- `src/game/Game.ts`: detail kit, lit windows by mood, hooks and diagnostics.
- `src/vite-env.d.ts`: types for the new hooks and diagnostics.

## Open points
- Rerun the roof bot on seed 22 a few times (one stuck run, 856).
- Test on a real phone: about 380k triangles at street level.
- Distant stone and concrete patterns can show slight moiré at mid distance before they fade out.
- The ~230 ms `start()` frame (pre-existing).
