# Round 11 critic: measure the captures from music-run11.mjs (TAP=1).
# usage: python3 analyze11.py <rawdir> <tag+seed, e.g. ds22> <outdir or -> [write wavs: 1/0]
# Channels: master output (after limiter and trim), music bus (musicOut), cue bus (sfx).
# Capture latency per channel comes from a known noise burst (calT) found by matched filter.
import sys, json, wave
import numpy as np
raw, key, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
WRITE = len(sys.argv) > 4 and sys.argv[4] == '1'
tl = json.load(open(f"{raw}/{key}-timeline.json"))
sr = tl['sr']; t0 = tl['t0']; calT = tl.get('calT')
CH = {n: np.fromfile(f"{raw}/{key}-{n}.f32", dtype=np.float32).astype(np.float64) for n in ['master', 'music', 'cues']}
TL, ML = tl['TL'], tl['mlog']
out = dict(key=key, sr=sr, seconds=round(len(CH['master']) / sr, 1), mobile=tl.get('mobile'), force=tl.get('force'))

# ---------- capture latency from the calibration burst ----------
n = round(sr * 0.01); x = 12345.0; burst = np.zeros(n)
for i in range(n):
    x = (x * 1103515245.0 + 12345.0) % 2147483648.0
    burst[i] = (x / 2147483648.0 * 2 - 1) * 0.6
OFF = {}
for name, sig in CH.items():
    e = int((calT - t0) * sr); a = max(0, e - int(0.3 * sr)); b = min(len(sig), e + int(0.6 * sr))
    seg = sig[a:b]
    c = np.correlate(seg, burst, mode='valid')
    i = int(np.argmax(c)); norm = c[i] / np.dot(burst, burst)
    OFF[name] = (t0 + (a + i) / sr) - calT
    out.setdefault('latency_ms', {})[name] = dict(ms=round(OFF[name] * 1000, 2), match=round(float(norm), 3))
# the master also carries the two compressors' look-ahead for anything that goes through them: find it against the music bus
def idx(ct, ch): return int(round((ct - t0 + OFF[ch]) * sr))

def kgain(f):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1.0, -1.99004745483398, 0.99007225036621]
    z = np.exp(-1j * 2 * np.pi * f / 48000)
    H = lambda b, a: (b[0] + b[1] * z + b[2] * z ** 2) / (a[0] + a[1] * z + a[2] * z ** 2)
    return np.abs(H(b1, a1) * H(b2, a2)) ** 2

def kpow(x):
    # K-weighted mean square of a block via Parseval
    N = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(N, 1 / sr); P = np.abs(X) ** 2; P[1:-1] *= 2
    return float(np.sum(P * kgain(f)) / N ** 2)

