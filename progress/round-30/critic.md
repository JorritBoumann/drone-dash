# Drone Dash: round 30 critic report

**Verdict:** The climb snap is fixed. The new camera does not mislead players in turns. But in one alley (Quill Row, seed 22) it now hides the drone behind a wall for up to 0.6 s. Round 29 did not do this.

Build tested: the uncommitted round 30 work (CameraRig.ts, a `camSmooth` probe hook) on top of commit c0b5238. My dev server ran on port 5191. A copy of commit c0b5238 (round 29) ran on port 5192 for A/B checks. Both are stopped. The owner's server on 5188 was left alone. Every browser ran alone, one job at a time, from `critic-scripts/queue30.sh` and `jobs30.txt`. I did not read the round 30 builder notes. The round 29 scripts were copied to `progress/round-30/critic-scripts/`. Their output folders are relative, so they now write to round 30.

New scripts this round:

- `climb30.mjs`: climb29 with a 1.0 m jump line, a camera-in-solid check and the closest distance per frame.
- `heading30.mjs`: a fixed-step flight (boost, sharp turns, hover turn, zig-zag). Per frame, it compares the camera's view direction with the drone's heading and travel direction. It also logs trail distance, sideways offset and the nav marker position against the true bearing.
- `marker30.mjs`: a "human model" that steers only by the screen. It turns until the projected nav marker sits over the drone (or over screen centre). It runs with a yaw-truth bot as the baseline.
- `padview30.mjs`: glides onto 24 real pads, mostly beside walls (4 approach headings). After the pickup or drop, it logs where the camera looks.
- `route-play-hd30.mjs`: the street medal bot, unchanged except for a port setting and a log of its heading error.
- `cam-clip30.mjs`: cam-clip24 with a port setting. It also takes a screenshot of each moment that a wall hides the drone.

## Machine load (read first)

BTLEServer used 58 to 100% of one core all session. At the start, NordVPN also used 100% of a core (`cpu-ff.txt`). Unlike round 29, the headless browser was not capped at 30 fps this time. First-flight and perf runs held 120 fps (median 8.3 ms). The 80 s HUD runs swung between 8.4 and 16.5 ms median. All wall-clock times are still marked contaminated. The camera verdicts come from fixed-step probes.

## Camera results

### Fixed-step climb test (32 climbs, 31 beside walls, seeds 22 and 130): pass

| Build | Frames with a jump over 1.0 m | Max jump | Frames in solid | Closest camera | Frames at 40% or more | Max height share |
|---|---|---|---|---|---|---|
| Round 30 desktop | **0** of 4,800 | 0.90 m | 0 | 5.42 m | 0 | 0.394 |
| Round 30 iPhone 13 | **0** of 4,800 | 0.91 m | 0 | 5.42 m | 0 | 0.394 |
| Round 29 desktop (control) | 50 (in 11 climbs) | 3.70 m | 0 | 4.32 m | 10 | 0.516 |

The snap is gone in all four climb modes (up, up+back, up+turn, up+forward).

### Wall-side framing (real time, 3 s after each pickup or drop): pass

| Run | Wall samples | 40% or more | Max |
|---|---|---|---|
| Desktop 22 / 58 / 130 | 62 / 62 / 63 | 0 / 0 / 0 | 0.32 / 0.34 / 0.27 |
| iPhone 22 / 58 / 130 | 60 / 0 / 58 | 0 / 0 / 0 | 0.33 / 0.32 / 0.27 |

That is 0 of 365 wall samples at 40% or more (round 29: 3 of 454). iPhone seed 58 had no wall-side event in its 80 s, so it adds nothing. Per-frame open-street minimum: 2.53 m. Camera in solid: 0. Drone hidden in open streets: 0.

### Tunnels and alleys: fail (new regression)

| Run (10 passes each) | In solid | Closest | Jumps over 1 m | Drone hidden |
|---|---|---|---|---|
| Desktop seed 22, random orbit | 0 | 3.74 m | 1 | **39 frames** (Quill Row) |
| Desktop seed 58, random orbit | 0 | 4.17 m | 0 | **16 frames** (Thimble Lane, 0.32 s) |
| iPhone seed 22, no orbit | 0 | 2.72 m | 0 | **20 frames** (Quill Row) |
| A/B desktop seed 22, no orbit, round 30 | 0 | | 1 (2.46 m) | **115 frames: 0.57 s and 0.38 s** |
| A/B desktop seed 22, no orbit, round 29 | 0 | | 1 | 4 frames (0.03 s) |

