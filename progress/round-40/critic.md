# Drone Dash: round 40 critic report

**Verdict:** Keep build M's minimap. It won all 18 blind pairs. Its target bearing error is under 1 degree. It sits on screen on every desktop and phone size I tested. Build W's minimap points the wrong way most of the time and is off screen on every phone. The rest of round 40 passes. Two small notes: the "light" knock still shakes at full strength, and the help text does not mention N for music.

## Setup

- Build M: the main working tree (round 40, not committed). Build W: the worktree `drone-dash-codex-minimap` (round 39 code plus the Codex minimap).
- My servers: 5191 (M dev), 5192 (W dev), 5193 (production preview of my own build of M in the scratchpad). Each dev server had its own Vite cache in the scratchpad, HMR and file watch off. I did not touch the owner's server on 5188. All three of mine are stopped.
- I did not read `progress/round-40/builder.md`. Before judging I read W's placement and draw code (to understand why its map sat off screen on the phone). I read M's minimap code after judging, for its colours and probe hooks.
- Every browser job ran alone, one at a time (`critic-scripts/queue40c.sh`, `jobs40c.txt`). The machine was busy during the second half (load average up to 25, mostly other apps). See the perf note.

## 1. Blind A/B of the two minimaps

Method: `mm-ab40.mjs` captured both builds on the same seeds, spots and poses (fixed step, both maps forced to draw the current frame). `ab-assign40.py` then put each build on side A or B at random per pair and wrote the key to `critic/ab/key.json`. `ab-compose40.py` built the pair images. I wrote my picks to `critic/ab/picks.txt` before I opened the key.

Seeds and light: 22 (bright morning), 58 (hazy noon), 130 (golden hour). Desktop 1280x720 and iPhone 13 held sideways.

| Pair | Pick | Build picked | Reason |
|---|---|---|---|
| 22 desktop, straight | A | M | Target 23 deg right in 3D. M shows it at 1 o'clock, W at 6 o'clock. |
| 22 desktop, hard turn | B | M | Target ahead-left. M at 11 o'clock, W at 7 o'clock. |
| 22 desktop, shore | A | M | Both have the sea on the right. W draws water ahead where the city goes on. |
| 22 desktop, target ahead | B | M | Dead ahead: M at 12, W at 6. W also has the boulevard and sea on the wrong side. |
| 22 desktop, target behind | B | M | 205 m behind: M edge arrow at 6, W at 12. |
| 22 desktop, shortcut leg | A | M | Target 8 deg right: M at 12, W below the drone. No shortcut mark at that moment on either. |
| 58 phone, straight | A | M | W's map is not on screen. |
| 58 phone, hard turn | A | M | W not on screen. M correct (target at 9, sea right). |
| 58 phone, shore | A | M | W not on screen. M correct. |
| 58 phone, target ahead | B | M | W not on screen. M at 12. |
| 58 phone, target behind | A | M | W not on screen. M arrow at 6. |
| 58 phone, shortcut leg | A | M | W not on screen. M shows the alley entrance arch ahead and the target beyond. |
| 130 desktop, hard turn | B | M | Target 27 m behind-left. M at 7 to 8 o'clock. W's "27 m" label sits on the drone arrow. |
| 130 desktop, shore | B | M | W draws the south shore ahead. M correct. |
| 130 desktop, target behind | A | M | M arrow at 6, W at 12. |
| 130 phone, straight | A | M | W not on screen. M correct (diamond touches the drone arrow at 26 m). |
| 130 phone, target ahead | A | M | W not on screen. M correct. |
| 130 phone, shortcut leg | A | M | W not on screen. M correct. |

**Result: M 18, W 0.** The two styles are easy to tell apart, so the blind step mainly kept me honest per pair. Each pick rests on a check against the 3D view and the true bearing.

Look and readability, desktop: M's cream streets, tinted roofs, N badge on the rim and big distance pill read at a glance. W's grey grid with red diagonals and a dark teal sea is heavier. Its labels are 7 CSS px tall at normal pixel density (see DPI). At speed they are hard to read. On the phone W cannot be judged: it is never on screen.

## 2. Measurements (both builds, from the canvas pixels)

Script: `mm-measure40.mjs` (same pixel method for both builds: the largest blob of marker colour, its angle from the map centre). `mm-domcount40.mjs` for DOM queries.

