# Round 46 builder: are the chimes in key with the soundtrack that plays? For each payout, pickup, delivery and medal
# (the duck the cue starts), the 3 strongest pitch classes of the effects bus 0.03 to 0.35 s after it, against
#  (a) the chord the music plays at that moment (the game's own chordPcs: bass, voicing and arp tones), and
#  (b) the critic's round-45 method: the 4 strongest pitch classes of the music bus over the 1.5 s around it.
# usage: python3 chime46.py <rawdir>
import sys, json, numpy as np
raw = sys.argv[1]
def chroma(x, sr):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; f = np.fft.rfftfreq(len(x), 1 / sr); c = np.zeros(12)
    m = (f > 180) & (f < 4200); pc = np.round(12 * np.log2(f[m] / 261.6256)).astype(int) % 12
    np.add.at(c, pc, X[m]); return c / (c.sum() + 1e-20)
tot = {'chord': [0, 0], 'music4': [0, 0]}; rows = {}
for tag in ('main-s22', 'ot-s22'):
    tl = json.load(open(f'{raw}/{tag}-timeline.json')); sr, t0 = tl['sr'], tl['t0']; lat = 0.1707
    ch = {n: np.fromfile(f'{raw}/{tag}-{n}.f32', dtype=np.float32).astype(np.float64) for n in ['sfx', 'music']}
    ix = lambda ct: int(round((ct - t0 + lat) * sr))
    seen = set()
    for e in tl['EV']:
        ld = e.get('lastDuck')
        if not ld or ld['at'] in seen or ld['reason'] not in ('slip', 'pickup', 'delivery', 'medal'): continue
        seen.add(ld['at']); t = ld['at']
        near = min(tl['EV'], key=lambda q: abs(q['ct'] - t)); pcs = set(near.get('chord') or [])
        c = chroma(ch['sfx'][ix(t + 0.03):ix(t + 0.35)], sr); m = chroma(ch['music'][ix(t - 1.2):ix(t + 0.3)], sr)
        top = list(np.argsort(c)[::-1][:3]); mus = set(np.argsort(m)[::-1][:4])
        a = sum(1 for p in top if p in pcs); b = sum(1 for p in top if p in mus)
        r = rows.setdefault(ld['reason'], [0, 0, 0]); r[0] += a; r[1] += b; r[2] += 3
        tot['chord'][0] += a; tot['chord'][1] += 3; tot['music4'][0] += b; tot['music4'][1] += 3
print('chime notes on the chord that plays:', f"{tot['chord'][0]}/{tot['chord'][1]} = {tot['chord'][0] / max(1, tot['chord'][1]):.0%}",
      '| critic method (music bus top 4):', f"{tot['music4'][0]}/{tot['music4'][1]} = {tot['music4'][0] / max(1, tot['music4'][1]):.0%}")
for k, (a, b, n) in rows.items(): print(f'  {k:9} chord {a}/{n} = {a / n:.0%}   music-top4 {b}/{n} = {b / n:.0%}')
