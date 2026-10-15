# Drone Dash: round 16 critic report

**Verdict:** The job rules work: every city now gets the same kind of legs, and the city roll no longer sets the medal through tower roofs. But the round 15 test still fails. The same street pilot scores 1,695 to 9,066 on 12 fresh cities (5.3 times), and 838 to 1,695 on the same city run twice. The cause is now the clock, not the city. A run lives or dies at the third drop, which is always a rooftop. The margin is often one or two seconds. And the score roughly doubles with each extra delivery.

Build tested: working tree at commit 6dafbeb plus the uncommitted round 16 changes. Dev server port 5188 (stopped at the end). Scripts are copies of round 15 in `critic-scripts/`. Their output folder is the relative `../critic/`, so the copies write here with no edit. New scripts are listed at the end.

## Round 15 gap (the city roll decides the medal): not closed

12 fresh random cities, read from `__GAME__.city()` after loads with no `?seed` (`pick-seeds.log`), none found in the builder's round 16 scripts. Real time, one run at a time, `route-play-rt-x-m-esc.mjs` (street) and `balance-probe-m-esc.mjs` (lazy), SIMT 600.

| City | Mood, parks | Street | Drops, run | Lazy | Same street bot, deterministic |
|---|---|---|---|---|---|
| 80258 | Golden hour, 2 | 3,882 Silver | 3, 126 s | 1,417 Bronze | 3,830 (3) |
| 40443 | Bright morning, 4 | 7,505 Gold | 5, 170 s | 1,398 Bronze | 7,371 (5) |
| 66012 | Hazy noon, 2 | 5,589 Silver | 4, 145 s | 1,469 Bronze | 7,355 (5) |
| 97343 | Hazy noon, 4 | 7,576 Gold | 5, 165 s | 1,318 Bronze | 7,718 (5) |
| 73243 | Hazy noon, 4 | 8,791 Gold | 5, 174 s | 510 | **11,041 Ace** (6) |
| 12668 | Rose dusk, 4 | 3,668 Silver | 3, 121 s | 595 | 2,458 (2) |
| 96842 | Rose dusk, 3 | 4,223 Silver | 3, 126 s | 589 | 4,215 (3) |
| 54408 | Golden hour, 4 | 3,436 Silver | 3, 118 s | 344 | 1,832 (2) |
| 19093 | Hazy noon, 2 | 3,862 Silver | 3, 123 s | 299 | 2,458 (2) |
| 84143 | Hazy noon, 4 | 9,066 Gold | 5, 178 s | 489 | 9,277 (5) |
| 62367 | Hazy noon, 4 | **1,695 Bronze** | 2, 88 s | 342 | 1,689 (2) |
| 36020 | Rose dusk, 4 | **1,960 Bronze** | 2, 96 s | 586 | 1,957 (2) |

| Test | Needed | Result | Pass |
|---|---|---|---|
| Street Silver or better | 12 of 12 | 10 of 12 (62367 and 36020 Bronze) | No |
| Lazy Bronze or below | 12 of 12 | 12 of 12 (best 1,469) | Yes |
| No bot at Ace | none | Real time none (best 9,066). The deterministic street bot made Ace on 73243 (11,041) | Yes in the test, but close |
| Best lazy at least 300 below worst street | 300 | 1,469 vs 1,695: **226** | No |
| Street best / worst | at most 2.5 | 9,066 / 1,695 = **5.35** (round 15: 6.1) | No |

Same-city repeats in real time (`rep-low.log`): 62367 scored 1,695, then 1,675, then **838** (one drop). 36020 scored 1,960 twice. 54408 scored 3,436, then **1,960** (and 1,832 deterministic). So 54408 is a third Bronze city about half the time.

What did improve: leg lengths are now uniform. On all 12 cities, pickups are 45 to 105 m of street and drops are 106 to 198 m. Every third drop is a rooftop at 16 to 29 m (`reach16-low.log`, `legs-*.log`). No first leg goes up a tower. Draftable street frontage is the same on every city (91 to 97 percent of road within reach of a wall, `frontage16.log`). The city itself is no longer the problem.

## Outliers: why

Street score by deliveries made, all 28 street runs on the 12 cities: 1 drop 838. 2 drops 1,675 to 2,458. 3 drops 3,436 to 4,223. 4 drops 5,348 to 5,589. 5 drops 7,355 to 9,277. 6 drops 11,041. Each delivery is worth more than the last (combo x1.5 to x3.5, street bonus paid only on a drop, time bonus per drop). So one missed drop near the end costs 40 to 50 percent of the score.

