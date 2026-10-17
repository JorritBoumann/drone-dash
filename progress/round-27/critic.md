# Drone Dash: round 27 critic report

**Verdict:** Round 26 works: medals now reward skill and the first run is paced. The phone camera still swallows the screen after some pickups by a wall. Round 27 is a real step up for the buildings. Street level (shop fronts, people, cars, trees, pavements) is now the part that looks basic.

Build tested: commit 48a28e7 (rounds 26 and 27). My own dev server on port 5191, stopped at the end. The owner's server on 5188 was left alone. Every browser ran alone, one at a time, from one job queue (`critic-scripts/queue27.sh`, `jobs27.txt`). I did not read the round 26 or 27 builder notes. The round 25 scripts were copied to `progress/round-27/critic-scripts/`. Only the output folders changed (they write to `progress/round-27/critic/`). New scripts this round: `fb27-init.js` and `hud-probe27.mjs` (early feedback, camera after pickups and drops, pops on the "Fly" label), `art27.mjs` (art views), `firstleg27.mjs`, `fb27.py`, `acc27.py`.

## Round 26: medals for skill

Medal lines now: Bronze 1,000, Silver 2,400, Gold 6,000, Ace 15,000.

Twelve fresh cities, real time, one run at a time. Street = the low bot. Lazy = 10 m/s, no boost.

| City | Street (low bot) | Lazy | Lazy as share of street |
|---|---|---|---|
| 40217 | 7,009 Gold, 4 drops | 1,698 Bronze, 3 | 0.24 |
| 66804 | **0, 0 drops** (bot crash and stall) | 1,860 Bronze, 3 | |
| 23391 | 2,893 Silver, 2 | 1,519 Bronze, **2** | **0.53** |
| 81156 | 6,228 Gold, 4 | 1,654 Bronze, 2 | 0.27 |
| 57732 | 3,392 Silver, 3 | 1,508 Bronze, **3** | **0.44** |
| 12945 | 3,172 Silver, 3 | 1,128 Bronze, 2 | 0.36 |
| 70388 | 7,105 Gold, 4 | 1,001 Bronze, 2 | 0.14 |
| 95021 | 4,378 Silver, 4 | 1,425 Bronze, 2 | 0.33 |
| 34670 | 3,353 Silver, 3 | 451 none, 1 | 0.13 |
| 48159 | 3,103 Silver, 3 | 1,535 Bronze, 2 | 0.49 |
| 62513 | **1,435 Bronze, 1 drop** (bot stall) | 1,091 Bronze, 2 | |
| 87406 | 4,020 Silver, 3 | 940 none, 2 | 0.23 |

Reruns (twice each): 66804 gave 5,886 and 5,457 Silver (4 drops each). 62513 gave 5,132 and 5,004 Silver (4 and 3 drops).

- **Street Silver or better: pass.** 10 of 12 on the first pass. The two misses are bot failures, not the game. On 66804 the bot hit a car at 0.8 m, 24 m from the drop, and stood still for 16 s. On 62513 it took 38 s on a 109 m leg and crashed at the end. All four reruns are Silver with 3 or 4 drops. With the reruns, 12 of 12 cities give the street pilot Silver.
- **Lazy Bronze or below: pass**, 12 of 12.
- **Best lazy at least 300 below worst street: pass.** Best lazy 1,860. Worst real street run 2,893 (23391, 2 drops). Gap 1,033 (round 25: 3).
- **Same drops, lazy at least 25% less: pass.** 23391 (2 drops each): lazy 47% less. 57732 (3 drops each): lazy 56% less. Round 25's lazy 3-drop runs (2,400 to 2,617) now land at 1,500 to 1,860.
- Strict delivery share: street 69.8% (lowest 63%), lazy 89%.
- Breakdown exact on all 34 real-time bot runs.
- One watch point: the worst real street run (2,893, 2 drops) is only 493 above Silver. A 2-drop street run is Silver now, but not by much.

## Round 26: gate runs (seeds 22, 58, 130, real time)

| Line | 22 | 58 | 130 | Total | Strict delivery share |
|---|---|---|---|---|---|
| Street (low) | 5,756 Silver, 4 drops | 4,362 Silver, 4 | 3,409 Silver, 2 | **13,527** | **66.4%** (56 to 75% per run) |
| Roof (high) | 7,470 Gold, 7 drops | 5,173 Silver, 5 | 2,528 Silver, 3 (7 crashes) | **15,171** | 97.0% |

