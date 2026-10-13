# Round 3 builder note: final approach to street-level targets

## Causes found
I traced the critic's autopilot sample by sample. I also read the colliders around each slow target.

1. **The camera never looked down at the pad.** The chase camera keeps a shallow pitch. Take a pad 20 m below and 10 m ahead. It sits about 60 degrees below the horizon. The vertical FOV is only 60 degrees, so the pad leaves the frame. Only a special case for "far and high" existed.
2. **Parapets pinned the drone on roofs.** Every flat roof has a 0.7 m parapet that is solid. A drone that lands on a roof and flies toward the edge hits the parapet with its contact normal mostly horizontal. It bounces back. Holding descend pulls it back down, so it stays inside the parapet ring. This was the main roof stall (seed 44 pharmacy: the pad is 1.6 m past the parapet of a 6.6 m building).
3. **The drone arrived over the pad while still high.** It drops at 10 m/s, and the bot starts its descent 25 m out. It then reaches the pad at 20 to 30 m altitude, hovers, drifts and wobbles, and often settles on the next roof. Boost speed bled off at 35% of the normal drag, so arrivals after a boost overshot by 10 to 20 m.
4. **Tree colliders started too low.** Each one is a box that starts at the lowest point of the canopy. The round canopy is an ellipsoid, so the lower corners of the box were invisible. At street level they wedged the drone between a facade and a tree (seed 22 Records: 4 stalls).
5. **Some pads were hidden behind a tower.** From the arrival side, a tower stood in the way. One example is seed 44 Deli on Copper & 4th, beside a 70 m tower. Coming from the far side, a straight approach runs into the tower wall. This is the critic's original seed-44 screenshot.
6. The trigger radius and the landing tolerance were not the problem. I did not change them.

## Changes (and why)
- **Approach camera** (`CameraRig.ts`, `CAMERA.approach*`). The effect starts when the target is within 45 m and more than 2 m below. It is fully on at 18 m. The camera rises up to 4.5 m and pulls in 18%. It pitches down until the pad sits in the lower part of the frame. The pitch is capped so the drone stays in frame. Only the pitch changes, so the heading still follows the drone. The effect blends in over about 0.4 s.
- **Through-roof ground ring** (`ObjectiveMarker.ts`). This is an additive ring with no depth test, drawn at the pad. You can see where the pad is through roofs and towers from 6 to 90 m. It uses a basic material and no `pow()`. The round-2 beam and wall clamps are untouched.
- **Ledge hop** (`Drone.ts`, `FLIGHT.hop*`). Some obstacles are low: their top is less than 2.2 m above the skids, with nothing taller behind. If you fly into one, the drone skims up over it instead of bouncing. This covers parapets, roof units and fountain rims. Collision still applies. The hop only adds lift.
- **Faster drop, crisper stop** (`FLIGHT.descendSpeed` 16, `sinkBrakeResponse` 7). Climb stays at 10 m/s. Getting down to a street drop now feels snappy. When you release descend, the drop stops fast, so you do not sink past a roof edge.
- **Dive airbrake.** Within 28 m of the pad, when you descend, leftover boost speed bleeds at the normal rate. So you do not sail past the pad.
- **Drop guide** (`FLIGHT.guide*`). The guide works within 11 m of the pad. You must be descending, or hovering less than 6 m above the pad. The drone then eases toward the pad centre at up to 6 m/s. Pulling back weakens the pull, and climbing or boosting cancels it.
- **Tree colliders fit the canopy** (`CityGenerator.ts`). The canopy box now starts where the ellipsoid is as wide as the box (2.2 x scale instead of 1.6 x scale). A thin trunk collider was added. Pines are unchanged.
- **Pad placement** (`DeliverySystem.ts`). When possible, the game picks a next target that you can glide to. The test line runs from 25 m out on the arrival side to the pad, and must clear solid buildings. This uses the same `isClear` test the first pickup already used. When nothing else fits, hidden pads still appear.

## Files changed
- src/systems/CameraRig.ts
- src/entities/ObjectiveMarker.ts (ring only, bloom clamps intact)
- src/entities/Drone.ts
- src/game/config.ts
- src/game/Game.ts (gives the active pad to the drone, clears it at game over)
- src/systems/DeliverySystem.ts
- src/world/CityGenerator.ts
- src/systems/DebugTools.ts (descendSpeed slider)

Debug hooks and diagnostics fields are unchanged.

## Acceptance numbers
The original `arrival-metrics.mjs` saves stall screenshots into `progress/round-2/critic/`, and I must not edit round 2. So I ran a copy in which only the `OUT` path differs (a scratch folder). I checked the logic with a `diff` against the original. Default seeds 11, 22, 33, 44, default URL, bloom on.

| run | legs / timeouts | longest final | sum final vs sum cruise | marker off screen | slow and >4 m above |
|---|---|---|---|---|---|
| round 2 (critic) | 28 / 1 | 32.4 s | 180.0 vs 112.9 | 46.1% | 16.6% |
| final A | 46 / 0 | 6.5 s | 148.3 vs 222.8 | 0.6% | 1.8% |
| final B | 41 / 0 | 6.8 s | 136.0 vs 203.3 | 0.7% | 4.4% |

- Stalls in the final approach: 0 in both final runs (round 2: 24).
- Run-to-run variance is real. Two runs before the last two tweaks (crisper stop, guide range 8 to 11 m) each had one 18 to 20 s leg. Slow-and-high has ranged from 1.5% to 5.2% across builds, and was 1.8% and 4.4% on the final build. It comes from 1 to 2 s spells resting on a neighbouring roof or tree top before the hop or guide frees the drone.
- `acceptance-probe.mjs` (unmodified): 1,025 frames, 0 flat.
- `npm run build`: passes (JS 686 KB).
- Frame time (`play-desktop.mjs` copy, 1280x720, bloom on, 120 Hz): median 8.30 ms. p95 was 9.2 to 9.9 ms across runs, with 0 frames over 20 ms.
  - This p95 is higher than the critic's 8.8 ms. I ran an A/B with the new camera, guide and ring disabled, and it gave the same p95 (9.7 ms). So the difference is machine load (other sessions and dev servers were running), not this change.
  - The runs are also about 20k frames long now, against 8k in round 2, because the bot makes more deliveries.

## Screenshots (progress/round-3/)
- approach-20m.png: the camera rises and frames the beam at 41 m.
- approach-9m.png: street level, the pad framed beside the facade.
- xray-ring-through-tower.png: from an intermediate build. The ring shows the pad through a tower. That target type is now avoided from that side.
