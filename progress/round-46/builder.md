# Drone Dash, round 46 audio builder

Brief: a second soundtrack, "Breakbeat". The owner can switch to it and compare it with the current one, "Classic", which did not change. Also the audio leftovers A to H from round 45. Inputs: `round-45/gemini-argon-audio-review.md` (music direction, items 5, 6, 9), `round-45/critic.md`, `round-45/codex-review.md`, `round-45/builder.md`.

## Summary

- **Breakbeat is in and switchable.** A procedural liquid drum and bass soundtrack at 168 BPM in F Dorian. It has a title loop, an adaptive run, a last-10-s build with a drop at overtime, and a half-time game-over loop with a medal sting. Classic is still the default and its score did not change.
- **The switch.** "Music: Classic / Breakbeat" and "Effects on / off" sit on the title card and the pause card. Both are remembered. `?music=breakbeat` or `?music=classic` sets the soundtrack for one page. N still turns the music on or off.
- **Loudness.** Classic's run is at -16.0 LUFS, with the title and game over at -15.6. Breakbeat's run is at -15.8, with the title and game over at -16.8. The highest true peak in any clip is -4.7 dBTP.
- **Repeats and timing.** Breakbeat repeats exactly only after 96 bars (137 s). Its layers change on the next downbeat, at most 1.35 s after the game event.
- **Chimes.** 96% of Breakbeat's chime notes are on the chord that plays. For Classic it is 87%.
- **A to H.** All done, with numbers below. The live audio graph stays flat for 5 minutes (150 to 232 connected nodes), and 11,373 one-shot graphs were disconnected.
- **No regressions.**
  - 0 flat frames.
  - p95 at most 7.9 ms on desktop and 5.8 ms on the phone, with either soundtrack.
  - First load 3.62 MB.
  - Release smoke test: 0 failed requests and one session-complete call per run, with both soundtracks.
  - No chunk warning.
- **Time.** About 1 h 35 min of the 2.5 h box (07:15 to 08:50).


## The Breakbeat soundtrack: musical design

All of it is synthesised in code (`src/systems/breakbeat.ts`). It uses no samples, adds no file and adds 0 bytes to the load. Classic's score and sound did not change (`music.ts` is untouched). Classic's level on the menus and its medal fanfare did change, see items F and "Chimes and fanfares".

**Tempo and key.** 168 BPM (one 16th = 0.089 s, one bar = 1.43 s). F Dorian, with the borrowed D flat major seventh for colour. Chords are ninths and thirteenths: Fm9, B♭13, E♭maj9, A♭maj9, D♭maj9 and C9sus4 (only before the drop).

**Instruments.** Only the sources and their envelope gains are new per note. Every filter, the tremolo, the panners, the echo and the buses are built once.

| Part | How it is made |
|---|---|
| Kick | A sine that falls from 170 to 50 Hz in 90 ms. A 30 ms hold gives punch. A 12 ms noise click is the beater. |
| Snare | A triangle body (200 to 165 Hz). A wide band of noise at 3 kHz with a fast drop and a 0.1 to 0.2 s tail. Ghost notes are the same, quieter and shorter. |
| Hats, shaker | Noise through a shared 7.6 kHz highpass (hats) or a 6.2 kHz band (shaker). The 16ths are shuffled: every off-16th is 12 ms late. Velocities accent the off-eighths, the liquid "tss". |
| Ride, crash | Noise through a 5.4 kHz band with a 2.96 kHz bell ping (ride). Noise through a 3.8 kHz highpass with a 1.6 s tail (crash). |
| Sub | A sine on the chord root in octave 2 (65 to 123 Hz). It plays one long note per kick and never overlaps. |
| Saw bass | A soft (band-limited) saw, an octave above the sub. A resonant lowpass opens with the chain (300 Hz at x0, 700 Hz at x3) and closes in the last 10 s. Its riff changes per section. |
| Rhodes | An FM tine per note: a sine carrier with a ratio-1 modulator whose index falls from 1.5 to 0.12 in 0.35 s. That gives a bright strike that settles into a warm tone. Then a lowpass that opens with the chain, a 4.6 Hz tremolo and a 2.3 Hz auto-pan (a stereo tremolo). Voicings are rootless, around middle C. |
| Plucks | A soft saw through a resonant 2.6 kHz lowpass with a 0.2 s decay, into a dotted-eighth echo (0.27 s) panned a little right. |
| Lead | A sine plus a quiet detuned soft saw, with a small pitch scoop at the start. It plays F minor pentatonic motifs. A note a minor ninth over a chord tone moves down onto the chord. |
| Stabs | The top three chord tones an octave up, two detuned soft saws each, through a filter blip. |
| Riser | Noise through a band sweeping from 500 Hz to 7 kHz over 4 bars, cut on the downbeat. |

