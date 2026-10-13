# Drone Dash, round 3 critic report

**Verdict:** Arrivals now feel clean and fair, and the round 2 gap is closed. The game is now too forgiving: a 40 m/s head-on crash costs nothing, so flying fast and badly is never punished.

## Round 2 gap (final approach to street targets): closed

Scripts are copied to `critic-scripts/` with no logic changes. The screenshot folder is relative, so it now writes to `round-3/critic/`.

| Run | Seeds | Legs | Timeouts | Longest final | Sum final / sum cruise | Marker off screen | Slow and >4 m above |
|---|---|---|---|---|---|---|---|
| A | 11, 22, 33, 44 (tuned) | 43 | 0 | 6.6 s | 137.4 / 221.4 s | 0.9% (18 of 2,112) | 3.5% |
| B | 11, 22, 33, 44 (tuned) | 46 | 0 | 4.6 s | 144.3 / 222.7 s | 0.7% (16 of 2,215) | 1.5% |
| C | 7, 58, 91, 130 (new) | 40 | 1 | 4.4 s | 119.5 / 219.4 s | 0.9% (16 of 1,841) | 0.3% |

Round 2 numbers were 46% off screen, 16.6% on a roof, and sum final 180 s against sum cruise 113 s.

- All criteria pass on the tuned seeds in both runs. Median final approach is 3.0 s on street and raised targets alike. There were 0 final-approach stalls.
- On the new seeds, all criteria pass except one timeout. It is not a final-approach failure. On seed 91 the clock ran out 0.5 s into a final approach, after a 40.2 s cruise leg. The bot cruises at 40 m. In that leg it hit a tower taller than that, again and again (`critic/C-seed91-cruise-stuck.png`, 52 m altitude, 147 m out). A re-run with a trace (`cruise-trace.mjs`) gave the same result. This is mostly a bot limit. A player can see the tower and climb. It is listed below as a minor gap.
- Flat-frame probe (`acceptance-probe.mjs`): 1,018 frames, **0 flat**. Mobile play: 14,657 frames, 0 flat.

### How the arrival help feels

- **It is fair and does not fly the game for you.** `assist-probe.mjs` runs 8 seeds with fixed time steps. I committed 10 m from the pad, 7 to 31 m above it. With descend held and no steering, the pad triggered on 6 of 8 legs, median 1.55 s. When I held descend and flew away, it triggered on **0 of 6** legs. The pull never overrides intent.
- **It is generous.** Holding one button 10 m out finishes the drop. The two misses were rooftop pads where the drone sank past the roof edge. That is a fair miss.
- **Camera:** on the final approach it looks down at about 55 to 63 degrees from 13 to 16 m away. The pad and street read clearly (`P-seed22-commit-A.png`). Pitch rate is p50 0.09 rad/s and p95 0.64 rad/s. I saw no sickness-level whipping. The camera came closer than 2.5 m to the drone in 8 of 4,254 samples (min 1.95 m).
- **X-ray ring:** it reads as "the pad is here, behind this". It is small and faint behind bright walls (`A-seed22-stall-final-approach.png`, 16 m out, ring barely visible behind a sunlit wall). It did not confuse me.
- **Ledge hop:** I saw no clipping through roofs in screenshots. Stalls are now rare: 4 street stalls in 6 minutes of long-run play.

## Single biggest remaining gap: crashes have no cost

The drop is no longer the hard part, so the only skill left is routing. Routing has no risk, because hitting a wall costs nothing. In the best arcade delivery flyers, the fun is threading a fast line past towers while a mistake is expensive. Here, full boost straight into a tower is the same as braking.

Evidence (`critic-scripts/crash-stakes.mjs`): two deliveries to build a x2.0 combo with a parcel on board, then boost at 10 m into the first wall.
- Seed 22: 39.8 m/s head-on into a tower (`critic/X-seed22-crash.png`). One second later: time left 30.8 to 29.5 s (normal drain only), combo still 2, score 1,123 unchanged, parcel still carried.
- Seed 58 (12.6 to 1.2 m/s) and seed 130 (15.6 to 0.4 m/s): same result. Nothing lost.
- Mobile play: a chain of 3 bumps from 40.8 to 19.5 m/s, then a delivery 2 s later that *added* time (`critic/m07-bump.png`). Desktop play logs about 4 bumps per minute.
- Combo only resets on a slow delivery, so crashing is in practice the fastest way to brake.

