# Round 10 critic: cut and measure the captured audio (master output, music bus, cue bus) from music-run.mjs TAP=1.
# usage: python3 -I analyze-audio.py <rawdir> <seed> <outdir>
import sys, json, wave, struct
import numpy as np
raw, seed, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
tl = json.load(open(f"{raw}/s{seed}-timeline.json"))
sr = tl['sr']; t0 = tl['t0']
M = np.fromfile(f"{raw}/s{seed}-master.f32", dtype=np.float32)
MU = np.fromfile(f"{raw}/s{seed}-music.f32", dtype=np.float32)
CU = np.fromfile(f"{raw}/s{seed}-cues.f32", dtype=np.float32)
OFF = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0  # capture latency correction (s)
idx = lambda ct: int(round((ct - t0 + OFF) * sr))
print(f"sr {sr} t0 {t0:.3f} samples {len(M)} ({len(M)/sr:.1f} s)")
TL, ML = tl['TL'], tl['mlog']

def kweight_gain(f):
    # BS.1770 K-weighting magnitude^2 (shelf + RLB highpass), evaluated with the 48 kHz biquads on the unit circle
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1.0, -1.99004745483398, 0.99007225036621]
    z = np.exp(-1j * 2 * np.pi * f / 48000)
    H = lambda b, a: (b[0] + b[1] * z + b[2] * z**2) / (a[0] + a[1] * z + a[2] * z**2)
    return np.abs(H(b1, a1) * H(b2, a2)) ** 2

