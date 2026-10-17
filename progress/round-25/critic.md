# Drone Dash: round 25 critic report

**Verdict:** Delivery is now the main reward in every bot run. The camera and phone leftovers are closed. The medal guard now fails. Delivery pays twice as much, so medals follow the number of drops. A slow 3-drop flier lands within a few points of a 2-drop street pilot. The first run is calm before 30 s. Then it teaches eight things in 34 s.

Build tested: commit 258206f plus the uncommitted round 25 changes. My own dev server on port 5191, stopped at the end. The owner's server on 5188 was left alone. Every browser ran alone, one at a time, from one job queue (`critic-scripts/queue25.sh`, `jobs25.txt`). I did not read the builder notes. Bot scores are the same in first-run and returning mode (teaching only hides HUD parts), so a fresh browser profile is a fair bot test.

## Round 24 gap: delivery is the main reward. Closed (bot side).

Strict count: what the drop itself pays (base, fast-drop time bonus, rush bonus, combo). The banked street bonus paid with the drop and the time-up share are not counted. "At the drop" adds the street bonus paid in the same pop (everything the player sees arrive at a delivery).

| Run (real time) | 22 | 58 | 130 | Total | Strict delivery share | Street bonus share |
|---|---|---|---|---|---|---|
| Low (street line) | 6,384 Gold, 4 drops | 3,757 Silver, 3 | 5,217 Silver, 3 | **15,358** | **61.1%** (each run 58 to 67%) | 38.9% |
| High (roof line) | 7,777 Gold, 7 drops | 1,876 Bronze, 2 (5 crashes) | 5,122 Silver, 5 | **14,775** | **96.3%** (each 86 to 100%) | 3.3% |
| Lazy | 1,205 Bronze, 2 | 1,400 Bronze, 2 | 1,241 Bronze, 2 | 3,846 | 84.4% | 15.6% |

- Delivery at least 55% of total: **pass**, on all 6 low and high runs (lowest 58%, seed 130 low). Round 24 had slipstream at 56% of the low total. Now it is 39%.
- At the drop (strict plus the street bonus in the same pop): 100% of low, 99.6% of high. Every point except the time-up share now arrives with a delivery.
- Street total over high: 15,358 / 14,775 = **1.04**. Pass (needs 0.85). Note: the roof line now matches the street line and earns almost no street bonus. Slipstream has become an optional extra. That fits the goal, but it is a design change worth knowing.
- Lazy Bronze or below: **pass** (1,205 to 1,400, all just over the 1,200 Bronze line).
- No Ace: **pass**. Best score of any run is 7,777 (Ace is 15,000).
- Breakdown exact (bot sum and game-over card): **pass** on all 37 real-time bot runs.
- The new delivery pop reads well: "+731 delivered" big, "Fast drop +193 · +512 street bonus" below (`fr25-d-22-t036.jpg` area, and `hud25-m-130-ov1.jpg` for the pickup pop "Deliver for +499").
- Player side (three new players say "delivering parcels" scores most) still **needs a human player**.

## Medal guards (12 fresh cities, real time, one run at a time)

Silver is now 2,800, Bronze 1,200, Gold 6,000, Ace 15,000.

| City | Street (low bot) | Lazy |
|---|---|---|
| 31847 | **2,695 Bronze**, 2 drops | **2,504 Bronze, 3 drops** |
| 52906 | 4,859 Silver, 4 | 1,347 Bronze, 2 |
| 74413 | 4,462 Silver, 3 | 1,289 Bronze, 2 |
| 19582 | 3,474 Silver, 3 | 1,683 Bronze, 2 |
| 63170 | 4,764 Silver, 4 | 1,372 Bronze, 2 |
| 88241 | 3,177 Silver, 3 | 1,606 Bronze, 2 |
| 27659 | 5,757 Silver, 4 | 2,426 Bronze, 3 |
| 45318 | 3,555 Silver, 3 | 1,161 none, 2 |
| 90724 | 3,634 Silver, 3 | 1,434 Bronze, 2 |
| 36085 | 3,900 Silver, 3 | 1,056 none, 2 |
| 58861 | 5,466 Silver, 4 | **2,617 Bronze, 3 drops** |
| 14492 | **2,620 Bronze**, 2 drops | 1,403 Bronze, 2 |

