# Drone Dash: round 41 critic report

**Verdict:** Ready for a Vercel link to colleagues. Not ready for the platform yet: on phones the target marker still goes into the 64 px top-left corner. Also fix a smaller recording glitch on phones.

## Setup

- My servers: 5191 for dev (own Vite cache, no HMR) and 5193 for the production build at the root.
- 5194 served the production build under `/nested/game/`. 5195 served the outer page on `localhost`, a different origin.
- All four are stopped. I did not touch the owner's server on 5188.
- I built with `tsc` and `vite build` into the scratchpad. tsc was clean, there was no chunk warning, and the build kept the relative `./assets/` paths.
- Every browser job ran alone, one at a time (`critic-scripts/queue41c.sh`, `jobs41c.txt`).
- I did not read `builder.md`.
- **Time note:** from about 21:25 the machine got very slow while my session was idle. One 60 s run took 17 minutes, and one cold-load probe timed out. The GPU was the real Apple GPU throughout (`gpu41c.log`). I ran out of time, so I cut the regression list. The checks I skipped are listed in section 5.

## 1. Platform

Scripts: `platform41c.mjs` ran desktop with and without the mock, plus a phone run. `platform41c-phone.mjs` ran iPhone 13 and Pixel 7, with an outer page that has a device-width viewport. `seeds41c.mjs` ran odd seed values.

| Check | Result |
|---|---|
| Nested path, cross-origin iframe, `?seed=22&slLaunch=x&foo=bar` | Pass. 0 failed requests and 0 HTTP errors from the game. The only 404 was `/favicon.ico` on my outer page. 0 page errors. |
| Game plays | Pass. A real click on Play, then 2.5 s of W moved the drone 31.6 m at 16.5 m/s. On the phone, a real tap on Play, then a full run by the pilot: 4 deliveries, Silver, 5,288 points. |
| Same city as dev `?seed=22` | Pass. The full sites list is identical, and the first pickup (Records, Juniper and 4th) is the same. |
| Mock `StateloopSession.complete` | Pass. Exactly 1 call per run: run 1 gave 1 call, run 2 gave 2 in total, and a restarted (abandoned) run added none. A debug `end()` after the run had ended did not add a call. Detail of the phone run: `{game, score 5288, medal "Silver", medalTier 2, deliveries 4, seed 22, cityMode "seed", runSeconds 119.3, run 1}`. Sensible. |
| `stateloop:session-complete` event | Pass. It fired once per run (2 events after 2 runs). |
| No mock | Pass. Nothing was thrown and the event still fired once per run. |
| Single Escape | Pass. Playing went to paused, and a second Escape went back to playing. |
| Double Escape within 700 ms (180 ms apart) | Pass. Over 4 Escape presses there were 0 calls to preventDefault, stopPropagation or stopImmediatePropagation (I patched them to log). Every press reached listeners on window (capture and bubble) and on document. |
| Odd seeds (`seeds41c.mjs`) | Pass. 0, -5, 4294967295, 2^53+1, 123456789012, "abc" and "22.7" each load the same city twice, with no errors. An empty seed or a space gives a random city. Note: -5 gives the same city as 5. |
| 64 px corner, HTML HUD and canvas HUD panels | Pass on desktop and phone. The score now starts at x 68 to 76. No HUD panel was in the corner in any sample (2,274 canvas-HUD samples over 4 recorded runs). |
| **64 px corner, nav marker (diamond, edge arrow, distance pill)** | **Fails on phones.** In real play on iPhone 13: 9 of 577 samples on seed 22 (1.6%) and 29 of 577 on seed 130 (5%). With the HTML HUD on seed 130: 25 of 422. Desktop: 0 of 423. Typical boxes: diamond 24..56 x 39..70, arrow -7..19 x 38..76 (`navcorner-iphone-130.jpg`). It happens while a centre pop blocks the middle. Then the touch placement walks the marker along the edge. In `navTouch` the margin is 40 and the top is 30, with no corner block. My fixed-pose sweep (`corner41c.mjs`, 864 poses per device) found 0, because no pop was showing. |

Test-setup notes, not game bugs: an outer page without a viewport meta gives the phone iframe a 980 px layout. In that layout my tap on Play did not start the game. With a device-width outer page it works. Inside the cross-origin iframe, headless Chromium reported devicePixelRatio 1 on the phone, so I judged phone sharpness from top-level runs.

## 2. Canvas HUD (`?hud=canvas`)

