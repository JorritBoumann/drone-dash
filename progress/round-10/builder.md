# Drone Dash, round 10 builder: adaptive music

Concern: the game had no music. The title was silent, and nothing in the audio followed the chain, the clock or a medal chase.

## Musical design

- **Key and tempo.** C major at 125 BPM, on a 16th-note grid (one step = 0.12 s). The medal fanfare uses the same grid: its notes are 0.12 s apart. The start sting notes are 0.06 s apart. The pickup and delivery chimes are C major. The slipstream ticks climb D-F-Ab-B, and the no-medal game-over sting falls C-Ab-F-C. So the borrowed chords Ab, Bb and Fm come from sounds that are already in the game.
- **Title loop.** Fmaj7, Em7, Dm7, Gsus, two bars per chord (about 15 s). It has a soft triangle pad and a bass note on each bar. A plucked eighth-note arpeggio has a dotted-eighth echo. Each chord gets one high bell. There are no drums. It fades in over 1.2 s after the first press.
- **Run track.** C, Am, F, G, one chord per bar. The layers build with the slipstream chain:

| Chain | Section (`audio.music.section`) | `layer` | Layers playing | Target intensity |
|---|---|---|---|---|
| 0 | base | 1 | pad + syncopated bass | 0.30 |
| 1 | drums | 2 | + kick on 1 and 3, offbeat hats, octave bass pickup | 0.50 |
| 2 | arp | 3 | + four-on-the-floor kick, eighth-note arpeggio | 0.68 |
| 3+ | lead | 4 | + claps on 2 and 4, 16th arpeggio, ghost hats, lead melody | 0.85 |

  A close medal chase (the last 15% of the way to the next medal) adds ghost hats and +0.05 intensity. The pad lowpass opens from 450 Hz to 2.1 kHz as intensity rises (smoothed, about 0.6 s).
- **Last 10 s ("final", layer 5).** The harmony changes to Ab, Bb, Ab, G7. The bass plays driving eighth-note octaves. The section adds four-on-the-floor, claps, 16th hats, a 16th arpeggio and a ticking high C on the eighths. Target intensity is 0.92 to 0.98. The change lands on the next beat, so the groove stays in time. If a time bonus lifts the clock above 12 s, the run section comes back. The gap between 10 s and 12 s stops the music from flipping back and forth.
- **Game over.** The sting depends on the medal. With no medal it is the old falling C-Ab-F-C. With a medal it is a rising G-C-E with a held C major chord and one bell for each tier. A slow loop then swells in over 1.8 s under the sting:
  - No medal ("calm"): Fm, C, Am, Gsus with a falling sigh note.
  - With a medal: C, Fmaj7, Am, G with bells that climb the chord. Silver adds a falling line. Gold and Ace add a quiet octave sparkle.
- **Ducking.** The music bus has its own duck gain. Each cue sets a depth and a hold time, and overlapping ducks keep the deeper level and the later end.

| Cue | Duck level | Hold |
|---|---|---|
| Medal fanfare (timed to the banner delay) | 0.28 (−11 dB) | 1.25 s |
| Crash | 0.35 | 0.55 s |
| Delivery | 0.45 | 0.7 s |
| Game-over sting | 0.5 | 1.0 s |
| Pickup | 0.6 | 0.35 s |
| Slip payout | 0.7 | 0.25 s |

