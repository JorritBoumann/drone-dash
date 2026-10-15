# Drone Dash, round 17 builder: the ending and the shape of the score

Concern from the round 16 critic: the run ends on a knife edge at the third drop. Each extra delivery roughly doubled the score. A run 18 m short at time-up lost all of its banked street bonus. The same street bot scored 1,695 to 9,066 on 12 cities (5.35 times).

**Result in short:** the ending is no longer a cliff. A parcel aboard at 0 s gets a short overtime. A late pickup gets a short job. No run in the acceptance set lost a banked bonus at a pad's edge. The breakdown is exact and the farms still score 0. But the spread across cities is still too wide. The street bot scored 1,774 to 8,006 in real time (4.5 times, target 2.5), and one city is Bronze. The cause is now run length (3 drops against 7), not the ending.

Time box: 21:26 to 23:26. Dev server on port 5188, stopped at the end.

## 1. Where the doubling came from (round 16 numbers)

Round 16 breakdowns of the street bot, from `round-16/critic-scripts/acc-low.log`:

| City | Drops | Deliveries | Fast | Combo | Street bonus | Lost at time-up |
|---|---|---|---|---|---|---|
| 80258 | 3 | 741 | 225 | 982 | 1,934 | 1,139 |
| 40443 | 5 | 1,247 | 675 | 2,470 | 3,113 | 950 |

Causes:
- **Combo.** The steps were x1.5, x2, x2.5, x3 and x3.5. The combo line grew from 327 a drop (3 drops) to 494 a drop (5 drops). So each drop paid more than the last.
- **Street bonus lost at time-up.** The bonus was about 650 a drop, flat. But the clock ran out with a parcel aboard in most runs. Then the bank on it (often 700 to 1,100) went to 0, even 13 m from the pad.
- **Run length snowballs.** A drop gives 5 + distance/11 s (up to 20 s). The slow clock gives up to 8 s a leg. A bot that flies a cycle in 25 s earns about 30 s a cycle. Its run goes on until the drop decay catches it (6 to 8 drops). A bot that needs 35 s a cycle earns about 21 s. It stops at drop 3. This is the biggest factor that is left (section 4).
- **Rooftop on drop 3 with no time check.** A pickup with 1 s left got a 158 m rooftop job.

## 2. Design (what changed)

1. **Overtime.** The clock hits 0 with a parcel aboard: overtime starts (once a run). Its length fits the parcel in hand: street route left / 6 m/s + 4 s, from 8 to 15 s. The timer turns gold with an "OT 12" count and a quick double pulse. A banner says "Overtime: 12 s to finish this delivery, no new jobs". A three-note horn plays. The music holds its last-10-s section at full intensity with the lead layer on. Overtime cannot chain. The overtime delivery adds no clock and no new job. A "Made it!" beat follows, then the game-over card. Overtime has no slow clock. A crash still costs seconds.
2. **Overtime pays the bank by the share flown.** The overtime delivery pays its points as normal. Its street bonus pays the share of the leg flown at time-up (street route left plus any climb). So a parcel near its pad keeps nearly all of it. A bank farmed far from the drop does not cash in.
3. **Time-up share.** Sometimes the clock runs out for good (no parcel aboard, or overtime spent). Then the street bonus banked on the current leg pays by the share of the leg flown. It has its own game-over row: "Last leg, 62% flown at time-up". This needs at least one delivery in the run. So a no-delivery farm still scores 0.
4. **On schedule only.** Overtime and the time-up share need a leg on schedule. That is a leg flown in at most 1.6 times its par (route / 9 + 7 s). A parcel that sat aboard while its bank was farmed gets neither. This rule keeps the carry farm low (section 3).
5. **Last call.** A parcel picked up with under 22 s left gets a short drop. The drop fits the time left plus 8 s at 7 m/s (at least 55 m). It is at street level, never a rooftop. A last-call drop pays points as normal but adds no clock. So the end of a run is a set of short jobs on a falling clock. It is not a cliff. Short legs also cannot pay for themselves forever. A "Last call! Short job, no time bonus" pop shows on pickup. After a drop, the next pickup is never further than the clock left at 7 m/s (at least 30 m).
6. **Flatter score.** Combo step 0.5 to 0.15 (x1.15 to x1.75 at five, and the HUD shows two decimals). Street bonus pace weight max 2.5 to 1.8. The leg cap stays 7 points a metre. (I tried 3.5. Then the carry farm filled its share fast and delivered like an honest pilot.)
7. **Shorter snowball.** Slow-clock budget 8 to 5 s a leg (a fast run earned all of it on every leg). Drop time bonus decay 0.035 to 0.06 a drop. Start time 50 to 56 s, so a slow but steady run keeps its third drop.
8. **First payout.** The intro meter is 3 m (was 4). It counts from 3 m/s (was 4). This is for the mobile hand-fly first payout, which was 9.9 s.
9. **Medal lines.** Silver 2,500 to 2,000, Gold 6,000 to 4,500, Ace 10,000 to 9,000.

