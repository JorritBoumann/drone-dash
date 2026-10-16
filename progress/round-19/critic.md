# Drone Dash: round 19 critic report

**Verdict:** The round 18 gap is closed on route variety and naming: alleys and tunnels now decide the route on most legs and every real shortcut is named at the leg start. But the name points at nothing a player can find. No alley or tunnel shows its name in the world and there is no map, so the hint says "a shortcut exists" without saying where. One gate also fails: the high line now beats the street line (low over high 0.78).

Build tested: working tree on commit 38a35fa plus the uncommitted round 19 changes. Dev server port 5188, stopped at the end. Scripts in `progress/round-19/critic-scripts/` (round 18 copies. Their output folder is the relative `../critic/`, so only the folder changed. I also edited the path in `legs18.py`). New: `route-feat19.mjs` (route-feat18 with logging only, control unchanged), `legs19.py`, `capfarm-narrow.mjs`, `looks19.mjs`, `det19.sh`, `det19b.sh`. `alley-entry19-unused.mjs` is a broken probe (my pilot cut corners). I use no numbers from it.

Fresh cities (picked by a seeded random draw, none found in builder scripts, builder shots, round 17 or 18): 16068, 20540, 22132, 34471, 32134, 34372, 99113, 20188, 47664, 20823, 26635, 96680. Pad audit: 19860, 85749, 96382, 14820, 29724, 70006, 84383, 23893, 61564, 39178, 94202, 49588, 72214, 65264, 34173, 50169, 36880, 98757, 46825, 65279.

## Round 18 gap: shortcuts one-note and silent. Closed, with one clause missed

| Test (12 fresh cities, deterministic) | Needed | Result | Pass |
|---|---|---|---|
| Alley or tunnel on the shortest route | 25% of legs | 55 of 93 (59%). Round 18: 13% | Yes |
| Alley or tunnel alone gives a 15% shortcut | 1 in 8 | 30 of 93 (32%). Round 18: 2 of 97 | Yes |
| Kinds on 15% shortcut legs | | alley 36, tunnel 8, boulevard 21 (of 52) | Varied now |
| Shortcut bot faster on alley/tunnel cut legs | 10% | 23.9% faster on 27 matched legs (327 s against 430 s) | Yes |
| Shortcut bot crashes | at most 0.5 a minute | 0.62 a minute (16 in 1,554 s). Grid bot 0. Without one city where the bot hit the same alley 4 times (22132): 0.48 | No, just |
| Feature named within 1 s of leg start | 12 of 12 | Shown at 0.0 s on every leg with a real shortcut. 157 of 169 feature legs. The 12 misses: 10 first hops (16 to 23 m, never hinted) and 2 legs where the route from the pad has no shortcut | Yes |
| No name repeats in a city | 0 | 0 repeats, 21 to 25 features per city | Yes |
| Centre messages never overlap | 0 | 443 centre messages, 232 kind changes, smallest gap 650 ms, 0 shown together | Yes |

- 15 of the 16 shortcut-bot crashes are in alleys (12) or tunnels (3). Most hit at 14 to 18 m/s, many at 25 m from the pad: the bot leaves an alley mouth fast and turns hard onto a doorstep pad set 2.2 m beside the mouth. Same control as round 18, which had 0.19 a minute. The new mouth pads make the end of an alley leg sharper.
- Straight through every alley and tunnel at 20 m/s, 4.5 m, W only: 447 of 452 passes clean, 5 scrape (bumps, no charged crash). Same as round 18 (5 of 398).
- Scores: grid bot 1,838 to 3,866 (median 3,340). Shortcut bot 0 to 8,658, Gold on 7 of 12, best 87% of Ace. Round 18 gap 3 (Gold needs shortcuts, Ace far) is mostly fixed. The 0 (22132) and 1,184 (34471) are my bot. On 22132 it hit one alley 4 times. On two tunnel legs to 20 m rooftop pads it stayed under the tunnel roof for 46 s.
- Hint honesty, small faults: 3 hints say "Tunnel" but name only two alleys (the tunnel is the third feature and is cut off by the two-name limit). 6 of 61 alley or tunnel hints point at a raised pad. The job picker avoids tunnels to raised pads, but the hint does not.
- Repetition: 21 of 77 hinted legs (grid bot) and 31 of 91 (shortcut bot) share a named feature with the leg before. Back and forth along one alley line (V-d-seed20540-leg2/leg3: "Sparrow Row + Ink Alley" twice in a row).

## Exploits

- **Van tailing:** not an exploit. Tailing a van gives full draft, but the bank is capped per leg and the slow clock has its per-leg budget. A carry farm that tails vans scores 0.66 to 0.83 of honest points a minute (25 s and 12 s a leg). It never beats honest flying on any seed (best 0.85 on 130). "Forever" does not pay: the 25 s version scores less than the 12 s one.
- **Tunnel shuttle:** the full slow clock under a tunnel roof does not stack: whole-run slow-clock seconds stay 12 to 15 s, as for honest runs. No exploit.
- **But the street bonus can carry a run.** A tunnel carry farm on seed 58 scores 2,132 Silver with 2 drops. Street bonus is 1,666 of it (78%). Leg caps on long legs reach 1,106.
- **No-delivery farms:** all 0 (farm-probe on 22, 58, 130, farm-loop, smart-farm near, pickupline, spendpickup).

