# Drone Dash: round 28 critic report

**Verdict:** Round 28 passes its street-level test. The new build wins 21 of 24 blind pairs. The props, shop fronts and trees are a real step, and the phone camera now passes. New flaws: the cars have no wheels, and a few park views go over 600k triangles. The desktop camera still crowds the screen after a drop by a wall.

Build tested: the uncommitted round 28 work on top of commit 56f8d65. My own dev server on port 5191, stopped at the end. The owner's server on 5188 was left alone. Every browser ran alone, one at a time, from one job queue (`critic-scripts/queue28.sh`, `jobs28.txt`). I did not read the round 28 builder notes. The round 27 scripts were copied to `progress/round-28/critic-scripts/`. New scripts this round:

- `art28.mjs`: the art27 spots, with audits and a 3 m people close-up.
- `ab-make.py`: the blind pairs.
- `closeups28.mjs` and `cars28.mjs`: props that float or sink, and close-ups.
- `traffic-rt28.mjs`: real-time traffic overlap.
- `trisweep28.mjs`: worst-case triangles.
- `chime28-init.js` and `hud-probe28.mjs`: each chime against its pop.

## Acceptance (round 27 test)

All four art views per mood used the same seeds and spots as round 27 (golden hour seed 130, bright morning seed 22). Every round 27 view had a match, so nothing was skipped. The CC0 assets loaded in 220 to 243 ms in every run.

| Check | Result |
|---|---|
| At least 3 prop kinds within 40 m | **Pass.** 7 or 8 kinds at every spot (bollard, bin, bench, hydrant, planter, cafe table and chairs, sandwich board, bike rack). |
| At least 1 prop per 10 m of pavement | **Pass.** 1.11 to 1.88 per 10 m (35 to 58 pieces in 309 to 372 m). Bollards are about 40% of the count. |
| No two neighbouring shop fronts share sign, door and awning | **Pass by the hook:** 0 of 445 pairs (seed 130) and 0 of 421 (seed 22). By eye, the sign plates still read as one dark plate with white blobs for letters. Some rows of doors look alike (`art28-d-morning-22-shopfront.jpg`, left building). |
| At least 3 car models, 2 tree species with real shape | **Pass, with a flaw.** Compact, estate and taxi models, and round and oak trees. **The car models have no wheels.** The wheel arches are empty and the body sits on the road (`car28-new-22-t1-6m.jpg`, `close28-22-car0.jpg`). Vans and trucks are still procedural. |
| People: no box heads, knees and elbows bend | **Pass.** Round heads with hair and caps, round limbs and hands. Three frames 0.15 s apart show a bent back knee and a bent elbow (`art28-d-hour-130-people-close-f0..f2.jpg`). Torsos are still boxy and there are no faces. |
| Blind A/B, new view wins at least 5 of 6 per mood | **Pass** on both devices (table below). |
| Budgets | **Mostly pass.** p95, draw calls and load pass. Triangles go over 600k at a few park spots. The desktop first-flight hitch is still 241 ms. See Performance. |

### Blind A/B

`ab-make.py` put each round 27 and round 28 view side by side in random order (A left, B right). It shuffled the pairs (`critic/ab/pair-01..24.jpg`). The key went to `critic/ab/.key.json`. I wrote every pick and reason to `critic/ab/picks.txt` before I opened the key.

| Device, mood | street | shop front | facade mid | mid | cruise | cruise down | New wins |
|---|---|---|---|---|---|---|---|
| Desktop, golden hour | new | new | new | new | old (tie) | new (tie) | **5 of 6** |
| Desktop, bright morning | new | new | new | new | new (tie) | new | **6 of 6** |
| iPhone, golden hour | **old** | new | new | new | new (tie) | new | **5 of 6** |
| iPhone, bright morning | new | new | new | new | new | old (tie) | **5 of 6** |

- Per mood: golden hour 10 of 12, bright morning 11 of 12. **Pass.**
- Where it was clear, the reasons were the same every time: furniture on the pavement, cobbled paving and cracked asphalt with grain, coloured doors and varied awnings, and trees and cars with real shapes. The old views have spotless ground and one red and white awning along a block.
- From 38 m (cruise views) the two builds look almost the same. Five of the six cruise pairs were near ties, and the misses came from those.
- The one clear miss (iPhone golden hour street) was judged on the shrunk pair. At full size the new view has a hydrant, bollards, planters, cobbles and an estate car (`art28-m-hour-130-street.jpg`). I keep the recorded pick.