| Check | Build M | Build W |
|---|---|---|
| Bearing error, 360 poses over 6 legs on seeds 22, 58, 130 (pickup and drop, all headings, 15 to 300 m) | median 0.1 deg, p95 0.6 deg, max 9.2, 0 over 20 deg | median 93 deg, p95 170 deg, 313 of 360 over 20 deg, 186 over 90 deg |
| Bearing error, real time, 8 s of carving at speed (160 samples) | median 0.9 deg, p95 4.1 deg (the 30 Hz redraw lag) | median 102 deg, p95 159 deg |
| Orientation: facing east, target dead ahead | 12 o'clock (0.0 deg) | 6 o'clock (180 deg) |
| Same, facing north | 12 o'clock | 6 o'clock |
| Street ahead at the top: street share of the 12 o'clock ray, facing E / N / W / S | 0.89 / 0.84 / 0.89 / 0.89 | 0.91 / 0.48 / 0.86 / 0.47 (facing N or S the street is drawn behind) |
| Sea on the correct side (east shore facing N and S, south shore facing E and W) | 4 of 4 | 2 of 4. Facing E or W, left and right are mirrored |
| Edge clamp | Marker moves out to 0.82 of the radius at 135 m, then turns into the rim arrow at the same point | Dot stops at 135 m. The arrow only starts after 150 m. From 135 to 150 m a plain dot sits on the rim |
| Alleys | The passage under the drone is drawn light in all 6 alleys tested (93% of pixels) | 6 to 8% alley colour under the drone. The alleys are not drawn through the blocks |
| Restart x2 and new city | 1 canvas, keeps updating. New city is a full page load | Same: 1 canvas, keeps updating |
| Placement, 96 samples each during a run with pops and drops | On screen and clear of every HUD box on 1280x720, 1024x600, 1920x1080, 800x500, iPhone 13, iPhone SE, Pixel 7 | Desktop: on screen, no overlap in the samples. All 3 phones: fully below the screen in 100% of samples (top 354 px on a 342 px screen) |
| Cost per frame (CDP profiler, desktop, real time, map on) | 0.036 ms. 0 when hidden | 0.10 ms |
| DOM queries per frame | 0 | 10 querySelector + 10 getBoundingClientRect, map on or hidden. About 1 getComputedStyle |
| Canvas pixels per screen pixel | dpr 1: 1.0, dpr 2: 1.0, iPhone dpr 3: 0.67 (capped at 2x) | dpr 1: 2.0 (text and icons at half size), dpr 2: 1.0, iPhone: 0.67 |

Notes on M:
- At short range (under about 30 m) the target diamond touches the drone arrow.
- The shortcut shows only as an arch at the entrance, and only while the leg's mark is at its entrance stage. There is no line to the exit.

Extra note on W: in one desktop capture (`mm-dpr2-M-vs-W.jpg`) W's map covers part of the 3D objective pill. M keeps that pill off its map.

## 3. Gemini Argon's claims about build W, checked on the running build

| # | Claim | Holds? |
|---|---|---|
| 1 | City layer and markers rotate in opposite directions, left and right mirrored. Facing east: target at 12, street at 6 | **Holds in substance, details reversed.** Facing east the street ahead is at 12 and the target dead ahead at 6. Facing north both are at 6. Facing east or west, the city's left and right are mirrored. Bearing error median 93 deg. |
| 2 | Restart or new city makes a second, frozen map and leaks | **Does not hold.** 1 canvas after 2 restarts, still updating. New city reloads the page. Only a dev hot reload can do that. |
| 3 | Desktop uses the touch layout. The chosen spot can be below the screen | **Holds, but the harm is on phones.** The code does feed the touch layout boxes on desktop. But on 4 desktop sizes the map stayed bottom-right and on screen. On all 3 phones the map is placed fully below the screen, every frame. |
| 4 | Alleys drawn on the middle of main streets | **Holds.** No alley under the drone in 6 real alleys. The code starts them at road centres. |
| 5 | About 10 querySelector and 10 getBoundingClientRect per frame, map on or hidden. This breaks the 0.5 ms budget | **Counts hold** (10 + 10 per frame, on or hidden). **Budget not broken on this desktop:** 0.10 ms a frame. A slow phone gets closer to it. |
| 6 | High-DPI fight. Text and icons at half size | **Holds at dpr 1:** a 320 px canvas in 160 CSS px, so the 14 px label shows at 7 px. Correct at dpr 2. |
| 7 | Marker stops at 135 m, arrow starts at 150 m | **Holds.** Dot pinned on the rim from 135 m, arrow only after 150 m. |
| 8 | No water margin in the static bitmap | **Technically holds, no visible harm.** Outside the bitmap the fill is a sea colour, so the corner view shows one flat sea. |

## 4. Recommendation

**Keep build M's minimap as it is. Take no code from W.** W fails the two things that matter most: direction, and being on screen on phones. None of its parts beats M's version.

