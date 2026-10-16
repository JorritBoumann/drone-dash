# Drone Dash: round 18 critic report

**Verdict:** Route choice is real now, but it is one-note. The diagonal boulevards make 33 of the 35 shortcut legs. The alleys and tunnels look great and fly cleanly. But they almost never change the best route. The game also never names or points out a shortcut. Both leftovers are closed. All guards and gates pass, with two notes: one street run under heavy machine load scored Bronze (clean reruns: Silver), and the high-line bot still stalls on seed 130 (a bot fault, explained below).

Build tested: working tree on commit 893b17b plus the uncommitted round 18 changes. Dev server port 5188, stopped at the end. Scripts in `progress/round-18/critic-scripts/`. The round 17 copies are unchanged: their output folder is the relative `../critic/`, which now points at round 18.

Fresh cities (loads with no `?seed`, none found in any builder script, builder shot or round 17 file): 44840, 66352, 86749, 69865, 66633, 54075, 81658, 53713, 39728, 82412, 43361, 40118. Pad audit adds 13051, 21382, 58825, 82579, 35020, 44243, 30287, 65430, 17060, 28610, 57888, 52131, 87301, 10869.

## Round 17 gap and leftovers

### Leftover 1: one-delivery farms reached Silver. Closed.
- capfarm "both" with 12 s and 20 s farm phases on seeds 22, 58, 130: best 1,639 Bronze (round 17: 2,243 and 2,356). Time-up share paid 0 in all of them (it now needs 2 drops).

### Leftover 2: stale saved medal. Closed.
- 24 deterministic runs (12 cities, two bots): run tier, tier from score, saved best tier and localStorage best tier agree 24 of 24. 6 of those runs were paid a time-up share.
- 41 real-time runs: state tier equals the tier from the score, and the game-over card names the same medal, 41 of 41.

### Round 17 gap: no route choice and nothing new in the world. Mostly closed.

| Test | Needed | Result | Pass |
|---|---|---|---|
| Legs with a draftable shortcut at least 15% shorter (12 cities) | 1 in 3 | 35 of 97 (0.36). Median saving 20%, range 15 to 34% | Yes, just |
| Which feature makes the shortcut | | Boulevard on 33 of 35. Alley or tunnel alone on 2 of 35 | (see gap) |
| Shortcut bot faster on those legs | 10% | 16.3% faster on 31 matched legs (427 s against 510 s). It flies about 22% less distance | Yes |
| Crashes per minute, shortcut bot against grid bot | not more | 0.19 a minute (5 in 1,612 s) against 0 (0 in 1,498 s) | No |
| Kinds of feature on 6 fresh loads | 3 | Every load has 4 boulevards, 7 to 18 alleys, 2 to 5 tunnels, plus 2 rush lanes | Yes |
| Rush hour changes something visible | yes | Two streets light up in amber with chevrons and hover-vans stream in (R-d-seed44840-rush-before and -after) | Yes |

How I measured: `route-feat18.mjs`, deterministic (external clock, 50 ms steps). FEAT=0 is the round 17 grid street bot, control unchanged. FEAT=1 is my shortcut bot with the same control. Each leg, it checks the shortest route on the game's street graph (the `streetRoute` hook). If that route is at least 3% shorter than the grid route, it takes it. It flies tunnels at 3.5 m and alleys at 5 m, and it merges straight-through boulevard stops so they do not count as corners. The first version did not merge them and was only 9.7% faster. That was my bot, not the game (`legs18-v1.out`). Legs are matched by from-pad and to-pad. Analysis: `legs18.py`, output `legs18.out`.

Is the graph honest about the geometry? `alley-fly18.mjs` flies straight through every alley and tunnel on the 12 cities, both ways, at 4.5 m, holding W only. 393 of 398 passes are clean at 14 m/s and again at 20 m/s. 5 passes (the same ones at both speeds) scrape a wall near one mouth and drop to about 2.7 m/s, with no charged crash. At least one is where an alley opens onto a boulevard (A-seed44840-GalleryTunnel--1).

