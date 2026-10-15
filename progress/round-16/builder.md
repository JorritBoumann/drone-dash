# Drone Dash, round 16 builder: fair cities

Concern from the round 15 critic: the city roll decides the medal more than flying skill. The same street bot scored 1,178 to 7,208 on 9 cities (6.1 times).

**Result in one line:** the job sequence is now the same on every city, and the 9 old cities measure alike. On 12 fresh cities the lazy-bot checks pass, but the street bot still spreads 2,196 to 10,729 (4.9 times). Two runs reached Ace and two ended under Silver. The cause is now different. It is not the city. It is how long the run lasts (the clock snowball). Not fixed in the time box. See "What is left".

Note on the session: the Mac slept during the first attempt. The time box restarted at 18:29. All numbers below come from after the restart.

## 1. Measurement (why the city decided the medal)

`builder-scripts/city-measure.mjs` runs the game's own generator and DeliverySystem in Node (vite `ssrLoadModule`). It walks a ghost through the first 8 objectives. The job sequence does not depend on how the drone flies, so this is exact. For each leg it logs the straight distance, the street (grid) distance, the target kind and the target height. It also logs the draft-wall share. This is the share of 4 m samples on the street bot's L route that have a solid building face within 10 m at 7 m height. Logs: `builder/measure-before.log` (old code), `measure-after.log`, `measure-fresh.log`.

Before (old job picker, first 4 objectives):

| City | Street score r15 | First pickup | First-4 street m | First-4 climb m | Roof legs in first 4 | Mean wall share |
|---|---|---|---|---|---|---|
| 22 | 7,208 | roof 7 m, 37 m | 460 | 0 | 1 | 0.70 |
| 73023 | 6,781 | roof 13 m, 101 m | 466 | 19 | 2 | 0.70 |
| 130 | 4,777 | roof 20 m, 59 m | 510 | 13 | 1 | 0.74 |
| 57366 | 4,495 | roof 10 m, 48 m | 384 | 3 | 1 | 0.73 |
| 32730 | 4,017 | roof 7 m, 102 m | 536 | 35 | 2 | 0.68 |
| 81401 | 2,690 | roof 7 m, 100 m | 493 | 0 | 1 | 0.73 |
| 58 | 2,219 | roof 16 m, 67 m | 398 | 18 | 2 | 0.76 |
| 48684 | 1,970 | roof 7 m, 58 m | 429 | 16 | 2 | 0.74 |
| 70492 | 1,178 | roof 16 m, 45 m | 420 | **69** | **3** | 0.73 |

Causes found:
- **Rooftop climbs early in the run.** The first pickup was always a rooftop. The spawn rule allowed only a depot, park or roof, and roofs won the clear-line test. Drops took any kind 55% of the time, so a tower-heavy city sent the street pilot up 33 to 42 m roofs. On 70492 the first 4 legs held 69 m of climb and 3 roofs. The street bot's mean height there was 16.5 m (9 to 10 m on good cities). That is above most of the draft, so the bot lost both drafting and clock.
- **Leg length came from straight distance, not street distance.** Some cities opened with 300 m of street before the first drop (81401: 140 m + 170 m). The street pilot flies the grid, so a long grid leg costs clock the drop bonus does not repay.
- **Wall share was not the main driver before.** It was 0.68 to 0.76 on all 9 cities. It does matter for the leftover spread (section 4).

## 2. Design

### Job sequence (src/systems/DeliverySystem.ts, `JOBS`, `jobSpec`, `pickLeg`)
Every leg follows one spec on every city. Street distance is the grid distance from the last stop:
- **First pickup:** 45 to 95 m of street, a pad at most 12 m up, any kind. A clear straight line from the spawn is still preferred.
- **Pickups:** 45 to 105 m of street, at most 16 m up.
- **Drops:** 105 to 165 m of street, growing 6 m per delivery (up to 150 to 225 m). Drops are at street level: 70% shop doorsteps, the rest any street pad. The exception: **every third drop is a rooftop between 9 and 24 m** (+4 m per delivery, at most 40 m).
- If no site fits, the band widens in 15% steps. Then the kind and height rules go, with a height limit of 15 m over the spec. Then any site. The clear-approach check is a preference inside each step, as before.
- The objective RNG is still the only random source, so `?seed=N` and the daily city stay deterministic. The parcel order changes on every seed, including the 8 regression seeds.

