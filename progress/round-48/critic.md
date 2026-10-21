# Round 48 critic: the shift and the tailwind rings

Verdict: **FAIL (small fix needed).** The shift answers Jorrit's complaint. But the ring burst throws a normal player into the wall at the next corner, and the crash costs more time than the ring gave. A first-time player will notice that in the first minute.

## How I tested
- Production build (`npm run build`), copied and served on port 5393. Port 5188 was not touched. No source edits.
- My own pilot (`critic/pilot48-critic.mjs`, not the builder's bot) flies in real time with real input: Playwright keyboard on desktop, CDP multi-touch on the stick and buttons on the phone. It reads diagnostics about 15 times a second and plans each leg on the street graph. It does not use `externalClock` or `__GAME__.key`.
- Pilot styles:
  - careful: brakes into corners. On long straights with a full meter, it boosts.
  - casual: a first-timer. Holds W and lets go of W for corners, but never presses S.
  - eager: boosts every straight and aims at rings.
  - slow: 11 m/s and flies above the rings.
- Round 47 baseline for frame time: `git archive HEAD` (c14d8ec), built and served on 5394.
- Files: screenshots, the JSON log per run (with a trace) and one video (`s130-careful-a.webm`) are in `critic/`.

## Runs (all real input, real time)
| run | result | time left | score / medal | rings taken | crashes |
| --- | --- | --- | --- | --- | --- |
| seed 130, careful A (video) | Shift complete | 13 s | 9,270 Gold | 10 of 13 | 3 |
| seed 130, careful B | Shift complete | 27 s | 10,653 Gold | 11 of 13 | 0 |
| seed 130, eager | Shift complete | 45 s | 12,077 Gold | 12 of 13 | 0 |
| seed 130, slow (above the rings) | Out of time, 3 of 5 | 0 | 2,976 Bronze | 0 of 7 | 0 |
| daily city, casual, fresh storage (first-run teaching) | Shift complete | 12 s | 9,267 Gold | 4 of 6 | 2 |
| random city, casual | Shift complete | 5 s | 7,328 Silver | 7 of 8 | 3 |
| random city 23085, careful, `hud=canvas` | Shift complete | 36 s | 10,112 Gold | 10 of 10 | 1 |
| phone 812x375 touch, seed 130, casual | Shift complete | 1 s | 7,150 Silver | 10 of 12 | 4 |
| phone 812x375 touch, daily, casual | Shift complete | 13 s | 8,861 Silver | 5 of 6 | 1 |
| seed 130, `hud=canvas`, no input | Out of time, 0 of 5 | 0 | 0 | 0 | 0 |

No page errors in any run. `StateloopSession.complete` was not called (on purpose). `session()` reports win, parcels and timeLeft.

## 1. Does it answer the owner?
Yes, mostly.
- **"You do your best but time runs out."** 8 of 9 flown runs won the shift. The wins include a casual first-timer on the daily city, a casual random city and both phone runs. Only the slow line, which skipped every ring, lost, and it still got 3 of 5 with a Bronze. The loss card says "3 of 5 parcels delivered" and gives a fitting tip (rings). The win card ("Shift complete", "All 5 parcels delivered with 13 s to spare", a Time left row) feels like a finish line. This is a real fix.
- **"Boost the drone sometimes."** Rings come often: 4 to 12 per run, about one every 10 to 20 s. Boost time per run went to 6 to 22 s (round 47: 1.6 to 4.3 s). The rings are very easy to see from the chase camera on desktop: bright cyan, with bloom, visible down a whole block (`s130-careful-a-ring-ahead.jpg`, `daily-casual-fresh-ring-ahead.jpg`). The minimap shows them as clear cyan bars (`zoom-minimap-rings-desktop.jpg`). So boosting does now happen "sometimes". But it is not yet something you enjoy, because of gap 2 below.
- The boost nudge works: "E or click" on desktop, "tap Boost" on phone, plus the pulsing button (`*-nudge.jpg`). It is small text at the bottom left. Fine as a hint.

## 2. The single biggest gap: the ring burst carries you into the next corner
The burst gives 1.5 s of full boost thrust. **Releasing W does not stop it** (`Drone.ts`: `thrustIn = ... || 1` during a gust). Only holding S (brake) stops it. At about 30 m/s that is about 40 to 45 m of travel. Placement only promises 18 m of straight road after a ring (`RINGS.beforeTurn`). Many rings sit 20 to 46 m before a turn, often a 40 to 50 degree turn onto a diagonal.

Evidence (the casual style: lets go of W for a corner, never brakes, which is how most people fly):
- 26 rings taken, 10 crashes, and **7 of those crashes came within 2.7 s of taking a ring**. That is 27% of rings ending in a wall. The time right after rings is under 10% of the flight but holds 70% of the crashes.
- Examples:
  - random city, t=118.9: ring, next corner 21 m ahead, speed 22.8 rising to 30.9 m/s, then a wreck at t=120.3 (26 m/s impact).
  - daily city, t=11.2: ring, corner 21 m ahead, 11 to 28 m/s, then a hard crash 1.5 s later.
  - phone, seed 130, t=42.9: ring, corner 44 m ahead, 31 m/s, then a crash 2.5 s later.
- A crash costs 3 to 5 s. A ring gives at most 2 s (less later in the run). **So a ring and then a crash loses 1 to 3 s net.** It also breaks the combo. The phone casual run finished with 1 s to spare after 4 crashes, all after rings.
- The careful and eager styles never crashed after a ring. But they brake above 18 to 21 m/s, and the brake cancels the burst. Their top speed during a burst was only 19 to 21 m/s. So with this rule, you either get the burst and hit the wall, or you brake and lose the burst.

Fix suggestion (small, one owner):
1. Make the burst follow the throttle. Push only while forward is held (`intent.thrust > 0`). End it early on a hard turn (for example, 0.2 s of turn input above cruise speed). Then letting go of W in a corner works the way players expect.
2. Raise `RINGS.beforeTurn` from 18 m to about 40 m, so a held burst ends before the corner. Or shorten `burst` to about 1.0 s.
3. Test: rerun `pilot48-critic.mjs` with the casual style on seed 130, the daily city and one random city (desktop and phone). Target: under 1 crash in 10 rings within 2.7 s after the ring.

## 3. Bugs and regressions (ranked)
1. **Ring burst into corners (above).** Steps: any city, casual flying. Take a ring that is 20 to 45 m before a turn, let go of W and steer into the turn. The drone keeps boosting into the far wall. Seen in 4 of 4 casual runs.
2. **Phone: the HUD chips hide the ring at mid distance.** At 812x375, a ring 30 to 60 m ahead sits behind two chips: the objective pill and "FAST LANE" (`phone-daily-casual-ring-ahead.jpg`). The ring hangs at 6.5 m, level with the chips. Closer in, the ring shows again. Suggestion: on short screens, fade the two chips while a ring is behind them. Another option is to frame phone rings a little lower.
3. **A good line has too much clock (design, not a blocker).** Eager on seed 130 had 45 s left. Careful on a random city had 36 s left. In the eager run the clock went **up** from leg to leg: 59.8, 61.8 and 63.6 s left after drops 1 to 3. For a skilled player, the clock is no threat until the last leg. Jorrit asked for easier, so keep it for now. To get tension back later, shrink the ring clock late in the shift (for example, 0 s after parcel 3). Do not cut the start time.
4. **Frame time: within noise, maybe a little higher in rush hour.** I measured both builds on the same machine in the same session. Settings: seed 22, uncapped, 2 runs each. The table gives p95 in ms. The machine was busier than in round 47 (round 47 itself measured 10 to 12 ms on desktop today, vs the 8 ms recorded then).

   | case | round 47 | round 48 |
   | --- | --- | --- |
   | desktop normal | 10.1 / 10.5 | 11.3 / 10.4 |
   | desktop rush | 12.3 / 11.3 | 13.9 / 13.7 |
   | phone normal | 7.3 / 6.2 | 8.2 / 7.5 |
   | phone rush | 6.2 / 5.5 | 6.2 / 7.0 |

   Medians are the same (4.7 to 5.0 ms desktop, 2.7 to 3.2 ms phone). Draw calls are +2 (116 max). Not a blocker. Recheck desktop rush on a quiet machine. Seed 130 desktop normal p95 was 11.4 and 13.8 ms.
5. **Minor: the "Flew" time on a win can be 1 s off.** It uses the whole seconds left (`clockLeft`). It does not use the exact time. Cosmetic.

Not bugs (checked):
- The HUD pips fill correctly in both HUDs (`*-hud-2of5.jpg`, `*-hud-4of5.jpg`, `canvas-random-careful-hud-2of5.jpg`). They are small on desktop, and the "2/5" chip carries the meaning.
- The loss card with 0, 3 and 4 of 5 shows the right tip. The canvas HUD mode uses the same results card.
- Medals and v2 keys: Bronze to Gold reached by these runs, and Ace is just above the best run (12,077 vs 12,500). That feels right.
- One test-setup note: when I ran 2 or 3 pilots in parallel, the control loop starved and runs failed. I threw those runs away and reran every run alone. It was not a game problem.

## 4. Verdict
**FAIL, small fix.** The shift, the win and loss cards, the pips, the minimap rings and the nudge all work, and casual players now win. But the main new boost mechanic punishes the very player this round is for: about 1 in 4 rings ends in a wall and costs more time than it gave. Make the burst follow the throttle and give rings about 40 m of road after them, then rerun the casual pilot. With that fix, I expect this round to pass.

## Re-check after the fix pass

Verdict: **PASS for pushing round 48.** The ring no longer throws you into the wall. One tuning gap remains (the burst is cut too easily on keyboard). It is not a blocker.

### How I tested
- A fresh critic. I did not build it. No source edits.
- Production build from `npm run build`, served from a copy of `dist` on port 5395. Port 5188 was not touched.
- Pilot: `recheck/pilot48-recheck.mjs`, a copy of the first critic's pilot. Real-time Playwright keyboard on desktop, CDP touch on the phone (812x375). Runs went one at a time.
- New style "eagerhold": it never brakes, aims at rings, and holds W on the ring approach and for 3 s after the ring, even into the next corner. It still steers.
- Probe: `recheck/burst-probe.mjs` flies the first ring on seed 130 at 16.8 m/s with real keys, 2 repeats per variant.
- Logs, JSON and screenshots are in `recheck/`. The summary script is `recheck/sum-recheck.py`.

### 1. Crashes after a ring
A crash counts if it comes within 3 s after a ring.

| run | result | time left | rings | crashes | within 3 s of a ring |
| --- | --- | --- | --- | --- | --- |
| seed 130, casual | Shift complete, Gold | 44 s | 11 of 13 | 0 | 0 |
| daily, casual | Shift complete, Gold | 17 s | 8 of 8 | 1 | 0 |
| phone seed 130, casual | Shift complete, Gold | 34 s | 13 of 13 | 0 | 0 |
| seed 130, careful | Shift complete, Gold | 29 s | 12 of 13 | 0 | 0 |
| daily, careful | Shift complete, Silver | 7 s | 3 of 7 | 1 | 0 |
| seed 130, eager (holds W) | Shift complete, Gold | 44 s | 9 of 13 | 1 | 1 |
| daily, eager (holds W) | Shift complete, Silver | 16 s | 5 of 8 | 3 | 0 (see note) |
| phone daily, eager (holds W) | Out of time, 4 of 5 | 0 | 2 of 7 | 0 | 0 |
| seed 130, slow (above the rings) | Out of time, 3 of 5 | 0 | 0 of 9 | 0 | 0 |

- Casual: 0 crashes in 32 rings. Careful: 0 in 15 rings. Both pass the bar (fewer than 1 in 10). The first critic saw 7 in 26 for casual.
- Eager: 1 crash in 16 rings. It came 0.55 s after the first ring of seed 130. The pilot had swung off its line to take that ring, and it hit a wall at 20 m/s while holding W. The burst had already ended (the turn cut). Without the ring it would likely have hit the same wall at 17 m/s. That feels fair: the player chose to hold W while off line.
- Note: one daily eager crash at 116.5 s came 0.5 s after the last drop, while landing during the finish. It does not count.
- The daily city today (Wed 21 Oct) is tight: careful won with 7 s left, and the phone eager run lost 4 of 5 with 0 crashes. This is the city and the slower touch pilot, not the rings.
- No page errors in any run.

### 2. Is the burst still a treat?
- Straight line, W held: 16.8 to 27.8 m/s (+11 m/s), the full 1.0 s. Same in both repeats. That is a real treat, close to the builder's 27.3.
- Let go of W at the ring: peak 17.0 m/s (+0.2). The burst does not push. This is the fix working.
- **Remaining gap: a short keyboard correction ends the burst.** Keyboard steering is all or nothing (turn = 1). So any A or D held for 0.25 s at speed counts as a "hard turn". In the probe, a 0.3 s D tap ended the burst at 0.36 s and the peak fell to 23 m/s (+6). A 0.15 s tap did not end it.
- In the eagerhold runs, 11 of 16 bursts ended by 0.43 s, long before any corner (the corners were 33 to 78 m away). Only 1 of 16 ran the full 1.0 s. The median gain was 4.6 m/s.
- So the treat is full on a clean line and about half after a normal lane correction. A player cannot see why. Suggestion for the next round: count the turn cut only when the heading has changed a lot (for example 25 degrees since the ring), or raise `FLIGHT.gustTurnCut` to about 0.5 s. Do not undo the throttle rule.
- Casual and careful pilots let go of W near 17 m/s, so their gain is about 1 m/s. That is the intended trade.

### 3. Phone 812x375
- A ring ahead is easy to see. In `phone-s130-casual-ring-ahead.jpg` it sits below and right of the chips.
- The chips fade when a ring is behind them (`phone-*-see-on-*.jpg`). They come back after the ring passes.
- Seed 130 casual: 16 fades, all at least 0.5 s long, no quick re-fade. Clean.
- Daily eager: 12 fades. 5 lasted only 0.3 to 0.37 s, and twice the chips came back for 0.5 s and then faded again. That is a mild blink while a close ring (10 to 26 m) moves at the chip edge.
- **Small bug: the objective pill snaps back to full opacity with no fade.** The 0.2 s transition sits only on `.see-through`, so it applies on the way down but not on the way up. Probe: opacity is 1.0 already 0 ms after the class is removed. The route chip fades back smoothly (it has its own transition). Fix: put `transition: opacity 0.2s` on `.objective` itself, and maybe hold the fade for 0.4 s after the last hit. Not a blocker.
- Desktop: one single 0.17 s fade in a whole seed 130 run. Fine.

### 4. Win and loss screens
- Win (`s130-casual-end.jpg`): "Shift complete", Gold 12,070, "All 5 parcels delivered with 44 s to spare". "Flew 2:03" matches 50 + 63 + 34.4 + 20 minus 44.5 s left. Correct.
- Loss (`s130-slow-loss-end.jpg`): "Out of time", Bronze, "3 of 5 parcels delivered" with the ring tip, a "Last leg 56%" row. "Flew 1:33" matches 50 + 33 + 10.4. Correct.
- Phone loss (`phone-daily-eager-end.jpg`): the two-column card fits. "4 of 5 parcels delivered, so close!" and a ring tip. Correct.

### 5. Frame time (p95 in ms, seed 22, uncapped, 2 runs each)
The machine was quieter than for the first critic. So I also rebuilt round 47 (c14d8ec) and measured it on the same port right after.

| case | first critic, r48 | re-check, r48 | re-check, r47 |
| --- | --- | --- | --- |
| desktop normal | 11.3 / 10.4 | 7.0 / 6.8 | 7.0 / 7.5 |
| desktop rush | 13.9 / 13.7 | 6.4 / 6.3 | 6.3 / 6.4 |
| phone normal | 8.2 / 7.5 | 6.3 / 6.1 | 6.0 / 6.0 |
| phone rush | 6.2 / 7.0 | 5.5 / 5.6 | 5.2 / 5.2 |

- The desktop rush worry from the first critic was machine load. Round 48 and 47 are now equal on desktop.
- The phone is up about 0.3 ms. Within noise. Draw calls are up by 2 (116 max), as before.
- Logs: `recheck/perf-r48.log`, `recheck/perf-r47.log`.

### Summary
- Pass: 0 ring crashes in 47 casual and careful rings, and 1 fair crash in 16 eager rings.
- Next round, top item: the keyboard turn cut ends most held bursts after 0.3 s.
- Small fix: the objective pill pops back instead of fading back.
