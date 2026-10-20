# Round 45 builder: measured priority ducking per cue: music, drone (bed) and ambience bus RMS in the 0.35 s after the
# duck lands against the 0.95 s before the cue. usage: python3 ducks45b.py <rawdir> <tags comma list>
import sys, json, numpy as np
from collections import defaultdict
raw, tags = sys.argv[1], sys.argv[2].split(',')
db = lambda x: 20 * np.log10(np.sqrt(np.mean(x * x)) + 1e-12)
res = defaultdict(list)
for tag in tags:
    tl = json.load(open(f'{raw}/{tag}-timeline.json')); sr = tl['sr']; t0 = tl['t0']
    ch = {n: np.fromfile(f'{raw}/{tag}-{n}.f32', dtype=np.float32).astype(np.float64) for n in ['music', 'bed', 'amb']}
    idx = lambda ct: int((ct - t0 + 0.1707) * sr)
    seen = set()
    for e in tl['EV']:
        d = e.get('lastDuck')
        if not d or d['at'] in seen: continue
        seen.add(d['at']); at = d['at']
        row = []
        for n in ['music', 'bed', 'amb']:
            pre = ch[n][idx(at - 1.0):idx(at - 0.05)]; post = ch[n][idx(at + 0.06):idx(at + 0.41)]
            row.append(db(post) - db(pre) if db(pre) > -70 else None)
        res[d['reason']].append(row)
print('cue          n   music dB (median, min)   drone dB (median)   ambience dB (median)')
for k, v in sorted(res.items()):
    f = lambda j: [r[j] for r in v if r[j] is not None]
    m, b, a = f(0), f(1), f(2)
    print(f"{k:10} {len(v):3}   {np.median(m):6.1f} ({min(m):6.1f})        {np.median(b) if b else float('nan'):6.1f}            {np.median(a) if a else float('nan'):6.1f}")