- **Mix and safety.** The music runs at 0.5 of the 0.8 master. It goes through a 55 Hz highpass and a 6.5 kHz lowpass, so there are no harsh highs. Small speakers cannot play notes below 55 Hz, and those notes waste headroom. Hats are band-passed at 7.2 kHz at very low level. Bass sits in octave 2-3 (73 to 130 Hz) with triangle harmonics, so phones still reproduce it. The master is now glue compressor (−14 dB, 4:1), then a brick-wall limiter (−2 dB, 20:1, 2 ms attack). The music never uses the `square` oscillator. The fanfare brass stays the only square wave below 1 kHz, which the critic's fanfare count depends on.
- **Scheduler.** A lookahead scheduler on `AudioContext.currentTime` schedules 0.2 s ahead. It wakes on a 25 ms interval and also on every game frame. There is no setTimeout per note. A note scheduled with a start time in the past counts as `late`. If the timer was starved for more than 0.25 s, the grid skips forward. That skip counts as `resyncs`, and no burst of notes plays. When music is off, nothing is scheduled. On the title and game-over screens a hidden tab suspends the context. When the tab is visible again, the context resumes. Cost is about 40 short oscillator or noise nodes a second at full intensity. There is one shared filter per drum voice and one echo delay. No second convolver was added.
- **Gesture and title.** Any pointerdown, touchend, click or keydown anywhere (the title card too) starts the AudioContext. The title loop then plays. Pressing Play still starts the run in one press. Until then a pulsing amber chip at the top right reads "Click or press a key for sound" (desktop) or "Tap for sound" (touch).
- **Music toggle.** The chip turns into "Music on" or "Music off" after the first press. It shows on the title, pause (below the pause button) and game-over screens. The M key toggles music anywhere. The setting is stored in localStorage `drone-dash-music-v1`, wrapped in try/catch. It only affects music: SFX and the rotor are unchanged. There was no existing sound toggle.

## Diagnostics and hooks

- `diagnostics.audio = { state, music: { enabled, unlocked, playing, track, section, layer, layers, intensity, target, chain, chase, bpm, gain, duck, ducks, lastDuck, late, resyncs, notes, meter, lastFanfare } }`
- `__GAME__.audioMeter(true)` reads the RMS of the music bus and the SFX bus with AnalyserNodes every frame. For each medal fanfare it records `lastFanfare = { sfxRmsDb, sfxPeakDb, musicRmsDb, musicBeforeDb, marginDb }` over the 1.2 s fanfare window.
- `__GAME__.music(on)` works like the chip.
- All existing hooks are unchanged (`start`, `advance`, `externalClock`, `tune`, `place`, `sites`, test hooks). The bloom clamps in `ObjectiveMarker.ts` are untouched.

## Files changed

- `src/systems/AudioSystem.ts`: limiter, music bus, layer buses, sequencer, ducking, meters, `musicInfo()`, medal-aware `gameOver(tier)`, ducks on the cues.
- `src/systems/music.ts` (new): chords, progressions, lead line and patterns. Data only.
- `src/game/Game.ts`:
  - gesture unlock anywhere and scene changes (title, run, over)
  - `setRunState(chain, timeLeft, chase)` and `musicFrame(dt)` each frame
  - chip and M key
  - hidden-tab suspend on title and over
  - `audio` in diagnostics, `audioMeter` and `music` hooks
- `src/ui/Hud.ts`: `musicButton`, `setMusic()`, `musicLocked`.
- `index.html`: `#music-toggle` chip.
- `src/styles.css`: chip styles. The chip pulses while locked. When reduced motion is set, it does not pulse.
- `src/vite-env.d.ts`: types for `audio`, `audioMeter` and `music`.

## Numbers (scripts and logs in `builder-scripts/`, shots in `builder-shots/`)

**1. Music on every screen** (`music-screens.mjs`, 10 s per screen, sampled every 0.5 s, `screens-desktop.log` and `screens-mobile.log`).

| Screen | Desktop: playing, min gain | iPhone 13 held sideways: playing, min gain | Track / section |
|---|---|---|---|
| Title (after the first click or tap on empty sky) | 20/20, 0.17 | 20/20, 0.20 | title / loop |
| Run | 20/20, 0.50 | 20/20, 0.50 | run / base |
| Game over | 20/20, 0.08 (swelling in) | 20/20, 0.08 | over / calm |

Before the first press: context `none`, playing false, and the chip invites the press (`m-01-title-before-press`, `d-01-title-before-press`). Page errors: 0.

**2. Follows the run** (`route-play-music.mjs` = round 9 `route-play-rt-x-m.mjs` with the same control and log-only music sampling, LINE=low, SIMT=400, `low-music.log`). Intensity is the median of samples where the chain level had held for 1.2 s or more.

| Seed | Chain 0 | Chain 3+ | Higher at 3+ | Last 10 s: before → in final | Layer before → final |
|---|---|---|---|---|---|
| 22 | 0.35 | 0.851 | yes | 0.709 → 0.958 | 3-4 → 5 |
| 58 | 0.317 | 0.85 | yes | 0.671 → 0.938 | 3-4 → 5 |
| 130 | 0.30 | 0.90 | yes | 0.845 → 0.98 | 4 → 5 |

