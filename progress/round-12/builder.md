# Drone Dash, round 12 builder: slipstream feeds the clock

Status: **incomplete. The acceptance test was not finished.** I ran out of time. The code is in, it type-checks and builds. The tuning is not proven. Read section 4 before you trust any number.

## 1. Design

Today every slipstream payout adds 0.5 s. Deliveries add 7 to 20 s. The roof line delivers more often, so its runs last longer and it wins the medals.

New rule: a payout adds clock time by **chain level** and by **pace**.

- Every payout still gives the base **0.5 s**.
- A chained payout adds up to `chainSeconds[chain - 1]` = **0, 3, 3, 3.5, 3.5** s (chain x1 to x5).
- That extra time is scaled by the meter's **pace**: draft metres per second while drafting. This is the same measure as the HUD chevrons. At or below **5** it adds nothing (a slow, centred crawl). From **11** it adds all of it (fast and close to a facade). The result is rounded to half seconds.
- **Budget per delivery:** the slipstream can add at most **10 s** between two drops. The budget shrinks with the run in the same way as the drop time bonus (x0.965 per delivery, floor 0.55). This cap keeps drafting from making a run endless. When the budget is used up, the pop says "time full, deliver".

Measured pace (round 12 PAY logs):

| Pilot | Chain 1 pace | Chain 2+ pace |
|---|---|---|
| Lazy (centre, 10 m/s, no boost) | 1.5 to 5 | 2.8 to 5.1 |
| Standard low bot | 2 to 8.5 | 4 to 14.6, mostly 7 to 14 |

So a lazy pilot gets exactly 0.5 s per payout, the same as before. In the round 12 lazy run every payout paid 0.5 s, and the lazy scores were 1,728, 861 and 1,141. All are Bronze or below, the same as round 10.

What the player sees:

- **Payout pop:** the points, plus the time in teal next to them, for example "+120 +3.5s".
- **Timer:** the "+Ns" by the timer now shows the real amount, for example "+3.5s". Before it always showed "+0.5s".
- **Game over:** the Slipstream row reads "×27 · +37.5 s". The "Flew" line already counted slipstream seconds, and it still adds up exactly.
- **Title tagline:** "Fly fast and low, close to the walls: the slipstream pays points and buys time."

Not changed: crash rules, roof-line flight and headwind, points per payout, medal thresholds, the bloom clamps in `ObjectiveMarker.ts`, and every existing debug hook. New fields in diagnostics `slipstream`: `lastPace`, `lastSeconds`, `legSeconds`, `legCap`.

## 2. Files changed

- `src/game/config.ts`: in `SLIPSTREAM`, added `chainSeconds`, `paceLow`, `paceFull` and `legSeconds`, with comments.
- `src/systems/Slipstream.ts`: tracks draft metres and drafting time for each meter. The payout event now carries `pace`.
- `src/systems/DeliverySystem.ts`: new `clockDecay` getter. This is the existing drop-time decay. The drop bonus now uses it, so drop time is unchanged.
- `src/game/Game.ts`: `slipClock()` and `slipLegCap()`. The budget resets on each delivery and at run start. Pop and timer flash show the real time. New diagnostics fields.
- `src/ui/Hud.ts`: `slipPop(points, chain, seconds, capped)`. New `fmtSec` helper. The over-card Slipstream row shows the seconds.
- `index.html`: new `#slip-pop-time` element inside the pop. Tagline updated.
- `src/styles.css`: `.slip-pop-time` is teal. An empty one is hidden.
- `src/vite-env.d.ts`: types for the new diagnostics fields.

## 3. Scripts

`builder-scripts/` holds copies of the round 9 and round 10 critic scripts. In every copy only the output folder changed (`../builder-shots/`). There are two extra tuning copies, `route-play-rt-x-mp.mjs` and `balance-probe-mp.mjs`. They have the same control logic as the `-m` scripts, plus one `PAY` log line per payout (chain, pace, seconds, budget).