- Street Silver or better: **fail, 10 of 12.** Both Bronze cities are 2-drop runs that miss Silver by 105 and 180 points.
- Lazy Bronze or below: **pass**, 12 of 12.
- Best lazy at least 300 below worst street: **fail.** Best lazy 2,617 (58861) against worst street 2,620 (14492): a gap of 3 points. Without the two Bronze street cities the worst street is 3,177, a gap of 560.
- Strict delivery share on the 12 street runs: 68.7% (lowest 56%). On the 12 lazy runs: 92.8%.

**The two Bronze street cities: one is the game, one is the bot.**
- 31847: two drops by 59 s. The third job is a 134 m street leg picked up at 73.5 s. The clock runs out at 85% of the leg, overtime gives 8 s, and the bot ends 95% of the way (17 m short). The time-up share pays 391. On the same city, the lazy bot got 3 drops from a different job sequence. Two reruns: 2,641 and 2,728, both Bronze with 2 drops. Three of three runs miss Silver by 70 to 160 points. **Game:** this city gives a street pilot 2 drops, and 2 drops is not Silver.
- 14492: the pickup leg after the first drop takes 26 s (109 m). The second drop lands at 76 s with 10 s left, too little for a third. Two reruns: 1,372 (1 drop, the bot got stuck for 50 s on a pickup) and 4,018 Silver (3 drops). **Mostly bot and luck.**
- The pattern is in the numbers, not one bad bot run. A street run with 2 drops scores 2,600 to 2,700. A lazy run with 3 drops scores 2,400 to 2,600. Silver (2,800) sits just above both. So the medal now says "how many parcels", with little room for how well you flew. The street bonus used to be the gap between a good and a lazy pilot (round 24: lazy best 1,559 vs street worst 2,207). Moving points into the drop removed most of that gap.

## First run for a new player (cleared storage)

Probe: `hud-probe25.mjs` with `NEW=1` and `firstrun-init.js`. Every 100 ms it logs which HUD parts are really visible: element and parents shown, opacity 0.15 or more, on screen. It also logs every banner text with its time. The low street bot flies, 80 s. Desktop seed 22 and iPhone 13 seed 58.

| First visible (s) | Desktop 22 | iPhone 58 |
|---|---|---|
| Score, clock, objective pill, parcel count, boost bar, speed and altitude, pad marker, pause | 0.1 | 0.1 (plus stick and buttons) |
| "Parcel secured! Deliver for +N" pop | **15.4** | **11.8** |
| Slipstream meter, street bonus, Slipstream hint | 30.0 | 30.0 |
| First delivery pop | 31.8 (drop at 30.8) | 31.8 (drop at 30.2) |
| Combo chip and hint | 34 | 34 |
| Medal goal row and Bronze banner | 38 (Bronze was reached at 31.8) | 75 |
| Slow clock hint | 42 | 46 |
| Camera hint | 46 | 38 |
| High wind hint | 50 | 42 |
| Rush hour banner | 60 | 60 |
| Shortcuts hint and arches | 64 | 79 |

- Nothing new before 30 s except the first pickup and its marker: **pass**, both devices.
- Each hint once: **pass.** Seven hints, each shown once.
- Returning player (played key set): full HUD from the first frame (medal goal, route pill, and the slipstream meter as soon as it fills), no teaching class, no hints. **Pass** on 4 phone runs and 1 desktop run.

