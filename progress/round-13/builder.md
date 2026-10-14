# Drone Dash, round 13 builder: the slow clock serves delivering

Status: done inside the 90 minute box (22:07 to 23:10). The farm is closed and every regression check passes. Two checks do not pass on the letter:
- The low/high ratio. It depends on which high pass you compare against (section 4).
- The Silver margin rests on a lazy result that sits on a knife edge (section 5).

## 1. Design

The round 12 slow clock had no limit and no link to the objective. I added two limits. Payouts, crash rules, roof-line flight and drop time are unchanged.

1. **Only on the way.** The slow clock runs only while the drone flies toward its current objective (pickup or drop). The game compares the drone's horizontal velocity with the direction to the target:
   - cos 0.2 or more (within about 80 degrees): full effect.
   - cos -0.1 or less: no effect.
   - In between: a linear ramp.
   - Config: `towardLow`, `towardFull`.
2. **A budget per leg.** Each leg adds at most `clockBudget` = **8 s** of clock.
   - A pickup or a delivery refills the budget to 8 s. It does not stack.
   - A run with no deliveries therefore gets at most 16 s in total: the start budget plus one pickup. A farm that never picks up gets 8 s.
   - Honest pilots never hit the limit. In round 12 the routed street bot used about 3 to 4 s per leg (34 to 38 s over 11 legs on seed 22).
3. The rate (`clockRate` 1), the pace thresholds and the decay per delivery are unchanged. I tried a rate of 1.5 on seed 58 to lift the weak low seed. That run scored 1,542: 11 s more clock, still 2 drops, and one drop was not fast. So I reverted it (`t-low58-r15.log`).

**What the player sees.** The badge on the timer now shows the budget left on the leg:
- "CLOCK FROZEN · 4S" or "CLOCK X0.1 · 5S".
- A good draft that earns no clock shows a muted badge, and the teal ring and glow switch off:
  - "SLOW CLOCK SPENT": the budget is used up.
  - "SLOW CLOCK: WRONG WAY": the drone flies away from the objective.
- Shots: `d-/m-clock-hug-cruise.jpg` and `d-/m-clock-hug-spent.jpg`. The title overlay is still fading in these shots. That comes from the test API, as in round 12.
- The tagline now ends "slows the clock on the way to your next stop."

## 2. Farm acceptance (farm-probe.mjs, farm-loop.mjs, SIMT 600, `farm13.sh`)

| Seed | Road, offset | Run | Score | Medal | Slip clock | Frozen share |
|---|---|---|---|---|---|---|
| 22 | 66, 6.5 | 58 s | 3,375 | Silver | 8.0 s | 12% |
| 22 | -22, 6.5 | 58 s | 4,100 | Silver | 8.0 s | 13% |
| 22 | 66, 5 | 58 s | 3,665 | Silver | 8.0 s | 12% |
| 58 | 66, 6.5 | 58 s | 4,100 | Silver | 8.0 s | 13% |
| 58 | 22, 5 | 58 s | 2,650 | Silver | 8.0 s | 12% |
| 130 | 66, 6.5 | 58 s | 1,965 | Silver | 8.0 s | 11% |
| 130 | 22, 6.5 | 58 s | 3,085 | Silver | 8.0 s | 12% |
| 130 | -66, 6.5 | 58 s | 3,665 | Silver | 8.0 s | 13% |
| loop 22 | 22/66 x -110/110 | 58 s | 1,820 (1 crash) | Silver | 8.0 s | 13% |

- No farm run reaches Gold. The best is 4,100, which is 400 below Gold. **Pass.**
- No farm run lasts over 150 s. The longest is 58 s, against 312 s before. **Pass.**
- With 0 deliveries, the slow clock adds at most 8 s (the limit is 20 s). **Pass.**

**Remaining gap (outside my concern):** a 58 s farm with no delivery still scores Silver from payout points alone. Its best is 4,100, which beats a routed seed 58 street run (1,792). The clock is no longer the problem. The payout points are. One option for the next round: payouts that need a parcel on board, or a payout cap per leg.

The farm logs ran before a change that touched only the HUD text and the Silver line. The game logic is the same, so the numbers stand.

## 3. Route bots (dev server 5188, SIMT 600, one at a time, `queue13.sh`)

