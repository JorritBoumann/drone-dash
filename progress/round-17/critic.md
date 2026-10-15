# Drone Dash: round 17 critic report

**Verdict:** The ending is now fair. The cliff at the third drop is gone. Each delivery adds a similar amount, and a run that runs out of clock with a parcel aboard finishes it in overtime. Every gate and regression passes except one: the cross-city ratio is 2.78 (target 2.5). I recommend retiring that target. The street bot causes most of the spread, not the city. The game's biggest limit is now content, not balance: on a uniform grid every leg is the same drive, so there is no route to choose and little to discover after a few runs.

Build tested: working tree at commit 064109c plus the uncommitted round 17 changes. Dev server port 5188 (stopped at the end). Scripts are copies of round 16 in `critic-scripts/`. Their output folder is the relative `../critic/`, so the copies write here with no edit. New scripts are listed at the end.

## Round 16 gap (the run ends on a knife edge at the third drop): closed, with one smaller edge left

12 fresh random cities from `pick-seeds.mjs` (loads with no `?seed`), none found in any builder file: 55211, 52809, 95387, 16805, 14523, 15493, 88700, 68665, 65188, 25215, 83341, 61719. Real time, one run at a time.

| City | Street (real time) | Drops | Ending | Lazy | Street, deterministic |
|---|---|---|---|---|---|
| 55211 | 3,094 Silver | 3 | clock out on a 29 m pickup leg | 907 | 3,512 (4) |
| 52809 | **2,495 Silver** | 4 | overtime, made it | 1,540 Bronze | 3,879 (5) |
| 95387 | 6,354 Gold | 5 | clock out on a 27 m pickup leg | 1,104 Bronze | 6,348 (5) |
| 16805 | 6,729 Gold | 6 | overtime, made it | 1,680 Bronze | 4,134 (5) |
| 14523 | 5,045 Gold | 5 | clock out on a 38 m pickup leg | 1,418 Bronze | 6,030 (6) |
| 15493 | 6,004 Gold | 6 | overtime, made it | 1,427 Bronze | 6,074 (6) |
| 88700 | 5,094 Gold | 6 | overtime, made it | 1,562 Bronze | 5,056 (5) |
| 68665 | 4,268 Silver | 4 | overtime, made it | 1,157 Bronze | 4,251 (4) |
| 65188 | **6,927 Gold** | 6 | overtime, made it | **1,792 Bronze** | 6,005 (5) |
| 25215 | 5,247 Gold | 5 | overtime, made it | 1,288 Bronze | 5,153 (5) |
| 83341 | 5,132 Gold | 5 | clock out on a 29 m pickup leg | 1,379 Bronze | 4,884 (5) |
| 61719 | 3,513 Silver | 4 | overtime, made it | 1,095 Bronze | 3,530 (4) |

| Test | Needed | Result | Pass |
|---|---|---|---|
| 1. Street Silver or better | 12 of 12 | 12 of 12 (worst 2,495) | Yes |
| 1. Lazy Bronze or below | 12 of 12 | 12 of 12 (best 1,792) | Yes |
| 1. No Ace from any bot | none | Best of all bots and modes 8,232 (deterministic, quick-cornering variant). Ace is 9,000 | Yes |
| 2. Best lazy at least 300 below worst street | 300 | 2,495 minus 1,792 = **703** | Yes |
| 2. Street best / worst | at most 2.5 | Real time 6,927 / 2,495 = **2.78**. Deterministic 6,348 / 3,512 = 1.81. City medians (below) 6,927 / 3,088 = 2.24 | No (real time) |
| 3. Same-city noise, 3 runs each | at most 1.4 | 52809: 2,495, 3,382, 3,453 (**1.38**). 55211: 3,094, 3,027, 3,088 (1.02). 65188: 6,927, 6,972, 6,330 (1.10). 16805: 6,729, 5,663, 6,166 (1.19) | Yes |
| 4. Ends within 30 m of the next stop | at most 3 of 12, or keeps half its bank | Deterministic: 5 of 12, all on a pickup leg (10 to 26 m short). Banked bonus at that moment 0 on four, 107 on one, which kept 56 (52 percent) | Yes, by the second clause |
| 5. Gates on 22, 58, 130 | see below | all pass | Yes |

Round 16 was 1,695 to 9,066 (5.35) with two Bronze cities and same-city swings up to 2.0. Now it is 2,495 to 6,927, no Bronze, and same-city swings at most 1.38.

