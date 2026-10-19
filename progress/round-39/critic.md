# Drone Dash: round 39 critic report

**Verdict:** Pass. The drone now leans, pitches, swings its parcel and crashes with real weight. Every camera, crash and regression guard holds. Biggest gap left: speed only feels fast during boost, and the boost ends with a hard 1.3 g brake.

## Setup

- Build tested: the working tree on top of 78353b0 ("Round 38"). Round 39 changes are not committed (Drone.ts, Game.ts, config.ts, AudioSystem.ts, CameraRig.ts, VfxSystem.ts, vite-env.d.ts).
- Control: `git archive` of 78353b0 (round 38) in the scratchpad (`c39/r38c`).
- My servers: 5191 (round 39 dev), 5192 (round 38 dev), 5193 (production preview of my own build in `c39/dist39`). Each dev server had its own Vite cache in the scratchpad, HMR and watch off. I did not touch the owner's server on 5188. All three of mine are stopped.
- I did not read `builder.md`. I read the `src/` diff only to learn the controls and what changed.
- Every browser ran alone, one job at a time, from `critic-scripts/queue39c.sh` and `jobs39c.txt`.
- Top process before the runs (`cpu-*.txt`): start Brave helper 56%, videos WindowServer 36%, hull WindowServer 21%, boats WindowServer 28%, medal WindowServer 34%, perf the owner's Chrome renderer 26%. All are other apps, not my jobs.
- Video frames were encoded while only fixed-step probes ran, never during a real-time or perf job.

## Feel, as a player

**Fast:** yes under boost, only a little in normal flight. Boost now reads clearly: the nose drops 20 degrees, the view widens to 75 degrees, the camera falls back and speed streaks rush past. At normal cruise (the 16.8 m/s cap) the frame looks close to round 38: FOV 66.6 against 63.9, no streaks (they start at 17.2 m/s), drone 8.9% of the screen height against 9.5%.

**Weighty and alive:** yes, clearly. The drone dips its nose 17 degrees to set off. It lifts its nose 23 degrees to brake, with a small overshoot as it settles. It banks 32 degrees into a full turn. The parcel swings back on take-off, forward on braking, and settles. The rotors now read as spinning. At a hover it is dead still (0.00 degrees, no jitter), so it does not look nervous.

**Lean readability:** on desktop the bank is easy to read and helps steering: you see how hard you are turning before the view turns. The brake pose shows the top of the drone, which reads as "stopping". It never hides the road: the drone sits in the middle of the frame and the street ahead stays open. On the phone the drone is small (about 10% of the screen height). The objective marker often sits on it in turns (`c39-m-turn-right.jpg`), so the lean is half hidden there. That marker problem is from earlier rounds.

**Motion sickness:** low risk. The camera roll is at most 3.1 degrees and smoothed. The FOV changes over about a second. No camera move over 0.6 m in one frame in any crash or wall test.

**FOV:** it feels good, not fish-eyed. 75 degrees on a wide phone screen stretches the buildings at the edges (`c39-m-boost-top.jpg`). That only lasts during boost and reads as speed. The hover view at 55 degrees is a little tight but fine.

**Scrapes:** fair. A glancing hit slides along the wall with sparks and a rattle and costs no time. It still costs speed, more at steeper angles (mean speed kept 0.70 at 5 degrees, 0.37 at 24 degrees, seed 22).

**Head-on crashes:** impactful and not annoying. Red flash, sparks, the drone flips 50 to 85 degrees, the rotors sputter, "Crash! -3 sec" (`crash-desktop-sheet-seed58.jpg`, `crash-phone-sheet-seed130.jpg`). The slow-motion beat is short: 0.03 s hit-stop plus 0.15 s at 0.3x speed, so you lose about 0.1 s of game time. The drone is flying again within about 0.9 s. It reads as a hit, not as a pause.

**One mismatch:** a hit into a wall at 8 to 11 m/s plays the full crash show (flip, shake, slow motion). It is not charged and shows no "Crash!" text. That is 63 of 224 head-on probe hits over 8 m/s, and 28 of 96 tumbles in the crash bots. A player sees a crash and then nothing happens. Generous, but it blurs what a crash is.

## Measurements

### Attitude (`feel39.mjs`, fixed 60 Hz, desktop and iPhone 13 give the same numbers)

| Check | Result |
|---|---|
| Hover, 2.5 s | pitch 0.00, roll 0.00, max second difference 0.0000 deg/frame^2. FOV 55. |
| Take-off from rest | nose down peak 17.1 deg |
| Steady cruise, W held | nose down 11.5 deg |
| Brake | nose up peak 23.4 deg, overshoot to -3.6 deg as it settles |
| Boost | nose down peak 19.8 deg |
| Full turn at cruise | roll 32.1 right, 31.6 left (phone 32.3). Camera roll up to 3.1 deg. |
| Pitch against commanded drive (thrust plus acceleration) | correlation 0.80 desktop, 0.74 phone |
| Pitch against smoothed forward acceleration | 0.52 / 0.45 |
| Roll against yaw rate times speed | 0.74 / 0.72 |
| Parcel swing | back 12 deg on take-off, forward 24 deg on braking, settles to 1 deg |

