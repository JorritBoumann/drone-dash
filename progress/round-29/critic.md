# Drone Dash: round 29 critic report

**Verdict:** Round 29 fixes four of the five round 28 gaps. Cars now have wheels, rush-hour cars no longer overlap, triangles stay under 600k, and the first flight has no hitch. The wall-side camera passes by a hair. It crowds the screen far less now. But after a wall-side pickup, a fast climb makes it snap back and forth for up to a second.

Build tested: the uncommitted round 29 work on top of commit 0a60215. My own dev server ran on port 5191 and is stopped. A copy of commit 0a60215 (round 28) ran on port 5192 for A/B checks and is stopped too. The owner's server on 5188 was left alone. Every browser ran alone, one job at a time, from one queue (`critic-scripts/queue29.sh`, `jobs29.txt`). I did not read the round 29 builder notes. The round 28 scripts were copied to `progress/round-29/critic-scripts/`, and only their output folders changed.

New scripts this round:

- `cars29.mjs`: a wheel probe (count, ground contact, spin, steering) and street-level car shots.
- `traffic-det29.mjs`: per-frame traffic overlap at fixed 120 Hz steps.
- `trisweep29.mjs`: the round 28 sweep, but it reads the frame just drawn (`renderStats`). `DIAG=1` uses diagonal headings.
- `popcheck29.mjs`: looks for culled trees inside the view during fast camera turns.
- `ff29.mjs`: first flight. It logs long tasks and shader compiles after Play.
- `climb29.mjs`: a real pickup or drop beside a wall, then an instant climb, at 60 Hz steps.
- `hover29.mjs`: desktop framing at hover, cruise and boost (round 29 against round 28).
- `perf-street-port.mjs` plus `work29-init.js`: main-thread work per frame.
- `route-play-yaw29.mjs`: the roof bot steering by drone yaw.
- `leg22-29.mjs`: checks the seed 22 leg where the roof bot stalls.
- `medal-sum29.py`, `ab-make.py`: summaries and the blind pairs.

## Machine load (read first)

BTLEServer used 97 to 100% of one core during the whole session. I logged it before each timing block (`cpu-start.txt`, `cpu-ff.txt`, `cpu-tr.txt`, `cpu-perf.txt`, `cpu-medal.txt`). Every real-time browser run was held at exactly 30 fps (median frame 33.3 ms, every frame "over 20 ms"). Round 28 ran at 120 fps. So **all wall-clock frame times in this report are contaminated**. They only show the 30 fps cap. Where possible, I used deterministic or per-frame probes instead: fixed-step simulation, long-task and shader-compile logs, and main-thread work per frame. Real-time bot runs (medal gates, hud probes) also ran at 30 fps, so their control loops saw a quarter of the frames.

## Results for items 1 to 5

### 1. Camera after a pickup or drop beside a wall: pass, with one new flaw

| Device (first run, seeds 22, 58, 130, plus one more run) | Wall samples | 40% or more | Max | Closest camera |
|---|---|---|---|---|
| Desktop 1280x720 (3 first runs, returning seed 22) | 233 | 2 (0.86%) | 0.431 | 5.94 m |
| Phone (iPhone 13 seeds 22, 58, 130, plus Android 317) | 221 | 1 (0.45%) | 0.42 | 5.76 m |

- Pooled per device, both pass the 99% line (99.1% and 99.5%). Per run, desktop seed 22 (1 of 58) and seed 130 (1 of 56) are just over 1%. Round 28 desktop had 20 of 62 at 40% or more, up to 77%.
- **2 m test: pass.** All post-event samples were 5.76 m or more. Per-frame open-street minimum: 3.21 m in 7 runs (about 17,000 frames). Alleys and tunnels, desktop random orbit seeds 22 and 58 plus iPhone seed 22: minimum 3.39 m. In solid 0, drone hidden 0, drone under the camera 0.
- **The three spikes are one-frame camera snaps.** Each came while the bot climbed at about 10 m/s just after a pickup or drop. The camera went 8.8 m, then 5.9 m, then 8.8 m in 200 ms. A deterministic repro (`climb29.mjs`, 32 real pickups and drops beside walls on seeds 22 and 130, climbing at once) shows the pattern:

