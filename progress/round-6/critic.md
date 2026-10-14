# Drone Dash, round 6 critic report

**Verdict:** The street line now pays, and the round 5 test passes on deliveries. But half of the change came from slowing the roof line down, and the street line still earns 30% less score a minute. It is now a fair second choice, not the stylish best line.

## Round 5 gap (low line safe but paid nothing): closed, narrowly

Scripts are copied to `critic-scripts/`. Only the output folder changed (it is relative, so it now writes to `round-6/critic/`). I ran `route-play-rt-x.mjs`. It is `route-play-rt.mjs` plus log-only fields (slipstream payouts, payout times, mean headwind). The control logic is the same. One browser at a time.

| Pilot (seeds 22, 58, 130, SIMT 150) | Time | Deliveries/min | Score/min | Crashes/min | Slipstream payouts/min |
|---|---|---|---|---|---|
| Low, round 5 | 215 s | 1.12 | 348 | 0.0 | none existed |
| Low, round 6 | 277 s | **1.52** | **1,278** | **0.0** | **3.25** |
| Low, round 6 repeat | 278 s | 1.51 | 1,281 | 0.0 | 3.45 |
| High, round 5 | 450 s | 3.33 | 2,439 | 1.3 | |
| High, round 6 | 373 s | **2.41** | **1,826** | 0.5 | 0.16 |

- Deliveries: low/high = **0.63** (needed 0.6). Pass, by a margin of under one delivery in this sample.
- Score: low/high = **0.70** (needed 0.75). Fail on its own. The test needs only one of the two.
- Visible low-line reward: 3.25 to 3.45 payouts a minute, each with a "+N slipstream" pop, "+1s" at the timer, a burst and a sound. Pass.
- Low crashes: 0 per minute in 555 s. Pass.
- High-line deliveries a minute dropped **28%** (3.33 to 2.41). High runs now end at 120 to 129 s. In round 5 they all ran to the 150 s cap.

## How the pass was achieved

Three changes:
1. **Headwind above 20 m** (full from 28 m) takes 30% off top speed. Measured: cruise 16.3 m/s at 10 m, 11.8 m/s at 40 m. Boost 29.4 m/s at 10 m, 21.4 m/s at 40 m.
2. **Slipstream meter** below 18 m beside facades. Each full meter pays 40 points (plus 15 per chain step) times combo, plus 1 s, plus 30% boost. It made up 27% of low score (1,622 of 5,899).
3. **Leg par uses grid distance**, and drafting pauses the par clock. So street routes can now earn fast-drop bonuses. Low score without slipstream points rose from 348 to 926 a minute, so this quiet change did more for low score than the meter did.

Split: the gap went from 0.34 to 0.63. In log terms, almost exactly half came from the low line getting better (+36%) and half from the high line getting worse (-28%). With the round 5 high rate, low/high is 1.52/3.33 = 0.46, a fail. So the pass depends on the nerf. That is the weaker way, as the brief warned. The headwind is at least honest. It has a chip ("High wind · slower up here"), pale streaks and an audio change.

**Mid-line check (exploit test).** Same high bot at 19 m, just under the wind: 2.50 deliveries/min, but 3.1 crashes/min and 0 payouts. No dominant mid line. Good.

## Single biggest remaining gap: the slipstream reward is too thin to make the street the line you want

The street line is now safe and paid, but a player still scores more by going over the roofs (1,826 against 1,278 a minute). The reward that must flip that is small and slow:
- One payout is 40 points before combo. One delivery is about 400 to 800. Three payouts a minute is worth less than one delivery.
- In hand flights, the first payout came **16.5 s** (desktop) and **26 s** (mobile) after the first draft. The meter fills in 2 s only at full quality, which needs a facade within 4 m at 14 m/s. Flying the middle of a street gives low quality.
- The chain never went above x1 in 5 hand payouts. Crossing an intersection breaks the draft, and 3 s out resets the chain. On this 44 m grid, that happens on every block. So the x2 to x5 chain, the skill ceiling, is rarely reached.
- The title screen does not mention it. You learn it by seeing a meter appear.

The best arcade city flyers make the risky low line the fastest and richest line. You hear the wind, the bonus counter runs up as you hug the wall, and a good run feels obviously better than a safe one. Here the low line is "less bad".

**Acceptance test** (dev server on 5188, from the game folder):
1. `LINE=low SEEDS=22,58,130 SIMT=150 node progress/round-6/critic-scripts/route-play-rt-x.mjs`, and the same with `LINE=high`. Unchanged bots.
2. Pass: low score a minute is at least **0.9 times** high. Now 0.70.
3. Pass: high deliveries a minute stay at **2.3 or more**. Now 2.41. No further high nerf.
4. Pass: run `hand-fly.mjs` on desktop and with `MOBILE=1`. The first payout comes within **10 s** of the first draft. A chain of **x2 or more** happens at least once in 50 s of low flight. Now 16.5 s and 26 s, and x1.
5. Low crashes stay at 1.5 per minute or less.

## Other gaps (ranked)

