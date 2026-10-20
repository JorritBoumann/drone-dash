# Round 45 builder: which bus a master click comes from. usage: python3 clickbus45b.py <rawdir> <tag> <ct0> <ct1>
import sys, json, numpy as np
raw, tag, a, b = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
tl = json.load(open(f'{raw}/{tag}-timeline.json')); sr = tl['sr']; t0 = tl['t0']
def clicks(x):
    d2 = np.abs(np.diff(x, 2)); w = int(sr * 0.005)
    k = np.ones(2 * w + 1); k[w - 1:w + 2] = 0; k /= k.sum()
    loc = np.sqrt(np.convolve(d2 * d2, k, mode='same')) + 1e-9
    hits = np.where((d2 > 8 * loc) & (d2 > 0.01))[0]
    keep = []
    for h in hits:
        if not keep or h - keep[-1] > sr * 0.02: keep.append(h)
    return keep
i0, i1 = int((a - t0 + 0.1707) * sr), int((b - t0 + 0.1707) * sr)
for n in ['L', 'R', 'music', 'sfx', 'bed', 'amb', 'rev']:
    x = np.fromfile(f'{raw}/{tag}-{n}.f32', dtype=np.float32).astype(np.float64)[i0:i1]
    h = clicks(x)
    print(n, [(round(a + j / sr, 3), round(float(np.abs(np.diff(x, 2))[j]), 3)) for j in h][:10])
