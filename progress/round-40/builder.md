# Drone Dash: round 40 builder notes

Main concern: a minimap. Also the three Codex findings, a boost tail, and a lighter effect for hits that are not charged.

Summary:
- Minimap: round, heading-up, about 150 m round the drone. Desktop 160 px bottom-right, phone 110 px under the top-right chips. M toggles it in a run (remembered). Marker angle against the true bearing over 5 full runs: worst error 2.9 degrees, 0 samples at 5 degrees or more. 0 overlaps with phone controls, meters, pops or the objective pill. Cost: about 0.03 to 0.04 ms a frame on average, 0.4 ms worst draw in real time.
- Codex A, B, C fixed. During slow motion the run clock now runs at real time (0.2333 s of clock for 0.2333 s of real time, every hit).
- Boost tail: after a full boost with W held, 22 m/s or more for 2.25 s, 18 m/s after 3.57 s, peak slowdown 3.8 m/s^2. Faint streaks at cruise (0.18).
- Hits that are not charged now get a light effect: shake, sparks, a small knock under 22 degrees. No flip, no slow motion, no hit-stop. Every charged hit keeps the full effect.
- No regression found in the guard list. Two notes: see "Open points".

## Setup

- Build: the working tree on top of fe6d711 (round 39). Not committed (no git commands that change state).
- My servers: 5190 (dev) and 5195 (production preview of my own build in the scratchpad). The dev server had its own Vite cache in the scratchpad, with HMR and file watching off. I restarted it after each code change. I did not touch the owner's server on 5188. Both of mine are stopped.
- Every browser job ran alone from `builder-scripts/queue40.sh` (`jobs40.txt`, then `jobs40b.txt` for the reruns after the last code change). Logs: `queue40.log`, `queue40b.log`.
- Scripts copied from `round-39/critic-scripts` with the port changed to 5190. New: `mm40.mjs`, `mm40-init.js`, `mmshot40.mjs`, `mmcost40.mjs`, `orient40.mjs`, `toggle40.mjs`, `clock40.mjs`, `tail40.mjs`, `crash40.mjs`, `tune-init.js`. `hud-probe34.mjs` now also loads `mm40-init.js` (logs `MM40`) and takes `TUNE`. `pop34-init.js` also checks pops against `#minimap`.

## 1. Minimap (`src/ui/Minimap.ts`, new)

Design:
- `buildMinimapLayer(layout, SHORE, tunnels)` draws the static city ONCE per city into an offscreen canvas. It uses 1.6 px per metre (about 1,060 px square). It draws water, the island ground and block paving. Streets are the light colour. Parks are green, tunnel runs are a cool grey. Building footprints come from the collider list: every solid on the ground taller than 3 m and bigger than 9 m^2. Last comes the seawall line. The water margin round the island is 170 m, more than the map radius, so a view at the shore never samples outside the bitmap. A new city is a page load, so there is one canvas and one layer for the page's life.
- `drawMinimap(ctx, x, y, size, layer, frame)` draws into ANY 2D context at a given rect (for the canvas-drawn HUD next round). It clips a circle and draws the layer with one transform: translate, rotate by the drone yaw, scale, translate to the drone. Then it draws the markers with the same rotation, computed by hand:
  - a faint forward view cone,
  - the leg's suggested shortcut: an arch mark at the entrance (amber for an alley, blue for a tunnel) and a short dashed line with a chevron to the exit,
  - the objective: a diamond (amber pickup, teal drop, coral rush) inside the radius, an arrow on the rim outside it. One threshold for both. A marker near the distance pill moves inward along its own direction. So its angle stays exact.
  - the drone: an ink arrow with a cream edge at the centre, always pointing up,
  - a cream rim with a thin ink edge and an N badge on the rim at north. The badge is hidden in the sector of the distance pill.
  - a distance pill at the bottom of the rim in the objective's colour. It shows the same distance as the pad marker's pill (to the marker, in 3D). So the two always agree.
