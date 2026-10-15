# Drone Dash: round 14 critic report

**Verdict:** The street bonus fixes the score. A pilot who never delivers now scores 0. Every gate in the round 13 test passes. The lazy pilot sits 800 points under the worst street run. Balance is no longer the problem. The problem now is that every run is the same run. Every load gives the same city and the same first pickup, and nothing new happens inside a run.

Build tested: the working tree at commit cf22239 plus the uncommitted round 14 changes (street bonus, Silver 1,650, Ace 8,500). Dev server port 5188. Scripts are copies of round 13 in `critic-scripts/`. Their output folder is the relative `../critic/`, so the copies write here with no edit. New scripts: `farms14.sh`, `capfarm.mjs`, `capfarm.sh`, `hug-probe-uncap.mjs`, `queue14.sh`, `variety-probe.mjs`.

## Round 13 gap (the score did not need parcels): closed

| Check | Needed | Result | Pass |
|---|---|---|---|
| 1. Every 0-delivery run under 1,000 | farm-probe 8 rows, farm-loop, smart-farm near, line, pickup, pickupline, spendpickup on 22, 58, 130 | **0 in all 30 runs**. Runs last 51 to 65 s. Payouts still happen (9 to 32 a run), but the bank is never paid | Yes |
| 2. Farm at most 0.5 times the street bot a minute | | 0-delivery farms: **0 a minute**. Street bot: 2,070 (pass A) and 2,097 (pass B) a minute | Yes |
| 3. Round 10 test, two passes | see below | passes in both passes | Yes |
| 4. Lazy vs street gap at least 300, lines 150 clear | | best lazy **1,249**, worst street **2,049**: gap **800**. Silver 1,650 sits 401 above and 399 below | Yes |
| 5. Wall hug and first payout | hug at least 1.3 and 2 times, first payout within 10 s | 35 and 106 times (leg cap lifted). First payout 7.5 s desktop, 8.5 s touch | Yes |

### New farm aimed at the new rules (`capfarm.mjs`, deterministic, 600 s cap)

A routed street pilot that does deliver. In `carry` mode it picks up the parcel. Then it laps its street 2.5 m off the facade until the leg's bank is full. Then it delivers. In `both` mode it also fills the bank on the way to each pickup. `honest` is the same pilot with no farming.

| Seed | honest | carry (farm with parcel) | both (farm both legs) |
|---|---|---|---|
| 22 | 6,881 Gold, 166 s, **2,489 a min** | 2,716 Silver, 106 s, 1,531 a min | 1,483 Bronze, 83 s, 1,071 a min |
| 58 | 2,071 Silver, 92 s, **1,357 a min** | 1,091 Bronze, 77 s, 851 a min | 1,655 Silver, 81 s, 1,233 a min |
| 130 | 4,641 Gold, 135 s, **2,068 a min** | 0, 59 s (clock ran out farming) | 0, 60 s (same) |
| All | **2,081 a min** | 944 a min (**0.45**) | 843 a min (**0.41**) |

Against the real-time street bot (2,070 to 2,097 a minute), the farms make 0.40 to 0.46 times as much. Farming loses for three reasons. The clock keeps running while you circle. The drop is late, so you lose the fast bonus and the combo. A full bank that misses its drop is lost (1,244 to 1,831 points in these runs). The closest single case is seed 58 `both`: 0.91 times honest a minute, and it reached Silver by 5 points with one drop. That is a slower, worse run, not an exploit. I did not build a "nearest pair" farm: the game picks the next pickup and drop, so a player cannot choose short pairs. Very short legs bank at least 150, which an honest pilot also gets.

## Round 10 test (seeds 22, 58, 130, SIMT 600, every run twice)

| Run | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low A | 6,741 Gold, 159 s | 2,049 Silver, 91 s | 4,455 Silver, 134 s | 13,245 |
| Low B (music-run) | 6,894 Gold, 161 s | 2,111 Silver, 94 s | 4,451 Silver, 130 s | 13,456 |
| High A | 4,683 Gold | 4,068 Silver | 4,816 Gold | 13,567 |
| High B | 4,020 Silver | 4,097 Silver | 4,163 Silver | 12,280 |
| Lazy A | 1,249 Bronze, 2 drops | 509 none, 1 drop | 0, 0 drops, 51 s | 1,758 |
| Lazy B | 1,212 Bronze, 2 drops | 573 none, 1 drop | 621 none, 1 drop | 2,406 |

