# Drone Dash: round 36 critic report

**Verdict:** Pass on the water bar. I found 0 views with sea inside any hull. Every flag the probes raised is open sea outside the hull. The new rigging, the sail or a pier beam frames it. I checked each case pixel by pixel. The new boats win the blind A/B 5 of 6 and the wakes win 6 of 6. No regression found.

## Setup

- Build tested: the working tree on top of commit 5a53f9e ("Round 35: ..."), round 36 builder work, not committed yet.
- Control: a clean `git archive` of 5a53f9e in the scratchpad (`c36/r35c`).
- My servers: 5191 (round 36 dev), 5192 (round 35 control dev), 5193 (round 36 production preview from my own build). Each dev server had its own Vite cache folder in the scratchpad, HMR off. I did not touch the owner's server on 5188. All three of mine are stopped now.
- I did not read `builder.md`. I read `src/` only for hooks and the diff (wake shader, sail flutter, lid material).
- Every browser ran alone, one job at a time, from `critic-scripts/queue36.sh` and `jobs36.txt`.
- Machine load (top process): hull probe XprotectService 21%, boats loginwindow 10%, cold load coreaudiod 13%, perf systemstats 13%, medal run coreaudiod 5%.

## New or changed scripts (progress/round-36/critic-scripts/)

- `hullwater35.mjs`: unchanged copy, run with `TAG=r36` and `TAG=r35c`.
- `seams36.py`: a fix to round 35's offline check. The probe paints its own in-browser leaks green in the `-M` frames. `seams35.py` only read magenta, so it never saw those pixels. Now green counts as sea too. Round 35's "18 of 151" missed some views for this reason.
- `seams36.mjs`: as `seams35.mjs`, and it also writes each leak's pixels so I can crop them.
- `hwdbg36.mjs`: the hull probe plus, for each leak, where the probe's ray-march thinks the sea is (in boat coordinates) and which boat it blames. It also saves sweep frames that leak.
- `hwlid36.mjs`: adds two frames per view with the water hidden: `-L1` shows the lid in magenta, `-L2` has no lid. A ray into a real hole in a hull hits wood in `-L2`. A ray over open sea hits the sea bed.
- `wake36.mjs`: wake views from above (straight down, and a 20 m chase view) for the wake A/B.
- `ab36.py`: two blind sets, boats and wakes. Keys are written hidden before judging.
- `stuck36.mjs` and `stuck36b.mjs`: the sailboat low ram with a frame-by-frame trace.

## Sea inside hulls

| Run | Views | Sweep frames | Caps-off control (sea in hull) |
|---|---|---|---|
| Desktop, golden / morning / dusk | 183 | 432 | 49 views, 178 sweep frames |
| Phone (iPhone 13), same | 183 | 216 | 70 views, 99 sweep frames |

The control is live: with the lids off the rowing boat and the sailboat fill with sea (`hw35-r36-golden-row-into-hull-M0.jpg`).

**Flags raised with the lids on, and what they were:**

- In-browser leak column: desktop 12 views and 14 sweep frames, phone 28 views and 5 sweep frames. Almost all on the sailboat, plus a few rowing-boat views of 1 to 22 px.
- Offline seam check (fixed): 7 of 168 saved round 36 views, 3 to 674 px. The round 35 control gives 8 of 42 on its smaller set, including the old thwart lines (770 px in the morning sailboat).

**I checked the flags pixel by pixel** (normal frame, lid-on magenta, lid-off magenta side by side, at 3 to 5 times zoom):

1. Sailboat, very close, golden and dusk (3,646 and 3,788 px): the patch sits between the boom, the mast, a shroud and the far rail. It is the same shape with the lid off. In the water-hidden frame the same pixels show the sea bed, not wood. So it is sea beyond the far rail (`leak-check-rigging-1.jpg`, `lid-shown-and-water-hidden.jpg`).
2. Sailboat, sun behind the sail, phone (674 px): sea beyond the far rail, framed by the boom, the mast and a stay (`leak-check-rigging-1.jpg`, top row).
3. Moored sailboat, into the hull, phone, and the bow sweep frames (600 to 2,400 px): a triangle of sea beyond the bow, between the sail foot, the bow block and the forestay (`leak-check-sweep-bow.jpg`).
4. Sailboat side views and moored stern views (13 to 256 px): slivers of sea beyond the far rail, split off by a shroud or a small post. With the lid off the shroud line joins them to a bigger patch, so the offline rule fires (`leak-check-rigging-2.jpg`).
5. Moored sailboat stern and bow views (100 to 1,160 px): sea just beyond the far gunwale of the moored rowing boat, under the pier beam (`leak-check-pier-rail.jpg`).
6. Rowing boat moored stern (3 px): a JPEG speck inside open sea.

