# Drone Dash: round 43 builder notes (last release fixes)

All 8 items are done. Every acceptance check ran and passed on the final code. The regression list ran too, one browser at a time (`builder-scripts/queue43.sh`, `jobs43.txt`). My servers were 5191 and 5192 for dev (own Vite cache, no HMR) and 5193 for `dist/` at the root. 5194 served `dist/` under `/nested/game/`, and 5195 served the outer page on another origin. 5196 served a round 42 copy once, for the allocation baseline. I stopped all of them. I did not touch the owner's server on 5188.

## Fixes

1. **Game-over card in the corner (platform blocker).**
   - HTML card (`src/styles.css`): on a wide screen, `#over-screen` keeps `76px + the larger side safe-area inset` free on both sides, so the centred card never reaches the corner box. On a tall screen it keeps that room above and below. The card's width and height are capped to what is left. The time line and breakdown labels wrap, and the numbers stay on one line. On a short phone the row layout now uses `align-items: safe center`, so a tall body scrolls from its top instead of being cut off above.
   - Canvas card (`CanvasHud.drawOver`): its width is capped at the viewport minus the corner box on both sides. If the height does not fit, the whole card scales down. Long rows get smaller type first, then an ellipsis. It is placed at least 4 px right of the corner box, which now includes the safe-area inset.
2. **Corner inside the placement search (Codex high).** `Game.cornerPush` is gone. The nav marker and the gate tag now share one search, `Game.placeSearch`. For a good spot, the footprint (marker, pill and edge arrow) must be fully on screen and clear of every block. The blocks are the corner box, the touch controls, the top panels and a showing pop. If the start spot is not good, the search walks the screen edge as before. If no edge spot is good, it takes the first spot that is on screen and clear of the corner and the controls. The top panels and the pop can give way. It never pushes after the search. The nav edge inset went from 40 to 48 px, so the edge arrow (46 px out) stays on screen. The search now runs on desktop too, for the corner and the screen edges. The round 40 desktop minimap nudge is kept as it was.
3. **Event labels on screen (Codex medium).** `CanvasHud.updateEvent` clamps the label to the viewport after the overlap moves. If the clamped spot lands on a panel again, it tries spots above and below. A label wider or taller than the screen is drawn smaller to fit. The corner test uses the real corner box (with the inset), not a fixed 72 px.
   - I also found the same problem in the HTML HUD: on Pixel 7 and 915x412, the rush-hour banner reached up to 9 px past the left edge during its pop-in (scale 1.12). `Hud.touchLayout` now leaves room for that overshoot in `--pop-w`.
4. **Canvas game-over card built once (Codex medium).** A `MutationObserver` on `#over-screen` marks the card dirty at each change of the HTML result. `updateOver` reads the DOM and builds rows and strings for a dirty card, or for a change of screen, pixel ratio, seed or corner. On other frames it does none of this. The panel list is built once, and the box object is reused.
5. **Grapheme truncation (Codex medium).** New `graphemes()` uses Intl.Segmenter. Its fallback splits by code point and keeps combining marks, skin tones, ZWJ sequences and flag pairs together. New `fitText()` does a binary search on whole graphemes, measured with the ellipsis. The objective pill and the game-over card rows use them.
6. **Objective pill floor (Codex low).** The 120 px minimum can no longer exceed the slot, in `CanvasHud.objMax` and `Hud.fitObjective`. If the slot is too small for the fixed parts, the canvas pill drops its distance text first.
7. **Phone hull probe: not real.** The 2% came from the probe, not the game. Details below.
8. **Score panel and the safe area.** `.hud-score` now sits at `left: calc(76px + env(safe-area-inset-left))`. That is 12 px outside the corner box plus the inset. The canvas score panel is drawn 8 px left of the HTML box, so it is 4 px outside. `Hud.cornerBox()` now updates its box in place (no new object per read).

## Item 7: the hull probe