## Consistency and scale

- **Style fits.** Kay Lousberg, Kenney, Quaternius and procedural pieces are all flat-shaded with vertex colours and sit well with the low-poly buildings. Nothing clashes in colour or detail (`close28-22-street-props-*.jpg`). The bike racks and bus-stop poles (procedural) match the kit.
- **Cars are the weak spot.** The empty wheel arches make them look like toys sliding on the road. You see it every time a car crosses in front of the drone at street level. The old procedural cars had wheels.
- **Scale is right.** The compact car is 3.8 m long and 1.46 m high. The estate and taxi are 4.5 m long. A person is about 1.75 m tall. Benches and tables sit at the right height next to walkers (`close28-22-street-props-bench.jpg`, `-table.jpg`).
- **Nothing floats or sinks.** A ray down under each prop found its base on the ground. That held for all 1,404 pieces (seed 130) and all 1,430 (seed 22). Tree trunks: 1 of about 450 sits 0.25 m low (a kerb edge).
- **Props never block the play space.** On both seeds the placement hook finds 0 props on pads, in alleys or tunnels, or on the diagonal. It also finds 0 over a road and 0 touching a lamp or tree. Props have no colliders.
- Lit-window "TV static" from round 27 is still there on brick walk-ups at street level (`art28-m-hour-130-street.jpg`, left).
- Trees switch from the model to the old blob at 80 m (62 m on a phone). Is the swap visible? **Needs a human eye.**

## Traffic overlap

**Real, and not new in round 28.** The deterministic probe (`street-probe.mjs`) shows 0 overlaps. I ran it on seed 4 three times and on 22, 130 and 58. It cannot see the bug, because it waits 2 s after rush starts and steps the simulation in big steps. A real-time probe that checks every frame (`traffic-rt28.mjs`, run clock held open, 20 s normal then 80 s rush) does see it:

| Build | Seed 4 (run 1, 2, 3) | 22 | 130 | 58 |
|---|---|---|---|---|
| Round 28 | 0, 2,055, 99 frames | 336 | 920 | 0 |
| Round 27 (commit 56f8d65) | 0, 814, 435 frames | 0 | 0 | 0 |

- Every overlap is at a corner of the outer ring road (x or z near plus or minus 157), during rush hour, while playing. A car turning onto the edge road cuts into a car already in that lane, 4.1 to 5.4 m apart. The two stay merged for up to about 17 s (2,055 frames at 120 fps). One case is a box truck and a compact nose to tail in one lane.
- Round 27 has the same bug at the same corners, so it is old. It shows up more on the round 28 build here (4 of 6 runs against 2 of 6). With this few runs, the difference is not significant.
- The first real-time run (no clock hold) also found overlaps after the game-over screen, because traffic keeps running there.
- Players rarely fly the edge ring, but some pads are near it. Fix: in `Traffic.ts`, a turning car must check the target lane before it enters it.

## Regressions

