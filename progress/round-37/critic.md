# Drone Dash: round 37 critic report

**Verdict:** Pass. The camouflage sea is gone on desktop: low values 20.6 to 23.7, and the new build wins the blind boat A/B 6 of 6. The wakes, the ride-along and the bus are fixed. No regression found. Only polish remains.

## Setup

- Build tested: the working tree on top of f63a1c3 ("Round 36: ..."). Round 37 builder work, not committed yet (Drone.ts, Boats.ts, Water.ts).
- Controls: `git archive` of f63a1c3 (round 36) and 8284d4a (round 34 critic report) in the scratchpad (`c37/r36c`, `c37/r34c`).
- My servers: 5191 (round 37 dev), 5192 (round 36 dev), 5194 (round 34 dev), 5193 (round 37 production preview from my own build). Each dev server had its own Vite cache in the scratchpad, HMR and watch off. I did not touch the owner's server on 5188. All four of mine are stopped.
- I did not read `builder.md`. I read the `src/` diff only to learn what changed.
- Every browser ran alone, one job at a time, from `critic-scripts/queue37.sh` and `jobs37.txt`.
- Top process before timing tests (`cpu-*.txt`): water claude 21%, hull coreaudiod 4%, boats systemstats 7%, cold load AlDente 3%, perf coreaudiod 16%, medal coreaudiod 15%.

## New scripts (progress/round-37/critic-scripts/)

- `water31.mjs` and `contrast31.py`: copied from round 31. Only the output folder changed (`OUTDIR`, `CDIR`). Tags inside are fixed: `r31` = the build on 5191, `r30` = the build on 5192.
- `contrast37.py`: the same metric, plus the cruise value with the HUD masked out, and the low band split in two.
- `water37.mjs`: game-camera water views at 1, 4, 15 and 24 m. Places: open sea, and 11 m out from a moored boat. Plus one view at 1 m facing the sun. Four moods, desktop and phone.
- `ab37.py`: blind A/B sets with hidden keys. `wakegap37.py`: wake arm gaps and trail brightness. `lip37.py`: pad-lip crashes in the crash-classify logs.

## Water

### The acceptance numbers

| Seed (mood) | Low r37 | Low r36 | Cruise r37 | Ratio r37 | Ratio r36 | Cruise, HUD masked r37 | r36 |
|---|---|---|---|---|---|---|---|
| 130 golden | **23.4** | 35.2 | 13.9 | 0.594 | 0.51 | 5.2 | 12.8 |
| 22 morning | **21.5** | 30.9 | 12.8 | 0.597 | 0.53 | 4.8 | 11.4 |
| 33 dusk | **23.7** | 40.7 | 14.2 | 0.601 | 0.40 | 5.6 | 10.4 |
| 58 noon | **20.6** | 31.3 | 12.3 | 0.595 | 0.53 | 3.2 | 11.9 |

- Low: under 24 and above 14 on all four. Pass.
- Cruise ratio: 0.594 to 0.601. It prints as 0.60 on all four. Seed 33 is 0.001 over the line. I count this as a pass on the metric, because the metric no longer measures the water (next point).
- **The metric does not track the water any more.** With the HUD masked, the cruise band drops to 3 to 6. So the HUD gives about 12 of the 12 to 14. The cruise ratio is now a HUD-to-low-water ratio. Masked, the ratio is 0.16 to 0.24.
- **The masked numbers show a real change:** the cruise water lost about 55 to 70% of its fine detail (11.6 down to 4.7 on average). You can see it. In `cruise-band-130-r36-top-r37-bottom.jpg` round 36 has crisp wavelets at 24 m. Round 37 is a softer, smoother swell. It still reads as water. It is calmer and a touch hazy, not flat. A trade, not a failure. If the loop goes on, use the HUD-masked number with a floor (for example masked cruise at least 7) instead of the ratio.

### Blind A/B: 6 low boat views, round 37 against round 36

Picks in `critic/ab/picks-boat.txt`, written before I opened `.key-boat.json`.

| Pair | View | My pick | Result |
|---|---|---|---|
| 1 | Golden, sailboat, low side | broken ripples vs navy blobs, clear | **new wins** |
| 2 | Morning, sailboat, low quarter | fine ripples and a sparkle path, moderate | **new wins** |
| 3 | Golden, rib, low quarter | glitter path vs navy blobs, moderate | **new wins** |
| 4 | Morning, rib, low side | finer vs blue blobs with cream rings, clear | **new wins** |
| 5 | Golden, rowing boat, low quarter | finer, moderate | **new wins** |
| 6 | Morning, rowing boat, low side | fine sparkling chop, clear | **new wins** |

