# Round 45 audio critic: decode every Kenney Ogg with ffmpeg and describe its envelope and spectrum.
# usage: python3 -I kenney45.py <kenney-audio dir> <out tsv>
import sys, os, subprocess
import numpy as np
root, out = sys.argv[1], sys.argv[2]
SR = 48000
rows = []
for dp, dn, fn in os.walk(root):
    for f in sorted(fn):
        if not f.endswith('.ogg'):
            continue
        p = os.path.join(dp, f)
        raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
        x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
        if len(x) < 100:
            continue
        pk = np.max(np.abs(x)); dur = len(x) / SR
        env = np.sqrt(np.convolve(x * x, np.ones(240) / 240, mode='same'))  # 5 ms RMS
        ip = int(np.argmax(env)); att = ip / SR
        thr = env[ip] * 10 ** (-30 / 20)
        after = np.where(env[ip:] < thr)[0]
        dec = (after[0] / SR) if len(after) else (len(x) - ip) / SR
        # active part (above -40 dB of peak env)
        act = env > env[ip] * 0.01
        rms = 20 * np.log10(np.sqrt(np.mean(x[act] ** 2)) + 1e-12)
        X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; fr = np.fft.rfftfreq(len(x), 1 / SR); tot = X.sum() + 1e-20
        b = lambda a, c: X[(fr >= a) & (fr < c)].sum() / tot * 100
        cen = (X * fr).sum() / tot
        # brightness first vs last third of the active part (rising / falling sweep)
        ia = np.where(act)[0]; seg = x[ia[0]:ia[-1] + 1]; n3 = max(256, len(seg) // 3)
        def cent(s):
            S = np.abs(np.fft.rfft(s * np.hanning(len(s)))) ** 2; fq = np.fft.rfftfreq(len(s), 1 / SR); return (S * fq).sum() / (S.sum() + 1e-20)
        c1, c2 = cent(seg[:n3]), cent(seg[-n3:])
        f0 = fr[np.argmax(X * (fr > 60))]
        rows.append((os.path.basename(dp), f[:-4], dur, 20 * np.log10(pk + 1e-12), rms, att * 1000, dec * 1000, cen, c1, c2, f0, b(0, 150), b(150, 3000), b(3000, 6000), b(6000, 24000)))
with open(out, 'w') as o:
    o.write('pack\tname\tdur_s\tpeak_db\trms_db\tattack_ms\tdecay30_ms\tcentroid_hz\tcent_start\tcent_end\tpeak_hz\tlow150\tmid150_3k\tup3_6k\thi6k\n')
    for r in rows:
        o.write('\t'.join([r[0], r[1]] + [f'{v:.3f}' if i < 1 else f'{v:.1f}' if i < 6 else f'{v:.0f}' if i < 10 else f'{v:.1f}' for i, v in enumerate(r[2:])]) + '\n')
print(len(rows), 'files')
