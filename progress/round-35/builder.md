# Drone Dash: round 35 builder notes

Concern this round: boat quality. Owner feedback: "the boats have very low quality, you can see the water through the
bottom". His close-up at golden hour showed the sea inside the hull, flat single colours and coarse facets.

Build: the round 35 work, not committed, on top of 8284d4a (round 34).
Control: an export of 8284d4a (`git archive` into my scratchpad) on port 5193, with its own Vite cache.
My server: port 5190, the working tree. It used its own Vite cache (`cacheDir` in a scratchpad config).
I did not touch the owner's server on 5188, and it did not have to optimize again. My two servers are stopped.
Every browser job ran alone, one at a time, from `builder-scripts/queue35.sh` (`jobs35.txt`, then `jobs35b.txt`).
The log is `queue35.log`. At the start, XprotectService used about 40% of one core (`cpu-start.txt`).

## What I found

- **Water in the hull.** The sailboat, the rowing boat and the speedboat are open boats. In the model, their floors are
  0.30, 0.25 and 0.35 to 0.40 m above the keel. The game floats them at a draft of 0.42, 0.32 and 0.34 m. So each floor
  was already below the still water line.
- Two more things made it worse. The boats ride the full swell (up to 0.28 m up or down). The drawn sea is flat beyond
  12 to 21 m from the camera. Also, the speedboat turned bow-up about its middle, so its stern went under.
- **The meshes were not decimated.** Round 31 kept the full Quaternius triangle counts (sail 1,020, speedboat 626,
  bus 858, rowing boat 224). It changed the palette texture to one colour per face. It also split every corner (flat
  shading) and removed the UVs. That is why each surface was one flat colour and each facet showed.
- **Faces.** No holes and no flipped faces after the split corners are welded (see the audit below).

## 1. Water mask: hull caps (`Boats.ts`, role `cap` in `boats.glb`)

- For each open boat, Blender cuts the hull at the gunwale: 1.0 m above the keel (sailboat), 0.8 m (rowing boat) and
  0.5 m (speedboat). It keeps the loop of the inner wall, shrinks it by 2 cm and fills it. This gives a lid over the
  open hull (30, 18 and 32 triangles).
- The game draws each lid as an `InstancedMesh` that shares the boat's own `instanceMatrix` buffer. So the lid follows
  the heave, pitch, roll and heel of its boat exactly. The lid material writes depth only (`colorWrite: false`).
- Draw order: boats (renderOrder 0), then lids (1), then water (2). The floor, thwarts, crates and all other parts in
  the hull are drawn before the lid, and they keep their colour. The sea comes after the lid and fails the depth test
  inside the hull.
- A lid draws only while a boat of its kind is less than 160 m from the camera. Farther away it only costs a draw call.
  With this switch, the city keeps the draw count of round 34.
- The harbour bus has a closed deck. It needs no lid.
- Draft: under way, the speedboat now turns bow-up about its stern. It rises onto the plane by sin(trim) x 0.4 x length.
  Its stern does not go below the swell now. The other drafts did not change. With the new paint at the waterline they
  look right: red antifouling just below the surface, a boot top just above it, and 0.6 to 0.7 m of freeboard on the
  small boats.
- New test hook for the bots: `boatCaps('depth' | 'show' | 'off')`.

## 2. Geometry and faces (`blender_boats35.py`, audit in `blender-audit35.json`)

- Welded at 0.1 mm. Degenerate faces removed. For each closed part, the signed volume shows that it faces outwards.
- Smooth shading, with sharp edges above 34 degrees. Round hulls and tubes now look round. Chines and corners stay
  sharp. No decimation at all. The triangle counts are the original ones.
- Audit after the weld, all four boats: 0 boundary edges (no holes), 0 winding conflicts, 0 parts inside out and
  0 faces with zero area.
- A ray-parity test on each face finds 63 odd faces. All of them are hidden contact faces: the bottoms of the mast,
  barrel, crate and funnel blocks, which sit inside or on other parts. 0 visible faces point inwards. The bus has 7
  T-junction edges where its blocks meet. They do no harm.