**Problems the probe shows:**
1. **The layers arrive as a burst.** Eight introductions in 34 s (30 to 64 s), 4 s apart, on both devices. Two of them land on the first delivery. The Slipstream hint appears at 30.0 s and the first delivery pop has to wait behind it (`fr25-d-22-t031.jpg`, `fr25-m-58-t031.jpg`: the score already shows 920 or 1,243, but the screen says SLIPSTREAM).
2. **Hints out of context.** "High wind: up high the wind slows you" shows at 42 to 50 s while the drone is at street height. It was queued at the spawn, at 18 m. On the phone the first slipstream pop a new player sees is "Off route · No bonus" at 37.5 s.
3. **The medal moment comes late.** On desktop the run reaches Bronze at the first delivery (31.8 s). The banner shows at 38 s, after the Combo hint.
4. **Quiet banking is not quiet.** Before 30 s, the bot banks 4 to 5 slipstream payouts (up to 512 points). The pop is hidden, but the payout chime, the camera shake and the boost refill still happen. A new player hears and feels a reward with nothing on screen to explain it.

## First 30 s as a player

- **Is it clear what to do?** Yes. One pill ("PICK UP Records · Juniper & 4th Ave"), one marker with a distance, a clock. Nothing else competes (`fr25-d-22-t010.jpg`, `fr25-m-58-t018.jpg`). This is the cleanest start the game has had.
- **Is there enough feedback?** It is thin but not empty. The first visible reward comes at 12 to 15 s ("Parcel secured! Deliver for +437"). It names the prize, which is good. Then 15 to 18 s pass with only the distance counting down, plus the unexplained chimes above. For a delivery game, a 12 to 15 s flight to the first pickup is fine. The quiet 15 s carry after it is the weaker part, because the player cannot yet see any progress except metres. Does it drag? **Needs a human player.**
- **Is the pickup pop at 15 to 22 s a problem?** Not by itself. The real issue is the shape of the first minute: 30 s with almost nothing, then 34 s with almost everything.
- **The early-feedback test I recommend** (replaces "first payout within 10 s"): on a first run, measured on 3 seeds, desktop and phone, with the street bot:
  - The first pickup lands within 15 s. Now 11.8 and 15.4 s: pass.
  - In the first 60 s, no stretch longer than 15 s without visible feedback (a pop, a marker change or a meter).
  - Every sound or shake that means "reward" comes with something visible that explains it.
  - From 30 s on, at most one new introduction per 8 s. None within 3 s of a delivery or pickup pop.
  - Each hint fires only while its system is active. Wind only above 30 m. Slow clock only while the clock is slowed.
  - Human side: 3 new players play a first run on a phone. Each can say what to do within 10 s. None stops to ask why it chimed.

## Exploits

| Farm | 22 | 58 | 130 |
|---|---|---|---|
| No-delivery farm (farm-probe) | 0 | 0 | 0 |
| Smart farm, near | 0 | | |
| Carry farm (vs honest points a minute) | 0.26, 1 drop | 0, 0 drops | 0.27, 1 drop, 1,259 Bronze |
| Farm both legs | 0 | 0 | 0 |
| Farm both legs, 12 s | 0.23, 1 drop | 0.33, 1 drop | 0, 0 drops |
| Alley / van / tunnel farm, 12 s, then deliver | 0.80 / 0.66 / 0.50 | | |

- No-delivery farms 0: **pass.**
- Carry farms under 0.5 of honest points a minute: **pass**, all at 0.33 or below.
- One-delivery runs: best 1,259 Bronze. **Pass.**
- The 12 s narrow farms are mostly honest runs with a short detour (3 drops each). They score below honest, so they are not an exploit.

## Camera and phone HUD (round 24 leftovers)

**Camera near a wall: closed.** I measured the camera to drone distance in every frame in open streets (not alley or tunnel framing). 6 runs with deliveries, about 55,000 frames: desktop 22 and 130, iPhone 22, 58 and 130, Android 317.
- Frames within 2 m: **0.** Closest: 2.17 m. Under 2.5 m: 0.4% of frames. The camera floor is 2.4 m in the code.
- Still visible at the floor: right after a pickup beside a wall, the drone fills the lower half of the phone screen (`hud25-m-130-ov1.jpg`). Rare and short. Polish.