Where runs end (deterministic, `route-legs16.mjs`, screenshot 0.5 s before time-up):
- 5 of 12 deterministic runs end on drop 3, the rooftop. 4 of those end 13 to 31 m from the pad (12668 30 m, 54408 13 m, 19093 31 m, 36020 17 m).
- 4 more end 6 to 14 m from the next stop (96842 6 m, 40443 14 m, 66012 14 m, 97343 14 m).
- **62367** (O-low-seed62367-timeout): the bot picks up at a depot with 1 s left, and the game hands it a 29 m rooftop 158 m away. Its first two legs were slow (88 m in 18.1 s and 134 m in 22.9 s, against 7 to 15 s on other cities). It earned only 9.5 to 12.3 s of slow clock in a run (best cities 50 s). The bot climbs to 26 m to leave off-road depot pads. It also brakes to 7 m/s at every corner. So legs with three corners cost it more than they would cost a human.
- **36020** (O-low-seed36020-timeout): 18 m short of the third drop, a rooftop, with 1 s left and +697 street bonus banked and lost.
- **54408 and 19093**: the same rooftop on drop 3, 13 and 31 m short in the deterministic run. In real time they made it by a second or two and scored 3,436 and 3,862.
- No crashes in any of the 28 street runs. No stuck bot (0 unstick episodes logged).

**Game or bot?** Mostly the game. The bot is slow on some corners and depots, but that only decides which runs fall off the cliff. The cliff itself is the game. Every run must reach a fixed rooftop on drop 3 at about 95 to 100 s. The clock has no grace. The score compounds with deliveries. A human of steady skill will meet the same edge, and will see "Parcel secured! Now deliver it" with 1 s left and a 158 m job, then lose the banked bonus. A few hundred milliseconds of noise moves the same pilot on the same city between medals. Examples: Bronze and Silver (62367, 54408), Gold and Ace (73243).

## Gates on seeds 22, 58, 130 (real time, one pass)

| Run | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low (music-run) | 4,078 Silver, 3 drops | 4,982 Silver, 4 | 5,451 Silver, 4 | 14,511 |
| High | 5,350 Silver, 6 | 3,020 Silver, 5 | 3,158 Silver, 5 | 11,528 |
| Lazy | 582 | 1,236 Bronze | 681 | 2,499 |

- Low / high **1.26** (needed 0.85). The street line now beats the beeline (round 15: 0.95). No Gold on these seeds under the new 6,000 line.
- Breakdown exact: diagnostics, game-over rows and total agree in all 9 runs here and all 28 runs on random cities (bdOk and domOk true). The game-over card splits fast drops and rush orders, and they add up.
- Rush hour starts at 60.0 s in all 30 runs that passed 60 s (ESC lines), stage 2 after 120 s.
- No-delivery farms: all 30 (farm-probe 8, farm-loop, smart-farm near, line, pickup, pickupline, spendpickup) score **0**. Capfarm points a minute over the 3 seeds: honest 2,158, carry 777 (**0.36**), both 0. The carry farm on seed 22 still delivers twice and gets Silver (2,830), as in round 15. Pass.

## Daily city: works

Seed 45900 on two loads and in a fresh profile, same first parcel. Mocked 16 Oct gives 68757, 31 Dec gives 75412. A daily run of 1,220 saved as "Daily best 1,220 Bronze, New daily best!". A random-city run of 2,905 raised the overall best and left the daily best at 1,220. Two daily attempts get the same 4 parcels in order. On iPhone the title buttons are still 25 px tall.

## City audit: 24 fresh cities, nothing broken

Seeds 94168, 54344, 26595, 76487, 60851, 35255, 71248, 78143, 86757, 37625, 29902, 83343, 12982, 89030, 33443, 94748, 98918, 99195, 77231, 20180, 81397, 46053, 62130, 41816. `city-audit16.mjs` builds each city with its own park count. 0 broken pads (buried, overhang, awning, too high, outside, far from road), builder padAudit 0. 0 spawns inside geometry, 0 crashes or drift in 3 s with no input. First pickup 38 to 81 m straight line. Park count matches the look in 24 of 24 (2 to 4). Moods across 40 loads: Hazy noon 17, Golden hour 9, Rose dusk 9, Bright morning 5.

## Regressions

