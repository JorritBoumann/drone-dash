# Drone Dash: round 31 builder notes

Owner request: some boats in the water next to the island, and more realistic water.
Plus the round 30 leftover: the alley camera hid the drone behind a wall (Quill Row seed 22, Thimble Lane seed 58).

Dev server: my own on port 5190 (stopped at the end). The owner's 5188 was left alone. Browsers ran one at a time.
Machine: BTLEServer at 99 to 100% of one core in every `cpu-*.txt`. The NordVPN helper used up to 13%. Headless Chromium still ran at
120 fps this session. Wall-clock frame numbers are marked contaminated. The water cost comes from GPU timer queries.

## 1. Water (`src/world/Water.ts`, new)

- **Mesh:** a grid that follows the camera (snapped to the 2.5 m step in `onBeforeRender`, so near vertices never swim).
  2.5 m cells near the camera, growing 7% per ring out to 1.3 km. 23k triangles. Phone: 3.2 m cells, 9% growth, about 11k.
- **Swell:** four sum-of-sines waves: 21, 13, 8.3 and 5.1 m long, 0.13, 0.08, 0.045 and 0.025 m high, deep-water speeds slowed 20%. The
  vertex shader lifts the grid, fading the swell out between 150 and 380 m from the camera. The GLSL is generated from the
  same `WAVES` table as the TypeScript `waveHeight()` that the boats sample, so there is one source.
- **Normals:** per pixel, the analytic swell gradient plus two scrolling, rotated samples of a tileable detail normal map
  (made in code at start, 18 sine waves, 256 px). Phones use one sample and 128 px. Detail fades with distance.
- **Colour and reflection:** Fresnel (Schlick, F0 0.02, base clamped before `pow`) between a deep-to-shallow water colour and an
  analytic reflection of the mood's own sky gradient (the same uniforms as the sky dome: horizon, mid, top, sun halo). The sun
  glint is the key light's GGX specular at roughness 0.16, so building shadows remove it. Indirect env specular is not used.
- **Shore:** exact signed distance to the seawall box (`|x|, |z| = 164`). Shallow colour within about 16 m. A darker band
  shows the wall's foot. Lapping foam moves in and out along the wall, broken by the noise channel. Scattered foam patches
  reach out to 6 m. Foam round the marina docks from their rectangles. Foam also catches sky light, so it stays white in
  building shadow.
- **Wakes:** up to 8 moving boats sent each frame (position, speed, half sizes, heading as sin/cos). Per boat: a Kelvin V
  (19.5 degree arms) with ripples that tilt the normal, a foam trail and a bow wave. Strength grows with speed. Fragments more
  than about 20 m plus the wake length from a boat skip it.
- **Moods:** deep, shallow and foam colours plus reflection strength per mood (golden hour, bright morning, rose dusk, hazy noon).
- **NaN safety (round 1 lesson):** every `pow` base is clamped to [0, 1]. Normals are built as `normalize(vec3(.., 1.0, ..))`.
  The reflection vector gets a tiny +y before `normalize`. Reversed `smoothstep` edges (undefined in GLSL) were rewritten.
  Flat-frame probe with bloom: 877 frames, 0 flat, 0 errors.

Before / after (desktop and phone, cruise height, low over the water, at the seawall, every mood):
`builder-shots/before-water-*.jpg` (24) and `builder-shots/after-water-*.jpg` (40, adds the marina and a wide view).

## 2. Boats (new `src/world/Boats.ts`, assets in `public/assets/models/boats.glb`)

- **Assets:** CC0 Quaternius models from Poly Pizza through the Blender MCP: Sail Boat, Lifeboat (used as a fast rigid
  inflatable), Cruise Ship (scaled to a 20 m harbour ferry), Boat (rowing / fishing boat), Dock (marina). The round 28
  pipeline (`flatten`) plus `builder-scripts/blender_boats.py`: vertex colours, bow on +Z, keel at 0, one GLB, 240 KB,
  3,116 triangles. Logged in ASSETS.md. No generation, no paid credits, nothing saved to a .blend file. At the start, Poly Pizza
  and Poly Haven were off in the Blender session. I switched both on in the add-on panel (scene properties).