- Strict delivery share at least 55%: **pass** (lowest 56%, street seed 130).
- Street at least 0.85 of high: **pass**, 13,527 / 15,171 = **0.89** (round 25: 1.04). The roof line is ahead again. It still earns almost no street bonus (2.9%).
- No Ace: **pass.** Best run 7,470.
- Breakdown exact (bot sum and game-over card): **pass** on every real-time run.

## Round 26: early feedback on a first run

Fresh browser profile (empty storage), street bot, 80 s. Desktop 1280x720 and iPhone 13 (wide view), seeds 22, 58, 130.

| Run | First pickup (s) | Longest quiet stretch in first 60 s | Introductions (s) | Payout chime with no slip pop |
|---|---|---|---|---|
| Desktop 22 | 15.2 | 8.0 (start) | slip 8, medal 31.1, combo 45, rush 63, clock 73.8 | 1 (45.5, under the Combo hint) |
| Desktop 58 | 10.8 | 10.8 (start) | slip 14.3, medal 26.8, combo 34.8, view 44.4, rush 63.2, clock 77.1 | 1 (77.3, under the Slow clock hint) |
| Desktop 130 | **21.1** | 9.0 | slip 8.9, clock 30, medal 45.7, rush 62.1, combo 70.1, view 79.3 | 1 (31.0, under the Slow clock hint) |
| iPhone 22 | **16.2** | 9.0 | slip 8, medal 40.4, rush 60.2, combo 74.4 | 1 (60.9, under the Rush banner) |
| iPhone 58 | 11.7 | 11.7 (start) | slip 15.1, combo 33.6, view 41.8, rush 60.4, medal 76.2 | 0 |
| iPhone 130 | **22.8** | 9.3 | slip 8, clock 30, medal 45.9, rush 64.2, combo 72.2 | 2 (30.8, 65.2) |

- **First pickup within 15 s: 3 of 6 for the bot.** The slow ones are the bot, not the game. The first pickup is 65 m (22), 55 m (58) and 52 m (130) away by street (`firstleg.log`). A human at 12 to 16 m/s gets there in 4 to 7 s. On seed 130 the bot takes 21 to 23 s for 52 m. **A human gets there in time. Pass for the game.**
- **No stretch over 15 s without visible feedback in the first 60 s: pass.** Longest is 11.7 s (spawn to first pickup, phone 58). The slipstream now arrives at 8 to 15 s and fills the first carry. Round 25 had 15 to 18 s with only metres counting down.
- **From 30 s, at most one introduction per 8 s: pass.** Smallest gap 8.0 s. Round 25 had eight in 34 s.
- **None within 3 s of a pickup or delivery pop: pass** for every hint. The medal banner is the exception by design: it now lands 0 to 1 s after the delivery that earned it (round 25: 6 s late). That is right.
- **Hints only while their system is active: pass.** Slow clock only with the clock slowed (gain 0.28 to 1.0). Wind never fired (bots stay low). The code now needs 30 m and headwind. Weak spot: the Slipstream hint fires at 8 s on 3 runs with the meter at 0.06 to 0.20 and not drafting. The code counts it as active (meter above 0.05). When the hint says "Fly low by walls", the drone is no longer next to a wall.
- **Every reward sound or shake has a visible cause: mostly.** Payouts before the slipstream is introduced are now silent (1 to 2 per run, as coded). After that, 7 of 74 payouts played the chime and shake under a hint or banner. Their "+N Banked" pop never showed. The bonus in the objective pill still goes up. Small fail: the bar is 0.
- Human side (three new players on a phone) still **needs a human player.**

Screenshots: `fr27-d-22-t003.jpg` to `t060.jpg` (`t010` slipstream hint over a busy park, `t031` first delivery pop clean), `fr27-m-58-t*.jpg`, `fr27-*-t010/t031/t045.jpg` for the other runs.

## Round 26: phone camera after pickups and drops

For 3 s after each pickup or drop, every 100 ms, I logged the drone's true screen box (`__GAME__.droneBox()`). At the event I also logged one more fact: is the drone within 4 m of a solid? Phone runs: iPhone 13 seeds 22, 58 and 130 (first run), iPhone 22 (returning), Android 915x412 seed 317. One more iPhone 22 run made the screenshots.

