# Drone Dash: round 33 critic report

**Verdict:** Pass. The harbour bus now runs all day. The render cost fell by about a quarter with no visible loss. The close glint water is crisp again. One miss by a hair: the draw-call peak is 125, and the target was under 125.

Build tested: the uncommitted round 33 work on top of commit 46b183d. Control: an untouched export of commit 46b183d (round 32). My servers ran on 5191 (round 33) and 5192 (round 32) and are stopped. The owner's server on 5188 was left alone. Every browser ran alone, one job at a time, from `critic-scripts/queue33.sh` and `jobs33.txt`. I did not read the round 33 builder notes. I read the diffs only to learn what to test.

New scripts in `progress/round-33/critic-scripts/`:

- `bus-stop33.mjs`: 700 s per seed, fixed step. Logs every bus stop, its length and pier.
- `cruise33.mjs`: fast flight at cruise height (24 m, 20 m/s, 60 Hz fixed step, every frame drawn) along two avenues. Logs frame change, pops, triangles, draw calls, detail chunks. Shots for the blind A/B.
- `cruise33b.mjs`: the same flight with a 32 x 18 tile grid, to catch small local pops.
- `boats33.mjs`: `boats32.mjs` plus peak drone speed for 1 s after a boat contact.
- `boattrace33.mjs`, `boattrace33b.mjs`: frame-by-frame trace of a boat running into a parked drone (b also logs the distance to the city edge).
- `ab33.py`: blind A/B, 3 sets of 6 pairs. `crash-classify-v-r32c.mjs`: the crash bot pointed at the round 32 control.
- Changed copies: `art27.mjs` and `water31.mjs` take PORT for the control, `water31.mjs` writes `water33-r33-*` and `water33-r32c-*`, `contrast31.py` reads them.

## Machine load (read first)

BTLEServer used 96 to 100% of one core in every check (`cpu-*.txt`). The headless browser still ran at 120 Hz vsync (median 8.3 ms). All wall-clock timings are marked contaminated. Every verdict on bus, boats, water, budgets, camera and pops comes from fixed-step probes.

## Results per item

### Harbour bus: pass

| Seed | Stops in 700 s | Piers | Stop length |
|---|---|---|---|
| 22 | 4 | -36, 40, -36, 40 | 9.0 to 9.25 s |
| 58 | 4 | -36, 40, -36, 40 | 9.0 to 9.25 s |
| 4711 | 4 | -36, 40, -36, 40 | 9.0 to 9.25 s |
| 9001 | 4 | 40, -36, 40, -36 | 9.0 s |

It alternates piers every time. The longest stop is 9.25 s against a limit of 11 s. It sails at 4.6 m/s and creeps under 0.3 m/s for only 2.75 s a run. `wake32.mjs` saw it leave a pier and sail on.

### Budget: triangles pass, draw calls miss by one

Full spot sweep (`trisweep31.mjs`), 1,920 water and marina spots in each:

| Run | Max triangles | Max draw calls | Round 32 |
|---|---|---|---|
| Desktop 22 | 429k | 123 | 566k |
| Desktop 130 | **444k** | **125** | 588k, 144 |
| Desktop 33 | 433k | 122 | |
| iPhone 130 | 408k | 106 | 524k, 128 |
| Water spots only | 348k | n/a | 463k |

Triangles: 444k, target under 480k. Pass. Draw calls: 125 at one city spot (desktop 130, x -60, z 90, 3 m high, facing west), target under 125. A miss by one call. Everywhere else it is at most 123. Street runs peak at 122 (desktop rush) and 103 (iPhone). Fast cruise peaks at 121. One more merged draw clears it.

### Blind A/B against round 32: pass

Picks were written to `critic/ab/picks.txt` before I opened `.key.json`. Top or bottom was random per pair.

| Set | New wins | Ties | Old wins | Result |
|---|---|---|---|---|
| Street (art27 views, desktop and phone) | 0 | 6 | 0 | 6 of 6, pass |
| Water | 3 | 2 | 1 | 5 of 6, pass |
| Fast cruise (24 m, 20 m/s) | 0 | 6 | 0 | 6 of 6, pass |

