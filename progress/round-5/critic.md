# Drone Dash, round 5 critic report

**Verdict:** The crash cost is now fair. Low street flight no longer gets charged for skims or pad edges. But the low line still pays nothing. A street route delivers about a third as fast as cruising over the roofs, so the best plan is still to fly over the city.

## Round 4 gap (crash cost fired on hops and pad edges): closed

Scripts are copied to `critic-scripts/`. Only the output folders changed. New scripts have their own names.

**crash-classify.mjs, all 8 seeds**

| Cruise | Sim time | Deliveries | Charged crashes | Hop-like | Within 30 m of target |
|---|---|---|---|---|---|
| 12 m | 606 s | 19 | 28 (2.8/min) | **0** | 5 |
| 20 m | 703 s | 26 | 36 (3.1/min) | **0** | 2 |
| 40 m (reference) | 876 s | 39 | 18 (1.2/min) | 0 | 1 |

Round 4 at 12 m: 40% of charged crashes were hop-like. Now 0 at both heights.

**Near-target crashes.** I reran seeds 22, 44, 91 and 130 with a logging variant (`crash-classify-v.mjs`). It records the game's own crash record and the speed 0.3 s before the hit. All 5 near-target crashes hit a real building face: wall tops 10.6 to 55 m, far above the pad (0.4 m). The drone was moving at 14 to 17 m/s just before. 0 were on the pad's own lip, kerb or edge. In one screenshot the bot overshoots a street pad into the shop front behind it (`N-alt12-seed44-t54.1-near.jpg`). In another it drops fast beside a facade (`N-alt20-seed22-t32.9-near.jpg`). This is the bot's own action after a real wall hit, not a game fault.

The bot's "from" speed is low (2 to 6 m/s) because the game decides 0.2 s after first contact. By then the drone has already stopped. Speed 0.3 s earlier was 13 to 17 m/s in every logged case.

**crash-stakes.mjs (seeds 22, 58, 130, plus repeats with crash counter)**
- Seed 22: 29.0 to 10.1 m/s. Within 1 s: clock down 4 s on top of normal ticking, combo x2 lost.
- Seed 58: 28.9 to 10.5 m/s, 4 s and combo lost. Repeat run: same result.
- Seed 130: 18.5 to 10.0 m/s, 3 s and combo lost. In the first run the bot measured a follow-up scrape after the real crash. The screenshot shows "-3 SEC · X2.0 COMBO LOST" was already applied (`X-seed130-crash.jpg`).
- Seed 58, first run: no hit over 8 m/s within 8 s of boosting at 10 m. The street ahead was clear, or the drone brushed through trees and lamp posts, which are now free. Free thin props are fair. They look soft, and a player expects to glance off a tree.

**Scrapes are free (new controlled sweep, `wall-speed-sweep.mjs`).** 18 real block faces on seed 22, head-on at 10 m. With forward held: 0 of 126 charged at 3 to 7 m/s, 2 of 18 at 8 m/s, 18 of 18 at 10 m/s and above. With forward released: 0 charged up to 12 m/s, 18 of 18 at 16 m/s.

**arrival-metrics.mjs, all 8 seeds twice**
- Run B (clean, one browser at a time): seeds 11, 22, 33, 44: 43 legs, 0 timeouts, longest final 4.9 s, marker off screen 1.2%, slow and high 0.6%. Seeds 7, 58, 91, 130: 39 legs, 1 end-of-clock cruise leg, longest final 4.5 s, 1.2% off screen, 0.0% slow and high. Pass.
- Run A was run in parallel with other browsers (CPU contention). It showed 4 finals over 10 s (18 to 33 s) and far fewer legs (29 and 25). The clean rerun did not repeat any of them. Treat run A as invalid.

**Flat-frame probe:** 905 frames, **0 flat**. Mobile run: 15,164 frames, 0 flat.

## Seed 11: not a game fault

- Clean, alone, 5 runs in a row: 52 legs, **0 finals over 10 s**, longest 6.1 s (Tailor, Juniper & 6th, the same rooftop canyon leg as round 4), median 3.2 s.
- Under CPU contention (5 runs plus run A): 3 finals over 10 s (18.4, 20.3, 25.4 s), all with bot stall and back-off cycles.
- So the long seed 11 finals follow host load, not the seed. When the bot polls more slowly, it misses the pad and loops. The game's arrival is fine.

## Low street line against high cruise

New routed pilots (`route-play.mjs` deterministic, `route-play-rt.mjs` real keyboard). The low pilot follows the street grid at 7 m. It goes corner to corner and brakes into turns. It boosts only on long straights, and it rises up the facade for rooftop pads. The high pilot flies straight at 40 m and boosts.

| Pilot | Seeds | Time | Deliveries/min | Crashes/min | Mean speed | Run length |
|---|---|---|---|---|---|---|
| Low, real time | 22, 58, 130 | 215 s | **1.12** | **0.0** | 8 to 9 m/s | 64 to 81 s |
| High, real time | 22, 58, 130 | 450 s (150 s cap) | **3.33** | 1.3 | 14 to 16 m/s | all hit the cap |
| Low, deterministic | 11, 22, 58, 130 | 303 s | 1.39 | 0.0 | | 62 to 85 s |
| High, deterministic | 11, 22, 58, 130 | 666 s | 3.24 | 1.6 | | 124 to 217 s |
| Low, aggressive (corners 11 m/s) | 11, 22, 58, 130 | 124 s | 0.97 | 2.4 | | 24 to 38 s |