## 4. Numbers (low line, `route-play-rt-x-m(p).mjs`, SIMT 400)

Round 10 baseline: low 3,658 / 1,792 / 2,612 (total 8,062). High 6,789 / 4,078 / 4,124 (total 14,991).

| Try | chainSeconds | pace low / full | budget per delivery | Seed 22 | Seed 58 | Seed 130 | Low total / round 10 high |
|---|---|---|---|---|---|---|---|
| t1 | 0, .5, 1.5, 2.5, 3.5 | 5 / 12 | 15 | 6,367 Gold, 153 s | 1,792 Bronze, 87 s | 3,870 Silver, 128 s | 12,029 = 0.80 |
| t2 | 0, 2, 2.5, 3, 3 | 5 / 11 | 15 | 6,232 Gold, 161 s | 1,907 Bronze, 94 s | (page reloaded, run lost) | n/a |
| t3 | 0, 3, 3, 3.5, 3.5 | 5 / 11 | 15 | (bot stalled, invalid) | 2,795 Silver, 119 s | **9,722 Ace, 239 s** | n/a |
| t4 | 0, 3, 3, 3.5, 3.5 | 5 / 11 | 8 | 6,222 Gold, 161 s | 1,772 Bronze, 93 s | 3,870 Silver, 126 s | 11,864 = 0.79 |
| t5 (in the code now) | 0, 3, 3, 3.5, 3.5 | 5 / 11 | 10, shrinking | 6,277 Gold, 161 s | (page reloaded at 55 s, run lost) | not run | n/a |

Lazy (t1 settings, `balance-probe-mp.mjs` CRUISE=10 NOBOOST=1): 1,728 Bronze (86 s), 861 none (68 s), 1,141 Bronze (74 s). Every payout paid 0.5 s.

The breakdown added up (`bdOk`, `domOk`) in every run that reached game over.

Findings:

- **The pace gate works.** Lazy flight never earns extra time. Fast chained flight earns 2 to 4 s per payout.
- **The result is very sensitive to one extra delivery.** Each delivery also adds 14 to 20 s of drop time and raises the combo. So small changes in slipstream time flip a run between "one more delivery" and "time-up". With a 15 s budget, seed 130 ran 239 s and reached Ace. With an 8 s budget, seed 58 stayed at 2 deliveries and Bronze. The 10 s shrinking budget is a guess between the two and was only measured on seed 22.
- **Seed 58 is the hard case.** There the low bot climbs to rooftop pads. Each climb breaks the chain for 10 to 18 s, so it rarely gets past chain 3. It reached Silver in 1 of 3 tries.
- **Seed 22 is stable:** Gold at about 6,250 in 161 s in every valid run. That is about 1,200 below Ace.
- **Two runs died** with "Execution context was destroyed" and no Vite reload logged. One run stalled at 892 s of wall time. The host clock also jumped about 1.5 hours during the session. I think the machine slept or was throttled. Those runs are not valid.

## 5. Not done

- The full low, high and lazy acceptance on the final settings.
- High line on the new code. I expect little change: high-line payouts are slow chain 1 payouts, so they still get 0.5 s.
- Regressions: balance-probe ratio, hug-probe, hand-fly on desktop and mobile, crash-classify at 12 m and 20 m, flat-frame, music diagnostics, p95 frame time, screenshots.
- Done: `tsc` and `vite build` pass (`builder-scripts/build.log`, built to the scratchpad). The production JS is 726 KB.

## 6. Suggested next step

Run the final settings on seeds 22, 58 and 130 at least twice each, one at a time. If seed 130 goes over Ace, lower `legSeconds` to 9. If seed 58 stays Bronze, the honest options are these:

- (a) Accept "Silver in 2 of 3" for the low line.
- (b) Make chain 2 easier to hold on rooftop legs, through a change to the chain window.
- (c) Retune Silver. Risk: lazy seed 22 sits at about 1,730 against Silver 2,250. A lower Silver can let the lazy pilot reach it.