- Street and cruise pairs look the same. I found no missing far building, no missing far shadow and no thinner city.
- Popping in motion: `cruise33.mjs` found 0 frame pops in 12 passes on both builds. Frame change is the same on both (median 11.2 against 11.2, golden). `cruise33b.mjs` tile pops are equal too (desktop 130: 2,887 against 2,950, phone 22: 6,445 against 6,432). Detail chunks now change 18 to 19 times a pass (round 32: 14 to 15), but that does not show as pops.
- The cut was large. In the art views the round 33 frame draws 22 to 25% fewer triangles and 22 to 26 fewer draw calls. The detail chunks near the drone at 14 to 16 m dropped from 12 to 6, with no visible change in the shots.

### Water: pass, one soft spot left

`contrast31.py`, desktop game camera:

| Mood | Cruise | Low | Ratio | Round 32 control |
|---|---|---|---|---|
| Golden 130 | 18.2 | 35.1 | 0.52 | 0.52 |
| Morning 22 | 16.6 | 30.1 | 0.55 | 0.55 |
| Dusk 33 | 16.7 | 40.6 | 0.41 | 0.42 |
| Noon 58 | 16.8 | 31.2 | 0.54 | 0.55 |

All marks met (cruise at most 0.6 of low, low at least 25, cruise at least 15).

- **Glint views at 14 m: fixed.** Fine contrast in the near water doubled (golden 8.4 to 16.8, dusk 11.0 to 20.8). The new glint views won both blind pairs. The sun path is glitter again, not a soft glow (`water33-r33-130-glint.jpg`).
- **Low views at 1 m: better, not solved.** The golden 1 m view won its pair. The dusk 1 m view lost (weak pick). In the golden low view the bottom third still smears into soft radial streaks (`water33-r33-130-g-low.jpg`). Near-band contrast moved only 8.3 to 8.6 (dusk 10.4 to 12.3).
- **Flat frames with bloom on:** 0 flat, 0 black pixels, at least 39 colours of 49, over 4 moods and 8 views.
- **Grid snap:** snap frames change the same as other frames (for example cruise 6.06 against 6.08).

### Boats: pass

`boats33.mjs`, seeds 22, 58, 4711, 9001, 156 approaches:

- 0 frames inside a hull. 0 frames within 0.4 m of a mast. 0 stuck. 0 pushed down.
- **Low bus hits block like a wall.** 16 of 16 bus rams charged exactly one crash. The highest the drone rose after a 1 m hit was 1.81 m. No hop over the cabin (round 32: one hop to 4.3 m).
- **Bus wake toward a low sun.** Golden sunward views: 2.12, 1.54, 1.12. Dusk: 6.62, 2.40, 2.92. 5 of 6 are at least 1.3 (round 32: 0.93 and 0.67 in golden). In the shot the wake reads as a bright line behind the bus (`wake32-130-sunward-ferry.jpg`). The 1.12 view looks along the glitter path.
- **Sideways throw: no boat throws the drone above the cap.** A bus that hits a parked drone gives it 5.3 m/s at most. The bus moves at 4.6 m/s, so the cap is 6.6 m/s. The big sailboat number from round 32 (8.5 m/s, now 9.8 on seed 4711) is not the boat. `boattrace33b.mjs` shows the drone sitting 197 m out, past the soft city edge, and the edge spring pulls it inward. The probe parks the drone there. The round 32 control gives the same trace.
- **New find, not a regression: the bus snaps the drone sideways.** The bus bow pushes a parked drone. Then the drone jumps 0.55 m sideways in a single frame. This happens 3 or 4 times, about every 10 frames (33 m/s for one frame). Its real speed stays near 5 m/s. Round 32 does the same. On screen this can look like a stutter. **A human player must judge it.**

## Regressions

