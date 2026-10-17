# Drone Dash: round 29 builder notes

The round 28 critic named five concerns. I worked on them in this order:

1. The desktop camera after a pickup or drop beside a wall.
2. Wheels on the CC0 cars.
3. The traffic overlap at the outer ring corners.
4. Triangles near parks.
5. The desktop first-flight hitch.

## How I worked and tested

- Two production snapshots, both served by `vite preview` and built by `builder-scripts/rebuild29.sh`:
  - the new build on 127.0.0.1:5191
  - the round 28 code, built before my first edit, on 5192
- The owner's server on 5188 was not touched. Both of my servers are stopped.
- The round 28 critic scripts are copied to `progress/round-29/builder-scripts/`. Only the output folder changed (`../builder-shots/`). `trisweep28.mjs` and `art28.mjs` also take `PORT`, and `art28.mjs` takes `TAG`.
- One browser at a time, from one job queue (`queue29.sh`, `jobs29.txt`, log `queue29.log`).
- A queue bug cost some time. A job line with `for i` overwrote the queue's own line counter `i`, so two old jobs ran a second time. The counter is now `QL`.
- New scripts:
  - `hitch29.mjs` and `hitch29-init.js`: a first-flight trace. They time the blocking WebGL calls and `new AudioContext()` per frame. They also list the shader programs compiled after Play.
  - `trisweep29.mjs`: the critic's sweep with the true count of each render, and a per-mesh breakdown at any spot over 600k.
  - `cars29.mjs`: every vehicle type from the side at 6 m and 30 m. Also a moving front wheel in two frames 0.06 s apart, and a car in a turn.
  - `ab29.py`: labelled before and after pairs of the art27 spots (`builder-shots/ab/ba29-*.jpg`).
- New debug hooks: `triBreakdown`, `renderStats`, `programs`, `meshInfo`. The bot hooks and the bloom clamps in `ObjectiveMarker.ts` are unchanged.

## 1. Desktop camera after a pickup or drop beside a wall

**Cause.** The slow-drone room floor (`CameraRig.keepRoom`) was 4.2 m on desktop and 8.8 m on touch screens. Both use a 60 degree view, so the desktop drone filled up to 77% of the screen height after a drop by a wall.

**Fix (`CameraRig.ts`, `Game.ts`).**
- One rule for every device: the 8.8 m floor (`CAMERA_TOUCH_ROOM`, 2.1 times 4.2 m) for a slow drone and for 3.2 s after each pickup or drop. A hovering drone on desktop now sits a little further away, as on the phone.
- The wider floor made the camera jump. With the player's orbit, a camera rose 8 m in one frame. Three changes stop that:
  - The floor never jumps out. When it wants more room, it holds the camera where it is and backs it off at 9 m/s.
  - A push straight out moves at most 2.0 m a frame. A rise over the drone moves at most 2.4 m a frame. I tried 0.6 and 0.9 m first. Then a drop by a wall filled 60 to 70% of the screen for 0.2 s (2 of 62 samples). So I raised them.
  - A camera already at its floor (within 2 cm) is left alone.
- A hard gap in every mode, alleys and tunnels too (`hardGap`). The camera never stays closer than 2.35 m to the drone's look point (0.4 m above its centre, the point the critic measures to). It picks the nearest clear spot: straight out, out along last frame's direction, back along the corridor or behind the heading, or over the drone. Above 2.1 m the move is a glide of at most 2.0 m a frame.
- The orbit camera, the tunnel framing and the arrival framing are otherwise unchanged.

**Numbers.** `hud-probe27` with the critic's `fb27-init.js` (first run, street bot 80 s, every 100 ms for 3 s after each pickup or drop). "Beside a wall" means a solid within 4 m at the event.

