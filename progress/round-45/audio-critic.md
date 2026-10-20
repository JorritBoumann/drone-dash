# Drone Dash, round 45 audio critic report

**Verdict:** The audio is clean and safe. It never clips, the loudness is steady and the adaptive music works. It sounds basic for four reasons. A buzzy two-sawtooth rotor drone is the loudest thing in every flight clip. The mix is dry and dark: the reverb is inaudible and almost nothing sits above 3 kHz. The short cues (boost, scrape, clock tick) are buried under the rotor. And the world itself makes no sound at all. The music is pleasant but made only of sine and triangle tones, so it sounds like a ringtone. The biggest single win is a new rotor and wind bed, about 5 dB lower and with real blade chop. Next come sampled transients for impacts, scrapes, boost and UI, using the Kenney picks below.

## 1. Clips

All clips are in `progress/round-45/audio/`. Each one is a WAV (48 kHz, stereo, 24-bit) plus an MP3 (192 kbps) for upload. The full timelines, with the level of every cue, are in `progress/round-45/audio/timelines.txt`.

| # | Upload file | Length | MP3 size | What you hear |
|---|---|---|---|---|
| 01 | `01-title-music.mp3` | 20.0 s | 0.48 MB | Title loop, from the first key press |
| 02 | `02-takeoff-calm-flight-chain0.mp3` | 20.0 s | 0.48 MB | Enter, take-off, street flight, first pickup |
| 03 | `03-slipstream-chain-x3-payouts.mp3` | 25.0 s | 0.60 MB | Chain x1 to x4 with chimes, a delivery, then x1 to x3 again |
| 04 | `04-boost-and-tail-off.mp3` | 10.0 s | 0.24 MB | A 5.1 s held boost on a long street, then release |
| 05 | `05-wall-scrape-and-head-on-crash.mp3` | 10.0 s | 0.24 MB | Glancing scrape plus a knock, then a head-on crash at 16 m/s |
| 06 | `06-pickup-delivery-medal.mp3` | 14.7 s | 0.35 MB | Pickup, then (join at 4.7 s) a x5 chime, a delivery and the Bronze fanfare |
| 07 | `07-rush-hour-then-last-10s-into-overtime.mp3` | 30.0 s | 0.72 MB | Rush hour horn, then (join at 7.7 s) the last 10 s, the overtime horn, the drop, a medal and game over |
| 08 | `08-harbour-boats-bus-then-street-people-traffic.mp3` | 21.7 s | 0.52 MB | 3.5 m over the water behind the harbour bus and past boats, then (join at 11.7 s) 2.8 m up a busy street |
| 09 | `09-game-over-sting-and-loop.mp3` | 21.0 s | 0.51 MB | Final drop at the buzzer, game-over sting, Gold loop |
| 10 | `10-full-run-60s-unedited.mp3` | 60.0 s | 1.44 MB | The first 60 s of the main run, unedited |

### How they were made

- **Tap.** I used my own dev server on port 5196 and headless Chromium at 1280x720. An init script tapped the real audio graph with one ScriptProcessor. It recorded six channels. Two are the master left and right, after the limiter and trim: what the speakers get. The other four are the music bus after the duck, the cue bus, the rotor/wind/slipstream bed and the reverb return.
- **Latency.** A 10 ms burst at a known audio-clock time gave the capture latency. It was 170.67 ms in all three sessions, with a match score of 0.99 to 1.04. All times are corrected for it.
- **Pilot.** A scripted pilot flew the round 5 to 11 street line on seed 22, the way a competent person flies. It takes corners at 7 m/s and straights at 16 m/s, flies about 7 m up, and holds boost on long straight streets.
- **Teaching mode.** This was a first run in a fresh browser, so teaching mode was on. The game banks the first three slipstream payouts silently, so they have no chime. That is by design, and it is in clips 02 and 10.
- **Sessions:**
  - **main** (seed 22): the title, a full run (Gold, 9,116 points, 5 drops, 0 crashes) and the game-over screen.
  - **fx:** a scripted wall scrape and head-on crash. Then a test hook (`place`) moved the drone to the harbour bus and to the busiest street.
  - **ot:** the same pilot with the start clock cut to 22 s (`tune`), so overtime starts. The main run made its last drop 2 s before the buzzer and never reached overtime.