3 of 3 on both checks. The high line (`m-high.log`) never chains past 1-2, stays at "base" at 0.30 and moves to final at 0.92 in 3 of 3.

**3. Fanfare audible.** Over the 1.2 s fanfare window, the SFX bus RMS minus the music bus RMS was:
- Low line, 5 fanfares: +12.7 to +17.6 dB.
- High line, 7 fanfares: +18.3 to +21.2 dB.

The duck reached 0.28 in every run. The music fell from about −30 to −35 dBFS open to −38 to −45 dBFS under the fanfare. The critic's fanfare count (square below 1 kHz) still equals the passes: low 2/1/2, high 2/2/3.

**4. Toggle.** The chip changes to off and stores "0". After a reload, music is still off (enabled false, playing false). M turns it on and stores "1", which survives a reload. Pass on desktop and mobile.

**5. Performance and scheduler.** Headless runs are capped at 120 Hz.

| Run | Frames | p95 | Max | Over 20 ms |
|---|---|---|---|---|
| Low line, 3 seeds | 10,099 to 13,089 | 9.0 to 9.1 ms | 16.7 ms | 0 |
| High line, 3 seeds | 14,607 to 19,512 | 9.1 to 9.2 ms | 17.6 ms | 0 |
| Hand-fly desktop | 9,580 | 9.60 ms (round 9: 9.20) | 10.4 ms | 0 |
| Hand-fly mobile | 9,578 | 9.70 ms (round 9: 9.30) | 10.4 ms | 0 |

Scheduler: **0 late events and 0 resyncs** in every run (low, high, hand-fly, screens). Music adds about 0.4 ms to p95, still under 12 ms.

## No regressions

- **crash-classify, 8 seeds, 0 hop-like at both heights:**
  - 12 m: 644 s, 19 deliveries, 30 charged (2.8/min).
  - 20 m: 779 s, 29 deliveries, 21 charged (1.6/min).
  - Verbose 12 m: 31 charged (3.1/min). Verbose 20 m: 29 charged (2.3/min).
- **Pad lip: 0.** Near-target crashes:
  - Three are building faces near street pads (0.4 m), with wall tops at 10.6, 14.7 and 20.2 m.
  - One is seed 7 near the Bay Lofts rooftop pad (32.5 m). The drone hit at 21 m, 12 m below the 33 m roof edge, so it hit the facade, not the lip.
- **Medals:**

| Pilot | Seed 22 | Seed 58 | Seed 130 | Result |
|---|---|---|---|---|
| Lazy (centre, 10 m/s, no boost) | 1,728 Bronze | 766 none | 255 none | Pass (Bronze at most) |
| Standard low | 3,658 Silver | 1,792 Bronze | 2,562 Silver | Pass (2 of 3) |
| High | 4,007 Silver | 4,123 Silver | 4,850 Gold | Pass (3 of 3) |

  - No Ace.
  - The breakdown and the game-over DOM add up in 9 of 9 runs.
  - The lazy seed 130 run made no delivery (round 9: 1,186). This is bot noise from real-time control. The music does not touch game state: it only reads chain, clock and score.
  - High seed 130 scored 4,850 (round 9: 5,466).
- **Flat-frame probe:** 958 frames, 0 flat.
- **Build:** `npm run build` passes. First load is about 0.76 MB: JS 723 KB, CSS 28 KB, HTML 9 KB. lil-gui loads only with `?debug`.

## Limits

- I did not listen to the music. The mix levels come from the meters: open music sits at about −30 to −35 dBFS RMS, 10 to 15 dB under the fanfare RMS before ducking. If it sounds too quiet on real speakers, raise `MUSIC_VOL` in `AudioSystem.ts` (0.5 now).
- Pausing still suspends the whole AudioContext (existing behaviour), so the pause screen is silent. The chip there still works.
- The medal fanfare lifts by a whole tone for each tier: D for Silver, E for Gold, F# for Ace. Above Bronze it is not strictly in C. The −11 dB duck keeps it clear of the music.