| Build | Climbs touching 40% | Frames at 40% or more | Max height share | Frames where the camera jumps over 1.7 m |
|---|---|---|---|---|
| Round 28 | 14 of 32 | 313 of 4,800 | 0.81 | 8 |
| Round 29 | 6 of 32 | 8 of 4,800 | 0.53 | **29** (max 3.7 m) |

  So crowding is much better, but the camera now jerks more. In 9 of 32 climbs it jumps 2 to 3.7 m in one frame. Then it swings between about 6 m and 8.8 m for up to a second (`climb29-d-22-4-spike.jpg`). The phone shows the same numbers. The 1.7 m per-frame cap from round 23 does not hold here.
- **As a player (desktop hover):** the drone is only a little smaller. At hover in an open street it fills 18.6% of the screen height at 8.8 m (round 28: 20.5% at 8.1 m). Cruise (9 to 17 m/s) and boost framing are identical to round 28 to the third decimal (`hover29-r29-*.jpg` against `hover29-r28-*.jpg`). It is still easy to read, and speed still feels close and fast. The view at a slow drone beside a wall is now a higher overview. Is that less exciting? **Needs a human player.**
- New side finding: on desktop the centre pops sit on the drone. Examples are "Parcel secured!" and the slip "+24 BANKED". They cover it in 28 to 44% of samples where a pop shows (round 28: 20 to 29%). See `fr29-d-22-h05-low-payout-chain.jpg` and `climb29-d-22-4-spike.jpg`. The phone moves its pops clear of the drone (0 to 0.4%). Desktop does not.

### 2. Wheels: pass

`cars29.mjs` read every near car and every wheel instance per frame. It ran on seeds 22 and 130: 720 steps, 5,818 car samples, six spots, rush on and off.

- Wheels per car: 4 on every compact, estate, taxi and van sample. The box truck has 6 (three axles). There were 0 cars with missing wheels and 0 stray wheels.
- Ground contact: every wheel bottom sits at road height (within 0.00000003 m).
- Spin: wheel turn times radius equals the distance the car moved, with median and 95th percentile error 0. None spin backwards. Wheels on a stopped car move under 0.01 m.
- Steering: front wheels turn into the curve on all 233 turning samples, up to 0.34 rad. Rear wheels never steer. Straight-lane cars: 95th percentile 0.004 rad.
- Street-level shots: `car29-22-t0..t4-side6m.jpg`. The wheels fill the arches and sit on the road. The style matches the low-poly cars. `car29-22-turning.jpg` is a van from the front: its skirt hides the wheels, which is fine.
- Cars beyond 55 m (the far version) have no wheels, as before. At that range a wheel is a few pixels. Is the swap visible? **Needs a human eye.**

### 3. Traffic overlap: pass

| Probe | Seed 4 (three runs) | 22 | 130 | 58 |
|---|---|---|---|---|
| Real time, every frame, round 29 (`traffic-rt28.mjs`) | 0, 0, 0 | 0 | 0 | 0 |
| Fixed 120 Hz steps, every step, round 29 (`traffic-det29.mjs`) | 0, 0, 0 | 0 | 0 | 0 |
| Same fixed-step probe on round 28 (control) | 873, 2,995, 2,864 | 3,606 | 443 | 151 |

- The real-time runs were at 30 fps (3,000 frames each), so I added the fixed-step probe. On round 28 it finds the old bug in all 6 runs. Every case is at an outer ring corner (x or z near plus or minus 157). On round 29 it finds 0 in all 6 runs, about 76,000 steps. So the fix is real.
- `street-probe.mjs` (4 seeds, normal and rush): 0 overlaps, 0 cars in solids, 0 cars off lane, 0 reversals.

