# Drone Dash, round 45 critic (audio round)

**Verdict:** Pass. This is a big, measurable step up. The rotor no longer covers the game. The cues cut through. The mix is now stereo with a real room. Every regression check is clean. Four things still sound cheap. There is very little top end. The Doppler pass-bys are too quiet to notice. The pickup is a weaker reward than before. The menus are louder than the run.

## 1. My recordings

All ten clips are in `progress/round-45/critic-audio/` as WAV (48 kHz, stereo, 24-bit) and MP3 (192 kbps). The timeline is `critic-audio/timelines.txt` and every number is in `critic-audio/measurements.json`.

- **Method.** The same as the baseline: headless Chromium at 1280x720, seed 22, my own dev server on port 5197, the same scripted pilot. The tap is my own. It hooks `AudioNode.connect`, not the game's `audioTaps()` hook. It records 7 channels: master L and R, then the music, effects, drone and ambience buses, and the effects return. The capture latency was 170.67 ms in all three sessions (match 0.999 to 1.002).
- **Real flights.** The fx session uses no `place()` teleports this time:
  - It wall-rides a facade at 12 m/s and eases into it, which gives a scrape.
  - It backs off across the street and flies head-on into the wall with boost, which gives one impact and one crash.
  - It climbs to 75 m and crosses to the harbour at altitude, then descends to 3.5 m behind the harbour bus and past boats.
  - It climbs again, crosses back, descends into the busiest street and flies it at 2.8 m.
  - The only test hook is a long start clock (`tune`), so the run does not end mid-session. The ot session uses `tune` for a 22 s clock, as in the baseline.
- **Runs.** The main run scored 7,838 with 5 drops and 0 crashes. The baseline scored 9,116, because pilot timing varies in real time. The ot session reached overtime, with a medal and the game over inside clip 07.
- **Clip changes.** Clips 05 and 08 are two segments joined with a 0.3 s crossfade: scrape plus crash, and harbour plus street. Clip 07 is 33 s, not 30 s, because the ot run's slow clock stretched the last 10 s.

## 2. Measurements, before and after

"Before" is the baseline captures, re-measured with my code so both columns come from one code path.

### Rotor against music (drone bus minus music bus, 1 s windows in flight, cue moments left out)

| Chain | Before | After |
|---|---|---|
| x0 (cruise) | +7.2 dB | **-0.5 dB** |
| x1 | +5.2 | +0.4 |
| x2 | +4.4 | -1.2 |
| x3+ | +1.6 | **-4.3** |

The rotor is now level with the music in cruise and sits under it in chains. This was the baseline's number one ask, and it is done.

### Loudness and peaks (stereo BS.1770)

| Clip | Integrated before / after | Short-term range after | True peak after |
|---|---|---|---|
| 01 title | -14.4 / -14.8 LUFS | -15.1 to -14.3 | -5.8 dBTP |
| 10 full run, 60 s | -12.9 / **-16.2** | -17.7 to -14.3 | -5.3 |
| 09 game over | -18.9 / **-14.9** | -16.8 to -13.7 | -5.3 |
| 05 scrape and crash | -14.6 / -16.2 | -17.6 to -15.1 | -4.8 |

- There is no clipping anywhere. The worst true peak in any clip is -4.6 dBTP, with lots of headroom.
- The game-over loop is fixed: it went from 6 LU under the run to level with it.
- But the balance is now the other way round. The run is now 1.3 to 1.4 LU quieter than both the title and the game-over screen. See problem 4.

### Spectral balance (master, mono sum)

| Clip | Below 100 Hz | 150 Hz to 3 kHz | Above 3 kHz | Above 8 kHz |
|---|---|---|---|---|
| 10 run, before | 7.3% | 57% | 1.3% | 0.26% |
| 10 run, after | 14.8% | 58% | 3.5% | 0.65% |
| 04 boost, after | 12.6% | 61% | 17.7% | 3.2% |
| 08 harbour and street, after | 16.9% | 60% | 3.4% | 0.70% |
| 09 game over, after | 19.3% (was 35%) | 46% | 0.06% | 0.01% |

The top end is up about 2.7 times but is still low. The sub is up 2 times in flight and down by half on the game-over screen.

### Stereo width (side energy against mid)

