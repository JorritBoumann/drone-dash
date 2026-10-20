# Round 46 builder: clicks (second-difference detector from analyze45b.py) and band shares per calibration segment.
import sys, json, numpy as np
raw, tr = sys.argv[1], sys.argv[2]
M = json.load(open(f'{raw}/{tr}-marks.json')); sr, t0 = M['sr'], M['t0']
ch = {n: np.fromfile(f'{raw}/{tr}-{n}.f32', dtype=np.float32).astype(np.float64) for n in ['L', 'R', 'music']}
def clicks(x):
    d2 = np.abs(np.diff(x, 2)); w = int(sr * 0.005); k = np.ones(2 * w + 1); k[w - 1:w + 2] = 0; k /= k.sum()
    loc = np.sqrt(np.convolve(d2 * d2, k, mode='same')) + 1e-9
    h = np.where((d2 > 8 * loc) & (d2 > 0.01))[0]; keep = []
    for x0 in h:
        if not keep or x0 - keep[-1] > sr * 0.02: keep.append(x0)
    return [round(v / sr, 3) for v in keep]
def bands(x):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; f = np.fft.rfftfreq(len(x), 1 / sr); t = X.sum()
    b = lambda a, c: round(float(X[(f >= a) & (f < c)].sum() / t * 100), 1)
    return {'<100': b(0, 100), '100-150': b(100, 150), '150-3k': b(150, 3000), '>3k': b(3000, sr / 2), '>8k': b(8000, sr / 2)}
mk = M['marks']
for a, b in zip(mk, mk[1:]):
    i0 = int((a['ct'] - t0 + 0.67) * sr); i1 = int((b['ct'] - t0 + 0.17) * sr)
    if i1 - i0 < sr * 3: continue
    m = (ch['L'][i0:i1] + ch['R'][i0:i1]) / 2
    print(f"{tr:10s} {a['label']:8s} master {bands(m)} music-bus {bands(ch['music'][i0:i1])} clicks master {clicks(m)[:5]} music {clicks(ch['music'][i0:i1])[:5]}")
