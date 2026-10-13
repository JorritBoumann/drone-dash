# Drone Dash, round 5 builder report: fair crash classification

## Cause

The round 4 crash check fired on the game's own skim helpers. Four separate faults caused this:

1. **The ledge hop counted as a crash.** A hop cancels the drone's speed into the ledge. The crash check then counted that speed as "lost".
2. **The speed loss was a raw before/after delta.** It included drag, the S brake and the drop guide's pull near pads. So near a pad, a light touch plus braking was enough to pass 7 m/s.
3. **Edge clips counted as wall hits.** Sometimes the drone's underside clipped a roof edge or the rim of a box (contact normal 20 to 45 degrees up). The bounce then took off horizontal speed, and the game charged it.
4. **Lamp posts and trees counted as walls.** These are "soft" props. Near the camera, the game hides them. One head-on post hit stopped the drone dead (the critic's "nothing in view looks like an obstacle", grass, 10 m from a park pad). In a probe I placed the drone in front of a park lamp post: it stopped at 0 m/s and stayed pinned.

## Design

- **Only real walls can cost you.** Only a wall contact counts toward a crash. These contacts are never counted:
  - a low lip the drone can skim (the same test the game uses for its hop)
  - an underside clip on an edge (normal y 0.35 to 0.7)
  - a lamp post or tree
- **Severity is the speed the collision itself takes off.** It is the horizontal speed before the sub-stepped collision loop minus the speed after it. Thrust, drag, braking and the guide all run before the loop, so none of them count. The 3, 4 and 5 s tiers and the 7 m/s threshold are unchanged.
- **A hop always wins.** The crash is judged 0.2 s after first contact (the same span the loss was already summed over). If the game's own ledge hop fires inside that span, the collision is a skim and costs nothing.
- **The pad's own edge is free.** The rule applies within 30 m of the current pad. A wall there is free if its top is within 1.5 m of the pad height and the skids are less than 4 m below that top. This covers a roof lip, a kerb or a lawn edge you clip as you drop in.
- **Low lines keep their speed.** This is the low-flying reward. I kept it inside the physics and added no new scoring rule.
  - Lips up to 0.9 m above the skids are stepped over at full speed. This covers parapets (0.7 m), kerbs and fountain rims. The body eases up visually.
  - Taller ledges up to 2.2 m still hop. The pop is faster the harder you meet the ledge. Once you clear the top, the hop gives back 85% of the forward speed it absorbed.
  - Posts and trees brush you aside with 80% of your speed. There is one glance per brush, so you slide off instead of sticking.
- **Round 4 feedback is unchanged for real crashes:** HUD pop, -Ns chip, vignette, sparks, shake, tumble and sound. Brushes and skims keep the light scrape feedback.

I did not add a slipstream or combo bonus. Fair skims plus speed carry already make the low line pay. A scoring rule needs its own balancing round.

## Files changed

- `src/entities/Drone.ts`:
  - `FlightEvents` gains `wallLoss`, `wallTop` and `wallNormalY`.
  - Collision loop: soft-prop glance, edge-clip class, step-up, hop speed carry and impact-scaled hop lift.
  - New `columnTop()` helper.
  - New `place()` debug method.
- `src/game/Game.ts`:
  - `checkCrash` rewritten: wall-only loss, 0.2 s judge, hop skim and pad edge rule.
  - New `isTargetEdge`.
  - Diagnostics gain `lastCrash` and `contact`.
  - Hooks gain `__GAME__.place()` and `__GAME__.sites()`. All existing hooks are unchanged.
- `src/systems/CollisionWorld.ts`: `deepestSoft` flag.
- `src/game/config.ts`:
  - `FLIGHT.stepUp`
  - `CRASH.padEdgeRange` and `CRASH.padEdgeDepth`
  - comments on `chainGap` and `hitSpan`
- `src/vite-env.d.ts`: types for the new diagnostics and hooks.
- `src/entities/ObjectiveMarker.ts`: not touched. The bloom clamps are intact.

## Scripts

The critic scripts are copied to `progress/round-5/scripts/`. Only the output folder changed (now `../shots/`). The logic is unchanged.

I added three extra scripts of my own:
- `crash-classify-diag.mjs`: adds target y, the game's `lastCrash`, and a trace of climb input after each crash.
- `crash-stakes-trace.mjs`: logs contacts after the hit.
- `obstacle-probe.mjs`: places the drone in front of a fountain or post.

## Numbers

**crash-classify.mjs (official copy, deterministic, 8 seeds):**

| Cruise | Sim time | Deliveries | Charged crashes | Per minute | Hop-like | Near pad, on its surface |
|---|---|---|---|---|---|---|
| 12 m | 526 s | 14 | 29 | 3.3 | **1** | **1** (seed 22, see below) |
| 20 m | 744 s | 29 | 35 | 2.8 | **0** | 0 |
| 40 m (diag copy) | 905 s | 43 | 17 | 1.1 | 0 | 0 |

The round 4 critic measured 12 m at 45 crashes, 18 of them hop-like.

Over 6 more diagnostic runs at 12 m and 20 m:
- 0 to 1 hop-like matches per run. Every one is a flat wall hit: normal y 0, wall top 2.4 to 12 m above the drone. Then the bot presses Space within 0.3 s, from its unstick routine (S plus Space) or its altitude hold. No residual case was a game hop.
- Every flagged "near pad, on its surface" case, checked by screenshot, was a building facade or the depot building hit head-on at street level. Example: `shots/K-alt12-seed22-crash6.jpg` shows a shop front 10 m from the café pad. `D-alt12-seed44-crash2` (the depot front wall) came from a diagnostic run, and I deleted that run's screenshots before the final classify runs. None was a lip, kerb or lawn edge.

**Honest result:** criterion 1 is not a clean 0 at 12 m. The critic's hop-like test cannot tell the bot's own climb after a real wall hit from a hop.

**Real time (crash-classify-rt.mjs, seeds 11, 22, 58, 130):**
- 12 m: 3.2 crashes a minute, 9 deliveries (2.25 a run).
- 40 m: 0.4 crashes a minute, 17 deliveries (4.25 a run).
- I ran the two in parallel. That seems to slow the 40 m bot: seeds 11 and 58 made only 2 deliveries each, with 0 crashes.
- Deterministic deliveries per run: 1.75 at 12 m against 5.4 at 40 m.
- The optional target (12 m at half of 40 m) is **not met**. Most remaining 12 m crashes are real: the straight-line bot flies head-on into 13 to 57 m buildings without avoiding them.

**crash-stakes.mjs (22, 58, 130):**
- 58: 28.5 to 10.8 m/s, -4.8 s (bot reading).
- 130: 16.7 to 7.6 m/s, -3.8 s, combo 2 to 0.
- 22: 16.7 to 3.5 m/s, **free**. The bot boosted at 2 m into the park fountain's centre pillar (`shots/X-seed22-crash.jpg`). The pillar top is 1.4 to 2.2 m above the skids, so by the game's own rule this is a ledge hop. The bot releases the keys at the hit, so the drone does not carry its speed on. I count this as the hop rule working, but it does not pass the critic's "every hit over 8 m/s" line literally.
- On the earlier run, seed 58 was a 13.5 m/s rooftop parapet hop, also free. It is now a full-speed step-over.

**Scrapes:** the free bump counts above are 165 to 231 per run, with no charge.

**arrival-metrics.mjs:**

| Run | Legs | Final-approach timeouts | Longest final | Off screen | Slow and high |
|---|---|---|---|---|---|
| 11, 22, 33, 44 | 43 | 0 | **15.8 s** | 3.2% | 3.2% |
| 7, 58, 91, 130 | 40 | 0 | 4.6 s | 0.9% | 0.3% |
| 11, 11 | 21 | 0 | 3.7 s | 2.1% | 4.1% |

- The second set has 1 timeout, but it is a cruise leg (seed 91), not a final approach. The clock ran out before the bot got within 30 m, as in round 4.
- The 15.8 s final is seed 11, Willow Lofts Rooftop. It is the same leg that took 16.6 s in round 4's builder run. The bot dropped beside a taller tower, stalled 4 times, then landed (`shots/A-seed11-stall-final-approach.jpg`).
- On the re-runs of seed 11, the same leg took 3.7 s both times.

**Other checks:**
- Flat-frame probe: 1,021 frames, **0 flat**.
- Frame time (long-run, 120 s each, bloom on): seed 22 median 8.30 ms, p95 9.80 ms. Seed 58 median 8.30 ms, p95 9.80 ms. 0 frames over 20 ms. This equals round 4.
- `npm run build` passes (JS 693 KB).
- The dev server on port 5188 is stopped.