**Phone HUD (returning player, 4 phone runs, 3,170 samples):**

| Run | Marker on controls | Drone under pills (all / above 30 m) | Pop on drone | Route tag on stick, label, button / off screen |
|---|---|---|---|---|
| iPhone 13, seed 22 | 0 | 0% / 0 of 105 | 0 of 182 | 0 of 202 / 0 |
| iPhone 13, seed 130 | 0 | 0.13% / 0 of 125 | 3 of 179 (1.7%) | 0 of 89 / 0 |
| iPhone 13, seed 130 (rerun) | 0 | 0% / 0 of 129 | 1 of 188 (0.5%) | 0 of 114 / 0 |
| Android 915x412, seed 317 | 0 | 0.25% / 0 of 103 | 2 of 166 (1.2%) | 0 of 183 / 0 |

- All four checks **pass.** Route tag on the "Fly" label: 0 of 588 tag samples (round 24 had it in `hud24-a-317-ov2.jpg`).
- New small leftover: on the iPhone the pickup pop's "DELIVER FOR +499" pill sits on the "Fly" label (`hud25-m-130-ov1.jpg`). My probe checks pops against the controls, not that label.

## Regressions

- Flat-frame probe: 1,008 frames, 0 flat, 0 errors. **Pass.**
- Crash-classify, all 8 seeds: 12 m: 49 crashes in 624 s (4.7 a minute, round 24: 5.5), 11 near target, closest 1.5 m below a wall top, **0 pad lips**. 20 m: 35 crashes in 721 s (2.9 a minute, round 24: 3.9), 15 near target, closest 2.3 m, **0 pad lips**. **Pass.**
- Van slipstream: 280 and 132 draft points on seeds 58 and 130 (round 24: 325 and 153, the 14% bank cut). Van farm on 22: 3,946 Silver. **Pass.**
- Traffic probe, 4 seeds, normal and rush: 0 overlaps, 0 cars or people in solids, 0 people hit, 0 on pads, 0 off lane. **Pass.**
- Camera tunnel test, seed 22 with random orbit: 6,932 frames. Camera at 2.5 m or more: 99.7%. Drone in frame: 97.8%. In solid, under, hidden: 0. Max jump: 2.19 m (round 24: 1.70).
- Camera tunnel test, iPhone 13, no orbit: 6,927 frames. 100% at 2.5 m or more, drone in frame 99.9%, 0 in solid, under or hidden. Max jump: 0.78 m.
- frame-check: 0 far off-frame on both. **Pass.**
- Desktop pops still cover the drone in about 20% of pop samples on desktop (round 24: about 50%). Unchanged design.

## Performance

| Run | Median | p95 | Max | Over 20 ms | Calls | Triangles |
|---|---|---|---|---|---|---|
| Street, desktop | 8.3 | 9.6 | 10.4 | 0 | 95 | 327k |
| Street rush, desktop | 8.3 | 9.5 | 10.4 | 0 | 99 | 332k |
| Street, iPhone 13 | 8.3 | 9.5 | 10.4 | 0 | 79 | 300k |
| Street rush, iPhone 13 | 8.3 | 9.6 | 10.4 | 0 | 81 | 304k |
| Tunnels/alleys, desktop | 8.3 | 9.2 | 10.4 | 0 | 84 | 321k |
| Tunnels/alleys, iPhone 13 | 8.3 | 9.4 | 10.4 | 0 | 72 | 299k |
| 80 s play, desktop / iPhone (no camera sampler) | 8.3 | 9.6 / 9.7 | 25.0 / 16.9 | 1 / 0 | | |

