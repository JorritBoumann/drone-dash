# Drone Dash, round 8 builder

Concern: the slipstream paid for time spent near walls, not for flying well. A lazy pilot (centred, 10 m/s, no boost) scored the most per minute.

## Design

1. **The meter fills by distance, and speed counts twice.** Fill per second = draft quality x speed (m/s), so it is "draft metres". Draft quality = wall factor x speed factor. The speed factor is 0 below 4 m/s and full from 13 m/s. So 16 m/s fills about 4 to 7 times faster than 9 m/s on the same street, and a crawl barely fills.
2. **The street centre is no longer full strength.** The wall factor is full only within 4 m of a facade (was 9.5 m). The street centre (9 m from both facades) is about 0.7. Hugging a facade (inside 5 m, full at 2.5 m) adds up to 1.6x on top. Reach is unchanged at 16 m.
3. **A chain needs quick payouts.** The chain also resets when the next payout takes more than 9 s. A crawl cannot build x3 to x5. The chain is still lost on a charged crash, and after 6 s out of the draft.
4. **The par pause no longer rewards slowness.** The fast-drop clock only pauses while draft quality is at least 0.55, which means fast and near a facade. The lazy pilot (10 m/s, centred, about 0.47) no longer pauses it.
5. **Deliveries carry the street reward ("street multiplier").** A delivery pays +15% per slipstream chain step held at the drop (x5 = x1.75). The drop pop reads, for example, "Fast drop · street x1.6". These points count as delivery score. Diagnostics track them on their own as `slipstream.hotPoints`. I report them on their own lines below so the critic can judge the split.
6. **Payouts:** 50 points, plus 30 per chain step (x5 = 170). Meter sizes are 14 draft metres at chain 0, plus 4 per chain step. The first meter of a run is 4 draft metres (`introMeter`), so a new player gets a payout about 2 s after the first real draft.
7. **The HUD teaches the rule while you fly.**
   - Three chevrons next to "Slipstream" light up with fill speed. A crawl lights 1, the street centre at cruise 2, a wall hug or boosting 3.
   - A one-word cue above the meter names the limit: "Faster!" (near walls but too slow; this also shows the meter while you are not drafting), "Closer to wall" (fast but centred), or "Wall hug!".
   - Cues are hidden within 25 m of the pad and while the first-run hint shows.
   - The first-run hint now reads "Faster & closer to walls fills it faster". The title tagline reads "Fly fast and low, close to the walls, to ride the slipstream."
   - On mobile the cue sits on its own line above the meter, so it does not collide with the label (see m-* shots).

Not changed: flight, headwind, the high line, crash rules, arrival help, street-distance par formula, the bloom clamps in ObjectiveMarker.ts, and debug hooks. The diagnostics only add fields.

## Files changed

- src/game/config.ts: SLIPSTREAM block rewritten. New keys: `parQuality`, `chainWindow`, `introMeter`, `rateGood`, `rateTop`, `hotStep`. `holdsPar` removed. `fill` and meter sizes are now in draft metres.
- src/systems/Slipstream.ts: distance-based fill, `wall` and `speedFactor` split, `rate`, chain window, intro meter, `hotPoints`.
- src/systems/DeliverySystem.ts: `update(..., hot)` multiplies delivery points and records `lastHotPoints`. The event has a `hot` field.
- src/game/Game.ts: par hold uses `parQuality`, street multiplier at the drop, delivery pop text, HUD rate tier and cue, diagnostics fields.
- src/ui/Hud.ts: `setSlip(..., rate, cue)`, chevrons and cue element.
- index.html: chevrons, cue element, hint and tagline text. src/styles.css: chevron and cue styles.
- src/vite-env.d.ts: diagnostics type.

## Numbers (dev server 5188, one browser at a time; logs in progress/round-8/logs/)

Scripts were copied from round-7/critic-scripts to progress/round-8/scripts/. Only the output folder changed (`../builder-shots/`).

