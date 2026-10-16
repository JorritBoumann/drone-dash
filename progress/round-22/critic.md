# Drone Dash: round 22 critic report

**Verdict:** Both rounds land. The orbit camera is smooth and easy on desktop and phone, and the street now has believable cars and lively people at no frame cost. One real gap remains: under tunnel bridges the camera crowds the drone, and orbiting makes it much worse.

Build tested: commit 49c3b2c plus the uncommitted round 21 and 22 changes. My own dev server on port 5191, stopped at the end. The owner's server on 5188 was left alone. Every browser ran alone, one at a time, from one job queue (`critic-scripts/queue22.sh`, `jobs22.txt`). I did not read the builder notes.

## Camera (round 21)

**Controls are easy to find.** The title lists "Right-drag or swipe look · scroll zoom" and the touch line adds "drag the screen to look". In play, a small hint fades in after about 2.5 s. On desktop it says "Right-drag or two-finger swipe to look around". On the phone it says "Drag the screen to look around".

**Desktop, real input in flight (`cam-desktop.mjs`):**
- Right-drag of 300 px swings the view 94 degrees. It eases back behind the drone 1.1 s after release, with no overshoot.
- Right-drag down tilts the view up to 38 degrees. Eases back in 1.1 s.
- Mouse wheel: 3 notches zoom the chase distance from 8.5 m to 13.8 m. 6 notches back gives 5.4 m. No orbit on a mouse wheel. The zoom is saved.
- Synthetic trackpad two-finger swipe (fractional pixel deltas): orbits 73 degrees, no zoom. A vertical-only swipe tilts 29 degrees and does not zoom. So the trackpad and mouse wheel are told apart correctly.
- Ctrl-pinch (real Ctrl plus wheel, and a synthetic ctrl wheel): zooms in and out, no orbit.
- Left-click boost: on within 18 ms, off on release. Left press during a right-drag also boosts and stops on release. Boost still feels right.
- Right-click opens no browser menu over the canvas.

**iPhone 13 held sideways, real CDP touch (`cam-touch.mjs`):** one finger holds the stick forward, a second finger drags empty screen.
- A 160 px drag orbits 69 degrees. The stick keeps flying at 15 m/s during the drag.
- Eases back in 1.1 s (yaw) and 1.0 s (tilt).
- Pressing Boost does not orbit. A drag that starts on the pickup pill does orbit (36 degrees). That is fine.
- 0 camera pops, 0 page errors.

**Clipping (`cam-clip.mjs`, `frame-check.mjs`).** Real-time flights through every alley and tunnel, with random real right-drags (held 92% of the time) and wheel zoom. Seed 22 for 64 s, seed 130 for 45 s, and seed 130 for 45 s with no orbit as the baseline. Settled frames only (the first 90 after each teleport are skipped).

| Run | Frames | Camera inside a solid | Under ground | Drone hidden by a solid | Camera within 1.5 m of drone | Pops over 1 m a frame |
|---|---|---|---|---|---|---|
| Seed 22, orbit, 64 s | 6,925 | 0 | 0 | 0 | 1,723 (25%) | 60 |
| Seed 130, orbit, 45 s | 4,850 | 0 | 0 | 0 | 1,765 (36%) | 25 |
| Seed 130, no orbit, 45 s | 4,852 | 0 | 0 | 0 | 696 (14%) | 0 |

- **It never clips.** Not in walls, not in alleys, not under ground. The push-out works.
- **But it pays for that by crowding the drone in tunnels.** With no input, the camera sits within 1.5 m of the drone in 25% of tunnel frames. While orbiting, it is 39 to 60%. Then the drone fills the screen or leaves the frame (`cam-clip-130-5-tunnel.jpg`, `cam-clip-130-6-alley.jpg`, `cam-clip-22-5-tunnel.jpg`). In alleys it is 0% without orbit and 5 to 11% with orbit.
- **The pull-in snaps.** Orbiting toward a wall drops the camera from 9 m to 1 m in one frame (worst 12 m). 60 such pops in 64 s of heavy orbiting, none without orbit. See `cam-d-07-trackpad.jpg`: the drone was pushed into a wall and the view is all rotor.
- **Arrival framing:** I saw no fight with the round 3 framing. The approach framing fades out while the player steers and returns after the ease-back. I did not measure pad visibility in numbers this round.
- **Game over (minor, old):** the slow title and game-over orbit has no collision. In one run it sat inside a building for 118 frames.

## Street life (round 22)

**Measured (`street-probe.mjs`, deterministic, seeds 22, 4, 130, 58, 40 s normal plus 30 s rush, every 0.25 s):**
- Car overlaps: 0. Cars inside buildings: 0. Cars off their lane: 0.
- People inside solids: 0. People touching a car: 0. People in car lanes: 0 of about 400,000 samples.
- A person on the live pad: 1 sample on seed 130, then they walked off.
- About 25% of cars stand at stop lines at any time (40% in the frames I shot). Turns run on smooth arcs.
- 815 to 850 people per city, 290 to 400 drawn near the camera.

