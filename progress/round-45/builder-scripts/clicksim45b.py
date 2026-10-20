# Round 45 builder: offline check of sharp sprite samples against the click detector. Each sample (with a linear onset
# ramp and an optional biquad lowpass, as the game plays it) is mixed at its in-game level into a real flight bed from
# the main capture, and the critic's detector runs on the mix. usage: python3 clicksim45b.py <rawdir>
import sys, json, subprocess, numpy as np
raw = sys.argv[1]; sr = 48000
tl = json.load(open(f'{raw}/main-s22-timeline.json')); t0 = tl['t0']
bg = ((np.fromfile(f'{raw}/main-s22-L.f32', dtype=np.float32) + np.fromfile(f'{raw}/main-s22-R.f32', dtype=np.float32)) / 2).astype(np.float64)
a = int((60.0 - t0 + 0.1707) * sr); bg = bg[a:a + sr]
p = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'public/assets/audio/sfx.mp3', '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'], capture_output=True)
spr = np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)
src = open('src/systems/sfxSprite.ts').read(); tab = json.loads(src.split('SPRITE: Record<string, { o: number; d: number; loop: boolean }> = ')[1].rsplit(';', 1)[0])
def lowpass(x, fc, q=0.7071):
    w0 = 2 * np.pi * fc / sr; al = np.sin(w0) / (2 * q); c = np.cos(w0)
    b0, b1, b2, a0, a1, a2 = (1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2, x1, y2, y1 = x1, v, y1, o; y[i] = o
    return y
def clicks(x):
    d2 = np.abs(np.diff(x, 2)); w = int(sr * 0.005)
    k = np.ones(2 * w + 1); k[w - 1:w + 2] = 0; k /= k.sum()
    loc = np.sqrt(np.convolve(d2 * d2, k, mode='same')) + 1e-9
    return int(np.sum((d2 > 8 * loc) & (d2 > 0.01)))
for name, gain, att, lp in [('latch', 0.6, 0.003, 0), ('latch', 0.6, 0.005, 6000), ('latch', 0.6, 0.006, 5000), ('clunk', 0.45, 0.003, 0), ('clunk', 0.45, 0.005, 0), ('unlatch', 0.5, 0.003, 0), ('unlatch', 0.5, 0.005, 6000), ('tick0', 0.9, 0.003, 7500), ('tick1', 1.1, 0.003, 7500), ('box', 0.3, 0.004, 3000), ('thud', 0.8, 0.004, 0), ('knock0', 0.8, 0.003, 0), ('select', 0.55, 0, 0), ('select', 0.55, 0.003, 0), ('scrape0', 0.9, 0, 0), ('grit1', 0.9, 0, 0), ('crunch', 0.9, 0, 3800), ('back', 0.6, 0, 0), ('toggle', 0.5, 0, 0), ('error', 0.35, 0, 0)]:
    s = tab[name]; i = int(round(s['o'] * sr)); x = spr[i:i + int(s['d'] * sr)].copy() * gain
    if lp: x = lowpass(x, lp)
    if att: n = int(att * sr); x[:n] *= np.linspace(0, 1, n)
    m = bg.copy(); m[12000:12000 + len(x)] += x * 1.24  # bus to master (master gain x comp x trim, measured ~1.24)
    print(f'{name:8} gain {gain} att {att*1000:.0f}ms lp {lp:5}  clicks {clicks(m) - clicks(bg)}')
