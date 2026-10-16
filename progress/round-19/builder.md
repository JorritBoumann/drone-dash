# Drone Dash, round 19 builder: shortcuts you choose, and the game names them

Concern from the round 18 critic: shortcuts are one-note and silent. Boulevards made 33 of 35 shortcut legs. An alley or tunnel was on the shortest route in 13% of legs and decided the route alone on 2 of 97. No route was a trade, and the game never named a shortcut. Centre messages stacked.

Time box: 04:31 to 07:01. Dev server on port 5188, stopped at the end. Scripts and logs: `progress/round-19/builder-scripts/`. Shots: `progress/round-19/builder-shots/`. The critic's round 18 scripts are copied unchanged except their output folder (`../builder-shots/`) and the log path in `legs18.py`.

**Result in short:** every acceptance line passes on 12 fresh cities. An alley or tunnel is on the shortest route in 47% of legs (needed 25%). It alone gives a 15% shortcut on 19% of legs (needed 12.5%). The shortcut bot is 21.8% faster on shortcut legs and 24.8% faster on alley and tunnel legs, with 0.25 crashes a minute (limit 0.5). The HUD named the feature within 1 s on 140 of 140 legs whose shortest route uses one (desktop and iPhone). No name repeats. Centre messages never overlapped. Guards, gates, pad audit and regressions: see sections 4 and 5.

## 1. Design

### Alleys and tunnels on useful lines
- **Alley lines** (`CityFeatures.planAlleys`). Each city gets three lines of alleys along z and three along x, 3 to 5 blocks long, through the middle of the blocks. An alley now carries on across the street into the next block. So it is a narrow straight lane through part of the city, not a lone slot. Parks and depots break a line. 16 to 22 alleys a city. The most central ones are tunnels (at least 2 a city).
- **Pads at the mouths** (`CityGenerator`). A lot beside an alley mouth gets a doorstep more often (0.8 against 0.42). The doorstep sits 2.2 m from the alley wall, on the alley's line, not in the middle of the face. So a leg can start at one mouth and end at another mouth further down the line. Going round the block costs about 12 m more at each end than going through.
- **Job picker** (`DeliverySystem.pickLeg`, `JOBS.narrowBias` 0.5). The existing shortcut bias (0.85) stays. Inside it, half the legs first look for a special pad. Its shortest route takes an alley or tunnel, no boulevard, and is at least 15% shorter. Then any shortcut, then the old rules. The leg spec (kind, height, distance band) is unchanged. A shortcut leg never goes back to one of the last 4 pads (no ping-pong along one alley). A raised pad is never offered for a tunnel route. The climb to the roof must not start under the bridge.

### Each route is a readable trade
- **Alley:** shorter, and the draft runs at full strength: inside the strip the wall factor is 1 and the hug bonus is full (1.6x fill). HUD cue "Alley draft!". The entry is a 90-degree turn into a 6 m slot: a fast turn-in can hit a wall and costs the usual crash (3 s, combo, bank cut). Crash rules unchanged.
- **Tunnel:** shorter and darker (ice-blue lights). Under the bridge the slow clock runs at full strength. It uses the leg's existing budget (8 s a leg, only toward the objective), so it cannot be farmed. HUD cue "Tunnel · clock slowed". Clear height 7 m, so a fast high line has to drop to get in.
- **Boulevard:** wide, open, no tight entry. When an alley line points your way, the boulevard is usually longer.
- **Fair mouths** (drawn only, flush on the faces): glowing corner posts on both sides of every mouth and a lit board on each side. Two chevrons on the apron point in. They are amber for an alley and ice blue for a tunnel. The faces at an alley mouth are set back 1.5 m (`MOUTH_SET`). This gives a 4.5 m apron between the street and the slot to finish a turn. This is the funnel: a wider space before the slot, not a wider slot.

### The game names the route
- **Route hint** (`Hud.setRouteHint`, `Game.newLeg`). At the start of every leg, the game finds the shortest street route to the objective. It uses the same graph as the `streetRoute` hook. If the route uses a feature, a small pill shows under the objective pill at once, in the same glass style. Examples: "SHORTCUT Lantern Alley −24 m", "TUNNEL Clock Tunnel −31 m", "FAST LANE Kestrel Boulevard −27 m". If the saving is under 3 m, the label is "VIA". Alleys and tunnels are named first, at most two names. It stays 10 s. Diagnostics: `routeHint` (kind, names, saving, grid and route length, leg start and shown time).
- **Unique names:** alleys draw a distinct first word from 30 (Lantern, Tinker, Quill, Walnut ...) with Alley, Lane, Row, Passage or Walk. Tunnels draw from 10 names, boulevards from 6, all without repeats.

