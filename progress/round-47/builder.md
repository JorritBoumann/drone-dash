# Drone Dash, round 47 audio builder

Brief: the eight changes from Gemini's listening review (`round-46/gemini-argon-soundtrack-review.md`). The focus is the Breakbeat soundtrack and the shared effects. Classic gets the shared fixes where they help. Mid-round, the lead passed on the owner's choice: **Breakbeat is now the default soundtrack** (see "Default soundtrack" below).

## Summary

- **All eight items are in.** Everything is procedural. There is no new file, and the only sample change is how the existing Kenney tick plays (logged in `ASSETS.md`).
- **Key numbers, round 46 to round 47:**
  - **Room for the ticks.** Energy in 2 to 5 kHz in the last 10 s and overtime: Breakbeat 4.79% to 2.84% of the mix (-13.2 to -15.5 dB under full band). Classic 2.74% to 2.47%.
  - **Rotor at top speed.** Energy above 1.5 kHz: Breakbeat 27.9% to 21.1%, Classic 27.5% to 19.1%. The 1.5 to 5 kHz share fell from about 9% to about 5%.
  - **Overtime drop.** On the music bus: -34.3 dB in the beat before, -44.9 dB in the gap, -21.6 dB on the drop's first beat. Under 60 Hz it goes from -102 dB in the gap to -5.6 dB on the downbeat (the sub-drop).
  - **Drums no longer repeat exactly.** Same-pattern bars now differ by 2.04 dB on average (1.32 dB before, which was only the random noise). The backbeat's timing spread is 1.17 ms (0.15 ms before).
  - **Loudness.** Breakbeat runs -16.0 and -16.1 LUFS, game over -16.9. Classic run -16.8, game over -15.5. The highest true peak is -4.8 dBTP.
  - **Clicks.** 0 clicks from the game. The few detector hits left are capture artifacts (see Clicks).
- **No regressions.** The numbers are in the table at the end.
- **Time.** 08:53 to about 10:00, a little over 1 h of the 2.5 h box.

## What changed, per item

### 1. Drums: a hybrid kit with character, humanised (`breakbeat.ts`)

- **Kick.** A sine falling 230 to 95 Hz in 12 ms, then to 48 Hz by 70 ms (a short pitch drop). An 8 ms noise click through a 3.2 kHz band. Both go into a gentle soft clip (tanh, drive 1.6).
- **Snare.**
  - A triangle body falling 220 to 110 Hz in 45 ms.
  - Noise through a 2 kHz band into a harder soft clip (drive 2.4, 2x oversampled).
  - On the snare bus: +5 dB at 280 Hz, a top shelf, and a short room (a generated 0.3 s stereo burst in a convolver, built once, snare only).
- **Ghost notes.** Quieter (0.07 against 0.055 before, with a ±25% velocity spread). Their body is lower (190 to 120 Hz). Their noise skips the clip and goes through a 1.5 kHz low-pass, so they are darker and shorter.
- **Hats.** Each hit picks one of three shared colours: a dark band at 6.8 kHz, the 7.6 kHz high-pass, or a bright 9.8 kHz high-pass. Accents lean bright. Each hit also varies ±25% in level and ±30% in decay.
- **Humanised timing and velocity.** A seeded generator (the same every run), so bars differ but recordings repeat.
  - The off-16ths swing 12% of a step late, every time. The hats keep their 14% shuffle.
  - The backbeat sits 4 ms behind the grid.
  - Every hit gets a small nudge: kick ±1.2 ms, snare ±2 ms, ghosts ±4 ms, hats ±3 ms.
  - Velocity varies ±6 to 12%, ±25% on ghosts and the shaker.
  - The title and game-over loops get the same treatment, plus a soft ghost before the bar line.
- **Levels.** The drum bus sits at 0.72 (-2.9 dB), because the clipped kit with its room peaked about 3.5 dB higher. The kick body is at 0.85 of its old level, with a shorter tail.
- **Measured** (`drums47.mjs`, `drums47.log`). This renders 16 run bars at chain x2 offline in Chromium, drums only, for the round 46 copy (`bb46/`) and the new code. It compares bars that play the same pattern.

