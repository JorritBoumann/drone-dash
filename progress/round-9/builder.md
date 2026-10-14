# Drone Dash, round 9 builder

Main concern: there was nothing to play for beyond one unexplained number. Two leftovers: the mobile first payout (11 s) and the strict slipstream share (62%).

**Honest summary: one acceptance number fails.** The strict share is now 46%, but low score a minute is 0.76 of high (needed 0.9). The two targets cannot both be met with the current bots. The section "Leftover B" shows why. Everything else passes.

## Design

### Medals (score goals)

There are four medals for one run's score: **Bronze 1,000, Silver 2,250, Gold 4,500, Ace 7,500** (`GOALS` in config.ts).

Why these thresholds (deterministic sim, plus real-time checks, seeds 22, 58, 130):
- Lazy pilot runs: 1,723 / 791 / 255 (real time: 1,728 / 816 / 1,141). Silver sits above the best lazy run with a margin of 30%. A slow, centred flier gets Bronze at most.
- Standard low runs: 3,688 / 1,792 / 2,782 (real time: 3,553 / 1,792 / 2,537). Silver in 2 of 3.
- High runs: 6,859 / 4,123 / 4,760 (real time: 5,524 / 4,078 / 5,421). Gold in 2 of 3, Silver in 3 of 3.
- Ace is 9% above the best bot run seen (6,859) and 36% above the best real-time bot run. Ace needs a long, clean run with a deep combo.
- The steps roughly double (1,000, 2,250, 4,500, 7,500), so each medal feels like a new level.

Where the medals show:
- **Title:** a row of four medal chips with names and scores, under Play. Chips for medals already won get a gold outline. The best line reads "Best 3,733 Silver".
- **In-run HUD:** one compact row under the score, in the top-left corner: next medal disc, its name and score ("SILVER 2,250"), and a thin 56 px progress bar from the last medal. No change to the area below the drone, which was already crowded on mobile.
- **Medal moment:** a large medal banner shows ("SILVER!"). The medal flips in, rays turn behind it, and a pill says "Next: Gold 4,500". A three-note fanfare plays. It rises one tone per medal and adds one bell per medal. A sparkle burst in the medal colour comes off the drone, the camera shakes a little, and the HUD goal row flashes. A drop usually carries the score across a line. So if a delivery pop is still showing, the banner waits until that pop has shown for about 1 s, then replaces it. The sound waits with it. On short (phone) screens the medal sits beside the text, so the banner stays clear of the objective pill.
- **Game over:** medal reached (or "No medal yet"), the score, "New best!", "767 more for Gold", then a breakdown:
  - Deliveries ×n (100 + 1.2 per metre of each leg)
  - Fast drops ×n (+75 each, before the combo)
  - Combo bonus (up to x2.5): the extra points from the combo multiplier
  - Slipstream ×payouts
  - Score (total)
  
  The game counts each line as a whole number at the moment it is earned. So the lines sum exactly to the score. Below that is the clock story: "Flew 1:48. 50 s start, +48 s drops, +10 s slipstream, −3 s 1 crash". Crashes cost seconds, not points, so they show in the time line. The time line sums exactly to the seconds flown. It also explains why street runs are shorter. Then come the best score and best medal, and "Fly again".
- **Storage:** the best score is in `drone-dash-best-v1` (unchanged). The best medal is in `drone-dash-best-tier-v1`. Each read and write is in try/catch.
- **Diagnostics:** `goals = { tier, tierName, next, passes, passList: [{tier, name, score, t}], best, bestTier, thresholds }` and `breakdown = { drops, fast, combo, slip, fastCount, dropSeconds, slipSeconds, crashSeconds, total }`. When one drop crosses two lines, both are counted.

I did not move the desktop slipstream meter. It was optional, and I kept the risk low.

### Leftover A: mobile first payout

On the first meter of a run only, the speed factor is at least 0.6 (`introSpeedFloor`) once the drone is above 4 m/s. So speed counts once on the intro meter, not twice. A touch pilot drafting at 6 m/s now fills the 4-metre intro meter in about 1.5 s. Every later meter is unchanged, so the lazy pilot gains one early 45-point payout and nothing more.

