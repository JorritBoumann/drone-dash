# Drone Dash: round 39 builder notes

Flight feel, part A: drone attitude, speed camera, crashes by impact angle. Part B (fly-through pickups, drone HUD) is not touched.

Summary:
- Attitude: 17 degrees nose down at full acceleration, 23 nose up under braking, 32 degrees of roll in hard turns. A spring gives overshoot and settle. No jitter in a hover.
- Speed camera: FOV 55 to 75 with speed, a spring arm, boost pull-back, turn roll and speed streaks from 19 m/s. Every camera guarantee still passes.
- Crashes: no contact under 25 degrees was charged in 1,280 probe hits. Head-on hits play a tumble, shake, sparks, a rotor sputter and a slow-motion beat.
- Open: under the unchanged rules, head-on hits charge only from about 11 to 12 m/s, not 8 (section 3). I also fixed a speed runaway over the top speed (section 4).

## Setup

- Build: the working tree on top of 78353b0 (round 38). Control: `git archive HEAD` (round 38) in the scratchpad (`r39/r38c`).
- My servers: 5190 (round 39 dev), 5192 (round 38 control), 5195 (production preview of my own build). Each had its own Vite cache in the scratchpad, with HMR off.
- I did not touch the owner's server on 5188. All three of my servers are stopped.
- Browser jobs ran one at a time from `builder-scripts/queue39.sh` and `jobs39.txt`. The log is `queue39.log`.
- Slip: `tsc` and a 0.4 s production build ran during the first desktop HUD probe. That probe ran again later, alone. Its numbers below are from the second run.
- Scripts: copied from the round 38 critic folder, plus `climb30`, `cam-clip30`, `cam-clip24` and `fb27` from round 34. The default port changed from 5191 to 5190.
- `crash-classify-v.mjs` now also prints the round 39 counters (scrapes, freed hits, impacts). It also takes `PORT` and `TUNE`.
- New scripts:
  - `feel39.mjs`: attitude, speed camera and parcel swing, fixed step.
  - `rotorshot39.mjs`: close views of the drone.
  - `crash39.mjs`: wall hits by impact angle and speed.
  - `crashbase39.mjs`: what a head-on crash does on screen. It runs on any build.
  - `video39.mjs`: the scrape, crash and 30 s speed videos.
  - `wallscan39.mjs`: block face profiles (to find a long flat wall for the scrape video).
  - `speedbug39.mjs` and `coast39.mjs`: the speed runaway (see "Handling changes").

## 0. Gemini's crash at 0:40.7: what the round 38 build really did

Gemini said the wall crash at 0:40.7 of video 08 had no tumble, no shake and no sparks. I measured the same kind of hit on the round 38 control and on round 39 with `crashbase39.mjs`. It is a head-on hit into a block face on seed 22 at 12.6 m/s, about the speed in the video.

| What | Round 38 | Round 39 |
|---|---|---|
| Crash charged after the contact | 0.067 s | 0.050 to 0.067 s |
| Tumble starts | with the charge | on the contact frame (0.000 s) |
| Body tilt | a rattle at 3 to 4 Hz. From the code: up to about 13 degrees pitch and 21 degrees roll at this speed, gone in about 0.9 s. The drone box height to width ratio went from 0.38 to at most 0.64. | a kick plus the rattle: peak 54 to 60 degrees pitch and 44 to 50 degrees roll. The box ratio went from 0.33 to 1.07 to 1.17. |
| Camera shake | 0.23 m peak jitter at about 10 Hz | 0.22 m peak jitter at about 10 Hz, plus the 2.5 Hz kick toward the wall (up to 0.45 m) |
| Sparks | 37 small particles (size 0.1 to 0.16) at the drone's centre | a hot flash at the contact, about 100 sparks thrown back off the wall, debris. Peak 82 to 124 live particles. |
| Slow motion | 0.11 to 0.16 s near-freeze (0.08 x speed) | 0.06 s freeze, then 0.15 s at 0.3 x speed |