- **Crash-classify, 8 seeds, 0 pad lips: pass.** 12 m: 58 crashes in 643 s (5.4 a minute, round 27: 4.6), 8 near target, closest 3.6 m below a wall top. 20 m: 39 in 658 s (3.6 a minute, round 27: 3.2), 10 near target, 2.1 m below. Props have no colliders. The higher rate is probably bot timing in real time. Check it again next round.
- **People probe: pass.** 0 people in solids, 0 on roads (about 610,000 samples), 0 hit by cars, 0 on active pads (48 legs, 1,536 samples).
- **Camera tunnel test: pass, with one frame.** Desktop with random orbit: 6,892 frames, drone in frame 100%, 0 in solid, under or hidden. One frame had the camera at 1.86 m in Marble Lane alley, with a 2.27 m jump. All other frames were 2.5 m or more (round 27: all of them). iPhone no orbit: 6,933 frames, minimum 3.45 m, max jump 0.97 m. The desktop camera code did not change. This is the random orbit.
- **2 m test in open streets: pass.** 0 frames under 2.5 m in 7 runs with the per-frame sampler (about 67,000 frames). Closest 3.93 m.
- **Phone camera after wall-side pickups: pass (it failed in round 27).** I got 274 samples beside a wall in 6 phone runs. The runs: iPhone 22, 58 and 130 (first run), iPhone 22 (returning and screenshot run), and Android 317. Drone box 40% of screen height or more: **0** (round 27: 7.4%). Largest: 0.365.
- **But on desktop the same thing still happens.** Desktop seed 22: 20 of 62 wall samples were at 40% or more, up to 77% of the screen height. It lasts about 1.4 s after each drop by a wall (camera 4.2 m away). Round 27 desktop runs gave 3 to 16%. The phone fix (`touchRoom`) only applies to touch screens.
- **Phone HUD probe: pass** (about 4,800 samples). Route marker on controls 0. Drone under pills at most 0.13%. Pop on drone at most 0.53%. Gate tag on controls or "Fly" 0. Pops on "Fly" 0.
- **Flat-frame probe: pass.** 941 frames, 0 flat, 0 errors.
- **Payout chimes never without their pop: pass.** The chime now plays at the moment its pop shows. A new probe read the game's own chime counter: 32 of 32 chimes in 3 runs had `#slip-pop` on screen in the same frame. The old round 27 probe reports 4 payouts "without a pop". It times from the payout, not from the chime, so it no longer applies.
- **Medal gate runs (seeds 22, 58, 130): pass.** Street 4,336 / 3,898 / 5,533 Silver, total 13,767. Strict delivery share 62.6% (lowest 59%). Roof 7,491 Gold, 851 none and 3,470 Silver. On seed 58 the bot stalled (7.8 m/s average, 1 drop, no crashes). The rerun gave 5,228 Silver, so the roof total is 16,189. Street divided by roof is 0.85, just at the line (1.17 with the stalled run). No Ace. Breakdown exact on all 7 runs.
- **Exploits: pass.** No-delivery farm 0 on 22, 58 and 130. Carry farm 0.25, 0.23 and 0 of honest points a minute. Farming both legs 0. One-delivery best 1,190 Bronze (carry farm, seed 130), the same as round 27.
- First-run pacing (desktop 22, iPhone 22, 58, 130): longest quiet stretch in the first 60 s is 10.6 s. At most one introduction per 8 s after 30 s. No hint within 3 s of a pickup or drop. Same as round 27.

## Performance

| Run | Median | p95 | Max | Over 20 ms | Calls (max) | Triangles (max) |
|---|---|---|---|---|---|---|
| Street, desktop | 8.3 | 9.5 | 10.3 | 0 | 130 | 547k |
| Street rush, desktop | 8.3 | 9.3 | 10.3 | 0 | 135 | 555k |
| Street, iPhone 13 | 8.3 | 9.7 | 10.4 | 0 | 112 | 475k |
| Street rush, iPhone 13 | 8.3 | 9.6 | 10.3 | 0 | 117 | 477k |
| Tunnels/alleys, desktop | 8.3 | 8.6 | 10.4 | 0 | 115 | 553k |
| Tunnels/alleys, iPhone 13 | 8.3 | 9.2 | 10.3 | 0 | 102 | 492k |
| 80 s runs, 7 runs | 8.3 | 9.3 to 9.7 | see below | 0 to 1 | | |

- **p95 under 12 ms: pass** everywhere. Headless Chromium caps at 120 Hz, so this shows hitches, not GPU headroom.
- **Draw calls under 150: pass.** Worst over a full-city sweep (1,336 to 1,376 spots at 3, 16 and 38 m, 4 headings, rush on) was 135.
- **Triangles under 600k: fail at a few spots.** Seed 130 desktop: max **662k**, 37 of 1,336 spots over 600k (2.8%), all near parks full of trees and people (`tris28-d-130-worst.jpg`). Seed 22 desktop: max 599k. iPhone seed 22: max 540k. In normal street flight 547k to 555k. Round 27 peaked at 464k, so round 28 added about 100k to 130k. Frame time did not move.
- **First load under 15 MB: pass.** Production build without source maps: 2.6 MB in total. First load is about 1.0 MB (HTML 11 KB, CSS 40 KB, JS 910 KB, 255 KB gzipped). The CC0 assets **lazy-load after the first frame**: 1.57 MB (GLBs 385 KB, WebP textures 1.18 MB, a 45 KB loader chunk). Until they arrive, the city runs on the procedural stand-ins. lil-gui (31 KB) only loads with `?debug`. Type check clean.
- **No first-flight hitch over 100 ms: fail on desktop.** Desktop seed 22, fresh profile: one **241 ms** frame on the first playing frame, the same as rounds 25 and 27. The audio prewarm did not remove it in headless Chromium. No first-flight hitch on any of 6 phone runs. One 50 ms frame at 26.5 s on iPhone 22. The 117 to 125 ms frames at 80.5 s are my probe's final read, as in round 27. **Needs a check in a real desktop browser.**