### Leftover B: strict slipstream share

Every point that exists only because of drafting is now in the "Slipstream" line. So the strict share and the direct share are the same number:
- **Street multiplier removed.** A slipstream chain held at the drop no longer multiplies the delivery.
- **Par pause removed.** Drafting no longer stops the fast-drop clock.
- **Par loosened** so that the street route can make it without drafting: par = street-route length / 9 m/s + 7 s (was / 12.5 + 5 with the draft pause). The standard low bot makes 7 of 7 fast drops, the same as before with the pause. The high line already made every par.
- **Payouts smaller:** 45 + 25 per chain step, so x5 pays 145. Before, it was 50 + 30, and x5 paid 170.

Why the 0.9 ratio cannot also be met: if the share is at most 50%, low score can be at most 2 × low non-draft points. Low non-draft points are about 900 a minute in the sim (about 900 real time). High is about 2,200 a minute. So the best possible ratio at a 50% share is about 0.80. In real time I got 0.76 at a 46% share. The low bot delivers 1.48 a minute against 2.62 for the high bot, and the high bot builds deeper combos (x3.5). Per-delivery changes scale both lines alike. I tested a combo cap of 3 or 4, a stronger headwind and other combo curves in the sim. None reaches 0.9 at a 50% share without cutting the high line below about 2.3 deliveries a minute or gutting the combo. The only other way is a new non-draft reward for the street route (for example a bonus for a leg flown under the roofline). I did not add it. It can look like the street multiplier moved into a new category. This is a choice for the next round: accept the ratio, weaken the roof line, or add a street-route reward.

## Files changed

- src/game/config.ts: `GOALS` (medals). In `RUN`: `fastBonus`, `parSpeed` 9, `parSlack` 7, `comboStep` (0.5, unchanged behaviour). In `SLIPSTREAM`: `introSpeedFloor` 0.6, points 45 and chainStep 25. `parQuality` and `hotStep` removed.
- src/game/goals.ts (new): `tierFor`, `tierName`, `nextGoal`, best-medal storage.
- src/systems/DeliverySystem.ts: `tally` (breakdown in points and seconds). Street multiplier and par pause removed. Par from config.
- src/systems/Slipstream.ts: intro speed floor. `hotPoints` stays at 0 for older scripts.
- src/systems/AudioSystem.ts: `medal(tier, delay)` fanfare.
- src/game/Game.ts: medal tracking and moment (`checkMedal`), game-over summary, best medal, diagnostics `goals` and `breakdown`. New test hooks, added only: `__GAME__.externalClock(on)` (only `advance` moves the game, fully deterministic) and `__GAME__.tune(patch)` (patch tunables for builder sims). Existing hooks are unchanged.
- src/ui/Hud.ts: `setBest(best, bestTier)` with the title medal row, `setGoal`, `medalPop`, `showOver(summary)`.
- index.html: HUD goal row, medal banner, title medal row, new game-over card (the `#over-screen` and `#again-button` ids are kept).
- src/styles.css: medal discs, goal row, banner, title row, game-over card, phone layout. The old `.over-stats` styles are removed.
- src/vite-env.d.ts: diagnostics and hook types.
- Not touched: the bloom clamps in src/entities/ObjectiveMarker.ts, flight, crash rules, the headwind.

## Numbers

Scripts: progress/round-8/critic-scripts copied to progress/round-9/. Only the output folder changed (`./builder-shots/`). Dev server on 5188. The real-time scripts ran one at a time (tools/rt-batch.sh). Logs are in progress/round-9/logs/.

