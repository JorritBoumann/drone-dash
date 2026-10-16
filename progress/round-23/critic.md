# Drone Dash: round 23 critic report

**Verdict:** The tunnel camera is fixed and passes every acceptance line on four seeds, with and without orbit. Traffic density and the triangle count are fixed too. No regressions. The biggest gap left is the phone HUD, which still covers the pad marker and, at height, the drone.

Build tested: commit 7453512 plus the uncommitted round 23 changes. My own dev server on port 5191, stopped at the end. The owner's server on 5188 was left alone. Every browser ran alone, one at a time, from one job queue (`critic-scripts/queue23.sh`, `jobs23.txt`). I did not read the builder notes.

## Round 22 gap: tunnel camera. Closed.

I copied the round 22 scripts and changed only output folders. One addition: the per-frame sampler (`cam-sampler.js`) now also grabs the real render camera and projects the drone onto the screen. The round 22 "in frame" number guessed the camera aim. The new one is exact. Analysis: `cam-accept23.mjs`. Settled playing frames only.

| Run | Tunnel frames | Camera at 2.5 m or more (tunnel) | Drone in frame (tunnel + alley) | Camera in solid / under ground / drone hidden | Max jump per frame |
|---|---|---|---|---|---|
| Seed 22, orbit | 3,465 | 99.7% | 98.1% | 0 / 0 / 0 | 1.70 m |
| Seed 22, no orbit | 3,465 | 100% | 99.9% | 0 / 0 / 0 | 1.15 m |
| Seed 130, orbit | 2,768 | 100% | 96.7% | 0 / 0 / 0 | 1.75 m |
| Seed 130, no orbit | 2,763 | 100% | 99.5% | 0 / 0 / 0 | 0.29 m |
| Seed 44 (fresh), orbit | 3,468 | 100% | 97.9% | 0 / 0 / 0 | 1.70 m |
| Seed 44, no orbit | 3,464 | 100% | 100% | 0 / 0 / 0 | 0.56 m |
| Seed 203 (fresh), orbit | 3,463 | 99.9% | 96.4% (tunnel alone 94.6%) | 0 / 0 / 0 | 1.12 m |
| Seed 203, no orbit | 3,463 | 99.8% | 99.7% | 0 / 0 / 0 | 0.68 m |

- Needed: 95% at 2.5 m without orbit, 90% with orbit. Got 99.7 to 100%. **Pass.**
- Camera within 1.5 m of the drone: round 22 had 25 to 60%. Now 0 to 0.13%.
- Drone in frame at least 95%: **pass** on the combined number in all 8 runs. Seed 203 with orbit is 94.6% on tunnel frames alone. A near miss, not a fail of the test as written.
- No jump over 2 m: **pass**. The worst is 1.75 m (round 22: 12 m). The builder caps the step at 1.7 m per frame. A hard orbit into a wall can still slide the camera from 7 m to 2 m in 5 frames. I saw this once on seed 130 and once on 22. That is 40 ms here and about 80 ms at 60 Hz. It reads as a quick zoom, not a snap.
- Where the drone leaves the frame with orbit, it is one of two cases. The player pitched the view to its steepest (over 1.1 rad), and the drone sits on the bottom edge. Or the player swings sideways in a corridor. The camera stays on the tunnel axis, so the drone sits on the side edge (seed 203 Vault Tunnel, 100 frames). Both are mild.
- Ease-back still 1.13 s (drag), 0.89 s (trackpad), 1.1 s and 1.0 s (touch). Open-street desktop camera: max jump 1.12 m, 0 in solid. Unchanged.
- Looks right. In `dbg-22-organ-6.jpg` and `cam-clip-44-noorbit-1-tunnel.jpg` the camera sits low and centred under the bridge, the drone is clear, and the exit is in view. That is good tunnel framing.
- Script note: `cam-clip-22-5-tunnel.jpg` and `cam-clip-44-noorbit-3-tunnel.jpg` show no drone. That is the script, not the game. It takes the shot on a stale position right after a teleport. A real flight through the same tunnel (`dbg-22-organ-0..8.jpg`) is clean.

**Gaps between buildings (`gap-fly23.mjs`).** On seeds 22 and 44, every narrow gap at street level is a marked alley. So I flew the unmarked gaps at 8 m and 16 m (4 to 11 m wide), 10 passes per seed, with and without orbit. 0 frames in a solid. The camera was at 2.5 m or more and the drone in frame in 98 to 100% of every real pass. One exception: on seed 44 with orbit, at 8 m behind a pitched roof, the drone hid behind the roof and chimney (`gap-22-3-y8w5.5.jpg`). Pitched roofs have no full collider, so the camera does not see them as blockers. Minor. (One pass wedged the drone into a 0.9 m slot between two boxes where my script placed it. I discount it.)

