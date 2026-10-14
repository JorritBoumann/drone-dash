# Drone Dash, round 9 critic report

**Verdict:** Medals work. Every run now has a target, a verdict and an honest breakdown, and the round 8 mobile miss is fixed. Nothing regressed. The biggest gap is now audio: the game has no music at all. That is the clearest thing separating it from a polished arcade game.

## Round 8 gap (nothing to play for beyond one number): closed

Scripts are copied to `critic-scripts/`. Output folders are relative (`../critic/`), so no path edits were needed. To read medals I made two log-only copies: `route-play-rt-x-m.mjs` and `balance-probe-m.mjs`. Their control logic is the same as the `-h` scripts. They also log medal passes, the breakdown and the game-over DOM. They count the medal fanfare with a hook on oscillator starts. They save the HUD goal text and a screenshot 0.9 s after each pass. Runs used seeds 22, 58 and 130, with SIMT 400 so every run ended on its own clock. Every run reached game over (none was cut short). Real-time scripts ran one at a time.

Medal lines: Bronze 1,000, Silver 2,250, Gold 4,500, Ace 7,500.

| Pilot | Seed 22 | Seed 58 | Seed 130 | Needed | Result |
|---|---|---|---|---|---|
| Lazy (centre, 10 m/s, no boost) | 1,728 Bronze | 696 none | 1,186 Bronze | tier 1 at most | Pass |
| Standard low | 3,658 Silver | 1,722 Bronze | 2,682 Silver | Silver in 2 of 3 | Pass (2 of 3) |
| High line, 40 m | 4,052 Silver | 4,123 Silver | 5,466 Gold | Silver in 2 of 3 | Pass (3 of 3) |
| Any bot at Ace | | | | none | Pass (best 5,466) |

- **Tiers visible.** The title shows all four medals and their scores, desktop and iPhone 13 held sideways (`d-j22-h01-title`, `m-j22-h01-title`). Won medals light up after a run, and the best line reads "BEST 3,658 SILVER" (`d-j22-h13-title-after`). The HUD shows the next medal and its score under the score, for example "BRONZE 1,000", plus a progress bar (`d-j22-h09-goal-hud`). Game over shows the medal, the score and "842 more for Gold" (`d-j22-h11-over`, `m-j22-h11-over`).
- **Breakdown adds up.** Deliveries + fast drops + combo + slipstream equals the final score in 12 of 12 runs: 9 bot runs, 2 medal journeys and the default-city journey. This was checked in diagnostics and in the game-over DOM. The "Flew 1:48" line also adds up (start + drops + slipstream − crashes).
- **Pass is a moment.** Each pass shows a big medal banner with rays, "Next: Gold 4,500", a sparkle burst and a small shake. It plays a three-note fanfare. Diagnostics count it. In all 9 bot runs the fanfares heard equal the passes counted (lazy 1/0/1, low 2/1/2, high 2/2/3). The AudioContext was running. A pass fired in 3 of 3 standard low runs.
- **Saved best.** Best score and best medal survive a reload.

## Scoring checks (round 7 set)

| Check | Needed | Round 8 | Round 9 | Result |
|---|---|---|---|---|
| Lazy / standard low, score a minute | ≤ 0.8 | 0.39 | **0.57** (963 / 1,697) | Pass |
| Centre 16.3 m/s / centre 8.9 m/s slip points | ≥ 1.3 | 4.2 | **4.1** (475 / 115) | Pass |
| Hug 2.5 m at 16.3 m/s / centre 8.9 m/s | ≥ 2 | 10.8 | **10.4** (1,200 / 115), same on 3 roads | Pass |
| Low / high, score a minute | (0.9 old target) | 1.05 | **0.85** (1,697 / 2,001) | See below |
| High deliveries a minute | ≥ 2.3 | 2.50 | **2.49** | Pass |
| Low crashes a minute | ≤ 1.5 | 0 | **0** | Pass |
| Desktop: first payout after first draft / chain x2 | 10 s / 50 s | 1.1 / 20.5 | **1.4 s / 21.1 s** | Pass |
| Mobile: first payout after first draft / chain x2 | 10 s / 50 s | 11.0 / 19.1 (fail) | **3.7 s / 24.0 s**, rerun **4.2 s / 24.1 s** | Pass |
| Strict slipstream share of low score | ≤ 50% | 62% | **47%** | Pass |