### Centre messages one at a time
`Hud.centre` is a small queue for the four centre messages (delivery and pickup and crash pop, medal banner, rush hour and overtime banner, payout pop). Only one is visible. A message of the same kind replaces the one up (as before). Another kind waits until the one up has been read (0.65 to 1.8 s). Then it takes its place. A crash jumps the queue. A newer message replaces an older queued one of its kind. A payout pop that waited more than 1.2 s is dropped. The medal fanfare is still timed to its banner. The extra "Street bonus paid" pop on a delivery is gone (the delivery pop's line already says "street bonus +N"). All four share one slot below the HUD column and the route hint: 39% down on desktop, 53% on a phone held sideways (the old spots overlapped the objective pill on iPhone).

### Rush-hour vans (optional)
Tailing a hover-van (2 to 10 m behind it, in its lane, at 8 m/s or more) is a full draft, cue "Van draft!". The vans still have no collider, so rush hour cannot get unfair. `van-probe19.mjs`: behind a van the draft was on for 20 to 94 of 160 frames and banked up to 630.

### Small extra
The run's first meter is 2.5 draft metres (was 3), so the first payout comes a little sooner on a phone (mobile hand-fly was 9.9 s against a 10 s line).

## 2. Acceptance (12 fresh cities)

Fresh cities from `pick-seeds.mjs` after the last game change (16 loads with no `?seed`, first 12 used): 77984, 51714, 55642, 15336, 80212, 55130, 41128, 23571, 72971, 37812, 15756, 63138. Pad audit adds the other 4 loads (57267, 96431, 24640, 47005) and 1001 to 1014.

Deterministic, the critic's `route-feat18.mjs` (FEAT=0 grid bot, FEAT=1 shortcut bot), 6 processes each, logs merged into `feat-grid.log` and `feat-feat.log`, then `legs18.py` (output `legs19.out`) and `legsum19.py`.

| Test | Needed | Result | Pass |
|---|---|---|---|
| Alley or tunnel on the shortest route | 25% of legs | 40 of 86 (47%) | Yes |
| Alley or tunnel alone gives a 15% shortcut (no boulevard) | 1 in 8 | 16 of 86 (19%) | Yes |
| Shortcut bot faster on 15% shortcut legs | 10% | 37 matched legs: 614 s against 481 s, 21.8% faster. Alley or tunnel only legs (13): 24.8% faster | Yes |
| Shortcut bot crashes | at most 0.5 a minute | 7 in 1,653 s (0.25 a minute). Grid bot 0. 5 of the 7 are fast entries into an alley (10 to 15 m/s), 1 a tunnel mouth, 1 a boulevard | Yes |
| Feature named within 1 s of the leg start | every leg whose shortest route has one | `hint-probe19.mjs`: desktop 122 of 122 legs (144 legs, 12 cities), iPhone 13 sideways 18 of 18 (24 legs, 4 cities). Shown at 0.0 s every time | Yes |
| No name repeats within a city | 0 | 0 of 12 cities (and 0 of 30 in the pad audit list) | Yes |

Per city (grid bot legs; on route / alone 15%): 77984 5/2 of 8, 51714 4/2 of 6, 55642 2/2 of 8, 15336 4/0 of 8, 80212 5/1 of 6, 55130 3/1 of 6, 41128 2/2 of 8, 23571 1/1 of 8, 72971 6/3 of 8, 37812 4/1 of 8, 15756 1/0 of 6, 63138 3/1 of 6.

Scores (deterministic): grid bot 2,304 to 3,682. Shortcut bot 3,421 to 9,100. No Ace (10,000).

## 3. Centre messages

`msg-probe19.mjs`, real time, one browser, nothing else running. One run fires every trigger, several close together. It finishes legs by placing the drone on the pad (deliveries, pickups, medals). It places the drone fast in an alley (payouts) and fast at a wall with W held (crashes). It does a delivery and a crash right on the 60 s rush hour. Then it lets the clock run out with a parcel aboard (overtime) and makes the overtime delivery. Every 50 ms it reads the four centre elements. Two visible at once with overlapping boxes counts as an overlap.

| Run | Frames | Overlaps | Triggers seen | Centre message over the objective pill or route hint |
|---|---|---|---|---|
| Desktop, seed 22 (`msg-d-22e.log`) | 3,358 | **0** | 13 deliveries, 6 crashes, 5 payouts, Bronze to Gold, rush hour at 60 s, overtime and its delivery | 0 frames |
| iPhone 13 sideways, seed 58 (`msg-m-58e.log`) | 3,167 | **0** | 12 deliveries, 6 crashes, 1 payout, Bronze to Gold, rush hour at 60 s, overtime and its delivery | 0 frames |

Earlier runs (`msg-d-22.log`, `msg-d-22b/c.log`, `msg-m-58*.log`) also had 0 overlaps between centre messages. Their crash trigger missed (W was not held), and on the phone the pop still touched the route hint as it faded. The fix: the centre slot is lower on a short screen, the pop is a little smaller, and it rises less as it fades. Shot: O-d-seed22-overtime.


## 4. Guards and gates

Real time, one script at a time (`rtqueue19.sh`, `rtjobs19.txt`), after the deterministic batch. The critic's street bot `route-play-rt-x-m-esc17.mjs` (LINE low) and lazy bot `balance-probe-m-esc17.mjs` (CRUISE 10, NOBOOST). Summary with `rt18.py`.

| City | Street | Lazy |
|---|---|---|
| 77984 | 3,268 Silver | 1,041 Bronze |
| 51714 | 2,644 Silver | 714 none |
| 55642 | 2,516 Silver | 1,413 Bronze |
| 15336 | 3,889 Silver | 1,083 Bronze |
| 80212 | 2,273 Silver | 658 none |
| 55130 | 2,680 Silver | 813 none |
| 41128 | 2,303 Silver | 1,039 Bronze |
| 23571 | 3,230 Silver | 1,596 Bronze |
| 72971 | 3,297 Silver | 1,002 Bronze |
| 37812 | 2,998 Silver | 1,339 Bronze |
| 15756 | 2,283 Silver | 1,026 Bronze |
| 63138 | 2,878 Silver | 715 none |

- Street Silver or better: **12 of 12** (worst 2,273).
- Lazy Bronze or below: **12 of 12** (best 1,596).
- No Ace: best real time 3,889. Best of any bot: the deterministic shortcut bot, 9,100 on 72971. Ace is 10,000.
- Best lazy against worst street: 2,273 − 1,596 = **677** (needed 300).
- Saved medal: in all 33 real-time runs (guards and gates) the run's tier equals the tier from the score, and the game-over card names the same medal. Breakdown exact (bdOk, domOk) in all 33.

**Gates, seeds 22, 58, 130:**

| Run | 22 | 58 | 130 | Total |
|---|---|---|---|---|
| Low, real time (music-run-esc) | 2,932 Silver | 3,492 Silver | 2,007 Silver | 8,431 |
| High, real time | 2,783 Silver | 2,086 Silver | 3,161 Silver | 8,030 |
| Lazy, real time | 566 | 895 | 932 | |
| Low, deterministic (route-legs17) | 2,982 | 3,731 | 1,873 | 8,586 |
| High, deterministic | 4,792 | 1,995 | 2,539 | 9,326 |

- Low over high: real time **1.05**, deterministic 0.92 (needed 0.85). The high-line bot did not stall on 130 this round (the layout near that pad changed), so I did not change the bot.
- No-delivery farms: farm-probe on 22, 58, 130, farm-loop 22, smart-farm near 22, pickupline 130: **all 0**. capfarm carry on 22 also delivered nothing: 0.
- Carry farm against honest (capfarm, deterministic): honest 1,690 + 1,740 + 1,167 = 4,597 a minute; carry 0 + 1,328 + 826 = 2,154. Ratio **0.47** (needed under 0.5). Close to the line: seed 58's carry farm alone is 0.76.
- One-delivery farms (capfarm both, FARMMAX 12): 1,443 Bronze, 1,426 Bronze, 818 none. Bronze or below.
- Rush hour starts at 60.0 s in all 33 real-time runs. Overtime started in 17 of them and was finished in all 17, and in both final message probes.

## 5. Pad audit and regressions

- **Pad audit** (`pad-audit18.mjs`, 30 seeds: the 16 fresh loads and 1001 to 1014): 2,862 pads, **0 issues** (buried, overhang, awning, outside). 0 pads inside an alley strip. 287 pads within 22 m of a tunnel; none flagged, none under a ceiling.
- **Crash-classify** (`crash-classify-v.mjs`, 8 seeds). 12 m: 657 s, 58 charged, 0 hop-like, 20 near the target, all on faces 2.8 to 43.8 m below the wall top, so **0 pad lip**. 20 m: 589 s, 35 charged, 0 hop-like, 4 near the target, faces 4.0 to 22 m below the top, **0 pad lip**. The 12 m rate is a little higher than round 18 (5.3 against 4.6 a minute): the alley lines put more narrow gaps across a straight 12 m line.
- **Flat-frame probe** (`acceptance-probe.mjs`): 875 frames, 0 flat, 0 errors.
- **Music:** adaptive. Chains 0 to 3 give 1 to 4 layers (mean intensity 0.34 to 0.87). The final section starts at 9.97 to 9.99 s left with 5 layers. 0 late notes, 0 resyncs, 0 errors. Fanfare 14 to 20 dB over the music.
- **Hand-fly first payout:** desktop **5.6 s**, mobile **6.7 s** (round 18: 8.8 and 9.9; needed 10).
- **Frame time.** Hand-fly 80 s: desktop 9,572 frames, median 8.30 ms, p95 9.80 ms, 0 over 20 ms. Mobile 9,578 frames, median 8.30, p95 9.50, 1 over 20 ms. Feature flight (`perf18.mjs`, 2 tunnels, 2 alleys, a boulevard): desktop p95 9.0 ms, mobile p95 9.4 ms, max 10.4, 0 over 20 ms, 262k triangles, 58 to 74 draw calls. Headless Chromium caps at 120 Hz.
- **Build:** `npm run build` passes. First load about 0.81 MB (JS 767 KB, CSS 36 KB, HTML 11 KB); lil-gui 31 KB loads only for `?debug`.

**Order and load.** The deterministic batch (`det19.sh`, up to 14 processes, nice 5) ran 04:46 to 04:56. The real-time queue ran alone from 04:57 to 06:15. The last message probes and the screenshots ran alone after it. Three CSS-only edits (the centre slot) were hot-swapped during the real-time queue; they change no game logic. Tuning runs on seeds 1201 to 1204 are in `tune/` and `tune2/` (the first ones ran while I was still editing, so they are not clean).

**Not done:** rush vans block nothing (by design, to keep rush fair). I did not rerun the critic's `alley-fly18.mjs` straight-through test.

## Screenshots (progress/round-19/builder-shots/)
- Route hint: H-d-seed77984-hint1..3 (desktop), H-m-seed77984-hint1..3 (iPhone; taken before the phone pop fix).
- Lit mouths: F-d/F-m-seed72971-alley-*/tunnel-* and F-d-seed1202-*. The first frames still show the title card fading, as in round 18.
- Messages: O-d-seed22-overtime.
- Shortcut bot crashes: P-feat-seed*-crash1. Crash-classify near-target hits: N-alt12-*, N-alt20-*. Farms: C-*, F-farm-*.

## 6. Files changed

- `src/world/CityFeatures.ts`: alley lines, at least 2 tunnels, unique names (30 alley first words, 10 tunnels).
- `src/world/CityGenerator.ts`: mouth setback (`MOUTH_SET`), lit mouths (corner posts, name boards, chevrons), mouth doorsteps.
- `src/systems/DeliverySystem.ts`: `JOBS.narrowBias`, alley or tunnel shortcut first, no return to the last 4 pads on a shortcut leg.
- `src/game/Game.ts`: shortcut classes for the picker (no tunnel route to a raised pad), route hint at each leg start, alley and tunnel strips (full draft, tunnel slow clock), van draft, centre queue tick, diagnostics (`routeHint`, `narrow`, `vanDraft`, `centreLog`), test hook `vans()`.
- `src/systems/Slipstream.ts`: `narrow` and `van` inputs.
- `src/world/Environment.ts`: `vanDraft`, `vanPositions`.
- `src/ui/Hud.ts`: centre message queue, route hint, new cues.
- `index.html`, `src/styles.css`: route hint pill, one centre slot.
- `src/game/config.ts`: `introMeter` 3 to 2.5.
- `src/vite-env.d.ts`: new diagnostics and hook types.
- Kept: bloom clamps in `src/entities/ObjectiveMarker.ts` (untouched) and every debug hook the bots use.

New scripts: `hint-probe19.mjs`, `msg-probe19.mjs`, `van-probe19.mjs`, `legsum19.py`, `det19.sh`, `rtqueue19.sh` with `rtjobs19.txt`.