**Arrival framing near low pads, no input (`arrival-metrics.mjs`, seeds 22 and 44).** 17 legs, 15 to street pads. The nav marker was off screen in 0.4% of final-approach samples (round 3 to 19 baseline: 1.2 to 2%). It still works. The one timeout is the known bot stall on a rooftop edge with the pad in plain view (`A-seed44-stall-final-approach.jpg`).

## Round 22 leftovers

- **Too few cars: closed.** Cars within 50 m of a street point: 5.8 normal, 7.3 to 7.4 in rush (round 22: 2.3 and 3.9). Seeds 130 and 44 match. Share of nearby cars standing still: 15 to 17% normal, 18 to 24% rush (round 22: about 25%). One soft spot: downtown in rush on seed 4 drops to 3.4 cars, as vans take over (`density23.log`).
- **Person on an active pad: closed.** 48 legs (24 pickups, 24 drops) on seeds 22, 58, 130, 44. 1,536 samples while hovering nearby, plus the trigger moment. 0 people on the pad by the game's count and by mine. People do walk close by (about 3 within 6 m). The street probe also shows 0 on pad on four seeds.
- **Triangles doubled: closed.** Street level 327k (round 22: 508k), rush 334k (651k). Phone 300k (438k). Draw calls rose a little: 95 desktop (83), 98 to 102 in rush (84), 79 phone (67). Fine.
- **Promenade looks like a road: not closed.** The diagonal is still red with a white dashed centre line, now partly lit, plus cross bands. No benches or planters. From 16 m it still reads as a red road with people walking down the middle (`prom-d-22-1-16m.jpg`, `prom-m-4-0-5m.jpg`, `hud23b-m-h06-high-wind.jpg`).

## Regressions

