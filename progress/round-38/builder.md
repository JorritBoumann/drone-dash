# Drone Dash: round 38 builder notes

Polish round from the round 37 critic list, done in order: 1 masked water metric, 2 cruise water detail, 3 phone near water, 4 phone pops off the top column, 5 rib tubes.

Setup:
- Build: the working tree on top of e733ab3 (round 37). Controls: `git archive` of e733ab3 (round 37) and f63a1c3 (round 36) in the scratchpad (`r38/r37c`, `r38/r36c`).
- My servers, each with its own Vite cache in the scratchpad and HMR off: 5190 (round 38 dev), 5192 (round 37 control), 5193 (round 36 control), 5195 (production preview of my own build in the scratchpad). The owner's 5188 was not touched. All four of mine are stopped.
- Browser jobs ran one at a time (by hand, then from `builder-scripts/queue38.sh` with `jobs38.txt` and `jobs38c.txt`, logs in `queue38.log` and `queue38c.log`). One slip: after I re-queued the final boat checks, a second queue instance started by mistake and two hull-probe browsers overlapped for about 30 s. I killed both and re-ran that job alone. No result below comes from the overlap.
- Scripts: copied from the round 37 critic scripts (which include the round 36, 34, 31 and 25 ones). Only the output folders changed (scratchpad `r38/shots/`, `builder-shots/`) and the default port 5191 to 5190.
- New scripts:
  - `water38.mjs`: water views with and without the HUD, plus the DOM rects.
  - `contrast38.py`: the masked metric.
  - `ab38.py`: blind A/B.
  - `gpu38.mjs`: water GPU time.
  - `ribshot38.mjs`: rib close-ups.
  - `blender_rib38.py`: the Blender pass.
- Time used: 06:40 to about 07:45.

## 1. Water metric with the HUD masked (`contrast38.py`, `water38.mjs`)

`water38.mjs` uses the water31 game-camera views (g-cruise: drone at 24 m facing the sea. g-low: drone at 2 m) with the same set-up. It shoots each view twice:
- **hud**: as the player sees it. The old metric (`contrast31.py`, unchanged) runs on this shot.
- **clean**: every DOM element is hidden except the game canvas (CSS `visibility: hidden` on everything, `visible` on `#game-canvas`). So no HUD or overlay pixel can reach the metric. **This is the metric from now on.**

It also saves the rect of every visible DOM element. `contrast38.py` uses them as a cross-check: the hud shot with every rect (grown by 6 px) masked out. Rects over 20% of the frame are skipped: the full-screen HUD layer and empty containers. The bands are fractions of the frame height, so phone shots use the same part of the view.

| Seed | Old cruise r36 | Old cruise r37 | **Masked cruise r36** | **Masked cruise r37** | Rect cross-check r36 / r37 | Low r36 / r37 (no HUD in the band) |
|---|---|---|---|---|---|---|
| 130 golden | 18.63 | 14.14 | **14.27** | **5.94** | 14.51 / 6.42 | 35.16 / 23.41 |
| 22 morning | 16.80 | 12.93 | **12.68** | **5.24** | 12.40 / 4.76 | 31.07 / 21.97 |
| 33 dusk | 16.51 | 15.00 | **10.23** | **6.87** | 10.87 / 7.68 | 40.24 / 23.60 |
| 58 noon | 17.04 | 12.23 | **13.30** | **3.60** | 13.46 / 3.60 | 31.16 / 20.66 |

- The HUD adds about 4 to 9 to the old cruise value. With it masked, round 37 kept only 27 to 67% of the round 36 cruise detail (average 41%). This matches the critic's numbers from fixed boxes (critic: r36 10.4 to 12.8, r37 3.2 to 5.6). The fixed boxes missed some HUD pixels, so my r36 values are a little higher.
- The low band has no HUD pixels: old and new are the same.

## 2. Cruise-height water: fine detail back, calm kept (`src/world/Water.ts`)

**Cause.** From height, round 37 cut the slope of the normals that the Fresnel and the reflection use at grazing angles. The new values were 0.25 and 0.3 (`HI_FRES_S`, `HI_REFL_S`). It also lowered the mid and fine layers from height (`HI_MID` 0.26 to 0.17, `HI_FINE` 0.22 to 0.15). The far band at cruise height is all grazing angles, so its sky reflection went smooth and hazy.

**Fix.** Only values that act from height (`hiK`, full from 20 m camera height) changed. The low views keep the round 37 look:
- `HI_FRES_S` 0.25 to 0.6 and `HI_REFL_S` 0.3 to 0.72: the far band keeps crisp wavelet rows in the sky reflection.
- `HI_MID` 0.17 to 0.21 and `HI_FINE` 0.15 to 0.19.
- Noon `chop` 0.68 to 0.76. Noon was the flattest from height.

