# Drone Dash: assets

Everything not listed here is procedural, made in code (city, buildings, people, vans, trucks, hover-vans, lamps, pines, sky, audio).

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

Water: procedural, no file. The detail normal map (and its foam noise channel) is made in code at start (`src/world/Water.ts`, 18 tileable sine waves, 256 px, 128 px on phones). No third-party texture.

## Totals

- Models: 385 KB. Textures: 1,182 KB. All round 28 assets: about 1.5 MB, loaded after the first frame.
- Round 31: boats.glb 240 KB. All lazy assets now about 1.8 MB.