- **Joins.** Clips 06, 07 and 08 are two segments joined with a 0.3 s crossfade. The timeline gives each join time.

### Timelines (short form)

The full version in `timelines.txt` has every cue level.

- **01 title:** the loop fades in over 1.2 s. One chord every 2 bars (Fmaj7, Em7, Dm7, Gsus) with a triangle pluck, a sine lead note and a pad. No events.
- **02 take-off:** 0.5 s Enter. 0.7 s run music base layer and the rotor starts. 4.9 s, 9.4 s and 17.2 s payouts are silent (teaching), but the music still adds layers. 7.3 s and 16.2 s boost. 11.0 s pickup (music ducks 4.2 dB). 17.9 s and 18.4 s the first audible payout chimes, x4.
- **03 chain:** 4.0 s x1, 4.9 s x2, 6.4 s x3 and 7.6 s x4 chimes, each with a 4 to 6 dB duck. Music layers: drums, arp, lead. 12.1 s delivery (duck 7.1 dB). 15.6 s chain reset to base layer. 17.0 s x1, 21.4 s x2, 23.0 s x3.
- **04 boost:** 2.0 s boost on, held 5.1 s (whoosh plus rising rotor). 2.6 s, 3.5 s, 5.0 s and 6.2 s chain chimes x1 to x4. 7.1 s boost off: the only tail-off is the rotor gliding down.
- **05 crash:** 1.1 s scrape. 1.6 s knock (bump thud). 2.2 s second scrape. 4.7 s the drone is placed 15 m from the wall and boosts at it. 5.3 s head-on impact: crunch, clank, rotor sputter and a duck of 8.5 dB. 5.5 s crash charged: "lost it" cue and chain reset. The hit-stop and 0.15 s slow motion have no sound of their own.
- **06 pickup to medal:** 1.5 s pickup. Join at 4.7 s. 7.2 s x5 chime. 10.1 s delivery. 11.0 s Bronze fanfare (duck 7.8 dB).
- **07 rush to overtime:** 1.9 s rush hour starts, 3.0 s horn (duck 9.2 dB). 4.8 s and 7.4 s chimes. Join at 7.7 s. 9.0 s pickup. 9.2 s music switches to the final section and the clock ticks start (1,175 Hz, then 1,480 Hz from 5 s). 15.9 s, 17.1 s and 21.7 s chimes x3 to x5. 24.2 s overtime horn. 24.9 s delivery. 26.0 s medal. 26.5 s game-over sting.
- **08 harbour and street:** the cue bus is silent the whole time (-60 dB). You hear only the rotor, wind and music, over water, past the harbour bus and boats, and down a street with people and cars.
- **09 game over:** 0.4 s last drop at the buzzer. 1.0 s game-over sting and Gold loop (duck 16 to 18 dB under the sting). The loop then plays alone.
- **10 full 60 s run:** see 02 and 03. Chimes at 17.9, 18.4, 23.2 (x5), 33.6, 37.9, 47.9, 49.2, 50.4 and 52.6 s. Pickups at 11.0 and 40.4 s. Delivery and Bronze at 26.1 and 27.0 s. Boosts at 7.3, 16.2, 46.2 and 47.6 s.

## 2. Measurements

### Loudness, peaks, spectrum, clicks (master output)

Loudness here is stereo BS.1770 from ffmpeg ebur128. Round 11 tapped a mono downmix, which reads about 3 LU lower for the same sound. So the title's -14.4 here matches round 11's -17.4.