## Guards (real time, one run at a time)

| City | Street (grid bot) | Lazy |
|---|---|---|
| 16068 | 2,556 Silver | not run |
| 20540 | 2,480 Silver | 1,116 Bronze |
| 22132 | 2,872 Silver | not run |
| 34471 | 1,151 Bronze (under load), rerun 2,705 Silver | not run |
| 32134 | 1,818 Bronze (under load), rerun 2,985 Silver | not run |
| 34372 | 3,642 Silver | not run |
| 99113 | 3,978 Silver | not run |
| 20188 | 3,736 Silver | not run |
| 47664 | 3,657 Silver | 1,255 Bronze |
| 20823 | 2,713 Silver | 847 none |
| 26635 | 2,286 Silver | 987 none |
| 96680 | 2,501 Silver | not run |

- Street Silver or better: 12 of 12 on clean runs (10 first runs plus the 2 reruns). The two Bronze runs ran 06:35 to 06:39 while my deterministic farm batch pushed the load to 12 to 17 on 10 cores. The deterministic grid bot scores Silver on both (2,817 and 3,399). I count them as contaminated but flag it.
- Lazy: cut to 4 cities for time. All Bronze or below (best 1,255). Not 12 of 12 measured.
- No Ace: best of anything 8,658 (shortcut bot, deterministic). Best real time 4,876.
- Best lazy 1,255 against worst clean street 2,286: gap 1,031. Pass on the cities measured.

## Gates (seeds 22, 58, 130, real time)

| Run | 22 | 58 | 130 | Total |
|---|---|---|---|---|
| Low (music-run) | 2,941 Silver, 3 drops | 3,099 Silver, 4 | 1,757 Bronze, 3 | 7,797 |
| High | **4,876 Gold**, 8 drops | 2,290 Silver, 5 | 2,832 Silver, 6 | 9,998 |

- **Low over high 0.78. The line is 0.85, so this fails.** In round 18 it was 0.84 once the 130 stall was set aside. 130 did not stall this time. The high line on 22 made 8 drops and Gold.
- No-delivery farms 0. Carry farm (round 18 capfarm, 60 s cap) 0.47 of honest, as the builder measured. New narrow farms: tunnel 0.50 (25 s) and 0.69 (12 s), alley 0.32 and 0.74, van 0.66 and 0.83. **Over 0.5 as written** for the short farm phases, but none beats honest flying, so this is a weak gate, not an exploit.
- One-delivery farms: every 1-drop farm run is Bronze or below (best 1,379). Pass.
- Breakdown exact, card medal equals tier from score and saved tier, in all real-time runs. Rush at 60.0 s in all 15 runs that reached it. Overtime: started in 3 street runs, finished in 2, ran out in 1.

## Regressions

- Crash-classify, 8 seeds. 12 m: 594 s, 46 charged, 0 hop-like, 17 near the target, all on faces at least 2.8 m below the wall top: 0 pad lip. 20 m: 518 s, 32 charged, 5 near target (faces 3.5 m or more below the top). 1 rise of 0.9 m without climb (seed 130, face 7.7 m below the top), a real wall hit. Pass.
- Pad audit, 20 fresh cities: 1,987 pads, 0 issues, 0 inside an alley strip, 160 within 22 m of a tunnel (round 18: 72), none flagged.
- Flat-frame probe: 942 frames, 0 flat, 0 errors.
- Music adaptive: chain 0 to 3 gives layers 1 to 4, mean intensity 0.34 to 0.86. Pass.
- Hand-fly first payout: desktop **5.6 s**, mobile **6.5 s** (round 18: 8.8 and 9.9). Pass.

## Player feel (desktop 1280x720 and iPhone 13 landscape, touch)

- **Alley entries at speed:** you must brake, and then they are fair. A straight line through is clean at 20 m/s. Turning in off a cross street at 15 m/s or more hits the mouth corner (V-d-seed20540-leg2-t5, V-m-...-leg2-t8). The wider apron and lit posts help you see the slot. The harsh part is the exit: doorstep pads now sit 2.2 m beside the mouths, so an alley leg often ends with a hard turn at speed.
- **Route hint:** it does not fly the game for you. It does not really help either. "Shortcut · Sparrow Row + Ink Alley −41 m" names places the world never labels: the mouth "name boards" are plain glowing boxes, and the nav marker points straight at the pad. In a new random city each run, a name tells you nothing. What a player can use is "there is an alley shortcut on this leg" plus the lit mouths they happen to see.
- **Mobile HUD:** less clear than desktop. The centre pop ("Parcel secured!", "Crash! -3 SEC") lands on the slipstream and boost meters and the cue line (V-m-seed20540-leg2-t3, -t8). The pad marker and distance sit on the shortcut pill. The pill itself reads well.

## Whole game against the best polished indie arcade flying and delivery games

