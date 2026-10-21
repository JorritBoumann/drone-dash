# Round 48 builder: a shift you can win, and speed bursts

Jorrit said two things. Time always runs out, so a run never feels won. And he wants to boost more often.
This round gives each run a finish line, puts free boost rings in the streets, and makes the boost meter easier to notice.

## The diagnosis holds

I checked the lead's diagnosis on the round 47 code. It is right.
- Every run ended in "Time's up". A run ended only when the clock ran out.
- With the round 47 code, all 32 bot runs (4 lines on 8 cities) ended on the clock. Even the best line ran out of time after 6 to 9 parcels.
- The good bot pressed boost for only 1.6 to 4.3 s per run.

## What changed

### A. The shift (a run you can win)
- A run is now a shift of **5 parcels** (`SHIFT.parcels` in `src/game/config.ts`).
- Delivering the fifth parcel wins the run. The card says "Shift complete". Each whole second left pays **40 points** (`SHIFT.pointsPerSecond`). The combo does not multiply it.
- If the clock runs out first, the run is lost. The card says "Out of time" and how far the shift got, for example "4 of 5 parcels delivered, so close!". It adds one tip: fly through the rings, boost on straights, crash less, or draft the walls. The tip depends on what the run missed.
- Overtime still works. If the overtime drop is the fifth parcel, the shift is won with 0 s left.
- The clock now starts at **50 s** (was 56). Last call is unchanged. It gives a short final drop when little time is left, and it keeps close runs alive.
- HUD: five small parcel pips sit in the timer pill and fill in teal as you deliver. The right chip shows "2/5". The canvas HUD (`?hud=canvas`) draws the same pips in its clock panel. Its results card shows "SHIFT COMPLETE" or "OUT OF TIME" and the shift line.
- A win plays the rising end tune, even with no medal. A "Shift complete!" banner shows for 2.4 s before the card.
- Daily and seeded cities stay fair. The rings use no random numbers, and the parcel order is unchanged.

### B. Tailwind rings
- `src/entities/TailwindRings.ts`: up to 4 glowing cyan rings per leg. They sit 6.5 m up, over straight road or boulevard stretches of the leg's suggested street route. They are never placed in alleys or tunnels.
- Placement (`RINGS` in config): about one ring per 50 m of route, 2 to 4 per leg. No ring within 26 m of the leg start or 45 m of the pad. At least 34 m between rings. At least 10 m of straight road before a ring and 18 m after it. Each spot is checked for solid boxes along 8 m of the ring's axis.
- Flying through a ring gives 1.5 s of free boost. It uses the normal boost speed, camera FOV, burner sound and trail, but not the meter. It also adds +2 s to the clock, shrinking with the run like the drop bonus. A short chime plays and the timer shows "+2s". Missing a ring costs nothing.
- A boost from a ring never pushes against a held brake.
- Drawn as one InstancedMesh (one draw call, about 2,000 triangles). The parts are a hoop, an inner hoop, a faint halo and six wind streaks. It is bright enough to bloom on desktop and still reads on phones without bloom. It is not a collider.
- The minimap shows each ring as a small cyan bar across the street.

### C. Boost you notice
- `FLIGHT.boostRegen` 0.16 to **0.25** per s and `boostRegenDelay` 0.9 to **0.6** s. An empty meter is full again in 4.6 s (was 7.2 s).
- The nudge starts when the meter is full and unused for 8 s. The boost bar pulses three times and shows "E or click" next to "BOOST". On phones it shows "tap Boost" and the Boost button pulses too. This repeats every 20 s while the meter stays unused. There are no new banners, so the first run keeps the round 39 rule.

### Medals and saved bests
- A shift caps a run at 5 parcels. Old scores came from runs of up to 9 parcels, so the medal table is new.
- Bronze 1000 (was 1000), Silver 4000 (was 2400), Gold 9000 (was 6000), Ace 12500 (was 15000).
- Bot results: slow line 1,250 to 2,800 (Bronze). Casual win 6,200 to 9,600 (mostly Silver). Good line 9,500 to 11,400 (Gold), but 6,478 on the daily city. Best bot run 11,496, so Ace is above every bot run.
- The storage keys for best score, best medal and daily best moved to `-v2`. No shift can beat the old bests from the endless runs (up to about 18,000). The played flag is kept, so returning players still skip the first-run teaching.

