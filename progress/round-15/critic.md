# Drone Dash: round 15 critic report

**Verdict:** Random cities, the daily city and rush hour all work, and every round 14 gate still passes on seeds 22, 58 and 130. But random cities exposed a new problem: the city you roll now decides your medal more than how you fly. The same street pilot scores 1,178 (Bronze) to 7,208 (Gold), city by city. On a hard city it scores less than the lazy pilot on an easy one.

Build tested: working tree at commit 2165a53 plus the uncommitted round 15 changes. Dev server port 5188 (stopped at the end). Scripts are copies of round 14 in `critic-scripts/`. Their output folder is the relative `../critic/`, so the copies write here with no edit. New scripts are listed at the end.

## Round 14 gap (every run was the same run): closed in the letter, partly in the spirit

| Check | Needed | Result | Pass |
|---|---|---|---|
| Fresh loads differ | 2 of 3 | `variety-probe`: 3 of 3 different fingerprints (941f2d2d, de0db502, d5e70f4a), 80 / 96 / 82 sites, 3 different first pickups. `city-audit`: 24 fresh loads gave 24 different seeds | Yes |
| Daily city | same on a day, differs on another date, own best | Seed 45900 on two loads and in a fresh profile, same first parcel. Mocked 16 Oct gives 68757, 31 Dec gives 75412. A daily run of 1,127 saved as "Daily best 1,127 Bronze, New daily best!". A later random-city run of 3,061 raised the overall best but left the daily best at 1,127. The next day shows daily best 0. Two daily attempts get the same 4 parcels in the same order | Yes |
| New element after 60 s, in diagnostics | 3 of 3 low runs | Rush hour starts at 60.0 s in 3 of 3 (and in all 33 bot runs that lasted past 60 s). Diagnostics: `escalation.on` true, `startedAt` 60, stage 1, then stage 2 after 120 s. Orders 1 to 3, made 1 to 2 | Yes |

In spirit: every city is the same 7 by 7 street grid, with roads at the same coordinates. Every city has exactly 3 parks and 6 depot pads. The sky, palette and sea never change. What changes is which buildings stand where (1 to 10 towers, tallest 59 to 120 m) and where the pads are. It reads as the same city rearranged, not a new place. Rush hour is a coral tag and +150 on 1 to 3 parcels a run. Nothing in the world changes at 60 s.

## Round 14 gates on seeds 22, 58, 130 (one pass, real time, SIMT 600)

| Run | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low (music-run) | 7,208 Gold, 159 s, rush +300 | 2,219 Silver, 94 s, rush +150 | 4,777 Gold, 130 s, rush +150 | 14,204 |
| High | 6,101 Gold, rush +450 | 4,253 Silver, rush +150 | 4,529 Gold, rush +300 | 14,883 |
| Lazy | 506 none | 579 none | 640 none | 1,725 |

- Low / high 0.95 (needed 0.85). Low Silver 3 of 3, Gold 2. High Silver or better 3 of 3. No Ace (best 7,208, 1,292 short). Lazy no medal 3 of 3. Pass.
- Breakdown exact in 9 of 9 runs (diagnostics, game-over rows and total agree. The new "Rush orders 2 of 3 in time" row adds up).
- Best lazy 640, worst street 2,219: gap 1,579. Silver 1,650 sits 1,010 above lazy and 569 below street. Pass.
- Rush closed round 14's Gold knife edge on low seed 130 (4,455 then, 4,777 now) but made a new one: high seed 130 is 29 over Gold.
- No-delivery farms: all 30 (farm-probe 8, farm-loop, smart-farm near, line, pickup, pickupline, spendpickup on 22, 58, 130) score **0**. Capfarm: honest 2,180 a minute, carry 953 (0.44), both 844 (0.39). Pass.

## Generalisation: 6 random cities of my choosing (81401, 70492, 32730, 48684, 57366, 73023)

| City | Low (street) | High (beeline at 40 m) | Lazy |
|---|---|---|---|
| 81401 | 2,690 Silver | 4,625 Gold | 0 |
| 70492 | **1,178 Bronze** | 4,525 Gold | 657 |
| 32730 | 4,017 Silver | 2,636 Silver | 424 |
| 48684 | 1,970 Silver | 3,779 Silver | 325 |
| 57366 | 4,495 Silver (5 short of Gold) | 3,346 Silver | **1,414 Bronze** (incl. a +150 rush) |
| 73023 | 6,781 Gold | 3,595 Silver | 645 |
| Total | 21,131 | 22,506 | 3,465 |