1. **The headwind chip shows at rooftop pads.** At a 29 m rooftop pad at 2 m/s, it shows "High wind · slower up here" (`d08-stuck-near-drop.jpg`). It is noise there and makes rooftop jobs feel penalized. When the drone moves fast up high, show it. Otherwise, hide it.
2. **Desktop payout pop sits in the bottom-left corner,** far from the drone (`d-h04-low-payout-pop.jpg`). On mobile it is centred near the drone and reads much better (`m-h04-low-payout-pop.jpg`). Desktop players watch the drone.
3. **The slipstream label is ghosted until drafting starts** (`d-h02-low-drafting.jpg`). A new player sees a faint word with no explanation.
4. **High flight is slower in towers' own band.** At 26 m beside a 50 m tower there is wind but no draft (`d-h06-high-wind.jpg`). Drafting is capped at 18 m, so a tower canyon at 25 m feels punished twice. Minor, but players will notice.
5. **crash-stakes finds no boost crash on seeds 22 and 58 now.** The slower high bot ends its second delivery in a different place. The straight boost then finds open street. The bot path causes this, not the game. A retry variant (`crash-stakes-x.mjs`) and `boost-probe.mjs` show hits still charge. Seed 130: 17.3 m/s, -4 s, combo x2 lost. Seed 58: 15.8 m/s, -4 s. Seed 22: a 29.4 m/s boost into a wall was charged.

## Regressions: none found

- **crash-classify, all 8 seeds:** 12 m: 16 deliveries, 30 charged (3.1/min), **0 hop-like**. 20 m: 31 deliveries, 31 charged (2.3/min), **0 hop-like**. 40 m reference: 35 deliveries, 5 charged (0.3/min).
- **Near-target crashes** (verbose rerun, seeds 22, 58, 91 at 12 m and 11, 22, 33 at 20 m): all hit building faces with tops 10.6 to 20.2 m. Pads are 0.4 m. Speed 0.3 s before was 16 to 17 m/s. **0 on a pad lip.** Same bot overshoot as round 5.
- **arrival-metrics, all 8 seeds:** 67 legs, against 82 in round 5, because cruise is slower. **0 timeouts.** Longest final 4.5 s, median final 3.4 s. Marker off screen 1.3% and 2.5%. Slow and high 0.0% and 0.4%. Pass.
- **Flat-frame probe:** 148 sampled frames, **0 flat**.
- No page errors on desktop or mobile.

## How it plays

- **Street flight is pleasant and now has a pulse.** The meter fills, ticks, and pays with a pop, a burst and a sound. Wind streaks peel off the drone while drafting. The mobile layout puts the meter just above boost, centred, and it reads well (`m-h03-low-meter-half.jpg`).
- **High flight is slower but not hateful.** The wind is explained right away, and boost still gets you to 21 m/s. Some players will resent a speed cap they cannot see in the world. The chip helps.
- **HUD is busy but not crowded.** On mobile the wind chip and slipstream meter share one slot and never show together. No overlap with the stick, boost or climb buttons. On desktop, bottom-left now stacks pop, slipstream, wind, boost and telemetry, which is the busiest corner.

## Performance

- Desktop 1280x720, 80 s of flight (both lines): 9,578 frames, **median 8.30 ms, p95 9.80 ms, max 10.4 ms, 0 over 20 ms**. Same as round 5.
- Mobile emulation (iPhone 13 held sideways, touch), 80 s: 9,578 frames, median 8.30 ms, p95 9.60 ms, max 10.4 ms, 0 over 20 ms.
- First load, production build: **0.73 MB** (JS 699 KB, CSS 19 KB, HTML 7 KB, lil-gui chunk 31 KB). Budget 15 MB: pass.

## Screenshots (progress/round-6/critic/)

- Hand flights, desktop: d-h01-title, d-h02-low-drafting, d-h03-low-meter-half, d-h04-low-payout-pop, d-h06-high-wind, d-h08-end
- Hand flights, mobile: m-h01-title, m-h02-low-drafting, m-h03-low-meter-half, m-h04-low-payout-pop, m-h06-high-wind, m-h08-end
- Crash classify: K-alt12-*, K-alt20-*, K-alt40-*. Near target: N-alt12-seed22-t34.8/t65.3, N-alt12-seed91-t34.9, N-alt20-seed22-t32.3
- Crash stakes: X-seed130-crash, X-seed58-crash-x, X-seed130-crash-x
- Route pilots: Q-high-* (seed 58 from the 40 m run. Seeds 22 and 130 overwritten by the 19 m mid-line run)
- Flow probe: d01-title, d02-takeoff, d03-flying, d04-near-pickup, d08-stuck-near-drop (old bot without back-off, stuck by a rooftop structure. bot cause), d08b-after-bump, d09-game-over

New scripts (progress/round-6/critic-scripts/): route-play-rt-x.mjs (log-only fields, optional HIGHY), crash-stakes-x.mjs (retries other headings), boost-probe.mjs (top speeds by altitude), hand-fly.mjs (both lines, desktop or MOBILE=1, frame times, HUD rects).