The crashes: 4 of the 5 happen in alleys, 3 of them in one alley on 66352. The bot turns into a 6 m alley and speeds up to 15 to 18 m/s. At impact it is 2 to 3 m off the centre line (P-feat-seed66352-crash1). The 5th is at a tunnel mouth. This is a real risk of the feature, not broken geometry. A 6 m slot entered off a 90-degree turn is tight. That is fine as a trade-off, but the acceptance clause asked for no extra crashes.

Score effect (deterministic): grid bot 2,557 to 5,416 (median about 3,300). Shortcut bot 1,644 to 6,503 (median about 4,550). The 1,644 on 43361 is my bot stuck for 48 s at a rooftop beside a tunnel: it held 3.5 m because the route ran through the tunnel. That is a bot limit.

## Feature feel (desktop 1280x720 and iPhone 13 held sideways, touch)

- **Boulevards:** the best new thing. Red paving with an amber dashed line, stepped facades, a diamond you can see from the title screen (L-d-load1-seed69870-title). At street height they read as fast lanes. They create the only real decision: "does a diagonal point my way?"
- **Alleys:** cosy and readable. Warm lanterns and two close walls to draft. The camera stays 2.9 m above and 7 to 9 m behind the drone, with no clipping (T-feat-seed82412-alley2, F-d/F-m-seed44840-alley-*). But they are mid-block, so on a grid they rarely shorten a leg. The shortest route used an alley on 8 of 97 legs.
- **Tunnels:** a lit ceiling, a glowing sign band, 7 m clear. At 3.5 m the camera sits at about 6.1 m, below the ceiling, and the view through is clear on desktop and iPhone (F-d-seed44840-tunnel-inside, F-m-seed44840-tunnel-enter). A tunnel is on the shortest route on 5 of 97 legs. Most players will fly through one by chance, not by choice.
- **Fair or cramped?** Fair. A straight line through is clean at 20 m/s. A turn into an alley at speed is risky and costs a 3 s crash charge. That is a good risk, but the game does not reward the risk: the alley route is just shorter, with the same draft as a street.
- **Readability of the choice:** weak. The nav shows a direction arrow and distance only. Feature names exist in code but are never shown. One city reuses names: 66352 has two each of Ginger Alley, Cobble Row, Paper Lane and Kite Lane. A player cannot plan "take Clock Tunnel", and is never told that a shortcut paid off.
- **Rush hour:** visible but not alive. The lanes glow and vans fly in. The vans are drawn only: no collider, no draft, no effect on jobs. You can fly through them. On iPhone the rush banner fades over the objective bar (R-m-seed44840-rush-after). On desktop, "RUSH HOUR", "Crash!" and the bank pop stack in the centre (P-feat-seed66352-crash1).

## Medal guards (12 fresh cities, real time, one run at a time)

| City | Street (grid bot) | Lazy |
|---|---|---|
| 44840 | 2,325 Silver | 1,135 Bronze |
| 66352 | 3,389 Silver | 1,209 Bronze |
| 86749 | 3,862 Silver | 1,007 Bronze |
| 69865 | 3,223 Silver | 1,146 Bronze |
| 66633 | 2,729 Silver | 712 none |
| 54075 | 2,471 Silver | 1,071 Bronze |
| 81658 | **1,430 Bronze** (under load), reruns 3,240, 2,523, 2,526 Silver | 640 none |
| 53713 | 2,857 Silver | 1,400 Bronze |
| 39728 | 3,138 Silver | 883 none |
| 82412 | 5,440 Gold | 1,559 Bronze |
| 43361 | 4,068 Silver | 1,479 Bronze |
| 40118 | 2,277 Silver | 828 none |