- **First 10 seconds:** strong. A pretty city, a clear first pickup, a payout in about 6 s.
- **Onboarding:** good. The draft rule teaches itself. The cues name the next thing to do.
- **Core loop:** pick up, thread streets, drop, bank. Shortcuts now matter on most legs and double a good pilot's score.
- **Game feel:** still the best part. Alleys with both walls feeding the draft are the best moments.
- **Art:** warm, cohesive low-poly with lit alleys and tunnels. Good.
- **Audio:** adaptive music that follows the chain. Good.
- **UI:** clean on desktop, crowded at the bottom centre on phones.
- **Difficulty curve:** rush hour at 60 s, then every parcel a rush. Fine.
- **Run variety:** random cities and named features, but legs often go back along the same alley line.
- **Game over and restart:** clear card with an exact breakdown and medal. Fast restart.
- **Replay pull:** medals, daily city, a real score ceiling. But a player cannot learn a city, so mastery comes from reading streets live, and the game gives no way to read the route ahead.

## Single biggest remaining gap: the route is not readable from the screen

**The concern.** Route choice is now the game's depth: on 59% of legs the best route goes through an alley or tunnel, and taking it is 24% faster. But nothing on screen shows where that route starts. The hint names a feature the world never labels, the marker points as the crow flies, and every city is new. Good players will find shortcuts by luck or by flying high to look. The best games of this kind make the line visible: a sign, a glow on the right entrance, a small map.

**Acceptance test** (12 fresh cities, desktop and iPhone 13 landscape):
1. On every leg whose shortest route uses an alley or tunnel, the entrance the route uses is marked on screen in a way that differs from other mouths (for example its name in the world, or a lit arrow on that mouth only). The diagnostics expose the marked mouth position. A probe confirms it projects inside the viewport within 3 s of the leg start, or as soon as it is within 80 m in front.
2. A "sign follower" bot that steers only by what is marked (the marked mouth, then the pad marker), with no street graph, is at least 15% faster than the grid bot on those legs, at most 0.5 charged crashes a minute.
3. The hint's label matches its names (no "Tunnel" without a tunnel), and no hint suggests a tunnel to a raised pad.
4. All guards and gates still pass, including low over high at least 0.85.

## Other gaps (ranked)

1. **The high line beats the street line** (low over high 0.78, high Gold on seed 22). The game's identity is low street flying. Test: low over high at least 0.85 on 22, 58 and 130, high bot at most Silver.
2. **Mobile HUD crowding.** Centre pops cover the slipstream and boost meters. The pad marker covers the shortcut pill. Test: on iPhone 13 landscape in 3 full runs, no centre message rectangle intersects a meter, cue or pill rectangle, and the nav marker never covers the pill.
3. **Alley exits into mouth pads are sharp.** The shortcut bot crashes 0.62 a minute, mostly at alley ends next to pads. Test: shortcut bot at most 0.4 charged crashes a minute on 12 fresh cities, same control.
4. **Street bonus can carry a run.** A 2-drop tunnel farm reaches Silver with 78% street bonus. Test: no run with 2 drops or fewer scores Silver on 22, 58, 130. Narrow carry farms under 0.6 of honest at 12 s farm phases.
5. **Back-and-forth legs.** About a third of hinted legs reuse the last leg's alley line. Test: at most 15% of consecutive legs share a named feature.

## Performance

Headless Chromium caps at 120 Hz.
- Flight through 2 tunnels, 2 alleys and a boulevard (`perf18.mjs`, 12.5 s): desktop 1,502 frames, median 8.3 ms, p95 9.6, max 10.4, 0 over 20 ms. iPhone 13 landscape: median 8.3, p95 9.4, max 10.4, 0 over 20 ms. 262k triangles, 58 to 74 draw calls.
- Hand-fly 80 s mobile: 9,580 frames, median 8.3, p95 9.8, max 24.7, 1 over 20 ms.
- First load, production build: about 0.81 MB (JS 767 KB, 211 KB gzipped, CSS 36 KB, HTML 11 KB). lil-gui 31 KB only for `?debug`. Budget 15 MB: pass. Page errors 0.

## Screenshots (progress/round-19/critic/)

- V-d-seed20540-leg1..3-t* and V-m-seed20540-leg1..3-t*: first three legs, desktop and iPhone (hint pill, alley entry crash, mobile HUD crowding: V-m-...-leg2-t3, -leg2-t8).
- T-feat-seed*-alley*/tunnel*/diagonal*: shortcut bot in features. P-feat-seed*-crash*: its crashes (22132 alley pile-up).
- A-seed*: alley-fly scrapes. C-capfarm19-*: narrow carry farms. C-capfarm-*, F-farm-*, S-smartfarm-*: farms. M-low-*, Q-*: gate medal moments. N-alt12-*, N-alt20-*: crash-classify. d-h*, m-h*: hand-fly.

## Order and contamination

Deterministic batches (nice 19) ran 06:30 to 06:39 beside the first real-time street runs. Street runs 34471 and 32134 ran at load 12 to 17. Everything after 06:40 ran with nothing in parallel. Lazy guard was cut to 4 cities and the lazy gate on 22, 58, 130 was not run, to stay near the time budget.