**Strict share.** The street multiplier on drops and the par pause are gone (I checked the code). So the "Slipstream" line is now every point paid by drafting: 3,785 of 8,062 low-line points = 47%. One indirect part remains. Payouts add 0.5 s to the clock (24 s over 3 runs), and the low line earns 15 non-slip points a second. That is about 360 more points, which gives 51%. If you count clock time, it is on the line. On the direct count it is a pass.

## Street line: is it still a real choice?

The number: **0.85** score a minute (1,697 against 2,001). Per run it is much lower: **0.59** (2,687 against 4,547). Street runs end sooner (82 to 108 s against 120 to 164 s). Drops feed the clock, and the street line delivers 1.47 a minute against 2.49.

As a player, the street line still feels like the best part of the game. You fly down a canyon of warm facades at 15 m/s. The chevrons climb. "CLOSER TO WALL" tells you what to do. The chain ticks up with a chime, and the payout pop lands every few seconds. The roof line is calmer and, honestly, duller: a long straight hop at 40 m with a headwind. On the game-over card the street line's "Slipstream ×19 +1,680" is the biggest single line. That reads as a reward, not a consolation.

But the medals now judge the run, not the minute. A player who follows the title ("Fly fast and low") reaches Silver near the end of the run (76 s of about 100). A player who flies high reaches Silver at 80 s and Gold at 147 s. Within a few runs a medal chaser learns that the roof line wins. So the street line is a real and rewarding way to play. It is not the best way to win medals. I rank that as the top "other gap" below, not the biggest one.

## Whole game, as a player

- **First 10 seconds.** Strong. A golden-hour city, a chunky drone, a clear title with controls and now the medal ladder. One press and you fly. The clock starts at once (10 s idle costs 10 of 50 s), which is fine for an arcade game.
- **Onboarding.** Good. The tagline gives the rule. The slip cue names one action. The first payout comes 1.4 s (desktop) or about 4 s (touch) after the first draft. The touch fix is real.
- **Core loop.** Pick up, deliver, draft. It pays for speed, line and wall distance, and now it has a target. It works.
- **Game feel.** Still the best part. Momentum, bank, the drop guide and fair crashes (0 hop-like, 0 on a pad lip).
- **Art.** Warm, coherent low-poly with moving traffic. Finished-looking. The medals (bronze, silver, gold, teal "Ace") match the style.
- **Audio.** Rotor hum, wind, draft whistle, chimes, ticks and the new fanfare. **There is still no music.** The title is silent (the audio starts on the first press). The run is rotor hum and chimes. Game over is a four-note sting, then silence.
- **UI.** Clean. The game-over card is now the best screen: medal, score, "New best", points to the next medal and a breakdown that teaches you where points come from. Weak spots: the HUD goal row is 15 px tall. Its progress bar is a thin dark line that disappears against dark walls (`d-j22-h09-goal-hud`). On mobile the medal banner overlaps the slipstream pop (`#slip-pop`) at both passes. The delivery pop sits on the objective pill (`m-j22-h10-medal1`).
- **Difficulty curve and run length.** Runs last 67 to 164 s. Legs get longer and clock bonuses shrink. Nothing new appears over a run. The fifth delivery plays like the first, and the soundscape does not change either.
- **Game over and restart.** Fast and clear. "Fly again" to control: 77 to 84 ms desktop, 23 to 26 ms touch.
- **Replay pull.** Much better. "842 more for Gold" is a real reason to press "Fly again". The thresholds feel right. Bronze comes about 45 s in for a decent pilot. Silver is a solid run. Gold needs a clean, fast run (1 of 6 bot runs). Ace is out of reach for every bot (best 5,466 of 7,500), which is the right place for a top medal. One weak point: every fresh load is still the same city (seed 7) with the same first pickup.

