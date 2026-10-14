# Drone Dash, round 11 critic report

**Verdict:** All four round 10 audio problems are fixed. The music has no clicks. The title and run sit at about -16 to -18 LUFS. The title is no longer mostly sub-bass. The run music repeats only every 61 s. Every gameplay cue stays at least 6 dB over the music. The only exceptions are 3 slip chimes of 61, in the master. Nothing regressed. Two smaller audio points remain: the game-over loop is still 4 dB quiet and bass-heavy, and in flight the music sits under the rotor and wind.

## How I measured

- Dev server on port 5188, Playwright with channel `chromium` and the autoplay flag. A key press (desktop) or a tap (iPhone 13 held sideways) was the gesture.
- An init script tapped three points of the real graph with a ScriptProcessor: the master output (after the limiter and the new trim, the signal sent to the speakers), the music bus and the cue bus. Same tap as round 10.
- **Capture latency.** At the start of each capture I played a known 10 ms noise burst into all three taps. I knew its audio-clock time. I found it again with a matched filter. The latency was 170.67 ms (8,192 samples, two ScriptProcessor buffers) on every channel in every capture, match score 0.97 to 1.01. All cue timing below is corrected for it. Game sound reaches the master 12.0 ms after the buses (the two compressors' look-ahead), the same as round 10. After the correction, cue sound starts a median 11 to 23 ms after the game's scheduled cue time.
- Loudness is BS.1770 K-weighted. "Integrated" is gated over the clip. "Short-term" uses 3 s windows. Round 10 used an ungated approximation. For steady music the two differ by under 1 dB.
- Captures:
  - Low line, seeds 22, 58 and 130, desktop.
  - Low line, seed 22, iPhone 13 held sideways.
  - High line, seeds 22, 58 and 130, desktop. The crashes come from these runs.
  - One forced capture. `musicForce` held chain 0 for 40 s, then chain 3 for 95 s, then the final section for 20 s. The clock was set to 200 s. The low line bot did not crash once, so the crash numbers come from the high line runs.
- Raw recordings (about 30 MB each) are in the session scratchpad, not in the project.

## Round 10 audio problems

### 1. Clicks on the 16th-note grid: fixed

| Where | Round 10 | Round 11 |
|---|---|---|
| Round 10 detector, music bus, whole run | 118 | **0** (every capture: 4 low runs, 3 high runs, forced) |
| Round 10 detector, master, whole run | 26 | **0** |
| Last 10 s, music bus | 47 (4.1 a second) | **0** in all 7 runs |
| Run at chain 3, music bus | 10 (0.7 a second) | **0** |
| Stricter detector, music bus | 268 in a 140 s capture (114 a minute) | **0** in the whole runs of seeds 58, 130 and mobile 22. 1 in the 187 s forced capture |
| Stricter detector, master | 125 a minute | 21 to 41 a minute, none from the music (see below) |

- The round 10 detector is unchanged: a step over 10 times the local 2 ms RMS step and over 0.004.
- My stricter detector flags a step over 5 times the RMS step in a 5 ms window, with the centre left out. The step must also be over 0.002 on the music bus. On the master the floor is 0.005, because the master now runs about 9 dB hotter. The slope itself must jump, so smooth steep edges do not count. I ran it on the round 10 raw capture for the baseline above.
- The master hits are not from the music. About 70% sit on cue sounds (slip chime, chimes, the square-wave fanfare brass). The rest fall on the rotor and wind sound. The ones I opened were steep edges spread over 5 to 10 samples, not one-sample spikes. I do not count them as clicks.

### 2. Music too quiet: fixed

Integrated loudness of the master (desktop seeds 22, 58, 130, then mobile seed 22):

| Clip | Round 10 | Round 11 | Short-term range |
|---|---|---|---|
| Title | -32.7 | **-17.4** (all runs) | -17.8 to -16.7 |
| Run, chain 0 | -27.6 | **-17.0, -17.8, -17.8, -17.1** | -18.7 to -16.1 |
| Run, chain 3+ | -25.1 | **-16.1, -16.4, -16.2, -15.7** | -17.8 to -14.9 |
| Last 10 s | -26.3 | **-17.0, -17.0, -16.5, -17.2** | -18.1 to -15.0 |
| Medal fanfare | -25.3, -24.9 | **-15.3 to -16.8** | -18.3 to -14.9 |
| Crash (high line) | none | **-15.2, -14.8** | |
| Game over | -31.2 | **-21.4 to -21.6** | -23.6 to -17.7 |

- Peaks: the loudest sample in any clip is **-1.2 dBFS** (a crash). **0 samples over -1 dBFS** and 0 clipped. The limiter now works, up to 3.6 to 3.8 dB of gain reduction at peaks.
- Title and run are in the -16 to -18 target. Game over is still about 4 dB under it (see "Remaining audio points").

### 3. Title 73% below 150 Hz: fixed

| Clip | Below 150 Hz | Above 6 kHz | Phone band (above 200 Hz) |
|---|---|---|---|
| Title | **35%** (round 10: 73%) | 0.0% | **-18.7 dBFS** (round 10: -37.3) |
| Run, chain 0 | 39 to 49% | 0.03 to 0.10% | -18.3 to -20.0 |
| Run, chain 3+ | 40 to 44% | 0.21 to 0.34% | -17.9 to -18.4 |
| Last 10 s | 44 to 50% | 0.19 to 0.32% | -18.9 to -19.7 |
| Game over | 57 to 60% | 0.04 to 0.09% | -23.9 to -24.4 |

- In the phone band the title is now within 1.5 dB of the run (round 10: 10 dB under). Round 10's test asked for 4 dB.
- In the run, part of the low end is the rotor. The music bus alone is 9 to 43% below 150 Hz in the run.
- Nothing is harsh. Energy above 6 kHz stays under 1% everywhere.

### 4. Run music repeats every 7.68 s: fixed

Correlation of 4-bar windows of the music bus with the same window one or more whole bars later. "Mean" is over all start points.

| Capture | Round 10 | Round 11 |
|---|---|---|
| Forced chain 3, 92 s | 0.86 at 7.68 s | No lag under 61 s reaches 0.8 (mean). Highest under 30 s: 0.50. Repeats at **61.44 s** (32 bars) with 0.97 |
| Forced chain 0, 37 s | (not measured) | No lag up to 28.8 s reaches 0.8 (mean). Highest: 0.58 at 11.5 s |

- Single 4-bar windows: 1 of 35 reaches 0.80 at 17.3 s at chain 3, and 1 of 6 reaches 0.84 at 19.2 s at chain 0. These are single phrases that come back, not a loop.
- The code comment says the run only repeats exactly every 96 bars (184 s). On the waveform it is nearly exact (0.97) after 32 bars. The pad, lead and drums cycle every 32 bars, and the changing bass and arp lines carry little of the energy. 61 s is still twice the 30 s target.
- Title and game-over loops show no repeat inside the 15 s clips.

## Adaptive behaviour: still holds

| Check | Result |
|---|---|
| Chain 3+ above chain 0 | Mean intensity chain 0 / chain 3+: seed 22 0.39 / 0.87, seed 58 0.36 / 0.84, seed 130 0.33 / 0.86, mobile 22 0.37 / 0.86. Layers 1 vs 4 and 5. Chain 3+ is also 0.6 to 1.6 LU louder than chain 0 |
| Final section in the last 10 s | Switches to `final` at 9.96 to 10.00 s left in all 7 runs (low and high, desktop and mobile). Layer 5, intensity 0.93 to 0.97 |
| Toggle remembered | "Music off" writes `0`, survives reload, music stays off after the next gesture. Same on iPhone 13 held sideways (tap). Chip shows on title, pause and game over. M key works in the run |
| Scheduler | late 0, resyncs 0, 0 page errors in all runs |

## Cues over the louder music: not masked

I compared the cue bus with the ducked music bus in each cue's own window. The table gives the median per run. Runs: low line seeds 22, 58, 130 and mobile 22. The crash comes from the high line.

| Cue | Round 10 | Round 11 median | Round 11 lowest single cue | In the master (lowest) |
|---|---|---|---|---|
| Slipstream payout | 4.6 dB | **10.1 to 10.7** | 6.4 | 4.4 |
| Pickup | 9.7 | **11.2 to 13.0** | 9.9 | 9.1 |
| Delivery | 16.6 | **15.1 to 18.9** | 14.7 | 12.2 |
| Medal | 11.5 | **15.9 to 17.5** | 15.2 | 12.1 |
| Crash | not measured | **22.4** (3 crashes) | 21.9 | 16.0 |
| Game over sting | 7.2 | **24.3 to 25.2** | 24.3 | 22.1 |

- "In the master" splits the real output into its music part and its cue part by a least-squares fit, so it includes the compressor. On the buses every one of 61 slip payouts is over 6 dB. In the master 3 of 61 are under 6 dB (4.4, 5.1 and 5.7 dB). All other cues are over 9 dB.
- The game's own fanfare meter: 15.3, 17.1, 17.3 dB (low line) and 18.6, 21.3, 19.0 dB (high line).

## Remaining audio points (not regressions)

1. **Game over is still quiet and bass-heavy.** It measures -21.5 LUFS against a target of about -17. It has 57 to 60% of its energy below 150 Hz. In the phone band it is -24 dBFS, 6 dB under the run. The title fix was not carried over to the game-over loop. On a phone speaker the game-over loop will sound much softer than the run. Test: game over at -18 ± 2 LUFS and within 4 dB of the run in the phone band.
2. **In flight the music sits under the rotor and wind.** I split the master with the same fit. In the run the music part is -21.5 to -25.5 LUFS. The rotor, wind and reverb part is -18 to -19. On the title, where there is no rotor, the music is -17.4. This balance is the same as round 10 (the music bus level did not change, everything got louder together). It is a taste call. But the chain-3 layers tell the player they are doing well, and they play 3 to 7 LU under the drone hum.

## Files for the owner to listen to

`progress/round-11/critic/audio/` (mono 22.05 kHz 16-bit WAV, master output, all under 0.7 MB):

- `title.wav`: title loop, 14.7 s (seed 22)
- `run-chain0.wav`: in run at chain 0, 14.9 s (seed 130)
- `run-chain3.wav`: in run at chain 3 and up, 15 s (seed 22)
- `last-10s.wav`: last 10 s into the time-up sting, 11.1 s (seed 22)
- `medal-fanfare-1.wav`, `medal-fanfare-2.wav`: Bronze and Silver passes, 6 s each (seed 22)
- `crash.wav`: a crash with music under it, 4 s (high line, seed 130)
- `game-over.wav`: game-over loop after a Silver, 15.5 s (seed 22)
- `measurements-*.json`: every number above, per capture (low, high, mobile, forced)

## Regressions: none found

- **Medals** (needed: lazy Bronze at most, low and high Silver in at least 2 of 3, no Ace):
  - Lazy: 1,728 Bronze, 766 none, 1,141 Bronze.
  - Standard low: 3,638 Silver, 1,837 Bronze, 2,712 Silver (2 of 3). Mobile seed 22: 3,493 Silver.
  - High: 4,052 Silver, 4,123 Silver, 4,074 Silver (3 of 3). No Ace. Seed 22 high reached Gold in round 10. This run took a different route, and no medal logic changed.
  - The breakdown adds up in diagnostics and the game-over screen in all 10 bot runs and the journey. Fanfares heard equal medal passes in every run.
- **Flat-frame probe:** 797 frames, **0 flat**, 0 errors.
- **Frame time,** desktop medal journey (108 s of flight, music on): 12,893 frames, median 8.30 ms, **p95 8.90 ms**, max 9.4, 0 over 20 ms. Fly again to control: 75 ms.
- **Page errors:** 0. Music scheduler: late 0, resyncs 0.

## Scripts and logs

`progress/round-11/critic-scripts/`:
- `music-run11.mjs`: round 10 `music-run.mjs` (same bot) plus the calibration burst, MOBILE=1, FORCE=1 and raw files outside the project.
- `analyze11.py`: latency, clips, both click detectors, loudness, bands, cue margins, repetition.
- `fullrun-clicks.py`: both detectors over a whole capture. `music-share.py`: the music part against the rest of the master.
- `queue11.sh` then `queue11b.sh` ran the timing-sensitive scripts one at a time. I stopped `queue11.sh` after the lazy runs and ran the high line through `music-run11.mjs` (same control logic as `route-play-rt-x-m.mjs`) so its crashes were recorded.
- Logs: force-22, music-d, music-m, toggle, m-lazy, m-high, flat, mj-desktop. Screenshots are in `progress/round-11/critic/`.