**Sections and form.**

- **Run.** 32 bars of chords: four 8-bar sections, one chord per 2 bars.
  - A: Fm9, B♭13, Fm9, B♭13.
  - B: D♭maj9, E♭maj9, Fm9, A♭maj9.
  - C: Fm9, B♭13, A♭maj9, D♭maj9.
  - D: A♭maj9, E♭maj9, D♭maj9, E♭maj9.
  - Three groove variants change the kick pattern, the ghost notes, the bass riff and the Rhodes comping. They cycle every 3 sections, the chords every 4, and the lead motif order every 4. So the run only repeats exactly after **96 bars = 137 s**.
  - Every 8th bar has a snare fill, and the 4th bar a short one. A crash marks each new section from chain x2.
- **Title.** A gentle half-time loop: A♭maj9, D♭maj9, Fm9, B♭13, 2 bars each. Rhodes, a soft sub, a kick and a brushed snare on beat 3, a shaker and a slow pluck line.
- **Game over.** A warm half-time loop, 2 bars per chord:
  - With a medal: A♭maj9, D♭maj9, B♭13, E♭maj9. Climbing pluck bells from bronze, falling ones from silver and a slow lead from gold.
  - Without a medal: Fm9, D♭maj9, A♭maj9, E♭maj9.
- **Sting.**
  - With a medal: E♭ A♭ C rising, then a held A♭ major chord with its seventh and one bell per tier. It is in the chord the medal loop opens on.
  - Without a medal: the falling C A♭ F C, which is F minor, home for both soundtracks.

**Adaptive layers.** They are latched on the downbeat, so every change lands on a bar line. The longest wait is one bar (1.43 s).

| Game state | What plays |
|---|---|
| Chain x0 (base flight) | Kick, snare, 8th hats, sub, Rhodes (filter closed at 1.5 kHz), a quiet saw bass |
| Chain x1 | Shuffled 16th hats and a shaker. The Rhodes filter opens to 3.2 kHz. Fuller saw bass. |
| Chain x2 | Ghost snares, the pluck arpeggio, a crash on each section |
| Chain x3 | The lead and the ride |
| Close to the next medal | Open hats on the off-beats |
| Rush hour | Brass stabs on the push beats, an extra snare fill in bar 6 of each section |
| Last 10 s | D♭maj9, E♭maj9, Fm9, C9sus4, one a bar. The bass filter closes (620 to 155 Hz over 6 bars) and the sub thins. A snare roll doubles every two bars: 8ths, 16ths, then 32nds, rising in level. Plus a noise riser. The kick stops after bar 6. |
| Overtime | The drop on the next downbeat: a crash, the full groove at x3 with stabs and the lead, on the home vamp Fm9 and B♭13 |
| Game over | The half-time results loop and the medal sting |

**Transitions.**
- Layer changes wait for the next downbeat.
- Run to the last 10 s waits for the next downbeat (Classic: the next beat).
- Game over fades the run out over 150 ms under the sting.
- A soundtrack switch fades out over 0.25 s and starts the same scene on the new grid.