- **Loading:** with the street assets after the first frame (`Game.loadAssets`), compiled with `compileAsync` before they are
  added. One `InstancedMesh` per kind plus one for the docks: 5 draw calls (10 with the shadow pass).
- **Layout:** 10 boats. 6 move on four lanes, rounded squares at 30, 52, 78 and 104 m from the seawall: 2 sailboats
  (2.8 m/s), 2 speedboats (8.5 m/s), the ferry (4.4 m/s), 1 sailboat (3.2 m/s). One speed and one direction per lane, so
  no boat can meet another, the shore or the marina. Start positions shift per city seed. 4 boats are moored in a small marina
  on the south wall (two 16 m docks at x = -52 and -36).
- **Motion:** heave from the swell at the hull centre (same fade as the shader), pitch and roll from four samples at bow,
  stern and both sides. Sailboats heel 7 degrees plus a slow sway. Speedboats trim bow-up 3.4 degrees.
- **Rules:** boats and docks have no colliders (like the hover-vans), so they never charge a crash. They are all on the water,
  more than 3.5 m from the seawall, so never on a delivery pad.

## 3. Alley camera (`src/systems/CameraRig.ts`, `smoothRel`)

Cause, found with a per-frame log of the glide's choice: on Quill Row the glide's target was itself hidden. The per-frame cap
upstream (`MAX_REL_STEP`) kept the target within 1.7 m of a camera behind the alley corner. With a hidden target, the glide
skips its sight test. So the camera glided along out of sight for 0.26 to 0.57 s.

Fix (the climb fix is untouched):
1. A hidden target is replaced by the clear part of the line from the drone to the target. The ideal chase point is the second
   choice. The new target must be free of walls and at least the glide gap from the drone.
2. If no step along the glide sees the drone, search all round the last camera within one smooth step (26 directions, three
   radii up to 0.9 m) for a wall-free point that does, nearest the target.
3. The drone stays hidden for at most 0.045 s (`HIDE_MAX`). After that, the camera cuts to the nearest clear view further out.
   (Never needed in the tests below.)

## Acceptance results

| Check | Result |
|---|---|
| Boat kinds visible | 4 (sail, speedboat, ferry, rowing boat) |
| Moving boats | 6, each with a wake (`after-water-*-wide.jpg`, `after-boat-*.jpg`) |
| 120 s fixed-step probe, seeds 22 and 130 (`boat-probe.log`) | 7,200 steps each: 0 hull-shore, 0 hull-hull, 0 hull-dock overlaps. Closest hull corner to the wall 3.5 m |
| Bob against the water (instance matrices against `waterAt` with the fade) | max error 0.0056 m (limit 0.1). Heave range per kind matches the water's within 0.01 m (about -0.27 to +0.28 m) |
| Camera: `cam-clip30` seed 22, no orbit | 0 hidden frames (round 30: 115), 0 in solid, 0 jumps over 1 m |
| `cam-clip24` seed 22 / 58 random orbit, iPhone 22 no orbit | 0 / 0 / 0 hidden frames, 0 in solid, 0 jumps over 1 m |
| `climb30` desktop / iPhone | 0 of 4,800 frames over 1.0 m (max 0.896 m), 0 in solid, max height share 0.395 |

## Budgets

GPU time per frame (EXT_disjoint_timer_query_webgl2, whole pipeline, 40 frames per pose, `perf-water-*.log`):

| Pose | Desktop 1280x720, bloom on: frame / water share / boats | iPhone 13 (wide): frame / water |
|---|---|---|
| Cruise over the bay | 8.1 ms / 2.1 to 2.3 ms / under 0.4 ms (noise) | 4.3 ms / 1.6 ms |
| Low over the water | 7.6 to 7.8 ms / 1.8 to 3.4 ms | 4.0 ms / 1.4 ms |
| Marina | 8.5 ms / 2.1 ms | 3.6 ms / 0.4 ms |
| Downtown street (water hidden) | 9.1 to 9.7 ms / 0.1 ms | 5.1 ms / 1.4 ms |

The GPU-timer p95 per pose is 12.5 to 14.6 ms on desktop. It is the same with the water off (14.2 ms in the city pose). So
that spread is timer noise, not the water.