### 4. Triangles and culling: pass

| Sweep (rush on, 3, 16 and 38 m) | Spots | Max triangles | Over 600k | Max calls |
|---|---|---|---|---|
| Desktop seed 130 | 1,336 | 549k | 0 | 136 |
| Desktop seed 130, diagonal headings | 1,336 | 543k | 0 | 134 |
| Desktop seed 22 | 1,376 | 519k | 0 | 136 |
| Desktop seed 22, diagonal headings | 1,376 | 524k | 0 | 136 |
| iPhone seed 22 | 1,376 | 462k | 0 | 118 |
| iPhone seed 130 | 1,336 | 504k | 0 | 118 |

- Round 28 peaked at 662k (seed 130). Median spot is now 408k (round 28: 456k). In normal street flight: 460k to 470k (round 28: 548k to 553k). People drawn went from 300 to 412 to 128 to 199.
- **No popping found.** `popcheck29.mjs` orbited the camera fast (about 5 rad/s) at three pitches and spun the drone. It used 4 park spots on seed 130, 1,920 frames per device. Desktop: 0 frames with a culled tree inside the view. iPhone: 3 frames (one tree at 29 m, at the frame edge, during a fast spin at 16 m). People counts change smoothly frame to frame. The filmstrip `pop29-d-130-f0..f3.jpg` shows nothing odd. Do shadows of culled people just outside the view pop at golden hour? **Needs a human eye.**

### 5. First-flight hitch: pass (deterministic evidence)

`ff29.mjs` used a fresh profile each time. Desktop ran 3 runs at the normal title wait and 2 quick-Play runs (1.7 s after load). iPhone ran 3 runs.

- Long tasks (50 ms or more) on the main thread from Play to 4 s after: **0 in all 8 runs**. Shader programs compiled after Play: **0** (52 desktop and 43 phone, all compiled on the title).
- Max frame interval: 35 ms in every run. That is the 30 fps cap, so it is contaminated. It still means no frame took 100 ms.
- The hud-probe runs (7 first and returning runs) logged no frame over 40 ms in the first 80 s. Round 28's 241 ms frame came from shader compiles on the first playing frame, and those are gone.

## Regressions

- **Blind A/B against round 28: fails by the letter, but it is noise.** I picked from 24 shuffled pairs (`critic/ab/pair-01..24.jpg`). The picks are in `ab/picks.txt`. I wrote them before I opened `ab/.key.json`. New wins: desktop golden hour 2 of 6, desktop bright morning 2 of 6, iPhone golden hour 3 of 6, iPhone bright morning 3 of 6. The rule allows losing 2 of 6 at most. But 20 of 24 pairs are the same scene. Only random traffic and the drone size differ. The four clear picks were about a van cut off at the camera (one each way) and car placement. Nothing in the city art got worse. The art views use the live camera, so the new drone is a little smaller and higher in frame.
- **Crash-classify, 8 seeds, 0 pad lips: pass.** 12 m: 59 crashes in 666 s (5.3 a minute, round 28: 5.4), 13 near the target, closest 2.5 m below a wall top. 20 m: 21 in 626 s (2.0 a minute, round 28: 3.6), 5 near the target, closest 4.4 m below.
- **People probe: pass.** 0 people on active pads (48 legs, 1,536 samples). 0 in solids, 0 hit by cars, 0 on roads (4 seeds, 1,120 samples of about 850 people each).
- **Camera tunnel test: pass on distance and solids.** See item 1. Per-frame jump counts (44 and 28 frames over 1 m) cannot be compared with round 28. At 30 fps every per-frame move is about four times larger.
- **Phone HUD probe: pass.** iPhone 22, 58, 130 and Android 317, about 3,100 samples. Route marker on controls 0. Drone under pills 0. Pops on the drone at most 0.40%. Pops on "Fly" 0.
- **Flat-frame probe: pass.** 270 frames, 0 flat, 0 errors.
- **Chimes with pops: pass.** 88 of 88 chimes in 8 runs had `#slip-pop` on screen within 0.3 s.
- **First-run pacing: same as round 28.** Longest quiet stretch in the first 60 s: 11.3 s. Intros after 30 s are at least 8.0 s apart. No hint within 3 s of a pickup or drop.
- **Medal gate runs (seeds 22, 58, 130), breakdown exact on all 9 runs:**
  - Street: 5,863 / 2,437 / 5,246, all Silver, total 13,546 (round 28: 13,767). Strict delivery share 64.2% (lowest 62%).
  - Roof: 982 (no medal) / 4,521 Silver / 4,759 Silver, total 10,262 (round 28: 16,189 with the rerun). Street divided by roof is 1.32 (round 28: 0.85). No Ace.
  - On seed 22 the roof bot made one drop and picked up the second parcel at 20 s. It never delivered it (8.3 m/s average, 0 crashes).
