# Round 45 critic: are the chimes in the music's chord? For each payout / delivery / pickup, the 3 strongest pitch
# classes of the effects bus (0.03 to 0.35 s after the cue) against the music bus's pitch-class profile over the 1.5 s
# around it. A chime note counts as "in" when its pitch class is one of the music's 4 strongest at that moment.
# Run on the after captures and the before captures (6-channel) for comparison.
import sys, numpy as np
src = open(__file__.replace('chimekey45c.py', 'analyze45c.py')).read()
exec(src.split('def plan_for')[0].replace('RAW_A, RAW_B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]', 'RAW_A, RAW_B = sys.argv[1], sys.argv[2]').replace('os.makedirs(OUT, exist_ok=True)', ''))
NOTES = 'C C# D D# E F F# G G# A A# B'.split()
def chroma(x, sr):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; f = np.fft.rfftfreq(len(x), 1 / sr); c = np.zeros(12)
    m = (f > 180) & (f < 4200); pc = np.round(12 * np.log2(f[m] / 261.6256)).astype(int) % 12
    np.add.at(c, pc, X[m]); return c / (c.sum() + 1e-20)
for lab, raw, names in (('after', RAW_A, NA), ('before', RAW_B, NB)):
    tot = inn = 0; rows = {}
    for tag in ('main-s22', 'ot-s22'):
        S = load(raw, tag, names); E = events(S); sr = S['sr']
        for (t, kind, desc) in E:
            if kind not in ('duck:slip', 'duck:delivery', 'duck:pickup'): continue
            c = chroma(S['ch']['sfx'][idx(S, t + 0.03):idx(S, t + 0.35)], sr); m = chroma(S['ch']['music'][idx(S, t - 1.2):idx(S, t + 0.3)], sr)
            top = list(np.argsort(c)[::-1][:3]); mus = set(np.argsort(m)[::-1][:4])
            k = sum(1 for p in top if p in mus); tot += 3; inn += k
            r = rows.setdefault(kind, [0, 0]); r[0] += k; r[1] += 3
    print(lab, 'chime notes in the music chord:', f'{inn}/{tot} = {inn / tot:.0%}', {k: f'{a}/{b}' for k, (a, b) in rows.items()})