### Stateloop: a conflict with the brief
The brief asked to keep `window.StateloopSession.complete(detail)` firing once per run. But the last commit (c14d8ec, "Round 48: stop ending the Stateloop session after each run") removed that call on purpose. The portal closed the game on it, before the results card. **I did not put the call back.** `win`, `parcels` and `timeLeft` were added to the session detail that `__GAME__.session()` returns. The lead and Jorrit must decide this. Putting the call back is one line in `endRun`, but then the portal closes the game again.

## Numbers (bot measurements)

Method: `progress/round-48/builder-scripts/shiftbot48.js` is a deterministic pilot inside the page (`externalClock` plus `advance`, keys through `__GAME__.key`). The same city and line always give the same run. `shift48.mjs` and `matrix48.sh` run it. Round 47 numbers come from a copy of HEAD (c14d8ec, `git archive`) on port 5392. Cities: 22, 58, 130, the daily city of 2026-10-20 (seed 50488), 7, 91, 11 and 300. Raw logs: `before-bots.log`, `after-bots.log`.

The four lines:
- **slow**: plain street grid, 12 m/s, pauses, ignores rings. This is the round 48 first casual draft, kept as a floor.
- **casual**: the suggested street route at 13 m/s, never presses boost, a 2 s pause every 20 s, takes rings that are on its line.
- **good**: shortest route at 16 m/s, boosts on straights.
- **perfect**: corners at 9 m/s, boosts on any straight, steers through rings.

Before (round 47): every run was lost on the clock.

| line | parcels before time ran out (8 cities) | 5th parcel at |
| --- | --- | --- |
| slow | 2 to 3 | never |
| casual | 3 to 5 (5 on 2 cities) | 146 s, 129 s |
| good | 5 to 7 | 122 to 135 s |
| perfect | 6 to 9 | 116 to 124 s |

After: seconds left at the end of a won shift. "L" means lost, with the parcel count.

| city | slow | casual | good | perfect |
| --- | --- | --- | --- | --- |
| 22 | L 2/5 | 6.6 | 34.1 | 35.8 |
| 58 | L 2/5 | 5.4 | 28.1 | 35.0 |
| 130 | L 2/5 | 13.8 | 31.9 | 40.5 |
| daily | L 3/5 | 2.4 | 1.4 (2 crashes) | 13.9 |
| 7 | L 2/5 | 4.1 | 17.8 | 23.6 |
| 91 | L 2/5 | 3.0 | 19.0 | 27.0 |
| 11 | L 2/5 | L 3/5 (bot got stuck 3 times) | 25.5 | 28.2 |
| 300 | L 2/5 | 0.6 | 24.0 | 26.1 |

- **casual** wins 7 of 8 cities, mostly with 0.6 to 6.6 s left. The loss on city 11 is partly the bot getting stuck.
- **good** has a median of about 24.8 s to spare. 4 cities fall in the 10 to 25 s target. 3 are above it (28 to 34 s). The daily city is close (1.4 s, with 2 crashes).
- **perfect** finishes in 121 to 129 s, with 14 to 41 s left. That is not absurdly early. Its fifth parcel used to land at 116 to 124 s.
- Rings: casual took 3 to 13 per run (+5.6 to +23.5 s). Good took 3 to 12 (+5.8 to +21.6 s).
- Boost: good now boosts 7.5 to 20 s per run (rings plus meter), up from 1.6 to 4.3 s.

The start time is a sensitive dial because of last call. Tested start times, with casual wins out of 8 and the good line's seconds to spare:

| start time | casual wins | good line spare |
| --- | --- | --- |
| 46 s | 2 of 8 | 6.9 to 30 s |
| 49 s | 4 of 8 | 0.4 to 33 s, median about 24 |
| 50 s (chosen) | 7 of 8 | see the table above |
| 52 s | 7 of 8 | |
| 56 s | 7 of 8 | median about 31 |