- **Fair now.** 518 s of careful street flight gave 0 crashes. Corner-cutting at 11 m/s gives crashes into real corners, which is fair.
- **Not rewarding.** The street line delivers at a third of the high rate, and runs end in about half the time. My pilot is slower than a good player. But even at 15 m/s average, a street route is about 1.3 times longer than the straight line and can rarely boost. My estimate for that player is still only about 55% of the high rate.
- High cruise is also where the hard crashes happen (boosting into towers at 30 to 45 m/s, 4 to 5 s each). It still wins by a wide margin.

## Single biggest remaining gap: the street line is safe but pays nothing, so the high line wins by 3 to 1

Evidence: see the table above. The game has no near-miss, low-flight or street bonus. The time bonus uses the straight-line leg distance, so a street route earns nothing extra for the longer path. Leaving the street costs nothing either. In the best arcade city flyers, the street line is the stylish, risky line. It pays back in score, time or speed. Here it is just slower. The crash rework removed the punishment, but nothing gives the player a reason to go down there.

**Acceptance test** (dev server on 5188, run from the game folder):
1. `LINE=low SEEDS=22,58,130 SIMT=150 node progress/round-5/critic-scripts/route-play-rt.mjs` and the same with `LINE=high`, both unchanged bots.
2. Pass: low deliveries per minute are at least **0.6 times** high. Now: 1.12 against 3.33 (0.34 times). Or: low score per minute is at least **0.75 times** high. Now: 348 against 2,439.
3. Pass: the low run shows a visible low-line reward at least once a minute, for example a HUD pop or a meter. Low crashes stay at or under 1.5 per minute.
4. No regression: crash-classify at 12 m and 20 m still has 0 hop-like and 0 pad-edge charges. crash-stakes still charges every hit over 8 m/s.

## Other gaps (ranked)

1. **Holding forward changes what counts as a crash.** Head-on at 10 m/s with forward held: 18 of 18 charged. Head-on at 12 m/s with forward released: 0 of 18 charged. Thrust during the 0.2 s window adds about 2 to 4 m/s to the measured loss. Players almost always hold forward. So the real threshold is about 9 m/s. Letting go of the key before a hit is an odd way to dodge a penalty.
2. **Pitched roofs are still walls.** The drone met a gable slope at 13.7 m/s. The ridge was 0.6 m above the drone's middle. The game charged -3 s (`P-low-seed22-crash1.jpg`). A player expects to ride up a slope that low.
3. **Crash feedback lands 0.2 s after impact.** At the moment of impact there is no cue yet (`X-seed22-crash.jpg`). When the window closes, the "Crash!" text, shake and sound follow. It reads fine. A short cue on first contact (spark or thud) can tie the cost to the hit more tightly.
4. **Rooftop canyon beside street pads (seed 11 Tailor).** Still the slowest leg, at 4.5 to 6.1 s. It is fair, and it is no longer an outlier.

## How it plays

- **Crash feel is good.** You get a big coral "Crash!" and a chip with seconds and combo lost. The combo badge is struck through. A red vignette, shake and sound follow. Three tiers (3, 4, 5 s) feel proportionate. Tree and lamp brushes are free and look free.
- **Street flying feels safe but slow.** Corners at 7 m/s are clean. Long avenues are pleasant to fly. But each leg starts on a rooftop pad, so you climb out, drop into the street, and fly a longer path for the same reward.
- **Full loop works** on desktop and on iPhone 13 held sideways (touch): title, pickup, delivery, combo, crashes, game over, Fly Again (clock 50.9 s after the mobile restart). Mobile touch controls stay clear of the HUD (`m07-bump.jpg`). The mobile run made 3 deliveries in the first 41 s.

## Performance

- Desktop 1280x720, bloom on, 40 s of flight: 4,854 frames, **median 8.30 ms, p95 9.80 ms, 0 frames over 20 ms**. Same as round 4.
- Mobile emulation (iPhone 13 held sideways, touch, DPR 2), 60 s: 7,161 frames, median 8.30 ms, p95 9.60 ms, max 18.6 ms, 0 over 20 ms.
- First load, production build: **0.72 MB** (JS 693 KB, CSS 17 KB, HTML 6 KB, plus a 31 KB lil-gui chunk). Budget 15 MB: pass.

## Screenshots (progress/round-5/critic/)

- Crash stakes: X-seed22-crash, X-seed130-crash, X2-seed58-crash-421/746, X2-seed130-crash-89
- Crash classify: K-alt12-*, K-alt20-*, K-alt40-* (first 8 crashes each); near-target checks N-alt12-seed44-t54.1-near, N-alt12-seed91-t34.3-near, N-alt20-seed22-t32.9-near, N-alt20-seed130-t54.7/t98.0-near
- Routed pilots: P-low-* (aggressive low run, incl. pitched roof P-low-seed22-crash1), P-high-*, Q-high-* (real-time high run; the real-time low run had no crashes, so no shots)
- Arrival stalls from the contended run A (invalid run): A-seed7/11/22/58-stall-final-approach
- Desktop flow: d01-title to d09-game-over
- Mobile (iPhone 13 held sideways, touch): m01-title to m09-restart

New scripts (progress/round-5/critic-scripts/): wall-speed-sweep.mjs, crash-classify-v.mjs, route-play.mjs, route-play-rt.mjs, route-play-debug.mjs.
