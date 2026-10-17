# Drone Dash: round 28 builder notes

Concern: street-level realism with free CC0 assets (the round 27 critic's biggest gap).
Order of work: street props, cars and trees, Poly Haven textures, shop-front variety, people, tests. Then the three leftovers (phone camera, payout chimes, Slipstream hint), and one fix the tests found (the first-flight hitch).

No paid generation. No Meshy, Retro Diffusion, PixelLab, ElevenLabs or `generate_3d` calls. Sketchfab stayed off. Only CC0 assets.

## How I worked and tested

- Blender 5.2 through the Blender MCP. The owner's Blender had an unsaved default file (cube, light, camera). I worked in a new scene `dd_assets` and saved nothing. At the end I switched back to the original scene, removed my scene and purged the orphan data. No file was saved.
- Production snapshot served by `vite preview` on 127.0.0.1:5190 (`builder-scripts/rebuild28.sh`). The round 27 code (`git archive HEAD`, read only) was built and served on 5191 as the baseline. The owner's server on 5188 was not touched. Both of my servers are stopped.
- One browser at a time, from job queues (`queue28*.sh`, `jobs28*.txt`, logs `queue28*.log`).
- New scripts in `progress/round-28/builder-scripts/`:
  - `art28.mjs`: the critic's `art27.mjs` views (same spots, both moods, desktop and iPhone), plus prop and shop audits per view. `OUT_PREFIX=before27 PORT=5191` makes the before set.
  - `closeup28.mjs`: free-camera close-ups (a walking person in 3 frames 0.15 s apart, the curb strip, the road).
  - `prop-audit28.mjs`: placement audit (pads, alleys, tunnels, diagonal, roads, poles), props near six spots, shop audit, on 5 seeds.
  - `tri-probe28.mjs`, `start-profile28.mjs`, `audio-cost28.mjs`: small diagnostics.
  - `blender_pipeline.py`: the Blender code used, for the record.
  - `critic27/`: copies of the round 27 critic scripts, pointed at 5190 and at `builder-shots/`. `fb27-init.js` and `fb27.py` also log each played payout chime and whether its pop showed.
- Copied from round 27 and used as before:
  - `crash-classify-v`, `cam-clip24`, `street-probe`, `pad-people23`
  - `acceptance-probe` (flat frames), `hud-probe26`, the three medal bots
  - `perf-street`, `perf27`, `firstframe27`, `layout-check27`, `detail-audit27`
- `perf-street`, `perf27`, `crash-classify-v` and `street-probe` now take `PORT`. `perf-street` also takes `HOOK` and `DUMP`.

## Assets (all CC0, full table with sizes in `games/drone-dash/ASSETS.md`)

- Cars (Kay Lousberg, City Builder kit): Car Hatchback, Stationwagon, Taxi.
- Street props: Fire Hydrant, Bench, Fence Pillar (bollard) by Kay Lousberg. Trashcan by Kenney. Medium Pot (planter) by Isa Lousberg. Table Large Circular by CreativeTrio. Chair and Sign (sandwich board) by Quaternius.
- Trees (Quaternius): two species, a round multi-crown tree and an oak-like tree.
- Poly Haven textures at 1k: Plastered Wall 02 (facade detail), Concrete Pavement 02 (sidewalk), Asphalt 02 (road). Albedo and normal each.
- People: Poly Pizza has no CC0 animated low-poly people (search "person walking", animated, CC0: no results). I improved the round 27 figures in code instead.
- Tried and not used:
  - Road Bits and Traffic Light (Kay Lousberg): no use for them.
  - Pine (Quaternius) and Bush: alpha-leaf textures.
  - Trash Bin: an indoor pedal bin. Mailbox: a rural post box.

## Pipeline

1. `search_assets` (Poly Pizza with the CC0 filter, and Poly Haven) and `import_asset` into the fresh scene.
2. Flatten each model: every face takes one colour, sampled from the kit's palette texture at the face's UV centre (or the material colour). This removes all textures and materials. Each model becomes plain vertex colours.
3. Scale to the game's sizes. The cars fit the round 22 boxes exactly: compact 3.8 x 1.72 x 1.46 m, sedan and taxi 4.5 x 1.82 m. Front on +Z, wheels on the ground.
4. Split into roles. Cars: `paint` (stored as a grey shade, so each car still takes its own colour per instance), `glass` (glossy) and `trim` (own colours). Trees: `canopy` (grey shade, tinted per tree with the old palette, so autumn colours stay) and `trunk`. Props: one part.
5. Decimate (collapse) per role: car trim 0.38, car paint 0.8, round-tree canopy 0.13, oak canopy 0.33, trunks 0.45 to 0.55.
6. Export GLB without materials and UVs: `car_compact.glb` (628 triangles), `car_wagon.glb` (624), `car_taxi.glb` (654), `street_props.glb` (8 props, 1,468 triangles), `trees.glb` (2 species, 802).
7. Poly Haven JPEGs converted to WebP with `cwebp` (albedo q72, normal q80). Originals stay in `asset-src/` (now in `.gitignore`).

## What changed in the game

### 1. Street props (`CityGenerator.placeStreetProps`, new `StreetProps.ts`)
- Ten kinds:
  - from the CC0 models: bench, litter bin, hydrant, bollard, planter (with a procedural shrub), cafe table with two chairs, sandwich board
  - procedural: bike rack (three hoops), bus stop (a pole and sign, with a bench)
- Placement: slots every 2.8 m along each curb, 0.42 to 1.0 m in from it (the strip the lamps and trees use). The kind comes from a position hash. No draws from the city's random stream, so the layout is unchanged. Bollards at both ends of each curb, by the crossings. At most one hydrant per curb. One bus stop on about 4 of 6 blocks.
- Kept clear:
  - pads: any ground site, its radius plus 1.8 m
  - alley mouths, tunnel arches and the diagonal (the same clear zones as the trees)
  - lamp posts (1.2 m), trunks (1.5 m) and roads
  - no cafe or sandwich board on park blocks
- Nothing collides. Everything is small and stays in the curb strip, outside the walkers' paths (1.75 and 2.35 m in).
- Drawing: one InstancedMesh per kind, only for pieces within 80 m of the camera (60 m on touch). The range shrinks above 18 m of camera height. Thin pieces (bollards, hydrants, chairs, bus-stop poles) cast no shadow.
  - A BatchedMesh (one draw call) was tried first. Without WEBGL_multi_draw it draws piece by piece. In the headless tests it pushed desktop p95 to 16.7 ms. The instanced version fixed that.

### 2. Cars and trees
- Traffic types 0, 1 and 2 (compact, sedan, taxi) use the three CC0 car models (`StreetKit.modelBody`, `Traffic.setCarModels`). Same sizes, lanes, lights and traffic code as round 22. The paint still takes the per-car colour. Small glowing head and tail lamp boxes keep dusk and brake lights. The van, box truck and hover-van stay procedural.
- Trees: near the camera, street and park trees use one of the two species (picked by position hash). Near means 80 m (62 m on touch), less from high up. Further away they keep the old blob. The blob canopies are now compacted, so only far trees are drawn. Pines stay procedural. Colliders and the hide-near-camera rule are unchanged. The occlusion pass now only sets `hidden`, and `Environment.updateTreeLod` writes the matrices.

### 3. Poly Haven textures (`CityMaterial.ts`, `Environment.ts`)
- Walls near the camera (full to 20 m, gone at 52 m) get the plaster albedo detail and the plaster normal map. The detail is relative to the texture's own mean, so each wall keeps its colour and light mood. The normal map uses a world-aligned tangent frame. Brick walls get half strength, so the mortar pattern stays.
- Sidewalks: near the camera the procedural tile grid fades into the Poly Haven concrete slabs (albedo and normal).
- Road: the Poly Haven asphalt (3 m tile, albedo and normal, slightly warm tint) replaces the canvas texture. The ground material has a flat normal map from the start, so the swap needs no shader recompile.
- Everything is lazy: the loader (`StreetAssets.ts`, with GLTFLoader) is its own 45 KB chunk, fetched after the first frame. The models' materials are compiled with `compileAsync` before they go into the scene. Until then the city runs on its procedural stand-ins. `?assets=0` keeps the stand-ins (for A/B checks).

### 4. Shop-front variety (`CityGenerator.ts`, `CityMaterial.ts`)
- Each shop bay (two window columns) has a sign variant, `(seed + bay) mod 8`. There are 7 sign colours with light, gold or dark letters, and variant 7 is a home entrance. It also has a door colour, `(3 seed + 3 bay) mod 7`, from 7 colours, with a glazed panel and a brass handle.
- Within a building, neighbouring bays always differ. Across a party wall, the generator steps the building's seed (no random draw) until the touching bays differ in both sign and door colour.
- Awnings are now one colour per bay, from the same palette, stepped so that no two neighbouring bays match. The old single colour draw is kept, so the random stream is unchanged.
- Audit hook `shopAudit()`: neighbouring bays along each street-face line, within and across buildings.

### 5. People (`StreetKit.buildPedGeometry`)
- Near figures: tapered round limbs (6-sided), rounded hands, a smooth sphere head, a round neck. No box is left except the shoes. Knees and elbows bend as in round 27.
- Fixed a round 27 bug: the shoulder-bag strap was rotated about the world origin, so it floated as a stick beside about a fifth of the people.

### Leftovers
- **Phone camera after pickups and drops:** on touch screens the slow-drone room floor is now 8.8 m instead of 4.2 m (2.1 times, `CameraRig.touchRoom`, used in `keepRoom`). Desktop is unchanged.
- **Payout chimes:** the chime, shake and sparks now play at the moment the payout pop shows (`Hud.slipPop(..., onShow)`). A pop held behind a hint waits with them. A pop dropped as stale stays silent. Diagnostics: `slipstream.chimes`.
- **Slipstream hint:** it is only introduced while drafting (before, any meter above 0.05 counted).
- **First-flight hitch:** profiling showed `start()` took 222 ms, and about 198 ms of it was `new AudioContext()`. The context is now made on the title screen (`AudioSystem.prewarm`, 1.2 s after boot), and `start()` only resumes it.

## Numbers (final build unless noted)

### Acceptance
- **Props within 40 m (street level):** 7 to 8 kinds at all six art spots in both moods. 1.11 to 1.88 pieces per 10 m of sidewalk (bar: 1). On 5 seeds x 6 spots: at least 7 kinds and 1.11 per 10 m everywhere. About 1,400 pieces per city.
- **Placement audit (5 seeds):** pads 0, alley or tunnel corridors 0, diagonal 0, roads 0, touching a lamp post or trunk 0.
- **Shop fronts (5 seeds, 421 to 477 neighbouring pairs a city):**
  - same sign 0, same door colour 0, all three the same 0
  - same awning 0 (228 to 265 pairs with an awning on both sides)
- **Cars and trees:** 3 car models (hatchback, estate, taxi) and 2 tree species with real trunks and branches.
- **People:** no box heads. The walk cycle bends knees and elbows (`close28-*-person-f0..f2.jpg`).
- **Screenshots:** after `art28-{d,m}-{hour-130,morning-22}-*.jpg`, before (round 27 build, same spots) `before27-*.jpg`, close-ups `close28-*` (after) and `close27-*` (before), all in `builder-shots/`.

### Budgets
| | Round 27 build | Round 28 |
|---|---|---|
| Busy street flight desktop, p95 (normal / rush) | 9.6 / 9.8 ms | 9.3 to 9.8 / 9.3 to 9.8 ms (3 runs) |
| Busy street flight iPhone 13, p95 | 9.6 / 9.7 ms | 9.6 / 9.4 ms |
| Frame cost, vsync off, desktop median / p95 | 3.7 to 4.0 / 7.4 to 9.2 ms | 3.9 / 7.8 to 7.9 ms |
| Draw calls, street flight (max) | 112 desktop, 94 phone | 135 desktop, 115 phone |
| Draw calls, art views (max) | 108 | 129 |
| Triangles, art views (max) | 459k | 588k (desktop morning shop front) |
| Triangles, street flight (max) | 422k | about 566k |
| First-flight frame | 240 ms desktop, 233 ms phone | 26 ms desktop, 24 ms phone |

- **First load:** HTML 11 KB, CSS 40 KB, main JS 927 KB (was 866 KB). The loader chunk (45 KB) and the assets (1.57 MB) arrive after the first frame. Total for a full session without `?debug`: about 2.6 MB. `firstframe27` measured 1.88 MB transferred in the first 2.5 s.
- Per-asset sizes: cars 59, 59 and 62 KB, props 113 KB, trees 83 KB. Textures: asphalt 297 + 253 KB, paving 196 + 304 KB, wall 6 + 126 KB.
- Assets in use about 0.2 s after load (`assetsReady().ms` 211 to 238).
- `npm run build`: pass (type check clean). Vite warns that the main chunk is over 900 KB. This is only a warning.

### Regressions
- **Layout:** solid colliders, sites and pad audit identical to round 27 on seeds 22, 58, 130, 4 and 317 (same hashes, 0 pad issues). Detail-kit audit 0, 0, 0.
- **Crash-classify (seeds 22, 58, 130):** this machine's round 27 build gave 12 m 6.3 a minute and 20 m 3.6 a minute. Round 28 gave 12 m 5.9, 6.1 and 6.0 (three runs) and 20 m 3.1 and 3.8. No crash within 8 m of the target, so 0 pad lips. These bots are not fully repeatable: the same round 27 code gave 5.2 and 4.0 a minute in the round 27 builder's run.
- **Camera tunnel test (cam-clip24, seed 22):** 10 of 10 PASS, in solid 0, under 0, occluded 0 (three builds).
- **2 m test (phone HUD probe, camera log):** closest camera 5.45 m (round 27: 4.06 m).
- **People probe:** 0 in solids, 0 on roads, 0 hit by cars, 0 on the live pad. Pad-people: 48 legs, 0 on the pad.
- **Traffic probe (4 seeds, normal and rush, 0 cars in solids, 0 off lane, 0 people hit):** 0 overlaps in 5 of 6 runs. One run had 5 overlapping pairs at 2 spots on seed 4 in rush hour. Two repeats of seed 4 gave 0, and so did the round 27 build. The traffic code and car sizes did not change. **Watch point for the critic.**
- **Flat-frame probe:** 865 frames, 0 flat, 0 errors.
- **Phone HUD probe (iPhone 22):** marker on Fly 0, pops on drone 0.00%, p95 9.6 ms. Drone under pills 0.25%: 2 of 791 samples (round 27: 0.13%).
- **Phone camera after pickups and drops.** Tools: the critic's `hud-probe27` and `fb27.py`. Runs: iPhone seeds 22, 58 and 130 (first run), Android 317, iPhone 22 (returning).
  - Drone box 40% of the screen height or more: **0 of 276** wall-side samples (round 27: 25 of 336). Largest 0.37.
  - With the floor at 1.45x it was 14 of 184 (7.6%). At 1.8x it was 4 of 306 (1.3%).
- **Payout chimes without their pop:** 0 of 64 chimes (iPhone 22, 58, 130, Android 317, desktop 22). The critic's payout-based count ("shown without slip pop") still lists 1 or 2 per run. Those are payouts whose pop was held or dropped, and they are now silent.
- **Slipstream hint:** introduced while drafting on every first run checked (7 runs, at 8 to 15 s).
- **Medal gate (seeds 22, 58, 130, real time, final build):**

| Line | 22 | 58 | 130 | Total |
|---|---|---|---|---|
| Street (low) | 6,783 Gold, 4 drops | 4,501 Silver, 4 | 5,571 Silver, 3 | 16,855 (strict delivery share 66.3%) |
| Roof (high) | 6,252 Gold, 6 | 3,871 Silver, 4 | 5,173 Silver, 6 | 15,296 |
| Lazy | 1,183 Bronze, 2 | 1,178 Bronze, 2 | 1,011 Bronze, 2 | 3,372 |

  - Breakdown exact (bot sum = game-over card) on all 9 runs. Street / roof = 1.10. No Ace. Lazy runs Bronze.
  - An earlier build (before the camera, audio and prop-drawing changes) gave 14,940 street, 13,891 roof, all exact.

## Files changed

- New: `src/world/StreetAssets.ts` (loader), `src/world/StreetProps.ts` (props, audits), `public/assets/models/*.glb` (5 files), `public/assets/textures/*.webp` (6 files), `ASSETS.md`.
- `src/world/CityGenerator.ts`: prop placement, shop-bay registry and seed stepping, per-bay awnings, `props` and `shopFronts` in the layout.
- `src/world/CityMaterial.ts`: detail textures near the camera, shop sign and door variants.
- `src/world/Environment.ts`: asset swap-in, tree LOD, asphalt textures, props update.
- `src/world/StreetKit.ts`: model-based car bodies, rounder near people, the strap fix.
- `src/world/Traffic.ts`: `setCarModels`.
- `src/game/Game.ts`: lazy asset load and compile, new hooks, phone room floor, chime with its pop, drafting-only Slipstream hint, audio prewarm, `?assets=0`.
- `src/systems/CameraRig.ts` (`touchRoom`), `src/systems/AudioSystem.ts` (`prewarm`), `src/ui/Hud.ts` (`slipPop` `onShow`), `src/vite-env.d.ts` (hook types).
- `.gitignore`: `asset-src/`.
- New test hooks: `assetsReady`, `assetsOn`, `assetParts`, `streetPropAudit`, `propPlacementAudit`, `shopAudit`, `renderFrom`. Diagnostics: `slipstream.chimes`. The bloom clamps in `ObjectiveMarker.ts` and the bot hooks are untouched.

## Not done or open

- A blind before/after pick by a fresh critic (the acceptance test's last art item) is for the critic.
- Lit-window static and blown-out daytime glows (critic gap 3) were not touched. A glowing box still shows in some bright-morning views.
- Rooftop props from CC0 kits (critic item 5) were not added.
- The van and box truck are still procedural (no CC0 van in Poly Pizza's results).
- People are still procedural figures (no CC0 animated people found).
- The traffic overlap seen once on seed 4 (above).
- `progress.html` was not updated (the critic's report lives there).
- No git commands were run.