After (same 9 cities): every first pickup is low (0.4 to 7 m), and first-4 climb is **0 on all 9**. First-4 street is 395 to 486 m (before 384 to 536). Mean drop street distance is 131 to 170 m. On 12 fresh cities: first-4 street 410 to 477 m, climb 0, 1 or 2 roof legs in the first 8.

### Medal lines (src/game/config.ts, GOALS)
With no early tower climbs, the street bot makes 4 to 5 drops instead of 1 to 2. On my 4 tuning cities (70492, 48684, 81401, 58), the street bot scored 4,945 to 8,891 and the lazy bot 1,210 to 1,637. New lines: **Bronze 1,000 (same), Silver 2,500 (was 1,650), Gold 6,000 (was 4,500), Ace 10,000 (was 8,500).**

### City looks (cheap, in the existing art style)
- `cities.cityLook(seed)` uses a separate hash of the seed. It never touches the layout or parcel RNG. It picks:
  - **a light mood**, one of 4: Golden hour (the original), Bright morning, Rose dusk, Hazy noon. `Environment.applyMood` rewrites PALETTE and SUN_DIR before the sky, fog and lights are built. The sky shader, fog, background, baked environment light, sun colour and direction, and hemisphere fill all follow. There is no new geometry and no new draw calls.
  - **2 to 4 parks** (was always 3). It passes through `generateCity(rng, 7, parks)`. With 3 parks the layout is byte-identical to before.
- Spread over 10,000 seeds: moods 24 to 25% each, parks 2/3/4 a third each.
- Diagnostics: `city.mood`, `city.parks`.
- Screenshots: `builder-shots/L-*-title.jpg` and `L-*-play.jpg`. Seeds 11 Golden hour, 22 Bright morning, 33 Rose dusk, 58 Hazy noon.
- **Regression seeds:** 22, 58, 130, 11 and 91 keep 3 parks, so their layout is unchanged (only their light mood changes). **Seeds 7 and 33 now have 2 parks and seed 44 has 4.** Those three layouts changed. Of the critic's random cities, 70492, 48684, 32730 and 73023 now have 2 parks and 81401 has 4, so they are not the cities the critic flew.
- **Script note:** the critic's `city-audit.mjs` rebuilds the city with `generateCity(createSeededRandom(seed))`, which means 3 parks. On 2 or 4 park cities, its spawn check compares the real spawn against the wrong layout. It reported 4 false "spawnHit" out of 30. `builder-scripts/city-audit16.mjs` is the same script with one change: it passes `cityLook(seed).parks`. The in-game `__GAME__.padAudit` hook already does this. I did not get to run `city-audit16.mjs` (time).

## 3. Acceptance on 12 fresh cities (never tuned on)

Seeds (crypto random, `builder/fresh-seeds.txt`): 38538, 38820, 80628, 61714, 48173, 22265, 36686, 22415, 26338, 59413, 25355, 73421. Real time, one script at a time, SIMT 600. Logs: `builder/f-low.log`, `builder/f-lazy.log`.