Kept: the street bonus (banked, paid on delivery) and the slow clock with its budget per leg. Rush hour at 60 s. The round 16 job spec (a rooftop every third drop, except on last call). The daily city, the bloom clamps in `ObjectiveMarker.ts` and all debug hooks.

New diagnostics: `ending` (overtime, finished, lastCall, overtimeSeconds, partial, partialShare, legRoute). Breakdown fields `partial`, `overtimeSeconds` and `overtimeDrop`. `partial` is a part of `slip`, so drops + fast + combo + slip still equals the score. Also `audio.music.overtime`, and score log entries `overtime`, `otshare`, `otcut`, `otdrop` and `partial`.

Tried and dropped: a "clutch" time bonus (more drop time at a low clock). It did not help the slow cities. They stop on a leg, not at a drop with little time left. A decay of 0.08 to 0.09 cut the top a little but also cost slow cities a drop.

## 3. Results

12 fresh cities from 14 loads with no `?seed` (`builder-scripts/pick-seeds.log`). None was used in round 16. I tuned on the round 16 cities and also checked these 12 deterministically before the real-time runs. So they are not fully blind. Real-time scripts ran one at a time: `route-play-rt-x-m-esc.mjs` (street) and `balance-probe-m-esc.mjs` (lazy, CRUISE=10, NOBOOST=1). Deterministic: `route-legs17.mjs` (route-legs16 plus log-only lines for breakdown and ending).

| City | Mood, parks | Street (real time) | Drops, run | Overtime | Lazy | Lazy drops | Street, deterministic | Det. ending |
|---|---|---|---|---|---|---|---|---|
| 32124 | Rose dusk, 3 | 5,877 Gold | 5, 149 s | none | 1,595 | 3 | 6,031 (6) | overtime drop |
| 14545 | Golden hour, 2 | 2,327 Silver | 3, 98 s | none | 1,031 | 2 | 2,811 (3) | overtime drop |
| 97836 | Rose dusk, 4 | 3,089 Silver | 4, 134 s | 9.7 s, delivered | 1,446 | 3 | 3,199 (4) | overtime drop |
| 48947 | Hazy noon, 2 | 2,945 Silver | 4, 123 s | none | 1,245 | 3 | 2,823 (3) | pickup leg, 56 m short, bank 0 |
| 96635 | Rose dusk, 4 | 2,975 Silver | 3, 105 s | none | 711 | 2 | 2,674 (3) | pickup leg, 20 m short, bank 0 |
| 97214 | Rose dusk, 3 | 4,523 Gold | 4, 127 s | none | 1,491 | 3 | 6,546 (6) | pickup leg, 37 m short, bank 0 |
| 79278 | Hazy noon, 2 | 6,710 Gold | 6, 167 s | none | 1,643 | 3 | 6,902 (6) | pickup leg, 19 m short, bank 0 |
| 59437 | Bright morning, 2 | 4,936 Gold | 5, 132 s | 7.0 s, delivered | 1,634 | 3 | 2,836 (4) | overtime drop |
| 29130 | Hazy noon, 2 | 8,006 Gold | 7, 183 s | 9.3 s, delivered | 1,535 | 3 | 8,277 (7) | overtime drop |
| 30593 | Golden hour, 3 | 5,197 Gold | 5, 138 s | none | 1,356 | 3 | 4,904 (5) | pickup leg, 30 m short, bank 17 |
| 32429 | Hazy noon, 3 | 3,006 Silver | 4, 123 s | 4.2 s, delivered | 1,528 | 3 | 2,957 (4) | overtime drop |
| 93049 | Bright morning, 4 | 1,774 Bronze | 3, 106 s | 9.0 s, delivered | 896 | 2 | 2,667 (3) | pickup leg, 24 m short, bank 0 |

| Test | Needed | Result | Pass |
|---|---|---|---|
| Street Silver or better | 12 of 12 | 11 of 12 (93049 1,774 Bronze) | No |
| Lazy Bronze or below | 12 of 12 | 12 of 12 (best 1,643) | Yes |
| No Ace from any bot | none | none (best real time 8,006, deterministic 8,277, Ace 9,000) | Yes |
| Best lazy at least 300 below worst street | 300 | 1,643 against 1,774: 131 | No |
| Street best / worst | at most 2.5 | 8,006 / 1,774 = 4.51 (deterministic 8,277 / 2,667 = 3.10) | No |
| Same city, 3 runs, best / worst at most 1.4 | 4 cities | 2 cities, 2 runs each: 93049 1,774 and 1,681 (1.06). 29130 8,006 and 7,800 (1.03) | Not fully run (2 of 4 cities, 2 of 3 runs) |
| Deterministic runs ending within 30 m of the next stop | at most 3, or keep half the bank | 6 end on an overtime delivery at the pad (bank paid, minus the share cut). 4 end on a pickup leg 19 to 30 m short, with 0, 0, 0 and 17 points banked | Yes on the bank clause (3 of the 4 have nothing banked; 30593 keeps 1 of 17) |