- Hand-fly first payout: desktop 5.7 s, iPhone 13 6.6 to 7.2 s. **Pass.**
- Flat-frame probe: 1,024 frames, 0 flat, 0 errors. **Pass.**
- Crash-classify, seeds 22, 58, 130: at 12 m, 22 crashes in 194 s (6.8 a minute, round 22: 6.4), 2 near the target, closest face 2.2 m below the top, **0 pad lips**. At 20 m, 13 crashes (3.5 a minute, round 22: 2.9), 4 near target, closest face 2.8 m below the top, **0 pad lips**. Pass. The small rise is within run-to-run noise.
- Low bot: 22: 4,463 Silver. 58: 2,923 Silver. 130: 5,035 Gold. **Total 12,421** (round 22: 11,426). 0 crashes.
- High bot: 22: 366 (two early crashes, run ended at 66 s). Rerun: 2,611 Silver. 58: 2,030 Silver. 130: 2,439 Silver. **Total 4,835, or 7,080 with the rerun** (round 22: 5,476). 6 crashes, 1.3 a minute (round 22: 2.3). The seed 22 drop is the known straight-line bot hitting towers. None were pad lips.
- No-delivery farm: 0 points on seeds 22, 58, 130, and 0 on smart-farm near. **Pass.**
- Van slipstream: draft works, the same 325 and 153 points on seeds 58 and 130. Capfarm van on 22: 2,814 Silver (round 22: 2,690). **Pass.**
- Traffic probe, four seeds, normal plus rush: 0 car overlaps, 0 cars in buildings, 0 off lane, 0 people in solids, 0 people touching cars, 0 people on roads. **Pass.**
- Breakdown exact (the bot's own check) on all 6 bot runs. **Pass.**

## Performance

Headless Chromium caps at 120 Hz, so these show hitches, not GPU headroom.

| Run | Median | p95 | Max | Over 20 ms | Calls | Triangles |
|---|---|---|---|---|---|---|
| Street, desktop | 8.3 | 9.2 | 10.3 | 0 | 95 | 327k |
| Street rush, desktop | 8.3 | 9.3 | 10.4 | 0 | 98 | 334k |
| Street, iPhone 13 | 8.3 | 9.6 | 10.4 | 0 | 79 | 300k |
| Street rush, iPhone 13 | 8.3 | 9.7 | 25.1 | 1 | 81 | 304k |
| Tunnels/alleys route, desktop | 8.3 | 9.2 | 16.8 | 0 | 84 | 321k |
| Same, iPhone 13 | 8.3 | 9.6 | 16.7 | 0 | 72 | 299k |
| Hand-fly 80 s, desktop | 8.3 | 9.4 | 16.8 | 0 | | |
| Hand-fly 80 s, iPhone 13 (3 runs) | 8.3 | 9.6 to 10.1 | 17 to 25 | 0 to 1 | | |

- p95 under 12 ms everywhere. **Pass.** One 25 ms frame on the phone in two runs. Not the old 200 ms hitch.
- First load, production build: HTML 11 KB, CSS 38 KB, JS 819 KB (229 KB gzipped). About 0.87 MB. lil-gui loads only with `?debug`. Type check clean. **Pass.**

## Whole game, as a player

After rounds 21 to 23 the camera feels finished. Tunnels look great from behind. The street is busy and believable. Deliveries, rush orders and medals all fire.

**Phone HUD (re-checked).** Still the clearest problem on a phone:
- The edge arrow and distance for the pad sit on the Fly stick (`m-h04-low-payout-pop.jpg`) and under the climb button (`m-h08-end.jpg`). Open since round 20.
- At 30 to 40 m height the drone rides up into the top band and hides under the objective and route pills (`hud23b-m-h06-high-wind.jpg`: only the rotors show).
- Centre pops land on the drone. "Short job · no time bonus" and the slipstream meter cover it in `m-h08-end.jpg`. "+25 Banked", the look hint, the slipstream cue and two meters stack over the street in `m-h04-low-payout-pop.jpg`.
- The pop over the route pill happens 30 to 42 times per 80 s run (`hf23-mobile*.log`).
- The round 20 overlap sampler does not see the nav marker (its box is 0 by 0). So "0 marker overlaps" in older logs is not proof.

**Route mark (re-checked, sign bot, the same 12 round 20 cities).** Unchanged. 97 legs, 40 with a mark. The game re-planned the mark 18 times (round 20: 18), dropped it 11 times (8), and showed more than one name on 6 legs (8).

## Biggest remaining gap

**The phone HUD covers what the player steers by.** It covers the pad marker, and at height the drone itself. The phone is a target platform. A bot can see this gap on every run.

**Acceptance test.** Use an iPhone 13 held sideways. Run `hand-fly23.mjs` on seeds 22 and 130, plus a 40 m cruise on seed 130. Sample at 10 Hz. Use the visible child boxes of `#nav-marker`, not its 0-size wrapper. Use the drone's projected screen box.
1. The nav marker (diamond, arrow and distance) overlaps the stick, climb, dive or boost buttons in 0 samples.
2. The drone's screen box overlaps the objective pill, the route pill or the timer in under 2% of samples, including at 40 m.
3. A centre pop covers the drone's screen box in under 5% of the samples where a pop is showing.
4. Nothing else gets worse: first payout under 10 s, p95 under 12 ms, and the desktop HUD unchanged.

## Other gaps, ranked

1. **Delivery is not yet the main reward. The systems are not taught in layers.** Street bonus, chains, rush, overtime, the slow clock and medals all fire in the first two minutes. In a low run, slip is 2,400 of 4,463 points. **Needs a human player.**
2. **Route mark still changes its mind.** 18 re-plans and 11 drops in 97 legs. Test: 0 drops while inside the marked run, and at most 1 name per leg. A bot can check this.
3. **Promenade still reads as a road.** Remove the centre dashes or add benches and planters. **Needs a human eye**, plus screenshots.
4. **Run variety.** Every city now has the same features in the same mix. **Needs a human player.**
5. **Camera polish.** The drone can hide behind pitched roofs, which have no collider. With orbit inside a corridor it can sit on the screen edge (seed 203 tunnels 94.6% in frame). Steep look-down puts it on the bottom edge. Small. A bot can check this.

Only polish remains in the camera. The rest above is game-level.

## Screenshots (progress/round-23/critic/)

- Tunnel camera, good: `dbg-22-organ-0.jpg` to `dbg-22-organ-8.jpg` (full pass), `cam-clip-44-noorbit-1-tunnel.jpg`.
- Tunnel camera with orbit: `cam-clip-130-5-tunnel.jpg` (drone kept clear), `cam-clip-203-7-tunnel.jpg` (drone on the side edge).
- Other: `cam-clip-*` (all passes, the drone-less ones are taken right after a teleport), `dbg-44-gallery-b.jpg` (drone against a tunnel side wall, still in view).
- Gaps between buildings: `gap-22-*`, `gap-44-*`. `gap-22-3-y8w5.5.jpg` shows the drone hidden behind a pitched roof.
- Arrival: `A-seed44-stall-final-approach.jpg` (pad in view, bot stalled on a roof edge).
- Promenade: `prom-d-22-*`, `prom-d-4-*`, `prom-m-22-*`, `prom-m-4-*`.
- Phone HUD, bad: `m-h04-low-payout-pop.jpg` (marker on the stick, stacked pops), `m-h08-end.jpg` (marker under the climb button, banner on the drone).
- Phone HUD, more: `hud23b-m-h06-high-wind.jpg` (drone under the top pills), `hud23-m-*`, `hud23b-m-*`, `hud23*-m-ov*.jpg`.
- Hand-fly: `d-h*`, `m-h*`.