- **Flight clips.** Before: -34 to -50 dB, which is effectively mono. After: **-9 to -13 dB**, a real stereo image.
- **Title.** -27 dB. The music is still near mono, by design this round.

### Reverb

- **Return level.** The effects return now sits 12 to 13 dB under the dry effects bus. Before, the gap was 27 to 30 dB. You can hear the room on chimes and impacts, and the ping-pong shows in the spectrogram.
- **Slapback.** It opens in narrow streets. Its level was not isolated.

### Ducking (dB change 0.08 to 0.35 s after the cue, median)

| Cue | Music | Drone | Ambience |
|---|---|---|---|
| Slipstream chime (38) | -3.6 (was -5.3) | -2.3 | -1.9 |
| Pickup (6) | -4.1 | -1.5 | -1.9 |
| Delivery (2) | -7.5 | -4.2 | -2.9 |
| Rush and overtime horn (4) | -6.8 | -4.5 | -3.7 |
| Medal (4) | -10.2 | -5.3 | -3.7 |
| Crash (1) | -8.2 | -12.2 | -3.8 |
| Game over (2) | -24 (includes the scene change) | -6.4 | -0.6 |

The chime duck is lighter and shorter, so chains pump less than before.

### Cue level (loudest 20 ms of the cue's bus against the music, median)

| Cue | Before | After | Note |
|---|---|---|---|
| Boost | -3.7 | **+5.7** | Drone bus. Now audible as its own event |
| Scrape | -3.3 | **+10.5** | Weakest single hit: +3.9 |
| Clock tick | -0.8 | **+12.2** | Weakest: +3.6, on the 5 s tick under the final-section music |
| Slipstream chime | +14.4 | +12.1 | Over the drone: +11.2 (was +4.2) |
| Knock | +19.8 | +14.0 | |
| Delivery | +17.0 | +18.0 | |
| Pickup | +14.8 | **+8.0** | Weaker than before. See problem 3 |
| Rush order | +13.5 | +7.8 | |
| Head-on crash | +26.8 | **+30.8** | The loudest cue, 13 dB over a delivery |
| Doppler pass-by | none | **-4.5** | Ambience bus, 33 pass-bys. Under the music |

### Chimes in key

- I compared the 3 strongest pitch classes of each cue with the 4 strongest of the music at that moment.
- **Before:** 37% of chime notes were in the chord.
- **After:** 76%.
  - Slipstream chimes: 78%.
  - Delivery: 100%.
  - Pickup: 56%. It is now mostly a latch and clunk, so it is not tonal.

### Clicks

- **Flight and screens.** 0 clicks in 9 of 10 clips. The baseline had 9 in the crash clip and 3 at game over.
- **Clip 07.** 1 isolated click at 11.7 s, between two clock ticks.
- **Music bus.** 0 clicks in every clip.

### Ambience loops

- **Exact repeat.** The ambience bed repeats its waveform exactly every 3.0 s: correlation 0.95 at altitude, 0.79 at the harbour and 0.98 in the street. It is one 3 s stereo noise buffer, and the `cityLow` sample loop is also 3.0 s.
- **Loudness pattern.** The audible loudness pattern barely repeats at that lag: +0.10, 0.00 and +0.21. With the drone in the mix it is +0.04 or less.
- **Seams.** 0 clicks on the ambience bus.
- **Verdict.** No audible seam in the mix. With the music off, hovering in a street, a trained ear can perhaps hear a faint 3 s "whoosh" rhythm.

### Ambience levels (bus RMS)

| Place | Ambience | Drone | Music |
|---|---|---|---|
| Street | -37.5 | -32.9 | -31.8 |
| Harbour | -39.7 | -32.0 | -32.1 |
| Altitude | -43.1 | -31.0 | -32.6 |

- **Character.** The street bed is mostly low rumble (56% below 150 Hz). The harbour bed is a mid wash (92% from 150 Hz to 3 kHz). The altitude wind has air on top (24% above 3 kHz).
- **Title.** The bed is silent on the title. On the game-over screen it runs quietly (-45.5).

## 3. Asset check