- Low / high total: A/A 0.98, A/B 1.08, B/A 0.99, B/B 1.10 (needed 0.85). Pass.
- Low Silver 3 of 3 and Gold on seed 22, both passes. High Silver 3 of 3 both passes. No bot at Ace (best 6,894). Lazy Bronze or below in both passes. Pass.
- Breakdown exact: diagnostics and game-over card add up in 18 of 18 runs and both journeys.
- Street bonus share of a low run: 41% (seed 22), 50% (58), 54% (130). The high line drafts little (35 to 339).
- Pass-to-pass spread is small now: low 153 / 62 / 4, high 663 / 29 / 653.

## Margins (lines: Bronze 1,000, Silver 1,650, Gold 4,500, Ace 8,500)

| Run | Score | Nearest line | Distance |
|---|---|---|---|
| Low A / B seed 130 | 4,455 / 4,451 | Gold | **-45 / -49** |
| High A seed 22 | 4,683 | Gold | +183 |
| Lazy B seed 22 | 1,212 | Bronze | +212 |
| Lazy A seed 22 | 1,249 | Bronze | +249 |
| High A seed 130 | 4,816 | Gold | +316 |
| High B seed 130 | 4,163 | Gold | -337 |
| Lazy B seed 130 | 621 | Bronze | -379 |
| Low A seed 58 | 2,049 | Silver | +399 |
| High B seed 58 | 4,097 | Gold | -403 |
| Lazy B seed 58 | 573 | Bronze | -427 |
| High A seed 58 | 4,068 | Gold | -432 |
| Low B seed 58 | 2,111 | Silver | +461 |
| High B seed 22 | 4,020 | Gold | -480 |
| Lazy A seed 58 | 509 | Bronze | -491 |
| Lazy A seed 130 | 0 | Bronze | -1,000 |
| Low B seed 22 | 6,894 | Ace | -1,606 |
| Low A seed 22 | 6,741 | Ace | -1,759 |
| Medal journey, mobile | 4,736 | Gold | +236 |
| Medal journey, desktop | 6,467 | Ace | -2,033 |

The required margins hold (gap 800, Silver 401 / 399). Two notes. Low seed 130 lands 45 and 49 short of Gold in both passes: one clean leg decides it. And Ace at 8,500 is far from every run: the best bot is 1,606 short and the desktop journey 2,033 short.

## Banked bonus readability

Shots: d-h04, d-h05, m-h05, d-j22-h10-medal1, m-j22-h11-over.

- **The pill works.** Desktop: "DELIVER Bookshop · Juniper & 7th Ave **BONUS +55**" in a warm chip at the end of the objective pill. When it grows, it bumps. It sits where your eye already goes for the next stop. Good.
- **The payout pop works.** "+48 BANKED · CHAIN X2" in gold. The word "Banked" tells you the points are not in the score yet.
- **The lump on delivery works, but is soft.** "+553 STREET BONUS PAID" in teal, next to the drop pop. The score jumps from about 1,200 to 1,757 at once. That is the best moment in the new loop. But the pop is semi-transparent, sits on the drone, and fades fast. The score counter does not count up or flash for the lump.
- **Weak spots.**
  - The first payout of a run banks **+7** (desktop and touch hand-fly), the second +48. "+7" after 4 s of careful drafting feels like nothing. A slow, centred line is weighted down to 0.2, which is right for balance and wrong for the first impression.
  - The score reads **0** for the whole first leg (26 s in the desktop hand-fly), while the pill shows a growing bonus. A new player can think that drafting does nothing.
  - On iPhone 13 held sideways, the pill drops the word "Bonus" and shows only "+64" after the street name. Without the label it reads like a distance or a price.
- **Does drafting still feel rewarding in the moment?** Mostly yes. The boost bar refills. The chain adds music layers, from 1 to 4. The camera shakes. The badge reads "CLOCK FROZEN" with a bar that empties. The points themselves now feel like a promise, not a reward. With a hard crash cutting the bank ("bonus -N"), carrying a fat bonus gives real stakes. That is a good change.
- The round 13 "three seconds numbers" problem is gone. The badge now says "CLOCK FROZEN" with a small bar, and the pop no longer says "CLOCK +2S".

## Whole game, as a player

Against the best polished indie arcade flying and delivery games I know.