**How it looks.** Against good stylized indie city games:
- **Cars:** chunky low-poly sedans, taxis, vans and box trucks with wheels, windows and a body line. They read well from 2 m and from 24 m, and the paint fits each mood. At dusk the headlights glow and look good (`sl-d-4-e-rush-street.jpg`). The "looking basic" complaint is fixed.
- **People:** small blocky figures with a clear walk cycle, mixed shirt and trouser colours, kids among adults. At 30 m they read as people, not dots. They do not look like clones. The low pass is a highlight: people duck and throw their arms up (`sl-d-4-g-lowpass.jpg`, 4 reactions in one pass).
- **Too few cars.** From 200 random street points, a player has 2.3 cars within 50 m (1.7 to 2.3 downtown) and 3.9 in rush hour. With a quarter of them stopped, long avenues and junctions often look empty (`sl-d-4-c-street.jpg`, `sl-d-4-d-junction.jpg`, `sl-d-22-f-rush-cruise.jpg`). People are dense (22 to 34 within 30 m), so the street feels like a pedestrian zone with a few cars. A busy indie city shows a car every 15 to 30 m on a main road.
- **Boulevards read as roads.** People stroll on the red diagonal promenade, which has a dashed road-style centre line. From some angles they seem to walk down the middle of a road (`cam-d-07-trackpad.jpg`, `cam-m-03-drag-held.jpg`).
- No z-fighting seen. No pop-in seen at normal cruise heights. People are drawn within 105 m (82 m on phones), and at 45 m up the cutoff is not obvious.

## Performance

Headless Chromium caps at 120 Hz, so these numbers show hitches, not real GPU headroom.

| Run | Median | p95 | Max | Over 20 ms | Draw calls | Triangles |
|---|---|---|---|---|---|---|
| Street level 4 m, busy avenue, 12 s, desktop | 8.3 | 9.7 | 10.4 | 0 | 83 | 508k |
| Same, rush hour, desktop | 8.3 | 9.7 | 10.4 | 0 | 84 | 651k |
| Street level, iPhone 13 | 8.3 | 9.7 | 10.4 | 0 | 67 | 438k |
| Same, rush hour, iPhone 13 | 8.3 | 9.7 | 10.3 | 0 | 68 | 567k |
| perf18 route (tunnels, alleys, diagonal), desktop | 8.3 | 9.0 | 10.3 | 0 | 73 | 502k |
| perf18 route, iPhone 13 | 8.3 | 9.3 | 25.0 | 1 | 57 | 439k |
| Hand-fly 80 s, desktop | 8.3 | 9.6 | 16.8 | 0 | | |
| Hand-fly 80 s, iPhone 13 | 8.3 | 9.5 | 16.6 | 0 | | |

- p95 is the same as round 20 (about 9.6 ms). Traffic costs 0.04 to 0.08 ms a frame. People cost 0.2 ms.
- The round 20 phone hitch (200 to 280 ms) is gone.
- **Triangles doubled:** 254k in round 20, now 500k, and 650k in rush hour. Draw calls barely moved. This is the one perf risk for a mid laptop or older phone, and headless cannot show it.
- First load, production build: HTML 11 KB, CSS 38 KB, JS 813 KB (226 KB gzipped). About 0.86 MB, far under 15 MB. lil-gui (31 KB) loads only with `?debug`. Type check clean.

## Regressions

Scripts are copies of the round 20 critic scripts in `critic-scripts/`. Only the server port (5188 to 5191) changed. Output goes to `../critic/`.

- **Hand-fly first payout:** desktop 5.6 s, iPhone 6.6 s. Pass.
- **Flat-frame probe:** 1,023 frames, 0 flat, 0 errors. Pass.
- **Crash-classify, seeds 22, 58, 130:** 12 m: 25 charged crashes in 233 s, 6.4 a minute (round 20: 6.5). 5 were near the target. The closest face was 2.2 m below the top. **0 pad lips**, 0 hop-like. 20 m: 11 crashes (2.9 a minute), 3 near the target, closest face 3.1 m below the top, **0 pad lips**. Pass.
- **Low bot:** 22: 4,483 Silver. 58: 2,778 Silver. 130: 4,165 Silver. **Total 11,426** (round 20: 10,769). 0 crashes.
- **High bot:** 22: 2,526 Silver. 58: 1,837 Bronze. 130: 1,113 Bronze. **Total 5,476** (round 20: 5,966). 11 crashes (2.3 a minute, round 20 was 1.0).
- **The high bot's seed 58 stall is the bot, not the game.** This time seed 58 reached 4 drops. Its crashes, and seed 130's, cluster 10 to 13 m from the target at 20 to 27 m height against a 29.5 m tower. The faces are 3 to 9 m below the top, so these are not pad lips. The bot flies a straight line at a fixed height and drops into the tower next to the pad. Then it bounces and tries the same line again. The low bot and crash-classify show nothing similar. Traffic flies no higher than the vans at about 3 m, so it cannot cause this.
- **No-delivery farm:** 0 on seeds 22, 58, 130 (farm-probe), and 0 on smart-farm near. Pass.
- **Van slipstream:** works. With rush on, a bot tailing a van 5 m behind at van height sets the van draft flag. It banked 325 and 153 points on seeds 58 and 130. The capfarm van run on 22 scored 2,690 Silver. Pass.
- **Breakdown exact, card equals score:** all 6 bot runs. Pass.
- Still open from round 20: on the phone the pad marker sits on the stick (`cam-m-03-drag-held.jpg`) and on the climb button (`sl-m-58-a-cruise24.jpg`).