What changed in the shape of a run:
- **Score per drop is flat now.** Real time: 3 drops about 3,050, 4 drops 2,495 to 4,268, 5 drops 5,045 to 6,354, 6 drops 5,094 to 6,972. Each drop adds about 1,000 to 1,100. Round 16: each drop roughly doubled the score.
- **Overtime almost always wins.** 16 of 16 overtime windows were finished by the street bots (real time), and 11 of 12 by the lazy bot. Windows were 8 to 15 s for 12 to 55 m left. Bots used 1.3 to 10 s of them.
- **The one edge left is at the pickup.** The clock can run out while flying to a pickup, and then there is no overtime. That happened in 8 of 20 real-time street runs: 55211, 95387, 14523, 83341 and 4 repeats. Each time the open leg was a short pickup leg of 26 to 38 m of street. Those runs lose a last-call drop. With a parcel aboard, overtime gives that drop. Its value is the overtime drops seen: 328 to 1,159, mean about 700, so 10 to 20 percent of the run. It is a step now, not a cliff. Examples: 55211 deterministic 3,512 (ended in overtime) and the same run with screenshot pauses 3,012 (ended 4 m short of the pickup). 68665 on iPhone ended 22 m short of a pickup, 249 points short of Gold (E-m-seed68665-over).

## The spread: city or bot? Mostly the bot

Evidence from the deterministic leg logs (`legs-*.log`, summary script `legs-summary.py`):
- **The cities are close.** The first three pickup and drop cycles are 586 to 696 m of street on all 12 cities (1.19 times).
- **A beeline bot sees that same small spread.** The high-line bot flies those cycles in 48.5 to 57.9 s (1.19 times). Time tracks distance.
- **The street bot does not.** It flies them in 70.4 to 98.0 s (1.39 times). Its average speed on the legs varies by city from 6.4 to 8.3 m/s. Pickup legs are the slow ones (5.2 to 7.4 m/s). They start at a drop pad. The bot climbs to 26 m to leave an off-road pad. Then it brakes to 7 m/s at every corner.
- **Two cities make it plain.** 55211 against 65188: the beeline bot scores 3,485 and 3,724 (the same). The street bot scores about 3,050 and about 6,700 (2.2 times). With faster corners (11 m/s), 55211 barely moves (3,628) and 65188 jumps to 8,232. So 55211's corners and pad exits are what slow this bot down.
- **A clock fed by drops amplifies it.** A run that is 15 percent slower earns fewer drops. So it also earns less clock, and it gets fewer drops again. That is how a 1.2 to 1.4 times difference in pace becomes 2.2 times in score.

**Is it a problem for a human player?** Not much. A human corners and leaves pads in their own way, not the bot's way. The pure city difference (about 1.2 times in distance) is normal for a game with random maps. Players who want to compare scores fairly have the daily city, where everyone flies the same map. On random cities the medal bands are wide (Silver 2,000 to 4,500, so 2.25 times). The street bot lands Silver or Gold on every city, and the lazy bot lands Bronze everywhere. That is the result that matters.

**Recommendation:** accept the spread and move on. Retire the "street best over worst at most 2.5" target. It now mostly measures how this one bot takes corners. Three rounds went into it. Do not build medal lines scaled to each city's par now. That adds a system to explain to the player. The builder can only tune it against the same bot. Keep these guards for future rounds instead:
  - street Silver or better 12 of 12
  - lazy Bronze or below 12 of 12
  - no bot at Ace
  - lazy at least 300 below the worst street run
  - same-city noise at most 1.4.

 Par medals can wait. A leaderboard on random cities is the point where the spread starts to matter.

## Exploits of overtime and the time-up share

- **No-delivery farms: all 0.** 8 farm-probe runs, farm-loop, and 15 smart-farm runs (near, line, pickup, pickupline, spendpickup) on seeds 22, 58 and 130. Overtime does not start without a parcel, and the time-up share needs one delivery.
- **Standard carry farm (gate): pass.** Capfarm with a farm phase of up to 60 s. Points a minute over the 3 seeds: honest 1,838, carry 781 (**0.42**), both 0 on two seeds. The carry farm on seed 22 still scores Silver (3,151) with 2 drops, as in rounds 15 and 16. A parcel held past 1.6 times its par gets no overtime and no time-up share, so this farm gains nothing from the new rules.
- **Short farm phases (new probe, `otfarm17.sh`): a real leak, but small.** With a short farm phase (12 s), the leg stays inside the schedule window. Then the time-up share pays the farmed bank by the share of the leg flown.
  - Farming both legs with **one delivery** scores 2,243 (seed 130) and 2,356 (seed 22), above the 2,000 Silver line. The time-up share pays 845 and 793 of that. The best lazy honest run is 1,792 Bronze.
  - Carry with 12 s farm phases scores 2,345 to 3,537 with 2 to 3 drops. That is 0.85 of honest points a minute, but 0.72 of the honest score per run, so farming still loses to delivering.
  - Bug found on the way: the medal state is not updated after the time-up share. On the two one-delivery runs above, the game reports tier Bronze at a score over 2,000. The game-over card computes the medal from the score, but the saved best tier comes from the stale state.
