# Drone Dash: round 34 critic report

**Verdict:** Pass on all six items. The unstyled flash is gone. The bus push is smooth. Desktop pops leave the drone. The golden and dusk water at 1 m is clearly crisper. No regression found.

Build tested: commit 05cd223 (round 34). Control: an untouched export of commit 56353fb (round 33). My servers: 5191 (round 34 dev), 5192 (round 33 control dev, own Vite cache), 5193 (round 34 production preview). All three are stopped. The owner's server on 5188 was left alone. Note: my 5191 server shares `node_modules/.vite` with 5188 and re-optimized the deps once at start. If 5188 asked for a reload around 20:33, that was me.

Every browser ran alone, one job at a time, from `critic-scripts/queue34.sh` and `jobs34.txt`. I did not read `builder.md`. I read the diffs only to learn what to test. Bulk shots went to the session scratchpad. The chosen ones are in `critic/`.

New scripts in `progress/round-34/critic-scripts/`:

- `fouc34.mjs`: cold load (fresh context), 2 s. A rAF sampler checks every painted frame: is `#app` visible before `styles.css` applies? Plus a CDP screencast of every frame.
- `load34.mjs`: cold production load. Time to Play button, game code, street assets. Bytes moved. Then Play, and long tasks and new shaders after Play.
- `playearly34.mjs`, `playearly34b.mjs`: press Play as early as possible on a cold production load.
- `hud-probe34.mjs` + `pop34-init.js`: hud-probe28 plus every pop against the real drone box and every HUD box, every 50 ms.
- `perf-street34.mjs`: perf-street with `UNCAP=1` (no vsync, no frame cap), so frame time is the real cost.
- `bt34.py`: from boattrace33, the largest single-frame move beyond the drone's own speed.
- `ab34.py`: blind A/B, water (6) and street (6).
- `route-play-r33c.mjs`: the street medal bot pointed at the round 33 control.
- Changed copies: `water31.mjs` (tags r34 / r33c, files `water34-*`), `cruise33*.mjs` (tags), `contrast31.py` (reads the scratch folder). All `.mjs` take `OUTDIR`.

## Machine load

At the start: XprotectService 43% (perf), coreaudiod 11% (boats), Brave 70% (HUD runs), WindowServer under 25% elsewhere. During the street medal run, knowledgeconstructiond (92%) and duetexpertd (75%) were busy (`cpu-medal.txt`). Fixed-step probes do not care. The real-time medal bot does (see Regressions).

## Results per item

### 1. Desktop pops cover the drone: pass

Real DOM rects of each visible pop against `droneBox()` (every visible drone vertex through the render camera). hud-probe samples every 100 ms. pop34 samples every 50 ms.

| Run | hud-probe | pop34 | Round 33 |
|---|---|---|---|
| Desktop 22 | 3 of 318 (0.94%) | 5 of 635 (0.8%) | 22.6% |
| Desktop 58 | 1 of 265 (0.38%) | 2 of 541 (0.4%) | |
| Desktop 130 | 6 of 318 (1.89%) | 12 of 643 (1.9%) | |

All three are under 2%. Seed 130 is close to the line. Every remaining hit is the same case. The drone sits on the ground or hugs a wall. The camera is then very close, and the drone box is 220 to 260 px wide (`fr34-d-130-ov1.jpg`, `fr34-d-22-ov1.jpg`). The pop then touches a rotor ring. Median gap between pop and drone is 59 to 61 px. Desktop pops never go off screen, never touch the top panels or the bottom meters. Seed 130 had 2 samples of the payout pop over the edge marker (diamond and distance pill).

**Phone pops touching the top column: real, but not new.** The probe counts pop samples that touch `.hud-score`, `.hud-center` or `.hud-right`.

| Phone seed | Round 34 | Round 33 |
|---|---|---|
| 22 | 79 of 228 (35%) | 77 of 136 (57%) |
| 58 | 86 of 258 (33%) | 78 of 251 (31%) |
| 130 | 88 of 284 (31%) | 59 of 231 (26%) |
| All | 253 of 770 (33%) | 214 of 618 (35%) |