| Pilot | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low A (`m-low-a.log`) | 6,252 Gold, 158 s, 34.3 s slip clock | 1,792 Silver, 91 s, 14.5 s | 4,100 Silver, 135 s, 33.5 s | 12,144 |
| Low B (`m-low-b.log`, music-run) | 6,627 Gold, 162 s, 38.2 s | 1,837 Silver, 93 s, 15.6 s | 4,130 Silver, 135 s, 33.4 s | 12,594 |
| High A (`m-high.log`) | 6,834 Gold, 155 s | 4,123 Silver, 119 s | 5,626 Gold, 168 s | 16,583 |
| High B (`m-high-b.log`) | 5,479 Gold, 144 s | 4,078 Silver, 121 s | 3,984 Silver, 148 s | 13,541 |
| Lazy A (`m-lazy-a.log`) | 844, 65 s | 741, 65 s | 1,141 Bronze, 71 s | 2,726 |
| Lazy B (`m-lazy-b.log`) | 844, 65 s | 791, 65 s | 1,141 Bronze, 71 s | 2,776 |

The low line per seed matches round 12:
- Seed 22: 6,382 to 6,522 in round 12, 6,252 to 6,627 now.
- Seed 58: 1,792 to 1,837 in both rounds.
- Seed 130: it swings by one delivery. Round 12 got 3,755 to 5,906. This round got 4,100 to 4,130.

So the budget did not cost honest street runs anything measurable.

## 4. Round 10 test

| Check | Result | Pass |
|---|---|---|
| Low total / high total, at least 0.85 | Against high B (13,541): **0.90 / 0.93**. Against high A (16,583, a strong roof pass with 7 drops on seed 130): **0.73 / 0.76**. Against the mean of both high passes (15,062): 0.81 / 0.84. Against round 12's high pass (13,443): 0.90 / 0.94 | Mixed: high-pass noise, see note |
| Low Silver 3 of 3 | 3 of 3 in both passes | Yes |
| Low Gold at least 1 | 1 in each pass (seed 22) | Yes |
| High Silver at least 2 of 3 | 3 of 3 in both passes | Yes |
| No route bot reaches Ace | Best is 6,834 (high A, seed 22) | Yes |
| Lazy Bronze or below | At most Bronze (1,141) | Yes |
| Breakdown exact | `bdOk` and `domOk` true in all 18 route-bot runs and both journeys | Yes |
| Run lengths | Low 91 to 162 s, high 119 to 168 s, lazy 65 to 71 s | Yes |

Note on the ratio: the high line barely uses the slow clock (1.9 to 6.3 s a run), so my change cannot move it. The two high passes differ by 3,000 points from crashes and drop count alone. The low line is unchanged from round 12. If the critic's next high pass looks like high A, the ratio fails. To close that gap, the street line must get stronger. The Ace margin has no room for that: in round 12, a rate of 1.15 put seed 22 at Ace.

## 5. Medal lines and margins

The lines are now Bronze 1,000, **Silver 1,600** (was 1,775), Gold 4,500 and Ace 7,500. Only Silver moved.

Why it moved: the lazy pilot's seed 22 run now misses its second drop. It gets 0.6 s of slow clock instead of 0.85 s, because the toward gate drops some frames. So it scores 844 instead of 1,728, the same in both passes. That frees room under the worst routed low run.

- Best lazy result: 1,141 = **459 below Silver**. **Pass.**
- Worst standard low result: 1,792 = **192 above Silver**. **Pass.**
- **Risk:** the lazy seed 22 second drop was within about 0.3 s of the time-out in round 12. If a lazy run lands it again, it scores about 1,728. That is 128 above Silver, so the lazy pilot gets Silver in that case. No 150-point line can hold both sides as long as lazy seed 22 and low seed 58 both make exactly 2 drops.

Every bot result and its distance to the nearest medal line:

| Run | Score | Nearest line | Distance |
|---|---|---|---|
| Low A 22 / 58 / 130 | 6,252 / 1,792 / 4,100 | Ace / Silver / Gold | -1,248 / +192 / -400 |
| Low B 22 / 58 / 130 | 6,627 / 1,837 / 4,130 | Ace / Silver / Gold | -873 / +237 / -370 |
| High A 22 / 58 / 130 | 6,834 / 4,123 / 5,626 | Ace / Gold / Gold | -666 / -377 / +1,126 |
| High B 22 / 58 / 130 | 5,479 / 4,078 / 3,984 | Gold / Gold / Gold | +979 / -422 / -516 |
| Lazy A 22 / 58 / 130 | 844 / 741 / 1,141 | Bronze | -156 / -259 / +141 |
| Lazy B 22 / 58 / 130 | 844 / 791 / 1,141 | Bronze | -156 / -209 / +141 |
| Medal journey desktop / mobile | 6,532 / 4,739 | Ace / Gold | -968 / +239 |
| Hand-fly desktop / mobile | 2,818 / 1,708 | Silver | +1,218 / +108 |
| Farm (8 rows) | 1,965 to 4,100 | Silver / Gold | +365 at least / -400 at most |
| Farm loop | 1,820 | Silver | +220 |

