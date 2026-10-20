# Round 46 builder: round 45's cuepeak45b.py pointed at analyze46b.py. Round 45 audio builder (copy of the critic's cuepeak45.py): per-cue level as the loudest 20 ms of the cue bus in a +-0.3 s window around the game event,
# against the music bus and the rotor+wind bed (RMS over the same 0.6 s). Short cues (ticks, scrapes) are judged fairly.
import sys, json, numpy as np
from collections import defaultdict
TAGS = sys.argv[2]; sys.argv = [sys.argv[0], sys.argv[1], sys.argv[1] + '/../tmpout', TAGS]
exec(open(__file__.replace('cuepeak46b.py', 'analyze46b.py')).read().split('S_main = load(')[0])
res = defaultdict(list)
for tag in sys.argv[3].split(','):
    S = load(tag); E = events(S); sr = S['sr']
    w = int(0.02 * sr)
    for (t, kind, desc) in E:
        if kind in ('music', 'state', 'mark', 'boost-off', 'chain-reset', 'medal', 'crash', 'overtime', 'rush'): continue
        if kind in ('passby', 'passby-close'):
            # the critic's round-45 method: loudest 20 ms of the ambience bus from 0.2 s before to 0.8 s after the trigger
            seg = S['ch']['amb'][idx(S, t - 0.2):idx(S, t + 0.8)]; pw = int(0.02 * sr)
            pkdb = 20 * np.log10(np.sqrt(np.max(np.convolve(seg * seg, np.ones(pw) / pw, mode='valid'))) + 1e-12)
            res['pass-by (amb bus)' if kind == 'passby' else 'pass-by close (amb bus)'].append((pkdb - rms_db(S['ch']['music'][idx(S, t - 0.2):idx(S, t + 0.8)]), pkdb - rms_db(S['ch']['bed'][idx(S, t - 0.2):idx(S, t + 0.8)]), pkdb)); continue
        a = idx(S, t - 0.3); b = idx(S, t + 0.3)
        cue = S['ch']['sfx'][a:b]; mus = S['ch']['music'][a:b]; bed = S['ch']['bed'][a:b]
        if len(cue) < w: continue
        pk = np.sqrt(np.max(np.convolve(cue * cue, np.ones(w) / w, mode='valid')))
        pkdb = 20 * np.log10(pk + 1e-12)
        if pkdb < -90: res[kind].append(None); continue
        res[kind].append((pkdb - rms_db(mus), pkdb - rms_db(bed), pkdb))
for k, v in sorted(res.items()):
    ok = [x for x in v if x]; silent = len(v) - len(ok)
    if not ok: print(f'{k:14} n={len(v)} all silent'); continue
    a = np.array(ok)
    print(f'{k:14} n={len(v):3} silent={silent:2}  peak20ms over music: median {np.median(a[:,0]):6.1f} (min {a[:,0].min():6.1f})   over rotor+wind: median {np.median(a[:,1]):6.1f} (min {a[:,1].min():6.1f})   peak {np.median(a[:,2]):6.1f} dB bus')