The same rate as round 33. pop34 shows the cause. It is mostly the first-run teaching pop "Slipstream" (`#event-pop`). It touches the objective pill in 122 to 144 samples a run. On seeds 58 and 130 it also touches the score panel and combo chip (42 to 98 samples). The payout pop touches the objective pill only 4 to 29 times. Pops sit partly off screen in 12 to 13 samples a run (the pop-in scale). Pops on the drone on the phone: 0 on all three seeds. Worth a fix, not a regression.

### 2. Harbour bus push on a parked drone: pass

`boattrace33.mjs`, seeds 4711 and 22, 40-frame trace after first contact. Largest single-frame move beyond the drone's own speed (`bt34.py`):

| Contact | Round 34 | Round 33 control |
|---|---|---|
| Bus at 2 m (two seeds) | 0.012 m | 0.475 m |
| Bus at 1 m | 0.008 to 0.010 m | 0.42 to 0.46 m |
| Sailboat at 0.9 m | 0.001 to 0.014 m | 0.28 to 0.35 m |
| Frames over 0.15 m | 0 in 8 traces | 2 to 6 per trace |

The snap is gone. The drone is now carried as a velocity. One change to note: the bus now carries the drone at 6.6 m/s (its own 4.6 plus the 2 m/s cap), up from about 5.3. Effective speed peaks at 7.3 m/s for a frame. The sail run on seed 4711 still reads 9.9 m/s: that is the city-edge spring from round 33 (drone parked 197 m out), not the boat.

### 3. Draw calls: pass

`trisweep31.mjs`, full spot sweep (3,256 to 3,296 spots, 1,920 on water):

| Run | Max draw calls | Max triangles | Round 33 |
|---|---|---|---|
| Desktop 22 | 114 | 418k | 123 |
| Desktop 130 | 112 | 430k | 125, 444k |
| Desktop 33 | 114 | 413k | 122 |
| iPhone 130 | 97 | 398k | 106 |

Street runs: 108 normal, 113 rush (round 33: 117, 122). Matches the builder's 114. The merged shadow proxies show no visible change: all 6 street A/B pairs were ties (see item 4).

### 4. Water at 1 m and the glint view: pass

Blind A/B, round 33 control against round 34. Picks in `critic/ab/picks.txt` written before I opened `.key.json`. Top or bottom random per pair.

| Pair | My pick | New side | Result |
|---|---|---|---|
| Golden 130, 1 m | bottom, clear | bottom | **new wins** |
| Dusk 33, 1 m | bottom, clear | bottom | **new wins** |
| Noon 58, 1 m | bottom, clear | bottom | new wins |
| Morning 22, 1 m | top, weak | bottom | old wins (weak) |
| Golden 130, glint 14 m | tie | | tie |
| Dusk 33, glint 14 m | tie | | tie |
| Street (6 art27 views) | 6 ties | | 6 ties |

- The golden and dusk 1 m views both win clearly. The soft radial streaks in the bottom third are gone. The ripples stay crisp to the bottom edge (`water34-r34-130-g-low.jpg` against `water34-r33c-130-g-low.jpg`).
- The one loss: morning 22 at 1 m. The old frame has bright glitter in the near water. The new near layer is even and calmer, with less sparkle (`water34-r34-22-g-low.jpg`, `water34-r33c-22-g-low.jpg`). A taste call, weak.
- Glint views at 14 m: the same as round 33, by design (the near layer fades out above 8 to 13 m camera height).
- `contrast31.py`, cruise ratio: golden 0.52, morning 0.54, dusk 0.41, noon 0.54. All at most 0.6. Control: 0.51, 0.54, 0.40, 0.53.
- Still soft: free-camera views from 10 to 14 m keep the old smeared streaks in the near water (`water34-r34-130-boat-ferry.jpg`). The game camera at cruise height does not show this.