- **Bot or game?** The game is fine on that leg. `leg22-29.mjs` shows the target is a street-level pad (Florist, Copper & 2nd Ave) with nothing above it. A plain descent from 3 m delivers at once. The street bot on the same seed made 4 drops. I also ran a roof bot that steers by drone yaw instead of the camera (`route-play-yaw29.mjs`). It stalls on the same leg and scores lower overall (856 / 2,936 / 1,970). So the camera is not the only cause, and swapping the heading source is no fix. The roof bot is fragile on this leg in round 29. The 30 fps cap also gives it a quarter of the control updates. Round 28 had a similar stall on seed 58. **Needs a human player:** one roof-line run on seed 22 settles it.
- **Exploits: mostly pass.**
  - No-delivery farm: 0 on 22, 58 and 130. Farming both legs: 0. One-delivery best: 944, no medal (round 28: 1,190 Bronze).
  - Carry farm: 0.30, 0 and **0.52** of honest points a minute. Seed 130 is just over the 0.5 line. The bot farmed for only 33 s (round 28: 59 s) and then delivered twice, so this is closer to a slow honest run than a farm. The bot steers by the camera, so its path changed. Watch it next round.

## Performance

| Run (12 s each) | Main-thread work median / p95 (ms) | Frame interval | Calls (max) | Triangles (max) |
|---|---|---|---|---|
| Street, desktop, round 29 | 4.1 / 5.0 (rush 4.2 / 4.9) | 33.3 (capped) | 137 | 471k |
| Street, desktop, round 28 | 4.0 / 4.7 (rush 4.0 / 4.7) | 33.3 (capped) | 133 | 553k |
| Street, iPhone 13, round 29 | 3.2 / 4.0 (rush 3.1 / 4.0) | 33.3 (capped) | 117 | 418k |
| Street, iPhone 13, round 28 | 3.0 / 4.0 (rush 3.3 / 4.1) | 33.3 (capped) | | 474k |
| Tunnels and alleys, desktop / iPhone | | 33.3 (capped) | 119 / 100 | 448k / 412k |

- **p95 frame time under 12 ms: not measurable this round.** The machine load holds the browser at 30 fps. BTLEServer used 97 to 100% of a core in every check. As a stand-in, I timed the game's own work per frame on the main thread. Its p95 is 5.0 ms or less. No frame took over 12 ms. Round 29 adds about 0.2 ms over round 28 (wheels and view culling). GPU time is not in this number. **Rerun the real-time perf on a quiet machine.**
- **Draw calls under 150: pass** (max 137).
- **First load under 15 MB: pass.** Production build without source maps: 2.7 MB in total. First load is about 1.0 MB (JS 918 KB, CSS 40 KB). The CC0 assets still lazy-load after the first frame. Type check clean.

## Biggest remaining gap

**The camera snaps back and forth in a fast climb out of a wall-side pickup or drop.** Round 29 fixed the crowding. The worst frame is now 53% of the screen height instead of 81%. Only 8 of 4,800 frames reach 40%. But the new room floor and hard gap fight each other during a fast climb beside a wall. In 9 of 32 climbs the camera jumps 2 to 3.7 m in one frame. It then swings between about 6 m and 8.8 m for up to a second. You get a visible shake right at the moment you leave a pad, which you do every leg. Round 28 had 8 such frames in the same test. Round 29 has 29.