- **First 10 seconds.** Strong. Golden-hour city from above, bold logo, medal ladder, a sound prompt. The tagline is still three sentences of rules.
- **Onboarding.** Good in action. The first draft comes at 4 s and the first payout at 7.5 s (desktop) or 8.5 s (touch). The hint "Faster & closer to walls fills it faster" shows at the right moment. Weak in words: medals, combo, fast drops, chain, hug, boost, slow clock, budget, wrong way and now the bank are all live in run one.
- **Core loop.** Now one loop. Pick up, draft along the streets to grow the bonus, deliver to cash it, keep the combo. Drafting and delivering finally point the same way. This is the biggest step in many rounds.
- **Game feel.** Still the best part: momentum, banking, a camera that leans, clear crashes with "-3 SEC".
- **Art.** Coherent, warm, finished low-poly. But it is one city, seen the same way every time.
- **Audio.** Adaptive and clean. Chain 0 to 3 goes from intensity 0.35 to 0.86 and from 1 to 4 layers. The final section starts at 9.96 to 9.99 s left. 0 late notes, 0 resyncs, 0 errors.
- **UI.** Clean and on-style. The game-over card adds up and now says "Street bonus paid on 4 drops · 360 lost", which teaches the rule after the fact. The payout pop still sits on the drone.
- **Difficulty curve and run length.** 1:30 to 2:45 for good pilots, about 1:05 to 1:20 for a lazy one. Good length. But the only thing that changes inside a run is that the next pickup can be up to 155 m away instead of 95 m. No new hazard, no traffic in the air, no rush hour, no weather, no new district.
- **Game over and restart.** Clear and quick.
- **Replay pull.** Medals now mean courier skill, which is good. But the next run is the same city, the same first pickup, and the same two minutes. Ace at 8,500 has no visible path: the best run here is 1,606 short.

## Single biggest remaining gap: every run is the same run

**The concern.** The city is fixed and a run never changes. With no `?seed`, every page load builds seed 7: the same 88 sites in the same places, and the first pickup is "Juniper Lofts Rooftop" every time. Inside a run, nothing new appears after the first minute. The best arcade games of this kind change the board: daily routes, new districts, weather, traffic, a rush hour. Or they change the run as it goes. Here, once you have flown the city twice, you have seen the game.

**Evidence (this round):**
- `variety-probe.mjs`: 3 fresh loads with no seed give the **same city fingerprint (4e56fcf3) and the same first pickup** 3 of 3 times.
- `DEFAULT_SEED = 7` in the game, and the only in-run change is the next pickup range (95 m growing by 5 m a drop, to 155 m).
- In all 18 bot runs and both journeys, the second minute holds the same things as the first: pads, buildings, a clock. Not one new element.
- Fourteen rounds tuned scoring, clock and balance. With round 14, balance holds within every target (above), so more tuning will not move the game much.

**Acceptance test** (dev server 5188):
1. Run `variety-probe.mjs`. At least 2 of 3 fresh loads give a different city fingerprint or district. Another way to pass: the title shows a named daily city with its own best score. With a mocked date, 2 dates give 2 fingerprints.
2. Run the low bot on seeds 22, 58 and 130. In 3 of 3 runs, a new gameplay element appears after 60 s. Examples: traffic drones, a rush-hour headwind, a moving pickup, a closed street. The diagnostics show it, for example as a hazard count that rises after 60 s.
3. The round 14 gates still pass. 0-delivery farms score under 1,000. The round 10 test passes twice. The lazy-to-street gap is at least 300, with Silver 150 clear of both. The first payout comes within 10 s. The hand-fly runs have 0 frames over 20 ms.

## Other gaps (ranked)

1. **The first leg feels like it pays nothing.** The first payout banks +7. The score reads 0 until the first drop, 26 s into the desktop hand-fly. Test: in the hand-fly run, the first banked pop shows at least +25. Or, from the first payout on, the score shows the pending bonus (for example "0 +55").
2. **Ace looks out of reach.** Best bot 6,894 (1,606 short), desktop journey 6,467 (2,033 short). Test: the best of the low bots and the desktop journey reaches within 800 of Ace, or a human playtest reaches Ace once in 5 runs.
3. **One leg still decides Gold on seed 130.** Low runs land 45 and 49 short in both passes. Test: no route-bot result within 100 of a line in two passes.
4. **The pop sits on the drone, and the paid lump is soft.** See the desktop and touch shots. "+553 STREET BONUS PAID" is semi-transparent over the drone. Test: in a full run, no payout or paid pop overlaps the drone's screen box. The score counter animates the paid lump.
5. **Too many rules in run one, and the mobile pill drops its label.** The tagline is three sentences. The touch pill shows only "+64". Test: the tagline is one sentence, and the touch pill shows "Bonus" or an icon next to the number.

## Regressions: none found