| | Round 46 | Round 47 |
|---|---|---|
| Mean difference of the 5 ms envelope between same-pattern bars | 1.32 dB (noise only) | **2.04 dB** |
| Per pair | 0.95 to 1.72 dB | 1.61 to 2.77 dB |
| Snare on beat 2: onset mean / spread | 0.75 / 0.15 ms | 6.43 / **1.17 ms** |

### 2. Rotor: a small pitch rise, chop and air instead of shrill harmonics (`AudioSystem.ts`)

- **Pitch.** It was 92 + 58·speed + 24·effort + 36 (boost) + 6·altitude Hz: up to about +120% at top speed with the boost. Now it is 96 + 18·speed + 8·effort + 4 (boost) + 2·altitude Hz: **at most +33%**. Measured at top speed with the boost (`rotorHz` in the diagnostics): 121 to 126 Hz, against 96 Hz in a hover, so +26 to +31%.
- **Blade chop.** The two beating LFOs now run at 35 to 55 Hz (35 + 17·speed, +3 with the boost). Before, they ran at the blade rate (46 to 108 Hz). Their depth on the rotor and on its air grows with speed (0.35 to 1.15 times the base depth).
- **Tonal rotor.** Its low-pass stays at 1,050 to 1,400 Hz. It used to open to 4 kHz.
- **Chop air.** A low band at 700 to 1,100 Hz (it was 2.3 to 4.8 kHz) that gets louder with speed (0.14 to 0.46).
- **Air noise.** 20% lower.
- **Drone bus.** A notch at 2.2 kHz (Q 1.2) between the drone bus and its duck. It applies to the rotor, chop, air, slipstream and burner.
- **Measured** (`measure47.py`, drone bus in 0.3 s windows at 90% or more of top speed, almost all boosting):

| | Above 1.5 kHz | 1.5 to 5 kHz | 30 to 400 Hz | Drone bus level |
|---|---|---|---|---|
| Breakbeat, round 46 | 27.9% | 9.3% | 63.3% | -33.8 dB |
| Breakbeat, round 47 | **21.1%** | **5.4%** | 68.2% | -36.1 dB |
| Classic, round 46 | 27.5% | 9.1% | 62.5% | -33.7 dB |
| Classic, round 47 | **19.1%** (first pass 22.6%) | **4.9%** (5.6%) | 67.5% | -36.6 dB |

  - The remaining energy above 1.5 kHz is mostly the 3.2 to 7.5 kHz air noise, which is wind, not harmonics.
  - The Classic final pass had only 10 top-speed windows. The first pass on the same rotor code had 17, so both are listed.

### 3. A short gap before overtime, then a sub-drop (`breakbeat.ts`, `AudioSystem.ts`)

- **The gap.** In the last 10 s, the last beat before the overtime drop is a gap:
  - The drum, sub and bass buses mute (6 ms).
  - A high-pass on the whole soundtrack sweeps from 10 Hz to 240 Hz in 30 ms, then to 700 Hz across the beat.
  - The Rhodes, plucks and riser keep going. The riser now runs outside the drum gate.
- **The drop.** On the downbeat, everything comes back in 4 ms with the crash, plus a sub-drop: a sine falling 110 to 32 Hz over 0.75 s.
- **Timing.**
  - AudioSystem predicts the moment the clock reaches 0 with a parcel aboard. It measures the game clock's rate against the audio clock, because in headless runs the game clock ran about 20% slow.
  - The clock can run out inside the bar's last beat, at least 0.3 s before the downbeat (the scheduler's 0.2 s lookahead plus a margin). Then that beat is the gap, and the drop lands on the downbeat.
  - When the prediction misses, overtime that starts during the last beat still gets the rest of that beat as a shorter gap. Otherwise the drop waits for the next bar's last beat, at most about 1.8 s later. Round 46 dropped on the next downbeat, at most 1.43 s later.
  - Breakbeat's overtime horn now ducks for 0.35 s plus 0.3 s, not 0.8 s plus 0.5 s, so the duck no longer covers the drop. The horn now sounds in the gap.
- **Classic** has no drop to set up, so this item is Breakbeat only.
- **Measured** with `measure47.py` in the overtime session, from the game's own audio-clock times.
  - The gap came at 43.682 s and the drop at 44.039 s, so the gap lasted one beat (0.357 s). Counts: `gaps 1, drops 1, deferred 0`, so it was predicted on the first try. In clip 07 the gap is at 21.2 s and the drop at 21.5 s.