| Run | Samples beside a wall | Drone box 40% of screen height or more |
|---|---|---|
| iPhone 58 (first run) | 60 | 4 (6.7%) |
| iPhone 22 (first run) | 63 | 9 (14.3%) |
| iPhone 130 (first run) | 62 | 1 (1.6%) |
| iPhone 22 (returning) | 31 | 3 (9.7%) |
| Android 317 | 59 | 4 (6.8%) |
| iPhone 22 (screenshot run) | 61 | 4 (6.6%) |
| **Total** | **336** | **25 (7.4%)** |

- Drone under 40% in 99% of samples: **fail**, 92.6%. Worst frames: 71 to 74% of screen height, camera 4.2 m from the drone, drone 2 to 3 m up, just after a pickup by a wall. The camera now keeps 4 m or more (round 25 floor 2.4 m), so it is not the floor. It is the angle: the camera looks down on the drone from close above, and the rotor rings fill the bottom half. See `cam27-m-22-big2-hf45.jpg`: the drone covers the route diamond, "100 m" and the slipstream meter.
- Pops on the "Fly" label: **pass, 0** of 1,229 pop samples on the phone. Round 25's "Deliver for" pill on the label is gone.

## Round 27: the art

Views: street (3 m), shop fronts (3 m), mid (14 to 16 m), cruise (38 m), cruise looking down, and people. Golden hour (seed 130) and bright morning (seed 22), desktop and iPhone. HUD hidden. `art27-*.jpg`.

**What works.** This is a real step. The city no longer reads as boxes. Six building types show up. One frame holds 2 to 4 types and, at street level, 3 to 11 shop fronts. Look at the red brick walk-up with blue shutters and a striped awning, next to a stone block with tall windows (`art27-d-hour-130-shopfront.jpg`). It reads as a street, not a test level. Bay-window apartments make a nice zigzag silhouette from above. There is a water tower, AC units, solar panels, antennas, fire escapes (`cam27-m-22-big2-hf45.jpg`) and gabled red roofs on the townhouse rows. Golden hour with long tower shadows across the street is the best look in the game so far. The look is consistent: warm, painterly, low poly.

**What still reads as basic or procedural, most visible first:**

1. **Wall surfaces are flat colour.** Brick is a flat red. Stone is a flat beige with faint lines. Nothing at the base of a wall (no grime, no darker plinth, no contact shadow where wall meets pavement). In bright morning light every facade looks like painted card (`art27-d-morning-22-street.jpg`, right side). From cruise height this is fine. At 3 m it is the main tell.
2. **Ground level is the weakest part.** Doors are identical black rectangles. Each shop has the same gold or orange sign plate with white blobs for letters. The same plate repeats along a whole block (`art27-d-morning-22-people-f1.jpg`, left building). Every awning is the same red and white stripe. Pavements and asphalt are perfectly clean: no kerb detail, drains, manholes, cracks or patches. No street furniture except lamps and benches in parks (no bins, hydrants, bollards, signposts, bike racks, cafe tables).
3. **Lit windows.** The lit glass uses a speckled noise that looks like TV static up close (`art27-d-hour-130-street.jpg`, left building and shop window). In bright morning some ground-floor glows blow out to plain white boxes with bloom (`art27-d-morning-22-people-f1.jpg`, right). Unlit glass has no sky reflection.
4. **People are blocky.** Box heads, box limbs, no faces or hands, stiff scissor stride. Hats, bags and coats help the colour, but at 3 m they read as voxel figures, a step behind the buildings now. At cruise height they are fine as dots.
5. **Rooftops are sparse.** Most flat roofs are an empty slab with at most one AC block. The skyline from cruise is flat boxes with a cornice. Only the townhouse gables break it.
6. **Cars and trees did not get the upgrade.** The taxi, sedan and van are simple boxes with a stripe. Trees are all the same low-poly blob in three greens. Next to the new facades they now look the most basic thing on screen.

**Can CC0 assets close it? Yes for most items. Shopping list, in order of value:**

