# Drone Dash: round 41 builder notes

Time box hit (the session lost time to repeated output cut-offs). Parts 1 and 2 are built and tested. Part 3 fixes are in the code but most were NOT verified with numbers. The regression list was NOT run.

## Part 3, open fixes (code done)
- A. `Slipstream.update(dt, ..., realDt)`: meter fill and pace stay on the scaled step (distance flown); chain window, grace, drain, draft clock and smoothing use real time. `Game.updateSlipstream(dt, realDt)`: slow-clock reward, gain and HUD timing use real time; `payFlown` stays on scaled movement. Not measured (reuse round-40 `clock40.mjs`).
- B. `InputController.clear()` (blur, pause, visibility) releases the stick pointer (and its capture), zeroes the axes, resets the knob and clears `is-pressed`. `lostpointercapture` also releases the stick and the buttons. Hook `__GAME__.stick()`. Not measured.
- C. New `src/core/storage.ts` (`storeGet` / `storeSet`): every access guarded, in-memory fallback. All 16 call sites switched (Game, cities, goals, Audio, CameraRig, Hud, Minimap).
- D. Music button and all other UI button listeners go through `Game.onUi`, removed in `dispose()`.
- E. Light knock: shake 0.2 to 0.32 (was 0.45 to 0.65), its bump adds 0.08 to 0.2 (was 0.25 to 0.95), flash and bump burst smaller, spark fan about 15 to 20 (was 31 to 43). Not measured (reuse `crash39c.mjs`).
- F. Help line "M map · N music · Esc pause", chip title "Music (N)". M is now the map only (no longer music on menus); N is music everywhere.

## Part 1, platform (tested, `builder-scripts/platform41.mjs`)
- `vite.config.ts` `base: './'`; build references `./assets/...`; GLBs and WebP load via BASE_URL `./`.
- Production build served under `/nested/game/` (port 5291) inside an iframe on another origin (5292), query `?seed=22&slLaunch=1&slSession=abc123&cfg=...&utm_source=test&debugx`: 23 requests, 0 failed, 0 page errors, all 16 asset files under `/nested/game/assets/`. Played by keyboard inside the iframe (16.9 m/s after 4 s).
- Seed: `parseSeed` in `cities.ts`. Whole numbers kept (22 = 22, " 130 " = 130, -7 = 7, huge folded to 32 bits), other strings hashed to a stable 5-digit seed (same uuid twice = 28049), empty = random. Duplicate keys take the first. A `?seed=` city now resets the parcel RNG on every run (was daily only), so one seed is one exact game.
- Session end (`src/core/platform.ts`): `completeSession` calls `window.StateloopSession?.complete(detail)` and dispatches `stateloop:session-complete`, once per run, guarded. Detail: game, score, medal, medalTier, deliveries, seed, cityMode, runSeconds, run. Mock run: time-up gives 1 call and 1 event (same detail); two extra end calls add nothing; run 2 adds exactly one more. Without the mock: 0 errors, event fires once.
- Escape: two presses in the iframe paused and resumed; `defaultPrevented` false both times. No pointer lock in the game.
- 64 px corner: `.hud-score` moved to `left: max(76px, safe-left + 18px)`. Canvas HUD samples: 0 boxes in the corner (desktop 60 samples, phone 60).

## Part 2, canvas HUD (`src/ui/CanvasHud.ts`)
- Choice: drawn only on the platform (injected bridge, `slLaunch`, or `?hud=canvas`; `?hud=html` forces off). Elsewhere (Vercel link) the tuned HTML HUD stays as is, so 40 rounds of layout and probes are untouched. On the platform the HTML score, timer, objective, slip meter, minimap and centre pops get `visibility: hidden` (class `canvas-hud`) and the canvas draws them, so players and recordings see the same thing. Touch controls, menus, pause/deliveries chips, boost, nav marker and gate tag stay HTML (not in recordings; the minimap and objective distance carry direction).
- Each panel is a small 2D canvas on a quad in an orthographic scene, rendered after the post pass (no bloom), `toneMapped: false`, snapped to device pixels at the renderer pixel ratio (up to 2). Panels sit on the boxes of the hidden HTML elements (read 4 times a second), so safe areas, the corner and the HTML overlap rules carry over. Text comes from the hidden HTML, so both always match. Redraw only on change, 12 to 30 Hz per panel; the minimap uploads the round 40 minimap canvas after each of its draws. Centre messages arrive through `Hud.onCentre`. Hooks: `__GAME__.canvasHud()`, `canvasHudOff(bool)`.
- Recording test (`rec41.mjs`, canvas.captureStream into WebM, frames decoded from the WebM):
  - Desktop seed 22 (bright morning, 1280x720): score, clock, objective with distance, pickup pop, minimap all in the video. 0 corner, 0 overlaps in 60 samples. Draw calls 109, triangles 406k. CPU 0.022 ms a frame mean.
  - Phone seed 58 (hazy noon, 844x390 at dpr 3, video 1688x780): pixels changed by the HUD pass inside each panel: score 83%, clock 93%, objective 99%, slip 52%, minimap 79%. 0 corner. Objective box touched the event label in 2 of 60 samples. Calls 99, 366k triangles.
  - Shots: `builder-shots/rec-d22-*.jpg`, `rec-m58-*.jpg`, `iframe-nested-desktop.jpg`. WebM in `builder-scripts/out/`.

## Not run
Desktop dpr 2 and seed 130 recordings, A to F numbers, the whole regression list (flat frames, camera, crash-classify, people, traffic, boats, HUD probes, medal gates, farm, unstyled flash, perf p95, first load). Build: `npm run build` clean, no chunk warning, game chunk 404.7 kB (+16 kB).

## Files
New: `src/core/storage.ts`, `src/core/platform.ts`, `src/ui/CanvasHud.ts`. Changed: `vite.config.ts`, `index.html`, `src/styles.css`, `src/game/Game.ts`, `src/game/cities.ts`, `src/game/goals.ts`, `src/core/InputController.ts`, `src/systems/Slipstream.ts`, `src/systems/AudioSystem.ts`, `src/systems/CameraRig.ts`, `src/ui/Hud.ts`, `src/ui/Minimap.ts`, `src/vite-env.d.ts`. Kept: ObjectiveMarker bloom clamps, the `#app` visibility rule, all bot hooks.