- **Flat-frame probe, bloom on: pass.** 943 frames, 0 flat, 0 errors.
- **Crash-classify, 8 seeds: pass, 0 pad lips.** 12 m: 55 crashes in 493 s (6.7 a minute), 12 near the target, closest 6.2 m below a top. 20 m: 40 in 648 s (3.7 a minute), 15 near, closest 2.6 m below a top. 0 hop-like crashes. The 12 m rate is the highest so far (round 32: 5.2). But the same bot on the round 32 control today gave 5.9 a minute and 1 hop-like crash. The bot is not fully repeatable, so I count this as noise.
- **Alley camera: pass.** cam-clip30 desktop 22 no orbit, cam-clip24 desktop 22 and 58, iPhone 22 no orbit: 0 hidden, 0 in solid, 0 pops over 1 m, about 6,930 frames each.
- **climb30: pass.** 0 jumps over 1 m (max 0.89 desktop, 0.90 phone), 0 frames in solid, closest camera 5.4 m, max drone share 39.2%.
- **People probe: pass.** 0 people on active pads (48 legs, 1,536 samples).
- **Traffic overlap: pass.** 0 pair frames in all 6 runs.
- **Phone HUD probe: pass.** iPhone 22, 58, 130: marker on controls 0, drone under pills 0, pops on the drone 0%. Desktop 22: pops cover the drone in 22.6% of pop samples (round 32: 29.6%). Still open.
- **Chimes with pops: pass.** 34 of 34 chimes had the pop shown within 0.3 s.
- **Medal gate, breakdown exact on all 6 runs: pass.** Street: 6,274 Gold, 3,457 Silver, 6,612 Gold (total 16,343, round 32: all Silver, 15,473 total). Strict delivery share 66%. Lazy: 1,086 / 1,145 / 1,040, all Bronze, total 3,271. No lazy run near Silver. The street bot now reaches Gold on 2 seeds. Worth a human look at the medal pace.
- **Exploits: pass.** No-delivery farm 0 on 22, 58, 130. Carry farm 0.25, 0 and 0.24 of honest points a minute. Honest 4,559 / 4,892 / 6,859, the same as round 32.
- **First load: pass.** Production build 3.0 MB without source maps (JS 952 KB), 7.3 MB with maps. Type check clean. The JS chunk is now over Vite's 900 KB warning line.
- **No long task after Play: pass.** 0 long tasks, 0 new shader programs in 3 runs (2 desktop, 1 iPhone).

## Budgets and CPU-load notes

| Check | Result |
|---|---|
| Triangles, full sweep | Max 444k desktop, 408k iPhone (round 32: 588k, 524k). Fixed step, not affected by load. |
| Draw calls | Max 125 desktop sweep, 106 iPhone. Street run 122 / 103 (round 32: 146). |
| First load | 3.0 MB. |
| Street frame time, 12 s (contaminated, 120 Hz vsync, BTLEServer 99%) | Desktop p95 9.1 / 9.2 ms (normal / rush), max 10.3. iPhone p95 9.7 / 9.6 ms, max 10.4. 0 frames over 20 ms. |
| HUD runs, 80 s (contaminated) | Only frames over 20 ms: the probe ending at 80.5 s, as before. |

Headroom is back: 136k triangles and about 25 draw calls under the old 600k and 150 limits.

## Whole game after 33 rounds

The bot finds no gap left that clearly limits the game. Flight, camera, city, water, boats, scoring, medals, exploits, phone layout and budgets all pass. The open bot items are small. One draw call is over target. Pops cover the drone on desktop. The water at 1 m in golden hour is soft. The bus snap is possibly visible.

So in what a bot can measure, **only polish remains.** The real gate is a human playing. No person played a full run in many rounds. Feel decides the rest: crash fairness, near-miss thrill, the slipstream chain, medal pace, and touch controls.

## Ranked list

1. **Human playtest (needs a human player).** Desktop and phone, using the guide below. Everything else waits on this.
2. **Medal pace (needs a human player).** The street bot now reaches Gold on 2 of 3 seeds. Is Gold too easy, or just right for a good player?
3. **Desktop pops cover the drone** in 22.6% of pop samples (seed 22). Test: under 2% on desktop seeds 22, 58, 130.
4. **Bus snaps a parked drone 0.55 m sideways in one frame,** 3 or 4 times per contact. Test: in `boattrace33.mjs`, no single-frame move is over 0.15 m beyond the drone's own speed. **A human player must judge how visible it is.**
5. **Draw calls 125 at one spot.** Test: full sweep under 125 on desktop 22, 130, 33.
6. **Golden water at 1 m** still smears in the bottom third. Test: blind A/B of golden and dusk g-low against round 33, new wins or ties both, cruise ratio stays at most 0.6.
7. **JS chunk 952 KB,** over Vite's warning line. Not a load problem yet (3.0 MB total).