I chose 50 rather than 49 for one reason. Bots fly cleaner than people, and Jorrit's complaint was that the game is too hard. If the critic wants half of casual runs to lose, 49 is the measured setting (logs `m-s49.log`, `m-s46.log`, `m-s52.log`, `m-cur.log`).

## Budgets and checks
- `npx tsc --noEmit` passes. `npm run build` passes with no chunk warnings. dist without source maps is 3.66 MB.
- Frame time (`perf48.mjs`, uncapped, street level, 12 s normal then 12 s rush). The machine was noisy this session, so I took the best of 2 to 5 A/B runs for each case:
  - desktop normal p95: 8.2 ms before, 7.9 ms after
  - desktop rush p95: 7.3 ms before, 7.1 ms after
  - phone (iPhone 13, held sideways) normal p95: 6.0 ms before, 6.1 ms after
  - phone rush p95: 5.6 ms before, 5.5 ms after
  - Draw calls are up by 2 at most (111 vs 109). Some single runs of both builds had p95 values of 10 to 28 ms from background load (`perf48.log`).
- Platform build (`platform48.mjs`, dist from a nested path inside a cross-origin iframe):
  - Nothing is drawn in the 64 px top-left corner.
  - Escape still reaches the portal. Single Escape pauses and nothing swallows it.
  - Seeds match the dev server.
  - No requests fail, and `StateloopSession.complete` is called 0 times (as in c14d8ec).
- Screenshots are in `progress/round-48/shots/`, for desktop and phone, with both the HTML and the canvas HUD:
  - `hud-*`: shift pips 2/5 and a ring ahead on a boulevard
  - `win-*`: the "Shift complete" card
  - `loss-*`: "Out of time, 2 of 5" with a tip
  - `nudge-*`: the boost bar pulsing with "E or click"
- README: the goal and the boost row are updated. Controls are unchanged. No assets were added.

## Open risks
- The Stateloop `complete` call. See above. It needs a decision.
- The bots fly cleaner than people. A real casual player probably loses more often than 1 in 8. The loss card's tip and the rings are meant to close that gap.
- The good line lands above 25 s spare on 3 of 8 cities. A ring clock of 1.5 s trims that, but then casual loses more often.
- The daily city of 2026-10-20 is tight for every line, because of its rooftop legs and crashes. Daily cities change every day.
- The shift's scores are a new table, so old bests are not shown any more (they stay under the v1 keys).
- The ring burst is forward thrust at boost speed. A player who turns hard right after a ring can still hit a wall. Rings keep 18 m of straight road ahead, but this is not tested by hand.

## Fix pass

The critic failed the round on one gap. A ring's burst threw a normal player into the wall at the next corner. Codex found two small bugs.

### What changed
- **The burst follows the throttle** (`Drone.ts`). It pushes only while forward is held. A hard turn at speed (0.25 s of full turn input, `FLIGHT.gustTurnCut`) ends it. Letting go of W after a ring now works the same as without a ring.
- **A shorter burst, more road after a ring.** `RINGS.burst` 1.5 to 1.0 s (about 25 m at boost speed). `RINGS.beforeTurn` 18 to 26 m.
- **Phone chips over a ring.** Six times a second the game projects each live ring within 90 m to the screen. If a ring overlaps the objective pill or the route chip ("FAST LANE"), both fade to 22% opacity. The canvas HUD pill fades too.
- **`Game.dispose()`** now calls `this.rings.dispose()`.
- **The "Flew" time on a win** uses the exact seconds left (`tally.clockExact`), not the floored whole seconds.
- The start time stays at 50 s and the ring clock gain at +2 s. `StateloopSession.complete` is still not called.

### Choosing the burst and the road after a ring
I measured placement with the deterministic bot (good and casual lines, 8 cities each, `fixpass/place-*.log`). The new throttle rule was already in.

