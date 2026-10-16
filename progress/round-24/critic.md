# Drone Dash: round 24 critic report

**Verdict:** The phone HUD gap is closed on all five phone runs, with no regressions. The route mark no longer changes its mind. Only polish remains in the HUD and the camera. The biggest gap left is game-level and needs a human player.

Build tested: commit d0ecc62 plus the uncommitted round 24 changes. My own dev server on port 5191, stopped at the end. The owner's server on 5188 was left alone. It is still running. Every browser ran alone, one at a time, from one job queue (`critic-scripts/queue24.sh`, `jobs24.txt`). I did not read the builder notes.

## Round 23 gap: phone HUD. Closed.

Probe: the builder's `hud-probe.mjs`, copied, with my own init script `hud-probe-init24c.js`. I checked that it measures the real thing. Every box is `getBoundingClientRect` of the visible element (the nav arrow, diamond and distance pill, not the 0-size wrapper). The drone box projects every visible drone vertex through the real render camera, view shift included. I drew that box onto the screenshots (`hud24-m-22-p60-y41.jpg`, `hud24-m-22-h08-end.jpg`): it hugs the drone. Sampled at 10 Hz while playing. 80 s per run: 50 s low street line, then 30 s at 40 m with boost.

| Run | Samples | 1. Marker on stick or button | 2. Drone under top pills (all / above 30 m) | 3. Pop on drone (of samples with a pop) |
|---|---|---|---|---|
| iPhone 13, seed 22 | 795 | 0 | 0% / 0 of 83 | 0 of 183 (0%) |
| iPhone 13, seed 130 | 790 | 0 | 0.25% / 0 of 87 | 5 of 203 (2.5%) |
| iPhone 13, seed 130, 72 s at 40 m | 794 | 0 | 0% / 0 of 338 | 5 of 151 (3.3%) |
| Android 915x412, seed 317 (fresh) | 797 | 0 | 0.63% / 0 of 105 | 7 of 165 (4.2%) |
| Android 915x412, seed 22 | 793 | 0 | 0% / 0 of 84 | 3 of 188 (1.6%) |
| **All phone runs** | 3,969 | **0** | **0.18%**, 0 of 697 at height | **20 of 890 (2.2%)** |

- Test 1: **pass.** 0 of 3,962 samples with a marker. The marker also never touched the "Fly" label or the top panels on iPhone. It touched a top panel twice on Android.
- Test 2: **pass**, including 34 s in a row at 40 m. The 7 hits were all at 6 to 14 m, right after a delivery, with the camera squeezed against a wall. The drone then fills the screen (`hud24-a-317-ov2.jpg`, `hud24-m-130-ov1.jpg`).
- Test 3: **pass** on every run. The worst run is 4.2%, so there is little margin. Most hits come from the same moment: the camera is squeezed against a wall, and "Fast drop!" lands on a huge drone. The rest are the Rush hour and Overtime event pops on the narrow Android screen.
- Round 23 bad shot vs now, same moment on seed 130 at 40 m: `../round-23/critic/hud23b-m-h06-high-wind.jpg` (only the rotors show) vs `hud24-m-130-h06-high-wind.jpg` (drone clear below the route pill).
- Pops now sit left of the drone and above the stick (`hud24-m-22-h04-low-payout-pop.jpg`). That reads well. My check flags them against the top panels in up to 21% of iPhone samples. In the shots there is no visible overlap, so I think the centre column's box is wider than its pills. Not a fail.

**Phone view shift (player judgement).** It feels natural. The view moves about 50 px down at 40 m (max 86 px of 390). That shows more of the city ahead and the horizon, and less of what is right under and behind the drone. At height the drone now sits 40 to 60% down the screen in 92 to 99% of samples. At street level the shift is 0 most of the time. It does not hide road ahead. The shift eases in and out as you climb. A phone player must still judge how that feels (**needs a human player**).

### Small leftovers
- The route tag ("Gallery Tunnel 13 m") can run off the left edge and sit on the "Fly" label (`hud24-a-317-ov2.jpg`). The marker avoids the controls, but the route tag does not.
- When the drone sits low on screen, the look hint and the slipstream meter can overlap it. This happens in 1 to 7% of samples. Small.
- On the narrow Android screen the marker can sit in the gap between the score panel and the timer (`hud24-a-317-h04-low-payout-pop.jpg`). It is readable.

## Round 23 leftovers

**Promenade lane line: closed.** No centre line on the diagonals, desktop or phone (`prom-d-22-1-16m.jpg`, `prom-m-4-0-5m.jpg`, all `prom-*`). Only light stone bands across the red paving remain. As a look, from 16 m it still reads a bit like a wide red road with stop bars. No benches or planters. **Needs a human eye.**