Method: `rec41c.mjs` recorded the WebGL canvas alone (`captureStream(30)`, VP9 at 3.5 Mbps, 12 s segments) while `video-pilot39c.js` played in real time. Runs: desktop dpr 1 seed 22 (bright morning), desktop dpr 2 seed 130 (golden hour), and iPhone 13 on seeds 22 and 130. Bloom was on for desktop. All segments were 1.4 to 6.2 MB.

What the recording alone shows:
- Score, the pending street bonus, medal progress (name, target and bar) and the combo chip.
- The clock with its ring. The objective with its verb, name, distance and RUSH tag.
- Slipstream with its chain (up to x5) and the minimap with its distance pill.
- Every event label: pickup, delivered with breakdown, chain payouts, crash, medal and rush hour.
- All of it is readable at dpr 1, dpr 2 and on the phone, in both light moods. The text is crisp. Bloom never smears it. It is drawn after post-processing (see `rec/rec-desk2-s130-score-crop.jpg`).
- Not in the recording: the boost meter, the speed and altitude readout, the world nav marker and the touch controls (all HTML, as designed). The title, pause and **game-over result screens** are not in the recording either. A clip ends on the city with no final score.

| Check | Result |
|---|---|
| Panel on panel, desktop (481 + 593 samples) | 0 |
| Corner and off-screen | 0 in the corner and 0 off screen in all 4 runs |
| **Event label on the objective, phone** | 1 sample in each phone run. Video frames show it. When an event starts, the label sits over the objective pill for about 2 frames at 12 fps. Then it jumps left (`rec/rec-phone-s130-event-jump-strip.jpg`, `rec/rec-phone-s130-event-on-objective.jpg`). The cause looks like the event box being measured only every 250 ms, with a fallback position at 32% of the screen height before that. This matches the builder's 2 of 60. |
| **Objective pill over the score panel, phone** | The boxes overlap in most phone samples: 369 of 529 (seed 22) and 651 of 671 (seed 130), up to 1,800 px². With a long objective name or a pending bonus, the overlap is visible. The pill covers the right end of the medal bar (`rec/rec-phone-s130-score-objective-overlap.jpg`). The HTML HUD has the same overlap (422 of 422 samples, seed 130), so it is the layout, not the canvas copy. |
| Cost | Mean 0.03 ms a frame (dpr 1 and phone) and 0.07 ms at dpr 2. Largest single frame 10.2 ms, once, at dpr 2. 2,300 to 3,300 texture uploads per run. |
| Without the flag | Pass. No `canvas-hud` class, canvas HUD off, the HTML panels visible (`htmlhud41c.mjs`, `htmlhud-desk-22.jpg`, `htmlhud-phone-22.jpg`). |

## 3. Fixes A to F

| Fix | Result |
|---|---|
| A. Slow motion vs slipstream | Pass (`fixes41c.mjs`, slow motion held on with the fixed step). Slow-clock reward: 1.000 s added per real second at time scale 1, at 0.3 and in hit-stop (0.08). Meter drain: 0.05 per real second in both. Grace before the drain: 3.0 s in both. Chain lost after 6.0 s in both. |
| B. Touch release | Pass. Stick and boost were held through real CDP touches, then I tried blur, a hidden tab, pause and lost pointer capture. Each time: axes 0, pointer id cleared, knob back to `translate(-50% + 0px, -50% + 0px)`, 0 pressed buttons. A new press works afterwards. |
| C. Storage blocked | Pass. With localStorage throwing on access, and again with setItem throwing: 0 page errors and 0 console errors. Play, M map, N music, pause, run end and replay all worked. |
| D. Music listener on dispose | Pass. `#music-toggle` click listeners went from 1 to 0, and all element listeners from 37 to 0. Still on window after dispose: beforeunload, error, unhandledrejection and touchstart (I did not trace their source). |
| E. Uncharged knocks | Pass (`crash41c-22.log`, `e41.py`, seed 22, 60 and 90 deg). Free knocks at 10 to 11 m/s: shake median 0.41 (round 40: 1.00), live particles median 74, max 77 (round 40: 90 / 110). Charged crashes: shake 1.00, particles median 114 to 119, 14 slow frames, flip 47 to 61 deg. The threshold is unchanged: highest free head-on 11 m/s, lowest charged 11.6 m/s. Crash camera: closest 9.0 m, 0 frames in a solid, largest move 0.41 m per frame. |
| F. Help and music chip | Pass. The help line reads "M map · N music · Esc pause". The chip title reads "Music (N)" on title, play and pause. No "(M)" music strings are left. |

## 4. Regressions measured this round