- **Crash-classify, 8 seeds:** 12 m: 645 s, 20 drops, 56 charged, **0 hop-like**, 9 near the target, **0 on a pad lip**. All near-target hits were faces 7.8 to 25.7 m below the top (N-alt12-seed33-t55.4: the side of a taller tower beside a 26 m rooftop pad). 20 m: 659 s, 25 drops, 37 charged, **0 hop-like**, 7 near, 0 pad lip, faces 4.3 to 25.8 m below the top. 12 crashes rose afterwards, all with climb held (bot climbing or unsticking). Two clipped an edge 1.2 and 1.5 m below the top while climbing over it (seed 58). Real wall hits. The 12 m beeline crashes more than last round (5.2 a minute, was 3.9), likely because drops are now longer.
- **Flat-frame probe:** 1,039 frames, 0 flat, 0 errors.
- **Music:** adaptive. Chain 0 to 3 gives 1 to 4 layers, mean intensity 0.33 to 0.89. Final section from 9.96 to 9.99 s left. 0 late notes, 0 resyncs, 0 errors.
- **Hand-fly first payout:** desktop 7.2 s, mobile **9.9 s** (round 15: 5.5 and 8.7). Both within 10 s, mobile by 0.1 s.

## As a player (desktop and iPhone 13 held sideways, touch)

- **Do cities feel different?** Yes, more than last round. Rose dusk is purple and pink with a low sun. Hazy noon has a teal sea and flat light. Bright morning is blue and cool. Golden hour is the old look. The first look from the title now tells you a new place. Parks vary 2 to 4 but you rarely notice. The grid, the buildings and the props are still the same. The title still says "Golden-hour courier" on a rose dusk city (L-d-seed12668-title).
- **New medal lines.** Bronze 1,000 comes on the first or second drop. Silver 2,500 needs three drops, Gold 6,000 needs five. That ladder is readable and reachable for a good pilot, and Gold is a real goal. But the medal you get depends on whether you reach the third drop with a second to spare. Missing it by a building width turns Silver into Bronze and leaves +700 unpaid on screen. That feels unfair, not motivating. Ace 10,000 needs six drops, which a deterministic bot already did.
- **HUD.** On iPhone the "High wind" chip covers the pickup distance label (L-m-seed12668-flight). The rush banner still sits on top of the crash pop (N-alt12-seed33-t55.4). Delivery pops stack over the drone.

## Whole game, against the best polished indie arcade flying and delivery games

- **First 10 seconds:** strong. Now four looks, each warm and coherent.
- **Onboarding:** good. First payout within 10 s on both devices, but mobile is at the edge.
- **Core loop:** pick up, draft, deliver, chain. The street line now beats the beeline (1.26). Leg lengths are fair.
- **Game feel:** still the best part. Momentum, banking, camera lean.
- **Art:** coherent and finished, with real variety in light now.
- **Audio:** adaptive and clean.
- **UI:** clean, with a few overlaps at busy moments.
- **Difficulty curve:** the clock decides everything around drop 3. The best arcade delivery games also end a run on a clock. But there you keep what you earned. The last seconds feel like a sprint you can win. Here the last seconds often hand you a job you cannot finish and take away banked points.
- **Replay pull:** daily city and four moods help. Medals still swing too much run to run to mean skill.

## Single biggest remaining gap: the run ends on a knife edge at the third drop

**The concern.** Run length is set by the clock, the clock is fed by drops, and the score compounds with drops. Every city now has the same legs, so every run hits the same wall. The third drop is a rooftop, reached at about 95 to 100 s. Either the pilot makes it with a second to spare, or the run ends 6 to 30 m short and the banked street bonus is lost. One drop more or less moves the score 40 to 50 percent. So the same pilot on the same city swings between medals, and the spread across cities stays near 5 times.

**Evidence:**
- Street bot on 12 cities: 1,695 to 9,066 (5.35 times). Silver 10 of 12.
- Same city, same bot: 62367 838 to 1,695. 54408 1,832 to 3,436. 66012 5,589 to 7,355. 73243 8,791 to 11,041.
- 9 of 12 deterministic runs end within 31 m of the next stop. 5 of 12 end on drop 3, the rooftop.
- Score by drops: 2 drops at most 2,458, 3 drops at least 3,436.
- Best lazy 1,469 (it gets a +150 rush order on two drops) is 226 below the worst street run.

**Acceptance test.** Dev server 5188. 12 fresh random seeds not used for tuning. `critic-scripts/route-play-rt-x-m-esc.mjs` (street, real time) and `balance-probe-m-esc.mjs` (lazy), plus `route-legs16.mjs` (deterministic).
1. Street bot Silver or better on 12 of 12. Lazy Bronze or below on 12 of 12. No bot at Ace, deterministic included.
2. Best lazy at least 300 below worst street. Street best / worst at most 2.5.
3. Same-city noise: 3 real-time street runs on each of 4 of those cities (the two lowest and two highest). On each city, best / worst at most 1.4.
4. In the deterministic runs, at most 3 of 12 end within 30 m of the next stop. Or: a run that ends that close keeps at least half of its banked street bonus.
5. Seeds 22, 58, 130 still pass the round 14 and 15 gates, no-delivery farms 0.