So the builder's claim holds. The new rigging and sail frame small patches of open sea, and the probe's ray-march misplaces them. I traced why. A ray can graze a far rail. Then the ray-march puts the sea hit inside the hull (median 0.43 of the half-beam in case 1). But the water-hidden frame shows that the ray clears the hull. Use the water-hidden frame in future seam tests, not the ray-march.

**Result: 0 views with sea inside a hull.** This is true for every boat kind, on desktop and phone, in all three moods and all sweeps. Round 35 had 18 of 151 by its own count (more with the green fix).

**The lid hides nothing but sea.** In some places the lid-on and lid-off frames differ off the water. There the difference is a 1 px rim on the edge of the old sea area, never a part. See `lid-diff-row-inside-close.jpg`: the deck, thwart and oars are all there. One case was marked "lid hid sea outside the hull" (phone, moored rowing boat, 1,502 px). It is sea inside that rowing boat, again misplaced by the ray-march. No flat lid shows in any view. No boat carries a person.

**Motion:** bob heave -0.20 to +0.24 m in the sweeps, rib at planing trim, three views per step: 0 frames with sea in a hull.

## Blind A/B: round 36 against round 35 (5a53f9e)

Same seed, time and pose. Picks in `critic/ab/picks-boat.txt` and `picks-wake.txt`, written before I opened `.key-boat.json` and `.key-wake.json`.

**Close boat views** (`ab/boat-1.jpg` to `boat-6.jpg`)

| Pair | View | My pick | Result |
|---|---|---|---|
| 1 | Golden, sailboat, into the hull | rigging and gaff, clear | **new wins** |
| 2 | Golden, rowing boat, into the hull | thwarts and oars, clear | **new wins** |
| 3 | Morning, rib, low quarter | weak | old wins (the new rib trails a pale streak) |
| 4 | Dusk, sailboat, very close | shrouds, clear | **new wins** |
| 5 | Golden, bus, low quarter | rails, windows, deck houses, clear | **new wins** |
| 6 | Phone, golden, sailboat, low quarter | rigging, weak | new wins |

5 of 6: pass.

**Wakes from above** (`ab/wake-1.jpg` to `wake-6.jpg`)

| Pair | View | Result |
|---|---|---|
| 1 | Golden, sailboat, straight down | **new wins**, clear |
| 2 | Golden, rib, chase view into the sun | **new wins**, clear |
| 3 | Morning, bus, straight down | **new wins**, clear |
| 4 | Morning, rib, straight down | **new wins**, clear |
| 5 | Dusk, sailboat and marina, chase view | **new wins**, clear |
| 6 | Phone, golden, rib, straight down | **new wins**, clear |

6 of 6: pass. Every old wake has the pale box round the hull and the bright fan. Every new one has thin V lines.

## Round 35 low-quality list

| Item | Status | Evidence |
|---|---|---|
| Wakes: pale rectangle and torch-beam fan | **Fixed.** No box round any hull, no fan. Thin V arms, an echo line, a wash band hugging the hull. A soft pale haze still lies inside the V just behind the transom, and the arms look dotted, like perforations. | `ab/wake-*.jpg`, `wake36-r36-*` vs `wake36-r35c-*`, `hw35-r36-golden-sail-above.jpg` vs `hw35-r35c-golden-sail-above.jpg` |
| Flat sail, no rigging | **Fixed.** Gaff and boom, a curved sail with belly, shrouds and a forestay, a slight flutter. Lit through with the sun behind. | `sheet-r36-golden-sail.jpg`, `hw35-r36-morning-sail-sun-behind-sail.jpg` |
| Empty eight-sided rowing tub | **Fixed.** Thwarts, two oars, oarlocks, a proper pointed bow. Still a little wide. | `sheet-r36-golden-row.jpg`, `hw35-r36-dusk-row-very-close.jpg` |
| Bare white bus, band with steps | **Improved.** The band is clean at 1 m (no steps). Rails, window rows, deck houses, funnel. Still white boxes with black window strips, no texture. | `bus-band-and-rib-r35c-left-r36-right.jpg`, `sheet-r36-golden-ferry.jpg` |
| Faceted rib tubes | **Improved.** Seats are now round, the white bands lost the hatch. The outer tubes still show hard facets along their length. | `bus-band-and-rib-r35c-left-r36-right.jpg`, `sheet-r36-golden-rib.jpg` |

**Against polished stylized games** (described in words): the best stylized harbours give each boat a clear silhouette, chunky deliberate detail and foam that hugs the hull. The sailboat and rowing boat now meet that bar. What still reads low quality, most visible first:

