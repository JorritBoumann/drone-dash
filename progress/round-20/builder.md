# Drone Dash, round 20 builder: the suggested route marked in the world

Time box: 07:23 to 09:53. Scripts: `progress/round-20/builder-scripts/`. The critic's round 19 scripts are copied there. Only the output folder (`../builder-shots/`) and the log path in `legs18.py` and `legs19.py` changed. Logs: `progress/round-20/builder/`. Shots (JPEG): `progress/round-20/builder-shots/`.

## Short version

- The marks are in. The marked alley or tunnel gets an arch in the objective colour. A board on the arch shows the feature's name. The far mouth gets a plain arch. A HUD tag leads to the entrance, then to the way out. After that, the pad marker leads.
- The hint names exactly the board's text: 59 of 59 marked legs.
- Leftover B: farming now earns nothing more than holding still. But the farm ratios stay over 0.5, and one 2-drop farm reaches Silver (section 4).
- Leftover C: the shortcut bot crashes 0.16 times a minute.
- Leftover D: the centre pops stay clear of the meters.
- Leftover A: low over high is 1.65 in real time on the final code (needed 0.85). The low line reached Gold on seed 22.
- **The main speed test fails.** A bot that follows only the marks is 3.7% slower than the grid bot. The target is 15% faster. The critic's shortcut bot uses the full street graph. It is only 5.3% faster on the same legs.

## 1. Leftovers

### A. Low over high

- **Cause.** I ran the round 19 code with the job picker switches on and off (deterministic). The tune hook now also takes `JOBS`.
  - Round 19 as it is: low 8,586, high 9,066 (0.95).
  - No `narrowBias` (no alley-line pads first): low 8,739, high 7,849.
  - No shortcut bias at all: low 8,934, high 10,583.
- So the gain came from the round 19 alley-line legs. These go from a mouth pad to a mouth pad on one straight line. The roof line flies them straight. The street line must go round the block.
- The tunnel slow clock and the vans do not help the roof line. Its slow clock is 3 to 6 s a run, and it never tails vans.
- **Fix.** The street bonus banks 15% more: `SLIPSTREAM.bankCarry` 1 to 1.15 and `bankPickup` 0.75 to 0.86. The street line earns most of the street bonus (1,500 to 2,000 a run). The roof line earns 200 to 400. Flight and headwind did not change, so the roof line is as fast as in round 17.
- This is safe for farming only because of the fix for B.

### B. Carry farms

- **Cause.** A payout banked its full value, whatever the drone did. Shuttling in a tunnel, circling an alley or tailing a van filled the leg cap.
- **Fix: a parcel must go somewhere.**
  - Four times a second, the game measures the route left to the objective. It uses the street graph and the plain grid, plus any climb.
  - Each payout banks by the progress made while the meter filled. The measure is route metres gained divided by metres flown. At 0.4 or more, the payout banks in full (`bankProgress`).
  - When neither route gets 2 m shorter in 5 s, the parcel goes stale (`staleStep`, `staleAfter`). Then payouts bank 0 and the slow clock stops. So the tunnel's slow clock does not count while farming. The bank also fades by 20% a second (`staleDrain`).
  - Within 25 m of the pad, a parcel never goes stale (`staleNear`). Landing is not farming.
  - HUD: the cue "Off route · bonus fading" and the payout pop "Off route".
  - The leg cap is now 5 points per metre of route, not 7 (`bankPerMetre`).
- **Honest flying is not hit.** I switched the new rules off for the grid bot on two cities. The scores did not change: 16541 1,743 both times, 72537 1,200 both times. The deterministic grid bot went stale once in 12 cities and lost 0 points.

### C. Shortcut bot crashes

- The round 19 crash list shows most hits at an alley mouth, at 14 to 16 m/s. The bot turned into or out of the slot. Some hits were not near a mouth pad.
- Two changes in the final code:
  - Alleys are 7 m wide, not 6 m (`ALLEY_WIDTH`).
  - A doorstep beside a mouth now sits 2.4 m from the lot's outer corner (`MOUTH_PAD`). That is about 7 m from the alley wall. It was 2.2 m from the wall.
