# Round 47 builder: where the 2 to 5 kHz energy of the last 10 s and overtime comes from (per bus, absolute dB in the band,
# summed over the same windows as measure47.py). usage: python3 busband47.py <rawdir> <label>
import sys, json
import numpy as np
sys.argv = sys.argv[:3]
raw, label = sys.argv[1], sys.argv[2]
exec(open('measure47.py').read().split('out = {')[0])
S = load('ot-s22'); EV = S['tl']['EV']; sr = S['sr']
fin = [e for e in EV if e['state'] == 'playing' and e['section'] in ('final', 'drop')]
a, b = fin[0]['ct'], fin[-1]['ct']; w = int(0.5 * sr); res = {}
for n in ['music', 'sfx', 'bed', 'amb', 'rev']:
    band = 0.0; tot = 0.0
    for t in np.arange(a, b - 0.5, 0.5):
        i = idx(S, t); x = S['ch'][n][i:i + w]
        if len(x) < w: break
        f, X = spec(x, sr); band += X[(f >= 2000) & (f < 5000)].sum(); tot += X.sum()
    res[n] = dict(band_db=round(db(band), 1), share_pct=round(100 * band / (tot + 1e-20), 1))
print(label, json.dumps(res))