- Double-sided: none. In the model the sail is a thin closed slab, so it needs no double-sided material.

## 3. Materials (`blender_boats35.py`, `boatMaterial` in `Boats.ts`)

Each boat has one baked albedo texture: a Cycles EMIT bake of albedo x ambient occlusion, then cwebp at quality 80.

- Wood grain from two CC0 Poly Haven textures: Brown Planks 03 on the hulls, Roof Planks on the varnished trim, mast and
  thwarts. The mapping is triplanar, so the planks run along the hull on the sides and on the floor. The texture only
  changes the brightness of the round 31 palette colour (luminance, normalized in linear space). The boats keep the
  palette of the game.
- Painted bands go on the outside skin only. For each face, a ray goes along its normal (without the upward part). If
  the ray leaves the boat, the face is outside. The bands are antifouling below the waterline and a boot top stripe at it. The sailboat also has a
  navy sheer stripe. The topsides of the rowing boat are a faded teal. The bus has a dark boot top.
- A darker wet band starts at the waterline and fades out over 0.2 m.
- Sail cloth: a seam every 0.55 m, fine weave noise and some dirt near the foot. In the game, if the sun is behind the
  sail, some sunlight comes through: `back x (0.22 + 0.55 x pow(toward, 4)) / pi`. Both values are clamped to
  0..1 before `pow`, so no NaN gets to the bloom.
- Rope handles on the speedboat (twisted stripes), seams on its tubes, and metal fittings and an outboard motor.
- Baked ambient occlusion: inside the hulls, under the thwarts and around the crates.
- The vertex colour holds the roughness and metalness of each part (r = sail cloth, g = metalness, b = roughness).
  So each boat kind still has one material and one draw call, as before.

## 4. Models

I searched Poly Pizza (CC0: sailboat, speedboat, yacht or motor boat, ferry, rowboat or canoe or kayak) and Poly Haven
(models: boat). Poly Pizza has the same Quaternius set plus old sailing ships, a raft and a Kenney pirate ship. Poly
Haven has Dutch ships from the 17th century. None of them is clearly better and also fits a modern harbour city. So I
kept the four kinds (sailboat, speedboat, rowing boat, harbour bus) and rebuilt them. All of it is in `ASSETS.md`.

## Results

### Water inside a hull: 0

`boatclose35.mjs MODE=probe`. For each open boat, the probe moves the game 0.37 s per step, and the boat rolls. It does
12 steps on desktop and 8 on the phone, on seeds 130, 22 and 33. Each step has 4 views: into the hull, from above, bow
quarter and high quarter. For each view, the probe renders 4 frames:

1. The lids in magenta. This is the mask of the open hull.
2. The frame as drawn.
3. The frame without the water.
4. The frame without the lids. This is the round 34 state on the same pose.

The mask is made smaller by one pixel at its edge.

| Run | Views | Mask pixels | Water pixels in the hull, as drawn | Same views without lids |
|---|---|---|---|---|
| Desktop, golden / morning / dusk | 432 | 1,071,647 | **0** (0 views) | 427,217 (in 334 views) |
| iPhone 13 (wide), same seeds | 288 | 453,661 | **0** (0 views) | 178,137 (in 223 views) |

The bus has a closed deck, so its mask is empty. Its shots show no water on it.

### Close-ups: 48 contact sheets

`builder-shots/r35-boats-<mood>-<d|m>-<kind>.jpg` (this build) and `r34-boats-...` (round 34 control, same frames).
Each sheet has 6 views: side low, bow quarter, into the hull, from above, stern low and high quarter. They cover golden
hour (seed 130), morning (22) and dusk (33), on desktop and on the phone. I saw no water inside a hull in any of the
r35 sheets. Most r34 sheets of the sailboat and the rowing boat show it.

### Blind A/B against round 34: new wins 6 of 6

