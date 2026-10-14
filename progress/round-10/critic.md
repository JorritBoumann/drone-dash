# Drone Dash, round 10 critic report

**Verdict:** The music is in and it works. It plays on every screen. It rises with the chain and turns tense in the last 10 s. The medal fanfare sits 15 dB above it. Nothing regressed. But the music has a crackle: short clicks on the beat in the busy parts. It is also quiet, and the title is mostly sub-bass. The biggest gap is now a design one: the game says "fly fast and low", but the high roof line still wins the medals by almost 2 to 1.

## Round 9 gap (no music): closed

All checks ran on the dev server (port 5188). Scripts are in `critic-scripts/`. The audio run used Chromium with `--autoplay-policy=no-user-gesture-required` and a key press as the gesture. The toggle test used no flag, only a real click or tap.

| Check | Needed | Result | Pass |
|---|---|---|---|
| Title music | plays after first press | desktop click and iPhone tap on the sky: context running, `playing` true, `gain` 0.5, track `title`. Seeds 22, 58, 130: playing in 100% of samples | Yes |
| Run music | plays | 6,358 samples over 3 runs, playing in all but 16 (the 0.24 s gap at run start and the switch to game over) | Yes |
| Game over music | plays | track `over`, section by medal (`bronze`, `silver`), playing in 88 to 97% of samples (the 0.14 s gap and fade in) | Yes |
| Diagnostics | `audio.music` | present: playing, track, section, layer, intensity, bpm 125, gain, duck, late (0), resyncs (0) | Yes |
| Chain 3+ above chain 0 | 3 of 3 low runs | mean intensity chain 0 / chain 3+: seed 22 0.36 / 0.87, seed 58 0.37 / 0.85, seed 130 0.33 / 0.86. Layers 1 vs 4 | 3 of 3 |
| Last 10 s changes | 3 of 3 | track switches to `final` at 9.96 to 9.99 s left in all 3. Layer 5, intensity 0.94 to 0.97 (0.53 to 0.73 in the 10 s before). Tempo stays 125 BPM. Harmony, drums and a ticking high C change | 3 of 3 |
| Fanfare audible | fanfare over music | measured on the captured buses: fanfare 15.1 and 14.5 dB above the ducked music (seed 22). Game meter: 15.2, 17.0, 15.9 dB on seeds 22, 58, 130 | Yes |
| Toggle | exists, remembered | chip top right on title, pause and game over, plus the M key. "Music off" writes `0`, survives reload, music stays off after the next gesture. Same on iPhone 13 held sideways | Yes |
| p95 frame time | under 12 ms | desktop 9.00 ms, mobile 8.90 ms | Yes |

## Audio measurements

How: an init script tapped three points of the real graph with a ScriptProcessor. These are the master output (after the limiter, the signal sent to the speakers), the music bus and the cue (one-shot SFX) bus. Seed 22, low line, Silver run. Rotor and wind are in the master but not in the two buses. The clips are mono 22.05 kHz 16-bit WAV, 0.26 to 0.68 MB each. Loudness is ungated K-weighted (LUFS-like). "Phone band" is the RMS above 200 Hz, roughly what a phone speaker can play.

| Clip | Length | Peak | Clipped samples | Loudness | Phone band | Below 150 Hz | Above 6 kHz | Clicks (music bus) |
|---|---|---|---|---|---|---|---|---|
| title | 14.7 s | -21.7 dBFS | 0 | -32.7 | -37.3 dBFS | 73% | 0.0% | 0 |
| run-chain0 | 8.2 s* | -12.9 | 0 | -27.6 | -29.7 | 49% | 0.07% | 0 |
| run-chain3 | 15.0 s | -7.1 | 0 | -25.1 | -27.0 | 38% | 0.31% | 10 (0.7 a second) |
| last-10s | 11.5 s | -9.2 | 0 | -26.3 | -28.7 | 46% | 0.36% | 47 (4.1 a second) |
| medal-fanfare-1 (Bronze) | 6.0 s | -7.8 | 0 | -25.3 | -27.3 | 34% | 0.65% | 0 |
| medal-fanfare-2 (Silver) | 6.0 s | -7.8 | 0 | -24.9 | -26.9 | 33% | 0.78% | 20 |
| game-over | 15.5 s | -11.1 | 0 | -31.2 | -34.1 | 60% | 0.08% | 2 (before the switch) |

