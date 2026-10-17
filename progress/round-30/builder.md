# Drone Dash: round 30 builder notes

Main concern from the round 29 critic: the camera snaps 2 to 3.7 m in one frame in fast climbs out of wall-side pads.
Small leftovers: (A) the carry farm on seed 130 at 0.52 of honest points a minute, (B) the roof bot stall on seed 22.

## How I worked and tested

- My own dev server on 127.0.0.1:5190 (stopped at the end). The owner's server on 5188 was not touched.
- A round 29 snapshot (`git archive c0b5238`, no repo state changed) ran on 5193 for the A/B jobs and was stopped.
- The round 29 critic scripts are copied to `progress/round-30/builder-scripts/`. Only the output paths changed (scratch
  folder for raw output, port 5190). One browser at a time from one queue (`queue30.sh`, `jobs30.txt`, log `queue30.log`).
- Machine load: BTLEServer at 99 to 100% of one core in every check (`cpu-start.txt`, `cpu-hud.txt`, `cpu-ff.txt`,
  `cpu-medal.txt`). Real-time runs were held at 30 fps again. Every camera number below comes from fixed-step (60 Hz)
  probes, except the hud-probe and cam-clip runs, which are real time.
- New scripts:
  - `climb30.mjs`: the critic's `climb29.mjs` plus per-frame camera-inside-solid (pad 0 and 0.1), a thin-line occlusion
    test (the `cam-sampler.js` one) and the count of frames with a jump over 1.0 m. Same events, same keys, same 60 Hz.
  - `climbdbg.mjs`: the same with the camera rig's glide state per frame (debug only).
  - `climbshots.mjs`: a filmstrip of the critic's worst climb (seed 22, event 4, the one in `climb29-d-22-4-spike.jpg`).
  - `capfarm-yaw.mjs`: `capfarm.mjs` steering by the drone's yaw instead of the camera (camera-independent bot).
  - `route-play-trace.mjs`: the deterministic `route-play.mjs` with a trace every 0.5 s, `HEAD=yaw` and `FIX=1`.
  - `route-play-rt-x-m-esc17-fix30.mjs`: the real-time medal bot with one bot fix (see B) and an optional trace.
  - `route-play-rt-x-m-esc17-port.mjs`: the medal bot taking `PORT` (round 29 A/B).
  - `geo22.mjs`, `geo22b.mjs`: solid geometry (and every collider) around the seed 22 stall spot.
  - `ab58.sh`, `ab58b.sh`: the deterministic street bot on seed 58, round 30 against round 29, steering by camera or yaw.
- New debug hook: `camSmooth()` (the camera glide's last check). Bot hooks and the bloom clamps in
  `ObjectiveMarker.ts` are unchanged.

## 1. Camera snaps in fast climbs out of wall-side pads

**Cause.** Three round 29 parts fought each other every frame. The follow pulled the camera toward the chase ideal (about
4 to 5 m behind). Then the room floor (`keepRoom`) wanted 8.8 m for 3.2 s after a pickup or drop. Beside a wall the
straight push-out was blocked, so it took the "rise" branch toward a point almost straight over the drone, at most 2.4 m
a frame. That move is a chord through the sphere, so the camera came closer while moving 2.4 m, on top of the 1.7 m the
per-frame cap had already allowed. The hard gap (`hardGap`, 2.35 m) could add its own 2.0 m step after that. Next
frame the follow pulled in again. So the camera swung between about 6 and 8.8 m, up to 3.7 m in one frame. A trace
(`climbdbg.mjs`) also showed a second case. The test turns the drone as it lands it on the pad, so the chase heading
is still swinging round when the climb starts, and that swing sweeps the view into the wall beside the pad. The clip
pull-in then cut the camera in by 2 to 3 m in one frame.

**Fix (`src/systems/CameraRig.ts`).**
- The floor, rise and hard-gap code now produce only a target. They place it in one step (the round 29 per-frame
  caps `RISE_STEP`, `PUSH_STEP`, `SOFT_GAP` are gone, which ends the 6 to 8.8 m swing).
- A new last stage, `smoothRel`, moves the camera. It works on the camera's offset from the drone, in a frame that
  turns with the chase heading and the player's orbit. So turning with the drone passes straight through, and the
  orbit control and ease-back are unchanged. Changes of distance, height and side follow a critically damped spring
  (0.09 s). It runs at up to 20 m/s, or 45 m/s when it backs away from the drone, and never moves more than 0.92 m
  relative to the drone in one frame.
- The glide is checked every frame. If it would put the camera in a wall (0.3 m pad), under 2.15 m from the drone, or
  out of sight of the drone, it tries the same glide with this frame's turn held back. Then it tries small steps toward
  the target, with a clear view first, then a thin-line view. Then it tries a step round the wall (over, under or
  aside, whichever ends nearest the target). Only if none of these works within 0.92 m does it take a bigger step, so
  the hard gap is now a soft limit that bites only where geometry forces it.
- The rise beside a wall now tries tilted-up spots on the camera's own side first (0.72 back and 0.7 up of the floor
  distance, then 0.45 and 0.9), and only then the near-vertical ones. The target stays near the camera, and the
  view keeps its heading.
