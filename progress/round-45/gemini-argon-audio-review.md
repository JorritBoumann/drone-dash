# Round 45: Gemini Argon listening review of the audio

Model: Gemini 4 Argon, thinking level High, in the Gemini app on Jorrit's Pro account, 2026-10-20. The full answer is in his Gemini history as "Drone Dash Audio Overhaul Guide".

Input: the ten MP3 clips in `audio/` and a prompt that described the game and asked for a blunt audio review.

Status: a second opinion. The audio builder uses it with `audio-critic.md` and `codex-audio-design-review.md`.

## Verdict (Gemini)

Music 3.5 out of 10, sound effects 3 out of 10. The trigger system and the adaptive structure are solid. The sound itself is raw: single dry oscillators with plain gain ramps, unmodulated noise, mono, and most energy between 180 Hz and 2.5 kHz. Over a 60 s run this becomes tiring. Gemini puts the game at about 35 to 40% of a polished indie arcade sound.

## Main problems (Gemini)

- The rotor is one static buzz, "more like an electric shaver than a quadcopter", and it is too loud. It masks the music's bass.
- The music has almost no drums and no sub-bass, and its harmony is static. The chain layers add thin arpeggios, not energy. Chain chimes do not match the music's chord.
- Crashes and scrapes sound like 8-bit explosions. Noise cannot make plastic, carbon or concrete.
- Pickup and delivery sound like menu beeps.
- The medal fanfare plays on top of the music with no ducking.
- The countdown tick sounds like a kitchen timer.
- The harbour and street sound fake: the seagulls sound like laser zaps, the horns like bare synth notes, the crowd like radio static. There is no Doppler.
- The mix is dry, narrow and centred, with no shared reverb, almost no sub-bass and almost no top end.
- The game-over loop is bleak and quiet. It does not invite another try.

## Music direction (Gemini)

A bright liquid drum and bass or arcade breakbeat style, at 168 BPM (half time on the game-over screen). Jazzy seventh and ninth chords, for example in F Dorian. Instruments: a warm sub-bass with a filtered saw bass, a crisp breakbeat kit, a Rhodes-style electric piano, and plucks and brass stabs. Layers:
- Base flight: drums, sub and Rhodes.
- Chain x1: 16th hats.
- Chain x2: ghost snares and an arpeggio.
- Chain x3: a lead and a ride cymbal.
- Rush hour: brass stabs.
- Last 10 s: a filtered bass and a snare roll into a drop at overtime.

## Top 10 changes (Gemini, ranked)

1. Rebuild the rotor as four slightly detuned propellers with a body filter, soft saturation and a blade-chop air noise. Cut 800 Hz on the drone bus so it does not mask chimes.
2. Sub-buses for music, drone, ambience and effects, a master compressor, and priority ducking for pickups, deliveries, payouts, crashes and the medal fanfare.
3. Crashes and scrapes from Kenney impact samples, with random pitch and a procedural sub-drop. Scrapes panned to the side of the wall.
4. CC0 ambience loops for the harbour, the street and high-altitude wind, crossfaded by position. Doppler pitch and panning for passing boats and vehicles.
5. A real drum kit and sub-bass groove in the music, either CC0 one-shots or better-built procedural drums.
6. Slipstream panned to the wall side, with a rising filtered whistle per chain level. Chain chimes tuned to the current chord, with an FM bell and a ping-pong delay.
7. A boost ignition with a sub-drop and a short filter dip on the music, and rotor flutter on the tail-off.
8. Mechanical layers for pickup (latch, servo whir) and delivery (unlatch, whoosh, parcel thud). A fanfare in key, with ducking and reverb.
9. A countdown tick that rises in pitch each second, with a heartbeat in the last 3 s and a riser into overtime. A pitch drop on the music during the crash slow-motion beat.
10. One shared reverb made in code for outdoor space, plus a short slapback echo in narrow streets.

## Identity ideas (Gemini)

- The drone's sound reflecting off a nearby wall forms a comb filter tuned to the music's chord, so wall riding "sings".
- The drone sounds heavier while it carries a parcel, and lighter after a delivery.
- Alerts framed as courier radio calls, with a short squelch and band-limited voice-like stingers.
