# Fine alignment: full cross-correlation (FFT) of the waveform, true file vs a wrong file as control.
exec(open('progress/round-45/critic-scripts/spritecheck45c.py').read().split('rows = []')[0])
def xc(a, b):
    n = len(a) + len(b); N = 1 << int(np.ceil(np.log2(n)))
    c = np.fft.irfft(np.fft.rfft(a, N) * np.conj(np.fft.rfft(b, N)), N)
    # normalise by local energy of a
    e = np.sqrt(np.convolve(a * a, np.ones(len(b)), mode='full')[len(b) - 1:len(b) - 1 + len(a)]) + 1e-12
    c = c[:len(a)] / (e * np.linalg.norm(b) + 1e-12)
    return float(np.max(c))
names = list(SP); good = []; ctrl = []
for i, name in enumerate(names):
    s = SP[name]
    a0 = int((s['o'] + delay - 0.03) * SR); a1 = int((s['o'] + delay + s['d'] + 0.03) * SR); seg = spr[a0:a1]
    for which, nm in (('true', name), ('ctrl', names[(i + 7) % len(names)])):
        path, *part = src[nm]; x = dec(path, *(part if part else [None, None]))
        L = min(len(x) - 96, int(min(s['d'], 0.6) * SR) - 96); probe = x[96 + (int(0.35 * SR) if SP[nm]['loop'] else 0):][:L]
        v = xc(seg, probe)
        (good if which == 'true' else ctrl).append((name, nm, round(v, 3)))
for g, c in zip(good, ctrl): print('%-8s true %.3f   vs %-8s %.3f' % (g[0], g[2], c[1], c[2]))
print('true min %.3f, control max %.3f' % (min(g[2] for g in good), max(c[2] for c in ctrl)))
