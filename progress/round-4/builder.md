# Drone Dash, round 4 builder report: crash stakes

## Design

A crash is measured by the speed it takes off the drone (horizontal m/s), summed over the first 0.2 s of one collision. That is the same thing the player feels and the same thing the critic measures.

| Speed lost in one hit | Name | Cost |
|---|---|---|
| under 7 m/s | scrape | free (old spark + thud only) |
| 7 to 16 m/s | Crash | -3 s, combo broken |
| 16 to 26 m/s | Hard crash | -4 s, combo broken |
| 26 m/s and up | Wreck | -5 s, combo broken |

Why this set:
- **Time plus combo, nothing else.** Time is the run's only life bar, so it always matters, even with no combo. The combo break is the sharp extra cost for players who are on a streak. Both are already on screen, so no new meter is needed. I left out parcel damage to keep it to one rule the player can learn.
- **Fair.** One charge per collision: follow-up contacts within 1.2 s only top up to a harder tier, so being pinned against a wall does not drain the clock. A slow slide along a parapet never adds up to a crash (only the first 0.2 s counts). A crash never takes the clock below 1 s, so a crash alone never ends the run.
- **Arrival work stays free.** The guide pull, ledge hop and braking near a pad move at low speed and lose well under 7 m/s. A ledge hop now reports its impact. A full-speed boost into a parapet stops the drone dead, so it is a crash. The gentle hop over a parapet is still free.
- **Readable in the moment.**
  - HUD: a "Hard crash!" pop in coral with "-4 SEC · X2.0 COMBO LOST" under it. A large coral "-4s" drops out beside the timer, and the timer shudders with a coral flash. The combo chip turns coral, keeps the lost multiplier, is struck through, then tips and falls away.
  - VFX: a heavier red vignette (0.45 s) and orange and white spark bursts sized by severity. The camera shakes harder, the hit-stop is a little longer (0.10 to 0.16 s), and the drone tumbles for one second. The parcel swings hard and the status bar blinks red.
  - Audio: a deep crunch (low sine thud plus filtered noise) and a falling two-note "lost it" cue. When a combo breaks, the cue is pitched lower.
- Art direction: the existing palette tokens (coral, ink, cream) and the existing stroke-text pop style.

## Files changed

- `src/game/config.ts`: new `CRASH` block (threshold, tiers, window, chain gap, hit span, clock floor).
- `src/systems/DeliverySystem.ts`: `penalize(seconds, floor, breakCombo)`.
- `src/game/Game.ts`: `checkCrash` (speed-loss measurement, tiers, one charge per collision) and `crashFeedback`. Diagnostics now include `crashes` (a run counter). Existing fields are unchanged, so the bot hooks still work.
- `src/entities/Drone.ts`: `FlightEvents.ledge` (impact absorbed by a ledge hop), `crash()` visual tumble, cargo jolt and red status blink. Flight physics are unchanged.
- `src/ui/Hud.ts`: `flashTimePenalty`, `breakCombo`, heavy `hitFlash`, `crash` pop kind.
- `src/systems/AudioSystem.ts`: `crash()`.
- `src/styles.css`, `index.html`: `#time-penalty`, timer hit shudder, broken combo chip, crash pop, heavy vignette.
- `src/vite-env.d.ts`: an optional `crashes` field in the diagnostics type.
- `src/entities/ObjectiveMarker.ts`: not touched (bloom clamps intact).

## Acceptance numbers

The scripts are copied to `progress/round-4/scripts/`. The logic is unchanged. Only the screenshot folder now points to `progress/round-4/shots/`. `scrape-check.mjs` is my own extra check.

**crash-stakes.mjs (seeds 22, 58, 130), final run:**

| Seed | Before | 1 s after | Cost |
|---|---|---|---|
| 22 | 28.6 m/s, 33.0 s, combo 2 | 5.8 m/s, 28.8 s, combo 0 | 3.0 s extra off the clock, combo lost |
| 58 | 12.3 m/s, 31.9 s, combo 2 | 1.8 m/s, 26.7 s, combo 0 | 4.0 s extra, combo lost |
| 130 | 21.0 m/s, 35.8 s, combo 0* | 1.1 m/s, 31.5 s | 3.1 s extra |

\*On seed 130 the bot crashed once on the way down to 10 m, so the combo was already broken. Earlier runs: on seed 22, hits at 31.5 and 36 m/s cost 4 s plus the combo. On seed 130, hits at 16 to 17 m/s cost 3 s plus the combo. The 1 s "after" values include 1 s of normal drain.

**Scrapes (scrape-check.mjs, 90 s autopilot on seeds 22, 58, 130):** 126 sampled drops were under 6 m/s. None of them cost anything: no crash, no combo change, no extra time, no score change. 1 drop was over 8 m/s, and it cost 3 s and the combo.

**arrival-metrics.mjs:**

| Run | Legs | Timeouts | Longest final | Sum final / cruise | Off screen | Slow and high |
|---|---|---|---|---|---|---|
| 11, 22, 33, 44 (run 1) | 41 | 0 | not recorded | 136.5 / 198.9 | 1.0% | 3.5% |
| 11, 22, 33, 44 (run 2) | 45 | 0 | **16.6 s** | 152.7 / 214.6 | 3.7% | 1.9% |
| 7, 58, 91, 130 | 44 | 0 | 4.3 s | 136.0 / 223.5 | 1.0% | 0.2% |
| 11 x3 (re-check) | 33 | 0 | Willow Lofts leg 3.6, 3.6, 4.0 s | 109.2 / 155.2 | 0.6% | 4.2% |

Honest note: run 2 had one 16.6 s final approach (seed 11, Willow Lofts Rooftop, 4 bot stalls and 3 bumps). That breaks the "no final over 10 s" line for that run. I re-ran seed 11 three times, and the same leg took 3.6 to 4.0 s with 0 stalls. Flight physics did not change this round, so I read it as bot variance at that rooftop, but I cannot prove it. Run 1 printed only the summary lines, so its longest final was not recorded.

**Flat-frame probe (acceptance-probe.mjs):** 866 frames, 0 flat. Bloom on.

**Frame time (long-run.mjs, 3 min per seed, 1280x720, bloom on):** seed 22: median 8.30 ms, p95 9.70 ms, max 10.4 ms. Seed 58: median 8.30 ms, p95 9.80 ms, max 10.4 ms. 0 frames over 20 ms. Round 3 was median 8.3 ms, p95 9.8 ms.

**Build:** `npm run build` passes.

Screenshots: `progress/round-4/shots/X-seed22-crash.png`, `X-seed58-crash.png`, `X-seed130-crash.png`.