So Gemini was partly right. The tumble and shake were there, but they were a short rattle that started with the charge. The 10 Hz shake reads as noise in a 30 fps video. The sparks were tiny and hidden in the drone. Frames: `builder-shots/crashbase-r38-top-r39-bottom.jpg`. The video frames at 0:40.2 to 0:41.8 show the same: a small tilt after the "Crash!" pop, and no sparks I can see.

## 1. Drone attitude (`src/entities/Drone.ts`, `src/game/config.ts`)

Before (round 38): pitch followed the speed and the measured acceleration, and roll followed the yaw rate. Both used a plain 8/s exponential smoothing. From the code, steady cruise was about 7.5 degrees nose down and full acceleration about 9 degrees. Braking gave about 3 degrees nose up. A hard turn at speed already gave about 31 degrees of roll.

Now:
- Pitch follows the thrust command plus the smoothed forward acceleration. Forward thrust tilts the nose down (more under boost). Braking lifts it.
  - `attPitchForce` 0.2 rad at full thrust (x1.3 under boost).
  - `attPitchAccel` 0.1 rad per thrust-sized m/s² of forward acceleration, clamped at 1.5 of it.
  - The acceleration is taken from the flight controls only (thrust, drag, grip, guide). Wall contacts are left out, so a scrape never twitches the body. It is low-passed at 10/s.
- Roll follows the yaw rate: `attRoll` 0.56 rad at a full-rate turn at cruise speed or faster, and 30% of that on the spot (`attRollSlow`). A small part of the sideways acceleration adds to it.
- Both go through a lightly damped spring: `attFreq` 12 rad/s, `attDamp` 0.55. That gives a little overshoot and settle. The spring is sub-stepped for long frames.
- Clamp: pitch at most 0.48 rad (27.5 degrees) from the flight controls.

Results (`feel39.mjs`, fixed step, seed 22, desktop and iPhone 13 give the same numbers):

| Measure | Round 39 |
|---|---|
| Hover | pitch 0 and roll 0, second difference 0 (no jitter) |
| Full acceleration from rest | 17.1 degrees nose down (peak) |
| Steady cruise, W held, 17 m/s | 11.5 degrees nose down |
| Boost | 19.8 degrees nose down (peak), 15 degrees steady |
| Brake (S) from cruise | 23.4 degrees nose up (peak), then a 3.5 degree overshoot as it settles |
| Hard turn at cruise | 32.0 degrees right, 32.0 to 32.8 degrees left |
| Correlation, pitch against the attitude drive (thrust command and acceleration) | 0.74 desktop, 0.76 phone |
| Correlation, pitch against the forward acceleration alone | 0.47 to 0.51 |
| Correlation, roll against yaw rate times the speed share | 0.79 desktop, 0.74 phone |

The pitch is not a pure function of acceleration. A drone at a steady speed still leans into its thrust. That is the main speed cue Gemini asked for, so the correlation with acceleration alone is lower.

Rotors: the four blur discs are now a motion smear. Each blade arm drags a fading sector behind it. The sector grows with rotor speed (30% of a quarter turn at idle, 92% at full boost). Blades and smear turn at an apparent 2 to 3.5 turns a second, so they read as spinning without strobing at 60 Hz. They sit on the body, so they tilt with it. It is still one draw (the same merged disc mesh, a new shader). Close views: `builder-shots/r39-close-*.jpg`.

Parcel: a damped pendulum on its pivot. It now lags behind the acceleration as a hanging load does (round 38 swung it the wrong way, forward on acceleration). It hangs plumb against the body tilt. Spring 22, damping 2.4, drive 0.2 x the acceleration, clamp 0.6 rad. Measured: 12 degrees back under full acceleration and 24 degrees forward under braking. Then it swings two or three times and settles in about 2 s.

