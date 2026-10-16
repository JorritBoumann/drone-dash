# Drone Dash: round 20 critic report

**Verdict:** The round 19 gap is mostly closed. Every marked alley or tunnel now has an arch with its name, and the HUD tag points at it from the first frame. The hint always matches the board. A bot that follows only the marks gains 9% on those legs, almost as much as a bot that knows the street map (12%). It misses the 15% line because shortcuts now save only about 10% of real time. Two checks fail narrowly: one fresh city gives the street pilot Bronze twice, and 5 of 28 marked legs do not show the arch itself within 3 s. Low over high passes at 1.81, but that now means the roof line is far too weak. After 20 rounds, the bot metrics tell us little that is new. The next step is a human playtest, not another tuning round.

Build tested: commit f52e1b9 plus the uncommitted round 20 changes. Dev server on port 5188, stopped at the end. Every browser ran alone, one at a time. The deterministic batch ran first, then a strict real-time queue.

Scripts are in `progress/round-20/critic-scripts/`. They are round 19 copies. Only the output folders changed: they write to the relative `../critic/`. I edited the absolute path in `legs18.py` and `legs19.py`. New this round:
- `route-sign20.mjs`: route-feat19 plus a sign-following bot and per-leg mark logging. The grid and shortcut bots keep their control.
- `legs20.py` and `rt20.py`: summaries.
- `overlap-init.js` and `hand-fly20.mjs`: hand-fly plus a 10 Hz HUD overlap sampler. Log-only.
- `det20.sh`, `rtqueue20.sh`, `rtjobs.txt`, `chain20.sh`: the run order.

Fresh cities, from a seeded random draw, checked against all earlier progress files and builder scripts: 30397, 67861, 71635, 73297, 18304, 20024, 41556, 38060, 21060, 15384, 20323, 55608.

## Part 1: acceptance test

### Route marks

The sign bot never sees the street graph. It flies the plain street grid to the street in front of the marked arch. Then it flies straight through to the exit arch, out to the street, and along the grid to the pad marker. If the game moves or drops the mark, it re-plans from the new mark or from the grid.

| Test (12 fresh cities, deterministic) | Needed | Result | Pass |
|---|---|---|---|
| Marked legs | | Grid bot run: 84 legs. 35 have an alley or tunnel on the shortest route. 28 are marked at the start | |
| Arch in view within 3 s, or by 80 m | every marked leg | Grid bot 23 of 28. Shortcut bot 34 of 36. Sign bot 25 of 25 | **No, near miss** |
| HUD tag on screen at leg start | | 0.0 s on every marked leg, all bots (in the frame or as the edge arrow) | Yes |
| Hint matches the world board, same instant | every leg | 55 of 55 legs with the pill visible: same name, same kind | Yes |
| Tunnel marked to a raised pad | 0 | 1 leg | Small fault |
| Sign bot faster than grid bot on marked legs | 15% | **9.2%** on 23 matched legs (307 s against 338 s) | **No** |
| Sign bot crashes | at most 0.5 a minute | 0.05 a minute overall. 0.20 a minute on marked legs | Yes |
| Shortcut bot gain on the same legs | report | 11.7% on 25 matched legs. 10.3% on legs with a 15% alley or tunnel cut | |

- **The 5 misses** all start next to the mark, 9 to 27 m away, with the arch behind or beside the camera. On three, the arch came into view at 3.05 to 3.55 s. On two tunnel legs it never did, because the grid bot flew another way. The edge arrow pointed at the arch from 0 s on all five. So the player is always told where to go. The arch itself is not always in view.
- **Unmarked legs.** The 7 unmarked alley legs save under 10 m or under 8%, as designed. Three legs that also take a boulevard get the "Fast lane" hint and no arch.
- **Do alleys still save real time?** Yes, but less. The street-graph bot is 8.5% faster than the grid bot over all legs. On marked legs it is 10 to 12% faster. In round 19 it was 24% on cut legs. The marks now skip alleys that save little. A fast pilot must also brake into the slot. The sign bot gains 9%, close to the graph bot. So the marks work. The shortcuts themselves are now worth about 10%.
- **The mark is not steady.** On 84 sign-bot legs, the game re-planned the mark 17 times. It dropped the mark 7 times before the bot reached the entrance. 8 legs showed more than one name. A typical case is city 30397. Two alleys lie in one column. The mark jumps between them. Then it vanishes while the drone is inside the first alley, and comes back as "Way out". A player who follows the sign sees it change its mind.
- **Shortcut bot crashes:** 0.33 a minute overall (8 in 1,460 s: 6 alley, 2 tunnel). Round 19 was 0.62. On marked legs alone it is 1.09 a minute. The alley exits are better but not fixed.
- **Deterministic scores:** grid bot 1,719 to 5,015 (Bronze on 38060 and 20323). Shortcut bot 2,459 to 8,782 (Gold on 4). Sign bot 2,189 to 4,391 (all Silver).

