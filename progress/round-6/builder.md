# Drone Dash, round 6 builder: a reward for the low street line

## Design

**Slipstream (low line reward).** Fly below 18 m, faster than 4 m/s, beside a building face taller than the drone (within 12 m; full strength at 4 m or closer; a second face across the street adds a canyon bonus). A meter fills while you draft (about 2 s at full quality, 5 to 10 s at street centre and cruise speed). It holds 1.2 s after you leave the draft, then drains slowly. Each full meter pays out:
- points: 40, then +15 for each chained payout (up to x5), times the combo multiplier,
- +30% boost tank,
- +1 s on the clock.

While you draft, the fast-drop clock (leg par) does not run. A charged crash empties the meter and the chain.

Feedback: an amber "Slipstream" meter above the boost bar, shown only while it matters. It shows "x2" and up for a chain. A "+40 slipstream" pop rises from the meter, and the timer shows "+1s". Faint speed lines and warm wind streaks peel off the drone. A whistling air band rises in pitch as the meter fills. There is a blip at each quarter, and a whoosh and chime on payout that climbs with the chain.

**Par uses the street route.** The fast-drop par now uses grid distance (|dx| + |dz| + |dy|) instead of the straight line. Following the streets is no longer a slow drop by definition. The time bonus is unchanged.

**High wind above the roofline.** From 20 m up (full at 28 m), top cruise and boost speed drop by up to 30%. Speed carried in from below bleeds at the normal rate instead of gently. Feedback: a "High wind · slower up here" chip in the same slot as the slipstream meter, pale wind streaks blowing past from ahead, and a louder, lower, gusting wind layer. High cruise still works (it delivers about 1.6 times as fast as the street bot). Skimming the low roofs under 20 m is now a middle line.

**Crash severity no longer depends on input (critic gap 1).** The forward thrust added in a contact frame is subtracted from the wall loss. Holding forward into a wall no longer adds to the measured hit. Wall-speed-sweep (critic's 2 m gap) after the fix: held 10 m/s charges 18/18 because the drone really hits at about 11 m/s. Released 12 m/s hits at about 9.5 m/s and is free. By real impact speed, the result no longer depends on the key: `wall-impact-consistency.mjs` gives free at 10 m/s or below and charged at 11 to 12 m/s and up, with or without W. Loss/impact ratio: 0.62 held, 0.65 released. The rest of the old held/released difference was real approach speed: drag slows a released drone over the last 2 m.

## Files changed
- `src/systems/Slipstream.ts` (new): draft quality, meter, chain, payouts.
- `src/game/config.ts`: `SLIPSTREAM` block; `FLIGHT.headwindStart/Full/Slow`.
- `src/game/Game.ts`: slipstream update and payout, wind streaks, HUD and audio wiring, par hold, diagnostics (`slipstream`, `leg`, `player.headwind`).
- `src/entities/Drone.ts`: headwind top speed and bleed; thrust taken out of `wallLoss`.
- `src/systems/DeliverySystem.ts`: `addBonus`; par on grid route; par hold while drafting.
- `src/systems/AudioSystem.ts`: draft whistle layer, `slipTick`, `slipPayout`, gusts in `updateRotor`.
- `src/ui/Hud.ts`, `index.html`, `src/styles.css`: slipstream meter, slip pop, high-wind chip.
- `src/vite-env.d.ts`: diagnostics types.
- Not touched: `ObjectiveMarker.ts` (bloom clamps), `__GAME__` and test hooks.

## Numbers (dev server 5188, one browser at a time for timing-sensitive runs)

Acceptance, `route-play-rt` (real time; I ran `route-play-rt-slip.mjs`, the same bot with extra result fields), seeds 22, 58, 130, SIMT 150:

| Line | Sim | Deliveries/min | Score/min | Crashes/min | Slipstream payouts |
|---|---|---|---|---|---|
| Low (7 m streets) | 277 s | **1.52** | 1,255 | **0.0** | 15 (3.2/min; 5, 3, 7 per run) |
| High (40 m straight) | 373 s | **2.41** | 1,761 | 0.5 | 0 |
| Round 5 low / high | | 1.12 / 3.33 | | 0.0 / 1.3 | |

- Deliveries ratio **0.63** (pass, needs 0.6). Score ratio 0.71 (under 0.75, but the test passes on either one).
- Low: visible reward 3.2 times a minute, crashes 0/min. Pass.
- Deterministic `route-play-slip.mjs` agrees: low 1.54/min and 1,345/min; high 2.44/min and 1,845/min.
- The low bot's own pace limits it. Even with unlimited boost it only reaches 1.58/min, because it caps itself at 16 m/s and 7 m/s corners. So most of the ratio change comes from the high-wind nerf: high went from 3.6 to 2.4 deliveries a minute. The par change and slipstream mostly raise low score (590 to 1,255 a minute) through payouts and combos.

Regressions:
- crash-classify 12 m (8 seeds): 37 charged, 1 flagged "hop-like" (seed 33, rise 0.81 m, Space not held at the hit). It is not a game hop: the game's hop did not fire, or the hit would have been free. Its rise is on the 0.8 m threshold, and the bot holds altitude at 12 m ± 1.2. The verbose rerun (`crash-classify-v`) flags 1 too: seed 130, wall top 20.2 m with the drone at 15.8 m. That is a real wall 4.4 m above the drone. Near target: 5, all hits on facades (no pad lip).
- crash-classify 20 m: 32 charged, **0 hop-like**, 2 near target.
- crash-stakes 22, 58, 130: every hit charged (29.3, 28.2, 16.9 m/s): clock down 4 to 5 s within 1 s, combo x2 lost.
- arrival-metrics, all 8 seeds: 33 + 32 legs, longest final 4.3 / 4.6 s, 0 finals over 10 s, marker off screen 1.5% / 2.6%, slow and high 0.0% / 0.4%. There was 1 timeout, on seed 91. It started at t = 60 s and never came within 30 m: an end-of-clock cruise leg, as in round 5. There are fewer legs than in round 5 (43 and 39) because the arrival bot cruises at 40 m, which is now in the high wind.
- Flat-frame probe: 1,044 frames, **0 flat**.
- Frame time (long-run, seed 22, 60 s, bloom on): 7,173 frames, **median 8.30 ms, p95 9.70 ms**, max 10.4 ms, 0 over 20 ms. Same as round 5.
- `npm run build` passes. JS 699 KB (was 693 KB).

## Scripts and shots (progress/round-6/)
- `scripts/`: copies of the round 5 critic scripts. Only the output folder changed (`../shots/`). New: `route-play-rt-slip.mjs`, `route-play-slip.mjs`, `wall-speed-sweep-gap.mjs`, `wall-impact-consistency.mjs`, `wall-trace.mjs`, `headwind-check.mjs`, `slip-shots.mjs`, `long-run-perf.mjs` (round 5 builder copy).
- `shots/`: `s1-street-drafting.jpg`, `s2-street-payout.jpg`, `s3-high-wind.jpg`; raw outputs `rt-low.txt`, `rt-high.txt`, `classify-12.txt`, `classify-12-v.txt`, `classify-20.txt`, `crash-stakes.txt`, `arrival-A.txt`, `arrival-B.txt`.

## Open
- The high-wind nerf is bigger than "a little": high deliveries fell 28%. With an unchanged bot, no low-only reward could reach 0.6, because the bot sets its own speed. To soften it, lower `FLIGHT.headwindSlow` (0.25 gave a ratio of 0.59).
- The slipstream's speed and boost rewards matter more to a human than to the bot, which brakes above 19 m/s.
