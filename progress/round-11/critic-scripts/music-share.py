# Round 11 critic: how loud is the music itself inside the master? Least-squares fit master ~ a*music + b*cues (music bus 12 ms ahead),
# then the K-weighted loudness of a*music alone and of the remainder (rotor, wind, reverb, compressor error).
import sys, json, numpy as np
raw, key, mj = sys.argv[1], sys.argv[2], sys.argv[3]
sys.argv = ['x', raw, key, '-']
src = open(__file__.replace('music-share.py', 'analyze11.py')).read(); exec(src[:src.index('segs = {}')])
M = json.load(open(mj)); LAG = int(0.012 * sr)
for c in M['clips']:
    a, b = c['ct']; mu = CH['music'][idx(a, 'music'):idx(b, 'music')]; cu = CH['cues'][idx(a, 'cues'):idx(b, 'cues')]
    x = CH['master'][idx(a, 'master') + LAG:idx(a, 'master') + LAG + len(mu)]; n = min(len(mu), len(cu), len(x)); mu, cu, x = mu[:n], cu[:n], x[:n]
    A = np.stack([mu, cu], 1); coef, *_ = np.linalg.lstsq(A, x, rcond=None); rest = x - A @ coef
    L = lambda v: round(loudness(v)['integrated_lufs'] or -99, 1)
    print(key, c['clip'], 'master', L(x), 'music part', L(coef[0] * mu), 'cue part', L(coef[1] * cu) if np.any(cu) else None, 'rest (rotor, wind, reverb)', L(rest), 'gain a', round(float(coef[0]), 2))
