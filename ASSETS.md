# Drone Dash: assets

Everything not listed here is procedural, made in code (city, buildings, people, vans, trucks, hover-vans, lamps, pines, sky, music and most of the audio; the sampled sounds are listed under Round 45).

All assets below are **CC0 1.0** (public domain, no attribution needed, commercial use fine). No paid or free-tier generation was used.
Originals stay local in `asset-src/` (git-ignored). Only the optimised files under `public/assets/` are committed.

Tool: Blender 5.2 through the Blender MCP (`search_assets` and `import_asset` with Poly Pizza and Poly Haven turned on), round 28.
Pipeline: `progress/round-28/builder-scripts/blender_pipeline.py` (flatten to vertex colours, scale to the game's sizes, split into roles, decimate, export GLB without materials or UVs). Textures: Poly Haven 1k JPEG, converted to WebP with `cwebp` (albedo q72, normal q80).

## Models (Poly Pizza)

| Asset | Source | Author | Tool | Used for | Game file (size) |
|---|---|---|---|---|---|
| Car Hatchback | https://poly.pizza/m/BG0KAhmGDt | Kay Lousberg | Blender MCP | traffic type 0 (compact) | `public/assets/models/car_compact.glb` (59 KB, 628 tris) |
| Stationwagon | https://poly.pizza/m/vTTTjDoxhV | Kay Lousberg | Blender MCP | traffic type 1 (sedan slot) | `public/assets/models/car_wagon.glb` (59 KB, 624 tris) |
| Taxi | https://poly.pizza/m/u5PhZQ35XG | Kay Lousberg | Blender MCP | traffic type 2 (taxi) | `public/assets/models/car_taxi.glb` (62 KB, 654 tris) |
| Fire Hydrant | https://poly.pizza/m/thffn9bO75 | Kay Lousberg | Blender MCP | street prop (hydrant) | in `public/assets/models/street_props.glb` |
| Bench | https://poly.pizza/m/6d92UYCIC1 | Kay Lousberg | Blender MCP | street prop (bench, bus stop bench) | in `street_props.glb` |
| Fence Pillar | https://poly.pizza/m/O8wNXcCDLL | Kay Lousberg | Blender MCP | street prop (corner bollard) | in `street_props.glb` |
| Trashcan | https://poly.pizza/m/eoC8NFaafh | Kenney | Blender MCP | street prop (litter bin) | in `street_props.glb` |
| Medium Pot | https://poly.pizza/m/y05UXwo0fM | Isa Lousberg | Blender MCP | street prop (planter, with a procedural shrub) | in `street_props.glb` |
| Table Large Circular | https://poly.pizza/m/aG6qYcqcI0 | CreativeTrio | Blender MCP | street prop (cafe table) | in `street_props.glb` |
| Chair | https://poly.pizza/m/iMNqRzPwwe | Quaternius | Blender MCP | street prop (cafe chair) | in `street_props.glb` |
| Sign | https://poly.pizza/m/4MSsNFk5fc | Quaternius | Blender MCP | street prop (sandwich board) | in `street_props.glb` |
| Tree | https://poly.pizza/m/1BkD9JnKrE | Quaternius | Blender MCP | tree species 1 (round), near the camera | in `public/assets/models/trees.glb` |
| Tree | https://poly.pizza/m/b0boebSV1r | Quaternius | Blender MCP | tree species 2 (oak), near the camera | in `trees.glb` |

Round 29: no new files. The car GLBs are unchanged on disk. At load the game drops the leftover wheel shards from each car's `trim` part (about 200 triangles inside the arches; the kit's wheels did not survive the round 28 decimation) and raises the body 7 cm. The wheels are procedural instanced meshes in code (`StreetKit.buildWheelGeometry`, tyre, sidewall and five-hole rim), no asset.

`street_props.glb`: 113 KB, 1,468 tris for all eight props together. `trees.glb`: 83 KB, 802 tris for both species (trunk plus canopy).

