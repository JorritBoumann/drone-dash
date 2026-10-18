# Drone Dash: round 35 critic report

**Verdict:** A big step up, but not a pass on the strict water bar. The sea no longer fills any hull. The new boats win the blind A/B 6 of 6. But thin lines of sea still show through gaps inside the sailboat in 18 of 151 checked close views. No regression found.

## Setup and servers

- Build tested: the working tree on top of commit 8284d4a (round 35 builder work, not committed yet).
- Control: a clean export of commit 05cd223 (round 34) in the scratchpad.
- My servers: 5191 (round 35 dev), 5192 (round 34 control dev), 5193 (round 35 production preview). All three are stopped now.
- Each dev server used its own Vite cache folder in the scratchpad. HMR and file watching were off. I did not touch the owner's server on 5188.
- I did not read `builder.md`. I read `src/` only for the test hooks.
- Every browser ran alone, one job at a time, from `critic-scripts/queue35.sh` and `jobs35.txt`.
- Bulk shots are in the session scratchpad. The chosen ones are in `critic/`.

## Machine load

- Start: claude 14%, NordVPN 8%.
- Perf runs: XprotectService 36%, systemstats 15% (`cpu-perf.txt`).
- Hull probe: coreaudiod 14% (`cpu-hull.txt`). Harbour perf: Safari SafeBrowsing 20% (`cpu-perf2.txt`).

## New scripts (progress/round-35/critic-scripts/)

- `hullwater35.mjs`: the water-in-hull probe. It uses fixed steps.
  - Per view it renders three frames and reads each one back at once.
  - Frame 1 is the normal frame. It is saved and gets the flat check.
  - Frame 2 forces the water colour to magenta, with the caps as shipped.
  - Frame 3 is the same with the caps off. This is the positive control.
  - I patch the water through the three.js devtools hook and the water material. I do not use the builder's magenta cap mask.
  - Views per boat: two low views at the waterline (side and quarter), one into the hull and one straight down.
  - Also: bow, stern, side, 0.6 m outside the rail, 1.6 m above the floor, and at the waterline 1.2 m off.
  - The sailboat also gets a view with the sun behind the sail.
  - Boats: sailboat (moving and moored), rib, rowing boat (moving and moored), harbour bus.
  - Light: golden (seed 130), morning (22), dusk (33). Desktop and iPhone 13.
  - Then a sweep: steps of 0.53 s while the boats bob and roll and the rib planes. Three views per step.
- `seams35.py` and `seams35.mjs`: offline check of the magenta frames.
  - A leak is a closed patch of sea in the caps-on frame. It must not touch the frame edge.
  - The same pixels must be part of a patch at least 3 times larger with the caps off. So the cap was meant to cover it.
  - Sea seen between pier posts or over the far rail is the same with and without caps. It does not count.
- `perf-harbour35.mjs`: frame time with no frame cap. The game camera hovers at the marina, then follows the sailboat, the rib and the bus.
- `ab35.py`: blind A/B of six close boat views.
- Changed copies: `water31.mjs` (tags r35 and r34c), `contrast31.py` and `ab34.py` (scratch folder c35), `fouc34.mjs` (names). The rest are copies from rounds 31 to 34.

## Water inside hulls

**The probe can see the fault.**
- Caps off: open sea fills the hull in 34 of 183 desktop views and 41 of 183 phone views. Also in 104 of 432 desktop sweep frames.
- Round 34 control: sea fills the hull in 38 of 183 desktop views and 15 of 61 phone views. The worst frame has 158,000 px of sea in a hull (`hw35-r34c-golden-row-into-hull.jpg`). This is the owner's bug.

**Round 35 with the caps on: no open sea in any hull.**
- The rowing boat shows its planked floor. Compare `hw35-r35-golden-row-into-hull.jpg` with the control and with the caps-off frame `hw35-r35-golden-row-into-hull-M0.jpg`.
- The sailboat shows its deck, thwarts, barrel and crates. The rib shows its grey floor.
- The bus is closed. It never shows sea.

**But not 0 frames.** Thin lines of sea still show through gaps inside the sailboat.

| Run | Views checked | Views with sea in a hull | Largest patch |
|---|---|---|---|
| Desktop, 3 moods | 62 | 8 (5 sailboat, 3 rowing boat) | 754 px |
| Phone, 3 moods | 89 | 10 (all sailboat) | 1,370 px |
| Round 34 control | 183 desktop | 38, hull full | 158,000 px |

- Where on the sailboat:
  - A line 1 to 2 px wide along the seam between the floor and the side planks.
  - Short lines under the front edge of each thwart.
  - On the moored sailboat, a small patch in the bow corner, seen from close.