### Guards (real time, one run at a time)

| City | Street | Lazy |
|---|---|---|
| 30397 | 3,199 Silver | 976 none |
| 67861 | 3,214 Silver | 956 none |
| 71635 | 2,831 Silver | 683 none |
| 73297 | 2,910 Silver | 675 none |
| 18304 | 2,345 Silver | 851 none |
| 20024 | 4,917 Gold | 877 none |
| 41556 | 3,299 Silver | 1,021 Bronze |
| 38060 | 2,601 Silver | 682 none |
| 21060 | 3,624 Silver | 840 none |
| 15384 | 3,263 Silver | 867 none |
| 20323 | **1,767 Bronze**. Rerun 1,752 Bronze | 1,252 Bronze |
| 55608 | 2,275 Silver | 898 none |

- **Street Silver: 11 of 12. Fail.** City 20323 gives Bronze in both real-time runs and in the deterministic grid run (1,835). Its street bonus is low (655 to 679 points). This is a city effect, not machine load.
- Lazy Bronze or below: 12 of 12. Pass.
- No Ace: best score of anything is 8,782 (shortcut bot). Best real time is 4,917. Pass.
- Best lazy 1,252 against worst street 1,752: gap 500. Pass.

### Gates (seeds 22, 58, 130, real time)

| Run | 22 | 58 | 130 | Total |
|---|---|---|---|---|
| Low (music-run) | 3,867 Silver, 4 drops | 2,798 Silver, 3 | 4,104 Silver, 3 | 10,769 |
| High | 2,063 Silver, 5 drops | 1,519 Bronze, 3 | 2,384 Silver, 5 | 5,966 |

- **Low over high is 1.81.** It passes the 0.85 line. **But the roof line is now far too weak.** On 22 and 130 the high line delivers more parcels and scores about half as much. Street bonus is 53 to 65% of every low score. It is 6 to 13% of every high score. The ratio went from 0.78 to a reported 1.65 and now 1.81. The score now pays more for flying style than for delivering.
- **Carry farms.** The table gives points a minute against the honest run in the same controller.

| Farm | 22 | 58 | 130 |
|---|---|---|---|
| Old carry farm (60 s cap) | 0.35, 1 drop | 0, 0 drops | 0.32, 1 drop |
| Alley 12 s | **0.87**, 3 drops, Silver | 0.60 | 0.51, 2 drops, **Silver** |
| Alley 25 s | 0.21 | 0.20 | 0.15 |
| Tunnel 12 s | 0.61 | 0.64 | 0.45 |
| Tunnel 25 s | 0.33 | 0.24 | 0.32 |
| Van 12 s | 0.80 | **0.86** | 0.77 |
| Van 25 s | 0.54 | 0.61 | 0.69, 2 drops, **Silver** |

  The new stale rule kills long farms: the 25 s farms fell to 0.15 to 0.69. Short 12 s farms are unchanged at 0.45 to 0.87. Two runs with only 2 drops still reach Silver. No farm beats honest flying. Part 2 explains why the 12 s line is a weak test.
- One-delivery runs: all Bronze or below (best 1,112). Pass.
- No-delivery farms: 0 on every run (farm-probe on 22, 58, 130, farm-loop, smart-farm near and spendpickup). Pass.
- Breakdown exact, and the card matches the score, in all 31 real-time runs. Pass.
- Rush hour started at 60.0 s in every run that reached it. Pass.
- Overtime started and finished with a drop once (high line, 22). Pass.
- Saved medal: after a reload, the title best and tier equal the card on 22, 58 and 130. Pass.

### Regressions