## Single biggest remaining gap: the game has no music

The best arcade flying and delivery games carry their energy in music. A loop on the title sets the mood. In the run the track lifts as you chain and tightens as the clock runs out. Game over gets its own short cue. Drone Dash now has a full loop, honest scoring and medals, so the missing layer is the soundtrack. The sound you hear for 80 to 160 s of every run is a rotor drone.

Evidence:
- `src/systems/AudioSystem.ts` has rotor, wind, draft, chimes, ticks, a fanfare, a start sting and a game-over sting. There is no music bus, loop or sequencer anywhere in `src/`.
- The title is silent until the first press, because the AudioContext starts on that gesture. A new player's first impression has no sound.
- Nothing in the audio responds to the state of the run. A x5 slipstream chain, a Gold chase with 8 s left, and an idle hover all sound the same apart from one-shot chimes.
- Round 8 ranked this as the top "other gap". It is unchanged.
- The run has no rising arc (see "Difficulty curve" above). Music is the cheapest way to give it one without touching balance.

**Acceptance test** (dev server on 5188, desktop and iPhone 13 held sideways):
1. **Music exists.** A procedural music layer plays on the title after the first tap or key, during the run, and on game over. Diagnostics expose `audio.music = { playing, layer, gain, bpm }`. Over 10 s on each screen `playing` is true and `gain` is above 0.
2. **It follows the run.** Run `route-play-rt-x.mjs` on the low line, seeds 22, 58, 130. In 3 of 3 runs, `audio.music.layer` (or intensity) is higher at a slipstream chain of 3 or more than at a chain of 0. In the last 10 s of the clock it changes again (faster tempo or an extra layer) in 3 of 3 runs. A medal pass ducks or lifts the music for the fanfare, so the fanfare stays audible.
3. **It is mixable.** A mute or music toggle exists on the title or pause screen and is remembered after reload.
4. **No regressions.** Frame time p95 stays under 12 ms on desktop and mobile. First load stays under 15 MB. The round 9 scoring table above stays within 10%.

## Other gaps (ranked)

1. **Medals reward the roof line.** The title says "fly fast and low". But per run, the low line scores 0.59 of the high line (2,687 against 4,547). Low runs end 25 to 55 s sooner because they deliver less (1.47 against 2.49 a minute). Low pilots reach Silver at about 76 s. High pilots reach Gold. Test: on seeds 22, 58, 130, standard low reaches at least 0.8 of the high line's per-run score. The strict share stays at or below 50%. One option: give the clock more time from slipstream chains, which adds no points.
2. **The same city on every load.** Seed 7 and "Juniper Lofts Rooftop" are always first. A daily or rotating city with its own best and medals can add a lot of replay pull to the medal ladder. Test: two loads on different days give different seeds, and the title shows which city it is and its best.
3. **The HUD goal is hard to read.** The row is 15 px tall, 18 px from the left. The progress bar is a thin dark bar that vanishes on dark facades. The run shows no "points to go" number. Test: the goal row shows "1,240 to Gold" or similar, and the bar has a light track at least 4 px tall.
4. **Pops stack on mobile.** The medal banner overlaps `#slip-pop` at 2 of 2 passes in the touch run. The delivery pop "+502" covers the objective pill. When the off-screen marker is clamped bottom-left it sits under the touch stick. Test: no overlap between the medal banner, slip pop, objective pill and stick in a full touch run.
5. **No arc inside a run.** Leg length and clock bonus change, but nothing new appears and nothing on screen marks the run's phases. Music (main gap) is the first step. A late-run event (a rush order or a double-points street) is a good second step.

## Regressions: none found