| Build | Device, seed | Wall samples | 40% or more | Largest | Closest camera |
|---|---|---|---|---|---|
| Round 28 (critic) | desktop 22 | 62 | 20 (32%) | 0.77 | |
| First fix | desktop 22, 130, 58, 22 returning | 62, 62, 62, 62 | 0, 0, 0, 0 | 0.35 | 5.8 m |
| First fix | iPhone 22, 130 | 62, 62 | 0, 0 | 0.37 | 3.05 m |
| Step limits 0.6 / 0.9 m | desktop 22, iPhone 22 | 62, 62 | 2, 2 | 0.70 | |
| Step limits 2.4 / 2.0 m | desktop 130, 58, 22 returning | 62, 61, 62 | 0, 0, 0 | 0.40 | 5.8 m |
| Step limits 2.4 / 2.0 m | iPhone 22, 130 | 61, 60 | 0, 0 | 0.37 | 2.71 m |
| Step limits 2.4 / 2.0 m | desktop 22 (machine slow, p95 33 ms) | 62 | 3 (4.8%) | 0.44 | 6.0 m |
| Final (frame-rate independent steps) | desktop 22, 130 | 62, 62 | 0, 0 | 0.38 | 5.6 m |
| Final | iPhone 22, 130 | 61, 61 | 0, 0 | 0.40 (not by a wall) | 5.9 m |

- The last desktop 22 run before the final fix had 3 big samples. The machine was slow then (p95 33 ms, see "Test conditions"). The rise moved at most half the gap a frame, so at 30 fps it fell behind a wall cutting the view. In the final build, a camera well inside its floor takes the full step. The steps also scale with frame time. The final runs were also at 30 fps and pass.
- Final build, desktop 22 returning and desktop 58 (both at 30 fps): 0 of 62 and 0 of 62 at 40% or more. Largest 0.40 and 0.399. Closest camera 6.2 m.
- 2 m test: in every run above, the closest camera to the drone's look point was 2.71 m or more (critic sampler, every frame).
- Camera tunnel test: `cam-clip24`, seed 22, desktop with random orbit. This run was at a normal 120 fps, on the build with step limits 2.4 / 2.0 m:
  - 6,919 frames, in solid 0, under 0, occluded 0
  - closest 2.39 m in Marble Lane (round 28: 1.86 m)
  - jumps over 1 m: 11 (round 28: 9 to 12). Largest 3.31 m, a wall hit at the Marble Lane mouth with the camera lifted over the drone (round 28: 2.27 m).
  - The same test on the final build ran at 17 fps (slow machine): closest 3.42 m, in solid, under and occluded 0. Its jump count (48) is not comparable at that frame rate.
- iPhone, no orbit (`cam-clip24`): 6,924 frames, in solid 0, under 0, 1 jump over 1 m (round 28: 0), closest 3.2 m.
- Screenshots: `fr29-*`, `fin29-*`, `fin3-*` (title, 10 s, 31 s, 45 s, and any frame with the drone box at 40% or more), `cam-clip-22-*`.

## 2. Wheels on the cars

**Cause.** The Kay Lousberg cars lost their wheels in the round 28 decimation. About 200 broken shards of each car's wheels stayed in its `trim` part, inside the arches.

**Fix (`StreetKit.ts`, `Traffic.ts`).**
- One new InstancedMesh (`traffic-wheels`) holds every wheel of the near vehicles. It costs one draw call plus its shadow. Near means within the 55 m detail range.
- The wheel is procedural and flat shaded like the kit. It has a dark tread, a dark sidewall, a light rim with five dark holes, and a hub, on both faces. That is 132 triangles a wheel.
- Wheel spots: the arch centres measured on the meshes (rear -1.25 m, front +1.15 m, radius 0.31 m) for the three CC0 cars. The round 22 spots for the vans (4 wheels) and box trucks (6 wheels). Their baked wheels are gone, so every ground vehicle uses the same wheel.
- The model bodies ride 7 cm higher (`MODEL_RIDE`), so the arches sit just over the tyres. The lamps and taxi sign move with them. The trim shards inside the wheel volume are dropped at load.
- Wheels spin with the distance driven. The front pair steers by the heading's turn rate (bicycle model), clamped to 0.34 rad and smoothed.
- A camera can jump, for example a teleport in a test or a `renderFrom` shot. Then the near or far split is redone for the camera drawn (`Traffic.relod`). Before, a car next to a jumped camera was sometimes drawn far: no wheels, no trim.