def loudness(x):
    L = lambda p: -0.691 + 10 * np.log10(p + 1e-20)
    # momentary blocks 400 ms, hop 100 ms; short-term 3 s, hop 1 s
    blk = int(0.4 * sr); hop = int(0.1 * sr)
    mom = np.array([kpow(x[i:i + blk]) for i in range(0, len(x) - blk + 1, hop)])
    st = np.array([kpow(x[i:i + 3 * sr]) for i in range(0, len(x) - 3 * sr + 1, sr // 2)]) if len(x) >= 3 * sr else np.array([kpow(x)])
    g = mom[L(mom) > -70]
    integ = None
    if len(g):
        rel = L(np.mean(g)) - 10; g2 = g[L(g) > rel]; integ = round(float(L(np.mean(g2))), 1)
    return dict(integrated_lufs=integ, short_term_median=round(float(np.median(L(st))), 1), short_term_min=round(float(np.min(L(st))), 1), short_term_max=round(float(np.max(L(st))), 1))

def spectrum(x):
    N = 8192
    if len(x) < N: return None, None
    w = np.hanning(N); segs = [x[i:i + N] * w for i in range(0, len(x) - N, N // 2)]
    return np.fft.rfftfreq(N, 1 / sr), np.mean([np.abs(np.fft.rfft(s)) ** 2 for s in segs], axis=0)

def merge(flag, vals, ratio):
    ev = []
    for i in flag:
        if not ev or i - ev[-1][0] > sr * 0.01: ev.append([int(i), float(vals[i]), float(ratio[i])])
    return ev

def clicks_r10(x):
    # round 10 detector: |dx| > 10x the RMS of dx over the surrounding +-2 ms (centre excluded) and > 0.004
    d = np.diff(x); a = d * d; W = int(sr * 0.002); c = np.concatenate([[0], np.cumsum(a)])
    lo = np.clip(np.arange(len(a)) - W, 0, len(a)); hi = np.clip(np.arange(len(a)) + W + 1, 0, len(a))
    s = (c[hi] - c[lo] - a) / np.maximum(1, hi - lo - 1); r = np.abs(d) / np.sqrt(s + 1e-20)
    return merge(np.where((r > 10) & (np.abs(d) > 0.004))[0], np.abs(d), r)

def clicks_strict(x, floor):
    # round 11 critic, stricter than round 10: |dx| > 5x (not 10x) the RMS of dx over +-5 ms with +-2 samples around the
    # centre excluded (so a 3 to 4 sample spike cannot hide in its own reference), and |dx| > floor
    # (0.002 on the music bus, half of round 10's 0.004; 0.005 on the master, which now runs about 8 dB hotter than the bus)
    d = np.diff(x); a = d * d; W = int(sr * 0.005); E = 2; c = np.concatenate([[0], np.cumsum(a)])
    i = np.arange(len(a)); L = len(a)
    lo = np.clip(i - W, 0, L); hi = np.clip(i + W + 1, 0, L); clo = np.clip(i - E, 0, L); chi = np.clip(i + E + 1, 0, L)
    s = ((c[hi] - c[lo]) - (c[chi] - c[clo])) / np.maximum(1, (hi - lo) - (chi - clo)); r = np.abs(d) / np.sqrt(s + 1e-20)
    # spike shape: the slope itself has to jump (max |d2| within +-2 samples over 0.3 x |dx|); a smooth steep edge of the
    # rotor's low-passed saw passes the level test but not this one
    d2p = np.concatenate([[0, 0, 0], np.abs(np.diff(d)), [0, 0, 0]]); d2m = np.lib.stride_tricks.sliding_window_view(d2p, 6).max(1)[:len(d)]
    return merge(np.where((r > 5) & (np.abs(d) > floor) & (d2m > 0.3 * np.abs(d)))[0], np.abs(d), r)

db = lambda v: round(20 * np.log10(max(v, 1e-12)), 1)
rms = lambda v: float(np.sqrt(np.mean(v ** 2))) if len(v) else 0.0

def measure(name, a_ct, b_ct):
    am, bm = idx(a_ct, 'master'), idx(b_ct, 'master'); au, bu = idx(a_ct, 'music'), idx(b_ct, 'music'); ac, bc = idx(a_ct, 'cues'), idx(b_ct, 'cues')
    x = CH['master'][am:bm]; mu = CH['music'][au:bu]; cu = CH['cues'][ac:bc]
    if len(x) < sr: return None
    f, P = spectrum(x); tot = P.sum(); band = lambda lo, hi: float(P[(f >= lo) & (f < hi)].sum() / tot * 100)
    fm, Pm = spectrum(mu); bandm = lambda lo, hi: float(Pm[(fm >= lo) & (fm < hi)].sum() / Pm.sum() * 100)
    pk = float(np.max(np.abs(x)))
    r10m, r10x = clicks_r10(mu), clicks_r10(x); sm, sx = clicks_strict(mu, 0.002), clicks_strict(x, 0.005)
    dur = len(x) / sr
    res = dict(clip=name, ct=[round(a_ct, 2), round(b_ct, 2)], dur=round(dur, 1), peak_dbfs=db(pk), samples_over_m1dbfs=int(np.sum(np.abs(x) > 10 ** (-1 / 20))), samples_at_or_over_1=int(np.sum(np.abs(x) >= 1.0)),
               rms_dbfs=db(rms(x)), **loudness(x), below150_pct=round(band(0, 150), 1), above6k_pct=round(band(6000, sr / 2), 2),
               phone_band_rms_dbfs=round(db(rms(x)) + 10 * np.log10(max(1e-9, band(200, sr / 2) / 100)), 1), music_below150_pct=round(bandm(0, 150), 1),
               music_rms_dbfs=db(rms(mu)), cues_rms_dbfs=db(rms(cu)),
               clicks_r10_music=len(r10m), clicks_r10_master=len(r10x), clicks_strict_music=len(sm), clicks_strict_master=len(sx),
               rate_r10_master=round(len(r10x) / dur, 2), rate_strict_master=round(len(sx) / dur, 2),
               strict_master_times=[round(e[0] / sr, 3) for e in sx][:15], strict_master_sizes=[round(e[1], 4) for e in sx][:15],
               strict_music_times=[round(e[0] / sr, 3) for e in sm][:15], strict_music_sizes=[round(e[1], 4) for e in sm][:15], r10_master_times=[round(e[0] / sr, 3) for e in r10x][:15])
    if WRITE and outdir != '-':
        h = np.sinc(2 * 10000 / sr * (np.arange(63) - 31)) * np.hamming(63); h /= h.sum()
        y = np.convolve(x, h, mode='same'); tt = np.arange(0, len(y) / sr, 1 / 22050); y2 = np.interp(tt, np.arange(len(y)) / sr, y)
        with wave.open(f"{outdir}/{name}.wav", 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050); w.writeframes((np.clip(y2, -1, 1) * 32767).astype('<i2').tobytes())
    return res

def ctOf(pred, src):
    for s in src:
        if pred(s) and s.get('ct') is not None: return s['ct']
    return None

segs = {}
title_ct = ctOf(lambda s: s['tag'] == 'title', TL); enter_ct = ctOf(lambda s: s['tag'] == 'enter', TL)
segs['title'] = (max(title_ct + 1.5, calT + 0.3), min(enter_ct, title_ct + 16.5))
run = [s for s in ML if s['state'] == 'playing' and s['ct'] is not None]
over_ct = ctOf(lambda s: s['state'] == 'over', ML) or ctOf(lambda s: s['tag'] == 'over', TL)
if tl.get('force'):
    fs = {s['tag']: s['ct'] for s in TL if s['tag'].startswith('force')}
    segs['forced-chain0'] = (fs['force-0-false'] + 3, fs['force-3-false'])
    segs['forced-chain3'] = (fs['force-3-false'] + 3, fs['force-3-true'])
    segs['forced-final'] = (fs['force-3-true'] + 1, over_ct or fs['force-3-true'] + 20)
else:
    def longest(pred):
        best = (0, None, None); cur = None
        for s in run:
            if pred(s) and s['timeLeft'] > 10:
                if cur is None: cur = s['ct']
                if s['ct'] - cur > best[0]: best = (s['ct'] - cur, cur, s['ct'])
            else: cur = None
        return best
    L0 = longest(lambda s: s['m']['chain'] == 0 and s['m']['track'] == 'run')
    segs['run-chain0'] = (L0[1], L0[1] + min(15, L0[0]))
    best = (0, None)
    for s in run:
        sc = sum(1 for q in run if s['ct'] <= q['ct'] < s['ct'] + 15 and q['m']['chain'] >= 3 and q['m']['track'] == 'run')
        if sc > best[0]: best = (sc, s['ct'])
    if best[1] is not None: segs['run-chain3'] = (best[1], best[1] + 15)
    out['chain3_window_frac'] = round(best[0] / max(1, sum(1 for q in run if best[1] <= q['ct'] < best[1] + 15)), 2) if best[1] else 0
    fin = []
    for s_ in reversed(run):
        if s_['timeLeft'] <= 10.05: fin.insert(0, s_)
        else: break
    if fin: segs['last-10s'] = (fin[0]['ct'], over_ct if over_ct else fin[-1]['ct'])
# ducks (each cue's exact audio-clock time)
ducks = {}; seen = 0
for s in ML:
    m = s['m']
    if m['ducks'] > seen and m.get('lastDuck'):
        seen = m['ducks']; d = m['lastDuck']; ducks[(d['reason'], d['at'])] = d
ducks = sorted(ducks.values(), key=lambda d: d['at'])
med = [d for d in ducks if d['reason'] == 'medal']
for i, d in enumerate(med[:2]): segs[f'medal-fanfare-{i + 1}'] = (d['at'] - 2.0, d['at'] + 4.0)
cr = [d for d in ducks if d['reason'] == 'crash']
if cr:
    # the crash with the most music around it (a crash at chain 0 at the run start is the least telling)
    segs['crash'] = (cr[len(cr) // 2]['at'] - 1.5, cr[len(cr) // 2]['at'] + 2.5)
if over_ct: segs['game-over'] = (over_ct - 0.5, over_ct + 15)
res = []
for k, (a, b) in segs.items():
    r = measure(k, a, b)
    if r: res.append(r)
out['clips'] = res

# ---------- cues over music (bus RMS, latency corrected), and in the master by least squares ----------
# master lag behind the music bus (compressor look-ahead), from cross-correlation on the run
def lagOf():
    a = idx(enter_ct + 5, 'music'); seg = CH['music'][a:a + 4 * sr]; best = (0, -1)
    am = idx(enter_ct + 5, 'master')
    for L in range(0, int(0.03 * sr)):
        y = CH['master'][am + L:am + L + len(seg)]
        c = np.dot(seg, y) / (np.linalg.norm(seg) * np.linalg.norm(y) + 1e-12)
        if c > best[1]: best = (L, c)
    return best
LAG, LAGC = lagOf(); out['master_lag_behind_buses_ms'] = round(LAG / sr * 1000, 2); out['master_lag_corr'] = round(float(LAGC), 3)
WIN = dict(slip=0.4, pickup=0.4, delivery=0.6, medal=1.2, crash=0.5, gameover=1.0)
rows = []
for d in ducks:
    at = d['at']; w = WIN.get(d['reason'], 0.4)
    mu = CH['music'][idx(at, 'music'):idx(at + w, 'music')]; cu = CH['cues'][idx(at, 'cues'):idx(at + w, 'cues')]
    pre = CH['music'][idx(at - 0.55, 'music'):idx(at - 0.05, 'music')]
    if len(mu) < 100 or len(pre) < 100 or rms(mu) == 0: continue
    # master decomposition: master[t+LAG] ~ a*music[t] + b*cues[t] + rest
    ma = idx(at, 'music') + LAG + int(round((OFF['master'] - OFF['music']) * sr)); xm = CH['master'][ma:ma + len(mu)]
    A = np.stack([mu, cu[:len(mu)]], 1); coef, *_ = np.linalg.lstsq(A, xm[:len(mu)], rcond=None)
    rest = xm[:len(mu)] - A @ coef
    cue_m, mus_m = abs(coef[1]) * rms(cu), abs(coef[0]) * rms(mu)
    rows.append(dict(reason=d['reason'], at=at, depth_db=round(20 * np.log10(d['depth']), 1), duck_measured_db=round(db(rms(mu)) - db(rms(pre)), 1),
                     cue_over_music_bus_db=round(db(rms(cu)) - db(rms(mu)), 1), cue_over_music_master_db=round(db(cue_m) - db(mus_m), 1), cue_over_rest_master_db=round(db(cue_m) - db(rms(rest)), 1)))
out['cue_rows'] = rows
by = {}
for r in rows: by.setdefault(r['reason'], []).append(r)
out['cues'] = {k: dict(n=len(v), depth_db=v[0]['depth_db'], duck_measured_median=round(float(np.median([x['duck_measured_db'] for x in v])), 1),
                       bus_median=round(float(np.median([x['cue_over_music_bus_db'] for x in v])), 1), bus_min=round(float(np.min([x['cue_over_music_bus_db'] for x in v])), 1),
                       master_median=round(float(np.median([x['cue_over_music_master_db'] for x in v])), 1), master_min=round(float(np.min([x['cue_over_music_master_db'] for x in v])), 1),
                       over_rest_median=round(float(np.median([x['cue_over_rest_master_db'] for x in v])), 1)) for k, v in by.items()}
# cue timing: onset of the cue bus after each duck time (latency corrected)
ons = []
for d in ducks:
    at = d['at']; cu = np.abs(CH['cues'][idx(at - 0.1, 'cues'):idx(at + 0.3, 'cues')])
    if len(cu) < 10: continue
    env = np.convolve(cu, np.ones(48) / 48, mode='same'); th = 0.2 * env.max()
    if env.max() > 1e-4: ons.append(round((np.argmax(env > th) / sr - 0.1) * 1000, 1))
out['cue_onset_vs_scheduled_ms'] = dict(n=len(ons), median=float(np.median(ons)) if ons else None, min=float(min(ons)) if ons else None, max=float(max(ons)) if ons else None)

# ---------- repetition: correlation of 4-bar windows at whole-bar lags ----------
BAR = 4 * 60 / 125
def repetition(a_ct, b_ct, lowpass=False):
    a, b = idx(a_ct, 'music'), idx(b_ct, 'music'); x = CH['music'][a:b].copy()
    if lowpass:
        X = np.fft.rfft(x); X[np.fft.rfftfreq(len(x), 1 / sr) > 3000] = 0; x = np.fft.irfft(X, len(x))
    W = int(round(4 * BAR * sr)); res = []
    k = 1
    while True:
        lag = k * BAR * sr; L = int(round(lag))
        starts = list(range(0, len(x) - W - L - 4, int(round(BAR * sr))))
        if not starts: break
        cs = []
        for s0 in starts:
            u = x[s0:s0 + W]; best = -1
            for dl in range(-3, 4):
                v = x[s0 + L + dl:s0 + L + dl + W]
                if len(v) < W: continue
                best = max(best, float(np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-12)))
            cs.append(best)
        res.append(dict(lag_s=round(k * BAR, 2), mean=round(float(np.mean(cs)), 3), max=round(float(np.max(cs)), 3), n=len(cs)))
        k += 1
    first = next((r['lag_s'] for r in res if r['mean'] > 0.8), None)
    firstmax = next((r['lag_s'] for r in res if r['max'] > 0.8), None)
    top = sorted(res, key=lambda r: -r['mean'])[:5]
    return dict(span_s=round(b_ct - a_ct, 1), max_lag_tested_s=res[-1]['lag_s'] if res else 0, first_lag_mean_over_0_8=first, first_lag_any_window_over_0_8=firstmax, top=top)
reps = {}
for k in ['forced-chain0', 'forced-chain3', 'run-chain3', 'title', 'game-over']:
    if k in segs:
        reps[k] = repetition(*segs[k]); reps[k + ' (below 3 kHz)'] = repetition(*segs[k], lowpass=True)
out['repetition'] = reps
# adaptive state summary
if not tl.get('force'):
    byc = {}
    for s in run:
        if s['timeLeft'] > 10 and s['m']['track'] == 'run': byc.setdefault(min(3, s['chain']), []).append(s['m']['intensity'])
    out['intensity_by_chain'] = {c: dict(n=len(v), mean=round(float(np.mean(v)), 3)) for c, v in sorted(byc.items())}
    fin10 = [s for s in run if s['timeLeft'] <= 10]
    out['final'] = dict(tracks=sorted(set(s['m']['track'] for s in fin10)), first_final_at=next((s['timeLeft'] for s in fin10 if s['m']['track'] == 'final'), None), meanI=round(float(np.mean([s['m']['intensity'] for s in fin10])), 3) if fin10 else None)
    lim = [s['m'].get('limiterDb', 0) for s in run]; out['limiter_db_min'] = min(lim) if lim else None
print(json.dumps(out, indent=1))
if outdir != '-': json.dump(out, open(f"{outdir}/measurements-{key}.json", 'w'), indent=1)