| Clip | Integrated LUFS | Short-term range (3 s) | True peak dBTP | Clipped samples | Below 150 Hz | 150 Hz to 3 kHz | 3 to 6 kHz | Above 6 kHz | Clicks |
|---|---|---|---|---|---|---|---|---|---|
| 01 title | -14.4 | -14.8 to -13.7 | -4.1 | 0 | 34% | 66% | 0.0% | 0.0% | 0 |
| 02 take-off | -12.8 | -15.2 to -9.9 | -1.7 | 0 | 32% | 65% | 2.1% | 1.0% | 1 |
| 03 chain | -12.3 | -15.2 to -9.4 | -1.7 | 0 | 32% | 65% | 1.9% | 1.0% | 1 |
| 04 boost | -11.3 | -13.5 to -9.4 | -2.0 | 0 | 6% | 84% | 6.5% | 3.2% | 0 |
| 05 crash | -14.6 | -16.5 to -13.4 | -1.5 | 0 | 51% | 49% | 0.5% | 0.2% | **9** |
| 06 medal | -13.1 | -14.8 to -12.0 | -1.7 | 0 | 40% | 59% | 0.3% | 0.2% | 0 |
| 07 rush, overtime | -13.1 | -20.0 to -10.0 | -1.6 | 0 | 35% | 62% | 2.1% | 1.0% | 2 |
| 08 harbour, street | -15.5 | -16.0 to -14.9 | -3.4 | 0 | 50% | 50% | 0.1% | 0.0% | 0 |
| 09 game over | **-18.9** | -20.7 to -16.3 | -2.1 | 0 | **69%** | 32% | 0.0% | 0.0% | 3 |
| 10 full 60 s | -12.9 | -15.2 to -9.9 | -1.5 | 0 | 42% | 57% | 0.8% | 0.4% | 1 |

- **Peaks and clipping.** No clipping anywhere. The loudest true peak is -1.5 dBTP.
- **Loudness.** The run sits at -11 to -13 LUFS stereo (about -14 to -16 mono). That is a little hot but steady.
- **Game over.** It is 6 LU under the run and 69% sub-bass. This is the round 11 point, still open.
- **Very little top end.** In flight only 0.3 to 3% of the energy is above 3 kHz. Nothing at all is above 3 kHz on the title and game-over screens. The music bus is low-passed at 6.5 kHz and uses only sines and triangles. This is the main reason it sounds dull and "basic".
- **Clicks** (a second-difference detector, 8x over the local 5 ms level and over 0.01):
  - **Clip 05.** The crash makes 7 clicks in 0.35 s (5.53 to 5.87 s, then 6.19 and 6.21 s). These are the rotor sputter: `impact()` steps the rotor gain 7 times with `setValueAtTime` on a raw sawtooth, which is a hard step. Two more fall at 0.46 and 0.62 s, where the test hook moved the drone. They are partly a test artefact.
  - **Clip 09.** 3 clicks at 0.98 to 1.34 s. At game over the run music is cut in 40 ms and the rotor stops under the sting.
  - **Elsewhere.** 1 or 2 isolated clicks in a few clips, on cue onsets.
  - **Music bus.** 0 clicks in every clip except 2 at the scrape-test teleport.
- **Reverb.** The reverb return is 27 to 30 dB under the dry cues (bus RMS: cues -31 to -37 dB, reverb -59 to -66 dB). The convolver is normalised, so the "small bright reverb on chimes" in the code is inaudible. Every cue is bone dry.

### Balance between the buses (RMS, before the master gain)

| Clip | Music bus | Rotor + wind + air bed | Cue bus |
|---|---|---|---|
| 01 title | -25.7 | none | none |
| 02 take-off | -31.8 | **-25.8** | -36.7 |
| 03 chain | -31.7 | **-25.6** | -33.7 |
| 04 boost | -31.7 | **-24.5** | -35.2 |
| 08 harbour, street | -34.2 | **-27.8** | -60.5 (nothing) |
| 10 full 60 s | -31.4 | **-26.3** | -33.0 |

- **The rotor bed is the loudest layer in flight.** It sits 4.5 to 7 dB over the music. The run music bus is also 6 dB quieter than on the title. The chain layers that tell the player "you are doing well" play under a drone hum.

