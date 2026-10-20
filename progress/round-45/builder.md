# Drone Dash, round 45 audio builder

Brief: sound effects, ambience and the mix. The music's style, tempo and composition did not change. Only its level, its ducking and its clicks changed. Inputs: `audio-critic.md`, `gemini-argon-audio-review.md` and `codex-audio-design-review.md`. All samples are CC0 Kenney files from `asset-src/kenney-audio/`. Nothing was downloaded. Time used: about 1 h 35 min of the 2.5 h box.

## Summary

- The rotor is new. It sits under the music in cruise: median **-3.4 dB** against the music. The critic's capture gives **+3.7 dB** with the same method.
- The mix has four sub-buses: music, drone, ambience and effects. One effects return carries a shared reverb, a slapback echo for narrow streets and a ping-pong delay for chimes. A glue compressor, a limiter and a trim follow. Priority cues duck the music, the drone and the ambience. Then all three recover.
- 22 Kenney files (24 slices) are in one MP3 sound sprite of 161 KB. It loads after the first frame. Every sampled cue has a procedural fallback.
- Chimes are FM bells on the notes of the chord that the music plays. A ping-pong delay carries them.
- The world makes sound now: city hum and distant traffic, harbour water and wind, wind above the roofs, and Doppler pass-bys for cars and boats. The horns are detuned brass chords. There are no gulls, because nothing in the packs makes a natural gull.
- Loudness: the run is at **-15.8 LUFS** (critic: -12.9). The game-over loop is at **-14.8 LUFS**, 1.0 LU over the run (critic: -18.9, 6 LU under). The highest true peak is **-4.8 dBTP**.
- Clicks: **0** from the game in all ten clips. One detector hit stays in clip 05. It is the test teleport that the critic also flagged.
- iPhone SE game-over card: 0 digits outside the card (round 44: 5).

## What changed per sound

All in `src/systems/AudioSystem.ts` unless named.