**Check.** `cars29.mjs` on seeds 22 and 130:
- Every vehicle type from the side at 6 m and 30 m: `car29-new-22-t{0..4}-{6,30}m.jpg`, `car29b-new-130-t{0..4}-*.jpg`. Every car shows 4 wheels in its arches, touching the road. The box truck shows 6.
- Spin: `car29-spin-f0.jpg` and `-f1.jpg`, 0.06 s apart. The rim holes turn between the frames.
- A car mid-turn: `car29-steer.jpg` (the front wheels are mostly hidden by the body from this angle).
- Cost: 12k to 15k triangles at busy spots (main pass plus shadow), one draw call plus one shadow draw.

## 3. Traffic overlap at the ring corners

**Causes (`Traffic.ts`).** I found three.
- A car commits to a junction up to 32 m before its stop line. The exit-lane check skipped any car whose heading was not along the exit lane. A car still in its turn into that lane points across it, so it was skipped. The next car committed into a full lane.
- A turning car only followed cars ahead along its nose's heading. For most of the arc that heading points across the exit lane, so it drove into the queue there. At the outer corners every car turns, and the exit lane queues in rush hour.
- Rush-hour spawns. A new car sometimes appeared 5 m in front of a moving car in the same lane. That car was too close to stop (seed 58: a taxi spawned in front of a moving truck).

**Fixes.**
- `turnPathGap`: a turning car keeps its gap along the rest of its arc and on into the exit lane. It counts cars in that lane and cars further along a turn into the same lane.
- Exit-lane rule: a car does not commit while a car from another approach is turning into, or committed to, the same exit lane at the same junction.
- Spawns keep clear of a car behind in the same lane: its stopping distance plus 8 m. They also keep clear of any car turning at the junction just behind. A tick now tries up to three spawns, so rush hour fills about as fast as before.

**Numbers.** The critic's real-time probe `traffic-rt28.mjs` (every frame, 20 s normal then 80 s rush, seed 4 three times, then 22, 130, 58):

| Build | 4 | 4 | 4 | 22 | 130 | 58 |
|---|---|---|---|---|---|---|
| Round 28 (critic) | 0 | 2,055 | 99 | 336 | 920 | 0 |
| Turn fixes, 120 fps | 0 | 0 | 0 | 0 | 0 | 0 |
| Turn fixes, second run, 120 fps | 0 | 0 | 0 | 0 | 0 | **388** (spawn) |
| Plus the spawn rule, 30 to 58 fps | 0 | 0 | 0 | 0 | 0 | 0 |
| Final (people fix too), 30 fps | 0 | 0 | 0 | 0 | 0 | 0 |

- The 388 frames on seed 58 were the spawn case: a taxi spawned 5 m ahead of a moving box truck, mid-block on the west ring road. The spawn rule fixes it.
- The deterministic street probe (`street-probe.mjs`, seeds 22, 4, 130, 58, normal and rush): overlaps 0, cars in solids 0, off lane 0, people in solids 0, people hit 0, people on pads 0. Rush fills to 136 cars and 18 vans as before.
- Rush hour density (`perf-street`, desktop): 105.9 cars on average over the window, round 28: 115.1. That run was before the three-tries spawn change.

## 4. Triangles near parks

**Cause.** The breakdown at the worst seed 130 spot (650k, a park with people), main pass plus shadow pass:
- people 141k near and 63k far
- city 113k, lamp posts 42k
- trees about 60k, street props about 65k

People and near trees were drawn all round the camera, also behind it.

**Fixes (`Pedestrians.ts`, `Environment.ts`, `Game.ts`).**
- People further than 14 m are only drawn in or near the camera's view: a sphere test against the view frustum, 3.5 m plus 4% of the distance of margin.
- Trees further than 22 m keep the CC0 model only inside a cone of plus or minus 78 degrees round the view direction. Outside it they use the light blob, so their shadows stay. When the camera looks steeply down, every tree in range keeps its model.
- These cones use the camera of the previous frame. A camera can turn more than about 6 degrees or move more than 1.5 m since then. In that case the cones are redone just before the frame is drawn (`Environment.syncView`).
- A measuring trap: `__THREE_GAME_DIAGNOSTICS__.renderer` is published before the render, so it lags one frame. The critic's sweep max is still right, but its worst spot is the one after the real one. `renderStats` gives the count of the last render.

