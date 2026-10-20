# Round 47 builder: the round 47 acceptance numbers from one set of raw captures (rec46b.mjs / rec47.mjs sessions).
# usage: python3 measure47.py <rawdir> <label>   (prints one JSON object)
# 1. Last 10 s and overtime: master (L+R) energy in 2 to 5 kHz, as a share of the whole spectrum and as dB under the
#    full-band level, over every playing poll in the 'final' or 'drop' section of the overtime session (MODE=ot).
# 2. Rotor at top speed: the drone bus (bed tap: rotor, chop, air, slipstream) in 0.3 s windows where the drone flies at
#    90% or more of the run's top speed (main session); share of energy above 1.5 kHz and in 1.5 to 5 kHz.
# 3. Breakbeat's overtime gap and drop (round 47 only, from the game's own gap/drop audio-clock times): music bus and
#    master level in the beat before the gap, in the gap, and in the first beat of the drop; energy under 60 Hz.
import sys, json
import numpy as np
raw, label = sys.argv[1], sys.argv[2]
NAMES = ['L', 'R', 'music', 'sfx', 'bed', 'amb', 'rev']
def load(tag):
    tl = json.load(open(f'{raw}/{tag}-timeline.json'))
    ch = {n: np.fromfile(f'{raw}/{tag}-{n}.f32', dtype=np.float32).astype(np.float64) for n in NAMES}
    sr, t0, calT = tl['sr'], tl['t0'], tl['calT']
    n = round(sr * 0.01); x = 12345.0; burst = np.zeros(n)
    for i in range(n):
        x = (x * 1103515245.0 + 12345.0) % 2147483648.0; burst[i] = (x / 2147483648.0 * 2 - 1) * 0.6
    e = int((calT - t0) * sr); a = max(0, e - int(0.3 * sr)); b = e + int(0.6 * sr)
    c = np.correlate(ch['L'][a:b], burst, mode='valid'); i = int(np.argmax(c))
    off = (t0 + (a + i) / sr) - calT
    return dict(tl=tl, ch=ch, sr=sr, t0=t0, off=off)
def idx(S, ct): return int(round((ct - S['t0'] + S['off']) * S['sr']))
def spec(x, sr):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; f = np.fft.rfftfreq(len(x), 1 / sr); return f, X
def db(v): return 10 * np.log10(v + 1e-20)
out = {'label': label}
# 1. last 10 s + overtime
S = load('ot-s22'); EV = S['tl']['EV']; sr = S['sr']
fin = [e for e in EV if e['state'] == 'playing' and e['section'] in ('final', 'drop')]
if fin:
    a, b = fin[0]['ct'], fin[-1]['ct']
    m = (S['ch']['L'] + S['ch']['R']) / 2
    tot = np.zeros(1); band = 0.0; allE = 0.0; n = 0
    w = int(0.5 * sr)
    for t in np.arange(a, b - 0.5, 0.5):
        i = idx(S, t); x = m[i:i + w]
        if len(x) < w: break
        f, X = spec(x, sr); band += X[(f >= 2000) & (f < 5000)].sum(); allE += X.sum(); n += 1
    hi = 0.0
    for t in np.arange(a, b - 0.5, 0.5):
        i = idx(S, t); x = m[i:i + w]
        if len(x) < w: break
        f, X = spec(x, sr); hi += X[(f >= 5000)].sum()
    out['final_ot'] = dict(seconds=round(b - a, 1), share_2_5k_pct=round(100 * band / allE, 2), band_2_5k_under_full_db=round(db(band) - db(allE), 1), share_over_5k_pct=round(100 * hi / allE, 2), windows=n)
# 2. rotor at top speed
S = load('main-s22'); EV = S['tl']['EV']; sr = S['sr']
pl = [e for e in EV if e['state'] == 'playing' and e.get('spd') is not None]
top = max(e['spd'] for e in pl); sel = [e for e in pl if e['spd'] >= 0.9 * top]
bed = S['ch']['bed']; w = int(0.3 * sr); hi = 0.0; mid = 0.0; allE = 0.0; low = 0.0; n = 0; last = -9
for e in sel:
    if e['ct'] - last < 0.3: continue
    last = e['ct']; i = idx(S, e['ct']); x = bed[i:i + w]
    if len(x) < w: continue
    f, X = spec(x, sr); allE += X.sum(); hi += X[f >= 1500].sum(); mid += X[(f >= 1500) & (f < 5000)].sum(); low += X[(f >= 30) & (f < 400)].sum(); n += 1
out['rotor_top'] = dict(top_speed=round(top, 1), windows=n, boosting_share=round(sum(1 for e in sel if e['boosting']) / max(1, len(sel)), 2), share_over_1k5_pct=round(100 * hi / allE, 1), share_1k5_5k_pct=round(100 * mid / allE, 1), share_30_400_pct=round(100 * low / allE, 1), level_db=round(db(allE / max(1, n) / w / w), 1), rotorHz=[e.get('rhz') for e in sel[:1]] + [max((e.get('rhz') or 0) for e in pl)])
# 3. gap and drop
S = load('ot-s22'); EV = S['tl']['EV']; sr = S['sr']
g = next((e['gap'] for e in reversed(EV) if e.get('gap') and e['gap'].get('drops')), None)
if g:
    beat = 60 / 168
    gA, dA = g['gapAt'], g['dropAt']
    def lv(chn, a, b):
        x = S['ch'][chn][idx(S, a):idx(S, b)] if chn != 'M' else (S['ch']['L'][idx(S, a):idx(S, b)] + S['ch']['R'][idx(S, a):idx(S, b)]) / 2
        return round(20 * np.log10(np.sqrt(np.mean(x * x)) + 1e-12), 1)
    def sub(a, b):
        x = S['ch']['music'][idx(S, a):idx(S, b)]; f, X = spec(x, sr); return round(db(X[(f >= 20) & (f < 60)].sum() / len(x)), 1)
    out['drop'] = dict(gapAt=round(gA, 3), dropAt=round(dA, 3), gap_len_s=round(dA - gA, 3), gaps=g['gaps'], drops=g['drops'], deferred=g['deferred'],
        music_db=dict(beat_before=lv('music', gA - beat, gA), gap=lv('music', gA + 0.02, dA), drop_beat=lv('music', dA, dA + beat)),
        master_db=dict(beat_before=lv('M', gA - beat, gA), gap=lv('M', gA + 0.02, dA), drop_beat=lv('M', dA, dA + beat)),
        music_under60_db=dict(gap=sub(gA + 0.02, dA), drop_first_0p35s=sub(dA, dA + 0.35)))
    # 50 ms music-bus RMS profile from 1 beat before the gap to 1 beat after the drop
    prof = []
    for t in np.arange(gA - beat, dA + beat, 0.05): prof.append(lv('music', t, t + 0.05))
    out['drop']['music_profile_50ms_from_beat_before_gap'] = prof
print(json.dumps(out))