| City | Look | Street (low) bot | Drops | Run s | Lazy bot | Wall share (8 legs) |
|---|---|---|---|---|---|---|
| 38538 | 4 parks | 5,359 Silver | 4 | 147 | 1,568 Bronze | 0.74 |
| 38820 | | **10,704 Ace** | 6 | 197 | 1,383 Bronze | 0.73 |
| 80628 | 4 parks | 2,947 Silver | 3 | 110 | 1,256 Bronze | 0.61 |
| 61714 | 2 parks | **2,298 Bronze** | 2 | 89 | 460 none | 0.73 |
| 48173 | 2 parks | **10,729 Ace** | 6 | 196 | 331 none | 0.69 |
| 22265 | | **2,196 Bronze** | 2 | 92 | 452 none | 0.59 |
| 36686 | 2 parks | 9,379 Gold | 5 | 176 | 644 none | 0.72 |
| 22415 | 2 parks | 8,490 Gold | 5 | 176 | 1,619 Bronze | 0.68 |
| 26338 | 4 parks | 3,959 Silver | 3 | 125 | 1,413 Bronze | 0.66 |
| 59413 | 4 parks | 5,351 Silver | 4 | 137 | 1,400 Bronze | 0.64 |
| 25355 | 4 parks | 3,524 Silver | 3 | 119 | 491 none | 0.72 |
| 73421 | 4 parks | 2,592 Silver | 2 | 103 | 566 none | 0.70 |

| Check | Needed | Result | Pass |
|---|---|---|---|
| Street Silver or better | 12 of 12 | 10 of 12 (61714 2,298 and 22265 2,196 are Bronze) | **No** |
| Lazy Bronze or below | 12 of 12 | 12 of 12 (best 1,619) | Yes |
| No bot at Ace | 0 | 2 street runs over 10,000 (10,704 and 10,729) | **No** |
| Best lazy at least 300 below worst street | 300 | 2,196 - 1,619 = **577** | Yes |
| Street best / worst | at most 2.5 | 10,729 / 2,196 = **4.9** (was 6.1) | **No** |

Breakdown exact (bdOk and domOk) in 12 of 12 street runs and 12 of 12 lazy runs. Rush hour showed in every run that passed 60 s.

## 4. What is left: the clock snowball, not the city

The score is almost a function of the number of drops:
- 2 drops: 2,196 to 2,592
- 3 drops: 2,947 to 3,959
- 4 drops: 4,945 to 5,359
- 5 drops: 7,797 to 9,379
- 6 drops: 10,704 to 10,729

The number of drops comes from run length: 50 s, plus drop time, plus slow-clock time. A good run earns clock faster than it spends it (6 drops, 92 s drop time, 51 to 55 s slow clock, 196 s). A run that misses one leg ends at about 90 s with 2 drops (26 s drop time, 15 s slow clock). The job sequence is now flat across cities, but this knife edge stays. Two signs that it is partly run noise rather than city:
- The lazy bot scored only 331 on 48173, where the street bot hit 10,729.
- The tuning runs on 70492, 48684 and 81401 all landed at 5 drops.

One city trait still shows: the two cities with the lowest route wall share (22265 at 0.59, 80628 at 0.61) both gave short street runs. Less wall means less slow clock.

Proposed next steps (not done, all small):
1. **Prefer drop legs with a draft wall.** `pickLeg` can rank candidates by route wall share. The measure already exists in `city-measure.mjs`. It costs about 40 collider samples per pick. Aim for at least 6 of 8 legs at 0.6 or more on every city.
2. **Compress run length.** Steeper `clockDecay` (for example 1 - 0.08 per drop, floor 0.4, was 0.035 and 0.55) plus about +8 s start time. Weak runs get a third drop and strong runs stop near 5.
3. **Flatten the per-drop snowball.** Cap the combo at x2.5 (now x3.5). Or pay the street bonus at a flat rate per leg.
4. Then recalibrate the medals on 4 to 6 tuning cities and re-test on 12 new fresh seeds.

I did not tune the medal lines on the fresh seeds. A Silver of 2,000 and an Ace of 11,000 pass the medal rows here, but that is fitting the test. The 2.5 times ratio still fails with any medal lines.

## 5. Gates and regressions

