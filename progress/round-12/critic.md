# Drone Dash, round 12 critic report

**Verdict:** The round 10 gap is closed. The street line now scores as well as the roof line, and runs are the same length. But the slow clock opened a bigger hole. A pilot who never delivers a parcel can fly up and down one street along a wall, keep the clock frozen, and reach Ace. The delivery game is optional now.

## Round 10 gap (medals pay the roof line): closed

Dev server port 5188. Same bots as rounds 9 and 10. Scripts are copies in `critic-scripts/`. Only the output folder changed. It is a relative path, so no edit was needed. I set SIMT to 600 to give long runs room. No run hit that limit.

| Check | Needed | Result | Pass |
|---|---|---|---|
| Low total / high total | at least 0.85 | run A 14,220 / 13,443 = **1.06**. Run B 11,974 / 13,443 = **0.89**. Mean 0.97 (round 10: 0.54) | Yes |
| Low Silver | 3 of 3 | 3 of 3 in both runs | Yes |
| Low Gold | at least 1 | run A 2 (seeds 22, 130), run B 1 (seed 22) | Yes |
| High Silver | at least 2 of 3 | 3 of 3 (5,655 Gold, 4,078 Silver, 3,710 Silver) | Yes |
| No bot reaches Ace | none | route bots: none (best 6,522). **But the medal-journey pilot reached Ace on desktop (8,834).** The farm bot reached Ace in 6 of 8 tries (below) | Partly |
| Lazy pilot | Bronze or below | 1,728 / 696 / 1,141, rerun 1,723 / 721 / 1,141. Bronze at most | Yes |
| Breakdown exact | every run | diagnostics and game-over DOM add up in 9 of 9 bot runs and both journeys | Yes |
| Slipstream share of low score | at most 50% | 42% (A), 41% (B) | Yes |
| Run length | none over about 4 min | low 91 to 164 s, high 119 to 155 s, lazy 65 to 82 s, desktop journey 193 s. Farm runs up to **312 s** | Bots yes, farm no |

Per seed, low run A / run B (spread):
- Seed 22: 6,522 Gold / 6,382 Gold (140 apart). 162 s / 160 s.
- Seed 58: 1,792 Silver / 1,837 Silver (45 apart). 91 s / 94 s.
- Seed 130: 5,906 Gold / 3,755 Silver (2,151 apart). 164 s / 135 s. One extra delivery made the difference.
- Lazy: seed 22 1,728 / 1,723, seed 58 696 / 721, seed 130 1,141 / 1,141.

Why it closed: low runs now last as long as high runs. On seed 22 the low clock got 74 s from drops and 38 s from the slipstream. The high line got 2 to 7 s from the slipstream.

## Medal band margins

Medal lines: Bronze 1,000, Silver 1,775, Gold 4,500, Ace 7,500.

| Run | Score | Nearest line | Margin |
|---|---|---|---|
| Low seed 58, A / B | 1,792 / 1,837 | Silver | **+17 / +62** |
| Lazy seed 22, A / B | 1,728 / 1,723 | Silver | **-47 / -52** |
| Low seed 130 B | 3,755 | Gold | -745 |
| High seed 58 | 4,078 | Gold | -422 |
| High seed 130 | 3,710 | Gold | -790 |
| Low seed 130 A | 5,906 | Gold | +1,406 |
| High seed 22 | 5,655 | Gold | +1,155 |
| Low seed 22, A / B | 6,522 / 6,382 | Ace | -978 / -1,118 |
| Lazy seed 130 | 1,141 | Bronze | +141 |

The Silver line is a problem. The lazy pilot's best (1,728) and the routed street pilot on seed 58 (1,792) are only 64 points apart. Silver sits between them. One slip payout more or less (45 to 145 points) flips either result. The line was set to fit one bot run. The config comment says so too.

## Frozen clock

- **Readable: yes.** The timer gets a teal ring and glow. A pill under it says "CLOCK FROZEN" or "CLOCK X0.1". It is 13 px tall with 10 px text on both desktop and iPhone 13 held sideways. On the phone it reads well. On desktop it is small but clear because of the teal glow (`d-clock-hug-cruise.jpg`, `m-clock-hug-cruise.jpg`, `m-j22-h05-low-payout-chain.jpg`).
- **How strong it is** (desktop probe, 0 deliveries): crawl at the street centre: clock at full speed. Centre at cruise: about x0.1 to x0.4. Wall hug at cruise: **frozen** (0.02 s lost a second).
- **Fair and fun in a normal run: mostly yes.** A routed street pilot gets 14 to 44 s of clock from it over a run. Runs end at 1:31 to 2:44. The last-10-s music still arrives in every run. Drafting now feels like it earns time, which suits the game.
- **Tension: removed in the wrong case.** At 0 deliveries the clock freezes fully. Only deliveries shrink the effect (by 3.5% each, down to 55%). So the way to keep the clock frozen is to never deliver.
- **Farming: yes.** See the biggest gap below. Runs are not endless, because each U-turn leaks a few seconds. But they reach 5:12, and the score has no ceiling short of Ace.
- **Is the street line the medal chaser's line now?** Yes, and too much so. The best "street line" does not deliver at all.