`ab35.py` makes 6 pairs of single full-size views. The pairs are: golden sail into the hull, morning rowing boat into
the hull, dusk speedboat bow quarter, golden rowing boat side low, dusk sail bow quarter, and morning bus side low.
Left and right were random (SystemRandom). The key went to `ab35-key.json` before I looked. Result in `ab35.log`. By chance, the
new build was on the left in all 6 pairs. I am the builder, so I am not a neutral judge. The bus pair was close (the
change there is only the boot top and smoother shading). Pairs: `builder-shots/ab35-pair-1..6.jpg`.

### Boat probes

| Test | Result |
|---|---|
| boats32 (117 runs, seeds 22, 58, 4711), first and final build | 0 frames inside a hull, 0 stuck, 0 mast-close, deepest overlap 0 |
| bus-stop33 (seeds 4711, 9001, 700 s) | 4 stops each, piers alternate 3 of 3, every stop 9 to 9.25 s |
| boattrace34 hover runs, final build | worst move beyond the drone's own speed 0.013 m (limit 0.15) |
| boattrace33 | peak speed over the cap 0.08 to 0.56 m/s, as in round 34 |
| boats31 overlap, 120 s, seeds 22, 58, 130 | 0 hull-hull, 0 hull-dock, 0 in a solid. Fly-through: 0 crashes, 0 frames in a solid |

### No regressions

| Test | Result |
|---|---|
| Flat-frame probe, bloom on (`acceptance-probe.mjs`) | 941 frames, 0 flat, 0 errors |
| Crash-classify, 12 m, seeds 22, 58, 130 | 21 crashes in 180 s (7.0 a minute, control today 6.0), 0 hop-like, 7 near a target, closest 4.1 m below a top: 0 pad lips |
| Crash-classify, 20 m | first run: 11 crashes in 193 s, 1 hop-like (seed 58, 12.6 m below a top, not a pad lip). Second run: 12 in 216 s, 0 hop-like, 0 near a target. Control today: 15 in 253 s, 0 hop-like. These runs are not deterministic. The boats are not near any pad. |
| Water contrast31, cruise ratio | golden 0.52, morning 0.54, dusk 0.41, noon 0.54 (limit 0.6, round 34: the same) |
| People probe | 0 people on active pads (48 legs, 1,536 samples) |
| Traffic overlap | 0 pair frames, seeds 22, 58, 130 |
| Phone HUD probe, iPhone 22, 58, 130 | marker on the controls 0, drone under a pill 0, pops on the drone 0 |
| Street medal gate, seeds 22, 58, 130 | 4,503 / 2,884 / 5,713, all Silver. Breakdown exact (`bdOk`) on all 3. Real-time bot, so the totals vary (round 34 critic: 14,465, also all Silver) |
| Unstyled flash (`fouc34.mjs`, dev, desktop and iPhone) | 0 bad frames |
| `npm run build` | no chunk warning, built in 0.3 s |
| Bloom clamps, `#app` rule, debug hooks | untouched |

### Budgets

| Budget | Round 34 | Round 35 |
|---|---|---|
| Draw calls, full sweep, desktop 130 / 22 | 114 / 114 | 115 / 116 (limit 125) |
| Draw calls, full sweep, iPhone 130 | 97 | 102 |
| Triangles, full sweep, desktop 130 / 22 | 431k / 418k | 432k / 413k (limit 480k) |
| Triangles, iPhone 130 | 397k | 395k |
| Production build, no source maps | about 3.2 MB (this build minus the new boat files) | 3.5 MB in `dist`. The boat files (580 KB) load after the first frame, so the first load does not grow |
| Boat files | boats.glb 240 KB | boats.glb 211 KB + 4 textures 369 KB |

The worst iPhone spot is in the city, 80 m from the marina, at 102 draw calls (round 34: 97). There the lids of the
moored boats are inside their 160 m range. The sweep also moves the boats, so the worst count changes a little from
run to run (my first iPhone sweep, before the range switch, had 100).

Frame time, uncapped (no vsync), `perf-street34.mjs` and the new `perf-boats35.mjs`. Same machine, run one after the
other with the control.