| Sound | Before | Now |
|---|---|---|
| Mix | Rotor, wind, cues and music went straight into one master. Compressor -14 dB at 4:1, limiter -2 dB. The reverb was 27 to 30 dB down. | Four buses and one effects return. Glue compressor -20 dB at 2.5:1. Limiter -4 dB at 20:1. Trim 0.62. A shared 1.1 s stereo room is made in code: early reflections and a noise tail that gets darker. It returns about 14 dB under the dry cues. Sends: per cue, music 0.12, drone 0.06, ambience 0.12. |
| Priority ducking | Music only. | `priority()` ducks the music to the cue depth. The drone goes to depth^0.6 and the ambience to depth^0.5. The payout duck is shallower (0.62, 0.22 s hold). At chain x3 the old 0.45 duck made the music pump. |
| Slapback | None. | A stereo echo at 68 and 94 ms, lowpassed at 3.2 kHz. A "narrow" factor opens it. Alleys and tunnels give 1. Close facades on both sides under 14 m give up to 1. It takes the drone, knocks, scrapes and the crash. |
| Rotor | Two raw sawtooths, one lowpass and one sine AM. It was 4.5 to 7 dB over the music. | Four rotors on a band-limited blade wave, detuned from -1.1% to +1.3% and spread in stereo. Highpass 150 Hz. Body peak at 620 Hz (540 Hz with a parcel). Lowpass 1.3 to 4 kHz with speed, effort and boost. Gentle tanh saturation. A -7 dB cut at 1.15 kHz keeps room for the chimes. Two blade-rate LFOs beat against each other for an uneven flutter. Blade-chop air: a noise band at 2.3 to 4.8 kHz, gated by the same LFOs. A quiet sub one octave down. Banking spins up the outer pair and pans the bed a little. A parcel lowers the pitch by 4.5%, makes the tone darker and adds weight. |
| Speed wind | One noise band. | A body band (380 to 1,400 Hz) and an air band (3.2 to 7.5 kHz). Both have a smoothed random gust. |
| Slipstream air | A narrow noise band in the centre. | The same whistle with a 6 Hz flutter. The pitch also rises with the chain. It is **panned to the wall side**: the direction to the nearest facade against the camera. |
| Boost | A noise sweep and a soft saw, with no tail. It was 9 dB under the bed. | An ignition burst (`thrusterFire_004`), a sub-drop from 95 to 38 Hz and a wider noise sweep. The burner loop (`thrusterFire_002`) holds while boost is on. On release it fades over 0.6 s with an air release. Game calls the new `boostEnd()`. |
| Crash | A sine thud, noise and a square whine. The rotor gain stepped 7 times (7 clicks). | `explosionCrunch_000` (lowpassed at 3.8 kHz), `impactPlate_heavy_000` and a low knock, each at a random pitch within 10%. A sub-drop from 72 to 26 Hz. Panned to the wall side. The rotor stutter glides on 8 ms ramps. The music's top closes to 900 Hz for the slow-motion beat. The motor whine is a soft saw, not a square. |
| Knock | Sine, noise and a square. | One of three `impactMetal_medium` files at a random pitch, with a low sine. Panned to the wall side. |
| Scrape | Two noise bursts, 8 dB under the bed. | `impactMetal_light` grains (three, random pitch). `scratch` grit on harder scrapes. The synth grind stays under them. All of it is **panned to the wall side**. |
| Pickup | Three sines. | The claw latches (`switch12` and a tin clunk). A 0.13 s servo whir. Then three FM bells on the chord. |
| Delivery | Five sines. | Unlatch (`switch14`) and a servo going down. The parcel lands: a soft thud (`impactSoft_medium_001`) and a cardboard knock (`impactWood_light_000`). Then five FM bells on the chord, one chord tone higher per combo step, with a sub on the chord root. |
| Slipstream payout | A triangle and sines in fixed keys. | FM bells on the current chord. Chain x1 plays two notes and x5 plays six. Each chain step starts one chord tone higher. The pan alternates and the last note goes into the ping-pong. A glass edge (`select_001`, pitched to the chord) sits on the first note. |
| Clock tick | A square beep, 5.5 dB under the bed. | `tick_002` from 10 to 6 s and `tick_001` from 5 to 1 s. The pitch goes up one semitone each second. A sine pip sits under each tick. A heartbeat (sine lub-dub and a thud) plays in the last 3 s. |
| Rush hour and overtime horns | Square and sine notes. | Brass: three detuned soft saws per note through a lowpass that opens, in two-note chords. |
| UI | One triangle beep. | `select_001` for buttons, play and resume. `back_001` for pause. `toggle_002` for the music toggle (N and the chip) and the minimap (M). |
| Combo lost | Two triangles. | The same cue with `error_004`. |
| Ambience (new) | Silence. | Stereo noise beds that crossfade by position. City: a low hum, the lowpassed `spaceEngineLow_001` loop, and a distant traffic band that swells at random. Harbour: water lapping (a moving lowpass with an uneven swell) and wind. Above the roofs: wind bands. A quiet bed plays on pause and game over. |
| Pass-bys (new) | None. | A car within 9 m or a passing boat that comes closest in the next 0.5 s gets a Doppler whoosh. The band sweeps down and a soft engine tone glides down. The pan follows its path. Game checks every third frame (`updatePassBys`, `Traffic.near`). |
| Medal and game over | The score notes. | The same notes. The bells are FM bells now. The medal also ducks the drone and the ambience. |
| Music (mix only) | Bus 0.5. The game-over loop was 69% sub-bass at -18.9 LUFS. The run music was cut in 40 ms at game over. | Bus 0.63 (+2 dB). The game-over loop is lifted x1.95 with a highpass at 120 Hz. The run music fades over 150 ms into game over. A light reverb send. The composition, tempo and instruments did not change. |

Click fixes:

- The crash stutter glides on 8 ms ramps.
- Every sample starts 15 ms ahead. A buffer source that starts at the current time reaches the audio thread one render block late. Chromium then skips that far into the sample, past its 2 ms fade-in, which makes a step.
- Synth tones, bells and noise have linear attacks. An exponential attack ends in a near-step.
- The sharpest samples have short onset ramps and lowpasses.

## Samples used

All are CC0 Kenney files. The full table is in `ASSETS.md`.

- Sci-fi Sounds: `explosionCrunch_000`, `thrusterFire_002`, `thrusterFire_004`, `spaceEngineLow_001`.
- Impact Sounds: `impactPlate_heavy_000`, `impactMetal_medium_000`, `_001`, `_003`, `impactMetal_light_000`, `_001`, `_003`, `impactTin_medium_000`, `impactSoft_medium_001`, `impactWood_light_000`.
- Interface Sounds: `scratch_004`, `scratch_001`, `tick_002`, `tick_001`, `select_001`, `back_001`, `toggle_002`, `error_004`.
- UI Audio: `switch12`, `switch14`.

Listening pass: ffmpeg decoded every pick, and the script printed its envelope and spectrum (`builder-scripts/sprite.log`: length, attack, decay to -30 dB, centroid, band shares). `builder-scripts/build_sprite.py` builds `public/assets/audio/sfx.mp3`: mono, 96 kbps, 13.4 s, **161,324 bytes**. The offsets are in `src/systems/sfxSprite.ts`. The game measures the decoder delay against a sync click. It is 0 ms in Chromium.

