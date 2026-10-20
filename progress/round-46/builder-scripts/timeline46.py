# Round 46 builder: write builder-audio/<track>/timelines.txt (a header plus the per-clip event lists from analyze46b.py).
import sys
track, d = sys.argv[1], sys.argv[2]
name = {'classic': 'Classic (the round 45 soundtrack, unchanged score)', 'breakbeat': 'Breakbeat (the new soundtrack)'}[track]
head = f"""Drone Dash, round 46 BUILDER audio clips, soundtrack: {name}
==================================================================================================================

How the clips were made
- Real master output of the page (after the glue compressor, limiter and trim), stereo, 48 kHz, recorded in real time from
  headless Chromium at 1280x720, music on, effects on, URL ?seed=22&music={track}.
- Recorder: builder-scripts/rec46b.mjs, round 45's rec45b.mjs (same pilot, seed, routes, test hooks and clip plan) plus the
  soundtrack flag. Seven channels: master L/R, music bus, effects bus (dry), drone bus, ambience bus, effects return.
  Own dev server on 5199 (not the owner's 5188).
- One change to the clip sessions: the overtime session (clip 07, second part) starts with a 15 s clock (round 45: 22 s), so
  the clock always runs out while a parcel is aboard and overtime starts (with 22 s the pilot sometimes delivered in time).
- Cutting and measuring: builder-scripts/analyze46b.py. Numbers: audio-measurements.json in this folder.
- The pilot flies in real time, so each run differs a little (score, drops, where the payouts fall).
- Levels in brackets: "cue vs music" = effects bus against the (ducked) music bus in the cue's window (window RMS);
  "duck" = how far the music bus dropped; "cue vs rotor+wind" = against the drone bus.
- "music run/<section> layer N" lines are the music's own report. Breakbeat names its layers base, hats, ghosts-arp,
  lead-ride (+stabs in rush hour), final, drop; it changes them on the next downbeat (at most 1.43 s after the game event).
"""
open(f'{d}/timelines.txt', 'w').write(head + open(f'{d}/timelines-raw.txt').read())
