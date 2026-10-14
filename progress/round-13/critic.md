# Drone Dash, round 13 critic report

**Verdict:** The slow clock no longer pays you to skip deliveries: farm runs now end in under 65 s. But the score still does. A pilot who never touches a parcel scores Silver every time, and per minute scores about twice as much as a pilot who delivers. The lazy pilot also reached Silver again in one of two passes.

Build tested: the working tree at commit cc95720 plus the uncommitted `src/game/config.ts` change (Silver 1,775 to 1,600). Dev server port 5188. Scripts are copies of round 12 in `critic-scripts/`. Their output folder is the relative `../critic/`, so the copies write here with no edit. New scripts: `smart-farm.mjs`, `clock-badge13.mjs`, `farm8.sh`, `queue13.sh`.

## Round 12 gap (the slow clock paid you not to deliver): closed as written

| Check | Needed | Result | Pass |
|---|---|---|---|
| farm-probe, 8 rows from round 12 | no Gold, none over 150 s | all **Silver**, 1,965 to 4,100. All 58 s long (round 12: up to 312 s and 21,935) | Yes |
| Slow clock with 0 deliveries | at most 20 s | **8.0 s** in every farm-probe row | Yes |
| farm-loop seed 22 | same | 1,820 Silver, 58 s, 8 s of slow clock, 1 crash | Yes |
| My smarter farms (15 runs) | same | best **4,390 Silver in 64 s** (110 below Gold). Most slow clock: **16.0 s** | Yes |

My smarter farms (`smart-farm.mjs`, seeds 22, 58, 130, 0 deliveries in all 21 runs):
- `near`: laps the block that holds the pickup, so it often flies toward the target. 655 to 1,345. Slow clock 4.5 to 7.3 s. The small block and its corners keep the pace down.
- `line`: flies the street through the target toward it, U-turns 15 m short. 1,570 to 2,690. 8 s.
- `pickup`, `pickupline`: teleports onto the pickup at the start (this saves the flight there, so it is an upper bound), then farms. Up to 3,955. Only 8 s of slow clock, because the pickup refills the budget to 8 s and does not stack.
- `spendpickup`: the strongest. It farms a long straight until the start budget is spent, then teleports onto the pickup to refill the budget, then farms again. **16.0 s** of slow clock, 61 to 65 s runs, 1,870 to **4,390**. This matches the code: at most 2 budgets of 8 s with no delivery.

So the clock exploit is gone. The rule works as the builder intended.

What is left: the points. A wall hug at cruise pays a slip payout about every 2 s, up to 145 points each, with no parcel. That is about **3,400 points a minute** on average (8 farm-probe rows, best 4,240). The routed street bot makes **1,900 a minute** and the roof bot **1,850**. On seed 58 both farm rows (2,650 and 4,100) beat both street runs (1,792 and 1,837). The 4,100 row also beats both roof runs (4,078). See the biggest gap below.

## Round 10 test, rerun (seeds 22, 58, 130, SIMT 600, every run twice)

| Run | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low A | 6,532 Gold, 160 s | 1,792 Silver, 92 s | 3,690 Silver, 130 s | 12,014 |
| Low B (music-run) | 6,707 Gold, 166 s | 1,837 Silver, 94 s | 3,915 Silver, 131 s | 12,459 |
| High A | 3,843 Silver, 139 s | 4,078 Silver, 121 s | 5,147 Gold, 163 s | 13,068 |
| High B | 4,007 Silver, 125 s | 4,078 Silver, 119 s | 4,079 Silver, 148 s | 12,164 |
| Lazy A | 618 none | 746 none | 1,141 Bronze | 2,505 |
| Lazy B | **1,728 Silver** | 696 none | 1,141 Bronze | 3,565 |

Spread between passes: low 175 / 45 / 225. High 164 / 0 / **1,068**. Lazy **1,110** / 50 / 0.

| Check | Needed | Result | Pass |
|---|---|---|---|
| Low / high total | at least 0.85 | A/A 0.92, A/B 0.99, B/A 0.95, B/B 1.02 | Yes |
| Low Silver | 3 of 3 | 3 of 3, both passes | Yes |
| Low Gold | at least 1 | 1 (seed 22), both passes | Yes |
| High Silver | at least 2 of 3 | 3 of 3, both passes | Yes |
| No route bot at Ace | none | best 6,707 | Yes |
| Lazy | Bronze or below | **pass B seed 22: 1,728 Silver** (2 drops). Pass A: 618 (1 drop) | **No** |
| Breakdown exact | every run | diagnostics and game-over card add up in 18 of 18 runs and both journeys | Yes |
| Medal journey | below Ace | desktop 7,107 Gold (393 short of Ace), mobile 3,513 Silver | Yes |