## Human playtest guide (15 minutes)

Play on a laptop first (10 minutes), then on a phone turned sideways (5 minutes). Write one line per point.

1. **First minute.** Start a fresh run without reading anything. Do you know where to go and what to do within 30 seconds? Note anything you had to guess.
2. **Crashes.** Fly low and fast between buildings for 2 minutes. After each crash, ask: did I deserve that? Count the crashes that felt unfair, and say where they happened (pad edge, corner, alley, tunnel).
3. **Slipstream chain.** Hug walls to build a chain, then deliver. Do you notice the bonus build up and pay out? Does it make you want to take more risk? Do the pops ever hide your drone?
4. **Medals.** Play one full run to the end. Which medal did you get, and did it feel earned? Do you want to try once more for the next one?
5. **Harbour.** Fly out over the water near the piers at low height. Does the water look good up close and from cruise height? Let the harbour bus run into your hovering drone. Does the push look smooth, or does the drone jump?
6. **Fast cruise.** Fly high and fast across the whole city. Do buildings, trees or people pop in or out? Does the city look full?
7. **Phone.** On the phone: are the stick and buttons comfortable? Do your thumbs hide anything important? In rush hour, with many pops on the screen, does the game stay smooth?
8. **One word.** At the end, describe the game in one word, and name the one thing to change first.

## Screenshots (progress/round-33/critic/), 56 files

- **Blind A/B:** `ab/street-1.jpg` to `ab/street-6.jpg`, `ab/water-1.jpg` to `ab/water-6.jpg`, `ab/cruise-1.jpg` to `ab/cruise-6.jpg`. Top or bottom is random. Picks in `ab/picks.txt` (written first), key in `ab/.key.json`.
- **City, round 33:** `art27-d-hour-130-street.jpg`, `art27-d-hour-130-mid.jpg` (compare `art27c-d-hour-130-mid.jpg`, round 32), `art27-m-morning-22-cruise.jpg`.
- **Fast cruise:** `cruise33-r33-130-ns-1.jpg`, `cruise33-r33-22-ew-1.jpg`, `cruise33-r33-m-22-ns-2.jpg` (compare `cruise33-r32c-m-22-ns-2.jpg`).
- **Water, glint:** `water33-r33-130-glint.jpg`, `water33-r33-33-glint.jpg` (crisp). Round 32: `water33-r32c-130-glint.jpg`.
- **Water, low:** `water33-r33-130-g-low.jpg` (soft bottom third), `water33-r33-33-g-low.jpg`. Round 32: `water33-r32c-130-g-low.jpg`, `water33-r32c-33-g-low.jpg`.
- **Water, cruise and phone:** `water33-r33-130-g-cruise.jpg`, `water33-r33-58-g-cruise.jpg`, `water33-r33-m-22-g-cruise.jpg`, `water33-r33-m-22-g-low.jpg`.
- **Wakes and bus:** `wake32-130-sunward-ferry.jpg`, `wake32-130-sunward-rib.jpg`, `wake32-33-sunward-ferry.jpg`, `bus32-130-at-pier.jpg`, `bus32-130-from-promenade.jpg`.
- **Boats:** `boats33-22-bus-ram.jpg`, `boats33-22-bus-hits-drone.jpg`, `boats33-22-sail-low.jpg`, `boats33-22-moored-rib-low.jpg`.
- **Crashes near a target:** `N-alt12-seed91-t40.3-near.jpg`, `N-alt20-seed130-t45.2-near.jpg`.
- **Medals:** `M-low-seed22-pass2.jpg`, `M-low-seed130-pass3.jpg` (Gold), `M-low-c10-seed58-pass1.jpg` (lazy Bronze).
- **Camera:** `cam-clip-22-6-alley.jpg`, `cam-clip-22-m-noorbit-6-alley.jpg`.
- **HUD:** `raw/fr33-d-22-h04-low-payout-pop.jpg` (desktop pop over the drone), `raw/fr33-m-22-h04-low-payout-pop.jpg`, `raw/fr33-d-22-h08-end.jpg`.

The other 280 shots from the probes are in the session scratchpad, not in the project.