- **crash-classify, 8 seeds, 12 m:** 650 s sim, 19 deliveries, 31 charged (2.9/min), **0 hop-like**. **20 m:** 804 s, 31 deliveries, 32 charged (2.4/min), **0 hop-like**. Verbose reruns: 12 m 33 charged (3.2/min), 20 m 25 (2.1/min), 0 hop-like.
- **Pad lip:** 6 crashes within 30 m of the target across both verbose runs. All targets are street pads (0.4 m). All hits are building faces with tops of 10.6 to 20.2 m at 13.5 to 17.1 m/s. **0 on a pad lip.**
- **arrival-metrics, 8 seeds:** 64 legs, 62 arrived. The seed 91 timeout is the known straight-line bot case. The seed 7 timeout is the clock running out, after the bot stalled 30.5 s on the parapet beside the first rooftop pad (`A-seed7-stall-final-approach.jpg`). That leg gave all 10 stalls and 110 of the 136 "slow and high" samples. On a rerun of seed 7 the same leg took 2.8 s, with 0 stalls on all 9 legs. I count it as bot noise. Median cruise 6.1 s, median final approach 3.3 s, marker off screen 2.0%.
- **Flat-frame probe:** 1,050 frames, **0 flat**.
- **Page errors:** 0 on desktop and mobile.

## Performance

Headless Chromium caps at 120 Hz, so 8.3 ms is the cap.

- Desktop 1280x720, medal journey (about 107 s of flight): 12,834 frames, **median 8.30 ms, p95 9.20 ms, max 9.5 ms, 0 over 20 ms**. Hand-fly (80 s): 9,577 frames, median 8.30, p95 9.20, max 16.7, 0 over 20 ms.
- Mobile (iPhone 13 held sideways, touch), medal journey: 12,663 frames, median 8.30, p95 9.20, max 9.5, 0 over 20 ms. Hand-fly runs: p95 9.30, max 9.5, 0 over 20 ms.
- Round 8: 8.3 / 8.8 ms. p95 is 0.4 ms higher, well inside 12 ms.
- First load, production build: **about 0.74 MB** (JS 708 KB, CSS 27 KB, HTML 8 KB). lil-gui (31 KB) loads only with `?debug`. Budget 15 MB: pass.

## Screenshots (progress/round-9/critic/)

- Medal journey, desktop seed 22: d-j22-h01-title, h02-low-drafting, h03-low-meter-half, h04-low-payout-pop, h05-low-payout-chain, h08-end, h09-goal-hud, h10-medal1, h10-medal2, h11-over, h12-restart, h13-title-after
- Medal journey, desktop seed 58 (first attempt, logs lost to a script bug, shots valid): d-j58-h01 to h13
- Medal journey, mobile seed 22: m-j22-h01-title, h02 to h05, h08-end, h09-goal-hud, h10-medal1, h11-over, h12-restart, h13-title-after
- Medal passes from bots: M-low-seed22/58/130-pass*, M-high-seed22/58/130-pass*, M-low-c10-seed22/130-pass1 (lazy)
- Hand flight: d-h01 to d-h08, m-h01 to m-h08 (the second mobile run wrote over the first)
- Player journey (default city): J-00-title, J-01-idle-01s/04s/10s, J-02-delivery-1, J-03-gameover, J-04-restart
- Crash classify: K-alt12-*, K-alt20-*. Near target: N-alt12-*, N-alt20-*. Route crashes: Q-high-seed58/130-crash*. Arrival stall: A-seed7-stall-final-approach

Scripts (progress/round-9/critic-scripts/): copies of all round 8 scripts, plus `route-play-rt-x-m.mjs` and `balance-probe-m.mjs` (log-only medal additions) and `medal-journey.mjs` (hand-fly pilot on the street line for a whole run, with title, HUD, pass, game-over and restart checks). `queue*.sh` ran the timing-sensitive scripts one at a time. Logs: m-lazy, m-low, m-high, hf-desktop, hf-mobile, hf-mobile-2, hug, flat, cc12, cc20, ccv12, ccv20, am-all, am-seed7-rerun, journey, mj-desktop, mj-mobile, build.