**Chimes and fanfares.** `chordNow()` asks the soundtrack that plays for its chord.
- Slipstream payouts, pickup and delivery bells, and the slipstream ticks follow the chord, as in round 45.
- The rush and overtime horns follow it in Breakbeat (Classic keeps its horns).
- The take-off arpeggio follows it too: Fm9 for Breakbeat.
- New for both soundtracks: the medal fanfare climbs the chord that plays, one chord tone higher per tier. In round 45 it climbed a whole tone per tier and left the key. Breakbeat's fanfare brass is a triangle, because a square's 3rd and 5th harmonics land off its ninth chords. Classic keeps its square.
- The ping-pong delay follows the tempo: 0.36 s for Classic, 0.27 s for Breakbeat.

**The switch.**
- Title card and pause card: a small row, "Music: Classic / Breakbeat" and "Effects on / off".
- N still turns the music on or off. Picking a soundtrack also turns the music on.
- The choice is saved in localStorage (`drone-dash-track-v1`, `drone-dash-sfx-v1`) through the guarded `storeGet` and `storeSet`, plus try/catch.
- `?music=breakbeat` or `?music=classic` wins for that page and is not saved.
- Classic stays the default.
- Test hooks: `__GAME__.soundtrack(t)` and `__GAME__.sfx(on)`. The diagnostics report `audio.music.soundtrack`, `sfxEnabled` and `chordPcs`, and `audio.sfx.liveOneShots`, `reapedOneShots` and `lastPassNear`.
- On short phone screens held sideways, the title card tightens (gap 3 px, smaller chips), so the Best line stays on screen. That was checked on the SE (568x320), the iPhone 13 and a 640x360 phone.

## Measurements

**How they were made.**
- Both soundtracks were recorded with the same ten clip definitions as round 45: same seed, routes, pilot, tap and clip plan (`builder-scripts/rec46b.mjs`, `analyze46b.py`).
- The clips are in `builder-audio/classic/` and `builder-audio/breakbeat/`. Each clip is a WAV (48 kHz, stereo, 24-bit) and an MP3 (192 kbps). The largest MP3 is 2.2 MB.
- Each folder also has `timelines.txt` and `audio-measurements.json`.
- Breakbeat also has `11-breakbeat-90s-continuous`: 90 s from take-off, unedited.
- One change to the sessions: the overtime session starts with a 15 s clock (round 45: 22 s). With 22 s the pilot sometimes delivered in time and overtime never started. With 15 s it started in every final session.
- The pilot flies in real time, so the runs differ a little. Classic scored 7,910 (5 drops) and Breakbeat 7,272 (4 drops). Both won Gold with 0 crashes.

### Loudness, peaks, balance, clicks (per clip)

| Clip | Classic LUFS / TP | Breakbeat LUFS / TP | Classic under 100 Hz, 150 Hz-3 kHz, over 3 kHz | Breakbeat, same bands |
|---|---|---|---|---|
| 01 title | -15.6 / -6.3 | -16.8 / -5.3 | 36, 64, 0.0% | 23, 48, 0.4% |
| 02 take-off | -16.1 / -5.3 | -16.1 / -5.4 | 17, 56, 5.1% | 26, 41, 5.4% |
| 03 chain x3 | -15.9 / -5.4 | -15.7 / -5.1 | 17, 53, 3.4% | 22, 49, 3.2% |
| 04 boost | -14.6 / -5.2 | -14.5 / -5.2 | 12, 61, 19.3% | 18, 55, 13.3% |
| 05 scrape, crash | -17.3 / -4.9 | -16.5 / -5.0 | 35, 45, 2.1% | 36, 38, 2.7% |
| 06 pickup, delivery, medal | -16.1 / -5.2 | -16.1 / -5.1 | 14, 61, 5.4% | 24, 47, 2.9% |
| 07 rush, last 10 s, overtime | -16.5 / -4.7 | -16.0 / -4.7 | 22, 52, 4.0% | 31, 40, 6.7% |
| 08 harbour, street | -17.8 / -5.7 | -16.7 / -5.7 | 15, 64, 2.0% | 28, 37, 2.2% |
| 09 game over | -15.6 / -5.3 | -16.8 / -5.4 | 19, 46, 0.1% | 28, 43, 0.5% |
| 10 full run, 60 s | -16.0 / -5.2 | -15.8 / -5.1 | 14, 58, 4.3% | 25, 46, 4.0% |
| 11 Breakbeat, 90 s | | -15.8 / -5.0 | | 26, 45, 3.8% |

