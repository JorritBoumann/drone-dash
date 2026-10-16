# Drone Dash: round 23 builder notes

Main concern: in tunnel passes the chase camera came too close to the drone. Orbiting made it worse, and the camera snapped in by up to 12 m.
Small leftovers: thin traffic, the road-style line on the promenade, a person on a live pad, and the triangle count.

I used my own dev server on port 5190 and stopped it at the end. I did not touch the owner's server on 5188.
Every browser ran alone, from one queue (`builder-scripts/queue23.sh`, `jobs23.txt`).
The critic's scripts are copied into `builder-scripts/`. I changed only the port (5191 to 5190) and the output folders.
Screenshots go to `../builder-shots/`. The low bot's raw audio goes to `../builder/audio/raw/`.

## What really happened in the tunnel passes

`cam-clip.mjs` puts the drone 10 m before each feature, on the axis that the script detects.
On seeds 22 and 130, some "tunnel" passes detect the wrong axis.
Then the drone starts in a slot between two buildings next to the tunnel. The slot is 1.25 to 1.5 m wide (`solid-grid2.mjs` maps it).
The drone gets stuck in the slot and hovers there for the whole pass.
So most of the bad "tunnel" frames came from a camera behind a drone in a very narrow slot:
- The line-of-sight probe used a 0.5 m pad. In a 1.25 m slot it was blocked at once, and the camera fell to its 0.9 m minimum.
- An orbit turned the view into the slot walls. Then the camera snapped from 9 m to less than 1 m in one frame.

Real tunnels are 7 m wide and 7 m high. Without orbit they were mostly fine. With orbit, the same wall problem applied.

## Camera design (src/systems/CameraRig.ts)

1. **Aim at a view that the walls allow.** Before the camera follows its target point, a spherecast from the drone pulls that point in.
   So the camera moves in smoothly. Before, it was pulled in only after it was already behind a wall.
   If the line is blocked close to the drone, the rig tries small moves of the target point.
   It tries 0.3 to 1 m to the side and 1.5 m or 3 m up. It keeps the point with the most clear room.
   So the camera finds the gap and does not fall onto the drone.
2. **Thinner probe.** The pad is now 0.34 m (was 0.5 m). The last pull-in on the actual camera uses 0.2 m.
   The 0.3 m push-out still keeps the near plane out of walls.
3. **Orbit only as far as the view is clear.** During an orbit, the rig tests a row of angles (0.12 to 3.2 rad).
   The test starts straight behind the drone and goes out to the player's angle.
   It stops at the first angle with a blocked view. So the camera cannot go through a wall to get to an angle.
   On the open street nothing blocks the view, so the player's angle is used as before.
   The round 21 orbit, zoom and ease-back do not change.
   A held-back angle moves to its new limit smoothly (14/s in, 5/s out), and it handles the wrap at 180 degrees.
4. **Corridor framing in alleys and tunnels.** Game gives the straight alleys and tunnels to the rig as known bounds (`setCorridors`).
   The bounds come from `narrowRects`, and the bridge underside comes from the colliders.
   When the drone flies along a corridor, the framing applies inside it and 9 m before and after each mouth.
   It blends in at 3.2/s and out at 1.8/s.
   The camera stays on the corridor axis, 5.2 m behind the drone (4.2 to 6.6 m with zoom) and 1.6 m above it.
   It stays 1.15 m from each wall, 1 m under the bridge, and at least 3.6 m back along the axis.
   The orbit range in a corridor is 0.42 rad.
   The "lift" for a blocked view is off in a corridor. It raised the camera into the bridge, and then the camera had to snap back in.
5. **No snaps.** The camera moves at most 1.7 m relative to the drone in one frame.
   This limit is off while the camera is more than 18 m away, for example after a teleport or the title orbit.

Kept: the round 3 arrival framing (same code path), the round 21 controls and ease-back, the push-out, and all debug hooks.
New test hook: `camCorridors()`. New diagnostics: `camera.corridor`.

## Acceptance (critic's cam-clip.mjs and frame-check.mjs, unchanged, settled playing frames)

Numbers per kind come from `cam-accept.mjs`. It uses the same settled-frame rule and in-frame test as frame-check.mjs.