**Acceptance test:** start the dev server and run `node progress/round-3/critic-scripts/crash-stakes.mjs` (seeds 22, 58, 130) unchanged.
1. On every seed, a hit that drops speed by more than 8 m/s must cost something visible and lasting within 1 s. That means at least one of: the combo drops, more than 2 s comes off the clock beyond normal drain, or score is lost. The HUD must show what was lost.
2. Light scrapes must stay free. In `play-desktop.mjs`, bumps that drop speed by less than 6 m/s must change none of these values.
3. No regression: `arrival-metrics.mjs` still passes on seeds 11, 22, 33, 44 and 7, 58, 91, 130 with final-approach criteria as above.

The builder chooses the cost (parcel damage, combo break, time). It must be readable, not a silent number.

## Other gaps (ranked)

1. **Run start still faces away from the first target** (round 2 gap 1, not fixed). At takeoff the marker is pinned at the bottom-right edge, 67 m away. The title copy is still fading over gameplay (`critic/d02-takeoff.png`).
2. **Landing is close to automatic.** Descend held from 10 m finishes 75% of drops in about 1.5 s. Options: a smaller pull radius, or more points for a manual, centred drop, to reward precision.
3. **Towers taller than cruise height trap a straight-line flyer.** Seed 91 cost a 40 s leg and the run (`C-seed91-cruise-stuck.png`). Seed 44 had a 22.8 s cruise. At 52 m the camera looks steeply down, so the tower face fills the view and it is not obvious that you should climb.
4. **The nav marker still covers the objective pill** (round 2 gap 5, not fixed). "Juniper" is hidden (`critic/m03-flight.png`).
5. **At boost the camera trails 13 to 15 m** (p50 13.1 m against 7 to 10 m at cruise). The drone gets small. In 14% of cruise samples it sits in the top 30% of the frame, near the HUD pill (`critic/d08-stuck-near-drop.png`, 30 m/s). The file name is from the script. The drone is not stuck.

## Performance

- Desktop 1280x720, bloom on, 120 Hz: two 3-minute runs (`long-run.mjs`), about 43,000 frames. **Median 8.30 ms, p95 9.80 ms, p99 10.3 ms.** **Max 18.1 ms, 0 frames over 20 ms.** p95 is up 1 ms from round 2 (8.8 ms). There is still large headroom.
- Mobile emulation (iPhone 13 held sideways, touch, post off, 9-pixel probe on): 6,902 frames, median 8.30 ms, p95 9.60 ms, 5 frames over 20 ms, one 492 ms start or compile hitch.
- First load (production build): 0.71 MB (JS 686 KB, CSS 15 KB, HTML 6 KB). lil-gui (31 KB) loads only with `?debug`. Budget 15 MB: pass.
- About 80 to 86 draw calls and 298k triangles.
- The clock now produces pressure: a crude bot run lasts about 3 minutes and 9 deliveries.

## Screenshots (progress/round-3/critic/)

- Arrival help: P-seed11-commit-A/H, P-seed22-commit-A/H, P-seed33-commit-A/H (the title overlay in the seed 33 shots is a test artifact from starting through the test hook)
- Stall and cruise: A-seed22-stall-final-approach (long run), C-seed91-cruise-stuck
- Crashes: X-seed22-crash, X-seed58-crash, X-seed130-crash
- Long run end: L-seed22-end, L-seed58-end
- Desktop flow: d01-title to d09-game-over
- Mobile (iPhone 13 held sideways, touch): m01-title to m09-restart

Scripts (progress/round-3/critic-scripts/): arrival-metrics.mjs, acceptance-probe.mjs (copied, unchanged logic), assist-probe.mjs, cruise-trace.mjs, long-run.mjs, cam-distance.mjs, crash-stakes.mjs, play-desktop.mjs, play-mobile.mjs.