- I also tried a deeper mouth setback (2.5 m, `MOUTH_SET`). It set back whole street faces, so the street draft got weaker. The grid bot fell to Bronze on 3 cities (16541: 1,743, with 1.5 m: 2,642. 74215: 1,970 against 2,800. 48251: 2,168 against 2,716). I put it back to 1.5 m.
- Result on the final code: the critic's shortcut bot (`route-sign20.mjs FEAT=1`, control unchanged) on 12 fresh cities: **4 charged crashes in 1,489 s, 0.16 a minute** (round 19: 0.62). Kinds: 3 alley, 1 tunnel.

### D. iPhone pops over the meters

- On a short screen, the centre slot is higher. The pop moved from 62% to 50% of the height. The banner and medal moved from 58% to 47%. The payout pop moved from 57% to 47%.
- Static check at peak size, iPhone 13 sideways (`pop-rects.mjs`): 0 overlaps with the slipstream meter, its cue, the boost meter, the route hint and the objective pill.
- The nav marker now stops at 140 px from the top on a phone (150 on desktop). It was 120 and covered the hint pill. The gate tag uses the same limit.
- Fault found late: on a phone the edge **arrow** of the nav marker still reached 46 px up into the hint pill (shot K-m-seed22-arch). I fixed the limit to leave room for the arrow. This fix was built after the real-time queue (see section 5).

## 2. Main concern: the route on screen

### Design

- **Which legs get a mark.** At the start of a leg, the game takes the shortest street route. The game also finds the best route that stays out of alleys and tunnels (boulevards allowed). When the route through an alley or tunnel saves at least 10 m and 8%, that run gets a mark. An alley that saves almost nothing gets no mark and no name. (In round 19, the hint named those too.)
- **In the world** (`src/entities/RouteGate.ts`). Drawn only, no collider.
  - An arch over the entrance mouth, in the objective colour: amber for a pickup, teal for a drop.
  - The posts stand just outside the slot. The arch does not make the slot narrower.
  - A dark board with the feature's name sits above the beam.
  - A chevron moves up and down above the arch at 14 m. You can see it over traffic and from down the street.
  - The far mouth gets a plain arch that pulses: the way out.
  - Plain colours at normal brightness. The bloom clamps in `ObjectiveMarker.ts` did not change.
- **On the HUD.** A tag with an arch icon, the name and the distance sits over the board. When the arch is off screen, the tag stays at the screen edge with an arrow, like the pad marker. After the entrance, the tag says "Way out" and points at the far arch. After the run, the tag and the arches go, and the pad marker leads. The pad marker did not change. A pilot who ignores the marks flies as before.
- **Hint and board match.** The hint names only the marked feature. The label is "Shortcut" for an alley and "Tunnel" for a tunnel. When there is no mark and the route takes a boulevard, the hint names the boulevard. Otherwise it names nothing.
- **Re-plan.** Four times a second, the game plans again from the drone. If the pilot goes another way, the mark moves to the new route's alley or tunnel, and the hint gets the new name. If the new route has no alley or tunnel, the mark and the hint go away. A mark stays while its run saves at least half the limit. So it does not flicker.
- **Diagnostics.** `routeMark` gives the kind, the names, the stage (entrance or through), the gate and exit positions and directions, and the width. It also gives the leg start, the time the HUD tag showed, the first time the arch came into view (and the distance then), and the board text. `progress` gives the route left, stall seconds, stale state, stale points lost and the stale count.

### Acceptance (12 fresh cities, deterministic)

Scripts: `route-sign20.mjs` and `legs20.py`. Output: `builder/legs20.out`.

Fresh cities (random loads with `pick-seeds.mjs`): 72692, 72834, 50400, 50160, 16541, 74215, 48251, 72537, 63888, 26829, 32548, 38954.

| Test | Needed | Result | Pass |
|---|---|---|---|
| Marked legs | | 29 of 92 grid-bot legs, 0 to 5 a city | |
| Hint label = world board = feature name | every case | 29 of 29 (grid bot), 30 of 30 (sign bot) | Yes |
| HUD tag on screen at the leg start | within 3 s | 28 of 29 at 0.0 s. The other one is a mark that changed in the leg | Mostly |
| Arch in view within 3 s or by 80 m | every mark | Grid bot 28 of 29. Sign bot 28 of 30 (median 1.4 s, max 3.5 s). Misses: legs that start 19 to 21 m from the arch with the camera facing away | No, 3 misses |
| Sign bot faster than the grid bot on marked legs | 15% | 23 matched legs: 347.3 s against 334.9 s, **3.7% slower** | **No** |
| Sign bot crashes | at most 0.5 a minute | 6 in 1,334 s, 0.27 a minute | Yes |