| Run | Tunnel frames | Camera at 2.5 m or more (tunnel) | Drone in frame (tunnel / alley) | Largest jump relative to drone | Inside solid / under ground / drone hidden |
|---|---|---|---|---|---|
| Seed 22, orbit, 64 s | 3,459 | **99.2%** (need 90) | 95.9% / 99.0% | 1.70 m | 0 / 0 / 0 |
| Seed 22, no orbit | 3,464 | **100%** (need 95) | 99.8% / 100% | 0.26 m | 0 / 0 / 0 |
| Seed 130, orbit, 45 s | 2,771 | **100%** | 97.9% / 98.6% | 0.85 m (1.74 m alley) | 0 / 0 / 0 |
| Seed 130, no orbit | 2,771 | **100%** | 99.8% / 98.6% | 0.26 m | 0 / 0 / 0 |

Camera within 1.5 m of the drone (the critic's column):
- Seed 22 with orbit: 9 frames (was 1,723).
- Seed 130 with orbit: 0 (was 1,765).
- Seed 130 without orbit: 0 (was 696).

Jumps over 1 m: 13, 4, 0 and 0 (were 60, 25 and 0). Jumps over 2 m: 0 in all four runs.
Screenshots: `builder-shots/cam-clip-*-tunnel.jpg` and `cam-clip-*-alley.jpg`.

Orbit controls are the same as in round 22 (`cam-desktop.mjs`, `cam-touch.mjs`):
- Right-drag of 300 px: 94.5 degrees, ease-back 1.14 s. Tilt: 37.7 degrees, ease-back 1.14 s.
- Wheel: 13.8 m out, 5.4 m in. Trackpad: 72.9 degrees, no zoom. Pinch zooms and does not orbit.
- Left-click boost starts in 8 ms. Boost during a right-drag works.
- Touch: 68.7 degrees, the stick keeps 15.2 m/s, ease-back 1.1 s (yaw) and 1.0 s (tilt), 0 pops, 0 errors.

## Leftovers

**A. Traffic (src/world/Traffic.ts).**
Cars: 40 to 100 (rush 62 to 136). On mobile: 34 to 84 (rush 52 to 112).
The signal cycle is 12 s (was 18 s): 5 s green for each axis and 1 s all-red. So cars wait less at the stop line.
- Cars within 50 m (`density-probe.mjs`, 200 street points):
  - Seed 22: 2.33 to **6.10** (downtown 2.37 to 6.25). Rush: 3.71 to **7.96** (downtown 3.55 to 9.83).
  - Seed 4: 2.27 to **5.84**. Rush: 4.05 to **7.43**.
- Share of cars standing still (`street-probe.mjs`, speed below 0.5 m/s): 26 to 31% before. After: **15 to 17%** normal, 18 to 22% rush.
- Street probe on seeds 22, 130, 58 and 4 (40 s normal and 30 s rush): 0 car overlaps, 0 cars in buildings, 0 cars off lane.
  Also 0 people in solids, 0 people touching cars, 0 people on the live pad, 0 stuck cars.
- Cost: traffic takes 0.13 ms a frame (0.18 ms in rush). Before: 0.04 and 0.08 ms.

**B. Promenade (src/world/CityGenerator.ts).**
Where a boulevard crosses a block, people walk on it. There, light stone bands across the paving replace the amber centre dashes.
The amber dashes stay only where the boulevard crosses a road.
This change uses no city random numbers, so the layouts do not change.
Screenshots: `builder-shots/promenade-22-*.jpg` and `promenade-4-*.jpg`.

**C. Pad keep-out (src/world/Pedestrians.ts).**
When a pad lights up, the game finds walkers on it (pad radius plus 0.9 m).
These walkers move on along their loop to a point past the pad.
Last step: if a sidestep or a nudge puts a person within 0.15 m of the live pad, the person is pulled back.
If the person is still on the pad, the person is not drawn. The `padHidden` counter counts this.
`pad-probe.mjs` watched 36 live pads (12 pickups and drops each on seeds 130, 22 and 58).
It sampled every 0.1 s. Each pad was watched from the time it lit up to the end of its job.
Result: **0 people on a pad and 0 hidden**. No person came within the pad radius plus 1 m.
The critic's street probe also shows 0 people on the live pad on all 4 seeds.

**D. Triangles (src/world/StreetKit.ts, Traffic.ts, Pedestrians.ts).**
- The real cost: the six vehicle bodies were one merged mesh, and every car drew all six. The shader then hid five of them.
  Now each vehicle type has its own instanced mesh, and it draws only its own part of the shared buffer.
- LOD for cars: past 55 m, a car draws only its body and glass, and it casts no shadow.
- LOD for people: past 40 m, a person draws legs, arms, torso, head and hair cap (104 of 188 triangles).
- Both LODs use a shorter draw range on the same buffers, so they need no extra memory.
- I saw no popping near the drone. The switch is 40 to 55 m from the camera.

| Run | Triangles before (round 22) | After | Draw calls before / after | p95 after |
|---|---|---|---|---|
| Street level, desktop | 508k | **327k** (with 2.5 times the cars) | 83 / 95 | 9.5 ms |
| Same, rush | 651k | **332k** | 84 / 98 | 9.4 ms |
| Street level, iPhone 13 | 438k | **300k** | 67 / 79 | 9.8 ms |
| Same, rush | 567k | **303k** | 68 / 81 | 9.8 ms |
| perf18 route, desktop | 502k | **321k** | 73 / 84 | 9.0 ms |
| perf18 route, iPhone 13 | 439k | **299k** | 57 / 72 | 9.4 ms |

Draw calls go up by about 12: one mesh for each vehicle type and LOD, and one for far people. Headless Chromium caps at 120 Hz.

## Regressions

- Hand-fly first payout: desktop **5.7 s**, iPhone **6.6 s** (round 22: 5.6 s and 6.6 s). In the 80 s runs, p95 is 9.5 and 9.6 ms, with 0 frames over 20 ms.
- Flat-frame probe: 1,019 frames, **0 flat**, 0 errors.
- Crash-classify on seeds 22, 58 and 130:
  - 12 m: 21 charged crashes in 225 s (5.6 a minute, round 22: 6.4). 0 hop-like. 4 near the target. The closest face is 2.5 m below the top, so **0 pad lips**.
  - 20 m: 13 crashes (3.5 a minute, round 22: 2.9). 0 hop-like. 5 near the target. The closest face is 2.8 m below the top, so **0 pad lips**.
- Van slipstream (`van-draft.mjs`): the same as round 22. It banked 325 on seed 58 and 153 on seed 130.
- Low bot (`music-run-esc.mjs`, LINE=low): seed 22 4,294 Silver, seed 58 3,075 Silver, seed 130 4,036 Silver. **Total 11,405** (round 22: 11,426). 0 crashes. The breakdown equals the score in all 3 runs.
- High bot (`route-play-rt-x-m-esc17.mjs`): seed 22 3,371 Silver, seed 58 2,405 Silver, seed 130 1,547 Bronze. **Total 7,323** (round 22: 5,476, round 20: 5,966). 9 crashes (1.6 a minute, round 22: 2.3). The breakdown equals the score in all 3 runs.
  This total is higher than in round 22. Seed 58 did not stall this time. I did not change the flight or the scoring.
- `npm run build`: passes, type check clean. JS 819 KB (229 KB gzip), CSS 38 KB, HTML 11 KB.
- I did not change the bloom clamps in `src/entities/ObjectiveMarker.ts`. The debug hooks are unchanged, and I added `camCorridors`.

## Files changed

- `src/systems/CameraRig.ts`: corridor framing, clear-view aim with small moves, orbit held to the clear angle, thinner probe, step limit for each frame.
- `src/game/Game.ts`: camera corridors (`cameraCorridors()`), the `camCorridors` hook, `camera.corridor` diagnostics.
- `src/vite-env.d.ts`: types for the hook and the diagnostics.
- `src/world/Traffic.ts`: car counts, 12 s signal cycle, one instanced mesh for each type, far LOD.
- `src/world/StreetKit.ts`: vehicle parts sorted by type with far parts first, and ranges for each type. Far parts first for people too.
- `src/world/Pedestrians.ts`: near and far meshes for people, live-pad move-on and last-step keep-out, `padHidden`, `hidden` in the snapshot.
- `src/world/CityGenerator.ts`: stone bands instead of centre dashes where the promenade crosses a block.

New builder scripts: `cam-accept.mjs` (acceptance numbers), `pad-probe.mjs`, `promenade-shots.mjs`, `cor-debug.mjs`, `solid-grid.mjs`, `solid-grid2.mjs`, `queue23.sh` and `jobs23.txt`.

## Still open

- `cam-clip.mjs` puts some "tunnel" passes into a slot between buildings because of its axis detection.
  The drone is stuck there, so those frames test a slot, not the tunnel. The camera now handles both.
- The phone HUD overlap from round 20 (the pad marker on the stick and on the climb button) is still open. I did not work on it this round.