**Acceptance test:** run `climb29.mjs` on desktop and iPhone 13. It makes 32 real pickups and drops beside walls on seeds 22 and 130. Each is followed by an instant climb (Space, Space+S, Space+A, Space+W), at 60 Hz steps. The pass marks:

- 0 frames where the camera moves more than 1.7 m relative to the drone.
- Drone box under 40% of the screen height in 99.5% of frames.
- Camera at least 2 m from the drone in every frame.
- The tunnel test and the 2 m open-street test still pass.

If that counts as polish, then **only polish remains**, ranked as below.

## Other gaps, ranked

1. **Desktop pops cover the drone.** "Parcel secured!", the slip "+N BANKED" and medal pops sit at screen centre, on the drone. That happens in 28 to 44% of samples where a pop shows (round 28: 20 to 29%). The phone already moves its pops clear of the drone. Test: the hud-probe pop-on-drone share on desktop seeds 22, 58 and 130 under 2%.
2. **Roof bot stall on seed 22 (bot or feel?).** The game target is reachable. But two roof bots stall on the same leg, and the roof scores fell. Test: a human flies the roof line on seed 22 for one run. If the human is fine, retune the bot. If not, look at the approach to that pad.
3. **Carry farm on seed 130 at 0.52** of honest points a minute, just over the 0.5 line. It is probably a bot path change, but check again with `capfarm.mjs` on a quiet machine.
4. **Real-time perf was not measurable** (30 fps cap from machine load). Rerun `perf-street.mjs`, `perf18.mjs` and the 80 s runs on a quiet machine, with BTLEServer idle. The pass mark is a p95 under 12 ms.
5. **Shop signs and faces** (from round 28). Sign plates are white blobs on a dark plate, and people have no faces. **Needs a human eye** at play speed.

## Screenshots (progress/round-29/critic/)

109 screenshots in total.

- **Art, same spots as rounds 27 and 28 (48 files, the base for the next A/B):** `art29-{d,m}-{hour-130,morning-22}-{street,shopfront,facade-mid,mid,cruise,cruise-down}.jpg`, `-people-f0..f2.jpg` and `-people-close-f0..f2.jpg`.
- **Blind A/B:** `ab/pair-01.jpg` to `ab/pair-24.jpg`, `ab/picks.txt`, `ab/.key.json`.
- **Wheels:** `car29-22-t0..t4-side6m.jpg`, `car29-22-turning.jpg`.
- **Camera:** `climb29-d-22-4-spike.jpg` and `climb29-d-130-6-spike.jpg` (round 29 snap frames), `climb29-r28-d-22-4-spike.jpg` (round 28, same event), `hover29-{r29,r28}-{hover,cruise,boost}.jpg`, and `cam-clip-22-5-tunnel.jpg`, `cam-clip-22-10-alley.jpg`, `cam-clip-22-m-noorbit-5-tunnel.jpg`.
- **Desktop pops on the drone:** `fr29-d-22-h04-low-payout-pop.jpg`, `fr29-d-22-h05-low-payout-chain.jpg`, `fr29-d-130-ov1.jpg`, `fr29-d-22-h02-low-drafting.jpg`. Phone for contrast: `fr29-m-22-h04-low-payout-pop.jpg`, `hud29-a-317-h04-low-payout-pop.jpg`.
- **Triangles and culling:** `tris29-{d,m}-{22,130}-worst.jpg`, `tris29-d-{22,130}-diag-worst.jpg`, and the fast-orbit filmstrip `pop29-d-130-f0..f3.jpg`.
- **Other:** `leg22-r29-target.jpg` (the seed 22 roof-bot leg), and `N-alt12-seed11-*.jpg` (crash-classify near-target examples).
