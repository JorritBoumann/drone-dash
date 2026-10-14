# Drone Dash, round 7 builder: slipstream as a skill reward

## Design

The problem: the slipstream paid too little, too late, and the chain broke on every block.

1. **The street centre counts.** Draft range is now 16 m, full strength at 9.5 m. A street centre is 9 m from each facade, so normal street flight at cruise drafts at full quality. Full draft speed is now 8 m/s (was 14). Touch players and corners at 7 m/s still draft. A facade whose roof is up to 1.5 m below the drone still counts.
2. **Wall hug is the skill.** Within 5 m of a facade the meter fills faster: up to 1.7x at 2.5 m or closer. The meter glows hotter while you hug.
3. **Faster meter, quick first payout.** 0.45 meter a second at full quality. The first meter of a chain is 0.65 in size. Each chain step adds 0.1, so x4 and up need 1.05. You get a quick first payout that teaches the rule. A long chain pays more but less often.
4. **The chain survives the grid.** The meter holds 3 s out of the draft, then drains slowly (0.05 a second). The chain resets only after 6 s out of the draft (was 3 s). A charged crash still empties the meter and the chain (`Slipstream.lose()`, unchanged).
5. **Payout size.** 50, 75, 100, 125 and 150 points for x1 to x5, plus 0.5 s and 30% boost. The delivery combo no longer multiplies these points. The chain is their multiplier. Without this cap, x5 times combo ran to 4,500 a minute.
6. **Feedback.**
   - The payout pop sits next to the drone on desktop and mobile (was bottom left on desktop). It shows "+N" with "Slipstream chain xN" under it. It grows and brightens at x3, x4 and x5.
   - The chime climbs a whole tone per chain step, plays one more arpeggio note per step and gets louder. The burst and shake grow with the chain, with a second white burst at x3 and up.
   - The fill glows only while it is filling and looks dim while it waits. The chain tag glows at x3 and up.
   - The first two runs on a device show a one-line hint above the meter for 6 s: "Stay low & fast beside walls". The hint uses localStorage inside try/catch.
   - The title tagline adds "Fly low along the streets to ride the slipstream."
7. **Headwind softened from 30% to 20%.** The low line now passes the test without help from the wind. So the high line gets back part of its round 6 loss. The wind chip now shows only above 7 m/s (critic gap 1: no chip at rooftop pads).

## Files changed
- `src/game/config.ts`: SLIPSTREAM values (reach, full, hug*, roofSlack, speeds, fill, drain, grace, chainReset, points, chainStep, firstMeter, meterPerChain, seconds). `headwindSlow` changed from 0.3 to 0.2.
- `src/systems/Slipstream.ts`: hug factor, roof slack, meter size by chain, `firstPayoutAt` debug field.
- `src/systems/DeliverySystem.ts`: `addBonus(points, seconds, useCombo = true)`.
- `src/game/Game.ts`: payout feedback scales with the chain. The flat points no longer take the combo. Wind chip needs speed above 7 m/s. Hint armed at run start. Diagnostics add `slipstream.hug` and `slipstream.firstPayoutAt`. All existing hooks are kept.
- `src/ui/Hud.ts`: `setSlip` adds hug, hint timer and chain data attribute. `armSlipHint()` is new. `slipPop(points, chain)` is new.
- `src/systems/AudioSystem.ts`: `slipPayout` scales with the chain.
- `index.html`, `src/styles.css`: payout pop moved to the HUD centre. Hint line, idle and hug fill states, chain styles, title line.
- `src/vite-env.d.ts`: diagnostics type.
- Not touched: ObjectiveMarker bloom clamps, crash rules, arrival help, street-distance par.

## Numbers (dev server 5188, one browser at a time)

route-play-rt-x.mjs, seeds 22, 58 and 130, SIMT 150. These are the final runs (`rp-low-4.log`, `rp-high-4.log`):

| Line | Sim | Deliveries/min | Score/min | Crashes/min | Slip payouts/min |
|---|---|---|---|---|---|
| Low | 295 s | 1.42 | **2,644** | **0.0** | 13.4 |
| High | 420 s | **2.71** | **2,339** | 0.6 | 2.7 |

- Low/high score = **1.13** (needed 0.9). High deliveries = **2.71/min** (needed 2.3, round 6 was 2.41). Low crashes = 0.
- Tuning path, for the record:
  - First pass with points times combo: low 4,537/min (ratio 2.3, far too rich).
  - Flat points: low 2,401/min.
  - Headwind 0.2: high 2,077/min, ratio 1.12.
  - Meter size by chain and 8 m/s full speed: the final row above.

hand-fly.mjs (50 s low, then 30 s high):

| | First draft | First payout | Gap | First x2 | Max chain |
|---|---|---|---|---|---|
| Desktop | 3.8 s | 6.0 s | **2.2 s** | **8.0 s** | x5 by about 21 s |
| Mobile (touch) | 4.1 s | 7.9 s | **3.8 s** | **15.6 s** | x5 at 23.8 s |

- Before the meter-size change, mobile was 11.5 s and failed. The mobile pilot drafts at 5 to 8 m/s. At that speed the old speed factor cut quality in half.

Regressions:
- **crash-classify, 8 seeds.** 12 m: 37 charged (3.3/min), **0 hop-like**, 5 near target. 20 m: 28 charged (2.3/min), **0 hop-like**, 3 near target.
- **Verbose rerun at 12 m, 8 seeds.** All 5 near-target hits are on building faces. Their tops are 10.6 to 20.2 m. Speed 0.3 s before was 15.8 to 16.9 m/s. **0 on a pad lip.** This is the same bot overshoot as rounds 5 and 6.
- **arrival-metrics, 8 seeds.** 67 legs, 66 arrived. Median final 3.2 s. Marker off screen 1.3% and 2.0%. Slow and high 1.1% and 3.3%.
  - The 1 "timeout" is seed 91: a cruise leg cut off by the run clock. It never came within 30 m, as in round 6 builder. The rerun of seed 91 shows the same.
  - One seed 91 first leg (Fountain Park) took 15.5 s in the final, with 4 stalls on a rooftop. It did not repeat on the rerun (3.5 s median). I log it as bot variance but have not proven that.
  - "Slow and high" rose from 0.4% to 3.3% on the second seed group. That is still small, but it is up.
- **Flat-frame probe:** 1,017 frames, **0 flat**.
- **Frame time (hand-fly, 80 s).** Desktop median 8.30 ms, p95 9.10 ms, max 9.5 ms. Mobile median 8.30 ms, p95 9.20 ms. 0 frames over 20 ms. Round 6 was 8.3 ms and 9.8 ms.
- **`npm run build` passes.** JS 701 KB (was 699 KB). 0 page errors.

## Known limits
- Street flight now pays 13 payouts a minute for the bot. It is a steady drip, not a rare event. The pop size and the chime pitch carry the chain, but some players can find the pop too frequent.
- The high line also gets more payouts on descents (2.7/min), worth about 170 points a minute.
- The hint is stored per device. A cleared localStorage shows it again.

## Files in this folder
- Scripts copied from round-6/critic-scripts (output folder changed to `./critic/` only): route-play-rt-x, hand-fly, crash-classify, crash-classify-v, crash-classify-rt, arrival-metrics, acceptance-probe.
- New: `hand-fly-trace.mjs` (hand-fly plus TRACE=1 half-second meter log).
- Logs: `rp-*.log`, `hf-*.log`, `cc*.log`, `am*.log`, `ap.log`.
- Screenshots: `critic/` (d-h02 to d-h05 and m-h02 to m-h05 show the hint, meter, pop and chain).