The collision sphere and the drone's position are unchanged. The attitude is visual only.

## 2. Speed camera (`src/systems/CameraRig.ts`, `src/systems/VfxSystem.ts`, `src/game/config.ts`)

- FOV: 55 degrees at a hover, 67 at cruise speed (17 m/s), 75 at full boost speed (31 m/s), plus 2 while boosting, capped at 75. It eases in at 3/s (5/s under boost) and out at 2/s. Round 38: 60 at a hover, 64 at cruise, 70 under boost.
- Spring arm: forward acceleration stretches the chase distance by up to `accelLag` 0.8 m. Braking shortens it by up to 0.4 m. It is a spring (7 rad/s, damping 0.7), so it settles with a small overshoot.
- Boost pulls the camera back `boostPull` 0.6 m (eased). The distance cap rises by the same amount. Round 38 added 0.8 m, but the 8 m cap usually ate it.
- Turn roll: up to `turnRoll` 0.06 rad (3.4 degrees) into a hard turn at speed. It is added after the look-at, like the shake roll.
- Crash kick: a head-on hit lurches the camera toward the wall (a damped spring, at most 0.45 m). It is an offset on top of the smoothed camera, like the shake, and the wall push-out runs after it.
- At a hover, the narrower 55 degree view makes the drone 11% taller on screen. So the slow-drone room floor (`keepRoom`) now scales with tan(30°)/tan(fov/2). The wall-side framing therefore stays the same as in round 38.
- Speed streaks (`SpeedStreaks` in `VfxSystem.ts`): 56 thin quads in a loose tube round the view axis. The vertex shader draws them straight in camera space and moves them past the camera. That is one draw, with no buffer upload per frame. They fade in from 19 to 27 m/s (85% strength without boost). They are hidden at a lower speed and outside a run. The round 38 DOM speed-line overlay for boost and slipstream is unchanged.

| Speed band | Mean FOV | Mean camera distance |
|---|---|---|
| 0 to 2 m/s | 56.2 | 9.9 m |
| 2 to 8 m/s | 59.9 | 9.0 m |
| 8 to 14 m/s | 61.7 | 9.5 m |
| 14 to 18 m/s | 65.8 | 10.1 m |
| 18 to 24 m/s | 70.6 | 10.8 m |
| 24 to 40 m/s | 74.7 | 12.3 m |

FOV against speed: correlation 0.95, range 55 to 75. Streaks reach full strength at full boost. In this run they never passed 0.01 below 19 m/s.

The 30 s capture is `builder-shots/speed-desktop.mp4`. It shows two straight 15 s runs (hover, accelerate, boost, coast, an S-bend at cruise speed, brake), with a cut between them.

### Camera guarantees (final build)

| Check | Result |
|---|---|
| `cam-clip30`, desktop seed 22, no orbit, 10 alley and tunnel passes | 0 frames in a solid, 0 hidden, 0 under the street, 0 jumps over 1 m |
| `cam-clip24`, desktop seed 22, random orbit | 0 in a solid, 0 hidden, 0 under, 0 jumps over 1 m, orbit share 0.92 |
| `cam-clip24`, iPhone 13 seed 22, no orbit | 0 in a solid, 0 hidden, 0 under, 0 jumps over 1 m |
| `climb30`, 32 climbs beside walls, desktop | 0 jumps over 1 m (max 0.895 m), 0 in a solid, max drone height share 0.386, closest 5.07 m |
| `climb30`, iPhone 13 | 0 jumps over 1 m (max 0.881 m), 0 in a solid, max share 0.382, closest 5.26 m |
| Wall-side framing (`hud-probe34` and `fb27.py`, 3 s after each pickup or drop) | desktop 22: 0 of 62 wall samples at 40% or more (max 0.346). Desktop 58: 0 of 62 (max 0.351). iPhone 22: 0 of 31 (0.341). iPhone 58: 0 of 63 (0.337). iPhone 130: 0 of 61 (0.254). |
| 2 m test (open-street camera distance, whole 80 s runs) | 0 frames under 2 m in all five runs. Closest: desktop 22 6.12 m, desktop 58 2.46 m, iPhone 22 2.38 m, iPhone 58 7.63 m, iPhone 130 8.52 m. 0 frames in a solid, 0 hidden. |
| Arrival framing near low pads (`arrival-metrics`, seeds 22 and 44, no input) | nav marker off screen in 0 of 1,549 final-approach samples (0.0%). Same-day round 38 control: 22 of 1,649 (1.3%). The bot flew 9 legs (7 arrived) against 14 (12 arrived) on the control. |
| Camera heading after pickups and drops (`padview30`, 24 pads, 23 beside a wall) | camera bearing over 30 degrees off the heading in 9.6% of frames, over 60 degrees in 0.1%, over 90 degrees 0. Same-day round 38 control: 9.4%, 0%, 0. |