- Magenta frames: `hw35-r35-golden-sail-into-hull-M.jpg`, `hw35-r35-morning-sail-moored-into-hull-M.jpg`, `hw35-r35-m-golden-sail-moored-very-close-M.jpg`.
- The lines also show as thin blue lines in the normal frame. See the bottom left of the deck in `hw35-r35-morning-sail-moored-into-hull.jpg`, and the bow corner in `hw35-r35-m-golden-sail-moored-very-close.jpg`.
- The rowing boat hits are 3 to 25 px, only in the straight-down views. The rib has 0.
- The worst desktop view is 0.08% of the frame. That is small. But it is the exact fault the owner named. A player who hovers over a moored sailboat sees it.
- In motion: the sweep found sea in a hull in 1 of 432 desktop frames and 0 of 216 phone frames. That one frame is the sail seam again.
- The rib at planing trim: 0. Largest heave in the sweeps: 0.26 m. There is no hook to force an extreme roll, so I did not test one.

**The opposite fault: none found.**
- The lid never hid the deck, the floor, a thwart, the barrel or the crates.
- Off the water, the caps-on and caps-off frames differ only on a soft rim 1 to 2 px wide at the lid edge. I removed that rim in the worst view (3,581 px on the phone). Then 1 px was left.
- No flat lid surface shows in any view. This includes the camera 0.6 m from the rail and 1.6 m above the floor.
- No boat carries a person in this build. So the lid cannot hide one.
- Some pixels were marked "sea hidden outside the hull" by my ray-march. When I looked, all of them were inside the rowing boat. The ray-march is not exact near the hull.

## Blind A/B: round 35 against round 34 (05cd223)

Same seed, same time, same pose relative to the boat. I wrote my picks to `critic/ab/picks.txt` before I opened `critic/ab/.key.json`.

| Pair | View | My pick | New side | Result |
|---|---|---|---|---|
| 1 | Golden, sailboat, into the hull | bottom, clear | bottom | **new wins** |
| 2 | Golden, rowing boat, into the hull | top, clear | top | **new wins** |
| 3 | Morning, rib, low quarter | top, weak | top | new wins |
| 4 | Dusk, sailboat, very close | bottom, clear | bottom | **new wins** |
| 5 | Golden, bus, low quarter | bottom, weak | bottom | new wins |
| 6 | Phone, golden, sailboat, low quarter | top, clear | top | **new wins** |

6 of 6, so this is a pass (the bar is 5). The four clear wins are the open hulls (no sea, wood grain and planks) and the sail with the sun behind it. The two weak wins: the rib reads a little clearer. The bus lost its faceted bow triangles, but its dark band now shows jagged steps (see Faces).

## Quality against good stylized boats

The polished stylized games I know with good boats have these things (in words only):
- a strong silhouette for each boat type,
- chunky but deliberate detail: oars, rope, fenders, a curved sheer line,
- sails with a belly and a few rigging lines,
- wakes as foam that hugs the hull, plus a V of ripples,
- textures that stay sharp at the closest camera.

What is good now:
- Wood. The hulls have planks with grain, a painted band and a wet band at the waterline. The sailboat has deck boards. It reads as wood at 1 m.
- Smooth shading. The faceted triangles on the bus bow and the sailboat hull are gone.
- With the sun behind it, the sail glows softly (`hw35-r35-morning-sail-sun-behind-sail.jpg`, A/B pair 6).
- Bobbing is smooth, with a heave of about 0.27 m. No boat overlaps another boat or a dock.

What still looks low quality, most visible first:
1. **Wakes from above.** Each moving boat sits in a pale rectangle. A wide bright fan spreads behind it, like a torch beam on the water (`hw35-r35-golden-sail-above.jpg`, and the bus in `hw35-r35-golden-ferry-stern.jpg`). Round 34 has the same fault (`hw35-r34c-golden-sail-above.jpg`). From the game camera, this is the most artificial part of the boats.
2. **The sail is a flat sheet.** It has no belly and no curve. It has no stays and no sheets. From the side it looks like card (`sheet-golden-sail.jpg`).
3. **The rowing boat is an empty tub with eight sides.** It has no thwarts, no oars and no oarlocks. At 4.6 m by 2.4 m it looks wide and boxy next to the pier (`sheet-golden-row.jpg`, `hw35-r35-dusk-row-very-close.jpg`).
4. **The harbour bus is white boxes.** It has almost no texture. Its 1,024 px texture covers a 14 m hull. Close up, the dark band has an edge with steps of about 10 px (`hw35-r35-dusk-ferry-very-close.jpg`). A few dark rectangles stand in for windows.
5. **The rib.** The tubes are prisms with eight hard sides. The seats are boxy logs. The white bands have a fine diagonal hatch, which can shimmer in motion (`hw35-r35-morning-rib-very-close.jpg`).
6. **The water at 1 m around the boats** is a busy pattern of blue and cream blotches. It frames every low boat view (`sheet-golden-rib.jpg`). This is not a boat fault, but it makes the boats look worse.