| Bus | Beat before the gap | Gap | First beat of the drop |
|---|---|---|---|
| Music bus | -34.3 dB (under the horn's duck) | **-44.9 dB** | **-21.6 dB** |
| Music under 60 Hz | | -102 dB | **-5.6 dB** (sub-drop) |
| Master | -18.4 dB | -17.7 dB | -16.7 dB |

  - On the master, the overtime horn fills the gap, so the dip shows on the music, not on the whole mix.
  - The 50 ms profile is in `measure47-breakbeat.log`.
  - The first headless try exposed two things, both fixed: the clock-rate drift, and a pilot that delivered before the drop's downbeat (see "Recording").

### 4. Brass stabs and horns (`breakbeat.ts` stab, `AudioSystem.ts` horn)

- **Stabs.** The chord's top three keys an octave up:
  - Three real saws per note (-11, 0, +9 cents), so 9 oscillators, against 6 soft saws before.
  - A fast pitch blip on every note: 60 cents flat, 7 cents over at 18 ms, on pitch at 40 ms.
  - A two-stage low-pass: 420 Hz to 3 kHz in 8 ms, down to 1.4 kHz by 60 ms, then to 650 Hz by 240 ms, Q 1.6.
  - A held level to 70 ms. Then a shared soft clip (drive 2.2, 2x oversampled) with a -3 dB dip at 3 kHz.
- **Horns.** The rush-hour and overtime horns on both soundtracks use the same recipe, through their own shared clip and 3 kHz dip. Their filter peak is at most five times the note, and never over 3.2 kHz.
- **Not measured.** "Cheap sound-card brass" is a listening judgement, so this item has no number. It is for the critic's ears.

### 5. Room in 1 to 3 kHz: a stereo slipstream and a keys dip

- **Slipstream.** The decorrelated stereo wind noise feeds two band-passes:
  - The left one at f (Q 1.6) and the right one at 1.47 f (Q 2.0). Each is panned about 60% to its side.
  - Then a -7 dB peak cut at 1.5 kHz on the slipstream's own path, then the tremolo, the level and the wall-side pan (narrower: at most ±0.6).
  - f = 520 + 380·meter + 120·intensity + 40·chain + a gust term, so about 0.5 to 1.2 kHz. It was a single Q-5 band from 750 Hz to 2.9 kHz, which rose like a synth riser.
  - The level is up a little (0.34 against 0.26) for the lower Q.
- **Keys dip.** While drafting, Breakbeat's Rhodes and Classic's pad dip at 1.2 kHz by up to 4.5 dB. It is a peak filter in the keys chain and after the pad's filter. The dip follows the slipstream intensity.
- **Measured.** In the last 10 s, the drone bus's 2 to 5 kHz band fell from 52.0 to 46.7 dB (`busband47.log`, summed bands). The round 47 window is longer, so the real fall is larger.

### 6. Last 10 s: a melodic low-pass and a soft FM tick

- **Breakbeat.**
  - Keys, plucks, their echo, the lead and the stabs now share one low-pass. It sits at 2.4 kHz in the last 10 s, 3.4 kHz in the drop and 16 kHz elsewhere.
  - In the last 10 s the snare roll's top shelf is also darker: -9 dB from 1.9 kHz, -5 dB from 3.2 kHz in the drop, -3 dB from 5.2 kHz elsewhere. The first pass, without this, left Breakbeat's 2 to 5 kHz share at 4.97%, above round 46.
  - The dark hat colour moved to a narrower band at 6.8 kHz.
- **Classic.** The pad, arp, lead and the ticking urgency layer now share one low-pass. It sits at 2.4 kHz in the last 10 s and 16 kHz elsewhere. The drums keep their air.
- **Tick.** A new FM mallet:
  - A sine carrier and a ratio-3.5 modulator whose index dies in 25 ms. Decay 0.14 s, low-passed at 2.6 kHz, a little reverb.
  - It climbs the chord that plays, one chord tone a second, from the first tone at or above C5 (about 520 to 1,100 Hz).
  - Alternate ticks are panned -0.28 and +0.28.
  - The old Kenney tick still sits under it, quietly (rate 0.7, low-passed at 2.4 kHz, same pan).
  - The heartbeat in the last 3 s is unchanged.
- **Measured** (`measure47.py`, master, every 0.5 s window of the last 10 s and overtime in the overtime session):

| | 2 to 5 kHz share | 2 to 5 kHz under full band | Above 5 kHz |
|---|---|---|---|
| Breakbeat, round 46 | 4.79% | -13.2 dB | 4.42% |
| Breakbeat, round 47 | **2.84%** | **-15.5 dB** | 1.77% |
| Classic, round 46 | 2.74% | -15.6 dB | 2.44% |
| Classic, round 47 | **2.47%** | **-16.1 dB** | 1.59% |

### 7. A human lead and Rhodes (`breakbeat.ts`)

- **Lead.**
  - Delayed vibrato on notes longer than 0.22 s: a 5.2 to 5.7 Hz LFO whose depth is 0 until 0.16 s, then rises to ±0.7% (about 12 cents) by 0.45 s.
  - The saw's low-pass follows the note: 4.2 times the pitch, kept between 1.6 and 3.6 kHz.
  - The low-pass softens to 60% over a sustained note.
  - Velocity varies ±8%.
- **Rhodes.**
  - Each voice gets a random velocity (±18%). The FM index, and so the strike's brightness, follows it: from 0.55 to 1.13 times a base of 1.25. Its decay time follows too.
  - The attack is 6 ms (it was 4 ms).
  - The strum is uneven: 3 to 7 ms per voice.

### 8. Impacts in the shared room

- **Impact bus.** A new bus feeds the shared reverb through a 250 Hz high-pass.
- **What sends to it.**
  - The crash's crunch (0.7), plate (0.6) and knock (0.5). Before, only crunch 0.3 and plate 0.2 went in, straight and unfiltered.
  - The light-hit knock (0.5) and the scrape grains (0.3).
- **The knocks.** They now have a 4.5 kHz low-pass and a 3 to 4 ms onset. Their raw edge set off the click detector at light hits in the first pass.
- **Game over.** The game-over sting has no impact sample. Its tones already send to the same reverb.
- **Not measured.** This item is a listening change, with no separate number.

## Default soundtrack (the owner's choice, from the lead mid-round)

- **The rule** (`readTrackPref` in `AudioSystem.ts`). `?music=classic` or `?music=breakbeat` wins for the page and is not saved. Otherwise a saved `'classic'` gives Classic. No choice, `'breakbeat'` or any unknown value gives Breakbeat.
- **Also updated.** The comments in `AudioSystem.ts` and `breakbeat.ts`. The initial `aria-pressed` of the Music buttons on the title and pause cards in `index.html` (Breakbeat pressed). The HUD still syncs the buttons at start-up.
- **Not affected.** `README.md` does not mention the soundtrack. No test in `tests/` assumes Classic.
- **Probes.** My round 47 probes now pass `?music=classic` for Classic and no flag for Breakbeat.
- **Test** (`default47.mjs`, `default47.log`). Fresh contexts on the dev server: no choice, saved classic, saved breakbeat, saved unknown, `?music=classic`, `?music=classic` over a saved breakbeat, `?music=breakbeat` over a saved classic, `?music=foo`. **8 of 8 correct**, the title and pause buttons agree, 0 errors.

## Recording

- **Sessions.** The same six as round 46, with `rec47.mjs` (a copy of `rec46b.mjs`) and `analyze47.py` (a copy of `analyze46b.py`).
  - **Main:** title, run, game over.
  - **Effects:** scrape, crash, harbour, street.
  - **Overtime:** 15 s clock, rush hour into overtime.
- **What was cut.**
  - The clip definitions Gemini judged: 01 title, 03 chain x3, 07 rush hour into overtime, and 09 game over, for both soundtracks.
  - The other round 46 clips (02, 04, 05, 06, 08, 10).
  - Breakbeat's 11, 90 s continuous.
- **Files.** In `builder-audio/classic/` and `builder-audio/breakbeat/`: WAV (48 kHz, 24-bit) and MP3 (192 kbps), with `timelines.txt` and `audio-measurements.json`. The largest MP3 is 2.2 MB.
- **One change to the overtime session.** With `OT_HOLD=3`, the pilot hovers for 3 s at the start of overtime. In the first try it delivered within a second of overtime, and the run ended before the drop's downbeat.
- **Repeated sessions.** Two main sessions failed (0 drops, 3 crashes) and were recorded again. The pilot flies in real time and was likely disturbed by a compile I ran in parallel. The failed logs are in `first-pass/`.
- **The final runs.**
  - Breakbeat: 7,510 points, Gold, 4 drops, 0 crashes.
  - Classic: 2,733 points, Silver, 3 drops, 0 crashes. Classic's run was shorter, with fewer chain levels than round 46's (7,910), so its music is a little quieter.

### Loudness, peaks, low end, clicks (per clip)

| Clip | Classic LUFS / TP | Breakbeat LUFS / TP | Breakbeat under 100 Hz | Clicks, Classic / Breakbeat |
|---|---|---|---|---|
| 01 title | -15.5 / -6.3 | -16.8 / -5.4 | 26.6% | 0 / 0 |
| 02 take-off | -16.8 / -5.4 | -16.2 / -5.3 | 33.9% | 0 / 0 |
| 03 chain x3 | -16.2 / -5.3 | -15.8 / -5.4 | 40.7% | 0 / 0 |
| 04 boost | -16.6 / -5.6 | -15.2 / -5.2 | 25.9% | 0 / 0 |
| 05 scrape, crash | -17.3 / -4.8 | -16.7 / -5.0 | 42.6% | 0 / 1 (teleport) |
| 06 pickup, delivery, medal | -16.0 / -5.3 | -16.2 / -5.2 | 33.9% | 0 / 0 |
| 07 rush, last 10 s, overtime | -16.7 / -5.2 | -16.2 / -5.0 | 34.6% | 0 / 0 |
| 08 harbour, street | -17.7 / -6.0 | -17.0 / -5.4 | 36.9% | 6 (capture) / 0 |
| 09 game over | -15.5 / -5.4 | -16.9 / -5.2 | 34.4% | 2 (capture) / 0 |
| 10 full run, 60 s | -16.8 / -5.3 | -16.1 / -5.2 | 32.6% | 0 / 0 |
| 11 Breakbeat, 90 s | | -16.0 / -5.2 | 33.7% | / 0 |

- **Runs.** Breakbeat -16.1 and -16.0 LUFS. Classic -16.8 (round 46: -16.0). Classic's quieter run comes from a shorter, lower-chain run and a quieter rotor (-2 dB at top speed).
- **Game over against the run.** Breakbeat -0.8 LU, Classic +1.3 LU. The limit is 2 LU.
- **True peak.** The highest is -4.8 dBTP. The limit is -1.
- **Clicks, all checked by bus** (`clickbus47.py`, `blockcheck47.py`).
  - **Classic 08 and 09.** Every live bus (music, drone, ambience, reverb) jumps on the same sample. Some hits fall on 4,096-sample capture block boundaries. The others fall in the recorder's 3 s data dumps, which stall the page (the poll log shows a 0.58 s gap there).
  - **Breakbeat 05.** The scripted `place()` teleport before the scrape, which round 46 also reported.
  - **First pass.** It showed real musical clicks: the new kick click (0.5 ms attack through a high-pass), the knock samples at light hits, and one sharp kit transient in the game-over loop. All three were fixed (click 2 ms through a band-pass, knock low-pass and slower onset, kit attacks 2 to 2.5 ms) before the final recordings.
- **Low end.** Breakbeat's share under 100 Hz rose to 26 to 43% (round 46: 22 to 36%), from the sub-drop and a kick that keeps its weight through the soft clip. It is an open point.

## Regressions and budgets

| Check | Result |
|---|---|
| Flat-frame probe, bloom on (`flat47-*.log`) | Classic (`?music=classic`) 906 frames, Breakbeat (default) 910 frames: **0 flat** |
| p95 frame time, no frame cap, normal / rush (`perf47-*.log`) | Desktop: Classic 8.2 / 7.7 ms, Breakbeat 9.0 / 8.0 ms. iPhone 13: Classic 6.1 / 5.6 ms, Breakbeat 6.3 / 6.4 ms. Round 46 was about 1 ms lower (7.8 / 7.3 and 5.7 / 5.1). The new kit adds two 2x-oversampled clips and a small convolver. All are under 12 ms. |
| Long tasks after Play, production build (`longtask47-d-*.log`) | **0** with either soundtrack |
| First load (production build, every request) | **3.62 MB** in 23 requests, the same as round 46. No new file. |
| Release smoke test: production build under `/nested/game/` in a cross-origin iframe, `?seed=22&slLaunch=x` (`platform47-breakbeat.log` with the default, `platform47-classic.log` with `&music=classic`) | Both soundtracks, desktop with the mock, without it, and on the phone: **0 failed requests**, 0 bad responses, 0 errors, 0 console lines. **One session-complete call per run**: 1 after run 1, 2 after run 2, still 2 after leaving. Without the mock: 0 calls, one event per run. Seed parity with dev holds. |
| Phone, real tap and a full run (`platform47-phone.log`, now Breakbeat by default) | 1 call (5,289 points, Silver, 4 drops), 0 failed, 0 errors |
| Live audio nodes over 5 minutes (`nodes47.log`: 300 s, Breakbeat then Classic from 150 s, crashes, last 10 s, game over) | Connected nodes stayed between **188 and 272** (first 216, last 200, second half 188 to 233). 27,894 connected in total, and 11,139 one-shot graphs disconnected. Live one-shots peaked at 28. Flat. The floor is about 40 nodes higher than in round 46 (150 to 232): the new shared filters, clips and the snare room are built once. |
| `npm run build` (`build47.log`) | Built in 0.37 s, **no chunk warning**. three.js is still the largest chunk at 588 kB. |
| Default soundtrack (`default47.log`) | 8 of 8 cases correct, 0 errors |
| Kept | The bloom clamps, the `#app` visibility rule and every debug hook. None of those files changed. In `index.html` only the pressed button changed. New diagnostics: `audio.music.gap` and `audio.sfx.rotorHz`. |

## Files changed

- `src/systems/breakbeat.ts`:
  - The kit (kick, snare with room and boost, ghosts, hat colours) and the seeded humanisation.
  - The gap, drop and sub-drop. The melodic low-pass, the keys dip and the snare top per scene.
  - The new stabs, lead and Rhodes. The drum bus level.
  - `gapInfo` for tests. The header now names it the default.
- `src/systems/AudioSystem.ts`:
  - Rotor pitch, chop and filters, and the drone-bus notch.
  - The two-band slipstream with its 1.5 kHz cut, and the keys and pad dip.
  - The FM tick. The impact reverb bus and its sends, and the knock low-pass.
  - The horn redesign. Classic's melodic low-pass.
  - The overtime prediction (clock rate, `otSoon`) and the shorter Breakbeat overtime duck.
  - Diagnostics: `audio.music.gap` and `audio.sfx.rotorHz`.
  - Breakbeat as the default.
- `index.html`: Breakbeat pressed by default on the title and pause cards.
- `ASSETS.md`: the round 47 note (no new files).
- `progress/round-47/`: this file, `builder-audio/` (both soundtracks) and `builder-scripts/`.
  - Recorder, analysis and measures: `rec47.mjs`, `analyze47.py`, `measure47.py`, `busband47.py`, `clickbus47.py`, `blockcheck47.py`, `timeline47.py`.
  - Tests: `drums47.mjs` (with the round 46 copy in `bb46/`), `default47.mjs`.
  - Job queues: `jobs47-rec.sh`, `jobs47-rec2.sh`, `jobs47-checks.sh`.
  - All logs, with the first pass in `first-pass/`.

## Open points for the critic

- **Not measured.** Items 4 (brass), 7 (lead and Rhodes) and 8 (impact room) are listening changes with no number of their own. I have no ears in this setup.
- **Breakbeat's low end** is heavier than in round 46 (26 to 43% under 100 Hz). If it sounds boomy, the first levers are the kick body (0.85) and the sub-drop (0.16).
- **Late overtime.** Overtime can start too late in a bar for the prediction. Then the drop waits for the next bar's last beat, up to about 1.8 s after overtime starts (round 46: at most 1.43 s).
- **The live one-shot counter** (diagnostics) briefly reads negative at the run-to-last-10-s switch, in round 46's recordings too (-1 there, -6 here). The 5-minute node test below is the real leak check.
- **Servers.** Dev server on 5199 and static servers on 5193 to 5195, all stopped at the end. The owner's 5188 was not touched. I ran no git commands that change state.
