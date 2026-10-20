# Round 47 builder: write builder-audio/<track>/timelines.txt (a header plus the per-clip event lists from analyze47.py).
import sys
track, d = sys.argv[1], sys.argv[2]
name = {'classic': 'Classic (selectable; shared effect fixes and a 2.4 kHz melodic low-pass in the last 10 s)', 'breakbeat': 'Breakbeat (the default from round 47)'}[track]
head = f"""Drone Dash, round 47 BUILDER audio clips, soundtrack: {name}
==================================================================================================================

How the clips were made
- Real master output of the page (after the glue compressor, limiter and trim), stereo, 48 kHz, recorded in real time from
  headless Chromium at 1280x720, music on, effects on, URL ?seed=22&music={track}.
- Recorder: builder-scripts/rec47.mjs, a copy of round 46's rec46b.mjs (same pilot, seed, routes, test hooks and clip plan). Seven channels: master L/R, music bus, effects bus (dry), drone bus, ambience bus, effects return.
  Own dev server on 5199 (not the owner's 5188).
- The overtime session (clip 07, second part) starts with a 15 s clock as in round 46. New in round 47: the pilot hovers
  for 3 s when overtime starts (OT_HOLD=3), so the pre-drop gap and the drop are on the recording (in a first try the
  pilot delivered within a second of overtime, before the drop's downbeat).
- Cutting and measuring: builder-scripts/analyze47.py (a copy of analyze46b.py); round 47 numbers: measure47.py. Numbers: audio-measurements.json in this folder.
- The pilot flies in real time, so each run differs a little (score, drops, where the payouts fall).
- Levels in brackets: "cue vs music" = effects bus against the (ducked) music bus in the cue's window (window RMS);
  "duck" = how far the music bus dropped; "cue vs rotor+wind" = against the drone bus.
- "music run/<section> layer N" lines are the music's own report. Breakbeat names its layers base, hats, ghosts-arp,
  lead-ride (+stabs in rush hour), final, drop; it changes them on the next downbeat (at most 1.43 s after the game event).
  In round 47 the beat before the drop is a gap (high-passed music, no drums or bass) and the drop's downbeat has a sub-drop.
"""
open(f'{d}/timelines.txt', 'w').write(head + open(f'{d}/timelines-raw.txt').read())