\* The longest stretch at chain 0 in a low run was 8.2 s. The bot starts drafting within 4 to 6 s.

- **Clipping:** none. The loudest peak in the whole run is -7.1 dBFS. The limiter never works.
- **Harshness:** none. Energy above 6 kHz is under 1% everywhere. The music has a 6.5 kHz low-pass.
- **Loudness:** low. The run sits at about -25 to -28, the title and game over at -31 to -33. Typical mobile and web games sit near -16 to -20. There are 7 dB of unused headroom.
- **Phone speakers:** the title has 73% of its energy below 150 Hz (bass at 73 to 98 Hz, pads behind a 700 Hz filter). In the phone band the title is -37 dBFS, 10 dB below the run. On an iPhone speaker the title is likely very faint.
- **Ducking** (music bus before and during each cue, median, with the set value in brackets): slipstream payout -2.4 dB (-3.1, n 18). Pickup -3.0 (-4.4). Delivery -4.8 (-6.9). Medal -9.3 (-11.1). Game over -5.7 (-6.0). Cues sit 4.6, 9.7, 16.6, 11.5 and 7.2 dB above the ducked music. The slip chime is the least clear (4.6 dB).
- **Clicks:** real, and in the master output. On the music bus there are short spikes, 3 to 4 samples wide and about 0.07 to 0.1 in size. The surrounding music sample-to-sample step is about 0.005. Each one shows up in the master exactly 12.00 ms later, which is the two compressors' look-ahead, so it is not a capture fault. They fall exactly on the 16th-note grid. Only the drum and arp layers have them. Rates: 0 on the title and at run layer 1. 0.7 a second at chain 3. About 4 a second in the last 10 s. I rendered each voice alone (kick, hat, clap, bass, arp, lead, urgency tick) in an OfflineAudioContext with the same envelopes and filters. None of them spikes. So the cause is in the live graph, not one voice. I did not find it. Listen to `last-10s.wav` from 0 to 4 s and `run-chain3.wav` at 11.5 s and 14.1 s.
- **Repetition:** the in-run music repeats every 7.68 s (4 bars). Correlation of the music bus at chain 3: 0.86 at 7.68 s, 0.89 at 15.36 s. Only the layers change with the chain. A 108 s run hears the same 4 bars about 14 times. The title and game-over loops are 15.36 s (8 bars).
- **Loop and section boundaries:** no clicks at the run-to-final or final-to-over switches beyond the grid clicks above. The title loop is clean (0 clicks).

**Files for the owner to listen to** (`progress/round-10/critic/audio/`):
- `title.wav`: title loop, 15 s
- `run-chain0.wav`: in run, no chain, 8 s
- `run-chain3.wav`: in run, chain 3 to 5, 15 s
- `last-10s.wav`: the last 10 s section into the time-up sting, 11.5 s
- `medal-fanfare-1.wav`, `medal-fanfare-2.wav`: Bronze and Silver passes, 6 s each
- `game-over.wav`: game-over loop after a Silver, 15.5 s
- `measurements.json`: all numbers above, plus every duck

## Whole game, as a player