- **Run loudness.** Classic -16.0 LUFS, Breakbeat -15.8 (target about -16).
- **Game over against the run.** Classic +0.4 LU, Breakbeat -1.0 LU. The limit was 2 LU.
- **True peak.** The highest is -4.7 dBTP for both. The limit was -1.
- **Balance.** Breakbeat has more low end than Classic: 22 to 31% under 100 Hz in flight, against 12 to 22%. That is the sub and the kick of the style. I cut the sub by 11 dB from the first draft, which had 75 to 90% under 150 Hz. Its top end over 3 kHz is the same as Classic's (3 to 7% in flight).
- **Clicks (master).**
  - Breakbeat: 0 in all 11 clips.
  - Classic: 0 in 9 of 10. The one hit in clip 05 is during the test's `place()` teleport. The music, drone and ambience buses jump on the same sample, and the effects bus is silent. The scripted pause in the page drops a block of the recorder. It is not the game.
  - The music bus has 3 such hits in Breakbeat clips 02, 10 and 11, all the same kind: three buses on one sample, at the Enter press and at one long main-thread stall. None reaches the master detector.

### Rotor against the music (1 s windows in cruise, no cue, no duck; `cruise46b.py`)

| | All | Chain x0 | x1 | x2 | x3 |
|---|---|---|---|---|---|
| Classic | -3.0 dB | +0.4 | -2.1 | -2.0 | -4.5 |
| Breakbeat | -4.9 dB | -3.8 | -4.0 | -5.0 | -5.3 |

Breakbeat has drums from chain x0, so the rotor sits under the music even in cruise. That was the one open point of round 45: Classic is still +0.4 dB at x0.

### Exact-repeat period

- **From the score.** `period46.mjs` runs Breakbeat's `step()` against a fake audio context for 400 bars. It records every voice call and looks for the smallest lag after which every bar repeats. At each chain level, with and without rush hour, the lag is **96 bars = 137.1 s** (`period46.log`). Classic's score is unchanged: 96 bars = 184 s.
- **From the audio.** In the 90 s clip, the music bus's spectral similarity at whole-bar lags peaks at 0.60. That is at 1 bar and at 32 bars (45.7 s, the chord loop with different drums, bass and lead). No lag comes near an exact repeat.

### Adaptive layers at the right game events (`layers46.py`)

- **Breakbeat, main run.** 23 chain changes. In 18 of them the layer followed on the next downbeat: median 0.31 s, longest 1.35 s, never more than one bar (1.43 s). In the other 5 the chain changed again before that downbeat, so the music kept the layer it had.
- **Rush hour.** The stabs are reported 0.04 s after rush hour starts and play from the next bar.
- **Last 10 s.** The section starts on the next downbeat.
- **Overtime.** The drop came 0.08 s and 0.99 s after overtime started, in two runs.
- **Game over.** The loop and the sting start at once.
- **Classic.** 24 chain changes, every layer at once, as before.

### Chimes and fanfares in key (`chime46.py`)

For each cue, I take the 3 strongest pitch classes of the effects bus from 0.03 to 0.35 s after it. I compare them with the chord that plays (`chordPcs` from the game). The critic's round-45 method uses the 4 strongest pitch classes of the music bus instead.

| | Chord that plays | Critic's method | Payouts | Pickup | Delivery | Medal |
|---|---|---|---|---|---|---|
| Classic | 87% (97/111) | 77% | 88% | 100% | 78% | 67% |
| Breakbeat | 96% (104/108) | 73% | 97% | 100% | 100% | 78% |