**Numbers.** The critic's `trisweep28.mjs` (1,336 to 1,376 spots, 3, 16 and 38 m, 4 headings, rush on):

| Run | Round 28 max | Round 29 max | Spots over 600k | Draw calls max |
|---|---|---|---|---|
| Desktop, seed 130 | 662k | 544k | 0 | 135 |
| Desktop, seed 22 | 599k | 521k | 0 | 137 |
| iPhone, seed 130 | | 499k | 0 | 116 |
| iPhone, seed 22 | 540k | 458k | 0 | 118 |
| Final build, desktop 130 / iPhone 130 | | 548k / 500k | 0 | 135 / 120 |

- p95 over the sweep, desktop 130: 486k. My first run, with only the tree cone in, gave a max of 655k and a p95 of 575k.
- Art views: 306k to 467k triangles (round 28 builder: up to 588k), 91 to 131 draw calls.

## 5. First-flight hitch

**Causes, from the trace (`hitch29.mjs`).**
- `new AudioContext()` took 189 to 215 ms inside `start()`. The round 28 prewarm ran 1.2 s after boot. The critic's probe presses Play about 1.7 s after load, before that timer fired.
- Five or six shader programs compiled on the first playing frame (about 25 ms): the route gates, pad marker sprites and beams, which are hidden on the title. A plain `renderer.compile` did not help. It compiled for the canvas, but desktop draws through the post-processing buffer, so the programs did not match and compiled again.

**Fixes (`Game.ts`, `Renderer.ts`).**
- The audio context is made 30 ms after the first frame. The cost moves into the loading frames.
- `warmPrograms` runs at 400 ms, and again when the assets are in. It shows every hidden object for one synchronous compile and hides it again before any frame is drawn. `RenderPipeline.compileScene` compiles for the target the scene is really drawn into.