Texture sharpness at close range: the sailboat (2,048 px) and the rowing boat (1,024 px) stay sharp at 1 m. The bus and the rib (1,024 px on larger or plainer hulls) blur or show steps.

## Faces

I checked about 370 close round 35 frames.
- No holes in the outer hull. No flipped faces.
- No z-fighting on hulls or sails. No shimmer between the lid and the hull, because the lid writes no colour.
- The only gaps are the inner gaps in the sailboat (floor seam, thwart edges, bow corner). They let the sea through.
- Texture faults: the band with steps on the bus, and the hatch on the rib's white bands.
- No texture stretching on the sails.

## Regressions

| Check | Result | Round 34 |
|---|---|---|
| boats33 (boats32 plus), seeds 22, 58, 4711, 9001 | 156 approaches: 0 inside a hull, 0 near a mast, 0 pushed down. 1 marked stuck (see below). Bus rams: 16 of 16 charged one crash. | 0 stuck |
| boats33, seed 22 again, both builds | Round 35: 0 stuck, longest contact 73 frames. Round 34: 0 stuck, 74 frames. | |
| Bus-stop probe, 4 seeds | 4 stops each, piers alternate every time, stops 9.0 to 9.25 s, top speed 4.6 m/s | the same |
| boattrace33, seeds 4711 and 22 | Largest single-frame move beyond the drone's own speed: 0.008 to 0.013 m. 0 frames over 0.15 m in 8 traces. | 0.008 to 0.014 m |
| Boat overlap, 120 s, seeds 22, 58 and 8086 (new) | 0 hull on hull, 0 hull on dock, 0 in a solid. Heave 0.27 m. Sailboat fly-through: 0 crashes. | |
| Flat frames, bloom on | 963 frames, 0 flat, 0 errors. My 366 round 35 boat views (6 sun-behind-sail views per device): 0 flat. | 0 |
| Crash-classify, seeds 22, 58, 130 | 12 m: 19 crashes in 199 s (5.7 a minute), 0 hop-like. 20 m: 8 in 216 s (2.2 a minute), 0 hop-like. No pad lips. | 6.1 and 3.3 a minute on 8 seeds |
| Water contrast31, cruise ratio | golden 0.52, morning 0.54, dusk 0.41, noon 0.54 (all at most 0.6) | the same |
| People probe | 0 people on active pads (48 legs, 1,536 samples) | 0 |
| Traffic overlap | 0 pair frames on 4 seeds | 0 |
| Phone HUD probe, 22, 58, 130 | Marker on controls 0. Drone under pills 0. Pops on the drone 0. Pops over the top column: 106 of 275, 89 of 224, 84 of 247 samples. | 79 of 228 on seed 22 |
| Street medal gate, 22, 58, 130 | 4,800 Silver, 2,990 Silver, 6,188 Gold. Breakdown exact on all 3. | 4,598 / 4,236 / 5,631, all Silver |
| Cold load, no unstyled flash | 8 cold loads (dev and production, desktop and phone): 0 bad frames. Production shows the styled title at 11 to 14 ms. | 0 |
| `npm run build` (tsc, then build to the scratchpad) | No chunk warning. three 587 kB, game 354 kB, StreetAssets 45 kB, lil-gui 31 kB, three-post 19 kB, CSS 40 kB. | the same |

- The one "stuck" case: seed 22, a sailboat, ram at 0.9 m with W held. The drone slid along the hull for 149 frames (the limit is 111). It did not reproduce. A rerun of seed 22 gave 0 stuck on round 35 (73 frames), the same as round 34 (74 frames). I count it as noise, but it is worth one more look.
- The medal bot runs in real time and swings by about one delivery between runs (see round 34). Seed 58 at 2,990 is lower than before but still Silver. No scoring code changed.

## Perf