Masked metric (final build):

| Seed | Masked cruise r36 | r37 | **r38** | **r38 / r36** | Low r37 | Low r38 |
|---|---|---|---|---|---|---|
| 130 | 14.27 | 5.94 | **10.10** | **71%** | 23.41 | 23.66 |
| 22 | 12.68 | 5.24 | **8.95** | **71%** | 21.97 | 22.09 |
| 33 | 10.23 | 6.87 | **8.15** | **80%** | 23.60 | 23.76 |
| 58 | 13.30 | 3.60 | **9.29** | **70%** | 20.66 | 20.70 |

All four are in the 60 to 80% target (seed 33 sits at the top edge). The low values did not move (within 0.25). The old metric (HUD showing) now reads 14.6 to 16.1.

**Blind A/B, 4 cruise views, round 38 against round 37** (`ab38.py cruise`, HUD showing). `ab38.py` wrote the key together with the pairs. My picks were written to `builder-shots/ab/picks-cruise.txt` before I opened the key.

| Pair | View | My pick | Result |
|---|---|---|---|
| 1 | Golden, open sea, 24 m | crisper far wavelets, less haze, moderate | **new wins** |
| 2 | Morning, marina, 15 m | more sparkle and ripple, weak to moderate | **new wins** |
| 3 | Dusk, marina, 24 m | more ripple texture, weak to moderate | **old picked** |
| 4 | Noon, open sea, 15 m | defined ripples, less haze, moderate | **new wins** |

**3 of 4, not the 4 of 4 asked for.** On pair 3, the round 37 and round 38 frames are close to identical. The water region measures 9.39 (r37) against 9.40 (r38) on the same metric. The steep 24 m marina view has almost no grazing water, so this round's change barely touches it. In fact it is a tie. By my written pick it is a loss, and I report it as one. I did not re-run the A/B to get a better count.

Sheets: `builder-shots/cruise-band-130/58/33-r36-r37-r38.jpg` (the far band, HUD hidden). In each, round 38 sits between the crisp round 36 and the soft round 37.

## 3. Phone near water: the near layers on touch devices (`src/world/Water.ts`)

- The round 34 and round 37 near block is now one template for both shaders. The phone (lite) shader gets the two near octaves (about 0.6 m and 0.2 m ripples, footprint-faded as on desktop), not the capillary octave. These are two texture fetches, only within 45 m of a camera under 8 to 13 m. The phone mixes them in at 0.7 (desktop: 0.85). Thus the coarser swell still shows through, and the edge of the near zone does not read as a ring.
- The phone gets its own 128 px near texture (desktop 256 px).
- The phone still has no fine (d2) layer. Only the near zone changed.

Results (iPhone 13 profile, final build):
- **Perf, harbour (perf-harbour35, uncapped, no CPU slowdown): marina p95 4.3 ms**, sail follow 6.0, rib follow 4.1, ferry follow 5.2. All phone frames: median 2.3, p95 4.9, max 15.8, none over 20 ms. Round 37 (critic): 3.7 at the harbour.
- **GPU cost** (`gpu38.mjs`: timer query, water on minus water off, median of 25 frames, 1500x684 drawing buffer). Two runs each:

| View | r38 water ms | r37 water ms |
|---|---|---|
| Sea, 1.5 m | 1.88 / 1.87 | 1.96 / 1.77 |
| Sea, 4 m | 2.02 / 2.02 | 1.90 / 1.98 |
| Marina, 1.5 m | 1.39 / 1.29 | 1.34 / 1.40 |
| Marina, 4 m | 1.36 / 1.38 | 1.47 / 1.26 |

  The difference is within run-to-run noise (about ±0.1 ms). The cost is small because the near layers only draw on a few pixels near the camera and the rest of the shader is unchanged. The desktop timer numbers (`gpu38-d.log`) are too noisy with bloom on to use. Some come out negative.
- Phone water metric (`MOBILE=1 contrast38.py`, HUD hidden): low 16.71, 16.38, 15.98, 14.74 (round 37: 16.54, 16.30, 15.65, 14.67). That is inside the critic's 14 to 24 band. The g-low band mostly sits beyond the near zone, so it barely moves. Masked cruise on the phone: 9.9, 10.3, 7.8, 9.1 (round 37: 4.8, 6.0, 6.5, 3.9). The cruise change reaches the phone too.

**Blind A/B, 4 phone low views, round 38 against round 37** (`ab38.py phone`). Picks were written to `builder-shots/ab/picks-phone.txt` before I opened the key.