The first real-time desktop 22 run (before the last fixes) had its closest open-street frame at 2.44 m. The orbit and the ease-back are covered by the random-orbit run.

## 3. Crashes by impact angle (`src/entities/Drone.ts`, `src/game/Game.ts`, `src/systems/AudioSystem.ts`)

Rule: the impact angle is the angle between the horizontal velocity and the wall face. It comes from the velocity part along the wall normal: `asin(into / speed)`. It is checked on each wall contact. Floors, low steps, kerbs and soft props are never scrapes.

Scrape (under `scrapeAngle` 25 degrees):
- The drone keeps sliding along the wall with a small bounce (`scrapeBounce` 0.15).
- It loses speed along the wall by friction: `scrapeFriction` 0.6 x the speed into the wall, at most half. A 15 degree hit at 20 m/s keeps about 84% of its speed.
- It is never a crash: no time penalty, no combo loss, no bank cut. The contact does not count toward the crash's speed loss.
- Feedback: a stream of sparks off the contact, thrown back along the wall. A light stream continues while it slides. A short camera jitter (shake 0.12 to 0.34). A short bright grind sound, rate-limited. A small rattle of the body. No red flash.

Head-on hit (charged under the unchanged crash rules):
- On the contact frame: a tumble (an angular kick on the attitude spring: the nose thrown up and back from the wall, a roll to one side, a yaw wobble, plus the round 4 rattle). The spring is looser while the tumble plays, so the flip reads, then it rights itself in about 0.6 s.
- Camera: shake 0.85 to 1.0 and the kick toward the wall. The charge adds a second jolt of 0.5.
- A rotor sputter: the rotor bus stutters and sags in pitch for about 0.6 s, then catches. On screen the rotor smear collapses and recovers. Phones vibrate for 45 ms where the browser allows it.
- Sparks: a hot flash at the contact, a fan of sparks, hot fast streaks and slower debris.
- Slow motion: a 0.06 s freeze (the round 4 bump hit-stop, unchanged), then 0.15 s at 0.3 x speed. Sim time lost per crash: about 0.16 s, the same as round 38.
- The charge itself still waits for the unchanged `hitSpan` decision. The "lost it" cue, the red flash, the pop and the penalty come with it.
- A hard head-on knock (45 degrees or more, 8 m/s or more into the wall) that the unchanged rules leave free also shows the impact. See the open question below.

### Wall-hit probe (`crash39.mjs`)

Seeds 22 and 58, 4 tall block faces each, 10 m up. Angles 5, 10, 15, 20, 24, 27, 30, 45, 60 and 90 degrees. Speeds 5, 8, 10, 12, 16, 20, 25 and 30 m/s. W held and W released. That is 640 hits per seed. There is 1.5 s of hover between hits, so the 1.2 s crash window never hides a charge.

