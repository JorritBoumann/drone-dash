# Drone Dash: round 32 critic report

**Verdict:** Pass, with one new bug. The water now calms with height: the cruise to low ratio is 0.43 to 0.56 (round 31: 0.90 to 1.09). The grid pop is gone and boats are solid. But the new harbour bus stalls 5 cm short of its first pier and never moves again, on every seed, after 70 to 120 s.

Build tested: the uncommitted round 32 work on top of commit 1e9035e. My dev server ran on port 5191 and is stopped. The owner's server on 5188 was left alone. Every browser ran alone, one job at a time, from `critic-scripts/queue32.sh` and `jobs32.txt`. I did not read the round 32 builder notes. I read the diffs of `Water.ts`, `Boats.ts`, `CollisionWorld.ts`, `Drone.ts` and `Game.ts` only to learn what to test.

New scripts (in `progress/round-32/critic-scripts/`):

- `boats32.mjs`: flies the drone into boats (fixed step, 60 Hz). Modes: ram is 15 m/s with W held, let go 0.35 s after the hit. Slow is 4 m/s. In hover the boat runs into a parked drone. In press, W is held into an oncoming bow. Logs crashes, frames inside a hull box, frames within 0.4 m of a mast, overlap depth, time in contact, push distance and drop.
- `bus-stop32.mjs`: runs 700 s and logs every stop and start of the harbour bus.
- `wake32.mjs`: wake shots looking toward a low sun, and harbour bus scale shots.
- `ab32.py`: blind pairs of round 31 against round 32 water.
- Changed copies: `water31.mjs` (tag r32), `water31b.mjs` (3 extra sunward wake views per boat, waits until the boat is under way), `contrast31.py` (reads both rounds).

## Machine load (read first)

BTLEServer used 97 to 100% of one core all session (`cpu-*.txt`). XProtect used 40% at the start. The headless browser still ran at the 120 Hz vsync (median 8.3 ms), so all wall-clock numbers are marked contaminated. The water, boat, camera and triangle verdicts come from fixed-step probes.

## Water

**Calm with height: pass.** `contrast31.py` on the desktop game-camera views:

| Mood | Cruise (24 m) | Low (2 m) | Ratio | Round 31 ratio |
|---|---|---|---|---|
| Golden 130 | 18.2 | 34.1 | **0.53** | 1.01 |
| Morning 22 | 16.6 | 29.4 | **0.56** | 1.09 |
| Dusk 33 | 16.7 | 39.0 | **0.43** | 0.90 |
| Noon 58 | 16.8 | 29.9 | **0.56** | 1.04 |

All marks met: ratio at most 0.6, low at least 25, cruise at least 15. On the phone the ratio is 0.79 (round 31: 1.09). It calms, but less.

**Blind A/B against round 31: new water wins 4, ties 2, loses 4. Win or tie 6 of 10: pass, just.** Picks were written in `critic/ab/picks.txt` before I opened `.key.json`. Four pairs show a boat on one side only, so they were not fully blind.

- The new water wins every desktop cruise view (golden, dusk, morning, noon). The crumpled foil is gone. From play height the bay now shows broad dark and light swell shapes with sparkle near the sun.
- It loses all three close low-sun views (golden 2 m, golden glint 14 m, dusk glint 14 m) and the phone cruise view.
- **Close golden-hour and dusk views now look hazy.** The water right under and in front of the camera smears into soft radial streaks. It looks out of focus (`water32-r32-130-g-low.jpg`, `water32-r32-130-glint.jpg`, `water32-r32-33-glint.jpg`). At 14 m the glint path is a soft glow, not glitter. Round 31 was crisper here.

**Grid pop: fixed.** 2 cm camera move across a snap line against the same move elsewhere: 0.99 to 2.34% of pixels changed against 0.80 to 2.32% (ratio at most 1.23, target at most 2). Round 31: 14 to 18% against under 2%. In the 15 m/s motion sweep, snap frames and other frames now change by the same amount (for example 6.06 against 6.08 at cruise). Round 31 snap frames changed 13% more.