- **First 10 seconds.** Strong. A warm golden-hour city, a clear title and the medal ladder. A "Click or press a key for sound" chip now invites the first press. After it, a soft loop plays. On a phone that loop is mostly bass, so it is likely close to silent.
- **Onboarding.** Good and unchanged. First payout 1.5 s after the first draft on desktop, 4.0 s on touch.
- **Core loop.** Pick up, deliver, draft. It works and now has music that answers it. Chain 3 adds the lead melody, and you can hear yourself doing well.
- **Game feel.** Still the best part. Momentum, bank, fair crashes.
- **Art.** Coherent, warm, finished-looking low-poly.
- **Audio.** A big step. The run has an arc. Pad and bass come first. Drums join at chain 1, arp at 2, lead at 3. The last 10 s get a tense minor section. Game over gets a warm or wistful loop by medal. The fanfare cuts through. Weak spots: the click crackle in the busiest parts, the low overall level, and a 7.68 s loop that gets samey by the third minute.
- **UI.** Clean. The music chip fits the style. Unchanged weak spots: the HUD goal row is still 15 px tall. On mobile the medal banner still overlaps `#slip-pop` (2 of 2 passes) and the objective pill (1 of 2).
- **Difficulty curve and run length.** Low runs 83 to 108 s, high runs 120 to 153 s. The music gives the run an arc now. The play itself still does not change over a run.
- **Game over and restart.** Fast. "Fly again" to control: 90 ms desktop, 23 ms touch. The game-over loop is a nice touch.
- **Replay pull.** Good. "817 more for Gold" pulls you back. The pull points you to the wrong line, though (below).

## Single biggest remaining gap: the medals reward the roof line, not the game's own idea

The title says "Fly fast and low, close to the walls". The street line is where the game feels best, and now it is where the music is best: the chain is what lifts it to drums, arp and lead. But the medals pay the high, straight roof line far better. A medal chaser learns this in a few runs. Then they fly at 40 m over the roofs and get the plainest version of the game. That includes the music: the high line gets 1.44 slip payouts a minute, so its music stays mostly at layers 1 and 2.

Evidence (same bots as round 9, seeds 22, 58, 130, every run to its own time-up):
- Standard low: 3,658 Silver, 1,792 Bronze, 2,612 Silver. Total 8,062.
- High line at 40 m: 6,789 Gold, 4,078 Silver, 4,124 Silver. Total 14,991.
- Low / high per run: **0.54** (round 9: 0.59). Seed 22 high came within 711 of Ace.
- Why: drops feed the clock. The low line delivers 1.47 a minute, the high line 2.59. Low runs end 25 to 55 s sooner (83 to 108 s against 120 to 153 s).
- Slipstream share of the low score: 3,785 of 8,062 = 47%. The street line's own reward is not the problem. Its clock is.
- The best low run reaches Silver at 76 s. Only the high line reaches Gold (1 of 3 here, 1 of 3 in round 9).

**Acceptance test** (dev server 5188, `route-play-rt-x-m.mjs` LINE=low and LINE=high, `balance-probe-m.mjs` CRUISE=10 NOBOOST=1, seeds 22, 58, 130, SIMT 400):
1. Standard low per-run total is at least **0.85** of the high line's total.
2. Standard low reaches Silver in 3 of 3 runs and Gold in at least 1 of 3.
3. The high line still reaches Silver in at least 2 of 3. No bot reaches Ace.
4. Lazy still gets Bronze at most.
5. Strict slipstream share of the low score stays at or below 50%. The breakdown still adds up in every run.
6. Crash-classify: 0 hop-like and 0 on a pad lip at 12 m and 20 m on all 8 seeds. p95 frame time stays under 12 ms.

One option that adds no points: let a slipstream chain feed the clock, for example +1 s per payout from chain 3. Then a street run lasts as long as a roof run.

## Other gaps (ranked)

1. **Music clicks.** Spikes on the 16th-note grid: 0.7 a second at chain 3 and about 4 a second in the last 10 s. They are about 0.08 in size against music steps of 0.005, and they reach the master output. Test: run `music-run.mjs` TAP=1 on seed 22, low line, full run. The click count on the music bus is 0 (now 118). A click is a step over 10 times the local 2 ms RMS step and over 0.004.
2. **Music level and phone balance.** Run -25 to -28, title -33, game over -31 LUFS-like, peak -7 dBFS. The title has 73% of its energy below 150 Hz. Test: the run measures -18 ± 3. In the phone band (above 200 Hz) the title is within 4 dB of the run. Peak stays at -1 dBFS or below, with 0 clipped samples.
3. **The run loop repeats every 7.68 s.** One 4-bar phrase for the whole run. Test: the in-run music bus shows no exact repeat (correlation over 0.8) within 30 s at a fixed chain level. For example, an 8 or 16 bar form with an A and B section, or a variation every second pass.
4. **The same city on every load.** Seed 7 and the same first pickup, every time. Test: two loads on different days give different seeds, and the title shows which city it is and its best.
5. **HUD goal and mobile pops** (unchanged from round 9). The goal row is 15 px tall. On iPhone the medal banner overlaps `#slip-pop` at 2 of 2 passes and the objective pill at 1 of 2. Test: the goal row is at least 20 px tall and shows a "to Gold" number. In a full touch run the banner, slip pop and objective never overlap.