- **Overtime cannot be chained or farmed.** It happens once a run. It adds no clock and gives no new job. It pays the bank by the share of the leg flown at the start of overtime, no more.
- **Overtime cuts a bank the player earned honestly.** The bank from the pickup leg rides on the parcel. When overtime starts soon after a pickup, the share of the drop leg flown is low, so most of that bank is cut. 52809 (real time): bank 205, share 16 percent, paid 20, cut 185. The pop says "street bonus +20 (16%)" with no reason given.

## Gates on seeds 22, 58, 130 (real time, one pass)

| Run | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low (music-run) | 3,779 Silver, 4 drops | 4,435 Silver, 5 | 3,837 Silver, 4 | 12,051 |
| High | 4,275 Silver, 7 | 2,774 Silver, 6 | 2,758 Silver, 6 | 9,807 |
| Lazy | 1,478 Bronze | 1,554 Bronze | 1,063 Bronze | 4,095 |

- Low / high **1.23** (needed 0.85).
- Breakdown exact: diagnostics, game-over rows and total agree in all 41 real-time runs (bdOk and domOk true). The new "Last leg" row adds up.
- Rush hour starts at 60.0 s in every run that passed 60 s (36 runs).
- No-delivery farms 0. Carry farm 0.42 of street points a minute.

## Regressions

- **Crash-classify, 8 seeds (11, 22, 33, 44, 7, 58, 91, 130):**
  - 12 m: 337 s, 33 charged, **0 hop-like**, 5 near the target, **0 on a pad lip**. All near-target hits were faces 3.3 to 15.1 m below the top.
  - 20 m: 366 s, 21 charged, 1 flagged hop-like, 5 near, **0 pad lip** (faces 2.4 to 7.3 m below the top). The flagged one is seed 130 at 30.7 s: a street-level hit into a shop front at 1 m/s, with a 1.2 m bounce (N-alt20-seed130-t30.7-near). That is a real wall hit.
  - Sim time is about half of round 16, because the shorter clock ends the beeline bot's runs sooner.
- **Flat-frame probe:** 1,042 frames, 0 flat, 0 errors.
- **Music:** adaptive. Chain 0 to 3 gives 1 to 4 layers (mean intensity 0.31 to 0.86). Overtime goes to layer 5. The final section starts at 9.95 to 9.97 s left. 0 late notes, 0 resyncs, 0 errors.
- **Hand-fly first payout:** desktop **6.4 s**, mobile **7.1 s** (round 16: 7.2 and 9.9).

## As a player (desktop and iPhone 13 held sideways, touch)

- **Is overtime exciting and readable?** Readable, yes. The timer turns into a gold "OT 11" pill. An "Overtime" banner, a horn, and the top music layer follow. The finish pays a big "+525 Made it! overtime delivery" (E-d-seed14523-ot-madeit). On iPhone the gold pill is the clearest thing on screen (E-m-seed52809-ot-start). Exciting, only a little. Overtime was won 16 of 16 times by the street bots and 11 of 12 by the lazy bot, with seconds to spare. It feels like a lap of honour, not a last sprint.
- **Messages collide at the busiest moment.** Overtime often starts just after a pickup. The "Rush order!" pop then lands on top of the overtime banner. It hides the banner line "11 s to finish this delivery · no new jobs" (E-d-seed14523-ot-start). A rush order also replaces the "Last call!" pop, so the player is never told that the job adds no time (E-d-seed88700-lastcall). On iPhone, the last-call pop did not show at all in our shot (E-m-seed52809-lastcall).
- **Is the ending fair now?** Mostly, yes. A run no longer ends with a fresh rooftop job you cannot finish. A parcel aboard always gets a fair try. The game-over card says "Time's up" even after "Made it!", which undersells the finish. The ending that still stings is the clock running out 10 to 30 m from a pickup. Nothing on screen says why that run got no overtime (E-d-seed95387-clock0).
- **Medal ladder.** Bronze 1,000, Silver 2,000, Gold 4,500, Ace 9,000. A steady pilot gets Silver or Gold. Gold now feels reachable and earned. Ace is far, which is right.
- **Mobile title:** the city buttons still look about 25 px tall on iPhone 13 held sideways (m-h01-title). On one iPhone shot the nav distance label sits on the "FLY" stick label (E-m-seed52809-lastcall).