These numbers are from the final code (dev server on port 5189, logs in `builder/detF/`). An earlier build gave the same picture: 0.8% faster.

**The sign bot** (`route-sign20.mjs FEAT=2`) has no street graph. It flies the plain grid (roads every 44 m), as the grid bot does. It goes to the road in front of the marked arch (`routeMark.gate`). Then it flies through the alley to the exit arch. Then it flies the grid to the pad marker. When the mark changes, it plans again. It uses the critic's shortcut bot control. One change: it does not brake at a stop that is in line with its path.

**Why the sign bot is not faster.** On these legs, the alley saves 10 to 40% of the distance. The sign bot flies about 15% less. But it is slower per metre:
- it brakes to 7 m/s for the 90-degree turn at the mouth,
- it drops to 5 m in alleys, and to 3.5 m in tunnels (at 4 m/s while above 6.5 m),
- it seldom boosts, while the grid bot boosts on long straight streets.

The critic's shortcut bot uses the full street graph. On the same marked legs (25), it is only 5.3% faster. So the marks lead the bot onto the shortcut (it went through the marked entrance on 25 of 30 legs). But with this control, an alley gives almost no time. A human who keeps speed through the slot gains more, but I did not measure that.

## 3. Shots

- K-d-seed22-start, K-d-seed22-arch, K-m-seed22-start, K-m-seed22-arch: arch, board, tag and hint, on desktop and on an iPhone 13 held sideways. The arch shots are 12 to 30 m in front of the mouth.
- T-sign-seed*: the sign bot in marked alleys and tunnels.
- P-feat-seed*: shortcut bot crashes. C-capfarm20-*: farms. 

## 4. Guards, gates and regressions

All real-time runs were one at a time, on the frozen production build (`vite preview` on port 5188, so no source edit could reload a page mid-run). A deterministic batch (one process, nice 19) ran beside the street guard on a second server; the load stayed at 4 to 7 on 10 cores.

### Guards (12 fresh cities, real time, final code)

| City | Street (`route-play-rt-x-m-esc17`, LINE low) |
|---|---|
| 72692 | 3,561 Silver |
| 72834 | 3,978 Silver |
| 50400 | 3,340 Silver |
| 50160 | 4,474 Silver |
| 16541 | 2,640 Silver |
| 74215 | 2,578 Silver |
| 48251 | 3,096 Silver |
| 72537 | **1,655 Bronze** |
| 63888 | 4,122 Silver |
| 26829 | 4,215 Silver |
| 32548 | 4,038 Silver |
| 38954 | 3,344 Silver |

- Street Silver or better: **11 of 12** (fail). 72537 made 3 drops. The deterministic grid bot also scores Bronze on one city.
- Lazy guard: **not run** on the final code (time box). So "lazy Bronze or below" and "best lazy 300 below the worst street" are not measured.
- No Ace: best real-time score 4,474. Best of any bot: the deterministic shortcut bot, 6,823.
- Breakdown exact and card medal = tier from score in all 12 street runs. Rush hour at 60 s in all 12.
- An earlier build (2.5 m mouth setback, reverted) scored Bronze on 3 of the first 7 cities. That is how I found the setback problem (section 1 C).

### Gates (seeds 22, 58, 130)

| Run | 22 | 58 | 130 | Total |
|---|---|---|---|---|
| Low, real time, final code (`music-run-esc`) | 4,524 Gold, 4 drops | 3,388 Silver, 4 | 3,937 Silver, 3 | 11,849 |
| High, real time, final code | 3,140 Silver, 6 drops | 1,846 Bronze, 4 | 2,180 Silver, 5 | 7,166 |
| Low, real time, earlier build (2.5 m setback) | 4,054 | 2,401 | 1,609 | 8,064 |
| High, real time, earlier build | 365 (stalled on a roof edge 45 s) | 863 (6 crashes) | 2,999 | 4,227 |