## Measurements, before (critic) and after (builder)

The clips are in `builder-audio/`: a WAV and an MP3 each, `timelines.txt` and `audio-measurements.json`. Seeds, routes, pilot and clip rules are the critic's. The pilot flies in real time, so the run differs a little. This run: 10,886 points, 6 drops, Gold, 0 crashes. The critic's run: 9,116 points, 5 drops, Gold, 0 crashes.

| Clip | LUFS before / after | True peak before / after | Under 100 Hz before / after | Over 3 kHz before / after | Over 8 kHz after | Clicks before / after |
|---|---|---|---|---|---|---|
| 01 title | -14.4 / -14.8 | -4.1 / -5.8 | 33.9 / 35.1% | 0.0 / 0.0% | 0.0% | 0 / 0 |
| 02 take-off | -12.8 / -16.2 | -1.7 / -5.2 | 5.4 / 16.8% | 3.1 / 5.1% | 1.2% | 1 / 0 |
| 03 chain | -12.3 / -15.4 | -1.7 / -5.2 | 6.0 / 15.3% | 2.8 / 5.2% | 0.9% | 1 / 0 |
| 04 boost | -11.3 / -14.6 | -2.0 / -5.2 | 1.3 / 10.2% | 9.7 / 13.5% | 2.1% | 0 / 0 |
| 05 scrape and crash | -14.6 / -17.1 | -1.5 / -5.0 | 25.9 / 36.4% | 0.7 / 2.5% | 0.6% | 9 / 1 (test teleport) |
| 06 pickup, delivery, medal | -13.1 / -16.1 | -1.7 / -5.2 | 5.8 / 14.2% | 0.5 / 5.2% | 0.6% | 0 / 0 |
| 07 rush, last 10 s, overtime | -13.1 / -16.1 | -1.6 / -4.8 | 5.9 / 22.8% | 3.1 / 4.3% | 0.9% | 2 / 0 |
| 08 harbour and street | -15.5 / -17.8 | -3.4 / -7.2 | 7.7 / 14.7% | 0.1 / 2.6% | 0.5% | 0 / 0 |
| 09 game over | -18.9 / -14.8 | -2.1 / -5.3 | 35.0 / 19.2% | 0.0 / 0.0% | 0.0% | 3 / 0 |
| 10 full 60 s | -12.9 / -15.8 | -1.5 / -5.2 | 7.2 / 12.8% | 1.3 / 4.9% | 0.7% | 1 / 0 |

The bands are shares of each clip's energy (`builder-scripts/before-bands.log` and `after-bands.log`).