| Test | Result | Target | Pass |
|---|---|---|---|
| Lazy pilot (bp-lazy) | 907 /min (round 7: 2,783) | | |
| Standard low (rp-low) | 2,220 /min, 1.47 del/min, 0 crashes | | |
| Lazy / standard | **0.41** | at most 0.8 | yes |
| Hug probe, centre 16.3 vs 8.9 m/s | 550 vs 130 = **4.2x**, all 3 roads | at least 1.3 | yes |
| Hug probe, hug 2.5 m at 16.3 vs centre at 8.9 m/s | 1,400 vs 130 = **10.8x** | at least 2 | yes |
| High line (rp-high) | 1,883 /min, **2.45 del/min**, 0.6 crashes/min | at least 2.3 del/min | yes |
| Low / high score a minute | **1.18** | at least 0.9 | yes |
| Low crashes | 0.0 /min | at most 1.5 | yes |
| Slip points share of low score | 4,450 / 10,545 = **42%** | at most 50% | yes |
| Hand-fly desktop | first draft 4.1 s, first payout 5.4 s (**1.3 s**), x2 at 21.3 s | within 10 s, x2 by 50 s | yes |
| Hand-fly mobile (iPhone 13 landscape, touch) | first draft 3.9 s, first payout 8.7 s (**4.8 s**), x2 at 23.2 s | within 10 s, x2 by 50 s | yes |

Honest notes:
- **Street multiplier share.** Use the sim numbers below for the split: in the deterministic sim the street multiplier is about 21% of standard low score. So, for the standard low line: direct slipstream points about 41 to 42%, street multiplier on deliveries about 21%, base delivery points about 37%. Counting the multiplier as slipstream, the street share is about 62%. I counted it as delivery score, because it is paid only by delivering. The critic should judge if that counts.
- **High line numbers move between runs.** Earlier runs in this round: 2,178/min at 2.62 del/min, then 1,883/min at 2.45 del/min. The difference is noise from crashes and combo breaks. The high line's code path is unchanged; slip is 2 to 4% of high score.
- **Standard low also moves between runs.** 1,975, 2,336 and 2,220 per minute in three runs, from small payout tuning between them and run-to-run noise.
- **Hug-offset bot.** In the deterministic sim, the hug-offset bot (OFF 5.5) now beats the standard bot (2,542 vs 2,339 per minute). In round 7 it lost to the lazy pilot.

Deterministic tuning sim (builder tool, not a critic script; same control logic as balance-probe with G.advance steps), final config, seeds 22, 58, 130, SIMT 150:
lazy 792/min (slip 50%), standard 2,339/min (slip 41%, street multiplier 21%), high 2,255/min at 2.71 del/min, hug-offset 2,542/min.

## Regressions

- **crash-classify, all 8 seeds.**
  - 20 m: 26 deliveries, 27 charged (2.2/min), **0 hop-like**.
  - 12 m: 20 deliveries, 37 charged (3.4/min), **1 flagged hop-like**: seed 44 at t 27.45, 3.8 m/s, rose 0.8x m.
  - A seed 44 rerun with the same script gave 0 hop-like. A per-step trace of that crash shows a head-on hit into a facade 6 m above the drone (wallTop 16.95, drone at 11.0) at 14.5 m/s, with no ledge contact. So it is a real crash, and the rise is the bot's altitude hold. These bots steer from the camera, and payout shake now lands at different times, so runs diverge from round 7.
- **Pad lip:** I did not run the verbose crash-classify-v. In the 12 m and 20 m runs, every charged crash near the target (7 and 3) hit a facade; none was on a pad. No code near the crash or pad-edge rules changed.
- **arrival-metrics, all 8 seeds:** 68 legs, 67 arrived, 1 timeout (seed 91, the known tower case). Median final 3.2 s. Street legs: 0 stalls. Marker off screen 1.5%.
  - One outlier: seed 7, first leg (rooftop, 22.9 m), final 17.1 s with 4 stalls. Two seed 7 reruns gave 2.9 s and 3.2 s. A one-off like the 15.5 s case round 7 saw once.
- **Flat-frame probe (acceptance-probe):** 992 frames, **0 flat**.
- **`npm run build` passes.** JS 702 KB, CSS 21 KB, HTML 7 KB.
- **Frame time (hand-fly, 80 s).** Desktop median 8.30 ms, p95 9.70 ms, max 10.4 ms. Mobile median 8.30 ms, p95 9.60 ms. 0 frames over 20 ms. An earlier run this round: p95 8.9 and 9.0 ms. Round 7: median 8.3 ms, p95 9.6 ms.
- No page errors.

## Screenshots (progress/round-8/builder-shots/)

- HUD states:
  - d-/m-slow-centre: 1 chevron, "Faster!". On mobile the first-run hint is on top, so the cue is hidden.
  - d-/m-fast-centre: 2 chevrons, "Closer to wall".
  - d-/m-fast-hug: 3 chevrons, "Wall hug!", chain x4 pop.
- Hand-fly shots: d-h01..h08, m-h01..h08.
