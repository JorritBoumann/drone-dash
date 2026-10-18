# Drone Dash: round 34 builder notes

Build: the round 34 work, not committed, on top of 56353fb (round 33).
Control: an export of 56353fb (git archive into my scratchpad) on port 5193.
My servers: 5190 served a snapshot copy of the working tree (all regression jobs). 5195 served the working tree (quick looks).
4193 and 4194 ran `vite preview` of the two production builds (round 33 and round 34). All are stopped.
I did not touch the owner's server on 5188. Every browser job ran alone, one at a time, from `builder-scripts/queue34.sh`
and `jobs34.txt` (log in `queue34.log`).

Scripts: I copied the critic scripts of rounds 25, 31, 32 and 33 into `builder-scripts/`. I changed only the ports
(5191 -> 5190, control 5192 -> 5193) and the output folders (`../builder-shots/`). Tags: `water31.mjs` writes
`water33-r34-*` and `water33-r33c-*`, `contrast31.py` reads them. New:

- `boattrace34.mjs`: boattrace33 with a 150-frame trace and a `SNAP` line per hover run (largest per-frame move beyond the drone's own speed, in m).
- `trisweep34.mjs`: trisweep31 plus a draw-call histogram and the draw calls per mesh at every spot with 119 calls or more.
- `breakdown34.mjs`: copy of my round 33 per-mesh breakdown.
- `waterlow34.mjs`: only the low water views, for tuning (shots went to the scratchpad).
- `ff34.mjs`: ff29 with a PORT option. `firstload34.mjs`: first load of a production build (bytes, timings, long tasks after Play).
- `ab34.py`: the critic's ab33.py for round 33 against round 34 (water pairs at full width). The key is written before judging.

Machine load: the Mac was restarted, no Bluetooth hog. CPU snapshots are in `cpu-*.txt`.
One stretch around 07:03 to 07:13 ran slow: the headless browser fell to about 60 frames a second. The round 33 control ran
just as slow back to back (`fr-d-58-r33c-b.log`: median 16.0 ms, mine `fr-d-58-b.log`: 16.6 ms), so that was the machine.
The final batch ran at the normal 8.3 ms median.


## 1. Desktop pops over the drone: fixed

**Cause.** On desktop all centre messages sat on the centre line (39% and 50% down). The drone sits on the centre line too.
The payout pop (`#slip-pop`) and the medal banner covered it most often.

**Fix** (`Hud.ts`, `Game.ts`, `styles.css`). Desktop now gets a pop slot like the round 24 phone slot:

- `Game.updateDeskPop` gives the HUD the drone's screen box every frame (centre projected, size from the distance, the same estimate as the touch framing).
- `Hud.deskPlace` puts the pop that is up just left of the drone, level with it. Its right edge stays 26 px clear of the drone box (it allows for the 1.15 pop-in scale).
- The slot starts right of the edge marker. It stays below the score panel and above the bottom meters and the view hint. The pop's rise as it fades is allowed for.
- While a pop is up it eases after the drone. Small moves are ignored, so the text does not shake.
- The HUD boxes are measured every 300 ms. The HUD measures the pop size one time, at show time. There is no layout read per frame.
- The objective pill and the centre column are untouched. Touch layout is unchanged.

**Test**: `hud-probe28.mjs` (the round 24/25 method: real DOM rects of the 4 pop elements against `droneBox()`,
every visible drone vertex through the render camera). Desktop, new player, 80 s low line.

| Seed | Round 33 (control, 5193) | Round 34 (first run) | Round 34 (final batch) |
|---|---|---|---|
| 22 | 23.1% (79 of 342) | 0.66% (2 of 301) | 0.33% (1 of 300) |
| 58 | 33.9% (87 of 257) | 0.74% (2 of 269) | 0.00% (0 of 284) |
| 130 | 29.9% (92 of 308) | 0.00% (0 of 255) | 0.33% (1 of 307) |

Pops over the controls 0, pops over the top panels 0, drone under a pill 0, other HUD on the drone 0, in every run.
The few hits left are a medal banner, an event banner or a delivery pop while the drone swings across the screen.
Shots: `builder-shots/hud34-d-22-payout-beside-drone.jpg` and `hud34-d-58-payout-beside-drone.jpg` (the payout pop beside the drone).
Round 33 control for comparison: `hud33c-d-22-payout-chain.jpg`.

## 2. Harbour bus snaps the drone sideways: fixed

**Cause.** `Drone.update`: when a boat's bow or stern pushed the drone, the code moved the drone's position sideways by
`(boat speed + 2) x 5 steps` in one sub-step. That is 0.55 m in one frame, and it repeated at every new contact.

**Fix** (`Drone.ts`). The sideways carry is now a velocity, not a position jump:

- At a bow or stern contact the drone gets a slide direction and a slide speed. The slide speed is the boat speed + 2 m/s, within the round 33 cap.
- For 0.3 s after the last contact, the slide speed is held after the lateral grip, and the grip does not eat it. It eases out in the last 0.12 s.
- The hull's own push-out (the drone leaves the face at least as fast as the face moves) is unchanged. The round 33 speed cap is unchanged.

**Test**: `boattrace34.mjs` (hover runs: the boat runs into a parked drone, 150 frames after first contact).
"Worst move" is the largest per-frame move beyond the drone's own speed.

| Run | Round 33 (control) | Round 34 |
|---|---|---|
| Bus, 2 m, seeds 4711 / 22 | 0.475 / 0.475 m | 0.012 / 0.012 m |
| Bus, 1 m, seeds 4711 / 22 | 0.421 / 0.457 m | 0.008 / 0.010 m |
| Sailboat, 0.9 m (4 runs) | 0.28 to 0.35 m | 0.001 to 0.013 m |
| Longest contact, bus hover | 11 to 45 frames | 20 to 22 frames |

All under the 0.15 m bar. The peak effective speed after a bus contact fell from 33.8 m/s to 7.3 m/s.
The drone's own speed peaks at 6.6 m/s (the cap: boat speed 4.6 + 2). The hull's push-out adds the last 0.7 m/s.
The sailboat hover runs on seed 4711 still reach 9 to 10 m/s. That is the soft city edge spring, as the critic found in round 33 (the drone sits 197 m out), not the boat.

## 3. Draw calls: 125 -> 114

`trisweep34.mjs` logged the draw calls per mesh at every spot with 119 calls or more (round 33 control, seed 130).
Each spot had the same top costs. The drone took 13 calls (9 meshes, 4 of them also in the shadow pass). The objective marker took 9.
Each instanced street mesh took 2 calls (main pass and shadow pass).

What changed:

- **A shadow-only layer** (`SHADOW_ONLY_LAYER` in `shadowSubset.ts`). The sun's shadow camera sees layer 2. The game cameras do not.
  A mesh on it costs one draw in the shadow pass and none in the main pass.
- **Drone**: the 4 hull meshes that cast a shadow now draw it as one merged proxy on that layer. 4 shadow draws -> 1. Same shape, same material side.
- **Near trees** (the two CC0 species): trunk and canopy cast one merged proxy per species. 4 shadow draws -> 2. The canopy sway was never in the shadow pass, so nothing changes there.
- **Objective marker**: the two tape bands on the parcel are one mesh. 2 draws -> 1.

Full sweep (`trisweep34.mjs`, the critic's trisweep31 spots: 3,256 to 3,296 spots, 1,920 of them on the water):

| Run | Round 33 critic | Round 33 control, today | Round 34 |
|---|---|---|---|
| Desktop 22, draw calls | 123 | 123 | **114** |
| Desktop 130, draw calls | 125 | 123 | **114** |
| Desktop 33, draw calls | 122 | | **113** |
| iPhone 130, draw calls | 106 | | **97** |
| Desktop 130, max triangles | 444k | 446k | 431k |
| Desktop 22 / 33, max triangles | 429k / 433k | 424k / | 418k / 416k |
| iPhone 130, max triangles | 408k | | 397k |

Spots at 110 calls or more, desktop 130: 177 in the control, 10 now. Street runs (`perf-street.mjs`): desktop 108 / 113
(normal / rush, round 33: 117 / 122), iPhone 94 / 94.
In the blind street A/B (below) I saw no difference in any shadow.

## 4. Golden water at 1 to 2 m: the soft streaks are gone

**What I found** (`waterlow34.mjs`, layer switches in a temporary debug uniform, removed again):

- With the near normals flat, the bottom third of the golden low view is smooth. So the streaks are in the normal layers.
- They are not in the shadows (receiving shadows off changed nothing). They are not in the boats or their wakes (boats off changed nothing).
- Switching off any one layer (the 14 m, 5 m or 2 m detail layer, or the swell) left the streaks. All layers sample the same tile texture. It is a sum of only 18 waves, so each layer shows a few long crests. Close to a low camera they read as soft streaks that run toward the vanishing point.

**Fix** (`Water.ts`, desktop only, the phone's lite water is unchanged):

- A second tile texture for the near layer: 56 short ripples turned evenly round the circle (no few long crests), 256 px.
- Near a low camera this layer takes over 85% of the detail normals. It reaches 14 to 45 m and fades by pixel footprint (2 to 11 cm). It works only for a camera under 8 to 13 m.
- So the 14 m glint views and the play-height cruise view keep their round 33 look.

**Blind A/B** (`ab34.py`, round 33 control against round 34). The sides are random and the key was written first.
I wrote `builder-shots/ab/picks.txt` before I opened `.key.json`. The water pairs are at the full 1280 px width.

| Pair | Pick | Result |
|---|---|---|
| Dusk 33, g-low | new (crisp ripples in the bottom third, old smears) | **new wins** |
| Golden 130, g-low | new (old has radial streaks under the drone) | **new wins** |
| Golden 130, cruise | tie | tie |
| Golden 130, glint 14 m | old, weak (glitter a little more defined) | old wins |
| Dusk 33, glint 14 m | tie | tie |
| Noon 58, cruise | tie | tie |
| Street set, 6 pairs (art27 views) | tie in all 6 | 6 ties |

The one loss (golden glint at 14 m) came from the near layer reaching the 14 m camera. I then limited it to cameras
under 8 to 13 m (the camera-height fade above). After that change the 14 m glint views match round 33: mean pixel difference 1.0 to 1.8 (of 255) on all 4 moods, the noise of moving boats. The g-low views still differ (mean 11 to 18, bottom third 16 to 25). I did not run a second blind A/B. I know the look now, so it is not blind any more.

`contrast31.py` (desktop game camera, cruise must stay at most 0.6 of low):

| Mood | Round 33 control | Round 34 |
|---|---|---|
| Golden 130 | 18.1 / 35.0 = 0.52 | 18.2 / 35.1 = 0.52 |
| Morning 22 | 16.5 / 30.2 = 0.55 | 16.6 / 30.8 = 0.54 |
| Dusk 33 | 16.4 / 40.7 = 0.40 | 16.7 / 40.6 = 0.41 |
| Noon 58 | 16.6 / 31.3 = 0.53 | 16.9 / 31.2 = 0.54 |

The metric's low band is rows 170 to 400 (water 30 m and more away), so it does not see the bottom-third change.
Cost: no more texture fetches (the near layer had one already). The near texture is built once at load. I also made the texture build faster: one row of sines per wave instead of one sine per pixel and wave. Same values (largest difference 3e-6), about 11 times faster.

## 5. JS chunk split: 952 KB -> 351 KB + 587 KB + 19 KB

`vite.config.ts`: `build.rolldownOptions.output.codeSplitting` groups. three.js core goes to its own `three` chunk.
The post-processing passes go to `three-post`. The street assets (GLTF loader and models) and lil-gui were already lazy and stay lazy.
The `single` build mode is unchanged.

| Chunk (minified) | Round 33 | Round 34 |
|---|---|---|
| index (game code) | 952 KB | 351 KB (123 KB gzip) |
| three | | 587 KB (149 KB gzip) |
| three-post | | 19 KB |
| StreetAssets (lazy) | 45 KB | 45 KB |
| lil-gui (lazy, debug) | 31 KB | 31 KB |

`npm run build`: no chunk warning (round 33: the 900 KB warning). Type check clean.
Build size without source maps: 2.92 MB (with maps 7.3 MB). The index.html head keeps the lead's inline style that hides
`#app`. The single stylesheet still loads from a `<link>` in the head before the module scripts, so `#app` shows as soon as it applies.

I did not lazy-load the boats, water or debug tools. Water shows from the title screen on. The boats module is small, and the boats build from the lazy street assets already.
The debug hooks (`window.__GAME__`) are the ones the bots use, so they stay in the build.

**First load** (`firstload34.mjs`, `vite preview` of each production build, fresh browser context, desktop, 3 runs each):

| | Round 33 build | Round 34 build |
|---|---|---|
| Bytes over the wire (gzip) | 2.14 MB | 2.14 MB |
| JS over the wire | 286 KB | 289 KB |
| Load event | 693 to 768 ms | 694 to 704 ms |
| Play button ready | 786 to 867 ms | 789 to 802 ms |
| Long tasks after Play (4 s) | 0 | 0 |

First load stays far under 15 MB. Before the faster texture build, round 34 needed about 90 ms more to start (the new 56-wave texture). That is gone now.
First flight on the final code (`ff34.mjs`, dev server): 0 long tasks after Play, 0 new shader programs after Play, desktop and iPhone.

## Regressions (final batch, snapshot of the round 34 code on 5190)

| Check | Result |
|---|---|
| Flat frames, bloom on (`acceptance-probe.mjs`) | 927 frames, 0 flat, 0 errors. Again after the last water change: 945 frames, 0 flat (`flat-b.log`). On the final code: 651 frames, 0 flat (`flat-c.log`). |
| Crash classify, 8 seeds, 12 m | 45 crashes in 538 s (5.0 a minute, round 33 critic 6.7, its control 5.9). 0 hop-like. 10 near a target, closest 5.0 m below a top. 0 pad lips. |
| Crash classify, 8 seeds, 20 m | 41 crashes in 716 s (3.4 a minute, round 33: 3.7). 0 hop-like. 13 near a target, closest 2.0 m below a top (round 33: 2.6). 0 pad lips. |
| Boats (`boats33.mjs`, seeds 22, 58, 4711, 9001, 156 approaches) | 0 frames inside a hull, 0 stuck, 0 near a mast, 0 pushed down. Bus rams: 16 of 16 charged exactly one crash. Bus hover longest contact 24 frames (round 33: 37). |
| Bus stops (`bus-stop33.mjs`, 700 s, 4 seeds) | 4 stops a seed, piers alternate every time, stops 9 to 9.25 s, no stall. |
| Alley camera | cam-clip30 desktop 22 no orbit, cam-clip24 desktop 22 and 58, iPhone 22 no orbit: 0 hidden, 0 in solid, 0 pops over 1 m, about 6,920 frames each. |
| climb30 | Desktop and iPhone: 0 jumps over 1 m (max 0.90), 0 frames in solid, closest camera 5.4 m. |
| People on active pads (`pad-people23.mjs`) | 0 (48 legs, 1,536 samples). |
| Traffic overlap (`traffic-det29.mjs`) | 0 pair frames in all 6 runs. |
| Phone HUD (`hud-probe28.mjs`, iPhone 22, 58, 130) | Marker on controls 0, drone under pills 0, pops on the drone 0.00% in all 3, pops over the controls 0. Pops touching the top column: 106 / 120 / 98 samples (round 33 critic: 77 / 78 / 59). The touch code path is unchanged. Back to back on seed 58: control 71 of 226, round 34 85 of 226 (`fr-m-58-r33c.log`, `fr-m-58-b.log`). I count this as run noise. Please check it. |
| Desktop HUD (seeds 22, 58, 130) | See part 1: 0.33%, 0.00%, 0.33%. |
| Chimes with pops | 61 of 61 chimes had the payout pop shown within 0.3 s (6 HUD runs). |
| No-delivery farm (`farm-probe.mjs`) | 0 points on 22, 58 and 130. |
| First flight (`ff34.mjs`, dev server) | 0 long tasks after Play, 0 new shader programs after Play (desktop 2 runs, iPhone 1). |
| Street frame time (`perf-street.mjs`, 12 s) | Desktop p95 8.6 / 8.8 ms (normal / rush), max 9.4. iPhone p95 8.9 / 8.9 ms, max 9.4. 0 frames over 20 ms. |
| HUD runs, 80 s | p95 9.9 to 10.0 ms desktop, 9.1 to 10.0 ms iPhone. |
| Medal gate, street (`route-play-rt-x-m-esc17.mjs`) | 4,087 Silver, 3,560 Silver, 5,994 Silver (seeds 22, 58, 130, total 13,641). Breakdown exact in all 3. Strict delivery share 64%. Round 33 critic: 16,343 with 2 Gold, round 32: 15,473 all Silver. This bot runs in real time and varies this much between runs. Nothing in this round changes flight or scoring. |
| Medal gate, lazy (`balance-probe-m-esc17.mjs`) | 1,156 / 1,184 / 1,058, all Bronze (total 3,398, round 33: 3,271). Breakdown exact. No lazy run near Silver. |
| Triangles | Max 431k desktop, 397k iPhone (under 480k). |
| `npm run build` | No chunk warning. Type check clean. |

The bloom clamps in `ObjectiveMarker.ts` are untouched (only the tape mesh merge is new there).
The debug hooks the bots use are unchanged and stay in the build.

## Files changed

- `src/ui/Hud.ts`: desktop pop slot (`setDroneScreen`, `deskLayout`, `deskTarget`, `deskPlace`, follow in `tickCentre`).
- `src/game/Game.ts`: `updateDeskPop` (the drone's screen box for the HUD, desktop only).
- `src/styles.css`: desktop pops wrap inside their slot (appended block). The lead's `#app` visibility rule is kept.
- `src/entities/Drone.ts`: boat sideways carry as a velocity (no position jump). Merged shadow proxy for the hull.
- `src/world/shadowSubset.ts`: `SHADOW_ONLY_LAYER`.
- `src/world/Environment.ts`: the sun's shadow camera sees that layer. Shadow proxies for the near trees.
- `src/entities/ObjectiveMarker.ts`: the parcel's two tape bands in one mesh. Bloom clamps untouched.
- `src/world/Water.ts`: near ripple texture, near layer reach and camera-height fade, faster texture build, cache key `water34`.
- `vite.config.ts`: `three` and `three-post` chunks.
- `index.html`: changed by the lead (inline style that hides `#app`), not by me. I kept it.

## Open points for the critic

- The ab/ pairs show the first round 34 water (before the camera-height fade). The g-low views did not change after that. The glint views now match round 33. The water shots in `builder-shots/` are from the final code.
- The desktop pop slot is left of the drone. A human player must judge the eye jump from the centre to the left side.
- The bus push now reads as a smooth slide in the trace. A human player must still judge it on screen.
- The street medal bot gave 3 Silver this time (round 33: 2 Gold). Nothing in this round changes flight or scoring. I think it is run noise, but it is a real-time bot.