- **Hug probe** (seed 22, roads -22, 22, 66, `hug-probe-uncap.mjs` with the leg cap lifted. The capped probe never picks up, so the cap hides the difference): centre at cruise / centre at 9 m/s = 742 / 21 = **35** (needed 1.3). Hug at cruise / centre at 9 m/s = 2,226 / 21 = **106** (needed 2). Payout counts: 5 vs 2 and 10 vs 2. 0 crashes.
- **First payout:** desktop 7.5 s into the run, 3.5 s after the first draft. Touch 8.5 s, 4.0 s after. Both within 10 s.
- **Crash-classify-v, 8 seeds (11, 22, 33, 44, 7, 58, 91, 130):**
  - 12 m: 847 s, 30 deliveries, 46 charged crashes, **0 hop-like**. 9 near the target, all street pads (0.4 to 0.5 m). Every one hit a building face whose top was 1.8 to 51 m above the drone (wall tops 8.8 to 58.6 m). **0 on a pad lip.** Example: seed 7 at 32 s, the drone at 0.8 m beside the pad flew into a house front with an 8.8 m top (N-alt12-seed7-t32.0-near). As a player that charge is fair: you flew into a wall.
  - 20 m: 713 s, 25 deliveries, 27 charged, **1 hop-like**: seed 130 at 32.6 s, at 20.2 m into a face with a 33 m top, lost 8.8 m/s, rose 1.2 m. Same case as rounds 12 and 13: a real wall hit, 12.8 m below the top. Fair. 1 near the target (seed 22, street pad, face top 10.6 m, drone at 5.4 m). **0 on a pad lip.**
- **Flat-frame probe:** 1,041 frames, **0 flat**, 0 errors.
- **Music:** adaptive (see Audio). Seed 130 had 6 of 2,859 steps with no music, at time-up, as before.
- **Medal journey:** desktop 6,467 Gold, mobile 4,736 Gold. Both below Ace.
- **Page errors:** 0 on desktop and mobile.

## Performance

Headless Chromium caps at 120 Hz (8.3 ms).
- Hand-fly desktop 1280x720: 9,576 frames, **median 8.30 ms, p95 9.80, max 10.4, 0 over 20 ms**.
- Hand-fly iPhone 13 held sideways, touch: 9,578 frames, median 8.30, p95 9.70, max 10.4, 0 over 20 ms.
- Medal journey: desktop 19,141 frames, p95 9.80, max 10.4. Mobile 16,808 frames, p95 9.50, max 10.4. 0 over 20 ms.
- First load, production build (built to a scratch folder): **about 0.77 MB** (JS 730 KB or 198 KB gzipped, CSS 30 KB, HTML 9 KB). lil-gui (31 KB) is a separate chunk for `?debug`. Budget 15 MB: pass.

## Screenshots (progress/round-14/critic/)

- Farms at time-up (score 0): F-farm-seed22-road66, F-farm-seed22-road-22, F-farm-seed58-road66, F-farm-seed58-road22, F-farm-seed130-road66, F-farm-seed130-road22, F-farm-seed130-road-66.
- Smart farms: S-smartfarm-{near, line, pickup, pickupline, spendpickup}-seed{22, 58, 130}.
- New cap farm, game-over cards: C-capfarm-{honest, carry, both}-seed{22, 58, 130}. C-capfarm-carry-seed22 shows "Street bonus paid on 2 drops · 1,244 lost".
- Hand-fly: d-h01-title, d-h02 to d-h06, d-h08-end, and m-h01 to m-h08. Bank pill and pop: d-h04 (+7), d-h05 (+48, BONUS +55), m-h05 (+41, pill "+64" with no label).
- Medal journey: d-j22-h01 to d-j22-h13 and m-j22-h01 to m-j22-h13. Paid lump: d-j22-h10-medal1 ("+553 STREET BONUS PAID"). Game-over: m-j22-h11-over.
- Medal passes from bots: M-low-*, M-high-*, M-low-c10-seed22-pass1 (lazy Bronze).
- Crashes: Q-high-*, K-alt12-*, K-alt20-*. Near-target crashes: N-alt12-*, N-alt20-seed22-t33.4-near.

## Scripts and logs (progress/round-14/critic-scripts/)

- Copies of all round 13 scripts, unchanged (output folder is relative).
- New: `farms14.sh` runs the 30 no-delivery farms. `capfarm.mjs` and `capfarm.sh` run the farm aimed at the bank cap. `hug-probe-uncap.mjs` lifts the leg cap with the test tune hook. Also `queue14.sh` and `variety-probe.mjs`.
- Farm logs: farm-*, farmloop-22, smart-*, capfarm-*.
- Round 10 logs: m-low-a, m-low-b, m-high-a, m-high-b, m-lazy-a, m-lazy-b.
- Probe logs: hug, hug-uncap, ccv12, ccv20, flat, variety. cc-plain12 and cc-plain20 are a first try without crash detail.
- Real-time logs: hf-desktop, hf-mobile, mj-desktop, mj-mobile, queue14.
- The deterministic probes ran before or after the real-time queue, never during it.