- I saved the frames the critic's probe counted as leaks (`builder-scripts/hull43.mjs`, a copy of `hullwater35.mjs` with frame saving). All 16 sweep leaks in round 42 were sail boats, all in the "into-hull" view: camera 3 m up, 2.2 m to starboard, looking down at the bow.
- In the frames, the counted patch is open sea beyond the bow. The bow post, the sail foot and the far rail frame it. It is not inside the hull. See `builder-shots/hull-r42probe-leak-sail-moored-N-M-CAP.jpg`: the normal frame, the probe's water mask with the patch in green, and the hull lid in magenta.
- Cause: the debug hook `G.waterShown(x, z)` returns the swell height relative to `WATER_Y` (-0.7 m, `src/world/Water.ts`). The probe compares it with absolute ray heights. So each ray "hit the sea" 0.7 m too high, and for a steep view over the bow that point fell inside the hull outline. A ray traced through the patch reaches the real sea at 3.4 m forward and 1.1 m to port, past the bow tip. The probe counts only patches that do not touch the frame edge. The wider phone frame (2.19:1) closes this patch off from the edge, and the desktop frame does not.
- I fixed the probe, not the game: `hull43.mjs` adds `WATER_Y` (`RAWWATER=1` gives the old behaviour). The debug hook is unchanged, because other bots use it.
- Same frames, same build: with the old probe, the sail sweep (seed 130, 6 steps) gave 2 + 2 leak frames. With the fixed probe it gave 0 + 0. With the lids off (the probe's positive control), the fixed probe still finds water in the hulls (`leak0` 12 of 18). So it still sees real leaks.
- Full phone run with the fixed probe: seeds 130 and 22, every boat kind, 12 sweep steps with 3 views each. See the table below. I used 12 steps instead of 24 to fit the time box.

## Acceptance (scripts in `builder-scripts/`, logs in `builder-scripts/logs/`)

| Check | Result |
|---|---|
| Full real-time runs to game over (`play43.mjs` and `sampler43.js`, from the critic's `play42.mjs`). Screens: iPhone 13 with safe-area emulation (47/47/0/21), Pixel 7 and 915x412. Seeds 22 and 130, HTML and canvas HUD. Every frame, the sampler checks nav and gate parts, pops and canvas panels against the corner box. The box is 64 px plus the inset, read from `env()`. It also checks that markers are on screen and off the touch controls, and that event labels are fully on screen. Every 3rd frame, it checks every painted element. Only `#speed-lines` and `#hit-flash` are skipped now, so the critic's filter gap is closed. On every game-over frame, it checks the HTML card against the corner. | 12 configurations, 13,131 to 16,154 frames each. **Corner: 0 frames in all.** Game-over card: 0 frames in the corner. The HTML card starts at x 123 on the iPhone with insets, x 166 on Pixel and x 125 to 192 at 915x412. The canvas card starts at x 187 or more. **Markers off screen: 0. Markers on the touch controls: 0.** **Event labels off screen: 0.** Overlaps (labels, pill, score): 0. Medal pops on the drone: 0. Canvas message scale: 0 bad of about 1,400 to 1,800 samples per canvas run. 0 page errors. The longest result was 5 deliveries and 6,574 points (iPhone, seed 22, canvas). |
| Fixes made during that list | The first iPhone seed 22 runs showed the gate tag on the stick for 183 frames. No edge spot was free (pop, top panels and controls), and the last resort of the search ignored the controls. The new fallback tier (corner and controls) fixed it. Rerun: 0. In three HTML runs, the rush banner was up to 9 px off the left edge for 26 or 27 frames (fix 3 above). Rerun: 0. I reran each affected configuration on the fixed build. The table above uses the reruns. The last code change (desktop only: the minimap left the desktop search, after one marker-on-top sample in the desktop HUD probe) came after these phone runs. It does not touch the touch path. |
| Long, high-scoring card on 6 screens (`overcard43.mjs`). The card gets 7 breakdown rows, a 6-digit score and a long time line with overtime and crashes. The check runs every frame for 1.5 s from the start of the entry animation. | Screens: iPhone 13 with and without insets, iPhone 13 portrait with insets, Pixel 7, 915x412 and desktop 1280x720. HTML and canvas HUD. **0 frames in the corner and 0 off screen** in all 12. Shots: `builder-shots/overcard43-*.jpg`. |
| Canvas card: no per-frame work (`unit43.mjs`). CDP heap sampling at 64 bytes for 3 s of game over, on the dev build for readable names. | Round 43: about 29 KB sampled in the card code in 3 s. That is numbers only (`performance.now()` and opacity values). Round 42 copy, same test: about 790 KB. Panel draws: 1 before and 1 after 3 s (no redraws). When the HTML result changes, the card redraws exactly once (draws 1 to 2 in `overcard43.mjs`). |
| Canvas card content | Matches the HTML card: "TIME'S UP", medal, score, breakdown rows, "City seed 22" (`builder-shots/unit43-r43-canvas-over-*.jpg`). |
| Truncation (`unit43.mjs`) | Test name `Café Zoë 👩‍👩‍👧 Bäckerei 🇳🇱 Ångström 👍🏽 Noël` (combining umlaut in the last word): 37 graphemes, 51 code units. Cut at every width from 10 to 400 px: 0 bad (no U+FFFD, no lone surrogate, always a whole-grapheme start, never wider than asked). The fallback path gives the same 37 graphemes. The real pill: `builder-shots/unit43-r43-objective-*.png` (desktop shows the family emoji and the flag whole, then "Ån…"). |
| Phone hull probe | See the table below. |

## Regressions

| Check | Result |
|---|---|
| Flat-frame probe, bloom on | 911 frames, 0 flat, 0 errors |
| Crash-classify, 12 m, seeds 22, 58, 130 | 14 charged crashes, **0 pad lip** (`ccv-sum.py`), 0 hop-like |
| HUD probe desktop 22 / 130 (final build) | Marker on controls 0, marker on top boxes 0, drone under a pill 0, gate on controls or off screen 0. Pops on the drone 2/305 and 3/333 (round 42: 5/308 and 1/328). |
| HUD probe phone 22 / 130 | Marker on controls 0, marker on top boxes 0, pops over top boxes or controls 0, gate 0. Drone under a pill 1/794 and 0. Pops on the drone 0 and 0 (round 42: 12/281 and 0). |
| Minimap (`mm-measure40.mjs`) | Bearing median 0.10 deg, p95 0.78, max 9.7, 0 over 20. Real time median 1.2, p95 4.3. Placement: on screen, 0 overlaps on all 7 screens. |
| Street medal gate, seeds 22, 58, 130 | Silver 5,570, Silver 3,699, Silver 5,782. Breakdown and end screen exact on all three (bdOk, domOk). |
| Release smoke: production build under `/nested/game/` in a cross-origin iframe, with `?seed=22&slLaunch=x&foo=bar` (final build) | 0 failed requests, 3 requests per load, 0 errors, 0 console lines. Session complete: 1 call per run (1, then 2, still 2 after an abandoned run). Without the mock, the event fires once per run. Escape pauses and resumes. A double Escape leaves the game playing. Seed parity with dev: same sites, same first objective. Phone full pilot run: 1 call, Silver 5,287, 4 deliveries, 0 failed. |
| Root path (5193, final build) | 0 failed requests, 0 errors, desktop and iPhone. Only the 4 Chrome autoplay warnings. HTML HUD visible. |
| Cold-load flash | 0 bad frames, root and iframe, desktop and iPhone |
| Perf p95, street, no frame cap | Desktop HTML 7.7 / 7.6 ms (normal / rush), canvas 5.2 / 5.2. iPhone HTML 5.6 / 5.1, canvas 3.5 / 3.6. All under 12 ms. Draw calls up to 119, triangles up to 404k. |
| `npm run build` | tsc clean, no chunk warning. Game chunk 413.0 kB (+0.4 kB), three 588 kB. |

The hull, people-on-pads and harbour-perf probes were not on the list beyond item 7. Nothing in boats, water or people changed.

## Phone hull probe (fixed probe, final dev build)

| Metric (phone, seeds 130 and 22) | Round 42 critic (old probe, sweep 24) | Round 43 (fixed probe, sweep 12) |
|---|---|---|
| Views with sea in a hull (enclosed leak) | 18 of 122 | **0 of 122** |
| Sweep frames with sea in a hull | 16 of 864 (1.9%) | **0 of 432** |
| Lids off (positive control): views / sweep frames | 49 / 438 | 49 / 208 |
| Views with any in-hull water pixel (per-pixel count, not enclosed) | 49 | 17 (max 390 px, bow and side views at the hull edge), 2 sweep frames |

The per-pixel count is a looser measure. Its hits sit at the hull edge in low bow and side views. I did not look into them further.

## Not fixed (seen, out of scope)

- On the iPhone game-over screen (phone on its side), the music toggle (top right) overlaps the card's top-right edge. It did before too (the old card was wider). It is not in the corner box.

## Files changed

- `src/styles.css`: score panel left with the inset. Game-over screen padding, card caps, wrapping and `safe center`.
- `src/game/Game.ts`: new shared `placeSearch` with the corner, screen and control tiers. `navPlace` (was `navTouch`) and `gateTagPlace` use it. `NAV_MX = 48`. `cornerPush` is gone. The canvas HUD gets the corner getter.
- `src/ui/CanvasHud.ts`: new `graphemes` and `fitText`, and the corner getter. The event label clamp and fit. The cached game-over card (observer, dirty flag, reused box) and its fit to the screen. The objective cap.
- `src/ui/Hud.ts`: `fitObjective` without the 120 px floor, `--pop-w` with room for the overshoot, `cornerBox` updated in place.
- Kept: the bloom clamps in `src/entities/ObjectiveMarker.ts`, the `#app` visibility rule (index.html, styles.css), every debug hook (`waterShown` unchanged).
- New scripts in `builder-scripts/`: `play43.mjs`, `sampler43.js`, `overcard43.mjs`, `unit43.mjs`, `hull43.mjs`, `capgeo43.mjs`, `dev43.mjs`, `serve43.mjs`, `queue43.sh`, `jobs43.txt`. `reg/` holds the round 42 builder and critic scripts, run unchanged. Per-run sampler data: `logs/json/`.