The fix is the builder's choice. Examples:
- a short overtime to finish the leg in hand;
- a time bonus sized to the next leg, so a fresh job is never impossible;
- no rooftop on drop 3 when the clock is low;
- part of the banked bonus paid at time-up;
- a flatter combo.

## Other gaps (ranked)

1. **Busy-moment overlaps.** Rush banner over the crash pop (N-alt12-seed33-t55.4). On iPhone the wind chip over the nav distance (L-m-seed12668-flight). Delivery pops over the drone (M-low-seed40443-pass3). Test: in a full run on desktop and iPhone held sideways, no two centre pops overlap and nothing covers the objective pill or nav label.
2. **Title on mobile and mood text.** City buttons 25 px tall on iPhone 13 held sideways (round 15 asked for 40 px). "Golden-hour courier" shows on every mood. Test: buttons at least 40 px tall, tagline matches the mood.
3. **Ace is one good run away for a bot.** Deterministic street bot 11,041 on 73243. Ace is meant for skilled humans. Test: with the fix above, no bot over 9,500 on 12 cities, and a skilled desktop journey within 1,000 of Ace.
4. **Mobile first payout at 9.9 s.** Was 8.7. Test: hand-fly mobile first payout at most 8 s.
5. **The world is still one grid.** Light changes, layout and props do not, and nothing changes in the world at 60 s. Test: 6 fresh loads show at least 3 district mixes a player can name, and rush hour changes something visible.

## Performance

Headless Chromium caps at 120 Hz (8.3 ms).
- Hand-fly desktop 1280x720: 9,566 frames, **median 8.30 ms, p95 9.20, max 25.6, 2 over 20 ms**.
- Hand-fly iPhone 13 held sideways, touch: 9,580 frames, median 8.30, p95 9.10, max 9.4, 0 over 20 ms.
- First load, production build to a scratch folder: **about 0.79 MB** (JS 742 KB, 199 KB gzipped. CSS 34 KB. HTML 10 KB). lil-gui 31 KB only for `?debug`. Budget 15 MB: pass.
- Page errors: 0 in every run.

## Screenshots (progress/round-16/critic/)

- Outliers at time-up (deterministic, 0.5 s before the end): O-low-seed62367-timeout, O-low-seed36020-timeout, and O-low-seed* for all 12 cities.
- Outlier medal moments: M-low-seed62367-pass1, M-low-seed36020-pass1. All medal passes: M-low-*, M-high-*, M-low-c10-*.
- Moods, desktop and iPhone: L-d-seed80258 (Golden hour), L-d-seed40443 (Bright morning), L-d-seed66012 (Hazy noon), L-d-seed12668 (Rose dusk), each -title and -flight, and the same as L-m-*.
- Crashes near the target: N-alt12-*, N-alt20-*. Bot crash shots: Q-*.
- City audit starts: V-city*-start. Farms: F-farm-*, S-smartfarm-*, C-capfarm-*. Hand-fly: d-h*, m-h*. Daily: D-*.

## Scripts and logs (progress/round-16/critic-scripts/)

- Copies of all round 15 scripts, unchanged.
- New scripts:
  - `pick-seeds.mjs`: random seeds with mood and parks.
  - `city-audit16.mjs`: city-audit with each city's own park count.
  - `reach16.mjs`: reach-probe plus leg street distance and height.
  - `route-legs16.mjs`: route-play with the external clock, per-leg times and clock, time-up shot.
  - `frontage16.mjs`: draftable street frontage.
  - `looks16.mjs`: mood shots.
  - `det16.sh`, `queue16.sh`, `repeat16.sh`.
- Note: route-play.mjs, reach-probe.mjs and crash-classify-v.mjs do not switch on the external clock, so the game loop also runs in real time. Their leg times and scores are not deterministic. route-legs16.mjs fixes that. Leg geometry from reach16 is still right, since the parcel order depends on the seed only.
- Logs: acc-low, acc-lazy (acceptance), rep-low (repeats), legs-a to d, reach16-low, frontage16, m-low-a, m-high-a, m-lazy-a, ccv12, ccv20, farm-*, farmloop-22, smart-*, capfarm-*, city-audit, daily, hf-desktop, hf-mobile, flat, looks16, pick-seeds.
- Order: deterministic batch first, then real-time queue one at a time, then deterministic leg runs, then real-time repeats alone.