## Biggest remaining gap in these three areas

**The camera crowds the drone under tunnel bridges, and orbit makes it worse.** It never clips. But under a bridge it sits within 1.5 m of the drone in a quarter of the frames with no input. While orbiting, it is up to 60%. It also snaps in by up to 12 m in one frame. Players meet this on every marked tunnel shortcut.

**Acceptance test** (rerun `cam-clip.mjs` and `frame-check.mjs`, seeds 22 and 130, with and without `NOORBIT=1`, settled playing frames):
1. Camera inside a solid, under ground, or with the drone hidden by a solid: 0 frames (unchanged).
2. In tunnel passes, the camera is at least 2.5 m from the drone in 95% of frames without orbit, and in 90% with random orbit.
3. The drone is inside the frame in at least 95% of tunnel and alley frames, with and without orbit.
4. No frame-to-frame camera jump over 2 m relative to the drone (now up to 12 m).
5. Desktop and touch ease-back stay at or under 1.3 s, and the open-street numbers in this report do not get worse.

## Other gaps, ranked (whole game)

1. **Too few cars on the street.** 2.3 cars within 50 m (3.9 in rush), about a quarter of them stopped. Aim for 6 or more within 50 m downtown. Traffic costs under 0.1 ms, so there is room. Check the triangle count while doing it.
2. **Triangle count doubled to 500k to 650k.** It is invisible headless. Test on a real mid laptop and an older phone before adding more cars or people. Use lower-detail cars and people beyond about 40 m.
3. **Phone HUD overlap is still open** from round 20: the pad marker sits on the stick and the climb button.
4. **The boulevard reads as a road with people in the middle.** Drop or soften the dashed centre line on the promenade. Or add benches or planters. Then it reads as a walkway.
5. **From round 20, still the larger game-level gaps:** a human playtest is overdue. Make delivery the main reward again. Teach the systems in layers.

## Screenshots (progress/round-22/critic/)

- Camera, desktop: `cam-d-01-title.jpg` (controls), `cam-d-02-start-hint.jpg`, `cam-d-03-rightdrag-held.jpg` (good), `cam-d-04-drag-pitch.jpg`, `cam-d-05-wheel-out.jpg`, `cam-d-06-wheel-in.jpg`, `cam-d-07-trackpad.jpg` (bad: wall pull-in, drone fills the screen), `cam-d-08-pinch-in.jpg`, `cam-d-09-leftboost.jpg`.
- Camera, phone: `cam-m-01-title.jpg`, `cam-m-02-start.jpg`, `cam-m-03-drag-held.jpg` (good orbit, but the pad marker sits on the stick), `cam-m-04-after-ease.jpg`.
- Camera in features: `cam-clip-130-5-tunnel.jpg` (bad: crowded under the bridge), `cam-clip-130-6-alley.jpg` (bad: drone out of frame), `cam-clip-22-5-tunnel.jpg`, `cam-clip-22-6-alley.jpg`, `cam-clip-22-10-alley.jpg`, `cam-clip-130-noorbit-*.jpg` (baseline).
- Street life, desktop, Rose dusk (seed 4) and Bright morning (seed 22): `sl-d-4-e-rush-street.jpg` (good: van, sedan, headlights), `sl-d-4-g-lowpass.jpg` (good: people react), `sl-d-4-a-cruise24.jpg`, `sl-d-4-b-high45.jpg`, `sl-d-4-c-street.jpg` and `sl-d-4-d-junction.jpg` (empty roads), `sl-d-22-c-street.jpg`, `sl-d-22-f-rush-cruise.jpg` (rush, no cars in view).
- Street life, phone, Hazy noon (seed 58) and Rose dusk (seed 4): `sl-m-58-*`, `sl-m-4-*`. `sl-m-58-d-junction.jpg` shows a street tree filling the frame.
- Regressions: `d-h*`, `m-h*` (hand-fly), `M-*`, `Q-*` (bot medals and crashes), `N-alt*` (crash-classify near target), `F-farm-*`, `C-capfarm19-van-seed22.jpg`.