Real time (contaminated, BTLEServer at 100%):
- Circling low over the marina (`perf-shore-*.log`): desktop median 8.3 ms, p95 9.8 / 10.0 ms. iPhone p95 9.7 ms. No long tasks.
- Street (`perf-street-*.log`): desktop p95 9.7 / 9.5 ms (normal / rush), iPhone 9.5 / 9.7 ms.
- Draw calls: trisweep max 145 (desktop 130), 142 (desktop 22), 128 (iPhone 130). All under 150.
- Triangles: trisweep max 584k (desktop 130), 559k (desktop 22), 518k (iPhone 130). 0 spots over 600k. Round 30 was 542k.
  The water grid adds 23k and the boats about 8k. This is now the tightest budget.
- First load: production build 3.0 MB without source maps (round 30: 2.7 MB). boats.glb is 240 KB of it.. JS 935 KB.
- First flight: 0 long tasks and 0 new shader programs after Play (2 desktop runs, 1 iPhone run). Max frame 16.7 ms.

## Regressions (all on port 5190, `builder-scripts/`)

- Crash-classify, seeds 22, 58, 130: 12 m: 24 charged crashes in 201 s, 0 pad lips (closest 2.4 m below a top). 20 m: 9 in
  211 s, 0 pad lips (closest 2.6 m). Only 3 seeds here. The critic ran 8.
- People on active pads: 0 (48 legs, 1,536 samples).
- Traffic per-frame overlap: 0 on seeds 22, 130, 58 (12,001 frames each).
- Phone HUD (iPhone 22, 58, 130): marker on controls 0, pops on the drone 0. Drone under a pill: 1 of 798 samples on the
  first seed 22 run, 0 on a repeat and on 58 and 130.
- Flat frames with bloom: 0 of 877.
- Street medal gate (low line), breakdown exact on all 3: 5,428 Silver (22), 2,930 Silver (58), 5,284 Silver (130).
  Total 13,642 (round 30 critic: 13,230).
- No-delivery farm: 0 points on 22, 58 and 130.
- `npm run build`: passes (type check clean). The bloom clamps in `ObjectiveMarker.ts` and every bot hook are unchanged.

## Not done / open

- No real reflections of the city or boats in the water (sky only). A planar reflection costs a second scene pass.
- Boats do not react to the drone, and the drone flies through them. That matches the vans. A human player must judge it.
- Rowing boats and docks are plain kit models. A human eye must check the boats' scale against the cars and people.
- After the after-shots I made slow boats' wake trails weaker (sailboats and the ferry). The water shots were taken just
  before that, `after-boat-*.jpg` just after.
- The critic's other round 30 gaps (slow re-centre after turns, desktop pops) were not touched.

## Files changed

- `src/world/Water.ts` (new): water mesh, shader, swell table and `waveHeight`, shore distance.
- `src/world/Boats.ts` (new): boats, lanes, marina, bobbing, wakes, probe data.
- `src/world/Environment.ts`: uses `Water`, builds `Boats` (`applyBoats`), updates both.
- `src/game/Game.ts`: loads `boats.glb` with the street assets. Hooks: `boats`, `boatFootprints`, `waterAt`, `waterOn`, `boatsOn`.
- `src/vite-env.d.ts`: hook types.
- `src/systems/CameraRig.ts`: alley camera fix (sight target, sight search, `HIDE_MAX` cut).
- `public/assets/models/boats.glb` (new), `ASSETS.md`.
- `src/world/Textures.ts`: unchanged (the old `waterNormalTexture` is no longer used).

Scripts in `builder-scripts/`:
- New: `water-shots.mjs`, `pose-shot.mjs`, `boat-probe.mjs`, `boat-close.mjs`, `perf-water.mjs`, `perf-shore.mjs`.
- New helpers: `console-check.mjs`, `spells.cjs` (hidden spells and jumps from cam-clip rows), `blender_boats.py`.
- Queues: `cam-queue.sh`, `queue31.sh`.
- Copied from round 30 (port 5190, probe screenshots to a scratch folder): `cam-clip30.mjs` (plus `ONLY=` for one feature).
- Also copied: `cam-clip24.mjs`, `climb30.mjs`, `cam-sampler.js` (now logs the glide choice) and the regression probes.