## Regressions: none found

- **Medals** (needed: lazy Bronze at most, low and high Silver in 2 of 3, no Ace): lazy 1,773 Bronze, 811 none, 1,066 Bronze. Low 2 of 3 Silver. High 3 of 3 Silver or better (one Gold). Best 6,789, no Ace. Breakdown adds up in diagnostics and the game-over DOM in 9 of 9 bot runs plus both journeys. The fanfares heard equal the passes in all 9 runs.
- **Crash-classify, 8 seeds, verbose:** 12 m: 617 s, 19 deliveries, 42 charged (4.1 a minute, round 9 3.2), **0 hop-like**. 20 m: 801 s, 31 deliveries, 30 charged (2.2 a minute), **0 hop-like**. The 12 m rate is higher. 39 of the 42 came from under 10 m/s. None rose without climb. I count the higher rate as bot noise.
- **Pad lip:** 10 crashes within 30 m of the target. All targets are street pads (0.4 m). All hits are building faces with tops of 8.8 to 58.6 m at 14.5 to 17 m/s. **0 on a pad lip.**
- **Flat-frame probe:** 858 frames, **0 flat**.
- **Page errors:** 0 on desktop and mobile. Music scheduler: late 0, resyncs 0 in all runs.

## Performance

Headless Chromium caps at 120 Hz (8.3 ms).
- Desktop 1280x720, medal journey (107 s of flight, music on): 12,864 frames, **median 8.30 ms, p95 9.00 ms, max 9.4, 0 over 20 ms**.
- iPhone 13 held sideways, touch: 10,503 frames, **median 8.30, p95 8.90, max 9.4, 0 over 20 ms**.
- Round 9: 8.3 / 9.2 ms. The music costs nothing measurable.
- First load, production build: **about 0.76 MB** (JS 723 KB, CSS 28 KB, HTML 9 KB). lil-gui (31 KB) loads only with `?debug`. Budget 15 MB: pass.

## Screenshots (progress/round-10/critic/)

- Music chip and gesture path: d-title-locked, d-title-music-on, d-title-music-off-after-reload, d-pause-chip, d-over-chip, and the same with m- for iPhone 13 held sideways
- Medal journey, desktop seed 22: d-j22-h01-title, h02-low-drafting, h03-low-meter-half, h04-low-payout-pop, h05-low-payout-chain, h08-end, h09-goal-hud, h10-medal1, h10-medal2, h11-over, h12-restart, h13-title-after
- Medal journey, mobile seed 22: m-j22-h01 to h13 (same set)
- Medal passes from bots: M-low-seed22/58/130-pass*, M-high-seed22/58/130-pass*, M-low-c10-seed22/130-pass1 (lazy)
- Route crashes: Q-high-seed22/58/130-crash*. Near-target crashes: N-alt12-*, N-alt20-*

Scripts (progress/round-10/critic-scripts/): copies of all round 9 scripts, plus:
- `music-run.mjs`: the round 9 low-line medal bot (same control logic) with music sampling every step. With TAP=1 it also captures the master, music and cue buses.
- `analyze-audio.py`: cuts the clips and measures them (run it without `-I` so it finds numpy).
- `toggle-test.mjs`: the real gesture path and the music toggle, desktop and touch.
- `offline-voices.mjs`: the per-voice click check.
- `queue10.sh`: ran the timing-sensitive scripts one at a time.

Logs: toggle, music-22, music-58-130, m-high, m-lazy, flat, mj-desktop, mj-mobile, ccv12, ccv20, build. The raw 79 MB capture was moved out of the project (to the session scratchpad).
