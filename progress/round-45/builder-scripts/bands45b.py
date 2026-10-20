# Round 45 builder: frequency bands, loudness, true peak and clicks of every clip WAV in a folder (before / after table).
# usage: python3 bands45b.py <dir with the ten WAVs>
import sys, glob, subprocess, numpy as np
def bands(x, sr):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; f = np.fft.rfftfreq(len(x), 1 / sr); t = X.sum() + 1e-20
    b = lambda a, c: round(float(X[(f >= a) & (f < c)].sum() / t * 100), 1)
    return {'<100': b(0, 100), '<150': b(0, 150), '>3k': b(3000, 24000), '3-8k': b(3000, 8000), '>8k': b(8000, 24000)}
def clicks(x, sr):
    d2 = np.abs(np.diff(x, 2)); w = int(sr * 0.005)
    k = np.ones(2 * w + 1); k[w - 1:w + 2] = 0; k /= k.sum()
    loc = np.sqrt(np.convolve(d2 * d2, k, mode='same')) + 1e-9
    hits = np.where((d2 > 8 * loc) & (d2 > 0.01))[0]
    keep = []
    for h in hits:
        if not keep or h - keep[-1] > sr * 0.02: keep.append(h)
    return [round(h / sr, 2) for h in keep]
for w in sorted(glob.glob(sys.argv[1] + '/*.wav')):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', w, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], capture_output=True)
    st = np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64); sr = 48000
    q = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', w, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True).stderr.decode()
    s = q[q.rfind('Summary:'):]; I = s.split('I:')[1].split()[0]; TP = s.split('Peak:')[1].split()[0]
    m = st.mean(1)
    print(f"{w.split('/')[-1][:44]:44} I {I:>6} TP {TP:>5}  {bands(m, sr)}  clicks {len(clicks(m, sr))} {clicks(m, sr)[:8]}")