### Speed camera

| Speed band (m/s) | Mean FOV | Mean camera distance | Drone share of screen height (r39 / r38) |
|---|---|---|---|
| 0 to 2 | 56.0 | 9.6 m | 11.7% / 11.5% |
| 2 to 10 | 59.9 | 9.0 m | 11.5% / 10.6% |
| 10 to 16 | 62.2 to 66.0 | 9.6 to 10.2 m | 10.0% / 10.5% |
| 16 to 18 (cruise cap) | 66.0 | 10.2 m | 8.4% / 9.5% |
| 18 to 25 | 70.6 | 10.9 m | 7.4% / 8.1% |
| 25 to 40 (boost) | 74.6 | 11.8 m | 6.5% / 7.2% |

- FOV range 55 to 75, correlation with speed 0.955. The arm stretches about 0.6 m on acceleration and pulls back 0.6 m under boost (peak distance 12.6 m).
- Speed streaks start at 17.2 m/s. At or under 19 m/s their level stays under 0.01.
- Drone share comes from `dronesize39c.mjs` (same route on both builds). At boost the drone is small on both builds (6.2% against 6.8%, `boost-top-r38-top-r39-bottom-d.jpg` and `-m.jpg`).

### Camera guarantees

| Check | Result |
|---|---|
| Crash and scrape probe, 1,400 hits | camera never in a solid, closest 8.4 m, largest move relative to the drone 0.59 m/frame, 0 over 1 m |
| cam-clip30, seed 22, no orbit (10 tunnel and alley passes) | 0 in solid, 0 hidden, 0 pops, closest 2.52 m |
| cam-clip30, seed 58, random orbit | 0 in solid, 0 pops, closest 2.62 m, drone hidden 4 frames (0.06%) in one orbit pass |
| cam-clip24, desktop seed 22 with orbit, phone seed 22 | 0 in solid, 0 hidden, 0 pops |
| climb30, desktop and phone (32 climbs each) | 0 jumps over 1 m (max 0.88 / 0.89 m), 0 in solid, closest 5.3 m, max drone share 38.4% / 38.3% |
| Wall-side framing, 3 s after each pickup or drop (HUD probe runs) | desktop 22/58/130: 62/62/62 wall samples, 0 at 40% or more, max 0.35/0.33/0.29. Phone 22/58/130: 31 (rerun 62)/61/62, 0 at 40% or more, max 0.34/0.34/0.28 |
| Open-street camera (HUD probe runs) | closest 2.3 m (phone 22), 0 in solid, 0 hidden |
| Arrival framing, seeds 22 and 44 | 10 of 11 legs arrived. Nav marker off screen in 0.1% of final-approach samples (builder's round 38 run 1.3%, history 0.4 to 2%) |
| Pad view (24 pickups and drops) | camera bearing over 30 deg 9.6% (round 38: 9.4%), over 90 deg 0 |
| Orbit ease-back | desktop drag 1.13 s, tilt 1.13 s, trackpad 0.89 s. Touch 1.1 s and 1.0 s. Same as before. |

The new roll and FOV break none of the camera guarantees.

### Crashes by angle (`crash39c.mjs`, seeds 22 and 58, 7 wall faces, angles 5 to 90, run-up 5 to 30 m/s, W held and released)

- **Under 25 degrees (700 hits): 0 charged on the glancing contact.** 526 got scrape feedback. On seed 22, 8 hits at 20 to 30 m/s were charged 0.4 to 0.6 s later. In each, the drone slid along the wall into a second, steeper surface (29 to 44 degrees). That is the city, not the rule. Seed 58: 0 of 300.
- **26 to 45 degrees:** charged from a 16 m/s run-up (13 m/s with W held at 26 degrees).
- **Head-on threshold:** by the speed into the wall, 10 to 11 m/s: 0 of 21 charged. 11 to 12 m/s: 21 of 28. 12 m/s and up: 119 of 119. So the threshold I see is 11 to 12 m/s into the wall, as intended.
- **Full effect on every charged hit:** 302 charged hits. Flip 47 to 84 deg, shake 1.0, slow motion on all. Hit-stop plus slow motion 14 to 32 sim frames.
- 8 to 11 m/s head-on: full flip and slow motion with no charge (see the mismatch above).

### Top speed (`topspeed39c.mjs`, seed 22, open road)

| Test | Round 39 | Round 38 |
|---|---|---|
| W held from rest, 12 s | 16.8 m/s | 16.8 m/s |
| Boost until empty (3.4 s), then W held | peak 30.4, back to 16.8 | peak 47.6 and rising, then a crash |
| Boost then hard carving with W | peak 30.0 | 41.4 |
| speedbug (turn at top speed) | max 17.5 | 20.8 |

The runaway is gone. After the boost runs out with W held, speed falls from 30.0 to 17.6 m/s in 1.0 s and is at 16.8 after 2 s.

Street against roof line (real-time bots, one run each):

| Seed | Low (street) | High (roof) | Low over high |
|---|---|---|---|
| 22 | 4,233 Silver | 856, 1 drop (a crash at 20 s, then a slow run) | 4.95 |
| 58 | 2,915 Silver | 2,807 Silver | 1.04 |
| 130 | 5,677 Silver | 5,296 Silver | 1.07 |
| All | 12,825 | 8,959 | **1.43** |

All at least 0.85. The seed 22 high run is weak, so its ratio overstates the gap.

## Regressions

| Check | Round 39 | Round 38 |
|---|---|---|
| Flat frames, bloom on | 918 frames, 0 flat, 0 errors | 0 |
| Crash-classify 12 m, 8 seeds | 40 crashes in 511 s (4.7 a minute), **0 pad lip**, 1 hop-like | 6.9 a minute, 0, 1 |
| Crash-classify 20 m, 8 seeds | 28 in 606 s (2.8 a minute), 0 hop-like, **0 pad lip** | 3.1 a minute |
| Hull probe, desktop, 3 moods, sweep 3 | 15 flagged views, all among round 38's 19 (sea beyond the far rail). 0 flat. | 19 |
| Hull probe, phone, sweep 2 | 10 flagged views. One new: 4 px on a moving sailboat stern (phase of the moving boat). | 12 |
| boats32 seed 22, 3 runs | longest contact 69 to 75, 0 stuck, 0 inside a hull, 0 near the mast | 65 to 70 |
| boats33, 4 seeds | 200 approaches: 0 inside, 0 mast, 0 stuck, longest contact 113 | 113 |
| boats31 overlap, 3 seeds | 0 hull on hull, 0 hull on dock, 0 in a solid, fly-through 0 crashes | same |
| boattrace33 | identical to round 38 | |
| Bus stop | 4 stops per seed, piers alternate, 9.0 to 9.25 s, top speed 4.6 m/s | same |
| People on active pads | 0 (48 legs, 1,536 samples) | 0 |
| Traffic overlap | 0 pair frames on 3 seeds | 0 |
| Desktop HUD probe, 22/58/130 | marker on controls 0. Pops on the drone 1/309, 0/242, 3/302. Drone under a pill 0. | 6/304 on 22 |
| Phone HUD probe, 22/58/130 | marker on controls 0. Drone under a pill 0, 0, 0. Pops on the drone 0 on 58 and 130. Seed 22: 15/212 in the first run (Bronze and Rush hour pops, drone hovering on the left). Rerun 0/286. Round 38 on the same seed 6/265. Run-to-run noise. | 0 |
| Medal gate, street bot | Silver 4,233 / 2,915 / 5,677, 0 crashes. Breakdown and end screen exact. | Bronze to Silver |
| Medal gate, lazy bot | Bronze 1,191 / 948 (no medal) / Bronze 1,037. Breakdown exact. | Bronze 1,101 / 1,171 / 1,077 |
| Exploits | No-delivery farm 0 on 22, 58, 130. Carry farm 0.23, 0 and 0.24 of honest points a minute. | 0.25, 0, 0.24 |
| Cold load, no unstyled flash | 8 cold loads (dev and production, desktop and phone): 0 bad frames | 0 |
| Build | tsc clean. **No chunk warning.** three 588 kB, game 377 kB (+14 kB), StreetAssets 45 kB, lil-gui 31 kB, three-post 19 kB, CSS 40 kB | game 363 kB |

Breakdown exact on all 9 medal runs (street, roof and lazy). I found no regression.

## Perf

Each job alone at the end. Top process: the owner's Chrome 26%, WindowServer 17% (`cpu-perf.txt`).

| Check | Desktop | iPhone 13 |
|---|---|---|
| Street, normal, no cap | median 3.8, **p95 8.0** | median 2.7, **p95 6.4** |
| Street, rush | median 4.3, **p95 8.2** | median 2.5, **p95 5.5** |
| Harbour marina hover | p95 8.3 | p95 4.7 |
| Sail / rib / ferry follow | p95 7.8 / 8.5 / 10.7 | p95 6.1 / 4.2 / 5.2 |

- All p95 under 12 ms.
- Draw calls over the full spot sweep: desktop 119 (seed 130) and 116 (seed 22), iPhone 104. Under 125.
- Triangles: 445k and 436k desktop, 417k iPhone. Under 480k.
- First load on the wire (production, 4 cold loads): **2.78 MB**.

## Biggest remaining gap in flight feel

**Speed only feels fast while boost is held, and the boost ends with a hard brake.**

- Normal flight is capped at 16.8 m/s. The streaks start at 17.2 m/s, so they never show outside boost. At cruise the frame is close to round 38 (FOV +2.7 degrees, drone a little smaller).
- Boost lasts 3.4 s. When it ends with W still held, speed drops from 30 to 17.6 m/s in 1.0 s (about 12 m/s^2, 1.3 g). The streaks fade to 0.2 in the same second. It feels like flying into a wall of air at the moment you want to carry the speed.

**Acceptance test** (`topspeed39c.mjs`, `feel39.mjs`, fixed step, seed 22):
1. Full boost with W held: after the boost ends, speed stays at 22 m/s or more for at least 1.5 s. It reaches 18 m/s no sooner than 3 s after. Peak slowdown at most 6 m/s^2.
2. At steady cruise (16.8 m/s) the streak level is at least 0.15. Under 12 m/s it stays 0.
3. Guards: W held without boost still tops out at 17.5 m/s or less. Boost plus carving tops out at 31 m/s or less (no runaway). Crash-classify charged rate at 12 m and 20 m no higher than this round (4.7 and 2.8 a minute). Low over high still at least 0.85 on 22, 58 and 130.

Runner-up: the 8 to 11 m/s hits that play the full crash show without a charge. Test (`crash39c.mjs`): a hit that is not charged gets no flip over 30 degrees and no slow motion. Every charged hit keeps the full effect.

## Videos (progress/round-39/critic/)

Both show the real game and HUD in headless Chromium. A scripted pilot plays live in real time (keys on desktop, the on-screen stick and buttons on the phone). Fresh first run, no cuts, H.264 MP4, 30 fps, no sound. `video-timeline.txt` has the full timeline.

| File | What it shows |
|---|---|
| `video-desktop-30s.mp4` | 1280x720, 30.0 s, 9.1 MB, city 58. Take-off 0.0. First pickup 6.5. Street run with slipstream. Delivery and Bronze 19.8. Turn into a building 22.8. Head-on crash 24.5 (flash, sparks, flip, "Crash! -3 sec"). Flying again 25.4. |
| `video-phone-30s.mp4` | 750x342 (iPhone 13 held sideways, in CSS pixels), 30.0 s, 8.9 MB, city 130. Starts just after the first pickup. Delivery and Bronze 20.8. Turn into a building 24.9. Wall scrape about 27.5. Head-on crash 28.0. Flying again 29.0. |

- On city 130 the desktop pilot missed its planned crash (it climbed over a low roof). So the desktop video is from city 58.
- Contact sheets: `video-desktop-sheet.jpg`, `video-phone-sheet.jpg`.

## New scripts (progress/round-39/critic-scripts/)

- Copied from round 38 critic and round 39 builder: only output folders and the default port (5190 to 5191) changed.
- `crash39c.mjs`: the builder's crash39 plus camera checks per hit (closest camera, in solid, frame jump) and slow-motion frames. It hovers 1.5 s at the start point first, so the camera is settled.
- `topspeed39c.mjs`: W held, boost until empty, boost plus carving, speedbug, on any build.
- `dronesize39c.mjs`: drone share of screen height against speed, any build, desktop and phone.
- `video39c.mjs`, `video-pilot39c.js`: video38 with the harbour detour off and the planned crash kept. `encode39c.mjs`: H.264 MP4.
- `sheet39c.py`: contact sheets from video frames. `frsum39c.mjs`, `medsum39c.sh`: log summaries.

## Screenshots (progress/round-39/critic/)

40 JPEGs.

- Attitude and camera moments, desktop and phone (`c39-d-*`, `c39-m-*`): hover, take-off 0.35 s, cruise, brake 0.35 s, turn right, boost 0.5 s, boost top, parcel on take-off, parcel on braking.
- Drone size, round 38 against round 39 (`size-r38-*`, `size-r39-*`): hover, cruise, boost, hover after braking, desktop and phone.
- `boost-top-r38-top-r39-bottom-d.jpg`, `boost-top-r38-top-r39-bottom-m.jpg`.
- Crash sequences: `crash-desktop-sheet-seed58.jpg`, `crash-phone-sheet-seed130.jpg`.
- Video contact sheets: `video-desktop-sheet.jpg`, `video-phone-sheet.jpg`.
- Data: `feel39-c39-d.json`, `feel39-c39-m.json` (per-frame attitude and camera rows).
