# Drone Dash: round 42 builder notes (release fixes)

All five fixes are in. Every acceptance check passed. The full regression list ran (one browser at a time, through `builder-scripts/queue42.sh`). My servers: 5191 for dev (own Vite cache) and 5193 for the build at the root. 5194 served the build under `/nested/game/`. 5195 served the outer page on another origin. All four are stopped. I did not touch the owner's server on 5188.

## Fixes

1. **Corner (blocker).** `Hud.cornerBox()` measures the 64 px top-left corner plus the safe-area inset, and adds 4 px. A hidden probe that uses `env()` is read every 500 ms. `Game.navTouch` and `Game.gateTagPlace` now treat that box as blocked, so the round 24 edge walk slides the marker past it. After each placement, `Game.cornerPush` checks the nav marker (diamond, pill and arrow) and the gate tag (pill and arrow). If a footprint is in the corner, it moves down or right, whichever move is smaller. This works on desktop and touch. The canvas event label already kept out of the corner.
2. **Shrinking centre message (Codex P1).** `CanvasHud.updateEvent` now sets the scale from the base size on every frame: `allocW * s`, `allocH * s`, with `s = 0.9 + 0.1 * age / 160` for the first 160 ms and 1 after that. The label grows around its own centre. Before, it multiplied the current scale.
3. **Seed sign (Codex P2).** In `parseSeed`, a negative whole number now keeps its sign as a 32-bit two's complement value: -22 is city 4294967274. README "Play locally" now explains the seed format: whole numbers, negatives, the wrap at 2^32, text seeds and empty seeds.
4. **Phone overlaps.**
   - The objective pill's width now fits its slot. `Hud.fitObjective` sets `--obj-max` every 300 ms. It is twice the smaller gap to the score panel and to the right chips, with room for the 1.08 flash. A long name gets an ellipsis (`min-width: 0` on the name and `overflow: hidden` on the pill).
   - The canvas pill uses the same cap and its own drawn score box, and cuts the name with an ellipsis.
   - At the start of a message, the canvas event label now reads the resting centre of the HTML message (offsetLeft and offsetTop). Before, it used a box that was up to 250 ms old. The label then moves below the score, clock, objective and minimap boxes, with a 6 px gap.
   - HTML HUD: a `ResizeObserver` on the score panel and the centre column re-measures the touch layout and moves the pop that is up at once. Before, this waited up to 300 ms. A combo chip that appeared together with a pop let the pop touch the score panel for 18 frames.
5. **Game-over card on the canvas.** At game over with the canvas HUD on, `CanvasHud.updateOver` draws a compact card. It shows "Time's up", the medal, the score, the breakdown rows and "City seed N". It reads them from the HTML game-over card, so both say the same. It fades in over 250 ms. During game over the other canvas panels are hidden. At the start of a new run the card goes away.

Kept: the bloom clamps in ObjectiveMarker.ts, the `#app` visibility rule (index.html, styles.css), and all bot hooks. The canvas `stats().event` now also reports age, scale, meshScale and alloc.

## Acceptance (scripts in `builder-scripts/`)

| # | Check | Result |
|---|---|---|
| 1 + 4 | `phone42.mjs`: full piloted runs that end at game over. iPhone 13 on its side (750x342) and Android 915x412, seeds 22, 58 and 130, canvas and HTML HUD (12 runs). It checks **every animation frame**: nav parts, gate tag, HTML panels and pops, and canvas panels against the corner. It also checks event labels against the objective pill and the score panel, and the pill against the score panel. | **Corner: 0 frames in all 12 runs** (about 13,000 to 15,800 frames each). Overlaps: 0 in 11 runs. HTML iPhone seed 130 had 18 frames of a pop on the score panel (2 px). I fixed that with the ResizeObserver, then reran HTML iPhone 22, 58 and 130 and Android 130: **0 overlaps, 0 corner**. Logs: `phone42.log`, `phone42-html-rerun.log`. |
| 2 | `scale42.mjs`: first 3 events, every frame for the first 300 ms, desktop and iPhone | 110 and 109 frames. Largest difference between the measured scale and the intended curve, and between the quad scale and alloc times s: **0.0001** (rounding). Starts at 0.9016 at 3 ms and reaches 1 at 160 ms (`logs/scale42-*.log`). |
| 3 | `seeds42.mjs` | 22 is "Bright morning" (seed 22). -22 is seed 4294967274 ("Hazy noon"), a different sites list. 5 and -5 are different too. -22 gives the same city as 4294967274, as the README says. 0 and -0 are the same. 0 errors. |
| 5 | Canvas-only capture at game over: all HTML hidden, then a page shot | The card shows on all 6 canvas runs: `builder-shots/over-canvas-{iphone,android}-{22,58,130}.jpg`. Example: iPhone seed 22, Gold medal, 6,573, five breakdown rows, "City seed 22". |

The canvas runs and one HTML run were done before the ResizeObserver change. That change only moves HTML pops, and only further from the top boxes. The canvas label follows the resting point of the HTML pop.