1. **The sea right around the boats.** In every low view it is a leopard print of navy blobs on cream, with hard blob edges. It reads as camouflage more than water, and it frames every boat (`sheet-r36-golden-sail.jpg` low side, bow, stern).
2. **Wake texture.** The arms are dotted, and the soft haze behind the transom is still a faint beam in the chase view (`wake36-r36-golden-rib-cruise.jpg`).
3. **The bus** is clean but plain: flat white, black strips for windows.
4. **The rib** tubes show facets at close range.

## Faces

About 400 close round 36 frames checked. No holes in the outer hulls, no flipped faces, no z-fighting, no lid shimmer. Rigging lines are thin and stable. No stretched sail texture. The sail flutter is small and does not tear the sail.

## The sailboat "stuck" case, seed 22

- `boats32` on seed 22, 5 runs on round 36: 1 run marked stuck (run 3). Round 35 control, 2 runs: 0. With the traced copy (`stuck36b.mjs`) it showed again on run 4 of 4. So it is about 1 run in 4 to 5, on both builds (round 35 saw it too).
- `stuck36.mjs` (60 low rams with time offsets): 0 stuck. The case needs the exact boats32 sequence. It is not deterministic between page loads.
- The trace (`stuck36b-22-4.log`): the drone rams the side at 0.9 m and 39 m/s. It clips the top edge of the hull box and goes up to 1.2 m. No crash is charged (a top-edge graze). W is let go after 21 frames. The drone then hovers with no input. Its centre stays 0.95 m (its own radius) above the hull box top. The boat slides under it from bow to stern at 2.4 m/s for 2.5 s. The mast passes through it as a soft column (a scrape). Past the stern it drifts away at up to 6 m/s. In the other runs it bounces off within 3 to 7 frames.
- **Verdict: not a game bug in the sense of being stuck.** The drone is never trapped. A player can fly off at any frame. The probe flags it because contact lasts over 111 frames. Two small real oddities: the drone hovers on an invisible box about a drone-radius above the deck, and the sail passes through the drone.

## Regressions

| Check | Round 36 | Round 35 |
|---|---|---|
| boats33, seeds 22, 58, 4711, 9001 | 156 approaches: 0 inside a hull, 0 near a mast, 0 pushed down, 0 stuck, longest contact 112 frames. Bus rams 16 of 16 charged one crash. | 1 stuck |
| Mast and rigging hits | 24 of 24 mast-height rams touch the soft mast. 0 crashes at the mast. The 4 crashes in that group are 47 to 57 m past the boat (W still held, into the wall). | 3 such |
| boats31 overlap, 120 s, seeds 22, 58, 5150 (new) | 0 hull on hull, 0 hull on dock, 0 in a solid. Heave 0.27 m. Sailboat fly-through 0 crashes. | 0 |
| Bus-stop probe, 4 seeds | 4 stops each, piers alternate, stops 9.0 to 9.25 s, top speed 4.6 m/s | same |
| boattrace33, seeds 4711 and 22 | largest single-frame move beyond own speed 0.008 to 0.013 m, 0 frames over 0.15 m | 0.008 to 0.013 m |
| Flat frames, bloom on | 939 frames, 0 flat, 0 errors. All 366 hull-probe views (6 sun-behind-sail views per device, rigging against the sun): 0 flat. | 0 |
| Crash-classify 12 m | 21 crashes in 195 s (6.5 a minute), 0 hop-like, 0 at a lip height | 5.7 a minute |
| Crash-classify 20 m | 13 in 278 s (2.8 a minute), 0 hop-like, 0 at a lip height | 2.2 a minute |
| Water contrast31 cruise ratio | golden 0.51, morning 0.53, dusk 0.40, noon 0.53 (all at most 0.6) | 0.52 / 0.54 / 0.41 / 0.54 |
| People probe | 0 people on active pads (48 legs, 1,536 samples) | 0 |
| Traffic overlap | 0 pair frames on 3 seeds | 0 |
| Phone HUD probe 22, 58, 130 | marker on controls 0, drone under pills 0, pops on drone 0. Pops over the top column 104 of 246, 119 of 249, 87 of 293. | 106/275, 89/224, 84/247 |
| Street medal gate 22, 58, 130 | 5,906 Silver, 4,026 Silver, 5,378 Silver. Breakdown and end screen sum exact on all 3. | 4,800 S / 2,990 S / 6,188 G |
| Cold load, no unstyled flash | 8 cold loads (dev and production, desktop and phone): 0 bad frames. Production styled title at 11 to 15 ms. | 0 |
| `npm run build` (tsc, build to the scratchpad) | No chunk warning. three 587 kB, game 356 kB, StreetAssets 45 kB, lil-gui 31 kB, three-post 19 kB, CSS 40 kB. | same |

The crash rate at 12 m moved from 5.7 to 6.5 a minute. No crash or flight code changed this round, and the bot's runs swing like this between rounds.