### Cue levels against music and rotor bed

For each event I took the loudest 20 ms of the cue bus in a 0.6 s window. I compared it with the RMS of the music and the bed in the same window. I used every event in all three sessions. The log is `audio-critic-scripts/cuepeak45.log`.

| Cue | Count | Over music (median, worst) | Over rotor + wind (median, worst) | Judgement |
|---|---|---|---|---|
| Head-on crash | 1 | +26.8 | +17.8 | Loud enough, maybe too loud. It peaks at -6.5 dB on the bus, the loudest cue |
| Knock (bump) | 2 | +19.8 (+18.6) | +13.1 (+12.7) | Fine |
| Delivery | 6 | +17.0 (+14.6) | +12.8 (+12.2) | Fine |
| Medal fanfare | 4 | +16.7 (+16.4) | +12.2 (+11.8) | Fine |
| Pickup | 6 | +14.8 (+12.6) | +10.1 (+10.0) | Fine |
| Slipstream chime | 36 (4 silent, teaching) | +14.4 (+10.4) | **+4.2 (+2.4)** | Thin: only 2 to 4 dB over the rotor hum |
| Rush horn / overtime horn | 2 | +12.9 (+11.4) | +6.9 (+5.1) | A bit low for a big event |
| Rush order | 2 | +13.5 | +10.4 | Fine |
| Clock tick (last 10 s) | 20 | **-0.8 (-4.4)** | **-5.5 (-9.4)** | Buried |
| Scrape | 2 | **-3.3 (-4.1)** | **-7.8 (-8.3)** | Buried |
| Boost whoosh | 28 | **-3.7 (-9.7)** | **-9.4 (-10.9)** | Buried. You hear boost only through the rotor pitch |

### Ducking (music bus, measured)

| Cue | Code depth | Measured drop |
|---|---|---|
| Slipstream chime | 0.45 (-6.9 dB) | -5.3 dB median. Two overlapping chimes: -1.5 dB |
| Pickup | 0.6 (-4.4 dB) | -4.2 dB |
| Delivery | 0.45 | -7.1 dB |
| Medal | 0.28 (-11 dB) | -7.8 to -11.2 dB |
| Crash | 0.35 (-9.1 dB) | -8.5 dB |
| Rush / overtime horn | 0.4 (-8 dB) | -9.2 / -4.7 dB |
| Game over | 0.35 / 0.28 | -16 to -18 dB (the scene change fades the music too) |

At chain x3+ the chimes come every 1.2 to 2.5 s. The music is then ducked more than half the time, so it pumps.

### Repetition

These numbers are the cosine similarity of the music-bus spectrum at whole-bar lags.

- **Title.** It repeats exactly every 15.36 s (4 chords x 2 bars). It already reaches 0.82 at 1 bar and 0.81 at 4 bars (7.7 s), so it feels like it repeats every 4 to 8 s.
- **Run.** No lag under 60 s goes above 0.72. The 32-bar form repeats every 61.4 s. This is good.
- **Game over.** It repeats every 15.36 s (0.81 at 1 bar).

### Events with no sound at all

- **World:**
  - pedestrians, and their reactions to a passing drone
  - cars, vans and the rush-hour lanes
  - the harbour bus, boats, water, waves and gulls
  - the city ambience: at a hover you hear only rotor hum and music
- **Gameplay:**
  - the delivery time bonus
  - combo up
  - the slow clock
  - boost end and boost empty
  - the crash slow-motion beat
  - pad approach and landing
  - the first three slipstream payouts of a first run (by design)
- **Interface:**
  - teaching pop-ups
  - the minimap and its toggle
  - pause and the music toggle
  - the game-over buttons (beyond the one shared 880 Hz click)

## 3. Every sound in the code

All of these are in `src/systems/AudioSystem.ts`, with the score data in `src/systems/music.ts`. Triggers are in `src/game/Game.ts`.