| Item | CC0 source | Fixes |
|---|---|---|
| Brick, plaster, concrete and stone facade textures (albedo plus normal, 1K, tiling) | Poly Haven textures | Item 1. Blend them into the existing shader at street range only, keep the flat colour far away. |
| Asphalt, paving slabs, kerb stone | Poly Haven textures | Item 2 ground. |
| Street props: bins, hydrants, bollards, benches, bike racks, signposts, newspaper boxes, cafe tables, planters | Poly Pizza (Kenney City Kit, Quaternius) | Item 2. Instanced, a few hundred near the camera. |
| Low-poly cars (taxi, sedan, van, bus) | Poly Pizza (Kenney Car Kit, Quaternius) | Item 6. |
| Low-poly trees (2 or 3 species) | Poly Pizza (Quaternius nature) | Item 6. |
| Animated low-poly people (walk, idle) | Poly Pizza (Quaternius animated characters) | Item 4. Needs a baked-animation instancing path to keep 300 people cheap. That is real work. |
| Rooftop props: water tanks, vents, AC units, antennas, roof doors | Poly Pizza (Kenney City Kit) | Item 5. |
| One sky HDRI per light mood, for window and car reflections | Poly Haven HDRIs | Item 3 partly. |

What CC0 will not fix: shop signs and doors (generate varied sign text and door colours in code), the window static (a shader change: use a calmer interior pattern or a small interior atlas) and the blown-out daytime glows (cap lit-window brightness in bright moods). Budget is not a worry: about 10 textures at 1K plus 30 small GLBs stay well under 15 MB. Draw calls need watching: instance every prop.

## Regressions

- Flat-frame probe: 960 frames, 0 flat, 0 errors. **Pass.**
- Crash-classify, 8 seeds: 12 m: 48 crashes in 631 s (4.6 a minute, round 25: 4.7), 14 near target, **0 pad lips**. 20 m: 35 in 661 s (3.2 a minute, round 25: 2.9), 10 near target, closest 1.3 m below a wall top, **0 pad lips**. Collision unchanged. **Pass.** The new detail has no colliders, as the code says.
- Camera tunnel test, desktop seed 22 with random orbit: 6,933 frames, camera 2.5 m or more 100%, drone in frame 100%, 0 in solid, under or hidden. Max jump 2.26 m (round 25: 2.19). iPhone no orbit: 6,931 frames, all 100%, max jump 1.09 m. **Pass.**
- 2 m test in open streets (camera to drone, every frame): 0 frames under 2.5 m in 4 runs with the per-frame sampler (about 38,000 frames). Closest 2.71 m. **Pass.**
- People probe: 0 people in solids, 0 on roads (about 408,000 samples), 0 on active pads (48 legs, 1,536 samples). **Pass.** One visual note: the person standing next to a drop pad stands inside the drone's rotor ring as it lands (`fr27-d-22-t031.jpg`, `Q-low-seed66804-crash1.jpg`).
- Traffic probe, 4 seeds, normal and rush: 0 overlaps, 0 cars in solids, 0 people hit, 0 off lane. **Pass.**
- Phone HUD probe (5 phone runs, about 3,950 samples): route marker on controls 0, drone under pills at most 0.13%, pop on drone at most 1.6%, route tag on controls or "Fly" 0. **Pass.**
- Exploits: no-delivery farm 0 on 22, 58, 130. Carry farm 0.23, 0 and 0.25 of honest points a minute. Farm both legs 0, 0, 0. One-delivery best: 1,190 Bronze (carry farm 130). **Pass** (same as round 25. Bronze is now 1,000, so one delivery can still reach it).
- Desktop pops cover the drone in 27 to 42% of pop samples (round 25: about 20%), mostly the slip pop. Same design as before, a bit worse.

## Performance

| Run | Median | p95 | Max | Over 20 ms | Calls | Triangles |
|---|---|---|---|---|---|---|
| Street, desktop | 8.3 | 9.5 | 10.3 | 0 | 104 | 414k |
| Street rush, desktop | 8.3 | 9.4 | 10.4 | 0 | 106 | 422k |
| Street, iPhone 13 | 8.3 | 9.7 | 10.3 | 0 | 86 | 386k |
| Street rush, iPhone 13 | 8.3 | 9.6 | 10.4 | 0 | 89 | 389k |
| Tunnels/alleys, desktop | 8.3 | 9.0 | 10.3 | 0 | 92 | 431k |
| Tunnels/alleys, iPhone 13 | 8.3 | 9.6 | 10.3 | 0 | 79 | 406k |
| 80 s first runs, 6 runs | 8.3 | 9.5 to 9.8 | 10 to 17 | 0 | | |