- The critic's method reads lower for Breakbeat because its ninth chords have 5 notes and the method keeps only 4.
- The medal notes are chord tones by construction. The misses are harmonics of the brass: the 3rd and 5th harmonics of Classic's square, and of Breakbeat's triangle. Round 45's critic measured 76% before.

### Leftovers A to H

| Item | What changed | Number |
|---|---|---|
| A, codex high: one-shot graphs never disconnected | `reap()` disconnects each one-shot source and every temporary node (filters, gains, panners, sends, modulators) on `ended`. It covers samples, tones, noise, bells, servos, horns, the boost loop, pass-bys, Classic's notes and drums, and every Breakbeat voice. | `nodes46.mjs`: a 290 s run (Breakbeat, then Classic from 150 s, every chain level, the last-10-s section, 16 crashes and the game over). It hooks `AudioNode.connect` and `disconnect`. Connected nodes stayed between **150 and 232** (first 190, last 154), while **28,680** nodes were connected over the session and **11,373** one-shot graphs were disconnected. Live one-shots peaked at 36. Before the fix, every one of those graphs stayed attached. |
| B, codex low: rotor detune array every frame | `ROTOR_DET` is a module constant. | 0 allocations per frame in `updateRotor`. |
| C, codex low: sprite tails cut by the offset correction | The length follows the clamped start: `want + s.d - off`. It is bounded by the end of the buffer, and the stop time uses that length. | With a positive correction the window was already shifted, so its length stays `s.d`. The real cut was a negative correction clamped at 0, and that is fixed. The measured correction is 0 ms in Chromium, so nothing audible changes there. |
| D, critic: pass-bys 4.5 dB under the music | About +11 dB, weighted to close vehicles (closeness squared). Breakbeat adds 2 dB, because its music is hotter. The engine is a soft saw through an opening lowpass with a firing-rate growl. | Loudest 20 ms of the ambience bus against the music (the critic's method). Close pass-bys (closeness 0.6 or more): Classic **+5.0 dB** (28), Breakbeat **+4.4 dB** (32). Far ones: -1.6 and -2.1 dB, a background swish. Over the rotor, close ones are +4.8 and +6.0 dB. Before: -4.5 dB. |
| E, critic: pickup weaker than before | The bells come 60 ms earlier, about 5 dB louder and brighter, with a deeper duck (0.5). | Loudest 20 ms over the music, same method. Round 45 captures: **+7.2 dB** (critic +8.0). Now Classic **+15.3 dB**, Breakbeat **+13.1 dB**. |
| F, critic: menus 1.4 LU over the run | Per-soundtrack scene levels. Classic's title and game over come down 1.4 dB. Breakbeat's are set the same way. | Classic: title -15.6, run -16.0, game over -15.6 (**+0.4 LU**, was +1.4). Breakbeat: -16.8, -15.8, -16.8 (**-1.0 LU**). |
| G, critic: crash 3 to 4 dB too hot | Every crash layer x0.63 (**-4.0 dB** at the same impact strength): crunch, plate, knock, sub-drop and the synth fallback. | There is one crash per session, and its strength follows the impact speed. Peak on the effects bus: round 45 -8.1 dB, now -11.0 (Classic) and -9.6 (Breakbeat). Over the music: +23.7, now +20.9 and +23.1 dB. |
| H, critic: no effects switch | "Effects on / off" on the title and pause cards, remembered (`drone-dash-sfx-v1`). It gates the effects bus, the drone bus and the ambience (a new gate after its duck), and cues stop scheduling while it is off. | `sfxoff46.mjs`, in flight. Effects off: effects bus -150 dB, drone -111 dB (from -32), ambience -120 dB (from -41). A boost press while off: all three -150 dB. On again: restored. The music keeps playing, and the setting survives a reload (`ui46.log`). |

## Regressions and budgets

| Check | Result |
|---|---|
| Flat-frame probe, bloom on (`flat46-*.log`) | Classic 911 frames, Breakbeat 930 frames: **0 flat** |
| p95 frame time, no frame cap, normal / rush (`perf46-*.log`) | Desktop Classic 7.8 / 7.3 ms, Breakbeat 7.9 / 7.5 ms. iPhone 13 Classic 5.7 / 5.1 ms, Breakbeat 5.8 / 5.0 ms. Round 45: 7.8 / 7.0 and 5.4 / 4.9. All under 12 ms. |
| Long tasks after Play, production build (`longtask46-*.log`) | **0** on desktop and iPhone 13, both soundtracks |
| First load (production build, every request) | **3.62 MB** in 23 requests. Breakbeat adds no file. |
| Release smoke test: production build under `/nested/game/` in a cross-origin iframe, `?seed=22&slLaunch=x` (`platform46-classic.log`, `platform46-breakbeat.log` with `&music=breakbeat`) | Both soundtracks, desktop with the mock, without it, and on the phone: **0 failed requests**, 0 bad responses, 0 errors, 0 console lines. **One session-complete call per run**: 1 after run 1, 2 after run 2, still 2 after leaving. Without the mock: 0 calls, one event per run. Seed parity with dev holds. |
| Phone, real tap and a full run (`platform46-phone.log`) | 1 call (5,290 points, Silver, 4 drops), 0 failed, 0 errors |
| `npm run build` (`build46b.log`) | Built in 0.34 s, **no chunk warning**. three.js is still the largest chunk at 588 kB. |
| Sound controls on small screens (`ui46.log`, `fit46.log`) | Every title-card line is on screen at 1280x720, iPhone 13, SE 568x320 and 640x360. The pause row is in view. Clicks switch the soundtrack and the effects and are remembered after a reload. The URL flag wins for the page without being saved. 0 page errors. |
| Kept | The bloom clamps, the `#app` visibility rule and every debug hook. New hooks: `soundtrack()`, `sfx()`, plus `chordPcs`, `liveOneShots`, `reapedOneShots` and `lastPassNear` in the diagnostics. |

## Files changed

- `src/systems/breakbeat.ts` (new): the Breakbeat score, its voices and its layer logic.
- `src/systems/AudioSystem.ts`:
  - The soundtrack switch and the effects switch.
  - A per-track step length, scene levels and tone filter. The chord source for chimes comes from the active soundtrack.
  - Track-aware horns, sting and take-off. The medal fanfare on chord tones.
  - One-shot clean-up (A), the rotor constant (B) and the sprite length (C).
  - Pass-bys (D), pickup (E), menu levels (F), crash (G) and the effects switch (H).
  - Diagnostics, and the ambience tap after its gate.
- `src/game/Game.ts`: the sound buttons, rush hour into the music, and the `soundtrack` and `sfx` test hooks.
- `src/ui/Hud.ts`: `setSound` and the buttons.
- `index.html`: the sound row on the title card and the pause card. The help line says "N music on/off".
- `src/styles.css`: the sound row, and a tighter title card on short screens.
- `src/vite-env.d.ts`: hook typings.
- `ASSETS.md`: Breakbeat is procedural (no files, no bytes).
- `progress/round-46/`: this file, `builder-audio/` (both soundtracks) and `builder-scripts/` (every script and log). `jobs46-final.sh` and `jobs46-last.sh` are the final queues.

## Open points for the critic

- Breakbeat has more low end than Classic (22 to 31% under 100 Hz in flight). On phone speakers the kick and sub will mostly vanish. The Rhodes, hats and plucks carry the track there.
- The crash reduction is exact in code (-4 dB), but each recording has only one crash, at a different strength.
- Breakbeat's medal fanfare is 78% on the chord, Classic's 67%. The notes are chord tones, but the brass harmonics count against them.
- I have no ears in this setup. Every judgement of how it sounds comes from measurements.
- Servers: my dev server on 5199 and static servers on 5193 to 5195 are all stopped. The owner's 5188 was not touched. I ran no git commands that change state.

