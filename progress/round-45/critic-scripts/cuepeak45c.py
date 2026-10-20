# Round 45 critic: per-cue level, the baseline method (loudest 20 ms of the cue's bus in +-0.3 s of the game event,
# against the RMS of the music and the drone bed over the same 0.6 s), on my after captures. Boost lives on the drone bus
# now and pass-bys on the ambience bus, so those are measured there (boost: the drone bus's rise over its last 1 s).
# Also: the measured duck of music, drone and ambience per priority cue (0.08 to 0.35 s after vs the 1 s before).
import sys, json, numpy as np
from collections import defaultdict
src = open(__file__.replace('cuepeak45c.py', 'analyze45c.py')).read()
exec(src.split('def plan_for')[0].replace('RAW_A, RAW_B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]', 'RAW_A, RAW_B, OUT = sys.argv[1], sys.argv[2], "/tmp"').replace('os.makedirs(OUT, exist_ok=True)', ''))
res = defaultdict(list); duck = defaultdict(lambda: defaultdict(list))
for tag in ['main-s22', 'fx-s22', 'ot-s22']:
    S = load(RAW_A, tag, NA); E = events(S); sr = S['sr']; w = int(0.02 * sr)
    pk = lambda x: 20 * np.log10(np.sqrt(np.max(np.convolve(x * x, np.ones(w) / w, mode='valid'))) + 1e-12)
    for (t, kind, desc) in E:
        if kind.startswith('duck:'):
            for bus in ('music', 'bed', 'amb'):
                a0 = rms_db(S['ch'][bus][idx(S, t - 1.0):idx(S, t - 0.05)]); a1 = rms_db(S['ch'][bus][idx(S, t + 0.08):idx(S, t + 0.35)])
                if a0 > -90: duck[kind[5:]][bus].append(a1 - a0)
            continue
        if kind in ('music', 'state', 'mark', 'boost-off', 'chain-reset', 'medal', 'crash', 'overtime', 'rush'): continue
        a = idx(S, t - 0.3); b = idx(S, t + 0.3)
        mus = S['ch']['music'][a:b]; bed = S['ch']['bed'][a:b]
        if kind == 'boost-on':
            pre = rms_db(S['ch']['bed'][idx(S, t - 1.0):idx(S, t - 0.05)]); p = pk(S['ch']['bed'][idx(S, t):idx(S, t + 0.6)])
            res['boost (drone bus)'].append((p - rms_db(mus), p - pre, p)); continue
        if kind == 'passby':
            seg = S['ch']['amb'][idx(S, t - 0.2):idx(S, t + 0.8)]; p = pk(seg)
            res['pass-by (amb bus)'].append((p - rms_db(S['ch']['music'][idx(S, t - 0.2):idx(S, t + 0.8)]), p - rms_db(S['ch']['bed'][idx(S, t - 0.2):idx(S, t + 0.8)]), p)); continue
        cue = S['ch']['sfx'][a:b]
        if len(cue) < w: continue
        p = pk(cue)
        if p < -90: res[kind].append(None); continue
        res[kind].append((p - rms_db(mus), p - rms_db(bed), p))
print('CUE LEVELS (after)')
for k, v in sorted(res.items()):
    ok = [x for x in v if x]; silent = len(v) - len(ok)
    if not ok: print(f'{k:18} n={len(v)} all silent'); continue
    a = np.array(ok)
    print(f'{k:18} n={len(v):3} silent={silent:2}  over music: median {np.median(a[:,0]):6.1f} (min {a[:,0].min():6.1f})   over drone bed: median {np.median(a[:,1]):6.1f} (min {a[:,1].min():6.1f})   peak {np.median(a[:,2]):6.1f} dB bus')
print('\nDUCKS (after; dB change 0.08-0.35 s after the cue vs the 1 s before; median, n)')
for k, d in sorted(duck.items()):
    print(f'{k:10} ' + '  '.join(f'{bus} {np.median(v):6.1f} (n {len(v)})' for bus, v in d.items()))
