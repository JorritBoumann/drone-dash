# Round 11 builder: measure quick-audio.mjs captures with the round 10 critic's methods (same click detector, same
# ungated K-weighted loudness, same band shares), plus 3 s short-term loudness, comp/limiter reduction and a
# repetition check (smallest lag with music-bus correlation >= 0.8).
import sys, json, numpy as np
raw = sys.argv[1]
mk = json.load(open(raw + '/marks.json')); sr = mk['sr']; t0 = mk['t0']
M = np.fromfile(raw + '/master.f32', dtype=np.float32).astype(np.float64)
MU = np.fromfile(raw + '/music.f32', dtype=np.float32).astype(np.float64)
idx = lambda c: int(round((c - t0) * sr))
def kg(f):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1.0, -1.99004745483398, 0.99007225036621]
    z = np.exp(-1j * 2 * np.pi * f / 48000); H = lambda b, a: (b[0] + b[1] * z + b[2] * z**2) / (a[0] + a[1] * z + a[2] * z**2)
    return np.abs(H(b1, a1) * H(b2, a2)) ** 2
def spec(x):
    n = 8192; w = np.hanning(n); P = np.mean([np.abs(np.fft.rfft(x[i:i + n] * w)) ** 2 for i in range(0, len(x) - n, n // 2)], axis=0)
    return np.fft.rfftfreq(n, 1 / sr), P
def lufs(x):
    f, P = spec(x); return -0.691 + 10 * np.log10(np.mean(x ** 2) * np.sum(P * kg(f)) / P.sum() + 1e-20)
def clicks(x):
    d = np.diff(x); a = d * d; W = int(sr * 0.002); c = np.concatenate([[0], np.cumsum(a)]); n = len(a)
    lo = np.clip(np.arange(n) - W, 0, n); hi = np.clip(np.arange(n) + W + 1, 0, n)
    s = (c[hi] - c[lo] - a) / np.maximum(1, hi - lo - 1); r = np.abs(d) / np.sqrt(s + 1e-20)
    ev = []
    for i in np.where((r > 10) & (np.abs(d) > 0.004))[0]:
        if not ev or i - ev[-1] > sr * 0.01: ev.append(i)
    return ev
def rep(x, maxlag=62):
    # envelope-free waveform correlation at bar-multiple lags (1.92 s steps) and fine search around them
    out = []
    bar = 1.92
    for k in range(1, int(maxlag / bar) + 1):
        L = int(round(k * bar * sr))
        if L >= len(x) - sr * 4: break
        a, b = x[:len(x) - L], x[L:]
        best = max(float(np.corrcoef(a[: len(a)], b[: len(a)])[0, 1]) for _ in [0])
        out.append((round(k * bar, 2), round(best, 3)))
    return out
res = {}
for m in mk['marks']:
    a, b = idx(m['a']), idx(m['b']); x, mu = M[a:b], MU[a:b]
    f, P = spec(x); tot = P.sum(); band = lambda lo, hi: float(P[(f >= lo) & (f < hi)].sum() / tot * 100)
    st = [lufs(x[i:i + 3 * sr]) for i in range(0, len(x) - 3 * sr, sr)]
    r = dict(dur=round(len(x) / sr, 1), peak_dbfs=round(20 * np.log10(np.max(np.abs(x))), 2), lufs=round(lufs(x), 1), st3_min=round(min(st), 1), st3_med=round(float(np.median(st)), 1), st3_max=round(max(st), 1),
             below150=round(band(0, 150), 1), above6k=round(band(6000, sr / 2), 2), band300_3k=round(band(300, 3000), 1), music_rms=round(10 * np.log10(np.mean(mu ** 2) + 1e-20), 1),
             clicks_music=len(clicks(mu)), clicks_master=len(clicks(x)))
    rr = [q for q in mk['red'] if q['seg'] == m['name']]
    if rr: r['comp_db_med'] = float(np.median([q['comp'] for q in rr])); r['comp_db_min'] = min(q['comp'] for q in rr); r['lim_db_med'] = float(np.median([q['lim'] for q in rr])); r['lim_db_min'] = min(q['lim'] for q in rr)
    if r['clicks_master']:
        ck = clicks(x); r['master_click_s'] = [round(c / sr, 3) for c in ck][:10]; r['master_click_mod4096'] = [int((a + c + 1) % 4096) for c in ck][:10]
    if m['name'].startswith('rep'):
        cr = rep(mu); r['corr_by_lag'] = cr; hits = [l for l, c in cr if c >= 0.8]; r['first_lag_corr_ge_0_8'] = hits[0] if hits else None
    res[m['name']] = r
    print(m['name'], json.dumps(r))
json.dump(res, open(raw + '/quick-results.json', 'w'), indent=1)