- p95 under 12 ms everywhere: **pass.** Headless Chromium caps at 120 Hz, so this shows hitches, not GPU headroom.
- Cost of the detail kit: triangles up about 27% (327k to 414k street desktop), calls up about 9 (95 to 104). Art views peak at 464k triangles and 108 calls. Fine for a mid laptop. On a real phone 400k triangles is worth one real-device check.
- First load, production build: HTML 11 KB, CSS 40 KB, JS 866 KB (245 KB gzipped). About 0.92 MB (lil-gui only loads with `?debug`). Type check clean. **Pass.**
- First-flight hitch: one 242 ms frame at the first playing frame on desktop, identical to round 25 (241 ms). None on the phone. The 116 ms frames at 80 s are my probe's final read, not the game.

## Biggest remaining gap

**Street level still looks basic next to the new buildings.** The facades now carry the city from mid and cruise height. At 3 m, the walls are flat colour and the doors are identical black boxes. One sign plate and one awning repeat along a block. Pavements are spotless, with no street furniture. People are blocky, cars are boxes and trees are blobs. The owner's ask ("more realistic") is half met: the upper floors are there, the ground floor is not.

Suggested order of work. First, street props, cars and trees from CC0 kits (Poly Pizza: Kenney City Kit, Car Kit, Quaternius). Second, Poly Haven facade and paving textures near the camera. Third, varied signs, doors and awnings in code. Last, better people.

**Acceptance test** (6 fixed street views per light mood, golden hour and bright morning, desktop and iPhone, the same spots as `art27.mjs`):
- Within 40 m of the drone at street level: at least 3 kinds of street prop and at least 1 prop per 10 m of pavement (count with a test hook).
- No two neighbouring shop fronts share the same sign, door colour and awning (test hook audit).
- Cars and trees: at least 3 car models and 2 tree species with real shape (not a recoloured box or blob).
- People: no box heads, with a walk cycle that bends knees and elbows (3 frames 0.15 s apart, checked by eye).
- A fresh critic, blind, picks the new street views over the round 27 views in at least 5 of 6 pairs, per mood.
- Budgets hold: p95 under 12 ms on desktop and phone in busy street flight, draw calls under 150, triangles under 600k, first load under 15 MB.

## Other gaps, ranked

1. **Phone camera after a pickup or drop by a wall** (round 26 test, failed). The drone box is 40% of the screen height or more in 7.4% of samples (bar: 1%), up to 74%. It hides the route diamond and the slipstream meter (`cam27-m-22-big2-hf45.jpg`). Same test next round.
2. **Payout chime under a hint.** 7 of 74 payouts played the chime and shake while a hint or banner hid their pop. At 8 s the Slipstream hint can fire with the drone no longer drafting (meter 0.06 to 0.20). Test: 0 payout chimes without their pop, and the Slipstream hint only while drafting.
3. **Lit windows.** Speckle noise reads as TV static up close, and some daytime glows blow out to white boxes in bright morning (`art27-d-morning-22-people-f1.jpg`). A shader fix, no assets needed.
4. **People stand in the drone at drop pads.** A walker beside the pad stands inside the rotor ring as the drone lands (`fr27-d-22-t031.jpg`). Test: no person within 1.5 m of the drone while it is under 2 m on a pad.
5. **Desktop pops cover the drone** in 27 to 42% of pop samples (round 25: about 20%), mostly the slip pop. Does it hurt? **Needs a human eye.**

## Screenshots (progress/round-27/critic/)

- Art, desktop: `art27-d-hour-130-{street,shopfront,facade-mid,mid,cruise,cruise-down,people-f0..f2}.jpg` (golden hour), `art27-d-morning-22-*.jpg` (bright morning).
- Art, iPhone 13: `art27-m-hour-130-*.jpg`, `art27-m-morning-22-*.jpg`.
- First run: `fr27-d-22-t003.jpg` to `t060.jpg`, `fr27-m-58-t003.jpg` to `t060.jpg`, `fr27-{d,m}-{22,58,130}-t010/t031/t045.jpg`.
- Phone camera after a pickup by a wall: `cam27-m-22-big1-hf42.jpg`, `big2-hf45.jpg`, `big3-hf44.jpg`.
- Phone HUD: `hud27-m-22-*`, `hud27-a-317-*`.
- Bots: `M-low-*`, `M-high-*`, `Q-*` (crashes, incl. `Q-low-seed66804-crash1.jpg`), `N-alt12-*`, `N-alt20-*`.
- Farms and tunnels: `F-farm-*`, `C-capfarm-*`, `cam-clip-22-*`.
