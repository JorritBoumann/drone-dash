# Drone Dash, round 2 critic report

**Verdict:** The blank bloom render is fixed and the game now flies cleanly on desktop and mobile. The weakest part is now the last 30 m of every street-level leg: the drone settles on a roof, the target is out of view, and the clock runs out.

## Round 1 gap: closed

- Acceptance probe (`critic-scripts/acceptance-probe.mjs`), default URL, 1280x720, `renderer.post === true`:
  - W+Space 3 s: 326 frames, 0 flat (fewest distinct samples in a frame: 8 of 9)
  - W+E 3 s: 337 frames, 0 flat
  - W+A 3 s: 335 frames, 0 flat
  - **Total 998 frames, 0 flat. PASS.** Round 1 was 187 of 331 flat.
- `play-desktop.mjs` (round 1 script, copied to `critic-scripts/play-desktop.mjs`, now logs retries): **all 10 screenshots saved on the first try**. Every file is 351 KB or larger. PASS.
- Other ways to find a blank frame: `long-session.mjs` ran the 9-pixel probe on every frame through 2 runs. That covered climbing, boosting, a deliberate boost crash at 6 m, 4 deliveries, game over, the over screen, and an Enter restart. **29,422 frames, 0 flat, 0 read errors.** Mobile (post off) had 18,192 frames and 0 flat.

## Single biggest remaining gap: the final approach to street-level targets

Flying between targets feels good. Arriving at street-level targets does not. On the way down, the drone lands on whatever roof is between it and the pad. The chase camera then sits low behind the drone and shows only roof surface and parapet. The target is below the roof edge, and the nav marker is stuck at the bottom of the screen with a down arrow. The player has no view of the pad and no clear way down to it. This is the same problem round 1 listed as gap 1. It is now the main cost in a run.

Evidence (`critic-scripts/arrival-metrics.mjs`, seeds 11, 22, 33, 44, desktop, bloom on). The autopilot steers at the marker and cruises at 40 m. Inside 25 m it descends. If it stalls for 3 s, it backs off and climbs. It plays like a casual player who flies straight at the marker.
- Run A: 28 legs. **The last 30 m took 180.0 s in total. The cruise took 112.9 s.** The last 30 m is about a quarter of the distance. It used 61% of travel time. 6 of 28 legs needed more than 10 s for the last 30 m (32.4, 19.1, 13.7, 11.7, 10.0 s, and one that never arrived). 21 of 24 stalls were on street-level targets (y < 2).
- Run B (same seeds, plus visibility sampling): last 30 m 128.4 s, cruise 84.7 s. **In 3 of 4 runs, the clock ran out during a final approach.** I took 3,275 final-approach samples. **The nav marker was off screen in 46.1% of them.** In 16.6%, the drone was slower than 3 m/s and more than 4 m above the target. That means it sat on a roof.
- Desktop autopilot run (`play-desktop.mjs`): it hovered on a roof at 23 m altitude, 17 m from the "Noodle Bar" street drop, for 30 s until time ran out. The camera was jammed into the drone (`critic/d08-stuck-near-drop.png`).
- Screenshots: `critic/A-seed44-stall-final-approach.png` (6 m from the pharmacy drop; the drone sits on a roof at 7 m and only the roof shows), `critic/A-seed22-stall-final-approach.png` (27 m, roof parapet, marker pinned bottom), `critic/A-seed11-stall-final-approach.png`, `critic/A-seed33-stall-final-approach.png`.
- The trigger is not too small. The pickup zone is about 4.1 m for a rooftop and about 3.9 m for a doorstep, which roughly matches the drawn pad. The problem is view and route, not the hit radius.

The best arcade delivery flyers handle the drop moment in a few ways. They tilt the camera to look down at the target as you close in. They keep the pad or beam readable through occluding roofs. And they gently pull the craft into the zone, or over the edge, once you commit to it. The builder can choose how to fix it.

**Acceptance test:** Start the dev server. Run `node progress/round-2/critic-scripts/arrival-metrics.mjs` without changing the script (default seeds 11, 22, 33, 44, default URL, bloom on). It must print:
1. 0 timeouts (no run ends during a final approach), and no leg with `final` over 10 s.
2. `sum final` at or below `sum cruise`.
3. Nav marker off screen in under 15% of final-approach samples.
4. "slow and >4 m above target" under 5% of final-approach samples.

Rerun `acceptance-probe.mjs` too: 0 flat frames, so the fix does not break the round 1 fix.

## Other gaps (ranked)