- **Loudness.** The run is at -15.8 LUFS (target: about -16). The game-over loop is at -14.8 LUFS, **1.0 LU** over the run. The highest true peak is -4.8 dBTP (target: under -1).
- **Frequency balance.** Every flight clip has more energy over 3 kHz than before: 2.5 to 13.5% against 0.1 to 9.7%. It also has more under 100 Hz: 10 to 36% against 1.3 to 26%. Over 8 kHz stays at 0.5 to 2.1%, so there is no harshness. The title and game-over screens play only music, so their top end did not change. The music's timbre is for the next round. The game-over loop has less sub on purpose: the critic flagged its 69% sub-bass.
- **Rotor against the music in cruise** (`cruise45b.log`, 1 s windows with no cue and no duck). Median -3.4 dB, against +3.7 dB before. By chain: x0 +1.9 (before +7.3), x1 -1.5 (+4.6), x2 -2.5 (+4.7), x3 and up -5.2 (+1.5). At chain x0 the music is only pad and bass, and the rotor is still a little over it.
- **Cues against the drone bed** (`cuepeak45b.log`, loudest 20 ms, the critic's value in brackets). Boost +13.7 (-9.4). Scrape +11.4 (-7.8). Tick +14.3 (-5.5). Slipstream chime +10.6 (+4.2). Knock +16.9 (+13.1). Crash +20.1 (+17.8). Delivery +22.3 (+12.8). Medal +23.4 (+12.2). Pickup +12.6 (+10.1). Rush order +13.6 (+10.4).
- **Ducking** (`ducks45b.log`). The table gives the bus level in the 0.35 s after each cue against the second before it, in dB.

| Cue | Music | Drone | Ambience |
|---|---|---|---|
| Crash | -9.3 | -8.9 | -6.5 |
| Medal | -12.1 | -5.1 | -3.2 |
| Delivery | -5.9 | -3.9 | -2.3 |
| Pickup | -4.4 | -2.1 | -2.3 |
| Slipstream payout (shallow on purpose) | -3.1 | -2.2 | -1.8 |
| Rush and overtime horns | -7.3 | -4.9 | -4.4 |
| Game over (scene change) | -18.1 | -7.2 | -1.1 |

- **Clicks.** 0 from the game in all ten clips (critic: 17). Clip 05 has one detector hit at 0.5 s. It is the `place()` teleport before the scrape test, which the critic also flagged. An earlier take had one hit exactly on a 4096-sample block edge of the recorder, in every channel. That was a dropped capture block, so I did not use that take.

## Budgets and regressions

| Check | Result |
|---|---|
| Sample payload | 161 KB in one request after the first frame. It decodes off the main thread and is ready about 0.2 s into the title. |
| First load (production build, every request) | 3.59 MB in 23 requests. Budget: 15 MB. |
| Long tasks after Play (12 s of flight with boost, production build, `longtask45b.mjs`) | Desktop **0**, iPhone 13 **0**. |
| Sound only after the first gesture | The context is `suspended` before the first press, with the sprite already loaded. It is `running` after the press (`toggle45b.log`, `longtask45b-*.log`). |
| Music toggle (N) | On the title and in a run: off (gain 0, not playing), then on again (gain 0.63, playing). The toggle click plays. The game has no separate effects toggle. |
| Flat-frame probe | 901 frames, 0 flat. |
| p95 frame time, no frame cap, normal / rush (`perf-street41.mjs`, sound running) | Desktop 7.8 / 7.0 ms. iPhone 13 HTML HUD 5.4 / 4.9 ms. iPhone 13 canvas HUD 3.6 / 3.6 ms. Round 44: 8.3 / 7.7, 5.4 / 4.9, 3.5 / 3.5. All under 12 ms. |
| Release smoke test (production build under `/nested/game/` in a cross-origin iframe, `?seed=22&slLaunch=x`) | Desktop with the mock: 0 failed requests, 0 errors, 0 console lines. 1 call after run 1, 2 after run 2. Desktop without the mock: 0 errors, one event per run. Phone with the mock: same. Phone, real tap and a full run: 1 call (5,289, Silver, 4 drops), 0 failed. Seed parity with the dev server: same city and first job. |
| `npm run build` | No chunk warning (`build45b.log`). |
| iPhone SE game-over card (`over44.mjs`, natural card, HTML and canvas) | SE: 0 digits outside the card, 0 covered, 0 under the toggle (round 44: 5, 5, 1). iPhone 13 with safe area and desktop: still 0. The forced 7-digit long card still scrolls below the fold on short screens, as in round 44 (4 "bad cases", all from that card). |
| Kept | The bloom clamps, the `#app` visibility rule and every debug hook. New hooks: `audioTaps()` and `audio.sfx` in the diagnostics. |

## Files changed

- `src/systems/AudioSystem.ts`: the mix, rotor, air, ambience, pass-bys, samples, bells, horns and cues. For the music, only the mix: bus level, game-over lift and highpass, 150 ms fade and a reverb send.
- `src/systems/sfxSprite.ts` (new, generated): the sprite offsets.
- `public/assets/audio/sfx.mp3` (new): the sound sprite.
- `src/game/Game.ts`: the rotor gets turn and carrying. New `setWorld` (shore distance, altitude, narrow factor) and `updatePassBys`. Wall-side pans for knocks, scrapes, the crash and the slipstream. `boostEnd`. The tick gets the seconds left. UI sounds on pause, N, M and the music chip. The `audioTaps` hook and `audio.sfx` in the diagnostics.
- `src/systems/Slipstream.ts`: `dir` (the direction to the nearest facade) is public.
- `src/world/Traffic.ts`: `near()` for the pass-bys.
- `src/vite-env.d.ts`: typings.
- `src/styles.css`: the iPhone SE card. No minimum column widths and a narrower gap at `max-height: 460px` and `max-width: 640px`.
- `ASSETS.md`: the samples table and the totals.
- `progress/round-45/builder-scripts/`: the scripts and all logs. The main scripts are `build_sprite.py`, `rec45b.mjs` and `analyze45b.py`. The folder also has copies of the round 44 checks with my ports.

## Open points for the critic

- At chain x0 (pad and bass only) the rotor is still about 2 dB over the music. At every other chain level it is under.
- The pickup chime is lower against the music than before: +7 dB peak over the music, against +14.8. The music is 2 dB louder, and the latch and servo come first, so the bells start 0.15 s later. Over the rotor the pickup is louder than before.
- No gulls, crowd or footsteps. Nothing in the CC0 packs makes them sound real.
- I stopped my servers (dev 5197, static 5193 to 5195) at the end. I did not touch the owner's server on 5188. I ran no git commands.