## Whole game, against the best polished indie arcade flying and delivery games

- **First 10 seconds:** strong. A warm toy city in four light moods, a clear title, a quick first payout.
- **Onboarding:** good. First payout in 6 to 7 s on both devices.
- **Game feel:** still the best part. Momentum, banking, the camera lean, wall drafting.
- **Core loop:** pick up, draft, deliver, chain. Now balanced. The street line beats the beeline, the score is flat per drop, and farms do not pay.
- **Ending:** fair now, with a short overtime and a part-pay of the bank.
- **Art and audio:** coherent and finished. Adaptive music with a real overtime layer.
- **UI:** clean in normal flight. Busy at the end of a run. There, four rules (last call, rush order, overtime, bank share) speak in the same few seconds.
- **Depth and replay:** this is where it falls behind. The best games of this kind give each run choices and surprises: shortcuts through gaps and arches, a risky line under a bridge, districts that fly differently, set pieces that change mid-run. Here every city is the same street grid with new colours. On a grid every monotone route has the same length, so there is no route to choose. The skill is cornering and staying near walls, and after three or four runs a player has seen all the city has. Rush hour adds orders but nothing changes in the world.

## Single biggest remaining gap: no route choice and nothing new in the world

**The concern.** The loop is now balanced and fair, so the limit is what a run asks of the player. Every leg is a corner-to-corner drive on a uniform grid. Because all monotone grid routes are the same length, the "street line" is one choice repeated, not a decision. Cities differ in light and building mix, not in how they fly. A run at 2:30 looks and plays like a run at 0:30. That caps replay pull below the best arcade flyers, where reading a shortcut is half the fun.

**Evidence:**
- On all 12 cities, the street bot's legs are 45 to 200 m of grid with the same corners. The only city-to-city difference that matters is how many corners and pad exits a leg has.
- The beeline bot crosses the same cycles in 49 to 58 s against 70 to 98 s for the street bot. But it scores less (2,663 to 5,122), because the only alternative to the grid is flying over it, with no draft.
- Mood shots across rounds 16 and 17: four light moods on one grid, same props, no landmark to steer by.