| Pair | View | My pick | Result |
|---|---|---|---|
| 1 | Golden, open sea, 1 m | fine broken chop against satin bands, moderate to clear | **new wins** |
| 2 | Golden, marina, 1 m | fine ripples against smooth gloss, clear | **new wins** |
| 3 | Dusk, open sea, 1 m (ferry passing) | finer near ripples, moderate | **new wins** |
| 4 | Dusk, marina, 4 m | ripple texture at the bottom against soft navy shapes, moderate | **new wins** |

**4 of 4.** Sheets: `builder-shots/phone-22-morning-sea-1m-r37-r38.jpg`, `phone-58-noon-marina-1m-r37-r38.jpg`, `phone-130-golden-sea-4m-r37-r38.jpg`.

## 4. Phone pops below the top column (`src/ui/Hud.ts`, `src/styles.css`)

**Cause.** The round 26 rule lifted a tall pop (two-line hint, medal banner) so its bottom stayed above the stick's "Fly" label. On the iPhone, those pops do not fit between the score column and the stick. So they climbed into the objective pill and the score panel. The slot's upper edge also used only 0.6 of the pill height.

**Fix (`Hud.touchPlace`).**
- When a pop shows, it measures its own size. Then its top edge stays below every top-column box that shares its columns. These boxes are the score panel, the centre column (timer, objective pill, route hint) and the right chips. The pop stays clear of those boxes through the whole animation: the pop-in overshoot, and the rise as it fades (up to 0.74 of its height for the payout pop).
- If it cannot also stay above the Fly label, the pop goes compact (`pop-squeeze`: smaller type, no icon or rays) and is measured again. If it still does not fit, the top column wins.
- The HUD measures the touch layout again every 300 ms. Each time, the pop that is up is placed again, because a combo chip or route hint can grow under it. There is no layout read per frame.
- The x placement did not change (the round 24 slot left of the drone). The desktop path did not change.