Deterministic checks ran before the real-time queue (logs in `builder/` and `builder-scripts/`):
- **No-delivery farms:** 30 of 30 score **0** (farm-probe 8, farm-loop, smart-farm 21 on 22, 58, 130).
- **Capfarm:** honest 4,017 / 5,188 / 5,747 (2,158 a minute over 416 s). Carry 2,830 / 0 / 0 (777 a minute, **0.36**). Both 0 / 0 / 0 (**0**). Under 0.5: pass.
- **Crash-classify-v, 8 seeds** (`ccv12.log`, `ccv20.log`):
  - 12 m: 624 s, 18 drops, 60 charged, **0 hop-like**. 9 near the target: every one a building face 2.9 to 25.6 m above the drone (tops 14.5 to 52 m, pad heights 0.4 to 26 m). **0 on a pad lip.**
  - 20 m: 642 s, 25 drops, 43 charged. **1 hop-like** (seed 44 at 61.4 s, 66 m from the target, 3.2 m under a 23.4 m top, rose 1.0 m). This is the same kind as the round 15 builder's case. **0 on a pad lip.** Closest near-target: seed 58 at 34.4 s, 1.2 m under a 22.1 m face, target a street doorstep.
  - The 12 m crash count rose (60, was 48). More street-level drops mean more low flying among trees and lamps. These bots fly a fixed height.
- **Pad audit, 30 fresh random cities** (`city-audit.log`, the game's own `padAudit` with the right park count): **0 broken pads.** The critic's own audit in that script also found 0 pad issues, and 0 spawn crashes in 3 s. Its 4 "spawnHit" are the 3-park layout mismatch described above.
- **Build:** `tsc` clean. Production build to a scratch folder: JS 742 KB (201.5 KB gzip), CSS 34 KB, HTML 10 KB. First load about **0.79 MB**. lil-gui is still a separate chunk.
- **Bloom clamps** in ObjectiveMarker: untouched. **Debug hooks:** all kept. `padAudit` now uses each seed's park count.

Real-time queue after the acceptance runs (`builder-scripts/queue16.sh`, `builder/queue16.log`): see the "Queue tail" section below.

## Files changed

- `src/systems/DeliverySystem.ts`: `JOBS`, `jobSpec`, `pickLeg`. Replaces `choose`, the old straight-distance picker.
- `src/game/config.ts`: medal lines.
- `src/game/cities.ts`: `cityLook(seed)`.
- `src/world/Environment.ts`: `MOODS`, `applyMood`. LightingRig takes a mood.
- `src/world/CityGenerator.ts`: `parks` parameter (default 3).
- `src/game/Game.ts`: applies the look, passes the park count (also in the `padAudit` hook), adds `city.mood` and `city.parks` to diagnostics.
- `src/vite-env.d.ts`: diagnostics type.
- `progress/round-16/builder-scripts/`: copies of the round 15 critic scripts (output folder changed to `../builder-shots/`). New: `city-measure.mjs`, `look-shots.mjs`, `city-audit16.mjs`, `queue16.sh`.

## Queue tail (real time, one at a time, after the acceptance runs)

- **Hand-fly:**
  - Desktop: first draft 4.7 s, first payout **6.7 s** (+25). 9,578 frames, median 8.30 ms, **p95 9.80**, max 16.7, 0 over 20 ms.
  - Mobile: first draft 5.2 s, first payout **9.8 s** (+25, inside 10 s but close). 7,991 frames, p95 10.0, max 10.5.
  - 0 errors on both.
- **Flat-frame probe:** 978 frames, 0 flat, 0 errors.
- **Round 14 and 15 gates on 22, 58, 130 (SIMT 600):**

| Run | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low (music-run) | 4,088 Silver | 3,630 Silver | 5,832 Silver | 13,550 |
| High | 5,707 Silver | 2,994 Silver | 5,893 Silver | 14,594 |
| Lazy | 582 none | 1,230 Bronze | 434 none | |

  - Low / high **0.93** (needed 0.85). Breakdown exact (bdOk, domOk) in 9 of 9.
  - Rush hour started at 60 s in 3 of 3 low runs and shows in diagnostics.
  - Music adaptive: chain 0 to 2 gives 1 to 3 layers.
  - With the new Gold line (6,000), no gate run reached Gold.
  - Best lazy 1,230 is 2,400 below the worst low run.
- **Not run (time):**
  - a daily-city check this round (`cities.ts` daily code is unchanged)
  - `city-audit16.mjs`
  - a same-city repeat test to split city effect from run noise

Dev server on 5188 stopped.