Round 29's own runs had 0 hidden frames. On Quill Row the round 30 camera stays outside the alley mouth, so the screen shows a brick wall and the drone is gone. The player gets no input from the screen for half a second, in a narrow passage. See `cam-clip30-22-r30-noorbit-6-alley.jpg` (only wall) against `cam-clip30-22-r29-noorbit-6-alley.jpg` (the same moment on round 29: drone centred in the alley). `cam-clip30-22-r30-6-hidden.jpg` shows the corner hiding the drone. The code comment says the view of the drone comes back "a frame or two later". The real figure is 23 to 34 frames.

### Laggy or floaty?

Measured with fixed-step inputs, same drone path on both builds (`heading30.mjs`). The yaw bot shows that the physics are identical.

- **Full boost (peak 24 m/s):** the camera trails less. Distance is 14.5 m against 15.8 m at 25 m altitude, and 13.1 against 14.2 m at street level. Distance changes now lag about 0.3 to 0.5 s in both directions.
- **Sharp turns:** the view now lags *less*. Mid-turn, the view direction is 35° off the heading (round 29: 42°) and 9° off the travel direction (round 29: 16°).
- **After a turn: slower re-centre.** Round 29 is back behind the drone 0.5 s after the turn ends. Round 30 stays 0.5 to 0.8 m to the side and 2 to 4° off for 2 s. Its time constant is about 0.9 s (round 29: 0.2 s). After a hover turn, it is still 4 to 6° off 1.5 s later (round 29: 0.6°). On screen, the heading point drifts 30 to 80 px over those 2 s. It is a slow sideways settle, not a lag in the turn itself. Does it feel floaty? **Needs a human player.**
- Does the view still show where you are going? Yes. Turn shots match round 29 almost exactly (`heading30-r30-*` against `heading30-r29-*`).

## Seed 58: only the bot is fooled, and the Bronze did not reproduce

1. **The marker is true on both builds.** The nav marker, arch tags and pad marker are projections of the real target through the real camera. My probe compared the marker's screen offset with the true bearing every frame, and the relation is the same on both builds.
2. **A screen-steering player does better on round 30.** The human model turns until the marker sits over the drone. It finished 6 seed 58 legs in 67 s on round 30 against 106 s on round 29. Steering by screen centre took 66 s against 90 s. The yaw-truth bot took 60.1 s on both. Seed 22: 117 s against 125 s. Seed 130: 143 s against 173 s. When this player thinks it is "aimed", the true heading error is 20 to 23° on round 30 and 42 to 44° on round 29. So the new camera misleads a screen-steering player less, not more.
3. **The bot reads the camera wrong on both builds.** Under 4 m/s, the bot takes its heading as the line from the camera to the drone. That happens after every pad and hover turn. That is wrong by a median 30° on round 30 and 46° on round 29. Round 30 has a fatter tail (90th percentile 93 to 95° against 57°), from the slow re-centre after hover turns.
4. **No Bronze here.** Street bot on seed 58, round 30: 3,575, 4,311 and 3,482, all Silver. Round 29: 4,042 and 3,667, both Silver. The 1,443 and 1,702 runs look like bot variance plus the old 30 fps cap. To fix the bot, make it use drone yaw when slow.
5. After a wall-side pad, the camera ends 30° or more off the heading in 10% of frames (round 29: 7.9%). It is never over 60° on either build.

## Regressions

- **Crash-classify, 8 seeds, 0 pad lips: pass.** 12 m: 50 crashes in 547 s (5.5 a minute), 10 near the target, closest 4.4 m below a top. 20 m: 30 in 641 s (2.8 a minute), 11 near the target, closest 1.6 m below.
- **People probe: pass.** 0 people on active pads (48 legs, 1,536 samples).
- **Traffic per-frame overlap: pass.** 0 in all 6 fixed 120 Hz runs (seeds 4, 4, 4, 22, 130, 58).
- **Phone HUD probe: pass.** iPhone 22, 58, 130: marker on controls 0, drone under pills 0, pops on drone 0 / 0 / 0.39%, pops on "Fly" 0.
- **Flat-frame probe: pass.** 1,011 frames, 0 flat, 0 errors.
- **Chimes with pops: pass.** 63 of 63 chimes had `#slip-pop` shown within 0.3 s.
- **Medal gate, breakdown exact (bdOk) on all 10 runs: pass.**
  - Street: 4,003 / 3,575 / 5,652, all Silver, total 13,230 (round 29: 13,546). Strict delivery share 62.6%.
  - Lazy (cruise 10, no boost): 1,250 Bronze / 884 none / 1,035 Bronze, total 3,169.
- **Exploits: pass.**
  - No-delivery farm: 0 on 22, 58 and 130.
  - Carry farm: 0.23, 0 and 0.24 of honest points a minute. Honest runs: 4,559, 4,892 and 6,859 (Gold).
  - One delivery: best 1,149 Bronze (seed 130), so no better than Bronze.
