# Round 45 builder: quick bus balance per marked segment of a rec45b capture (for tuning between recordings).
# usage: python3 quick45b.py <rawdir> <tag>
import sys, json, subprocess, numpy as np
raw, tag = sys.argv[1], sys.argv[2]
N = ['L', 'R', 'music', 'sfx', 'bed', 'amb', 'rev']
tl = json.load(open(f'{raw}/{tag}-timeline.json'))
ch = {n: np.fromfile(f'{raw}/{tag}-{n}.f32', dtype=np.float32).astype(np.float64) for n in N}
sr, t0 = tl['sr'], tl['t0']
off = 0.1707  # capture latency (critic: 170.67 ms in every session)
def i(ct): return max(0, int((ct - t0 + off) * sr))
def db(x): return 20 * np.log10(np.sqrt(np.mean(x * x)) + 1e-12)
marks = tl['marks'] + [{'label': 'end', 'ct': t0 + len(ch['L']) / sr - 0.3}]
def ebur(a, b):
    st = np.stack([ch['L'][a:b], ch['R'][a:b]], 1).astype(np.float32)
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-', '-af', 'ebur128=peak=true', '-f', 'null', '-'], input=st.tobytes(), capture_output=True)
    t = p.stderr.decode(); s = t[t.rfind('Summary:'):]
    g = lambda k: s.split(k)[1].split()[0]
    return g('I:'), g('Peak:')
def bands(x):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; f = np.fft.rfftfreq(len(x), 1 / sr); t = X.sum() + 1e-20
    b = lambda a, c: round(float(X[(f >= a) & (f < c)].sum() / t * 100), 1)
    return {'<100': b(0, 100), '<150': b(0, 150), '3k-6k': b(3000, 6000), '>3k': b(3000, 24000), '>8k': b(8000, 24000)}
for m0, m1 in zip(marks, marks[1:]):
    a, b = i(m0['ct'] + 0.5), i(m1['ct'])
    if b - a < sr: continue
    I, TP = ebur(a, b)
    mono = (ch['L'][a:b] + ch['R'][a:b]) / 2
    print(f"{m0['label'][:14]:14} {(b-a)/sr:5.1f}s  LUFS {I:>6} TP {TP:>5}  music {db(ch['music'][a:b]):6.1f} bed {db(ch['bed'][a:b]):6.1f} amb {db(ch['amb'][a:b]):6.1f} sfx {db(ch['sfx'][a:b]):6.1f} rev {db(ch['rev'][a:b]):6.1f}  bed-music {db(ch['bed'][a:b])-db(ch['music'][a:b]):+5.1f}  {bands(mono)}")