Results (hud-probe34 with pop34-init, NEW player, iPhone 13, 80 s, the round 37 critic's command):

| Seed | Pops over the top column (POP34 `hit`) | Pops on the drone (HUDPROBE) | Marker on controls | Drone under pills |
|---|---|---|---|---|
| 22 | **0** (r37: 117 event-pop samples and more) | 0 of 233 | 0 | 0 |
| 58 | **0** | 2 of 249 (**0.8%**), slip pop in a close wall camera (drone box 348 px wide), as in round 37 | 0 | 0 |
| 130 | **0** | 0 of 221 | 0 | 0 |

Round 37 (critic): 79, 97 and 63 over the top column. The "Slipstream" hint and every other pop now stay clear of the objective pill, the pills and the meters. POP34 `off` (part of a pop past the screen edge) is 12, 9 and 12, the same as round 37's 12. Fly-label hits: 0.

## 5. Rib tubes (`public/assets/models/boats.glb`, Blender)

- Blender 5.2.2 through the MCP, in the unsaved round 35/36 scene. No .blend file was saved. No new asset (still the CC0 Quaternius lifeboat) and no generation. Script: `builder-scripts/blender_rib38.py`. Logged in `ASSETS.md`.
- Hull (tubes, white bands, rubbing strake): every edge under 62 degrees gets one cut, with the new points moved onto the smooth surface. The tube cross-section goes from 8 to 16 sides and the bow cone rounds off. The 90-degree creases stay.
- Seats: smooth shading across their sides only. A first try cut them as well, and the smoothing pinched the long thin cylinders into peanut shapes. I threw that try away.
- Rib: 626 to 1,908 triangles. boats.glb: 459 KB to 500 KB. Textures unchanged.
- Shots: `builder-shots/rib-quarter-crop-r37-left-r38-right.jpg`, `rib-quarter/side/high-r37-left-r38-right.jpg`. The tubes and bands read round. Some soft lengthwise shading bands remain where the original segments were.

## Regressions and budgets (final build unless noted)

| Check | Round 38 | Round 37 (critic) |
|---|---|---|
| Hull probe, desktop, 3 moods, sweep 3 (final rib) | 18 flagged views, 4 sweep frames. All 18 are in the round 37 flagged set (slivers of sea beyond a neighbour's rail). 0 rib flags. **0 views with sea in a hull**. Flat 0. | 19 / 4 |
| Hull probe, phone, sweep 2 (final rib) | 12 views, 7 sweep frames. Two not in the round 37 set: the moored rowing boat "very close", 1 px and 13 px. I checked the 13 px mask: the boat's inside is all wood, no water. 0 rib flags. **0 in a hull**. Flat 0. | 10 / 7 |
| Flat frames, bloom on (acceptance-probe) | 941 frames, 0 flat, 0 errors | 891, 0 |
| boats32, seed 22, 3 runs on the final rib (plus 7 on earlier rib passes) | longest contact 64 to 67 (all 10: 64 to 76), 0 inside a hull, 0 near a mast, 0 stuck, 0 dropped | 64 to 73 |
| boats33, 4 seeds, 156 approaches | 0 inside a hull, 0 near a mast, 0 stuck, longest contact 114 | 0, 113 |
| boats31 overlap, 120 s, seeds 22, 58, 5150 | 0 hull on hull, 0 hull on dock, 0 in a solid, fly-through 0 crashes | same |
| Bus stop, 4 seeds | 4 stops each, piers alternate, 9.0 to 9.25 s, top speed 4.6 | same |
| boattrace33, 4711 and 22 | largest step beyond own speed 0.013 m, 0 frames over 0.15 m | 0.008 to 0.014 |
| Crash-classify 12 m, seeds 22, 58, 130 | 20 crashes in 184 s (6.5 a minute), 0 hop-like, **0 pad lip** (`lip37.py`) | 6.5 a minute on 3 seeds (r36) |
| Crash-classify 20 m, seeds 22, 58, 130 | 10 in 233 s (2.6 a minute), 0 hop-like, **0 pad lip** | 2.8 (r36) |
| People probe | 0 people on active pads (48 legs, 1,536 samples) | 0 |
| Traffic overlap | 0 pair frames on 22, 130, 58 | 0 |
| Desktop HUD probe, seed 22 (NEW) | marker hits 0, drone under pills 0, pops on drone 1 of 310 (0.3%, medal banner), POP34 top-column hits 0. One minor: `#pop>#nav-distance` 3 samples. The desktop pop path is unchanged. | n/a |
| Street medal gate 22, 58, 130 (route-play-rt-x-m-esc17, low line, 600 s) | 5,628 Silver, 3,552 Silver, 5,277 Silver. **Breakdown exact on all 3** (`medal-sum29.py` bdOk). 0 crashes. | Gold, Silver, Gold (round 36: Silver x3) |
| Cold load, no unstyled flash (fouc34, dev 5190 and prod 5195, desktop and iPhone, 2 runs each) | 8 of 8 with 0 bad frames | 0 |
| Kept as asked | bloom clamps in `ObjectiveMarker.ts`, the `#app` visibility rule in `index.html` and `styles.css`, the debug hooks: not touched | |

The medal-gate tiers are lower than in round 37's run: Silver on all three, the same as round 36. This bot plays in real time, and its scores swing between runs. Nothing this round touches flight, scoring or the street. The only HUD change is where phone pops sit, and this bot plays desktop-size. I report the tiers as measured.

Budgets:

| Budget | Round 38 |
|---|---|
| Draw calls, full sweep | desktop 116 (seed 130) and 116 (seed 22), iPhone 101. Under 125. |
| Triangles, full sweep | desktop 447k (130) and 446k (22), iPhone 417k. Under 480k (round 37: 441k, 439k, 411k). |
| p95 frame time, desktop | street normal 9.3, rush 7.9, harbour 8.4 overall (ferry follow 10.0). Uncapped. |
| p95 frame time, phone | street normal 6.2, rush 5.4, harbour 4.9 overall, marina 4.3. Uncapped. |
| First load | 2.78 MB on the wire (production, 4 cold loads. Round 37: 2.73 MB) |
| Build | tsc clean, no chunk warning. three 588 kB, game 363 kB, StreetAssets 45 kB, CSS 40 kB. |

The desktop street p95 (9.3) is higher than round 37's critic run (7.8). The same run had 9 frames over 20 ms and one 51 ms frame, which looks like machine load. Round 38 does not change street rendering. It stays under 12 ms.

## Files changed

- `src/world/Water.ts`: cruise-height constants (`HI_MID`, `HI_FINE`, `HI_FRES_S`, `HI_REFL_S`), noon chop, near layers shared with the phone shader (`NEAR_MIX_LITE`), a 128 px near texture on the phone, shader cache key `water38`.
- `src/ui/Hud.ts`: `touchPlace` (touch pop placement below the top column, compact fallback, re-placement on re-measure).
- `src/styles.css`: the `pop-squeeze` compact rule for touch pops.
- `public/assets/models/boats.glb`: smoother rib (tubes, bands, seats).
- `ASSETS.md`: round 38 rib entry.
- `progress/round-38/`: `builder-scripts/` (copied and new scripts, logs, A/B picks and keys in `builder-shots/ab/`) and `builder-shots/` (comparison sheets).

## Not done or open

- The cruise A/B came out 3 of 4, not 4 of 4 (pair 3 is in fact a tie, see section 2).
- The morning glare zig-zag rows at cruise height (round 37 critic, polish item 4) were not on this list and were not touched. The higher Fresnel slope from height may make that glare a little busier. I did not measure it.
- No git commits (as asked).