**Acceptance test** (measurable, the build is the builder's choice):
1. On 12 fresh cities, at least 1 in 3 legs has a draftable alternative to the plain grid route. The alternative is at least 15 percent shorter. Examples: an alley, an arch, a passage through a block, a gap between towers, a low bridge. Verify with a probe that measures the route length of the alternative against the best grid route for each leg.
2. A routed bot that takes those alternatives beats the plain street bot by at least 10 percent in leg time on those legs. It must not have more charged crashes (deterministic, the same 12 cities).
3. Six fresh loads show at least 3 kinds of feature a player can name. Each is visible in the title shot or the first 10 s of flight.
4. Something in the world changes at rush hour (60 s) that a screenshot can show. Examples: traffic, a closed street, a new open gap.
5. No regressions. The round 17 guards above still pass. No-delivery farms score 0. The carry farm stays under 0.5. Low over high is at least 0.85. The breakdown is exact. Crash-classify shows 0 pad lip hits. Hand-fly first payout comes within 10 s.

## Other gaps (ranked)

1. **The end-of-run messages collide and do not explain themselves.** The Rush order pop covers the overtime banner (E-d-seed14523-ot-start). A rush order hides "Last call!" (E-d-seed88700-lastcall). "Street bonus +20 (16%)" gives no reason. The card says "Time's up" after "Made it!". Test: in 12 full runs on desktop and iPhone held sideways, no two centre messages are on screen at once. Every last-call pickup shows "no time bonus", including rush orders. Any bank cut says why in plain words. A run that ends on an overtime delivery has its own card title.
2. **The pickup edge.** 8 of 20 real-time street runs ran out of clock 26 to 38 m from a pickup. They got no overtime. Each lost a final drop worth 330 to 1,160. Test: at most 3 of 12 real-time street runs end in the pickup phase within 40 m. Or: before the clock reaches 0, the screen says why there will be no overtime.
3. **One delivery can earn Silver, and the medal state goes stale.** A 12 s farm on both legs with one delivery scores 2,243 and 2,356. Of that, 793 to 845 comes from the time-up share. The tier stays Bronze in the game state. Test: the capfarm "both" mode with FARMMAX 12 on seeds 22, 58 and 130 stays under 2,000. After every game over, the tier state equals the medal of the final score.
4. **Overtime is too safe to thrill.** It was won 27 of 28 times by bots, with 2 to 10 s to spare. Test: the street bot finishes 60 to 85 percent of overtime windows on 12 cities. No window is impossible: it gives at least the route left at 9 m/s.
5. **Mobile title and labels.** City buttons about 25 px tall on iPhone 13 held sideways (asked for 40 px since round 15). The nav distance label overlaps the "FLY" label. Test: buttons at least 40 px tall. No HUD label overlaps another in a full mobile run.

## Performance

Headless Chromium caps at 120 Hz (8.3 ms).
- Hand-fly desktop 1280x720, 80 s: 9,578 frames, **median 8.30 ms, p95 9.70, max 10.4, 0 over 20 ms**.
- Hand-fly iPhone 13 held sideways, touch: 9,579 frames, **median 8.30, p95 9.60, max 10.4, 0 over 20 ms**.
- First load, production build to a scratch folder: **about 0.79 MB** (JS 747 KB, 200 KB gzipped. CSS 34 KB. HTML 10 KB). lil-gui 31 KB only for `?debug`. Budget 15 MB: pass.
- Page errors: 0 in every run.

## Screenshots (progress/round-17/critic/)

- Overtime and ending, desktop: E-d-seed14523-lastcall, -clock0, -ot-start (banner under the rush pop), -ot-mid, -ot-madeit, -over (Gold card). E-d-seed88700-lastcall (rush order hides last call). E-d-seed95387-clock0 (clock out 25 m from a pickup). E-d-seed55211-over.
- Overtime and ending, iPhone 13 held sideways: E-m-seed52809-* (lastcall, ot-start, ot-mid, ot-madeit, over), E-m-seed16805-*, E-m-seed15493-*, E-m-seed68665-over (ended at a pickup, 249 short of Gold).
- Clock at 0.5 s left, deterministic street bot, all 12 cities: O-low-seed*-timeout.
- Medal moments: M-low-*, M-high-*, M-low-c10-* (lazy).
- Crashes near the target: N-alt12-*, N-alt20-* (N-alt20-seed130-t30.7-near is the flagged hop). Bot crash shots: P-high-*, Q-high-*.
- Farms: F-farm-*, S-smartfarm-*, C-capfarm-* (the carry and both shots were overwritten by the short-farm probe). Hand-fly: d-h*, m-h*.

## Scripts and logs (progress/round-17/critic-scripts/)

- Copies of all round 16 scripts, unchanged. Their output folder `../critic/` now points at round 17.
- New scripts:
  - `route-play-rt-x-m-esc17.mjs`, `balance-probe-m-esc17.mjs`: the round 16 real-time street and lazy bots plus one log-only END line (overtime, share, cut, last leg). Control logic identical.
  - `route-legs17.mjs`: route-legs16 plus log-only ending detail. It logs the distance and bank at the moment the clock first hits 0, and the score-log ending entries.
  - `ot-shots.mjs`: route-legs17 control with ending screenshots, desktop and `MOBILE=1`.
  - `legs-summary.py`: per-city leg speed, cycle distance and ending from the legs logs.
  - `det17.sh`, `det17b.sh` (beeline and quick-corner controls), `queue17.sh`, `repeat17.sh`, `otfarm17.sh` (short-farm exploit probe).
- Acceptance logs: acc-low, acc-lazy, rep-low. Deterministic street: legs-a, legs-b, legs-c. Controls: legs-high-a/b, legs-c11-a/b.
- Other logs: ot-d, ot-m, m-low-a, m-high-a, m-lazy-a, ccv12, ccv20, farm-*, farmloop-22, smart-*, capfarm-*, otfarm-*, hf-desktop, hf-mobile, flat, pick-seeds.
- Order: the deterministic batch ran first. The real-time queue started once while the control runs were still going. I stopped it after 30 s, discarded that log (`acc-low-contaminated.log`), and restarted it alone. The short-farm probe (`otfarm17.sh`, deterministic, priority 19) ran alongside the first real-time street runs. Those runs match their deterministic twins within normal noise.