- `Minimap` (the DOM part): one `<canvas id="minimap">` inside `#hud` (so it shows only in play and pause, like the rest of the HUD). At most 30 redraws a second: Game asks `due(realDt)` before it gathers data. Game gathers the frame data only then. The CSS size and pixel ratio are read only after a resize, a toggle or a touch switch (one resize listener, removed in `dispose`). The backing store is CSS size times the pixel ratio (at most 2), and drawing uses `setTransform(dpr)` in CSS pixels.
- Placement (`src/styles.css`): desktop bottom-right, 160 px, 18 px from the edges (or the safe area). Touch: 110 px at the right edge, 50 px under the top of the safe area. That is just under the deliveries and pause chips, and above the climb, boost and dive buttons. On very short screens (under 300 px tall) 92 px. Own opaque background and a soft shadow, so it reads in every light mood.
- The objective marker keeps off it: on touch the minimap box joins the "top" HUD boxes that the marker and the gate tag avoid (`Hud.touchLayout`). On desktop the marker (diamond, pill and edge arrow) stays 64 px clear of the map box. The box is measured every 500 ms, not per frame.
- Keys: in a run M toggles the minimap, remembered in localStorage (`drone-dash-minimap-v1`, in try/catch). On the title, pause and game-over screens (where the music chip shows) M still toggles the music. N toggles the music anywhere. The title's key list now says "M map".
- Debug hook: `__GAME__.minimap` returns `{ visible, radius, draws, msMean, msMax, box, last }`. `last` holds data from the last draw: the marker angle (degrees clockwise from up), the rim flag, the shortcut flag, the yaw, and the drone and objective positions. Also `__GAME__.minimapToggle()` and `__GAME__.minimapStats(reset)`.