### 5. Bundle and load: pass

Production build in the scratchpad (`tsc` clean):

| Chunk | Size | Gzip |
|---|---|---|
| three | 587 kB | 149 kB |
| index (game) | 351 kB | 123 kB |
| StreetAssets (lazy) | 45 kB | 14 kB |
| lil-gui (lazy) | 31 kB | 8 kB |
| three-post | 19 kB | 5 kB |
| CSS | 40 kB | 9 kB |

- No Vite size warning (the limit is 900 kB, and round 33's single chunk was 952 kB). The three chunk is over Vite's default 500 kB but under the project limit.
- First load, measured on the wire (`load34.mjs`, 4 cold loads): **2.14 MB** with all street assets. 3.0 MB on disk without maps.
- Time from navigation: styled title and Play button 36 to 39 ms. Game code ready 694 to 803 ms. Street assets on 962 to 1,285 ms.
- After Play: 0 long tasks, 0 new shader programs (4 runs on production, 3 on dev with `ff29.mjs`). The first 4 s after Play: p95 8.9 to 9.3 ms, one frame of 24 to 25 ms on production (16.7 ms on dev).
- Early Play press: a click at 250 and 400 ms after navigation (`playearly34b.mjs`) reached the page at 722 to 915 ms, after the game code was ready. The browser held the click until then. The run started both times. No press is lost.

### 6. Flash of unstyled content: pass

`fouc34.mjs`, cold loads, 2 s each, rAF sampler plus CDP screencast. A bad frame is `#app` visible before `styles.css` applies.

| Build | Device | Runs | Bad frames | Title visible at |
|---|---|---|---|---|
| Round 34 dev | desktop | 2 | 0 | 754, 806 ms |
| Round 34 dev | iPhone | 2 | 0 | 740, 771 ms |
| Round 34 production | desktop | 2 | 0 | 11, 14 ms (first frame) |
| Round 34 production | iPhone | 2 | 0 | 13 ms |
| Round 34 dev, 4x CPU | desktop / iPhone | 1 each | 0 | 2,313 / 2,231 ms |
| Round 34 production, 4x CPU | desktop / iPhone | 1 each | 0 | 29 ms |
| **Round 33 control dev** | desktop / iPhone | 1 each | **13** | 829 / 779 ms |

- The control shows the bug in the screencast: bare text and a giant black circle (the timer SVG) for about 0.8 s (`fouc/dev-r33-control-desktop-sheet.jpg`). Round 34 shows a plain orange page, then the styled title (`fouc/dev-r34-desktop-sheet.jpg`, `fouc/dev-r34-phone-sheet.jpg`).
- No element outside `#app` ever shows.
- The page never stays hidden at normal speed: title within 0.81 s on dev, at first paint on production. Only dev with a 4x CPU throttle goes past 2 s (2.2 to 2.3 s of plain orange). That is the dev server's CSS-by-JS path. The round 33 control is just as slow to its first styled frame.
- Production: the styled title is there from the first frame on an orange gradient. The city fades in at about 0.78 s (`fouc/prod-r34-desktop-first-frames.jpg`, `fouc/prod-r34-desktop-game-start.jpg`). Small text swaps when the code runs: "Tap for sound" becomes "Click or press a key for sound", "City" becomes "City 22", and the medal row appears. Not a flash, but a visible jump.

## Regressions

- **Flat-frame probe, bloom on: pass.** 757 frames, 0 flat, 0 errors. The flat check inside `water31.mjs` reads 1 colour in many views. It does so on both builds and in round 33's own log, because it reads the canvas after the frame is gone. This is a probe fault, not a black frame. The shots are normal.
- **Crash-classify, 8 seeds: pass, 0 pad lips.** 12 m: 54 crashes in 535 s (6.1 a minute), 16 near the target, closest 4.0 m below a top, 0 hop-like. 20 m: 34 in 618 s (3.3 a minute), 16 near, closest 2.9 m below a top, 0 hop-like. Round 33: 6.7 and 3.7 a minute.
- **Boats32/33: pass.** 156 approaches on seeds 22, 58, 4711, 9001: 0 inside a hull, 0 near a mast, 0 stuck, 0 pushed down. Bus rams: 16 of 16 charged exactly one crash, highest rise after a 1 m hit 1.81 m.
- **Bus-stop probe: pass.** 4 stops per seed on 4 seeds, piers alternate every time, stops 9.0 to 9.25 s, top speed 4.6 m/s.
- **Alley camera: pass.** cam-clip30 desktop 22 no orbit, cam-clip24 desktop 22: 0 hidden, 0 in solid, 0 pops over 1 m. iPhone 22 no orbit: first run had 1 jump of 1.1 m in Quill Row (rounds 31 to 33: 0.59 to 0.95 there). The rerun: 0 pops, max 0.88 m. No camera code changed. Noise.
- **climb30: pass.** Desktop and phone: 0 jumps over 1 m (max 0.896 / 0.895), 0 frames in solid, closest camera 5.4 m.
- **People probe: pass.** 0 people on active pads (48 legs, 1,536 samples).
- **Traffic overlap: pass.** 0 pair frames, 3 seeds.
- **Phone HUD probe: pass.** iPhone 22, 58, 130: marker on controls 0, drone under pills 0, pops on the drone 0. Pops over the top column as above (not new).
- **Chimes with pops: pass.** 64 of 64 chimes had the pop shown within 0.3 s.
- **Exploits: pass.** No-delivery farm 0 points on 22, 58, 130. Carry farm 0.24, 0.25 and 0 of honest points a minute. Honest 4,559 / 4,892 / 6,859 (the same as round 33).
- **Triangles: pass.** Max 430k desktop, 398k iPhone (target under 480k).
- **Medal gate: pass, breakdown exact on all 10 runs.**
  - Street bot: 4,598 Silver, 4,236 Silver, 5,631 Silver (total 14,465). Strict delivery share 66%. Round 33: 6,274 Gold, 3,457 Silver, 6,612 Gold (16,343). Round 32: all Silver (15,473).
  - Lazy bot: 1,133 Bronze, 923 none, 1,029 Bronze (total 3,085). No lazy run near Silver.
  - **Noise or regression? Noise.** I ran the same bot again on both builds:

    | Run | Seed 22 | Seed 130 |
    |---|---|---|
    | Round 34, first run | 4,598 Silver | 5,631 Silver |
    | Round 34, rerun (`m-low-b.log`) | 1,736 Bronze (2 drops, stalled leg, missed rush) | **6,983 Gold** |
    | Round 33 control today (`m-low-r33c.log`) | 6,021 Gold | 5,708 Silver |
    | Round 33 critic, same build | 6,274 Gold | 6,612 Gold |

    The round 33 build gives Silver on seed 130 today. The round 34 build gives Gold on seed 130 on the rerun. The bot swings by a whole delivery (about 1,600 points) between runs of the same build. It runs in real time, and the street run had heavy background load (knowledgeconstructiond 92%, duetexpertd 75%). No scoring or flight code changed this round. Points per delivery and the strict share (66%) match round 33.

## Perf (clean timing)

| Check | Desktop | iPhone 13 |
|---|---|---|
| Street, normal, vsync (rAF interval) | p95 9.2 ms, max 9.4 | p95 9.0, max 9.4 |
| Street, rush, vsync | p95 9.2, max 9.4 | p95 9.3, max 9.4 |
| Street, normal, uncapped (real cost) | median 3.9, **p95 7.8**, max 27.7 (2 frames over 20 ms) | median 2.5, **p95 6.2**, max 18.4 |
| Street, rush, uncapped | median 3.7, **p95 7.7**, max 16.4 | median 2.5, **p95 5.5**, max 11.6 |
| HUD runs, 80 s, vsync | p95 9.0 to 9.3, over 20 ms: 1 to 3 (the probe's end, as before) | p95 9.2 to 9.3, 1 |
| First 4 s after Play | p95 9.1 to 9.3, max 16.7 | p95 9.2, max 16.7 |

All p95 values are under 12 ms. Headless Chromium on this Mac renders at 120 Hz, so the vsync numbers sit at 8.3 ms. The uncapped run shows the real cost. The 27.7 ms peak on desktop normal is 2 frames in 2,830.

## Close boat views (noted, not judged: the boat round is next)

- A moored sailboat: the sail is one flat triangle at an odd angle and cuts through the drone when it sits on the boat. The hull holds crates (`boats33-22-moored-sail-low.jpg`).
- The bus is flat-shaded blocks. The wheelhouse reads as dark boxes. Its wake is a single bright line (`boats33-22-bus-hits-drone-late.jpg`).
- Free view from 14 m behind the bus: the near water still smears (`water34-r34-130-boat-ferry.jpg`).
- Unrelated find: at 0 m against a café wall a pedestrian stands inside the drone (`fr34-d-130-ov1.jpg`).

## Ranked list

1. **Human playtest (needs a human player).** Unchanged from round 33. The bots find nothing big. Use the round 33 guide.
2. **Medal pace (needs a human player).** The street bot lands on Bronze, Silver or Gold on the same seed, depending on one delivery. Is Gold at 6,000 right for a good player?
3. **Phone pops over the top column** in about a third of pop samples, mostly the first-run "Slipstream" teaching pop over the objective pill and score panel. Test: under 5% of phone pop samples touch `.hud-score`, `.hud-center` or `.hud-right` on seeds 22, 58, 130, with pops on the drone still 0.
4. **Desktop pops near a close drone.** 1.9% on seed 130, just under the line. All hits come when the camera is very close (drone box over 200 px). Test: under 1% on 22, 58, 130.
5. **Bus carry speed.** The drone is now carried at 6.6 m/s, above the bus's 4.6. Smooth, but a human should judge if it looks like the bus throws the drone.
6. **Morning water at 1 m** lost some near glitter (weak). Test: blind A/B of morning 22 g-low against round 33, new wins or ties.
7. **Production title text swap** at about 0.78 s ("Tap for sound" to "Click or press a key", "City" to "City 22"). Test: the static title text matches the device and seed from the first frame.

## Screenshots (progress/round-34/critic/)

- **Blind A/B:** `ab/water-1.jpg` to `ab/water-6.jpg`, `ab/street-1.jpg` to `ab/street-6.jpg`. Picks in `ab/picks.txt` (written first), key in `ab/.key.json`.
- **Unstyled flash:** `fouc/dev-r33-control-desktop-sheet.jpg` (the bug, round 33), `fouc/dev-r34-desktop-sheet.jpg`, `fouc/dev-r34-phone-sheet.jpg`, `fouc/prod-r34-desktop-first-frames.jpg`, `fouc/prod-r34-desktop-game-start.jpg`. Every screencast frame is in the scratchpad.
- **Water, 1 m:** `water34-r34-130-g-low.jpg` against `water34-r33c-130-g-low.jpg`, `water34-r34-33-g-low.jpg` against `water34-r33c-33-g-low.jpg`, `water34-r34-22-g-low.jpg` against `water34-r33c-22-g-low.jpg`, `water34-r34-m-22-g-low.jpg` (phone).
- **Water, 14 m:** `water34-r34-130-glint.jpg`, `water34-r34-130-boat-ferry.jpg`.
- **Boats:** `boats33-22-bus-ram.jpg`, `boats33-22-bus-hits-drone.jpg`, `boats33-22-bus-hits-drone-late.jpg`, `boats33-22-sail-low.jpg`, `boats33-22-moored-sail-low.jpg`.
- **HUD:** `fr34-d-22-ov1.jpg` (medal pop beside a very close drone), `fr34-d-130-ov1.jpg` (payout pop at a wall-hugging drone, pedestrian inside the drone), `fr34-m-58-h02-low-drafting.jpg` (phone).