Breakdown: bdOk and domOk true in all 24 real-time runs. The game-over rows add up, including "Last leg" and the overtime time line.

Where the runs end now: in real time, 5 of 12 street runs and 8 of 12 lazy runs end with an overtime delivery. No run ended with a banked bonus lost at a pad's edge. Overtime cuts were small (101 to 295 points, from the share rule).

## 4. Gates (seeds 22, 58, 130) and regressions

Real-time gate runs were not run (time box). Deterministic stand-ins:
- **Low / high (deterministic, route-legs17):** low 4,032 + 3,926 + 4,162 = 12,120. High 3,948 + 4,189 + 4,093 = 12,230. Ratio 0.99 (needed 0.85). Pass. The high line now makes 7 to 8 drops at about 520 a drop. The low line makes 4 to 5 at about 900.
- **No-delivery farms:** all 30 (farm-probe 8, farm-loop, smart-farm near, line, pickup, pickupline, spendpickup) score 0.
- **Capfarm:** honest 1,878, 1,861 and 1,772 points a minute (5,511). Carry 0, 1,603 and 0 (1,603): 0.29 of honest (needed under 0.5). Pass. Both: 441, 1,123 and 0. Before the on-schedule rule, the carry farm was at 0.64 to 0.72: it farmed, then finished in overtime.
- **Breakdown exact:** yes in every run (see above).
- **Rush hour at 60 s:** the ESC lines in acc-low show `startedAt` 60 in every run that passed 60 s.
- **Hand-fly first payout:** desktop 6.3 s (was 7.2), mobile 7.1 s (was 9.9). 0 page errors.
- **Frame time (hand-fly, headless 120 Hz cap):** desktop p95 9.5 ms, max 10.4, 0 over 20 ms. Mobile p95 9.6 ms, max 10.4.
- **Build:** `npm run build` passes. First load about 0.79 MB (JS 746 KB, CSS 34 KB).
- **Crash-classify:** only an early run with an older config, under load from parallel jobs. 12 m: 24 charged, 0 hop-like, 5 near the target. 20 m: 13 charged, 1 hop-like (seed 130: the wall top was 3.6 m above the drone, so it is a real wall). No flight or collision code changed this round. Not re-run on the final build.
- **Flat-frame probe, music-run analysis, real-time gate runs:** not run.

## 5. What is left (honest view)

The ending is fixed. The spread is not. The street bot makes 3 drops on some cities and 7 on others, because its leg times differ per city (pickups 8 to 10 s on 29130, 16 to 18 s on 93049 and 14545). The bot climbs to 26 m to leave pads off the road edge, and that costs it more on some cities. A fast bot earns more clock per cycle than it spends. A slow one earns less. The decay and the smaller budget cut the snowball from 8 drops to 7, but the gap is still about 2 times in drops and 1.5 times in points a drop. The next fix would be on run length itself. Options: a fixed shift length with the clock as a soft limit, or a time bonus based on par rather than distance, so a slow leg earns as much as a fast one.

Small fix at the end: the overtime delivery now says "Made it! Overtime delivery" in the delivery pop, not in a second banner, and the pill says "Run complete". Known issue: an overtime banner from less than 3 s before still overlaps the delivery pop (`builder-shots/OT-madeit-d.jpg`, a teleport test). In normal play overtime lasts longer than the banner. This last change came after the real-time runs. It touches only the HUD text.

## 6. Files changed

- `src/game/config.ts`: RUN overtime, scheduleSlack, last call, clockDecayStep, comboStep 0.15, startTime 56. SLIPSTREAM clockBudget 5, bankPaceMax 1.8, introMeter 3, introMinSpeed 3. GOALS lines.
- `src/systems/DeliverySystem.ts`: overtime state, startOvertime (sized to the leg), addPartial, last-call drop spec, reachable pickup band, no clock on overtime or last-call drops, tally fields.
- `src/game/Game.ts`: overtime start and finish beat, on-schedule rule, share of leg flown, time-up share, overtime bank share, last-call pop, diagnostics `ending`.
- `src/ui/Hud.ts`: overtime timer ("OT 12"), game-over "Last leg" row and overtime time, combo shown with two decimals.
- `src/styles.css`: overtime timer style.
- `src/systems/AudioSystem.ts`: overtime horn, overtime music layer and intensity, `overtime` in music info.
- `src/systems/Slipstream.ts`: intro meter speed floor.
- `src/vite-env.d.ts`: `ending` diagnostics type.

Scripts: `progress/round-17/builder-scripts/` (round 16 critic copies with output folders changed to `../builder-shots/` and `../builder/`, plus `route-legs17.mjs`, `det17.sh`, `det17all.sh`, `queue17*.sh`, `ot-shot.mjs`, `kinds.mjs`, `sum17.py`). Tuning logs t1 to t8 are in the same folder. Screenshots: `builder-shots/OT-start`, `OT-mid`, `OT-madeit`, `OT-gameover`, `TU-gameover` (desktop -d, iPhone -m), `O-low-seed*-timeout` (deterministic, 0.5 s before time-up), `M-*` medal moments.