Coordinator checklist (Gemini's findings on the competing build), checked:
1. Same rotation sign for layer and markers: one transform, and the marker angle matches the true bearing (below).
2. No mirror: `orient40.mjs` reads the map's own pixels. Drone on the north road (seawall 10 m north), facing east: road ahead (street colour up the map), sea on the LEFT, island on the RIGHT. Facing west: sea on the right. Facing north: sea ahead. Shots `orient-east.jpg`, `orient-west.jpg`, `orient-north.jpg`.
3. One canvas, layer replaced by `setLayer`, one resize listener (removed in `dispose`).
4. No per-frame DOM reads: size after resize only, map box every 500 ms, nothing gathered on frames without a redraw.
5. High DPI as described.
6. Fixed CSS position inside the viewport and the safe area.
7. One edge threshold, no dot under the arrow, the distance label never jumps (fixed at the bottom) and markers keep clear of it.
8. 170 m water margin.

Measurements (`mm40.mjs`: a fixed-step autopilot flies a full run, climbs to 46 m, heads for the objective, drops onto the pad. Every minimap draw compares the marker angle with the true bearing computed from the diagnostics' own position, yaw and objective. Every 0.25 s the minimap box is checked against the HUD.)

| Run | Draws compared | Inside / on the rim | Worst error | Mean error | At 5 deg or more | Overlap samples |
|---|---|---|---|---|---|---|
| desktop 22 | 1,878 | 1,746 / 132 | 2.18 deg | 0.006 | 0 | 0 of 287 |
| phone 22 | 1,881 | 1,735 / 146 | 2.88 deg | 0.013 | 0 | 0 of 286 |
| desktop 58 | 1,835 | 1,835 / 0 | 2.18 deg | 0.014 | 0 | 0 of 281 |
| phone 58 | 1,839 | 1,839 / 0 | 2.77 deg | 0.007 | 0 | 0 of 281 |
| phone 130 | 1,932 | 1,785 / 147 | 2.88 deg | 0.008 | 0 | 0 of 289 |

The worst errors are single draws on the frame a new objective appears. 3 deliveries and the end of the run on each, 0 crashes, 0 page errors.

HUD overlap in the real-time HUD probes (`hud-probe34.mjs` + `mm40-init.js`) is checked every 100 ms. The boxes: the stick and its label, the three buttons, the meters, the score, the timer, the objective pill and the route hint. Also the right chips, every pop, the nav marker, the gate tag and the view hint.
- Phone 22, 58, 130 (and the reruns): 0 hits in 786 to 800 samples each.
- Desktop, first runs (before the 64 px clearance): the nav marker's edge arrow touched the map in 5, 9 and 1 of about 807 samples. After the fix: seed 58 and 22 reruns 0 of 807.

Cost (`mmcost40.mjs`, real time, rAF loop, W held and turning, 20 s):

| | Draws a second | Mean draw | Worst draw | Per frame | Frame time median / p95, map on | map off |
|---|---|---|---|---|---|---|
| desktop 1280x720 | 28.9 | 0.12 ms | 0.40 ms | 0.028 ms | 8.3 / 8.8 | 8.3 / 8.8 |
| iPhone 13 (emulated) | 28.8 | 0.18 ms | 0.40 ms | 0.044 ms | 8.3 / 8.7 | 8.3 / 8.9 |

The very first draw costs about 1.2 ms (backing store allocation). The layer build runs once at load.

Toggle (`toggle40.mjs`): on the title, M toggles music (as before), and N too. In a run, M hides the map and stores "0". After a reload it is still hidden. M again shows it and stores "1". 0 page errors.

Screenshots (`builder-shots/`) show two light moods, desktop and phone. Seed 22 is bright morning, seed 58 hazy noon. Files: `mm-d-22-t12.jpg`, `mm-d-22-shortcut.jpg`, `mm-d-58-t30.jpg`, `mm-m-22-edge.jpg` (rush order, coral edge arrow), `mm-m-58-t30.jpg`. The final drawing (with the cone and the shortcut line) is in `mm-m-130-*.jpg`, `close-d-22.jpg`, `close-m-58.jpg` and `orient-*.jpg`. The `mm-d-*`, `mm-m-22` and `mm-m-58` shots are from before the review fixes (no cone or dashed shortcut line yet).

## 2. Codex findings

A. Slow motion and the clocks (`Game.updatePlaying`). The run clock, the leg clock, `DeliverySystem.update` (time left, leg time, overtime) and the rush window now advance with the real step. The scaled step still drives the drone, the slipstream, the marks and the effects. `clock40.mjs` flies head-on hits at 14 and 24 m/s (fixed 60 Hz) and logs the time scale per frame (`feel.timeScale`). Result: 8 hits with an impact, each with 14 slowed frames (scale down to 0.08). Real time in them: 0.2333 s. The run clock advanced 0.2333 s, the leg clock 0.2333 s. The delivery timer lost 3.233 s (0.233 s plus the 3 s crash charge). Before, the run clock advanced about 0.06 s in the same frames.

B. Speed streak shader (`VfxSystem.ts`): `smoothstep(-0.8, -4.0, z)` is now `1.0 - smoothstep(-4.0, -0.8, z)` (the same curve with ordered edges). Flat-frame probe (`acceptance-probe.mjs`): 791 frames, 0 flat, 0 errors.

C. Scrape pad-edge exemption (`Drone.ts`, `Game.shadowCrash`). The scrape branch now records `scrapeTop`: the column top at the scrape contact with the largest round 38 loss. The shadow accounting uses it for the pad-edge test. The wall path keeps `wallTop`. Crash-classify (final build):

| | Charged | Per minute | Pad lip | Hop-like | Freed (shadow) | Impacts = charged |
|---|---|---|---|---|---|---|
| 12 m, seeds 22, 58, 130 | 15 in 179 s | 5.0 | 0 | 0 | 0 | 15 = 15 |
| 20 m, seeds 22, 58, 130 | 8 in 193 s | 2.5 | 0 | 0 | 0 | 8 = 8 |

Round 39 builder on the same 3 seeds: 5.2 and 5.1 a minute (the critic's 8-seed figures were 4.7 and 2.8).

## 3a. Boost tail (`Drone.ts`, `config.ts`)

- `Drone.carry`: speed over the cruise top that the drone can still carry after a boost. While boosting it follows the speed over the cruise top. After the boost it falls at `min(tailDecel 3.8, tailBase 1.0 + tailEase 0.8 x carry)` m/s^2, times (1 + 2 x headwind). So up over the roofs the tail is up to 3 times shorter.
- With W held (and not airbraking onto a pad), the speed is held at min(speed before the drag, cruise top + carry). It never adds speed, so there is no runaway: it only holds back the round 39 over-top drag. Releasing W, braking, a wall or a turn that takes the speed off ends it (carry is clamped to the real excess every frame).
- Inside the pad airbrake range (28 m from the objective) the tail ends at once. So arrivals bleed speed as before. "Open points" tells why.
- Streaks: a faint cruise layer, 0.18 x smoothstep(12, 16.5 m/s), under the boost layer.

`tail40.mjs` (fixed step, seed 22, the critic's road), and `topspeed39c.mjs`:

| Check | Target | Round 40 | Round 39 |
|---|---|---|---|
| Full boost then W: time at 22 m/s or more after the boost ends | 1.5 s or more | 2.25 s | about 0.6 s |
| ...time to 18 m/s | 3 s or more | 3.57 s | 1.0 s |
| ...peak slowdown (0.1 s window) | 6 m/s^2 or less | 3.8 | about 12 |
| Streak level at steady cruise (16.8 m/s) | 0.15 or more | 0.18 | 0 |
| Streak level at about 11 m/s | 0 | 0 | 0 |
| W only, top speed | 17.5 or less | 16.8 | 16.8 |
| Boost peak / boost plus carving | 31 or less | 30.4 to 30.6 / 30.0 | 30.4 / 30.0 |
| speedbug turn at top speed | | 17.5 | 17.5 |

Speed trace after the boost (every 0.5 s): 30.5, 28.6, 26.7, 24.8, 22.9, 21.0, 19.3, 18.1, 17.4, 17.1, 16.9, 16.8.

## 3b. Uncharged hits get a lighter effect (`Game.checkCrash`, `Game.lightHitFx`, `Drone.knock`)

- A hit whose speed loss is already over the crash threshold at contact plays the full round 39 effect (tumble, sputter, shake, slow motion, hit-stop). A hard head-on knock that the rules leave free plays `lightHitFx`. Such a knock is 45 degrees or more, 8 m/s or more into the wall, and under the threshold. The light effect: a shake (0.45 to 0.65), a small camera lurch and a fan of sparks off the wall. Also `Drone.knock`: a small kick on the attitude spring (about 10 to 15 degrees, settles in about half a second). No flip, no sputter, no hit-stop, no slow motion. If that hit is charged after all, the full effect plays on the charge (it upgrades).
- The bump hit-stop (0.06 s at bumps over 4 m/s) now plays only with the full crash effect.

`crash40.mjs` is the round 39 critic's crash39c plus a round 40 summary. Seeds 22 and 58, 4 faces each, angles 5 to 90, run-ups 5 to 30 m/s, W held and released:

| | Seed 22 | Seed 58 |
|---|---|---|
| Uncharged hits | 476 | 464 |
| ...tilt over 30 deg | 0 | 0 |
| ...with slow motion or hit-stop | 0 | 1 (see below) |
| Uncharged head-on knocks (45+ deg, 8+ m/s) | 36: tilt max 21.4 deg, shake min 0.64, particles min 54 | 36: 21.4 deg, 0.64, 57 |
| Charged hits | 164, all with the full effect and slow motion, tilt 47.5 to 86.8 deg | 176, all full, tilt from 48.6 |
| Head-on 8 to 11 m/s with the full effect | 0 of 28 (round 39: 44 of 44) | |
| Under 25 deg charged | 8 of 320 (round 39 critic: 8 of 400) | |
| Camera over all hits | closest 8.39 m, 0 in solid, largest move 0.49 m/frame | |

The one seed 58 case is a 39 degree hit at 9.3 m/s. Its speed loss reached the threshold (7.2) at contact, so the full effect played. But the charge did not follow: a ledge hop during the hit makes it a skim. 1 in 464.

## Regressions (all on my build; reruns after the last code change marked "final")

| Check | Round 40 | Round 39 reference |
|---|---|---|
| cam-clip30 seed 22 no orbit | 0 in solid, 0 hidden, 0 pops | same |
| cam-clip30 seed 58 orbit | 0 in solid, 0 pops, occluded 2 frames | 4 frames |
| cam-clip24 desktop 22 / phone 22 | 0 / 0 / 0 | same |
| climb30 desktop / phone | 32 climbs, 0 jumps over 1 m (max 0.887 / 0.881), 0 in solid, closest 5.17 / 5.34 m | 0.88 / 0.89 |
| Wall-side framing and open-street camera (HUD probes, CAM=1) | 0 in solid, 0 occluded, closest 2.4 m (phone 22), 0 under 2 m | closest 2.3 m |
| Pad view, 24 pickups and drops | bearing over 30 deg 9.6%, over 90 deg 0 | 9.6% |
| Hull probe desktop / phone | 16 / 11 flagged views, 0 flat (control views also +2 each, view timing) | 15 / 10 |
| boats32 seed 22 x2, boats33, boats31 overlap, bus stop | 0 inside, 0 mast, 0 stuck, 0 hull on hull or dock, fly-through 0 crashes, 4 stops per seed at 9 to 9.25 s | same |
| People on active pads | 0 (48 legs, 1,536 samples) | 0 |
| Traffic overlap | 0 pair frames on 3 seeds | 0 |
| Desktop HUD probe 22 / 58 / 130 | marker on controls 0. Pops on the drone 2 / 0 / 1 of about 300. Drone under a pill 0 / 0 (rerun 0.37%) / 0 | similar |
| Phone HUD probe 22 / 58 / 130 | marker on controls 0. Pops on the drone 0 / 0 / 0. Drone under a pill 0.13% / final 0% / 0% | 0 to 0.25% |
| Medal gate, street (final build) | 4,622 Silver / 3,708 Silver / 4,952 Silver, 1 crash in 3 runs. Breakdown and end screen exact. First build: 6,049 / 2,911 / 6,751 | 4,233 / 2,915 / 5,677 |
| Medal gate, roof (final build) | 856 (a crash at 20 s, the same as the round 39 critic's run) / 3,152 Silver / 5,259 Silver. Exact. First build: 7,204 / 851 / 5,259 | 856 / 2,807 / 5,296 |
| Medal gate, lazy (no boost, so the last change does not touch it) | 1,169 Bronze / 895 / 1,083 Bronze, exact | 1,191 / 948 / 1,037 |
| No-delivery farm 22 / 58 / 130 | score 0 / 0 / 0 | 0 |
| Cold load, no unstyled flash | 8 loads (dev and production, desktop and phone): 0 bad frames | 0 |
| First load (production, 4 cold loads) | 2.78 MB | 2.78 MB |
| Draw calls (spot sweep) | desktop 117 (130 and 22), phone 104 | 119 / 116 / 104 |
| Triangles | 447k / 436k desktop, 415k phone | 445k / 436k / 417k |
| Perf p95, street normal / rush | desktop 7.7 / 9.8 ms, phone 6.2 / 5.5 ms | 8.0 / 8.2, 6.4 / 5.5 |
| `vite build` | no chunk warning. Game chunk 388.5 kB (+11 kB), three 588 kB, CSS 40.6 kB | 377 kB |

Kept: the bloom clamps in `ObjectiveMarker.ts` (file untouched), the `#app` visibility rule in `index.html` and `styles.css`, all debug hooks.

## Open points

- Phone drone-under-pill on seed 58 rose to 1.1 to 1.3% with the first boost tail. An A/B run with the tail tuned off gave 0.13%, so it was the tail: the street bot reached a pad approach with carried speed. I made the tail end inside the 28 m pad airbrake range. Final rerun: 0.00%.
- Street-over-roof ratio: real-time bot runs swing a lot (seed 22 roof: 7,204 one run, 856 the next). On the final build: street 13,282 against roof 9,267, so low over high is 1.43 (round 39: 1.43). Per seed: 5.40 (22), 1.18 (58), 0.94 (130). All are 0.85 or more.
- The street bot scored more with the first tail (seeds 22 and 130 reached Gold in one run). With the final tail it is Silver on all three seeds again.
- Light hit against charge: a hit that reaches the threshold at contact but then skims a ledge still shows the full effect (1 in 464 probe hits). To wait for the charge adds 0.2 s of lag to every real crash, so I kept it.

## Files changed

- `src/ui/Minimap.ts` (new): layer builder, reusable `drawMinimap`, DOM `Minimap`.
- `src/game/Game.ts`: Codex A (real-time clocks) and Codex C (shadow uses `scrapeTop`). The light hit effect and `hitFx` levels. The bump hit-stop only with the full effect. Minimap wiring: layer, `updateMinimap`, M and N keys, desktop marker clearance, debug hooks, `dispose`. Diagnostics `feel.timeScale`, `runTime`, `legClock`, `lightHits`, `carry`.
- `src/entities/Drone.ts`: `scrapeTop`, `knock()`, boost tail (`carry`).
- `src/game/config.ts`: `tailDecel`, `tailBase`, `tailEase`, `tailWind`.
- `src/systems/VfxSystem.ts`: ordered smoothstep edges, cruise streak layer.
- `src/ui/Hud.ts`: `relayout()`, the minimap box joins the touch "top" boxes.
- `src/styles.css`: minimap placement.
- `index.html`: the minimap canvas, "M map" in the title key list.
- `src/vite-env.d.ts`: hook types.