The builder lowered Silver to 1,600 because one lazy run missed its second drop (844). The lazy pilot on seed 22 is a coin flip: one drop gives 618 to 844, two drops give 1,728. Round 12 also saw 1,728 twice.

## Medal margins

Lines: Bronze 1,000, Silver 1,600, Gold 4,500, Ace 7,500.

| Run | Score | Nearest line | Margin |
|---|---|---|---|
| Lazy B seed 22 | 1,728 | Silver | **+128** (needed: at least 150 below) |
| Lazy seed 130, both | 1,141 | Bronze | +141 |
| Low seed 58, A / B | 1,792 / 1,837 | Silver | +192 / +237 (needed at least +150: pass) |
| Lazy seed 58, A / B | 746 / 696 | Bronze | -254 / -304 |
| Lazy A seed 22 | 618 | Bronze | -382 |
| Medal journey, desktop | 7,107 | Ace | **-393** |
| High seed 130 B | 4,079 | Gold | **-421** |
| High seed 58, A / B | 4,078 / 4,078 | Gold | **-422** |
| High seed 22 B | 4,007 | Gold | -493 |
| Low seed 130 B | 3,915 | Gold | -585 |
| High seed 22 A | 3,843 | Gold | -657 |
| High seed 130 A | 5,147 | Gold | +647 |
| Low seed 22, B / A | 6,707 / 6,532 | Ace | -793 / -968 |
| Low seed 130 A | 3,690 | Gold | -810 |
| Smart farm, best | 4,390 | Gold | **-110** |

The margin rule fails, and no line can pass it. The best lazy run (1,728) and the worst standard street run (1,792) are only **64 points apart**. A line with 150 points on each side needs a gap of 300. Moving Silver again will not fix this.

Many runs sit within a single delivery of a line. A drop is worth about 300 to 600 with its fast bonus and combo. These runs are: lazy seed 22 B (its second drop made Silver), lazy seed 130, and both low seed 58 runs. Also four high runs short of Gold by 421 to 493, and the desktop journey short of Ace by 393. One parcel decides nearly every medal.

## Clock rule readability

Shots: `d-badge13-*`, `m-badge13-*` (test API, title overlay faded first), and real play in `d-j22-h05-low-payout-chain.jpg`, `m-j22-h05-low-payout-chain.jpg`.

- **What the badge says.** "CLOCK FROZEN · 7S" while drafting toward the target. "SLOW CLOCK SPENT" in muted white after 8.0 s of use. "SLOW CLOCK: WRONG WAY" about 1 s after you turn away. All three switch at the right time.
- **Mobile (iPhone 13 held sideways):** readable. The dark pill sits on the timer's lower edge.
- **Desktop 1280x720:** still **9.9 px text, 13 px tall**. If you look for it in real play, you can read it. You will not notice it change while you fly. In the test-API shots the top of the text sits under the timer's edge.
- **Too many seconds on screen.** Look at one frame. The timer says 0:31. The badge says 7S (budget left). The payout pop says "CLOCK +2S" (clock gained). That is three numbers in seconds near the top centre, with three meanings. Nothing explains that the 7S is a budget that a pickup or drop refills.
- **Fair or fussy?** Fair in effect. An honest street pilot still banks 14 to 42 s of slow clock a run (round 12: 14 to 44 s), so normal play barely changed. "WRONG WAY" is fair: on a street grid an honest route almost never heads away. But it is fussy to read. The rule now has a direction test, a pace test and a per-leg budget, and the only tutorial is a 40-word tagline. A player feels one thing: "when I fly low, the clock sometimes stops". That is enough. The badge text adds little.

## Whole game, as a player

Compared with the best polished indie arcade flying and delivery games I know.

- **First 10 seconds.** Strong. A warm golden-hour city seen from above, a bold logo, the medal ladder, a sound prompt. The tagline is now three sentences of rules. Good games say one verb here.
- **Onboarding.** Good in action. The first payout came 3.2 s after the first draft on desktop (7.1 s into the run) and 4.0 s on touch (8.4 s). The hint "Faster & closer to walls fills it faster" shows at the right moment. Weak in words: medals, combo, fast drops, chain, hug, boost, slow clock, budget and wrong way are all live in the first run.
- **Core loop.** Pick up, fly, drop, keep the combo, draft on the way. If you play it straight, it works. But the two halves pay separately, and the drafting half pays more. A player who learns that hugging a wall beats delivering stops playing a delivery game.
- **Game feel.** Still the best part: momentum, bank, a camera that leans, fair crashes with a clear "-3s".
- **Art.** Coherent, warm, finished low-poly. The city is the same city on every page load (default seed 7). Within a session the parcel order changes, but the streets do not.
- **Audio.** Adaptive and clean. Chain 0 to 3 goes from intensity 0.34 to 0.85 and from 1 to 4 layers. The final section starts at 9.96 to 9.99 s left. 0 late notes, 0 resyncs, 0 errors.
- **UI.** Clean and on-style. The payout pop still sits on the drone, on desktop and on touch.
- **Difficulty curve and run length.** Runs last 1:30 to 2:50 for good pilots and about 1:05 for a lazy one. That is a good arcade length. Nothing changes inside a run except leg distance: no new hazard, no traffic in the air, no rush hour, no weather.
- **Game over and restart.** Clear. The card adds up exactly and tells the clock story ("50 s start +74 s drops +43.4 s slipstream"). "Fly again" is quick.
- **Replay pull.** Medals and best score. That pull depends on the medals meaning something, and today Silver goes to a pilot who never delivers.