1. **Run start still faces the wrong way.** I pressed Enter and gave no input. The camera flew in from 237 m away to 7.5 m in about 0.7 s. After that, the target nav marker stays off screen for the full 2.5 s sampled, on desktop and on mobile (`start-probe.mjs`). The first pickup sits at the left edge, 78 m away (`critic/d02-takeoff.png`, and after restart `critic/L05-restart-300ms.png`, 47 m to the left). The title copy is still fading over gameplay at 300 ms. Test: within 1.0 s of Enter, with no input, the nav marker is on screen and within 25% of screen width from center.
2. **Crashes have no stake.** A boost crash into a wall at 6 m altitude dropped speed from 17.9 to 9.5 m/s. 600 ms later the drone was at 1.4 m/s with no time lost (`critic/L01-crash-frame.png`, `L02`, `L03`). Typical runs log 5 or 6 bumps. Walls slow you down but never feel dangerous.
3. **The camera crowds the drone near walls.** In the long session, camera-to-drone distance fell under 2.5 m in 110 of 28,990 playing frames. The minimum was 1.92 m. When wedged, the props fill the screen (`critic/d08-stuck-near-drop.png`). This is rare but ugly, and it overlaps with the main gap.
4. **No difficulty curve.** Legs stay the same kind of task from start to end. The +17 to +19 s time bonuses keep the clock generous. Three deliveries (1,459) earned "New best" (`critic/L04-game-over.png`).
5. **The nav marker covers the objective pill.** The target can be ahead and above. Then the arrow and distance chip sit over the objective name. See `critic/m03-flight.png`, where "Juniper" is hidden, and `critic/m07-bump.png`.

What meets the bar:
- Golden-hour art and a city that reads at a glance.
- The drone model, the beam and the pad ring.
- Pop text and combo chip (`critic/d07-delivery.png`), and a clean game-over card.
- A clean mobile HUD with no control overlaps. The stick is 110 px, climb and descend are 54 px, boost is 76 px.

Physics feels weighty but controllable:
- Climb: 12.9 m in 1.5 s.
- 0 to 16 m/s: 1.95 s.
- Coast to a stop: 1.8 s over 8.9 m.
- S brakes from 15 m/s in 0.37 s.

## Performance

- Desktop 1280x720, bloom on, Apple GPU via ANGLE, 120 Hz. `play-desktop.mjs` with no per-frame readback: 8,306 frames (about 70 s of active flight). **Median 8.30 ms, p95 8.80 ms, p99 9.2 ms, max 9.4 ms, 0 frames over 20 ms.** 60 fps is met with large headroom.
- There is one hitch of about 241 ms on the first gameplay frame after Enter (`start-probe.mjs`), likely shader compile.
- With the 9-pixel readback running every frame (`long-session.mjs`): p95 16.7 ms and 30 frames over 20 ms. That is cost from the probe, not from the game.
- Mobile emulation (iPhone 13 held sideways, DPR 2, post off): 8,668 frames, median 8.3 ms, p95 9.1 ms, 6 frames over 20 ms, one max of 499 ms (a start or compile hitch). Confirm on a real device.
- First load: dev server 6.95 MB over 35 requests. The production build loads about 0.70 MB (JS 683 KB, CSS 15 KB, HTML 6 KB; source maps are not fetched). Both are well under the 15 MB budget. Draw calls are 66 to 85, with about 291k triangles.

## Note on test tooling

The first mobile run looked like the descend button climbed. It was my driver: CDP `touchEnd` ends the touch points it lists, so I lifted the stick finger instead of the button finger (`critic-scripts/mobile-lift-check.mjs`). With the fix, the touch controls work correctly. Not a game bug.

## Screenshots (progress/round-2/critic/)

- Desktop flow: d01-title, d02-takeoff, d03-flying, d04-near-pickup, d05-parcel-picked, d06-carrying-enroute, d07-delivery, d08-stuck-near-drop, d08b-after-bump, d09-game-over
- Long session: L01-crash-frame, L02-crash-plus120ms, L03-after-crash-600ms, L04-game-over, L05-restart-300ms
- Arrival stalls: A-seed11/22/33/44-stall-final-approach
- Mobile (iPhone 13 held sideways, touch): m01-title, m02-takeoff-250ms, m03-flight, m04-picked-up, m05-carrying-near-drop, m06-delivery, m07-bump, m08-game-over, m09-restart

Scripts (progress/round-2/critic-scripts/): acceptance-probe.mjs, play-desktop.mjs, long-session.mjs, arrival-metrics.mjs, start-probe.mjs, play-mobile.mjs, mobile-stick-check.mjs, mobile-button-check.mjs, mobile-lift-check.mjs