- p95 under 12 ms everywhere: **pass.** Headless Chromium caps at 120 Hz, so these show hitches, not GPU headroom.
- My long probe runs with the per-frame camera sampler showed one 108 to 126 ms frame each. Two clean reruns without the sampler show none (max 25 and 17 ms). It is my sampler's start-up, not the game.
- First load, production build (to a scratch folder): HTML 11 KB, CSS 39 KB, JS 831 KB (230 KB gzipped). About 0.88 MB. Type check clean. **Pass.**

## Biggest remaining gap

**Medals now count drops, not how well you fly.** A lazy 3-drop run scores 2,400 to 2,617. A skilled 2-drop street run scores 2,620 to 2,728. That is about the same. Both sit just under Silver (2,800). One city (31847) gives the street pilot Bronze in 3 of 3 runs. The best lazy run is 3 points below the worst street run. Skill still shows on the good cities (street 3,177 to 5,757). But the Silver line sits right on the step from 2 drops to 3.

Options for the builder (not a prescription):
- Let the fast-drop time bonus and the combo carry more of the skill gap. A lazy drop scrapes in. A street drop beats par by 4 to 9 s.
- Or set Silver where a 2-drop street run lands (about 2,500), and check that lazy 3-drop runs stay below it.
- Or pick jobs so that a street pilot fits 3 drops in a run on every city.

**Acceptance test.** 12 fresh cities, real time, one run at a time, with the street (low) bot and the lazy bot. Rerun any Bronze street city twice.
- Street Silver or better on 12 of 12.
- Lazy Bronze or below on 12 of 12.
- Best lazy at least 300 below worst street.
- On the same city, a lazy run with as many drops as the street run scores at least 25% less.
- The delivery share rules from this round still hold (strict at least 55% on the gate runs).

## Other gaps, ranked

1. **The first run teaches in a burst, and some hints come at the wrong time.** Eight introductions arrive in 34 s. One hides the first delivery pop. The wind hint shows at street level. The medal banner comes 6 s after its cause. Payout chimes play before anything explains them. Test: the early-feedback test above. A bot can check all of it except the human line.
2. **Run variety.** Every city has the same features in the same mix (round 24 item 1). **Needs a human player.**
3. **The roof line now equals the street line** (1.04) and earns almost no street bonus. If slipstream must matter, the street line needs some edge back. If not, make the meter and its hints simpler. **Design call, needs a human player.**
4. **At its 2.4 m floor, after a pickup beside a wall, the camera still lets the drone fill the phone screen** (`hud25-m-130-ov1.jpg`). The pickup pop's "Deliver for" pill sits on the "Fly" label there. Test: within 3 s of a pickup or drop, the drone box is under 40% of the phone screen height in 99% of samples. Pops on the "Fly" label: 0 samples. A bot can check this.
5. **Promenade from above** still reads as a red road with stop bars (round 24). **Needs a human eye.**

## Screenshots (progress/round-25/critic/)

- First run, desktop: `fr25-d-22-t003.jpg` to `t060.jpg` (`t010` clean start, `t031` Slipstream hint on the first delivery, `t036` Combo hint).
- First run, iPhone 13: `fr25-m-58-t003.jpg` to `t060.jpg` (`t018` carrying with nothing to watch but metres, `t031` hint over the first delivery).
- Phone HUD, returning player: `hud25-m-22-*`, `hud25-m-130-*`, `hud25-a-317-*` (`hud25-m-130-ov1.jpg`: camera at its floor after a pickup, pop pill on "Fly").
- Camera near walls: `camwall25-d-130-p20-y1.jpg`, `p40-y1.jpg` (drone on the pavement by a wall, framed fine).
- Camera tunnels: `cam-clip-22-*`, `cam-clip-22-m-noorbit-*`.
- Bots: `M-low-*`, `M-high-*`, `M-low-c10-*` (medal passes), `Q-*` (crashes), `N-alt12-*`, `N-alt20-*` (crashes near target).
- Farms: `F-farm-*`, `C-capfarm-*`, `C-capfarm19-*`, `S-smartfarm-near-seed22.jpg`.