| Test | Needed | Result | Pass |
|---|---|---|---|
| Lazy pilot medal (bp-lazy, real time) | Bronze or none | 1,728 Bronze / 816 none / 1,141 Bronze | yes |
| Standard low medal (rp-low) | Silver or better in 2 of 3 | 3,553 Silver / 1,792 Bronze / 2,537 Silver | yes |
| High medal (rp-high) | Silver or better in 2 of 3 | 5,524 Gold / 4,078 Silver / 5,421 Gold | yes |
| No bot at Ace | below 7,500 | best real-time 5,524, best sim 6,859 | yes |
| Breakdown sums to score | every run | diagnostics: 12 of 12 sim runs (4 pilots × 3 seeds). DOM rows and shown score: 10 of 10 runs that reached game over (2 high runs hit the 150 s script cap first) | yes |
| Medal passes counted | each pass | `goals.passes` = medal tier in 12 of 12, with times in `passList` | yes |
| Hand-fly desktop: first payout after first draft / chain x2 | 10 s / 50 s | draft 4.0 s, payout 5.2 s (**1.2 s**), x2 at 20.3 s | yes |
| Hand-fly mobile (iPhone 13 held sideways, touch) | 10 s / 50 s | draft 4.1 s, payout 5.7 s (**1.6 s**), x2 at 23.5 s | yes |
| Strict slipstream share, standard low | at most 50% | 3,605 / 7,882 = **46%** (direct = strict, hotPoints 0) | yes |
| Lazy / standard low score a minute | at most 0.8 | 978 / 1,665 = **0.59** | yes |
| Hug-probe centre 16.3 / centre 8.9 m/s | at least 1.3 | 475 / 115 = **4.1** (all 3 roads) | yes |
| Hug-probe hug 2.5 m at 16.3 / centre 8.9 | at least 2 | 1,200 / 115 = **10.4** (all 3 roads) | yes |
| Low / high score a minute | at least 0.9 | 1,665 / 2,188 = **0.76** | **NO** |
| High deliveries a minute | at least 2.3 | **2.62** | yes |
| Low crashes a minute | at most 1.5 | **0** | yes |

Wall-offset pilot (sim only): 63% slipstream share. That is a choice of style, not the standard low test.

Regressions:
- **crash-classify-v, all 8 seeds.** 12 m: 603 s, 17 deliveries, 35 charged (3.5/min), **0 hop-like**. 20 m: 737 s, 27 deliveries, 30 charged (2.4/min), **0 hop-like**.
- **Pad lip.** 7 + 2 crashes within 30 m of the target. All are facade hits with tops of 8.8 to 20.2 m, beside street pads at 0.4 m. One is near a rooftop pad (seed 7, 20 m, Bay Lofts, pad 32.5 m): the drone's skids were 4.15 m under the 33 m roof edge, climbing at 2.7 m/s. That is a face hit, just outside the 4 m lip allowance. The crash rules have not changed since round 8. **0 on the pad lip itself.**
- **arrival-metrics, all 8 seeds:** 69 legs, 68 arrived, 1 timeout (seed 91, the known case). Median final approach 3.3 s, 0 stalls in the final 30 m. Marker off screen 1.5%.
- **Flat-frame probe:** 1,002 frames, **0 flat**.
- **`npm run build` passes.** JS 708 KB (+6), CSS 27 KB (+6), HTML 8 KB.
- **Frame time (hand-fly, 80 s):** desktop median 8.30 ms, p95 8.80 ms, max 9.4 ms. Mobile median 8.30 ms, p95 8.90 ms, max 9.4 ms. 0 frames over 20 ms. No page errors. (Round 8: 8.3 / 9.7 ms.)

## Builder tools (progress/round-9/tools/)

- sim.mjs: a deterministic copy of balance-probe-h. It uses `externalClock` with `advance` in 50 ms steps and does no rendering, so a run takes about 5 s. It takes the same env as balance-probe, plus `LINE=high`, `PARAMS` (tune patch), `SHOTS`, `MOBILE`, `CHECK` and `LEGLOG`.
- all.sh: runs the four pilots in parallel.
- rt-batch.sh: runs the real-time scripts in sequence.

## Screenshots (progress/round-9/builder-shots/)

- d-title and m-title show the title medal row.
- d-s22-medal1, d-s22-medal2, m-s22-medal1, m-s22-medal2 and m-s58-medal1 show the medal banner and the HUD goal row.
- d-s22-over, m-s22-over and m-s58-over show the game-over breakdown. On a phone it uses two columns.
- d-h* and m-h* are hand-fly shots. N-alt* are crashes near the target. Q-high-* are high-line crashes.