- **Triangles and draw calls: pass.** Desktop 130: 542k, 135 calls. Desktop 22: 528k, 134 calls. iPhone 130: 489k, 117 calls. 0 spots over 600k.
- **First flight: pass.** 0 long tasks and 0 shader compiles after Play in 3 runs (2 desktop, 1 iPhone). Max frame 16.6 ms.
- **First load: pass.** Production build without maps: 2.7 MB. JS 921 KB, CSS 40 KB. Type check clean.

## Performance (contaminated, BTLEServer at 98%)

| Run (12 s) | Frame median / p95 | Max | Calls max | Triangles max |
|---|---|---|---|---|
| Street desktop, normal / rush | 8.3 / 9.3 ms | 9.5 ms | 132 / 137 | 461k / 473k |
| Street iPhone 13, normal / rush | 8.3 / 9.3 ms | 9.5 ms | 116 / 117 | 419k / 416k |

p95 is under 12 ms at the 120 Hz vsync, even with one core busy. The 80 s HUD runs had two short bursts of three frames at 90 to 110 ms. They came at 52 s on desktop 130 and at 55 s on iPhone 58. The probe takes screenshots during play, so these are probably probe stalls. The roughly 80.8 s frame in every run is the probe ending. Recheck on a quiet machine.

## Biggest remaining gap

**In an alley, a wall can hide the drone for up to 0.6 s.** The round 30 glide keeps the camera outside the alley mouth on Quill Row (seed 22). It also does this for a moment on Thimble Lane (seed 58). This happens with and without orbit input, on desktop and phone. Round 29 showed the drone in the same passes.

**Acceptance test:**

- Run `cam-clip30.mjs` (NOORBIT=1 SEED=22, desktop).
- Run `cam-clip24.mjs` on seeds 22 and 58 (random orbit) and on iPhone seed 22 (no orbit).
- Pass marks: no hidden spell longer than 0.1 s, and at most 10 hidden frames per run. Round 29 had 4 frames, 0.03 s. Camera in solid 0. Per-frame jumps over 1 m: at most 1 per run.
- `climb30.mjs` must still show 0 jumps over 1.0 m.

## Other gaps, ranked

1. **Slow re-centre after turns.** After each turn, the camera stays 0.5 to 0.8 m to the side and 2 to 4° off for about 2 s. Round 29 took 0.5 s. It likely comes from the new glide stacking on top of the old follow lerp. Test: in `heading30.mjs`, the sideways offset is under 0.2 m within 0.6 s after a turn ends, while keeping today's lower mid-turn lag. Is it floaty? **Needs a human player.**
2. **Desktop pops cover the drone** in 32 to 48% of pop samples (round 29: 28 to 44%). The phone keeps them clear. Test: under 2% on desktop seeds 22, 58 and 130.
3. **The street and roof bots steer by the camera when slow.** Their heading input is 30 to 46° wrong on both builds. So their scores change with each camera change. Switch them to drone yaw under 4 m/s before you use them as a medal gate again.
4. **Real-time perf on a quiet machine.** Recheck the 90 to 110 ms bursts and the p95 with BTLEServer idle.
5. **Shop signs and faces** (from round 28). Sign plates are white blobs, and people have no faces. **Needs a human eye.**

## Screenshots (progress/round-30/critic/), 53 files

- **Alley regression:** `cam-clip30-22-r30-noorbit-6-alley.jpg` against `cam-clip30-22-r29-noorbit-6-alley.jpg`, plus `cam-clip30-22-r30-6-hidden.jpg`, `cam-clip30-22-r30-7-hidden.jpg`, `cam-clip30-22-r29-7-hidden.jpg`, `cam-clip30-22-{r29,r30}-noorbit-{5-tunnel,10-alley}.jpg`, `cam-clip-22-*`, `cam-clip-58-*`, `cam-clip-22-m-noorbit-*`.
- **Turns, same frame on both builds:** `heading30-{r29,r30}-d-58-a25-{boostTurnL,cruiseTurnR,hoverTurnL,zigR}.jpg`.
- **Round 29 climb snaps (control):** `climb30-r29-d-22-4-spike.jpg`, `climb30-r29-d-22-9-spike.jpg`, `climb30-r29-d-130-6-spike.jpg`. Round 30 had no frame worth a shot.
- **Desktop pops on the drone:** `raw/fr30-d-{22,58,130}-h04-low-payout-pop.jpg`, `raw/fr30-d-{22,58,130}-h05-low-payout-chain.jpg`. Phone for contrast: `raw/fr30-m-22-h04-low-payout-pop.jpg`.
- **Medal runs:** `M-low-seed{22,58,130}-pass*.jpg`, `M-low-c10-seed{22,130}-pass1.jpg`.
- **Other:** `tris29-{d-22,d-130,m-130}-worst.jpg` (written by the reused trisweep29 script) and 4 crash-classify near-target shots (`N-alt*`).