def spectrum(x):
    n = 8192
    if len(x) < n: return None, None
    w = np.hanning(n); segs = [x[i:i + n] * w for i in range(0, len(x) - n, n // 2)]
    P = np.mean([np.abs(np.fft.rfft(s)) ** 2 for s in segs], axis=0)
    f = np.fft.rfftfreq(n, 1 / sr)
    return f, P

def clicks(x, label):
    # a click = a sample step far outside the local signal slope: |dx| > 10x the RMS of dx over the surrounding 2 ms (centre excluded) and > 0.004
    d = np.diff(x.astype(np.float64)); a = d * d; W = int(sr * 0.002)
    c = np.concatenate([[0], np.cumsum(a)])
    lo = np.clip(np.arange(len(a)) - W, 0, len(a)); hi = np.clip(np.arange(len(a)) + W + 1, 0, len(a))
    s = (c[hi] - c[lo] - a) / np.maximum(1, hi - lo - 1)
    r = np.abs(d) / np.sqrt(s + 1e-20)
    flag = np.where((r > 10) & (np.abs(d) > 0.004))[0]
    ev = []
    for i in flag:
        if not ev or i - ev[-1][0] > sr * 0.01: ev.append([i, float(np.abs(d[i])), float(r[i])])
    return ev

def measure(name, a, b, write=True):
    a = max(0, a); b = min(len(M), b)
    x, mu, cu = M[a:b], MU[a:b], CU[a:b]
    if len(x) < sr: return None
    pk = float(np.max(np.abs(x))); rms = float(np.sqrt(np.mean(x.astype(np.float64) ** 2)))
    f, P = spectrum(x); tot = P.sum()
    band = lambda lo, hi: float(P[(f >= lo) & (f < hi)].sum() / tot * 100)
    lufs = -0.691 + 10 * np.log10(np.sum(P * kweight_gain(f)) / np.sum(np.hanning(8192) ** 2) / (len(np.hanning(8192))) * 2 + 1e-20)
    # direct ungated K-loudness via mean square scaled by spectral K-gain ratio (robust to the Welch scale)
    kratio = np.sum(P * kweight_gain(f)) / tot
    lufs = -0.691 + 10 * np.log10(np.mean(x.astype(np.float64) ** 2) * kratio + 1e-20)
    fm, Pm = spectrum(mu); totm = Pm.sum() if Pm is not None else 1
    bandm = lambda lo, hi: float(Pm[(fm >= lo) & (fm < hi)].sum() / totm * 100)
    cen = float((f * P).sum() / tot)
    musr = float(np.sqrt(np.mean(mu.astype(np.float64) ** 2))); cur = float(np.sqrt(np.mean(cu.astype(np.float64) ** 2)))
    db = lambda v: round(20 * np.log10(max(v, 1e-9)), 1)
    ck_m = clicks(mu, name + ' music'); ck_x = clicks(x, name + ' master')
    res = dict(clip=name, dur=round(len(x) / sr, 1), peak_dbfs=db(pk), samples_over_0_99=int(np.sum(np.abs(x) >= 0.99)), samples_at_or_over_1=int(np.sum(np.abs(x) >= 1.0)),
               rms_dbfs=db(rms), lufs_approx=round(float(lufs), 1), crest_db=round(db(pk) - db(rms), 1),
               below150_pct=round(band(0, 150), 1), phone_band_rms_dbfs=round(db(rms) + 10 * np.log10(max(1e-9, band(200, sr / 2) / 100)), 1), mid_pct=round(band(150, 6000), 1), above6k_pct=round(band(6000, sr / 2), 2), above6k_music_pct=round(bandm(6000, sr / 2), 2), centroid_hz=int(cen),
               music_rms_dbfs=db(musr), cues_rms_dbfs=db(cur), clicks_music=len(ck_m), clicks_master=len(ck_x),
               click_times_music_in_clip=[round(e[0] / sr, 2) for e in ck_m][:12], click_rate_music_per_s=round(len(ck_m) / (len(x) / sr), 2), click_size_music=round(float(np.median([e[1] for e in ck_m])) if ck_m else 0, 3), click_times_master_in_clip=[round(e[0] / sr, 2) for e in ck_x][:12])
    if write:
        # mono 22.05 kHz 16-bit WAV: 2:1 decimation after a simple 31-tap windowed-sinc lowpass at 10 kHz (48 k -> 24 k), then resample to 22.05 k by linear interp
        h = np.sinc(2 * 10000 / sr * (np.arange(63) - 31)) * np.hamming(63); h /= h.sum()
        y = np.convolve(x, h, mode='same')
        tt = np.arange(0, len(y) / sr, 1 / 22050); y2 = np.interp(tt, np.arange(len(y)) / sr, y)
        pcm = np.clip(y2, -1, 1) * 32767
        with wave.open(f"{outdir}/{name}.wav", 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050); w.writeframes(pcm.astype('<i2').tobytes())
    return res

def ctOf(pred, src):
    for s in src:
        if pred(s) and s.get('ct') is not None: return s['ct']
    return None

segs = {}
title_ct = ctOf(lambda s: s['tag'] == 'title', TL); enter_ct = ctOf(lambda s: s['tag'] == 'enter', TL)
segs['title'] = (title_ct + 1.5, min(enter_ct, title_ct + 16.5))
run = [s for s in ML if s['state'] == 'playing' and s['ct'] is not None]
def longest(pred):
    best = (0, None, None); cur = None
    for s in run:
        if pred(s) and s['timeLeft'] > 10:
            if cur is None: cur = s['ct']
            if s['ct'] - cur > best[0]: best = (s['ct'] - cur, cur, s['ct'])
        else: cur = None
    return best
L0 = longest(lambda s: s['m']['chain'] == 0 and s['m']['duck'] > 0.99 or (s['m']['chain'] == 0))
L3 = longest(lambda s: s['m']['chain'] >= 3)
print('longest chain0', round(L0[0], 1), 'longest chain3', round(L3[0], 1))
segs['run-chain0'] = (L0[1], L0[1] + min(15, L0[0]))
if L3[0] >= 15: segs['run-chain3'] = (L3[1], L3[1] + 15)
else:
    # the 15 s window holding the most time at chain 3+
    best = (0, None)
    for s in run:
        w = [q for q in run if s['ct'] <= q['ct'] < s['ct'] + 15]
        sc = sum(1 for q in w if q['m']['chain'] >= 3)
        if sc > best[0]: best = (sc, s['ct'])
    segs['run-chain3'] = (best[1], best[1] + 15)
fin = []
for s_ in reversed(run):
    if s_['timeLeft'] <= 10.05: fin.insert(0, s_)
    else: break
over_ct = ctOf(lambda s: s['state'] == 'over', ML) or ctOf(lambda s: s['tag'] == 'over', TL)
if fin: segs['last-10s'] = (fin[0]['ct'], over_ct if over_ct else fin[-1]['ct'])
passes = []; prev = 0
for s in run:
    if s['passes'] > prev: passes.append(s['ct']); prev = s['passes']
for i, p in enumerate(passes): segs[f'medal-fanfare-{i + 1}'] = (p - 2.0, p + 4.0)
if over_ct: segs['game-over'] = (over_ct - 0.5, over_ct + 15)
results = []
for k, (a, b) in segs.items():
    r = measure(k, idx(a), idx(b)); r['ct'] = [round(a, 2), round(b, 2)]
    # what the music system said during the clip
    inside = [s for s in ML + TL if s.get('ct') is not None and a <= s['ct'] <= b]
    mm = [s.get('m') or s.get('music') for s in inside]
    if mm: r['music_state'] = dict(tracks=sorted(set(x['track'] for x in mm)), layers=sorted(set(x['layer'] for x in mm)), intensity=[min(x['intensity'] for x in mm), max(x['intensity'] for x in mm)], chain=sorted(set(s.get('chain') for s in inside)))
    results.append(r)
    print(json.dumps(r))

# ducking: music bus level before vs during each duck (from the game's own duck log)
ducks = []; seen = 0
for s in ML:
    m = s['m']
    if m['ducks'] > seen and m.get('lastDuck'):
        seen = m['ducks']; ducks.append(m['lastDuck'])
uniq = {}
for dk in ducks: uniq[(dk['reason'], dk['at'])] = dk
rows = []
for dk in uniq.values():
    at = dk['at']
    pre = MU[idx(at - 0.55):idx(at - 0.05)]; dur = MU[idx(at + 0.1):idx(at + 0.4)]
    cu = CU[idx(at):idx(at + 0.4)]
    if len(pre) < 100 or len(dur) < 100: continue
    r = lambda v: 20 * np.log10(np.sqrt(np.mean(v.astype(np.float64) ** 2)) + 1e-9)
    rows.append(dict(reason=dk['reason'], at=at, nominal_db=round(20 * np.log10(dk['depth']), 1), measured_db=round(r(dur) - r(pre), 1), cue_over_music_db=round(r(cu) - r(dur), 1)))
by = {}
for r_ in rows: by.setdefault(r_['reason'], []).append(r_)
print('DUCKS', json.dumps({k: dict(n=len(v), nominal=v[0]['nominal_db'], measured_median=float(np.median([x['measured_db'] for x in v])), cue_over_music_median=float(np.median([x['cue_over_music_db'] for x in v]))) for k, v in by.items()}))
# fanfare: cue bus vs music bus over the 1.2 s fanfare
for i, p in enumerate(passes):
    medal = [d for d in uniq.values() if d['reason'] == 'medal']
    for d in medal:
        at = d['at']
        cu = CU[idx(at):idx(at + 1.2)]; mu = MU[idx(at):idx(at + 1.2)]; mpre = MU[idx(at - 1.0):idx(at - 0.05)]
        r = lambda v: 20 * np.log10(np.sqrt(np.mean(v.astype(np.float64) ** 2)) + 1e-9)
        print('FANFARE', json.dumps(dict(at=at, cue_rms=round(r(cu), 1), music_rms_during=round(r(mu), 1), music_rms_before=round(r(mpre), 1), margin_db=round(r(cu) - r(mu), 1))))
    break
json.dump(dict(results=results, ducks=rows), open(f"{outdir}/measurements.json", 'w'), indent=1)