| Sound | Trigger | Synthesis |
|---|---|---|
| Rotor (loop) | setRotor on run start and resume. updateRotor every frame | 2 sawtooths, 88 to 214 Hz, detuned 1.3% + 1.5 Hz. Lowpass 600 to 2,800 Hz, Q 2.5. Amplitude modulation at 0.42 x pitch, depth 0.3. Gain 0.07 to 0.13 |
| Wind (loop) | updateRotor | Looped white noise, bandpass 400 to 1,800 Hz Q 0.7, gain speed^1.6 x 0.16 plus a headwind gust |
| Slipstream air (loop) | setDraft every frame | Same noise, bandpass Q 6, 700 to 2,500 Hz rising with the meter, gain up to 0.22 |
| Slip tick | Meter quarter (when the slipstream is introduced) | Triangle blip 587 Hz x 2^(3 x step/12), 0.12 s, small glide up |
| Slip payout | Meter full | Bandpass noise whoosh, triangle 880 Hz, sine 1,318 Hz, plus 0 to 4 sine arpeggio notes. up a whole tone per chain step. duck 0.45 |
| Pickup | Parcel picked up | 3 sines E5 G5 C6, 70 ms apart, with triangle octaves. highpass noise tick. duck 0.6 |
| Delivery | Parcel delivered | 5 sines C E G C E (raised a semitone per combo) with triangle fifths, sine C3, highpass air. duck 0.45 |
| Bump | Wall contact over 2 (knock) | Sine 140 to 45 Hz, lowpass noise, 50 ms square click at 2.4 to 3 kHz |
| Impact | Head-on crash | Sine 95 to 38 Hz. Lowpass noise 2.4 kHz to 160 Hz. Bandpass clank 3.8 to 1.8 kHz. Rotor gain stepped 7 times, rotor detune -900 cents. Square whine 320 to 180 Hz. Duck 0.35 |
| Scrape | Glancing wall contact (rate-limited to 11 a second) | Bandpass noise 5.2 to 2.6 kHz Q 4 plus highpass noise 7 to 9 kHz, 0.08 to 0.22 s |
| Crash cue | Crash charged | Triangle 466 Hz, or 392 Hz with a broken combo. Then a falling triangle a fourth lower |
| Boost | Boost starts | Bandpass noise 400 to 2,600 Hz, 0.55 s, plus a soft saw glide 220 to 440 Hz at gain 0.03 |
| Rush hour | Rush hour banner | Square + sine D5 then A5, played twice, sine D3, highpass air. duck 0.4 |
| Overtime horn | Overtime starts | Square + sine D5 F#5 B5, square F#6, 8-hit noise snare roll. duck 0.4 |
| Rush order | Rush parcel tagged | Square B5 then E6 |
| Tick | Each second of the last 10 s. Rush missed | Square 1,175 Hz (1,480 Hz in the last 5 s), 70 ms |
| Click | Title buttons, play, resume | Triangle 880 Hz, 60 ms |
| Start | Run start | Triangle G4 C5 E5 G5, 60 ms apart |
| Medal | Medal score passed | Square + sine G C E fanfare, held E plus G5, sine G3, 1 to 4 sine bells, highpass air. duck 0.28 |
| Game over | Time up | No medal: falling triangle C Ab F C. Medal: triangle G C E, sine C E G chord, C3, bells |
| Music: title | Title screen | 125 BPM. Fmaj7 Em7 Dm7 Gsus, 2 bars each. Triangle pad (lowpass 450 to 2,150 Hz) plus a sine octave, triangle bass, triangle and sine plucks, sine lead |
| Music: run | Playing, by chain | 32-bar form. Pad and bass always. Drums (sine kick 150 to 55 Hz, noise hats at 7.2 kHz, noise clap at 1.5 kHz) from x1. Triangle arp from x2. Sine and triangle lead from x3. Dotted-eighth echo |
| Music: final | Last 10 s and overtime | Ab Bb Ab G7, octave bass, four-on-the-floor, 16th hats, ticking high C. lead in overtime |
| Music: over | Game over | C Fmaj7 Am G (medal) or Fm C Am Gsus (none). Quiet pad and bass, sine bells per tier |
| Music bus | Always | Highpass 55 Hz, lowpass 6.5 kHz, scene fade, duck, level 0.5 |
| Master | Always | Gain 3.1, compressor -14 dB 4:1, limiter -2 dB 20:1, trim 0.8. Reverb: a generated 1.6 s noise IR, send 0.32 (inaudible, see above) |