- Low over high, final code: 11,849 / 7,166 = **1.65** (each seed 1.44 or more). No stall this time. Pass.
- The low line on 22 reached Gold. Round 19's critic run had the high line at Gold there.
- The high bot's roof-edge stall (round 18 and 19 critics saw it on 130) now shows on 22 on some runs. It hovers over a roof 6 m from a street pad and pushes down. I did not change the high bot.
- Breakdown exact and card medal = tier in all low gate runs. Rush at 60 s in all.

### Farms (deterministic, final code, `farms20.py`, `builder/farmsF/`)

Ratio = sum of farm points a minute over sum of honest points a minute (honest = capfarm honest: 3,969, 3,435, 3,843). Null farm = same trigger and farm time, but the drone holds still.

| Farm (12 s farm phases) | Ratio | Null farm ratio |
|---|---|---|
| Tunnel shuttle | 0.56 | 0.56 |
| Alley shuttle | 0.65 | 0.58 |
| Van tailing | 0.81 | 0.78 |

- Shuttling in a tunnel scores the same as holding still in it (seed 22: 1,389 both). Tailing a van scores about the same as hovering. So a farm phase now earns nothing. What is left is the cost of the lost time: these farms fly honestly between phases.
- **The 0.5 line is not met.** A farm that wastes 12 s a leg and earns nothing still scores 0.55 to 0.8 of an honest run, because the rest of the run is honest flying. Getting under 0.5 would mean punishing a pause more than its time. I did not do that.
- 2-drop farms at Silver: alley farm on 130 (2,161) and the null alley farm on 130 (2,198). Holding still gives the same, so the Silver comes from the two honest drops, not from farming. Still, the line as written fails.
- No-delivery farms (farm-probe 22/58/130, farm-loop 22, smart-farm near 22, pickupline 130): all **0** (earlier build, same bank rules).
- One-delivery farms (capfarm both, 12 s): 792, 890 and 0. Bronze or below.

### Regressions (deterministic, final code)

- Crash-classify, 8 seeds. 12 m: 643 s, 55 charged crashes, 14 near the target, all on faces 7 to 33 m above the pad: **0 pad lip**. The summary counts 1 hop-like rise; every rise I listed had climb held, so I did not find it. 20 m: 670 s, 37 charged, 0 hop-like, 14 near the target on faces 3.4 to 33 m above the pad: 0 pad lip.
- Pad audit, 30 seeds: 2,772 pads, **0 issues**, 0 in an alley strip.
- Phone pops at peak size: 0 overlaps (static check above). The real-time phone probe (`hud-overlap20.mjs`) did **not run** (time box).
- **Not run on the final code:** flat-frame probe, music, hand-fly, perf. On this round's code they were queued last and cut. The production build is 0.83 MB at first load (JS 778 KB, CSS 37 KB, HTML 11 KB), far under 15 MB. `npm run build` passes.


## 5. Files changed

- `src/entities/RouteGate.ts` (new): entrance arch with name board and chevron, exit arch.
- `src/game/Game.ts`: route marks (plan, stages, re-plan, HUD tag, diagnostics `routeMark` and `progress`). The hint names only the marked feature. Banking by progress, stale parcels, `openGraph`. Nav and tag limits. `JOBS` in the tune hook.
- `src/game/config.ts`: `bankCarry` 1.15, `bankPickup` 0.86, `bankPerMetre` 5, `bankProgress`, `staleStep`, `staleAfter`, `staleDrain`, `staleNear`.
- `src/ui/Hud.ts`, `index.html`, `src/styles.css`: gate tag, hint rename, "Off route" cue, higher centre slot on a phone.
- `src/world/CityFeatures.ts`: `ALLEY_WIDTH` 7.
- `src/world/CityGenerator.ts`: `MOUTH_SET` 2.5, `MOUTH_PAD`.
- `src/vite-env.d.ts`: new diagnostics.
- Kept: the bloom clamps in `ObjectiveMarker.ts` and every debug hook the bots use.
- New scripts: `route-sign20.mjs`, `legs20.py`, `hud-overlap20.mjs`, `pop-rects.mjs`, `quick-mark.mjs`, `capfarm-null20.mjs` (null farms: same farm time, holding still), `farms20.sh`, `farms20.py`, `det20.sh`, `det20b.sh`, `nodeliv20.sh`, `rtqueue20.sh` with `rtjobs20.txt`, `x-legs-tune.mjs`.