- **Street Silver or better:** 12 of 12 on clean runs. The one Bronze (81658, 2 drops) ran while my deterministic batch pushed the load average to 17 on 10 cores. Three clean reruns all scored Silver. I count it as contaminated, but I flag it.
- **Lazy Bronze or below:** 12 of 12 (best 1,559).
- **No Ace:** pass. Best of any bot and mode is 6,503 (shortcut bot, deterministic). The best real-time score is 5,663. Ace is now 10,000.
- **Best lazy at least 300 below worst street:** 1,559 against 2,207 (a clean 40118 repeat) = **648**. Pass. With the contaminated run included, it fails.
- **Same-city repeats (best over worst):** 40118: 2,277, 2,207, 2,234 (1.03). 82412: 5,440, 5,533, 5,663 (1.04). 43361: 4,068, 3,379, 4,000 (1.20). 81658 clean: 3,240, 2,523, 2,526 (1.28). With the loaded run included: 2.27. Pass on clean runs.
- **Score level shifted down for grid flying.** The real-time street median is about 3,000 (round 17: about 5,100). Job picks now prefer pads that have a shortcut, so a pilot who ignores shortcuts flies longer legs. Gold (4,500) now needs shortcuts. Ace (10,000) is far: the best bot reaches 65% of it.

## Gates (seeds 22, 58, 130, real time)

| Run | 22 | 58 | 130 | Total |
|---|---|---|---|---|
| Low (music-run) | 2,156 Silver, 3 drops | 2,355 Silver, 3 | 2,709 Silver, 3 | 7,220 |
| High | 2,936 Silver, 6 | 2,920 Silver, 6 | **0, stalled** | 5,856 |
| Lazy | 1,032 Bronze | 1,255 Bronze | 725 none | 3,012 |

- Low over high **1.23** (needed 0.85). Pass, but only because the high run on 130 scored 0. Suppose the high bot had scored its round 17 value of 2,758 on 130. Then low over high is 7,220 / 8,614 = **0.84**, just under the line. The low runs scored about 40% less than in round 17 (12,051), for the reason above. So this gate is on the edge.
- No-delivery farms: all 0 (farm-probe 3, farm-loop, smart-farm near, pickupline and spendpickup on 22, 58, 130, plus carry and both farms that never delivered).
- Carry farm: 0.34 of street points a minute (honest 1,309, 1,698, 1,655 a minute. Carry: 0, 1,563, 0). Pass. Seed 58 alone is 0.92. It scores 2,300 Silver with 2 drops.
- Breakdown exact: diagnostics, card rows and total agree in all 41 real-time runs.
- Rush hour starts at 60.0 s in every run that reached 60 s.
- Overtime works: started in 17 real-time runs and was finished in 16 of them (the high run on 22 ran out).

## Seed 130 high-line stall: the bot, not the game

- The stall pad is "Bakery · Orchard & 2nd Ave", a doorstep beside a boulevard corner cut. The cut leaves a low stepped roof (about 7 to 8 m) with a rim, 1.5 to 2.5 m from the pad.
- The beeline bot arrives high, starts down 25 m out, and lands on that roof 2.5 m short. Then it holds Shift (descend) the whole time. The roof rim stops it from sliding off. Its camera-relative steering swings about 1 rad each way. So it rocks in place for 50 s (H-seed130-stall). Same in deterministic and real time.
- The pad is fair: placed 30 m straight above it and holding Shift, the drone lands and delivers in 1.6 s (H-seed130-descent). The game's pad audit is clean too.
- So it is a bot fault: when something blocks the bot, it never climbs. The game adds a mild trap: a pad hard against a low roof with a rim. A person can see the ring and hop over the rim.

## Pad audit

26 fresh cities, 2,023 pads: 0 buried, 0 overhang, 0 awning, 0 outside. 0 pads sit inside an alley strip (pads are kept out of alleys). 72 pads lie within 22 m of a tunnel. None is flagged, and none has a ceiling over it.

## Regressions