- **Crash-classify at 12 m:** 611 s, **66 charged crashes (6.5 a minute, round 19: 4.6)**. 18 near the target. The closest face is 2.7 m below the wall top, so 0 pad lips. One rise of 1.3 m without climb (seed 58) hit a face 12.7 m below the top: a wall hit, not a lip.
- **Crash-classify at 20 m:** 676 s, 46 charged (round 19: 32), 11 near the target, faces 2.7 m or more below the top, 0 hop-like.
- Pass on pad lips. But the same blind bot hits about 40% more walls than in round 19. I did not find the cause. The arches are not colliders. This needs a builder check.
- Flat-frame probe: 991 frames, 0 flat, 0 errors. Pass.
- Music: chain 0 to 3 gives layers 1 to 4 on all 3 low runs. Mean intensity rises from 0.35 to 0.86. The final layer starts in the last 10 s. Pass.
- Hand-fly first payout: desktop **5.7 s**, mobile **6.7 s**. Pass.
- **iPhone pops against the meters: pass.** In 250 s of real touch play (two runs), no centre pop touched the slipstream meter, the boost meter or the cue line.
- **New iPhone overlaps.** At leg start the hint matters most, and centre pops sit on the route hint pill then (`long-m-ov1.jpg`). The sampler counted the pickup pop on it 54 times, the event pop 32, the medal pop 12. The pad marker, clamped to the bottom edge, sits on the slipstream meter. The gate tag, clamped to the right edge, slides under the Boost and up and down buttons (`long-m-ov3.jpg`). On the left edge the pad marker sits on the "FLY" stick label (`m-h04-low-payout-pop.jpg`). My sampler missed the edge markers. I found them in the screenshots.

## Part 2: a step back

### (a) Which bot metrics still mean something

Still worth tracking. Each one measures something a player meets directly:
- **No-delivery farm scores 0.** A real exploit test. A curious player will try circling for points.
- **First payout time.** It is how the first 10 seconds feel.
- **Crash classification near pads.** A crash you did not cause is the worst feeling in an arcade game.
- **Frame times, load size, flat frames, page errors.** Plain facts.
- **HUD overlap on a phone.** Plain facts. This round it caught the edge markers on the controls.
- **Breakdown exact, card equals score, saved medal.** Trust in the score.
- **Mark on screen, hint matches board.** These show that a sign exists. They do not show that a person reads it.

Now mostly noise, or tuned to the bots' own quirks:
- **Low over high.** It compares two scripted pilots: a grid bot at 7 m and a straight line at 40 m. No person flies either line. It uses three seeds, one run each, 3 to 5 drops a run. One extra drop moves a total by 10 to 20%. That is why it swung from 0.78 to 1.81. Tuning to it pushed the score toward style over deliveries.
- **Carry farm ratio at 12 s.** A 12 s detour through an alley looks the same as a slightly poor honest route. The ratio cannot fall far without punishing ordinary mistakes. It failed in several rounds because it measures the per-leg cap, not an exploit. No farm beat honest flying in any round since round 14.
- **Medal lines set by the grid bot.** The grid bot is one skill level that never learns. Whether Silver feels earned is a human question.
- **Shortcut gain and crash rate of my bots.** They measure my bots' cornering as much as the game. One braking rule made the sign bot crash about 5 times less than the graph bot on marked legs.
- **Single real-time runs.** Round 19 lost two guard runs to machine load. One run per city is a thin sample.

### (b) Would a human playtest teach more than another bot round?

Yes, clearly. The open questions are now about what a person sees and feels. No bot can answer them:
- Can a new player read an arch at 15 m/s and turn into it?
- Does the "Off route" rule feel fair, or like the game taking points for no reason?
- Do the many layers (street bonus, chain, bank, boost, combo, rush, overtime, stale, shortcuts, medals) read as one game or as noise?
- Does a delivery feel worth more than flying style? Today it is worth less.
- Is Silver on a first run too easy, about right, or out of reach?
- Do people press "Fly again"?

Five people, two runs each, with a screen recording and three questions afterwards, will teach more than five more bot rounds.

### (c) The whole game against the best indie arcade flying and delivery games