## Perf

| Check | Desktop | iPhone 13 |
|---|---|---|
| Street, normal, no frame cap | median 3.6, **p95 7.9**, max 25.2 (1 frame over 20 ms) | median 2.6, **p95 5.2**, max 21.9 (1 over 20) |
| Street, rush | median 3.6, **p95 7.6**, max 11.5 | median 2.5, **p95 4.8**, max 9.1 |
| Harbour, close to boats | median 3.3, **p95 8.3**, max 28.1 | median 2.5, **p95 3.7**, max 21.5 |
| Phone HUD runs, 80 s, vsync | | p95 9.6 to 9.7 |

- All p95 under 12 ms. The harbour p95 rose from 7.5 to 8.3 ms on desktop (the new wake shader and rigging). That is still well inside the budget.
- Draw calls over the full spot sweep (about 3,300 spots each): desktop 119, 113 and 115 on seeds 130, 22 and 33, iPhone 104 on 130. All under 125. Round 35: 117 and 97.
- Triangles: max 443k desktop, 410k iPhone. Under 480k. Round 35: 430k and 398k.
- First load on the wire (production, 4 cold loads): **2.73 MB** with all street assets. Round 35: 2.48 MB. `boats.glb` grew from 211 kB to 460 kB.

## Single biggest gap for the boats and water

**Camouflage sea round the boats**

The sea right around the boats looks like a camouflage print. Look at any low view, with the drone under about 4 m by the marina. The water is large navy blobs with hard edges on a cream sheen. The boats are now better than the water they sit in.

Acceptance test:
1. Run `water31.mjs` on seeds 130, 22, 33, 58 and `contrast31.py`. The `low` value (drone at 2 m) is now 35.2, 30.8, 40.7, 31.3. Pass: under 24 on all four, with the cruise ratio still at most 0.6.
2. Make a blind A/B of 6 low boat views against round 36. Use the low side and low quarter views of the sailboat, rib and rowing boat, at golden hour and morning. Pass: new wins 5 of 6.
3. The hull probe still gives 0 views with sea in a hull, and flat frames stay 0.

## Other gaps

1. **Wake texture.** The arms look dotted, and a soft haze sits behind the transom (it lost A/B pair 3 for the rib). Test: in the straight-down wake views, no dotted gap along an arm is longer than 3 px. The core behind the transom is not brighter than the arms.
2. **Sailboat ride-along.** In about 1 run in 4 of the seed 22 low ram, the drone hovers on the hull box top. The boat and its sail slide through it for 2.5 s. Test: run boats32 on seed 22 10 times. Pass: longest contact under 111 frames in all runs. The drone centre is never inside the sail's soft column for more than 10 frames.
3. **Phone pops over the top column** in 30 to 48% of pop samples. Not new. Test: under 5% on 22, 58, 130 with pops on the drone still 0.
4. **Bus and rib detail.** The bus is plain white with black strips. The rib tubes show facets. Test: blind A/B of 4 close bus and rib views against round 36 wins 3 of 4.
5. **Human playtest and medal pace.** These still need a human player.

## Screenshots (progress/round-36/critic/)

- Blind A/B: `ab/boat-1.jpg` to `boat-6.jpg`, `ab/wake-1.jpg` to `wake-6.jpg`, picks and hidden keys beside them.
- Sea in hull checks: `leak-check-rigging-1.jpg`, `leak-check-rigging-2.jpg`, `leak-check-sweep-bow.jpg`, `leak-check-pier-rail.jpg` (normal / lid on / lid off, zoomed), `lid-shown-and-water-hidden.jpg`, `lid-diff-row-inside-close.jpg`, `hw35-r36-golden-row-into-hull.jpg` and `-M0.jpg` (live control).
- Boats: `sheet-r36-golden-sail.jpg`, `sheet-r36-golden-row.jpg`, `sheet-r36-golden-rib.jpg`, `sheet-r36-golden-ferry.jpg`, `hw35-r36-golden-sail-into-hull.jpg`, `hw35-r36-morning-sail-sun-behind-sail.jpg`, `hw35-r36-m-golden-sail-low-quarter.jpg`, `hw35-r36-dusk-row-very-close.jpg`, `bus-band-and-rib-r35c-left-r36-right.jpg`.
- Wakes: `hw35-r36-golden-sail-above.jpg` vs `hw35-r35c-golden-sail-above.jpg`, `hw35-r36-golden-ferry-stern.jpg`, `wake36-r36-golden-rib-cruise.jpg` vs `wake36-r35c-golden-rib-cruise.jpg`, `wake36-r36-morning-rib-top.jpg` vs `wake36-r35c-morning-rib-top.jpg`, `wake36-r36-dusk-sail-cruise.jpg`.