| Result | Seed 22 | Seed 58 |
|---|---|---|
| Hits under 25 degrees (to the face) | 320 | 320 |
| ...charged | 8 | 20 |
| ...of those, the steepest actual contact was under 25 degrees | **0** | **0** |
| ...steepest actual contact of the charged ones | 29 to 44 degrees | 38 to 48 degrees |
| ...with scrape feedback | 252 | 244 |
| ...charged under the round 38 rules, free now ("freed") | 116 | 115 |
| Charged hits with a steepest contact under 25 degrees, all 640 | **0** | **0** |

The charged "under 25 degree" hits are facade relief. The sphere slides along the face and meets a step or a corner at 29 to 48 degrees. That contact is a real head-on hit, so it is charged. No contact under 25 degrees was ever charged.

Head-on hits (60 to 90 degrees), by the real speed into the wall (after drag on the run-up). The two seeds give the same table:

| Speed into the wall | Hits | Charged | Tumble, shake, sparks and slow motion |
|---|---|---|---|
| under 8 m/s | 28 | 0 | 0 |
| 8 to 10 m/s | 24 | 0 | 24 |
| 10 to 11 m/s | 4 | 0 | 4 |
| 11 to 12 m/s | 8 | 4 | 8 |
| 12 m/s and over | 64 | 64 | 64 |

Charged head-on hits (68 per seed): every one played the impact. Body tilt at least 50 degrees (median 67), camera shake at the cap (1.0), slow motion on all 68, at least 96 live particles.

**Open question for the lead.** The acceptance asks that head-on hits over 8 m/s always charge. The brief also says not to change which hits are charged, except to make glancing hits free. Those two conflict. Under the unchanged rules, a head-on hit loses 65% of its speed (the 0.35 bounce). So it reaches the 7 m/s crash threshold at about 10.8 m/s into the wall. I kept the rules. From 8 m/s, a head-on hit now always plays the full impact. From 12 m/s it is always charged. To charge from 8 m/s, set `CRASH.threshold` from 7 to about 5.2. That also makes more angled hits charge, so it is a balance change for the owner.

### Videos (`builder-shots/`, desktop 1280x720, 30 fps, H.264)

- `scrape-desktop.mp4` (10 s, 6.8 MB): the drone flies along a street, meets a flat block face at about 10 degrees and slides along it with sparks. Speed 16.8 to 14.0 m/s. No crash, no penalty.
- `crash-desktop.mp4` (10 s, 2.3 MB): the drone accelerates 16 m into a block face and hits it head-on at about 15 m/s. Tumble, sparks, shake, slow motion, "Crash! -3 sec".
- `speed-desktop.mp4` (30 s): the speed camera, see section 2.

### Crash-classify (pad lip), seeds 22, 58 and 130

The bot is fixed step, but its runs are not repeatable from day to day. So I ran the round 38 control the same day.

| Run | 12 m | 20 m |
|---|---|---|
| Round 39 | 13 crashes in 151 s (5.2 a minute), 2 drops | 15 in 175 s (5.1 a minute), 4 drops |
| Round 38 control, today | 20 in 190 s (6.3 a minute), 3 drops | 18 in 241 s (4.5 a minute), 8 drops |
| Round 38 builder, yesterday | 20 in 184 s (6.5 a minute) | 10 in 233 s (2.6 a minute) |
| Round 39 with the old over-top thrust (A/B) | | 14 in 257 s (3.3 a minute) |
| Round 39 with no scrapes (A/B) | | 16 in 260 s (3.7 a minute) |
| Pad-lip crashes (`lip37.py`) | **0** | **0** |
| Hop-like crashes | 0 | 0 |
| Scrape contacts | 9 | 6 |
| Charged under the round 38 rules, free now | **1** of 13 | **0** of 15 |

On seed 130 at 20 m the bot hit the same tall wall five times (it cannot climb over it). That one wall gives most of the 20 m rate. The spread between runs of the same code is larger than any change I can see. The bot rarely flies along walls, so few of its hits are glancing.