- **The build.** It has exactly one audio file: `public/assets/audio/sfx.mp3`, 161,324 bytes. It is mono, 96 kbps and 13.4 s long.
- **Did each segment come from the file ASSETS.md names?** I decoded the sprite and every source file in ASSETS.md, with the stated trims. Then I cross-correlated each sprite segment with its source (`spritecheck45c-fine.log`).
  - All 24 segments match their listed file: waveform match 0.958 to 1.000.
  - The control, each segment against a wrong file, scored at most 0.531.
  - The 2.2 s not covered by a listed segment is silent (peak -45 dBFS, codec spill). So nothing unlisted is in the build.
- **Licence.** All four packs used (Impact, Interface, Sci-fi, UI Audio) carry Kenney's `License.txt` with "Creative Commons Zero, CC0". The digital-audio pack is not used. ASSETS.md is accurate and complete.
- **Lazy loading.**
  - The sprite request starts at 1.10 s. That is after the load event (0.83 s) and long after the first frame (0.01 s).
  - It decodes while the context is still suspended.
  - With the sprite returning 404, the game plays and the procedural fallbacks sound (a toggle click measured -46.5 dB on the effects bus). There are no errors.
  - The production build copies it to `dist/assets/audio/sfx.mp3` and fetches it relative to `BASE_URL` (`./`). Under `/nested/game/` it loads with status 200 and reaches the "ready" state (`nested45c.log`).