**Numbers.** `hitch29.mjs`: fresh profile, Play 1.74 s after load (the critic's timing), then 3 s of flight.

| Run | Largest frame in the first 3 s of play | Programs compiled after Play |
|---|---|---|
| Round 28 code | 275 ms (AudioContext 211 ms plus 5 programs) | 5 to 6 |
| Desktop, 3 runs | 10.3, 16.7, 10.2 ms | 0 |
| iPhone 13, 3 runs | 16.6, 16.8, 16.7 ms | 0 |
| Final build, desktop / iPhone (30 fps machine, so every frame is about 33 ms) | 34.9 / 35.0 ms | 0 |

- `new AudioContext()` still costs 182 to 215 ms in headless Chromium, now at 0.7 to 0.85 s after load, during the loading frames.
- The critic's own hitch log in the first-run probes shows no frame over 40 ms in the first 80 s, on desktop or phone. Its only entry is the probe's final read at 80.5 s, as in round 28.
- Real desktop browser: not checked. Headless Chromium only.

## Regressions

### Test conditions

From about 18:12 the machine slowed down. `BTLEServer` (macOS Bluetooth) ran at 100% CPU, and the headless browser then ran at 30 fps or less instead of 120. Real-time results from then on are marked. Frame-time budgets come from the runs before that.

### Results

- **Blind look, street views:** before (round 28 build) and after, same art27 spots, both moods, desktop and iPhone: `builder-shots/ab/ba29-*.jpg` (28 pairs). Buildings, props, people, trees and light are the same. Cars now have wheels.
  - The one visible change is on desktop. The drone sits further away in these views (the shared 8.8 m floor for a still drone). So it is smaller and more street shows. The iPhone views are unchanged.
  - The traffic layout differs (stricter spawns).
  - I judge it unchanged or better, but this is not a blind pick.
- **Crash-classify, seeds 22, 58, 130 (120 fps):**
  - 12 m: 23 crashes in 211 s (6.5 a minute. Round 28: builder 5.9 to 6.1, critic 5.4 over 8 seeds). 6 within 30 m of the target, none within 8 m: 0 pad lips. Closest 3.8 m below a wall top.
  - 20 m: 9 crashes in 284 s (1.9 a minute. Round 28: 3.1 to 3.8). 2 near the target, none within 8 m. Closest 2.7 m below a wall top.
- **People:** `street-probe.mjs` on the final build: 0 in solids, 0 on roads, 0 hit by cars, 0 on pads, all four seeds, normal and rush. `pad-people23.mjs`: 48 legs, 1,536 samples, 0 on the live pad.
  - A first version of the people culling broke this (3 legs, 96 samples). It skipped people out of view before the pad rule ran, so their positions were stale. The cull now only skips the drawing.
- **Camera tunnel test:** see section 1.
- **Phone HUD probe (iPhone 22, 120 fps):** route marker on controls 0. Drone under pills 0.13% (1 of 793). Pops on the drone 0, pops on "Fly" 0. p95 9.7 ms. Closest camera 2.87 m.
- **Flat-frame probe:** 971 frames, 0 flat, 0 errors.
- **Payout chimes with their pop (`hud-probe28`):** desktop 22: 10 of 10, iPhone 130: 12 of 12 shown with `#slip-pop`.
- **Medal gate (`route-play-rt-x-m-esc17`), breakdown exact (`bdOk`, `domOk`) on all 8 runs:**
  - Street: 5,940 Silver, 3,957 Silver, 5,632 Silver (seeds 22, 58, 130), total 15,529 (round 28 critic 13,767).
  - Roof: 2,518 Silver, 977 none, 6,971 Gold, total 10,466 (round 28 critic 11,812 before its rerun). Seed 58 stalled again (1 drop, 7.9 m/s), as in round 28.
  - Roof reruns on the slow machine (30 fps): seed 22 856 none (1 drop, 6.9 m/s), seed 58 3,015 Silver.
  - Watch point: the roof bot takes its heading from the camera position (`atan2(drone - camera)`). On desktop the camera now rises over a slow drone beside a wall (as it already did on the phone), so that heading gets noisy. The game itself steers by the drone's yaw.
- **Exploits:** no-delivery farm 0 points on seeds 22, 58 and 130.
- **Frame time (`perf-street`, 120 fps, before the slowdown):** desktop p95 9.2 ms (normal and rush), iPhone 9.6 and 9.5 ms. Max 10.4 ms, 0 frames over 20 ms. The first-run probes at 120 fps: p95 9.4 to 9.9 ms.
- **First load:** `npm run build` passes (type check clean). Vite warns that the main chunk is over 900 kB. Without source maps the build is 2.64 MB. First load: HTML 11 KB, CSS 40 KB, JS 918 KB. The street assets (1.57 MB) still load after the first frame.

## Files changed (no new assets)

- `src/systems/CameraRig.ts`: eased floor, push and rise limits, `hardGap`.
- `src/game/Game.ts`: room floor on all devices, earlier audio prewarm, `warmPrograms`, view sync before each render, new hooks.
- `src/core/Renderer.ts`: `RenderPipeline.compileScene`.
- `src/world/StreetKit.ts`: wheel geometry and wheel spots, ride height, trim shards dropped, baked wheels removed.
- `src/world/Traffic.ts`: wheels, `turnPathGap`, exit-lane rule, spawn rule, `relod`.
- `src/world/Environment.ts`: tree view cone, people frustum, `syncView`.
- `src/world/Pedestrians.ts`: frustum culling of far people.
- `src/vite-env.d.ts`: hook types.
- `ASSETS.md`: a note on the car GLBs (no new files).

## Not done or open

- A blind before and after pick by a fresh critic.
- The roof-line bot's camera-based heading (see Regressions). I did not change the bots.
- A real desktop browser check of the hitch. Headless Chromium only.
- `progress.html` was not updated.
- No git commands were run.