| Check | Desktop | iPhone 13 |
|---|---|---|
| Street, normal, no frame cap | median 3.5 ms, **p95 7.5**, max 25.2 (1 frame over 20 ms in 2,976) | median 2.6, **p95 4.9**, max 15.4 |
| Street, rush, no frame cap | median 3.5, **p95 7.5**, max 11.0 | median 2.5, **p95 4.6**, max 9.6 |
| Harbour, close to boats, no frame cap | median 3.2, **p95 7.5**, max 13.3 | median 2.5, **p95 3.4**, max 5.9 |
| Harbour, round 34 control | median 3.3, p95 7.5, max 15.4 | |
| Phone HUD runs, 80 s, vsync | | p95 9.6 to 9.8, 1 frame over 20 ms each (the probe's end, as before) |
| First 8 s after Play (production) | p95 9.4 to 9.5, 0 long tasks, 0 new shaders | p95 9.5 to 9.7 |

- All p95 values are under 12 ms. The new caps and textures cost nothing measurable at the harbour.
- Draw calls (full spot sweep, about 3,300 spots each): desktop 117 on seeds 22, 130 and 33. iPhone 97 on seed 130. Harbour max 97. All under 125. Round 34: 114 and 97.
- Triangles: max 430k desktop, 398k iPhone. Under 480k.
- First load on the wire (production, 4 cold loads): **2.48 MB** with all street assets. Round 34: 2.14 MB. The boat textures add about 0.37 MB (sail 216 kB, rowing boat 80 kB, bus 37 kB, rib 37 kB). The build folder is 7.8 MB on disk, of which 4.3 MB is source maps.

## Single biggest gap for the boats

**Sea still shows through gaps inside the sailboat.** You see a thin line along the floor-to-side seam and short lines under each thwart. From close, you also see a small patch in the bow corner of the moored sailboat. It is the owner's own complaint. It is much smaller now, but it is not gone.

Acceptance test:
1. Run `hullwater35.mjs` on seeds 130, 22 and 33, desktop (SWEEP 8) and phone (SWEEP 4).
2. Run `seams35.py` and `seams35.mjs` on all its frames.
3. Pass: **0 views with sea in a hull, for every boat kind**. Now it is 18 of 151.
4. Also: the caps-off control still shows sea in the open hulls, so the probe is live.
5. Also: away from the water edge, the lid hides nothing but sea (under 1% of a view).
6. Also: the 6-pair blind A/B against round 34 still wins 5 of 6 or better.

## Other gaps

1. **Wakes look like a pale rectangle and a torch beam from above.** This affects all moving boats, and round 34 too. Test: in the straight-down view at 9 m and in the game camera at cruise height, no bright area with straight edges around any hull. Also a blind A/B of 6 wake views against round 35 wins 5 of 6.
2. **Boat detail is below the bar:** a flat sail with no rigging, an empty rowing tub, a bare white bus, a faceted rib. Test: a blind A/B of the 6 close views against round 35 wins 5 of 6. Also, the bus band shows no step larger than 2 px at 1 m.
3. **Phone pops over the top column** in about a third of pop samples (39%, 40%, 34% on 22, 58, 130). This is not new. Test: under 5% on 22, 58 and 130, with pops on the drone still 0.
4. **One sailboat ram marked stuck** in the 4-seed run (149 contact frames). It did not reproduce. Test: boats33 on seeds 22, 58, 4711, 9001 twice in a row, 0 stuck both times.
5. **Human playtest and medal pace.** These need a human player, as in round 34.

## Screenshots (progress/round-35/critic/)

- **Blind A/B:** `ab/boat-1.jpg` to `ab/boat-6.jpg`. Picks in `ab/picks.txt`. Key in `ab/.key.json`.
- **Water in the hull, the fix:**
  - `hw35-r35-golden-row-into-hull.jpg` (round 35).
  - `hw35-r34c-golden-row-into-hull.jpg` (round 34, sea in the hull).
  - `hw35-r35-golden-row-into-hull-M0.jpg` (round 35 with the caps off, water in magenta).
- **Water in the hull, what is left:**
  - `hw35-r35-golden-sail-into-hull.jpg` and `-M.jpg` (lines under the thwarts, in magenta).
  - `hw35-r35-morning-sail-moored-into-hull.jpg` and `-M.jpg` (floor seam line).
  - `hw35-r35-m-golden-sail-moored-very-close.jpg` and `-M.jpg` (phone, bow corner patch).
- **Quality:** `sheet-golden-sail.jpg`, `sheet-golden-rib.jpg`, `sheet-golden-row.jpg`, `sheet-golden-ferry.jpg`. Each has 9 views: low side, low quarter, into the hull, above, bow, stern, side, very close, at the waterline. Also `hw35-r35-morning-sail-sun-behind-sail.jpg`, `hw35-r35-m-golden-sail-low-quarter.jpg`, `hw35-r35-dusk-row-very-close.jpg`.
- **Faults:** `hw35-r35-golden-sail-above.jpg` and `hw35-r34c-golden-sail-above.jpg` (wake rectangle and fan), `hw35-r35-golden-ferry-stern.jpg` (bus wake), `hw35-r35-dusk-ferry-very-close.jpg` (band with steps), `hw35-r35-morning-rib-very-close.jpg` (hatch on the white bands).