- Street Silver or better: **5 of 6. Fails on 70492** (one delivery in 81 s). It is a tower-heavy city: 21 rooftop pads, tallest 120 m, and the first parcel goes to a tower roof.
- Lazy Bronze or below 6 of 6. No Ace. Pass.
- Best lazy (1,414) is **236 above** the worst street run (1,178). The 300-point gap fails on random cities.
- High Silver or better 6 of 6, Gold 2, with only 25 to 201 street-bonus points a run.

## Broken-city hunt (24 fresh random cities, plus a reach test)

- `city-audit.mjs` (my own audit, built from the game's generator in the page): **0 broken pads** in 2,206 sites. Checks: a buried landing sphere, and anything in a 1.2 m column above the pad up to the 105 m ceiling. Also an awning within the drone's radius, pads above 95 m, pads outside the city and doorsteps far from a road. The builder's `padAudit` also reports 0. 704 near misses where a cornice or awning edge sits 1.2 to 1.5 m from a pad centre: tight but flyable.
- Spawn: 0 of 24 inside geometry, 0 crashes and 0 drift in 3 s with no input.
- First pickup: 40 to 102 m straight-line from spawn, median 87 m. None absurd.
- `reach-probe.mjs` (deterministic, long clock, 10 legs a city, both bot lines): 480 legs on 24 cities. The high bot finished every leg, none over 45 s. The low bot had 4 slow legs (48 to 90 s), all stalls after leaving a tall roof. The same pads were reached in 10 to 15 s on other legs (for example 77070 Florist in 13.6 s, later 64.4 s). Shot R-low-seed48684-slowleg-9 shows the bot at 45 m beside towers. A bot problem, not a broken pad.
- No bad case needed a screenshot.

## Escalation exploits

- **Farming rush:** not possible. The game pays the bonus only on a delivery inside the window. The window is route / 11 + 5 s, tighter than the fast-drop par. The bonus is flat, with no combo and no clock time. All no-delivery farms still score 0.
- **Lazy pilot to Silver:** no. Lazy runs end at 51 to 79 s, so they see at most one rush order. It made one in 9 runs (+150 on 57366, 1,264 to 1,414). Best lazy stays 236 under Silver.
- **Rush favours the beeline.** Over 9 cities the high line made 2,100 rush points, the street line 1,350. The beeliner earns almost no street bonus and still matches the street pilot overall (14,883 vs 14,204, and 22,506 vs 21,131).
- **City reroll.** "New city" is one tap on the title and on the game-over card. Every city shares the overall best and best medal. A player can reroll until the first parcels are short. Not a bug, but it feeds the main gap below.
- **Daily memorising.** Every daily attempt gets the same parcels. That makes the daily a fair race. It is by design.

## Regressions: none found

- **Crash-classify-v, 8 seeds (11, 22, 33, 44, 7, 58, 91, 130):**
  - 12 m: 736 s, 24 deliveries, 48 charged, **0 hop-like**, 4 near the target. All were building faces 2.2 to 31 m above the drone (tops 11.7 to 39.4 m). Closest: seed 7 at 114 s, drone at 9.5 m into the depot hangar edge, top 11.7 m (N-alt12-seed7-t114.1-near). **0 on a pad lip.**
  - 20 m: 654 s, 24 deliveries, 33 charged, **0 hop-like**, 4 near (tops 10.6 to 20.2 m, drone 3.4 to 6.8 m below). **0 on a pad lip.**
  - 6 crashes rose more than 0.8 m afterwards. All had climb held during the bot's unstick move and hit walls 2.5 to 34 m below the top. Real wall hits.
- **Flat-frame probe:** 896 frames, 0 flat, 0 errors.
- **Music:** adaptive. Chain 0 to 3 gives 1 to 4 layers, mean intensity 0.34 to 0.85. Final section starts at 9.95 to 9.98 s left. 0 late notes, 0 resyncs, 0 errors. Seed 130 had 11 of 2,886 steps silent at time-up (6 last round, same moment).
- **Hand-fly first payout:** desktop 5.5 s, mobile 8.7 s, both now bank +25 (round 14: +7). Score shows the pending bonus ("1,984 +456"). Both within 10 s.
- **Page errors:** 0.

## As a player (desktop and iPhone 13 held sideways, touch)

- **Do new cities feel different?** Shuffled. The first look from the drone changes (a tower here, a park there), but the grid, the light and the mood never do. After three cities you stop noticing which one you are in. On the plus side, cities with many towers do play differently: you climb more and the street line suffers.
- **Rush hour.** Readable on desktop. A coral "RUSH HOUR" banner shows under the pill, then a "RUSH 11" tag with a bar shows in the pill. The delivery pop reads "+2,025 · Rush +150 · Street bonus +990" (H-d-seed22-t60.4, H-d-seed22-rushmade1). On iPhone held sideways the banner sits on top of the objective pill for its first second and a banked pop sits under it (H-m-seed22-t60.4). It is mildly exciting: a countdown in the pill gives the second minute a goal. But +150 is small next to a 990 street bonus. The world does not react: no traffic, no light change, only a horn. A street pilot sees 1 to 3 orders.
- **Title screen.** Clear on desktop: one-line tagline now, Play, then "City 24933 · New city · Daily city". In daily mode the label "Daily city · Thu 15 Oct" looks like a third button beside "Daily city ✓". On iPhone the city buttons are 25 px tall (below a comfortable touch size) and the daily-best line is folded into the label. The game-over card is good on both: city name, a "Rush orders 2 of 3 in time" row, "Replay this city" and "New city".

## Whole game, against the best polished indie arcade flying and delivery games

- **First 10 seconds:** strong. Golden-hour city, bold logo, one-line pitch, Play.
- **Onboarding:** good in play. First draft at 4 s, first payout +25 at 5.5 s, the score shows the pending bonus. Still many systems live in run one (bank, chain, combo, fast drop, slow clock, boost, rush).
- **Core loop:** pick up, draft, deliver, chain. Solid. But flying straight over the roofs scores as well as drafting the streets.
- **Game feel:** the best part. Momentum, banking, camera lean, crash feedback.
- **Art:** coherent, warm, finished. One mood, one palette.
- **Audio:** adaptive and clean.
- **UI:** clean. Pops still pile up at the centre at busy moments (N-alt12-seed7: Crash, Gold medal, -3 SEC and +92 banked at once).
- **Difficulty curve:** rush hour adds a small second-minute goal. No new hazard.
- **Run variety:** much better than last round in layout, still one look.
- **Game over and restart:** clear and quick, now with Replay or New city.
- **Replay pull:** the daily city with its own best is a real hook. But the medal you earn on a random city depends heavily on which city it was.

## Single biggest remaining gap: the city roll decides the medal

**The concern.** With a new random city every load, a run's score depends more on the city and its parcel draw than on the pilot. Medal lines are fixed numbers calibrated on three seeds, and the title's Best and best medal are shared by every city. So a good street pilot can get Bronze on one city and Gold on the next. A lazy pilot on an easy city can beat a good one on a hard city. Medals, the main replay pull, stop meaning skill. "New city" also lets a player reroll for an easy city.

**Evidence (this round, real-time bots):**
- Same street bot on 9 cities: 1,178 to 7,208 points, a **6.1 times** spread. Per minute 873 (70492) to 2,720 (seed 22).
- Street Silver failed on 1 of 6 random cities (70492: 1,178 Bronze).
- Best lazy run (1,414 on 57366) beats the worst street run (1,178 on 70492) by 236. On the three tuning seeds the gap was +1,579.
- On 70492 the beeline bot scores 4,525 Gold and the street bot 1,178 Bronze (3.8 times): tower-heavy cities punish the style the game's tagline asks for.
- Three runs sit within 30 of the Gold line (4,495, 4,525, 4,529).

**Acceptance test.** Use dev server 5188 and `critic-scripts/route-play-rt-x-m-esc.mjs` and `balance-probe-m-esc.mjs`. Use 12 fresh random seeds not used for tuning, read from `__GAME__.city()` after a load with no `?seed`.
1. Street (low) bot Silver or better on 12 of 12. Lazy bot Bronze or below on 12 of 12. No bot at Ace.
2. Best lazy score at least 300 below the worst street score across the 12.
3. Street bot best / worst score at most 2.5 (now 6.1).
4. Seeds 22, 58, 130 still pass the round 10 test and the no-delivery farms still score 0.
The way to get there is the builder's choice. Examples: a per-city par that scales the medal lines, no tower-heavy first legs, or best and medals kept per city or for the daily only.

## Other gaps (ranked)

1. **Cities are rearranged, not different.** Same grid, 3 parks, 6 depots, one sky and palette in all 24 audited cities. Rush hour changes a tag, not the world. Test: 6 fresh loads show at least 3 distinct city looks, for example time of day or district mix. After 60 s something visible in the world changes (traffic, lights, weather), and diagnostics count it.
2. **The beeline matches the street line.** High total 14,883 vs low 14,204 on seeds 22, 58, 130. High 22,506 vs low 21,131 on 6 random cities. The high line banks only 25 to 201 street bonus a run. Rush adds more to the high line (2,100 vs 1,350). Test: low / high at least 1.1 on 6 random cities while high still gets Silver on 5 of 6.
3. **Pops pile up at the centre.** Crash, medal, -3 SEC and banked pops at once (N-alt12-seed7-t114.1-near). On iPhone the rush banner covers the objective pill (H-m-seed22-t60.4). Test: in a full run on desktop and iPhone held sideways, no two centre pops overlap and nothing covers the objective pill.
4. **Title city controls on mobile.** Buttons 25 px tall. The daily label looks like a button next to "Daily city ✓". Test: city buttons at least 40 px tall on iPhone 13 held sideways, and the label is visibly text, not a chip.
5. **Ace still out of reach.** Best bot 7,208 (1,292 short). Best random-city run 6,781. Test: best low bot or a desktop journey within 800 of Ace.

## Performance

Headless Chromium caps at 120 Hz (8.3 ms).
- Hand-fly desktop 1280x720: 9,577 frames, **median 8.30 ms, p95 9.60, max 10.4, 0 over 20 ms**.
- Hand-fly iPhone 13 held sideways, touch: 9,581 frames, median 8.30, p95 9.60, max 10.4, 0 over 20 ms.
- First load, production build to a scratch folder: **about 0.78 MB** (JS 740 KB, 201 KB gzipped. CSS 34 KB. HTML 10 KB). lil-gui (31 KB) loads only for `?debug`. Budget 15 MB: pass.

## Screenshots (progress/round-15/critic/)

- Daily and title: D-daily-title-desktop, D-daily-title-mobile, D-daily-title-after-best, D-daily-over-desktop, D-random-title-desktop, D-random-title-mobile.
- Random cities at start: V-city84404-start, V-city24933-start, V-city39971-start, V-city71147-start (mid title fade. Layout check only).
- Rush hour, real time: H-d-seed22-t59.0 to t66.0, H-d-seed22-rushlive1/2, H-d-seed22-rushmade1/2, H-d-seed22-stage2, H-d-seed22-over, and the same set as H-m-* for iPhone held sideways.
- Rush hour, deterministic (pops last longer in sim time, so overlap is exaggerated): E-d-* and E-m-*. Note the E-d files mix the low and high runs on seed 22.
- Reach probe slow legs (bot stalls): R-low-seed32730-slowleg-2, R-low-seed42068-slowleg-3, R-low-seed48684-slowleg-9, R-low-seed77070-slowleg-9.
- Crashes near the target: N-alt12-seed22-t59.7, N-alt12-seed22-t108.8, N-alt12-seed7-t114.1, N-alt12-seed91-t33.5, N-alt20-seed22-t32.1, N-alt20-seed22-t60.3, N-alt20-seed130-t51.6, N-alt20-seed130-t92.9. Other crash shots: K-*, Q-*.
- Farms: F-farm-*, S-smartfarm-*, C-capfarm-*. Medal passes: M-*. Hand-fly: d-h*, m-h*.

## Scripts and logs (progress/round-15/critic-scripts/)

- Copies of all round 14 scripts, unchanged.
- New, log-only variants: `route-play-rt-x-m-esc.mjs`, `balance-probe-m-esc.mjs`, `music-run-esc.mjs` (one extra ESC line with escalation diagnostics).
- New: `city-audit.mjs` (24 random cities, own pad audit, spawn, first pickup), `reach-probe.mjs` (deterministic reach test), `daily-probe.mjs`, `rush-shots.mjs` (deterministic), `rush-rt.mjs` (real time), `det15.sh`, `queue15.sh`.
- Logs: variety, daily, city-audit (and `../critic/city-audit.json`), reach-*, ccv12, ccv20, farm-*, farmloop-22, smart-*, capfarm-*, m-low-a, m-high-a, m-lazy-a, g-low, g-high, g-lazy, hf-desktop, hf-mobile, flat, rush-*, queue15, det15.
- The deterministic batch ran before the real-time queue, and the rush shots after it. Real-time scripts ran one at a time.