**Route mark: closed in substance.** Sign bot, the same 12 round 20 cities, `route-sign24.mjs` (round 20 control, plus a log line per mark change). 86 legs (round 23: 97).

| | Round 23 | Round 24 | Per 100 legs |
|---|---|---|---|
| Re-plans (the old counter) | 18 | 15 | 18.6 to 17.4 |
| Drops before entry | 11 | 1 | 11.3 to 1.2 |
| Legs with more than one name | 6 | 7 | |

- Drops: **pass**, cut to a tenth.
- Re-plans: **fail as written**, only 7% fewer. But the per-change log shows that none of the 15 is the mark jumping from one alley to another. 3 are a mark at the start of a leg. 3 are a new mark after the drone finished a run. 9 are a mark that first appears 2 to 10 s into the leg. The old counter counts all of these. True changes of mind at the entrance (move or drop): 1 in 86 legs. I cannot split the round 23 number the same way.
- The 9 late marks are a small leftover: a shortcut that appears after you have set off. Low stakes.

**Lag on a real change of route.** I ran a grid bot that ignores the mark on the same 12 cities. In 84 legs, the mark had to give way 44 times. My clock starts at the drone's closest point to the marked entrance. Median: 2.5 s and 12 m. 90% within 3.4 s and 22 m. The worst was 8.8 s and 75 m, once. After you turn away, you still see the arch for about 2 s. That reads as "it noticed", not as lag. One worst case is long (**needs a human player**).

## Regressions