| setting | rings per leg | casual wins of 8 |
| --- | --- | --- |
| burst 1.5 s, 18 m (old) | 0.96 | 6 |
| burst 1.5 s, 40 m | 0.68 | 4 |
| burst 1.5 s, 34 m | 0.86 | 6 |
| burst 1.2 s, 30 m | 0.86 | 5 |
| burst 1.0 s, 26 m (chosen) | 0.89 | 5 |

A 40 m margin removes almost a third of the rings. A 1.0 s burst with 26 m keeps nearly all of them. No setting reaches 2 rings on every leg. Short pickup legs (45 to 105 m) often have no straight stretch that is 26 m from the start and 45 m from the pad. The average was already about 1 ring per leg before this pass.

### Ring crashes, before and after
Test: the critic's casual pilot, copied as `builder-scripts/pilot48-fix.mjs`, with only the port and output folder changed. It uses real-time keyboard input on desktop and real touch on the phone (812x375). Runs went one at a time against a production build. The "before" build was the round 48 dist before this pass. Logs are in `fixpass/` (`pre-*.json`, `post-*.json`, `pre.log`, `post.log`). Count: `builder-scripts/ringcrash48.py`.

| run | before: rings / crashes within 3 s / time left | after: rings / crashes within 3 s / time left |
| --- | --- | --- |
| seed 130, desktop | 9 / 1 / 49 s | 12 / 0 / 44 s |
| daily city 2026-10-20, desktop | 5 / 0 / 35 s | 4 / 0 / 23 s |
| seed 23085, desktop | 8 / 0 / 54 s | 10 / 0 / 46 s |
| daily city, phone | 5 / 0 / 16 s | 3 / 0 / 5 s |
| seed 130, phone | 10 / 2 / 7 s | 13 / 0 / 32 s |
| **total** | **37 rings, 3 crashes (0.8 per 10)** | **42 rings, 0 crashes (0 per 10)** |

- With the critic's own logs added (26 rings, 7 crashes within 2.7 s), the before total is 63 rings and 10 crashes: 1.6 per 10 rings.
- After: 0 crashes of any kind in the 5 casual runs. All 5 won the shift.
- The target was fewer than 1 crash per 10 rings. It is met on 5 runs, including seed 130 and the daily city, on desktop and phone.
- My "before" runs crashed less than the critic's. Real-time runs vary with machine load, so the pooled before number is the fairer one.

### The burst still works when you hold W
- `builder-scripts/ringpass48.mjs` flies the first ring on seed 130 with W held the whole way, using the game's fixed step.
- Speed goes from 16.8 m/s before the ring to a peak of 27.3 m/s, with the boost trail, wider view and burner sound. It eases back to 17 m/s about 1.5 s later.
- Screenshots: `fixpass/ring-pass-desktop.jpg` and `fixpass/ring-pass-phone.jpg`.
- The critic's pilots let go of W once they pass 17 m/s, so they no longer feel the burst. Their peak after a ring fell from about 30 m/s to about 18 m/s. That is the intended trade: the burst is there for a player who holds forward, and it never pushes one who lets go.

### Phone chips
- `ring-seethrough-phone.jpg` was taken on the same ring pass at 812x375. It shows the pill and the route chip faded while the ring is 44 m ahead behind them.
- The chips stayed faded for 15 of the approach frames. On desktop, where the ring rarely sits behind the chips, it was 1 frame.
- `ring-ahead-*.jpg` and `ring-seethrough-desktop.jpg` are extra views from the same pass.

### Checks
- `npx tsc --noEmit` passes.
- `npm run build` passes with no chunk warnings.
- Port 5188 was never touched. My servers on 5391, 5392, 5396 and 5397 are stopped.

### Open points
- A player who holds W into a corner right after a ring still meets the corner at speed. The 26 m margin and the turn cut cover most of this, but it is not tested by hand.
- Rings per leg average about 0.9, not 2 to 4. Short pickup legs rarely have room for one.
- A good line still finishes with a lot of time left (the critic saw 36 to 45 s). That is unchanged on purpose, because Jorrit asked for an easier game.