## Biggest remaining gap

**The desktop camera after a pickup or drop beside a wall.** The phone now passes the round 26 test (0 samples at 40% or more). On desktop the camera still pulls in to about 4.2 m from close above. For about 1.4 s after each drop by a wall the drone covers 60 to 77% of the screen height. That hides the route diamond, the distance and the street ahead, at the moment the player needs to find the next target. One desktop run had 20 of 62 wall samples at 40% or more (round 27 desktop: 3 to 16%). The phone fix (`touchRoom`) shows the way. It is just not applied to desktop.

**Acceptance test:** desktop 1280x720, seeds 22, 58 and 130, first run, street bot 80 s, plus one returning run on seed 22. For 3 s after each pickup or drop, sample the drone's screen box every 100 ms. The box is under 40% of the screen height in 99% of samples beside a wall. The 2 m test and the tunnel test still pass.

If that counts as polish (it is short and only beside walls), then **only polish remains**, ranked as below plus this one first.

## Other gaps, ranked

1. **Cars have no wheels.** All three CC0 car models show empty wheel arches and sit on the road (`car28-new-22-t1-6m.jpg`). It is the most visible flaw at street level. Test: every car model has 4 wheels at 6 m in a side view, in near and far detail.
2. **Traffic overlap at the outer ring corners in rush hour** (old bug). A turning car merges into a lane car for up to about 17 s. Test: `traffic-rt28.mjs` (real time, every frame), seed 4 three times plus 22, 130 and 58: 0 overlapping frames.
3. **Triangles over 600k near parks** (max 662k on seed 130). Test: `trisweep28.mjs` on seeds 22 and 130, desktop and phone: max under 600k. The near-tree range or the near people are the likely levers.
4. **Desktop first-flight hitch, 241 ms.** Test: desktop fresh profile, first playing frame under 100 ms. **Needs a real desktop browser** to check that it is not a headless artefact.
5. **Shop signs and faces.** Sign plates are still white blobs on a dark plate, and people have no faces. The window static from round 27 is still there. Does it matter at play speed? **Needs a human eye.**

## Screenshots (progress/round-28/critic/)

- Art, same spots as round 27: `art28-{d,m}-{hour-130,morning-22}-{street,shopfront,facade-mid,mid,cruise,cruise-down}.jpg`, people `-people-f0..f2.jpg` and close-ups `-people-close-f0..f2.jpg`.
- Blind A/B: `ab/pair-01.jpg` to `ab/pair-24.jpg`, picks `ab/picks.txt`, key `ab/.key.json`.
- Close-ups (scale and style): `close28-{22,130}-car0..4.jpg`, `close28-*-street-props-*.jpg`, `close28-*-tree-*.jpg`. Cars without wheels: `car28-new-22-t{0,1,2}-6m.jpg` (old cars: `car28-old-22-*.jpg`).
- Worst triangle spot: `tris28-d-130-worst.jpg`, `tris28-d-22-worst.jpg`, `tris28-m-22-worst.jpg`.
- First run and phone HUD: `fr28-{d-22,m-22,m-58,m-130}-*.jpg`, `hud28-{m-22,a-317}-*.jpg`, `cam28-m-22-*.jpg`, `ch28-*.jpg`.
- Bots: `M-low-*`, `M-high-*`, `Q-*`, `N-alt12-*`, `N-alt20-*`. Farms: `F-farm-*`, `C-capfarm-*`. Tunnels: `cam-clip-22-*`.
