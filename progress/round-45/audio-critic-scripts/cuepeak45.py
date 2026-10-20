# Round 45 audio critic: per-cue level as the loudest 20 ms of the cue bus in a +-0.3 s window around the game event,
# against the music bus and the rotor+wind bed (RMS over the same 0.6 s). Short cues (ticks, scrapes) are judged fairly.
import sys, json, numpy as np
from collections import defaultdict
sys.argv = [sys.argv[0], sys.argv[1], sys.argv[1] + '/../tmpout']
exec(open(__file__.replace('cuepeak45.py', 'analyze45.py')).read().split('# ---------- clip plan')[0])
res = defaultdict(list)
for tag in ['main-s22', 'fx-s22', 'ot-s22']:
    S = load(tag); E = events(S); sr = S['sr']
    w = int(0.02 * sr)
    for (t, kind, desc) in E:
        if kind in ('music', 'state', 'mark', 'boost-off', 'chain-reset', 'medal', 'crash', 'overtime', 'rush'): continue
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