Small follow-ups for M, in order:
1. Below about 30 m, the target diamond touches the drone arrow. Push it out to a minimum radius, or fade it.
2. Shortcut: add a faint dashed line from the entrance arch to the exit (Gemini's idea list), so the run reads as a way through.
3. Write "N music" in the help line and change the music chip tooltip, which still says "Music (M)".

## 5. Round 40 checks (build M)

| Check | Result |
|---|---|
| Run and delivery clocks during the crash slow motion (`clock40.mjs`, seed 22, 14 and 20 m/s head-on, 2 repeats each) | Pass. Over the 14 slow frames (time scale down to 0.08) the run clock moved 1/60 s per frame on 13 of 14. The 14th is the crash frame: -3.017 s, the 3 s charge plus that frame. runTime and legClock +1/60 on 14 of 14. With a live rush order (rush tuned to start at once): the leg time and the rush window also moved exactly 1/60 s per slow frame. |
| Speed streak shader and flat frames | Pass. fadeNear now uses ordered smoothstep edges. Flat-frame probe: 758 frames, 0 flat, 0 errors. Streak level at steady cruise (16.8 m/s) 0.17 to 0.18 (target 0.15 or more). Under 12 m/s only the fade-out from faster flight shows (it falls to under 0.01 within about a second). |
| Crash-classify, 0 pad lip, seeds 22, 58, 130 | Pass. 12 m: 20 crashes in 163 s, 0 pad lip, 0 hop-like. 20 m: 11 crashes in 215 s, 0 pad lip, 0 hop-like. (Three seeds only, so the per-minute rates are not comparable with round 39's eight seeds.) |
| Boost tail (`topspeed39c.mjs`) | Pass. Boost empties at 3.4 s. Speed stays at 22 m/s or more until about 5.05 s (1.7 s after). It reaches 18 m/s at about 6.45 s (3.1 s after, just inside). Peak slowdown 3.8 m/s^2. Caps unchanged: W only 16.8, boost peak 30.4, boost plus carving 30.0, speedbug 17.5. |
| Uncharged hits light, charged hits full (`crash39c.mjs`, seeds 22 and 58, 30 to 90 deg, 8 to 25 m/s) | Mostly pass. 134 charged hits: flip 47 to 79 deg, 14 slow frames each, full shake. 148 uncharged hits at 6 m/s or more into the wall: flip at most 24 deg, 0 slow frames. **But** at 10 to 11 m/s the uncharged knock still has the full camera shake (1.0). It also has as many sparks as a crash (up to 134). The head-on threshold is unchanged: 11 to 12 m/s gives 9 of 12 charged, 12 m/s and up all charged. Camera never in a solid, largest jump 0.46 m. |
| M toggles the map, N toggles music, help text (`keys40.mjs`) | Mostly pass. In a run M hides and shows the map, remembered after a reload. N toggles music on the title, in a run and paused. M still toggles music on the title and pause screens (as the code comment says). Help line says "M map · Esc pause". **N is not mentioned anywhere,** and the music chip tooltip still says "Music (M)", which is wrong in a run. |

## 6. Regressions (build M)

| Check | Round 40 | Round 39 |
|---|---|---|
| cam-clip30 seed 22, no orbit | 0 in solid, 0 hidden, closest 2.73 m. **1 pop of 1.05 m** in the Quill Row alley pass, where the bot also crashed | 0 pops |
| cam-clip30 seed 58, orbit | 0 in solid, 0 pops, 0 hidden | 0 pops |
| cam-clip24 phone seed 22 | 0 in solid, 0 hidden, 0 pops | same |
| climb30 desktop and phone (32 climbs each) | 0 jumps over 1 m (max 0.88 / 0.90), 0 in solid, closest 5.1 / 5.4 m | 0.88 / 0.89 |
| Wall-side framing, HUD probes (3 s after pickups and drops) | desktop 22/58/130: 0 at 40% or more, max 0.33/0.32/0.26. Phone: 0, max 0.35/0.34/0.31 | max 0.35/0.33/0.29 |
| Crash camera (crash39c) | closest 7.6 m, 0 in solid, largest move 0.46 m/frame | 0.59 |
| Hull probe, seeds 130 and 22, sweep 2 | desktop 7 leak views + 3 sweep, phone 6 + 5, 0 flat. Boat and water code did not change this round | 15 / 10 flagged with 3 seeds |
| boats32 seed 22 / boats33 4 seeds / boats31 overlap | 0 inside a hull, 0 mast, 0 stuck, longest contact 66 / 113. 0 hull on hull, 0 hull on dock, 0 in a solid | same |
| People on active pads | 0 (48 legs, 1,536 samples) | 0 |
| Traffic overlap, 3 seeds | 0 pair frames | 0 |
| Desktop HUD probe 22/58/130 | marker on controls 0, pops on the drone 0/290, 0/273, 0/283. Drone under a pill 0, **16/806 on seed 58** (under the objective pill), 0. Rerun of seed 58: 0/447, so the 16 were run noise | 0, 0, 0 |
| Phone HUD probe 22/58/130 | marker on controls 0, drone under a pill 0/0/0, pops on the drone 0, 1/235, 0 | 0 |
| Medal gate, street bot | Silver 5,702 / 3,759 / 5,323, 0 crashes. Breakdown and end screen exact | Silver 4,233 / 2,915 / 5,677 |
| Medal gate, lazy bot | Bronze 1,126 / 929 (no medal) / not measured. Breakdown exact on 22 and 58. On seed 130 the bot failed twice under the heavy machine load (a page navigation, then a stalled run with no pickup). A separate check shows the seed 130 run clock works (55.7 to 49.7 s in 6 s of flight) | Bronze 1,191 / 948 / Bronze 1,037 |
| No-delivery farm, 22 / 58 / 130 | score 0 on all | 0 |
| Cold load, no unstyled flash (8 loads, dev and production, desktop and phone) | 0 bad frames | 0 |
| Build | tsc clean. No chunk warning. Chunks: three 588 kB, game 389 kB (+12 kB). StreetAssets 45 kB, lil-gui 31 kB, three-post 19 kB, CSS 41 kB | game 377 kB |

## 7. Perf (build M)

The machine was loaded by other apps during these jobs (load average up to 25 at the end). Treat single long frames with care.

| Check | Desktop | iPhone 13 |
|---|---|---|
| Street, normal, no cap | median 3.7, **p95 7.3** | median 2.5, **p95 5.2** |
| Street, rush | median 4.3, **p95 5.7** | median 2.2, **p95 4.6** |
| Harbour: marina / sail / rib / ferry | p95 8.5 / 6.5 / 6.4 / 6.1 | p95 3.5 / 4.8 / 3.9 / 4.3 |

- All p95 under 12 ms. One 308 ms frame in the desktop sail-follow view, a one-off during heavy system load (p99 there 8.3 ms).
- Draw calls and triangles over the full spot sweep (seed 130): desktop 117 calls and 444k triangles, iPhone 101 and 415k. Under 125 and 480k. I skipped the seed 22 desktop sweep: on the loaded machine one sweep took 17 minutes.
- Street view: draw calls up to 112 desktop and 96 phone. Triangles up to 402k desktop.
- First load on the wire (production, cold): **2.78 MB**. Play ready in about 35 ms after the page, game ready 0.73 to 0.79 s.
- Minimap cost: 0.036 ms a frame on desktop (profiler).

## 8. Screenshots (progress/round-40/critic/)

41 JPEGs.

- `ab/<seed>-<device>-<spot>.jpg` (18): blind pairs, minimap crops with a 16 px margin, A left, B right.
- `ab/<seed>-<device>-<spot>-full.jpg` (18): the same pairs as full frames, A top, B bottom.
- `ab/key.json` (the side key), `ab/picks.txt` (my picks, written before the key was opened).
- `mm-orientation-M-vs-W.jpg`: facing east with the target dead ahead, facing east on a street, east along the south shore, north along the east shore. M top, W bottom.
- `mm-clamp-corner-alley-M-vs-W.jpg`: target at 140 m and 160 m, island corner, inside an alley.
- `mm-dpr2-M-vs-W.jpg`: both maps at device pixel ratio 2.
- `mm-place-iphone13-M-vs-W.jpg`, `mm-place-desk1280x720-M-vs-W.jpg`: full frames after a run of drops (W has no map on the phone).

## 9. Scripts (progress/round-40/critic-scripts/)

- Copied from round 39 (scripts only, no logs).
- New for the A/B: `mm-ab40.mjs` (matching captures), `ab-assign40.py` (random sides and key), `ab-compose40.py` (pair images).
- New for the measurements: `mm-measure40.mjs` (orientation, bearing, clamp, alley, restart, placement, cost, DPI) and `mm-domcount40.mjs` (DOM queries per frame).
- New for round 40: `clock40.mjs` (clocks in slow motion), `keys40.mjs` (M and N keys), `lazy130-check.mjs`, `queue40c.sh`, `jobs40c.txt`.
- Note: `mm-measure40.mjs` with the CDP profiler hung the W page twice (renderer at 100% CPU). Without the profiler W ran fine, so I took W's cost from one profiler run that finished and the DOM counts from `mm-domcount40.mjs`. I do not count it as a W bug.
