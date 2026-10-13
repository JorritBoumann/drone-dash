# Drone Dash, round 4 critic report

**Verdict:** Crashes now cost something, and the feedback reads well. But the cost also fires on the game's own ledge hop and on low contacts near pads. So flying low through the city is a trap. The best plan is to cruise above every roof.

## Round 3 gap (crashes had no cost): closed

Scripts are copied to `critic-scripts/`. Only the output folder and image format changed (JPEG, quality 80). Variants with extra logging have their own names.

**crash-stakes.mjs, seeds 22, 58, 130.** 4 runs, 12 hits measured by the bot as a speed loss of more than 8 m/s.
- 11 of 12 cost something within 1 s: 3 or 4 s off the clock, and the combo was lost (x2.0 to 0) every time a combo was running. Example seed 22: 29.2 to 10.5 m/s, clock 31.7 to 27.7 s at the hit, combo 2 to 0, "Hard crash! -4 SEC · x2.0 COMBO LOST" (`critic/X-seed22-crash.jpg`).
- 1 of 12 was free: seed 130, run 1, 14.0 to 5.7 m/s (8.3 m/s in the bot's 30 ms sample), no time lost, no combo running. The game measures loss per frame against a 7 m/s threshold, so this is a borderline case where drag adds to the bot's number. The 3 later seed 130 runs all charged 3 s (`critic/X2-seed130-crash-*.jpg`).
- Scrapes stay free. Across the probes, 363 speed drops of 2 to 7 m/s per sample were not charged. Two charged crashes showed a loss under 6 m/s in the bot's samples (seeds 58 and 22). In both, the real loss happened between samples.
- Score is never taken. Parcels are never lost. That is a fair choice.

**arrival-metrics.mjs, all 8 seeds, twice (plus seed 11 three more times).**

| Run | Seeds | Legs | Final-approach timeouts | Longest final | Sum final / sum cruise | Marker off screen | Slow and high |
|---|---|---|---|---|---|---|---|
| A1 | 11, 22, 33, 44 | 42 | 0 | 5.1 s | 129.7 / 201.5 s | 0.7% | 1.0% |
| A2 | 7, 58, 91, 130 | 38 | 0 | 4.4 s | 113.5 / 178.2 s | 0.9% | 0.6% |
| B1 | 11, 22, 33, 44 | 45 | 0 | 5.5 s | 143.9 / 219.0 s | 0.9% | 2.7% |
| B2 | 7, 58, 91, 130 | 42 | 0 | 4.1 s | 129.3 / 228.8 s | 1.0% | 0.1% |
| C | 11, 11, 11 | 33 | 0 | 6.6 s | 113.4 / 157.2 s | 0.6% | **5.5%** |

- All criteria pass on all runs A and B. Median final approach is 3.0 s.
- Two runs in A ended in a cruise leg (seed 44 rooftop pickup, seed 91 street pickup), not in a final approach. The clock ran out before the bot got within 30 m.
- **Seed 11:** no leg went over 10 s in 5 runs (55 seed 11 legs). The slowest leg is the Tailor street pickup at Juniper & 6th Ave: 4.5 to 6.6 s, with about 25% of its final samples slow and more than 4 m above the pad. That alone pushes seed 11 to 5.5% slow and high in run C. Screenshots (`critic/W-seed11-Tailor-2.7s.jpg`, `-5.4s.jpg`) show why: the bot cruises at 40 m. It arrives over a 33 m building beside a deep street canyon. It sits on the roof edge for about 3 s, then drops off. This is the bot's straight-line route, not a game fault. A player sees the pad in the street and comes off the roof at once.

**Flat-frame probe (acceptance-probe.mjs):** 1,003 frames, **0 flat**. Mobile play: 53,397 frames, 0 flat.

## Single biggest remaining gap: the crash cost punishes the ledge hop and low play near pads, so flying low is a trap

The ledge hop is meant to let you skim over parapets, roof boxes and rims. It still removes your forward speed, and the crash check counts that speed loss. So every hop above about 7 m/s head-on is charged as a full crash: minus 3 s and the combo. Low contacts at the pad itself (roof lips, kerbs, park edges) are charged the same way. The player sees "Crash!" for things that look like a skim or a landing.

Evidence (`critic-scripts/crash-classify.mjs` and `crash-classify-rt.mjs`, same bot, cruise at 12 m against 40 m, no boost):
- Low cruise (12 m), 8 seeds: 45 charged crashes. **18 (40%) were hop-like**: the drone rose more than 0.8 m in the next 0.3 s with climb not held. 11 were within 30 m of the target. Real-time repeat on 4 seeds: 20 crashes, 9 hop-like (45%), 5 near the target.
- `critic/K-alt12-seed11-crash3.jpg`: the drone skims a roof box at 21 m, 11.5 to 4 m/s. "Crash! -3 SEC · x1.5 COMBO LOST".
- `critic/R-alt12-seed22-crash7.jpg`: on the grass at 0 m, 10 m from a park pad, 14.5 to 6.8 m/s, "-3 SEC". Nothing in view looks like an obstacle.
- `critic/R-alt12-seed11-crash1.jpg`: clipping the roof lip of the building whose roof holds the pickup pad, 9 m out, combo lost.
- Result for the run (real time, seeds 11, 22, 58, 130): at 12 m the bot crashed 4.6 times a minute. Runs lasted 39 to 80 s, with 8 deliveries in total (scores 0 to 1,487). At 40 m the same bot crashed 0.5 times a minute. Runs lasted 122 to 174 s, with 27 deliveries (scores 3,259 to 6,609). The 40 m mobile run made 12 deliveries in 220 s.

Some low crashes are fair: the 12 m bot also flies straight into taller walls. But 40% of them are the game's own skim helper. In the best arcade city flyers, the low line between buildings is risky and it pays. A ledge you can skim never punishes you. Here the low line costs more and gives nothing back. So you fly over the city, not through it.

**Acceptance test** (start the dev server, run from the game folder):
1. `ALT=12 node progress/round-4/critic-scripts/crash-classify.mjs` and `ALT=20 ...` on all 8 seeds: **0 charged crashes are hop-like** (rose more than 0.8 m within 0.3 s, climb not held). A ledge hop must never show "Crash!".
2. Same runs: 0 charged crashes within 30 m of the target where the drone ends up on the surface it hit (rooftop pad lip, kerb, lawn edge). Use the log fields `hd < 30`, `rose >= 0`, and `y` within 1.5 m of the target height. Check each match by screenshot.
3. No regression: `crash-stakes.mjs` (seeds 22, 58, 130) still charges a cost on every head-on wall hit over 8 m/s, and `arrival-metrics.mjs` still passes on all 8 seeds.
4. Optional design target: in `crash-classify-rt.mjs`, deliveries per run at ALT 12 reach at least half of those at ALT 40 (now 2.0 against 6.75).

## Other gaps (ranked)

1. **Nothing rewards a low or risky line.** Even with fair crashes, high cruise is both the safest and the fastest route. Near misses, low flight or threading a gap earn nothing. A small reward for close, fast flight gives the crash cost a purpose.
2. **Game over does not say why the run ended.** A careless run lost 18 s to 5 crashes in 32 s. The card says only "TIME'S UP", score 0, deliveries 0 (`critic/F-game-over.jpg`). Show crashes and time lost, so the player learns why.
3. **Crash popups cover the nav marker.** The "-4 SEC" chip sits on the "61 m" marker label (`critic/F-crash1-400ms.jpg`). The "-3s" and "+15s" flashes sit half under the timer pill (`critic/K-alt12-seed22-crash1.jpg`).
4. **Rooftop canyons beside street pads.** Seed 11 Tailor pickup: a 33 m building edge next to the pad holds the drone for about 3 s (`critic/W-seed11-Tailor-2.7s.jpg`). It is fair. When the pad is straight below, a small push off the roof edge can help.
5. **Pitched roofs are walls.** A cruise contact with a sloped roof at 12.8 m reads as a crash (`critic/K-alt12-seed22-crash1.jpg`). Players expect to slide up a slope.

## How it plays

- **Crash feedback is readable and strong.** You get a big coral "Crash!" or "Hard crash!" and a chip with seconds and combo lost. The combo badge is struck through. A red flash, shake, hit-stop and a sound follow. It reads at a glance on desktop and on iPhone 13 held sideways. Three tiers (3, 4, 5 s) feel proportionate.
- **Fair on walls, unfair on skims.** Hitting a tower at boost now hurts the right amount. Skimming a roof box or touching a kerb next to the pad hurts the same, and that feels wrong.
- **Landing is free.** Vertical drops onto pads were never charged in any run.
- **Full loop works.** Title, routing, pickups, deliveries, combos, crashes, game over and Fly Again all work. Desktop Enter and mobile tap both restart the clock at 49.5 to 49.7 s. Mobile touch controls stay clear of the HUD. A clean mobile run lasts 220 s with 12 deliveries. A careless run ends in 32 s.

## Performance

- Desktop 1280x720, bloom on, 100 s of active flight: 12,054 frames. **Median 8.30 ms, p95 9.80 ms, p99 10.2 ms, max 10.4 ms.** **0 frames over 20 ms.** Same as round 3 (8.3 / 9.8).
- Mobile emulation (iPhone 13 held sideways, touch), 220 s: 26,270 frames, median 8.30 ms, p95 9.50 ms, 3 frames over 20 ms (max 50 ms).
- First load, production build: **0.71 MB** (JS 690 KB, CSS 17 KB, HTML 6 KB). lil-gui (31 KB) is a separate chunk. Budget 15 MB: pass. The dev server serves 7.0 MB unbundled.

## Screenshots (progress/round-4/critic/)

- Crash stakes: X-seed22-crash, X-seed58-crash, X-seed130-crash, X2-seed*-crash-* (repeats)
- Crash classification, deterministic probe at 12 m: K-alt12-seed11-crash1 to 6, K-alt12-seed22-crash1/7/8
- Real-time probe: R-alt12-seed11-crash1 to 4, R-alt12-seed22-crash5 to 8, R-alt40-seed11-crash1 to 3, R-alt40-seed130-crash4/5
- Trace run: T-alt12-seed58-crash1 to 3
- Seed 11 slow leg: W-seed11-Tailor-0.0s to 6.0s
- Careless desktop flow: F-crash1/2 at 0, 400, 1000 ms, F-game-over, F-restart
- Desktop flow: d01-title to d09-game-over (d09 is taken at the end of a 100 s window, the run was still going)
- Mobile (iPhone 13 held sideways, touch): m01-title to m09-restart

Scripts (progress/round-4/critic-scripts/): crash-stakes.mjs, arrival-metrics.mjs, acceptance-probe.mjs, play-desktop.mjs, play-mobile.mjs and the other round 3 scripts (output path and JPEG only). New: crash-stakes-v.mjs (adds crash counter), crash-classify.mjs, crash-classify-rt.mjs, crash-trace.mjs, arrival-watch.mjs, desktop-crash-flow.mjs.
