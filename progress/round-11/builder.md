# Drone Dash, round 11 builder: music audio quality

Scope: the procedural music in `src/systems/AudioSystem.ts` and `src/systems/music.ts`, plus the master level. No gameplay or scoring code changed. The bloom clamps in `src/entities/ObjectiveMarker.ts` and all debug hooks are untouched (one test hook added).

## 1. Cause of the clicks

**Cause: a GainNode starts at gain 1.** Every note made a new GainNode and set its envelope with `setValueAtTime(0.0001, t)`. Before that first event, the node passes signal at its default gain of 1. The step grid adds 0.12 s again and again. So a note often starts a tiny bit (around 1e-12 s) after a sample frame. Chromium then starts the source on that frame but applies the envelope's first event one frame later. So one sample of the source got through at full level. On an oscillator that sample is near zero. On a noise hat or clap it is a full-scale random value. The 7.2 kHz hat filter (or the 1.5 kHz clap filter) rings it into a short spike.

Evidence:
- **Shape and timing in the round 10 capture** (the raw capture in the session scratchpad): all 118 music-bus clicks sit at the same phase of the 0.12 s step grid (48.06 ms). Each one is a 6 to 7 sample ringing at about 7 kHz, which is the impulse response of the hat bandpass.
- **Reproduced offline** (`builder-scripts/click-repro.mjs`, log `click-repro.log`): 40 hats on a grid, in an OfflineAudioContext.

  | Start offset from the frame | Round 10 envelope (spikes / 40) | Fix, gain 0 at creation |
  |---|---|---|
  | 0 (0.1 + k x 0.02, float error only) | 4 | 0 |
  | +-1e-12 s | 20 | 0 |
  | +-1e-10 s | 19 | 0 |
  | +-1e-8 s | 20 | 0 |
  | +-3e-6 s | 0 | 0 |

  Spike size: up to 0.46. Fixed: under 0.003. The round 10 critic's per-voice render started every voice exactly on a sample frame. That is why it found nothing.
- **Why the rate grew with the music:** layer 1 has no noise voices, so 0 clicks. Chain 3 adds off-beat hats and claps, so about 0.7 a second. The last 10 s put a hat on every 16th note plus claps, so about 4 a second.

**Fix at the source:** `envGain()` makes each note's gain node with `gain.value = 0`. It is used by every music voice (`mNote`, `kick`, `hit`) and by the SFX `tone` and `noise`.

**A second, smaller source showed up at the louder level:** master-only clicks during boost. I tapped each input of the master bus on its own channel (`builder-scripts/bisect-master.mjs`): SFX, reverb, rotor, wind, draft and music. Only the SFX bus had them, as periodic edges at 220 to 440 a second. That is the boost whine, a plain `sawtooth` with a one-sample edge every period. It now uses a soft saw (12 harmonics with a Lanczos taper). After the fix all six channels and their sum show 0. I first suspected the rotor saw. An offline rotor render (`rotor-edges.mjs`) ruled it out, and the rotor is unchanged.

Other edges were removed on the way:
- The scene fade used to set a target of 0, then cut the tail with `setValueAtTime(0)`. It is now a straight 40 ms ramp to exactly 0.

## 2. Changes

- **Click fix:** zero-initialised envelope gains (above). Soft saw for the boost whine.
- **Level:** master gain 0.8 to 3.1, then a fixed 0.8 trim after the limiter, so peaks stay under -1 dBFS. The limiter's automatic make-up gain lifts its ceiling, and the trim pulls it back. The glue compressor and limiter settings are unchanged. Music bus level (`MUSIC_VOL` 0.5) is unchanged, so music against SFX stays as before.
- **Title midrange:** pad harmonics an octave up (sines, past the pad filter). Plucks louder, with a sine an octave above. A second high lead note per chord. Bass softer relative to the rest. Title voices about +4 dB overall.
- **Run pad colour:** the chord's top note an octave up as a quiet sine, for phone speakers.
- **Run form:** 32 bars instead of 4, in eight 4-bar phrases.
  - First pass: C Am F G / C Am Dm G / F G Em Am / F G C G.
  - Second pass: Am F C G / C Em F G / Dm Em F G / Am Dm G G.
  - The lead reads one of 16 written bars per bar. Bass rhythm and arpeggio order change every phrase (3 variants each, so the notes repeat exactly only every 96 bars). A drum fill comes on the last bar of every other phrase (chain 2+).
- **Cues over the louder music:** slip duck 0.7 to 0.45 with a 0.35 s hold. Game-over duck 0.5 to 0.35. Slip chime and game-over sting each +2.3 dB (x1.3).
- **Diagnostics:** `audio.music.compDb` and `limiterDb` (current gain reduction). New test hook `__GAME__.musicForce(chain | null, final?)` holds the music at a chain level for audio tests. It does not change gameplay.

## 3. Files changed

- `src/systems/AudioSystem.ts`: envelope fix, master and trim, soft saw, title and run voicing, 32-bar sequencing, ducks and cue levels, forced state hook, reduction readout.
- `src/systems/music.ts`: `RUN_FORM` (32 bars), `RUN_LEAD` (16 bars) plus `RUN_LEAD_ORDER`, `RUN_ARP_ORDERS`, `RUN_BASS_VARIANTS`. Dm and Em chords added.
- `src/game/Game.ts`: `musicForce` test hook.
- `src/vite-env.d.ts`: type for the hook.

## 4. Numbers