## Whole game, as a player

- **First 10 seconds.** Strong. A warm golden-hour city, a clear title with the medal ladder, a sound prompt. The tagline now says that the slipstream slows the clock.
- **Onboarding.** Good. First payout 3.4 s after the first draft on desktop (7.3 s into the run) and 3.9 s on touch (8.2 s).
- **Core loop.** In a normal run, pick up, deliver and draft now support each other well. The frozen clock tells you that flying low and close is right. The weak point: the loop stops needing parcels once you know the trick.
- **Game feel.** Still the best part. Momentum, bank and fair crashes.
- **Art.** Coherent, warm, finished low-poly.
- **Audio.** Adaptive music works. Chain 0 to 3+ goes from intensity 0.36 to 0.85 and layers 1 to 4. The final section starts at 9.96 to 9.97 s left. 0 late notes, 0 resyncs.
- **UI.** Clean. The clock badge fits the style. On mobile the payout pop ("+70, SLIPSTREAM CHAIN X2, CLOCK +1S") still sits on top of the drone.
- **Difficulty curve and run length.** Runs are 1:30 to 2:45, and the clock arc works. The play itself still does not change during a run.
- **Game over and restart.** Clear breakdown, plus a nice "clock story" line ("50 s start +74 s drops +38 s slipstream"). Fly again to control: 68 ms desktop, 23 ms touch.
- **Replay pull.** Good for most players. Weak for a skilled one: the desktop journey pilot got Ace on its first full run. The card then says "Top medal. Nothing left but your best."

## Single biggest remaining gap: the slow clock pays you not to deliver

A wall hug at cruise freezes the clock. It also pays a slip payout every 1 to 2 s, up to 145 points each at chain 5. Nothing in it needs a parcel, and not delivering keeps the freeze at full strength. The best way to score is to hug one long street, turn around at the end, and repeat. A medal chaser will find this: the timer literally says "CLOCK FROZEN" while you hug a wall.

Evidence: a new deterministic bot, `farm-probe.mjs`. It never picks up or delivers. It flies one street at 7 m, 2.5 m (or 4 m) from a facade, at up to 15 m/s. At each end it makes a careful U-turn: brake, turn in place, go.

| Seed | Street, offset | Run length | Score | Medal | Clock from slipstream | Clock frozen |
|---|---|---|---|---|---|---|
| 22 | x 66, 6.5 m | 172 s | 10,480 | Ace | 122 s | 65% of the run |
| 22 | x -22, 6.5 m | **312 s** | **21,935** | Ace | 261 s | 80% |
| 22 | x 66, 5 m | 260 s | 15,990 | Ace | 210 s | 74% |
| 58 | x 66, 6.5 m | 202 s | 13,380 | Ace | 152 s | 71% |
| 58 | x 22, 5 m | 125 s | 5,695 | Gold | 75 s | 52% |
| 130 | x 66, 6.5 m | 91 s | 3,310 | Silver | 41 s | 40% |
| 130 | x 22, 6.5 m | 270 s | 18,890 | Ace | 219 s | 78% |
| 130 | x -66, 6.5 m | 174 s | 10,770 | Ace | 124 s | 67% |

All with 0 deliveries and 0 crashes. The best routed street bot scores 6,522 in 162 s. The farm beats it in 6 of 8 tries and lasts up to 5:12. A lap around a block (`farm-loop.mjs`) did worse (3,250 Silver, 2 crashes), so the long straight is the exploit. The hand-fly street pilot also reached Ace: 8,834 in 3:13, with 52 s of clock from the slipstream. So one good normal run can now reach the top medal.

**Acceptance test** (dev server 5188, `farm-probe.mjs` with the 8 seed, street and offset rows above, SIMT 600):
1. No farm run reaches Gold (4,500). No farm run lasts over 150 s.
2. With 0 deliveries, the slipstream adds at most 20 s of clock in any farm run.
3. The round 10 test still passes on seeds 22, 58, 130. Low total is at least 0.85 of high. Low gets Silver 3 of 3 and Gold at least once. High gets Silver at least 2 of 3. Lazy gets Bronze at most. No route bot gets Ace. The breakdown is exact.
4. `medal-journey.mjs` on desktop and mobile stays below Ace.
5. Every medal line sits at least 150 points from every bot result in this set (seeds 22, 58, 130, two runs each).

Options (not tested): run the slow clock only while carrying a parcel, or cap it per leg (for example 10 s of clock per pickup).

## Other gaps (ranked)