## 4. Judgement as audio director

### What sounds cheap or generic

1. **The rotor.** Two raw sawtooths through a resonant lowpass make a static, buzzy comb from 100 Hz to 1 kHz (see any flight spectrogram). It reads as an electric razor or an old arcade engine, not a drone. There is no blade chop, no air, no stereo width and no variation. It is also the loudest layer, 4.5 to 7 dB over the music, so the whole game "sounds like" this hum.
2. **Everything is dry and dark.**
   - The reverb is 27 to 30 dB down, so it does nothing.
   - The cues are pure sines and triangles with exponential decays: the textbook "Web Audio beep".
   - Little energy reaches 3 kHz, so nothing sparkles or snaps, and the impacts have no texture.
3. **The music is pleasant but plain.**
   - Only sine and triangle voices, no stereo, a sine kick and quiet noise hats.
   - It sounds like a phone ringtone or a tutorial demo.
   - When the chain adds layers, each new layer just switches on: no riser, fill, filter sweep or stinger marks the moment.
   - The title loop repeats every 15 s and feels shorter.
4. **The fanfares and horns use square waves.** That is the chiptune signature. It clashes with the semi-real 3D city.

### What is missing

- **City life.** The cars, vans, people, harbour bus, boats and water make no sound. Clip 08 has only the hum and the music. The city is busy on screen but empty to the ear. This is the biggest gap in immersion.
- **The boost tail and boost empty.** Boost has an onset (which you cannot hear) but no sustain layer and no release.
- **Feedback on the crash beat.** There is a hit-stop and slow motion but no matching audio effect: no low-pass dip or pitch drop on the music, and no "whomp".
- **UI sounds** for pause, the music toggle, the minimap and the game-over buttons. Score count-up ticks on the game-over card.

### Too loud or too quiet

- **Too loud:**
  - the rotor and wind bed, by about 5 dB
  - the crash peak, the loudest thing in the game. With a lower bed it is fine
- **Too quiet:**
  - the boost whoosh (-9 dB under the bed)
  - the scrape (-8 dB)
  - the clock tick (-5.5 dB). The tick is the clock, so it must cut through
  - the slipstream chime, only +2 to +4 dB over the bed
  - the game-over loop (-18.9 LUFS, 69% sub-bass)
- **Pumping.** At chain x3+ the music is ducked under chimes more than half the time.

### What would make the biggest difference (in order)

1. **A new rotor and air bed, about 5 dB lower.**
   - Filtered noise chopped at the blade rate (a quad-rotor "whirr") over a quieter motor whine. Give it slight stereo width and a pitch that follows thrust.
   - Keep it procedural, because it must follow the flight.
   - This alone lifts the music and every cue into view.
2. **Sampled transients from the Kenney packs** for the crash, knock, scrape, boost, tick and UI (picks below). Normalise them to -3 dBFS, vary pitch by ±5% per play, and pick one of 3 to 5 variants at random.
3. **A real room.**
   - A short stereo reverb, around 0.8 s, at about -14 dB under the dry cues, on chimes, horns and impacts.
   - A stereo ping-pong on the chimes.
   - Raise or remove the 6.5 kHz music lowpass.
4. **A city ambience bed.** Add a distant traffic hum and car swishes by distance. Add a soft crowd murmur near people. At the harbour, add lapping water and a boat motor. Code can make all of it except the sampled parts.
5. **Fuller music in code.**
   - Detuned saw or FM pads through a chorus, and a kick with a click layer.
   - A clap and snare with a noise body, and a sidechain dip on the pad.
   - A one-bar riser or fill at each new chain layer.
   - A longer title form: at least 16 bars, with a B section.
