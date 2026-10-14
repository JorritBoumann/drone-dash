# Drone Dash, round 7 critic report

**Verdict:** The round 6 gap is closed with room to spare, and the high line was not nerfed further. But the street reward now pays for time spent near walls, not for flying well. A slow, centred, no-boost pilot scores as much a minute as anyone. The "dash" in Drone Dash no longer pays.

## Round 6 gap (slipstream too small and too slow): closed

Scripts are copied to `critic-scripts/`. The output folder is relative (`../critic/`), so no edit was needed to write to `round-7/critic/`. One browser at a time for all real-time scripts. Note: the builder had already put screenshots in `round-7/critic/`. Files with the same name were overwritten by mine.

| Pilot (seeds 22, 58, 130, SIMT 150) | Time | Deliveries/min | Score/min | Crashes/min | Slip payouts/min | Slip share of score |
|---|---|---|---|---|---|---|
| Low, round 6 | 277 s | 1.52 | 1,278 | 0.0 | 3.25 | 27% |
| **Low, round 7** | 295 s | 1.42 | **2,756** | **0.0** | 13.8 | **68%** |
| High, round 6 | 373 s | 2.41 | 1,826 | 0.5 | 0.16 | |
| **High, round 7** | 420 s | **2.71** | 2,259 | 0.7 | 3.1 | 8% |

- Low score a minute / high = **1.22** (needed 0.9). Pass.
- High deliveries a minute = **2.71** (needed 2.3). Pass. Headwind is now 20% (was 30%), so the high line got a little faster.
- Low crashes = **0** a minute. Pass.
- Hand flight, desktop: first draft at 3.9 s, first payout at 6.0 s (**2.1 s** after). Chain x2 at 8.0 s, x5 at 20.8 s. Pass.
- Hand flight, mobile (iPhone 13 held sideways, touch): first draft 3.7 s, first payout 7.2 s (**3.5 s** after). x2 at 14.8 s, x5 at 23.3 s. Pass.

## Balance and skill gradient: the street now pays for presence, not skill

Two new probes. `balance-probe.mjs` is the low route bot with a lateral offset, a speed cap and an option to never boost. `hug-probe.mjs` is deterministic: it places the drone on a straight street at 7 m and flies 12 s.

Route play, seeds 22, 58, 130, SIMT 150:

| Pilot | Score/min | Deliveries/min | Crashes | Final score per run |
|---|---|---|---|---|
| Lazy: centred, 10 m/s, never boosts | **2,783** | 1.12 | 0 | 4,129 |
| Standard low bot: centred, 16 m/s, boosts | 2,756 | 1.42 | 0 | 4,517 |
| Wall offset 5.5 m, 16 m/s, boosts | 2,556 | 0.99 | 1 | 3,450 |
| High line, 40 m | 2,259 | 2.71 | 5 | 5,271 |

Straight street, 12 s, three roads on seed 22 (all three gave the same result):

| Line | Speed | Payouts | Slip points |
|---|---|---|---|
| Centre | 8.9 m/s | 5 | 500 |
| Centre | 16.3 m/s | 5 | 500 |
| 2.5 m from a facade | 8.9 m/s | 7 | 800 |
| 2.5 m from a facade | 16.3 m/s | 8 | 950 |

What this means:
- **Speed is worth nothing to the meter.** Full draft starts at 8 m/s. The meter fills by time, not distance. Going 16 m/s instead of 9 gives the same payouts.
- **Slow is not punished.** Drafting pauses the fast-drop par clock, and each payout adds 0.5 s. So a slow street crawl keeps the combo alive and refills the clock.
- **The street centre is already full quality** (mean quality 0.96 to 0.97). Facades are 9 m away and "full" is 9.5 m. No steering skill is needed.
- **The only skill lever is the wall hug.** It is worth up to 1.9x on a straight. In route play it did not convert: corners and kerbs cost more than it paid, and the offset bot crashed once.
- **The roof line is not pointless.** Per run, high still scores most (5,271), because more deliveries buy more clock. High runs last 120 to 150 s, low runs 72 to 112 s. But a player cannot see this trade. The HUD shows score a minute climbing faster on the street.
- **Deliveries are now the minor part of a street run.** 68 to 77% of low score is slipstream points. The game is called a delivery game.

So there is a gradient, but on the wrong axis. Lazy, centred, low flight earns as much as the standard bot and more than the wall-offset bot.

## Seed 91: bot fault, not game fault

Arrival-metrics on all 8 seeds: 67 legs, 66 arrived, 1 timeout (seed 91). I ran seed 91 alone five more times with a per-second trace (`seed91-watch.mjs`).
- Every run had exactly one timeout. In 4 of 5, the bot spent 31 to 36 s on the fifth leg (Florist, Juniper and 4th). It hovered at 40 to 62 m, 43 to 67 m from the target, and crashed 2 to 4 times into one tower. Screenshots `S91-leg5-plus14s.jpg` and `S91-leg5-plus22s.jpg` show a slab tower taller than the bot's 40 m cruise height, directly on the straight line to the pad. The bot steers straight at the target and never routes around. A player goes around.
- The run then ends with the clock at 0 during the next leg. The clock is 50 s plus delivery bonuses. With only 2 deliveries, a timeout around 70 s is the normal end of a run, not a fault.
- The one-off 15.5 s rooftop arrival did not come back. Longest final approach over all 8 seeds: 4.5 s. Five seed 91 runs: final approaches 2.9 to 4.0 s, 0 stalls in the final 30 m.

## Single biggest remaining gap: the score rewards time near walls, not fast or skilful flying