1. **The Silver line is set to one bot run.** The routed seed 58 run clears it by 17 to 62 points. The lazy best misses it by 47 to 52 points. Test: rule 5 above.
2. **Ace is reachable in a normal good run.** Hand-fly street pilot: 8,834 on seed 22. After the farm fix, check that Ace still needs a near-perfect run. Test: medal-journey below Ace on desktop and mobile, two runs each.
3. **Same run, very different result.** Seed 130 low: 5,906 Gold and then 3,755 Silver with the same bot. One more delivery is worth about 2,000 points through the combo. That is fine for skill, but it means the medal often depends on one parcel. Watch it after the farm fix.
4. **Mobile payout pop covers the drone.** The pop and its tag ("SLIPSTREAM CHAIN X2 · CLOCK +1S") sit on the drone and the street ahead. Test: in a full touch run the pop never overlaps the drone's screen box.
5. **The clock badge is small on desktop.** 10 px text on a 1280x720 screen. Test: the badge text is at least 12 px on desktop.

## Regressions: none found

- **Lazy / standard low, score a minute** (at most 0.8): 984 / 1,947 = **0.51** (run A 0.48, run B 0.53).
- **Hug probe** (seed 22, roads -22, 22, 66): centre at cruise / centre at 9 m/s = 475 / 115 = **4.1** (needed 1.3). Hug at cruise / centre at 9 m/s = 1,200 / 115 = **10.4** (needed 2). Same as round 9.
- **First payout:** desktop 3.4 s after the first draft, mobile 3.9 s. Both under 10 s.
- **Crash-classify, 8 seeds:** 12 m: 782 s, 25 deliveries, 44 charged, **0 hop-like**. 6 near the target, all street pads (0.4 to 0.5 m), all building faces with tops of 7.4 to 20.2 m. **0 on a pad lip.** 20 m: 766 s, 29 deliveries, 34 charged, **1 hop-like**: seed 130 at 33.2 s. The drone was at 20.2 m, hit a face whose top is 33 m, lost 8 m/s from 15.9, and rose 1.3 m after. The wall top was 12.8 m above it, so this is a real wall hit, not a ledge hop. 4 near target, all street pads, building faces, **0 on a pad lip.**
- **Flat-frame probe:** 1,071 frames, **0 flat**.
- **Music:** still adaptive (see Audio above). Fanfare 13.5 to 17.5 dB above the ducked music.
- **Page errors:** 0 desktop, 0 mobile.

## Performance

Headless Chromium caps at 120 Hz (8.3 ms).
- Desktop 1280x720, medal journey (193 s of flight): 23,107 frames, **median 8.30 ms, p95 9.70, max 10.4, 0 over 20 ms**.
- iPhone 13 held sideways, touch: 14,656 frames, **median 8.30, p95 9.90, max 16.7, 0 over 20 ms**.
- Hand-fly: desktop p95 10.0, mobile p95 10.1, 0 over 20 ms.
- First load, production build: **about 0.76 MB** (JS 726 KB, CSS 29 KB, HTML 9 KB). lil-gui (31 KB) loads only with `?debug`. Budget 15 MB: pass.

## Screenshots (progress/round-12/critic/)

- Slow clock badge: d-clock-crawl-centre, d-clock-cruise-centre, d-clock-hug-cruise, and the same with m- (iPhone 13 held sideways). These use the test API, so the title overlay is still fading out in them. That is a capture artifact, not a game bug.
- Farm runs at time-up: F-farm-seed22-road66, F-farm-seed22-road-22, F-farm-seed58-road66, F-farm-seed58-road22, F-farm-seed130-road66, F-farm-seed130-road22, F-farm-seed130-road-66
- Medal journey, desktop seed 22 (Ace): d-j22-h01-title to d-j22-h13-title-after. This includes h10-medal1 to medal3 and h11-over
- Medal journey, mobile seed 22 (Silver): m-j22-h01 to h13
- Hand-fly: d-h01 to d-h08, m-h01 to m-h08
- Medal passes from bots: M-low-*, M-high-*, M-low-c10-* (lazy)
- Crashes: Q-high-*. Near-target crashes: N-alt12-*, N-alt20-*

## Scripts and logs (progress/round-12/critic-scripts/)

Copies of all round 9 and round 10 scripts, plus new ones:
- `farm-probe.mjs`: the no-delivery wall-hug farm (one street, U-turns).
- `farm-loop.mjs`: the same, lapping a rectangle of streets.
- `clock-badge.mjs`: the slow clock badge at three draft levels, desktop and mobile.
- `queue12.sh`: ran the timing-sensitive scripts one at a time.

Logs: m-low-a, m-low-b (music-run, same control logic), m-high, m-lazy-a, m-lazy-b, hug, hf-desktop, hf-mobile, flat, ccv12, ccv20, mj-desktop, mj-mobile, farm-*, badge-d, badge-m, build. Two short farm debug runs (40 and 60 s) ran beside the first low bot run. They used a few seconds of CPU on one of 10 cores.
