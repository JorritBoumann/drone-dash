# Drone Dash: round 36 builder notes

Main concern: thin lines of sea inside the sailboat. The round 35 critic found them in 18 of 151 views. They were at the floor seam, under the thwarts and in the bow corner of the moored sailboat. The largest patch was 1,370 px.
Second concern: the low-quality items that the critic named (wakes, sail, rowing boat, harbour bus, rib).

Setup:
- Build: the working tree on top of the round 35 commit.
- Control: a copy of the round 35 tree in my scratchpad, on port 5193, with its own Vite cache.
- My server: port 5190, with its own Vite cache. I did not touch the owner's server on 5188.
- Both of my servers are stopped now.
- Every browser job ran alone, one at a time, from `builder-scripts/queue36.sh`. The job lists are `jobs36*.txt`. The log is `queue36.log`.
- Time used: 23:16 to about 00:40.

## 1. Sea inside the hulls: fixed at the source

**Cause.**
- The round 35 lid was the inner hull outline at the lid height, shrunk 2 cm toward its centre.
- This left a gap of 2 cm between the lid and the inner wall. At the narrow bow the gap was larger.
- A view ray went through this gap and hit the sea. Inside the hull, the sea is above the floor.
- From above, the gap showed as a line along the floor seam and as short lines at the thwart ends.
- It also showed as a patch in the bow corner.

**Fix** (`blender_boats36.py` and `Boats.ts`):
- Blender now cuts the lid from the **outer** outline of the hull at the lid height.
- The outline is inset 2.5 cm along its own normals. Thus the lid edge is inside the solid wall all the way round. The walls are 12 to 45 cm thick at that height.
- A ray into the open hull below the gunwale must cross the lid.
- The lid stays under the rim top and inside the outer skin. From outside the boat, the hull always hides it.
- The lid heights did not change: sail 1.0 m, rowing boat 0.8 m, rib 0.5 m above the keel. The rims are 1.5 to 20 cm higher.
- The lid material has a small depth offset toward the camera (`polygonOffset` -1 and -2).
- The lid writes no colour. Thus it cannot hide the deck, the cargo or the floor. It only stops the sea inside the hull.
- Each lid uses the instance matrix of its boat. Thus it follows the heave, pitch, roll and planing trim.

**Acceptance.** I used the critic's scripts `hullwater35.mjs`, `seams35.py` and `seams35.mjs`. I changed only the output folders. All runs are on the final build.

| Run | Views | Views with sea in a hull (seams) | Caps-off control: views with sea |
|---|---|---|---|
| Desktop, seeds 130, 22, 33, SWEEP 8 | 183 (70 with masks) | **0** | 49 views, 180 of 432 sweep frames |
| iPhone 13, same seeds, SWEEP 4 | 183 (94 with masks) | **0** | 66 views, 99 of 216 sweep frames |
| Bob, roll and planing sweep frames that the in-browser count marked (diagnostic copy, then seams) | 12 frames | **0** | |

- Lid side effects: the largest caps-on against caps-off change on a pixel that is not sea is 0.43% of the boat box on desktop. On the phone it is 0.88%. It is a soft rim at the lid edge, as in round 35.
- In the frames that I examined, the lid did not hide the deck, a thwart, the barrel, the crates, the oars or the floor.
- Some pixels are marked "sea hidden outside the hull". I looked at them (`golden-row-moored-side`). They are inside the rowing boat. The ray-march of the probe is not exact near the hull. The round 35 critic found the same.

**Important: the in-browser `leak` column.**
- It now shows a value in 12 desktop and 25 phone views, and in 5 and 7 sweep frames.
- The new rigging lines close small pockets of open sea outside the hull. The pockets are between the shrouds, the sail, the boom and the tack line.
- The in-browser count calls each closed pocket a leak.
- The seams check passes all of them. Seams counts only sea that is part of a patch 3 times larger with the caps off.
- Example: `builder-shots/rig-enclosed-sea-example.jpg`. The green pocket is sea in front of the bow, between the sail and the tack line.
- In most of these views, the caps-on count is equal to the caps-off count. Thus the lid has no effect there.

Flat check: the 6 sun-behind-sail views per device and all other probe views have 0 flat frames.

## 2. Wakes (`Water.ts`)

Cause of the old look:
- The pale rectangle was a wide trail with a hard start across the hull.
- The torch beam was a pair of broad arm bands, with strong ripple glints between them.

The new wake for each boat:
- A V of two thin foam lines on each side: a main crest and a weaker echo inside it.
- The lines start at the bow shoulders at 19.5 degrees.
- They are 9 cm wide at the bow and get 1.3 cm wider for each metre. They fade with distance.
- A fine froth noise breaks the lines up. This is one more texture read, only near a moving boat.
- A short, narrow, broken trail starts at the transom. It fades in over the last half metre of the hull.
- A thin band of wash stays near the hull. It is strongest at the bow.
- Weak ripples run along the arms. Cross crests fill the V. Their wavelength comes from the boat speed.
- All parts fade to 0 before the range limit. Thus there is no straight edge.