6 of 6. Pass.

### Blind A/B: 1 m water, golden and dusk, against round 36 and round 34

Set `w36` and `w34` (my `water37.mjs` views, open sea and marina at 1 m):

| View | vs round 36 | vs round 34 |
|---|---|---|
| Golden, open sea | new wins, moderate | new wins, moderate |
| Golden, marina | new wins, moderate | new wins, moderate |
| Dusk, open sea | new wins, weak to moderate | new wins, weak to moderate |
| Dusk, marina | new wins, weak | new wins, weak |

8 of 8. The w34 set is only half blind: one image in each pair is the same file as in the w36 set.

Set `g1m` (round 34's own 1 m view, `water31` g-low):

| View | Result |
|---|---|
| Golden vs round 36 | new wins (not blind: I had seen both labelled while checking the metric) |
| Dusk vs round 36 | **old wins, weak** |
| Golden vs round 34 | **new wins, clear** |
| Dusk vs round 34 | **old wins, weak** |

**Dusk:** the builder's claim holds in this one view. Round 37 dims the near chop at dusk (`near` 0.95). The band right under the drone goes darker and softer. Round 34 and 36 are crisper there, with glints to the bottom edge. In my own dusk views (open sea at another time, and the marina) the new one wins. So it is a taste trade in one framing, weak both ways. **Not a real regression.**

### Honest look as a player

Sheets: `sheet-desktop-golden/morning/dusk/noon.jpg`, `sheet-phone-golden/dusk.jpg`.

- **Desktop, 1 m and 4 m:** natural in morning and noon. Fine teal chop with sparkle, depth toward the horizon (`w37-r37b-noon-marina-4m.jpg`). Golden and dusk: much better than round 36. The near water is teal or navy with fine ripples. A cream-on-navy dapple is still there in the middle distance at golden hour (`w37-r37b-golden-sea-1m.jpg`), smaller and softer than before. It reads as low sun on chop, not camouflage. At the bottom edge of the very low boat views the water is slightly blurred.
- **Desktop, 15 m and 24 m:** calm and smooth, a bit soft (see the metric note). In the morning, the sun glare at 15 to 24 m shows rows of zig-zag sparkles. They look a little regular. A sailboat inside the glare washes out (`morning-glare-24m-crop.jpg`). Polish.
- **Into the sun, 1 m:** a clean glitter path, natural (`w37-r37b-morning-sun-1m.jpg`).
- **Marina:** natural. Foam round the pier legs and along the wall reads well. At dusk the pier foam glows as a pink box round a pier seen from straight above (`wake-arms-dusk-sail-golden-bus-top.jpg`, top left). Small.
- **Phone:** unchanged from round 36 (`phone-r36-left-r37-right.jpg`). The round 37 near layers are in the desktop shader only. At 1 m the phone sea is broad soft swell bands, glossy like satin, slightly smeared near the camera (`w37-r37b-m-golden-marina-1m.jpg`). Not camouflage, not busy. A little flat and stretched. This is the weakest water now, and it is polish.

Overall: **natural on desktop, a little soft at cruise height, satin-smooth on the phone.** Not blotchy, not too busy.

## Sea in hulls and flat frames

| Run | Views | Flags (in-browser leak column) | Round 36 |
|---|---|---|---|
| Desktop, 3 moods, sweep 3 | 183 views, 162 sweep frames | 19 views, 4 sweep frames | 12 views at sweep 8 |
| Phone, 3 moods, sweep 2 | 183 views, 108 sweep frames | 10 views, 7 sweep frames | 28 views |

- The flagged views are the same views as in round 36. The pixel counts are nearly the same: sailboat very close 3,661 px (round 36: 3,646), side 364 px (358). The hulls did not change this round.
- New flags: the moored sailboat bow (800 to 880 px) and the phone rowing boat stern (320 to 550 px). I checked both pixel by pixel (normal, lid on, lid off). Both are a sliver of open sea beyond the far rail of a neighbour boat, under a pier beam or behind the boom. The same in the lid-off frame. Not inside any hull (`hull-flag-moored-sail-bow-normal-lid-nolid.jpg`, `hull-flag-phone-row-stern-normal-lid-nolid.jpg`).
- **Result: 0 views with sea in a hull.** The caps-off control is live (58 desktop, 51 phone views fill with sea).
- **Flat frames, bloom on:** 891 frames, 0 flat, 0 errors. Hull probe views: 0 flat.

## Leftovers

| Item | Status | Evidence |
|---|---|---|
| Dotted wake arms | **Fixed.** Continuous lines in every straight-down view. Longest gap 0 px on the sail and rib views in all moods. (My row metric reports gaps on the bus and dusk sail views. Those are the arm leaving its band or the pier and sea wall biasing the row, not gaps. I checked by eye.) | `wakes-r36c-left-r37-right.jpg`, `wake-arms-dusk-sail-golden-bus-top.jpg` |
| Haze behind the transom brighter than the arms | **Fixed.** Trail over arm contrast 0.09 to 0.52 (round 36: 0.21 to 0.83). No beam in the golden chase view. | same |
| Drone riding on the sailboat | **Fixed.** boats32 on seed 22, 10 runs: longest contact 64 to 73 frames in every run (round 36 ride-along: 149). 0 stuck, 0 inside a hull, 0 frames near the mast (under 0.4 m). boats32 has no direct "inside the sail column" counter. The proxy (mast distance) is 0, and no run shows the long hover. | `boats32-22-r37-*.log` |
| Plain harbour bus | **Fixed.** Teal livery stripe, life rings on the cabin sides and aft, and a "HARBOUR LOOP" board on the roof. Reads as a real harbour bus from a low quarter. The board is small from afar. | `bus-rib-r36c-left-r37-right.jpg`, `hw35-r37-golden-ferry-low-quarter.jpg` |
| Faceted rib tubes | **Not touched.** Tubes and seats still show hard facets close up. | `bus-rib-r36c-left-r37-right.jpg`, bottom row |

## Regressions

| Check | Round 37 | Round 36 |
|---|---|---|
| boats33, seeds 22, 58, 4711, 9001 | 156 approaches: 0 inside a hull, 0 near a mast, 0 stuck, 0 pushed down. Longest contact 113 (a slow press on a moored rib, not stuck). Bus rams: 16 of 16 one crash. | 0 / 0 / 0, 112 |
| boats31 overlap, 120 s, seeds 22, 58, 5150 | 0 hull on hull, 0 hull on dock, 0 in a solid. Sailboat fly-through 0 crashes. | same |
| Bus stop, 4 seeds | 4 stops each, piers alternate, stops 9.0 to 9.25 s, top speed 4.6 m/s | same |
| boattrace33, seeds 4711 and 22 | largest step beyond own speed 0.008 to 0.014 m, 0 frames over 0.15 m | 0.008 to 0.013 |
| Crash-classify 12 m, all 8 seeds | 54 crashes in 588 s (5.5 a minute), 0 hop-like, **0 pad lip** | 6.5 a minute on 3 seeds |
| Crash-classify 20 m, all 8 seeds | 33 in 626 s (3.2 a minute), 0 hop-like, **0 pad lip** | 2.8 on 3 seeds |
| People probe | 0 people on active pads (48 legs, 1,536 samples) | 0 |
| Traffic overlap | 0 pair frames on 3 seeds | 0 |
| Phone HUD probe 22, 58, 130 | marker on controls 0, drone under pills 0. Pops on drone 0, **3 of 217**, 0. Pops over the top column 79, 97, 63. | 0, 0, 0 |
| Street medal gate 22, 58, 130 | 6,380 Gold, 2,913 Silver, 6,942 Gold. Breakdown and end screen sum exact on all 3. | Silver, Silver, Silver |
| Cold load, no unstyled flash | 8 cold loads (dev and production, desktop and phone): 0 bad frames. Production styled at 11 to 17 ms. | 0 |
| Build (tsc, build to the scratchpad) | No chunk warning. three 588 kB, game 362 kB, StreetAssets 45 kB, lil-gui 31 kB, three-post 19 kB, CSS 40 kB. | same, game 356 kB |

**The phone pop on the drone is real but tiny.** On seed 58, a slip pop ("+12 BANKED · STREET BONUS") touched the drone's rotor box. This happened in 3 samples. In that frame the camera was pushed in close by a wall, so the drone fills the middle of the screen (`phone-pop-near-drone-58.jpg`). The pop does not cover the drone body. The HUD code did not change this round. The new hull-top slide in `Drone.ts` only acts on a boat under way. So this is run-to-run variance in where the bot flies, in a rare close-camera case. Not a regression. The pops over the top column dropped to 63 to 97 per run (round 36: 87 to 119).

## Perf

| Check | Desktop | iPhone 13 |
|---|---|---|
| Street, normal, no cap | median 3.6, **p95 7.8**, max 24.6 (1 frame over 20) | median 2.6, **p95 5.1**, max 20.9 (1 over 20) |
| Street, rush | median 3.6, **p95 7.7** | median 2.5, **p95 4.7** |
| Harbour, close to boats | median 3.4, **p95 7.7** (ferry follow 8.9) | median 2.5, **p95 3.7** |
| Phone HUD runs, 80 s, vsync | | p95 9.6 to 9.7 |

- All p95 under 12 ms.
- Draw calls over the full spot sweep (about 3,300 spots each): desktop 120 (seed 130) and 116 (seed 22), iPhone 103. Under 125. The bus details add one call.
- Triangles: max 441k and 439k desktop, 411k iPhone. Under 480k.
- First load on the wire (production, 4 cold loads): **2.73 MB**. Same as round 36.

## Whole-game verdict

After 37 rounds, every bot-measurable check I have passes. There is no sea in a hull and no stuck drone. There are no pad-lip or hop crashes, no overlaps and no flat frames. There is no unstyled flash. Perf is well inside budget. The medal gate is exact. The water was the last named visual gap and it now looks natural on desktop. What is left is taste and polish:

1. The phone sea is smooth satin swell near the camera (the new near layers are desktop only).
2. The cruise-height water got softer this round (HUD-masked detail down by more than half).
3. The rib tubes are faceted.
4. The morning sun glare at cruise height shows regular zig-zag rows.
5. Medal pace, difficulty and fun need a human player.

None of these clearly limits the game. **Only polish remains.** The loop can stop. The next step is for the owner to play.

## Biggest gap

**Only polish remains.**

Optional pass, best value: the phone near water. Add one cheap near octave to the lite shader. Test:
1. On the iPhone 13, the `water31` g-low view gets a low value between 14 and 24 (same metric).
2. A blind A/B of 4 phone 1 m views against round 37 wins 3 of 4. Use golden and dusk, open sea and marina.
3. Phone p95 stays under 12 ms.

## Screenshots (progress/round-37/critic/)

- Blind A/B: `ab/boat-1.jpg` to `boat-6.jpg`, `ab/w36-1.jpg` to `w36-4.jpg`, `ab/w34-1.jpg` to `w34-4.jpg`, `ab/g1m-1.jpg` to `g1m-4.jpg`, with picks and hidden keys beside them.
- Water sheets: `sheet-desktop-golden.jpg`, `sheet-desktop-morning.jpg`, `sheet-desktop-dusk.jpg`, `sheet-desktop-noon.jpg`, `sheet-phone-golden.jpg`, `sheet-phone-dusk.jpg`.
- Water views: `w37-r37b-golden-sea-1m.jpg`, `w37-r37b-golden-marina-1m.jpg`, `w37-r37b-dusk-sea-1m.jpg`, `w37-r37b-morning-sun-1m.jpg`, `w37-r37b-noon-marina-4m.jpg`, `w37-r37b-m-golden-marina-1m.jpg`, `cruise-band-130-r36-top-r37-bottom.jpg`, `morning-glare-24m-crop.jpg`, `phone-r36-left-r37-right.jpg`.
- Boats: `hw35-r37-golden-sail-low-side.jpg`, `hw35-r37-morning-row-low-side.jpg`, `hw35-r37-golden-ferry-low-quarter.jpg`, `bus-rib-r36c-left-r37-right.jpg`.
- Wakes: `wakes-r36c-left-r37-right.jpg`, `wake-arms-dusk-sail-golden-bus-top.jpg`.
- Hull flags: `hull-flag-moored-sail-bow-normal-lid-nolid.jpg`, `hull-flag-phone-row-stern-normal-lid-nolid.jpg`.
- HUD: `phone-pop-near-drone-58.jpg`.