| Check | Result |
|---|---|
| Flat-frame probe, bloom on | 903 frames, 0 flat, 0 errors |
| Crash-classify, 8 seeds, 12 m | 33 charged crashes in 535 s, **0 pad lip**, 0 hop-like |
| Crash-classify, 8 seeds, 20 m | 27 charged crashes in 628 s, **0 pad lip**, 0 hop-like |
| cam-clip30 seed 22, no orbit | 0 in solid, 0 hidden, 0 pops |
| cam-clip30 seed 58, orbit | 0 in solid, 0 hidden, 0 pops (largest glide 0.88 m) |
| Seed parity, nested build vs dev | identical |

## 5. Not run this round (time)

- Camera: cam-clip24 (phone), climb30 and wall-side framing.
- HUD probes on desktop and phone, and minimap bearing.
- World: hull probe, boats, people on pads and traffic overlap.
- Score: street and lazy medal gates, no-delivery and carry farms.
- Load: the cold-load flash check and the cold-load byte count. The byte probe timed out during the stall.
- Perf: harbour perf and the triangle sweep.

Risk: the round 41 diffs in `goals.ts` and `CameraRig.ts` only route storage through the new guard. `Slipstream.ts` now uses real time for its timers, and A shows that holds. Round 40 had all of these passing. Still, rerun the medal gate, the HUD probes and the farms before the platform upload.

## 6. Perf

| Check | Desktop 1280x720 | iPhone 13 |
|---|---|---|
| Street, HTML HUD, no cap | p95 7.5 ms normal, 5.7 rush | not run |
| Street, canvas HUD, no cap | p95 5.0 normal, 5.9 rush | p95 3.6 normal, 3.8 rush |
| Draw calls, street | up to 109 (HTML), 120 (canvas HUD, rush) | up to 101 (canvas HUD) |
| Triangles, street | up to 406k (HTML), 409k (canvas HUD) | 366k |

- Every p95 is under 12 ms. Draw calls are under 125 and triangles under 480k, with the canvas HUD too. The full spot sweep was not run.
- First load: without source maps, the production build is 3.7 MB in total. Models are 0.95 MB and textures 1.7 MB. So the first load is under 15 MB even with every file. Round 40 measured 2.78 MB on the wire.
- Note: the build ships source maps (about 4.5 MB of `.map` files). Leave them out of the platform ZIP unless you want the source to be public.

## 7. Release verdict

- **Vercel link for colleagues: yes.** Desktop and phone play well, the HTML HUD is unchanged, relative paths work from a nested path, and perf is well inside budget.
- **Platform upload: no.** One blocker:
  1. **Nav marker in the 64 px corner on phones** (1.6% to 5% of play time). Add the corner box (and some margin) to the blocked boxes in `navTouch`, and to the desktop clamp too.
- Also fix before upload (small):
  2. On phones, the canvas HUD draws a new event label over the objective pill for about 0.1 to 0.2 s. Measure the pop box at the start of each event.
  3. The objective pill overlaps the score panel on phones with long names or a pending bonus (in both HUDs).
  4. The game-over result is not on the canvas, so a recording ends without the final score.
  5. Rerun the regressions from section 5.

## 8. Files

Scripts in `progress/round-41/critic-scripts/`:
- Copied from round 40, with only the output folder changed through OUTDIR.
- New for the platform: `platform41c.mjs`, `platform41c-phone.mjs`, `seeds41c.mjs`, `corner41c.mjs` and `navcorner41c.mjs`.
- New for the canvas HUD: `rec41c.mjs` and `htmlhud41c.mjs`.
- New for the fixes: `fixes41c.mjs` and `e41.py`.
- New for perf: `gpu41c.mjs`, plus `perf-street41.mjs` and `trisweep41.mjs`. Both take Q for `&hud=canvas`.
- The queue: `queue41c.sh` and `jobs41c.txt`.
- Logs sit next to them.

Screenshots and clips in `progress/round-41/critic/` (19 JPEGs):
- `plat-desk-mock-title/play/over.jpg` and `plat-phone-iframe-title/play/over.jpg`: the game in the iframe.
- `navcorner-iphone-22.jpg` and `navcorner-iphone-130.jpg`: the blocker.
- `htmlhud-desk-22.jpg` and `htmlhud-phone-22.jpg`: the HTML HUD without the flag.
- `rec/rec-*.jpg`: frames taken from the canvas-only recordings.
- `rec/clip-desk1-s22-delivery.webm` (4.1 MB), `rec/clip-desk2-s130-delivery.webm` (5.9 MB), `rec/clip-phone-s22-chain.webm` (4.0 MB), `rec/clip-phone-s130-pickup.webm` (4.1 MB). The last clip shows the event-label jump.