6. **Fix the clicks.**
   - Ramp the rotor sputter (8 ms ramps instead of `setValueAtTime` steps).
   - Fade the run music over 150 ms at game over.
   - Bring the game-over loop up 4 to 5 dB with less sub-bass.

## 5. Kenney picks per event

These come from `asset-src/kenney-audio/` (CC0). I decoded all 418 files with ffmpeg. For each file I measured the length, attack, decay to -30 dB, spectral centroid at the start and the end, and the band shares. The table is `audio-critic-scripts/kenney45.tsv`. Many impact and UI files decode with peaks of +1 to +5.7 dBFS, so normalise them to -3 dBFS on import. Only the 5 s loops need trimming: `thrusterFire_*` has a built-in 1.1 s fade-in.

| Event | Top pick | Why (measured) | Backup |
|---|---|---|---|
| Head-on crash | `kenney_sci-fi-sounds/Audio/explosionCrunch_000.ogg` layered with `kenney_impact-sounds/Audio/impactPlate_heavy_000.ogg` | Crunch 0.78 s, 3 ms attack, 0.53 s decay, 79% low plus 20% mid. Plate: 0.49 s metal body at 80 Hz. Together a real "metal and plastic hits a wall". Keep the synth rotor sputter (ramped) on top | `kenney_sci-fi-sounds/Audio/impactMetal_003.ogg` (0.78 s clank, 75% in 150 Hz to 3 kHz, reads on phones) |
| Knock (bump) | `kenney_impact-sounds/Audio/impactMetal_medium_000` to `_004.ogg`, random | 0.11 to 0.27 s, 2.6 ms attack, centroid 0.7 to 1.2 kHz, 65 to 93% mid: a hollow body knock | `impactPlate_medium_002.ogg` |
| Scrape | `kenney_impact-sounds/Audio/impactMetal_light_000` to `_004.ogg`, random per contact, plus `kenney_interface-sounds/Audio/scratch_004.ogg` | Metal light: 0.21 to 0.48 s ringing at 2.4 to 3 kHz, 32 to 47% in 3 to 6 kHz, which cuts through the rotor. Scratch_004: 0.33 s grit, 22% in 3 to 6 kHz and 24% above 6 kHz. Keep the synth noise grind under it for long slides, +10 dB | `scratch_001.ogg` |
| Boost (sustain and tail) | `kenney_sci-fi-sounds/Audio/thrusterFire_002.ogg` as a loop while boosting | 5 s, centroid 1.6 kHz, 10.5% above 6 kHz: a real burner hiss. Start it at 1.2 s (past its fade-in), fade in over 0.15 s, and fade out over 0.6 s on release: that is the missing tail-off | `thrusterFire_000.ogg` (centroid 1.3 kHz, darker) |
| Boost onset | Keep the synth noise sweep, +10 dB, plus the first 0.3 s of `thrusterFire_004.ogg` | thrusterFire_004 is the brightest loop (centroid 2.4 kHz, 16% above 6 kHz) and works as a short ignition burst | none |
| Pickup | `kenney_interface-sounds/Audio/confirmation_001.ogg` | 0.29 s, 2.6 ms attack, rises 400 to 1,180 Hz, all in the phone band: a clean "got it". Layer it over the current arpeggio, or replace it | `drop_004.ogg` (0.28 s, rises 0.8 to 1.6 kHz) |
| Delivery | `kenney_interface-sounds/Audio/confirmation_002.ogg` over the synth chord, plus `kenney_impact-sounds/Audio/impactBell_heavy_000.ogg` about 10 dB down | Confirmation_002: 0.54 s, rises 1.6 to 3.3 kHz, 64% in 3 to 6 kHz, the sparkle the chord lacks. Bell: 1.5 s, 380 Hz, a weighty "ding" for the drop | `confirmation_003.ogg` (0.32 s, rises to 6.5 kHz) |
| Slipstream chime transient | `kenney_interface-sounds/Audio/glass_001.ogg`, pitched by chain via playbackRate, over the synth chime | 0.28 s glassy ping at 1.9 kHz, 2.5 ms attack. It gives the chime an edge over the rotor while the synth keeps the pitch ladder in key | `glass_005.ogg` (0.13 s, 2.6 kHz, 17% in 3 to 6 kHz) |
| Clock tick (10 to 6 s) | `kenney_interface-sounds/Audio/tick_002.ogg` | 20 ms, broadband (centroid 3.8 kHz, 46% in 3 to 6 kHz, 15% above 6 kHz). It cuts through where the 1,175 Hz square beep is buried | `kenney_ui-audio/Audio/click4.ogg` |
| Clock tick (5 to 1 s) | `kenney_interface-sounds/Audio/tick_001.ogg` (+3 dB over the 10 to 6 s tick) | 45 ms, centroid 4.7 kHz, sharper and more urgent | `tick_004.ogg` |
| Menu click, play, resume | `kenney_interface-sounds/Audio/select_001.ogg` | 40 ms, 2.4 kHz, crisp and modern | `kenney_ui-audio/Audio/click3.ogg` |
| Pause / back, music toggle, minimap toggle | `kenney_interface-sounds/Audio/back_001.ogg` for pause and back. `kenney_interface-sounds/Audio/toggle_002.ogg` for toggles | Back_001: 61 ms. Toggle_002: 0.14 s, 2.1 to 3.4 kHz | `switch12.ogg` (ui-audio) |
| Rush order | `kenney_interface-sounds/Audio/question_003.ogg` | 0.33 s, rises 2.0 to 3.7 kHz: an alert that asks for attention | `confirmation_004.ogg` |
| Combo lost after a crash | `kenney_interface-sounds/Audio/error_004.ogg` | 0.10 s, falls 640 to 240 Hz, clear and short | `error_008.ogg` |
| Harbour bus motor (new) | `kenney_sci-fi-sounds/Audio/spaceEngineSmall_000.ogg`, looped, through a PannerNode on the bus | 5 s steady loop, 85% below 150 Hz, centroid 136 Hz: works as a diesel thrum at a distance | `spaceEngineLow_001.ogg` |
| Distant city traffic rumble (new) | `kenney_sci-fi-sounds/Audio/spaceEngineLow_001.ogg`, looped very low, lowpassed | Steady, 85% below 150 Hz, no tonal whine | none |