**Wakes toward a low sun: better, not solved.** Trail over open-water brightness, rib and harbour bus, 4 azimuths per mood: 29 of 32 views at 1.3 or more (round 31: 6 views under 1.2). The 3 low ones are 1.11 to 1.18. In the new sunward views (camera looking into the sun over the boat), dusk passes (all 1.14 or more). Golden hour has 3 of 6 under 1.0: rib 0.96, bus 0.93 and 0.67, where the wake lies inside the glitter path. In the shots the rib wake reads as a bright line toward a low sun. The bus wake is only a faint pale streak (`wake32-130-sunward-rib.jpg`, `wake32-130-sunward-ferry.jpg`, `wake32-33-sunward-rib.jpg`).

**Flat frames with bloom on: pass.** 960 frames over 8 water views and 4 moods, plus 240 on the phone: 0 flat, 0 black pixels, at least 39 distinct colours of 49.

**Water cost (throughput, contaminated):** +0.44 to 1.04 ms a frame on desktop water views (round 31: +0.53 to 0.94). The low view is at the +1.0 ms line (0.92 to 1.04). Phone +0.1 to 0.7 ms.

## Boats

**Collision: pass.** `boats32.mjs`, seeds 22, 58, 4711 and fresh 9001, 156 approaches into 12 moving boats (4 harbour buses, 8 sailboats) and 16 moored boats:

