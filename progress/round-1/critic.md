# Drone Dash, round 1 critic report

**Verdict:** A charming, well-built arcade courier game that is unplayable on desktop as shipped. With bloom on (the desktop default), the 3D view turns into a flat orange screen for most of the flight.

## The single biggest gap: the desktop render goes blank in flight

With the default desktop settings (post-processing on), the whole 3D view regularly turns into one flat peach-orange colour. Only the HUD stays visible. This happens while you climb, boost, hover high, and even hover still at 14 m. It lasts for seconds at a time, and some single frames flicker back to normal, so it strobes. With `?post=0` the same flight renders perfectly. On touch devices post-processing is off by default, so mobile does not have the bug.

Evidence:
- I read back pixels inside the page after each frame (9 sample points per frame, Apple M5 Metal GPU through ANGLE). While I held W+Space for 3 s, **187 of 331 frames (56%)** were one flat colour with post on. With `?post=1` it was 202/348, and with `?post=0` it was **0/361**. Script: `critic-scripts/pixel-probe.mjs`, `pixel-probe2.mjs`.
- Key probe (`critic-scripts/key-probe.mjs`): standing still and W alone render fine. After about 0.6 s of W+Space the view goes flat. W+E (boost) was flat for 6 of 8 screenshots.
- In a full autopilot run, my screenshot helper retried 25 times over about 1 s and still could not get a non-blank frame at four key moments: `critic/d03-flying-BLANK.png`, `d04-near-pickup-BLANK.png`, `d05-parcel-picked-BLANK.png`, `d08b-after-bump-BLANK.png`. Also `d10-blank-frame-post-on.png` and `probe-boost-held.png`.
- The same moments with post off look great: `critic/nopost-d03-flying.png`, `nopost-d08b-after-bump.png`, `nopost-d06-carrying-enroute.png`.
- The camera is not inside a building. During blank frames it was in open air at y 40 to 48 (logged in the probe run). The background colour you see is the sky/fog horizon colour, which means the post chain outputs a flat result. A NaN or Inf from an HDR highlight that spreads through bloom is a likely cause, but the builder must find the real cause.

**Acceptance test the builder must pass:**
Load `http://127.0.0.1:5188/` with default settings (no URL params) in Playwright with channel `chromium` at 1280x720. Press Enter, then hold W+Space for 3 s, W+E for 3 s, and W+A for 3 s. After every rAF, read back 9 pixels spread across the canvas. **Zero frames may have all 9 samples identical** (the same metric as `critic-scripts/pixel-probe.mjs`). Bloom must stay on, with `renderer.post === true` in `__THREE_GAME_DIAGNOSTICS__`. Then run `node progress/round-1/critic-scripts/play-desktop.mjs`. Every screenshot in `critic/` it writes must succeed on the first try, with no file under about 100 KB.

## Other gaps for later rounds (ranked)
1. **Arrival is fiddly.** Pickup radius is 3.2 m and the vertical tolerance is tight. My autopilot circled a rooftop pickup 4.4 m away for over 4 s, and twice hovered on a roof edge 21 to 24 m from a street-level drop it could not drop down to (`nopost-d08-stuck-near-drop.png`). A good arcade courier game pulls you into the zone at the end of the approach, or shows a clear landing cone so the player knows where to descend.
2. **Collisions feel like walls of rubber, not crashes.** I logged 5 to 7 bumps per run. Speed drops from about 30 to 10 m/s with a small flash. There is no visible drone wobble or spin and no lasting penalty, so walls never feel dangerous. The timer is the only stake.
3. **Boost is tiny on mobile.** One 2 s boost press drained the bar almost to empty and flung the drone out over the water (`m03-boost-turn.png`). The boost button sits right next to climb, so it is easy to hit by mistake.
4. **Run start is disorienting.** At 0.3 s the title text is still fading over the gameplay view, and the target is 78 m away behind your left shoulder (`d02-takeoff.png`). The drone should spawn facing the first pickup with the camera already behind it.
5. **No sense of difficulty curve.** Three legs per run, all of the same kind. Time bonuses (+19 s) make the clock generous early and nothing ramps up. Two deliveries scored 1,188 and earned "New best" (`d09-game-over.png`).

What already meets the bar: the golden-hour art direction, readable building silhouettes, the drone model with banking, the strong objective beam and pad ring (`nopost-d08b-after-bump.png`), the edge-of-screen nav arrow with distance, the clear pop text and combo chip (`d07-delivery.png`), and a clean game-over card. The best polished browser arcade flyers have a camera that never hides the target, a world that reads at a glance, landings that snap in, and impacts you feel in the controller. The main things missing here are the stable render and the landing snap.

## Performance
- Desktop, 1280x720, Apple M5 on a 120 Hz display, about 85 s of active autopilot flight (10,283 rAF samples): **median 8.3 ms, p95 9.1 ms, p99 9.3 ms, max 10.3 ms, 0 frames over 20 ms.** In an earlier run there was a single 300 ms hitch on the first gameplay frame, likely shader compile. It is locked at 120 fps, so 60 fps is met with large headroom. The blank frames cost no time, so they are not a perf symptom.
- With post off: median 8.3 ms, p95 9.0 ms, one 151 ms hitch at start.
- Draw calls 71 to 85, about 291k triangles.
- First-load transfer (dev server, unminified): **6.95 MB over 35 requests**, under the 15 MB budget. The existing `dist/` is 4.1 MB on disk.
- Mobile (iPhone 13 landscape viewport, DPR 2, post off): 120 fps reported most of the time. One reading of 33.7 fps came during a boost and turn with two CDP touches held. This is unconfirmed and needs a real device check.

## Screenshots taken (progress/round-1/critic/)
- d01-title.png, d02-takeoff.png, d03-flying-BLANK.png, d04-near-pickup-BLANK.png, d05-parcel-picked-BLANK.png, d06-carrying-enroute.png, d07-delivery.png, d08-circling-pickup-BLANK.png, d08b-after-bump-BLANK.png, d09-game-over.png, d10-blank-frame-post-on.png, probe-boost-held.png
- nopost-d01-title.png to nopost-d09-game-over.png (the same flow with `?post=0`)
- m01-title.png, m02-flying-stick-and-climb.png, m03-boost-turn.png, m04-hover-hud.png, m05-game-over.png (iPhone 13 landscape, touch)

Scripts: progress/round-1/critic-scripts/ (play-desktop.mjs, play-desktop-nopost.mjs, play-mobile.mjs, blank-probe.mjs, key-probe.mjs, pixel-probe.mjs, pixel-probe2.mjs)