- **Medal journey stays below Ace.** Desktop scored 6,532 Gold (round 12: 8,834 Ace). It flew 2:46 = 50 + 74 + 41.6 s, which adds up exactly. Mobile scored 4,739 Gold in 2:20. **Pass.**

## 6. Regressions

| Check | Result | Pass |
|---|---|---|
| Balance: lazy at most 0.8 of standard low | Totals: 2,726 / 12,144 = 0.22. Score a minute: 814 / 1,898 = 0.43 | Yes |
| Hug probe (seed 22, roads -22, 22, 66) | Centre at cruise / centre at 9 m/s = 475 / 115 = **4.13** (needs 1.3). Hug at cruise / centre at 9 m/s = 1,200 / 115 = **10.4** (needs 2) | Yes |
| Hand-fly first payout | Desktop 7.6 s (first draft 3.9 s). Mobile 8.2 s (first draft 4.4 s) | Yes |
| Crash-classify 12 m, 8 seeds | 664 s, 17 deliveries, 39 charged crashes, **0 hop-like**. 7 near a target, all on 0.4 m street pads against building faces with tops of 10.6 to 55.4 m: **0 on a pad lip** | Yes |
| Crash-classify 20 m, 8 seeds | 788 s, 30 deliveries, 31 charged crashes, **0 hop-like**. 2 near a target, both building faces with tops of 10.6 and 20.2 m: **0 on a pad lip** | Yes |
| Flat-frame probe | 1,025 frames, 0 flat | Yes |
| audio.music adaptive (low B, seed 22) | Chain 0: intensity 0.35, layer 1. Chain 1: 0.49, layer 2. Chain 2: 0.66, layer 3, and so on | Yes |
| `npm run build` | tsc and vite pass. JS 727 KB, CSS 29 KB (`build.log`) | Yes |
| p95 frame time (under 12 ms) | Journey desktop 8.9, journey mobile 9.3, hand-fly desktop 9.7, hand-fly mobile 9.8. Max 16.7, 0 frames over 20 ms | Yes |
| Bloom clamps (ObjectiveMarker.ts), debug hooks | Untouched. The diagnostics gained `slipstream.budget` and `slipstream.toward` | Yes |

## 7. Files changed

- `src/game/config.ts`
  - `SLIPSTREAM`: added `clockBudget` 8, `towardLow` -0.1 and `towardFull` 0.2, with the reasons in a comment.
  - `GOALS`: Silver 1,775 to 1,600, with the reason in a comment.
- `src/game/Game.ts`
  - New state: `slipBudget` and `slipToward`, plus `slipTowardTarget()`.
  - The per-frame gain is capped by the budget.
  - The budget refills on every pickup and drop event and resets with the run.
  - The diagnostics expose `budget` and `toward`. `clockGain` is now the gain actually applied.
- `src/ui/Hud.ts`: `setSlowClock(gain, dt, budget, idle)` shows the budget left and the muted "spent" and "wrong way" states.
- `src/styles.css`: the `.timer.spent` muted styles.
- `src/vite-env.d.ts`: the diagnostics types.
- `index.html`: the tagline.

## 8. Process notes

- **A run lost to a source edit.** I edited `Hud.ts` while the first low pass was running. Vite reloaded the page and the bot died. I killed that queue and reran it from scratch. After that, no source file was edited while a timing-sensitive script was running.
- **A commit from another session.** At 22:45 another session committed the working tree (`cc95720`, "Round 13 work in progress"). That happened while the desktop medal journey was running. A commit does not change files, so the run was not affected. Since then the Silver line moved from 1,775 to 1,600. That change is uncommitted. I ran no git commands that change state.
- **Scripts.** All scripts in `builder-scripts/` are copies of the round 12 critic scripts. Their output folder is changed to `../builder-shots/`. `clock-badge.mjs` also adds a "spent" shot and logs the budget and the toward value. New in this round: `farm13.sh` and `queue13.sh`.
- **Shots** are in `builder-shots/`:
  - `F-farm-*`: the farm runs at time-up.
  - `d-/m-clock-*`: the badge.
  - `M-*`: medal passes.
  - `Q-*`: crashes.
  - `N-alt*`: crashes near a target.
  - `d-/m-j22-*`: the medal journeys.