## 4. Handling changes (exactly what changed)

1. Glancing wall contacts (under 25 degrees). Round 38: the full bounce (0.35) and, over 2.5 m/s into the wall, a scrub that kept only 55% of the speed along the wall. Round 39: bounce 0.15 and friction 0.6 x the speed into the wall, at most half. So a glancing hit now keeps much more speed. Contacts at 25 degrees or more are unchanged.
2. Thrust over the top speed. Round 38: with W held over the top speed, the gentle over-top drag (0.35 x) let the speed run away to about 2.9 x the top speed. That is 48 m/s after a boost or a fast carve with W held, and up to 88 m/s while boosting. I measured it on the round 38 control too (`speedbug39.mjs`: both builds reach 20.8 m/s in a carve, `coast39.mjs`: 41 m/s after a boost). Round 39: over the top speed plus 0.5 m/s, forward thrust no longer pushes. The leftover speed still bleeds off gently, as before. `FLIGHT.overTopPush = true` (test hook `tune`) brings the old behaviour back for A/B runs.

Nothing else in the flight model changed. Collision boxes, radius, hop, ledge, step-up, boat and guide code are unchanged.

## 5. Balance

| Check | Round 39 | Round 38 |
|---|---|---|
| Street medal gate, seeds 22, 58, 130 (`route-play-rt-x-m-esc17`, low line, 600 s, real time) | run a: Silver 4,559, Silver 3,583, Gold 6,782. Run b: Gold 6,873, Silver 3,719, Silver 5,582. 0 crashes in all six. | 5,628 Silver, 3,552 Silver, 5,277 Silver (builder). Critic: Bronze to Silver per run. |
| Lazy bot, seeds 22, 58, 130 | Bronze 1,192, none 922, Bronze 1,076 (total 3,190). Round 34 had the same "none" on seed 58 (923). | Bronze 1,101 / 1,171 / 1,077 |
| Breakdown and end screen exact (`medal-sum29.py`) | bdOk on all 9 runs | exact on all runs |
| No-delivery farm, seeds 22, 58, 130 | **0** points on all three | 0 |

## 6. Regressions (final build)

| Check | Round 39 | Round 38 |
|---|---|---|
| Flat frames, bloom on (`acceptance-probe`) | 836 frames, 0 flat, 0 errors | 941, 0 |
| Hull probe, desktop, 3 moods, sweep 3 | 19 flagged views (sea beyond a far rail, the same class as round 38), flat 0 | 19 |
| Hull probe, phone, sweep 2 | 11 flagged views, flat 0 | 12 |
| boats32, seed 22, 2 runs | longest contact 76 and 74, 0 inside a hull, 0 near a mast, 0 stuck. Bus rams: 4 of 4 charged exactly once. | 64 to 76 |
| boats33, 4 seeds, 156 approaches | 0 inside a hull, 0 near a mast, 0 stuck, longest contact 111. 16 bus rams, each charged exactly once. | 0, 111 to 114 |
| boats31 overlap, seeds 22, 58, 5150 | 0 hull on hull, 0 hull on dock, 0 in a solid. Fly-through: 0 crashes. | same |
| Bus stop, 4 seeds | 4 stops each, piers alternate, 9 s stops, top speed 4.6 m/s | same |
| People on active pads | 0 (48 legs, 1,536 samples) | 0 |
| Traffic overlap, 3 seeds | 0 pair frames | 0 |
| Desktop HUD probe, seeds 22 and 58 | marker on controls 0 and 0. Pops on the drone 1 of 306 and 1 of 298 (0.3%). Drone under a pill: 0 on seed 22. On seed 58: 9 samples (1.1%), all in one 0.8 s crash tumble right under the objective pill (`fd39-d-58-ov*.jpg` in the scratchpad). | seed 22: 1 sample, pops 0.3% |
| Phone HUD probe, seeds 22, 58, 130 | marker on controls 0, 0, 0. Pops on the drone 0, 0, 0. Drone under a pill 0, 2 (0.25%), 0. | 0, 2, 0 |
| Cold load, no unstyled flash (`fouc34`, dev and production, desktop and iPhone, 2 runs each) | 8 of 8 with 0 bad frames | 0 |
| Kept as asked | the bloom clamps in `ObjectiveMarker.ts`, the `#app` visibility rule in `index.html` and `styles.css`, every debug hook (new fields only) | |

