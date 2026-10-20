# Round 46 builder: loudness per calibration segment (master, ffmpeg ebur128) and music bus RMS. usage: python3 cal46.py RAWDIR TRACK
import sys, json, subprocess, numpy as np
raw, tr = sys.argv[1], sys.argv[2]
M = json.load(open(f'{raw}/{tr}-marks.json'))
ch = {n: np.fromfile(f'{raw}/{tr}-{n}.f32', dtype=np.float32) for n in ['L', 'R', 'music', 'bed']}
sr, t0 = M['sr'], M['t0']; lat = 0.17
def lufs(st):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-', '-af', 'ebur128=peak=true', '-f', 'null', '-'], input=st.astype(np.float32).tobytes(), capture_output=True)
    t = p.stderr.decode(); s = t[t.rfind('Summary:'):]
    g = lambda k: float(s.split(k)[1].split()[0])
    return g('I:'), g('Peak:')
mk = M['marks']
for a, b in zip(mk, mk[1:]):
    i0 = int((a['ct'] - t0 + lat + 0.5) * sr); i1 = int((b['ct'] - t0 + lat) * sr)
    if i1 - i0 < sr * 3: continue
    st = np.stack([ch['L'][i0:i1], ch['R'][i0:i1]], 1)
    I, TP = lufs(st)
    mus = 20 * np.log10(np.sqrt(np.mean(ch['music'][i0:i1] ** 2)) + 1e-12); bed = 20 * np.log10(np.sqrt(np.mean(ch['bed'][i0:i1] ** 2)) + 1e-12)
    print(f"{tr:10s} {a['label']:8s} {a['section']:12s} I {I:6.1f} LUFS  TP {TP:5.1f}  music {mus:6.1f}  bed {bed:6.1f}  bed-music {bed-mus:+5.1f}  live {a['live']}")
print('errors', M['errors'])