- **First 10 seconds:** strong. A pretty title, one key to start, a first payout in about 6 s.
- **Onboarding:** a weak point. Every system is explained by a text pop, and there are many systems. Good games of this kind teach one verb, then add the next. Here the first minute shows slipstream, banked bonus, chain, combo, shortcut, clock frozen and rush hour.
- **Core loop:** pick up, thread the streets, drop. Sound. But the score now pays more for style than for the job. The best games keep the job as the main reward and style as the bonus.
- **Game feel:** the best part. Wall-hugging draft in narrow streets and alleys is a real hook. Braking into a slot and bursting out feels good.
- **Art:** a warm, cohesive low-poly city with good light. The arches read well. This is at the level of a good indie game.
- **Audio:** adaptive music that climbs with the chain, and a clear medal fanfare. Good.
- **UI:** clean on desktop. Busy on a phone. Two pills, a tag, a pad marker, two meters, a cue line and touch controls share a small screen. The edge markers now land on the controls.
- **Difficulty curve:** flat. Rush hour at 60 s is the only step, and every run is about the same length. The best games ramp inside a run (more traffic, tighter windows) and across runs (new districts, new drones).
- **Run variety:** random cities and a daily city. But every city plays alike: a grid, some alleys, a boulevard, the same jobs.
- **Replay pull:** medals, a daily best and a real score ceiling. But nothing unlocks and nothing carries over. The best games give a reason for the next run beyond a number.

Overall, the moment-to-moment flying is close to the bar. Structure, onboarding and progression are well below it. The scoring is now tuned past the point where tuning helps.

### Next steps, ranked

1. **Freeze scoring and balance, and run a human playtest:** 5 players, 2 runs each, desktop and phone. Needs a human.
2. **Make delivery the main reward again.** Keep the street bonus well under half of a run's score, so the drop count leads. Judge by feel, not by low over high. Needs a human to judge.
3. **Teach in layers.** The first run shows only fly, pick up, drop and the clock. Slipstream comes on the second leg, shortcuts on the third, rush on run two. Needs a human to judge.
4. **Fix the phone HUD.** Keep the edge markers clear of the meters and touch buttons. Keep centre pops off the hint pill. A bot can check this.
5. **Steady the route mark.** No jump between neighbour alleys, and no drop while inside the marked run. A bot can check this.
6. **Give runs a reason to differ.** One or two of: districts with their own rules, a traffic ramp inside the run, a goal list or unlocks. Needs a human to judge the fun.
7. **Check two regressions:** 40% more crash-classify wall hits, and a 200 to 280 ms hitch on phones. A bot can check these.

## Performance

Headless Chromium caps at 120 Hz.
- Flight through 2 tunnels, 2 alleys and a boulevard (`perf18.mjs`, 12.5 s). Desktop: 1,499 frames, median 8.3 ms, p95 9.2, max 16.7, 0 over 20 ms, 74 draw calls, 254k triangles. iPhone 13 (wide view): median 8.3, p95 9.4, max 16.4, 0 over 20 ms, 58 draw calls.
- Hand-fly 80 s, desktop: 9,570 frames, median 8.3, p95 9.6, max 17.2, 0 over 20 ms.
- Hand-fly 80 s, mobile: 9,544 frames, median 8.3, p95 9.6, **max 283 ms**, 2 over 20 ms. The long mobile run had max 208 ms, 1 over 20 ms. Round 19 max was 24.7 ms. One long hitch per mobile run is new. My guess is the first board texture or arch build.
- First load, production build: about 0.83 MB. JS 778 KB (214 KB gzipped), CSS 37 KB, HTML 11 KB. lil-gui (31 KB) loads only with `?debug`. Type check clean. Page errors 0.

## Screenshots (progress/round-20/critic/)

- `T-sign-seed*`: the sign bot at marked alleys and tunnels (arches, name boards, HUD tag). For example `T-sign-seed55608-tunnel1.jpg`, `T-sign-seed30397-alley1.jpg`.
- `T-feat-seed*`: the shortcut bot in features. `P-feat-*`, `P-sign-*`: their crashes.
- `long-m-ov1..4.jpg`: iPhone overlaps (pickup pop on the hint pill, pad marker on the slipstream meter, gate tag under the touch buttons).
- `d-h*`, `m-h*`, `long-m-h*`: hand-fly desktop and iPhone (title, first draft, first payout, chain).
- `M-low-*`, `M-high-*`, `Q-high-*`: gate medal moments.
- `C-capfarm-*`, `C-capfarm19-*`, `F-farm-*`, `S-smartfarm-*`: farms.
- `N-alt12-*`, `N-alt20-*`: crash-classify crashes near the target.

## Order and load

The deterministic batch ran 09:52 to 10:00, one browser at a time. The real-time queue ran 10:00 to 11:02, one job at a time, with nothing else of mine running. Machine load from other processes was 3 to 5 on 10 cores.