The bots do not use the attitude or the camera for steering, except `crash-classify-v`. It steers by the camera's bearing, and it still works.

## 7. Budgets

| Budget | Round 39 |
|---|---|
| Draw calls, full sweep | desktop 117 (seed 130, two sweeps) and 118 (seed 22), iPhone 100. The streaks add 1 draw above 19 m/s (the sweep camera stands still), so the worst case is 119. Under 125. |
| Triangles, full sweep | desktop 446k and 448k (130) and 437k (22), iPhone 417k. The streaks add 112. Under 480k. |
| p95 frame time, desktop | street normal 7.8, rush 7.4. Harbour: marina 8.6, sail 7.4, rib 7.3, ferry 9.1. Uncapped. |
| p95 frame time, phone | street normal 5.8, rush 5.1. Harbour: marina 4.0, sail 6.1, rib 4.4, ferry 5.4. Uncapped. |
| First load | 2.78 MB on the wire (production, 4 cold loads) |
| Build | `tsc` clean, no chunk warning. three 588 kB, game 376 kB (round 38: 363 kB), StreetAssets 45 kB, CSS 40 kB. |

New shaders: the rotor smear and the streaks use no `pow()`. The rim and nav shaders are unchanged.

## 8. Files changed

- `src/entities/Drone.ts`:
  - the attitude spring and its drive, and the crash tumble (kick, yaw wobble, sputter)
  - the rotor smear shader and the parcel pendulum
  - glancing-hit scrapes, the impact angle and the over-top thrust fix
  - the `feel` getter for probes
- `src/systems/CameraRig.ts`: the speed FOV, spring arm, boost pull-back, turn roll, crash kick, and the FOV-scaled room floor.
- `src/systems/VfxSystem.ts`: `spray()`, `live()` and the `SpeedStreaks` class.
- `src/systems/AudioSystem.ts`: `impact()` with the rotor sputter (a new gain node on the rotor bus, plus detune), `scrape()`, `crashCue()`. `crash()` now calls both.
- `src/game/Game.ts`:
  - the impact on the contact frame, the scrape feedback and the slow motion
  - the round 38 rules run alongside, to count the freed hits
  - the streaks, the diagnostics `feel` block and new `contact` fields
- `src/game/config.ts`:
  - new `FLIGHT` keys: `att*`, `scrape*`, `overTopPush`
  - new `CAMERA` keys: `fovMin`, `fovCruise`, `fovTop`, `accelLag`, `boostPull`, `turnRoll`
- `src/vite-env.d.ts`: the diagnostics type.
- `progress/round-39/`: `builder-scripts/` (scripts, logs, JSON) and `builder-shots/` (JPEGs, three MP4s).

## 9. Not done or open

- Head-on hits from 8 to 11 m/s are not charged (see the open question in section 3). They do show the full impact.
- After a boost or a fast carve, the speed no longer runs away. That is a handling change. Bots and players lose the runaway's extra speed. I did not measure how often the runaway came up in normal play.
- The drone is small on screen at full boost (FOV 75 and about 12 m away). That is mostly the camera's own follow lag, as in round 38. Readability at boost needs a human player.
- The scrape sparks are clear in the close views but modest at a normal chase distance.
- Gemini's other items (fly-through pads, the drone HUD, phone vibration tuning) are part B or later.
- No git commands, as asked.