### Keep procedural or synthesised

- the rotor and wind (they must follow the flight)
- all music, including the medal fanfare, the game-over sting and the rush and overtime horns, which are part of the score
- the slipstream pitch ladder

The digital-audio pack (`laser*`, `powerUp*`, `phaser*`, `pepSound*`) is retro chiptune. It makes the game sound cheaper, not better, so skip it.

### Not in the Kenney packs

Car pass-bys, horns, crowd murmur, footsteps on stone, water lapping and gulls are missing. Water lapping can be noise through a slow-moving lowpass in code. The rest needs another CC0 source or ElevenLabs. ElevenLabs output on the free plan is non-commercial.

## Scripts

These are in `progress/round-45/audio-critic-scripts/`:

- `dev45a.mjs`: my own Vite server on port 5196, now stopped. The owner's server on 5188 was not touched.
- `rec45.mjs`: the recorder and pilot. `MODE=main`, `fx` or `ot`.
- `analyze45.py`: cuts the clips, writes the WAV and MP3 files, measures them and writes `timelines.txt`. All numbers are in `progress/round-45/audio-measurements.json`.
- `cuepeak45.py` and `cuepeak45.log`: the cue peaks against the music and the bed.
- `kenney45.py` and `kenney45.tsv`: the measurements of all 418 Kenney files.
- Raw 6-channel captures (about 270 MB) stay in the session scratchpad. Git ignores the WAVs (`progress/**/*.wav`). It does not ignore the MP3s.