## Regression list (`builder-scripts/jobs42.txt`, logs in `builder-scripts/logs/`)

| Check | Result |
|---|---|
| Flat-frame probe, bloom on | 897 frames, 0 flat, 0 errors |
| Crash-classify, 12 m, seeds 22, 58, 130 | 18 charged crashes, **0 pad lip** (`ccv-sum.py`). 1 "hop-like" rise without climb. This round did not touch flight or collision code. |
| Nested path, cross-origin iframe (`platform41c.mjs`, build under `/nested/game/`) | 0 failed requests, 0 errors, desktop with mock, without mock, and phone. Same sites and first objective as dev. |
| Session complete | Exactly 1 call per run (1, then 2 after run 2, still 2 after an abandoned run). Event once per run without the mock. Double Escape leaves the game playing. |
| Desktop HUD probe 22 / 58 / 130 | Marker on controls 0. Drone under a pill 0/0/0. Pops on the drone 5/308, 0/275, 1/328 (round 40: 0). Pops over the top boxes 0. |
| Phone HUD probe 22 / 58 / 130 | Marker on controls 0. Pops over the top boxes 0, pops over the controls 0. Drone under a pill 0, 2/795, 0. Pops on the drone 12/281 (medal and teach pops), 0, 0. Shot `fr42-m-22-ov1` (in scratchpad `c42/shots`): the drone sat far left of centre, near a building, and the medal pop below the tall score column touched its rotor. Desktop pop placement code was not changed this round, so the desktop counts are not from these fixes. I count these as noise or older behaviour to watch, not new regressions. |
| Minimap (`mm-measure40.mjs`) | Bearing over 360 poses: median 0.10 deg, p95 0.59, max 5.7, 0 over 20. Real time: median 1.0, p95 4.1. Placement: on screen with 0 overlaps on 6 screens (3 desktop, iPhone 13, iPhone SE, Pixel 7). |
| Medal gate, street bot | 22: Bronze 1,824 on the first run (2 deliveries, the bot flew high), then a repeat gave **Gold 6,483**. 58: Silver 2,818. 130: Silver 5,689. Breakdown and end screen exact (bdOk, domOk) on all. |
| Medal gate, lazy bot | Bronze 1,159, no medal 926, Bronze 1,029. Breakdown exact on all three. |
| No-delivery farm 22 / 58 / 130 | 0 / 0 / 0 |
| Carry farm (points per minute vs honest) | 0.22 / 0 / 0.24, all under 0.5 |
| boats32, seed 22 | 0 inside a hull, 0 mast, 0 stuck, longest contact 70 |
| Hull probe, desktop, seeds 130 and 22 | 8 leak views + 3 in the sweep, 0 flat (round 40: 7 + 3). Water code unchanged. The phone hull pass was not run. |
| Traffic overlap, 6 runs | 0 pair frames |
| climb30, desktop and phone | 32 climbs each: 0 with hf over 0.40, 0 frames in a solid, largest jump 0.89 m |
| cam-clip24, phone, seed 22, no orbit | 0 in a solid, 0 hidden, 0 pops |
| Unstyled flash on cold load (dev and build, desktop and iPhone, 2 loads each) | 8 loads, 0 bad frames |
| Perf p95, street, no frame cap | Desktop: HTML HUD 7.9 normal and 7.6 rush, canvas HUD 5.1 and 5.2. iPhone 13: HTML 5.4 and 4.9, canvas 3.5 and 3.5. All under 12 ms. |
| Draw calls and triangles | Street: up to 119 calls (canvas HUD, rush). Triangle sweep seeds 130 and 22: up to 446k and 434k triangles, up to 116 calls. All under 480k and 125. |
| `npm run build` | tsc clean, no chunk warning. Game chunk 410.7 kB (+6 kB), three 588 kB. |

Not run: the phone hull pass, the people-on-pads probe and harbour perf. These were not on this round's list, and nothing they cover changed.

## Files changed

- `src/game/Game.ts`: the corner block in `navTouch` and `gateTagPlace`, and `cornerPush` for the nav marker and the gate tag. `updateNav` calls `hud.fitObjective`. `render` draws the game-over card.
- `src/ui/Hud.ts`: `cornerBox()`, `fitObjective()`, and the ResizeObserver (`topWatch`).
- `src/ui/CanvasHud.ts`: the base-size scale, the event anchor and avoidance, the objective cap and ellipsis, and the drawn score box. New: `updateOver`, `hideOver`, `drawOver` and the event stats.
- `src/styles.css`: `--obj-max` on the objective pill, `overflow: hidden` on the pill, `min-width: 0` on the name.
- `src/game/cities.ts`: the seed keeps its sign.
- `README.md`: seed format under "Play locally".
- New scripts: `builder-scripts/phone42.mjs`, `scale42.mjs`, `seeds42.mjs`, `queue42.sh` and `jobs42.txt`. `builder-scripts/reg/` holds copies of the round 41 critic scripts, run unchanged.