| Spot | Round 35 p95 | Control (round 34) p95 |
|---|---|---|
| Street, desktop, normal / rush | 7.8 / 7.3 ms | 7.8 / 7.4 ms |
| Street, iPhone, normal / rush | 5.2 / 4.7 ms | (round 34 critic: 6.2 / 5.5) |
| Marina, desktop | 6.9 ms (max 10.4) | 6.6 ms (max 11.7) |
| Beside a sailing boat, desktop | 7.0 ms | 6.8 ms |
| Marina, iPhone | 3.3 ms | 3.3 ms |
| Beside a sailing boat, iPhone | 3.7 ms | 3.7 ms |

All p95 values are under 12 ms. The "iPhone" runs are desktop Chromium with the iPhone 13 viewport, as in earlier rounds.

## What is still open

- The models are still low-poly kit models. The bus is blocky. A clearly better CC0 modern boat set does not exist on
  Poly Pizza or Poly Haven. A possible next step is a modelled or generated set. The owner must decide that.
- The docks still use flat vertex colours from round 31.
- The boats still ride the full swell where the drawn sea is flat (far from the camera). The lids hide the water inside,
  and the wet band softens the waterline. But at 30 m or more the freeboard changes a little as a boat heaves.
- The A/B judge was me (the builder), so the critic must judge it again.

## Files changed

- `src/world/Boats.ts`: boat material (baked map, flags, sail translucency, gain hook), hull caps (shared instance
  matrices, depth only, range switch), water renderOrder 2, speedboat trim about the stern, `capMode` hook.
- `src/world/StreetAssets.ts`: `loadBoatAssets()` (boats.glb plus the four textures, lazy). `loadModelParts` keeps UVs.
- `src/world/Environment.ts`: `applyBoats(parts, tex)`.
- `src/game/Game.ts`: loads `loadBoatAssets()` with the street assets. New hook `boatCaps`.
- `src/vite-env.d.ts`: type of the `boatCaps` hook.
- `public/assets/models/boats.glb` (rebuilt, 211 KB). New: `public/assets/textures/boat_{sail,row,rib,ferry}_albedo.webp`.
- `ASSETS.md`: new round 35 section.
- Local only (git-ignored): `asset-src/polyhaven/*planks*_1k.jpg`, `asset-src/bake35/*.png`.

## Scripts (`builder-scripts/`)

- New: `blender_boats35.py`. This is the full Blender pipeline: weld, audit, classify, outer flag, smoothing, lids,
  UVs, materials, bake and export.
- New: `blender-audit35.json`, the face and normal audit.
- New: `boatclose35.mjs`. It makes the 6-angle contact sheets and runs the pixel probe for water in the hull.
- New: `ab35.py`, the blind A/B. It writes the key before judging.
- New: `perf-boats35.mjs`. It measures the uncapped frame time at the marina and beside a sailing boat.
- New: `queue35.sh`, `jobs35.txt` and `jobs35b.txt`.
- Copied from rounds 34, 32 and 31. I changed only the ports, the output folder (`OUTDIR`) and the tags.
  `crash-classify-v.mjs` now takes `PORT`. `water31.mjs` uses the tags r35 and r34c. `contrast31.py` reads `OUTDIR`.
- The copied boat probes: `boats32.mjs`, `bus-stop33.mjs`, `boattrace33.mjs`, `boattrace34.mjs` and `boats31.mjs`.
- The other copied probes: `acceptance-probe.mjs`, `crash-classify-v.mjs`, `water31.mjs`, `contrast31.py`,
  `pad-people23.mjs` and `traffic-det29.mjs`.
- The copied HUD, load and budget probes: `hud-probe28.mjs`, `fouc34.mjs`, `trisweep34.mjs`, `perf-street34.mjs` and
  `route-play-rt-x-m-esc17.mjs`.
- The shots of the regression jobs went to the scratchpad. `builder-shots/` has 54 JPEGs: 48 contact sheets and 6 A/B
  pairs.