## Textures (Poly Haven)

| Asset | Source | Author | Tool | Used for | Game files (size) |
|---|---|---|---|---|---|
| Plastered Wall 02 | https://polyhaven.com/a/plastered_wall_02 | Charlotte Baglioni | Blender MCP, cwebp | facade detail near the camera (albedo detail plus normal, every wall material) | `public/assets/textures/wall_plaster_albedo.webp` (6 KB), `wall_plaster_normal.webp` (126 KB) |
| Concrete Pavement 02 | https://polyhaven.com/a/concrete_pavement_02 | Charlotte Baglioni | Blender MCP, cwebp | sidewalk slabs near the camera (albedo plus normal) | `paving_albedo.webp` (196 KB), `paving_normal.webp` (304 KB) |
| Asphalt 02 | https://polyhaven.com/a/asphalt_02 | Rob Tuytel | Blender MCP, cwebp | road surface (albedo plus normal, 3 m tile) | `asphalt_albedo.webp` (297 KB), `asphalt_normal.webp` (253 KB) |

## Round 31: boats, marina docks and the water

Tool: Blender 5.2.2 through the Blender MCP (`search_assets` with licence "CC0" and `import_asset`, Poly Pizza), round 31. No paid or free-tier generation.
Pipeline: the round 28 `flatten()` from `progress/round-28/builder-scripts/blender_pipeline.py` (one sRGB colour per face from the kit's palette texture), then per model: centred, keel at z = 0, bow on -Y (glTF +Z), scaled to the game length, colours written as a linear corner colour attribute, one role (`<model>__all`), exported as one GLB with no materials or UVs (`progress/round-31/builder-scripts/blender_boats.py`).

| Asset | Source | Author | Licence | Tool | Used for | Game file |
|---|---|---|---|---|---|---|
| Sail Boat | https://poly.pizza/m/BgSZXwmm7k | Quaternius | CC0 1.0 | Blender MCP | sailboat (7 m), 3 sailing and 1 moored | in `public/assets/models/boats.glb` |
| Lifeboat | https://poly.pizza/m/Bkd4KKQA4O | Quaternius | CC0 1.0 | Blender MCP | rigid inflatable speedboat (5.2 m), 2 fast and 1 moored | in `boats.glb` |
| Cruise Ship | https://poly.pizza/m/yq9EKmEmfC | Quaternius | CC0 1.0 | Blender MCP | harbour ferry (scaled to 20 m), 1 sailing | in `boats.glb` |
| Boat | https://poly.pizza/m/5UEl54KsuC | Quaternius | CC0 1.0 | Blender MCP | rowing / fishing boat (4.6 m), 2 moored | in `boats.glb` |
| Dock | https://poly.pizza/m/XViKoBh2UN | Quaternius | CC0 1.0 | Blender MCP | marina docks (8 m pieces, two per dock, two docks) | in `boats.glb` |

`boats.glb`: 240 KB, 3,116 tris for all five models (sail 1,020, lifeboat 626, ferry 858, rowing boat 224, dock 388). Loaded after the first frame with the street assets.
Imported but not used: "Small Ship" (https://poly.pizza/m/W2vMzztgIi, CC0, a wooden period ship that does not fit the modern city) and "Boat" (https://poly.pizza/m/OknDJkGeJ8, CC0, a second rowing boat).

Round 32: no new files. The game now draws the Cruise Ship model at 0.72 scale (14.4 m). It is a harbour bus that stops at two piers. A third pier on the north wall uses the same Dock model (2 more instances). No Blender run, no generation, no .blend saved.

Water: procedural, no file. The detail normal map (and its foam noise channel) is made in code at start (`src/world/Water.ts`, 18 tileable sine waves, 256 px, 128 px on phones). No third-party texture.

## Round 35: boats rebuilt (materials, hull caps, clean normals)

Tool: Blender 5.2.2 through the Blender MCP (`import_asset` with Poly Haven on, `execute_blender_code`), round 35. No paid or free-tier generation. No .blend file saved (a fresh unsaved scene "dd_boats35").
Script: `progress/round-35/builder-scripts/blender_boats35.py`.

Models: the same four CC0 Quaternius boats and the CC0 dock as round 31 (table above). Round 31 never decimated the boats; it only flattened their palette texture to one colour per face and dropped the UVs. I searched Poly Pizza (CC0: "sailboat", "speedboat", "yacht motor boat", "ferry", "rowboat canoe kayak") and Poly Haven (models, "boat"). Nothing was clearly better and still fit a modern city (Poly Pizza only has the same Quaternius set plus period ships and a Kenney pirate ship; Poly Haven's boats are 17th-century Dutch ships), so no model was swapped.

What changed per boat: welded (0.1 mm), every closed part checked to face outwards, smooth shading with sharp edges above 34 degrees, new UVs (Smart UV Project), a baked albedo texture, a flags colour (sail cloth / metalness / roughness per part) and, for the three open boats, a hull cap (role `cap`, the inner hull outline at the gunwale, drawn depth-only in the game).

| Asset | Source | Author | Licence | Tool | Used for | Game file |
|---|---|---|---|---|---|---|
| Brown Planks 03 | https://polyhaven.com/a/brown_planks_03 | Rob Tuytel | CC0 1.0 | Blender MCP (1k JPEG diffuse) | wood grain on the sailboat and rowing-boat hulls (baked, not shipped) | in `boat_sail_albedo.webp`, `boat_row_albedo.webp` |
| Roof Planks | https://polyhaven.com/a/roof_planks | Rob Tuytel | CC0 1.0 | Blender MCP (1k JPEG diffuse) | varnished trim, mast, thwarts, keel (baked, not shipped) | in `boat_sail_albedo.webp`, `boat_row_albedo.webp` |
| Boat textures (baked) | made in Blender from the two Poly Haven textures plus procedural paint bands, sail cloth panels, rope stripes, tube seams, wet band and ambient occlusion | (own bake) | CC0 inputs | Blender Cycles bake, cwebp q80 | albedo per boat | `public/assets/textures/boat_sail_albedo.webp` (2048 px, 216 KB), `boat_row_albedo.webp` (1024 px, 80 KB), `boat_rib_albedo.webp` (1024 px, 37 KB), `boat_ferry_albedo.webp` (1024 px, 37 KB) |

`boats.glb` is now 211 KB (round 31: 240 KB): 2,728 boat triangles (unchanged: sail 1,020, rib 626, ferry 858, row 224) plus 3 hull caps (30, 32 and 18 triangles) and the dock (388). Boat textures 369 KB. Everything loads after the first frame with the street assets. The source JPEGs and the PNG bakes stay local in `asset-src/polyhaven/` and `asset-src/bake35/`.

## Round 36: boat detail pass and new hull lids

Tool: Blender 5.2.2 through the Blender MCP (`execute_blender_code`), round 36, in the same unsaved round 35 scene. No new third-party asset, no paid or free-tier generation, no .blend file saved.
Script: `progress/round-36/builder-scripts/blender_boats36.py`.

All new parts are modelled in the script and reuse the round 35 baked textures (each new part takes the UV of one clean texel of a matching colour in its own boat's texture), so no texture changed and no re-bake was needed.

- Sailboat: sail cloth subdivided and given a belly (up to 0.34 m to leeward); forestay, two shrouds with chainplates, a tack line and a sheet (thin 5-sided tubes). The flags colour carries a flutter weight for the game's vertex shader.
- Rowing boat: plan rounded from the eight-sided outline to a superellipse (station cuts every 0.15 m, each station's beam scaled), 10% narrower, smooth shading below 62 degrees; two thwarts with knees, two shipped oars with painted blades, two oarlocks.
- Rib: tubes and seats shaded smooth; the white bands take one clean texel (their baked hatch shimmered).
- Harbour bus: the big white and dark faces above the boot top take one clean texel (no stair-stepped bake edges); window bands on the cabin, a glazed wheelhouse with a visor, a red name band with a pinstripe, railings on the roof deck, the side walkways and the stern.
- Hull lids (role `cap`): rebuilt from the outer outline of each open hull at the lid height, inset 2.5 cm, so the lid reaches into the wall all round.

`boats.glb` is now 459 KB (round 35: 211 KB): sail 2,368 triangles, rib 626, ferry 2,642, row 2,632, lids 18 (sail) / 82 (row) / 82 (rib), dock 388. Textures unchanged (369 KB).

## Round 38: smoother rib tubes

Tool: Blender 5.2.2 through the Blender MCP (`execute_blender_code`), in the same unsaved round 35/36 scene. No new asset, no paid or free-tier generation, no .blend file saved.
Script: `progress/round-38/builder-scripts/blender_rib38.py`.

- Rib (CC0 Quaternius "Lifeboat", as before): every gently curved hull edge (tubes, white bands, rubbing strake; under 62 degrees) cut once with the new points on the smooth surface, so the tube cross-section goes from 8 to 16 sides and the bow cone rounds off. The seats are smooth shaded across their sides (not cut: a smooth cut pinched them). Rib 626 -> 1,908 triangles. No texture changed.

`boats.glb` is now 500 KB (round 36: 459 KB). All lazy assets now about 2.4 MB.

## Totals

- Models: 385 KB. Textures: 1,182 KB. All round 28 assets: about 1.5 MB, loaded after the first frame.
- Round 31: boats.glb 240 KB. All lazy assets now about 1.8 MB.
- Round 35: boats.glb 211 KB plus 369 KB of boat textures. All lazy assets now about 2.1 MB.
- Round 36: boats.glb 459 KB, textures unchanged. All lazy assets now about 2.4 MB.
- Round 38: boats.glb 500 KB (rib tubes smoothed), textures unchanged.
- Round 45: `audio/sfx.mp3` 161 KB (the Kenney sound sprite), fetched after the first frame. First load of the production build measured at 3.59 MB (23 requests) with every lazy asset.

## Round 45: sound samples (Kenney audio packs)

Source: the five CC0 Kenney audio packs in `asset-src/kenney-audio/` (Impact Sounds, Interface Sounds, Sci-fi Sounds, UI Audio; licence files inside each pack: "Creative Commons Zero, CC0", credit optional). Nothing was downloaded; no paid or free-tier generation. The digital-audio pack is not used.
Tool: `progress/round-45/builder-scripts/build_sprite.py` (ffmpeg + numpy): decode, trim, peak-normalise (-1.5 dBFS for the crash layers, -3 dBFS for the rest), 2 ms fade-in and up to 20 ms fade-out, loops get a baked equal-power crossfade, then everything goes into one mono sound sprite with 0.12 s gaps and a 2 ms sync click at 0.05 s (the game measures the decoder delay against it).

Game file: `public/assets/audio/sfx.mp3` (MP3 96 kbps mono 48 kHz, 13.4 s, **161 KB**), offsets in `src/systems/sfxSprite.ts`. Fetched and decoded after the first frame; every sampled cue has a procedural fallback until it is ready.

| File | Pack | Licence | Author | Part used | Where used | Sprite name |
|---|---|---|---|---|---|---|
| `explosionCrunch_000.ogg` | kenney_sci-fi-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | head-on crash (layer 1, random pitch) | `crunch` |
| `impactPlate_heavy_000.ogg` | kenney_impact-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | head-on crash (layer 2, metal body) | `plate` |
| `impactMetal_medium_000.ogg, _001.ogg, _003.ogg` | kenney_impact-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | wall knock (random of three) and a low layer of the crash | `knock0-2` |
| `impactMetal_light_000.ogg, _001.ogg, _003.ogg` | kenney_impact-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | wall scrape grains (random, panned to the wall side) | `scrape0-2` |
| `scratch_004.ogg, scratch_001.ogg` | kenney_interface-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | wall scrape grit on harder scrapes | `grit0-1` |
| `thrusterFire_004.ogg` | kenney_sci-fi-sounds | CC0 1.0 | Kenney (www.kenney.nl) | 1.15 to 1.65 s | boost ignition burst | `ignite` |
| `thrusterFire_002.ogg` | kenney_sci-fi-sounds | CC0 1.0 | Kenney (www.kenney.nl) | 1.3 to 4.0 s, loop with a baked 0.3 s crossfade | boost burner loop (held while boosting, 0.6 s fade on release) | `thrust` |
| `switch12.ogg` | kenney_ui-audio | CC0 1.0 | Kenney (www.kenney.nl) | whole | pickup: the claw latches | `latch` |
| `impactTin_medium_000.ogg` | kenney_impact-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | pickup: metal clunk under the latch | `clunk` |
| `switch14.ogg` | kenney_ui-audio | CC0 1.0 | Kenney (www.kenney.nl) | whole | delivery: the claw opens | `unlatch` |
| `impactSoft_medium_001.ogg` | kenney_impact-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | delivery: the parcel lands; heartbeat layer in the last 3 s | `thud` |
| `impactWood_light_000.ogg` | kenney_impact-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | delivery: cardboard box knock | `box` |
| `tick_002.ogg` | kenney_interface-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | clock tick, 10 to 6 s left (pitch rises a semitone a second) | `tick0` |
| `tick_001.ogg` | kenney_interface-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | clock tick, 5 to 1 s left; missed rush order | `tick1` |
| `select_001.ogg` | kenney_interface-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | UI click (title buttons, play, resume); glass edge on slipstream chimes | `select` |
| `back_001.ogg` | kenney_interface-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | UI: pause | `back` |
| `toggle_002.ogg` | kenney_interface-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | UI: music toggle (N and the chip), minimap toggle (M) | `toggle` |
| `error_004.ogg` | kenney_interface-sounds | CC0 1.0 | Kenney (www.kenney.nl) | whole | crash that breaks a combo | `error` |
| `spaceEngineLow_001.ogg` | kenney_sci-fi-sounds | CC0 1.0 | Kenney (www.kenney.nl) | 1.6 to 4.9 s, loop with a baked 0.3 s crossfade | city ambience: distant low engine rumble (lowpassed, very quiet) | `cityLow` |

Everything else in the audio stays procedural: the rotor, air and slipstream, the ambience beds (city hum and traffic, harbour water and wind, altitude wind), Doppler pass-bys, FM chimes, horns, the medal fanfare and all music.

Round 46: the second soundtrack, "Breakbeat" (`src/systems/breakbeat.ts`), is procedural too: every drum (kick, snare, hats, shaker, ride, crash, riser), the sub and saw bass, the FM Rhodes, plucks, lead and stabs are synthesised in code from oscillators and the game's own generated noise buffer. It uses no sample and adds no file and no bytes to the load. The `toggle` sample above also clicks for the new Music: Classic / Breakbeat and Effects on / off buttons.

Round 47: no new files. Breakbeat's new kit (pitched snare body, saturated noise, a 280 Hz boost and a generated 0.3 s room; darker ghosts; hats with three colours; a kick with a click and a short pitch drop), the new brass stabs and horns (three detuned saws, a pitch blip, a soft clip, a two-stage filter), the FM mallet clock tick, the sub-drop and the two-band slipstream are all synthesised in code. The existing `tick0` and `tick1` samples now play quietly under the FM tick (rate 0.7, low-passed at 2.4 kHz, panned with it), and the crash and knock samples also send into the shared reverb through a 250 Hz high-pass.