- **Gesture gate** (Chromium's real default policy, `document-user-activation-required`, in `gate45c.log` and `autoplay45c.log`):
  - Before any gesture the context is `suspended`, no title music plays and no audio frames are rendered.
  - One click starts it, and the title loop plays at -16 dB RMS.
- **Blocked or suspended audio.** None of these broke the game. In each case the run started, the drone flew about 40 m in 3 s, and N, M and Escape worked, with 0 page errors.
  - `resume()` never resolves.
  - `resume()` rejects.
  - No Web Audio at all.
  - The AudioContext constructor throws.
  - Suspending the context mid-run: the game kept running, and the next key press resumed the sound.
- **Music toggle (N).**
  - On the title and in a run it silences the music bus completely (-240 dB). The drone, the ambience and the effects keep going.
  - Pressing N again brings the music back.
  - The choice is remembered after a reload.
  - N and M each play the Kenney toggle click.
- **Sound toggle.** There is no sound-off control. `AudioSystem.setMuted` exists but nothing calls it.
- **Phone performance with the sound running** (`perf45c-*.log`). Measured with no frame cap, street level, 12 s normal plus 12 s rush:

| Setup | p95 normal / rush | Notes |
|---|---|---|
| iPhone 13, HTML HUD | 5.3 / 4.8 ms | |
| iPhone 13, canvas HUD | 3.5 / 3.6 ms | |
| Desktop | 7.9 / 7.3 ms | |
| iPhone 13, CPU throttled 4x | 8.3 / 9.2 ms | 0 late notes, 0 resyncs and 0 dropouts. 1 to 2 click detections per 12 s on the master |
| Unthrottled runs | | 0 clicks, 0 late notes |

All of them are under 12 ms.

## 4. Judgement as audio director

### What improved

- **The rotor.** It is the real win. The buzzy saw comb is gone. It is now a softer, wider blade whirr with chop and air, and it no longer owns the mix. You hear the music's chain layers for the first time.
- **Hits read as physical.** The crash (crunch plus plate), the knock and the scrape grains sound like metal and plastic, not 8-bit noise.
- **Boost.** It has an ignition, a burner sustain and a tail-off you can hear.
- **Ticks.** The Kenney ticks finally sound like a clock and cut through.
- **Chimes.** They now sit in the chord, ring into a room and bounce left and right. A chain sounds like a reward ladder, not beeps over a hum.
- **Space.** The stereo image and the room make the mix feel like a place.
- **The game-over screen.** It is no longer a quiet sub-bass hole.

### What still sounds cheap

- **Little top end.** Only 3.5% of the run is above 3 kHz, and 0% on the title and game-over screens. Partly that is the music, which comes next round. But the effects can also carry more air: the wind and the chime transients.
- **Generic ambience.** It is filtered noise. The street reads as "low rumble", not traffic. The harbour reads as "shh", not water. There are no recognisable events: no horn, no voices, no gulls, no slap of water on a hull.

### What is new and annoying

- **Doppler pass-bys.** They exist (33 in my sessions) but sit 4.5 dB under the music, so in normal play you will not notice them. Either make the near ones clearly audible or cut them.
- **The crash.** It is now 31 dB over the music. It is right for a crash, but it is a jolt on headphones compared with everything else. Pull it down 3 to 4 dB.
- **Repetition.** Nothing annoying. The ticks are not irritating and the chimes no longer pump the music hard.
- **Clashes.** No wrong pitch: the chimes are in key.

### Does the ambience help?

Yes, a little, and it never distracts. It glues the gaps between cues and makes altitude feel open and the street feel enclosed. It is quiet, 5 to 11 dB under the music and drone, which is the right side to err on. It does not yet add identity.

## 5. Remaining audio problems, ranked (music style excluded)

1. **Doppler pass-bys are inaudible under the music** (-4.5 dB median). Close cars and the harbour bus need to be +3 to +6 dB over the music for the half second they pass. Give them a real engine tone. Otherwise the feature does nothing.
2. **Thin top end in the effects and ambience.** Add air and transient sparkle: high wind on speed, a bright layer on chime attacks and some hiss in the harbour wash. Aim for 6 to 8% above 3 kHz in flight.
3. **The pickup reward got smaller.** It went from +14.8 to +8.0 dB over the music, and it is now mostly a latch and clunk. Bring back a short in-key tonal top (one or two FM bell notes) or raise it 4 to 5 dB.
4. **The menus are louder than the run.** The title is -14.8, the game over -14.9 and the run -16.2 LUFS. Raise the run master about 1.5 dB (there is 5 dB of true-peak headroom), or lower the menus by the same amount.
5. **The crash is 3 to 4 dB too hot** next to every other cue (+30.8 over the music).
6. **The ambience has no identity.** Add a few sparse, recognisable one-shots: a distant horn, a gull at the harbour, water slaps near moored boats.
7. **The ambience uses one 3 s noise loop.** It is inaudible in the mix. A longer buffer (8 to 10 s) or a second offset voice removes any chance of a 3 s pattern with the music off.
8. **No sound-off control.** There is only a music toggle. The platform or players can want a mute. `setMuted` is already there to wire up.
9. **Small items.**
   - Rush order: +7.8 dB over the music, a little low for a time-limited order.
   - One stray click in the last-10-s section (clip 07 at 11.7 s).
   - 1 to 2 click detections per 12 s under a 4x CPU throttle.

## 6. Regressions

| Check | Result |
|---|---|
| Flat-frame probe, bloom on (`flat45c.log`) | 887 frames, **0 flat**, 0 errors |
| Release smoke test: production build under `/nested/game/` in a cross-origin iframe, `?seed=22&slLaunch=x` (`platform45c.log`) | **0 failed requests**, 0 bad responses, 0 page errors, 0 console errors on desktop with and without the mock, and on phone. Seed parity with dev holds. **One session-complete call per run** (1 after run 1, 2 after run 2, still 2 after leaving). Without the mock: 0 calls, 1 event per run, no throw |
| `npm run build` (`build45c.log`) | Built in 0.33 s, **no chunk warning**. The largest chunk is three.js at 588 kB |
| iPhone SE game-over card, every score digit (`over45c.log`, `critic-audio/iphone-se-over-card.png`) | Pass. A real 2:19 run on the smallest SE (568x320) scored 8,380 Gold. **60 of 60 digits** on the card are on screen, and none is covered by another element. Side note, not audio: the "GOLD MEDAL" label runs under the breakdown column, and the big score sits close to the "Score" label |

## Files

- Clips, timeline, numbers: `progress/round-45/critic-audio/`
- Scripts and logs: `progress/round-45/critic-scripts/`
  - `rec45c.mjs`: recorder and pilot, with real-flight fx and the iPhone SE game-over check
  - `analyze45c.py`, `cuepeak45c.py`, `loops45c.py`, `chimekey45c.py`: measurements
  - `spritecheck45c*.py`: the sample source check
  - `gate45c.mjs`, `autoplay45c.mjs`: the start gate, blocked audio and toggles
  - `perf45c.mjs`: performance with the sound on
  - `queue45c.sh`: the sequential job queue
  - Copied from round 43 critic scripts: `platform41c.mjs`, `serve42.mjs`, `acceptance-probe.mjs`
- **Servers.** Mine were 5197 (dev), 5194 and 5195 (dist). All are stopped. The owner's server on 5188 was not touched.
- **Raw captures.** The 7-channel captures (about 280 MB) stay in the session scratchpad.