Recording: same method as round 10 (`builder-scripts/music-run.mjs`, a copy of the critic's script with only the output paths changed). Seed 22, low line, TAP=1, measured with the critic's `analyze-audio.py` (same click detector). Clips are in `builder-audio/` (0.26 to 0.68 MB each). The raw capture is in the session scratchpad.

| Clip | Peak dBFS | Loudness (LUFS-like) | Below 150 Hz | Above 6 kHz | Phone band | Clicks music / master |
|---|---|---|---|---|---|---|
| title | -4.1 | **-17.4** (round 10: -32.7) | **35.0%** (73%) | 0.0% | -18.7 (-37.3) | 0 / 0 |
| run-chain0 | -2.8 | **-16.6** (-27.6) | 36.4% | 0.03% | -17.7 | 0 / 0 |
| run-chain3 | -1.9 | **-15.9** (-25.1) | 41.8% | 0.22% | -17.9 | 0 / 0 (was 10 / 4) |
| last-10s | -2.0 | **-16.6** (-26.3) | 44.3% | 0.21% | -19.1 | 0 / 0 (was 47 / 11) |
| medal-fanfare-1 | -1.8 | -16.2 | 33.3% | 0.63% | -18.3 | 0 / 0 |
| medal-fanfare-2 | -2.0 | -15.5 | 32.4% | 0.70% | -17.4 | 0 / 0 (was 20) |
| game-over | -2.2 | -20.9 | 55.8% | 0.07% | -23.6 | 0 / 0 (was 2) |

- **Clicks:** 0 on every clip, music bus and master.
- **Peaks:** highest -1.8 dBFS. 0 clipped samples.
- **Title phone band:** within 1 dB of the run (round 10: 10 dB below).
- **Loudness:** the run and title are in the -16 to -18 range. Run-chain3 at -15.9 is 0.1 dB above it, with SFX included.
- **Game over:** -20.9. It was not in the target. It swells in slowly under the sting.
- **Short-term loudness (3 s windows, forced-chain capture `quick-rep-analysis.log`):** title -17.7 to -17.0. Chain 3 -18.0 to -17.3. Hovering at chain 0 is about -19.5, because the rotor is quieter than in flight.
- **No pumping:** glue compressor reduction at most 0.6 dB. Limiter median 0 dB, worst 0.4 dB in music-only sections. It reaches about 2 dB only during boost with cues.
- **Fanfare over music:** 14.0 and 14.2 dB on the captured buses. The game meter says 16.3 (seed 22), 16.7 (58) and 17.5 (130).
- **Cues over the ducked music (round 10 method):** slip 7.6 (round 10: 4.6), pickup 9.9, delivery 16.0, medal 11.8, game over 8.6. All at least 6 dB.
  - Note for the critic: the ScriptProcessor capture lags the audio clock by about 0.18 s. With `OFF=0.18` (the analyzer's own correction argument), the measured ducks match their set values (slip -7.5 against -6.9). The margins become slip 12.3, pickup 12.4, delivery 17.5, medal 22.1 and game over 37.0. Without it, the window takes in about 80 ms of music from before the duck, so those margins jump around from run to run.
- **Repetition:** the music bus is held at one chain level for 70 s (`quick-audio.mjs` REP=1). At chain 0 and chain 3, the highest correlation at any lag under 30 s is 0.65 (round 10: 0.86 at 7.68 s). The first correlation of 0.8 or more is at **61.4 s** (0.95 and 0.98), where the chords come round again. Exact note-for-note repetition is every 184 s.

## 5. Round 10 behaviour and regressions

- **Adaptive music:** chain 3+ above chain 0 on all 3 seeds. Mean intensity at chain 0 / chain 3: seed 22 0.37 / 0.86, seed 58 0.36 / 0.84, seed 130 0.32 / 0.87.
- **Last 10 s:** the final section starts at 9.98, 10.00 and 9.98 s left.
- **Scheduler:** late 0, resyncs 0, page errors 0.
- **Toggle** (`toggle.log`): the chip and the M key work. "Music off" writes 0, survives a reload, and stays off after the next gesture. Same on desktop and iPhone 13 held sideways.
- **Medals:**
  - Low line: Silver 3,768, Bronze 1,792, Silver 2,712.
  - High line: Silver 4,052, 4,123 and 3,755. No Ace.
  - Lazy bot: Bronze 1,728, then 741 and 255 with no medal. Bronze at most.
  - The breakdown adds up in all 9 runs (diagnostics and game-over DOM).
- **Crash-classify, 8 seeds:**
  - 12 m: 661 s, 36 charged, **0 hop-like**.
  - 20 m: 757 s, 28 charged, **0 hop-like**.
  - **0 on a pad lip.** Seven of the near-target hits are on building faces at street pads (wall tops 10.6 to 58.6 m). The eighth is on seed 7 at 20 m: a face 18 m from a rooftop pad (wall top 33 m, pad at 32.5 m).
- **Flat-frame probe:** 839 frames, **0 flat**.
- **Frame time** (desktop medal journey, music on): 12,834 frames, median 8.30 ms, **p95 10.00 ms** (round 10: 9.00), max 10.5, 0 over 20 ms.
- **Build:** `npm run build` passes. JS 725 KB.
- The timing-sensitive scripts ran one at a time (`queue11.sh`, `queue11.log`).

## Scripts (`progress/round-11/builder-scripts/`)

- `click-repro.mjs`: offline proof of the click cause and the fix.
- `quick-audio.mjs` and `quick-analyze.py`: forced-chain capture, with loudness, short-term loudness, compressor reduction, the click detector and repetition. Use REP=1 for the 70 s holds and FLY=1 for a boosting flight.
- `bisect-master.mjs`: every master-bus input on its own channel.
- `rotor-edges.mjs`: rotor render that ruled the rotor out.
- `queue11.sh`: the full acceptance and regression queue. The rest are copies of the round 10 critic scripts with only the output paths changed (screenshots and raw audio go to the session scratchpad).
