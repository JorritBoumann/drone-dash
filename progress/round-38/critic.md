# Drone Dash: round 38 critic report

**Verdict:** Pass with one miss. Items 1, 3, 4 and 5 pass. Item 2 passes on the metric (71 to 80% of round 36) but not on my blind A/B: the new cruise water won 2 of 4 and lost 2 weakly. No regression found. Only polish remains.

## Setup

- Build tested: the working tree on top of e733ab3 ("Round 37: ..."). Round 38 changes are not committed yet (Water.ts, Hud.ts, styles.css, boats.glb, ASSETS.md).
- Controls: `git archive` of e733ab3 (round 37, port 5192) and f63a1c3 (round 36, port 5194) in the scratchpad (`c38/r37c`, `c38/r36c`).
- My servers: 5191 (round 38 dev), 5192 (round 37 dev), 5194 (round 36 dev), 5193 (round 38 production preview of my own build). Each dev server had its own Vite cache in the scratchpad, HMR and watch off. I did not touch the owner's server on 5188. All four of mine are stopped.
- I did not read `builder.md`. I read the `src/` diff only to learn what changed.
- Every browser ran alone, one job at a time, from `critic-scripts/queue38.sh` and `jobs38.txt`.
- Top process before timing tests (`cpu-*.txt`): hull Chrome renderer 19% (the owner's own Chrome), boats WindowServer 20%, cold load Chrome 15%, first perf WindowServer 21%, medal Brave 25%, perf rerun Chrome 53%.
- One slip on my side: a video encode ran at the same time as the first perf pass. I threw those perf numbers away and ran all four perf jobs again at the end, alone.

## New scripts (progress/round-38/critic-scripts/)

- Copied from round 37 critic and round 38 builder: only output folders and the default port changed (`water38.mjs`, `contrast38.py`, `ribshot38.mjs`, `gpu38.mjs`, `ab38.py`).
- `cleancheck38.mjs`: checks the "clean" water shot has no DOM pixel (hides the canvas too, the rest must be plain page background).
- `maskcheck38.py`: does the rect mask cover every pixel where the HUD shot differs from the clean shot.
- `ab38c.py`: the builder's A/B maker with my own views (clean shots) and output in `critic/ab/`.
- `explore-media38.mjs`, `media-shots38.mjs`, `video-pilot38.js`, `video38.mjs`, `encode38.mjs`: the gemini media (see the end).

## Item 1: water metric that masks the HUD

**Pass.** `contrast38.py` has two masked values. The main one uses a "clean" shot where every DOM element is hidden and only the game canvas is drawn.

- I checked the clean shot directly. In the same state I also hid the canvas. What is left must be the page background. Desktop and phone, cruise and low views, seeds 130 and 33: **0 pixels** differ from the background. No element or `::before`/`::after` still computes as visible. So the clean shot has no HUD or overlay pixel at all.
- The rect-masked cross-check is close but not perfect. In each cruise shot 1 to 130 pixels stay in. They come from the soft shadow under the pause button. It reaches 6 to 13 px below its box (luminance difference up to 21). That is under 0.05% of the band. It only affects the cross-check, not the main metric.
- The low band has no HUD pixel at all on desktop (HUD and clean values are identical).

## Item 2: more fine detail in cruise-height water

**Metric: pass. Blind A/B: miss (2 wins, 2 weak losses).**

| Seed (mood) | Cruise clean r38 | r37 | r36 | r38 / r36 | Low r38 | Low r37 |
|---|---|---|---|---|---|---|
| 130 golden | 10.12 | 6.00 | 14.27 | **0.71** | 23.6 | 23.4 |
| 22 morning | 8.95 | 5.25 | 12.67 | **0.71** | 22.0 | 21.9 |
| 33 dusk | 8.14 | 6.81 | 10.23 | **0.80** | 23.8 | 23.2 |
| 58 noon | 9.28 | 3.60 | 13.25 | **0.70** | 20.7 | 20.6 |

- All four inside 60 to 80% of round 36 (I measured round 36 myself with the same script). Seed 33 sits right on the top edge (0.796).
- Low views are unchanged, as intended.

Blind A/B, 4 cruise views against round 37, my own views (not the builder's), clean shots. Picks in `critic/ab/picks.txt`, written before I opened the keys.

| Pair | View | My pick | Result |
|---|---|---|---|
| 1 | Golden, marina, 15 m | crisper chop in the basins, moderate | **new wins** |
| 2 | Morning, open sea, 24 m | finer, more varied ripples | **old wins, weak to moderate** |
| 3 | Dusk, open sea, 15 m | more varied glints, less stripy | **old wins, weak** |
| 4 | Noon, marina, 24 m | a little more texture | **new wins, weak** |

- Side by side with the labels (`cruise-22-...-r37-left-r38-right.jpg`, `cruise-33-...`), round 38 clearly has more contrast in the ripples. Over open sea that extra mid-scale slope makes the regular wave rows read as stripes. The marina, broken up by piers and boats, gains. So the detail is back, but on open sea it looks more regular, not more natural.
- Taste level, weak margins. Not a bug.

## Item 3: finer near water on phones

**Pass.**

- Blind A/B, 4 phone low views (1 m and 4 m, golden, morning, dusk, noon, sea and marina) against round 37: **new wins 4 of 4**, all clear. Round 37 is soft satin bands and big glossy blobs. Round 38 has fine chop and sparkle near the camera.
- One visible flaw: the fine near band ends in a soft edge. Above it the broad swell starts. The edge is about a third of the way up the water (`phone-near-band-edge-morning-1m.jpg`, `phone-g-low-130-r37-top-r38-bottom.jpg`). Polish.
- Phone p95 at the marina (rerun, alone): see Perf. Under 12 ms.

## Item 4: phone pops

**Pass.** HUD probe, iPhone 13, seeds 22, 58, 130, 80 s each, fresh first run:

| Seed | Pops over the top column (objective pill, timer, score, chips) | Pops on the drone | Round 37 |
|---|---|---|---|
| 22 | **0** (265 pop samples) | 0 | 0 on drone, 79 over top |
| 58 | **0** (222) | 0 | 3 of 217 on drone, 97 over top |
| 130 | **0** (293) | 0 | 0, 63 |

- The pop-to-box map (POP34) is empty on all three: no pop touched any HUD box.
- Pops partly off screen: 8 to 11 samples per run, same as round 37.
- The compact pop reads fine (`phone-pops-r38.jpg`).

## Item 5: smooth rib tubes

**Pass.** Same three close views as the builder, round 37 against round 38 (`rib-r37-top-r38-bottom.jpg`). The tubes and seat rolls now shade smoothly. A slight polygon edge is left on the bow silhouette. No sea in the rib in any hull view.

## Regressions

| Check | Round 38 | Round 37 |
|---|---|---|
| Hull probe, desktop, 3 moods, sweep 3 | Same 19 flagged views as round 37, pixel counts within a few %. All were checked as sea beyond the far rail last round. 0 rib views flagged. | 19 |
| Hull probe, phone, sweep 2 | 12 views (round 37: 10). The 3 new ones are 3 to 11 px. I checked the largest (moored row boat, very close): no magenta inside the hull (`hull-flag-phone-row-very-close-normal-magenta.jpg`). **0 sea in hulls.** | 10 |
| Flat frames, bloom on | 920 frames, 0 flat, 0 errors. Hull probe views: 0 flat. | 0 |
| boats32 seed 22, 5 runs | longest contact 65 to 70, 0 stuck, 0 inside a hull, 0 near the mast | 64 to 73 |
| boats33, 4 seeds | 156 approaches: 0 inside, 0 mast, 0 stuck. Longest contact 111. | same, 113 |
| boats31 overlap, 3 seeds | 0 hull on hull, 0 hull on dock, 0 in a solid, fly-through 0 crashes | same |
| Bus stop, 4 seeds | 4 stops each, piers alternate, 9.0 to 9.25 s, top speed 4.6 m/s | same |
| boattrace33 | seeds 4711 and 22: largest step beyond own speed 0.008 to 0.013 m, 0 frames over 0.15 m | 0.008 to 0.014 |
| Crash-classify 12 m, 8 seeds | 64 crashes in 553 s (6.9 a minute), **0 pad lip**, 1 "hop-like" (seed 44: a 1 m rise after hitting a wall whose top was 8.6 m above the drone, so not a ledge hop) | 5.5 a minute, 0, 0 |
| Crash-classify 20 m, 8 seeds | 34 in 655 s (3.1 a minute), 0 hop-like, **0 pad lip** | 3.2 a minute |
| People probe | 0 people on active pads (48 legs, 1,536 samples) | 0 |
| Traffic overlap | 0 pair frames on 3 seeds | 0 |
| Desktop HUD probe, seed 22 | marker on controls 0. Pops on the drone 6 of 304 (1.97%). Drone under a pill 1 sample (0.12%). | round 34: 0.4 to 1.9% |
| Phone HUD probe | marker on controls 0. Drone under a pill 0, 2 (0.25%), 0. | 0 |
| Medal gate | Street bot, 2 runs per seed: seed 22 Bronze 2,384 and Silver 4,555. Seed 58 Silver 3,983 and Bronze 2,073. Seed 130 Silver 5,871 and Silver 5,613. Lazy bot: Bronze 1,101 / 1,171 / 1,077. **Breakdown and end screen exact on all 9 runs.** | Gold, Silver, Gold |
| Exploits | No-delivery farm 0 points on 22, 58, 130. Carry farm 0.25, 0 and 0.24 of honest points a minute. Honest 4,559 / 4,892 / 6,859. | same as round 34 |
| Cold load, no unstyled flash | 8 cold loads (dev and production, desktop and phone): 0 bad frames. Production styled at 12 to 22 ms. | 0 |
| Build (tsc, build to the scratchpad) | tsc clean. **No chunk warning.** three 588 kB, game 363 kB, StreetAssets 45 kB, lil-gui 31 kB, three-post 19 kB, CSS 40 kB. | game 362 kB |

- The desktop and phone HUD changes this round are touch-only pop placement. The desktop pop on the drone (1.97%) sits inside round 34's range and the desktop code did not change. The 1 and 2 "drone under a pill" samples are camera-path noise in a close wall pass. I count them as noise, not a regression.
- **Medal gate: noise, not a regression.** The same seed swings a full tier between runs (22: Bronze then Silver, 58: Silver then Bronze). Seed 22 missed Silver by 16 points with 3 drops, then made 4,555. Nothing in this round's diff touches desktop scoring or flight. The builder's three Silvers sit inside this spread. Round 37's Gold, Silver, Gold also does. The spread comes from the real-time bot: one more or one fewer drop before the clock ends.
- The 12 m crash rate went up from 5.5 to 6.9 a minute. Drone.ts and the city did not change this round, so this is bot variance (this probe runs in real time).

## Perf

Final pass, each job alone at the end (the machine was busier: the owner's Chrome at 53%, WindowServer 36%, `cpu-perf2.txt`).

| Check | Desktop | iPhone 13 |
|---|---|---|
| Harbour, marina hover 3 m | median 3.6, **p95 8.9** | median 2.3, **p95 5.0** |
| Harbour, sail / rib / ferry follow | p95 8.4 / 8.2 / 10.3 | p95 5.9 / 4.4 / 5.2 |
| Street, normal, no cap | median 3.9, **p95 8.1** | median 2.5, **p95 6.0** |
| Street, rush | median 4.1, **p95 8.2** | median 2.5, **p95 5.8** |
| Phone HUD runs, 80 s, vsync | | p95 9.1 to 9.2 |

- All p95 under 12 ms. The phone marina, where the new near layers work, is 5.0 ms (4.0 in the first, contaminated pass).
- Draw calls over the full spot sweep (about 3,300 spots each): desktop 120 (seed 130) and 118 (seed 22), iPhone 103. Under 125.
- Triangles: max 447k and 447k desktop, 413k iPhone. Under 480k. (Round 37: 441k, 439k, 411k. The smoother rib adds about 6k.)
- First load on the wire (production, 4 cold loads): **2.78 MB** (round 37: 2.73 MB. boats.glb grew 41 kB).

## Whole-game verdict

Every bot-measurable check still passes. There is no sea in a hull and no stuck drone. There are no pad-lip crashes, no overlaps and no flat frames. There is no unstyled flash. Perf is well inside budget. Phone pops no longer touch the top column. The breakdown is exact. I found no gap that clearly limits the game. **Only polish remains.**

What is left, by value:

1. Open-sea water at cruise height now reads a little stripy (regular rows) after the detail boost. The marina looks better. A small cut to the mid octave over open water only would likely win the A/B both ways.
2. On the phone the objective marker often sits on the drone in a straight street (`07` still, phone video at 36 s).
3. The phone near-water band has a visible soft edge where it fades.
4. The medal outcome swings a full tier between bot runs of the same seed. Pace and fun need a human player now.

The loop can stop. The next step is for the owner to play, and to read the Gemini review of the media.

## Gemini media (progress/round-38/gemini-media/)

`README.txt` in that folder lists what happens at which second in each video.

| File | What it shows |
|---|---|
| `01-title-screen-desktop.png` | 1920x1080. Title screen, city 130, golden hour. |
| `02-street-level-busy-desktop.png` | 1920x1080. Street level, city 58 (noon), rush hour, people in a park and cars. The first-run Slipstream tip shows. |
| `03-cruise-golden-hour-desktop.png` | 1920x1080. 28 m over the city at golden hour, city 130. |
| `04-harbour-low-boats-desktop.png` | 1920x1080. 3 m over the harbour, moored boats and piers, city skyline, city 22 (morning). |
| `05-delivery-pop-desktop.png` | 1920x1080. A doorstep delivery with its "+936 delivered" pop. |
| `06-game-over-medal-desktop.png` | 1920x1080. Game over: Silver medal, 3,123, full breakdown. |
| `07-phone-hud-midflight-iphone13-landscape.png` | 2250x1026 (iPhone 13 held sideways, at 3x). Phone HUD mid-flight in a street with a parcel. |
| `08-gameplay-desktop-1280x720.webm` | 59.2 s, 24.7 MB. Take-off, pickup, slipstream chain, delivery and Bronze, low along the harbour sea wall, a wall crash, second pickup, second delivery and Silver. |
| `09-gameplay-iphone13-landscape.webm` | 58.3 s, 19.0 MB, 750x342. The same route on the phone, with the on-screen stick and buttons moving. Also a Rush hour pop and a chain x5. |

- The videos are live real-time play, driven by a per-frame pilot (smooth turns, no key chatter). A few dull stretches are cut out. The cuts are jump cuts. The README lists them.
- The phone video is 750x342 because the headless screencast gives CSS pixels. The phone still (07) is full 3x resolution.
- Stills 02 to 06 are set up by script: the drone flies a short scripted line into place, then the real game camera and HUD are captured.
- Real things a reviewer can spot: on the phone the objective marker (diamond and arrow) often sits on the drone in a straight street. See 07 and the crash frame in the phone video. In the desktop crash frame the drone is pressed against a shop front with a "Crash!" pop.

## Screenshots (progress/round-38/critic/)

- Blind A/B: `ab/cruise-1.jpg` to `cruise-4.jpg`, `ab/phone-1.jpg` to `phone-4.jpg`, `ab/picks.txt`, hidden keys `ab/.key-cruise.json`, `ab/.key-phone.json`.
- Cruise water close-ups: `cruise-22-morning-sea-24m-r37-left-r38-right.jpg`, `cruise-33-dusk-sea-15m-r37-left-r38-right.jpg`.
- Phone water: `phone-g-low-130-r37-top-r38-bottom.jpg`, `phone-g-low-58-r37-top-r38-bottom.jpg`, `phone-near-band-edge-morning-1m.jpg`.
- Rib: `rib-r37-top-r38-bottom.jpg`.
- HUD: `phone-pops-r38.jpg`.
- Hull flag check: `hull-flag-phone-row-very-close-normal-magenta.jpg`.
- Media checks: `gemini-stills-contact.jpg`, `video-desktop-sheet.jpg`, `video-phone-sheet.jpg`, `video-crash-frames-desktop-top-phone-bottom.jpg`.