- **Crash-classify, 8 seeds:** 12 m: 609 s, 47 charged, 0 hop-like, 10 near the target, all on faces 3.4 to 14.1 m below the wall top, so **0 pad lip**. 20 m: 684 s, 43 charged, 14 near the target. 0 hop-like: the two rises had climb held. Faces were 3.7 to 16.1 m below the top, so **0 pad lip**. Pass.
- **Flat-frame probe:** 997 frames, 0 flat, 0 errors.
- **Music:** adaptive. Chains 0 to 3 give 1 to 4 layers (mean intensity 0.33 to 0.87). The final section starts at 9.96 to 10.0 s left. 0 late notes, 0 resyncs, 0 errors.
- **Hand-fly first payout:** desktop **8.8 s**, mobile **9.9 s**. Pass, but slower than round 17 (6.4 and 7.1). Mobile is 0.1 s from the line.

## Whole game, against the best polished indie arcade flying and delivery games

- **First 10 seconds:** strong. The boulevard diamond makes the title city more legible and more designed.
- **Game feel:** still the best part. The alleys add the best moments in the game: threading a lantern-lit slot with both walls feeding the draft.
- **Core loop:** balanced and fair, with a real end-of-run.
- **Depth:** better, but the decision is shallow. The best games of this kind make a route a bet. One line is faster but riskier. Another is slower but pays more. And when the bet pays, the game tells you. Here a shortcut is strictly better, almost always the same kind (a diagonal), and silent. The alleys and tunnels, which are the most memorable spaces, are mostly scenery for routing.
- **World:** prettier and more varied. Still passive: rush hour is lighting and ghost vans.
- **UI:** clean in flight. Centre messages still stack at busy moments.

## Single biggest remaining gap: shortcuts are one-note and silent

**The concern.** Route choice exists. But almost all of it is one rule: when a diagonal points your way, take it. Alleys and tunnels decide the route on very few legs. No shortcut carries a trade-off (risk against reward), and nothing tells the player a shortcut exists, what it is called, or that it paid. So the new spaces do not yet create decisions a player plans and remembers.

**Evidence.** 33 of 35 shortcut legs come from a boulevard. Only 2 of 97 legs have an alley or tunnel shortcut without a boulevard. The shortest route uses an alley on 8 and a tunnel on 5 of 97 legs. The HUD shows only an arrow and distance. Feature names are never shown, and one city repeats four names.

**Acceptance test** (12 fresh cities, deterministic, with `route-feat18.mjs` and `legs18.py` or equivalent):
1. An alley or tunnel is on the shortest route in at least 25% of legs (now 13%). It alone gives a 15% shortcut (no boulevard on that route) on at least 1 in 8 legs (now 2 of 97).
2. Each alley or tunnel route is a trade-off a probe can measure. Examples: more street bonus a second than the street, or a speed gate. A crash in it can cost more than the route saves. The shortcut bot still beats the grid bot by at least 10% in leg time on those legs. It has at most 0.5 charged crashes a minute.
3. Some legs have a shortest route through a feature. On 12 of 12 such legs, the screen names the feature within 1 s of the leg start, for example "via Clock Tunnel". Check desktop and iPhone held sideways. No city uses one name twice.
4. The round 17 and round 18 guards and gates above still pass.

## Other gaps (ranked)

1. **Rush hour is cosmetic.** The vans have no collider, no draft and no effect on jobs. Test: during rush hour, vans block (collider) or give draft. A bot that flies a rush lane shows a measurable change against the same street before 60 s, in crashes or street bonus a second.
2. **Centre messages still stack.** "RUSH HOUR", "Crash!" and the bank pop overlap (P-feat-seed66352-crash1). On iPhone the rush banner fades over the objective bar (R-m-seed44840-rush-after), and the nav distance label sits on the "FLY" label. Test: in 12 full runs on desktop and iPhone, no two centre messages overlap and no HUD label overlaps another.
3. **Grid flying lost its medal headroom.** The street median fell from about 5,100 to about 3,000. Gold needs shortcuts now. Ace (10,000) is 1.5 times the best bot. Test: on 12 fresh cities, the shortcut bot reaches Gold on at least 6. Some pilot (bot or tuned run) reaches at least 80% of Ace.
4. **First payout got slower:** desktop 8.8 s, mobile 9.9 s (round 17: 6.4 and 7.1). Test: hand-fly first payout under 8 s on both.
5. **Low roof traps next to pads at boulevard cuts** (seed 130). Test: the pad audit also flags any pad with a roof edge lower than 12 m within 2.5 m. The beeline bot delivers on 22, 58 and 130.

