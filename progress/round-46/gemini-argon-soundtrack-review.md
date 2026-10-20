# Round 46: Gemini Argon listening review of both soundtracks

Model: Gemini 4 Argon, thinking level High, in the Gemini app on Jorrit's Pro account, 2026-10-20. The full answer is in his Gemini history as "Drone Dash Audio Review and Refinement".

Input: eight MP3 clips from `builder-audio/` (title, chain x3, rush hour into overtime, game over) for Classic and for Breakbeat.

Status: a second opinion. The owner chooses the soundtrack.

## Scores (Gemini)

| Part | Round 45 baseline | Now | Target for a polished indie game |
| --- | --- | --- | --- |
| Music, Classic | 3.5 | 5.5 | 8.5 |
| Music, Breakbeat | none | 7.5 | 8.5 |
| Effects and mix | 3.0 | 6.5 | 8.5 |

## Which soundtrack (Gemini)

Gemini prefers Breakbeat and suggests it replace Classic. Its fast, syncopated rhythm gives forward momentum, and its jazzy F Dorian chords keep it sunny and relaxed. Classic's mid-tempo 4/4 pulse makes the flight feel like a casual puzzle game.

## What still sounds weak in Breakbeat (Gemini)

- The snare and hats are plain noise bursts. They sound the same in every bar and have no body or ghost-note groove (title 0:00 to 0:20).
- The lead has a static filter and vibrato (title from 0:11).
- Every Rhodes voice has the same bright attack, so chord changes click slightly.
- The brass stabs in rush hour and overtime sound like cheap 1990s sound-card brass.
- From the last 10 s into overtime, ticks, plucks, brass, hats and the rotor all sit in 2 to 5 kHz. This becomes harsh, and the overtime drop has nowhere to go.

## What works (Gemini)

- The chain build-up, and chimes that match the chord with ducking.
- The pressure of the last 10 s.
- The game-over loop, the most polished state.

## Effects (Gemini)

Improved: chimes in key, ducking, real impact weight, and a sense of place. Still weak:
- At high speed the rotor climbs into 0.8 to 2.5 kHz like a dentist's drill.
- The slipstream sounds like a synth riser, not wind.
- The impact samples sound dry next to the reverb on the music.
- The last ticks are shrill.

## Top 8 next changes (Gemini, ranked)

1. A better breakbeat kit: CC0 drum one-shots, or a hybrid snare with a pitched body, saturation and a 280 Hz boost, plus quieter, darker ghost notes.
2. Rotor: keep the pitch rise under about 35%. Add blade chop as a 35 to 55 Hz amplitude modulation, a low-pass at 1.4 kHz and a notch at 2.2 kHz.
3. A short gap before overtime. On the last beat, high-pass the music, mute the drums and bass, then hit a sub-drop on the downbeat.
4. Redesign the brass stabs, or replace them with one CC0 horn-stab sample.
5. Make room around 1 to 3 kHz. Use a stereo, offset-filtered slipstream, cut 1.5 kHz on the slipstream bus, and dip the Rhodes near 1.2 kHz while drafting.
6. In the last 10 s, low-pass the melodic music at 2.4 kHz, and use a softer woodblock-like tick panned left and right.
7. Humanize the lead (delayed vibrato, filter by note height) and the Rhodes (random velocity, brightness by velocity).
8. Send the impact samples into the shared reverb, high-passed at 250 Hz.