| Check | Result |
|---|---|
| Frames with the drone centre inside any hull box | **0** |
| Frames with the drone centre within 0.4 m of a mast | **0** |
| Sphere deeper than touching a hull | 0 |
| Stuck states | **0** (longest contact 1.9 s, at the moored rib at 4 m/s) |
| Pushed down by a boat | 0 m (lowest 0.9 m, the drone's floor) |
| Bus side at 15 m/s, 1 m and 2 m high | 15 of 16 hits charged exactly one Crash (loss 9.9 to 15.3 m/s) |
| Bus at 4 m/s | 4 of 4 bumps, no crash |
| Masts at 15 m/s, 3 m high | 24 of 24 scrapes, 0 crashes, the drone glances by |
| Low hulls (sail, rib, row) at the lowest height | stepped over, no crash, drone sits on the deck (`boats32-22-moored-rib-low.jpg`) |

The odd one: one bus hit at 1 m (seed 9001) hopped the drone up over the cabin to 4.3 m with no crash. A ledge hop over a boat was meant to be off. The few other crashes in the log happened 47 to 95 m from the boat, after the drone flew on into the city. They are not boat hits.

Only the bus and the inner sailboats are reachable. The flight limit is 215 m from the centre. Ribs (203 to 216 m) and the outer sailboat (237 to 242 m) are out of reach, so they can never be hit.

**A boat hitting the drone feels fair (fixed step, a human must check it).** The bus hit a parked drone 8 of 8 times: no crash. The bus carries the drone at its own speed (4.2 to 4.6 m/s). The drone slides 5.5 to 7 m to the side and is free in 0.2 to 0.6 s. Holding W into an oncoming bow charged one Crash (4 of 4). The drone reached 15.6 m/s before the hit, so that is the player's own speed. A sailboat hull at the lowest height throws the drone sideways at 4 to 8.5 m/s, nearly three times the boat's speed. That can feel like a kick. **Needs a human player.**

**Routes and overlap: pass for 120 s.** `boats31.mjs`, seeds 22, 58 and fresh 9001: 0 hull overlaps, 0 hulls on a dock, 0 hull corners in a solid. Moving hulls come no closer than 17.4 m to the seawall (the bus lane). Heave within ±0.28 m. On seed 9001 two doorstep pads sit 21 m inland of the marina, clear of it.

**New bug: the harbour bus stops for good.** `bus-stop32.mjs` (700 s per seed): on seeds 22, 58, 4711 and 9001 the bus sails once, stops at its first pier after 88 to 119 s and never leaves. `wake32.mjs` shows the same at both piers (x -36.05 and x 40.05). 60 s later it still has not moved. In code, `stepShuttle` brakes so that the speed reaches 0 at 0.05 m before the stop, but it only counts as arrived under 0.02 m. So it parks 5 cm short with speed 0, and the 9 s wait never starts. After two minutes of every run the only big boat is a parked bus with no wake.

**Scale and life: mostly right.** At 14.4 m the bus reads as a small harbour ferry beside the drone and the docks (`bus32-22-from-promenade.jpg`, `bus32-130-at-pier.jpg`). Its shape is still a small cruise ship with funnels. Until it stalls, the bus braking into a pier is the best moment on the water. The sailboats' gusts are too slow to notice in a short look. **Needs a human eye** once the stall is fixed.

## Regressions

- **Flat-frame probe: pass.** 951 frames, 0 flat, 0 errors.
- **Crash-classify, 8 seeds: pass, 0 pad lips.** 12 m: 47 crashes in 541 s (5.2 a minute, round 31: 4.7), 14 near the target, closest 3.5 m below a top. 20 m: 36 in 722 s (3.0 a minute, round 31: 3.4), 13 near, closest 2.0 m below a top. 0 hop-like crashes.
- **Alley camera: pass.** cam-clip30 desktop 22 no orbit, cam-clip24 desktop 22 and 58 with orbit, iPhone 22 no orbit: 0 hidden frames, 0 in solid, 0 pops over 1 m in about 6,925 frames each.
- **climb30: pass.** 0 jumps over 1 m (max 0.90 m on desktop and phone). 0 frames in solid. Closest camera 5.4 m. Max drone share 39.4% (round 31 had one frame at 40.3%).
- **People probe: pass.** 0 people on active pads (48 legs, 1,536 samples).
- **Traffic overlap: pass.** 0 in all 6 runs.
- **Phone HUD probe: pass.** iPhone 22, 58, 130: marker on controls 0, drone under pills 0, pops on the drone 0%. Desktop 22: pops cover the drone in 29.6% of pop samples (round 31: 26%). Still open.
- **Chimes with pops: pass.** 43 of 43 chimes had the pop shown within 0.3 s.
- **Exploits: pass.** No-delivery farm 0 on 22, 58, 130. Carry farm 0.25, 0 and 0.24 of honest points a minute. Honest 4,559 / 4,892 / 6,859 (Gold), the same as round 31.
- **Medal gate, breakdown exact on all 6 runs: pass.** Street: 5,892 / 3,745 / 5,836, all Silver, total 15,473 (round 31: 15,439), strict delivery share 66%. Lazy: 1,226 / 1,165 / 1,031, all Bronze, total 3,422 (round 31: 3,231). Seed 58 lazy moved from no medal to a low Bronze. No lazy run gets near Silver.
- **No long task after Play: pass.** 0 long tasks and 0 shader compiles in 3 runs (2 desktop, 1 iPhone).

## Budgets

| Check | Result |
|---|---|
| Triangles, full spot sweep with 1,920 water and marina spots | Desktop 22: 566k. Desktop 130: **588k**. iPhone 130: 524k. Water spots max 463k. 0 spots over 600k. |
| Draw calls | Max 144 desktop, 128 iPhone. Street run max 146. 0 over 150. |
| First load | Production build 2.8 MB without source maps (JS 922 KB, boats.glb 234 KB), 7.0 MB with maps. Type check clean. |
| Street frame time (12 s, 120 Hz vsync, contaminated) | Desktop p95 9.3 / 9.2 ms (normal / rush), max 10.4. iPhone p95 9.5 / 9.4 ms, max 10.3. |
| HUD runs, 80 s | Only frames over 20 ms: the probe ending at 80.5 s, as in round 31. |

**Headroom is nearly gone.** 588k of 600k triangles (2% left) and 146 of 150 draw calls. Cut these first, before any more content. Draw people and cars beyond about 40 m with a lower-detail mesh. Remove the backdrop skyline boxes on the far horizon (they also look pasted on). Pull in the building-detail distance. Each of these frees tens of thousands of triangles.

## Whole game after 32 rounds

Against the best polished indie arcade flying and delivery games I know, Drone Dash now has most of what they have. A readable city with its own moods. A drone that flies with weight. A loop that pays for flying low and fast by the walls. Rush orders, medals, a daily city, sound, and a waterfront that finally looks like sea from play height. The camera holds in alleys and tunnels. The phone layout is clean. Exploits are closed.

What the best ones still do better is mostly feel, and a bot cannot measure feel. Does a near miss feel thrilling? Is 3 to 5 crashes a minute (for a bot) fair or annoying? Does the slipstream chain make a player want one more run? No human played a full run in many rounds. That is the real gate now.

So in what a bot can find, **only polish remains**, apart from the bus bug below.

## Biggest gap: the harbour bus stalls 5 cm short of its first pier

It is cheap to fix, it shows in every run after two minutes, and it undoes this round's "routes feel alive" work.

**Acceptance test:**

- `bus-stop32.mjs` on seeds 22, 58, 4711 and 9001 (700 s each): the bus stops at each pier, waits about 9 s and leaves again. At least 4 stops per seed. Never more than 15 s at speed 0.
- `boats31.mjs` lengthened to 400 s on the same seeds: still 0 hull overlaps, 0 hulls on a dock.
- `boats32.mjs`: still 0 frames inside a hull, 0 stuck.

## Other gaps, ranked

1. **Human playtest overdue (needs a human player).** Play one full run on a laptop and one on a phone. Judge crash fairness, boat pushes, the slipstream chain and the medal pace.
2. **Triangle and draw-call headroom about 2%.** Cut as listed under Budgets before adding content. Test: full sweep max under 540k, draw calls under 140.
3. **Close low-sun water looks hazy.** At 1 to 14 m in golden hour and dusk, the near water smears into soft streaks. It lost all three blind pairs there. Test: run a blind A/B of the golden and dusk g-low and glint views against round 31. The new water wins or ties at least 2 of 3. The cruise ratio stays at most 0.6.
4. **Desktop pops cover the drone** in 29.6% of pop samples (seed 22). Test: under 2% on desktop seeds 22, 58 and 130.
5. **Bus wake in the glitter path.** Golden-hour sunward views: 0.67 and 0.93. Test: all 6 rib and bus sunward views at least 1.2 in golden hour.
6. **A sailboat hull throws the drone sideways at up to 8.5 m/s,** and one low bus hit hopped the drone over the cabin. Cap the side kick near the boat's own speed plus 2 m/s, and keep boats out of the ledge hop. **Needs a human player** to judge how much it matters.
7. **Water cost at the +1.0 ms line** in the low view (0.92 to 1.04 ms, contaminated). Keep it from growing.

## Screenshots (progress/round-32/critic/), 63 files

- **Blind A/B:** `ab/pair-01.jpg` to `ab/pair-10.jpg`, picks in `ab/picks.txt` (written first), key in `ab/.key.json`.
- **Water, desktop:** `water32-r32-{130,22,33,58}-g-cruise.jpg` and `-g-low.jpg` (compare with round 31 `water31-r31-*`), `water32-r32-{130,33}-glint.jpg` (hazy close glint), `water32-r32-{22,58}-shoreline.jpg`.
- **Water, phone:** `water32-r32-m-22-g-cruise.jpg`, `water32-r32-m-22-g-low.jpg`, `water32-r32-m-58-g-marina.jpg`, `water32-r32-m-58-boat-rib.jpg`.
- **Wakes:** `water32-r32-{130,33}-boat-{rib,ferry}.jpg`, `wake32-{130,33}-sunward-{rib,ferry,sail}.jpg` (camera looking into the sun).
- **Boats:** `boats32-22-bus-ram.jpg` (crash flash at the bus side), `boats32-22-bus-hits-drone.jpg`, `boats32-22-bus-hits-drone-late.jpg`, `boats32-22-moored-rib-low.jpg`, `boats32-22-moored-sail-low.jpg`, `boats31-22-drone-in-sail.jpg`.
- **Harbour bus:** `bus32-22-from-promenade.jpg` (scale), `bus32-22-at-pier.jpg` and `bus32-130-at-pier.jpg` (stalled for good), `bus32-130-marina-game-cam.jpg`.
- **Camera:** `cam-clip30-22-r31-noorbit-6-alley.jpg`, `cam-clip-22-6-alley.jpg`, `cam-clip-58-6-alley.jpg`, `cam-clip-58-10-alley.jpg`, `cam-clip-22-m-noorbit-6-alley.jpg`.
- **Other:** `tris31-{d-22,d-130,m-130}-worst.jpg`, `N-alt12-seed91-t12.3-near.jpg`, `N-alt20-seed130-t28.1-near.jpg`, `M-low-seed22-pass2.jpg`, `M-low-seed58-pass2.jpg`, `M-low-c10-seed130-pass1.jpg`, `raw/fr32-d-22-h04-low-payout-pop.jpg` (desktop pop over the drone), `raw/fr32-m-22-h04-low-payout-pop.jpg`, `raw/fr32-m-130-h02-low-drafting.jpg`, `raw/fr32-d-22-h08-end.jpg`.