- Desktop HUD: all rects identical to round 23 (timer, objective, slip, wind, pause, telemetry). The view shift is 0 on desktop. Pops on desktop are still centred and cover the drone in 50% of pop samples, as before. **Unchanged.**
- Hand-fly first payout: desktop 5.4 s, iPhone 13 6.6 s. **Pass.**
- Flat-frame probe: 1,029 frames, 0 flat, 0 errors. **Pass.**
- Crash-classify, all 8 seeds: 12 m: 64 crashes in 695 s (5.5 a minute, round 23: 6.8 on 3 seeds), 13 near target, closest face 2.3 m below the top, **0 pad lips**. 20 m: 44 crashes in 683 s (3.9 a minute, round 23: 3.5), 16 near target, closest 2.2 m, **0 pad lips**. **Pass.**
- Low bot: 22: 4,347 Silver. 58: 2,407 Silver. 130: 3,716 Silver. **Total 10,470** (round 23: 12,421). Rerun: 58: 2,499, 130: 3,866 (total 10,712). The drop is one fewer delivery on 58 and 130. This bot does not read the mark or the marker. On seed 130, 3 deliveries is the norm (rounds 18 to 22). Round 23 got 4, once. Seed 58 alone went from 1,792 to 4,982 over rounds 12 to 23. Noise, not a regression. 0 crashes.
- High bot: 22: 2,446 Silver. 58: 3,014 Silver. 130: 1,755 Bronze. **Total 7,215** (round 23: about 7,080 after a rerun). 10 crashes, 1.9 a minute (round 23: 1.3). None were pad lips.
- No-delivery farm: 0 points on seeds 22, 58, 130, and 0 on smart-farm near. **Pass.**
- Van slipstream: the same 325 and 153 draft points on seeds 58 and 130. Capfarm van on 22: 2,814 Silver, the same as round 23. **Pass.**
- Traffic probe, 4 seeds, normal and rush: 0 car overlaps, 0 cars in solids, 0 people in solids, 0 people hit by cars, 0 on pads, 0 off lane. **Pass.**
- Breakdown exact (the bot's own check, sum and game-over screen) on all 8 bot runs. **Pass.**
- Camera tunnel test (round 23 `cam-clip` and `frame-check`, plus a phone run to test the view shift):

| Run | Tunnel frames | Camera at 2.5 m+ | Drone in frame (tunnel / all) | In solid / under / hidden | Max jump |
|---|---|---|---|---|---|
| Seed 22, orbit | 3,466 | 100% | 97.8% / 98.0% | 0 / 0 / 0 | 1.70 m |
| Seed 22, no orbit | 3,463 | 100% | 99.9% / 99.9% | 0 / 0 / 0 | 0.80 m |
| Seed 130, no orbit | 2,770 | 100% | 99.8% / 99.3% | 0 / 0 / 0 | 0.29 m |
| Seed 22, iPhone 13, no orbit | 3,455 | 100% | 99.9% / 100% | 0 / 0 / 0 | 1.10 m |

  **Pass.** The view shift does not push the drone out of frame in tunnels.

## Performance

Headless Chromium caps at 120 Hz, so these show hitches, not GPU headroom.

| Run | Median | p95 | Max | Over 20 ms | Calls | Triangles |
|---|---|---|---|---|---|---|
| Street, desktop | 8.3 | 9.5 | 10.4 | 0 | 95 | 328k |
| Street rush, desktop | 8.3 | 9.5 | 10.3 | 0 | 98 | 332k |
| Street, iPhone 13 | 8.3 | 9.6 | 10.4 | 0 | 79 | 300k |
| Street rush, iPhone 13 | 8.3 | 9.7 | 10.4 | 0 | 81 | 303k |
| Tunnels/alleys, desktop | 8.3 | 8.7 | 10.3 | 0 | 84 | 321k |
| Tunnels/alleys, iPhone 13 | 8.3 | 8.9 | 16.7 | 0 | 72 | 299k |
| HUD probe runs, phones (5) | 8.3 | 9.5 to 9.9 | 16.6 to 25.0 | 0 to 1 | | |
| Hand-fly, desktop / iPhone | 8.3 | 9.5 / 9.6 | 16.7 / 24.9 | 0 / 1 | | |

- p95 under 12 ms everywhere. **Pass.** One 25 ms frame in two phone runs, as in round 23.
- First load, production build: HTML 11 KB, CSS 39 KB, JS 824 KB (231 KB gzipped). About 0.87 MB. Type check clean. **Pass.**

## Whole game, as a player

The phone now plays cleanly. The stick, buttons and marker never fight. The drone stays clear of the top pills at any height, and pops land beside it. Camera, traffic and route marks are all steady. What is left in the HUD and camera is polish.

## Biggest remaining gap

**Delivery is not yet the main reward. The systems are not taught in layers.** Street bonus, chains, rush, overtime, the slow clock and medals all fire in the first two minutes. In the low bot runs, slipstream is 56% of the points (5,907 of 10,470). In the 80 s hand-fly on seed 22, the player banks 8 slipstream payouts and makes 1 delivery. A new player is likely to read this as a slipstream game with parcels on the side. **Needs a human player.**

**Acceptance test.** Three new players, each plays 3 runs on a phone with no explanation. Afterwards, each can say in one sentence what scores the most. At least 2 of 3 say "delivering parcels". Bot side: use the low and high bot runs on seeds 22, 58 and 130. Delivery points (drops, fast and combo) are at least 55% of the total. Apart from the first pickup, no new HUD element shows before 30 s.

## Other gaps, ranked

1. **Run variety.** Every city has the same features in the same mix. **Needs a human player.**
2. **Promenade still reads as a red road with stop bars from above.** Add benches, planters or a paving pattern along it. **Needs a human eye**, plus screenshots.
3. **The phone route tag ignores the controls.** It can sit off the left edge and on the "Fly" label (`hud24-a-317-ov2.jpg`). Test: the `#gate-tag` box overlaps the stick, its label or a button in 0 samples, and stays fully on screen. A bot can check this.
4. **Camera squeezed against a wall after a delivery.** The drone fills the screen, and the pop and top pills land on it (`hud24-m-130-ov1.jpg`). All the remaining HUD hits come from this. A bot can check this: camera within 2 m of the drone in open streets, 0 samples.
5. **Late route marks.** 9 in 86 legs show a shortcut 2 to 10 s after the leg starts. Desktop pops still cover the drone in half of the pop samples. Both small. A bot can check them.

## Screenshots (progress/round-24/critic/)

- Phone HUD, good: `hud24-m-22-h04-low-payout-pop.jpg` (pop left of the drone, marker clear of the stick).
- Drone box drawn by the probe (green): `hud24-m-22-p60-y41.jpg`, `hud24-m-22-h08-end.jpg`.
- At 40 m: `hud24-m-130-h06-high-wind.jpg` (drone clear), `hud24hi-m-130-p*.jpg` (sustained flight).
- Phone HUD, the remaining hits: `hud24-m-130-ov1.jpg`, `hud24-m-130-ov2.jpg`, `hud24-a-317-ov1.jpg` to `ov3.jpg` (camera against a wall, drone fills the screen, and in `ov2` the route tag on the "Fly" label).
- Android: `hud24-a-317-*`, `hud24-a-22-*`. Desktop: `hud24-d-22-*`. Periodic shots: `hud24*-p<seconds>-y<altitude>.jpg`.
- Promenade: `prom-d-22-*`, `prom-d-4-*`, `prom-m-22-*`, `prom-m-4-*`.
- Camera tunnel: `cam-clip-22-*`, `cam-clip-22-noorbit-*`, `cam-clip-130-noorbit-*`, `cam-clip-m-22-noorbit-*`.
- Crash near target: `N-alt12-*`, `N-alt20-*`.