Blind A/B of 6 wake views against round 35: **new wins 6 of 6** (`ab36-wakes-final.log`).
- Views: straight down at 9 to 20 m, the game camera at cruise height, and a low stern view.
- Moods: golden, morning and dusk.
- From above, there is no straight edge around a hull.
- In the glitter path of a low sun, the bus trail is still a bright streak. The round 33 glare rule keeps wake foam visible there. The streak is now about half as wide.

## 3. Boat detail (`blender_boats36.py`, Blender MCP, no new bake)

Method:
- The script models each new part.
- Each part uses the UV of one clean texel of the correct colour in the round 35 texture of its boat.
- Each part also gets the round 35 flags (sail cloth, metalness, roughness).
- No texture changed. I used no new asset and no generation. `ASSETS.md` has the details.

Sail:
- Blender subdivides the cloth (4 cuts) and gives it a belly of up to 0.34 m to leeward. The sail now shades as a curved sheet.
- New rig: a forestay, two shrouds with chainplates, a tack line to the stem and a sheet from the clew. They are thin tubes with 5 sides.
- The boom and the gaff were already in the model. They stay.
- Flutter: the flags carry a weight. It is 0 at the edges of the sail and largest near the leech.
- The vertex shader moves the cloth by up to 3 cm with an uneven ripple. Each boat has a different phase.

Rowing boat:
- Blender cuts the hull at a station every 0.15 m. It then scales each station to a smooth curve (a superellipse). The plan is now round, not eight-sided.
- The hull is 10% narrower (2.14 m) and has smooth shading.
- New parts: two thwarts with knees, two oars on the thwarts with painted blades, two oarlocks.

Harbour bus:
- The large white and dark faces above the boot top now use one clean texel each.
- Thus the band with steps is gone. The steps came from the bake edge between thin UV islands.
- New parts: windows on the main cabin, and a glazed wheelhouse (sides and front) with a visor.
- Also new: a red name band with a dark pinstripe.
- Also new: railings on the roof deck, the side walkways and the stern.

Rib:
- The tubes and the seats have smooth shading.
- The white bands use one clean texel. Their baked diagonal hatch shimmered in motion.

The lids come from the final hulls. The rowing-boat lid follows its new outline.

Blind A/B of 6 close boat views against round 35, with the same seed, time and pose: **new wins 6 of 6** (`ab36-boats-final.log`).
- Views: golden sail into the hull, golden rowing boat into the hull, morning rib low quarter, dusk sail quarter, golden bus quarter, phone golden sail quarter.
- I wrote the key before I judged.
- I am the builder and I know what changed. The critic must judge again.

## Regressions

| Check | Result |
|---|---|
| boats32, seeds 22, 58, 4711 (final build) | 117 runs: 0 inside a hull, 0 stuck, 0 near a mast, overlap 0, longest contact 114 |
| boats32, the stuck case | See the notes below the table. |
| bus-stop33, seeds 4711, 9001 | 4 stops each. Piers alternate 3 of 3. Stops 9 to 9.25 s. Top speed 4.6 m/s. |
| boattrace33, seeds 4711, 22 | Peak speed over the cap 0.08 to 0.64 m/s (round 35: 0.08 to 0.56). Ferry hover run. No boat code changed. |
| Boat overlap (boats31), 120 s, seeds 22, 58, 130, final build | 0 hull on hull, 0 hull on dock, 0 in a solid. Fly-through: 0 crashes, 0 frames in a solid. |
| Flat frames, bloom on (`acceptance-probe.mjs`), final build | 959 frames, 0 flat. Also 12 sun-behind-sail views in the hull probe, 0 flat. |
| Crash-classify 12 m, seeds 22, 58, 130 | 24 crashes in 191 s. 0 hop-like. 7 near a target, closest 1.4 m below a top. **0 pad lips.** |
| Crash-classify 20 m | 16 crashes in 218 s. 0 hop-like. 8 near a target, closest 1.4 m below a top. **0 pad lips.** |
| Water contrast31, cruise ratio | golden 0.52, morning 0.54, dusk 0.41, noon 0.54 (limit 0.6) |
| People probe | 0 people on active pads (48 legs, 1,536 samples) |
| Traffic overlap | 0 pair frames, seeds 22, 58, 130 |
| Phone HUD probe, 22, 58, 130 | Marker on the controls 0. Drone under a pill 0. Pops on the drone 0. |
| Street medal gate, 22, 58, 130 | 6,922 Gold, 3,695 Silver, 4,910 Silver. Breakdown exact (`bdOk`) on all 3. |
| Unstyled flash (`fouc34.mjs`, dev, desktop and iPhone) | 0 bad frames |
| `npm run build` | No chunk warning (three 587 kB, game 356 kB) |
| Bloom clamps, `#app` rule, debug hooks | Not changed |