The game sells a dash: fast drops, combos, boost through streets. The scoring now says the opposite. The best score a minute comes from crawling down the middle of a street at 9 m/s without boosting. The meter fills by time, the street centre is already full strength, and drafting stops the par clock. Two thirds of a street run's score comes from this meter. The best arcade flyers make the risky, fast, tight line pay clearly more than the safe one. Speed and precision multiply the reward, and a lazy run looks lazy on the score screen. Here a skilled run and a lazy run score the same.

Fix direction (the builder's call). Fill the meter by distance flown in the draft, or scale it by speed. Narrow full strength so the street centre is not full. Make the hug the main way to reach high chains. Stop the par pause from rewarding slowness.

**Acceptance test** (dev server on 5188, from the game folder, one browser at a time):
1. `OFF=0 CRUISE=10 NOBOOST=1 LINE=low SEEDS=22,58,130 SIMT=150 node progress/round-7/critic-scripts/balance-probe.mjs` (lazy). Then `LINE=low SEEDS=22,58,130 SIMT=150 node progress/round-7/critic-scripts/route-play-rt-x.mjs` (standard). Pass: lazy score a minute is at most **0.8 times** standard. Now 1.01.
2. `node progress/round-7/critic-scripts/hug-probe.mjs`. Pass: on each road, centre at 16.3 m/s earns at least **1.3 times** the slip points of centre at 8.9 m/s (now 1.0). Hug at 2.5 m and 16.3 m/s earns at least **2 times** centre at 8.9 m/s (now 1.9).
3. The round 6 test still passes. Standard low score a minute is at least 0.9 times high. High deliveries are at least 2.3 a minute. Low crashes are at most 1.5 a minute. In hand-fly, the first payout comes within 10 s of the first draft, and x2 within 50 s, on desktop and mobile.
4. Slipstream points are at most **50%** of standard low score. Now 68%.

## Other gaps (ranked)

1. **No difficulty curve, and runs are short and flat.** Runs last 70 to 150 s. Nothing changes over a run except smaller time bonuses (down to 55%). No new hazards, no harder sites, no rush hour. The tenth delivery feels like the first.
2. **Game over screen does not explain the score.** It shows score, best, deliveries and top combo (`m-r7-gameover.jpg`). It does not split delivery, combo and slipstream points, or show the street versus roof trade. A player cannot learn why a run was good.
3. **Up high at crawl speed, the headwind chip still shows.** At 55 m and 4 m/s, it reads "High wind · slower up here" (`S91-leg5-plus14s.jpg`). Round 6 asked for it only at speed.
4. **Mobile bottom centre is crowded during a payout.** Four items stack below the drone: the pop, the hint line, the meter and the boost bar. They cover the street ahead (`m-h04-low-payout-pop.jpg`). Desktop is fixed: the pop now sits by the drone (`d-h05-low-payout-chain.jpg`).
5. **Tall towers on the straight line can trap a player.** On seed 91, the nav marker points through a tower taller than normal cruise height. It gives no hint to go around. A route-around hint, or a marker that rises above the blocker, can help.

## Regressions: none found

- **crash-classify, all 8 seeds:** 12 m: 23 deliveries, 45 charged (3.8/min), **0 hop-like**. 20 m: 31 deliveries, 28 charged (2.1/min), **0 hop-like**.
- **Near-target crashes** (verbose rerun, seeds 11, 22, 7, 44 at 12 m and 11, 22, 7, 130 at 20 m): all hit building faces with tops 10.6 to 58.6 m at 13.9 to 17.1 m/s. Pads are 0.4 m. **0 on a pad lip.**
- **arrival-metrics, all 8 seeds:** 66 of 67 legs arrived. Median final 3.2 s, longest 4.5 s, 0 stalls. Marker off screen 1.3%. Slow and high 0.5%. The one timeout is explained above.
- **Flat-frame probe:** 869 frames, **0 flat**.
- No page errors on desktop or mobile.

## Performance


- Desktop 1280x720, 80 s hand flight: 9,577 frames, **median 8.30 ms, p95 9.60 ms, max 10.4 ms, 0 over 20 ms**.
- Mobile (iPhone 13 held sideways, touch), 80 s: 9,579 frames, median 8.30 ms, p95 9.50 ms, max 10.4 ms, 0 over 20 ms.
- First load, production build: about **0.73 MB** (JS 701 KB, CSS 20 KB, HTML 7 KB). The lil-gui chunk (31 KB) loads only with `?debug`. Budget 15 MB: pass.

## Screenshots (progress/round-7/critic/)

- Hand flight, desktop: d-h01-title, d-h02-low-drafting, d-h03-low-meter-half, d-h04-low-payout-pop, d-h05-low-payout-chain, d-h06-high-wind, d-h07-high-boost, d-h08-end
- Hand flight, mobile: m-h01-title, m-h02-low-drafting, m-h03-low-meter-half, m-h04-low-payout-pop, m-h05-low-payout-chain, m-h06-high-wind, m-h07-high-boost, m-h08-end
- Game over: d-r7-gameover, m-r7-gameover
- Seed 91: S91-leg5-plus6s, S91-leg5-plus14s, S91-leg5-plus22s, S91-t41/t50/t58 (a run that took a different path), A-seed91-stall-final-approach
- Crash classify: K-alt12-*, K-alt20-*. Route pilots: Q-high-*. Balance probe: B-off5.5-seed130-crash1

New scripts (progress/round-7/critic-scripts/): balance-probe.mjs, hug-probe.mjs, seed91-watch.mjs, gameover-shot.mjs. Logs: rp-low.log, rp-high.log, bp-lazy.log, bp-hug.log, hug.log, hf-desktop.log, hf-mobile.log, cc12.log, cc20.log, ccv12.log, ccv20.log, am-all.log, s91-1..5.log.