## Single biggest remaining gap: score does not need parcels

**The concern.** Slipstream payouts score on their own, with or without a parcel. A tight wall hug at cruise pays 45 to 145 points about every 2 s. Deliveries pay about 300 to 600 each, every 25 to 35 s. So the best way to score per minute is to hug a wall and ignore the parcels. The round 13 fix capped the clock that drafting buys. It did not touch the points.

**Evidence (this round, dev server 5188):**
- farm-probe, 8 rows, 0 deliveries: **Silver 8 of 8**, 1,965 to 4,100 in 58 s. About 3,400 points a minute on average, 4,240 at best.
- smart-farm spendpickup, 0 deliveries: up to **4,390, 110 short of Gold**.
- Routed bots that deliver: street 1,897 to 1,917 a minute, roof 1,845 to 1,857 a minute. The farm scores **1.8 to 2.2 times** as much per minute.
- On seed 58 the farm (2,650 to 4,100) beats both street runs (1,792, 1,837).
- The same split breaks the medal ladder from below. The lazy pilot and the street pilot sit 64 points apart. Both earn a large share of their score from payouts that do not depend on delivering well. No Silver line can sit 150 points from both.
- Slipstream is 42 to 48% of a street run's score (2,570 of 6,532, 1,875 of 3,915).

**Why it matters most.** Thirteen rounds tuned lines and rates around this split. Each fix moves the hole. While drafting pays separately from delivering, the medals measure wall hugging as much as courier play. This is the one gap that stops the core loop from being one loop.

**A direction (not tested).** Make drafting pay through the parcel. For example, slip payouts on a leg go into a "tip" on the carried parcel, shown on the parcel or the objective pill. The tip is paid on delivery, multiplied by the combo. If time runs out, the tip is lost. Payouts can still refill boost at once, so drafting still feels good right away. With no parcel, drafting gives boost only.

**Acceptance test** (dev server 5188, SIMT 600, the scripts in `critic-scripts/`):
1. Every 0-delivery run scores under **1,000** (Bronze): farm-probe (all 8 round 12 rows), farm-loop seed 22, smart-farm `near`, `line`, `pickupline` and `spendpickup` on seeds 22, 58 and 130.
2. A 0-delivery farm scores at most **0.5 times** the standard low bot's points a minute.
3. The round 10 test passes in two passes each. Low / high total at least 0.85. Low Silver 3 of 3 and Gold at least 1. High Silver at least 2 of 3. Lazy Bronze or below. No route bot at Ace. Breakdown exact.
4. The best lazy run and the worst standard low run are at least **300 points apart**, and Silver sits at least 150 points from both.
5. hug-probe still pays a wall hug at least 2 times the centre at 9 m/s. The first payout still comes within 10 s of the first draft, on desktop and on touch.
6. medal-journey stays below Ace on desktop and mobile.

## Other gaps (ranked)

1. **The lazy pilot reaches Silver.** 1,728 on seed 22 in one of two passes, with 0.8 s of slow clock. Silver was moved to 1,600 to fit a lazy run that missed a drop. Test: lazy Bronze or below in two passes (item 3 and 4 above).
2. **The city is the same on every load, and a run never changes.** Default seed 7. No escalation inside a run. Test: a fresh page load gives a different layout or district at least 2 times in 3. A daily city with its own best also passes. Something new appears in the second minute of a run in 3 of 3 bot runs. Examples: traffic drones, a rush-hour headwind, a moving pickup.
3. **Three "seconds" numbers at the top of the screen.** Timer, budget badge and "CLOCK +2S" in the payout pop. The desktop badge is 9.9 px. Test: badge text at least 12 px on desktop. In a full hand-fly run, at most one seconds figure other than the timer is on screen at any time.
4. **The payout pop sits on the drone.** Desktop and touch, see the h05 shots. Test: in a full run on both, the pop never overlaps the drone's screen box.
5. **One parcel decides most medals.** 10 of 20 bot and journey results sit within one delivery of a line. High seed 130 moved 1,068 points between passes. Test: after the scoring fix, at most 3 of the 18 bot runs within 300 points of a line.