Notes on the boats32 stuck case:
- The first run had 1 stuck run: seed 22, sailboat, ram at 0.9 m, 151 frames. The round 35 critic saw the same case.
- That first run was before the final GLB.
- Reruns of seed 22: round 36 had 0 and 0 (67 and 64 frames). The round 35 control had 1 and 1 (150 and 151 frames).
- Thus the case is older than this round. The boat positions at the start of the bot decide it.

Which build each check used:
- Final build: the hull probe, the sweeps, the A/B, boats32, overlap, flat frames, budgets and frame time.
- The build before the last rowing-boat change: HUD, medal, crash, people, traffic, contrast and unstyled flash.
- The last change was only the rowing-boat mesh and its lid. No game code changed after those runs.

## Budgets (final build)

| Budget | Round 35 | Round 36 |
|---|---|---|
| Draw calls, full sweep, desktop 130 and 22 | 117 (critic) | 115 and 115 (limit 125) |
| Draw calls, iPhone 130 | 97 to 102 | 100 |
| Triangles, desktop 130 and 22 | 430k | 441k and 435k (limit 480k) |
| Triangles, iPhone 130 | 398k | 408k |
| boats.glb | 211 KB | 459 KB (textures not changed, 369 KB) |
| First load on the wire | 2.48 MB (critic) | About 2.73 MB. This is an estimate (round 35 plus the larger boats.glb). I did not measure it again. |

Frame time, no frame cap, final build:
- Marina, desktop: p95 6.9 ms. Beside a sailboat: 6.8 ms.
- Marina, iPhone: 3.4 ms. Beside a sailboat: 3.8 ms.
- Street, desktop: normal 8.0 ms, rush 7.6 ms. Street, iPhone (earlier build): 5.2 and 4.7 ms.
- All values are under 12 ms.

## What is still open

- The lids come on only within 160 m of the **game** camera (round 35 design).
  - A probe can render from a pose far from the game camera (`renderFrom` after it moves the drone far away). Then the lid is off and the sea shows in the hull.
  - My own shot script did this once. In play, the game camera is the camera that renders. Thus it cannot occur in play.
- The stern of the rowing boat is still a little square.
- The bus is still a kit model, now with windows and railings.
- In the glitter path of a low sun, the bus trail is still a bright streak, but narrower.
- On the phone, the soft rim at the lid edge is 0.88% of the boat box in the worst close view. This is under 1%.

## Files changed

- `src/world/Boats.ts`: lid depth offset. Sail flutter (time uniform, weight in `flags.r`, phase for each boat).
- `src/world/Water.ts`: new wake block (V of thin broken foam lines, transom trail, hull wash, soft edges).
- `public/assets/models/boats.glb`: new lids, sail belly and rig, rowing-boat shape, thwarts and oars, bus details, smooth rib.
- `ASSETS.md`: round 36 section.

## Scripts (`builder-scripts/`)

New:
- `blender_boats36.py`: the full Blender pass. You can run it again. It ends with the GLB export.
- `boatshots36.mjs`: fixed boat views on both builds.
- `ab36.py`: blind A/B. It writes the key first. Keys: `ab36-*-key.json`. Picks: `ab36-picks.txt`.
- `hullwater36-sweepshots.mjs`: a diagnostic copy of the critic's probe. It also saves the marked sweep frames for the seams check. It is not the acceptance run.
- `queue36.sh` and the `jobs36*.txt` lists.

Copied from the critic, with only the output folders changed: `hullwater35.mjs`, `seams35.py`, `seams35.mjs`.

Copied from the round 35 builder scripts, not changed (the port is already 5190): the regression probes.

## Screenshots (`builder-shots/`, 39 JPEGs)

- Blind A/B pairs: `ab36-boats-1..6.jpg`, `ab36-wakes-1..6.jpg`.
- The leak views that the critic named, now clean: `hw35-r36-golden-sail-into-hull.jpg` and `-M.jpg`, `hw35-r36-morning-sail-moored-into-hull.jpg` and `-M.jpg`, `hw35-r36-m-golden-sail-moored-very-close.jpg` and `-M.jpg`.
- Detail: `hw35-r36-golden-row-*`, `hw35-r36-dusk-ferry-very-close.jpg` (no steps), `hw35-r36-morning-rib-very-close.jpg`, `hw35-r36-morning-sail-sun-behind-sail.jpg`.
- Wakes: `hw35-r36-golden-sail-above.jpg`, `hw35-r36-golden-ferry-stern.jpg`.
- Dusk, round 35 and round 36 side by side: `r35-dusk-*.jpg`, `r36-dusk-*.jpg`.
- `rig-enclosed-sea-example.jpg`: why the in-browser leak count shows a value for rigging pockets.
