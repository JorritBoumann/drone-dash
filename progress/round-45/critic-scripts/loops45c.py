# Round 45 critic: ambience loop audibility. (1) clicks on the ambience bus; (2) does the loudness pattern (50 ms RMS
# envelope, 300 Hz to 4 kHz, where noise "whooshes" are heard) repeat every 3.0 s more than at nearby lags?
# (3) the same with the music bus muted in the mix: ambience + drone only, as with the music toggled off.
import sys, numpy as np
src = open(__file__.replace('loops45c.py', 'analyze45c.py')).read()
exec(src.split('def plan_for')[0].replace('RAW_A, RAW_B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]', 'RAW_A = sys.argv[1]').replace('os.makedirs(OUT, exist_ok=True)', ''))
S = load(RAW_A, 'fx-s22', NA); sr = S['sr']
def bp(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / sr); X[(f < lo) | (f > hi)] = 0; return np.fft.irfft(X, len(x))
def envcorr(x, lag):
    h = int(0.05 * sr); e = np.sqrt(np.add.reduceat(x * x, np.arange(0, len(x) - h, h)) / h); e = np.log(e + 1e-9); e -= e.mean()
    L = int(round(lag / 0.05)); a, b = e[:-L], e[L:]; return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
for lab, (a, b) in {'altitude': ('altitude-cross', 'descend-harbour'), 'harbour': ('harbour-start', 'harbour-end'), 'street': ('street-start', 'fx-end')}.items():
    i0, i1 = idx(S, mark(S, a)), idx(S, mark(S, b))
    amb = S['ch']['amb'][i0:i1]; bed = S['ch']['bed'][i0:i1]
    ck = clicks(amb * 10, sr)
    xa = bp(amb, 300, 4000); xm = bp(amb + bed, 300, 4000)
    lags = [2.5, 2.8, 3.0, 3.2, 3.5, 6.0]
    print(f'{lab:9} {len(amb)/sr:5.1f} s  amb-bus clicks {len(ck)}  amb envelope corr ' + ' '.join(f'{l}s {envcorr(xa, l):+.2f}' for l in lags) + '  | amb+drone ' + ' '.join(f'{l}s {envcorr(xm, l):+.2f}' for l in lags))