## Performance

Headless Chromium caps at 120 Hz (8.3 ms).
- Flight through 2 tunnels, 2 alleys and a boulevard (`perf18.mjs`, 12.5 s, real rAF): desktop 1,502 frames, **median 8.3 ms, p95 9.5, max 10.4, 0 over 20 ms**. iPhone 13 held sideways: 1,503 frames, median 8.3, p95 9.4, max 10.3, 0 over 20 ms. 266k triangles, 59 to 75 draw calls.
- Hand-fly 80 s: desktop 9,576 frames, median 8.30, p95 9.30, max 16.1, 0 over 20. Mobile 9,578 frames, median 8.30, p95 9.50, max 24.9, **1 over 20 ms**.
- First load, production build to a scratch folder: **about 0.81 MB** (JS 761 KB, or 208 KB gzipped. CSS 34 KB. HTML 10 KB). lil-gui 31 KB loads only for `?debug`. Budget 15 MB: pass.
- Page errors: 0.

## Screenshots (progress/round-18/critic/)

- Fresh loads: L-d-load1..6-seed*-title and -fly4s (fly4s frames show the title overlay still fading, because the shot is taken right after start).
- Features: T-feat-seed*-diagonal*/alley* (shortcut bot in flight). F-d-seed44840-tunnel-enter/inside/leave and -alley-* (desktop). F-m-seed44840-* (iPhone).
- Rush hour: R-d-seed44840-rush-before/after, R-m-seed44840-rush-before/after.
- Shortcut bot crashes: P-feat-seed66352-crash1..3, P-feat-seed69865-crash1, P-feat-seed54075-crash1.
- Alley scrapes: A-seed*-*.
- Seed 130 stall: H-seed130-stall, H-seed130-descent.
- Round 17 script outputs: M-low-*, M-high-*, M-low-c10-* (medal moments), N-alt12-*, N-alt20-* (crash-classify), Q-high-*, Q-low-*, C-capfarm-*, F-farm-*, S-smartfarm-*, d-h*, m-h* (hand-fly).

## Scripts and logs (progress/round-18/critic-scripts/)

- New bots and probes: `route-feat18.mjs` (grid and shortcut bots with leg logs), `alley-fly18.mjs`, `pad-audit18.mjs`, `hi130-probe.mjs`, `looks18.mjs`, `perf18.mjs`.
- New helpers: `legs18.py`, `rt18.py`, `det18.sh`, `det18b.sh`, and `rtqueue18.sh` with `rtjobs.txt` (real-time jobs strictly one at a time).
- Real-time logs: acc-low, acc-lazy, rep-low, m-low-a, m-high-a, m-lazy-a, hf-desktop, hf-mobile, flat, perf-desktop, perf-mobile.
- Route logs: feat-grid, feat-grid-v2, feat-feat (plus -v1, -a, -b, -v2), legs18.out, legs18-v1.out, alleyfly-14, alleyfly-20.
- Other logs: pad-audit18, hi130-det, ccv12, ccv20, farm-*, farmloop-22, smart-*, capfarm-*, otfarm-*, pick-seeds.
- Order and contamination: the deterministic batches (nice 19) ran beside the first real-time street runs. 81658 ran around 03:17. At that time the load average reached 17 on 10 cores. All runs after 03:28 (lazy, gates, hand-fly, perf, repeats) ran with no parallel work.