## Regressions: none found

- **Lazy / standard low, score a minute** (at most 0.8): pass A 748 / 1,897 = **0.39**, pass B 986 / 1,917 = **0.51**.
- **Hug probe** (seed 22, roads -22, 22, 66): centre at cruise / centre at 9 m/s = 475 / 115 = **4.1** (needed 1.3). Hug at cruise / centre at 9 m/s = 1,200 / 115 = **10.4** (needed 2). Same as round 12.
- **First payout:** desktop 3.2 s after the first draft (7.1 s into the run). Mobile 4.0 s after (8.4 s). Both within 10 s.
- **Crash-classify, 8 seeds (11, 22, 33, 44, 7, 58, 91, 130):**
  - 12 m: 587 s of flight, 13 deliveries, 35 charged crashes, **0 hop-like**. 4 near the target, all at street pads (0.4 m), all building faces with tops of 7.4 to 13.8 m. **0 on a pad lip.** Flight time fell from 782 s, because this bot flies at 12 m and gets less slow clock now.
  - 20 m: 784 s, 30 deliveries, 34 charged, **1 hop-like**: seed 130 at 34.7 s. The drone was at 20.3 m, hit a face whose top is 33 m, lost 11.2 m/s and rose 0.9 m. The wall top was 12.7 m above it, so it is a real wall hit. It is the same case as round 12. 2 near the target, street pads, faces of 10.6 and 20.2 m, **0 on a pad lip.**
- **Flat-frame probe:** 872 frames, **0 flat**, 0 errors.
- **Music:** adaptive (see Audio). Seed 130 had 5 of 2,917 steps with no music, at time-up. 0 late notes, 0 resyncs.
- **Page errors:** 0 on desktop and mobile.

## Performance

Headless Chromium caps at 120 Hz (8.3 ms).
- Desktop 1280x720, medal journey (167 s of flight): 20,021 frames, **median 8.30 ms, p95 9.80, max 10.5, 0 over 20 ms**.
- iPhone 13 held sideways, touch, medal journey: 14,703 frames, **median 8.30, p95 9.80, max 10.4, 0 over 20 ms**.
- Hand-fly: desktop 9,578 frames, p95 9.80, max 10.4. Mobile 9,580 frames, p95 9.70, max 10.5. 0 over 20 ms.
- First load, production build (built to a scratch folder): **about 0.76 MB** (JS 727 KB or 197 KB gzipped, CSS 29 KB, HTML 9 KB). lil-gui (31 KB) loads only with `?debug`. Budget 15 MB: pass.

## Screenshots (progress/round-13/critic/)

- Clock badge, round 13 states: d-badge13-toward-2s, d-badge13-toward-12s-spent, d-badge13-away-3s-wrongway, and the same with m- (iPhone 13 held sideways).
- Farm runs at time-up: F-farm-seed22-road66, F-farm-seed22-road-22, F-farm-seed58-road66, F-farm-seed58-road22, F-farm-seed130-road66, F-farm-seed130-road22, F-farm-seed130-road-66.
- Smart farms: S-smartfarm-{near, line, pickup, pickupline, spendpickup}-seed{22, 58, 130}. These use manual rendering, so the frame can be stale.
- Medal journey, desktop seed 22 (Gold, 7,107): d-j22-h01-title to d-j22-h13-title-after, with h10-medal1 to medal3 and h11-over.
- Medal journey, mobile seed 22 (Silver, 3,513): m-j22-h01 to h13.
- Hand-fly: d-h01 to d-h08, m-h01 to m-h08.
- Medal passes from bots: M-low-*, M-high-*, M-low-c10-* (lazy). M-low-c10-seed22-pass2 is the lazy Silver.
- Crashes: Q-high-*. Near-target crashes: N-alt12-*, N-alt20-*.

## Scripts and logs (progress/round-13/critic-scripts/)

- Copies of all round 12 scripts. Unchanged, because their output folder is relative.
- New: `smart-farm.mjs` (MODE near, line, pickup, pickupline, spendpickup, straight), `clock-badge13.mjs`, `farm8.sh` (8 farm rows and farm-loop), `queue13.sh` (every timing-sensitive script one at a time).
- Logs: farm-*, farmloop-22, smart-*, m-low-a, m-low-b, m-high-a, m-high-b, m-lazy-a, m-lazy-b, hug, hf-desktop, hf-mobile, flat, ccv12, ccv20, mj-desktop, mj-mobile, badge13-d, badge13-m, queue13.
- The deterministic probes (farms, hug, crash-classify, badge) ran before or after the real-time queue, never during it.