- A teleport (the drone moved more than 3 m in a frame: a respawn or a probe placing it) restarts the glide, as before.
- The shake is now an offset on top of the smoothed camera. It is taken off at the start of the next frame, so it
  cannot build up in the glide.
- Unchanged: tunnel and alley framing, arrival framing, orbit limits, the swing, the per-frame cap of round 23, the
  push-out from walls, `keepInFrame`.

**Numbers (fixed 60 Hz steps, the critic's 32 climbs: seeds 22 and 130, Space, Space+S, Space+A, Space+W).**

| Climb test, 32 climbs, 4,800 frames | Jumps over 1.0 m | Over 1.7 m | Max jump | Inside solid (pad 0 / 0.1) | Drone hidden | Closest camera | Frames at 40% or more | Max height share |
|---|---|---|---|---|---|---|---|---|
| Round 29 code, desktop (`climb30-base-d.log`) | 48 | 30 | 3.71 m | 0 / 0 | n/a | 4.34 m | 8 | 0.514 |
| Round 30, desktop (`climb30-d.log`, `climb30-final-d.log`) | **0** | 0 | 0.88 m | **0 / 0** | 0 | **5.43 m** | 0 | 0.395 |
| Round 30, iPhone 13 (`climb30-m.log`, `climb30-final-m.log`) | **0** | 0 | 0.91 m | **0 / 0** | 0 | **5.42 m** | 0 | 0.395 |
| Critic's own `climb29.mjs`, round 30, desktop / iPhone | 0 / 0 (it counts over 1.7 m) | | 0.91 / 0.90 m | | | 5.42 / 5.42 m | 0 / 0 | 0.394 |

The filmstrip of the critic's worst climb (seed 22, event 4, a pickup then Space) is
`builder-shots/climb30-{d,m}-22-4-up-f00..f70.jpg`. The camera stays 7.4 to 10 m away and the drone stays at 17 to 33% of the
screen height. Round 29 snapped 3.6 m there in one frame and reached 51%.

**Wall-side framing (hud-probe28, first run, street bot 80 s, real time at 30 fps, every 100 ms for 3 s after each
pickup or drop; "beside a wall" = a solid within 4 m; `fb27.py`).**

| Run | Samples after events | Beside a wall | Drone box 40% or more | Max share | Closest camera (whole run) | Inside solid / hidden |
|---|---|---|---|---|---|---|
| Desktop seed 22 | 150 | 61 | 0 | 0.356 | 3.92 m | 0 / 0 |
| Desktop seed 58 | 122 | 61 | 0 | 0.348 | 4.69 m | 0 / 0 |
| Desktop seed 130 | 116 | 55 | 0 | 0.241 | 7.78 m | 0 / 0 |
| iPhone seed 22 | 121 | 62 | 0 | 0.347 | 2.75 m | 0 / 0 |
| iPhone seed 58 | 90 | 30 | 0 | 0.333 | 5.67 m | 0 / 0 |
| iPhone seed 130 | 104 | 61 | 0 | 0.228 | 8.03 m | 0 / 0 |
| Android seed 317 | 89 | 60 | 0 | 0.344 | 3.10 m | 0 / 0 |

So 0 of 390 wall-side samples reached 40%; round 29 had 3 of 454. No open-street frame came under 2.5 m.

**Tunnel and orbit test (`cam-clip24.mjs`, real time at 30 fps, 62 s each).**

| Run | Frames | Inside solid (pad 0 / 0.1) | Drone hidden | Under street | Camera jumps over 1 m | Closest |
|---|---|---|---|---|---|---|
| Desktop seed 22, random orbit | 1,060 | 0 / 0 | 0 | 0 | 0 (round 29: 44) | 3.81 m |
| Desktop seed 58, random orbit | 1,060 | 0 / 0 | 0 | 0 | 0 (round 29: 28) | 6.47 m or more |
| iPhone seed 22, no orbit | 1,057 | 0 / 0 | 0 | 0 | 0 (round 29: 0) | |

All ten passes per run (tunnels and alleys) are PASS. Orbit share 0.88, as in round 29.

## 2. Leftover A: carry farm on seed 130

**Answer: it is the bot. I did not change the street bonus cap.** `capfarm.mjs` picks its heading from the camera
whenever it is slow or turning, and the farm phase is all slow U-turns. So a camera change changes the farm path.

| capfarm, SIMT 600 (round 30 build) | Honest pts/min | Carry pts/min | Carry / honest | Carry farm time |
|---|---|---|---|---|
| Seed 130, camera heading (critic's script) | 2,893 | 691 | **0.24** | 54.6 s |
| Seed 130, yaw heading (`capfarm-yaw.mjs`, no camera at all) | 2,478 | 689 | **0.28** | 61.3 s |
| Seed 22, camera heading | 2,592 | 603 | 0.23 | 38.1 s |
| Seed 58, camera heading | 2,627 | 0 (no drop) | 0 | 47.7 s |
| Round 29 seed 130 (critic) | 2,972 | 1,537 | 0.52 | 33.4 s |

In round 29 the carry bot only farmed for 33 s and then made two plain deliveries, so it scored like a slow honest run.
With a camera-independent bot the farm earns 0.28 of honest. "Both" farms scored 0 on all three seeds. The no-delivery
farm (`farm-probe.mjs`) scored 0 on 22, 58 and 130. The per-leg cap (`bankPerMetre` 4.25) holds, and tightening it would
only cost honest street runs.

## 3. Leftover B: the roof bot on seed 22

**Answer: it is the bot, not the camera and not the game.**
- Deterministic runs (`route-play-trace.mjs`, 50 ms control steps): the roof bot steering by the camera made 8 drops
  on seed 22 (7,968). The same bot steering by the drone's yaw (no camera) made 1 drop and stalled on the same leg.
- The stall spot is the same in every stalled run on seed 22, my real-time ones too: (-98.5, 14.5, -54.3), 2.7 m from the
  Florist pad (-98.6, 0.4, -57). `geo22.mjs` and `geo22b.mjs` show why. The pad sits beside a 13.05 m building with a
  roof lip (12.85 to 13.75 m) along its edge. The roof bot starts its descent to pad height as soon as it is within 25 m.
  So it lands on that roof, holds "down", and pushes into the 0.7 m lip, 2.7 m short of the pad. Its unstick rule only
  fires more than 3 m from the pad, so it never lifts off. A plain descent from above the pad delivers at once (critic,
  `leg22-29.mjs`).
- The same pattern stalls it on seed 58 in some runs (on a roof at about 25 m, 6 m from a street pad).
- Real-time medal runs with the critic's bot this round: seed 22 856 (1 drop), seed 58 851 (1 drop), seed 130 8,598
  Gold (8 drops). Breakdown exact on all three. Round 29: 982 / 4,521 / 4,759. The 30 fps cap makes these runs noisy.
  Which leg ends on a roof depends on the bot's path.
- Bot fix tried (in `builder-scripts` only): `route-play-rt-x-m-esc17-fix30.mjs` and `route-play-trace.mjs FIX=1`. The
  unstick also fires when the bot is stuck high near a pad, and then it climbs to 16 m over the pad and comes straight
  down. Deterministic, yaw steering, seed 22: 1 drop became 3. Real time at 30 fps: seed 58 went from 851 (1 drop) to
  3,835 (4 drops), but seed 22 still dithers on that leg (982, 1 drop). The roof bot's arrival rule needs a proper rewrite (stay high until over the pad). I did not finish that.

## 4. Regression checks

| Check | Result | Round 29 (critic) |
|---|---|---|
| Crash-classify 12 m, 8 seeds (`ccv12.log`) | **0 pad lips**. 55 crashes in 558 s (5.9 a minute), 19 near the target, closest 1.5 m below a wall top | 0 pad lips, 5.3 a minute |
| Crash-classify 20 m, 8 seeds (`ccv20.log`) | **0 pad lips**. 28 crashes in 620 s (2.7 a minute), closest 2.7 m below | 0 pad lips, 2.0 a minute |
| People probe (`pad-people23.mjs`, 48 legs) | 0 people on active pads | 0 |
| Traffic per-step overlap (`traffic-det29.mjs`, 6 runs, 120 Hz) | 0 in all 6 | 0 |
| Phone HUD probe (iPhone 22, 58, 130; Android 317) | route mark on controls 0, drone under pills 0, pops on Fly 0, pops on the drone 1.05% / 0% / 0.36% / 0% | at most 0.40% |
| Flat-frame probe (`acceptance-probe.mjs`) | 271 frames, 0 flat, 0 errors | 0 |
| Chimes with pops (7 hud-probe runs) | 72 of 72 chimes with a pop on screen | 88 of 88 |
| Street medal gate, real time (`m-low-a.log`) | 4,766 Silver / **1,443 Bronze** / 5,317 Silver, breakdown exact on all 3 | 5,863 / 2,437 / 5,246, all Silver |
| Roof medal run, real time (`m-high-a.log`) | 856 / 851 / 8,598 Gold, breakdown exact | 982 / 4,521 / 4,759 |
| No-delivery farm (`farm-probe.mjs`) | 0 on 22, 58, 130 | 0 |
| Triangles / draw calls (`trisweep29.mjs`, desktop 130, iPhone 22) | max 547k / 471k, 0 over 600k; calls max 135 / 116 | 549k, 136 |
| First flight (`ff29.mjs`, desktop, 3 runs) | 0 long tasks after Play, 0 shaders compiled after Play | 0 |
| `npm run build` | passes, type check clean; JS 973 KB (first load about 1 MB, the CC0 assets still lazy-load) | 2.7 MB total, 918 KB JS |

**Street gate on seed 58 is a real worry.** The street bot fell from Silver to Bronze there twice (1,443 and 1,702, 2
drops each). The round 29 code on the same machine, minutes later, made 4,052 Silver with 3 drops (`m-low-58-r29.log`).
The street bot steers by the camera whenever it is slower than 4 m/s, at every pad and corner. So the new camera changes
its path. Evidence that the game itself plays the same: the deterministic street bot steering by the drone's yaw (no
camera) scored 5,369 with 4 drops on round 30 and 5,290 with 4 drops on round 29 (`rp-low-58-yaw-5190.log`,
`rp-low-58-yaw-5193.log`). Steering by the camera it scored 2,434 on round 30 and 3,984 on round 29, both with 3 drops
(`rp-low-58-cam-*.log`). In a 100 s trace of slow moments (under 4 m/s), the median angle between the camera direction
and the drone's heading is 0.53 rad on round 30 against 0.75 on round 29. But the worst 10% reach 1.44 rad against 0.95
(`rp-low-58-cam-trace-*.log`). So at some slow moments beside walls the new camera stays further off the heading, and
that steers the bot wrong. A human sees the drone turn, so this may not hurt play. But it is worth a human check
(hover beside a wall on seed 58 and turn), and the gate should be rerun with a yaw-steered street bot.

## 5. Known limits and what I did not finish

- The roof bot's arrival rule (descend once within 25 m) still lands it on roofs beside street pads. My bot fix helps
  in deterministic runs and on seed 58 in real time, not yet on seed 22. This is bot work, not game work.
- In the climb test the view can sit behind a building corner for a few frames, so the drone is half hidden by the
  facade mesh while the colliders say the line of sight is clear. The round 29 code shows the same view at the same
  moment (`builder-shots/r29code-climb-d-22-4-up-f16.jpg` against `climb30-d-22-4-up-f16.jpg`). The facade meshes stand
  a little proud of their colliders. Not fixed.
- Real-time frame time is still not measurable on this machine (30 fps cap). The glide adds a handful of segment and
  point tests per frame. I did not time it separately. First flight showed no long tasks.
- Desktop pops over the drone (critic's ranked gap 1) were not in scope this round.

## Files changed

- `src/systems/CameraRig.ts`: `smoothRel` (the glide in the drone's turning frame, with the wall, gap and sight checks
  and the step round a wall), shake as an offset, floor / rise / hard gap place their target in one step, tilted
  rise spots first, `SMOOTH` and `NUDGE` constants. `RISE_STEP`, `PUSH_STEP`, `SOFT_GAP` removed.
- `src/game/Game.ts`: debug hook `camSmooth()`.
- `src/vite-env.d.ts`: its type.
- `progress/round-30/`: this file, `builder-scripts/` (copied critic scripts and the new ones above, all logs),
  `builder-shots/` (30 JPEGs: the climb filmstrips for round 30 and the round 29 code, the round 29 snap frame,
  tunnel and alley views, desktop and phone pop shots, the worst triangle spots).
