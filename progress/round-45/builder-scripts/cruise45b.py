# Round 45 builder: rotor bed against the music in cruise. Over the run of a session, 1 s windows with no cue on the
# effects bus (< -60 dB), no duck (music duck 1.0 in the 25 Hz log) and the drone flying: median of bed RMS - music RMS.
# Works on the critic's 6-channel captures (a45) and the builder's 7-channel ones (b45).
# usage: python3 cruise45b.py <rawdir> <tag> <channel names comma list>
import sys, json, numpy as np
raw, tag, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
tl = json.load(open(f'{raw}/{tag}-timeline.json')); sr = tl['sr']; t0 = tl['t0']
ch = {n: np.fromfile(f'{raw}/{tag}-{n}.f32', dtype=np.float32).astype(np.float64) for n in ['music', 'sfx', 'bed']}
db = lambda x: 20 * np.log10(np.sqrt(np.mean(x * x)) + 1e-12)
EV = [e for e in tl['EV'] if e['state'] == 'playing' and e['ct']]
res = []
for k in range(len(EV) - 1):
    e = EV[k]
    if e['ct'] < (EV[0]['ct'] + 3) or abs((e['ct'] * 2) % 2) > 0.05: pass
t = EV[0]['ct'] + 3
while t < EV[-1]['ct'] - 1:
    w = [e for e in EV if t <= e['ct'] < t + 1]
    if w and all((e['duck'] or 1) > 0.99 for e in w):
        a = int((t - t0 + 0.1707) * sr); b = a + sr
        if db(ch['sfx'][a:b]) < -60: res.append((db(ch['bed'][a:b]) - db(ch['music'][a:b]), db(ch['bed'][a:b]), db(ch['music'][a:b]), max(e['chain'] or 0 for e in w)))
    t += 1
r = np.array(res)
print(tag, 'windows', len(r), 'bed-music median %.1f dB (p10 %.1f, p90 %.1f), bed %.1f, music %.1f' % (np.median(r[:, 0]), np.percentile(r[:, 0], 10), np.percentile(r[:, 0], 90), np.median(r[:, 1]), np.median(r[:, 2])))
for lv in range(4):
    s = r[r[:, 3] == lv]
    if len(s): print('   chain', lv, 'n', len(s), 'bed-music median %.1f' % np.median(s[:, 0]))
